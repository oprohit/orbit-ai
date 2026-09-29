import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/db";
import {
  automations, connectors, expenseTransactions, goals, goalMilestones, memoryEntries,
  notifications, profiles, skills, tasks,
} from "@/db/schema";
import { execTool, createApproval } from "@/lib/executor";
import { runTool } from "@/lib/tools";
import { resetPolicies, setPolicy } from "@/lib/policy";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const a = b?.action;
    const id = typeof b?.id === "string" ? b.id : "";

    switch (a) {
      case "task.status": {
        const [t] = await db.select().from(tasks).where(eq(tasks.id, id));
        if (!t) return NextResponse.json({ error: "task not found" }, { status: 404 });
        const done = b.status === "completed";
        await db.update(tasks).set({
          status: b.status,
          completedAt: done ? new Date() : null,
        }).where(eq(tasks.id, id));

        // Sync Goal progress if this task is linked to a goal
        if (t.goalId) {
          const [g] = await db.select().from(goals).where(eq(goals.id, t.goalId));
          if (g) {
            const allGoalTasks = await db.select().from(tasks).where(eq(tasks.goalId, g.id));
            const completedCount = allGoalTasks.filter((item) => 
              (item.id === t.id ? b.status : item.status) === "completed"
            ).length;

            const pointsSum = allGoalTasks.reduce((sum, item) => {
              const st = item.id === t.id ? b.status : item.status;
              return sum + (st === "completed" ? (item.points ?? 0) : 0);
            }, 0);

            const nv = g.unit === "points" ? pointsSum : completedCount;
            const nextPending = allGoalTasks.find((item) => 
              (item.id === t.id ? b.status : item.status) !== "completed"
            );
            const nextAction = nextPending ? nextPending.title : "All objectives completed! 🎉";

            await db.update(goals).set({
              currentValue: nv,
              nextAction,
              status: nv >= (g.targetValue || allGoalTasks.length) ? "completed" : "active",
              updatedAt: new Date(),
            }).where(eq(goals.id, g.id));

            // Proportional milestone progress
            const ms = await db.select().from(goalMilestones).where(eq(goalMilestones.goalId, g.id)).orderBy(asc(goalMilestones.seq));
            if (ms.length > 0) {
              const totalTasks = Math.max(1, allGoalTasks.length);
              const msToComplete = Math.floor((completedCount / totalTasks) * ms.length);
              for (let i = 0; i < ms.length; i++) {
                const targetStatus = i < msToComplete ? "done" : (i === msToComplete && completedCount < totalTasks ? "in_progress" : "pending");
                if (ms[i].status !== targetStatus) {
                  await db.update(goalMilestones).set({ status: targetStatus }).where(eq(goalMilestones.id, ms[i].id));
                }
              }
            }

            if (done && t.points) {
              await db.insert(notifications).values({ 
                id: randomUUID(), 
                kind: "goal_milestone", 
                title: `Stride progress: +${t.points} pts`, 
                body: `Completed “${t.title}” — goal now at ${nv} points.`, 
                read: false, 
                link: "/goals" 
              });
            } else if (done) {
              await db.insert(notifications).values({ 
                id: randomUUID(), 
                kind: "goal_milestone", 
                title: `Goal progress: ${completedCount}/${g.targetValue ?? allGoalTasks.length}`, 
                body: `Completed “${t.title}” in ${g.title}.`, 
                read: false, 
                link: "/goals" 
              });
            }
          }
        }

        await logAudit({ action: `task.status — ${t.title} → ${b.status}`, taskId: id, authorization: "allowed" });
        return NextResponse.json({ ok: true });
      }

      case "task.delete": {
        const [t] = await db.select().from(tasks).where(eq(tasks.id, id));
        if (!t) return NextResponse.json({ error: "task not found" }, { status: 404 });
        await db.delete(tasks).where(eq(tasks.id, id));
        await logAudit({ action: `task.deleted — ${t.title}`, taskId: id, authorization: "allowed" });
        return NextResponse.json({ ok: true, deleted: true, id });
      }

      case "goal.subtask": {
        const goalId = b.goalId || id;
        const [g] = await db.select().from(goals).where(eq(goals.id, goalId));
        if (g) {
          const newCurrent = typeof b.currentValue === "number" ? b.currentValue : (g.currentValue ?? 0) + (b.completed ? 1 : -1);
          const target = g.targetValue || 110;
          const capped = Math.max(0, Math.min(target, newCurrent));
          const isCompleted = capped >= target;
          await db.update(goals).set({
            currentValue: capped,
            status: isCompleted ? "completed" : "active",
            nextAction: b.nextAction || g.nextAction,
            updatedAt: new Date(),
          }).where(eq(goals.id, goalId));

          if (b.subtaskTitle && b.completed) {
            await db.insert(notifications).values({
              id: randomUUID(),
              kind: "goal_milestone",
              title: `Subtask Done: ${b.subtaskTitle}`,
              body: `Completed in ${g.title} · ${capped}/${target} subtasks accomplished!`,
              read: false,
              link: "/goals",
            });
          }
          await logAudit({ action: `goal.subtask — ${b.subtaskTitle || "topic"} (${capped}/${target})`, goalId, authorization: "allowed" });
          return NextResponse.json({ ok: true, currentValue: capped });
        }
        return NextResponse.json({ error: "goal not found" }, { status: 404 });
      }

      case "task.create": {
        if (!b.title) return NextResponse.json({ error: "title required" }, { status: 400 });
        const res = await execTool("task.create", { title: b.title, description: b.description ?? null, priority: b.priority ?? "medium", deadline: b.deadline ?? null, status: "inbox", source: "User" }, { reason: "Manual task from UI" });
        return NextResponse.json(res);
      }

      case "milestone": {
        const [m] = await db.select().from(goalMilestones).where(eq(goalMilestones.id, id));
        if (m) {
          await db.update(goalMilestones).set({ status: b.status }).where(eq(goalMilestones.id, id));
          if (m.goalId) {
            const allMs = await db.select().from(goalMilestones).where(eq(goalMilestones.goalId, m.goalId));
            const doneMs = allMs.filter((item) => (item.id === m.id ? b.status : item.status) === "done").length;
            const [g] = await db.select().from(goals).where(eq(goals.id, m.goalId));
            if (g && g.unit === "tasks") {
              const allGoalTasks = await db.select().from(tasks).where(eq(tasks.goalId, g.id));
              const completedTasksCount = allGoalTasks.filter((t) => t.status === "completed").length;
              const val = Math.max(completedTasksCount, doneMs);
              await db.update(goals).set({ currentValue: val, updatedAt: new Date() }).where(eq(goals.id, g.id));
            }
          }
        }
        return NextResponse.json({ ok: true });
      }

      case "skill": {
        const [sk] = await db.select().from(skills).where(eq(skills.id, id));
        const newStatus = b.status === "disabled" ? "disabled" : "enabled";
        const name = sk?.name || id;
        const action = `${newStatus === "disabled" ? "Disable" : "Enable"} skill — ${name}`;
        const approval = await createApproval({
          toolId: "skill.toggle",
          action,
          params: { id, name, status: newStatus },
          reason: `You requested to ${newStatus} the skill “${name}”. Skills change agent capabilities and require confirmation.`,
          riskLevel: "medium",
        });
        return NextResponse.json({ ok: true, approvalRequired: true, approvalId: approval.id, action });
      }

      case "automation": {
        const [auto] = await db.select().from(automations).where(eq(automations.id, id));
        const willEnable = !!b.enabled;
        const name = auto?.name || id;
        const action = `${willEnable ? "Enable" : "Disable"} automation — ${name}`;
        const approval = await createApproval({
          toolId: "automation.toggle",
          action,
          params: { id, name, enabled: willEnable },
          reason: `You requested to ${willEnable ? "enable" : "disable"} the automation “${name}”. Automations run recurring scheduled tasks and require confirmation.`,
          riskLevel: "medium",
        });
        return NextResponse.json({ ok: true, approvalRequired: true, approvalId: approval.id, action });
      }

      case "job.apply": {
        const res = await runTool("job.apply", { role: b.role, company: b.company });
        await logAudit({ action: `job.apply — ${b.role} at ${b.company}`, authorization: "allowed" });
        return NextResponse.json(res);
      }

      case "policy": {
        if (!b.toolId || !["allow", "ask", "block"].includes(b.level)) return NextResponse.json({ error: "toolId and level required" }, { status: 400 });
        await setPolicy(b.toolId, b.level);
        return NextResponse.json({ ok: true });
      }

      case "policy.reset": {
        await resetPolicies();
        return NextResponse.json({ ok: true });
      }

      case "memory": {
        if (!b.key || !b.value) return NextResponse.json({ error: "key and value required" }, { status: 400 });
        const existing = await db.select().from(memoryEntries).where(eq(memoryEntries.key, b.key));
        if (existing.length) await db.update(memoryEntries).set({ value: b.value }).where(eq(memoryEntries.key, b.key));
        else await db.insert(memoryEntries).values({ id: randomUUID(), key: b.key, value: b.value, kind: b.kind ?? "preference" });
        return NextResponse.json({ ok: true });
      }

      case "memory.delete": {
        await db.delete(memoryEntries).where(eq(memoryEntries.id, id));
        return NextResponse.json({ ok: true });
      }

      case "notification.read": {
        if (id) await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
        else await db.update(notifications).set({ read: true });
        return NextResponse.json({ ok: true });
      }

      case "expense.add": {
        if (!b.amount || !b.category) return NextResponse.json({ error: "amount and category required" }, { status: 400 });
        await db.insert(expenseTransactions).values({ id: randomUUID(), ts: new Date(b.ts ?? Date.now()), amount: Number(b.amount), category: b.category, merchant: b.merchant ?? null, note: b.note ?? null });
        await logAudit({ action: `expense.add — ₹${b.amount} (${b.category})`, authorization: "allowed" });
        return NextResponse.json({ ok: true });
      }

      case "profile.flags": {
        const [p] = await db.select().from(profiles).where(eq(profiles.id, "u1"));
        if (p) await db.update(profiles).set({ flags: { ...(p.flags ?? {}), ...(b.flags ?? {}) } }).where(eq(profiles.id, "u1"));
        await logAudit({ action: "profile.flags.updated", authorization: "approved", inputSummary: b.flags });
        return NextResponse.json({ ok: true });
      }

      case "profile.update": {
        const profileId = id || "u1";
        const [p] = await db.select().from(profiles).where(eq(profiles.id, profileId));
        if (p) {
          await db.update(profiles).set({
            name: b.name ? String(b.name).trim() : p.name,
            email: b.email ? String(b.email).trim() : p.email,
            timezone: b.timezone ? String(b.timezone).trim() : p.timezone,
          }).where(eq(profiles.id, profileId));
        } else {
          await db.insert(profiles).values({
            id: profileId,
            name: b.name ? String(b.name).trim() : "User",
            email: b.email ? String(b.email).trim() : null,
            timezone: b.timezone ? String(b.timezone).trim() : "Asia/Kolkata",
          });
        }
        await logAudit({ action: `profile.update — name: ${b.name}`, authorization: "allowed" });
        return NextResponse.json({ ok: true, name: b.name });
      }

      case "connector.revoke": {
        await db.update(connectors).set({ status: "available", connectedAt: null, lastSync: null }).where(eq(connectors.id, id));
        await logAudit({ action: `connector.revoked — ${id}`, connectorId: id, authorization: "approved" });
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: `unknown action: ${a}` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
