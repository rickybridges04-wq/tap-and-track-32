# Security

## Row-level security

Every table in `public` has RLS enabled with explicit `GRANT`s. Policies are scoped to `user_id = auth.uid()`, with an owner-role override through `public.has_role(auth.uid(), 'owner')`. Roles live in their own `user_roles` table — never on a profile — so a user cannot escalate by editing their own record. `has_role` is `SECURITY INVOKER` and executable by `authenticated` only (policy evaluation needs it); `anon` and `PUBLIC` have no execute rights on it or on the other internal helper functions.

## Secrets

Read only inside server function handlers or server route handlers, never at module scope, never with a `VITE_` prefix.

| Secret | Used for | Required |
| --- | --- | --- |
| `LOVABLE_API_KEY` | AI gateway calls | provisioned automatically |
| `QA_WORKER_TOKEN` | authenticates the external browser worker | yes, for automated runs |
| `FIRECRAWL_API_KEY` | page fetching and screenshots | yes, for crawls |
| `QA_WORKER_REPO`, `QA_WORKER_DISPATCH_TOKEN` | nudging the worker repo when jobs queue | optional |
| `GITHUB_TOKEN` | filing a bug as a GitHub issue | optional |
| `RESEND_API_KEY` | email alerts | optional |

The service-role key and database password are not retrievable and are never logged, returned or echoed.

## API keys

Created in Settings, shown exactly once, and stored only as a SHA-256 hash alongside a non-secret 12-character prefix for display. Verification is a constant-time hex comparison. Keys can be revoked, and `last_used_at` records activity. Rate limit: 30 requests per minute per key. A lost key cannot be recovered — revoke and create a new one.

Known limit: the rate limiter counts per runtime instance, not globally, so a heavily scaled deployment can allow more than 30/minute in aggregate.

## Worker endpoints

`/api/public/worker/*` bypasses site auth by design, so each handler authenticates itself: bearer `QA_WORKER_TOKEN` compared in constant time, `401` otherwise. Bodies are zod-validated, arrays capped at 200 items, screenshots at 3 MB. A worker cannot report a job it did not claim (`409`). No endpoint returns another user's data or any PII.

## Evidence storage

Screenshots go to the private `qa-evidence` bucket under `<user_id>/<run_id>/<job_id>.png`. There is no public read policy; the UI uses short-lived signed URLs.

## Test credentials

A project's optional test username and password exist only to substitute `{{username}}` / `{{password}}` placeholders into steps at claim time. They are never written into `steps_json`, never returned to the browser, and never included in an AI prompt. Use throwaway accounts on staging — treat anything stored here as readable by the worker.

## Share links

Report share links are unauthenticated by design: anyone holding the token can read that one report until it expires (7 days by default) or is revoked. They expose report contents only — no account data, no other runs.

## AI boundaries

Prompts carry page content, test metadata and failure evidence. They never carry secrets or credentials. Model output is zod-validated before storage, and the executive summary is rejected if it cites a number absent from the data.
