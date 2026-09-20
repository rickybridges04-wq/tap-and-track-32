# API

Two separate APIs. Neither uses a user session.

- **Public API** (`/api/v1/*`) — for your build pipeline. Bearer an API key created in Settings.
- **Worker API** (`/api/public/worker/*`) — for the `bridges-qa-worker` process only. Bearer the `QA_WORKER_TOKEN` secret, compared in constant time.

Replace `$BASE` with your app URL.

## Public API

Route files: `src/routes/api.v1.runs.ts`, `src/routes/api.v1.runs.$id.ts` (aliases: `api.public.v1.runs.ts`, `api.public.v1.runs.$id.ts`). Handlers: `src/lib/qa/api-v1.server.ts`. Auth and rate limiting: `src/lib/qa/api-auth.server.ts` — **30 requests per minute per key**, then `429`.

### POST /api/v1/runs

```bash
curl -X POST "$BASE/api/v1/runs" \
  -H "Authorization: Bearer $QA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"<uuid>","kind":"automated","ref":"main","commit_sha":"abc1234"}'
```

`201`:

```json
{ "run_id": "…", "status_url": "https://…/api/v1/runs/…", "jobs_queued": 4 }
```

`kind` defaults to `automated`. `crawl` is rejected with `400` — a crawl needs a browser session and cannot be started from the API. Other errors: `401` bad or revoked key, `404` unknown project, `422` project has no test cases, `429` rate limited.

### GET /api/v1/runs/:id

```bash
curl "$BASE/api/v1/runs/<run-id>" -H "Authorization: Bearer $QA_API_KEY"
```

```json
{
  "status": "completed",
  "kind": "automated",
  "total": 2, "passed": 1, "failed": 1, "errored": 0,
  "pass_rate": 50, "score": 66, "verdict": "major",
  "newly_failing": ["CHK-001"],
  "report_url": "https://…/qa/report/<run-id>"
}
```

A key can only see runs belonging to its own user.

## Worker API

All three routes return `401` without the exact token. They use the service-role client.

### POST /api/public/worker/claim

Body `{"worker_id":"worker-1"}`. `200` with one job, or `204` when the queue is empty.

```json
{
  "job": {
    "id": "…",
    "base_url": "https://staging.example.com",
    "case": { "id": "…", "code": "CHK-001", "title": "Checkout completes", "steps": [] },
    "credentials": { "username": "qa@example.com", "password": "…" },
    "capture": { "screenshot": true, "axe": true, "vitals": true }
  }
}
```

### POST /api/public/worker/heartbeat

Body `{"job_id":"…","worker_id":"worker-1"}` → `200 {"ok":true}`. Call it at least every couple of minutes; a job silent for 5 minutes is re-queued (and failed as `worker lost` on the third attempt).

### POST /api/public/worker/report

```json
{
  "job_id": "…", "worker_id": "worker-1", "status": "fail",
  "duration_ms": 4210, "failed_step_index": 3, "error_message": "Timeout waiting for #cart",
  "console_errors": ["TypeError: x is not a function"],
  "network_failures": [{ "url": "…/api/cart", "status": 500, "method": "POST", "failure": null }],
  "axe_violations": [{ "id": "color-contrast", "impact": "serious", "help": "…", "nodes": 4 }],
  "web_vitals": { "lcp_ms": 2800, "cls": 0.02, "ttfb_ms": 460, "fcp_ms": 1200 },
  "step_log": [{ "index": 0, "action": "goto", "ok": true, "ms": 300, "error": null }],
  "screenshot_png_base64": null
}
```

Whole body is zod-validated; arrays are capped at 200 items and the screenshot at 3 MB. A report for a job claimed by a different worker returns `409`. `status:"error"` marks the job `failed`; `pass`/`fail` mark it `done`. When the run's last job settles, `settle_qa_run()` writes counts, score and verdict.

## Share links

`GET /api/public/report/:token` returns a completed run's report as JSON, or CSV / PDF with `?format=csv|pdf`. Tokens expire (7 days by default) and can be revoked; unknown or expired tokens return `404`.

## Evidence

```bash
$ curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/public/worker/claim" \
    -H 'Content-Type: application/json' -d '{"worker_id":"x"}'
401
```
