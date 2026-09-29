import { asc } from "drizzle-orm";
import { db } from "@/db";
import { plugins } from "@/db/schema";
import { Badge, Card, Icon, PageHead, RiskBadge, StatusDot } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PluginsPage() {
  const rows = await db.select().from(plugins).orderBy(asc(plugins.id));
  return (
    <div>
      <PageHead
        title="Plugins"
        sub="Plugins extend Orbit. They bundle capabilities and tools — distinct from connectors (accounts), skills (compositions), MCP servers (tool hosts) and tools (atomic, registered actions)."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white/[0.04] text-accent"><Icon name="plugins" size={16} /></span>
              <div>
                <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">{p.name} <span className="font-mono text-[10.5px] text-faint">v{p.version}</span></div>
                <div className="flex items-center gap-1.5 text-[11px] text-faint"><StatusDot tone={p.status === "enabled" ? "ok" : "faint"} /> {p.status} · <RiskBadge risk={p.risk} /></div>
              </div>
            </div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">{p.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">Capabilities</div>
                <div className="space-y-0.5">{(p.capabilities ?? []).map((c) => <div key={c} className="text-muted">{c}</div>)}</div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">Permissions</div>
                <div className="space-y-0.5">{(p.permissions ?? []).map((c) => <div key={c} className="text-muted">{c}</div>)}</div>
              </div>
            </div>
            {(p.tools?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {(p.tools ?? []).map((t) => <code key={t} className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10.5px] text-info">{t}</code>)}
              </div>
            )}
            {(p.services?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">{(p.services ?? []).map((sv) => <Badge key={sv} tone="muted">{sv}</Badge>)}</div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
