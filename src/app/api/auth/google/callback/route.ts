import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { connectors, emailItems, memoryEntries } from "@/db/schema";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://orbit-ai-drab.vercel.app";
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/connectors?error=${encodeURIComponent(error || "no_code")}`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Missing Google OAuth credentials" }, { status: 500 });
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Failed to exchange token:", errText);
      return NextResponse.redirect(`${baseUrl}/connectors?error=token_exchange_failed`);
    }

    const tokens = (await tokenRes.json()) as { access_token: string; refresh_token?: string };
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;

    // Save tokens in memory entries for background email sending
    try {
      const existingToken = await db.select().from(memoryEntries).where(eq(memoryEntries.key, "google_access_token"));
      if (existingToken.length > 0) {
        await db.update(memoryEntries).set({ value: accessToken }).where(eq(memoryEntries.key, "google_access_token"));
      } else {
        await db.insert(memoryEntries).values({
          id: randomUUID(),
          key: "google_access_token",
          value: accessToken,
          kind: "connector",
        });
      }

      if (refreshToken) {
        const existingRefresh = await db.select().from(memoryEntries).where(eq(memoryEntries.key, "google_refresh_token"));
        if (existingRefresh.length > 0) {
          await db.update(memoryEntries).set({ value: refreshToken }).where(eq(memoryEntries.key, "google_refresh_token"));
        } else {
          await db.insert(memoryEntries).values({
            id: randomUUID(),
            key: "google_refresh_token",
            value: refreshToken,
            kind: "connector",
          });
        }
      }
    } catch (e) {
      console.error("Error storing token:", e);
    }

    // 2. Fetch user email
    let userEmail = "User";
    try {
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userRes.ok) {
        const u = (await userRes.json()) as { email?: string };
        if (u.email) userEmail = u.email;
      }
    } catch {}

    // 3. Fetch real recent messages from Gmail API
    try {
      const listRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (listRes.ok) {
        const listData = (await listRes.json()) as { messages?: Array<{ id: string }> };
        const msgIds = listData.messages || [];

        for (const m of msgIds) {
          try {
            const detailRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );

            if (detailRes.ok) {
              const detail = (await detailRes.json()) as any;
              const headers = detail.payload?.headers || [];
              const subject =
                headers.find((h: any) => h.name.toLowerCase() === "subject")?.value ||
                "No Subject";
              const from =
                headers.find((h: any) => h.name.toLowerCase() === "from")?.value ||
                "Unknown sender";
              const snippet = detail.snippet || "";
              const dateVal = detail.internalDate
                ? new Date(Number(detail.internalDate))
                : new Date();

              // Insert or update in emailItems
              await db
                .insert(emailItems)
                .values({
                  id: `gmail-${m.id}`,
                  subject,
                  from,
                  snippet,
                  classification: "routine",
                  read: false,
                  ts: dateVal,
                })
                .onConflictDoNothing();
            }
          } catch (e) {
            console.error("Error fetching message detail:", e);
          }
        }
      }
    } catch (e) {
      console.error("Error fetching Gmail messages:", e);
    }

    // 4. Update connector state in Supabase
    await db
      .update(connectors)
      .set({
        status: "connected",
        authType: "oauth2",
        demo: false,
        notes: `Connected to live Gmail (${userEmail}) via Google OAuth 2.0`,
        connectedAt: new Date(),
        lastSync: new Date(),
      })
      .where(eq(connectors.id, "gmail"));

    await logAudit({
      action: `connector.connected — Gmail (Live OAuth: ${userEmail})`,
      connectorId: "gmail",
      authorization: "approved",
      resultSummary: `Real Gmail inbox synced for ${userEmail}`,
    });

    return NextResponse.redirect(`${baseUrl}/connectors?connected=gmail`);
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(`${baseUrl}/connectors?error=oauth_error`);
  }
}
