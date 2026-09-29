import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import ActivityClient from "@/components/ActivityClient";
import type { AuditView } from "@/components/ActivityClient";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const rows = await db.select().from(auditEvents).orderBy(desc(auditEvents.ts)).limit(120);
  const view: AuditView[] = rows.map((e) => ({
    id: e.id,
    ts: (e.ts ?? new Date()).toISOString(),
    action: e.action,
    toolId: e.toolId,
    connectorId: e.connectorId,
    riskLevel: e.riskLevel,
    authorization: e.authorization,
    inputSummary: e.inputSummary,
    resultSummary: e.resultSummary,
    status: e.status,
    error: e.error,
    durationMs: e.durationMs,
  }));
  return <ActivityClient events={view} />;
}
