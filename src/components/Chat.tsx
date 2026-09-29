"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Btn, Icon, Progress, RiskBadge, StatusDot, fmtInr } from "./ui";
import type { Block, ChatContent } from "@/lib/types";

type Msg = { id: string; role: string; content: ChatContent; createdAt: string; runId?: string | null };
type ApprovalRow = {
  id: string; action: string; toolId: string; connectorId: string | null;
  params: Record<string, unknown>; reason: string | null; effect: string | null;
  riskLevel: string | null; status: string; createdAt: string;
};

const connectorName = (toolId?: string | null) => {
  const p = (toolId ?? "").split(".")[0];
  const names: Record<string, string> = { gmail: "Gmail", calendar: "Google Calendar", drive: "Google Drive", classroom: "Google Classroom", jobs: "Jobs", weather: "Weather", youtube: "YouTube", filesystem: "Desktop Agent", payment: "Payments (Sandbox)" };
  return names[p] ?? (p ? p.charAt(0).toUpperCase() + p.slice(1) : "Internal");
};

function ApprovalCard({ a, onDecide, busy }: { a: ApprovalRow; onDecide: (id: string, d: "approved" | "denied", params?: Record<string, any>) => void; busy: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(() => JSON.stringify(a.params ?? {}, null, 2));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const critical = a.riskLevel === "critical";

  const doApprove = () => {
    let params = a.params;
    if (editOpen) {
      try { params = JSON.parse(editText); } catch { return; }
    }
    if (critical) { setConfirmOpen(true); return; }
    onDecide(a.id, "approved", params);
  };

  const params = Object.entries(a.params ?? {});

  return (
    <div className={`fade-up overflow-hidden rounded-xl border ${a.status === "approved" ? "border-ok/30" : a.status === "denied" ? "border-danger/30" : "border-warn/30"} bg-surface`}>
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
        <Icon name="approvals" size={14} className={a.status === "pending" ? "text-warn" : a.status === "approved" ? "text-ok" : "text-danger"} />
        <span className="text-[13px] font-semibold text-ink">{a.action}</span>
        <RiskBadge risk={a.riskLevel} />
        <span className="ml-auto text-[11px] text-faint">{connectorName(a.toolId)} · <span className="font-mono">{a.toolId}</span></span>
      </div>
      <div className="space-y-2.5 px-3.5 py-3 text-[12.5px]">
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">Why</div>
          <div className="text-muted">{a.reason}</div>
        </div>
        {params.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">Parameters</div>
            {editOpen ? (
              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={4} className="w-full rounded-lg border border-line bg-bg p-2 font-mono text-[11px] text-ink" />
            ) : (
              <div className="overflow-hidden rounded-lg border border-line bg-bg">
                {params.map(([k, v]) => (
                  <div key={k} className="flex gap-2 border-b border-line/60 px-2.5 py-1.5 font-mono text-[11px] last:border-0">
                    <span className="w-28 shrink-0 text-faint">{k}</span>
                    <span className="break-all text-ink">{String(v).slice(0, 90)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {a.effect && (
          <div>
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">Potential effect</div>
            <div className="text-muted">{a.effect}</div>
          </div>
        )}
        {critical && a.status === "pending" && (
          <div className="flex items-center gap-1.5 rounded-lg border border-danger/25 bg-danger/10 px-2.5 py-1.5 text-[11px] text-danger">
            <Icon name="security" size={12} /> CRITICAL action — final confirmation required before execution.
          </div>
        )}

        {a.status === "pending" ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Btn variant={critical ? "danger" : "primary"} size="sm" disabled={busy} onClick={doApprove}>
              <Icon name="check" size={12} /> {critical ? "Approve & Continue" : "Approve"}
            </Btn>
            <Btn size="sm" disabled={busy} onClick={() => setEditOpen((v) => !v)}>Edit</Btn>
            <Btn variant="danger" size="sm" disabled={busy} onClick={() => onDecide(a.id, "denied")}>Deny</Btn>
          </div>
        ) : (
          <div className={`flex items-start gap-2 rounded-lg px-2.5 py-2 text-[12px] ${a.status === "approved" ? "bg-ok/10 text-ok" : "bg-danger/10 text-danger"}`}>
            <Icon name={a.status === "approved" ? "check" : "x"} size={13} className="mt-px shrink-0" />
            {a.status === "approved" ? "Approved & executed — verified against the connector (demo sync)." : "Denied — no action was taken."}
          </div>
        )}
      </div>

      {confirmOpen && (
        <div className="border-t border-danger/25 bg-danger/5 px-3.5 py-3">
          <div className="mb-2 text-[12px] font-semibold text-danger">Final confirmation</div>
          <label className="mb-3 flex cursor-pointer items-center gap-2 text-[12px] text-muted">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="accent-[#ff5c7a]" />
            I understand this action has real-world side effects and authorize Orbit to execute it.
          </label>
          <div className="flex gap-2">
            <Btn variant="danger" size="sm" disabled={!ack || busy} onClick={() => { setConfirmOpen(false); onDecide(a.id, "approved", editOpen ? JSON.parse(editText) : a.params); }}>
              <Icon name="check" size={12} /> Confirm & execute
            </Btn>
            <Btn size="sm" onClick={() => { setConfirmOpen(false); setAck(false); }}>Back</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function BlockView({ b, approvals, onDecide, busy, onSend }: { b: Block; approvals: Record<string, ApprovalRow>; onDecide: (id: string, d: "approved" | "denied", params?: Record<string, any>) => void; busy: boolean; onSend: (s: string) => void }) {
  switch (b.type) {
    case "chips":
      return (
        <div className="flex flex-wrap gap-1.5">
          {b.chips.map((c) => (
            <button key={c.label} onClick={() => onSend(c.send)} disabled={busy} className="rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-[12px] text-accent transition hover:brightness-110 disabled:opacity-40">
              {c.label}
            </button>
          ))}
        </div>
      );
    case "goal": {
      const g = b.goal;
      const pct = Math.round((g.current / (g.target || 1)) * 100);
      return (
        <div className="fade-up rounded-xl border border-line bg-surface p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><Icon name="goals" size={14} className="text-accent" /><span className="text-[13px] font-semibold text-ink">{g.title}</span></div>
            <Link href="/goals" className="text-[11px] text-accent hover:underline">Open goal →</Link>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-display text-[26px] font-semibold text-ink">{g.current}<span className="text-[15px] text-faint"> / {g.target}</span></span>
            <span className="text-[12px] text-muted">{g.unit}</span>
            <span className="ml-auto text-[12px] text-muted">{pct}% · due {g.deadline}</span>
          </div>
          <div className="mt-1.5"><Progress value={pct} /></div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {g.milestones.map((m) => (
              <span key={m.title} className={`rounded-md border px-2 py-0.5 text-[11px] ${m.status === "done" ? "border-ok/25 bg-ok/10 text-ok" : m.status === "in_progress" ? "border-accent/25 bg-accent-soft text-accent" : "border-line bg-white/[0.03] text-muted"}`}>{m.title}</span>
            ))}
          </div>
          {g.nextAction && <div className="mt-2.5 text-[12px] text-muted"><span className="text-faint">Next action:</span> {g.nextAction}</div>}
        </div>
      );
    }
    case "tasks":
      return (
        <div className="fade-up overflow-hidden rounded-xl border border-line bg-surface">
          {b.items.map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 border-b border-line/60 px-3 py-2 text-[12.5px] last:border-0">
              <StatusDot tone={t.status === "completed" ? "ok" : t.status === "waiting" ? "warn" : "info"} />
              <span className={t.status === "completed" ? "text-faint line-through" : "text-ink"}>{t.title}</span>
              {typeof t.points === "number" && <Badge tone="accent">+{t.points} pts</Badge>}
              <span className="ml-auto text-[11px] text-faint">{t.deadline}</span>
            </div>
          ))}
        </div>
      );
    case "approval": {
      const a = approvals[b.approvalId];
      if (!a) return null;
      return <ApprovalCard a={a} onDecide={onDecide} busy={busy} />;
    }
    case "briefing":
      return (
        <div className="fade-up grid gap-2 sm:grid-cols-2">
          {b.sections.map((s) => (
            <div key={s.title} className="rounded-xl border border-line bg-surface px-3 py-2.5">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">{s.title}</div>
              <div className="space-y-1">
                {s.lines.map((l, i) => (
                  <div key={i} className={`text-[12px] ${l.tone === "warn" ? "text-warn" : l.tone === "danger" ? "text-danger" : l.tone === "ok" ? "text-ok" : l.tone === "info" ? "text-info" : "text-muted"}`}>{l.text}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    case "opps":
      return (
        <div className="fade-up overflow-hidden rounded-xl border border-line bg-surface">
          {b.items.map((o, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line/60 px-3 py-2.5 last:border-0">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-ink">{o.title}</div>
                <div className="mt-0.5 text-[11px] text-faint">{[o.date, o.location, o.deadline && `⏳ ${o.deadline}`, o.source].filter(Boolean).join(" · ")}</div>
              </div>
              {typeof o.points === "number" && <Badge tone="accent" className="ml-auto shrink-0">+{o.points} pts</Badge>}
            </div>
          ))}
        </div>
      );
    case "jobs":
      return (
        <div className="fade-up overflow-hidden rounded-xl border border-line bg-surface">
          {b.items.map((j, i) => (
            <div key={i} className="border-b border-line/60 px-3 py-2.5 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-ink">{j.role}</span>
                <span className="text-[12px] text-muted">· {j.company}</span>
                {j.match && <span className="ml-auto font-mono text-[11px] text-ok">{j.match.split("—")[0].trim()}</span>}
              </div>
              <div className="mt-1 text-[11.5px] text-faint">{[j.location, j.requirements, j.match && j.match.includes("—") ? j.match.split("—").slice(1).join("—") : null, j.source].filter(Boolean).join(" · ")}</div>
            </div>
          ))}
        </div>
      );
    case "emails":
      return (
        <div className="fade-up overflow-hidden rounded-xl border border-line bg-surface">
          {b.items.map((e, i) => (
            <div key={i} className="flex items-center gap-2.5 border-b border-line/60 px-3 py-2 last:border-0">
              <Icon name="mail" size={13} className="shrink-0 text-faint" />
              <div className="min-w-0">
                <div className="truncate text-[12.5px] text-ink">{e.subject}</div>
                <div className="text-[11px] text-faint">{e.from}{e.deadline ? ` · due ${e.deadline}` : ""}</div>
              </div>
              <Badge tone={e.cls === "critical" ? "danger" : e.cls === "important" ? "info" : "muted"} className="ml-auto shrink-0">{e.cls}</Badge>
            </div>
          ))}
        </div>
      );
    case "scan":
      return (
        <div className="fade-up rounded-xl border border-line bg-surface p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] text-muted">Potential cleanup</span>
            <span className="font-display text-[18px] font-semibold text-warn">{b.total}</span>
          </div>
          {b.items.map((it) => (
            <div key={it.label} className="flex items-center justify-between border-b border-line/50 py-1.5 text-[12px] last:border-0">
              <span className="text-muted">{it.label}</span><span className="font-mono text-ink">{it.size}</span>
            </div>
          ))}
        </div>
      );
    case "files":
      return (
        <div className="fade-up overflow-hidden rounded-xl border border-line bg-surface">
          {b.items.map((f, i) => (
            <div key={i} className="flex items-center gap-2.5 border-b border-line/60 px-3 py-2 last:border-0">
              <Icon name="file" size={13} className="text-faint" />
              <div className="min-w-0">
                <div className="truncate text-[12.5px] text-ink">{f.name}</div>
                <div className="text-[11px] text-faint">{f.folder} · modified {f.modified}</div>
              </div>
              <Badge tone="ok" className="ml-auto shrink-0">{f.score} match</Badge>
            </div>
          ))}
        </div>
      );
    case "expense": {
      const max = Math.max(1, ...b.byCategory.map((c) => c.amount));
      return (
        <div className="fade-up rounded-xl border border-line bg-surface p-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-muted">{b.month}</span>
            <span className="font-display text-[22px] font-semibold text-ink">{fmtInr(b.total)}</span>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {b.byCategory.map((c) => (
              <div key={c.cat} className="flex items-center gap-2 text-[12px]">
                <span className="w-28 shrink-0 text-muted">{c.cat}</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-accent/70" style={{ width: `${(c.amount / max) * 100}%` }} />
                </div>
                <span className="w-16 text-right font-mono text-ink">{fmtInr(c.amount)}</span>
              </div>
            ))}
          </div>
          {b.insights.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-line pt-2.5">
              {b.insights.map((t, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11.5px] text-muted"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-info" />{t}</div>
              ))}
            </div>
          )}
        </div>
      );
    }
    case "result":
      return (
        <div className="fade-up rounded-xl border border-line bg-surface p-3.5">
          <div className="mb-1.5 text-[12px] font-semibold text-ink">{b.title}</div>
          <div className="space-y-1">{b.lines.map((l, i) => <div key={i} className="text-[12px] text-muted">{l}</div>)}</div>
        </div>
      );
    case "events":
      return (
        <div className="fade-up overflow-hidden rounded-xl border border-line bg-surface">
          {b.items.map((e, i) => (
            <div key={i} className="flex items-center gap-2.5 border-b border-line/60 px-3 py-2 last:border-0 text-[12.5px]">
              <StatusDot tone={e.status === "cancelled" ? "danger" : "ok"} />
              <span className="text-ink">{e.title}</span>
              <span className="ml-auto text-[11px] text-faint">{e.when} · {e.time}</span>
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

export default function Chat({ initialMessages }: { initialMessages: Msg[] }) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [approvals, setApprovals] = useState<Record<string, ApprovalRow>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const loadApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/approvals");
      const data = await res.json();
      const map: Record<string, ApprovalRow> = {};
      for (const a of data.approvals ?? []) map[a.id] = a;
      setApprovals(map);
    } catch { /* offline-safe */ }
  }, []);

  useEffect(() => { void loadApprovals(); }, [loadApprovals]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const decide = useCallback(async (id: string, decision: "approved" | "denied", params?: Record<string, any>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/approvals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision, params: params ?? undefined }) });
      const out = await res.json();
      await loadApprovals();
      if (!out.ok && out.error) {
        setMessages((ms) => [...ms, { id: `sys-${Date.now()}`, role: "assistant", content: { text: out.error ?? "Action failed.", blocks: [] }, createdAt: new Date().toISOString() }]);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [loadApprovals, router]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: { text }, createdAt: new Date().toISOString() };
    setMessages((ms) => [...ms, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
      const data = await res.json();
      if (data.assistant) setMessages((ms) => [...ms, data.assistant]);
      await loadApprovals();
      router.refresh();
    } catch {
      setMessages((ms) => [...ms, { id: `e-${Date.now()}`, role: "assistant", content: { text: "The agent run failed. Nothing was changed — check the audit ledger.", blocks: [] }, createdAt: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  }, [busy, loadApprovals, router]);

  return (
    <div className="flex h-[calc(100vh-190px)] min-h-[480px] flex-col md:h-[calc(100vh-150px)]">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pb-4 pr-1">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[92%] md:max-w-[85%] ${m.role === "user" ? "" : "w-full md:w-[88%]"}`}>
              {m.role === "assistant" && (
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-md border border-accent/30 bg-accent-soft text-accent"><Icon name="orbit" size={12} /></span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Orbit</span>
                </div>
              )}
              <div className={`fade-up rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${m.role === "user" ? "bg-accent-soft text-ink" : "text-ink"}`}>
                {m.content.text}
              </div>
              {m.content.blocks?.map((b, i) => (
                <div key={i} className="mt-2">
                  <BlockView b={b} approvals={approvals} onDecide={decide} busy={busy} onSend={send} />
                </div>
              ))}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 px-1 py-1">
            <span className="grid h-5 w-5 place-items-center rounded-md border border-accent/30 bg-accent-soft text-accent"><Icon name="orbit" size={12} /></span>
            <span className="flex gap-1">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" style={{ animationDelay: "0.15s" }} />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" style={{ animationDelay: "0.3s" }} />
            </span>
            <span className="text-[11px] text-faint">planning · validating · checking policy…</span>
          </div>
        )}
      </div>

      <form
        className="mt-3 flex items-end gap-2 rounded-xl border border-line bg-surface p-2 focus-within:border-accent/40"
        onSubmit={(e) => { e.preventDefault(); void send(input); }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
          rows={1}
          placeholder={'Give it a goal — "What\'s important today?" · "Finish my Stride points"'}
          className="max-h-28 min-h-[38px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13.5px] text-ink placeholder:text-faint"
        />
        <button type="submit" disabled={busy || !input.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-white transition hover:brightness-110 disabled:opacity-30 glow-accent">
          <Icon name="send" size={15} />
        </button>
      </form>
      <div className="mt-1.5 flex items-center justify-between px-1 text-[10.5px] text-faint">
        <span>Orbit plans · the policy engine decides · every action is audited</span>
        <span className="hidden items-center gap-1.5 sm:flex"><StatusDot tone="warn" pulse /> demo mode — simulated connectors</span>
      </div>
    </div>
  );
}
