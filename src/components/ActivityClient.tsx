"use client";

import { useMemo, useState } from "react";
import { Badge, Card, Icon, PageHead, RiskBadge, Empty, riskTone } from "./ui";

export type AuditView = {
  id: string; ts: string; action: string; toolId: string | null; connectorId: string | null;
  riskLevel: string | null; authorization: string | null; inputSummary: string | null;
  resultSummary: string | null; status: string | null; error: string | null; durationMs: number | null;
};

const AUTH_TONE: Record<string, string> = {
  allowed: "ok", auto: "ok", approved: "ok", ok: "ok",
  approval_required: "warn", waiting: "warn",
  denied: "danger", blocked: "danger", failed: "danger",
};

export default function ActivityClient({ events }: { events: AuditView[] }) {
  const [fRisk, setFRisk] = useState("all");
  const [fAuth, setFAuth] = useState("all");
  const [fConn, setFConn] = useState("all");
  const [fStatus, setFStatus] = useState("all");

  const conns = useMemo(() => Array.from(new Set(events.map((e) => e.connectorId).filter(Boolean))) as string[], [events]);
  const auths = useMemo(() => Array.from(new Set(events.map((e) => e.authorization).filter(Boolean))) as string[], [events]);

  const shown = events.filter((e) =>
    (fRisk === "all" || e.riskLevel === fRisk) &&
    (fAuth === "all" || e.authorization === fAuth) &&
    (fConn === "all" || e.connectorId === fConn) &&
    (fStatus === "all" || e.status === fStatus)
  );

  const sel = "h-7 rounded-lg border border-line bg-bg px-2 text-[11.5px] text-muted";

  return (
    <div>
      <PageHead
        title="Audit Ledger"
        sub="Append-only record of every decision, execution and result. No update or delete path exists from the UI — and secrets are redacted before write."
        right={<Badge tone="info">{events.length} events</Badge>}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <select value={fAuth} onChange={(e) => setFAuth(e.target.value)} className={sel}>
          <option value="all">Authorization: all</option>
          {auths.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={fRisk} onChange={(e) => setFRisk(e.target.value)} className={sel}>
          <option value="all">Risk: all</option>
          {["low", "medium", "high", "critical"].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={fConn} onChange={(e) => setFConn(e.target.value)} className={sel}>
          <option value="all">Connector: all</option>
          {conns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={sel}>
          <option value="all">Status: all</option>
          {["ok", "failed", "waiting"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {shown.length === 0 ? (
        <Empty text="No audit events match the filters." />
      ) : (
        <Card className="divide-y divide-line/60 p-0">
          {shown.map((e) => (
            <div key={e.id} className="flex items-start gap-3 px-3.5 py-2.5">
              <span className="w-[84px] shrink-0 pt-0.5 font-mono text-[10.5px] text-faint">
                {new Date(e.ts).toLocaleString("en-IN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] text-ink">{e.action}</span>
                  {e.authorization && <Badge tone={AUTH_TONE[e.authorization] ?? "muted"}>{e.authorization}</Badge>}
                  {e.riskLevel && <RiskBadge risk={e.riskLevel} />}
                  {e.status === "failed" && <Badge tone="danger">failed</Badge>}
                  {e.durationMs != null && e.durationMs > 0 && <span className="text-[10px] text-faint">{e.durationMs}ms</span>}
                </div>
                {(e.inputSummary || e.resultSummary || e.error) && (
                  <div className="mt-1 font-mono text-[10.5px] leading-relaxed text-faint">
                    {e.inputSummary && <div className="truncate"><span className="text-muted/70">in </span> {e.inputSummary.slice(0, 160)}</div>}
                    {e.error && <div className="truncate text-danger/80">err {e.error}</div>}
                    {e.resultSummary && !e.error && <div className="truncate"><span className="text-muted/70">out </span> {e.resultSummary.slice(0, 160)}</div>}
                  </div>
                )}
              </div>
              <Icon name={e.status === "failed" ? "x" : "check"} size={12} className={`mt-1 shrink-0 ${e.status === "failed" ? "text-danger" : "text-ok/60"}`} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
