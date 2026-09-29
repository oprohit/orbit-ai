const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode");
const { Client } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

let makeWASocket, useMultiFileAuthState, DisconnectReason;
try {
  const baileys = require("@whiskeysockets/baileys");
  makeWASocket = baileys.default || baileys.makeWASocket;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  DisconnectReason = baileys.DisconnectReason;
} catch (e) {
  console.warn("[WhatsApp Agent] @whiskeysockets/baileys not found, running in fallback mode:", e.message);
}

// Global WhatsApp state
let waSocket = null;
let connectionStatus = "disconnected"; // disconnected | scan_needed | connecting | connected
let currentQrRaw = "";
let currentQrDataUrl = "";
let connectedUser = null;
let lastSyncTime = null;
let recentExtractedTasks = [];

const AUTH_DIR = path.join(__dirname, "..", ".whatsapp_auth");

// Connect to Database helper
async function getDbClient() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    return client;
  } catch (err) {
    console.error("[WhatsApp Agent] DB connection failed:", err.message);
    return null;
  }
}

// Intelligent NLP Task Classifier for WhatsApp Messages
function analyzeWhatsAppMessage(text, sender = "Contact") {
  if (!text || typeof text !== "string") return null;
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Filter out non-tasks / casual chatter / greetings
  const isChitChat = /^(?:hi|hello|hey|heya|yo|hlo|good\s+(?:morning|afternoon|evening|night)|gm|gn|k|ok|okay|sure|cool|fine|alright|yes|no|nope|yep|yeah|haha|lol|lmao|rofl|nice|wow|super|congrats|thank(?:s|\s+you)|thanks\s+bro|see\s+you|bye|tc|how\s+are\s+you|what'?s\s+up|wassup|free\s+now\??|call\s+me\s+when\s+free|where\s+are\s+you)\b/i.test(lower);
  if (isChitChat && clean.length < 40 && !/(?:submit|deadline|assignment|due|pay|send|before)/i.test(lower)) {
    return null;
  }

  // 2. Detect Actionable Task Indicators
  const hasTaskVerb = /(?:submit|send|upload|forward|prepare|write|draft|review|verify|check|call|meet|schedule|pay|transfer|buy|order|attend|join|complete|finish|solve|revise|bring|collect|print|sign|fill|update)\b/i.test(lower);
  const hasTaskNoun = /(?:assignment|homework|project|presentation|slides|lab\s+report|report|form|fee|fees|bill|electricity|rent|ticket|document|notes|resume|meeting|class|exam|quiz|deadline|due\s+date|reminder|task|todo)\b/i.test(lower);
  const hasUrgency = /(?:urgent|important|asap|before\s+\d|by\s+(?:today|tomorrow|friday|monday|evening|5pm|6pm)|immediately)\b/i.test(lower);

  if ((hasTaskVerb && hasTaskNoun) || (hasTaskNoun && hasUrgency) || lower.startsWith("task:") || lower.startsWith("todo:")) {
    // Format a concise, clean task title
    let title = clean
      .replace(/^(?:hey|hi|hello|please|kindly|can\s+you|make\s+sure\s+to|don'?t\s+forget\s+to|task:?|todo:?)\s*/i, "")
      .replace(/[.!]+$/, "")
      .trim();

    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);
    if (title.length > 70) title = title.slice(0, 67) + "...";

    const priority = hasUrgency || /today|urgent|asap/i.test(lower) ? "high" : "medium";

    return {
      title,
      rawText: clean,
      sender,
      priority,
      detectedAt: new Date().toISOString(),
    };
  }

  return null;
}

// Save extracted task to Supabase / Postgres DB & trigger user notification
async function recordTaskInDb(taskInfo) {
  const db = await getDbClient();
  if (!db) return false;

  try {
    const taskId = "wa-task-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const notifId = "wa-notif-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const deadline = new Date(Date.now() + 86400000); // Default 24h

    // Insert task
    await db.query(`
      INSERT INTO tasks (id, title, description, priority, deadline, status, source, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (id) DO NOTHING
    `, [
      taskId,
      taskInfo.title,
      `Extracted from WhatsApp message by ${taskInfo.sender}: "${taskInfo.rawText}"`,
      taskInfo.priority,
      deadline,
      "inbox",
      `WhatsApp (${taskInfo.sender})`,
      "agent",
    ]);

    // Insert notification
    await db.query(`
      INSERT INTO notifications (id, kind, title, body, read, link, created_at)
      VALUES ($1, $2, $3, $4, false, $5, NOW())
    `, [
      notifId,
      "whatsapp_task",
      `WhatsApp Task from ${taskInfo.sender}`,
      `"${taskInfo.title}" was identified and added to your inbox.`,
      "/tasks",
    ]);

    // Update connector status to connected
    await db.query(`
      UPDATE connectors
      SET status = 'connected', last_sync = NOW(), notes = 'Personal WhatsApp Web device linked via QR scan.'
      WHERE id = 'whatsapp'
    `);

    recentExtractedTasks.unshift({
      id: taskId,
      title: taskInfo.title,
      sender: taskInfo.sender,
      time: new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
    });
    if (recentExtractedTasks.length > 20) recentExtractedTasks.pop();

    console.log(`[WhatsApp Agent] Auto-added task: "${taskInfo.title}" from ${taskInfo.sender}`);
    return true;
  } catch (err) {
    console.error("[WhatsApp Agent] Error inserting task:", err.message);
    return false;
  } finally {
    await db.end();
  }
}

// Start WhatsApp Multi-Device Socket
async function startWhatsApp() {
  if (!makeWASocket || !useMultiFileAuthState) {
    console.warn("[WhatsApp Agent] Baileys libraries not available, providing simulated QR endpoint.");
    return generateDemoQr();
  }

  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    waSocket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ["Orbit AI", "Chrome", "1.0.0"],
    });

    waSocket.ev.on("creds.update", saveCreds);

    waSocket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQrRaw = qr;
        currentQrDataUrl = await qrcode.toDataURL(qr, { margin: 2, scale: 7 });
        connectionStatus = "scan_needed";
        console.log("[WhatsApp Agent] New QR code generated. Waiting for user scan...");
      }

      if (connection === "connecting") {
        connectionStatus = "connecting";
      }

      if (connection === "open") {
        connectionStatus = "connected";
        currentQrRaw = "";
        currentQrDataUrl = "";
        lastSyncTime = new Date().toISOString();
        connectedUser = {
          id: waSocket.user?.id || "Linked User",
          name: waSocket.user?.name || waSocket.user?.notify || "WhatsApp Account",
        };
        console.log(`[WhatsApp Agent] WhatsApp connected successfully as: ${connectedUser.name} (${connectedUser.id})`);

        // Update DB connector status
        const db = await getDbClient();
        if (db) {
          try {
            await db.query(`
              UPDATE connectors
              SET status = 'connected', connected_at = NOW(), last_sync = NOW(),
                  notes = 'Connected as ' || $1 || ' via personal WhatsApp QR scan.'
              WHERE id = 'whatsapp'
            `, [connectedUser.name]);
          } catch {}
          await db.end();
        }
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason?.loggedOut;
        console.log(`[WhatsApp Agent] Connection closed (code: ${statusCode}). Reconnect: ${shouldReconnect}`);
        connectionStatus = "disconnected";

        if (shouldReconnect) {
          setTimeout(startWhatsApp, 3000);
        } else {
          // Logged out
          currentQrRaw = "";
          currentQrDataUrl = "";
          connectedUser = null;
        }
      }
    });

    // Listen to real-time incoming messages
    waSocket.ev.on("messages.upsert", async ({ messages, type }) => {
      for (const m of messages) {
        if (!m.message) continue;
        const messageText =
          m.message.conversation ||
          m.message.extendedTextMessage?.text ||
          m.message.imageMessage?.caption ||
          "";

        const senderName = m.pushName || m.key.remoteJid?.split("@")[0] || "Friend";

        console.log(`[WhatsApp Agent] Incoming msg from ${senderName}: "${messageText.slice(0, 50)}"`);

        // Check if message is an actionable task
        const task = analyzeWhatsAppMessage(messageText, senderName);
        if (task) {
          await recordTaskInDb(task);
        }
      }
    });

    return waSocket;
  } catch (err) {
    console.error("[WhatsApp Agent] Socket startup error:", err.message);
    connectionStatus = "disconnected";
  }
}

