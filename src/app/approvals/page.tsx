import { desc } from "drizzle-orm";
import { db } from "@/db";
import { approvals } from "@/db/schema";
import ApprovalsClient from "@/components/ApprovalsClient";
import type { ApprovalView } from "@/components/ApprovalsClient";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const rows = await db.select().from(approvals).orderBy(desc(approvals.createdAt)).limit(60);
  const view: ApprovalView[] = rows.map((a) => ({
    id: a.id, action: a.action ?? a.toolId ?? "Action", toolId: a.toolId, connectorId: a.connectorId,
    reason: a.reason, effect: a.effect, params: a.params as Record<string, unknown>,
    riskLevel: a.riskLevel, status: a.status ?? "pending",
    createdAt: (a.createdAt ?? new Date()).toISOString(),
    decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
  }));
  return <ApprovalsClient approvals={view} />;
}
