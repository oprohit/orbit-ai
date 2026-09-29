import type { ToolRequest } from "./types";

/**
 * Optional AI routing layer (OpenRouter).
 * - model routing + fallback (env-configured, nothing hardcoded as the single model)
 * - structured JSON outputs, validated before use
 * - ADVISORY ONLY: the returned tool requests still pass through the policy engine.
 */

export function aiConfig() {
  const key = process.env.OPENROUTER_API_KEY || "";
  return {
    enabled: key.length > 10,
    model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat",
    fallbackModel: process.env.OPENROUTER_FALLBACK_MODEL || "openai/gpt-4o-mini",
  };
}

export type LlmPlan = {
  intent: string;
  reply: string;
  needsClarification: boolean;
  toolRequests: ToolRequest[];
};

const SYSTEM = `You are the planning layer inside ORBIT AI, a constrained agent platform.
Respond ONLY with valid JSON:
{ "intent": "goal|task|question|search|reminder|chitchat",
  "reply": "short natural reply to the user (max 60 words)",
  "needsClarification": false,
  "tool_requests": [ { "tool_id": "gmail.read", "params": {}, "reason": "why" } ] }
Rules: only reference registered tools (gmail.*, calendar.*, drive.*, classroom.*, jobs.search,
weather.get, youtube.search, task.create, payment.*, filesystem.*). Never invent tool ids.
The policy engine will approve or block each request — never claim an action is done.`;

async function callModel(key: string, model: string, userMessage: string): Promise<unknown> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`openrouter ${res.status}`);
  const json = (await res.json()) as any;
  const content: string = json?.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content);
}

/** Validate + normalize structured model output. Returns null on any validation failure. */
export function validatePlan(raw: unknown): LlmPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.reply !== "string" || r.reply.length === 0) return null;
  const requests = Array.isArray(r.tool_requests)
    ? r.tool_requests
        .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
        .filter((t) => typeof t.tool_id === "string" && /^[a-z0-9._-]+$/i.test(t.tool_id as string))
        .map((t) => ({
          toolId: t.tool_id as string,
          params: (t.params && typeof t.params === "object" ? t.params : {}) as Record<string, unknown>,
          reason: typeof t.reason === "string" ? t.reason : "model-suggested",
        }))
    : [];
  return {
    intent: typeof r.intent === "string" ? r.intent : "chitchat",
    reply: r.reply.slice(0, 800),
    needsClarification: r.needsClarification === true,
    toolRequests: requests.slice(0, 5),
  };
}

export async function llmPlan(userMessage: string): Promise<LlmPlan | null> {
  const cfg = aiConfig();
  if (!cfg.enabled) return null;
  const key = process.env.OPENROUTER_API_KEY!;
  const models = [cfg.model, ...(cfg.fallbackModel ? [cfg.fallbackModel] : [])];
  for (const model of models) {
    try {
      const raw = await callModel(key, model, userMessage);
      const plan = validatePlan(raw);
      if (plan) return plan;
    } catch {
      /* fall through to next model */
    }
  }
  return null;
}

/** LLM-generated phrasing for free-form / chitchat turns when the key is configured. */
export async function llmReply(userMessage: string, context: string): Promise<string | null> {
  const cfg = aiConfig();
  if (!cfg.enabled) return null;
  const key = process.env.OPENROUTER_API_KEY!;
  const models = [cfg.model, ...(cfg.fallbackModel ? [cfg.fallbackModel] : [])];
  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: `You are ORBIT, a calm personal AI assistant. Context: ${context}. Reply in at most 3 sentences, plain text, no markdown.` },
            { role: "user", content: userMessage },
          ],
          max_tokens: 200,
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as any;
      const text = json?.choices?.[0]?.message?.content;
      if (typeof text === "string" && text.trim()) return text.trim();
    } catch {
      /* next model */
    }
  }
  return null;
}

export async function generateNaturalEmail(
  userPrompt: string,
  to: string
): Promise<{ subject: string; body: string }> {
  const key = process.env.OPENROUTER_API_KEY || "";
  const nameCandidate = to.split("@")[0].replace(/[^a-zA-Z]/g, " ").trim();
  const recipientName = nameCandidate ? nameCandidate.charAt(0).toUpperCase() + nameCandidate.slice(1).toLowerCase() : "there";

  const prompt = `You are an AI generating a natural, human-written email from Aarav to ${recipientName} (${to}).
The user request is: "${userPrompt}".
Understand the user's intent:
- If greeting for morning/afternoon/evening: write a warm, friendly greeting for that time of day.
- If asking for leave/sick: write a respectful note explaining absence.
- If asking about project/assignment: write a clear status or question.
- Do NOT talk about "discussion" or robotic phrases unless the user actually requested that. Act like a natural human.
Respond ONLY with valid JSON:
{
  "subject": "natural email subject line",
  "body": "natural email body text signed by Aarav"
}`;

  const models = [
    "deepseek/deepseek-chat",
    "openai/gpt-4o-mini",
  ];

  if (key) {
    for (const model of models) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_tokens: 400,
          }),
          signal: AbortSignal.timeout(9000),
        });

        if (res.ok) {
          const json = (await res.json()) as any;
          const content = json?.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (parsed.subject && parsed.body) {
              return {
                subject: parsed.subject.trim(),
                body: parsed.body.trim(),
              };
            }
          }
        }
      } catch {
        /* try next model */
      }
    }
  }

  // High-fidelity fallback if offline
  const lower = userPrompt.toLowerCase();
  if (/morning/i.test(lower)) {
    return {
      subject: `Good Morning, ${recipientName}!`,
      body: `Hi ${recipientName},\n\nWishing you a wonderful morning and a productive day ahead!\n\nBest regards,\nAarav`,
    };
  }
  if (/afternoon/i.test(lower)) {
    return {
      subject: `Good Afternoon, ${recipientName}!`,
      body: `Hi ${recipientName},\n\nHope your day is going well! Just wanted to send warm afternoon greetings your way.\n\nWarm regards,\nAarav`,
    };
  }
  if (/evening|night/i.test(lower)) {
    return {
      subject: `Good Evening, ${recipientName}`,
      body: `Hi ${recipientName},\n\nHope you had a great day today. Wishing you a peaceful and relaxing evening.\n\nBest regards,\nAarav`,
    };
  }
  if (/greet|hello|hi\b/i.test(lower)) {
    return {
      subject: `Warm Greetings from Aarav`,
      body: `Hi ${recipientName},\n\nHope you are having a great day! Reaching out to say hello and wish you all the best.\n\nBest regards,\nAarav`,
    };
  }
  if (/leave|sick|absence|unwell/i.test(lower)) {
    return {
      subject: `Leave Request — Aarav`,
      body: `Dear ${recipientName},\n\nI am writing to let you know that I am feeling unwell today and will be unable to attend. I will review all class material and catch up on any tasks promptly.\n\nThank you for understanding,\nAarav`,
    };
  }

  return {
    subject: `Note from Aarav`,
    body: `Hi ${recipientName},\n\nHope this finds you well. I wanted to reach out regarding ${userPrompt.replace(/^.*?(?:about|for|to)\s+/i, "") || "our work"}.\n\nBest regards,\nAarav`,
  };
}

