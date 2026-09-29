import type { ToolRequest } from "./types";

/**
 * Optional AI routing layer (OpenRouter).
 * - model routing + fallback (env-configured, nothing hardcoded as the single model)
 * - structured JSON outputs, validated before use
 * - ADVISORY ONLY: the returned tool requests still pass through the policy engine.
 */

export function aiConfig() {
  const key = process.env.OPENROUTER_API_KEY ?? "";
  return {
    enabled: key.length > 10,
    model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    fallbackModel: process.env.OPENROUTER_FALLBACK_MODEL || null,
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
