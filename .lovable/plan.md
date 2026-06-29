
# Synapse QA OS — phased plan

The full spec (200–500 concurrent testers, native iOS/Android/desktop, CI/CD, security pentest, perf profiling) is a multi-month enterprise build that needs real infrastructure we don't have in-app (browser farms, native runners, signed CI tokens). I'll ship it in phases. Each phase is a complete, usable product on its own; you approve before the next phase starts.

This plan covers **Phase 1 only**. Phases 2–5 are listed so you can see the trajectory.

---

## Phase 1 — Synapse QA OS shell + real web crawler (this build)

Goal: paste any URL → autonomous AI explores it → get a real bug list, coverage map, and Readiness Score.

### What ships

1. **New section `/qa`** (Synapse QA OS), separate from Bridges Tester. Top-level nav entry.
2. **New Run screen** — paste a URL, pick depth (Quick / Standard / Deep), pick 1–3 personas from a built-in roster (First-time user, Power user, Accessibility user, Frustrated customer, Random explorer — 5 to start, not 500). Start run.
3. **Crawler engine** (server-side, via Firecrawl connector):
   - `firecrawl.map` to discover URLs.
   - `firecrawl.scrape` per page with `formats: ['markdown','links','screenshot']`.
   - Build a **navigation graph** (nodes = URLs, edges = links).
4. **AI inspection pass** per page via Lovable AI Gateway (`google/gemini-3-flash-preview`):
   - Functional findings (broken links, missing forms, dead ends)
   - Visual findings from the screenshot (empty states, overlapping, missing images)
   - Accessibility findings from the HTML (missing alt, low contrast hints, missing labels)
   - Each finding: severity, confidence, suggested fix, page URL.
5. **Persona simulation** — each selected persona re-evaluates the same crawl with its own system prompt and produces its own findings stream. (Sequential, not 500-concurrent.)
6. **Dashboard `/qa`**:
   - Active run status, pages crawled, findings count by severity
   - Navigation graph (simple force/tree view)
   - Bug list (filter by severity / persona / page)
   - **Production Readiness Score 0–100** with weighted sub-scores (Functionality, Visual, Accessibility, Coverage) and a verdict: Ready / Minor / Major / Block.
7. **Run history** — every run stored, re-openable.
8. **Storage** — Lovable Cloud (enable it now). Tables: `qa_runs`, `qa_pages`, `qa_findings`, `qa_personas`, with RLS scoped to the user.
9. **Required secret** — Firecrawl connector (I'll prompt to connect it; nothing for you to paste manually).

### Out of scope for Phase 1 (deferred to later phases)

- Native iOS/Android/Windows/macOS/Linux apps
- Real concurrent 200–500 testers (Phase 2 raises this to ~25 via worker queue)
- Actual click/form/upload interaction (Phase 2 adds Browserbase for real DOM interaction)
- Security testing (XSS/CSRF/SQLi) — Phase 3
- Perf profiling (Lighthouse, CPU, memory) — Phase 3
- CI/CD integrations (GitHub/GitLab webhooks) — Phase 4
- Learning engine / historical regression memory — Phase 5

### Technical sketch

```text
/qa (dashboard)
/qa/new (start run)
/qa/runs/$runId (live run + findings)
/qa/runs/$runId/graph (navigation graph)

src/lib/qa/
  crawler.functions.ts     createServerFn → Firecrawl map+scrape
  inspector.functions.ts   createServerFn → AI Gateway per-page analysis
  personas.ts              5 persona definitions (system prompts)
  scoring.ts               Readiness Score formula
  qa-store.ts              Cloud-backed CRUD (replaces localStorage pattern)

src/routes/api/public/qa-webhook.tsx   (Phase 4 placeholder, not wired)
supabase/migrations/<ts>_qa_schema.sql
```

Readiness Score formula (transparent, tweakable):
`score = 100 − (critical*15 + high*7 + medium*3 + low*1) · coverage_factor`

### Verification before I call Phase 1 done

- Run against `https://example.com` and a real multi-page site (your choice).
- Show: ≥1 page crawled per link discovered, ≥1 finding per persona, score renders, history persists across reload.

---

## Phases 2–5 (preview only — approve Phase 1 first)

- **Phase 2 — Real interaction + concurrency.** Browserbase integration (uses the secret already in Settings). Agents actually click buttons, fill forms, follow flows. Worker queue runs ~25 personas in parallel. Adds login/auth-flow testing.
- **Phase 3 — Perf + a11y + security.** Lighthouse run per page, axe-core a11y scan, OWASP-lite checks (open redirects, missing headers, form CSRF tokens, exposed `.env`/admin paths).
- **Phase 4 — Dev integrations.** GitHub/GitLab webhooks → auto-run on new deploy. Status checks back to PRs. Webhook already scaffolded in current app.
- **Phase 5 — Learning engine + native targets.** Historical regression memory (which components fail repeatedly), trend charts. Native app testing requires external runners — I'll scope cost and infra then.

---

Reply **"approve Phase 1"** to build, or tell me what to change (e.g. swap Firecrawl for Browserbase from the start, more/fewer personas, different score formula, different route prefix).
