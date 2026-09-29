import { and, desc, eq, gte, lte } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import {
  approvals, calendarEvents, chatMessages, emailItems, goals, tasks,
} from "@/db/schema";
import Chat from "@/components/Chat";
import { Badge, Card, DemoTag, Icon, Progress, RiskBadge, StatusDot } from "@/components/ui";
import type { ChatContent } from "@/lib/types";

export const dynamic = "force-dynamic";

const fmtTime = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }).replace(" ", "");

export default async function Home() {
  const now = new Date();
  const [msgs, dayStart] = await Promise.all([
    db.select().from(chatMessages).orderBy(chatMessages.createdAt).limit(40),
    (async () => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; })(),
  ]);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const [todays, emails, pending, goalRows, dueSoon, allGoalTasks] = await Promise.all([
    db.select().from(calendarEvents).where(and(gte(calendarEvents.startsAt, dayStart), lte(calendarEvents.startsAt, dayEnd), eq(calendarEvents.status, "confirmed"))).orderBy(calendarEvents.startsAt),
    db.select().from(emailItems).where(eq(emailItems.read, false)).orderBy(desc(emailItems.ts)).limit(12),
    db.select().from(approvals).where(eq(approvals.status, "pending")).orderBy(approvals.createdAt),
    db.select().from(goals).where(eq(goals.status, "active")),
    db.select().from(tasks).where(and(gte(tasks.deadline, now), lte(tasks.deadline, new Date(now.getTime() + 48 * 3600e3)), eq(tasks.status, "planned"))).orderBy(tasks.deadline).limit(3),
    db.select().from(tasks),
  ]);

  const importantEmails = emails.filter((e) => e.classification === "critical" || e.classification === "important");
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-[24px] font-semibold tracking-tight text-ink">{greeting}, Aarav</h1>
            <DemoTag />
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · {pending.length} approval{pending.length === 1 ? "" : "s"} waiting · {importantEmails.length} important email{importantEmails.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="hidden items-center gap-2 text-[11px] text-faint md:flex">
          <Icon name="orbit" size={13} className="text-accent" />
          Plan · Policy · Approve · Execute · Audit
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        <Card className="flex min-h-0 flex-col p-3.5 md:p-4" glow>
          <Chat
            initialMessages={msgs.map((m) => ({
              id: m.id, role: m.role, content: m.content as ChatContent,
              createdAt: (m.createdAt ?? new Date()).toISOString(), runId: m.runId,
            }))}
          />
        </Card>

        <div className="space-y-3">
          <Card className="p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Today</div>
              <Link href="/calendar" className="text-[11px] text-accent hover:underline">Calendar →</Link>
            </div>
            <div className="space-y-1.5">
              {todays.slice(0, 4).map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-[86px] shrink-0 font-mono text-[11px] text-muted">{fmtTime(e.startsAt)}–{fmtTime(e.endsAt)}</span>
                  <span className="truncate text-ink">{e.title}</span>
                </div>
              ))}
              {todays.length === 0 && <div className="text-[12.5px] text-faint">No events scheduled today.</div>}
              {dueSoon.slice(0, 2).map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-[12px]">
                  <StatusDot tone="warn" pulse />
                  <span className="truncate text-muted">{t.title}</span>
                  <span className="ml-auto shrink-0 text-[10.5px] text-warn">due {t.deadline ? fmtTime(t.deadline) : ""}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-3.5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Important emails</div>
            <div className="space-y-1.5">
              {importantEmails.slice(0, 3).map((e) => (
                <div key={e.id} className="flex items-start gap-2 text-[12.5px]">
                  <Icon name="mail" size={12} className="mt-0.5 shrink-0 text-faint" />
                  <span className="truncate text-ink">{e.subject}</span>
                  <Badge tone={e.classification === "critical" ? "danger" : "info"} className="ml-auto shrink-0">{e.classification}</Badge>
                </div>
              ))}
              {importantEmails.length === 0 && <div className="text-[12.5px] text-faint">Inbox triaged — nothing important unread.</div>}
            </div>
          </Card>

          <Card className="p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Pending approvals</div>
              <Link href="/approvals" className="text-[11px] text-accent hover:underline">All →</Link>
            </div>
            <div className="space-y-1.5">
              {pending.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-[12.5px]">
                  <StatusDot tone="warn" pulse />
                  <span className="truncate text-ink">{p.action}</span>
                  <span className="ml-auto shrink-0"><RiskBadge risk={p.riskLevel} /></span>
                </div>
              ))}
              {pending.length === 0 && <div className="text-[12.5px] text-faint">All clear — nothing waiting on you.</div>}
            </div>
          </Card>

          <Card className="p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Active goals</div>
              <Link href="/goals" className="text-[11px] text-accent hover:underline">Goals →</Link>
            </div>
            <div className="space-y-3">
              {goalRows.map((g) => {
                const gTasks = allGoalTasks.filter((t) => t.goalId === g.id);
                const completedCount = gTasks.filter((t) => t.status === "completed").length;
                const pointsSum = gTasks.reduce((acc, t) => acc + (t.status === "completed" ? (t.points ?? 0) : 0), 0);
                const currentVal = g.unit === "points"
                  ? (pointsSum > 0 ? pointsSum : (g.currentValue ?? 0))
                  : (gTasks.length > 0 ? completedCount : (g.currentValue ?? 0));
                const pct = Math.round((currentVal / (g.targetValue || (gTasks.length || 1))) * 100);
                return (
                  <div key={g.id}>
                    <div className="mb-1 flex items-center justify-between text-[12.5px]">
                      <span className="text-ink">{g.title}</span>
                      <span className="font-display text-[12px] text-muted">{currentVal}/{g.targetValue} <span className="text-faint">{g.unit}</span></span>
                    </div>
                    <Progress value={pct} tone={pct >= 70 ? "ok" : "accent"} />
                  </div>
                );
              })}
              {goalRows.length === 0 && (
                <div className="text-[12px] text-faint">No active goals yet. Ask Orbit to set up your Stride goal!</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
