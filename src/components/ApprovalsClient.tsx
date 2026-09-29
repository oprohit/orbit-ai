"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Btn, Card, Icon, PageHead, RiskBadge, StatusDot, Empty } from "./ui";

export type ApprovalView = {
  id: string; action: string; toolId: string | null; connectorId: string | null;
  reason: string | null; effect: string | null; params: Record<string, unknown>;
  riskLevel: string | null; status: string; createdAt: string; decidedAt: string | null;
};

function ApproveBtns({ a, onDone }: { a: ApprovalView; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [ack, setAck] = useState(false);
  const critical = a.riskLevel === "critical";

  const decide = async (decision: "approved" | "denied") => {
    setBusy(decision);
    try {
      await fetch("/api/approvals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id, decision }) });
      onDone();
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Btn size="sm" variant={critical ? "danger" : "primary"} disabled={!!busy} onClick={() => (critical ? setConfirming(true) : void decide("approved"))}>
          <Icon name="check" size={12} /> {critical ? "Approve & Continue" : "Approve"}
        </Btn>
        <Btn size="sm" variant="danger" disabled={!!busy} onClick={() => void decide("denied")}><Icon name="x" size={12} /> Deny</Btn>
      </div>
      {confirming && (
        <div className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2.5">
          <div className="mb-1.5 text-[12px] font-semibold text-danger">Final confirmation — this is a {a.riskLevel?.toUpperCase()} action</div>
          <label className="mb-2 flex cursor-pointer items-center gap-2 text-[12px] text-muted">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="accent-[#ff5c7a]" />
            I understand the potential effect and authorize execution (step-up verification would apply in production).
          </label>
          <div className="flex gap-2">
            <Btn size="sm" variant="danger" disabled={!ack || !!busy} onClick={() => void decide("approved")}>Confirm & execute</Btn>
            <Btn size="sm" onClick={() => { setConfirming(false); setAck(false); }}>Back</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApprovalsClient({ approvals }: { approvals: ApprovalView[] }) {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const router = useRouter();
  const pending = approvals.filter((a) => a.status === "pending");
  const history = approvals.filter((a) => a.status !== "pending");
  const shown = tab === "pending" ? pending : history;

  return (
    <div>
      <PageHead
        title="Approvals"
        sub="Orbit never acts on ASK or CRITICAL tools without you. Each request shows exactly what will happen, why, and the effect."
        right={<Badge tone={pending.length ? "warn" : "ok"}>{pending.length} pending</Badge>}
      />
      <div className="mb-4 flex gap-1.5">
        {(["pending", "history"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-[12.5px] capitalize transition ${tab === t ? "bg-accent-soft text-accent" : "text-muted hover:bg-white/5 hover:text-ink"}`}>
            {t} {t === "pending" ? `(${pending.length})` : `(${history.length})`}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Empty text={tab === "pending" ? "Nothing waiting on you. Orbit will pause and ask here before any risky action." : "No decided approvals yet."} />
      ) : (
        <div className="space-y-3">
          {shown.map((a) => (
            <Card key={a.id} className={`overflow-hidden ${a.status === "pending" ? "border-warn/25" : ""}`}>
              <div className={`h-0.5 w-full ${a.riskLevel === "critical" ? "bg-danger/70" : a.riskLevel === "high" ? "bg-warn/70" : "bg-accent/60"}`} />
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14.5px] font-semibold text-ink">{a.action}</span>
                  <RiskBadge risk={a.riskLevel} />
                  {a.status === "pending" ? <StatusDot tone="warn" pulse /> : <Badge tone={a.status === "approved" ? "ok" : "danger"}>{a.status}</Badge>}
                  <span className="ml-auto text-[11px] text-faint">
                    {new Date(a.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    {a.toolId && <> · <span className="font-mono">{a.toolId}</span></>}
                  </span>
                </div>
                {a.reason && <p className="mt-2 text-[12.5px] text-muted"><span className="text-faint">Why: </span>{a.reason}</p>}
                {a.effect && <p className="mt-1 text-[12.5px] text-muted"><span className="text-faint">Effect: </span>{a.effect}</p>}
                {Object.keys(a.params ?? {}).length > 0 && (
                  <div className="mt-2.5 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
                    {Object.entries(a.params).map(([k, v]) => (
                      <div key={k} className="bg-bg px-2.5 py-1.5 font-mono text-[11px]">
                        <span className="text-faint">{k}: </span>
                        <span className="break-all text-ink">{String(v).slice(0, 120)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {a.status === "pending" ? (
                  <div className="mt-3.5"><ApproveBtns a={a} onDone={() => router.refresh()} /></div>
                ) : (
                  <div className="mt-3 text-[11.5px] text-faint">
                    Decided {a.decidedAt ? new Date(a.decidedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : ""} · full details in the audit ledger
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
