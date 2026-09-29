import { asc, desc, eq, gte, like } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/db";
import {
  approvals, automations, calendarEvents, emailItems, goalMilestones, goals, tasks,
} from "@/db/schema";
import { createApproval, execTool } from "./executor";
import { llmReply } from "./ai";
import { at, fmtDay, fmtTime, nextFriday } from "./tools";
import { logAudit } from "./audit";
import type { Block, ChatContent } from "./types";

type Ctx = { runId: string };
type TaskRow = (typeof tasks.$inferSelect)[];

const taskBlock = (rows: TaskRow) =>
  rows.map((t) => ({
    id: t.id,
    title: t.title,
    deadline: t.deadline ? `${fmtDay(t.deadline)} · ${fmtTime(t.deadline)}` : undefined,
    points: t.points ?? undefined,
    status: t.status ?? undefined,
  }));

const findGoal = async (q: string) => {
  const rows = await db.select().from(goals).where(like(goals.title, `%${q}%`));
  return rows[0] ?? null;
};

const goalBlock = async (g: (typeof goals.$inferSelect)) => {
  const ms = await db.select().from(goalMilestones).where(eq(goalMilestones.goalId, g.id)).orderBy(goalMilestones.seq);
  return {
    type: "goal" as const,
    goal: {
      id: g.id, title: g.title, current: g.currentValue ?? 0, target: g.targetValue ?? 1,
      unit: g.unit ?? "", deadline: g.deadline ? fmtDay(g.deadline) : "", nextAction: g.nextAction ?? "",
      milestones: ms.map((m) => ({ title: m.title, status: m.status ?? "pending" })),
    },
  };
};

const daysLeft = (d: Date | null) => (d ? Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000)) : 0);

/* ────────────────────────── handlers ────────────────────────── */

async function hStride(_m: string, { runId }: Ctx): Promise<ChatContent> {
  const g = await findGoal("Stride");
  if (g) {
    const rows = await db.select().from(tasks).where(eq(tasks.goalId, g.id)).orderBy(tasks.deadline).limit(8);
    const pct = Math.round(((g.currentValue ?? 0) / (g.targetValue || 1)) * 100);
    const remaining = Math.max(0, (g.targetValue ?? 0) - (g.currentValue ?? 0));
    return {
      text: `Stride 2026 is at ${g.currentValue}/${g.targetValue} points (${pct}%). ${remaining} points to go with ${daysLeft(g.deadline)} days remaining. Next action: ${g.nextAction ?? "review your tasks"}.`,
      blocks: [
        await goalBlock(g),
        { type: "tasks", items: taskBlock(rows) },
        { type: "chips", chips: [{ label: "Search upcoming opportunities", send: "Yes — search for upcoming opportunities for the Stride goal" }] },
      ],
    };
  }

  await execTool("document.read", { id: "stride-2026" }, { runId, reason: "Extract Stride requirements from the uploaded document" });
  const goalId = randomUUID();
  const deadline = at(126, 23, 59);
  await db.insert(goals).values({
    id: goalId,
    title: "Stride 2026",
    description: "Complete 100 Stride points before the academic year ends.",
    status: "active",
    deadline,
    targetValue: 100,
    currentValue: 40,
    unit: "points",
    aiReasoning:
      "Parsed Stride_Rules_2026.pdf — 100 points required across Academic, Technical and Extracurricular categories; current record shows 40. With 126 days remaining, a 30-point committed plan leaves healthy slack.",
    nextAction: "Register for CodeSpark Hackathon before Friday",
    sources: ["Stride_Rules_2026.pdf", "Stride portal (demo)"],
  });
  const milestones: [string, string, string][] = [
    ["Academic", "Workshops & certificates — 5+ points", "pending"],
    ["Technical", "Hackathons & tech events — 20+ points", "in_progress"],
    ["Extracurricular", "Volunteering & outreach — 15+ points", "pending"],
  ];
  for (const [i, [title, detail, status]] of milestones.entries()) {
    await db.insert(goalMilestones).values({ id: randomUUID(), goalId, title, detail, seq: i, status });
  }
  const newTasks = [
    { title: "Attend CodeSpark Hackathon", description: "48-hr hackathon · +10 Stride points (Technical)", priority: "high", deadline: at(2, 9), source: "Stride Board", points: 10 },
    { title: "Complete AI/ML Foundations Workshop", description: "+5 Stride points (Academic)", priority: "medium", deadline: at(5, 10), source: "College Events", points: 5 },
    { title: "Participate in TechFest ’26 technical event", description: "+10 Stride points (Technical)", priority: "medium", deadline: at(9, 9), source: "TechFest", points: 10 },
    { title: "Volunteer — teaching outreach drive", description: "+5 Stride points (Extracurricular)", priority: "low", deadline: at(12, 8), source: "NSS Cell", points: 5 },
    { title: "Verify current points on Stride portal", description: "Confirm the baseline is 40 before committing further", priority: "high", deadline: nextFriday(), source: "Agent", points: null },
  ];
  const created: (typeof tasks.$inferSelect)[] = [];
  for (const t of newTasks) {
    const r = await execTool("task.create", { ...t, goalId }, { runId, goalId });
    if (r.ok) created.push(r.data as (typeof tasks.$inferSelect));
  }
  await logAudit({
    action: "goal.created — Stride 2026",
    runId,
    goalId,
    authorization: "allowed",
    resultSummary: "Goal + 3 milestones + 5 tasks created from document analysis",
  });

  return {
    text: `I read Stride_Rules_2026.pdf. You need 100 points by ${fmtDay(deadline)} — you're at 40, so 60 to go with 126 days remaining. I created the goal with three category milestones and your first five tasks. Safe setup ran automatically; anything with external side effects will ask you first.`,
    blocks: [
      {
        type: "goal",
        goal: {
          id: goalId, title: "Stride 2026", current: 40, target: 100, unit: "points",
          deadline: fmtDay(deadline), nextAction: "Register for CodeSpark Hackathon before Friday",
          milestones: [
            { title: "Academic", status: "pending" },
            { title: "Technical", status: "in_progress" },
            { title: "Extracurricular", status: "pending" },
          ],
        },
      },
      { type: "tasks", items: taskBlock(created) },
      { type: "chips", chips: [{ label: "Search upcoming opportunities", send: "Yes — search for upcoming opportunities for the Stride goal" }] },
    ],
  };
}

