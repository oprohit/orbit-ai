import {
  pgTable, text, timestamp, boolean, integer, jsonb,
} from "drizzle-orm/pg-core";

const now = () => timestamp("created_at", { withTimezone: true }).defaultNow();

/* ── Identity ─────────────────────────────────────────────── */

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  timezone: text("timezone").default("Asia/Colombo"),
  // { requireApprovalForAll: boolean, language: string }
  flags: jsonb("flags").$type<{ requireApprovalForAll: boolean; language: string }>(),
  createdAt: now(),
});

export const memoryEntries = pgTable("memory_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").default("u1"),
  key: text("key").notNull(),
  value: text("value").notNull(),
  kind: text("kind").default("preference"), // preference | schedule | connector
  createdAt: now(),
});

/* ── Connectors / Tools / Policy ──────────────────────────── */

export const connectors = pgTable("connectors", {
  id: text("id").primaryKey(),               // e.g. "gmail"
  name: text("name").notNull(),
  provider: text("provider"),
  category: text("category"),
  description: text("description"),
  // connected | available | needs_attention | unavailable
  status: text("status").notNull().default("available"),
  authType: text("auth_type"),               // oauth2 | api_key | local_agent | sandbox
  demo: boolean("demo").default(true),
  scopes: jsonb("scopes").$type<string[]>().default([]),
  capabilities: jsonb("capabilities").$type<string[]>().default([]),
  freeTier: text("free_tier"),
  rateLimit: text("rate_limit"),
  docsUrl: text("docs_url"),
  notes: text("notes"),
  lastSync: timestamp("last_sync", { withTimezone: true }),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
});

export const tools = pgTable("tools", {
  id: text("id").primaryKey(),               // e.g. "gmail.send"
  name: text("name").notNull(),
  connectorId: text("connector_id").references(() => connectors.id),
  description: text("description"),
  riskLevel: text("risk_level").notNull().default("low"), // low|medium|high|critical
  requiresApproval: boolean("requires_approval").default(false),
  enabled: boolean("enabled").default(true),
  inputSchema: jsonb("input_schema"),
  outputSchema: jsonb("output_schema"),
});

export const toolPermissions = pgTable("tool_permissions", {
  id: text("id").primaryKey(),
  userId: text("user_id").default("u1"),
  toolId: text("tool_id").notNull(),
  // allow | ask | block — user policy overrides model suggestions
  level: text("level").notNull().default("allow"),
});

/* ── Extension entities (distinct: connector / tool / skill / mcp / plugin) ── */

export const skills = pgTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  tools: jsonb("tools").$type<string[]>().default([]),
  triggers: jsonb("triggers").$type<string[]>().default([]),
  status: text("status").default("enabled"),
  recommended: boolean("recommended").default(false),
  lastRun: timestamp("last_run", { withTimezone: true }),
});

export const plugins = pgTable("plugins", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version"),
  description: text("description"),
  capabilities: jsonb("capabilities").$type<string[]>().default([]),
  tools: jsonb("tools").$type<string[]>().default([]),
  permissions: jsonb("permissions").$type<string[]>().default([]),
  risk: text("risk").default("low"),
  status: text("status").default("enabled"),
  services: jsonb("services").$type<string[]>().default([]),
});

export const mcpServers = pgTable("mcp_servers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("connected"),  // connected | disconnected | degraded
  permissionLevel: text("permission_level"),
  health: text("health").default("healthy"),
  lastUsed: timestamp("last_used", { withTimezone: true }),
});

export const mcpTools = pgTable("mcp_tools", {
  id: text("id").primaryKey(),
  serverId: text("server_id").references(() => mcpServers.id),
  name: text("name").notNull(),
  description: text("description"),
  riskLevel: text("risk_level").default("low"),
  permission: text("permission").default("allow"), // allow | ask | block
});

/* ── Goals / Tasks / Automations ──────────────────────────── */

export const goals = pgTable("goals", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("active"),     // active | on_hold | completed | blocked
  deadline: timestamp("deadline", { withTimezone: true }),
  targetValue: integer("target_value"),
  currentValue: integer("current_value"),
  unit: text("unit"),
  aiReasoning: text("ai_reasoning"),
  nextAction: text("next_action"),
  sources: jsonb("sources").$type<string[]>().default([]),
  createdAt: now(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const goalMilestones = pgTable("goal_milestones", {
  id: text("id").primaryKey(),
  goalId: text("goal_id").references(() => goals.id),
  title: text("title").notNull(),
  detail: text("detail"),
  seq: integer("seq").default(0),
  status: text("status").default("pending"),    // pending | in_progress | done
});

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  goalId: text("goal_id"),
  priority: text("priority").default("medium"), // low|medium|high|urgent
  deadline: timestamp("deadline", { withTimezone: true }),
  status: text("status").default("inbox"),      // inbox|planned|in_progress|waiting|blocked|completed|cancelled
  source: text("source"),                        // Gmail · Classroom · Agent · User …
  createdBy: text("created_by").default("agent"), // user | agent
  approvalRequired: boolean("approval_required").default(false),
  points: integer("points"),                     // Stride points value
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: now(),
});

