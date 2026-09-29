"use client";

import { useEffect, useState, useMemo } from "react";
import { GATE_CATEGORIES, GATE_SUBTASKS, type CuratedSubtask } from "@/lib/gateCurriculum";
import { Badge, Btn, Icon } from "./ui";

export default function TaskBreakerModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"flowchart" | "explorer">("flowchart");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [completedIds, setCompletedIds] = useState<Record<string, boolean>>({});

  // Load saved state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("orbit_task_breaker_completed");
      if (saved) {
        setCompletedIds(JSON.parse(saved));
      }
    } catch {}

    const handleOpen = () => {
      setIsOpen(true);
      setIsMinimized(false);
    };

    const handleReset = () => {
      setIsOpen(false);
      setIsMinimized(false);
      setCompletedIds({});
      try {
        localStorage.removeItem("orbit_task_breaker_completed");
      } catch {}
    };

    window.addEventListener("orbit:open-task-breaker", handleOpen);
    window.addEventListener("orbit:reset", handleReset);
    return () => {
      window.removeEventListener("orbit:open-task-breaker", handleOpen);
      window.removeEventListener("orbit:reset", handleReset);
    };
  }, []);

  // Save changes to localStorage
  const toggleStep = (id: string) => {
    setCompletedIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem("orbit_task_breaker_completed", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const totalSteps = GATE_SUBTASKS.length;
  const completedCount = useMemo(() => {
    return Object.values(completedIds).filter(Boolean).length;
  }, [completedIds]);

  const percentage = Math.round((completedCount / totalSteps) * 100) || 0;

  // Filtered subtasks for explorer
  const filteredTasks = useMemo(() => {
    return GATE_SUBTASKS.filter((t) => {
      const matchCat = selectedCategory === "all" || t.categoryId === selectedCategory;
      const matchSearch =
        !searchQuery ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.weight.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  // Flowchart milestones
  const milestones = useMemo(() => {
    return [
      {
        id: "m1",
        title: "Phase 1: High-Weight Foundations",
        subtitle: "Engg Maths & Discrete Structures · 21 Steps",
        categoryIds: ["em", "dm"],
        color: "#6366f1",
      },
      {
        id: "m2",
        title: "Phase 2: Core Engineering Systems",
        subtitle: "Operating Systems, DBMS & Networks · 30 Steps",
        categoryIds: ["os", "dbms", "cn"],
        color: "#38bdf8",
      },
      {
        id: "m3",
        title: "Phase 3: Algorithms & Code Mastery",
        subtitle: "Data Structures, Algorithms & Logic · 22 Steps",
        categoryIds: ["dsa", "coa"],
        color: "#10b981",
      },
      {
        id: "m4",
        title: "Phase 4: Theoretical CS & Automata",
        subtitle: "TOC & Compiler Design · 21 Steps",
        categoryIds: ["toc", "compiler"],
        color: "#f59e0b",
      },
      {
        id: "m5",
        title: "Phase 5: Diagnostic Mocks & PYQs",
        subtitle: "GateOverflow PYQ Analysis & Virtual Mocks · 16 Steps",
        categoryIds: ["mocks"],
        color: "#ec4899",
      },
    ];
  }, []);

  // If closed and not minimized, do not render any floating pill
  if (!isOpen && !isMinimized) {
    return null;
  }

  // If minimized, show sleek floating dock widget in bottom right
  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-6 z-50 md:bottom-6">
        <div className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-surface/95 p-3 shadow-2xl backdrop-blur-md transition-all hover:border-accent">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/20 text-accent text-sm">
            🎯
          </span>
          <div>
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
              <span>GATE CS Task Breaker</span>
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className={`flex flex-col rounded-2xl border border-line bg-surface shadow-2xl transition-all duration-200 ${
          isFullscreen
            ? "h-[98vh] w-[98vw] max-w-none"
            : "h-[90vh] max-h-[860px] w-full max-w-6xl"
        }`}
      >
        {/* Top Studio Header Bar */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5 bg-bg/50">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent font-bold text-sm">
              🎯
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-ink">
                  Task Breaker Studio · 110-Step Interactive Roadmap
                </h2>
                <Badge tone="accent">GATE CS & IT</Badge>
              </div>
              <p className="text-[11px] text-faint">
                Curated milestones, subtasks checklist, weightage breakdown & YouTube lecture playlists
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

            {/* Window Controls: Minimize, Maximize, Close */}
            <div className="flex items-center gap-1 border-l border-line pl-2 ml-1">
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
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-ink transition-colors"
                title={isFullscreen ? "Restore window" : "Maximize window"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
              </button>
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
                if (confirm("Reset all step completion checks for this roadmap?")) {
                  setCompletedIds({});
                  localStorage.removeItem("orbit_task_breaker_completed");
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
                const phaseTasks = GATE_SUBTASKS.filter((t) => m.categoryIds.includes(t.categoryId));
                const phaseDone = phaseTasks.filter((t) => completedIds[t.id]).length;
                const phasePct = Math.round((phaseDone / phaseTasks.length) * 100) || 0;

                return (
                  <div
                    key={m.id}
                    className="relative rounded-xl border border-line bg-surface p-4 shadow-sm transition-all hover:border-line/90"
                  >
                    {/* Milestone Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-black"
                          style={{ backgroundColor: m.color }}
                        >
                          {mIndex + 1}
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-ink">{m.title}</h3>
                          <div className="text-[11px] text-faint">{m.subtitle}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] text-muted">
                          {phaseDone}/{phaseTasks.length} Done ({phasePct}%)
                        </span>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full transition-all duration-300"
                            style={{ width: `${phasePct}%`, backgroundColor: m.color }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Flow Nodes Grid */}
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {phaseTasks.map((task, i) => {
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
                              <span className="text-faint">{task.categoryName}</span>
                              <a
                                href={task.resource.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-accent hover:bg-accent/20"
                                title={`Watch ${task.resource.title} on YouTube`}
                              >
                                <span>▶</span> Lecture
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Connecting Visual Arrow to next milestone */}
                    {mIndex < milestones.length - 1 && (
                      <div className="absolute -bottom-6 left-8 flex items-center gap-1 text-[11px] font-mono text-faint">
                        <span>↓</span> Connected Flow
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
                  {GATE_CATEGORIES.map((cat) => {
                    const count = GATE_SUBTASKS.filter((t) => t.categoryId === cat.id).length;
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
                    placeholder="Search topics (e.g. Deadlock)..."
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
                          <span>▶</span> Watch Playlist
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div className="flex items-center justify-between border-t border-line bg-bg/40 px-5 py-3 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span>Flowchart roadmap active</span>
            <span>•</span>
            <span>All subtasks are tracked across sessions</span>
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
    </div>
  );
}
