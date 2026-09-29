import { asc } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connectors, profiles, toolPermissions, tools } from "@/db/schema";
import SecurityClient from "@/components/SecurityClient";
import type { ToolPolicyView } from "@/components/SecurityClient";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const [toolRows, permRows, connRows, profile] = await Promise.all([
    db.select().from(tools).orderBy(asc(tools.id)),
    db.select().from(toolPermissions),
    db.select().from(connectors).where(eq(connectors.status, "connected")),
    db.select().from(profiles).where(eq(profiles.id, "u1")),
  ]);
  const perm = new Map(permRows.map((p) => [p.toolId, p.level]));
  const view: ToolPolicyView[] = toolRows.map((t) => ({
    id: t.id, name: t.name, riskLevel: t.riskLevel, enabled: !!t.enabled,
    level: perm.get(t.id) ?? null,
    defaultLevel: t.riskLevel === "low" || t.riskLevel === "medium" ? "allow" : "ask",
    description: t.description,
  }));
  return (
    <SecurityClient
      tools={view}
      connectedCount={connRows.length}
      connectedNames={connRows.map((c) => c.name)}
      requireAll={!!profile?.[0]?.flags?.requireApprovalForAll}
    />
  );
}
