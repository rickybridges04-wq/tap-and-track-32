## Goal
Make the app robust at 100k+ user scale by expanding both rosters with scale-focused roles.

## 1. Add 5 beta tester personas (20 → 25)
Edit `src/lib/qa/personas.ts` — append to `PERSONAS` and `ALL_PERSONA_IDS`. Each gets a system prompt that biases the AI inspector toward a scale/reliability lens.

| New persona | Lens it adds |
|---|---|
| **Load-spike user** 🌊 | Behaves like one of 100k concurrent users — flags anything that implies per-user state, unbounded lists, missing pagination, N+1 calls, no rate-limit messaging, or UI that assumes a quiet backend. |
| **Concurrent collaborator** 👥 | Two people on the same record at once — flags missing optimistic-UI conflict handling, no "someone else edited this" warning, last-write-wins data loss, no realtime refresh. |
| **Global / timezone user** 🌍 | Non-US locale, different timezone, RTL, large numbers — flags hardcoded $/USD/MM-DD-YY, server-time displayed as local, missing i18n hooks, broken layout in RTL. |
| **Churn-risk user** 🚪 | Decides in 10 seconds whether to stay — flags slow first paint, no value on empty state, forced signup walls, friction before "aha" moment, no progress feedback. |
| **Compliance / legal reviewer** ⚖️ | Audits for production-readiness at scale — flags missing ToS/Privacy/Cookie notice, no data-export/delete path, PII shown in URLs/logs, missing age gate, unclear data retention. |

No other files need to change — `qa.new.tsx` reads from `ALL_PERSONA_IDS` and renders them automatically.

## 2. Expand agent roster (7 → 10)
Edit `src/lib/agents.ts` — add 3 new agents to the `AGENTS` map, the `AgentType` union in `src/lib/agent-store.ts`, and the keyword router. Each new agent gets system prompt, allowed tools, risk posture, and a routing rule. All three target the "runs reliably at scale" goal.

| New agent | Position | Why it matters at 100k users | Tools |
|---|---|---|---|
| **SRE / Reliability Engineer** 🛰️ | Uptime, error budgets, alerting, incident response | Catches outages, latency spikes, failed jobs, retry storms before they cascade | read*, listErrors, runBridgesTester, markResolved, proposePlan, **updateProdSetting** (risky) |
| **Performance Engineer** ⚡ | Load, latency, bundle size, DB query cost | At 100k users, a 200ms query becomes a 5-minute backlog — owns the speed budget | read*, listRuns, listErrors, proposePlan |
| **Security & Compliance Officer** 🔐 | Authn/z, secrets, RLS, PII, audit logs, vulnerability triage | One leak at scale = company-ending event; owns approval-gate for risky data ops | read*, listErrors, proposePlan, markResolved, **updateProdSetting** (risky) |

Router keyword additions:
- `uptime|outage|downtime|latency|alert|incident|sla|slo|reliab` → **sre**
- `slow|perf|performance|p95|p99|bundle|cache|query plan|index|throughput` → **perf**
- `security|auth|rls|pii|leak|vuln|cve|compliance|gdpr|hipaa|pci|secret|credential` → **security**

Risk: `updateProdSetting` stays in `RISKY_TOOLS=true`, so both SRE and Security must request approval for prod changes — matches the existing approval-queue pattern.

## Files changed
- `src/lib/qa/personas.ts` — append 5 personas + IDs
- `src/lib/agents.ts` — add 3 agents, 3 router rules, extend tool grants
- `src/lib/agent-store.ts` — extend `AgentType` union with `"sre" | "perf" | "security"`

## Out of scope
No backend, no schema, no UI restructuring — both surfaces already auto-render from the registries.