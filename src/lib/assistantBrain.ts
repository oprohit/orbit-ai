import { aiConfig } from "./ai";

export type AssistantActionType =
  | "open_url"
  | "play_music"
  | "create_folder"
  | "create_file"
  | "clean_junk"
  | "set_reminder"
  | "weather"
  | "email"
  | "break_goal"
  | "task_manage"
  | "briefing"
  | "conversational";

export type AssistantDecision = {
  intent: AssistantActionType;
  reply: string;
  isNegatedGoal?: boolean;
  params: Record<string, any>;
};

const SYSTEM_PROMPT = `You are Orbit, an exceptionally perceptive, intelligent, warm, and proactive personal AI assistant for Aarav, a 3rd-year Computer Science student at COET (College of Engineering and Technology).

AARAV'S PROFILE:
- Name: Aarav
- Role: 3rd year CS undergrad
- Academics: Data Structures & Algorithms (DSA), Web Development, GATE CS preparation, semester coursework
- Interests: Technology, coding, music, personal growth, balancing productivity with relaxation
- Timezone: Asia/Kolkata

CORE PERSONALITY:
- Warm, sharp, empathetic, and human-like (inspired by OpenAI voice mode, Samantha, and Jarvis).
- Speak naturally and conversationally, addressing Aarav with genuine warmth.
- NEVER sound robotic, clinical, or bureaucratic.
- Respect his mood: If he is tired or just wants to watch YouTube/relax, NEVER lecture him about studying or create unwanted goals! Fulfill his request instantly with friendly, supportive banter.

CRITICAL INTENT RULES & NEGATION HANDLING:
1. NEGATION & REFUSALS:
   - If Aarav says "I don't want any goals rn", "no goals", "don't make this a goal", "just open youtube", "stop", "cancel":
     He is explicitly rejecting goal creation. You MUST NOT set intent="break_goal". Honor his true request!
2. DIRECT ACTIONS (Fulfill immediately):
   - "open youtube", "launch youtube", "go to youtube" -> intent="open_url", params: { "url": "https://www.youtube.com", "title": "YouTube" }
   - "open gmail" -> intent="open_url", params: { "url": "https://mail.google.com", "title": "Gmail" }
   - "open github" -> intent="open_url", params: { "url": "https://github.com", "title": "GitHub" }
   - "open leetcode" -> intent="open_url", params: { "url": "https://leetcode.com", "title": "LeetCode" }
   - "open chatgpt" -> intent="open_url", params: { "url": "https://chat.openai.com", "title": "ChatGPT" }
   - "open [any url / website]" -> intent="open_url", params: { "url": "...", "title": "..." }
   - "play [song/music]" -> intent="play_music", params: { "song": "..." }
   - "create folder [name]" -> intent="create_folder", params: { "folderName": "...", "location": "desktop" }
   - "create file [name]" -> intent="create_file", params: { "fileName": "...", "content": "..." }
   - "clean temp / free up storage" -> intent="clean_junk", params: {}
   - "remind me in [X] to [Y]" -> intent="set_reminder", params: { "seconds": X, "title": "..." }
3. GOAL BREAKDOWN (ONLY when explicitly and genuinely requested):
   - "Help me prepare for GATE exam - make this a long term goal", "Create a 6-month roadmap for Full Stack Web Dev", "Break down my goal to master Rust"
   -> intent="break_goal", params: { "goal": "..." }
   - NEVER trigger break_goal for "open youtube", "open google", or simple tasks!
4. CONVERSATION / QUESTIONS:
   - "Hi", "How are you", "I'm stressed", "Explain quicksort", "What should I eat"
   -> intent="conversational"

Respond ONLY in valid JSON matching this schema:
{
  "intent": "open_url" | "play_music" | "create_folder" | "create_file" | "clean_junk" | "set_reminder" | "weather" | "email" | "break_goal" | "task_manage" | "briefing" | "conversational",
  "reply": "Warm, natural, human-like response spoken directly to Aarav (1-3 sentences max, personalized)",
  "params": {}
}`;

