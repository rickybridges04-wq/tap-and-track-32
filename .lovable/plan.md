
# Bridges Tester — AI Web App Testing Platform

A platform to register your web apps and run automated AI-driven usability walkthroughs that click every button/tab, capture screenshots, log errors, and produce a written usability report. Supports manual review, scheduling, and CI-triggered runs.

## Core Loop

```text
[Add App URL] → [Trigger Run: manual / schedule / webhook]
       ↓
[Server fn enqueues run]
       ↓
[Worker: Playwright crawls app, AI plans actions per page]
       ↓
[Captures: screenshots, console logs, network errors, element pass/fail]
       ↓
[AI summarizes → usability report]
       ↓
[Review UI: timeline, screenshots, checklist, findings, annotate]
```

## v1 Scope

**Projects**
- Add/edit/delete a project (name, base URL, notes, tags)
- Multi-project dashboard with last-run status

**Test Runs**
- One-click "Run now" per project
- Scheduled runs (cron expression, e.g. daily/hourly)
- CI/webhook trigger: public endpoint `/api/public/runs/trigger` with HMAC signature
- Run config: max pages, max depth, viewport (desktop/mobile)

**Execution (Hybrid AI + capture)**
- Headless Chromium (Playwright) crawls the public URL
- For each page: enumerate clickable elements (buttons, links, tabs, form inputs)
- AI agent decides exploration order + flags suspicious UX
- Each interaction: pre/post screenshot, mark pass/fail (error thrown, navigation broken, console error spike)
- Capture full console log + network log (4xx/5xx flagged)

**Reporting (per run)**
- Step-by-step timeline with screenshots
- Pass/fail checklist of every element interacted with
- Console + network error log (grouped, deduped)
- AI-written usability report: confusing flows, dead ends, accessibility flags, recommendations
- Compare to previous run: regressions highlighted
- Export as PDF/Markdown to `/mnt/documents`

**Review**
- Annotate any step (comment, mark as known issue, ignore)
- Mark findings resolved
- Alert badge on dashboard when new regressions appear

**Alerts (basic)**
- On run completion with new failures: in-app notification + optional email (Lovable Email)

## Architecture

**Stack**
- Frontend: TanStack Start (already scaffolded), Tailwind v4, shadcn
- Backend: Lovable Cloud (Postgres, auth, storage for screenshots)
- AI: Lovable AI Gateway (`google/gemini-3-flash-preview`) via AI SDK for action planning + report generation
- Execution: Playwright cannot run inside the Worker runtime — needs an external worker. **Decision needed (see Questions).**

**Database (Lovable Cloud)**
- `projects` — id, owner, name, base_url, notes, created_at
- `schedules` — id, project_id, cron, enabled
- `runs` — id, project_id, status (queued/running/done/failed), trigger (manual/schedule/webhook), started_at, finished_at, summary_json
- `run_steps` — id, run_id, idx, page_url, element_desc, action, status (pass/fail), screenshot_path, console_snapshot, network_snapshot
- `findings` — id, run_id, severity, title, body_md, status (open/ignored/resolved)
- `user_roles` — standard pattern
- RLS: owner-scoped; service_role for worker writes

**Server Functions**
- `createProject`, `listProjects`, `getProject`
- `triggerRun` (auth'd) → enqueue
- `getRun`, `listRuns`, `annotateStep`, `resolveFinding`
- `upsertSchedule`

**Server Routes**
- `POST /api/public/runs/trigger` — HMAC-signed webhook from CI
- `POST /api/public/runs/callback` — worker posts step/run results back

**UI Routes**
- `/` — dashboard (projects + recent runs)
- `/projects/$id` — project detail, run history, schedule config, trigger
- `/runs/$id` — timeline + screenshots + checklist + AI report + annotations
- `/settings` — webhook secret, email alerts

## Key Question Before Build

**Playwright cannot run in the Cloudflare Worker runtime that hosts server functions.** Two viable paths:

1. **Browserless.io / Browserbase (recommended)** — managed headless browser API; we call it from a server function, stream results back. No infra to run. Requires user to add their API key as a secret.
2. **Self-hosted worker** — separate Node service the user deploys (Render/Fly/Railway) that polls our DB or receives webhooks. More setup, no third-party cost.

I will ask which path you want before building.

## Technical Details

- AI loop uses AI SDK `streamText` + tools (`clickElement`, `fillInput`, `navigate`, `reportFinding`) with `stepCountIs(50)`
- Screenshots stored in Lovable Cloud Storage bucket `run-artifacts`, signed URLs for viewing
- Schedules executed via pg_cron calling `/api/public/runs/trigger` with stable preview URL
- Webhook security: HMAC-SHA256 over raw body, timing-safe compare, secret stored via `add_secret`
- Report generation: after run, second AI call summarizes all steps into markdown
- Regression diff: compare current `findings` set to previous run's

## Out of Scope for v1

- Testing apps behind login (would need credential storage)
- Visual regression diffing (pixel comparison)
- Multi-user team collaboration
- Mobile native app testing
