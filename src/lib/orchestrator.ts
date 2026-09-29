import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, chatMessages } from "@/db/schema";
import { planTurn } from "./planner";
import { logAudit } from "./audit";
import { aiConfig } from "./ai";
import type { ChatContent } from "./types";

export type StoredMessage = {
  id: string;
  role: string;
  content: ChatContent;
  createdAt: Date;
  runId: string | null;
};

/**
 * Constrained agent loop:
 * OBSERVE → PLAN → VALIDATE → ASK/EXECUTE (per step, via policy engine) → VERIFY → LOG → CONTINUE
 * The planner may request tools only; the policy engine decides each one.
 */
export async function runTurn(userMessage: string): Promise<StoredMessage> {
  const runId = randomUUID();
  const t0 = Date.now();
  const cfg = aiConfig();

  await db.insert(agentRuns).values({
    id: runId,
    userMessage,
    intent: "observing",
    model: cfg.enabled ? cfg.model : "local-planner (deterministic)",
    status: "running",
  });
  await logAudit({
    action: "goal received",
    runId,
    authorization: "allowed",
    inputSummary: userMessage,
  });

  const content = await planTurn(userMessage, runId);
  const summary = content.text.slice(0, 200);

  await db.update(agentRuns).set({ intent: "planned", status: "completed", summary }).where(eq(agentRuns.id, runId));
  await logAudit({
    action: "plan created",
    runId,
    authorization: "allowed",
    resultSummary: summary,
    durationMs: Date.now() - t0,
  });

  const id = randomUUID();
  await db.insert(chatMessages).values({ id, role: "assistant", content: content as any, runId });
  return { id, role: "assistant", content, createdAt: new Date(), runId };
}

export function toStoredMessage(id: string, role: string, content: ChatContent, runId: string | null): StoredMessage {
  return { id, role, content, createdAt: new Date(), runId };
}