export const taskDependencies = pgTable("task_dependencies", {
  id: text("id").primaryKey(),
  taskId: text("task_id").references(() => tasks.id),
  dependsOnId: text("depends_on_id").references(() => tasks.id),
});

export const automations = pgTable("automations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  trigger: text("trigger"),
  schedule: text("schedule"),
  tools: jsonb("tools").$type<string[]>().default([]),
  actions: text("actions"),
  enabled: boolean("enabled").default(true),
  lastRun: timestamp("last_run", { withTimezone: true }),
  nextRun: timestamp("next_run", { withTimezone: true }),
});

/* ── Agent execution & governance ─────────────────────────── */

export const approvals = pgTable("approvals", {
  id: text("id").primaryKey(),
  runId: text("run_id"),
  toolId: text("tool_id"),
  connectorId: text("connector_id"),
  action: text("action"),                        // human name: "Send email"
  reason: text("reason"),                        // why Orbit wants to do it
  params: jsonb("params"),
  effect: text("effect"),                        // potential effect
  preview: jsonb("preview"),
  riskLevel: text("risk_level").default("high"),
  status: text("status").default("pending"),     // pending | approved | denied
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: now(),
});

export const agentRuns = pgTable("agent_runs", {
  id: text("id").primaryKey(),
  startedAt: now(),
  userMessage: text("user_message"),
  intent: text("intent"),
  model: text("model"),
  status: text("status").default("completed"),
  summary: text("summary"),
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  ts: timestamp("ts", { withTimezone: true }).defaultNow(),
  userId: text("user_id").default("u1"),
  goalId: text("goal_id"),
  taskId: text("task_id"),
  runId: text("run_id"),
  connectorId: text("connector_id"),
  toolId: text("tool_id"),
  action: text("action").notNull(),
  riskLevel: text("risk_level"),
  authorization: text("authorization"), // allowed|auto|approval_required|approved|denied|blocked
  approvalId: text("approval_id"),
  inputSummary: text("input_summary"),
  resultSummary: text("result_summary"),
  status: text("status").default("ok"),        // ok | failed | waiting
  error: text("error"),
  durationMs: integer("duration_ms"),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  kind: text("kind"),
  title: text("title").notNull(),
  body: text("body"),
  read: boolean("read").default(false),
  link: text("link"),
  createdAt: now(),
});

/* ── Domain data (simulated in demo mode) ─────────────────── */

export const expenseTransactions = pgTable("expense_transactions", {
  id: text("id").primaryKey(),
  ts: timestamp("ts", { withTimezone: true }).notNull(),
  amount: integer("amount").notNull(),           // INR
  category: text("category").notNull(),          // Food|Travel|Shopping|Education|Subscriptions|Bills|Other
  merchant: text("merchant"),
  note: text("note"),
});

export const expenseReports = pgTable("expense_reports", {
  id: text("id").primaryKey(),
  month: text("month").notNull(),                // "2026-09"
  total: integer("total"),
  breakdown: jsonb("breakdown").$type<Record<string, number>>(),
  insights: jsonb("insights").$type<string[]>().default([]),
  generatedAt: now(),
});

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind"),
  source: text("source"),
  summary: text("summary"),
  extracted: jsonb("extracted"),
  createdAt: now(),
});

export const calendarEvents = pgTable("calendar_events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  calendar: text("calendar").default("Personal"),
  source: text("source").default("Google"),
  status: text("status").default("confirmed"),   // confirmed | cancelled
});

export const emailItems = pgTable("email_items", {
  id: text("id").primaryKey(),
  from: text("from"),
  subject: text("subject").notNull(),
  snippet: text("snippet"),
  ts: timestamp("ts", { withTimezone: true }).defaultNow(),
  classification: text("classification").default("routine"), // critical|important|routine|promotional|noise
  read: boolean("read").default(false),
  deadline: text("deadline"),
});

export const jobResults = pgTable("job_results", {
  id: text("id").primaryKey(),
  company: text("company"),
  role: text("role"),
  location: text("location"),
  requirements: text("requirements"),
  source: text("source"),
  link: text("link"),
  match: text("match"),                           // match explanation
  points: integer("points"),                      // Stride points if opportunity
  date: text("date"),
  deadline: text("deadline"),
  createdAt: now(),
});

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  role: text("role").notNull(),                   // user | assistant
  content: jsonb("content").notNull(),            // { text, blocks[] }
  runId: text("run_id"),
  createdAt: now(),
});
