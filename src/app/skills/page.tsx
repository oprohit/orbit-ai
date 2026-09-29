import { asc } from "drizzle-orm";
import { db } from "@/db";
import { skills } from "@/db/schema";
import { Badge, Card, Icon, PageHead } from "@/components/ui";
import Toggle from "@/components/Toggle";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const rows = await db.select().from(skills).orderBy(asc(skills.id));
  const enabled = rows.filter((r) => r.status === "enabled").length;
  return (
    <div>
      <PageHead
        title="Skills"
        sub={`Reusable higher-level capabilities composed from registered tools — ${enabled}/${rows.length} enabled. A skill can call multiple tools, but every tool call still passes the policy engine.`}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((sk) => (
          <Card key={sk.id} className="p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-accent-soft text-accent"><Icon name="skills" size={16} /></span>
              <div>
                <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                  {sk.name}
                  {sk.recommended && <Badge tone="accent">recommended</Badge>}
                </div>
                <div className="text-[11px] text-faint">{sk.status === "enabled" ? "enabled" : "disabled"}{sk.lastRun ? ` · last run ${new Date(sk.lastRun).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}</div>
              </div>
              <div className="ml-auto"><Toggle action="skill" id={sk.id} enabled={sk.status === "enabled"} label={`toggle ${sk.name}`} /></div>
            </div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">{sk.description}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {(sk.tools ?? []).map((t) => <code key={t} className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10.5px] text-info">{t}</code>)}
            </div>
            <div className="mt-2 text-[11px] text-faint">Triggers: {(sk.triggers ?? []).map((t) => t.replace(/“|”/g, "“")).join(" · ")}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
