import { randomUUID } from "crypto";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";

/** Redact anything that looks like a credential before it is persisted. */
export function redact(value: unknown): string {
  try {
    let s = typeof value === "string" ? value : JSON.stringify(value);
    if (!s) return "";
    s = s.replace(/sk-or-[A-Za-z0-9-]{8,}/g, "[REDACTED]");
    s = s.replace(
      /("(?:api[_-]?key|token|secret|password|authorization|client_secret)"\s*:\s*)"(?:[^"\\]|\\.)*"/gi,
      "$1\"[REDACTED]\""
    );
    s = s.replace(/(key|token|secret|password|authorization)\s*[:=]\s*["']?[\w.-]{4,}["']?/gi, "$1=[REDACTED]");
    return s.length > 480 ? s.slice(0, 480) + "…" : s;
  } catch {
    return String(value).slice(0, 200);
  }
}

export type AuditInput = {
  action: string;
  runId?: string | null;
  goalId?: string | null;
  taskId?: string | null;
  connectorId?: string | null;
  toolId?: string | null;
  riskLevel?: string | null;
  authorization?: string | null;
  approvalId?: string | null;
  inputSummary?: unknown;
  resultSummary?: unknown;
  status?: "ok" | "failed" | "waiting";
  error?: string | null;
  durationMs?: number;
};

/** Append-only. There is intentionally no update or delete API for audit events. */
export async function logAudit(e: AuditInput): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      id: randomUUID(),
      action: e.action,
      runId: e.runId ?? null,
      goalId: e.goalId ?? null,
      taskId: e.taskId ?? null,
      connectorId: e.connectorId ?? null,
      toolId: e.toolId ?? null,
      riskLevel: e.riskLevel ?? null,
      authorization: e.authorization ?? null,
      approvalId: e.approvalId ?? null,
      inputSummary: e.inputSummary !== undefined ? redact(e.inputSummary) : null,
      resultSummary: e.resultSummary !== undefined ? redact(e.resultSummary) : null,
      status: e.status ?? "ok",
      error: e.error ? redact(e.error) : null,
      durationMs: e.durationMs ?? null,
    });
  } catch (err) {
    console.error("audit insert failed", err);
  }
}