export async function decideAssistantTurn(userMessage: string): Promise<AssistantDecision | null> {
  const cfg = aiConfig();
  const rawMsg = userMessage.trim();
  const lower = rawMsg.toLowerCase();

  // Fast-path safety check for explicit negations + open requests
  const hasGoalNegation = /(?:don'?t\s+want|do\s+not\s+want|dotnt\s+want|no\s+goals?|not\s+(?:a\s+)?goal|stop\s+goals?|never\s+mind\s+goals?)\b/i.test(lower);
  const wantsOpenYouTube = /(?:open|launch|go\s+to|start)\s+(?:up\s+)?(?:the\s+)?(?:youtube|yt)\b/i.test(lower) || /^(?:youtube|yt)$/i.test(lower);

  if (hasGoalNegation && wantsOpenYouTube) {
    return {
      intent: "open_url",
      reply: "Got it, no goals right now Aarav! 🎬 Opening YouTube for you so you can kick back and relax.",
      isNegatedGoal: true,
      params: { url: "https://www.youtube.com", title: "YouTube" },
    };
  }

  if (/^(?:please\s+|can\s+you\s+|could\s+you\s+|just\s+)?(?:open|launch|go\s+to)\s+(?:up\s+)?(?:the\s+)?(?:youtube|yt)\s*(?:for\s+me|pls|please)?$/i.test(lower)) {
    return {
      intent: "open_url",
      reply: "Opening YouTube for you now, Aarav! Enjoy.",
      params: { url: "https://www.youtube.com", title: "YouTube" },
    };
  }

  // If OpenRouter is available, ask DeepSeek-Chat for human-level intent understanding
  if (cfg.enabled) {
    const key = process.env.OPENROUTER_API_KEY!;
    const models = [cfg.model, cfg.fallbackModel].filter(Boolean) as string[];

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
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: rawMsg },
            ],
            response_format: { type: "json_object" },
            max_tokens: 350,
          }),
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const json = await res.json();
          const content = json?.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (parsed.intent && parsed.reply) {
              // Extra safety check: if model mistakenly returned break_goal despite user saying "don't want goals", override it
              if (parsed.intent === "break_goal" && hasGoalNegation) {
                if (wantsOpenYouTube) {
                  return {
                    intent: "open_url",
                    reply: "Understood, Aarav — no goals right now! 🎬 Opening YouTube for you.",
                    isNegatedGoal: true,
                    params: { url: "https://www.youtube.com", title: "YouTube" },
                  };
                }
                return {
                  intent: "conversational",
                  reply: "No worries Aarav, we won't set up any goals right now. Let me know what you'd like to do instead!",
                  isNegatedGoal: true,
                  params: {},
                };
              }
              return {
                intent: parsed.intent,
                reply: parsed.reply,
                params: parsed.params || {},
                isNegatedGoal: hasGoalNegation,
              };
            }
          }
        }
      } catch (err) {
        // Fall through to next model or local classifier
      }
    }
  }

  // Local semantic classifier (high-fidelity fallback if offline)
  return localSemanticClassify(rawMsg, lower);
}

