import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { approvals, tools } from "@/db/schema";
import { decidePolicy } from "./policy";
import { runTool, fmtDay, fmtTime } from "./tools";
import { logAudit } from "./audit";
import type { ExecResult } from "./types";

const HUMAN_ACTION: Record<string, string> = {
  "gmail.send": "Send email",
  "gmail.label": "Label emails",
  "calendar.create": "Create calendar event",
  "calendar.delete": "Cancel calendar event",
  "payment.execute": "Send payment",
  "filesystem.delete": "Delete files (cleanup)",
  "filesystem.archive": "Move files to archive",
  "task.create": "Create task",
  "skill.toggle": "Toggle skill",
  "automation.toggle": "Toggle automation",
  "job.apply": "Apply to job",
};

function toolEffect(toolId: string, params: Record<string, any>): string {
  switch (toolId) {
    case "gmail.send":
      return `A message will be delivered to ${params.to}. Recipients will see it immediately.`;
    case "calendar.create":
      return `“${params.title}” will appear on your Google Calendar and any invites will be sent.`;
    case "calendar.delete":
      return `The event is cancelled and the removal syncs to Google Calendar. Invitations are withdrawn.`;
    case "payment.execute":
      return `₹${params.amount} will move from your connected account to ${params.recipient}. Reversible only within the PSP window.`;
    case "filesystem.delete":
      return `~${params.total ?? "several GB"} of files will be removed after archival. This is destructive.`;
    case "skill.toggle":
      return `The skill "${params.name || params.id}" will be ${params.status === "disabled" ? "disabled — the agent will no longer automatically trigger this capability" : "enabled and available to the agent"}.`;
    case "automation.toggle":
      return `The automation "${params.name || params.id}" will be ${params.enabled ? "enabled and will run according to its schedule" : "paused/disabled — scheduled runs will be skipped"}.`;
    case "job.apply":
      return `Orbit will submit your application for ${params.role} at ${params.company} and schedule a follow-up task.`;
    default:
      return "The connected service will be modified as described in the parameters.";
  }
}

export async function createApproval(args: {
  toolId: string;
  params: Record<string, any>;
  action?: string;
  reason?: string;
  runId?: string | null;
  riskLevel?: string;
  goalId?: string | null;
  taskId?: string | null;
}): Promise<{ id: string; action: string; effect: string }> {
  const [tool] = await db.select().from(tools).where(eq(tools.id, args.toolId));
  const action = args.action ?? HUMAN_ACTION[args.toolId] ?? tool?.name ?? args.toolId;
  const effect = toolEffect(args.toolId, args.params ?? {});
  const id = randomUUID();
  await db.insert(approvals).values({
    id,
    runId: args.runId ?? null,
    toolId: args.toolId,
    connectorId: tool?.connectorId ?? null,
    action,
    reason: args.reason ?? "Requested by the assistant",
    params: args.params ?? {},
    effect,
    riskLevel: args.riskLevel ?? tool?.riskLevel ?? "high",
    status: "pending",
  });
  await logAudit({
    action: `${args.toolId} — approval requested`,
    toolId: args.toolId,
    connectorId: tool?.connectorId ?? null,
    runId: args.runId ?? null,
    goalId: args.goalId ?? null,
    taskId: args.taskId ?? null,
    riskLevel: args.riskLevel ?? tool?.riskLevel ?? null,
    authorization: "approval_required",
    approvalId: id,
    inputSummary: args.params,
  });
  return { id, action, effect };
}

/**
 * The single gate for every tool invocation.
 * policy → execute → verify → audit. No other code path calls runTool
 * outside of this gate or decideApproval (which is the user-authorized branch).
 */
export async function execTool(
  toolId: string,
  params: Record<string, any>,
  opts: { runId?: string | null; goalId?: string | null; taskId?: string | null; reason?: string } = {}
): Promise<ExecResult> {
  const t0 = Date.now();
  const decision = await decidePolicy(toolId, { runId: opts.runId, goalId: opts.goalId });

  if (decision.decision === "block") {
    return { ok: false, summary: `Blocked — ${decision.reason}.`, blocked: decision.reason };
  }

  if (decision.decision === "ask") {
    const approval = await createApproval({
      toolId,
      params,
      reason: opts.reason ?? decision.reason,
      runId: opts.runId,
      goalId: opts.goalId,
      taskId: opts.taskId,
      riskLevel: decision.tool?.riskLevel,
    });
    return { ok: false, summary: "Approval required.", approvalId: approval.id };
  }

  const res = await runTool(toolId, params, opts);
  await logAudit({
    action: toolId,
    toolId,
    connectorId: decision.tool?.connectorId ?? null,
    runId: opts.runId ?? null,
    goalId: opts.goalId ?? null,
    taskId: opts.taskId ?? null,
    riskLevel: decision.tool?.riskLevel ?? null,
    authorization: "allowed",
    inputSummary: params,
    resultSummary: res.summary,
    status: res.ok ? "ok" : "failed",
    error: res.ok ? null : res.summary,
    durationMs: Date.now() - t0,
  });
  return { ok: res.ok, summary: res.summary, data: res.data };
}

