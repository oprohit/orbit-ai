"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Btn, Card, Icon, PageHead, RiskBadge, StatusDot, riskTone, DemoTag } from "./ui";

export type ConnectorView = {
  id: string; name: string; provider: string | null; category: string | null; description: string | null;
  status: string; authType: string | null; demo: boolean | null;
  scopes: string[]; capabilities: string[]; freeTier: string | null; rateLimit: string | null;
  docsUrl: string | null; notes: string | null; lastSync: string | null; connectedAt: string | null;
  tools: { id: string; riskLevel: string; name: string }[];
};

const STATUS_META: Record<string, { tone: string; label: string }> = {
  connected: { tone: "ok", label: "Connected" },
  available: { tone: "info", label: "Available" },
  needs_attention: { tone: "warn", label: "Needs attention" },
  unavailable: { tone: "danger", label: "Unavailable" },
};

export default function ConnectorsClient({ connectors }: { connectors: ConnectorView[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { healthy: boolean; latencyMs: number }>>({});
  const router = useRouter();

  const act = async (id: string, action: "connect" | "disconnect" | "test") => {
    setBusy(`${id}-${action}`);
    try {
      const res = await fetch("/api/connectors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
      const out = await res.json();
      if (action === "test") setTestResults((r) => ({ ...r, [id]: { healthy: !!out.healthy, latencyMs: out.latencyMs ?? 0 } }));
      router.refresh();
    } finally { setBusy(null); }
  };

  const sections = [
    { label: "Connected", rows: connectors.filter((c) => c.status === "connected") },
    { label: "Needs attention", rows: connectors.filter((c) => c.status === "needs_attention" || c.status === "unavailable") },
    { label: "Available", rows: connectors.filter((c) => c.status === "available") },
  ];

  return (
    <div>
      <PageHead title="Connectors" sub="Explicitly authorized integrations. Minimum scopes, revocable access, no passwords ever." right={<DemoTag />} />
      <div className="space-y-6">
        {sections.map((s) => s.rows.length > 0 && (
          <div key={s.label}>
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{s.label} · {s.rows.length}</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {s.rows.map((c) => {
                const meta = STATUS_META[c.status] ?? STATUS_META.available;
                const isOpen = open === c.id;
                const tr = testResults[c.id];
                return (
                  <Card key={c.id} className={`flex flex-col p-4 transition ${isOpen ? "glow-soft" : ""}`}>
                    <button className="text-left" onClick={() => setOpen(isOpen ? null : c.id)}>
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white/[0.04] font-display text-[14px] font-semibold text-accent">
                          {c.name.replace(" (Desktop Agent)", "").slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                            {c.name}
                            <StatusDot tone={meta.tone} pulse={c.status === "connected"} />
                          </div>
                          <div className="text-[11px] text-faint">{c.provider} · {c.category}</div>
                        </div>
                        <Icon name="chevron" size={13} className={`ml-auto shrink-0 text-faint transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      </div>
                      <p className="mt-2.5 line-clamp-2 text-[12px] leading-relaxed text-muted">{c.description}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        {c.demo && <Badge tone="warn">demo</Badge>}
                        <Badge tone="muted">{c.authType ?? "—"}</Badge>
                        {c.lastSync && <span className="ml-auto text-[10.5px] text-faint">synced {new Date(c.lastSync).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="mt-3 space-y-3 border-t border-line pt-3">
                        <div>
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">Capabilities</div>
                          <div className="flex flex-wrap gap-1">
                            {c.capabilities.length ? c.capabilities.map((cap) => <span key={cap} className="rounded-md border border-line bg-white/[0.03] px-1.5 py-0.5 text-[11px] text-muted">{cap}</span>) : <span className="text-[11px] text-faint">Capability unavailable for this account/API.</span>}
                          </div>
                        </div>
                        {c.scopes.length > 0 && (
                          <div>
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">OAuth scopes (minimum required)</div>
                            <div className="flex flex-wrap gap-1">
                              {c.scopes.map((sc) => <code key={sc} className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10.5px] text-info">{sc}</code>)}
                            </div>
                          </div>
                        )}
                        {c.tools.length > 0 && (
                          <div>
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">Registered tools & risk</div>
                            <div className="space-y-1">
                              {c.tools.map((t) => (
                                <div key={t.id} className="flex items-center justify-between text-[11.5px]">
                                  <span className="font-mono text-muted">{t.id}</span>
                                  <RiskBadge risk={t.riskLevel} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {c.notes && <div className="rounded-lg border border-line bg-bg px-2.5 py-2 text-[11.5px] text-faint">{c.notes}</div>}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {c.status === "connected" ? (
                            <Btn size="sm" variant="danger" disabled={busy === `${c.id}-disconnect`} onClick={() => void act(c.id, "disconnect")}>Revoke access</Btn>
                          ) : c.status === "available" ? (
                            <Btn size="sm" variant="primary" disabled={busy === `${c.id}-connect`} onClick={() => void act(c.id, "connect")}>Connect (demo OAuth)</Btn>
                          ) : (
                            <Badge tone="warn">action not available</Badge>
                          )}
                          <Btn size="sm" disabled={busy === `${c.id}-test`} onClick={() => void act(c.id, "test")}>Test connection</Btn>
                          {tr && (
                            <span className={`flex items-center gap-1.5 text-[11px] ${tr.healthy ? "text-ok" : "text-danger"}`}>
                              <StatusDot tone={tr.healthy ? "ok" : "danger"} /> {tr.healthy ? `healthy · ${tr.latencyMs}ms` : "not connected"}
                            </span>
                          )}
                          {c.docsUrl && (
                            <a href={c.docsUrl} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-[11px] text-faint hover:text-accent">
                              docs <Icon name="external" size={11} />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 flex items-start gap-2 text-[12px] text-faint">
        <Icon name="security" size={13} className="mt-0.5 shrink-0" />
        Official OAuth 2.0 with minimum scopes in production. This sandbox runs simulated connectors (clearly badged) — Orbit never fakes a live integration, and unavailable platforms (e.g. consumer WhatsApp) stay visibly unavailable.
      </p>
    </div>
  );
}
