"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Btn, Card, Icon, PageHead, Progress, StatusDot } from "./ui";

export type GoalView = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  deadline: string | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  aiReasoning: string | null;
  nextAction: string | null;
  sources: string[] | null;
  milestones: { id: string; title: string; detail: string | null; status: string | null }[];
  tasks: { id: string; title: string; status: string | null; deadline: string | null; points: number | null }[];
};

type ResourceItem = {
  title: string;
  type: "youtube" | "interactive" | "article" | "practice";
  creator: string;
  description: string;
  url: string;
  badge: string;
};

function getGoalResources(title: string, desc?: string | null): ResourceItem[] {
  const text = `${title} ${desc || ""}`.toLowerCase();

  if (/data structure|trees?|pointer|avl|hash|stack|queue|graph|algorithm|dsa|gate/i.test(text)) {
    return [
      {
        title: "Mastering Data Structures & Algorithms",
        type: "youtube",
        creator: "Abdul Bari",
        description: "The gold standard conceptual course for Trees, AVL Trees, Pointers, and Recursion.",
        url: "https://www.youtube.com/results?search_query=abdul+bari+data+structures",
        badge: "Top Rated Course",
      },
      {
        title: "Data Structures and Algorithms in 2024",
        type: "youtube",
        creator: "freeCodeCamp",
        description: "Comprehensive 8-hour crash course with visual memory representations and code.",
        url: "https://www.youtube.com/results?search_query=freecodecamp+data+structures+and+algorithms",
        badge: "Full Tutorial",
      },
      {
        title: "Binary Trees, AVL & Pointers Deep-Dive",
        type: "youtube",
        creator: "NeetCode",
        description: "Visual problem-solving patterns for tree traversals, height balancing, and pointer manipulation.",
        url: "https://www.youtube.com/results?search_query=neetcode+trees+avl+data+structures",
        badge: "Visual Breakdown",
      },
      {
        title: "VisuAlgo — Interactive Algorithm Visualizer",
        type: "interactive",
        creator: "Steven Halim (NUS)",
        description: "Animated step-by-step visualizations of AVL rotations, Hash tables, Binary Search Trees.",
        url: "https://visualgo.net/en",
        badge: "Interactive Tool",
      },
      {
        title: "Hashing & Collision Resolution Techniques",
        type: "youtube",
        creator: "Jenny's Lectures",
        description: "Clear breakdown of linear probing, quadratic probing, and chaining methods.",
        url: "https://www.youtube.com/results?search_query=jennys+lectures+hashing",
        badge: "Concept Lecture",
      },
      {
        title: "GeeksforGeeks Data Structures Master Sheet",
        type: "practice",
        creator: "GeeksforGeeks",
        description: "Curated problem sets, time complexity cheat sheets, and assessment MCQs.",
        url: "https://www.geeksforgeeks.org/data-structures/",
        badge: "Practice Sheet",
      },
    ];
  }

  if (/react|frontend|web|javascript|internship|next\.?js/i.test(text)) {
    return [
      {
        title: "React Full Modern Course (2024 Edition)",
        type: "youtube",
        creator: "freeCodeCamp",
        description: "Complete hands-on projects, component architecture, hooks, and performance tuning.",
        url: "https://www.youtube.com/results?search_query=freecodecamp+react+tutorial",
        badge: "Full Course",
      },
      {
        title: "Modern React & State Masterclass",
        type: "youtube",
        creator: "Net Ninja",
        description: "Modular playlist breaking down React hooks, custom hooks, and context.",
        url: "https://www.youtube.com/results?search_query=net+ninja+react+modern",
        badge: "Playlist",
      },
      {
        title: "Official React Documentation & Interactive Sandbox",
        type: "interactive",
        creator: "React Team",
        description: "Interactive tutorials with built-in sandbox exercises for mastering core concepts.",
        url: "https://react.dev/learn",
        badge: "Official Docs",
      },
      {
        title: "Frontend Developer Roadmap",
        type: "interactive",
        creator: "Roadmap.sh",
        description: "Visual roadmap covering essential frontend skills from junior to senior engineer.",
        url: "https://roadmap.sh/react",
        badge: "Career Roadmap",
      },
    ];
  }

  if (/placement|tcs|aptitude|interview|job/i.test(text)) {
    return [
      {
        title: "TCS NQT Full Preparation Masterclass",
        type: "youtube",
        creator: "CareerRide",
        description: "Quantitative aptitude, logical reasoning, and coding round strategy.",
        url: "https://www.youtube.com/results?search_query=tcs+nqt+preparation+full+course",
        badge: "Exam Prep",
      },
      {
        title: "Technical Interview Question & Answer Patterns",
        type: "youtube",
        creator: "Knowledge Gate",
        description: "Core CS fundamentals (OS, DBMS, Networks, OOPs) commonly asked in college placements.",
        url: "https://www.youtube.com/results?search_query=technical+interview+preparation+cs",
        badge: "Interview Q&A",
      },
      {
        title: "IndiaBIX Quantitative Aptitude Practice",
        type: "practice",
        creator: "IndiaBIX",
        description: "Topic-by-topic aptitude practice questions with step-by-step explanations.",
        url: "https://www.indiabix.com/",
        badge: "Mock Tests",
      },
    ];
  }

  const cleanTitle = title.replace(/—|-.*$/, "").trim();
  return [
    {
      title: `${cleanTitle} — YouTube Master Video Tutorials`,
      type: "youtube",
      creator: "Curated YouTube Courses",
      description: `High-yield video guides, breakdown lectures, and walkthroughs for ${cleanTitle}.`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanTitle + " tutorial complete guide")}`,
      badge: "YouTube Video",
    },
    {
      title: "Interactive Skill & Career Roadmap",
      type: "interactive",
      creator: "Roadmap.sh",
      description: "Community-driven visual learning roadmaps for modern technical topics.",
      url: "https://roadmap.sh",
      badge: "Roadmap Guide",
    },
    {
      title: "GeeksforGeeks Topic Notes & Exercises",
      type: "practice",
      creator: "GeeksforGeeks",
      description: `Practice problems, theory summaries, and test cases covering ${cleanTitle}.`,
      url: `https://www.google.com/search?q=${encodeURIComponent("site:geeksforgeeks.org " + cleanTitle)}`,
      badge: "Knowledge Base",
    },
  ];
}