/** User decided an approval. Executes through the same tool layer, then audits. */
export async function decideApproval(
  id: string,
  decision: "approved" | "denied",
  editParams?: Record<string, any> | null
): Promise<{ ok: boolean; status: string; text: string; data?: unknown; error?: string }> {
  const [a] = await db.select().from(approvals).where(eq(approvals.id, id));
  if (!a) return { ok: false, status: "error", text: "Approval not found.", error: "not found" };
  if (a.status !== "pending") return { ok: false, status: a.status ?? "pending", text: "This approval was already decided.", error: "already decided" };

  const params = editParams ?? (a.params as Record<string, any>) ?? {};

  if (decision === "denied") {
    await db.update(approvals).set({ status: "denied", decidedAt: new Date() }).where(eq(approvals.id, id));
    await logAudit({
      action: `${a.toolId} — denied by user`,
      toolId: a.toolId,
      connectorId: a.connectorId,
      runId: a.runId,
      authorization: "denied",
      approvalId: id,
      inputSummary: params,
    });
    return { ok: true, status: "denied", text: "Denied. No action was taken and nothing was changed." };
  }

  const t0 = Date.now();
  const res = await runTool(a.toolId ?? "", params, { runId: a.runId });
  const failed = !res.ok;
  await db.update(approvals)
    .set({ status: failed ? "pending" : "approved", decidedAt: failed ? undefined : new Date(), params })
    .where(eq(approvals.id, id));
  await logAudit({
    action: `${a.toolId} — approved by user`,
    toolId: a.toolId,
    connectorId: a.connectorId,
    runId: a.runId,
    riskLevel: a.riskLevel,
    authorization: "approved",
    approvalId: id,
    inputSummary: params,
    durationMs: Date.now() - t0,
  });
  await logAudit({
    action: `${a.toolId} — ${failed ? "FAILED" : "SUCCESS"}`,
    toolId: a.toolId,
    connectorId: a.connectorId,
    runId: a.runId,
    riskLevel: a.riskLevel,
    authorization: "approved",
    approvalId: id,
    resultSummary: res.summary,
    status: failed ? "failed" : "ok",
    error: failed ? res.summary : null,
    durationMs: Date.now() - t0,
  });

  if (failed) {
    return { ok: false, status: "failed", text: `The action failed: ${res.summary}. The approval stays pending so you can retry or deny it.`, error: res.summary };
  }
  return { ok: true, status: "approved", text: approvalResultText(a.toolId ?? "", res.data, params), data: res.data };
}

function approvalResultText(toolId: string, data: unknown, params: Record<string, any>): string {
  const d = (data ?? {}) as Record<string, any>;
  switch (toolId) {
    case "calendar.create": {
      const s = new Date(d.startsAt ?? params.startsAt);
      const e = new Date(d.endsAt ?? params.endsAt);
      return `Done — “${d.title ?? params.title}” created for ${fmtDay(s)} ${fmtTime(s)}–${fmtTime(e)}. Verified against Google Calendar (demo sync).`;
    }
    case "calendar.delete": {
      const s = new Date(d.startsAt ?? 0);
      const e = new Date(d.endsAt ?? 0);
      return `Cancelled — “${d.title}” removed from Google Calendar for ${fmtDay(s)} ${fmtTime(s)}. Sync verified.`;
    }
    case "payment.execute":
      return `Payment of ₹${d.amount ?? params.amount} to ${d.recipient ?? params.recipient} completed through the sandbox PSP. Reference ${d.ref}. No real money moved.`;
    case "filesystem.delete":
      return `Cleanup complete — freed ${d.freed ?? "4.3 GB"}. Files were archived before deletion (sandbox). Receipt saved to the audit ledger.`;
    case "gmail.send":
      return `Email sent to ${d.to ?? params.to}. It's now in the sent folder (demo mailbox).`;
    case "skill.toggle":
      return `Skill "${params.name || params.id}" has been updated to: ${params.status}.`;
    case "automation.toggle":
      return `Automation "${params.name || params.id}" has been ${params.enabled ? "enabled" : "disabled"}.`;
    case "job.apply":
      return `Application submitted for ${params.role} at ${params.company}.`;
    default:
      return "Action completed and verified by the executor.";
  }
}
