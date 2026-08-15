# Truthful QA Pipeline — Evidence, Coverage, Resilience

## First, an honest note on the governance docs

`AGENTS.md` routes to `docs/MASTER_INDEX.md`, the BAEOS volumes, UEC parts, `NEW_APP_STANDARD.md` and `TRIAL_POLICY.md`. **There is no `docs/` folder in this project** — those files do not exist here, so I could not load them. The audit below is run against the two standards I do have in context (App Readiness Governance and the IT Support Bot method) plus a direct read of the QA pipeline code.

## What actually happens when you run a URL

Verified by reading `src/lib/qa/crawler.functions.ts`, `inspector.functions.ts`, `runner.ts`, `scoring.ts`, `config.ts`.

```text
/qa/new  →  createRun (DB row)  →  runQa() in YOUR BROWSER TAB
   1. Firecrawl /map          → up to 5 (quick) / 15 (standard) / 40 (deep) URLs
   2. Firecrawl /scrape       → 5 pages in parallel; markdown (first 4000 chars),
                                title, status code, first 50 links
                                withScreenshot: false  ← no image is ever captured
   3. AI inspect              → 6 in parallel; ONE Gemini call per page × persona
                                input = URL + title + links + markdown text
   4. computeScore()          → normalized per (pages × personas); any critical = "block"
```

So each finding is one LLM's reading of a page's **text**. There is no browser, no click, no form submit, no login, no timing measurement, no rendered pixels.

## Findings (severity per governance §4)

**Blocking — Truth Standard**
1. `visual` and `performance` findings are presented with the same authority as functional ones, but nothing visual or timed is ever observed. Firecrawl supports `screenshot` and the code has the flag — it is hardcoded `false`. These are model guesses labeled as evidence.
2. A JS-only / auth-gated app can score "ready" purely because the crawler saw a login shell. Coverage is measured as `pagesCrawled / linksDiscovered` from the same shallow map, so it self-reports high coverage on a site it never entered.

**Degraded**
3. Closing the tab mid-run strands the row at `status: running` forever — no timeout, no reaper.
4. Persona inspections see only 4000 markdown chars; long pages are silently truncated with no note on the finding.
5. Scrape/inspect failures become `warnings` but the score is computed as if coverage were complete.

**Cosmetic**
6. No per-finding evidence link (page snapshot / raw excerpt) to check a claim against.

## The fix

1. **Enable real screenshots.** Turn on Firecrawl `screenshot` per page, store the URL on `qa_pages`, pass it to the inspector, and show it on the finding. Screenshot present → visual findings allowed.
2. **Evidence badges.** Every finding gets an explicit basis: `observed` (from screenshot/status/timing) vs `inferred` (from text only). Inferred `visual`/`performance` findings are visibly marked and excluded from the headline score, listed separately as "needs manual check."
3. **Real performance signal.** Record fetch latency + HTTP status per page in the crawler and score `performance` from those numbers instead of prose.
4. **Honest coverage.** Show pages scraped / discovered / skipped on the run header, and cap the verdict at "minor" when coverage is under 60% or the root page looks like an auth wall (short markdown, sign-in keywords).
5. **Run resilience.** Mark runs stuck in a non-terminal status with no update for 10 minutes as `failed` with reason "tab closed / run interrupted" when the runs list loads.
6. **Truncation note.** When markdown is cut at 4000 chars, flag the page as partially inspected.

## Technical notes

- `crawler.functions.ts`: `withScreenshot` default true for run scrapes; add `latencyMs`; return `truncated` boolean.
- `qa.functions.ts` + migration: add `screenshot_url`, `latency_ms`, `truncated` to `qa_pages`; add `basis` to `qa_findings`. Migration includes GRANTs per existing table pattern.
- `inspector.functions.ts`: pass screenshot URL and latency into the prompt; normalize a `basis` field, defaulting to `inferred`.
- `scoring.ts`: exclude `inferred` visual/performance from penalties; add the coverage verdict cap.
- `qa.runs.$runId.tsx` / `qa.index.tsx`: evidence badges, coverage line, stale-run reaping.

## Not in this pass

Real browser interaction (clicks, logins, form submits) still needs an external Node + Playwright worker — Cloudflare Workers cannot run Chromium. Say the word and that becomes its own plan.