function localSemanticClassify(raw: string, lower: string): AssistantDecision {
  const hasGoalNegation = /(?:don'?t\s+want|do\s+not\s+want|dotnt\s+want|no\s+goals?|not\s+(?:a\s+)?goal|stop\s+goals?)\b/i.test(lower);

  // 1. Direct Web & App Launches
  const openMatch = lower.match(/^(?:please\s+|can\s+you\s+|could\s+you\s+|just\s+)?(?:open|launch|go\s+to|start)\s+(?:up\s+)?(?:the\s+)?([a-z0-9\s.-]+)/i);
  if (openMatch) {
    const target = openMatch[1].trim();
    const KNOWN_SITES: Record<string, { url: string; title: string }> = {
      youtube: { url: "https://www.youtube.com", title: "YouTube" },
      yt: { url: "https://www.youtube.com", title: "YouTube" },
      "youtube music": { url: "https://music.youtube.com", title: "YouTube Music" },
      "yt music": { url: "https://music.youtube.com", title: "YouTube Music" },
      gmail: { url: "https://mail.google.com", title: "Gmail" },
      mail: { url: "https://mail.google.com", title: "Gmail" },
      github: { url: "https://github.com", title: "GitHub" },
      leetcode: { url: "https://leetcode.com", title: "LeetCode" },
      google: { url: "https://www.google.com", title: "Google" },
      chatgpt: { url: "https://chat.openai.com", title: "ChatGPT" },
      spotify: { url: "https://open.spotify.com", title: "Spotify" },
      whatsapp: { url: "https://web.whatsapp.com", title: "WhatsApp Web" },
      netflix: { url: "https://www.netflix.com", title: "Netflix" },
      twitter: { url: "https://x.com", title: "X (Twitter)" },
      x: { url: "https://x.com", title: "X" },
      reddit: { url: "https://www.reddit.com", title: "Reddit" },
    };

    if (KNOWN_SITES[target]) {
      const site = KNOWN_SITES[target];
      return {
        intent: "open_url",
        reply: `Opening ${site.title} for you right now, Aarav!`,
        params: { url: site.url, title: site.title },
      };
    }

    if (/^https?:\/\/|^www\.|^[a-z0-9-]+\.[a-z]{2,}/i.test(target)) {
      const url = target.startsWith("http") ? target : `https://${target}`;
      return {
        intent: "open_url",
        reply: `Opening ${target} in your browser, Aarav.`,
        params: { url, title: target },
      };
    }
  }

  // 2. Music Playback
  if (/^(?:please\s+|can\s+you\s+|could\s+you\s+)?(?:play|listen to|stream|put on)\s+(?:music|song|track)?\s*["']?([^"'\n]+?)["']?$/i.test(lower) || /play\s+.*\s+(?:in|on)\s+(?:youtube\s*music|yt\s*music|spotify)/i.test(lower)) {
    return {
      intent: "play_music",
      reply: "Finding the track and launching playback on YouTube Music right now! 🎶",
      params: { query: raw },
    };
  }

  // 3. Junk Cleaning
  if (/(?:clean|free|clear)\s+(?:up\s+)?(?:junk|temp|temporary|cache|storage|disk)/i.test(lower)) {
    return {
      intent: "clean_junk",
      reply: "Scanning %TEMP% and safely cleaning unneeded temporary junk files for you right now.",
      params: {},
    };
  }

  // 4. File / Folder Creation
  if (/(?:create|make|new)\s+(?:a\s+)?(?:folder|dir|directory|text\s+(?:document|file)|file)\b/i.test(lower)) {
    return {
      intent: "create_folder",
      reply: "Executing filesystem action on your Windows workspace right away.",
      params: { query: raw },
    };
  }

  // 5. Timed Reminders
  if (/(?:remind|reminder|alarm|alert\s+me)\b/i.test(lower)) {
    return {
      intent: "set_reminder",
      reply: "Setting up your timed reminder with physical audible alert.",
      params: { query: raw },
    };
  }

  // 6. Genuine Long Term Goal (ONLY if NOT negated!)
  if (!hasGoalNegation && /(?:long.?term\s+goal|make\s+this\s+(?:as\s+)?(?:an?\s+)?(?:active\s+|long.?term\s+)?goal|create\s+(?:a\s+|an\s+)?(?:active\s+)?goal|add\s+(?:this\s+)?(?:as\s+)?(?:an?\s+)?(?:active\s+)?goal|prepare\s+for\s+gate|gate\s+prep|study\s+plan\s+for|curriculum\s+for|roadmap\s+for\s+mastery)/i.test(lower)) {
    return {
      intent: "break_goal",
      reply: "Deconstructing your ambition into a structured milestone roadmap with researched subtasks and study resources.",
      params: { query: raw },
    };
  }

  // 7. General Conversational / Question
  return {
    intent: "conversational",
    reply: "I'm right here with you, Aarav. How can I help make your day smoother?",
    params: {},
  };
}
