import { NextRequest, NextResponse } from "next/server";
import { execTool } from "@/lib/executor";

export const dynamic = "force-dynamic";

/**
 * Generic policy-checked action request from the UI.
 * The policy engine decides ALLOW / ASK / BLOCK — the UI never bypasses it.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (typeof body?.toolId !== "string") return NextResponse.json({ error: "toolId required" }, { status: 400 });
    const res = await execTool(body.toolId, body.params ?? {}, { reason: body.reason ?? "Requested from the Orbit UI" });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
