# Make runs real (Browserbase + real agent execution)

Cloud is on. `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` are saved. Scope covers three swaps — all server-side, no UI redesign.

## 1. Browserbase driver (shared)

New `src/lib/browserbase.server.ts`:
- `createSession()` → POST `https://api.browserbase.com/v1/sessions` with project id, returns `{ id, connectUrl }`.
- `withPage(fn)` → connects Playwright over CDP to `connectUrl`, opens a page, runs `fn(page)`, closes session. Uses `playwright-core` (bundler-safe, no browser download).
- `install playwright-core` via `bun add`.

Errors return `{ ok:false, error }` — never throw across the RPC boundary.

## 2. QA crawler → Browserbase

Replace `src/lib/qa/crawler.functions.ts` Firecrawl calls:
- `mapSite`: load `url`, collect same-origin `<a href>` up to `limit`, BFS one level. No sitemap fetch.
- `scrapePage`: load `url`, capture `document.title`, response status, links, `document.body.innerText.slice(0, 4000)` as `markdownPreview`, optional `page.screenshot({ type: "jpeg", quality: 60 })` base64.

Existing `runner.ts` calls stay unchanged (same return shape). `FIRECRAWL_API_KEY` no longer required — remove the check.

## 3. Bridges Tester runs real

`src/lib/agent-tools.ts` `runBridgesTester` currently simulates. Replace with:
- Browserbase session against target URL.
- Playwright walkthrough: load home, click first 3 visible primary buttons/links, capture console errors + failed network requests + final screenshot.
- Return `{ ok, pagesVisited, consoleErrors, failedRequests, screenshotUrl }` (screenshot uploaded to Supabase storage bucket `tester-runs`, public URL returned).
- New migration: create `tester-runs` public storage bucket.

## 4. Risky agent tools execute for real (behind approval)

Currently `decideApproval` marks approved risky steps as "Simulated execution". Wire real execution in `src/lib/agent-tools.ts` for these tools, gated by the existing approval flow:
- `sendEmail` → Resend API using `RESEND_API_KEY` (if missing, return `{ok:false, error:"RESEND_API_KEY not configured"}`).
- `chargeMoney` → Stripe PaymentIntent via existing `createStripeClient("live")`.
- `deploy` → returns `{ok:false, error:"deploy tool not wired to a deploy provider"}` (explicit no-op, not silent success).
- `updateProdSetting` → same explicit no-op.
- `updateRow` / `deleteRow` → run against Supabase using `supabaseAdmin` inside handler, table+id from args, allowlist of tables (`apps`, `qa_runs`, `notification_campaigns`) to prevent arbitrary writes.
- `markResolved` → real update on `errors`/`qa_findings` row.

`agent-runner.ts` `decideApproval` now calls `executeTool` for approved risky steps instead of stubbing.

## 5. Settings copy

Update `src/routes/settings.tsx`: remove "simulated" language for Bridges Tester + risky tools. Keep the localStorage notice for agent tasks/runs (out of scope this pass).

## Out of scope
- Moving agent tasks/runs/approvals from localStorage to Postgres.
- Auth on `/api/public/*` webhook signing (already stubbed).
- New UI for viewing Browserbase live sessions.

## Technical

- All Browserbase / Playwright / Resend / Stripe / supabaseAdmin work happens inside `.handler()` bodies. No module-scope secret reads.
- `playwright-core` connects via CDP only — no chromium download, safe for the Worker runtime (network client, not a browser host).
- Storage bucket migration: `insert into storage.buckets (id,name,public) values ('tester-runs','tester-runs',true)` + policy for authenticated write, public read.
- File touches: `src/lib/browserbase.server.ts` (new), `src/lib/qa/crawler.functions.ts`, `src/lib/agent-tools.ts`, `src/lib/agent-runner.ts`, `src/routes/settings.tsx`, one migration.

## Verification
- QA: start a new crawl on a real URL, confirm rows land in `qa_pages` / `qa_findings`.
- Tester: trigger a Bridges Tester agent task, approve, confirm a screenshot URL is returned and viewable.
- Risky: trigger a `sendEmail` task, approve, confirm Resend returns a message id.
