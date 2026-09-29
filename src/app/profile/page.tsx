import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { memoryEntries, profiles } from "@/db/schema";
import { Badge, Card, DemoTag, Icon, PageHead } from "@/components/ui";
import ProfileEditor from "@/components/ProfileEditor";
import MemoryList from "@/components/MemoryList";
import type { MemoryView } from "@/components/MemoryList";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [profile, mem] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, "u1")),
    db.select().from(memoryEntries).orderBy(asc(memoryEntries.id)),
  ]);
  const p = profile[0];
  const view: MemoryView[] = mem.map((m) => ({ id: m.id, key: m.key, value: m.value, kind: m.kind ?? "preference" }));
  const aiEnabled = (process.env.OPENROUTER_API_KEY ?? "").length > 10;
  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const fallback = process.env.OPENROUTER_FALLBACK_MODEL;

  return (
    <div>
      <PageHead title="Profile" sub="Identity, controlled memory and AI routing." right={<DemoTag />} />
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <ProfileEditor
            initialProfile={{
              id: p?.id ?? "u1",
              name: p?.name ?? "Aarav",
              email: p?.email ?? null,
              timezone: p?.timezone ?? "Asia/Kolkata",
            }}
          />

          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">Personal memory (controlled)</div>
              <Badge tone="info">view · edit · delete</Badge>
            </div>
            <p className="mb-3 text-[11.5px] text-faint">Only explicit preferences, schedules and connector settings are stored. No free-form sensitive data. Every entry below is editable and deletable.</p>
            <MemoryList items={view} />
          </Card>

          <Card className="p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Data privacy</div>
            <ul className="space-y-1.5 text-[12px] text-muted">
              <li className="flex gap-2"><Icon name="check" size={13} className="mt-0.5 shrink-0 text-ok" /> OAuth tokens encrypted at rest, destroyed on revoke</li>
              <li className="flex gap-2"><Icon name="check" size={13} className="mt-0.5 shrink-0 text-ok" /> No secrets in audit logs (redaction at write time)</li>
              <li className="flex gap-2"><Icon name="check" size={13} className="mt-0.5 shrink-0 text-ok" /> Uploaded files private by default, readable only via approved scope</li>
              <li className="flex gap-2"><Icon name="check" size={13} className="mt-0.5 shrink-0 text-ok" /> Every integration revocable from Connectors</li>
            </ul>
          </Card>
        </div>

        <div className="space-y-3">
          <Card className="p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">AI routing (OpenRouter)</div>
            <div className="space-y-2 text-[12.5px]">
              <div className="flex items-center justify-between">
                <span className="text-muted">Provider</span>
                <span className="flex items-center gap-2 text-ink">
                  <span className={`h-1.5 w-1.5 rounded-full ${aiEnabled ? "bg-ok" : "bg-warn"}`} />
                  {aiEnabled ? "OpenRouter connected" : "Local deterministic planner (fallback)"}
                </span>
              </div>
              <div className="flex items-center justify-between"><span className="text-muted">Primary model</span><code className="font-mono text-[11.5px] text-info">{model}</code></div>
              <div className="flex items-center justify-between"><span className="text-muted">Fallback model</span><code className="font-mono text-[11.5px] text-info">{fallback ?? "—"}</code></div>
            </div>
            <p className="mt-3 rounded-lg border border-line bg-bg px-3 py-2 text-[11.5px] leading-relaxed text-faint">
              The model is advisory: it produces structured plans (intent, tasks, tool selection, risk hints) which are validated against schemas. Every tool request still passes the policy engine — the model cannot bypass permissions, create approvals, or execute anything directly.
            </p>
          </Card>

          <Card className="p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Deployment</div>
            <div className="space-y-1.5 text-[12px] text-muted">
              <div className="flex justify-between"><span>Web</span><span className="font-mono text-[11px] text-faint">Next.js · Netlify/Vercel</span></div>
              <div className="flex justify-between"><span>Database</span><span className="font-mono text-[11px] text-faint">PostgreSQL · RLS-ready</span></div>
              <div className="flex justify-between"><span>Android</span><span className="font-mono text-[11px] text-faint">Capacitor (same codebase)</span></div>
              <div className="flex justify-between"><span>Local companion</span><span className="font-mono text-[11px] text-faint">Orbit Desktop Agent (optional)</span></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
