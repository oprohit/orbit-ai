import { asc } from "drizzle-orm";
import { db } from "@/db";
import { automations } from "@/db/schema";
import { Card, Icon, PageHead, StatusDot, Badge } from "@/components/ui";
import Toggle from "@/components/Toggle";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) =>
  d ? d.toLocaleString("en-IN", { weekday: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

export default async function AutomationsPage() {
  const rows = await db.select().from(automations).orderBy(asc(automations.id));
  const enabled = rows.filter((r) => r.enabled).length;
  return (
    <div>
      <PageHead
        title="Automations"
        sub={`${enabled}/${rows.length} active. Orbit never creates recurring automations silently — every automation requires explicit opt-in and is shown here with its tools, permissions and cadence.`}
      />
      <div className="space-y-2.5">
        {rows.map((a) => (
          <Card key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className={`grid h-9 w-9 place-items-center rounded-lg border ${a.enabled ? "border-accent/30 bg-accent-soft text-accent" : "border-line bg-white/[0.03] text-faint"}`}>
              <Icon name="automations" size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                {a.name}
                <StatusDot tone={a.enabled ? "ok" : "faint"} pulse={!!a.enabled} />
              </div>
              <div className="mt-0.5 text-[11.5px] text-faint">
                {a.trigger} · {a.schedule} — {a.actions}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {(a.tools ?? []).map((t) => <code key={t} className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-info">{t}</code>)}
            </div>
            <div className="flex w-[190px] flex-col gap-0.5 text-[10.5px] text-faint">
              <span>last: {fmt(a.lastRun)}</span>
              <span>next: {fmt(a.nextRun)}</span>
            </div>
            <div className="flex items-center gap-2">
              {a.enabled && <Badge tone="ok">opted in</Badge>}
              <Toggle action="automation" id={a.id} enabled={!!a.enabled} label={`toggle ${a.name}`} />
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-5 flex items-start gap-2 text-[12px] text-faint">
        <Icon name="approvals" size={13} className="mt-0.5 shrink-0" />
        Each automation run uses the same policy engine: read-only steps auto-run, anything ASK/CRITICAL still lands in the Approval Center — automation never bypasses your consent.
      </p>
    </div>
  );
}
