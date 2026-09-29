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
    const rawMessage = typeof body?.message === "string" ? body.message.trim() : "";
    const attachment = body?.attachment;
    const clientScan = body?.clientScan;
    const message = rawMessage || (attachment ? `Attached file: ${attachment.name}` : "");
    if (!message && !attachment) return NextResponse.json({ error: "message or attachment is required" }, { status: 400 });

    const userMsg = toStoredMessage(randomUUID(), "user", { text: message.slice(0, 2000), attachment }, null);
    await db.insert(chatMessages).values({ id: userMsg.id, role: "user", content: { text: userMsg.content.text, attachment: userMsg.content.attachment } as any });

    const assistant = await runTurn(message, attachment, clientScan);
    return NextResponse.json({ user: userMsg, assistant });
  } catch (e) {
    console.error("chat error", e);
    return NextResponse.json({ error: "Agent run failed", detail: (e as Error).message }, { status: 500 });
  }
}