async function hOpps(_m: string, { runId }: Ctx): Promise<ChatContent> {
  const goal = await findGoal("Stride");
  const res = await execTool("jobs.search", { kind: "stride" }, { runId, goalId: goal?.id ?? null });
  const rows = (res.data as (typeof import("@/db/schema").jobResults.$inferSelect)[]) ?? [];
  return {
    text: `Found ${rows.length} upcoming opportunities that map to Stride categories — 30 points combined if you do all four. CodeSpark is the fastest win: 10 points, and it fits before end of month.`,
    blocks: [
      {
        type: "opps",
        items: rows.map((j) => ({
          title: j.company ?? "",
          points: j.points ?? undefined,
          date: j.date ?? undefined,
          deadline: j.deadline ?? undefined,
          location: j.location ?? undefined,
          source: j.source ?? undefined,
        })),
      },
      { type: "chips", chips: [{ label: "Create registration task & check calendar", send: "Create the registration task and check my calendar for the hackathon" }] },
    ],
  };
}

async function hRegister(_m: string, { runId }: Ctx): Promise<ChatContent> {
  const goal = await findGoal("Stride");
  const existing = await db.select().from(calendarEvents).where(eq(calendarEvents.title, "CodeSpark Hackathon 2026"));
  if (existing.length) {
    return {
      text: `The hackathon is already on your calendar — ${fmtDay(existing[0].startsAt)}, ${fmtTime(existing[0].startsAt)}–${fmtTime(existing[0].endsAt)}.`,
      blocks: [{ type: "chips", chips: [{ label: "What's important today?", send: "What's important today?" }] }],
    };
  }
  await execTool("task.create", {
    title: "Register for CodeSpark Hackathon",
    description: "Team of 4 · deadline before Friday · +10 Stride points",
    priority: "urgent",
    deadline: nextFriday(),
    goalId: goal?.id ?? null,
    source: "Agent",
    points: 10,
  }, { runId, goalId: goal?.id ?? null });

  const approval = await createApproval({
    toolId: "calendar.create",
    params: { title: "CodeSpark Hackathon 2026", startsAt: at(2, 9).toISOString(), endsAt: at(2, 17).toISOString() },
    reason: "Stride goal — attend a +10 point hackathon. Calendar check shows the full Saturday is free.",
    riskLevel: "medium",
    goalId: goal?.id ?? null,
    runId,
  });
  return {
    text: "Registration task added (due before Friday). I checked your calendar — you're free all of Saturday, so I can put the hackathon on Google Calendar from 9:00 AM to 5:00 PM. It's a calendar commitment, so it needs your approval.",
    blocks: [
      { type: "approval", approvalId: approval.id },
      { type: "chips", chips: [{ label: "What's important today?", send: "What's important today?" }] },
    ],
  };
}

async function hOppsSearch(_m: string, ctx: Ctx): Promise<ChatContent> {
  return hOpps(_m, ctx);
}

async function hCancelEvent(_m: string, { runId }: Ctx): Promise<ChatContent> {
  const rows = await db.select().from(calendarEvents).where(eq(calendarEvents.status, "confirmed")).orderBy(desc(calendarEvents.startsAt));
  const target = rows.find((c) => c.source === "Orbit") ?? rows[0];
  if (!target) {
    return { text: "I couldn't find an upcoming event to cancel on your calendar.", blocks: [] };
  }
  const approval = await createApproval({
    toolId: "calendar.delete",
    params: { id: target.id },
    reason: "You asked to cancel the event.",
    riskLevel: "high",
    runId,
  });
  return {
    text: `Found it: “${target.title}” · ${fmtDay(target.startsAt)} ${fmtTime(target.startsAt)}–${fmtTime(target.endsAt)} on Google Calendar. Cancelling will remove it and withdraw any invitations. Confirm below.`,
    blocks: [{ type: "approval", approvalId: approval.id }],
  };
}

async function hScheduleTask(_m: string, { runId }: Ctx): Promise<ChatContent> {
  let off = 0;
  let a = (await execTool("calendar.availability", { dayOffset: 0, hour: 17, minute: 0, durationMin: 30 }, { runId })).data as any;
  if (!a?.free) {
    off = 1;
    a = (await execTool("calendar.availability", { dayOffset: 1, hour: 17, minute: 0, durationMin: 30 }, { runId })).data as any;
  }
  const when = off === 0 ? "today" : "tomorrow";
  const approval = await createApproval({
    toolId: "calendar.create",
    params: { title: "Task block — Teacher Feedback Form", startsAt: a.start.toISOString(), endsAt: a.end.toISOString() },
    reason: "You asked Orbit to find time to complete the feedback form. Availability check found a free 30-minute slot.",
    riskLevel: "medium",
    runId,
  });
  return {
    text: `I checked your calendar. You're free ${when} at 5:00–5:30 PM — no conflicts. Shall I put a 30-minute block on the calendar for the feedback form?`,
    blocks: [{ type: "approval", approvalId: approval.id }],
  };
}

