import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { tools, toolPermissions, profiles } from "@/db/schema";
import { logAudit } from "./audit";
import type { PolicyLevel, Risk } from "./types";

export type ToolRow = {
  id: string;
  name: string;
  connectorId: string | null;
  description: string | null;
  riskLevel: string;
  requiresApproval: boolean | null;
  enabled: boolean | null;
};

export type PolicyDecision = {
  decision: PolicyLevel;
  tool: ToolRow | null;
  reason: string;
  requiresConfirm: boolean; // critical actions need a second confirmation step
};

const DEFAULT_LEVEL: Record<string, PolicyLevel> = {
  low: "allow",
  medium: "allow",
  high: "ask",
  critical: "ask",
};

/**
 * The policy engine. Every tool request passes through here.
 * Unknown or disabled tools are BLOCKED. Explicit user policy
 * (tool_permissions) always overrides model suggestions and defaults.
 */
export async function decidePolicy(
  toolId: string,
  ctx: { runId?: string | null; goalId?: string | null } = {}
): Promise<PolicyDecision> {
  const [tool] = await db.select().from(tools).where(eq(tools.id, toolId));

  if (!tool) {
    await logAudit({
      action: `${toolId} — blocked`,
      toolId,
      runId: ctx.runId ?? null,
      authorization: "blocked",
      status: "failed",
      error: "Unknown tool — not present in the registry",
    });
    return { decision: "block", tool: null, reason: "not in the tool registry", requiresConfirm: false };
  }

  if (tool.enabled === false) {
    await logAudit({
      action: `${toolId} — blocked`,
      toolId,
      runId: ctx.runId ?? null,
      authorization: "blocked",
      status: "failed",
      error: "Tool is disabled in the registry",
    });
    return { decision: "block", tool, reason: "tool is disabled", requiresConfirm: false };
  }

  const [perm] = await db.select().from(toolPermissions).where(eq(toolPermissions.toolId, toolId));
  let level: PolicyLevel =
    (perm?.level as PolicyLevel | undefined) ?? DEFAULT_LEVEL[tool.riskLevel] ?? "ask";

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, "u1"));
  if (profile?.flags?.requireApprovalForAll && level === "allow") {
    level = "ask";
  }

  const requiresConfirm = tool.riskLevel === ("critical" as Risk);
  const reason =
    perm?.level && perm.level !== DEFAULT_LEVEL[tool.riskLevel]
      ? `policy: ${perm.level} (explicit user rule)`
      : `default for risk=${tool.riskLevel}`;

  return { decision: level, tool, reason, requiresConfirm };
}

export async function setPolicy(toolId: string, level: PolicyLevel): Promise<void> {
  const [existing] = await db.select().from(toolPermissions).where(eq(toolPermissions.toolId, toolId));
  if (existing) {
    await db.update(toolPermissions).set({ level }).where(eq(toolPermissions.toolId, toolId));
  } else {
    await db.insert(toolPermissions).values({ id: randomUUID(), toolId, level });
  }
  await logAudit({
    action: `policy.updated — ${toolId} → ${level}`,
    toolId,
    authorization: "allowed",
    resultSummary: "User changed tool policy in Security Center",
  });
}

export async function resetPolicies(): Promise<void> {
  await db.delete(toolPermissions);
  await logAudit({ action: "policy.reset", authorization: "allowed", resultSummary: "All explicit policies reset to risk defaults" });
}

export const RISK_LABEL: Record<string, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
};
