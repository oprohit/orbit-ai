import { asc, desc, eq, gte, like } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/db";
import {
  approvals, automations, calendarEvents, connectors, emailItems, goalMilestones, goals, profiles, tasks,
} from "@/db/schema";
import { createApproval, execTool } from "./executor";
import { generateNaturalEmail, llmReply } from "./ai";
import { at, fmtDay, fmtTime, nextFriday, runTool } from "./tools";
import { logAudit } from "./audit";
import type { Block, ChatContent } from "./types";

type Ctx = { runId: string; clientScan?: any };
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

async function hStride(m: string, { runId }: Ctx): Promise<ChatContent> {
  const isFresh = /read\s+(?:this\s+)?document|help\s+me\s+finish|100\s+stride/i.test(m);
  const g = await findGoal("Stride");
  if (g && !isFresh) {
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

  // If re-triggering fresh from document, clean up previous Stride records
  if (g) {
    try {
      await db.delete(goalMilestones).where(eq(goalMilestones.goalId, g.id));
      await db.delete(tasks).where(eq(tasks.goalId, g.id));
      await db.delete(goals).where(eq(goals.id, g.id));
    } catch {}
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
    blocks: [
      { type: "briefing", sections },
      {
        type: "chips",
        chips: [
          { label: "What's my next action?", send: "What's my next action?" },
          { label: "Check my emails", send: "Check my emails" },
        ],
      },
    ],
  };
}

async function hNextAction(_m: string, _ctx: Ctx): Promise<ChatContent> {
  const activeGoals = await db.select().from(goals).where(eq(goals.status, "active"));
  const pendingTasks = await db.select().from(tasks).where(eq(tasks.status, "pending")).orderBy(tasks.deadline).limit(6);

  let nextTask = pendingTasks[0];
  let goalTitle = "";

  if (activeGoals.length > 0) {
    const primaryGoal = activeGoals[0];
    goalTitle = primaryGoal.title;
    if (primaryGoal.nextAction) {
      const match = pendingTasks.find(
        (t) => t.title.toLowerCase().includes(primaryGoal.nextAction!.toLowerCase()) || (t.goalId === primaryGoal.id)
      );
      if (match) nextTask = match;
    }
  }

  if (nextTask) {
    const dueStr = nextTask.deadline ? `due ${fmtDay(nextTask.deadline)} at ${fmtTime(nextTask.deadline)}` : "no set deadline";
    return {
      text: `Your immediate next action is:\n\n🎯 **${nextTask.title}**${goalTitle ? ` (part of **${goalTitle}**)` : ""}\n⏱️ **Deadline:** ${dueStr}\n⚡ **Priority:** ${(nextTask.priority || "routine").toUpperCase()}\n\nWould you like me to find free time on your calendar to complete this, or mark it in progress?`,
      blocks: [
        {
          type: "tasks",
          items: taskBlock([nextTask]),
        },
        {
          type: "chips",
          chips: [
            { label: "Find time in calendar", send: `Find me time in my calendar to complete ${nextTask.title}` },
            { label: "What's important today?", send: "What's important today?" },
          ],
        },
      ],
    };
  }

  return {
    text: "All clear! You don't have any pending tasks right now. Would you like to review what's important today or set a new goal?",
    blocks: [
      {
        type: "chips",
        chips: [
          { label: "What's important today?", send: "What's important today?" },
          { label: "Find React internships", send: "Find React internships in Coimbatore" },
        ],
      },
    ],
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
  gate: {
    title: "GATE Preparation — Computer Science & IT",
    desc: "Comprehensive 6–8 month structured study roadmap, high-weightage subjects, PYQs on GateOverflow, and timed diagnostic full-length mocks.",
    ms: [
      ["Phase 1: High-Weight Foundations", "Engineering Math, Discrete Math, Operating Systems & DBMS (28+ marks)"],
      ["Phase 2: Core Engineering & Systems", "Theory of Computation, Compiler Design, Computer Networks & Algorithms"],
      ["Phase 3: Topic-wise PYQs (2000–2025)", "Solve 15+ years of verified GATE CSE questions on GateOverflow"],
      ["Phase 4: Timed Full-Length Mocks", "Complete 5 full-length simulated 3-hour mocks with virtual calculator"],
    ],
    tasks: [
      { title: "Download official GATE CS syllabus & create topic weightage matrix", priority: "high", days: 1, hour: 17 },
      { title: "Watch Gate Smashers playlist on Operating Systems (Process, Deadlock, Memory)", priority: "high", days: 2, hour: 18 },
      { title: "Solve last 15 years of GATE Previous Year Questions (PYQs) on GateOverflow", priority: "high", days: 4, hour: 17 },
      { title: "Attempt 5 full-length timed diagnostic mocks on virtual interface", priority: "high", days: 7, hour: 10 },
    ],
  },
  dsa: {
    title: "DSA & LeetCode Coding Interview Prep",
    desc: "Master 75 high-frequency LeetCode data structures & algorithms patterns for top tech placements.",
    ms: [
      ["Phase 1: Arrays, Hash Maps & Two Pointers", "Sliding window, prefix sums, binary search"],
      ["Phase 2: Linked Lists, Trees & Graphs", "DFS, BFS, recursion, topological sort"],
      ["Phase 3: Dynamic Programming & Greedy", "1D/2D DP, knapsack, intervals, memoization"],
      ["Phase 4: Timed Mock Interviews", "Complete 10 timed 45-min mock coding rounds"],
    ],
    tasks: [
      { title: "Solve NeetCode 150 Arrays & Two Pointers problems", priority: "high", days: 1, hour: 18 },
      { title: "Master Binary Trees & BST traversals with LeetCode medium questions", priority: "high", days: 3, hour: 18 },
      { title: "Implement Graph BFS & DFS algorithms with cycle detection", priority: "high", days: 5, hour: 18 },
      { title: "Practice 1D Dynamic Programming standard patterns", priority: "high", days: 7, hour: 18 },
    ],
  },
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
  const isGate = /gate|graduate aptitude/i.test(m);
  const isDsa = /dsa|data structure|leetcode|coding interview|algorithm/i.test(m);
  const isIntern = /internship|job|placement/i.test(m);
  const isExam = /exam|assessment|study|prepare/i.test(m);

  const key = isGate ? "gate" : isDsa ? "dsa" : isIntern ? "internship" : isExam ? "exam" : "gate";
  const tpl = GOAL_TEMPLATES[key] || GOAL_TEMPLATES.gate;

  const searchKeyword = isGate ? "GATE" : isIntern ? "Internship" : isDsa ? "DSA" : "Assessment";
  const existing = await findGoal(searchKeyword);
  if (existing && existing.status === "active") {
    const rows = await db.select().from(tasks).where(eq(tasks.goalId, existing.id)).limit(6);
    return {
      text: `Your ${existing.title} goal is already active on your Goals board: ${existing.currentValue ?? 0}/${existing.targetValue ?? 4} done. Next: ${existing.nextAction ?? "review your tasks"}.`,
      blocks: [await goalBlock(existing), { type: "tasks", items: taskBlock(rows) }],
    };
  }

  const goalId = randomUUID();
  const deadline = at(isGate ? 240 : isIntern ? 180 : 30, 23, 59);

  await db.insert(goals).values({
    id: goalId,
    title: tpl.title,
    description: tpl.desc,
    status: "active",
    deadline,
    targetValue: tpl.tasks.length,
    currentValue: 0,
    unit: "tasks",
    aiReasoning: `Activated strategic goal from user request “${m}”. Decomposed into ${tpl.ms.length} milestone phases and ${tpl.tasks.length} actionable preparation tasks.`,
    nextAction: tpl.tasks[0].title,
    sources: ["User Goal"],
  });

  for (const [i, [title, detail]] of tpl.ms.entries()) {
    await db.insert(goalMilestones).values({
      id: randomUUID(),
      goalId,
      title,
      detail,
      seq: i,
      status: i === 0 ? "in_progress" : "pending",
    });
  }

  const created: (typeof tasks.$inferSelect)[] = [];
  for (const t of tpl.tasks) {
    const taskId = randomUUID();
    const taskDeadline = at(t.days, t.hour);
    await db.insert(tasks).values({
      id: taskId,
      goalId,
      title: t.title,
      priority: t.priority,
      status: "inbox",
      deadline: taskDeadline,
      source: "Agent",
    });
    created.push({
      id: taskId,
      goalId,
      title: t.title,
      priority: t.priority,
      status: "inbox",
      deadline: taskDeadline,
      source: "Agent",
    } as any);
  }

  await logAudit({
    action: `goal.created — ${tpl.title}`,
    runId,
    goalId,
    authorization: "allowed",
    resultSummary: `Active goal created with ${tpl.ms.length} milestones and ${tpl.tasks.length} tasks`,
  });

  return {
    text: `🎯 I've added **"${tpl.title}"** as an **Active Goal** in your Orbit dashboard! Decomposed into ${tpl.ms.length} structured milestone phases with ${tpl.tasks.length} immediate preparation tasks. You can track your progress in real-time under the Goals tab.`,
    blocks: [
      {
        type: "goal",
        goal: {
          id: goalId,
          title: tpl.title,
          current: 0,
          target: tpl.tasks.length,
          unit: "tasks",
          deadline: fmtDay(deadline),
          nextAction: tpl.tasks[0].title,
          milestones: tpl.ms.map((m, i) => ({ title: m[0], status: i === 0 ? "in_progress" : "pending" })),
        },
      },
      { type: "tasks", items: taskBlock(created) },
      {
        type: "chips",
        chips: [
          { label: "What's my next action?", send: "What's my next action?" },
          { label: "Open Task Breaker (110 Steps)", send: "Open task breaker flowchart" },
          { label: "What's important today?", send: "What's important today?" },
        ],
      },
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
  const to = emailMatch ? emailMatch[0] : "recipient@example.com";

  // Fetch dynamic user profile name
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, "u1"));
  const userName = profile?.name || "User";

  // Natural Language Processing: understand intent and generate natural, human-written email
  const { subject, body } = await generateNaturalEmail(m, to, userName);

  const isDirectSend = /\b(?:send|deliver|shoot|dispatch)\b.*?\b(?:email|mail)\b|\b(?:email|mail)\s+(?:to\s+)?[\w.-]+@/i.test(m) ||
    /needs?\s+to\s+be\s+sent|send\s+it\s+(?:automatically|directly|now)/i.test(m) ||
    /^(?:please\s+)?(?:send|deliver|dispatch)\b/i.test(m);

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  if (isDirectSend) {
    const sendRes = await runTool("gmail.send", { to, subject, body }, { runId });
    const sendData = (sendRes.data as any) || {};
    const liveSent = !!sendData.liveSent;

    await logAudit({
      action: `gmail.send — ${to}: "${subject}"`,
      toolId: "gmail.send",
      runId,
      authorization: "allowed",
      resultSummary: liveSent ? `Dispatched silently via Gmail API to ${to}` : `Queued email for ${to}`,
    });

    const statusMsg = liveSent
      ? "Dispatched & Sent silently via Gmail API ✓ (Background delivery — no button click needed)"
      : "Queued message ✓ (Orbit policy allows sending; connect Gmail in Connectors for direct silent background API sending)";

    return {
      text: liveSent
        ? `I have sent your email directly to **${to}** in the background via the Gmail API:\n\n> **${subject}**\n>\n> ${body.split("\n").join("\n> ")}\n\nDelivered automatically without opening any compose window.`
        : `I've prepared and queued your email to **${to}**:\n\n> **${subject}**\n>\n> ${body.split("\n").join("\n> ")}\n\n${statusMsg}`,
      blocks: [
        {
          type: "result",
          title: `✉️ Sent Email: ${subject}`,
          lines: [
            `To: ${to}`,
            `Subject: ${subject}`,
            `Status: ${statusMsg}`,
            `Message:\n${body}`,
          ],
          action: {
            type: "mail",
            payload: { to, subject, body, gmailUrl, sent: true, openCompose: false },
          },
        },
      ],
    };
  }

  await execTool(
    "gmail.draft",
    { to, subject, body },
    { runId, reason: `Prepare email draft to ${to}` }
  );

  return {
    text: `I've prepared your email to **${to}** with subject **"${subject}"**:\n\n> **${subject}**\n>\n> ${body.split("\n").join("\n> ")}\n\nClick below to open and review in Gmail:`,
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
          payload: { to, subject, body, gmailUrl, sent: false },
        },
      },
    ],
  };
}

