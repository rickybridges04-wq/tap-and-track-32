# Synapse QA OS — Persistence, tuning, personas

## Scope

Three changes:

1. **Server-driven crawl with progress polling** — runs persist across reloads mid-flight.
2. **Depth caps** raised to 5 / 15 / 40.
3. **Default personas** expanded to include a mobile/responsive persona.

Model stays `google/gemini-3-flash-preview` (already working after the schema-tolerance fix).

## 1. Server persistence + polling

### Schema (new migration)

Extend `qa_runs` and add two child tables:

```text
qa_runs (existing)
  + progress_current    int default 0
  + progress_total      int default 0
  + current_step        text        -- "crawling" | "inspecting" | "scoring" | "done"
  + error               text
  + summary             jsonb       -- final aggregate {score, counts, warnings}

qa_pages
  id uuid pk, run_id fk qa_runs on delete cascade,
  url text, title text, depth int, status text, created_at

qa_findings
  id uuid pk, run_id fk qa_runs, page_id fk qa_pages on delete cascade,
  persona text, severity text, category text,
  title text, detail text, suggestion text, confidence numeric,
  created_at
```

RLS: owner-only (`user_id = auth.uid()` via `qa_runs.user_id`). GRANT to `authenticated` + `service_role`. Enable Realtime on `qa_runs`, `qa_pages`, `qa_findings` (optional — polling works without).

### Server runner

- New `startRun` server fn (`requireSupabaseAuth`): inserts `qa_runs` row (`status='pending'`), kicks off crawl via `queueMicrotask`, returns `{ runId }`. The handler runs the whole crawl+inspect+score pipeline, writing pages/findings/progress as it goes and finalizing `status`, `score`, `summary`, `completed_at`.
- Note: Worker runtimes may not preserve background work after the response returns. If we see truncated runs in practice, fall back to a synchronous `startRun` that streams progress (still writes to DB) — kept as a follow-up if needed.
- New `getRun(runId)` server fn: returns `{ run, pages, findings }`.
- New `listRuns()`, `deleteRun(runId)`.

### Client

- Replace `qa-store.ts` localStorage layer with server-fn calls wrapped in TanStack Query.
- `qa.runs.$runId.tsx` uses `useQuery` with `refetchInterval: 2000` while `status in ('pending','running')`, stops polling on terminal status.
- `/qa` list view reads `listRuns()`.
- Drop the in-memory `runner.ts` orchestration on the client; keep only the AI SDK inspector call chain on the server.

## 2. Depth caps

In whatever config drives crawl depth today (likely `src/lib/qa/runner.ts` or a constants module):

```text
quick:    3  → 5
standard: 8  → 15
deep:     20 → 40
```

Applied server-side so localStorage overrides can't bypass.

## 3. Personas

Add `mobile` persona to the inspector persona registry with a prompt focused on responsive layout, tap targets, viewport, mobile-only failure modes.

Default selection on the New Crawl form: `first_time`, `accessibility`, `frustrated`, `mobile` (all four checked by default; user can uncheck).

## Files touched

- `supabase/migrations/<new>.sql` — schema + RLS + grants.
- `src/lib/qa/qa-store.ts` — replace with server-fn/Query wrappers.
- `src/lib/qa/runner.functions.ts` (new) — `startRun`, `getRun`, `listRuns`, `deleteRun`.
- `src/lib/qa/runner.ts` — pipeline moves to server; file trimmed or deleted.
- `src/lib/qa/inspector.functions.ts` — add `mobile` persona.
- `src/lib/qa/config.ts` (new or existing) — depth caps 5/15/40.
- `src/routes/qa.tsx`, `src/routes/qa.new.tsx`, `src/routes/qa.runs.$runId.tsx` — Query wiring, polling, default personas.

## Out of scope

- Swapping model provider.
- Changing the scoring formula.
- Realtime subscriptions (polling first; can add later).
- Backfilling existing localStorage runs into the DB.

## Verification

1. Start a run against `example.com` (quick), reload the page mid-run — progress continues from where it was.
2. New run at `standard` depth crawls up to 15 pages (verify in `qa_pages` count).
3. New Crawl form shows all four personas checked; findings include `persona='mobile'` entries.
4. `SELECT count(*) FROM qa_runs WHERE user_id = auth.uid()` matches the list view.
