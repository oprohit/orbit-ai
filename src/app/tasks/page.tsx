import { desc } from "drizzle-orm";
import { db } from "@/db";
import { goals, tasks } from "@/db/schema";
import TasksBoard from "@/components/TasksBoard";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const rows = await db.select().from(tasks).orderBy(desc(tasks.createdAt)).limit(60);
  const goalRows = await db.select().from(goals);
  const goalTitle = (id: string | null) => goalRows.find((g) => g.id === id)?.title ?? null;

  const view = rows.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    deadline: t.deadline ? t.deadline.toISOString() : null,
    status: t.status,
    source: t.source,
    points: t.points,
    goalTitle: t.goalId ? goalTitle(t.goalId) : null,
  }));
  return <TasksBoard tasks={view} />;
}
