import { asc } from "drizzle-orm";
import { db } from "@/db";
import { connectors, tools } from "@/db/schema";
import ConnectorsClient from "@/components/ConnectorsClient";
import type { ConnectorView } from "@/components/ConnectorsClient";

export const dynamic = "force-dynamic";

export default async function ConnectorsPage() {
  const rows = await db.select().from(connectors).orderBy(asc(connectors.id));
  const allTools = await db.select().from(tools);
  const view: ConnectorView[] = rows.map((c) => ({
    id: c.id, name: c.name, provider: c.provider, category: c.category, description: c.description,
    status: c.status, authType: c.authType, demo: c.demo ?? true,
    scopes: c.scopes ?? [], capabilities: c.capabilities ?? [],
    freeTier: c.freeTier, rateLimit: c.rateLimit, docsUrl: c.docsUrl, notes: c.notes,
    lastSync: c.lastSync ? c.lastSync.toISOString() : null,
    connectedAt: c.connectedAt ? c.connectedAt.toISOString() : null,
    tools: allTools.filter((t) => t.connectorId === c.id).map((t) => ({ id: t.id, riskLevel: t.riskLevel, name: t.name })),
  }));
  return <ConnectorsClient connectors={view} />;
}
