import { NextRequest, NextResponse } from "next/server";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { approvals } from "@/db/schema";
import { decideApproval, createApproval } from "@/lib/executor";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(approvals).orderBy(desc(approvals.createdAt));
  return NextResponse.json({ approvals: rows });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Create a new approval request (e.g. "Cancel event" from the Calendar page)
    if (body?.action === "create") {
      if (typeof body.toolId !== "string") return NextResponse.json({ error: "toolId required" }, { status: 400 });
      const approval = await createApproval({
        toolId: body.toolId,
        params: body.params ?? {},
        reason: body.reason ?? "Requested from the Orbit UI",
        riskLevel: body.riskLevel,
      });
      return NextResponse.json({ ok: true, id: approval.id, action: approval.action });
    }

    if (typeof body?.id !== "string" || !["approved", "denied"].includes(body.decision)) {
      return NextResponse.json({ error: "id and decision (approved|denied) required" }, { status: 400 });
    }
    const result = await decideApproval(body.id, body.decision, body.params ?? null);
    if (result.ok && body.decision === "approved") {
      await logAudit({ action: "result verified — UI synchronized", authorization: "approved", approvalId: body.id, resultSummary: result.text });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Convenience: list newest approvals ascending for the chat's approval map. */
export async function HEAD() {
  void (await db.select().from(approvals).orderBy(asc(approvals.createdAt)).limit(1));
  return new Response(null, { status: 200 });
}
