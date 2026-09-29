"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function playChimeSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number, vol = 0.35) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(vol, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    // First sequence
    playTone(587.33, now, 0.45);        // D5
    playTone(880.00, now + 0.15, 0.55); // A5
    playTone(1174.66, now + 0.30, 0.8); // D6

    // Echo sequence
    playTone(587.33, now + 0.7, 0.45);
    playTone(880.00, now + 0.85, 0.55);
    playTone(1174.66, now + 1.0, 1.2);
  } catch (err) {
    console.warn("Could not play Web Audio chime:", err);
  }
}

function ReminderTimerCard({ payload }: { payload: { title: string; targetTime: string; durationSeconds: number; taskId?: string } }) {
  const [timeLeftMs, setTimeLeftMs] = useState<number>(() => {
    const target = new Date(payload.targetTime).getTime();
    return Math.max(0, target - Date.now());
  });
  const [dismissed, setDismissed] = useState(false);
  const audioPlayedRef = useRef(false);

  const targetDate = useMemo(() => new Date(payload.targetTime), [payload.targetTime]);
  const totalDurationMs = Math.max(1000, (payload.durationSeconds || 10) * 1000);

  // Request browser Notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, targetDate.getTime() - Date.now());
      setTimeLeftMs(remaining);

      if (remaining <= 0 && !audioPlayedRef.current) {
        audioPlayedRef.current = true;
        // 1. Play audible chime via Web Audio API
        playChimeSound();

        // 2. Trigger browser desktop notification
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(`⏰ Orbit AI Reminder: ${payload.title}`, {
              body: `Your scheduled reminder for "${payload.title}" is due now!`,
              icon: "/favicon.ico",
            });
          } catch {}
        }

        // 3. Trigger Windows companion agent sound & balloon tip
        fetch("http://127.0.0.1:38291/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `⏰ Orbit Reminder: ${payload.title}`,
            message: `Time to: ${payload.title}!`,
          }),
        }).catch(() => {});
      }
    }, 100);

    return () => clearInterval(interval);
  }, [targetDate, payload.title]);

  if (dismissed) return null;

  const isExpired = timeLeftMs <= 0;
  const remainingSeconds = Math.ceil(timeLeftMs / 1000);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedCountdown = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  const pct = Math.max(0, Math.min(100, Math.round((timeLeftMs / totalDurationMs) * 100)));

  return (
    <div
      className={`fade-up mt-3 overflow-hidden rounded-xl border transition-all duration-300 ${
        isExpired
          ? "border-amber-500/80 bg-amber-500/10 shadow-[0_0_24px_rgba(245,158,11,0.3)] animate-pulse"
          : "border-accent/40 bg-surface/90 shadow-lg"
      } p-3.5`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">{isExpired ? "🔔" : "⏱️"}</span>
          <span className="text-[13px] font-semibold text-ink">
            {isExpired ? "Reminder Due Now!" : "Active Live Reminder"}
          </span>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold ${
            isExpired
              ? "bg-amber-500/25 text-amber-300 border border-amber-500/40"
              : "bg-accent/20 text-accent border border-accent/30"
          }`}
        >
          {isExpired ? "ALARM RINGING" : `${formattedCountdown} remaining`}
        </span>
      </div>

      <div className="mt-2.5 space-y-1.5 text-[12.5px]">
        <div className="flex items-baseline justify-between text-ink font-medium">
          <span className="text-sm">🎯 {payload.title}</span>
          <span className="text-[11px] text-faint">
            {targetDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>

        {!isExpired ? (
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-accent transition-all duration-100 ease-linear rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10.5px] text-muted font-mono">
              <span>Countdown active</span>
              <span>Target: {targetDate.toLocaleTimeString("en-IN")}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/15 p-2 text-[12px] text-amber-200">
            🔔 <strong>Time's up!</strong> Audio chime and system alert notification dispatched.
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-line/50">
          <button
            type="button"
            onClick={playChimeSound}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-1 text-[11.5px] font-medium text-accent hover:brightness-110"
          >
            <span>🔊</span> Play Chime
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-[11.5px] text-muted hover:text-ink hover:bg-white/5"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function AutoMusicPlayer({ payload }: { payload: any }) {
  const launchedRef = useRef(false);
  const targetUrl = payload?.primaryUrl || payload?.musicUrl || payload?.url;

  const triggerOpen = useCallback((urlToOpen: string) => {
    if (!urlToOpen) return;
    // 1. Tell local companion agent to launch browser via Windows OS start command (bypasses browser popup blocks)
    fetch("http://127.0.0.1:38291/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlToOpen }),
    }).catch(() => {});

    // 2. Also open via window.open (handled by Electron shell.openExternal or browser)
    try {
      if (typeof window !== "undefined") {
        window.open(urlToOpen, "_blank", "noopener,noreferrer");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (launchedRef.current || !targetUrl) return;
    launchedRef.current = true;
    triggerOpen(targetUrl);
  }, [targetUrl, triggerOpen]);

  return (
    <div className="mt-3 space-y-2.5 border-t border-line/60 pt-2.5">
      <div className="flex items-center justify-between rounded-xl border border-line bg-surface/80 px-3.5 py-2.5 text-[12px]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="font-medium text-ink">{payload.song}</span>
          <span className="text-[11px] text-muted">· Direct autoplay in browser tab</span>
        </div>
        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-mono text-emerald-400">
          Auto-opening browser tab ✓
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {payload?.musicUrl && (
          <button
            type="button"
            onClick={() => triggerOpen(payload.musicUrl)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent px-3 py-1.5 text-[11.5px] font-medium text-white shadow-sm transition hover:brightness-110 glow-accent"
          >
            <Icon name="orbit" size={13} /> Play on YouTube Music ↗
          </button>
        )}
        {payload?.url && (
          <button
            type="button"
            onClick={() => triggerOpen(payload.url)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11.5px] font-medium text-muted transition hover:bg-white/5 hover:text-ink"
          >
            YouTube ↗
          </button>
        )}
        {payload?.spotifyUrl && (
          <button
            type="button"
            onClick={() => triggerOpen(payload.spotifyUrl)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11.5px] font-medium text-muted transition hover:bg-white/5 hover:text-ink"
          >
            Spotify ↗
          </button>
        )}
        <button
          type="button"
          onClick={() => triggerOpen(targetUrl)}
          className="inline-flex items-center gap-1 rounded-lg border border-line bg-white/5 px-2.5 py-1.5 text-[11px] text-muted hover:text-ink hover:bg-white/10"
        >
          Re-open Browser ↗
        </button>
      </div>
    </div>
  );
}

function BlockView({
  b,
  approvals,
  onDecide,
  busy,
  onSend,
  onAddActiveGoal,
  addedGoals,
  addingGoal,
}: {
  b: Block;
  approvals: Record<string, ApprovalRow>;
  onDecide: (id: string, d: "approved" | "denied", params?: Record<string, any>) => void;
  busy: boolean;
  onSend: (s: string) => void;
  onAddActiveGoal?: (b: Extract<Block, { type: "study_plan" }>) => void;
  addedGoals?: Record<string, boolean>;
  addingGoal?: string | null;
}) {
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
          {b.action?.type === "reminder_alert" && b.action?.payload && (
            <ReminderTimerCard payload={b.action.payload as any} />
          )}
          {b.action?.type === "mkdir" && (
            <div className="mt-3 flex items-center gap-2 border-t border-line/60 pt-2.5">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await fetch("http://127.0.0.1:38291/open", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ path: b.action?.payload?.path }),
                    });
                  } catch {
                    alert("Desktop Agent not reachable at 127.0.0.1:38291. Make sure Orbit AI Launcher or desktop-agent.js is running.");
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-1.5 text-[11.5px] font-medium text-accent transition hover:brightness-110"
              >
                <Icon name="external" size={12} /> Open in Windows Explorer
              </button>
            </div>
          )}
          {b.action?.type === "create_file" && (
            <div className="mt-3 space-y-2 border-t border-line/60 pt-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await fetch("http://127.0.0.1:38291/open", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ path: b.action?.payload?.path || b.action?.payload?.folderPath }),
                      });
                    } catch {
                      alert("Desktop Agent not reachable at 127.0.0.1:38291. You can still download the file using the button below!");
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-1.5 text-[11.5px] font-medium text-accent transition hover:brightness-110"
                >
                  <Icon name="external" size={12} /> Open in Windows Explorer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const content = b.action?.payload?.content || "";
                    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = b.action?.payload?.fileName || "best_way_to_make_coffee.txt";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11.5px] font-medium text-emerald-400 transition hover:bg-emerald-500/20"
                >
                  <Icon name="download" size={12} /> Download .txt File
                </button>
              </div>
              {b.action?.payload?.content && (
                <details className="group mt-2 rounded-lg border border-line/60 bg-surface/40 p-2.5 text-[11px] text-muted">
                  <summary className="cursor-pointer select-none font-medium text-ink transition hover:text-accent flex items-center justify-between">
                    <span>📄 View Document Content Preview</span>
                    <span className="text-[10px] text-faint group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <pre className="mt-2.5 max-h-60 overflow-y-auto whitespace-pre-wrap rounded-md bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-ink/90 border border-line/40">
                    {b.action.payload.content}
                  </pre>
                </details>
              )}
            </div>
          )}
          {b.action?.type === "mail" && (
            <div className="mt-3 flex items-center gap-2 border-t border-line/60 pt-2.5">
              <a
                href={b.action?.payload?.gmailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent px-3 py-1.5 text-[11.5px] font-medium text-white shadow-sm transition hover:brightness-110 glow-accent"
              >
                <Icon name="mail" size={13} /> {b.action?.payload?.sent ? "Open in Gmail ↗" : "Open Compose in Gmail ↗"}
              </a>
            </div>
          )}
          {b.action?.type === "music" && b.action?.payload && (
            <AutoMusicPlayer payload={b.action.payload} />
          )}
        </div>
      );
    case "study_plan":
      return (
        <div className="fade-up rounded-xl border border-line bg-surface p-4 space-y-3.5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Icon name="goals" size={13} />
                </span>
                <span className="text-[14px] font-semibold text-ink">{b.title}</span>
              </div>
              <div className="mt-0.5 text-[11.5px] text-faint">
                Target: <span className="text-ink font-medium">{b.goal}</span> · Recommended Timeline: <span className="text-accent font-medium">{b.timeline}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("orbit:open-task-breaker", { detail: { goal: b.goal } }));
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/60 bg-accent/20 px-3 py-1.5 text-[11.5px] font-semibold text-accent shadow-sm transition hover:bg-accent hover:text-black"
              >
                <span>🎯</span> Open Task Breaker Flowchart (110 Steps)
              </button>
              {(addedGoals?.[b.goal] || b.isAdded) ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ok/40 bg-ok/10 px-3 py-1.5 text-[11.5px] font-semibold text-ok shadow-sm cursor-default"
                >
                  <Icon name="check" size={12} /> Added to Active Goals
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || addingGoal === b.goal}
                  onClick={() => onAddActiveGoal?.(b)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[11.5px] font-medium text-ink shadow-sm transition hover:bg-white/5 disabled:opacity-50"
                >
                  <Icon name="goals" size={12} /> {addingGoal === b.goal ? "Adding to Goals…" : "Add as active goal in Orbit"}
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-faint">
              Structured Roadmap (Phases)
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {b.phases.map((ph, idx) => (
                <div key={idx} className="rounded-lg border border-line/70 bg-bg/50 p-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-accent">{ph.name}</span>
                    <span className="text-faint font-mono text-[10px]">{ph.duration}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-snug text-muted">{ph.focus}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-faint">
              Recommended Subtasks Checklist
            </div>
            <div className="space-y-1.5 overflow-hidden rounded-lg border border-line/70 bg-bg/40 p-2">
              {b.subtasks.map((st, i) => (
                <div key={i} className="flex items-center gap-2.5 text-[12px] py-1 border-b border-line/40 last:border-0">
                  <StatusDot tone={st.status === "done" ? "ok" : st.status === "in_progress" ? "warn" : "info"} />
                  <span className="text-ink flex-1">{st.title}</span>
                  {st.weight && <Badge tone="muted" className="text-[10px]">{st.weight}</Badge>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-faint">
                Curated Video Lectures & Study Sources
              </span>
              <span className="text-[10.5px] text-accent">Direct YouTube links ↗</span>
            </div>
            <div className="space-y-2">
              {b.resources.map((res, i) => (
                <a
                  key={i}
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start justify-between gap-3 rounded-lg border border-line/70 bg-surface/80 p-2.5 transition hover:border-accent/40 hover:bg-white/[0.04]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-ink group-hover:text-accent transition">
                        {res.title}
                      </span>
                      <Badge tone="accent">{res.channel}</Badge>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-faint leading-relaxed">{res.why}</p>
                  </div>
                  <span className="shrink-0 rounded-md border border-line px-2 py-1 text-[11px] font-medium text-muted group-hover:text-ink">
                    Watch ↗
                  </span>
                </a>
              ))}
            </div>
          </div>
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
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [addedGoals, setAddedGoals] = useState<Record<string, boolean>>({});
  const [addingGoal, setAddingGoal] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<{
    name: string;
    type: string;
    size: number;
    dataUrl?: string;
    isImage?: boolean;
    extension?: string;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: reader.result as string,
        isImage,
        extension: ext,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleAddActiveGoal = async (b: Extract<Block, { type: "study_plan" }>) => {
    if (addingGoal === b.goal || addedGoals[b.goal]) return;
    setAddingGoal(b.goal);
    try {
      const res = await fetch("/api/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "goal.create",
          title: b.goal,
          phases: b.phases,
          subtasks: b.subtasks,
          deadline: b.timeline,
        }),
      });
      if (res.ok) {
        setAddedGoals((prev) => ({ ...prev, [b.goal]: true }));
        setMessages((ms) => [
          ...ms,
          {
            id: `sys-${Date.now()}`,
            role: "assistant",
            content: {
              text: `🎯 **"${b.goal}"** has been added as an **Active Goal** in your Orbit dashboard! Decomposed into ${b.phases?.length || 3} milestone phases and ${b.subtasks?.length || 6} preparation tasks. Check the **Goals** tab to track your progress.`,
              blocks: [],
            },
            createdAt: new Date().toISOString(),
          },
        ]);
        router.refresh();
      }
    } catch (e) {
      console.error("Failed to create active goal:", e);
    } finally {
      setAddingGoal(null);
    }
  };

  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // MediaRecorder audio capture states for Electron & fallback
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingTimerRef = useRef<any>(null);

  const stopMediaRecording = useCallback(() => {
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
  }, []);

  const startMediaRecording = useCallback(async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        alert("Audio recording is not supported in this environment.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) mimeType = "audio/webm;codecs=opus";
        else if (MediaRecorder.isTypeSupported("audio/webm")) mimeType = "audio/webm";
        else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
        else if (MediaRecorder.isTypeSupported("audio/ogg")) mimeType = "audio/ogg";
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }

        if (audioChunksRef.current.length === 0) {
          setIsRecordingAudio(false);
          setListening(false);
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || mimeType });
        if (audioBlob.size < 400) {
          setIsRecordingAudio(false);
          setListening(false);
          return;
        }

        setIsTranscribing(true);
        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64Data = (reader.result as string)?.split(",")[1];
              if (!base64Data) return;

              const res = await fetch("/api/transcribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  audio: base64Data,
                  mimeType: recorder.mimeType || mimeType,
                }),
              });
              const data = await res.json();
              if (data.ok && data.transcript) {
                setInput((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript));
              }
            } catch (err) {
              console.error("Transcribe failed:", err);
            } finally {
              setIsTranscribing(false);
              setIsRecordingAudio(false);
              setListening(false);
            }
          };
          reader.readAsDataURL(audioBlob);
        } catch (e) {
          console.error("Error reading audio data:", e);
          setIsTranscribing(false);
          setIsRecordingAudio(false);
          setListening(false);
        }
      };

      recorder.start(250);
      setIsRecordingAudio(true);
      setListening(true);

      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = setTimeout(() => {
        stopMediaRecording();
      }, 30000);
    } catch (err: any) {
      console.error("Microphone error:", err);
      alert("Microphone permission or hardware error: " + (err.message || "Could not access microphone"));
      setIsRecordingAudio(false);
      setListening(false);
    }
  }, [stopMediaRecording]);

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

  // Setup Web Speech Recognition for standard browsers
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isElectron = !!(window as any).orbitDesktop?.isDesktop || navigator.userAgent.toLowerCase().includes("electron");
      if (isElectron) {
        // In Electron, enable mic support via MediaRecorder
        setSpeechSupported(true);
        return;
      }

      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        setSpeechSupported(true);
        const rec = new SpeechRec();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = "en-US";

        rec.onresult = (event: any) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setInput(transcript);
        };

        rec.onerror = (e: any) => {
          console.warn("Speech recognition error:", e);
          setListening(false);
          if (e.error === "network" || e.error === "not-allowed" || e.error === "service-not-allowed") {
            void startMediaRecording();
          }
        };

        rec.onend = () => {
          setListening(false);
        };

        recognitionRef.current = rec;
      } else {
        setSpeechSupported(true);
      }
    }
  }, [startMediaRecording]);

  const toggleListening = () => {
    const isElectron = typeof window !== "undefined" && (
      !!(window as any).orbitDesktop?.isDesktop ||
      navigator.userAgent.toLowerCase().includes("electron")
    );

    // In Electron, webkitSpeechRecognition fails on Google API authorization.
    // Always use MediaRecorder with Gemini transcription.
    if (isElectron) {
      if (isRecordingAudio || listening) {
        stopMediaRecording();
      } else {
        void startMediaRecording();
      }
      return;
    }

    if (isRecordingAudio) {
      stopMediaRecording();
      return;
    }

    if (!recognitionRef.current) {
      void startMediaRecording();
      return;
    }

    if (listening) {
      try { recognitionRef.current.stop(); } catch {}
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch (err) {
        console.warn("SpeechRecognition start failed, switching to MediaRecorder:", err);
        void startMediaRecording();
      }
    }
  };

  const speakText = (txt: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const clean = txt
        .replace(/[*_#`~]/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .slice(0, 320);
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

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
    const attachPayload = attachment;
    if ((!text && !attachPayload) || busy) return;
    if (listening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setListening(false);
    }
    const displayText = text || `Attached file: ${attachPayload?.name}`;
    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: "user",
      content: { text: displayText, attachment: attachPayload || undefined },
      createdAt: new Date().toISOString(),
    };
    setMessages((ms) => [...ms, userMsg]);
    setInput("");
    setAttachment(null);
    setBusy(true);

    // Probe local desktop agent if user asks for pc/junk scan
    let clientScan: any = null;
    if (/(?:scan|junk|cleanup|clean\s+up|clean\s+my|check\s+(?:my\s+)?laptop|check\s+(?:my\s+)?pc|temp\s+files|free\s+up\s+space)/i.test(text)) {
      try {
        const scanRes = await fetch("http://127.0.0.1:38291/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: "junk" }),
          signal: AbortSignal.timeout(1500),
        });
        if (scanRes.ok) {
          clientScan = await scanRes.json();
        }
      } catch {
        // Desktop companion offline
      }
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          attachment: attachPayload || undefined,
          clientScan,
        }),
      });
      const data = await res.json();
      if (data.assistant) {
        setMessages((ms) => [...ms, data.assistant]);

        // Client-side Desktop Agent Bridge execution
        const blocks = data.assistant.content?.blocks || [];
        for (const blk of blocks) {
          if (blk.type === "study_plan" || (blk.type === "result" && blk.action?.type === "open_task_breaker")) {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("orbit:open-task-breaker"));
            }
          }
          if (blk.type === "result" && blk.action) {
            if (blk.action.type === "mkdir") {
              fetch("http://127.0.0.1:38291/mkdir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  folderName: blk.action.payload.folderName,
                  location: blk.action.payload.location,
                  openInExplorer: true,
                }),
              }).catch(() => {});
            } else if (blk.action.type === "create_file") {
              fetch("http://127.0.0.1:38291/create_file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  folderName: blk.action.payload.folderName,
                  fileName: blk.action.payload.fileName,
                  content: blk.action.payload.content,
                  location: blk.action.payload.location,
                  openInExplorer: true,
                }),
              }).catch(() => {});
            } else if (blk.action.type === "music") {
              const prefersYtMusic = blk.action.payload?.prefersYtMusic !== false;
              const primaryUrl = blk.action.payload?.primaryUrl;
              const musicUrl = blk.action.payload?.musicUrl;
              const ytUrl = blk.action.payload?.url;
              const playUrl = primaryUrl || (prefersYtMusic ? (musicUrl || ytUrl) : (ytUrl || musicUrl));
              let openedLocally = false;
              fetch("http://127.0.0.1:38291/play", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  song: blk.action.payload?.song,
                  url: playUrl,
                  musicUrl,
                  ytUrl,
                  videoId: blk.action.payload?.videoId,
                  prefersYtMusic,
                }),
              })
                .then((r) => {
                  if (r.ok) openedLocally = true;
                  else if (playUrl && !openedLocally) window.open(playUrl, "_blank");
                })
                .catch(() => {
                  if (playUrl && !openedLocally) window.open(playUrl, "_blank");
                });
            } else if (blk.action.type === "mail") {
              // Never pop up compose draft if sent is true or direct send
              if (blk.action.payload?.openCompose && !blk.action.payload?.sent) {
                fetch("http://127.0.0.1:38291/mail", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    to: blk.action.payload.to,
                    subject: blk.action.payload.subject,
                    body: blk.action.payload.body,
                    openInBrowser: true,
                  }),
                }).catch(() => {});
              }
            }
          }
        }

        // Voice output (TTS) if enabled
        if (ttsEnabled && data.assistant.content?.text) {
          speakText(data.assistant.content.text);
        }
      }
      await loadApprovals();
      router.refresh();
    } catch {
      setMessages((ms) => [...ms, { id: `e-${Date.now()}`, role: "assistant", content: { text: "The agent run failed. Nothing was changed — check the audit ledger.", blocks: [] }, createdAt: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  }, [busy, listening, ttsEnabled, loadApprovals, router]);

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
              {m.content.attachment && (
                <div className={`mb-1.5 flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/15 px-3 py-1.5 text-[12px] ${m.role === "user" ? "ml-auto w-fit" : "w-fit"}`}>
                  <Icon name="paperclip" size={13} className="text-accent shrink-0" />
                  <span className="font-medium text-ink truncate max-w-[220px]">{m.content.attachment.name}</span>
                  <span className="text-[10px] text-faint font-mono">({Math.round(m.content.attachment.size / 1024)} KB)</span>
                </div>
              )}
              <div className={`fade-up rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${m.role === "user" ? "bg-accent-soft text-ink" : "text-ink"}`}>
                {m.content.text}
              </div>
              {m.content.blocks?.map((b, i) => (
                <div key={i} className="mt-2">
                  <BlockView
                    b={b}
                    approvals={approvals}
                    onDecide={decide}
                    busy={busy}
                    onSend={send}
                    onAddActiveGoal={handleAddActiveGoal}
                    addedGoals={addedGoals}
                    addingGoal={addingGoal}
                  />
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

      {/* Voice Listening / Recording / Transcribing Banner */}
      {(listening || isRecordingAudio || isTranscribing) && (
        <div className={`fade-up mb-2 flex items-center justify-between rounded-lg border px-3 py-1.5 text-[11.5px] ${
          isTranscribing
            ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
            : "border-danger/40 bg-danger/10 text-danger"
        }`}>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${isTranscribing ? "bg-amber-400" : "bg-danger"} opacity-75`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isTranscribing ? "bg-amber-400" : "bg-danger"}`} />
            </span>
            <span className="font-medium">
              {isTranscribing
                ? "⏳ Transcribing voice command with Gemini AI..."
                : isRecordingAudio
                ? "🎙️ Recording voice command... Speak now (Click mic or button to stop & transcribe)"
                : "🎙️ Listening to speech… speak your goal or command now"}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleListening}
            className="rounded px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted transition hover:bg-white/10 hover:text-ink"
          >
            {isRecordingAudio ? "Stop & Transcribe" : "Cancel"}
          </button>
        </div>
      )}

      {/* File Attachment Chip Preview */}
      {attachment && (
        <div className="fade-up mb-2 flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-[12px]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="grid h-6 w-6 place-items-center rounded bg-accent/20 text-accent shrink-0">
              <Icon name="paperclip" size={13} />
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium text-ink">{attachment.name}</div>
              <div className="text-[10.5px] text-faint">
                {Math.round(attachment.size / 1024)} KB · {attachment.extension?.toUpperCase() || "File"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            className="rounded p-1 text-faint hover:bg-white/10 hover:text-ink transition ml-2"
            title="Remove attachment"
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      )}

      <form
        className="mt-2 flex items-end gap-2 rounded-xl border border-line bg-surface p-2 focus-within:border-accent/40"
        onSubmit={(e) => { e.preventDefault(); void send(input); }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.doc,.docx,.txt,.csv,.png,.jpg,.jpeg,.webp"
          className="hidden"
        />

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
          rows={1}
          placeholder={isRecordingAudio ? "🎙️ Recording... Click mic to finish" : listening ? "Listening... speak now" : attachment ? `Add instructions for ${attachment.name}...` : 'Give it a goal — "What\'s important today?" · "Create a folder named Projects on desktop"'}
          className="max-h-28 min-h-[38px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13.5px] text-ink placeholder:text-faint"
        />

        {/* File Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach PDF, document, or image"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-white/[0.04] text-muted hover:border-accent/40 hover:text-accent hover:bg-accent/10 transition"
        >
          <Icon name="paperclip" size={16} />
        </button>

        {/* Voice Command Dictation Button */}
        <button
          type="button"
          onClick={toggleListening}
          title={
            isTranscribing
              ? "Transcribing voice with Gemini..."
              : isRecordingAudio
              ? "Recording active! Click to finish & transcribe"
              : listening
              ? "Stop listening"
              : "Speak voice command (Click to speak)"
          }
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition ${
            isTranscribing
              ? "border-amber-500 bg-amber-500/20 text-amber-300 animate-pulse"
              : listening || isRecordingAudio
              ? "border-danger bg-danger text-white animate-pulse shadow-md"
              : "border-line bg-white/[0.04] text-muted hover:border-accent/40 hover:text-accent hover:bg-accent/10"
          }`}
        >
          <Icon name="mic" size={16} />
        </button>

        {/* Send Button */}
        <button
          type="submit"
          disabled={busy || (!input.trim() && !attachment)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-white transition hover:brightness-110 disabled:opacity-30 glow-accent"
        >
          <Icon name="send" size={15} />
        </button>
      </form>
      <div className="mt-1.5 flex items-center justify-between px-1 text-[10.5px] text-faint">
        <div className="flex items-center gap-3">
          <span>Orbit plans · the policy engine decides · every action is audited</span>
          {/* TTS Read-out Toggle */}
          <button
            type="button"
            onClick={() => setTtsEnabled((v) => !v)}
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition ${
              ttsEnabled ? "bg-accent/15 text-accent font-medium" : "text-faint hover:text-muted"
            }`}
            title="Toggle AI voice reading responses aloud"
          >
            <Icon name={ttsEnabled ? "volume" : "volumeMute"} size={11} />
            <span>Voice read-out: {ttsEnabled ? "ON" : "OFF"}</span>
          </button>
        </div>
        <span className="hidden items-center gap-1.5 sm:flex"><StatusDot tone="warn" pulse /> demo mode — simulated connectors</span>
      </div>
    </div>
  );
}