const MS_NEXT: Record<string, string> = { pending: "in_progress", in_progress: "done", done: "pending" };

export default function GoalsBoard({ goals }: { goals: GoalView[] }) {
  const [open, setOpen] = useState<string | null>(goals[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<Record<string, "roadmap" | "tasks" | "resources">>({});
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const mutate = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await fetch("/api/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!goals.length) {
    return (
      <div>
        <PageHead title="Goals" sub="Long-term objectives with milestones, tasks, interactive roadmap, and study guides." />
        <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center text-[13px] text-faint">
          No goals yet — give Orbit one in the command center.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHead
        title="Goals"
        sub="Each goal is an interactive milestone roadmap with linked tasks, live progress tracking, and curated study resources."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {goals.map((g) => {
          // Calculate authoritative progress
          const completedTasksCount = g.tasks.filter((t) => t.status === "completed").length;
          const pointsSum = g.tasks.reduce((sum, t) => sum + (t.status === "completed" ? (t.points ?? 0) : 0), 0);

          const currentValue = g.unit === "points"
            ? (pointsSum > 0 ? pointsSum : (g.currentValue ?? 0))
            : (g.tasks.length > 0 ? completedTasksCount : (g.currentValue ?? 0));

          const targetValue = g.targetValue || (g.tasks.length || 1);
          const pct = Math.min(100, Math.round((currentValue / targetValue) * 100));
          const isDone = pct >= 100;
          const days = g.deadline ? Math.max(0, Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000)) : null;
          const isOpen = open === g.id;
          const currentTab = activeTab[g.id] || "roadmap";
          const resources = getGoalResources(g.title, g.description);

          return (
            <Card key={g.id} className={`p-4 transition-all ${isDone ? "border-ok/40 bg-surface/90" : ""}`} glow={isOpen}>
              {/* Header Accordion Button */}
              <button className="w-full text-left" onClick={() => setOpen(isOpen ? null : g.id)}>
                <div className="flex items-center gap-2">
                  <Icon name="goals" size={16} className={isDone ? "text-ok" : "text-accent"} />
                  <span className="text-[15px] font-semibold text-ink">{g.title}</span>
                  <Badge tone={isDone ? "ok" : g.status === "active" ? "accent" : "muted"} className="ml-auto">
                    {isDone ? "Completed ✓" : g.status}
                  </Badge>
                  <Icon name="chevron" size={13} className={`text-faint transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </div>

                {/* Progress Bar & Counter */}
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-[26px] font-bold text-ink tracking-tight">
                    {currentValue}
                    <span className="text-[15px] font-medium text-faint"> / {targetValue}</span>
                  </span>
                  <span className="text-[12.5px] font-medium text-muted">{g.unit}</span>
                  <span className={`ml-auto font-mono text-[12.5px] font-semibold ${isDone ? "text-ok" : "text-muted"}`}>
                    {pct}%{days !== null ? ` · ${days} days left` : ""}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Progress value={pct} tone={isDone ? "ok" : pct >= 60 ? "ok" : "accent"} />
                </div>
              </button>

              {isOpen && (
                <div className="mt-4 space-y-4 border-t border-line/70 pt-3.5">
                  {/* Next Action Banner */}
                  {g.nextAction && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-accent/30 bg-accent-soft/70 px-3.5 py-2.5 text-[12.5px] text-ink">
                      <Icon name="orbit" size={14} className="mt-0.5 shrink-0 text-accent" />
                      <div>
                        <span className="font-semibold text-accent">Next Action:</span>{" "}
                        <span className="text-ink font-medium">{g.nextAction}</span>
                      </div>
                    </div>
                  )}

                  {/* View Tabs */}
                  <div className="flex items-center gap-1 rounded-lg border border-line bg-bg p-1 text-[12px]">
                    <button
                      onClick={() => setActiveTab((prev) => ({ ...prev, [g.id]: "roadmap" }))}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition ${
                        currentTab === "roadmap" ? "bg-surface text-ink shadow-sm border border-line/50" : "text-muted hover:text-ink"
                      }`}
                    >
                      <Icon name="activity" size={13} className={currentTab === "roadmap" ? "text-accent" : "text-faint"} />
                      <span>Roadmap Flow</span>
                    </button>
                    <button
                      onClick={() => setActiveTab((prev) => ({ ...prev, [g.id]: "tasks" }))}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition ${
                        currentTab === "tasks" ? "bg-surface text-ink shadow-sm border border-line/50" : "text-muted hover:text-ink"
                      }`}
                    >
                      <Icon name="tasks" size={13} className={currentTab === "tasks" ? "text-accent" : "text-faint"} />
                      <span>Objectives ({completedTasksCount}/{g.tasks.length || g.milestones.length})</span>
                    </button>
                    <button
                      onClick={() => setActiveTab((prev) => ({ ...prev, [g.id]: "resources" }))}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition ${
                        currentTab === "resources" ? "bg-surface text-ink shadow-sm border border-line/50" : "text-muted hover:text-ink"
                      }`}
                    >
                      <span className="text-[12px]">📺</span>
                      <span>Study & Videos</span>
                      <span className="ml-1 rounded-full bg-accent/20 px-1.5 py-0.2 text-[10px] text-accent font-semibold">{resources.length}</span>
                    </button>
                  </div>

                  {/* TAB 1: INTERACTIVE VISUAL ROADMAP */}
                  {currentTab === "roadmap" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-[11px] text-faint">
                        <span className="font-semibold uppercase tracking-wider">Milestone Roadmap</span>
                        <span>Click any phase to toggle status</span>
                      </div>

                      {/* Visual Connected Stepper Flowchart */}
                      <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-[2px] before:bg-gradient-to-b before:from-accent before:via-accent/40 before:to-line">
                        {g.milestones.map((m, idx) => {
                          const isPhaseDone = m.status === "done";
                          const isPhaseInProgress = m.status === "in_progress";

                          return (
                            <div key={m.id} className="relative group">
                              {/* Node Step Dot */}
                              <div
                                onClick={() => void mutate({ action: "milestone", id: m.id, status: MS_NEXT[m.status ?? "pending"] })}
                                className={`absolute -left-[30px] top-1 grid h-5 w-5 place-items-center rounded-full border text-[10.5px] font-bold cursor-pointer transition-all ${
                                  isPhaseDone
                                    ? "border-ok bg-ok text-black shadow-md glow-ok"
                                    : isPhaseInProgress
                                    ? "border-accent bg-accent text-white animate-pulse glow-accent"
                                    : "border-line bg-surface text-faint group-hover:border-accent/60"
                                }`}
                                title="Click to toggle milestone state"
                              >
                                {isPhaseDone ? "✓" : idx + 1}
                              </div>

                              {/* Phase Content Box */}
                              <div
                                onClick={() => void mutate({ action: "milestone", id: m.id, status: MS_NEXT[m.status ?? "pending"] })}
                                className={`cursor-pointer rounded-xl border p-3 transition-all hover:brightness-105 ${
                                  isPhaseDone
                                    ? "border-ok/30 bg-ok/5"
                                    : isPhaseInProgress
                                    ? "border-accent/40 bg-accent-soft/40 shadow-sm"
                                    : "border-line bg-surface/70"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10.5px] font-semibold text-accent uppercase">Phase {idx + 1}</span>
                                    <span className={`text-[13px] font-medium ${isPhaseDone ? "text-faint line-through" : "text-ink font-semibold"}`}>
                                      {m.title}
                                    </span>
                                  </div>
                                  <Badge
                                    tone={isPhaseDone ? "ok" : isPhaseInProgress ? "accent" : "muted"}
                                    className="shrink-0"
                                  >
                                    {isPhaseDone ? "Done" : isPhaseInProgress ? "In Progress" : "Pending"}
                                  </Badge>
                                </div>
                                {m.detail && <p className="mt-1 text-[11.5px] text-muted">{m.detail}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Roadmap Summary Banner */}
                      <div className="mt-2 flex items-center justify-between rounded-lg border border-line bg-bg px-3 py-2 text-[11.5px] text-muted">
                        <span className="flex items-center gap-1.5">
                          <StatusDot tone={isDone ? "ok" : "accent"} pulse={!isDone} />
                          {isDone ? "Roadmap 100% Completed!" : `Advancing through Phase ${g.milestones.findIndex((m) => m.status !== "done") + 1} of ${g.milestones.length}`}
                        </span>
                        <button
                          onClick={() => setActiveTab((prev) => ({ ...prev, [g.id]: "resources" }))}
                          className="text-accent hover:underline text-[11px] font-medium"
                        >
                          View Study Guides →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: OBJECTIVES & ACTIONABLE TASKS */}
                  {currentTab === "tasks" && (
                    <div className="space-y-3.5">
                      <div>
                        <div className="mb-2 flex items-center justify-between text-[11px] text-faint">
                          <span className="font-semibold uppercase tracking-wider">Objectives & Tasks</span>
                          <span>{completedTasksCount} of {g.tasks.length} completed</span>
                        </div>
                        <div className="space-y-1.5">
                          {g.tasks.map((t) => {
                            const isTaskDone = t.status === "completed";
                            return (
                              <button
                                key={t.id}
                                disabled={busy}
                                onClick={() =>
                                  void mutate({
                                    action: "task.status",
                                    id: t.id,
                                    status: isTaskDone ? "planned" : "completed",
                                  })
                                }
                                className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition hover:brightness-110 ${
                                  isTaskDone ? "border-ok/30 bg-ok/5" : "border-line bg-surface hover:bg-white/[0.04]"
                                }`}
                              >
                                <span
                                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                                    isTaskDone ? "border-ok bg-ok text-black shadow-sm" : "border-line text-transparent hover:border-accent"
                                  }`}
                                >
                                  <Icon name="check" size={12} />
                                </span>
                                <span className={`text-[13px] ${isTaskDone ? "text-faint line-through" : "text-ink font-medium"}`}>
                                  {t.title}
                                </span>
                                {typeof t.points === "number" && (
                                  <Badge tone="accent" className="ml-auto shrink-0">
                                    +{t.points} pts
                                  </Badge>
                                )}
                                <span className={`${typeof t.points === "number" ? "" : "ml-auto"} font-mono text-[10.5px] uppercase text-faint`}>
                                  {t.status}
                                </span>
                              </button>
                            );
                          })}
                          {g.tasks.length === 0 && (
                            <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[12px] text-faint">
                              No tasks linked yet. Orbit automatically creates tasks when planning goals.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Milestones Quick List */}
                      <div>
                        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">Milestones Overview</div>
                        <div className="space-y-1">
                          {g.milestones.map((m) => (
                            <div key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-[12px]">
                              <StatusDot tone={m.status === "done" ? "ok" : m.status === "in_progress" ? "accent" : "faint"} />
                              <span className={m.status === "done" ? "text-faint line-through" : "text-ink"}>{m.title}</span>
                              <span className="ml-auto text-[11px] text-faint">{m.detail}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: STUDY RESOURCES & YOUTUBE SUGGESTIONS */}
                  {currentTab === "resources" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-[11px] text-faint">
                        <span className="font-semibold uppercase tracking-wider">Recommended Study Sources & YouTube</span>
                        <a
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(g.title + " full course playlist")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline flex items-center gap-1"
                        >
                          <Icon name="external" size={11} /> More on YouTube
                        </a>
                      </div>

                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {resources.map((res, i) => (
                          <a
                            key={i}
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex flex-col justify-between rounded-xl border border-line bg-surface p-3 transition-all hover:border-accent/40 hover:bg-white/[0.04] hover:shadow-md"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                                <span className="inline-flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                                  {res.type === "youtube" ? "▶ YouTube" : res.type === "interactive" ? "⚡ Interactive" : "📖 Guide"}
                                </span>
                                <Badge tone="accent" className="text-[9px]">{res.badge}</Badge>
                              </div>
                              <h4 className="text-[12.5px] font-semibold text-ink group-hover:text-accent transition-colors line-clamp-2">
                                {res.title}
                              </h4>
                              <p className="mt-1 text-[11px] text-muted line-clamp-2">{res.description}</p>
                            </div>

                            <div className="mt-2.5 flex items-center justify-between border-t border-line/50 pt-2 text-[11px]">
                              <span className="text-faint">{res.creator}</span>
                              <span className="flex items-center gap-1 text-accent font-medium group-hover:translate-x-0.5 transition-transform">
                                Open ↗
                              </span>
                            </div>
                          </a>
                        ))}
                      </div>

                      {/* YouTube Quick Search Card */}
                      <div className="rounded-xl border border-line/60 bg-gradient-to-r from-red-500/10 via-surface to-accent/10 p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[20px]">📺</span>
                          <div>
                            <div className="text-[12.5px] font-semibold text-ink">Need custom video explanations?</div>
                            <div className="text-[11px] text-muted">Ask Orbit AI in the chat to break down complex topics or find extra lecture notes.</div>
                          </div>
                        </div>
                        <Btn size="sm" variant="ghost" onClick={() => router.push("/")} className="shrink-0">
                          Ask Orbit
                        </Btn>
                      </div>
                    </div>
                  )}

                  {/* AI Reasoning and Sources */}
                  {g.aiReasoning && (
                    <div className="rounded-lg border border-line bg-bg px-3 py-2 text-[11.5px] text-muted">
                      <span className="font-semibold text-faint">AI reasoning: </span>
                      {g.aiReasoning}
                    </div>
                  )}
                  {g.sources && g.sources.length > 0 && (
                    <div className="text-[11px] text-faint">Sources: {g.sources.join(" · ")}</div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end">
        <Btn size="sm" variant="ghost" onClick={() => router.push("/")}>
          <Icon name="plus" size={12} /> New goal via Orbit
        </Btn>
      </div>
    </div>
  );
}