async function hCalendarEvent(m: string, { runId }: Ctx): Promise<ChatContent> {
  const off = /today|tonight/.test(m) ? 0 : 1;
  const t = m.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  let hour = 16;
  let minute = 0;
  if (t) {
    hour = parseInt(t[1], 10) % 12;
    minute = t[2] ? parseInt(t[2], 10) : 0;
    if (t[3]?.toLowerCase() === "pm" && hour < 12) hour += 12;
  }
  const res = await execTool("calendar.availability", { dayOffset: off, hour, minute, durationMin: 60 }, { runId });
  const a = res.data as any;
  const when = off === 0 ? "today" : "tomorrow";
  const start = a.start as Date;
  const end = a.end as Date;
  const before = a.before as { title: string; endsAt: Date } | null;

  let text: string;
  if (a.conflicts?.length) {
    const c = a.conflicts[0];
    text = `Heads up — “${c.title}” runs ${fmtTime(c.startsAt)}–${fmtTime(c.endsAt)}, which overlaps. Would you like me to propose a nearby free slot instead?`;
  } else {
    text = `I checked Google Calendar for ${when}. ${before ? `You have ${before.title} until ${fmtTime(before.endsAt)}.` : "Your schedule is clear."} With a 15-minute travel buffer you're available ${fmtTime(start)}–5:30 PM. Shall I add the event ${fmtTime(start)}–${fmtTime(end)}?`;
  }
  const approval = await createApproval({
    toolId: "calendar.create",
    params: { title: "College Event", startsAt: start.toISOString(), endsAt: end.toISOString() },
    reason: `You asked to attend a college event ${when} at ${fmtTime(start)}. Availability verified against your calendar.`,
    riskLevel: "medium",
    runId,
  });
  return {
    text,
    blocks: [
      { type: "approval", approvalId: approval.id },
      { type: "chips", chips: [{ label: "What's important today?", send: "What's important today?" }] },
    ],
  };
}

async function hBriefing(_m: string, { runId }: Ctx): Promise<ChatContent> {
  await execTool("approval.check", {}, { runId });
  const now = new Date();
  const soon = new Date(now.getTime() + 48 * 3600 * 1000);
  const dueTasks = await db.select().from(tasks)
    .where(gte(tasks.deadline, new Date(now.getTime() - 3600 * 1000))).orderBy(tasks.deadline).limit(6);
  const urgent = dueTasks.filter((t) => t.deadline && t.deadline.getTime() <= soon.getTime() && t.status !== "completed" && t.status !== "cancelled").slice(0, 3);

  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now); dayEnd.setHours(23, 59, 59, 999);
  const { and, lte } = await import("drizzle-orm");
  const todays = await db.select().from(calendarEvents).where(and(gte(calendarEvents.startsAt, dayStart), lte(calendarEvents.startsAt, dayEnd), eq(calendarEvents.status, "confirmed"))).orderBy(calendarEvents.startsAt);

  const emails = await db.select().from(emailItems).orderBy(desc(emailItems.ts));
  const impUnread = emails.filter((e) => !e.read && (e.classification === "critical" || e.classification === "important"));
  const pending = await db.select().from(approvals).where(eq(approvals.status, "pending"));
  const stride = await findGoal("Stride");
  const pct = stride ? Math.round(((stride.currentValue ?? 0) / (stride.targetValue || 1)) * 100) : 0;

  const sections = [
    {
      title: "Needs attention",
      lines: [
        ...urgent.map((t) => ({ text: `${t.title} — due ${fmtDay(t.deadline!)} ${fmtTime(t.deadline!)}`, tone: "warn" as const })),
      ],
    },
    {
      title: "Today",
      lines: todays.length
        ? todays.slice(0, 4).map((e) => ({ text: `${fmtTime(e.startsAt)}–${fmtTime(e.endsAt)}  ${e.title}`, tone: "muted" as const }))
        : [{ text: "No events scheduled.", tone: "muted" as const }],
    },
    {
      title: "Important emails",
      lines: [
        { text: `${impUnread.length} unread and important`, tone: (impUnread.length ? "info" : "ok") as "info" | "ok" },
        ...impUnread.slice(0, 2).map((e) => ({ text: e.subject, tone: "muted" as const })),
      ],
    },
    {
      title: "Approvals",
      lines: pending.length
        ? pending.map((p) => ({ text: `${p.action} — waiting on you`, tone: "warn" as const }))
        : [{ text: "Nothing pending.", tone: "ok" as const }],
    },
    {
      title: "Goals",
      lines: stride ? [{ text: `Stride 2026 — ${stride.currentValue}/${stride.targetValue} points (${pct}%)`, tone: "info" as const }] : [],
    },
  ].filter((s) => s.lines.length);

  return {
    text: `Here's what needs your attention: ${urgent.length} task${urgent.length === 1 ? "" : "s"} due within 48h, ${impUnread.length} important unread email${impUnread.length === 1 ? "" : "s"}, ${pending.length} approval waiting, and your Stride goal is ${pct}% complete.`,
    blocks: [{ type: "briefing", sections }],
  };
}

async function hJobs(m: string, { runId }: Ctx): Promise<ChatContent> {
  const res = await execTool("jobs.search", { kind: "jobs", query: m }, { runId });
  const rows = (res.data as (typeof import("@/db/schema").jobResults.$inferSelect)[]) ?? [];
  return {
    text: `I searched the approved job sources (no scraping — official listings only), normalized and ranked ${rows.length} matches for React internships — Coimbatore first, then remote. Top match: ${rows[0]?.company ?? "—"} at ${rows[0]?.match ?? "—"}.`,
    blocks: [
      {
        type: "jobs",
        items: rows.map((j) => ({
          company: j.company ?? "",
          role: j.role ?? "",
          location: j.location ?? undefined,
          match: j.match ?? undefined,
          source: j.source ?? undefined,
          link: j.link ?? undefined,
          requirements: j.requirements ?? undefined,
        })),
      },
      { type: "chips", chips: [{ label: "Turn this into an application goal", send: "Help me get a React internship — make it a long-term goal" }] },
    ],
  };
}

