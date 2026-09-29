import { desc, ne } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { jobResults } from "@/db/schema";
import { Badge, Card, Icon, PageHead, DemoTag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const rows = await db.select().from(jobResults).where(ne(jobResults.source, "Stride Board")).orderBy(desc(jobResults.createdAt));
  return (
    <div>
      <PageHead
        title="Job Search"
        sub="Official and public job sources only — results are normalized and ranked with a match explanation. No scraping, no terms-of-service violations."
        right={<DemoTag />}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((j) => {
          const pct = (j.match ?? "").match(/^(\d+)%/)?.[1];
          return (
            <Card key={j.id} className="p-4">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-ink">{j.role}</span>
                {pct && <Badge tone={Number(pct) >= 90 ? "ok" : Number(pct) >= 75 ? "accent" : "muted"} className="ml-auto">{pct}% match</Badge>}
              </div>
              <div className="mt-0.5 text-[12.5px] text-muted">{j.company} · {j.location}</div>
              {j.requirements && <div className="mt-2 text-[12px] text-faint">Requires: {j.requirements}</div>}
              {j.match && <div className="mt-2 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-[11.5px] text-muted"><span className="text-faint">Why it matches: </span>{j.match.replace(/^\d+% — ?/, "")}</div>}
              <div className="mt-3 flex items-center gap-3">
                <span className="text-[11px] text-faint">{j.source}</span>
                <Link href="/" className="ml-auto flex items-center gap-1 text-[12px] text-accent hover:underline">
                  Apply via Orbit <Icon name="orbit" size={12} />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="mt-5 text-[12px] text-faint">
        Tip: say “Help me get a React internship — make it a long-term goal” in the command center to turn these matches into a managed goal with application tasks.
      </p>
    </div>
  );
}