// Generate demo QR code if socket is not actively bound
async function generateDemoQr() {
  const dummyQrString = `ORBIT-WHATSAPP-LINK-${Date.now()}`;
  currentQrRaw = dummyQrString;
  currentQrDataUrl = await qrcode.toDataURL(dummyQrString, { margin: 2, scale: 7 });
  connectionStatus = "scan_needed";
  return currentQrDataUrl;
}

// Disconnect and clear auth
async function disconnectWhatsApp() {
  if (waSocket) {
    try {
      await waSocket.logout();
    } catch {}
    waSocket = null;
  }
  connectionStatus = "disconnected";
  connectedUser = null;
  currentQrDataUrl = "";

  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch {}

  const db = await getDbClient();
  if (db) {
    try {
      await db.query(`
        UPDATE connectors
        SET status = 'available', connected_at = NULL, last_sync = NULL,
            notes = 'Personal WhatsApp Web device unlinked.'
        WHERE id = 'whatsapp'
      `);
    } catch {}
    await db.end();
  }
}

// Get live status
async function getWhatsAppStatus() {
  if (!currentQrDataUrl && connectionStatus === "disconnected") {
    await generateDemoQr();
  }

  return {
    running: true,
    connected: connectionStatus === "connected",
    status: connectionStatus,
    user: connectedUser,
    qr: currentQrDataUrl,
    lastSync: lastSyncTime,
    recentTasks: recentExtractedTasks,
  };
}

// Simulate receiving an incoming task for immediate demonstration
async function simulateIncomingMessage(text, sender = "Class Rep") {
  const msgText = text || "Please submit the Machine Learning lab assignment before 5 PM tomorrow!";
  const task = analyzeWhatsAppMessage(msgText, sender) || {
    title: msgText.replace(/[.!]+$/, ""),
    rawText: msgText,
    sender,
    priority: "high",
    detectedAt: new Date().toISOString(),
  };

  await recordTaskInDb(task);
  return { ok: true, task };
}

module.exports = {
  startWhatsApp,
  getWhatsAppStatus,
  disconnectWhatsApp,
  simulateIncomingMessage,
  analyzeWhatsAppMessage,
  recordTaskInDb,
};

if (require.main === module) {
  startWhatsApp();
}
