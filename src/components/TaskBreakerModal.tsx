"use client";

import { useEffect, useState, useMemo } from "react";
import { generateGoalBreakdown, type GoalBreakdown } from "@/lib/goalBreakerEngine";
import { Badge, Btn, Icon } from "./ui";

export default function TaskBreakerModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("orbit_task_breaker_pinned") === "true";
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState<"flowchart" | "explorer">("flowchart");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [completedIds, setCompletedIds] = useState<Record<string, boolean>>({});

  // Active Goal Breakdown state
  const [breakdown, setBreakdown] = useState<GoalBreakdown | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem("orbit_active_breakdown");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  // Ensure an initial breakdown is always available (defaults to GATE or saved)
  useEffect(() => {
    if (!breakdown) {
      generateGoalBreakdown("GATE CS & IT").then((b) => {
        setBreakdown(b);
      });
    }
  }, [breakdown]);

  // Load completed step checks per specific goal
  useEffect(() => {
    if (!breakdown) return;
    const goalKey = breakdown.id || breakdown.goal.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    try {
      const saved = localStorage.getItem(`orbit_task_breaker_completed_${goalKey}`);
      if (saved) {
        setCompletedIds(JSON.parse(saved));
      } else {
        setCompletedIds({});
      }
    } catch {
      setCompletedIds({});
    }
  }, [breakdown?.id, breakdown?.goal]);

  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("orbit_task_breaker_pinned", String(next));
      } catch {}
      return next;
    });
  };

  // Event Listeners for Opening and Resetting
  useEffect(() => {
    const handleOpen = (e: any) => {
      const detail = e?.detail;
      if (detail?.breakdown) {
        setBreakdown(detail.breakdown);
        try {
          localStorage.setItem("orbit_active_breakdown", JSON.stringify(detail.breakdown));
        } catch {}
      } else if (detail?.goal) {
        generateGoalBreakdown(detail.goal).then((b) => {
          setBreakdown(b);
          try {
            localStorage.setItem("orbit_active_breakdown", JSON.stringify(b));
          } catch {}
        });
      }
      setIsOpen(true);
      setIsMinimized(false);
    };

    const handleReset = () => {
      setIsOpen(false);
      setIsMinimized(false);
      setCompletedIds({});
      try {
        if (breakdown) {
          const goalKey = breakdown.id || breakdown.goal.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          localStorage.removeItem(`orbit_task_breaker_completed_${goalKey}`);
        }
      } catch {}
    };

    window.addEventListener("orbit:open-task-breaker", handleOpen);
    window.addEventListener("orbit:reset", handleReset);
    return () => {
      window.removeEventListener("orbit:open-task-breaker", handleOpen);
      window.removeEventListener("orbit:reset", handleReset);
    };
  }, [breakdown]);

  // Save changes to localStorage per goal
  const toggleStep = (id: string) => {
    if (!breakdown) return;
    const goalKey = breakdown.id || breakdown.goal.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    setCompletedIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(`orbit_task_breaker_completed_${goalKey}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const switchGoalPreset = async (goalTopic: string) => {
    const b = await generateGoalBreakdown(goalTopic);
    setBreakdown(b);
    setSelectedCategory("all");
    setSearchQuery("");
    try {
      localStorage.setItem("orbit_active_breakdown", JSON.stringify(b));
    } catch {}
  };

  const subtasksList = breakdown?.subtasks || [];
  const totalSteps = subtasksList.length;
  const completedCount = useMemo(() => {
    return Object.values(completedIds).filter(Boolean).length;
  }, [completedIds]);

  const percentage = Math.round((completedCount / (totalSteps || 1)) * 100) || 0;

  // Filtered subtasks for explorer
  const filteredTasks = useMemo(() => {
    if (!breakdown) return [];
    return breakdown.subtasks.filter((t) => {
      const matchCat = selectedCategory === "all" || t.categoryId === selectedCategory;
      const matchSearch =
        !searchQuery ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.weight.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [breakdown, selectedCategory, searchQuery]);

  // Flowchart milestones
  const milestones = useMemo(() => {
    if (!breakdown || !breakdown.phases) return [];
    return breakdown.phases;
  }, [breakdown]);

  if (!breakdown) return null;

  // If closed and not minimized, do not render any floating pill
  if (!isOpen && !isMinimized) {
    return null;
  }

  // If minimized, show sleek floating dock widget in bottom right
  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-6 z-50 md:bottom-6 animate-fade-in">
        <div className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-surface/95 p-3 shadow-2xl backdrop-blur-md transition-all hover:border-accent">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/20 text-accent text-sm">
            🎯
          </span>
          <div>
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
              <span className="max-w-[170px] truncate">{breakdown.goal}</span>
              <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[10.5px] text-accent">
                {completedCount}/{totalSteps} ({percentage}%)
              </span>
            </div>
            <div className="mt-1 h-1.5 w-36 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1 border-l border-line pl-2">
            <button
              onClick={() => {
                setIsMinimized(false);
                setIsOpen(true);
              }}
              className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-ink transition-colors"
              title="Expand Studio"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
            <button
              onClick={() => {
                setIsMinimized(false);
                setIsOpen(false);
              }}
              className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-danger transition-colors"
              title="Close"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full Expanded Task Breaker Studio Window
  const studioContent = (
    <div
      className={`flex flex-col bg-surface transition-all duration-200 ${
        isPinned
          ? "h-full w-full"
          : isFullscreen
          ? "h-[98vh] w-[98vw] max-w-none rounded-2xl border border-line shadow-2xl"
          : "h-[90vh] max-h-[860px] w-full max-w-6xl rounded-2xl border border-line shadow-2xl"
      }`}
    >
      {/* Top Studio Header Bar */}
      <div className="flex items-center justify-between border-b border-line px-4 md:px-5 py-3.5 bg-bg/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent font-bold text-sm">
            🎯
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14.5px] font-semibold text-ink truncate">
                Task Breaker Studio · {breakdown.goal}
              </h2>
              <Badge tone="accent">{totalSteps} Steps</Badge>
              <span className="hidden sm:inline-block rounded-md border border-line bg-white/5 px-2 py-0.5 text-[11px] font-medium text-faint">
                {breakdown.timeline}
              </span>
            </div>
            <p className="text-[11px] text-faint truncate max-w-xl">
              {breakdown.summary || "Interactive milestone flowchart, actionable subtasks checklist & video lecture sources"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Preset Goal Switcher */}
          <div className="hidden lg:flex items-center gap-1 rounded-lg border border-line bg-bg p-0.5 text-[11px]">
            <span className="px-1.5 text-faint text-[10px] uppercase font-mono">Switch:</span>
            <button
              onClick={() => switchGoalPreset("GATE CS & IT")}
              className={`rounded px-1.5 py-0.5 transition ${breakdown.goal.includes("GATE") ? "bg-accent/20 text-accent font-semibold" : "text-muted hover:text-ink"}`}
            >
              GATE CS
            </button>
            <button
              onClick={() => switchGoalPreset("Tech Startup & Wealth Building")}
              className={`rounded px-1.5 py-0.5 transition ${breakdown.goal.includes("Startup") || breakdown.goal.includes("Billionaire") ? "bg-accent/20 text-accent font-semibold" : "text-muted hover:text-ink"}`}
            >
              Startup/Wealth
            </button>
            <button
              onClick={() => switchGoalPreset("Data Structures & Algorithms")}
              className={`rounded px-1.5 py-0.5 transition ${breakdown.goal.includes("Data Structures") ? "bg-accent/20 text-accent font-semibold" : "text-muted hover:text-ink"}`}
            >
              DSA
            </button>
            <button
              onClick={() => switchGoalPreset("Full Stack Web Development")}
              className={`rounded px-1.5 py-0.5 transition ${breakdown.goal.includes("Full Stack") ? "bg-accent/20 text-accent font-semibold" : "text-muted hover:text-ink"}`}
            >
              Full Stack
            </button>
          </div>

          {/* View Switcher */}
          <div className="flex rounded-lg border border-line bg-bg p-0.5 text-xs">
            <button
              onClick={() => setActiveTab("flowchart")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                activeTab === "flowchart"
                  ? "bg-accent/20 text-accent font-semibold"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span>⚡</span> Flowchart View
            </button>
            <button
              onClick={() => setActiveTab("explorer")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                activeTab === "explorer"
                  ? "bg-accent/20 text-accent font-semibold"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span>📋</span> Step Explorer
            </button>
          </div>

          {/* Window Controls: Pin to Side, Minimize, Maximize, Close */}
          <div className="flex items-center gap-1 border-l border-line pl-2 ml-1">
            <button
              onClick={togglePin}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                isPinned
                  ? "bg-accent/25 text-accent font-semibold border border-accent/40"
                  : "text-muted hover:bg-white/10 hover:text-ink"
              }`}
              title={isPinned ? "Unpin from side (switch to center modal)" : "Pin to side (keep studio visible while chatting)"}
            >
              <span>📌</span>
              <span className="hidden sm:inline">{isPinned ? "Pinned" : "Pin"}</span>
            </button>
            <button
              onClick={() => {
                setIsMinimized(true);
                setIsOpen(false);
              }}
              className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-accent transition-colors"
              title="Minimize (keep chatting while working)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14" />
              </svg>
            </button>
            {!isPinned && (
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-ink transition-colors"
                title={isFullscreen ? "Restore window" : "Maximize window"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
              </button>
            )}
            <button
              onClick={() => {
                setIsOpen(false);
                setIsMinimized(false);
              }}
              className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-danger transition-colors"
              title="Close"
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Global Progress Bar Bar */}
      <div className="flex items-center justify-between border-b border-line/60 bg-bg/25 px-5 py-2.5">
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-base font-bold text-accent">{completedCount}</span>
            <span className="text-[12px] text-faint">/ {totalSteps} steps completed</span>
          </div>
          <div className="h-2 w-48 overflow-hidden rounded-full bg-white/10 md:w-64">
            <div
              className="h-full bg-gradient-to-r from-accent to-emerald-400 transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="font-mono text-[11px] font-semibold text-muted">{percentage}% Complete</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-faint">
          <span className="hidden md:inline">💡 You can minimize anytime to chat or manage tasks uninterrupted</span>
          <button
            onClick={() => {
              if (confirm(`Reset all step completion checks for "${breakdown.goal}"?`)) {
                setCompletedIds({});
                const goalKey = breakdown.id || breakdown.goal.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                localStorage.removeItem(`orbit_task_breaker_completed_${goalKey}`);
              }
            }}
            className="text-faint hover:text-muted underline ml-2"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === "flowchart" ? (
          /* Flowchart Node Graph View */
          <div className="space-y-8">
            {milestones.map((m, mIndex) => {
              let phaseTasks = breakdown.subtasks.filter((t) => m.categoryIds?.includes(t.categoryId));
              // Fallback partitioning if categories don't match exactly
              if (phaseTasks.length === 0 && breakdown.phases.length > 0) {
                const perPhase = Math.ceil(breakdown.subtasks.length / breakdown.phases.length);
                phaseTasks = breakdown.subtasks.slice(mIndex * perPhase, (mIndex + 1) * perPhase);
              }

              const phaseDone = phaseTasks.filter((t) => completedIds[t.id]).length;
              const phasePct = Math.round((phaseDone / (phaseTasks.length || 1)) * 100) || 0;

              return (
                <div
                  key={m.id || mIndex}
                  className="relative rounded-xl border border-line bg-surface p-4 shadow-sm transition-all hover:border-line/90"
                >
                  {/* Milestone Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-black"
                        style={{ backgroundColor: m.color || "#6366f1" }}
                      >
                        {mIndex + 1}
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-ink">{m.name}</h3>
                        <div className="text-[11px] text-faint">
                          {m.duration} · {m.focus} ({phaseTasks.length} Steps)
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-muted">
                        {phaseDone}/{phaseTasks.length} Done ({phasePct}%)
                      </span>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full transition-all duration-300"
                          style={{ width: `${phasePct}%`, backgroundColor: m.color || "#6366f1" }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Flow Nodes Grid */}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {phaseTasks.map((task) => {
                      const isDone = !!completedIds[task.id];
                      return (
                        <div
                          key={task.id}
                          onClick={() => toggleStep(task.id)}
                          className={`group relative flex cursor-pointer flex-col justify-between rounded-lg border p-2.5 transition-all ${
                            isDone
                              ? "border-emerald-500/40 bg-emerald-950/15"
                              : "border-line bg-bg/60 hover:border-accent/40 hover:bg-surface"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={isDone}
                              onChange={() => toggleStep(task.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5 h-3.5 w-3.5 rounded border-line text-accent focus:ring-0"
                            />
                            <div className="flex-1">
                              <span
                                className={`text-[12px] font-medium leading-tight ${
                                  isDone ? "line-through text-muted" : "text-ink group-hover:text-accent"
                                }`}
                              >
                                {task.title}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between border-t border-line/40 pt-1.5 text-[10px]">
                            <span className="text-faint truncate max-w-[120px]">{task.categoryName}</span>
                            <a
                              href={task.resource.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-accent hover:bg-accent/20"
                              title={`Watch ${task.resource.title} on YouTube`}
                            >
                              <span>▶</span> {task.resource.badge || "Lecture"}
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Connecting Visual Arrow to next milestone */}
                  {mIndex < milestones.length - 1 && (
                    <div className="absolute -bottom-6 left-8 flex items-center gap-1 text-[11px] font-mono text-faint">
                      <span>↓</span> Connected Sequence
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Categorized Step Explorer View */
          <div className="space-y-4">
            {/* Category Pills & Search */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                    selectedCategory === "all"
                      ? "bg-accent text-black font-semibold"
                      : "border border-line bg-bg text-muted hover:text-ink"
                  }`}
                >
                  All Topics ({totalSteps})
                </button>
                {breakdown.categories.map((cat) => {
                  const count = breakdown.subtasks.filter((t) => t.categoryId === cat.id).length;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-medium transition-colors ${
                        isSelected
                          ? "bg-accent/20 text-accent font-semibold border border-accent/40"
                          : "border border-line bg-bg text-muted hover:text-ink"
                      }`}
                    >
                      <span>{cat.icon}</span> {cat.shortName} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="w-full md:w-64">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search subtasks or topics..."
                  className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            {/* Subtask Cards List */}
            <div className="grid gap-2.5 md:grid-cols-2">
              {filteredTasks.map((t, idx) => {
                const isDone = !!completedIds[t.id];
                return (
                  <div
                    key={t.id}
                    onClick={() => toggleStep(t.id)}
                    className={`flex cursor-pointer flex-col justify-between rounded-xl border p-3 transition-all ${
                      isDone
                        ? "border-emerald-500/35 bg-emerald-950/10"
                        : "border-line bg-bg/50 hover:border-accent/40 hover:bg-surface"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => toggleStep(t.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 h-4 w-4 rounded border-line text-accent focus:ring-0"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-faint">#{idx + 1}</span>
                          <span
                            className={`text-[13px] font-medium ${
                              isDone ? "line-through text-muted" : "text-ink"
                            }`}
                          >
                            {t.title}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge tone="muted">{t.categoryName}</Badge>
                          <Badge tone="accent">{t.weight}</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-line/50 pt-2 text-[11px]">
                      <span className="text-muted truncate max-w-[240px]">
                        📚 {t.resource.creator}
                      </span>
                      <a
                        href={t.resource.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 rounded-md bg-accent/15 px-2.5 py-1 text-accent font-medium hover:bg-accent/25 transition-colors"
                      >
                        <span>▶</span> {t.resource.badge || "Watch Course"}
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Summary with Learning Resources */}
      <div className="flex flex-wrap items-center justify-between border-t border-line bg-bg/40 px-5 py-3 text-xs text-muted gap-2">
        <div className="flex items-center gap-2 truncate">
          <span className="text-accent font-medium">🎯 {breakdown.goal}</span>
          <span>•</span>
          <span className="text-faint">{totalSteps} interactive steps tracked across sessions</span>
        </div>
        <div className="flex items-center gap-2">
          <Btn size="sm" onClick={() => setIsMinimized(true)}>
            Minimize to Dock
          </Btn>
          <Btn variant="primary" size="sm" onClick={() => setIsOpen(false)}>
            Done
          </Btn>
        </div>
      </div>
    </div>
  );

  if (isPinned) {
    return (
      <div className="fixed top-0 right-0 bottom-0 z-40 w-full sm:w-[480px] md:w-[540px] lg:w-[580px] xl:w-[620px] border-l border-line bg-surface/98 shadow-2xl backdrop-blur-xl flex flex-col">
        {studioContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/75 backdrop-blur-sm animate-fade-in">
      {studioContent}
    </div>
  );
}