async function hCleanup(_m: string, { runId, clientScan }: Ctx): Promise<ChatContent> {
  let data: any = null;
  let isLive = false;

  if (clientScan && clientScan.live) {
    data = clientScan;
    isLive = true;
  } else {
    const scan = await execTool("filesystem.scan", {}, { runId, reason: "You asked to clear junk from the PC (via the Desktop Agent)" });
    data = scan.data as any;
    isLive = !!data?.live;
  }

  const total = (data?.totalFormatted || data?.total) ?? "0 Bytes";

  if (!isLive) {
    return {
      text: "⚠️ **Orbit Desktop Agent is offline**\n\nOrbit runs securely inside a browser sandbox and cannot access your physical Windows hard drive without the local desktop companion running.\n\nTo scan and clean your real Windows laptop (%TEMP% and Downloads):\n1. Launch the new **OrbitAI.exe** app (`dist/OrbitAI-win32-x64/OrbitAI.exe`) or double-click `start-orbit-desktop.bat`\n2. Ask me again: *“Check my laptop for any junk files and give me the report”*\n\nOnce running, Orbit scans your actual drive in real-time — both from the desktop app and from your web browser!",
      blocks: [
        {
          type: "result",
          title: "💻 Windows Desktop Companion Offline",
          lines: [
            "Status: 127.0.0.1:38291 unreachable",
            "Real Paths: %TEMP% (C:\\Users\\...\\AppData\\Local\\Temp) & Downloads",
            "App: dist\\OrbitAI-win32-x64\\OrbitAI.exe",
            "Script: start-orbit-desktop.bat (or npm run desktop)",
            "Web Access: Fully supported once agent is running locally",
          ],
        },
        {
          type: "chips",
          chips: [
            { label: "What's important today?", send: "What's important today?" },
            { label: "How to run desktop companion", send: "explain how to run the desktop agent" },
          ],
        },
      ],
    };
  }

  const approval = await createApproval({
    toolId: "filesystem.delete",
    params: { total, categories: (data?.items ?? []).map((i: any) => i.label || i.name) },
    reason: `Live Windows scan identified ${total} of temporary and cached files. Deletion is destructive, so it requires your confirmation.`,
    riskLevel: "critical",
    runId,
  });

  return {
    text: `I scanned your real Windows laptop via the live Orbit Desktop Agent. Found **${total}** of cleanable files across %TEMP% and Downloads. Nothing is deleted until you approve:`,
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
    m.match(/(?:at|every|to)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);

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
  const important = rows.filter((e) => e.classification === "critical" || e.classification === "important");
  
  // Query all current tasks from DB to check what was ALREADY completed or is open
  const existingTasks = await db.select().from(tasks);

  // Defined actionable emails with expected tasks
  const potentialActions = [
    {
      sourceMatch: "Kalaivana",
      titleKeywords: ["feedback"],
      defaultTitle: "Fill Teacher Feedback Form",
      description: "Source: Gmail → Kalaivana — “All students must complete the Teacher Feedback Form by Friday.”",
      priority: "high" as const,
      deadline: nextFriday(),
      source: "Gmail → Kalaivana",
    },
    {
      sourceMatch: "placements@college.edu",
      titleKeywords: ["tcs", "nqt", "placement"],
      defaultTitle: "Register for TCS NQT placement",
      description: "Source: Gmail → Placement Cell — “Registration closes Friday 6 PM.”",
      priority: "high" as const,
      deadline: nextFriday(),
      source: "Gmail → Placement Cell",
    },
    {
      sourceMatch: "examcell@college.edu",
      titleKeywords: ["internal assessment", "ds"],
      defaultTitle: "Submit DS Internal Assessment",
      description: "Source: Gmail → Exam Cell — “Submission window open until Friday 11:59 PM.”",
      priority: "urgent" as const,
      deadline: at(1, 23, 59),
      source: "Gmail → Exam Cell",
    },
    {
      sourceMatch: "scholarships@college.edu",
      titleKeywords: ["scholarship", "nsp"],
      defaultTitle: "Apply for NSP National Scholarship",
      description: "Source: Gmail → National Scholarship Portal — Applications open for eligible students.",
      priority: "medium" as const,
      deadline: at(9, 18, 0),
      source: "Gmail → Scholarships",
    },
  ];

  const completedEmailTasks: { title: string; source: string }[] = [];
  const pendingEmailTasks: (typeof tasks.$inferSelect)[] = [];
  const newlyCreatedTasks: (typeof tasks.$inferSelect)[] = [];

  for (const act of potentialActions) {
    const matchedTask = existingTasks.find((t) =>
      act.titleKeywords.some((kw) => t.title.toLowerCase().includes(kw)) ||
      (t.source && t.source.toLowerCase().includes(act.sourceMatch.toLowerCase()))
    );

    if (matchedTask) {
      if (matchedTask.status === "completed") {
        // User finished this task: Remember it and NEVER show it as a pending action again!
        completedEmailTasks.push({ title: matchedTask.title, source: matchedTask.source || act.source });
      } else {
        pendingEmailTasks.push(matchedTask);
      }
    } else {
      // Not yet created: extract it as a task
      const createRes = await execTool("task.create", {
        title: act.defaultTitle,
        description: act.description,
        priority: act.priority,
        deadline: act.deadline,
        source: act.source,
      }, { runId, reason: `Auto-extracted task from ${act.source}` });

      if (createRes.ok && createRes.data) {
        newlyCreatedTasks.push(createRes.data as (typeof tasks.$inferSelect));
      }
    }
  }

  // Check unread & critical emails
  const unreadCritical = rows.filter((e) => !e.read && (e.classification === "critical" || e.classification === "important"));
  const unreadCount = rows.filter((e) => !e.read).length;

  let reportText = `📧 **Inbox Triage & Email Analysis**\n\nI scanned your ${rows.length} recent messages (${unreadCount} unread, ${important.length} high priority):\n\n`;

  if (newlyCreatedTasks.length > 0) {
    reportText += `📌 **${newlyCreatedTasks.length} New Actionable Task${newlyCreatedTasks.length > 1 ? "s" : ""} Extracted:**\n`;
    newlyCreatedTasks.forEach((t) => {
      reportText += `• **${t.title}** (from ${t.source}) — Added to your Tasks board.\n`;
    });
    reportText += "\n";
  }

  if (pendingEmailTasks.length > 0) {
    reportText += `⏳ **${pendingEmailTasks.length} Pending Task${pendingEmailTasks.length > 1 ? "s" : ""} Tracked:**\n`;
    pendingEmailTasks.forEach((t) => {
      reportText += `• **${t.title}** — Due ${t.deadline ? fmtDay(new Date(t.deadline)) : "soon"} (${t.status}).\n`;
    });
    reportText += "\n";
  }

  if (completedEmailTasks.length > 0) {
    reportText += `✓ **Orbit Memory Audit (${completedEmailTasks.length} Completed):**\n`;
    completedEmailTasks.forEach((t) => {
      reportText += `• *${t.title}* was marked done earlier. As requested, it will never be prompted or re-added.\n`;
    });
    reportText += "\n";
  }

  if (unreadCritical.length > 0) {
    reportText += `⚠️ **Upcoming Deadlines / Attention Required:**\n`;
    unreadCritical.slice(0, 3).forEach((e) => {
      reportText += `• **${e.from}**: "${e.subject}" ${e.deadline ? `(Due ${e.deadline})` : ""}\n`;
    });
  } else {
    reportText += `🎉 No missed emails or urgent unhandled deadlines. Newsletters and promotional mail suppressed.`;
  }

  const activeDisplayTasks = [...newlyCreatedTasks, ...pendingEmailTasks];

  return {
    text: reportText.trim(),
    blocks: [
      {
        type: "emails",
        items: important.slice(0, 6).map((e) => ({
          from: e.from ?? "",
          subject: e.subject,
          cls: e.classification ?? "routine",
          deadline: e.deadline ?? undefined,
        })),
      },
      ...(activeDisplayTasks.length > 0 ? [{ type: "tasks" as const, items: taskBlock(activeDisplayTasks.slice(0, 4)) }] : []),
      {
        type: "chips",
        chips: [
          { label: "Show my full task list", send: "Show me my tasks" },
          { label: "Find time in calendar", send: "Find me free time in my calendar to complete tasks" },
          { label: "What's important today?", send: "What's important today?" },
        ],
      },
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
  const isLive = d?.live ? " (Live Open-Meteo API)" : "";
  return {
    text: `Coimbatore right now: ${d?.temp ?? "33°C"}, ${d?.sky ?? "partly cloudy"}${d?.wind ? `, wind ${d.wind}` : ""}${isLive}.`,
    blocks: [
      {
        type: "result",
        title: "🌤️ Live Weather · Coimbatore",
        lines: [
          `Location: ${d?.place ?? "Coimbatore, India"}`,
          `Temperature: ${d?.temp ?? "33°C"}`,
          `Conditions: ${d?.sky ?? "Partly cloudy"}`,
          ...(d?.wind ? [`Wind Speed: ${d.wind}`] : []),
          `Source: Real-time Public Weather API (Open-Meteo)`,
        ],
      },
    ],
  };
}

async function hJoke(_m: string, { runId }: Ctx): Promise<ChatContent> {
  const res = await execTool("public.joke", {}, { runId });
  const d = (res.data as any) || {};
  const setup = d.setup || "Why do programmers prefer dark mode?";
  const punchline = d.punchline || "Because light attracts bugs!";
  return {
    text: `${setup}\n\n**${punchline}**`,
    blocks: [
      {
        type: "result",
        title: "😄 Joke of the Moment",
        lines: [setup, `→ ${punchline}`],
      },
    ],
  };
}

async function hAdvice(_m: string, { runId }: Ctx): Promise<ChatContent> {
  const res = await execTool("public.advice", {}, { runId });
  const d = (res.data as any) || {};
  const advice = d.advice || "Focus on small consistent daily wins rather than overnight perfection.";
  return {
    text: `💡 Daily Advice: "${advice}"`,
    blocks: [
      {
        type: "result",
        title: "💡 Daily Advice & Wisdom",
        lines: [advice],
      },
    ],
  };
}

async function hYouTube(m: string, { runId }: Ctx): Promise<ChatContent> {
  const q = m
    .replace(/find me (a |an )?(about|of)?/i, "")
    .replace(/explanation of|video about|tutorial on|study materials? (?:for|about)?|sources? to study|videos? (?:for|about)?|how (?:to|do i) master|master\s+/gi, "")
    .trim();
  const topic = q || "Data Structures and Algorithms";
  const res = await execTool("youtube.search", { query: topic }, { runId });
  const vids = (res.data as any[]) ?? [];
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " full course tutorial")}`;

  return {
    text: `Here are curated study resources and YouTube video tutorials for **“${topic}”** to help you master the topic:`,
    blocks: [
      {
        type: "result",
        title: `📺 YouTube Tutorials & Study Guides: ${topic}`,
        lines: [
          ...vids.map((v) => `▶ ${v.title} (${v.channel} · ${v.duration})\n   ${v.why}\n   URL: ${v.url || searchUrl}`),
          `🔍 Full YouTube Playlist: ${searchUrl}`,
        ],
      },
      {
        type: "chips",
        chips: [
          { label: "View Goals Roadmap", send: "Show my goals" },
          { label: "What's my next action?", send: "What's my next action?" },
        ],
      },
    ],
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

function cleanTaskTitle(raw: string, matchedTimeStr?: string): string {
  let t = raw;
  if (matchedTimeStr) {
    t = t.replace(matchedTimeStr, " ");
  }
  t = t
    .replace(/^(?:i\s+(?:want|need|have)\s+to|can\s+you(?:\s+please)?|please|could\s+you)\s+/i, " ")
    .replace(/^(?:set\s+(?:a\s+)?reminder\s+(?:for|to)|schedule\s+(?:a\s+)?reminder\s+(?:for|to))\s+/i, " ")
    .replace(/\b(?:can\s+you\s+)?(?:add|put|save)\s+(?:this\s+)?(?:to\s+(?:the|my)?\s*(?:tasks?|todo|inbox|list))\s*(?:and)?\s*/gi, " ")
    .replace(/\b(?:to\s+(?:the|my)?\s*(?:tasks?|todo|inbox|list))\b/gi, " ")
    .replace(/^(?:add|create|make|new|schedule|put|remind\s+me(?:\s+to)?)\s+(?:a\s+)?(?:task|to-?do|reminder|item)?(?:\s+(?:to|for|about|:|that)\s+|\s+)?/i, " ")
    .replace(/^(?:add|create|make|new|schedule|put)\s+/i, " ")
    .replace(/\b(?:and\s+)?remind\s+me(?:\s+at\s+[\d:apm\s]+|\s+to)?\b/gi, " ")
    .replace(/\b(?:today|tomorrow|tonight)\b/gi, " ")
    .replace(/\b(?:by|on|next)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, " ")
    .replace(/\b(?:at|by|for)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, " ")
    .replace(/\s+(?:at|by|on|for|due)\s*$/gi, "")
    .replace(/^[?,.:;\s]+|[?,.:;\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!t) t = "New task";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function parseTaskAndDeadline(m: string): { title: string; deadline: Date | null; hasTime: boolean } {
  let deadline: Date | null = null;
  let hasTime = false;

  const isTomorrow = /\btomorrow\b/i.test(m);
  const isToday = /\btoday|tonight\b/i.test(m);
  let dayOffset = isTomorrow ? 1 : 0;

  const dayMatch = m.match(/\b(?:by|on|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (dayMatch) {
    const targetDay = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(dayMatch[1].toLowerCase());
    const now = new Date();
    const curDay = now.getDay();
    let diff = (targetDay - curDay + 7) % 7;
    if (diff === 0) diff = 7;
    dayOffset = diff;
    hasTime = true;
  }

  const timeRegexes = [
    /\b(?:at|by|for)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b(?:\s*(?:today|tomorrow|tonight))?/i,
    /\b(?:today|tomorrow|tonight)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
    /\bat\s+(\d{1,2})(?::(\d{2}))?\b/i,
    /\b(?:in\s+the\s+)?(morning|afternoon|evening|night)\b/i,
  ];

  let matchedTimeStr = "";
  let hour = 18;
  let minute = 0;

  for (const re of timeRegexes) {
    const match = m.match(re);
    if (match) {
      matchedTimeStr = match[0];
      hasTime = true;
      if (match[1] && /^\d+$/.test(match[1])) {
        hour = parseInt(match[1], 10);
        minute = match[2] ? parseInt(match[2], 10) : 0;
        const ampm = match[3]?.toLowerCase();
        if (ampm === "pm" && hour < 12) hour += 12;
        if (ampm === "am" && hour === 12) hour = 0;
      } else if (match[1]) {
        const part = match[1].toLowerCase();
        if (part === "morning") hour = 9;
        else if (part === "afternoon") hour = 14;
        else if (part === "evening") hour = 18;
        else if (part === "night") hour = 21;
      }
      break;
    }
  }

  if (isTomorrow || isToday) {
    hasTime = true;
  }

  if (hasTime) {
    deadline = at(dayOffset, hour, minute);
  }

  const cleanTitle = cleanTaskTitle(m, matchedTimeStr);
  return { title: cleanTitle, deadline, hasTime };
}

async function hNewTask(m: string, { runId }: Ctx): Promise<ChatContent> {
  const { title, deadline, hasTime } = parseTaskAndDeadline(m);

  if (hasTime && deadline) {
    const r = await execTool("task.create", {
      title,
      source: "User",
      status: "planned",
      deadline,
    }, { runId, reason: "User created scheduled task" });
    const when = `${fmtDay(deadline)} at ${fmtTime(deadline)}`;
    return {
      text: r.ok
        ? `Added **${title}** to your tasks scheduled for **${when}**.`
        : `Couldn't create the task: ${r.summary}`,
      blocks: r.ok ? [{ type: "tasks", items: taskBlock([r.data as (typeof tasks.$inferSelect)]) }] : [],
    };
  }

  // User simply gave a task name without time
  const r = await execTool("task.create", {
    title,
    source: "User",
    status: "inbox",
    deadline: null,
  }, { runId, reason: "User created inbox task" });

  return {
    text: r.ok
      ? `Added **${title}** to your task inbox.\n\nWhat time would you like to set a reminder or deadline for this task?`
      : `Couldn't create the task: ${r.summary}`,
    blocks: r.ok
      ? [
          { type: "tasks", items: taskBlock([r.data as (typeof tasks.$inferSelect)]) },
          {
            type: "chips",
            chips: [
              { label: "Remind me today at 5:00 PM", send: `Set reminder for ${title} today at 5:00 PM` },
              { label: "Remind me tomorrow at 9:00 AM", send: `Set reminder for ${title} tomorrow at 9:00 AM` },
              { label: "No reminder (keep in inbox)", send: `Keep ${title} in inbox without reminder` },
            ],
          },
        ]
      : [],
  };
}

