# ORBIT AI — System Architecture

> Tagline: **Give it a goal. Stay in control.**
> An operating system for your digital life: personal assistant + task manager + constrained AI agent + connector hub + automation platform + audit center.

---

## 1. System Architecture

```
                ┌────────────────────────────────────────────────────────────┐
                │                     ORBIT WEB APP (Next.js 16)             │
                │  Command Center · Goals · Tasks · Calendar · Expenses      │
                │  Connectors · Skills · MCP · Plugins · Approvals · Audit   │
                └───────────────▲────────────────────────────▲───────────────┘
                                │ Server Components (read)   │ API routes (write)
                                │ /api/chat /api/act /api/approvals /api/mutate
                ┌───────────────┴────────────────────────────┴───────────────┐
                │                    AGENT ORCHESTRATOR                       │
                │                                                             │
                │  Goal Interpreter → Planner → Tool Selector                │
                │        ↓ structured JSON (validated)                        │
                │  ┌─────────────┐   ┌──────────────┐   ┌────────────────   │
                │  │ POLICY      │ → │ APPROVAL     │ → │ EXECUTOR       │   │
                │  │ ENGINE      │   │ MANAGER      │   │ (registered    │   │
                │  │ ALLOW/ASK/  │   │ (user in UI) │   │  tools only)   │   │
                │  │ BLOCK       │   │              │   │                │   │
                │  └─────────────┘   └──────────────┘   └───────┬────────┘   │
                │                                               │            │
                │        ┌──────────────┐        ┌──────────────▼────────┐   │
                │        │ AI ROUTER    │        │ TOOL REGISTRY         │   │
                │        │ (OpenRouter  │        │ gmail.* calendar.*    │   │
                │        │  + fallback; │        │ drive.* classroom.*   │   │
                │        │  optional)   │        │ jobs.* payment.* …    │   │
                │        └──────────────┘        └───────────────────────┘   │
                │  VERIFIER → AUDITOR (every decision, execution, result)    │
                └───────────────┬───────────────────────────────┬────────────┘
                                │                               │
                     ┌──────────▼──────────┐         ┌──────────▼──────────┐
                     │   PostgreSQL (RLS-  │         │  CONNECTOR LAYER    │
                     │   ready schema)     │         │  Demo/sandbox mode  │
                     └─────────────────────┘         │  (clearly labeled)  │
                                                     └─────────────────────┘
```

### Agent Loop (constrained)

`OBSERVE → PLAN → VALIDATE → ASK / EXECUTE → VERIFY → LOG → CONTINUE`

The model may **suggest**. The **policy engine** decides what is permitted.
The **executor** performs only registered tools. The **auditor** records everything.
No code path exists in which a model response reaches a connector directly.

### AI Layer (OpenRouter)

- Optional. Enabled only when `OPENROUTER_API_KEY` is present.
- Responsible for: model routing, fallbacks, structured JSON outputs (intent, plan,
  task decomposition, tool selection, risk hints).
- Every structured output is validated against schemas in `src/lib/ai.ts` before the
  planner uses it. On any failure/timeout, the deterministic local planner (which is
  itself schema-conformant) is used. **No single model is hardcoded** — primary and
  fallback models are env-configured (`OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODEL`).
- The AI layer is advisory: it produces `ToolRequest[]`; each one still passes through
  the policy engine. It can never bypass it.

---

## 2. Connector Architecture

```
Connector (entity)          = an integration account (Gmail, Calendar, Drive, …)
├── status      connected | available | needs_attention | unavailable
├── authType    oauth2 | api_key | local_agent | sandbox
├── scopes[]    minimum scopes requested, listed & revocable
├── capabilities[]  human-readable powers granted
└── tools[]     registered tools that may use this connector
```

Rules:
- Users explicitly connect each account; OAuth 2.0 with minimum scopes (in this build:
  sandbox/demo connectors, clearly badged **DEMO MODE**).
- Passwords are never stored. Tokens would be encrypted at rest (RLS-ready schema).
- If a platform restricts an operation, the connector shows
  `Capability unavailable for this account/API` — never faked (e.g., consumer WhatsApp
  shows *unavailable in this environment*; LinkedIn is *limited, official API only*).
- Every connector exposes health: connected / expired / needs re-auth / limited /
  unavailable, plus a **Test connection** action that writes an audit event.

Priority connectors: Gmail, Calendar, Drive, Classroom, YouTube, Tasks.
Marketplace also lists: GitHub, Slack, Notion, Trello, LinkedIn, WhatsApp,
Weather, News, Jobs, Payments (sandbox PSP), Local Files (Desktop Agent).

### Orbit Desktop Agent (local Windows companion)
A separate, optional, authenticated local service exposing **allowlisted** tools only:
`filesystem.scan | search | archive | delete` with path restrictions, risk levels,
approval for all destructive ops, and audit. Arbitrary shell/PowerShell execution is
never granted to the LLM.

---

## 3. Tool Model

Central registry table `tools`. **No tool may execute outside this registry.**

