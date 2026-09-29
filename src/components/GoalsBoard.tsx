"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Btn, Card, Icon, PageHead, Progress, StatusDot } from "./ui";

export type GoalView = {
  id: string; title: string; description: string | null; status: string | null;
  deadline: string | null; targetValue: number | null; currentValue: number | null; unit: string | null;
  aiReasoning: string | null; nextAction: string | null; sources: string[] | null;
  milestones: { id: string; title: string; detail: string | null; status: string | null }[];
  tasks: { id: string; title: string; status: string | null; deadline: string | null; points: number | null }[];
};

const MS_NEXT: Record<string, string> = { pending: "in_progress", in_progress: "done", done: "pending" };
const T_NEXT: Record<string, string> = { inbox: "planned", planned: "in_progress", in_progress: "waiting", waiting: "completed", blocked: "planned", completed: "planned", cancelled: "inbox" };

export default function GoalsBoard({ goals }: { goals: GoalView[] }) {
  const [open, setOpen] = useState<string | null>(goals[0]?.id ?? null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const mutate = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await fetch("/api/mutate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      router.refresh();
    } finally { setBusy(false); }
  };

  if (!goals.length) {
    return (
      <div>
        <PageHead title="Goals" sub="Long-term objectives with milestones, tasks and progress." />
        <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center text-[13px] text-faint">No goals yet — give Orbit one in the command center.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHead title="Goals" sub="Each goal is a milestone chain with dependencies. Completing a points task advances the goal automatically." />
      <div className="grid gap-3 lg:grid-cols-2">
        {goals.map((g) => {
          const pct = Math.round(((g.currentValue ?? 0) / (g.targetValue || 1)) * 100);
          const days = g.deadline ? Math.max(0, Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000)) : null;
          const isOpen = open === g.id;
          return (
            <Card key={g.id} className="p-4" glow={isOpen}>
              <button className="w-full text-left" onClick={() => setOpen(isOpen ? null : g.id)}>
                <div className="flex items-center gap-2">
                  <Icon name="goals" size={15} className="text-accent" />
                  <span className="text-[15px] font-semibold text-ink">{g.title}</span>
                  <Badge tone={g.status === "active" ? "ok" : "muted"} className="ml-auto">{g.status}</Badge>
                  <Icon name="chevron" size={13} className={`text-faint transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="font-display text-[24px] font-semibold text-ink">{g.currentValue}<span className="text-[14px] text-faint"> / {g.targetValue}</span></span>
                  <span className="text-[12px] text-muted">{g.unit}</span>
                  <span className="ml-auto text-[12px] text-muted">{pct}%{days !== null ? ` · ${days} days left` : ""}</span>
                </div>
                <div className="mt-1.5"><Progress value={pct} tone={pct >= 70 ? "ok" : "accent"} /></div>
              </button>

              {isOpen && (
                <div className="mt-3.5 space-y-3.5 border-t border-line pt-3.5">
                  {g.nextAction && (
                    <div className="flex items-start gap-2 rounded-lg border border-accent/25 bg-accent-soft px-3 py-2 text-[12.5px] text-ink">
                      <Icon name="orbit" size={13} className="mt-0.5 shrink-0 text-accent" />
                      <span><span className="text-faint">Next action:</span> {g.nextAction}</span>
                    </div>
                  )}
                  <div>
                    <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-faint">Milestones</div>
                    <div className="space-y-1">
                      {g.milestones.map((m) => (
                        <button key={m.id} disabled={busy} onClick={() => void mutate({ action: "milestone", id: m.id, status: MS_NEXT[m.status ?? "pending"] })} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.04]">
                          <StatusDot tone={m.status === "done" ? "ok" : m.status === "in_progress" ? "accent" : "faint"} pulse={m.status === "in_progress"} />
                          <span className={`text-[13px] ${m.status === "done" ? "text-faint line-through" : "text-ink"}`}>{m.title}</span>
                          <span className="ml-auto text-[11px] text-faint">{m.detail}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-faint">Tasks</div>
                    <div className="space-y-1">
                      {g.tasks.map((t) => (
                        <button key={t.id} disabled={busy} onClick={() => void mutate({ action: "task.status", id: t.id, status: T_NEXT[t.status ?? "inbox"] })} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.04]">
                          <span className={`grid h-4 w-4 place-items-center rounded border ${t.status === "completed" ? "border-ok bg-ok/20 text-ok" : "border-line text-transparent"}`}><Icon name="check" size={10} /></span>
                          <span className={`text-[12.5px] ${t.status === "completed" ? "text-faint line-through" : "text-ink"}`}>{t.title}</span>
                          {typeof t.points === "number" && <Badge tone="accent" className="ml-auto">+{t.points}</Badge>}
                          <span className={`${typeof t.points === "number" ? "" : "ml-auto"} text-[10.5px] text-faint`}>{t.status}</span>
                        </button>
                      ))}
                      {g.tasks.length === 0 && <div className="px-2 text-[12px] text-faint">No tasks linked yet.</div>}
                    </div>
                  </div>
                  {g.aiReasoning && (
                    <div className="rounded-lg border border-line bg-bg px-3 py-2 text-[11.5px] text-muted">
                      <span className="font-semibold text-faint">AI reasoning: </span>{g.aiReasoning}
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
        <Btn size="sm" variant="ghost" onClick={() => router.push("/")}><Icon name="plus" size={12} /> New goal via Orbit</Btn>
      </div>
    </div>
  );
}