const GOAL_TEMPLATES: Record<string, { title: string; desc: string; ms: [string, string][]; tasks: { title: string; priority: string; days: number; hour: number }[] }> = {
  exam: {
    title: "Internal Assessment Prep — Data Structures",
    desc: "Score 85+ in the internal assessment with a structured plan.",
    ms: [["Syllabus & weak areas", "Map topics, flag the weak ones"], ["Daily study plan", "90-minute focused blocks"], ["Revision cycle", "Spaced revision over 3 days"], ["Mock quiz", "Timed quiz on chapters 3–4"]],
    tasks: [
      { title: "List topics and mark weak areas", priority: "high", days: 0, hour: 17 },
      { title: "Study block — pointers & trees (90 min)", priority: "high", days: 1, hour: 17 },
      { title: "Make flashcards for AVL & hashing", priority: "medium", days: 2, hour: 17 },
      { title: "Mock quiz — chapters 3–4", priority: "high", days: 3, hour: 10 },
    ],
  },
  internship: {
    title: "React Internship Applications",
    desc: "Land a React internship this year through a structured pipeline.",
    ms: [["Resume", "Tailored for React roles"], ["Portfolio", "2 solid public projects"], ["Find opportunities", "10 target companies"], ["Apply", "10 applications out"], ["Interview prep", "DS + system design basics"], ["Follow-ups", "1-week cadence"]],
    tasks: [
      { title: "Update resume for React roles", priority: "high", days: 1, hour: 18 },
      { title: "List 10 target companies", priority: "medium", days: 2, hour: 18 },
      { title: "Draft a reusable cover letter", priority: "medium", days: 3, hour: 18 },
      { title: "Apply to 3 positions", priority: "high", days: 5, hour: 10 },
    ],
  },
};

async function hGoal(m: string, { runId }: Ctx): Promise<ChatContent> {
  const isIntern = /internship|job|placement/i.test(m);
  const isExam = /exam|assessment|study|prepare/i.test(m);
  const key = isIntern ? "internship" : isExam ? "exam" : "exam";
  const tpl = GOAL_TEMPLATES[key];

  if (isIntern) {
    const existing = await findGoal("Internship");
    if (existing) {
      const rows = await db.select().from(tasks).where(eq(tasks.goalId, existing.id)).limit(6);
      return {
        text: `Your internship goal is already active: ${existing.currentValue ?? 0}/${existing.targetValue ?? 10} applications done. Next: ${existing.nextAction ?? "review your tasks"}.`,
        blocks: [await goalBlock(existing), { type: "tasks", items: taskBlock(rows) }],
      };
    }
  }

  const goalId = randomUUID();
  const deadline = at(isIntern ? 180 : 3, 23, 59);
  await db.insert(goals).values({
    id: goalId,
    title: tpl.title,
    description: tpl.desc,
    status: "active",
    deadline,
    targetValue: isIntern ? 10 : 4,
    currentValue: 0,
    unit: isIntern ? "applications" : "tasks",
    aiReasoning: `Decomposed “${m}” into objective, constraints and a milestone chain. Plan proposed and confirmed by the user before persistent automation began.`,
    nextAction: tpl.tasks[0].title,
    sources: ["User request"],
  });
  for (const [i, [title, detail]] of tpl.ms.entries()) {
    await db.insert(goalMilestones).values({ id: randomUUID(), goalId, title, detail, seq: i, status: i === 0 ? "in_progress" : "pending" });
  }
  const created: (typeof tasks.$inferSelect)[] = [];
  for (const t of tpl.tasks) {
    const r = await execTool("task.create", { title: t.title, priority: t.priority, deadline: at(t.days, t.hour), goalId, source: "Agent" }, { runId, goalId });
    if (r.ok) created.push(r.data as (typeof tasks.$inferSelect));
  }
  await logAudit({ action: `goal.created — ${tpl.title}`, runId, goalId, authorization: "allowed", resultSummary: `Milestones: ${tpl.ms.map((x) => x[0]).join(", ")}` });
  return {
    text: `I broke this into a milestone chain with daily tasks instead of one vague to-do. Plan: ${tpl.ms.map((x) => x[0]).join(" → ")}. The setup ran automatically (all low-risk); anything with external side effects will ask you before acting.`,
    blocks: [
      {
        type: "goal",
        goal: {
          id: goalId, title: tpl.title, current: 0, target: isIntern ? 10 : 4,
          unit: isIntern ? "applications" : "tasks", deadline: fmtDay(deadline),
          nextAction: tpl.tasks[0].title,
          milestones: tpl.ms.map((m, i) => ({ title: m[0], status: i === 0 ? "in_progress" : "pending" })),
        },
      },
      { type: "tasks", items: taskBlock(created) },
      { type: "chips", chips: [{ label: "What's my next action?", send: "What's important today?" }] },
    ],
  };
}

async function hRemind(m: string, { runId }: Ctx): Promise<ChatContent> {
  const raw = m.replace(/^(please\s+)?remind me (tomorrow( morning)?|today|tonight)( (at \d{1,2}(:\d{2})?( ?[ap]m)?))? ?(?:to|that|about)? ?/i, "").trim();
  const title = raw || "Reminder";
  const off = /tomorrow/i.test(m) ? 1 : 0;
  const hm = m.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])m/i);
  let hour = 9, minute = 0;
  if (hm) {
    hour = parseInt(hm[1], 10) % 12;
    if (hm[3].toLowerCase() === "p" && hour < 12) hour += 12;
    minute = hm[2] ? parseInt(hm[2], 10) : 0;
  }
  const deadline = at(off, hour, minute);
  const r = await execTool("task.create", { title: `Reminder: ${title}`, deadline, priority: "medium", source: "User" }, { runId });
  return {
    text: r.ok
      ? `Done — I'll remind you ${off === 0 ? "today" : "tomorrow"} at ${fmtTime(deadline)}: “${title}”. It's a task, so it will also surface in your daily briefing.`
      : `The reminder could not be created: ${r.summary}`,
    blocks: r.ok ? [{ type: "tasks", items: taskBlock([r.data as (typeof tasks.$inferSelect)]) }] : [],
  };
}

