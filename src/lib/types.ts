export type Chip = { label: string; send: string };

export type Block =
  | { type: "chips"; chips: Chip[] }
  | { type: "goal"; goal: { id: string; title: string; current: number; target: number; unit: string; deadline: string; nextAction: string; milestones: { title: string; status: string }[] } }
  | { type: "tasks"; items: { id: string; title: string; deadline?: string; points?: number; status?: string }[] }
  | { type: "approval"; approvalId: string }
  | { type: "briefing"; sections: { title: string; lines: { text: string; tone?: "ok" | "warn" | "danger" | "muted" | "info" }[] }[] }
  | { type: "opps"; items: { title: string; points?: number; date?: string; deadline?: string; location?: string; source?: string }[] }
  | { type: "jobs"; items: { company: string; role: string; location?: string; match?: string; source?: string; link?: string; requirements?: string }[] }
  | { type: "emails"; items: { from: string; subject: string; cls: string; deadline?: string }[] }
  | { type: "events"; items: { title: string; when: string; time: string; status?: string }[] }
  | { type: "scan"; total: string; items: { label: string; size: string }[] }
  | { type: "files"; items: { name: string; folder: string; modified: string; score: string }[] }
  | { type: "expense"; month: string; total: number; byCategory: { cat: string; amount: number }[]; insights: string[] }
  | { type: "result"; title: string; lines: string[]; action?: { type: string; payload: any } }
  | {
      type: "study_plan";
      title: string;
      goal: string;
      timeline: string;
      phases: { name: string; duration: string; focus: string }[];
      subtasks: { id: string; title: string; status: "pending" | "in_progress" | "done"; weight?: string }[];
      resources: { title: string; channel: string; duration: string; why: string; url: string }[];
    };

export type ChatContent = { text: string; blocks?: Block[] };

export type ToolRequest = { toolId: string; params: Record<string, unknown>; reason: string };

export type ToolResult = { ok: boolean; summary: string; data?: unknown };

export type ExecResult = {
  ok: boolean;
  summary: string;
  data?: unknown;
  blocked?: string;
  approvalId?: string;
};

export type Risk = "low" | "medium" | "high" | "critical";
export type PolicyLevel = "allow" | "ask" | "block";
