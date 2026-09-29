"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Btn, Card, Icon, PageHead, RiskBadge } from "./ui";

export type ToolPolicyView = {
  id: string; name: string; riskLevel: string; enabled: boolean;
  level: string | null; defaultLevel: string; description: string | null;
};

const LEVELS = ["allow", "ask", "block"] as const;
const LEVEL_TONE: Record<string, string> = { allow: "ok", ask: "warn", block: "danger" };

export default function SecurityClient({
  tools, connectedCount, connectedNames, requireAll,
}: { tools: ToolPolicyView[]; connectedCount: number; connectedNames: string[]; requireAll: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [all, setAll] = useState(requireAll);
  const router = useRouter();

  const setLevel = async (toolId: string, level: string) => {
    setBusy(toolId);
    try {
      await fetch("/api/mutate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "policy", toolId, level }) });
      router.refresh();
    } finally { setBusy(null); }
  };

  const setFlag = async (value: boolean) => {
    setAll(value);
    await fetch("/api/mutate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "profile.flags", flags: { requireApprovalForAll: value } }) });
    router.refresh();
  };

  const reset = async () => {
    setBusy("reset");
    try {
      await fetch("/api/mutate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "policy.reset" }) });
      router.refresh();
    } finally { setBusy(null); }
  };

  const blocked = tools.filter((t) => t.level === "block");

  return (
    <div>
      <PageHead
        title="Security Center"
        sub="Policies override model suggestions. The AI can only propose; the policy engine decides; unknown tools are always blocked."
      />
      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Tool policies · {tools.length} registered tools</div>
            <Btn size="sm" disabled={busy === "reset"} onClick={() => void reset()}>Reset to risk defaults</Btn>
          </div>
          <div className="space-y-1">
            {tools.map((t) => {
              const eff = t.level ?? t.defaultLevel;
              return (
                <div key={t.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                  <code className="w-[168px] shrink-0 font-mono text-[11px] text-ink">{t.id}</code>
                  <RiskBadge risk={t.riskLevel} />
                  <span className="hidden flex-1 truncate text-[11px] text-faint md:block">{t.description}</span>
                  <div className="ml-auto flex gap-1">
                    {LEVELS.map((lv) => (
                      <button
                        key={lv}
                        disabled={busy === t.id}
                        onClick={() => void setLevel(t.id, lv)}
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition ${
                          eff === lv ? `border-transparent ${lv === "allow" ? "bg-ok/20 text-ok" : lv === "ask" ? "bg-warn/20 text-warn" : "bg-danger/20 text-danger"}` : "border-line text-faint hover:text-muted"
                        }`}
                      >
                        {lv}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Global safety</div>
            <button onClick={() => void setFlag(!all)} className="flex w-full items-center gap-3 text-left">
              <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${all ? "bg-accent" : "bg-white/10"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${all ? "left-[18px]" : "left-0.5"}`} />
              </span>
              <span>
                <span className="block text-[13px] text-ink">Require approval for all actions</span>
                <span className="block text-[11px] text-faint">Even LOW-risk reads will ask you first</span>
              </span>
            </button>
          </Card>

          <Card className="p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Blocked actions</div>
            {blocked.length ? (
              <div className="space-y-1.5">
                {blocked.map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-[12px]">
                    <code className="font-mono text-muted">{b.id}</code>
                    <Badge tone="danger">blocked</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[12px] text-faint">No tools blocked by policy. Unknown tools are always blocked.</div>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Connected accounts</div>
            <div className="space-y-1.5">
              {connectedNames.map((n) => (
                <div key={n} className="flex items-center justify-between text-[12.5px]">
                  <span className="text-ink">{n}</span>
                  <Badge tone="ok">oauth · minimum scopes</Badge>
                </div>
              ))}
              {connectedNames.length === 0 && <div className="text-[12px] text-faint">No connected accounts.</div>}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              Revoke any connector from the Connectors page. Tokens are encrypted at rest and destroyed on revoke. {connectedCount} account{connectedCount === 1 ? "" : "s"} currently authorized.
            </p>
          </Card>

          <Card className="p-4 text-[11.5px] leading-relaxed text-faint">
            <div className="mb-1 flex items-center gap-1.5 text-muted"><Icon name="security" size={12} /> Audit trail</div>
            Every policy change, approval and execution is written to the append-only audit ledger — redacted of secrets, immutable from this UI.
          </Card>
        </div>
      </div>
    </div>
  );
}