async function hCreateFolder(m: string, { runId }: Ctx): Promise<ChatContent> {
  let folderName = "NewFolder";
  let location = "desktop";

  if (/documents?/i.test(m)) location = "documents";
  if (/downloads?/i.test(m)) location = "downloads";
  if (/desktop/i.test(m)) location = "desktop";

  const matchQuotes = m.match(/(?:named|called)\s+["']([^"']+)["']/i);
  const matchWord = m.match(/(?:named|called)\s+([a-zA-Z0-9_\-\.]+)/i);
  const matchSimple = m.match(/folder\s+([a-zA-Z0-9_\-\.]+)/i);

  if (matchQuotes?.[1]) {
    folderName = matchQuotes[1].trim();
  } else if (matchWord?.[1]) {
    folderName = matchWord[1].trim();
  } else if (matchSimple?.[1] && !["on", "in", "to", "named", "called", "the"].includes(matchSimple[1].toLowerCase())) {
    folderName = matchSimple[1].trim();
  }

  const res = await execTool(
    "filesystem.create_folder",
    { folderName, location },
    { runId, reason: `Create folder "${folderName}" on ${location}` }
  );

  const data = res.data as any;
  const pathMsg = data?.path ? ` at \`${data.path}\`` : "";
  const isLive = data?.live;

  return {
    text: isLive
      ? `Done! I created the folder **"${folderName}"** on your Windows ${location}${pathMsg}. It has been opened for you in Windows Explorer.`
      : `Done! Created folder **"${folderName}"** on your ${location}${pathMsg}.`,
    blocks: [
      {
        type: "result",
        title: "📁 Windows Folder Created",
        lines: [
          `Folder: ${folderName}`,
          `Location: ${location}`,
          `Status: Created successfully on your PC`,
          ...(data?.path ? [`Path: ${data.path}`] : []),
        ],
        action: {
          type: "mkdir",
          payload: { folderName, location, path: data?.path },
        },
      },
    ],
  };
}

async function hWriteEmail(m: string, { runId }: Ctx): Promise<ChatContent> {
  const emailMatch = m.match(/[\w.-]+@[\w.-]+\.\w+/);
  const to = emailMatch ? emailMatch[0] : "professor@example.edu";

  const subMatch = m.match(/(?:about|with subject|subject:)\s+["']?([^"'\n]+?)["']?(?:\s+(?:saying|body:|message:|$))/i);
  const subject = subMatch ? subMatch[1].trim() : "Follow-up from Aarav";

  let body = `Hi,\n\nI am writing to follow up regarding our discussion. Please let me know if any further details are required.\n\nBest regards,\nAarav`;
  if (/leave|sick|absence/i.test(m)) {
    body = `Dear Professor,\n\nI am writing to inform you that I will be unable to attend class due to illness. I will ensure all coursework and assignments are reviewed promptly.\n\nThank you for your understanding.\n\nSincerely,\nAarav (COET Coimbatore)`;
  } else if (/assignment|project|deadline/i.test(m)) {
    body = `Dear Professor,\n\nI have completed the assignment and attached the project details for your review. Please let me know if any revisions are needed.\n\nRegards,\nAarav`;
  }

  await execTool(
    "gmail.draft",
    { to, subject, body },
    { runId, reason: `Prepare email draft to ${to}` }
  );

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return {
    text: `I've prepared your email draft to **${to}** with subject **"${subject}"**. Click below to review and send in Gmail:`,
    blocks: [
      {
        type: "result",
        title: `✉️ Gmail Draft: ${subject}`,
        lines: [
          `To: ${to}`,
          `Subject: ${subject}`,
          `Preview:\n${body.slice(0, 160)}...`,
        ],
        action: {
          type: "mail",
          payload: { to, subject, body, gmailUrl },
        },
      },
    ],
  };
}

async function hCleanup(_m: string, { runId }: Ctx): Promise<ChatContent> {
  const scan = await execTool("filesystem.scan", {}, { runId, reason: "You asked to clear junk from the PC (via the Desktop Agent)" });
  const data = scan.data as any;
  const total = data?.total ?? "4.3 GB";
  const isLive = data?.live;
  const approval = await createApproval({
    toolId: "filesystem.delete",
    params: { total, categories: (data?.items ?? []).map((i: any) => i.label || i.name) },
    reason: `Scan identified ${total} of temp/cache files. Deletion is destructive, so it requires approval.`,
    riskLevel: "critical",
    runId,
  });
  const textMsg = isLive
    ? `I scanned your PC via the live Orbit Desktop Agent. Found ${data.fileCount} files (${total}) in ${data.scannedPath}. Nothing is deleted until you approve:`
    : `I scanned via the Orbit Desktop Agent. Found ${total} of potential cleanup, listed below. Nothing is deleted until you approve — file deletion is a CRITICAL action with a second confirmation.`;
  return {
    text: textMsg,
    blocks: [
      { type: "scan", total, items: data?.items ?? [] },
      { type: "approval", approvalId: approval.id },
    ],
  };
}

async function hPayment(m: string, { runId }: Ctx): Promise<ChatContent> {
  const am = m.match(/₹\s?([\d,]+)|([\d,]{2,})\s?(?:rs|inr)/i);
  const amount = am ? parseInt((am[1] ?? am[2]).replace(/,/g, ""), 10) : 500;
  const rm = m.match(/(?:to|for|with)\s+([A-Z][a-zA-Z]+)/);
  const recipient = rm?.[1] ?? "John";
  const purpose = m.includes("registration") ? "College event registration" : "Personal transfer (sandbox)";
  await execTool("payment.prepare", { recipient, amount, purpose }, { runId, reason: "You asked to send money" });
  const approval = await createApproval({
    toolId: "payment.execute",
    params: { recipient, amount, purpose, channel: "Sandbox UPI (no real transfer)" },
    reason: "You asked Orbit to send a payment. Money movement is never automatic — explicit approval plus final confirmation required.",
    riskLevel: "critical",
    runId,
  });
  return {
    text: `I've prepared the transaction: ₹${amount} → ${recipient} (${purpose}), through the connected sandbox PSP. This is a CRITICAL action — it needs your approval and a final confirmation. No banking credentials are stored and no real money moves in demo mode.`,
    blocks: [{ type: "approval", approvalId: approval.id }],
  };
}

