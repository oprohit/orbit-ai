import { and, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents } from "@/db/schema";
import CalendarBoard from "@/components/CalendarBoard";
import type { EventView } from "@/components/CalendarBoard";

export const dynamic = "force-dynamic";

const dayLabel = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

export default async function CalendarPage() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const rows = await db.select().from(calendarEvents).where(and(gte(calendarEvents.startsAt, start), lte(calendarEvents.startsAt, end)));
  const toView = (r: (typeof rows)[number]): EventView => ({
    id: r.id, title: r.title, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt.toISOString(),
    calendar: r.calendar, source: r.source, status: r.status,
  });

  const groups = [0, 1, 2, 3, 4, 5, 6].map((off) => {
    const d = new Date(start);
    d.setDate(d.getDate() + off);
    const label = off === 0 ? `Today — ${dayLabel(d)}` : off === 1 ? `Tomorrow — ${dayLabel(d)}` : dayLabel(d);
    return {
      label,
      events: rows.filter((r) => r.startsAt.toDateString() === d.toDateString()).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()).map(toView),
    };
  });
  return <CalendarBoard groups={groups} />;
}
