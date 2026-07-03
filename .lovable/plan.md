## Problem

The QA run failed at "Inspecting SEO / marketer (12/50)" with a bare `TypeError: Failed to fetch`. This is the browser losing one server-function call mid-run (Vite dev-server reload, transient network blip, or gateway hiccup). Because `startRun` wraps the whole loop in one `try/catch`, a single failed `inspectPage`/`scrapePage` call aborts the entire crawl and marks it `failed` — even though 11 pages had already been inspected successfully.

## Fix

Harden `src/lib/qa/runner.ts` so one flaky call can't kill the run:

1. **Per-call retry with backoff** — wrap each `scrapePage` and `inspectPage` call in a small helper that retries up to 2× on thrown errors (500ms, then 1500ms). Handles Vite HMR reconnects and transient gateway 5xx.
2. **Non-fatal per-page/per-persona failures** — after retries exhaust, log the error into `findings` as a low-severity `crawler` note (`"Inspection failed for <persona> on <url>"`) and continue the loop instead of throwing.
3. **Track soft errors on the run** — accumulate a `warnings: string[]` list and surface count in the progress stage (`"Inspecting X (5/50, 1 skipped)"`) so users see partial degradation.
4. **Only hard-fail if `mapSite` fails or every inspection fails** — otherwise finish with `status: "completed"` and let scoring reflect what was gathered.

## Files

- `src/lib/qa/runner.ts` — add `withRetry()` helper, wrap scrape/inspect calls, convert catches to soft warnings, adjust final status logic.
- `src/lib/qa/qa-store.ts` — add optional `warnings?: string[]` to `QaRun` type (backward compatible; existing runs read as undefined).
- `src/routes/qa.runs.$runId.tsx` — if `warnings.length > 0` on a completed run, show a small "N steps skipped" note under the header. (Read-only display; no behavior change.)

## Out of scope

- Retrying the entire failed run automatically (user can hit Run again).
- Reducing default page/persona counts — the 50-step deep crawl is by design; resiliency is the real gap.
- Backend changes to `inspectPage`/`scrapePage` — those already return `{ ok: false, error }` on handler errors; the failure here is at the transport layer before the handler is reached.
