import { randomUUID } from "crypto";
import { and, desc, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  automations, calendarEvents, documents, emailItems, expenseTransactions,
  goals, jobResults, notifications, skills, tasks,
} from "@/db/schema";
import type { ToolResult } from "./types";

export const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
export const fmtTime = (d: Date) =>
  d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }).replace(" ", "");
export const at = (days: number, h: number, m = 0) => {
  const t = new Date();
  t.setDate(t.getDate() + days);
  t.setHours(h, m, 0, 0);
  return t;
};
export const nextFriday = () => {
  const t = new Date();
  const add = (5 - t.getDay() + 7) % 7 || 7;
  t.setDate(t.getDate() + add);
  t.setHours(23, 59, 0, 0);
  return t;
};

type Ctx = { runId?: string | null; goalId?: string | null; taskId?: string | null };

/**
 * Demo tool executor. Every branch here is a *simulated connector* — the code path,
 * policy check, approval and audit behaviour is identical to a live OAuth tool.
 */
export async function runTool(toolId: string, params: Record<string, any>, _ctx?: Ctx): Promise<ToolResult> {
  switch (toolId) {
    /* ── Tasks ─────────────────────────────────────────── */
    case "task.create": {
      const id = randomUUID();
      const row = {
        id,
        title: String(params.title ?? "New task"),
        description: params.description ? String(params.description) : null,
        goalId: params.goalId ?? null,
        priority: params.priority ?? "medium",
        deadline: params.deadline ?? null,
        status: params.status ?? "planned",
        source: params.source ?? "Agent",
        createdBy: "agent",
        points: params.points ?? null,
      };
      await db.insert(tasks).values(row);
      return { ok: true, summary: `Task created: ${row.title}`, data: row };
    }

    /* ── Gmail ─────────────────────────────────────────── */
    case "gmail.search": {
      const rows = await db.select().from(emailItems).orderBy(desc(emailItems.ts)).limit(10);
      return { ok: true, summary: `Found ${rows.length} recent messages`, data: rows };
    }
    case "gmail.read": {
      const rows = await db.select().from(emailItems).where(eq(emailItems.classification, "important")).limit(5);
      return { ok: true, summary: `Read ${rows.length} important messages`, data: rows };
    }
    case "gmail.classify": {
      const rows = await db.select().from(emailItems).orderBy(desc(emailItems.ts));
      const counts = rows.reduce<Record<string, number>>((acc, r) => {
        const c = r.classification ?? "routine";
        acc[c] = (acc[c] ?? 0) + 1;
        return acc;
      }, {});
      return { ok: true, summary: `Classified ${rows.length} messages: ${JSON.stringify(counts)}`, data: rows };
    }
    case "gmail.draft": {
      const to = String(params.to ?? "");
      const subject = String(params.subject ?? "Draft from Orbit AI");
      const body = String(params.body ?? "");
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      try {
        await db.insert(emailItems).values({
          id: `draft-${Date.now()}`,
          subject: `[Draft] ${subject}`,
          from: "me",
          snippet: body.slice(0, 100),
          classification: "routine",
          read: true,
          ts: new Date(),
        }).onConflictDoNothing();
      } catch {}

      try {
        await fetch("http://127.0.0.1:38291/mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, subject, body }),
          signal: AbortSignal.timeout(1500),
        });
      } catch {}

      return {
        ok: true,
        summary: `Draft prepared for ${to || "recipient"}: “${subject}”`,
        data: { to, subject, body, gmailUrl },
      };
    }
    case "gmail.send": {
      const to = String(params.to ?? "");
      const subject = String(params.subject ?? "Message from Orbit AI");
      const body = String(params.body ?? "");
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      try {
        await db.insert(emailItems).values({
          id: `sent-${Date.now()}`,
          subject: `[Sent] ${subject}`,
          from: "me",
          snippet: body.slice(0, 100),
          classification: "routine",
          read: true,
          ts: new Date(),
        }).onConflictDoNothing();
      } catch {}

      try {
        await fetch("http://127.0.0.1:38291/mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, subject, body }),
          signal: AbortSignal.timeout(1500),
        });
      } catch {}

      return { ok: true, summary: `Email sent to ${to || "recipient"}`, data: { to, subject, gmailUrl } };
    }
    case "gmail.label": {
      return { ok: true, summary: `Label “${params.label}” applied to ${params.count ?? 1} messages` };
    }

    /* ── Calendar ─────────────────────────────────────── */
    case "calendar.read": {
      const start = new Date();
      start.setDate(start.getDate() - 1);
      const end = new Date();
      end.setDate(end.getDate() + 7);
      const rows = await db.select().from(calendarEvents).where(and(gte(calendarEvents.startsAt, start), lte(calendarEvents.startsAt, end), eq(calendarEvents.status, "confirmed"))).orderBy(calendarEvents.startsAt);
      return { ok: true, summary: `${rows.length} upcoming events`, data: rows };
    }
    case "calendar.availability": {
      const off = Number(params.dayOffset ?? 0);
      const start = at(off, Number(params.hour ?? 9), Number(params.minute ?? 0));
      const dur = Number(params.durationMin ?? 60);
      const end = new Date(start.getTime() + dur * 60000);
      const dayStart = new Date(start);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const rows = (await db.select().from(calendarEvents).where(and(gte(calendarEvents.startsAt, dayStart), lte(calendarEvents.startsAt, dayEnd), eq(calendarEvents.status, "confirmed")))).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      const overlaps = rows.filter((r) => r.startsAt < end && r.endsAt > start);
      const before = rows.filter((r) => r.endsAt <= start).slice(-1)[0];
      const after = rows.find((r) => r.startsAt >= end);
      return {
        ok: true,
        summary: overlaps.length ? `Conflict: ${overlaps.map((o) => o.title).join(", ")}` : "Slot is free",
        data: {
          free: overlaps.length === 0,
          start, end,
          conflicts: overlaps,
          before: before ?? null,
          after: after ?? null,
        },
      };
    }
    case "calendar.create": {
      const id = randomUUID();
      const startsAt: Date = new Date(params.startsAt as string | number);
      const endsAt: Date = new Date(params.endsAt as string | number);
      await db.insert(calendarEvents).values({ id, title: String(params.title), startsAt, endsAt, calendar: "Personal", source: "Orbit", status: "confirmed" });
      return { ok: true, summary: `Event created: ${params.title}`, data: { id, title: params.title, startsAt, endsAt } };
    }
    case "calendar.delete": {
      const rows = await db.update(calendarEvents).set({ status: "cancelled" }).where(eq(calendarEvents.id, String(params.id))).returning();
      if (!rows.length) return { ok: false, summary: "Event not found or already cancelled" };
      return { ok: true, summary: `Event cancelled: ${rows[0].title}`, data: { id: rows[0].id, title: rows[0].title, startsAt: rows[0].startsAt, endsAt: rows[0].endsAt } };
    }

    /* ── Drive / Documents ─────────────────────────────── */
    case "drive.search": {
      const q = String(params.query ?? "").toLowerCase();
      const rows = (await db.select().from(documents)).filter((d) => d.name.toLowerCase().includes(q) || d.summary?.toLowerCase().includes(q));
      if (!rows.length) return { ok: true, summary: "No files found in authorized scope", data: [] };
      return {
        ok: true,
        summary: `${rows.length} files found`,
        data: rows.map((d) => ({ name: d.name, folder: d.source ?? "Drive", modified: "2 days ago", score: d.name.toLowerCase().includes(q.split(" ")[0]) ? "98%" : "71%" })),
      };
    }
    case "drive.read":
    case "document.read": {
      const [doc] = await db.select().from(documents).where(eq(documents.id, String(params.id ?? "stride-2026")));
      if (!doc) return { ok: false, summary: "Document not found in authorized scope" };
      return { ok: true, summary: `Read “${doc.name}” (${doc.kind})`, data: { ...doc, extracted: doc.extracted } };
    }

    /* ── Classroom ─────────────────────────────────────── */
    case "classroom.assignments": {
      const rows = await db.select().from(tasks).where(eq(tasks.source, "Classroom")).limit(5);
      return { ok: true, summary: `${rows.length} assignments from Classroom`, data: rows };
    }
    case "classroom.announcements": {
      return { ok: true, summary: "2 announcements: holiday notice, placement circular", data: [] };
    }

    /* ── Search / Web / Media ──────────────────────────── */
    case "jobs.search": {
      const kind = params.kind === "stride" ? "stride" : "jobs";
      if (kind === "stride") {
        const [existing] = await db.select().from(jobResults).where(eq(jobResults.source, "Stride Board"));
        if (!existing) {
          await db.insert(jobResults).values([
            { id: randomUUID(), company: "CodeSpark Hackathon 2026", role: "48-hr hackathon · Technical", location: "COET, Coimbatore", requirements: "Team of 4 · Laptop", source: "Stride Board", link: "https://codespark.example/hack", match: "Technical category — +10 Stride points", points: 10, date: fmtDay(at(2, 9)), deadline: `Register by ${fmtDay(nextFriday())}` },
            { id: randomUUID(), company: "AI/ML Foundations Workshop", role: "Workshop · Academic", location: "Institute auditorium", requirements: "Open to all years", source: "College Events", link: "https://events.example/ml", match: "Academic category — +5 Stride points", points: 5, date: fmtDay(at(5, 10)), deadline: "Seat limit 60" },
            { id: randomUUID(), company: "TechFest ’26 Technical Event", role: "Robotics & quiz · Technical", location: "Sports complex", requirements: "Registration ₹100", source: "TechFest", link: "https://techfest.example", match: "Technical category — +10 Stride points", points: 10, date: fmtDay(at(9, 9)), deadline: `Entry by ${fmtDay(at(6, 23))}` },
            { id: randomUUID(), company: "Community Volunteer Drive", role: "Teaching outreach · Extracurricular", location: "Nearby school", requirements: "4-hour commitment", source: "NSS Cell", link: "https://nss.example", match: "Extracurricular — +5 Stride points", points: 5, date: fmtDay(at(12, 8)), deadline: "Confirm by Sunday" },
          ]);
        }
        const rows = await db.select().from(jobResults).where(eq(jobResults.source, "Stride Board")).orderBy(desc(jobResults.createdAt));
        return { ok: true, summary: "4 Stride opportunities found", data: rows };
      }
      const rows = await db.select().from(jobResults).where(ne(jobResults.source, "Stride Board")).orderBy(desc(jobResults.createdAt));
      const q = String(params.query ?? "").toLowerCase();
      const filtered = rows.filter((r) => !q || `${r.role ?? ""} ${r.company ?? ""} ${r.location ?? ""} ${r.requirements ?? ""}`.toLowerCase().includes(q) || (r.role ?? "").toLowerCase().includes("react") || (r.location ?? "").toLowerCase().includes("remote"));
      return { ok: true, summary: `${filtered.length} matching listings`, data: filtered };
    }
    case "weather.get": {
      const place = String(params.place || "Coimbatore");
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=11.0168&longitude=76.9558&current_weather=true&timezone=auto",
          { signal: AbortSignal.timeout(3000) }
        );
        if (res.ok) {
          const wData = (await res.json()) as any;
          const cur = wData.current_weather;
          const temp = `${cur.temperature}°C`;
          const wind = `${cur.windspeed} km/h`;
          const codes: Record<number, string> = {
            0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
            45: "Fog", 51: "Light drizzle", 61: "Slight rain", 63: "Moderate rain",
            65: "Heavy rain", 80: "Rain showers", 95: "Thunderstorm"
          };
          const sky = codes[cur.weathercode] || "Partly cloudy";
          return {
            ok: true,
            summary: `${place} — ${temp}, ${sky}`,
            data: { place, temp, sky, wind, live: true }
          };
        }
      } catch {}
      return { ok: true, summary: "Coimbatore — 31°C, partly cloudy", data: { place: "Coimbatore", temp: "31°C", sky: "Partly cloudy", wind: "12 km/h" } };
    }
    case "public.joke": {
      try {
        const res = await fetch("https://official-joke-api.appspot.com/random_joke", { signal: AbortSignal.timeout(2500) });
        if (res.ok) {
          const j = await res.json();
          return { ok: true, summary: "Joke", data: { setup: j.setup, punchline: j.punchline } };
        }
      } catch {}
      return { ok: true, summary: "Joke", data: { setup: "Why do programmers prefer dark mode?", punchline: "Because light attracts bugs!" } };
    }
    case "public.advice": {
      try {
        const res = await fetch("https://api.adviceslip.com/advice", { signal: AbortSignal.timeout(2500) });
        if (res.ok) {
          const a = await res.json();
          return { ok: true, summary: "Advice", data: { advice: a.slip?.advice || "Keep learning and building every day." } };
        }
      } catch {}
      return { ok: true, summary: "Advice", data: { advice: "Focus on small consistent daily wins rather than overnight perfection." } };
    }
    case "search.web": {
      return { ok: true, summary: "Search completed (2 sources)", data: [] };
    }
    case "news.search": {
      return { ok: true, summary: "3 headlines retrieved", data: [] };
    }
    case "youtube.search": {
      const q = String(params.query ?? "");
      return {
        ok: true,
        summary: "3 videos found",
        data: [
          { title: `${q || "Topic"} — Full 20-minute explanation`, channel: "DevSimplify", duration: "20:14", why: "Matches requested length, high production quality" },
          { title: `${q || "Topic"} in one sitting (lecture)`, channel: "Abdul Bari", duration: "44:02", why: "Deep dive if you want the theory" },
          { title: `${q || "Topic"} — quick intuition`, channel: "Fireship", duration: "11:31", why: "Fast overview before the long one" },
        ],
      };
    }

    /* ── Desktop Agent (live local companion + fallback) ─────── */
    case "filesystem.scan": {
      try {
        const agentRes = await fetch("http://127.0.0.1:38291/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: params.target || "downloads" }),
          signal: AbortSignal.timeout(3500),
        });
        if (agentRes.ok) {
          const liveData = (await agentRes.json()) as any;
          return {
            ok: true,
            summary: liveData.summary || `Live Scan: ${liveData.fileCount} files (${liveData.totalFormatted})`,
            data: {
              live: true,
              scannedPath: liveData.scannedPath,
              total: liveData.totalFormatted,
              fileCount: liveData.fileCount,
              largeFiles: liveData.largeFiles || [],
            },
          };
        }
      } catch {}

      return {
        ok: true,
        summary: "Scan complete — 4.3 GB reclaimable",
        data: {
          total: "4.3 GB",
          items: [
            { label: "Downloads · temp & installer files", size: "2.4 GB" },
            { label: "Browser cache (safe to clear)", size: "1.1 GB" },
            { label: "Temporary files (%TEMP%)", size: "800 MB" },
          ],
        },
      };
    }
    case "filesystem.archive": {
      return { ok: true, summary: "Files moved to Archive folder (sandbox)" };
    }
    case "filesystem.delete": {
      const freed = params.total ?? "4.3 GB";
      return { ok: true, summary: `Cleanup complete — freed ${freed}. Files were archived to Recycle first (sandbox).`, data: { freed } };
    }
    case "filesystem.create_folder": {
      const folderName = String(params.folderName || "NewFolder");
      const location = String(params.location || "desktop");
      try {
        const agentRes = await fetch("http://127.0.0.1:38291/mkdir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderName, location, openInExplorer: true }),
          signal: AbortSignal.timeout(3500),
        });
        if (agentRes.ok) {
          const liveData = (await agentRes.json()) as any;
          return {
            ok: true,
            summary: liveData.summary || `Created folder "${folderName}" on your ${location}`,
            data: { live: true, folderName, path: liveData.path },
          };
        }
      } catch {}

      return {
        ok: true,
        summary: `Created folder "${folderName}" on your ${location}`,
        data: { folderName, location },
      };
    }

    /* ── Payments (sandbox PSP only) ───────────────────── */
    case "payment.prepare": {
      return { ok: true, summary: `Transaction prepared: ₹${params.amount} → ${params.recipient} (sandbox UPI)`, data: { recipient: params.recipient, amount: params.amount, purpose: params.purpose } };
    }
    case "payment.execute": {
      const ref = `UPI${Date.now().toString().slice(-8)}`;
      return { ok: true, summary: `Payment of ₹${params.amount} to ${params.recipient} completed (sandbox PSP) — ref ${ref}`, data: { ref, recipient: params.recipient, amount: params.amount } };
    }

    /* ── System ────────────────────────────────────────── */
    case "expense.query": {
      const now = new Date();
      const curMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const rows = (await db.select().from(expenseTransactions)).filter((t) => t.ts >= prevMonth);
      const sum = (arr: typeof rows) => arr.reduce((a, t) => a + Number(t.amount), 0);
      const byCat = (from: Date, to: Date) => {
        const m: Record<string, number> = {};
        rows.filter((t) => t.ts >= from && t.ts <= to).forEach((t) => { m[t.category] = (m[t.category] ?? 0) + Number(t.amount); });
        return m;
      };
      const cur = byCat(curMonth, new Date());
      const prev = byCat(prevMonth, prevEnd);
      return { ok: true, summary: `Spent ₹${sum(rows.filter((t) => t.ts >= curMonth))} this month`, data: { cur, prev, curTotal: sum(rows.filter((t) => t.ts >= curMonth)), prevTotal: sum(rows.filter((t) => t.ts < curMonth)) } };
    }
    case "notification.create": {
      await db.insert(notifications).values({ id: randomUUID(), kind: params.kind ?? "info", title: String(params.title), body: params.body ?? null, read: false, link: params.link ?? null });
      return { ok: true, summary: "Notification created" };
    }
    case "approval.check": {
      return { ok: true, summary: "Checked pending approvals" };
    }
    case "skill.toggle": {
      const id = String(params.id ?? "");
      const status = params.status === "disabled" ? "disabled" : "enabled";
      const name = String(params.name ?? id);
      await db.update(skills).set({ status }).where(eq(skills.id, id));
      return { ok: true, summary: `Skill "${name}" ${status}`, data: { id, status } };
    }
    case "automation.toggle": {
      const id = String(params.id ?? "");
      const enabled = !!params.enabled;
      const name = String(params.name ?? id);
      await db.update(automations).set({ enabled }).where(eq(automations.id, id));
      return { ok: true, summary: `Automation "${name}" ${enabled ? "enabled" : "disabled"}`, data: { id, enabled } };
    }
    case "job.apply": {
      const role = String(params.role ?? "Position");
      const company = String(params.company ?? "Company");
      const followUp = at(3, 10, 0);
      await db.insert(tasks).values({
        id: randomUUID(),
        title: `Follow up on application: ${role} at ${company}`,
        description: "Application submitted via Orbit in background. Check portal / email for reply.",
        priority: "medium",
        deadline: followUp,
        status: "waiting",
        source: "Orbit Application",
        createdBy: "agent",
      });
      const allGoals = await db.select().from(goals);
      const internGoal = allGoals.find((g) => /react|intern/i.test(g.title));
      if (internGoal) {
        const nv = Math.min((internGoal.targetValue || 10), (internGoal.currentValue ?? 0) + 1);
        await db.update(goals).set({ currentValue: nv, updatedAt: new Date() }).where(eq(goals.id, internGoal.id));
      }
      await db.insert(notifications).values({
        id: randomUUID(),
        kind: "job",
        title: `Applied to ${role}`,
        body: `Orbit submitted your application to ${company} in background. Follow-up task scheduled for ${fmtDay(followUp)}.`,
        read: false,
        link: "/tasks",
      });
      return {
        ok: true,
        summary: `Successfully applied to ${role} at ${company} in background`,
        data: { role, company, followUp: fmtDay(followUp) },
      };
    }
    default:
      return { ok: false, summary: `No executor registered for ${toolId}` };
  }
}

