# Synapse QA OS

A release-readiness workbench for web apps. Point it at a URL and it does two different kinds of work:

1. **Crawl runs** — it fetches your pages, screenshots them, and has an AI model inspect each one from the point of view of several user personas. Output: findings with a severity, a category and a *basis* (`observed` = the model was looking at real evidence, `inferred` = it reasoned without it), plus a readiness score and a verdict.
2. **Automated runs** — deterministic browser test cases (Playwright steps you author or generate) executed by an external worker. Output: pass/fail per case with duration, failed step, console errors, failed network requests, accessibility violations, web vitals and a screenshot. AI never decides these verdicts; it only explains failures afterwards.

On top of that: bug tracking, regression diffs between runs, trends, PDF/CSV reports with expiring share links, a public API, and store-submission tooling for shipping apps.

## Stack

- TanStack Start v1 (React 19, Vite 7) on Cloudflare Workers
- Tailwind CSS v4 + shadcn/ui
- Lovable Cloud (Postgres, auth, storage, realtime) with RLS on every table
- Lovable AI Gateway for all model calls
- Firecrawl for page fetching and screenshots

## Running it

```bash
bun install
bun run dev        # http://localhost:8080
bun run test       # vitest unit tests
bun run typecheck  # tsgo --noEmit
bun run build
```

Environment variables come from Lovable Cloud automatically. The optional secrets are listed in [SECURITY.md](./SECURITY.md).

## The browser worker lives elsewhere

Playwright cannot run inside a Cloudflare Worker, so automated runs are executed by a separate process in its own repository: **`bridges-qa-worker`**. It is a plain Node service that loops over three HTTP endpoints in this app — claim a job, heartbeat, report the result — authenticated with the `QA_WORKER_TOKEN` secret. The contract is in [API.md](./API.md#worker-api). Without a worker running, automated runs stay queued (and are re-queued, then failed, after a stale heartbeat).

## Docs

| File | Contents |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Both pipelines end to end, with a diagram |
| [DATABASE.md](./DATABASE.md) | Tables, keys and RLS |
| [API.md](./API.md) | Public API and worker API with examples |
| [TESTING.md](./TESTING.md) | Unit tests and the self-test suite |
| [QA_STRATEGY.md](./QA_STRATEGY.md) | What counts as evidence and what is only a suggestion |
| [SECURITY.md](./SECURITY.md) | Secrets, keys, RLS, storage |
| [CHANGELOG.md](./CHANGELOG.md) | Phase history |