| Field | Notes |
|---|---|
| `tool_id` | e.g. `gmail.send` |
| `name`, `description` | human + model readable |
| `connector_id` | owning connector (FK) |
| `input_schema`, `output_schema` | JSON |
| `risk_level` | low | medium | high | critical |
| `requires_approval` | default from risk |
| `enabled` | master kill-switch |
| `allowed_roles` | role gating |

Risk semantics:
- **LOW** (read-only: search, read calendar/email, search jobs) → may auto-run.
- **MEDIUM** (reversible write: create draft, create task, create calendar event) → configurable.
- **HIGH** (external side effect: send email, cancel event, post) → approval.
- **CRITICAL** (financial / destructive: send money, delete files, submit official) → approval + final confirmation (+ re-auth where supported).
- **Unknown tool → BLOCK**, always.

---

## 4. Policy Model (the security layer)

Every action:
`AGENT → TOOL REQUEST → POLICY ENGINE → RISK EVALUATION → PERMISSION → APPROVAL (if needed) → EXECUTE → VERIFY RESULT → AUDIT LOG`

`tool_permissions` gives a per-tool decision: **ALLOW | ASK | BLOCK** (overrides model suggestions).
Default mapping when no explicit row exists: low→allow, medium→allow (configurable), high→ask, critical→ask+confirm.
Global safety switch in Security Center: *Require approval for all actions* and *Reset permissions*.
Policy statements (e.g. "Always ask before sending email", "Never allow filesystem deletion") are edited there and take effect immediately.

---

## 5. Goal / Task Model

`goals`: title, description, status, deadline, target/current value + unit, AI reasoning,
next recommended action, sources. `goal_milestones`: ordered, status-tracked.
`tasks`: title, description, goal link, priority, deadline, status
(`inbox | planned | in_progress | waiting | blocked | completed | cancelled`), source,
created_by (user|agent), approval_required, points.

Intelligent decomposition: a large goal never becomes one task. The planner extracts
objective, constraints, deadline, resources, dependencies, required tools, milestones —
and the user approves the proposed plan before persistent automation begins.
Long-term intelligence: UNDERSTAND → CLARIFY → PLAN → MILESTONES → TASKS → DEPENDENCIES → TOOLS → EXECUTION → MONITOR → REPLAN.

---

## 6. Approval Model

`approvals` rows carry: tool, connector, human action name, **why (reason)**,
**exact params**, **potential effect**, risk level, status (`pending | approved | denied`), decision time.
The Approval Center shows action, target, parameters, why, risk, expected result, and offers
**Approve / Edit / Deny**. Financial & destructive actions require a second confirmation
step (and step-up re-authentication where a provider supports it). Money is never moved
automatically.

---

## 7. Audit Model

`audit_events` — append-only from the normal UI (no delete/edit endpoints exist).
Fields: timestamp, user, goal, task, agent run, connector, tool, action, risk level,
authorization (allowed / approval_required / approved / denied / blocked / auto),
approval id, input summary, result summary, status, error, duration.
Secrets are redacted before write (`redact()` in `audit.ts`).

`agent_runs` + intent + model give full run-level traceability.

---

## 8. Database Schema (PostgreSQL via Drizzle)

profiles · connectors · tools · tool_permissions · skills · plugins · mcp_servers ·
mcp_tools · goals · goal_milestones · tasks · automations · approvals · agent_runs ·
audit_events · notifications · expense_transactions · expense_reports · documents ·
calendar_events · email_items · job_results · chat_messages · memory_entries

Definitions live in `src/db/schema.ts`. Row-level-security-ready (single-tenant user id
`u1` column on every user-scoped row; `RLS` policies to be enabled at deploy with a real
auth provider).

## 9. Implementation Plan (order actually used)

1. Design system (`globals.css`, `ui.tsx`, sidebar, layout) — dark premium, #0B0B1E.
2. Schema + seed (demo connectors, tools, policies, Stride scenario data).
3. Core vertical slice: chat → intent → plan → **policy** → **approval** → execute → **audit**.
4. Goals & Tasks screens (server-rendered, policy-checked mutations).
5. Calendar, Expenses (computed from real stored transactions), Job search.
6. Connector marketplace, Skills, MCP hub, Plugins, Automations.
7. Approval Center, Audit ledger, Activity, Security Center, Profile/Memory.
8. Polish: empty states, risk styling, demo-mode labels, mobile nav.

### Demo Mode (hackathon scenario)

The sandbox runs **DEMO MODE** with simulated connectors (labeled on every screen).
Main scenario: *"I have 100 Stride points to complete… read this document and help me
finish it."* → document read (audited) → Goal **Stride 2026** (40/100, 126 days) →
milestones (Academic / Technical / Extracurricular) → tasks (Hackathon +10, Workshop +5,
Event +10) → opportunity search → registration task + calendar check → **approval** for
the calendar event → verified result → full audit trail → "What's important today?" briefing.

### Deployment

Web: any Next.js host (Netlify/Vercel) · DB: PostgreSQL/Supabase (RLS on) ·
AI: OpenRouter (optional) · Android: same codebase via Capacitor (see
`capacitor.config.ts`); mobile layout ships in the web app with bottom-tab navigation.