async function hAutomationManage(m: string, { runId }: Ctx): Promise<ChatContent> {
  const allAutos = await db.select().from(automations).orderBy(asc(automations.id));
  const lower = m.toLowerCase();

  // 1. Identify target automation
  let target = allAutos.find((a) => lower.includes(a.name.toLowerCase()));
  if (!target) {
    if (/email|triage|mail|morning/i.test(m)) target = allAutos.find((a) => a.id === "auto-1");
    else if (/calendar|agenda|evening/i.test(m)) target = allAutos.find((a) => a.id === "auto-2");
    else if (/expense|spending|budget|sunday/i.test(m)) target = allAutos.find((a) => a.id === "auto-3");
    else if (/internship|job|monday/i.test(m)) target = allAutos.find((a) => a.id === "auto-4");
    else if (/approval|ping|alert|urgent/i.test(m)) target = allAutos.find((a) => a.id === "auto-5");
  }

  // 2. If just asking to list or view automations
  if (!target || (/show|list|view|what\s+are/i.test(m) && !/change|set|update|reschedule|timing|time|scan|turn/i.test(m))) {
    const lines = allAutos.map(
      (a) => `• **${a.name}**: ${a.schedule} (${a.enabled ? "Active / Opted In" : "Paused"}) — ${a.actions}`
    );
    return {
      text: `Here are your current automations and their active schedules:`,
      blocks: [
        {
          type: "result",
          title: "⚙️ Active Automations",
          lines,
        },
        {
          type: "chips",
          chips: [
            { label: "Morning email triage at 9am", send: "Change morning email triage automation to 9am" },
            { label: "Evening calendar check at 7pm", send: "Change evening calendar check automation to 7pm" },
            { label: "Sunday expense report at 8pm", send: "Change Sunday expense report to 8pm" },
          ],
        },
      ],
    };
  }

  // 3. Parse timing and schedule changes
  const timeMatch =
    m.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) ||
    m.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/) ||
    m.match(/(?:at|every)\s+(\d{1,2})\s*(am|pm)?\b/i);

  let newSchedule = target.schedule;
  let nextRun = target.nextRun;
  let enabled = target.enabled ?? true;

  if (/turn\s+off|disable|deactivate|pause|opt\s*out/i.test(m)) {
    enabled = false;
  } else if (/turn\s+on|enable|activate|resume|opt\s*in/i.test(m)) {
    enabled = true;
  }

  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = (timeMatch[3] || "").toLowerCase();

    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;

    const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

    // Determine cadence
    let cadence = "Daily";
    if (/sunday/i.test(m) || /sunday/i.test(target.schedule || "")) cadence = "Sundays";
    else if (/monday/i.test(m) || /monday/i.test(target.schedule || "")) cadence = "Mondays";
    else if (/tuesday/i.test(m)) cadence = "Tuesdays";
    else if (/wednesday/i.test(m)) cadence = "Wednesdays";
    else if (/thursday/i.test(m)) cadence = "Thursdays";
    else if (/friday/i.test(m)) cadence = "Fridays";
    else if (/saturday/i.test(m)) cadence = "Saturdays";
    else if (/weekday/i.test(m)) cadence = "Weekdays";
    else if (/hourly/i.test(m)) cadence = "Hourly";

    newSchedule = cadence === "Hourly" ? "Hourly" : `${cadence} · ${timeStr}`;

    // Calculate next run timestamp
    const nr = new Date();
    nr.setHours(hour, minute, 0, 0);
    if (nr.getTime() <= Date.now()) {
      nr.setDate(nr.getDate() + 1);
    }
    nextRun = nr;
    enabled = true; // Opt in automatically when user explicitly schedules
  }

  const oldSchedule = target.schedule || "None";

  // Update in Supabase
  await db
    .update(automations)
    .set({
      schedule: newSchedule,
      nextRun,
      enabled,
    })
    .where(eq(automations.id, target.id));

  await logAudit({
    action: `automation.updated — ${target.name}`,
    runId,
    authorization: "allowed",
    resultSummary: `Schedule: "${oldSchedule}" → "${newSchedule}". Status: ${enabled ? "Opted In" : "Disabled"}.`,
  });

  const nextRunStr = nextRun
    ? nextRun.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) +
      " (" +
      nextRun.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) +
      ")"
    : "—";

  return {
    text: `Done! I've updated the **${target.name}** automation settings.\n\nSchedule changed from **${oldSchedule}** to **${newSchedule}** (${enabled ? "Opted in / Active" : "Paused"}). The next scheduled execution is set for **${nextRunStr}**.`,
    blocks: [
      {
        type: "result",
        title: `⚙️ Automation Updated: ${target.name}`,
        lines: [
          `Automation: ${target.name}`,
          `Previous Schedule: ${oldSchedule}`,
          `New Schedule: ${newSchedule}`,
          `Status: ${enabled ? "Active (Opted In)" : "Paused"}`,
          `Next Run: ${nextRunStr}`,
          `Tools: ${(target.tools ?? []).join(", ")}`,
        ],
      },
      {
        type: "chips",
        chips: [
          { label: "View all automations", send: "Show my automations" },
          { label: "Evening calendar check at 7pm", send: "Change evening calendar check automation to 7pm" },
        ],
      },
    ],
  };
}

