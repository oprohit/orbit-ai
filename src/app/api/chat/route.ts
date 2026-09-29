import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { chatMessages } from "@/db/schema";
import { runTurn, toStoredMessage } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(chatMessages).orderBy(asc(chatMessages.createdAt)).limit(80);
  return NextResponse.json({
    messages: rows.map((r) => ({ id: r.id, role: r.role, content: r.content, createdAt: r.createdAt, runId: r.runId })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 });

    const userMsg = toStoredMessage(randomUUID(), "user", { text: message.slice(0, 2000) }, null);
    await db.insert(chatMessages).values({ id: userMsg.id, role: "user", content: { text: userMsg.content.text } });

    const assistant = await runTurn(message);
    return NextResponse.json({ user: userMsg, assistant });
  } catch (e) {
    console.error("chat error", e);
    return NextResponse.json({ error: "Agent run failed", detail: (e as Error).message }, { status: 500 });
  }
}
