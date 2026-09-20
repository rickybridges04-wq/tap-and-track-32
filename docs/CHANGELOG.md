# Changelog

## Phase 5 — Public API, CI, self-tests, docs

- `api_keys` table (SHA-256 hash + display prefix only); create / list / revoke in Settings.
- `POST /api/v1/runs` and `GET /api/v1/runs/:id`, bearer an API key, 30 requests/minute per key. `crawl` rejected with `400`.
- Optional `repository_dispatch` to `QA_WORKER_REPO` when jobs queue; a dispatch failure never fails the run.
- `qa_runs.ref` and `qa_runs.commit_sha` so a run can be traced back to a commit.
- CI integration page with a copy-paste GitHub Actions workflow that polls for up to 15 minutes and exits non-zero on failures, new regressions or a `block` verdict.
- Vitest suite over the pure logic (36 tests) plus `test` and `typecheck` scripts.
- Owner-only "Load self-test suite" that tests this app against itself.
- `docs/` written from the code.

## Phase 4 — Live runs, regressions, reports

- Realtime on `qa_jobs` and `automated_results`; the run page shows live counters, per-suite progress and a result feed, with a slow poll as fallback.
- Regression diff (newly failing / fixed / still failing / still passing / new case) and flaky detection over the last 5 runs.
- Project trends: LCP and TTFB medians per run, readiness score over time, accessibility by impact, slowest cases.
- Report view with CSV and PDF export and expiring read-only share links.
- `settle_qa_run()` as the single completion authority, called from the report route, the stale sweep and the invalid-job path, so a run can no longer hang.

## Phase 3 — Failure analysis and bugs

- `failure_analyses`, `bugs`, `bug_comments`.
- Failing results grouped by `error_signature`; one AI explanation per signature, repeats only increment `occurrences`. Infrastructure errors are never analysed. Credentials never leave the server.
- Failure groups in the run page, "Create bug" with user confirmation, a Bugs page with statuses and comments, optional GitHub issue creation.

## Phase 1–2 — Projects, cases, job queue, worker API

- `qa_projects`, `test_suites`, `test_cases`, `qa_jobs`, `automated_results`, private `qa-evidence` bucket.
- `claim_qa_job()` with `FOR UPDATE SKIP LOCKED`, heartbeat re-queueing and attempt limits.
- Worker API: claim, heartbeat, report — bearer `QA_WORKER_TOKEN`.
- Projects and cases UI with a validated steps editor, "Run automated", and a live run page.

## Phase 0 — Schema drift and truthfulness

- Added the evidence columns the code assumed: `qa_runs.pages_discovered/pages_scraped/updated_at`, `qa_pages.screenshot_url/latency_ms/truncated`, `qa_findings.basis`. Removed the `as never` casts.
- Silent persistence failures in the crawl runner became run warnings.
- Performance findings re-worded to describe what is actually measured (crawler fetch time, including rendering and screenshot).

## Earlier

Crawl pipeline with personas and AI inspection, evidence-aware scoring, fixes bubble with root-cause clustering, app registry and store submission wizard, push notifications, data manager, theme switcher, Stripe checkout and subscriptions, diagnostics panel.
