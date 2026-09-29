import { asc } from "drizzle-orm";
import { db } from "@/db";
import { mcpServers, mcpTools } from "@/db/schema";
import { Badge, Card, Icon, PageHead, RiskBadge, StatusDot } from "@/components/ui";

export const dynamic = "force-dynamic";

const HEALTH: Record<string, { tone: string; label: string }> = {
  healthy: { tone: "ok", label: "Healthy" },
  unstable: { tone: "warn", label: "Unstable" },
  "—": { tone: "faint", label: "Idle" },
};

export default async function McpPage() {
  const servers = await db.select().from(mcpServers).orderBy(asc(mcpServers.id));
  const allTools = await db.select().from(mcpTools);
  return (
    <div>
      <PageHead
        title="MCP Hub"
        sub="Registered Model-Context-Protocol servers. MCP tools are NOT a side channel — every tool call passes through the same central policy engine as everything else."
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {servers.map((srv) => {
          const tools = allTools.filter((t) => t.serverId === srv.id);
          const h = HEALTH[srv.health ?? "—"] ?? HEALTH["—"];
          return (
            <Card key={srv.id} className="p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white/[0.04] text-accent"><Icon name="mcp" size={16} /></span>
                <div>
                  <div className="text-[14px] font-semibold text-ink">{srv.name}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-faint">
                    <StatusDot tone={srv.status === "connected" ? "ok" : srv.status === "degraded" ? "warn" : "faint"} pulse={srv.status === "connected"} />
                    {srv.status} · {h.label}
                  </div>
                </div>
                <div className="ml-auto text-right text-[11px] text-faint">
                  <div><span className="text-muted">{tools.length}</span> tools</div>
                  {srv.lastUsed && <div>used {new Date(srv.lastUsed).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>}
                </div>
              </div>
              <p className="mt-2.5 text-[12.5px] text-muted">{srv.description}</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge tone="muted">{srv.permissionLevel}</Badge>
              </div>
              <div className="mt-3 space-y-1 border-t border-line pt-2.5">
                {tools.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-[12px]">
                    <code className="font-mono text-[11px] text-ink">{t.name}</code>
                    <span className="truncate text-[11px] text-faint">{t.description}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <RiskBadge risk={t.riskLevel} />
                      <Badge tone={t.permission === "allow" ? "ok" : t.permission === "ask" ? "warn" : "danger"}>{t.permission}</Badge>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
      <p className="mt-5 flex items-start gap-2 text-[12px] text-faint">
        <Icon name="security" size={13} className="mt-0.5 shrink-0" />
        Permission shown here is the effective permission after the policy engine resolves registry risk + user policy. A custom MCP server cannot grant itself more than its mapped tools allow — unknown tools are BLOCKED.
      </p>
    </div>
  );
}
