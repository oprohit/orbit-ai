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

  const view: GoalView[] = rows.map((g) => {
    const goalTasks = allTasks.filter((t) => t.goalId === g.id);
    const completedTasksCount = goalTasks.filter((t) => t.status === "completed").length;
    const pointsSum = goalTasks.reduce((acc, t) => acc + (t.status === "completed" ? (t.points ?? 0) : 0), 0);

    const currentValue = g.unit === "points"
      ? (pointsSum > 0 ? pointsSum : (g.currentValue ?? 0))
      : (goalTasks.length > 0 ? completedTasksCount : (g.currentValue ?? 0));

    const pendingTask = goalTasks.find((t) => t.status !== "completed");
    const nextAction = pendingTask
      ? pendingTask.title
      : (goalTasks.length > 0 && completedTasksCount === goalTasks.length ? "All objectives completed! 🎉" : g.nextAction);

    return {
      id: g.id,
      title: g.title,
      description: g.description,
      status: currentValue >= (g.targetValue || (goalTasks.length || 1)) ? "completed" : g.status,
      deadline: g.deadline ? g.deadline.toISOString() : null,
      targetValue: g.targetValue,
      currentValue,
      unit: g.unit,
      aiReasoning: g.aiReasoning,
      nextAction,
      sources: g.sources,
      milestones: ms.filter((m) => m.goalId === g.id).map((m) => ({ id: m.id, title: m.title, detail: m.detail, status: m.status })),
      tasks: goalTasks.map((t) => ({ id: t.id, title: t.title, status: t.status, deadline: t.deadline ? t.deadline.toISOString() : null, points: t.points })),
    };
  });
  return <GoalsBoard goals={view} />;
}
