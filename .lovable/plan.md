
# AI Agent Trigger System

Layer an "AI operations center" on top of the existing Bridges Tester app. All 7 agents, simulated execution today (LLM-only reasoning, tool calls, approval gates), swap to real Cloud-backed execution once credits are added.

## What gets built

### 1. Data model (localStorage, mirrors target Postgres schema)

Extend `src/lib/store.ts` with:

- `agent_tasks` — id, userId, title, description, status (pending/running/needs_approval/completed/failed), priority (low/med/high), agentType, source (user/db/error/webhook/schedule), createdAt, updatedAt
- `agent_runs` — id, taskId, agentType, input, output, status, approvalRequired, steps[] (per-tool log), retries, createdAt, completedAt
- `agent_approvals` — id, runId, actionSummary, riskLevel (low/med/high), payload, status (pending/approved/rejected), approvedBy, createdAt
- `errors` — id, userId, source (frontend/backend), message, stack, status (open/triaged/resolved), createdAt

Same `read/write/useStoreVersion` pattern as today.

### 2. Agent registry — `src/lib/agents.ts`

Seven agents, same scaffold, different persona + tool allow-list:

```text
debug        → bugs, errors, failed runs
research     → missing info, knowledge gaps
ceo          → business decisions, prioritization
cfo          → money, pricing, billing
marketing    → content, copy, campaigns
architect    → app structure, code, schema
pm           → task planning, breakdowns
```

Each entry: `{ id, name, systemPrompt, tools: ToolName[], color }`.

Router (`routeRequest(text, source)`) returns an `agentType` from keyword + LLM classification (single Lovable AI call, fallback to keyword rules).

### 3. Agent tools (typed, allow-listed per agent)

Defined with AI SDK `tool()` shape. Today they hit localStorage; tomorrow they hit Cloud.

- `readTable({ table, filters })` — read-only DB access
- `listProjects()`, `listRuns()`, `listErrors()`
- `runBridgesTester({ projectId })` — calls existing `simulateRun`, returns summary
- `updateRow({ table, id, patch })` — **risky**, queues approval
- `deleteRow({ table, id })` — **risky**
- `sendEmail({ to, subject, body })` — **risky**
- `chargeMoney(...)`, `deploy(...)`, `updateProdSetting(...)` — **risky**
- `proposePlan({ steps })` — non-risky, stored on run
- `markResolved({ entityId })` — low-risk write

Risky tools don't execute. They create an `agent_approvals` row, set run status `needs_approval`, and pause. On approval the run resumes and the tool is replayed.

### 4. Trigger surfaces (all 7 required triggers)

| # | Trigger | Where |
|---|---|---|
| 1 | User action | `Run Agent` button (global, in shell), `Fix This` button on every error card + the runtime error screen, `/agents/new` form |
| 2 | DB trigger | `subscribe()` hook on `agent_tasks/errors/failed_jobs/support_requests/project_issues` keys — any new row auto-enqueues a run |
| 3 | Error trigger | Patch `reportLovableError` + global `window.onerror`/`unhandledrejection` to insert into `errors` and fire Debug Agent |
| 4 | Webhook | `src/routes/api/public/webhooks.agent-event.tsx` — accepts JSON `{ source, type, payload }`, HMAC-verified (today: dev-mode skip with warning banner), inserts task |
| 5 | Scheduled | Client-side interval (every 60s while app open) scans for open issues, stuck tasks (>5m running), missing secrets, failed Bridges runs; enqueues sweeper tasks. Real `pg_cron` swap noted in code comment |
| 6 | Approval | Risky tool → approval row → blocks run → user clicks Approve/Reject in `/agents/approvals` → run resumes |
| 7 | Completion | Run finishes → updates task, saves output, increments stats, toast + dashboard refresh |

### 5. Execution engine — `src/lib/agent-runner.ts`

`runAgent(task)`:
1. Mark task `running`, create run row.
2. Build prompt: system from registry + task + tool catalog (filtered by agent).
3. Call Lovable AI Gateway (`google/gemini-3-flash-preview`) via `streamText` with `stopWhen: stepCountIs(50)`.
4. On each tool call: log step. If risky → queue approval, pause, return.
5. On finish: write `output` (markdown), set task `completed`, fire completion trigger.
6. On error: retry once, then mark `failed`.

Today the call goes through a `src/lib/ai.functions.ts` `createServerFn` that uses the existing `LOVABLE_API_KEY`. (This part is real — Cloud isn't required for AI Gateway calls.)

### 6. UI

New routes:
- `/agents` — task dashboard: filters by status/agent, badges, "Run Agent" button.
- `/agents/new` — submit a problem (title, description, priority, agent override). Router suggests agent.
- `/agents/$taskId` — task detail: input, full run timeline (step-by-step tool log, with tool name + args + result), output markdown, status pill.
- `/agents/approvals` — queue of pending approvals: action summary, risk badge, payload preview, Approve / Reject buttons.
- `/agents/history` — chronological log viewer across all runs.

Shell updates:
- Sidebar adds: Agents, Approvals (with count badge), History.
- Global "Run Agent" button in shell header.
- "Fix This" button injected into existing error UI (root `ErrorComponent`, runtime-error reporter, every failed run step in `/runs/$id`).

### 7. Status & safety

- Statuses shown everywhere: `pending`, `running`, `needs approval`, `completed`, `failed`.
- All agent activity logged to run.steps (timestamp, tool, args, result, agentType).
- Risky-action whitelist enforced server-side in the runner — frontend cannot bypass.
- Secret note: today only `LOVABLE_API_KEY` is needed (already configured). Once Cloud is on, Settings page adds: real DB-backed agent tables, `pg_cron` schedule, real webhook HMAC secret.

## Technical notes

- Hydration: agent UI components are gated behind `useStoreVersion()` which only reads on the client; on SSR they render skeletons. Also fixes the existing `/runs/$id` hydration mismatch by rendering a stable placeholder until mount.
- Files added/modified:
  - `src/lib/store.ts` (extend with 4 tables + subscribe helper)
  - `src/lib/agents.ts` (registry, router)
  - `src/lib/agent-tools.ts` (tool definitions, risk classification)
  - `src/lib/agent-runner.ts` (execution loop)
  - `src/lib/ai.functions.ts` (server fn → Lovable AI Gateway)
  - `src/lib/ai-gateway.server.ts` (provider helper per knowledge doc)
  - `src/components/AppShell.tsx` (sidebar items, Run Agent button)
  - `src/components/RunAgentDialog.tsx`, `FixThisButton.tsx`, `AgentStatusBadge.tsx`
  - `src/routes/agents.index.tsx`, `agents.new.tsx`, `agents.$taskId.tsx`, `agents.approvals.tsx`, `agents.history.tsx`
  - `src/routes/api/public/webhooks.agent-event.tsx`
  - `src/routes/settings.tsx` (note webhook URL + future Cloud secrets)

## Explicitly out of scope (for this pass)

- Real Postgres tables, RLS, pg_cron, Edge-side webhook HMAC enforcement — all marked with TODO + comment, swap-in when Cloud is enabled.
- Multi-user accounts — single local user.
- Real email/payments/deploy actions — risky tools log the approved payload but no external call fires.
