import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, mcpServers, mcpTools } from "@/db/schema";
import { execTool } from "@/lib/tools";

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const body = await req.json();
    const toolId = String(body.toolId || "");
    const serverId = body.serverId ? String(body.serverId) : null;
    const params = (body.params && typeof body.params === "object") ? body.params : {};
    const runId = randomUUID();

    if (!toolId) {
      return NextResponse.json({ ok: false, error: "Missing toolId" }, { status: 400 });
    }

    // Execute the tool
    const result = await execTool(toolId, params, {
      runId,
      reason: `Manual test execution via MCP Hub (${toolId})`,
    });

    const latencyMs = Date.now() - start;

    // Record audit trail
    await db.insert(auditEvents).values({
      id: randomUUID(),
      runId,
      action: `mcp.execute — ${toolId}`,
      toolId,
      authorization: "allowed",
      resultSummary: result.summary,
      durationMs: latencyMs,
      ts: new Date(),
    });

    // Update server lastUsed timestamp & healthy status
    if (serverId) {
      await db.update(mcpServers).set({
        lastUsed: new Date(),
        status: "connected",
        health: "healthy",
      }).where(eq(mcpServers.id, serverId));
    }

    return NextResponse.json({
      ok: result.ok,
      toolId,
      serverId,
      latencyMs,
      summary: result.summary,
      data: result.data ?? null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "Failed to execute MCP tool" },
      { status: 500 }
    );
  }
}