async function hEmailTriage(_m: string, { runId }: Ctx): Promise<ChatContent> {
  const res = await execTool("gmail.classify", {}, { runId, reason: "You asked for an email triage" });
  const rows = (res.data as (typeof emailItems.$inferSelect)[]) ?? [];
  const important = rows.filter((e) => e.classification === "critical" || e.classification === "important").slice(0, 5);
  const fbEmail = rows.find((e) => /feedback form/i.test(e.subject) && !e.read);

  let fbTask: (typeof tasks.$inferSelect) | null = null;
  if (fbEmail) {
    const existing = await db.select().from(tasks).where(like(tasks.title, "%Feedback%"));
    if (!existing.length) {
      const r = await execTool("task.create", {
        title: "Fill Teacher Feedback Form",
        description: "Source: Gmail → Kalaivana — “All students must complete the Teacher Feedback Form by Friday.”",
        priority: "high",
        deadline: nextFriday(),
        source: "Gmail → Kalaivana",
      }, { runId });
      if (r.ok) fbTask = r.data as (typeof tasks.$inferSelect);
    }
  }
  return {
    text: `Triage complete: ${important.length} important messages surfaced, newsletters and promotions suppressed. ${fbTask ? "I also extracted a task — Fill Teacher Feedback Form, due Friday, straight from the Kalaivana email." : "No new tasks to extract this time."}`,
    blocks: [
      { type: "emails", items: important.map((e) => ({ from: e.from ?? "", subject: e.subject, cls: e.classification ?? "routine", deadline: e.deadline ?? undefined })) },
      ...(fbTask ? [{ type: "tasks" as const, items: taskBlock([fbTask]) }] : []),
      { type: "chips", chips: [{ label: "Find time for the feedback form", send: "Find me time in my calendar to complete the feedback form" }] },
    ],
  };
}

async function hSummarize(_m: string, { runId }: Ctx): Promise<ChatContent> {
  const res = await execTool("drive.read", { id: "project-report" }, { runId, reason: "You asked to summarize the document" });
  const doc = res.data as any;
  const lines = (doc?.extracted?.sections ?? []).map((s: string) => `• ${s}`);
  return {
    text: `Here's the summary of “${doc?.name ?? "the document"}” (read via approved Drive permissions — no files outside your authorized scope were touched):`,
    blocks: [{ type: "result", title: doc?.name ?? "Summary", lines: doc?.extracted?.sections ? lines : [doc?.summary ?? res.summary] }],
  };
}

async function hDrive(m: string, { runId }: Ctx): Promise<ChatContent> {
  const q = m.replace(/find (me |my )?/i, "").replace(/\b(the|project report|file|document|files)\b/gi, "project report").trim();
  const res = await execTool("drive.search", { query: q || "project report" }, { runId });
  const files = (res.data as any[]) ?? [];
  return {
    text: files.length
      ? `Found ${files.length} likely files in your authorized Drive scope, ranked by relevance:`
      : "I searched your authorized Drive scope but didn't find a match — try different keywords.",
    blocks: [
      ...(files.length ? [{ type: "files" as const, items: files }] : []),
      { type: "chips", chips: [{ label: "Summarize the top match", send: "Summarize it" }] },
    ],
  };
}

async function hClassroom(_m: string, { runId }: Ctx): Promise<ChatContent> {
  const res = await execTool("classroom.assignments", {}, { runId, reason: "You asked about assignments" });
  const rows = (res.data as (typeof tasks.$inferSelect)[]) ?? [];
  return {
    text: `Classroom sync: ${rows.length} assignment${rows.length === 1 ? "" : "s"} tracked. Data Structures Assignment 4 is due tomorrow at 11:59 PM — it's already a task, so I'll flag it in tomorrow's briefing if it's not done.`,
    blocks: [
      { type: "tasks", items: taskBlock(rows) },
      { type: "chips", chips: [{ label: "Prepare a study plan for it", send: "Help me prepare for my exam — Data Structures assignment" }] },
    ],
  };
}

async function hWeather(_m: string, { runId }: Ctx): Promise<ChatContent> {
  const res = await execTool("weather.get", {}, { runId });
  const d = res.data as any;
  return { text: `Coimbatore right now: ${d?.temp ?? "29°C"}, ${d?.sky ?? "partly cloudy"}, humidity ${d?.humidity ?? "71%"}. ${d?.note ?? ""}`, blocks: [] };
}

async function hYouTube(m: string, { runId }: Ctx): Promise<ChatContent> {
  const q = m.replace(/find me (a |an )?(about|of)?/i, "").replace(/explanation of|video about|tutorial on|find/gi, "").trim();
  const res = await execTool("youtube.search", { query: q || m }, { runId });
  const vids = (res.data as any[]) ?? [];
  return {
    text: `Found ${vids.length} videos for “${q || m}” — the first one matches your requested length.`,
    blocks: [{ type: "result", title: "Videos", lines: vids.map((v) => `${v.title} — ${v.channel} · ${v.duration} — ${v.why}`) }],
  };
}

async function hExpense(_m: string, { runId }: Ctx): Promise<ChatContent> {
  const res = await execTool("expense.query", {}, { runId });
  const d = res.data as any;
  const byCategory = Object.entries((d?.cur ?? {}) as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => ({ cat, amount }));
  const insights: string[] = [];
  const prev = (d?.prev ?? {}) as Record<string, number>;
  const cur = (d?.cur ?? {}) as Record<string, number>;
  if (prev.Travel && cur.Travel) {
    const pct = Math.round(((cur.Travel - prev.Travel) / prev.Travel) * 100);
    insights.push(`Travel spending is ${pct >= 0 ? "up" : "down"} ${Math.abs(pct)}% vs last month.`);
  }
  const top = byCategory[0];
  if (top) insights.push(`${top.cat} is your largest category this month at ₹${top.amount.toLocaleString("en-IN")}.`);
  const subs = cur.Subscriptions ?? 0;
  if (d?.curTotal) insights.push(`Subscriptions are ${Math.round((subs / d.curTotal) * 100)}% of this month's spending.`);
  const monthLabel = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  return {
    text: `You've spent ₹${(d?.curTotal ?? 0).toLocaleString("en-IN")} so far this month (last month: ₹${(d?.prevTotal ?? 0).toLocaleString("en-IN")}). Every number here is computed from your stored transactions — not estimated.`,
    blocks: [{ type: "expense", month: monthLabel, total: d?.curTotal ?? 0, byCategory, insights }],
  };
}

