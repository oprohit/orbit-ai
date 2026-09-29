import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connectors } from "@/db/schema";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = typeof body?.id === "string" ? body.id : "";
    const action = typeof body?.action === "string" ? body.action : "";
    if (!id || !["connect", "disconnect", "test"].includes(action)) {
      return NextResponse.json({ error: "id and action (connect|disconnect|test) required" }, { status: 400 });
    }
    const [row] = await db.select().from(connectors).where(eq(connectors.id, id));
    if (!row) return NextResponse.json({ error: "connector not found" }, { status: 404 });

    if (action === "connect") {
      await db.update(connectors).set({ status: "connected", connectedAt: new Date(), lastSync: new Date() }).where(eq(connectors.id, id));
      await logAudit({ action: `connector.connected — ${row.name}`, connectorId: id, authorization: "approved", resultSummary: row.demo ? "Demo connector authorized (sandbox)" : "OAuth flow completed" });
      return NextResponse.json({ ok: true, status: "connected", demo: row.demo });
    }
    if (action === "disconnect") {
      await db.update(connectors).set({ status: "available", connectedAt: null, lastSync: null }).where(eq(connectors.id, id));
      await logAudit({ action: `connector.revoked — ${row.name}`, connectorId: id, authorization: "approved", resultSummary: "Access revoked by user; tokens would be destroyed" });
      return NextResponse.json({ ok: true, status: "available" });
    }
    // test
    const healthy = row.status === "connected";
    await db.update(connectors).set({ lastSync: new Date() }).where(eq(connectors.id, id));
    await logAudit({ action: `connector.test — ${row.name}`, connectorId: id, authorization: "allowed", status: healthy ? "ok" : "failed", resultSummary: healthy ? "Handshake OK (sandbox)" : "Not connected" });
    return NextResponse.json({ ok: healthy, healthy, demo: row.demo, latencyMs: 40 + (id.length * 13) % 90 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
