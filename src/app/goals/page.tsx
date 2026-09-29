import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { goalMilestones, goals, tasks } from "@/db/schema";
import GoalsBoard from "@/components/GoalsBoard";
import type { GoalView } from "@/components/GoalsBoard";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const rows = await db.select().from(goals).orderBy(asc(goals.createdAt));
  const ms = await db.select().from(goalMilestones).orderBy(asc(goalMilestones.seq));
  const allTasks = await db.select().from(tasks);

  const view: GoalView[] = rows.map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description,
    status: g.status,
    deadline: g.deadline ? g.deadline.toISOString() : null,
    targetValue: g.targetValue,
    currentValue: g.currentValue,
    unit: g.unit,
    aiReasoning: g.aiReasoning,
    nextAction: g.nextAction,
    sources: g.sources,
    milestones: ms.filter((m) => m.goalId === g.id).map((m) => ({ id: m.id, title: m.title, detail: m.detail, status: m.status })),
    tasks: allTasks.filter((t) => t.goalId === g.id).map((t) => ({ id: t.id, title: t.title, status: t.status, deadline: t.deadline ? t.deadline.toISOString() : null, points: t.points })),
  }));
  return <GoalsBoard goals={view} />;
}
