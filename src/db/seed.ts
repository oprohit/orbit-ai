/* ORBIT AI demo seed — idempotent (wipes & rebuilds the demo workspace). Run: npx tsx src/db/seed.ts */
import { db } from "./index";
import * as s from "./schema";

const at = (days: number, h = 9, m = 0) => {
  const t = new Date();
  t.setDate(t.getDate() + days);
  t.setHours(h, m, 0, 0);
  return t;
};
const ago = (days: number, h = 9, m = 0) => at(-days, h, m);
const nextFriday = () => {
  const t = new Date();
  const add = (5 - t.getDay() + 7) % 7 || 7;
  t.setDate(t.getDate() + add);
  t.setHours(23, 59, 0, 0);
  return t;
};
const dLabel = (d: Date) =>
  `${d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;

async function wipe() {
  const tables = [
    s.mcpTools, s.taskDependencies, s.toolPermissions, s.goalMilestones, s.tasks,
    s.approvals, s.auditEvents, s.agentRuns, s.chatMessages, s.notifications,
    s.jobResults, s.emailItems, s.calendarEvents, s.documents, s.expenseReports,
    s.expenseTransactions, s.memoryEntries, s.skills, s.plugins, s.mcpServers,
    s.automations, s.goals, s.tools, s.connectors, s.profiles,
  ];
  for (const t of tables) await db.delete(t);
}

async function main() {
  await wipe();
  const now = new Date();

  /* ── profile & memory ── */
  await db.insert(s.profiles).values({
    id: "u1", name: "Aarav", email: "aarav.student@example.edu", timezone: "Asia/Colombo",
    flags: { requireApprovalForAll: false, language: "English" },
  });
  await db.insert(s.memoryEntries).values([
    { id: "mem-1", key: "preferred_language", value: "English (casational tone, concise)", kind: "preference" },
    { id: "mem-2", key: "study_hours", value: "Free study blocks: 5:00–7:00 PM weekdays", kind: "schedule" },
    { id: "mem-3", key: "college", value: "COET, Coimbatore — B.E. CSE, 3rd year", kind: "preference" },
    { id: "mem-4", key: "travel_buffer", value: "Keep a 15-minute travel buffer before events", kind: "preference" },
    { id: "mem-5", key: "email_rules", value: "IMPORTANT: college, placement, exam, deadline, scholarship · LOW: marketing, promotions, newsletters", kind: "preference" },
  ]);

  /* ── connectors ── */
  const conns = [
    { id: "gmail", name: "Gmail", provider: "Google", category: "Communication", status: "connected", authType: "sandbox", scopes: ["gmail.readonly", "gmail.send"], capabilities: ["Read messages", "Search", "Classify", "Draft", "Send", "Label"], description: "Read, classify, summarize and triage your inbox. Sending always asks first.", freeTier: "Demo sandbox — no production calls", rateLimit: "250 req/min (demo)", docsUrl: "https://developers.google.com/gmail/api", notes: "Demo connector: simulated mailbox seeded with 9 messages.", lastSync: now, connectedAt: ago(21) },
    { id: "calendar", name: "Google Calendar", provider: "Google", category: "Planning", status: "connected", authType: "sandbox", scopes: ["calendar.events"], capabilities: ["Read events", "Check availability", "Create events", "Update", "Cancel events"], description: "Conflict checks, scheduling and cancellation. Creation & cancellation require approval.", freeTier: "Demo sandbox", rateLimit: "500 req/min (demo)", docsUrl: "https://developers.google.com/calendar/api", notes: "Demo connector: simulated calendar synced hourly.", lastSync: now, connectedAt: ago(21) },
    { id: "drive", name: "Google Drive", provider: "Google", category: "Files", status: "connected", authType: "sandbox", scopes: ["drive.readonly"], capabilities: ["Search files", "Read permitted files"], description: "Search and read files inside your authorized scope only.", freeTier: "Demo sandbox", rateLimit: "12k ops/day (demo)", docsUrl: "https://developers.google.com/drive/api", notes: "Read-only scope. Write actions are not granted.", lastSync: ago(0, 7), connectedAt: ago(20) },
    { id: "classroom", name: "Google Classroom", provider: "Google", category: "Education", status: "connected", authType: "sandbox", scopes: ["classroom.ro"], capabilities: ["Read courses", "Announcements", "Assignments & deadlines"], description: "Pulls assignments and converts them into tasks.", freeTier: "Demo sandbox", rateLimit: "60 req/min (demo)", docsUrl: "https://developers.google.com/classroom", notes: "Demo connector: seeded with 1 pending assignment.", lastSync: ago(0, 6), connectedAt: ago(14) },
    { id: "youtube", name: "YouTube", provider: "Google", category: "Media", status: "available", authType: "oauth2", scopes: ["yt.readonly"], capabilities: ["Search videos", "Channels", "Subscriptions", "Playlists (authorized)"], description: "Find tutorials and explanations with context on why they're useful.", freeTier: "10k units/day free tier", rateLimit: "10,000 units/day", docsUrl: "https://developers.google.com/youtube/v3", notes: "", lastSync: null, connectedAt: null },
    { id: "github", name: "GitHub", provider: "GitHub", category: "Developer", status: "available", authType: "oauth2", scopes: ["repo:read", "issues:read"], capabilities: ["Repos", "Issues", "Pull requests"], description: "Read repos and track issues/PRs.", freeTier: "Free (OAuth app)", rateLimit: "5k req/hr", docsUrl: "https://docs.github.com/en/rest", notes: "", lastSync: null, connectedAt: null },
    { id: "slack", name: "Slack", provider: "Slack", category: "Communication", status: "available", authType: "oauth2", scopes: ["channels:history", "chat:write"], capabilities: ["Read channel history", "Post (approval)"], description: "Summarize channels; posting always requires approval.", freeTier: "Free workspace apps", rateLimit: "1 req/s (demo)", docsUrl: "https://api.slack.com", notes: "", lastSync: null, connectedAt: null },
    { id: "notion", name: "Notion", provider: "Notion", category: "Productivity", status: "available", authType: "oauth2", scopes: ["read-only"], capabilities: ["Pages", "Databases"], description: "Sync notes and databases.", freeTier: "Free tier", rateLimit: "3 rps", docsUrl: "https://developers.notion.com", notes: "", lastSync: null, connectedAt: null },
    { id: "trello", name: "Trello", provider: "Atlassian", category: "Productivity", status: "available", authType: "oauth2", scopes: ["read:boards"], capabilities: ["Boards", "Cards", "Checklists"], description: "Mirror Trello boards into tasks.", freeTier: "Free tier", rateLimit: "300 req/5min", docsUrl: "https://developer.atlassian.com/cloud/trello", notes: "", lastSync: null, connectedAt: null },
    { id: "linkedin", name: "LinkedIn", provider: "LinkedIn", category: "Social", status: "needs_attention", authType: "oauth2", scopes: ["w_member_basic"], capabilities: ["Profile (limited)"], description: "Official API only. Many actions are not granted to this account.", freeTier: "Limited (community management API)", rateLimit: "Varies by endpoint", docsUrl: "https://learn.microsoft.com/linkedin", notes: "Capability unavailable for this account/API — only profile read is granted. No scraping, ever.", lastSync: ago(3), connectedAt: ago(30) },
    { id: "whatsapp", name: "WhatsApp", provider: "Meta", category: "Communication", status: "unavailable", authType: "oauth2", scopes: [], capabilities: [], description: "Consumer WhatsApp connector unavailable in this environment.", freeTier: "n/a", rateLimit: "n/a", docsUrl: "https://developers.facebook.com/docs/whatsapp", notes: "Only the official WhatsApp Business API is supported — consumer (QR/Web) automation is refused by design.", lastSync: null, connectedAt: null },
    { id: "weather", name: "Weather", provider: "Open-Meteo", category: "Info", status: "connected", authType: "api_key", scopes: [], capabilities: ["Current conditions", "Forecast"], description: "Key-free public weather API.", freeTier: "Free, non-commercial", rateLimit: "10k req/day", docsUrl: "https://open-meteo.com", notes: "", lastSync: now, connectedAt: ago(10) },
    { id: "news", name: "News", provider: "NewsData", category: "Info", status: "connected", authType: "api_key", scopes: [], capabilities: ["Headlines", "Search"], description: "Headlines for briefings.", freeTier: "100 credits/day free", rateLimit: "100 credits/day", docsUrl: "https://newsdata.io", notes: "", lastSync: ago(0, 8), connectedAt: ago(10) },
    { id: "jobs", name: "Jobs", provider: "Public job boards", category: "Career", status: "connected", authType: "api_key", scopes: [], capabilities: ["Search listings", "Normalize results"], description: "Official/public job sources only — no scraping.", freeTier: "Free public listings", rateLimit: "Polite crawl, 60 req/h", docsUrl: "https://github.com/public-apis", notes: "", lastSync: ago(1), connectedAt: ago(9) },
    { id: "payments", name: "Payments (Sandbox)", provider: "Sandbox PSP", category: "Finance", status: "connected", authType: "sandbox", scopes: ["payments.sandbox"], capabilities: ["Prepare transaction", "Execute (approval + confirm)"], description: "Sandbox UPI/PSP. No real money ever moves in demo mode.", freeTier: "Sandbox — unlimited fake funds", rateLimit: "10 req/min", docsUrl: "https://developer.razorpay.com", notes: "Merchant/UPI sandbox. Never a personal P2P banking API. Banking credentials are never stored.", lastSync: ago(2), connectedAt: ago(15) },
    { id: "localfiles", name: "Local Files (Desktop Agent)", provider: "Orbit Desktop Agent", category: "System", status: "available", authType: "local_agent", scopes: ["allowlisted local tools"], capabilities: ["Scan", "Search", "Archive", "Delete (approval)"], description: "Optional local companion. Allowlisted tools, path restrictions, approvals for destructive actions. No shell access.", freeTier: "Local — no cost", rateLimit: "Local", docsUrl: "internal", notes: "Runs on your machine; the web app authenticates to it. Deletion is always CRITICAL + approval.", lastSync: null, connectedAt: null },
  ];
  await db.insert(s.connectors).values(conns);

  /* ── tool registry ── */
  const tools: [string, string, string | null, string, string, boolean][] = [
    ["gmail.read", "Gmail · Read", "gmail", "Read a message by id", "low", false],
    ["gmail.search", "Gmail · Search", "gmail", "Search inbox with queries/labels", "low", false],
    ["gmail.classify", "Gmail · Classify", "gmail", "AI triage: critical/important/routine/promotional/noise", "low", false],
    ["gmail.draft", "Gmail · Draft", "gmail", "Prepare a draft (not sent)", "medium", false],
    ["gmail.send", "Gmail · Send", "gmail", "Send a message to a recipient", "high", true],
    ["gmail.label", "Gmail · Label", "gmail", "Apply labels", "medium", false],
    ["gmail.delete", "Gmail · Delete", "gmail", "Delete messages (destructive)", "high", true],
    ["calendar.read", "Calendar · Read", "calendar", "List events", "low", false],
    ["calendar.availability", "Calendar · Availability", "calendar", "Find free slots with buffer", "low", false],
    ["calendar.create", "Calendar · Create", "calendar", "Create an event (external commitment)", "medium", true],
    ["calendar.update", "Calendar · Update", "calendar", "Modify an event", "high", true],
    ["calendar.delete", "Calendar · Cancel", "calendar", "Cancel/delete an event", "high", true],
    ["drive.search", "Drive · Search", "drive", "Search files in authorized scope", "low", false],
    ["drive.read", "Drive · Read", "drive", "Read a permitted file", "low", false],
    ["classroom.courses", "Classroom · Courses", "classroom", "List courses", "low", false],
    ["classroom.announcements", "Classroom · Announcements", "classroom", "Read announcements", "low", false],
    ["classroom.assignments", "Classroom · Assignments", "classroom", "Read assignments & deadlines", "low", false],
    ["youtube.search", "YouTube · Search", "youtube", "Search videos", "low", false],
    ["jobs.search", "Jobs · Search", "jobs", "Search approved job sources", "low", false],
    ["weather.get", "Weather · Get", "weather", "Current conditions", "low", false],
    ["news.search", "News · Search", "news", "Headlines & search", "low", false],
    ["search.web", "Web · Search", null, "Registered web search provider", "low", false],
    ["document.read", "Documents · Read", "drive", "Parse & analyze uploaded documents", "low", false],
    ["task.create", "Tasks · Create", null, "Create a task (reversible, internal)", "medium", false],
    ["notification.create", "Notifications · Create", null, "Create a local notification", "low", false],
    ["filesystem.scan", "Files · Scan", "localfiles", "Desktop Agent: scan for junk (read-only)", "low", false],
    ["filesystem.archive", "Files · Archive", "localfiles", "Move files to archive", "high", true],
    ["filesystem.delete", "Files · Delete", "localfiles", "Delete files (destructive)", "critical", true],
    ["payment.prepare", "Payments · Prepare", "payments", "Prepare a sandbox transaction", "medium", false],
    ["payment.execute", "Payments · Execute", "payments", "Execute a payment (financial)", "critical", true],
  ];
  await db.insert(s.tools).values(tools.map(([id, name, connectorId, description, riskLevel, requiresApproval]) => ({
    id, name, connectorId, description, riskLevel, requiresApproval, enabled: true,
    inputSchema: { type: "object" }, outputSchema: { type: "object" },
  })));

  /* ── explicit policy rules (user-editable in Security Center) ── */
  const perms: [string, string][] = [
    ["gmail.send", "ask"], ["gmail.delete", "block"], ["gmail.draft", "allow"], ["gmail.label", "allow"],
    ["calendar.create", "ask"], ["calendar.update", "ask"], ["calendar.delete", "ask"],
    ["filesystem.delete", "ask"], ["filesystem.archive", "ask"],
    ["payment.execute", "ask"], ["payment.prepare", "allow"],
    ["task.create", "allow"], ["drive.read", "allow"],
  ];
  await db.insert(s.toolPermissions).values(perms.map(([toolId, level], i) => ({ id: `perm-${i}`, toolId, level })));

  /* ── goals ── */
  const strideDeadline = at(126, 23, 59);
  await db.insert(s.goals).values([
    {
      id: "goal-stride", title: "Stride 2026", description: "Complete 100 Stride points before the academic year ends.",
      status: "active", deadline: strideDeadline, targetValue: 100, currentValue: 40, unit: "points",
      aiReasoning: "Parsed Stride_Rules_2026.pdf — 100 points required; current record 40. 126 days remaining. Plan targets 30 committed points with slack.",
      nextAction: "Register for CodeSpark Hackathon before Friday",
      sources: ["Stride_Rules_2026.pdf", "Stride portal (demo)"], createdAt: ago(2), updatedAt: now,
    },
    {
      id: "goal-intern", title: "React Internship Applications", description: "Land a React internship this year.",
      status: "active", deadline: at(180, 23, 59), targetValue: 10, currentValue: 3, unit: "applications",
      aiReasoning: "Decomposed into resume → portfolio → search → apply → interview → follow-up. 3 applications already sent.",
      nextAction: "Review React internship at XYZ Labs",
      sources: ["User request"], createdAt: ago(12), updatedAt: ago(1),
    },
  ]);
  await db.insert(s.goalMilestones).values([
    { id: "ms-1", goalId: "goal-stride", title: "Academic", detail: "Workshops & certificates — 5+ points", seq: 0, status: "pending" },
    { id: "ms-2", goalId: "goal-stride", title: "Technical", detail: "Hackathons & tech events — 20+ points", seq: 1, status: "in_progress" },
    { id: "ms-3", goalId: "goal-stride", title: "Extracurricular", detail: "Volunteering & outreach — 15+ points", seq: 2, status: "pending" },
    { id: "ms-4", goalId: "goal-intern", title: "Resume", detail: "Tailored for React roles", seq: 0, status: "done" },
    { id: "ms-5", goalId: "goal-intern", title: "Find opportunities", detail: "10 target companies", seq: 1, status: "in_progress" },
    { id: "ms-6", goalId: "goal-intern", title: "Apply", detail: "10 applications out", seq: 2, status: "in_progress" },
    { id: "ms-7", goalId: "goal-intern", title: "Interview prep", detail: "DS + system design basics", seq: 3, status: "pending" },
    { id: "ms-8", goalId: "goal-intern", title: "Follow-ups", detail: "1-week cadence", seq: 4, status: "pending" },
  ]);

  /* ── tasks ── */
  const tasks = [
    { id: "task-1", title: "Data Structures Assignment 4", description: "Problem set on AVL trees & hashing", goalId: null, priority: "urgent", deadline: at(1, 23, 59), status: "in_progress", source: "Classroom", createdBy: "agent", points: null },
    { id: "task-2", title: "Fill Teacher Feedback Form", description: "Source: Gmail → Kalaivana — “All students must complete the Teacher Feedback Form by Friday.”", goalId: null, priority: "high", deadline: nextFriday(), status: "planned", source: "Gmail → Kalaivana", createdBy: "agent", points: null },
    { id: "task-3", title: "Register for TCS NQT placement", description: "Placement cell circular — registration closes Friday", goalId: null, priority: "high", deadline: nextFriday(), status: "inbox", source: "Gmail → Placement Cell", createdBy: "agent", points: null },
    { id: "task-4", title: "Update resume for React roles", description: "Milestone: Resume", goalId: "goal-intern", priority: "high", deadline: at(1, 18), status: "completed", source: "Agent", createdBy: "agent", points: null },
    { id: "task-5", title: "Apply to 3 positions", description: "Milestone: Apply — 10 target applications", goalId: "goal-intern", priority: "high", deadline: at(5, 10), status: "waiting", source: "Agent", createdBy: "agent", points: null },
    { id: "task-6", title: "Practice DSA — 2 problems", description: "Daily study block, 5:00–6:00 PM", goalId: null, priority: "medium", deadline: at(0, 18), status: "planned", source: "Agent", createdBy: "agent", points: null },
  ];
  await db.insert(s.tasks).values(tasks);
  await db.insert(s.taskDependencies).values([{ id: "dep-1", taskId: "task-5", dependsOnId: "task-4" }]);

  /* ── automations (all require opt-in) ── */
  await db.insert(s.automations).values([
    { id: "auto-1", name: "Morning email triage", trigger: "Schedule", schedule: "Daily · 08:30", tools: ["gmail.search", "gmail.classify"], actions: "Classify overnight mail; surface critical + important only", enabled: true, lastRun: ago(0, 8, 30), nextRun: at(1, 8, 30) },
    { id: "auto-2", name: "Evening calendar check", trigger: "Schedule", schedule: "Daily · 20:00", tools: ["calendar.read", "calendar.availability"], actions: "Preview tomorrow; flag conflicts", enabled: true, lastRun: ago(1, 20), nextRun: at(0, 20) },
    { id: "auto-3", name: "Sunday expense report", trigger: "Schedule", schedule: "Sundays · 21:00", tools: ["expense.query"], actions: "Generate monthly report from stored transactions", enabled: true, lastRun: ago(3, 21), nextRun: at(5, 21) },
    { id: "auto-4", name: "Monday internship search", trigger: "Schedule", schedule: "Mondays · 09:00", tools: ["jobs.search"], actions: "Search React internships; notify on new matches", enabled: false, lastRun: null, nextRun: null },
    { id: "auto-5", name: "Urgent approval ping", trigger: "Event", schedule: "Hourly", tools: ["approval.check"], actions: "Notify when a CRITICAL approval is pending", enabled: false, lastRun: null, nextRun: null },
  ]);

  /* ── skills ── */
  await db.insert(s.skills).values([
    { id: "skill-1", name: "Email Triage", description: "Classify, summarize and prioritize the inbox; extract tasks and deadlines. Learnable from your corrections.", tools: ["gmail.search", "gmail.read", "gmail.classify", "task.create"], triggers: ["“What's in my inbox?”", "Morning automation"], status: "enabled", recommended: true, lastRun: ago(0, 8, 30) },
    { id: "skill-2", name: "Calendar Assistant", description: "Conflict checks, availability with travel buffer, scheduling and cancellation — approvals before commitments.", tools: ["calendar.read", "calendar.availability", "calendar.create", "calendar.delete"], triggers: ["“I have an event tomorrow at 4”"], status: "enabled", recommended: true, lastRun: ago(1) },
    { id: "skill-3", name: "Job Search", description: "Searches official/public job sources, normalizes and ranks with a match explanation. No scraping.", tools: ["jobs.search", "search.web", "task.create"], triggers: ["“Find internships for React in Coimbatore”"], status: "enabled", recommended: true, lastRun: ago(1) },
    { id: "skill-4", name: "Expense Analyst", description: "Categorizes spending and generates monthly reports computed from real stored transactions.", tools: ["expense.query"], triggers: ["“How much did I spend?”", "Sunday automation"], status: "enabled", recommended: true, lastRun: ago(3, 21) },
    { id: "skill-5", name: "Study Planner", description: "Turns syllabi and deadlines into daily study blocks, revision cycles and quizzes.", tools: ["classroom.assignments", "task.create", "calendar.availability"], triggers: ["“Help me prepare for my exam”"], status: "enabled", recommended: false, lastRun: null },
    { id: "skill-6", name: "Document Analyzer", description: "Reads uploaded PDFs/DOCX, extracts requirements, rules and deadlines, then proposes goals and tasks.", tools: ["document.read", "task.create"], triggers: ["“Read this college document”"], status: "enabled", recommended: true, lastRun: ago(2) },
    { id: "skill-7", name: "Drive Assistant", description: "Searches your authorized Drive scope and summarizes permitted files.", tools: ["drive.search", "drive.read"], triggers: ["“Find my project report”"], status: "enabled", recommended: false, lastRun: ago(4) },
    { id: "skill-8", name: "Research Assistant", description: "Registered web search with citations; can file findings as tasks.", tools: ["search.web", "news.search", "task.create"], triggers: ["“Research X”"], status: "disabled", recommended: false, lastRun: null },
  ]);

  /* ── plugins ─ */
  await db.insert(s.plugins).values([
    { id: "plugin-1", name: "Orbit Desktop Agent", version: "0.9.2", description: "Optional local companion for Windows. Allowlisted tools only — scan, search, archive, delete (approval). No shell, no unrestricted access.", capabilities: ["Filesystem scan", "Junk detection", "Approved cleanup"], tools: ["filesystem.scan", "filesystem.archive", "filesystem.delete"], permissions: ["Path restrictions", "Sandboxing", "Approval for destructive ops"], risk: "high", status: "enabled", services: ["Local Files"] },
    { id: "plugin-2", name: "Expense Importer", version: "1.2.0", description: "Imports UPI/bank statements (CSV) into the expense ledger through the approved financial connector.", capabilities: ["CSV parse", "Auto-categorization"], tools: ["expense.query"], permissions: ["Read statements (approval)"], risk: "low", status: "enabled", services: ["Payments (Sandbox)"] },
    { id: "plugin-3", name: "Public API Catalog", version: "0.4.1", description: "Discovery catalog derived from public-apis/public-apis. Candidates are verified (auth, free tier, rate limits, HTTPS) before any becomes a connector.", capabilities: ["Discovery", "Compliance notes"], tools: [], permissions: ["Read-only catalog"], risk: "low", status: "enabled", services: [] },
    { id: "plugin-4", name: "Notification Bridge", version: "1.0.3", description: "Routes agent events (approvals, deadlines, matches) to desktop + Android notifications.", capabilities: ["Push routing", "Digest mode"], tools: ["notification.create"], permissions: ["Local notifications"], risk: "low", status: "enabled", services: [] },
  ]);

  /* ── MCP ── */
  await db.insert(s.mcpServers).values([
    { id: "mcp-1", name: "Google MCP", description: "Official MCP server wrapping Gmail & Calendar. Every tool still passes through the Orbit policy engine.", status: "connected", permissionLevel: "Mixed (READ allow, SEND ask)", health: "healthy", lastUsed: ago(0, 8, 30) },
    { id: "mcp-2", name: "Filesystem MCP", description: "Local file operations via the Desktop Agent allowlist. Destructive ops are CRITICAL.", status: "connected", permissionLevel: "READ allow, WRITE ask, DELETE ask+confirm", health: "healthy", lastUsed: ago(1) },
    { id: "mcp-3", name: "GitHub MCP", description: "Repo, issue and PR tools for the GitHub connector.", status: "disconnected", permissionLevel: "READ allow", health: "—", lastUsed: null },
    { id: "mcp-4", name: "Chrome DevTools MCP", description: "Browser automation primitives (navigate, screenshot, query). Not enabled by default.", status: "degraded", permissionLevel: "ASK for all", health: "unstable", lastUsed: ago(9) },
  ]);
  await db.insert(s.mcpTools).values([
    { id: "mcp-t1", serverId: "mcp-1", name: "gmail.search", description: "Search messages", riskLevel: "low", permission: "allow" },
    { id: "mcp-t2", serverId: "mcp-1", name: "gmail.read", description: "Read a message", riskLevel: "low", permission: "allow" },
    { id: "mcp-t3", serverId: "mcp-1", name: "gmail.draft", description: "Prepare a draft", riskLevel: "medium", permission: "allow" },
    { id: "mcp-t4", serverId: "mcp-1", name: "gmail.send", description: "Send a message", riskLevel: "high", permission: "ask" },
    { id: "mcp-t5", serverId: "mcp-1", name: "calendar.list", description: "List events", riskLevel: "low", permission: "allow" },
    { id: "mcp-t6", serverId: "mcp-1", name: "calendar.create", description: "Create an event", riskLevel: "medium", permission: "ask" },
    { id: "mcp-t7", serverId: "mcp-2", name: "fs.scan", description: "Scan for junk (read-only)", riskLevel: "low", permission: "allow" },
    { id: "mcp-t8", serverId: "mcp-2", name: "fs.search", description: "Search files", riskLevel: "low", permission: "allow" },
    { id: "mcp-t9", serverId: "mcp-2", name: "fs.archive", description: "Move to archive", riskLevel: "high", permission: "ask" },
    { id: "mcp-t10", serverId: "mcp-2", name: "fs.delete", description: "Delete files", riskLevel: "critical", permission: "ask" },
    { id: "mcp-t11", serverId: "mcp-3", name: "repo.list", description: "List repositories", riskLevel: "low", permission: "allow" },
    { id: "mcp-t12", serverId: "mcp-3", name: "issue.list", description: "List issues", riskLevel: "low", permission: "allow" },
    { id: "mcp-t13", serverId: "mcp-4", name: "page.navigate", description: "Navigate the browser", riskLevel: "medium", permission: "ask" },
    { id: "mcp-t14", serverId: "mcp-4", name: "page.screenshot", description: "Capture the page", riskLevel: "low", permission: "ask" },
  ]);

  /* ── domain data ── */
  await db.insert(s.documents).values([
    {
      id: "stride-2026", name: "Stride_Rules_2026.pdf", kind: "PDF · 1.2 MB", source: "Uploaded",
      summary: "College Stride 2026 requirements document",
      extracted: {
        required_points: 100, current_points: 40, deadline: dLabel(strideDeadline),
        categories: ["Academic", "Technical", "Extracurricular"],
        activities: [["Hackathon participation", 10], ["Workshop completion", 5], ["Technical event", 10], ["Volunteer activity", 5], ["Internship / project exhibition", 15], ["Sports participation", 8]],
        rules: ["Points credited after verification by the coordinator", "Each activity counts once per year", "Deadlines: activities must complete before end of academic year"],
      },
      createdAt: ago(2),
    },
    { id: "project-report", name: "Final_Year_Project_Report_v3.docx", kind: "DOCX · 2.8 MB", source: "Drive / Projects", summary: "FYP report — real-time bus tracking", extracted: { sections: ["Problem: city bus arrivals are unpredictable; 40k daily commuters affected.", "Solution: GPS feed + last-mile crowd reports → live arrival predictions.", "Stack: React front end, Node API, Redis cache; MAPE 2.1 min on test week.", "Next: pilot with 12 buses, vendor hardware order pending."] }, createdAt: ago(6) },
    { id: "project-draft", name: "Project_Report_Draft.docx", kind: "DOCX · 1.9 MB", source: "Drive / Projects", summary: "Older draft of the FYP report", extracted: { sections: [] }, createdAt: ago(30) },
  ]);

  await db.insert(s.calendarEvents).values([
    { id: "cal-1", title: "Data Structures Class", startsAt: at(0, 9), endsAt: at(0, 10, 30), calendar: "Personal", source: "Google", status: "confirmed" },
    { id: "cal-2", title: "Placement Seminar — TCS NQT", startsAt: at(0, 14), endsAt: at(0, 15), calendar: "Personal", source: "Google", status: "confirmed" },
    { id: "cal-3", title: "DSA Class", startsAt: at(0, 16, 30), endsAt: at(0, 18), calendar: "Personal", source: "Google", status: "confirmed" },
    { id: "cal-4", title: "Operating Systems Lab", startsAt: at(1, 14), endsAt: at(1, 15, 45), calendar: "Personal", source: "Google", status: "confirmed" },
    { id: "cal-5", title: "Return DS textbook to library", startsAt: at(3, 11), endsAt: at(3, 11, 30), calendar: "Personal", source: "Google", status: "confirmed" },
  ]);

  await db.insert(s.emailItems).values([
    { id: "mail-1", from: "examcell@college.edu", subject: "Internal Assessment — DS: submission window open", snippet: "Internal Assessment – DS due Friday 11:59 PM. Late submissions not accepted.", ts: ago(0, 8, 12), classification: "critical", read: false, deadline: dLabel(at(1, 23, 59)) },
    { id: "mail-2", from: "kalaivana@college.edu", subject: "Teacher Feedback Form — complete by Friday", snippet: "All students must complete the Teacher Feedback Form by Friday.", ts: ago(0, 9, 40), classification: "critical", read: false, deadline: dLabel(nextFriday()) },
    { id: "mail-3", from: "placements@college.edu", subject: "TCS NQT registration closes Friday", snippet: "Final year students: register for TCS NQT by Friday 6 PM.", ts: ago(1, 10), classification: "important", read: false, deadline: dLabel(nextFriday()) },
    { id: "mail-4", from: "itdept@college.edu", subject: "Placement circular — IT department drive", snippet: "IT department hiring drive details attached. Eligibility: 7.0+ CGPA.", ts: ago(1, 15), classification: "important", read: true, deadline: null },
    { id: "mail-5", from: "admin@college.edu", subject: "College holiday — upcoming public holiday", snippet: "The institute will remain closed on the public holiday next week.", ts: ago(2, 9), classification: "important", read: true, deadline: null },
    { id: "mail-6", from: "scholarships@college.edu", subject: "National Scholarship Portal — applications open", snippet: "Submit NSP scholarship applications before the deadline.", ts: ago(2, 11), classification: "important", read: false, deadline: dLabel(at(9)) },
    { id: "mail-7", from: "society@college.edu", subject: "Student society meeting notice", snippet: "Monthly society meeting this week, open to all members.", ts: ago(3, 16), classification: "routine", read: true, deadline: null },
    { id: "mail-8", from: "news@campusdigest.io", subject: "Campus Digest Vol. 12", snippet: "Monthly newsletter: events recap, interviews, opinions.", ts: ago(3, 8), classification: "promotional", read: false, deadline: null },
    { id: "mail-9", from: "deals@shopmart.com", subject: "60% off — ends tonight!", snippet: "Flash sale on electronics and gadgets.", ts: ago(4, 20), classification: "noise", read: false, deadline: null },
  ]);

  await db.insert(s.jobResults).values([
    { id: "job-1", company: "XYZ Labs", role: "Frontend React Intern", location: "Coimbatore", requirements: "React, TypeScript, basic Node", source: "LinkedIn (official API)", link: "https://jobs.example/xyz", match: "92% — React + TS, on-site, 8k/mo", createdAt: ago(1) },
    { id: "job-2", company: "Finlytics", role: "React + TypeScript Intern", location: "Remote (India)", requirements: "React, testing, REST APIs", source: "Naukri (public listings)", link: "https://jobs.example/finlytics", match: "95% — strongest skill overlap, remote", createdAt: ago(1) },
    { id: "job-3", company: "CodeCraft", role: "Web Development Intern", location: "Coimbatore", requirements: "HTML/CSS/JS, React a plus", source: "Company careers page", link: "https://jobs.example/codecraft", match: "90% — junior-friendly, on-site", createdAt: ago(2) },
    { id: "job-4", company: "PixelWorks", role: "React Native Intern", location: "Chennai", requirements: "React Native, Expo", source: "LinkedIn (official API)", link: "https://jobs.example/pixel", match: "74% — mobile focus, requires travel", createdAt: ago(2) },
    { id: "job-5", company: "DataMinds", role: "Frontend Engineer (Intern)", location: "Remote (India)", requirements: "React, D3, data viz", source: "Wellfound (public)", link: "https://jobs.example/dataminds", match: "68% — data-viz centric", createdAt: ago(3) },
    { id: "job-6", company: "Innov8", role: "Full-stack Intern (MERN)", location: "Coimbatore", requirements: "MongoDB, Express, React, Node", source: "Naukri (public listings)", link: "https://jobs.example/innov8", match: "61% — broader stack than your profile", createdAt: ago(3) },
  ]);

  /* ── expenses: deterministic ledger for last ~2 months ── */
  let seedState = 1337;
  const rnd = () => {
    seedState = (seedState * 1103515245 + 12345) % 2147483648;
    return seedState / 2147483648;
  };
  const merchants: Record<string, string[]> = {
    Food: ["Swiggy", "Zomato", "College canteen", "Chai tapri", "Baker's lane"],
    Travel: ["Uber", "City bus pass", "Share auto", "Bike fuel"],
    Education: ["Book store", "College fees", "Online course"],
    Subscriptions: ["Netflix", "Spotify", "YouTube Premium"],
    Bills: ["Airtel recharge", "Jio Fiber", "Electricity"],
    Shopping: ["Amazon", "Flipkart", "Decathlon"],
    Other: ["Grocery", "Stationery", "Lab fees"],
  };
  const txns: { ts: Date; amount: number; category: string; merchant: string; note: string | null }[] = [];
  for (let i = 0; i < 66; i++) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const slot = i % 7;
    if (slot === 0 || slot === 1 || slot === 3) {
      day.setHours(12 + Math.floor(rnd() * 9), Math.floor(rnd() * 59));
      const c = slot === 0 ? "Food" : slot === 1 ? (rnd() > 0.5 ? "Food" : "Travel") : "Food";
      const amt = c === "Food" ? 60 + Math.floor(rnd() * 20) * 10 : 40 + Math.floor(rnd() * 26) * 10;
      txns.push({ ts: day, amount: amt, category: c, merchant: merchants[c][Math.floor(rnd() * merchants[c].length)], note: null });
    } else if (slot === 2) {
      day.setHours(19, Math.floor(rnd() * 59));
      const subs: [string, number][] = [["Netflix", 219], ["Spotify", 119], ["YouTube Premium", 149]];
      const [m, a] = subs[Math.floor(i / 7) % 3];
      txns.push({ ts: day, amount: a, category: "Subscriptions", merchant: m, note: "recurring" });
    } else if (slot === 4) {
      if (i % 21 === 4) {
        day.setHours(10, 15);
        txns.push({ ts: day, amount: 399 + Math.floor(rnd() * 4) * 100, category: "Bills", merchant: ["Airtel recharge", "Jio Fiber", "Electricity"][i % 3], note: null });
      }
      if (i % 13 === 4) {
        day.setHours(17, 30);
        txns.push({ ts: day, amount: 150 + Math.floor(rnd() * 8) * 50, category: "Shopping", merchant: ["Amazon", "Flipkart"][i % 2], note: null });
      }
    } else if (slot === 5) {
      day.setHours(11, 45);
      // Travel trend: last month lighter, this month heavier (drives the insight)
      const inCurrentMonth = i < 28;
      txns.push({ ts: day, amount: (inCurrentMonth ? 220 : 160) + Math.floor(rnd() * 6) * 25, category: "Travel", merchant: merchants.Travel[Math.floor(rnd() * 4)], note: inCurrentMonth ? "extra commute" : null });
    } else {
      day.setHours(15, 20);
      if (i % 26 === 5) txns.push({ ts: day, amount: 450 + Math.floor(rnd() * 3) * 150, category: "Education", merchant: "Book store", note: "DSA problem book" });
      if (i % 17 === 5) txns.push({ ts: day, amount: 90 + Math.floor(rnd() * 5) * 30, category: "Other", merchant: "Stationery", note: null });
    }
  }
  await db.insert(s.expenseTransactions).values(txns.map((t, i) => ({ id: `txn-${i}`, ...t })));

  // monthly report for the previous full month (computed from real seeded rows)
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59);
  const prevRows = txns.filter((t) => t.ts >= prevStart && t.ts <= prevEnd);
  const breakdown: Record<string, number> = {};
  prevRows.forEach((t) => { breakdown[t.category] = (breakdown[t.category] ?? 0) + t.amount; });
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const topCat = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];
  const monthName = prevStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  await db.insert(s.expenseReports).values({
    id: "report-prev", month: `${prevStart.getFullYear()}-${String(prevStart.getMonth() + 1).padStart(2, "0")}`,
    total, breakdown,
    insights: [
      `${topCat[0]} was the largest category at ₹${topCat[1].toLocaleString("en-IN")} (${Math.round((topCat[1] / total) * 100)}% of spend).`,
      `Subscriptions were ₹${(breakdown.Subscriptions ?? 0).toLocaleString("en-IN")} — ${Math.round(((breakdown.Subscriptions ?? 0) / total) * 100)}% of spending.`,
      `Average per day: ₹${Math.round(total / prevRows.length * 10) / 10} across ${prevRows.length} transactions.`,
    ],
    generatedAt: prevEnd,
  });
  void monthName;

  /* ── notifications ── */
  await db.insert(s.notifications).values([
    { id: "ntf-1", kind: "approval", title: "Approval required", body: "Create calendar event — College Event (tomorrow)", read: false, link: "/approvals", createdAt: ago(0, 10) },
    { id: "ntf-2", kind: "deadline", title: "Assignment due tomorrow", body: "Data Structures Assignment 4 — 11:59 PM", read: false, link: "/tasks", createdAt: ago(0, 9) },
    { id: "ntf-3", kind: "email", title: "2 important college emails", body: "Placement registration + scholarship deadline", read: false, link: "/", createdAt: ago(0, 8, 30) },
    { id: "ntf-4", kind: "goal", title: "Stride goal updated", body: "40/100 points — plan created from document", read: true, link: "/goals", createdAt: ago(1) },
    { id: "ntf-5", kind: "job", title: "New job match", body: "Finlytics — React + TypeScript Intern (95% match)", read: true, link: "/jobs", createdAt: ago(1) },
  ]);

  /* ── one historical (already-approved) approval + audit history ── */
  await db.insert(s.approvals).values({
    id: "appr-seed", toolId: "task.create", connectorId: null, action: "Create task",
    reason: "Extracted from Gmail → Kalaivana email", params: { title: "Fill Teacher Feedback Form" },
    effect: "A new task appears in your task list.", riskLevel: "medium", status: "approved", decidedAt: ago(1, 18), createdAt: ago(1, 17, 55),
  });

  const aud = (hAgo: number, action: string, e: Record<string, unknown> = {}) =>
    db.insert(s.auditEvents).values({ id: `aud-${hAgo}-${Math.floor(rnd() * 9999)}`, ts: ago(0, hAgo, Math.floor(rnd() * 50)), action, authorization: "allowed", status: "ok", ...e });
  await aud(26, "connector.sync — Gmail", { connectorId: "gmail", toolId: "gmail.search", resultSummary: "9 messages synced" });
  await aud(25, "gmail.classify", { toolId: "gmail.classify", connectorId: "gmail", resultSummary: "2 critical · 4 important · 1 routine · 1 promotional · 1 noise" });
  await aud(24, "task.created — Fill Teacher Feedback Form", { toolId: "task.create", authorization: "approval_required", resultSummary: "Extracted from email (Kalaivana)" });
  await aud(23, "USER APPROVED — Create task", { toolId: "task.create", authorization: "approved", approvalId: "appr-seed" });
  await aud(22, "connector.sync — Google Classroom", { connectorId: "classroom", toolId: "classroom.assignments", resultSummary: "1 assignment: DS Assignment 4" });
  await aud(21, "calendar.read", { toolId: "calendar.read", connectorId: "calendar", resultSummary: "5 upcoming events" });
  await aud(20, "jobs.search", { toolId: "jobs.search", connectorId: "jobs", resultSummary: "6 React internship matches normalized" });
  await aud(18, "expense.report generated", { resultSummary: "Monthly report computed from stored transactions" });

  /* ── opening chat message ── */
  await db.insert(s.chatMessages).values({
    id: "chat-welcome", role: "assistant", runId: null,
    content: {
      text: "I'm Orbit — give it a goal, stay in control. I plan, I use only your connected tools, I ask before anything risky, and I log every action. This is DEMO MODE: connectors are simulated so nothing real is touched.",
      blocks: [{
        type: "chips",
        chips: [
          { label: "What's important today?", send: "What's important today?" },
          { label: "Finish my Stride requirement", send: "I have 100 Stride points to complete before the academic year ends. Read this document and help me finish it." },
          { label: "Event tomorrow at 4 PM", send: "I need to attend the college event tomorrow at 4 PM." },
          { label: "React internships in Coimbatore", send: "Find internships for React development in Coimbatore." },
        ],
      }],
    },
  });

  console.log("ORBIT seed complete:", {
    connectors: conns.length, tools: tools.length, skills: 8, plugins: 4,
    mcp: 4, goals: 2, tasks: tasks.length, transactions: txns.length,
  });
  process.exit(0);
}

main().catch((e) => {
  console.error("SEED FAILED", e);
  process.exit(1);
});
