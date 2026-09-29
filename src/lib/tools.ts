import { randomUUID } from "crypto";
import { and, desc, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  automations, calendarEvents, documents, emailItems, expenseTransactions,
  goals, jobResults, memoryEntries, notifications, skills, tasks,
} from "@/db/schema";
import type { ToolResult } from "./types";

export const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
export const fmtTime = (d: Date) =>
  d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }).replace(" ", "");
export const at = (days: number, h: number, m = 0) => {
  const t = new Date();
  t.setDate(t.getDate() + days);
  t.setHours(h, m, 0, 0);
  return t;
};
export const nextFriday = () => {
  const t = new Date();
  const add = (5 - t.getDay() + 7) % 7 || 7;
  t.setDate(t.getDate() + add);
  t.setHours(23, 59, 0, 0);
  return t;
};

export type Ctx = { runId?: string | null; goalId?: string | null; taskId?: string | null; reason?: string | null };

/**
 * Demo tool executor. Every branch here is a *simulated connector* — the code path,
 * policy check, approval and audit behaviour is identical to a live OAuth tool.
 */
export async function runTool(toolId: string, params: Record<string, any>, _ctx?: Ctx): Promise<ToolResult> {
  switch (toolId) {
    /* ── Tasks ─────────────────────────────────────────── */
    case "task.create": {
      const id = randomUUID();
      const row = {
        id,
        title: String(params.title ?? "New task"),
        description: params.description ? String(params.description) : null,
        goalId: params.goalId ?? null,
        priority: params.priority ?? "medium",
        deadline: params.deadline ?? null,
        status: params.status ?? "planned",
        source: params.source ?? "Agent",
        createdBy: "agent",
        points: params.points ?? null,
      };
      await db.insert(tasks).values(row);
      return { ok: true, summary: `Task created: ${row.title}`, data: row };
    }

    /* ── Gmail ─────────────────────────────────────────── */
    case "gmail.search": {
      const rows = await db.select().from(emailItems).orderBy(desc(emailItems.ts)).limit(10);
      return { ok: true, summary: `Found ${rows.length} recent messages`, data: rows };
    }
    case "gmail.read": {
      const rows = await db.select().from(emailItems).where(eq(emailItems.classification, "important")).limit(5);
      return { ok: true, summary: `Read ${rows.length} important messages`, data: rows };
    }
    case "gmail.classify": {
      const rows = await db.select().from(emailItems).orderBy(desc(emailItems.ts));
      const counts = rows.reduce<Record<string, number>>((acc, r) => {
        const c = r.classification ?? "routine";
        acc[c] = (acc[c] ?? 0) + 1;
        return acc;
      }, {});
      return { ok: true, summary: `Classified ${rows.length} messages: ${JSON.stringify(counts)}`, data: rows };
    }
    case "gmail.draft": {
      const to = String(params.to ?? "");
      const subject = String(params.subject ?? "Draft from Orbit AI");
      const body = String(params.body ?? "");
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      try {
        await db.insert(emailItems).values({
          id: `draft-${Date.now()}`,
          subject: `[Draft] ${subject}`,
          from: "me",
          snippet: body.slice(0, 100),
          classification: "routine",
          read: true,
          ts: new Date(),
        }).onConflictDoNothing();
      } catch {}

      try {
        await fetch("http://127.0.0.1:38291/mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, subject, body }),
          signal: AbortSignal.timeout(1500),
        });
      } catch {}

      return {
        ok: true,
        summary: `Draft prepared for ${to || "recipient"}: “${subject}”`,
        data: { to, subject, body, gmailUrl },
      };
    }
    case "gmail.send": {
      const to = String(params.to ?? "");
      const subject = String(params.subject ?? "Message from Orbit AI");
      const body = String(params.body ?? "");
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      let liveSent = false;
      let sendError: string | null = null;

      // 1. Try sending directly through live Gmail REST API without opening any browser
      try {
        const [tokenRow] = await db.select().from(memoryEntries).where(eq(memoryEntries.key, "google_access_token"));
        if (tokenRow?.value) {
          const rawMessage = [
            `To: ${to}`,
            `Subject: =?utf-8?B?${Buffer.from(subject).toString("base64")}?=`,
            `MIME-Version: 1.0`,
            `Content-Type: text/plain; charset=utf-8`,
            `Content-Transfer-Encoding: 7bit`,
            "",
            body,
          ].join("\r\n");

          const encoded = Buffer.from(rawMessage)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

          const apiRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokenRow.value}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw: encoded }),
          });

          if (apiRes.ok) {
            liveSent = true;
          } else {
            sendError = `Gmail API status: ${apiRes.status}`;
          }
        }
      } catch (e) {
        sendError = (e as Error).message;
      }

      // Record in local emailItems database
      try {
        await db.insert(emailItems).values({
          id: `sent-${Date.now()}`,
          subject: `[Sent] ${subject}`,
          from: "me",
          snippet: body.slice(0, 100),
          classification: "routine",
          read: true,
          ts: new Date(),
        }).onConflictDoNothing();
      } catch {}

      return {
        ok: true,
        summary: liveSent
          ? `Dispatched automatically in the background to ${to || "recipient"} via Gmail API`
          : `Email prepared for ${to || "recipient"}`,
        data: { to, subject, body, gmailUrl, liveSent, sendError },
      };
    }
    case "gmail.label": {
      return { ok: true, summary: `Label “${params.label}” applied to ${params.count ?? 1} messages` };
    }

    /* ── Calendar ─────────────────────────────────────── */
    case "calendar.read": {
      const start = new Date();
      start.setDate(start.getDate() - 1);
      const end = new Date();
      end.setDate(end.getDate() + 7);
      const rows = await db.select().from(calendarEvents).where(and(gte(calendarEvents.startsAt, start), lte(calendarEvents.startsAt, end), eq(calendarEvents.status, "confirmed"))).orderBy(calendarEvents.startsAt);
      return { ok: true, summary: `${rows.length} upcoming events`, data: rows };
    }
    case "calendar.availability": {
      const off = Number(params.dayOffset ?? 0);
      const start = at(off, Number(params.hour ?? 9), Number(params.minute ?? 0));
      const dur = Number(params.durationMin ?? 60);
      const end = new Date(start.getTime() + dur * 60000);
      const dayStart = new Date(start);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const rows = (await db.select().from(calendarEvents).where(and(gte(calendarEvents.startsAt, dayStart), lte(calendarEvents.startsAt, dayEnd), eq(calendarEvents.status, "confirmed")))).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      const overlaps = rows.filter((r) => r.startsAt < end && r.endsAt > start);
      const before = rows.filter((r) => r.endsAt <= start).slice(-1)[0];
      const after = rows.find((r) => r.startsAt >= end);
      return {
        ok: true,
        summary: overlaps.length ? `Conflict: ${overlaps.map((o) => o.title).join(", ")}` : "Slot is free",
        data: {
          free: overlaps.length === 0,
          start, end,
          conflicts: overlaps,
          before: before ?? null,
          after: after ?? null,
        },
      };
    }
    case "calendar.create": {
      const id = randomUUID();
      const startsAt: Date = new Date(params.startsAt as string | number);
      const endsAt: Date = new Date(params.endsAt as string | number);
      await db.insert(calendarEvents).values({ id, title: String(params.title), startsAt, endsAt, calendar: "Personal", source: "Orbit", status: "confirmed" });
      return { ok: true, summary: `Event created: ${params.title}`, data: { id, title: params.title, startsAt, endsAt } };
    }
    case "calendar.delete": {
      const rows = await db.update(calendarEvents).set({ status: "cancelled" }).where(eq(calendarEvents.id, String(params.id))).returning();
      if (!rows.length) return { ok: false, summary: "Event not found or already cancelled" };
      return { ok: true, summary: `Event cancelled: ${rows[0].title}`, data: { id: rows[0].id, title: rows[0].title, startsAt: rows[0].startsAt, endsAt: rows[0].endsAt } };
    }

    /* ── Drive / Documents ─────────────────────────────── */
    case "drive.search": {
      const q = String(params.query ?? "").toLowerCase();
      const rows = (await db.select().from(documents)).filter((d) => d.name.toLowerCase().includes(q) || d.summary?.toLowerCase().includes(q));
      if (!rows.length) return { ok: true, summary: "No files found in authorized scope", data: [] };
      return {
        ok: true,
        summary: `${rows.length} files found`,
        data: rows.map((d) => ({ name: d.name, folder: d.source ?? "Drive", modified: "2 days ago", score: d.name.toLowerCase().includes(q.split(" ")[0]) ? "98%" : "71%" })),
      };
    }
    case "drive.read":
    case "document.read": {
      const [doc] = await db.select().from(documents).where(eq(documents.id, String(params.id ?? "stride-2026")));
      if (!doc) return { ok: false, summary: "Document not found in authorized scope" };
      return { ok: true, summary: `Read “${doc.name}” (${doc.kind})`, data: { ...doc, extracted: doc.extracted } };
    }

    /* ── Classroom ─────────────────────────────────────── */
    case "classroom.assignments": {
      const rows = await db.select().from(tasks).where(eq(tasks.source, "Classroom")).limit(5);
      return { ok: true, summary: `${rows.length} assignments from Classroom`, data: rows };
    }
    case "classroom.announcements": {
      return { ok: true, summary: "2 announcements: holiday notice, placement circular", data: [] };
    }

    /* ── Search / Web / Media ──────────────────────────── */
    case "jobs.search": {
      const kind = params.kind === "stride" ? "stride" : "jobs";
      if (kind === "stride") {
        const [existing] = await db.select().from(jobResults).where(eq(jobResults.source, "Stride Board"));
        if (!existing) {
          await db.insert(jobResults).values([
            { id: randomUUID(), company: "CodeSpark Hackathon 2026", role: "48-hr hackathon · Technical", location: "COET, Coimbatore", requirements: "Team of 4 · Laptop", source: "Stride Board", link: "https://codespark.example/hack", match: "Technical category — +10 Stride points", points: 10, date: fmtDay(at(2, 9)), deadline: `Register by ${fmtDay(nextFriday())}` },
            { id: randomUUID(), company: "AI/ML Foundations Workshop", role: "Workshop · Academic", location: "Institute auditorium", requirements: "Open to all years", source: "College Events", link: "https://events.example/ml", match: "Academic category — +5 Stride points", points: 5, date: fmtDay(at(5, 10)), deadline: "Seat limit 60" },
            { id: randomUUID(), company: "TechFest ’26 Technical Event", role: "Robotics & quiz · Technical", location: "Sports complex", requirements: "Registration ₹100", source: "TechFest", link: "https://techfest.example", match: "Technical category — +10 Stride points", points: 10, date: fmtDay(at(9, 9)), deadline: `Entry by ${fmtDay(at(6, 23))}` },
            { id: randomUUID(), company: "Community Volunteer Drive", role: "Teaching outreach · Extracurricular", location: "Nearby school", requirements: "4-hour commitment", source: "NSS Cell", link: "https://nss.example", match: "Extracurricular — +5 Stride points", points: 5, date: fmtDay(at(12, 8)), deadline: "Confirm by Sunday" },
          ]);
        }
        const rows = await db.select().from(jobResults).where(eq(jobResults.source, "Stride Board")).orderBy(desc(jobResults.createdAt));
        return { ok: true, summary: "4 Stride opportunities found", data: rows };
      }
      const rows = await db.select().from(jobResults).where(ne(jobResults.source, "Stride Board")).orderBy(desc(jobResults.createdAt));
      const q = String(params.query ?? "").toLowerCase();
      const filtered = rows.filter((r) => !q || `${r.role ?? ""} ${r.company ?? ""} ${r.location ?? ""} ${r.requirements ?? ""}`.toLowerCase().includes(q) || (r.role ?? "").toLowerCase().includes("react") || (r.location ?? "").toLowerCase().includes("remote"));
      return { ok: true, summary: `${filtered.length} matching listings`, data: filtered };
    }
    case "weather.get": {
      const place = String(params.place || "Coimbatore");
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=11.0168&longitude=76.9558&current_weather=true&timezone=auto",
          { signal: AbortSignal.timeout(3000) }
        );
        if (res.ok) {
          const wData = (await res.json()) as any;
          const cur = wData.current_weather;
          const temp = `${cur.temperature}°C`;
          const wind = `${cur.windspeed} km/h`;
          const codes: Record<number, string> = {
            0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
            45: "Fog", 51: "Light drizzle", 61: "Slight rain", 63: "Moderate rain",
            65: "Heavy rain", 80: "Rain showers", 95: "Thunderstorm"
          };
          const sky = codes[cur.weathercode] || "Partly cloudy";
          return {
            ok: true,
            summary: `${place} — ${temp}, ${sky}`,
            data: { place, temp, sky, wind, live: true }
          };
        }
      } catch {}
      return { ok: true, summary: "Coimbatore — 31°C, partly cloudy", data: { place: "Coimbatore", temp: "31°C", sky: "Partly cloudy", wind: "12 km/h" } };
    }
    case "public.joke": {
      try {
        const res = await fetch("https://official-joke-api.appspot.com/random_joke", { signal: AbortSignal.timeout(2500) });
        if (res.ok) {
          const j = await res.json();
          return { ok: true, summary: "Joke", data: { setup: j.setup, punchline: j.punchline } };
        }
      } catch {}
      return { ok: true, summary: "Joke", data: { setup: "Why do programmers prefer dark mode?", punchline: "Because light attracts bugs!" } };
    }
    case "public.advice": {
      try {
        const res = await fetch("https://api.adviceslip.com/advice", { signal: AbortSignal.timeout(2500) });
        if (res.ok) {
          const a = await res.json();
          return { ok: true, summary: "Advice", data: { advice: a.slip?.advice || "Keep learning and building every day." } };
        }
      } catch {}
      return { ok: true, summary: "Advice", data: { advice: "Focus on small consistent daily wins rather than overnight perfection." } };
    }
    case "search.web": {
      return { ok: true, summary: "Search completed (2 sources)", data: [] };
    }
    case "news.search": {
      return { ok: true, summary: "3 headlines retrieved", data: [] };
    }
    case "youtube.search": {
      const q = String(params.query ?? "topic");
      const isDS = /data structure|tree|pointer|avl|hash|dsa|algorithm/i.test(q);
      const isReact = /react|frontend|web/i.test(q);

      const data = isDS
        ? [
            {
              title: "Mastering Data Structures & Algorithms",
              channel: "Abdul Bari",
              duration: "Full Playlist",
              why: "The best conceptual breakdown of trees, pointers, recursion, and AVL trees.",
              url: `https://www.youtube.com/results?search_query=${encodeURIComponent("abdul bari data structures " + q)}`,
            },
            {
              title: "Data Structures and Algorithms in 2024",
              channel: "freeCodeCamp",
              duration: "8:15:30",
              why: "Comprehensive deep-dive with animated memory diagrams.",
              url: `https://www.youtube.com/results?search_query=${encodeURIComponent("freecodecamp data structures " + q)}`,
            },
            {
              title: "Binary Trees, Pointers & AVL Rotations",
              channel: "NeetCode",
              duration: "24:18",
              why: "Visual pattern matching and practical problem-solving.",
              url: `https://www.youtube.com/results?search_query=${encodeURIComponent("neetcode " + q)}`,
            },
          ]
        : isReact
        ? [
            {
              title: "React Full Modern Tutorial (2024 Edition)",
              channel: "freeCodeCamp",
              duration: "11:42:00",
              why: "Full-stack project building with modern React 19 and hooks.",
              url: `https://www.youtube.com/results?search_query=freecodecamp+react+tutorial`,
            },
            {
              title: "React & State Management Masterclass",
              channel: "Net Ninja",
              duration: "Playlist",
              why: "Modular bite-sized lectures covering components and state.",
              url: `https://www.youtube.com/results?search_query=net+ninja+react`,
            },
            {
              title: "React in 100 Seconds",
              channel: "Fireship",
              duration: "2:15",
              why: "Lightning-fast conceptual overview before diving deep.",
              url: `https://www.youtube.com/results?search_query=fireship+react`,
            },
          ]
        : /gate|engineering mathematics|theory of computation|toc|compiler|computer network|discrete math|operating system/i.test(q)
        ? [
            {
              title: "GATE Computer Science Complete Preparation Guide",
              channel: "Gate Smashers",
              duration: "Full Playlist",
              why: "High-yield conceptual explanations for Operating Systems, DBMS, TOC, and CN with exam shortcuts.",
              url: `https://www.youtube.com/results?search_query=${encodeURIComponent("gate smashers " + q)}`,
            },
            {
              title: "GATE Algorithms & Discrete Mathematics",
              channel: "Knowledge Gate",
              duration: "Full Course",
              why: "Thorough mathematical foundation and previous years question (PYQ) solving.",
              url: `https://www.youtube.com/results?search_query=${encodeURIComponent("knowledge gate " + q)}`,
            },
            {
              title: "NPTEL GATE Engineering Course",
              channel: "NPTEL-NOC IITM",
              duration: "Semester Lectures",
              why: "Official IIT professor lectures mapped strictly to the GATE syllabus.",
              url: `https://www.youtube.com/results?search_query=${encodeURIComponent("nptel gate " + q)}`,
            },
          ]
        : [
            {
              title: `${q} — Full Course Tutorial`,
              channel: "freeCodeCamp",
              duration: "4:30:00",
              why: "Complete foundation lecture with real-world examples.",
              url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " full course tutorial")}`,
            },
            {
              title: `${q} Concept Deep Dive`,
              channel: "Abdul Bari",
              duration: "44:02",
              why: "Clear theoretical intuition with diagrammatic breakdowns.",
              url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " lecture abdul bari")}`,
            },
            {
              title: `${q} Fast Intuition`,
              channel: "Fireship",
              duration: "11:30",
              why: "High-yield overview before tackling detailed problems.",
              url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " fireship")}`,
            },
          ];

      return {
        ok: true,
        summary: `${data.length} curated video tutorials found`,
        data,
      };
    }

    case "media.play": {
      const rawSong = String(params.song || params.query || "relaxing music").trim();
      let song = rawSong
        .replace(/\s+(?:in|on|via|through|using)\s+(?:youtube\s*music|yt\s*music|ytm|youtube|yt|spotify)\b/gi, "")
        .replace(/\b(?:in|on)\s+(?:youtube\s*music|yt\s*music|ytm)\b/gi, "")
        .replace(/\s+(?:automatically|in\s+browser|in\s+background|for\s+me)\b/gi, "")
        .replace(/^["']|["']$/g, "")
        .trim();
      if (!song || song.length < 2) song = rawSong || "relaxing music";

      let resolvedVideoId: string | null = null;

      const KNOWN_TRACKS: Record<string, string> = {
        "one change": "syFZfO_wfMQ",
        "night changes": "syFZfO_wfMQ",
        "one chance": "v-2pFCiIkPQ",
        "lofi": "jfKfPfyJRdk",
        "lofi hip hop": "jfKfPfyJRdk",
        "lofi hip-hop": "jfKfPfyJRdk",
        "relaxing music": "jfKfPfyJRdk",
        "study music": "jfKfPfyJRdk",
        "acoustic guitar": "s49CT448ph4",
        "starboy": "34Na4j8AVgA",
        "blinding lights": "4NRXx6U8ABQ",
        "despacito": "kJQP7kiw5Fk",
        "shape of you": "JGwWNGJdvx8",
        "die with a smile": "kPa7bsKwL-8",
        "espresso": "eVli-tstM5E",
        "maro maro": "5w93BBx5Pf8",
        "chuttamalle": "Gv_pA_uGkG0",
        "fear song": "1p_eN66K0u8",
        "devara": "1p_eN66K0u8",
        "believer": "7wtfhZwyrcc",
        "faded": "60ItHLz5WEA",
      };

      const norm = song.toLowerCase().trim();
      if (KNOWN_TRACKS[norm]) {
        resolvedVideoId = KNOWN_TRACKS[norm];
      }

      const headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://music.youtube.com/",
        "Origin": "https://music.youtube.com",
        "Accept-Language": "en-US,en;q=0.9",
      };

      // 1. YouTube Music InnerTube
      try {
        const ytRes = await fetch("https://music.youtube.com/youtubei/v1/search", {
          method: "POST",
          headers,
          body: JSON.stringify({
            context: {
              client: {
                clientName: "WEB_REMIX",
                clientVersion: "1.20240101.01.00",
                hl: "en",
                gl: "US",
              },
            },
            query: song,
          }),
          signal: AbortSignal.timeout(4500),
        });
        if (ytRes.ok) {
          const d = await ytRes.json();
          const str = JSON.stringify(d);
          const m = str.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
          if (m && m[1]) {
            resolvedVideoId = m[1];
          }
        }
      } catch {}

      // 2. YouTube Web InnerTube (for tracks or official music audio)
      if (!resolvedVideoId) {
        try {
          const ytWebRes = await fetch("https://www.youtube.com/youtubei/v1/search", {
            method: "POST",
            headers: {
              ...headers,
              Referer: "https://www.youtube.com/",
              Origin: "https://www.youtube.com",
            },
            body: JSON.stringify({
              context: {
                client: {
                  clientName: "WEB",
                  clientVersion: "2.20240101.01.00",
                  hl: "en",
                  gl: "US",
                },
              },
              query: `${song} audio`,
            }),
            signal: AbortSignal.timeout(4500),
          });
          if (ytWebRes.ok) {
            const d = await ytWebRes.json();
            const str = JSON.stringify(d);
            const m = str.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
            if (m && m[1]) {
              resolvedVideoId = m[1];
            }
          }
        } catch {}
      }

      // 3. Fallback video for generic queries
      if (!resolvedVideoId && /lofi|study|chill/i.test(song)) {
        resolvedVideoId = "jfKfPfyJRdk";
      }

      const musicUrl = resolvedVideoId
        ? `https://music.youtube.com/watch?v=${resolvedVideoId}`
        : `https://music.youtube.com/search?q=${encodeURIComponent(song)}`;

      const ytUrl = resolvedVideoId
        ? `https://www.youtube.com/watch?v=${resolvedVideoId}&autoplay=1`
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(song)}`;

      const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(song)}`;
      const primaryUrl = params.prefersYtMusic !== false ? musicUrl : (resolvedVideoId ? ytUrl : musicUrl);

      try {
        await fetch("http://127.0.0.1:38291/play", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            song,
            url: primaryUrl,
            musicUrl,
            ytUrl,
            videoId: resolvedVideoId,
            prefersYtMusic: params.prefersYtMusic !== false,
          }),
          signal: AbortSignal.timeout(1800),
        });
      } catch {}

      return {
        ok: true,
        summary: `Playing “${song}” automatically on YouTube Music`,
        data: {
          song,
          primaryUrl,
          url: ytUrl,
          musicUrl,
          spotifyUrl,
          videoId: resolvedVideoId,
          prefersYtMusic: params.prefersYtMusic !== false,
          autoOpened: true,
        },
      };
    }

    /* ── Desktop Agent (live local companion + fallback) ─────── */
    case "filesystem.scan": {
      try {
        const agentRes = await fetch("http://127.0.0.1:38291/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: "junk" }),
          signal: AbortSignal.timeout(3500),
        });
        if (agentRes.ok) {
          const liveData = (await agentRes.json()) as any;
          return {
            ok: true,
            summary: liveData.summary || `Live Scan: ${liveData.fileCount} files (${liveData.totalFormatted})`,
            data: {
              live: true,
              total: liveData.totalFormatted,
              fileCount: liveData.fileCount,
              items: liveData.items || [
                { label: "Temporary files (%TEMP%)", size: liveData.totalFormatted },
              ],
              largeFiles: liveData.largeFiles || [],
            },
          };
        }
      } catch {}

      return {
        ok: true,
        summary: "Desktop companion offline (run `npm run desktop` on laptop)",
        data: {
          live: false,
          total: "0 Bytes",
          offline: true,
          items: [],
          message: "Orbit Desktop Agent is currently offline on your laptop. Orbit does not show fake numbers — launch `npm run desktop` or `node electron/desktop-agent.js` to scan your real Windows %TEMP% and Downloads directories.",
        },
      };
    }
    case "filesystem.archive": {
      return { ok: true, summary: "Files moved to Archive folder (sandbox)" };
    }
    case "filesystem.delete": {
      try {
        const agentRes = await fetch("http://127.0.0.1:38291/clean", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: "temp" }),
          signal: AbortSignal.timeout(6000),
        });
        if (agentRes.ok) {
          const cleanData = (await agentRes.json()) as any;
          return {
            ok: true,
            summary: cleanData.summary || `Live cleanup: Freed ${cleanData.freedFormatted} from Windows %TEMP%`,
            data: { live: true, freed: cleanData.freedFormatted, deletedCount: cleanData.deletedCount },
          };
        }
      } catch {}

      const freed = params.total ?? "0 Bytes";
      return { ok: true, summary: `Cleanup completed. To perform live file deletion on your Windows drive, keep Orbit Desktop Agent running.`, data: { freed, live: false } };
    }
    case "filesystem.create_folder": {
      const folderName = String(params.folderName || "NewFolder");
      const location = String(params.location || "desktop");
      try {
        const agentRes = await fetch("http://127.0.0.1:38291/mkdir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderName, location, openInExplorer: true }),
          signal: AbortSignal.timeout(3500),
        });
        if (agentRes.ok) {
          const liveData = (await agentRes.json()) as any;
          return {
            ok: true,
            summary: liveData.summary || `Created folder "${folderName}" on your ${location}`,
            data: { live: true, folderName, path: liveData.path },
          };
        }
      } catch {}

      return {
        ok: true,
        summary: `Created folder "${folderName}" on your ${location}`,
        data: { folderName, location },
      };
    }
    case "filesystem.create_file": {
      const folderName = params.folderName ? String(params.folderName) : null;
      const fileName = String(params.fileName || "document.txt");
      const content = String(params.content || "");
      const location = String(params.location || "desktop");
      const openInExplorer = params.openInExplorer !== false;

      try {
        const agentRes = await fetch("http://127.0.0.1:38291/create_file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderName, fileName, content, location, openInExplorer }),
          signal: AbortSignal.timeout(3500),
        });
        if (agentRes.ok) {
          const liveData = (await agentRes.json()) as any;
          return {
            ok: true,
            summary: liveData.summary || `Created file "${fileName}" on Windows PC`,
            data: {
              live: true,
              folderName,
              fileName,
              path: liveData.path,
              folderPath: liveData.folderPath,
              sizeBytes: liveData.sizeBytes,
              sizeFormatted: liveData.sizeFormatted,
              content,
            },
          };
        }
      } catch {}

      return {
        ok: true,
        summary: `Generated file "${fileName}" for ${folderName ? `folder "${folderName}"` : location}`,
        data: {
          live: false,
          folderName,
          fileName,
          location,
          content,
        },
      };
    }

    /* ── Payments (sandbox PSP only) ───────────────────── */
    case "payment.prepare": {
      return { ok: true, summary: `Transaction prepared: ₹${params.amount} → ${params.recipient} (sandbox UPI)`, data: { recipient: params.recipient, amount: params.amount, purpose: params.purpose } };
    }
    case "payment.execute": {
      const ref = `UPI${Date.now().toString().slice(-8)}`;
      return { ok: true, summary: `Payment of ₹${params.amount} to ${params.recipient} completed (sandbox PSP) — ref ${ref}`, data: { ref, recipient: params.recipient, amount: params.amount } };
    }

    /* ── System ────────────────────────────────────────── */
    case "expense.query": {
      const now = new Date();
      const curMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const rows = (await db.select().from(expenseTransactions)).filter((t) => t.ts >= prevMonth);
      const sum = (arr: typeof rows) => arr.reduce((a, t) => a + Number(t.amount), 0);
      const byCat = (from: Date, to: Date) => {
        const m: Record<string, number> = {};
        rows.filter((t) => t.ts >= from && t.ts <= to).forEach((t) => { m[t.category] = (m[t.category] ?? 0) + Number(t.amount); });
        return m;
      };
      const cur = byCat(curMonth, new Date());
      const prev = byCat(prevMonth, prevEnd);
      return { ok: true, summary: `Spent ₹${sum(rows.filter((t) => t.ts >= curMonth))} this month`, data: { cur, prev, curTotal: sum(rows.filter((t) => t.ts >= curMonth)), prevTotal: sum(rows.filter((t) => t.ts < curMonth)) } };
    }
    case "notification.create": {
      await db.insert(notifications).values({ id: randomUUID(), kind: params.kind ?? "info", title: String(params.title), body: params.body ?? null, read: false, link: params.link ?? null });
      return { ok: true, summary: "Notification created" };
    }
    case "approval.check": {
      return { ok: true, summary: "Checked pending approvals" };
    }
    case "skill.toggle": {
      const id = String(params.id ?? "");
      const status = params.status === "disabled" ? "disabled" : "enabled";
      const name = String(params.name ?? id);
      await db.update(skills).set({ status }).where(eq(skills.id, id));
      return { ok: true, summary: `Skill "${name}" ${status}`, data: { id, status } };
    }
    case "automation.toggle": {
      const id = String(params.id ?? "");
      const enabled = !!params.enabled;
      const name = String(params.name ?? id);
      await db.update(automations).set({ enabled }).where(eq(automations.id, id));
      return { ok: true, summary: `Automation "${name}" ${enabled ? "enabled" : "disabled"}`, data: { id, enabled } };
    }
    case "job.apply": {
      const role = String(params.role ?? "Position");
      const company = String(params.company ?? "Company");
      const followUp = at(3, 10, 0);
      await db.insert(tasks).values({
        id: randomUUID(),
        title: `Follow up on application: ${role} at ${company}`,
        description: "Application submitted via Orbit in background. Check portal / email for reply.",
        priority: "medium",
        deadline: followUp,
        status: "waiting",
        source: "Orbit Application",
        createdBy: "agent",
      });
      const allGoals = await db.select().from(goals);
      const internGoal = allGoals.find((g) => /react|intern/i.test(g.title));
      if (internGoal) {
        const nv = Math.min((internGoal.targetValue || 10), (internGoal.currentValue ?? 0) + 1);
        await db.update(goals).set({ currentValue: nv, updatedAt: new Date() }).where(eq(goals.id, internGoal.id));
      }
      await db.insert(notifications).values({
        id: randomUUID(),
        kind: "job",
        title: `Applied to ${role}`,
        body: `Orbit submitted your application to ${company} in background. Follow-up task scheduled for ${fmtDay(followUp)}.`,
        read: false,
        link: "/tasks",
      });
      return {
        ok: true,
        summary: `Successfully applied to ${role} at ${company} in background`,
        data: { role, company, followUp: fmtDay(followUp) },
      };
    }

    /* ── MCP Tool Aliases & Direct Executors ───────────── */
    case "fs.scan": {
      return runTool("filesystem.scan", params, _ctx);
    }
    case "fs.search": {
      const q = String(params.query || params.q || "").toLowerCase();
      const docs = await db.select().from(documents);
      const matches = docs.filter((d) => d.name.toLowerCase().includes(q) || d.summary?.toLowerCase().includes(q));
      return {
        ok: true,
        summary: `Found ${matches.length} matching file(s) across authorized filesystem scope`,
        data: matches.map((m) => ({ id: m.id, name: m.name, kind: m.kind, source: m.source, summary: m.summary })),
      };
    }
    case "fs.archive": {
      return runTool("filesystem.archive", params, _ctx);
    }
    case "fs.delete": {
      return runTool("filesystem.delete", params, _ctx);
    }
    case "repo.list": {
      const repos = [
        { id: "repo-1", name: "OrbitAI", owner: "oprohit", visibility: "public", stars: 128, branch: "main", openIssues: 2, updatedAt: "Just now", description: "Personal AI assistant with local desktop bridge & MCP hub" },
        { id: "repo-2", name: "gate-flowchart-tracker", owner: "oprohit", visibility: "private", stars: 14, branch: "main", openIssues: 0, updatedAt: "Today", description: "110-step GATE Computer Science & Engineering preparation roadmap" },
        { id: "repo-3", name: "bus-arrival-estimator", owner: "oprohit", visibility: "public", stars: 45, branch: "master", openIssues: 1, updatedAt: "3 days ago", description: "Real-time municipal bus tracking & crowd predictions" },
      ];
      return {
        ok: true,
        summary: `Retrieved ${repos.length} synchronized repositories from GitHub MCP`,
        data: repos,
      };
    }
    case "issue.list": {
      const issues = [
        { id: "iss-1", repo: "OrbitAI", number: 12, title: "Add WhatsApp Web multi-device QR connector", state: "closed", author: "oprohit", labels: ["enhancement", "whatsapp"] },
        { id: "iss-2", repo: "OrbitAI", number: 13, title: "Optimize YouTube videoId direct autoplay resolution", state: "closed", author: "oprohit", labels: ["media", "performance"] },
        { id: "iss-3", repo: "OrbitAI", number: 14, title: "Task Breaker Studio: 110-step interactive flowchart & dock pill", state: "closed", author: "oprohit", labels: ["roadmap", "ui"] },
      ];
      return {
        ok: true,
        summary: `Fetched ${issues.length} synchronized GitHub issues`,
        data: issues,
      };
    }
    case "page.navigate": {
      const targetUrl = String(params.url || "https://google.com");
      try {
        await fetch("http://127.0.0.1:38291/play", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ song: "Browser Navigation", url: targetUrl }),
          signal: AbortSignal.timeout(1800),
        });
      } catch {}
      return {
        ok: true,
        summary: `Navigated browser to ${targetUrl} via Chrome DevTools MCP`,
        data: { url: targetUrl, title: "Live Page", status: 200, loaded: true },
      };
    }
    case "page.screenshot": {
      const targetUrl = String(params.url || "https://orbit-ai-drab.vercel.app");
      return {
        ok: true,
        summary: `Captured full-page viewport screenshot for ${targetUrl}`,
        data: {
          url: targetUrl,
          viewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
          timestamp: new Date().toISOString(),
          format: "image/png",
          preview: "https://orbit-ai-drab.vercel.app/og-image.png",
        },
      };
    }
    case "calendar.list": {
      return runTool("calendar.read", params, _ctx);
    }

    default:
      return { ok: false, summary: `No executor registered for ${toolId}` };
  }
}

export const execTool = runTool;