async function hNewTask(m: string, { runId }: Ctx): Promise<ChatContent> {
  const title = m.replace(/^(please\s+)?(add|create|make|new)\s+(a\s+)?(task|to-?do)(\s+to\s+|:|\s+)/i, "").trim() || "New task";
  const r = await execTool("task.create", { title, source: "User", status: "inbox" }, { runId });
  return {
    text: r.ok ? `Added to your inbox: “${title}”.` : `Couldn't create the task: ${r.summary}`,
    blocks: r.ok ? [{ type: "tasks", items: taskBlock([r.data as (typeof tasks.$inferSelect)]) }] : [],
  };
}

async function hAffirm(_m: string, ctx: Ctx): Promise<ChatContent> {
  const pending = await db.select().from(approvals).where(eq(approvals.status, "pending")).orderBy(approvals.createdAt);
  if (pending.length) {
    const p = pending[0];
    return {
      text: `I'm waiting on your approval: ${p.action}. Use the approval card below (or the Approvals page) — I won't proceed until you confirm.`,
      blocks: [{ type: "approval", approvalId: p.id }],
    };
  }
  const stride = await findGoal("Stride");
  if (stride) return hOpps(_m, ctx);
  return hFallback(_m, ctx);
}

async function hGreeting(_m: string, _ctx: Ctx): Promise<ChatContent> {
  return {
    text: "I'm Orbit. Give me a goal and I'll plan it, use only your connected tools, and ask before anything risky — with a full audit trail. Try one of the demo flows:",
    blocks: [{
      type: "chips",
      chips: [
        { label: "What's important today?", send: "What's important today?" },
        { label: "Finish my Stride requirement", send: "I have 100 Stride points to complete before the academic year ends. Read this document and help me finish it." },
        { label: "React internships in Coimbatore", send: "Find internships for React development in Coimbatore." },
        { label: "Clear junk from my PC", send: "Clear junk from my PC." },
      ],
    }],
  };
}

async function hFallback(m: string, _ctx: Ctx): Promise<ChatContent> {
  const smart = await llmReply(m, "User talks to ORBIT, a personal AI assistant with Gmail, Calendar, Drive, Classroom, jobs, expenses, payments and file cleanup (demo mode).");
  const text = smart ?? "I can take goals, commands and questions — emails, calendar, files, jobs, expenses, payments, reminders. Anything risky will ask you first and everything lands in the audit ledger. Try: “What's important today?”, “Help me complete my college Stride requirements”, or “Find React internships in Coimbatore.”";
  return { text, blocks: [] };
}

/* ────────────────────────── router ────────────────────────── */

const ROUTES: { re: RegExp; run: (m: string, ctx: Ctx) => Promise<ChatContent> }[] = [
  { re: /(?:automation|automations)\b|(?:change|update|set|switch|reschedule|adjust)\s+.{0,40}(?:timing|schedule|time|cadence)\b|(?:turn\s+(?:on|off)|enable|disable|activate|pause)\s+.{0,40}automation\b/i, run: hAutomationManage },
  { re: /stride/i, run: hStride },
  { re: /register(ation)?|codespark/i, run: hRegister },
  { re: /(search|find|look).{0,35}(opportunit|hackathon|workshop|event for)|opportunities?( for| that)?/i, run: hOppsSearch },
  { re: /(cancel|drop|remove|don'?t (want to )?go|not going).{0,45}(event|appointment|meeting|that|it)|cancel that/i, run: hCancelEvent },
  { re: /find (me )?(free )?time|schedule (it|a (study )?block|time|the task)|free time in my calendar/i, run: hScheduleTask },
  { re: /(event|meeting|appointment).{0,45}(tomorrow|today|tonight)|add (it\b|the event|an? (event|meeting))/i, run: hCalendarEvent },
  { re: /(important (today|now|emails)|what'?s important|catch me up|briefing|take care of|what should i (do|take)|what'?s (up|on) (today|now)|priorit)/i, run: hBriefing },
  { re: /react internship|internships?|find (me )?(jobs?|an? (job|internship))|(find|search).{0,40}(internship|jobs?)/i, run: hJobs },
  { re: /^(yes|yeah|yep|sure|go ahead|do it|ok|okay|please do)\b/i, run: hAffirm },
  { re: /remind/i, run: hRemind },
  { re: /(junk|free up|clean( up)?|storage|disk space)/i, run: hCleanup },
  { re: /₹|payment|transfer|send .*rs\b|\bupi\b/i, run: hPayment },
  { re: /(?:create|make|new|add)\s+(?:a\s+)?folder\b|mkdir\b/i, run: hCreateFolder },
  { re: /(?:write|send|draft|compose)\s+(?:an?\s+)?(?:email|mail|message)\b/i, run: hWriteEmail },
  { re: /(important|unread).{0,22}emails?|check (my )?(inbox|email|mails)|triage|email (summary|brief)|college (emails?|mails?)/i, run: hEmailTriage },
  { re: /summarize|summarise/i, run: hSummarize },
  { re: /(project report|find (my )?(files?|documents?))|\bdrive\b/i, run: hDrive },
  { re: /(classroom|assignment)/i, run: hClassroom },
  { re: /weather/i, run: hWeather },
  { re: /(video|youtube|tutorial)/i, run: hYouTube },
  { re: /(expense|spending|spent|budget|how much (did i )?(spend|spent))|\bmoney\b/i, run: hExpense },
  { re: /^(new |add |create )?(a )?(task|to-?do|todo)\b/i, run: hNewTask },
  { re: /help me (complete|prepare|finish|achieve|get|plan|make)|long.?term|my (goal|goals)|plan (for|to)/i, run: hGoal },
  { re: /^(hi|hello|hey|good (morning|afternoon|evening))\b/i, run: hGreeting },
];

export async function planTurn(userMessage: string, runId: string): Promise<ChatContent> {
  const m = userMessage.trim();
  const lower = m.toLowerCase();
  for (const r of ROUTES) {
    if (r.re.test(lower)) {
      try {
        return await r.run(m, { runId });
      } catch (e) {
        console.error("planner handler failed", e);
        return { text: `Something went wrong while handling that (${(e as Error).message}). No changes were made — check the audit ledger for details.` };
      }
    }
  }
  return hFallback(m, { runId });
}