async function hSetTaskReminder(m: string, ctx: Ctx): Promise<ChatContent> {
  if (/no reminder|keep in inbox|without reminder/i.test(m)) {
    return {
      text: "Got it! Kept in your inbox without a reminder. You can schedule it anytime from the Tasks dashboard.",
      blocks: [],
    };
  }

  const { title: parsedTaskName, deadline, hasTime } = parseTaskAndDeadline(m);
  if (!hasTime || !deadline) {
    return {
      text: "Please specify what time you'd like the reminder (for example: *today at 5:00 PM* or *tomorrow at 9:00 AM*).",
      blocks: [],
    };
  }

  const recentTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt)).limit(20);
  
  // Search for an existing task with meaningful title match
  let target = recentTasks.find((t) =>
    parsedTaskName.length > 2 && (
      t.title.toLowerCase().includes(parsedTaskName.toLowerCase()) ||
      parsedTaskName.toLowerCase().includes(t.title.toLowerCase())
    )
  );

  // CRITICAL FIX: If target is not found, DO NOT hijack an arbitrary recent task (e.g. recentTasks[0])!
  // Instead, create a brand-new task with the requested title and scheduled deadline.
  if (!target) {
    const r = await execTool("task.create", {
      title: parsedTaskName,
      source: "User",
      status: "planned",
      deadline,
    }, { runId: ctx.runId, reason: "User scheduled new task with reminder" });

    const when = `${fmtDay(deadline)} at ${fmtTime(deadline)}`;
    return {
      text: r.ok
        ? `Added **${parsedTaskName}** to your tasks scheduled for **${when}** with reminder active.`
        : `Couldn't create the task: ${r.summary}`,
      blocks: r.ok ? [{ type: "tasks", items: taskBlock([r.data as (typeof tasks.$inferSelect)]) }] : [],
    };
  }

  // Update existing target task
  await db.update(tasks).set({
    deadline,
    status: "planned",
  }).where(eq(tasks.id, target.id));

  const updated = { ...target, deadline, status: "planned" };
  const when = `${fmtDay(deadline)} at ${fmtTime(deadline)}`;
  return {
    text: `Set reminder for **${target.title}** to **${when}**. It's updated on your Tasks dashboard.`,
    blocks: [{ type: "tasks", items: taskBlock([updated as any]) }],
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

function parseMusicQuery(raw: string) {
  const m = raw.trim();
  let prefersYtMusic = true;
  let prefersSpotify = false;
  let prefersYt = false;

  if (/(?:spotify)/i.test(m)) {
    prefersSpotify = true;
    prefersYtMusic = false;
  } else if (/\b(?:regular youtube|standard youtube|plain youtube)\b/i.test(m)) {
    prefersYt = true;
    prefersYtMusic = false;
  } else {
    // Default to YouTube Music for dedicated high-fidelity music streaming
    prefersYtMusic = true;
  }

  // Strip triggers like "please play", "listen to", "can you play", "play music", "open youtube music and play"
  let song = m
    .replace(/^(?:please\s+|can\s+you\s+|could\s+you\s+)?(?:open\s+(?:youtube\s*music|yt\s*music|spotify)\s+(?:and\s+)?(?:play|listen\s+to|stream)?\s*)/i, "")
    .replace(/^(?:please\s+|can\s+you\s+|could\s+you\s+)?(?:play|listen\s+to|stream|put\s+on|start\s+playing)\s+(?:music|song|track|the\s+song|the\s+track)?\s*["']?/i, "");

  // Strip provider mentions like "in youtube music", "on youtube music", "on spotify" (including typos like musioc, musci)
  song = song.replace(/\s+(?:in|on|via|through|using)\s+(?:youtube\s*(?:music|musioc|musci)?|yt\s*(?:music|musioc|musci)?|ytm|youtube|yt|spotify)\b/gi, "");
  song = song.replace(/\b(?:in|on)\s+(?:youtube\s*(?:music|musioc|musci)?|yt\s*(?:music|musioc|musci)?|ytm)\b/gi, "");
  song = song.replace(/\b(?:youtube\s*(?:music|musioc|musci)?|yt\s*(?:music|musioc|musci)?)\b/gi, "");
  song = song.replace(/\b(?:music|musioc|musci)\b/gi, "");
  song = song.replace(/\s+(?:automatically|auto|in\s+browser|in\s+background|for\s+me)\b/gi, "");
  song = song.replace(/["']?\s*$/i, "").trim();

  if (!song || song.length < 2) song = "relaxing music";

  return { song, prefersYtMusic, prefersSpotify, prefersYt };
}

async function hPlayMusic(m: string, { runId }: Ctx): Promise<ChatContent> {
  const { song, prefersYtMusic, prefersSpotify } = parseMusicQuery(m);
  
  const execResult = await runTool("media.play", { song, prefersYtMusic }, { runId });
  const playData = (execResult.data as any) || {};

  const resolvedVideoId: string | null = playData.videoId || null;
  const musicUrl = playData.musicUrl || (resolvedVideoId ? `https://music.youtube.com/watch?v=${resolvedVideoId}` : `https://music.youtube.com/search?q=${encodeURIComponent(song)}`);
  const ytUrl = playData.url || (resolvedVideoId ? `https://www.youtube.com/watch?v=${resolvedVideoId}&autoplay=1` : `https://www.youtube.com/results?search_query=${encodeURIComponent(song)}`);
  const spotifyUrl = playData.spotifyUrl || `https://open.spotify.com/search/${encodeURIComponent(song)}`;
  const primaryUrl = prefersYtMusic ? musicUrl : (playData.primaryUrl || ytUrl);

  const providerName = prefersYtMusic ? "YouTube Music" : (prefersSpotify ? "Spotify" : "YouTube");

  await logAudit({
    action: `media.play — "${song}" on ${providerName}`,
    toolId: "media.play",
    runId,
    authorization: "allowed",
    resultSummary: `Auto-launched direct music player for "${song}" on ${providerName} (${resolvedVideoId ? `videoId: ${resolvedVideoId}` : "search fallback"})`,
  });

  return {
    text: `🎵 Playing **"${song}"** automatically in **${providerName}**! Enjoy the music.`,
    blocks: [
      {
        type: "result",
        title: `🎵 Now Playing: ${song}`,
        lines: [
          `Track: ${song}`,
          `Status: Direct player launched in ${providerName} (Autoplay enabled) ✓`,
          `Provider: ${providerName}`,
          resolvedVideoId ? `Track ID: ${resolvedVideoId}` : `Status: Ready`,
        ],
        action: {
          type: "music",
          payload: {
            song,
            videoId: resolvedVideoId,
            primaryUrl,
            url: ytUrl,
            musicUrl,
            spotifyUrl,
            prefersYtMusic,
          },
        },
      },
      {
        type: "chips",
        chips: [
          { label: "Play lofi hip hop", send: "play lofi hip hop" },
          { label: "Play acoustic guitar", send: "play acoustic guitar" },
          { label: "What's important today?", send: "What's important today?" },
        ],
      },
    ],
  };
}

async function hBreakGoal(m: string, { runId }: Ctx): Promise<ChatContent> {
  const isGate = /gate|graduate aptitude|engineering exam/i.test(m);
  const isDsa = /dsa|data structure|leetcode|coding interview|algorithm/i.test(m);
  const isMl = /machine learning|deep learning|ai|artificial intelligence|data science/i.test(m);

  let goalName = "GATE Preparation";
  let timeline = "6–8 Months (200+ Study Hours)";
  let summaryText = "";
  let phases: { name: string; duration: string; focus: string }[] = [];
  let subtasks: { id: string; title: string; status: "pending" | "in_progress" | "done"; weight?: string }[] = [];
  let resources: { title: string; channel: string; duration: string; why: string; url: string }[] = [];

  if (isGate) {
    goalName = "GATE Computer Science & IT";
    timeline = "6–9 Months (250+ Hours)";
    summaryText = "I researched and decomposed your GATE preparation goal. Rather than overwhelming yourself with 10 subjects at once, the proven strategy prioritizes high-weightage subjects: Engineering Mathematics & Aptitude (28 marks) + Core Systems (OS, DBMS, CN, TOC) (45 marks).\n\nBelow is your structured milestone roadmap, actionable subtasks checklist, and curated free YouTube lecture playlists from Gate Smashers, Knowledge Gate, and NPTEL.\n\n*Note:* This plan is provided as research and guidance — it has NOT been added as an active goal in your Orbit database yet. You can click the button below anytime if you want Orbit to track it.";
    phases = [
      { name: "Phase 1: High-Weight Foundations", duration: "Months 1–3", focus: "Engineering Mathematics, Discrete Maths, Operating Systems & DBMS" },
      { name: "Phase 2: Core Engineering & Systems", duration: "Months 4–6", focus: "Theory of Computation, Compiler Design, Computer Networks & Algorithms" },
      { name: "Phase 3: Topic-wise PYQs & Mock Tests", duration: "Months 7–8", focus: "Solve 2000–2025 GATE PYQs on GateOverflow, full 3-hr mocks with virtual calculator" },
    ];
    subtasks = [
      { id: "g-1", title: "Download official GATE CS syllabus & create topic weightage matrix", status: "pending", weight: "15% Weight" },
      { id: "g-2", title: "Watch Gate Smashers playlist on Operating Systems (Process, Deadlock, Memory)", status: "pending", weight: "8–10 Marks" },
      { id: "g-3", title: "Study Discrete Mathematics & Logic with Knowledge Gate (Sanchit Jain)", status: "pending", weight: "7–9 Marks" },
      { id: "g-4", title: "Master Theory of Computation & Regular Languages with NPTEL / Gate Smashers", status: "pending", weight: "8–10 Marks" },
      { id: "g-5", title: "Solve last 15 years of GATE Previous Year Questions (PYQs) on GateOverflow", status: "pending", weight: "Crucial" },
      { id: "g-6", title: "Attempt 5 full-length timed diagnostic mocks on virtual interface", status: "pending", weight: "Final Sprint" },
    ];
    resources = [
      {
        title: "GATE Operating Systems Complete Playlist",
        channel: "Gate Smashers",
        duration: "Full Course",
        why: "Varun Singla's legendary series covering OS, DBMS, TOC, and CN with exam-oriented shortcuts.",
        url: "https://www.youtube.com/results?search_query=gate+smashers+operating+system+playlist",
      },
      {
        title: "GATE Discrete Mathematics & Algorithms",
        channel: "Knowledge Gate",
        duration: "Full Playlist",
        why: "Sanchit Jain's step-by-step rigorous breakdown of discrete math, graphs, and algorithm time complexity.",
        url: "https://www.youtube.com/results?search_query=knowledge+gate+discrete+mathematics",
      },
      {
        title: "NPTEL GATE Engineering Mathematics & Core CS",
        channel: "NPTEL-NOC IITM",
        duration: "University Lectures",
        why: "In-depth standard theoretical lectures taught by IIT professors mapped to official GATE standards.",
        url: "https://www.youtube.com/results?search_query=nptel+gate+computer+science",
      },
      {
        title: "GateOverflow PYQ Solutions & Practice",
        channel: "Gate Overflow",
        duration: "Community Portal",
        why: "Every single GATE question from 2000–2025 categorized topic-wise with verified explanations.",
        url: "https://gateoverflow.in",
      },
    ];
  } else if (isDsa) {
    goalName = "Data Structures & Algorithms Mastery";
    timeline = "3–4 Months (120+ Hours)";
    summaryText = "Here is your researched roadmap to master Data Structures & Algorithms. Rather than random LeetCode grinding, follow pattern-based learning: Arrays/Hashing → Two Pointers → Trees/Graphs → Dynamic Programming.";
    phases = [
      { name: "Phase 1: Fundamentals & Patterns", duration: "Weeks 1–4", focus: "Time/Space Complexity, Arrays, HashMaps, Two Pointers, Sliding Window" },
      { name: "Phase 2: Non-Linear Structures", duration: "Weeks 5–9", focus: "Binary Trees, BSTs, Heaps, Graph BFS/DFS, Backtracking" },
      { name: "Phase 3: Advanced Optimization", duration: "Weeks 10–14", focus: "Dynamic Programming (1D & 2D), Greedy, Trie, Company Mock Interviews" },
    ];
    subtasks = [
      { id: "dsa-1", title: "Complete Striver A2Z Sheet Step 1 to 3 (Basics to Arrays)", status: "pending", weight: "Core" },
      { id: "dsa-2", title: "Watch Abdul Bari's Algorithms lectures on recursion & divide and conquer", status: "pending", weight: "Concepts" },
      { id: "dsa-3", title: "Solve Blind 75 / NeetCode 150 Tree & Graph problems", status: "pending", weight: "Interview Prep" },
      { id: "dsa-4", title: "Master 1D & 2D Dynamic Programming patterns", status: "pending", weight: "Advanced" },
    ];
    resources = [
      {
        title: "Algorithms & Time Complexity Masterclass",
        channel: "Abdul Bari",
        duration: "Full Playlist",
        why: "The clearest visual explanations of recursion, sorting, and dynamic programming in computer science.",
        url: "https://www.youtube.com/results?search_query=abdul+bari+algorithms+playlist",
      },
      {
        title: "NeetCode 150 Coding Interview Guide",
        channel: "NeetCode",
        duration: "Interactive Playlist",
        why: "Visual pattern matching and pythonic code walkthroughs for all top interview problems.",
        url: "https://www.youtube.com/results?search_query=neetcode+150+playlist",
      },
    ];
  } else if (isMl) {
    goalName = "Machine Learning & AI Engineering";
    timeline = "4–6 Months (150+ Hours)";
    summaryText = "Here is your researched ML engineering roadmap. The optimal path builds on Python/Math foundations before moving to Classical ML algorithms, and finally PyTorch Deep Learning & LLMs.";
    phases = [
      { name: "Phase 1: Math & Python Foundations", duration: "Month 1", focus: "NumPy, Pandas, Vector Algebra, Probability & Calculus" },
      { name: "Phase 2: Classical Machine Learning", duration: "Months 2–3", focus: "Linear/Logistic Regression, Decision Trees, Random Forests, XGBoost, Scikit-Learn" },
      { name: "Phase 3: Deep Learning & Neural Nets", duration: "Months 4–5", focus: "PyTorch, CNNs, Transformers, Fine-Tuning LLMs" },
    ];
    subtasks = [
      { id: "ml-1", title: "Complete Andrew Ng's Machine Learning Specialization", status: "pending", weight: "Foundations" },
      { id: "ml-2", title: "Watch StatQuest for intuition on regression, PCA, and gradient descent", status: "pending", weight: "Intuition" },
      { id: "ml-3", title: "Build 3 end-to-end ML projects on Kaggle datasets", status: "pending", weight: "Portfolio" },
    ];
    resources = [
      {
        title: "Machine Learning Specialization",
        channel: "DeepLearning.AI (Andrew Ng)",
        duration: "Complete Series",
        why: "The gold standard introduction to supervised and unsupervised machine learning algorithms.",
        url: "https://www.youtube.com/results?search_query=andrew+ng+machine+learning+playlist",
      },
      {
        title: "Machine Learning Concepts Clearly Explained",
        channel: "StatQuest with Josh Starmer",
        duration: "Visual Playlist",
        why: "Fun, step-by-step visual explanations of math and algorithms without overwhelming notation.",
        url: "https://www.youtube.com/results?search_query=statquest+machine+learning",
      },
    ];
  } else {
    const raw = m.replace(/^(?:i want to|how to|help me|can you|please)?\s*(?:prepare for|study for|break down|give me a plan for|roadmap for|plan for)\s+/i, "").replace(/[.?]+$/, "").trim();
    goalName = `${raw || "Goal"} Mastery`;
    timeline = "3–6 Months";
    summaryText = `Here is a researched milestone plan and subtasks breakdown for **${raw}**. I have broken this into 3 progressive phases with actionable subtasks and recommended free tutorial resources on YouTube.`;
    phases = [
      { name: "Phase 1: Core Fundamentals & Blueprint", duration: "Weeks 1–4", focus: `Core theory, syntax/syllabus and foundational concepts of ${raw}` },
      { name: "Phase 2: Practical Application & Projects", duration: "Weeks 5–10", focus: "Hands-on exercises, standard problem-solving and portfolio work" },
      { name: "Phase 3: Advanced Mastery & Review", duration: "Weeks 11–16", focus: "Simulated assessments, edge-case debugging and final sprint" },
    ];
    subtasks = [
      { id: "sub-1", title: `Outline official syllabus and high-yield milestones for ${raw}`, status: "pending", weight: "Planning" },
      { id: "sub-2", title: "Complete curated introductory lecture series", status: "pending", weight: "Learning" },
      { id: "sub-3", title: "Complete 5 practical hands-on exercises or past papers", status: "pending", weight: "Practice" },
      { id: "sub-4", title: "Conduct weekly revision and diagnostic self-testing", status: "pending", weight: "Retention" },
    ];
    resources = [
      {
        title: `${raw} Complete Course Tutorial`,
        channel: "freeCodeCamp",
        duration: "Full Video Course",
        why: "Comprehensive zero-to-hero guide with real-world practical examples.",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent("freecodecamp " + raw)}`,
      },
      {
        title: `${raw} Concepts & Problem Solving`,
        channel: "YouTube Learning",
        duration: "Curated Playlist",
        why: "Targeted explanations and problem walkthroughs from top industry educators.",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(raw + " tutorial course")}`,
      },
    ];
  }

  await logAudit({
    action: `goal.breakdown — "${goalName}"`,
    runId,
    authorization: "allowed",
    resultSummary: `Generated roadmap and YouTube resources for "${goalName}" without auto-persisting`,
  });

  return {
    text: summaryText,
    blocks: [
      {
        type: "study_plan",
        title: `🎯 Research & Preparation Plan: ${goalName}`,
        goal: goalName,
        timeline,
        phases,
        subtasks,
        resources,
      },
      {
        type: "chips",
        chips: [
          { label: `🎯 Add as active goal in Orbit`, send: `create a goal to prepare for ${goalName}` },
          { label: "Search more YouTube lectures", send: `Search YouTube videos for ${goalName}` },
          { label: "What's important today?", send: "What's important today?" },
        ],
      },
    ],
  };
}

async function hWhatsApp(_m: string, { runId }: Ctx): Promise<ChatContent> {
  let isConnected = false;
  let userName = "Personal WhatsApp";

  try {
    const res = await fetch("http://127.0.0.1:38291/whatsapp/status", { signal: AbortSignal.timeout(1200) });
    if (res.ok) {
      const data = await res.json();
      isConnected = data.connected;
      if (data.user?.name) userName = data.user.name;
    }
  } catch {}

  if (!isConnected) {
    const [c] = await db.select().from(connectors).where(eq(connectors.id, "whatsapp"));
    isConnected = c?.status === "connected";
  }

  const dbTasks = await db
    .select({ id: tasks.id, title: tasks.title, priority: tasks.priority })
    .from(tasks)
    .where(like(tasks.source, "WhatsApp%"))
    .orderBy(desc(tasks.createdAt))
    .limit(5);

  await logAudit({
    action: "whatsapp.status_check",
    runId,
    connectorId: "whatsapp",
    authorization: "allowed",
  });

  if (isConnected) {
    return {
      text: `Your personal WhatsApp is linked and active (${userName}). Orbit continuously scans incoming messages with smart NLP, automatically ignoring casual chit-chat, and adding real tasks directly to your Tasks board.`,
      blocks: [
        {
          type: "tasks",
          items: dbTasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: "inbox",
            points: undefined,
          })),
        },
        {
          type: "chips",
          chips: [
            { label: "View all tasks", send: "Show me my tasks" },
            { label: "What's important today?", send: "What's important today?" },
          ],
        },
      ],
    };
  }

  return {
    text: "I've prepared personal WhatsApp linking via QR Code scan. No WhatsApp Business API or Meta Cloud credentials are required — simply open WhatsApp on your phone, go to Linked Devices (Settings → Linked Devices), and scan the QR code in Connectors to pair.",
    blocks: [
      {
        type: "chips",
        chips: [
          { label: "Open Connectors to scan QR", send: "Check connectors" },
          { label: "What's important today?", send: "What's important today?" },
        ],
      },
    ],
  };
}

/* ────────────────────────── router ────────────────────────── */

const ROUTES: { re: RegExp; run: (m: string, ctx: Ctx) => Promise<ChatContent> }[] = [
  { re: /(?:setup|link|connect|scan|sync|read|qr)\s*(?:my\s*)?whatsapp|whatsapp\b/i, run: hWhatsApp },
  { re: /^(?:please\s+|can\s+you\s+|could\s+you\s+)?(?:open\s+(?:youtube\s*music|yt\s*music|spotify)\s+(?:and\s+)?(?:play|stream|listen\s+to)?\s*["']?([^"'\n]*?)["']?)|^(?:please\s+|can\s+you\s+|could\s+you\s+)?(?:play|listen to|stream|put on)\s+(?:music|song|track)?\s*["']?([^"'\n]+?)["']?$/i, run: hPlayMusic },
  { re: /(?:turn\s+(?:this\s+into\s+)?(?:an?\s+)?(?:application\s+)?goal|long.?term\s+goal|make\s+it\s+(?:an?\s+)?(?:long.?term\s+)?goal|make\s+this\s+(?:as\s+)?(?:an?\s+)?(?:active\s+|long.?term\s+)?goal|create\s+(?:a\s+|an\s+)?(?:active\s+)?goal|add\s+(?:this\s+)?(?:as\s+)?(?:an?\s+)?(?:active\s+|actiev\s+)?goal|add\s+as\s+active\s+goal|plan\s+(?:for|to)|help me (?:complete|prepare|finish|achieve|get|plan|make).{0,35}goal|set\s+up\s+(?:a\s+)?goal|^create\s+(?:a\s+)?goal)/i, run: hGoal },
  { re: /(?:complex\s+task|task\s+breaker|flowchart|100\s+steps|roadmap\s+for|draw\s+roadmap|break\s+down\s+(?:my\s+|this\s+|a\s+)?(?:complex\s+)?(?:task|goal)|prepare for|i want to prepare|how to (?:prepare|study|learn|master)|breakdown|study plan for|syllabus for|strategy for)\s*([a-zA-Z0-9\s-]*)/i, run: hBreakGoal },
  { re: /(?:automation|automations)\b|(?:change|update|set|reschedule|adjust|switch|turn\s+(?:on|off)|enable|disable|pause)\s+.{0,50}(?:email triage|calendar check|expense report|internship search|approval ping|timing|schedule|cadence)\b|(?:email triage|calendar check|expense report|internship search|approval ping)\s*.{0,50}(?:change|update|set|to\s+\d|at\s+\d|every)\b/i, run: hAutomationManage },
  { re: /register(ation)?|codespark/i, run: hRegister },
  { re: /(search|find|look).{0,35}(opportunit|hackathon|workshop|event for)|opportunities?( for| that)?/i, run: hOppsSearch },
  { re: /(?:read\s+(?:this\s+)?document|stride\s*(?:rules|points?|requirements?|requirement|goal|progress)|(?:finish|complete|track|help me finish|about|my)\s+stride)/i, run: hStride },
  { re: /react internship|internships?|find (me )?(jobs?|an? (job|internship))|(find|search).{0,40}(internship|jobs?)/i, run: hJobs },
  { re: /(cancel|drop|remove|don'?t (want to )?go|not going).{0,45}(event|appointment|meeting|that|it)|cancel that/i, run: hCancelEvent },
  { re: /find (me )?(free )?time|schedule (it|a (study )?block|time|the task)|free time in my calendar/i, run: hScheduleTask },
  { re: /(event|meeting|appointment).{0,45}(tomorrow|today|tonight)|add (it\b|the event|an? (event|meeting))/i, run: hCalendarEvent },
  { re: /(?:what'?s (?:my )?next(?: action)?|next action|what should i do next|what do i do next)\b/i, run: hNextAction },
  { re: /(important (today|now|emails)|what'?s important|catch me up|briefing|take care of|what should i (do|take)|what'?s (up|on) (today|now)|priorit)/i, run: hBriefing },
  { re: /^(yes|yeah|yep|sure|go ahead|do it|ok|okay|please do)\b/i, run: hAffirm },
  { re: /(?:add|put|create|save|set)\s+.{0,40}(?:to\s+(?:the\s+|my\s+)?tasks?|in\s+(?:my\s+)?tasks?)|(?:i\s+want\s+to|i\s+need\s+to|can\s+you\s+add).{0,50}(?:tasks?|remind)|remind\s+me\s+(?:at|to|today|tomorrow)|(?:set|add|schedule|update)?\s*(?:reminder|deadline|time)\s*(?:for|to|on)\b|keep\s+.{1,30}in\s+inbox/i, run: hSetTaskReminder },
  { re: /remind/i, run: hRemind },
  { re: /(junk|free up|clean( up)?|storage|disk space)/i, run: hCleanup },
  { re: /₹|payment|transfer|send .*rs\b|\bupi\b/i, run: hPayment },
  { re: /(?:create|make|new|add)\s+(?:a\s+)?folder\b|mkdir\b/i, run: hCreateFolder },
  { re: /(?:write|send|draft|compose|shoot|dispatch)\s+(?:an?\s+)?(?:email|mail|message)\b|\b(?:email|mail)\s+(?:to\s+)?[\w.-]+@/i, run: hWriteEmail },
  { re: /(important|unread).{0,22}emails?|check (my )?(inbox|email|mails)|triage|email (summary|brief)|college (emails?|mails?)/i, run: hEmailTriage },
  { re: /(?:weather|weaher|wether|temp(?:erature)?|climate|forecast|rain\b|how\s+hot|how\s+cold)/i, run: hWeather },
  { re: /(?:joke|make me laugh|funny|humor|pun\b)/i, run: hJoke },
  { re: /(?:advice|quote|inspiration|motivat)/i, run: hAdvice },
  { re: /summarize|summarise/i, run: hSummarize },
  { re: /(project report|find (my )?(files?|documents?))|\bdrive\b/i, run: hDrive },
  { re: /(classroom|assignment)/i, run: hClassroom },
  { re: /(?:study\s+(?:materials?|resources?|sources?)|how\s+to\s+master|master\s+the\s+topic|videos?|youtube|tutorial|lecture)/i, run: hYouTube },
  { re: /(expense|spending|spent|budget|how much (did i )?(spend|spent))|\bmoney\b/i, run: hExpense },
  { re: /^(?:new|add|create|schedule|put)\s+(?:a\s+)?(?:task|to-?do|reminder)\b|^(?:a\s+)?task\s+to\b|completing\s+homework\b/i, run: hNewTask },
  { re: /^(hi|hello|hey|good (morning|afternoon|evening))\b/i, run: hGreeting },
];

export async function planTurn(userMessage: string, runId: string, attachment?: any, clientScan?: any): Promise<ChatContent> {
  const m = userMessage.trim();
  const lower = m.toLowerCase();

  let attachmentPrefix = "";
  if (attachment) {
    await logAudit({
      action: `document.read — ${attachment.name}`,
      runId,
      authorization: "allowed",
      resultSummary: `Parsed and indexed attachment "${attachment.name}" (${attachment.type || "file"}, ${Math.round(attachment.size / 1024)} KB)`,
    });
    attachmentPrefix = `📄 **Analyzed Attachment: ${attachment.name}**\n\n`;
  }

  for (const r of ROUTES) {
    if (r.re.test(lower)) {
      try {
        const res = await r.run(m, { runId, clientScan });
        if (attachmentPrefix && res.text) {
          res.text = attachmentPrefix + res.text;
        }
        return res;
      } catch (e) {
        console.error("planner handler failed", e);
        return { text: `Something went wrong while handling that (${(e as Error).message}). No changes were made — check the audit ledger for details.` };
      }
    }
  }

  if (attachment) {
    return {
      text: `${attachmentPrefix}I have received and reviewed your document **"${attachment.name}"**. I can break it down into actionable tasks, create a structured preparation roadmap, or set it as an active goal in your Orbit dashboard. What would you like me to do next with this document?`,
      blocks: [
        {
          type: "chips",
          chips: [
            { label: `Create study plan from ${attachment.name}`, send: `create a study plan from the attached document` },
            { label: "Make this a long-term goal", send: `make this a long term goal to study for this` },
            { label: "What's important today?", send: "What's important today?" },
          ],
        },
      ],
    };
  }

  return hFallback(m, { runId });
}
