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

      case "goal.create": {
        const goalTitle = (b.title || b.goal || "New Strategic Goal").trim();
        const goalId = b.id || randomUUID();
        const deadline = b.deadline ? new Date(b.deadline) : new Date(Date.now() + 180 * 86400000);
        const subtasksList = Array.isArray(b.subtasks) ? b.subtasks : [];
        const phasesList = Array.isArray(b.phases) ? b.phases : [];
        const targetValue = typeof b.targetValue === "number" ? b.targetValue : (subtasksList.length || 4);

        // Check if goal with identical title already exists
        const existingGoals = await db.select().from(goals).where(eq(goals.title, goalTitle));
        if (existingGoals.length > 0 && existingGoals[0].status === "active") {
          return NextResponse.json({ ok: true, goalId: existingGoals[0].id, title: goalTitle, alreadyActive: true });
        }

        // 1. Insert into goals table
        await db.insert(goals).values({
          id: goalId,
          title: goalTitle,
          description: b.description || `Active strategic goal: ${goalTitle}. Decomposed into structured milestone phases and scheduled preparation subtasks.`,
          status: "active",
          deadline,
          targetValue,
          currentValue: 0,
          unit: b.unit || "tasks",
          aiReasoning: b.aiReasoning || `Goal activated from research & study plan. Decomposed into milestone roadmap and scheduled tasks.`,
          nextAction: b.nextAction || (subtasksList[0]?.title ?? "Begin Phase 1 foundations"),
          sources: ["User Goal"],
        });

        // 2. Insert milestones into goalMilestones table
        if (phasesList.length > 0) {
          for (const [i, p] of phasesList.entries()) {
            await db.insert(goalMilestones).values({
              id: randomUUID(),
              goalId,
              title: p.name || p.title || `Phase ${i + 1}`,
              detail: p.focus || p.detail || "",
              seq: i,
              status: i === 0 ? "in_progress" : "pending",
            });
          }
        } else if (Array.isArray(b.milestones) && b.milestones.length > 0) {
          for (const [i, m] of b.milestones.entries()) {
            await db.insert(goalMilestones).values({
              id: randomUUID(),
              goalId,
              title: typeof m === "string" ? m : m.title,
              detail: typeof m === "object" ? m.detail || "" : "",
              seq: i,
              status: i === 0 ? "in_progress" : "pending",
            });
          }
        } else {
          // Default milestones for comprehensive goal
          const defaultMs = [
            ["Phase 1: High-Yield Foundations", "Core concepts, fundamental theory, and diagnostic baseline"],
            ["Phase 2: Core Engineering & Systems", "In-depth problem solving, algorithms, and application"],
            ["Phase 3: Topic-wise PYQs & Practice", "Solve previous questions and timed exercises"],
            ["Phase 4: Full-Length Diagnostic Mocks", "Simulated mock assessments under exam conditions"],
          ];
          for (const [i, [title, detail]] of defaultMs.entries()) {
            await db.insert(goalMilestones).values({
              id: randomUUID(),
              goalId,
              title,
              detail,
              seq: i,
              status: i === 0 ? "in_progress" : "pending",
            });
          }
        }

        // 3. Insert subtasks into tasks table with goalId
        if (subtasksList.length > 0) {
          for (const [i, st] of subtasksList.entries()) {
            const taskDeadline = new Date(Date.now() + (i + 1) * 3 * 86400000);
            await db.insert(tasks).values({
              id: randomUUID(),
              goalId,
              title: typeof st === "string" ? st : st.title,
              priority: (typeof st === "object" && st.weight?.toLowerCase()?.includes("crucial")) || i === 0 ? "high" : "medium",
              status: "inbox",
              deadline: taskDeadline,
              source: "Goal Subtask",
            });
          }
        } else {
          // Default subtasks if none passed
          const defaultTasks = [
            { title: `Download official ${goalTitle} syllabus & create weightage matrix`, priority: "high", days: 1 },
            { title: `Complete curated introductory foundational lecture series`, priority: "high", days: 3 },
            { title: `Solve last 15 years topic-wise previous year questions (PYQs)`, priority: "high", days: 5 },
            { title: `Attempt full-length timed diagnostic mocks`, priority: "high", days: 7 },
          ];
          for (const t of defaultTasks) {
            await db.insert(tasks).values({
              id: randomUUID(),
              goalId,
              title: t.title,
              priority: t.priority,
              status: "inbox",
              deadline: new Date(Date.now() + t.days * 86400000),
              source: "Goal Subtask",
            });
          }
        }

        await db.insert(notifications).values({
          id: randomUUID(),
          kind: "goal_milestone",
          title: `Goal Activated: ${goalTitle}`,
          body: `Added to your Active Goals board with milestones and subtasks.`,
          read: false,
          link: "/goals",
        });

        await logAudit({
          action: `goal.created — ${goalTitle}`,
          goalId,
          authorization: "allowed",
          resultSummary: `Active goal created with milestones and subtasks`,
        });

        return NextResponse.json({ ok: true, goalId, title: goalTitle });
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
