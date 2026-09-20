# Database

Postgres on Lovable Cloud. Every table in `public` has RLS enabled, explicit `GRANT`s, indexes on all foreign keys, and owner-scoped policies of the form `user_id = auth.uid()` plus an owner-role override via `public.has_role(auth.uid(), 'owner')`.

## Crawl runs

| Table | Key columns |
| --- | --- |
| `qa_runs` | `id`, `user_id`, `project_id` → `qa_projects` (nullable), `kind` `'crawl'｜'automated'`, `status`, `target_url`, `depth`, `personas`, `pages_discovered`, `pages_scraped`, `score`, `verdict`, `total`, `passed`, `failed`, `errored`, `warnings`, `ref`, `commit_sha`, `created_at`, `completed_at`, `updated_at` |
| `qa_pages` | `run_id`, `url`, `title`, `status_code`, `screenshot_url`, `latency_ms`, `truncated`, `content` |
| `qa_findings` | `run_id`, `page_url`, `persona_id`, `category`, `severity`, `confidence`, `title`, `detail`, `fix`, `basis` (`observed`｜`inferred`) |

## Projects, suites, cases

| Table | Key columns |
| --- | --- |
| `qa_projects` | `user_id`, `name`, `base_url`, `environment` `'staging'｜'production'`, `username`, `password` (only substituted into `{{username}}` / `{{password}}` step placeholders, never returned to the browser) |
| `test_suites` | `user_id`, `project_id`, `name`, `category` `auth｜crud｜security｜ui｜api｜a11y｜performance｜other` |
| `test_cases` | `user_id`, `suite_id`, `code` (unique per project, e.g. `AUTH-001`), `title`, `expected`, `steps_json`, `generated_by` `'ai'｜'human'` |

## Execution

| Table | Key columns |
| --- | --- |
| `qa_jobs` | `run_id`, `case_id`, `status` `queued｜claimed｜done｜failed`, `claimed_by`, `claimed_at`, `heartbeat_at`, `attempts`, `error`. Index on `(status, created_at)` |
| `automated_results` | `run_id`, `case_id`, `job_id` (unique), `status` `pass｜fail｜error`, `duration_ms`, `failed_step_index`, `error_message`, `console_errors`, `network_failures`, `axe_violations`, `web_vitals`, `step_log`, `screenshot_path`, `error_signature` |

## Analysis and bugs

| Table | Key columns |
| --- | --- |
| `failure_analyses` | `error_signature` (unique per user), `first_seen_result_id`, `occurrences`, `last_seen_at`, `likely_cause`, `repro_steps`, `suggested_severity`, `confidence`, `basis` (default `inferred`), `model` |
| `bugs` | `project_id`, `result_id`, `failure_analysis_id`, `title`, `severity`, `status` `open｜in_progress｜resolved｜wontfix`, `assignee`, `steps_to_reproduce`, `expected`, `actual`, `likely_cause`, `screenshot_path`, `github_issue_url` |
| `bug_comments` | `bug_id`, `user_id`, `body` |

## Reporting and access

| Table | Key columns |
| --- | --- |
| `qa_report_shares` | `run_id`, `token`, `expires_at`, `revoked_at` — read-only public report access |
| `api_keys` | `name`, `key_hash` (SHA-256), `prefix`, `last_used_at`, `revoked_at` — the key itself is never stored |

Plus the app-management tables (`apps`, `app_submissions`, `notification_campaigns`, data-manager tables) and `user_roles` + `has_role()` for role checks.

## Functions

- `claim_qa_job(p_worker text)` — service-role only. Claims one queued job with `SELECT … FOR UPDATE SKIP LOCKED LIMIT 1` ordered by `created_at`; sets `claimed`, `claimed_by`, `claimed_at`, `heartbeat_at`, `attempts + 1`. Re-queues jobs whose heartbeat is older than 5 minutes when `attempts < 3`, fails them with `worker lost` at 3, and settles the run when that empties the queue.
- `settle_qa_run(uuid)` — service-role only, the single authority for completing a run: counts, pass rate, score, verdict and `completed_at`.
- `has_role(uuid, app_role)` — role check used inside policies. `SECURITY INVOKER`; executable by `authenticated` only.

## Storage

- `qa-evidence` — private bucket. Screenshots live at `<user_id>/<run_id>/<job_id>.png`, readable only under the owner's own prefix; the UI uses short-lived signed URLs.

## Realtime

`qa_jobs` and `automated_results` are in the `supabase_realtime` publication with full replica identity. RLS still applies to subscriptions.
