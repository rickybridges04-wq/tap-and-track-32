# QA strategy

The guiding rule: **never present a guess as a measurement.** Every claim in this product carries its provenance.

## Three kinds of statement

| Kind | Produced by | Trust |
| --- | --- | --- |
| **Verdict** | Playwright, in the external worker | Deterministic. Pass, fail or infrastructure error. AI cannot change it. |
| **Observation** | AI inspecting a page with real evidence (screenshot, markdown, status code, latency) | Useful, still a model's reading. Stored with `basis = 'observed'`. |
| **Suggestion** | AI explaining a failure or writing a summary | Advisory only. Always labelled "Suggestion — AI" in the UI. |

## Crawl findings are observations, not test results

A crawl finding says "a model looking at this page thought X". It carries a category, a severity, a confidence and a basis. When the screenshot was captured the finding is `observed`; when the model had to reason without it, `inferred`.

Inferred **visual** and **performance** findings are excluded from the score entirely — you cannot judge layout or speed from text you never rendered. Inferred functional and accessibility findings still count, because they follow from the markup and content the model did see.

Performance findings are worded as "page fetch time through the crawler (includes rendering and screenshot)", because that is what is actually timed — not your server's response time.

## Automated results are verdicts

A case passes or fails because a browser executed its steps. AI is called only *after* the verdict exists, with a system prompt stating that the verdict is already decided and must not be contradicted. It receives the case title, steps, failed step, error message, console errors, failed network requests, axe violations and the URL — never credentials.

One AI call per distinct `error_signature`. A repeat of a known failure increments `occurrences` and costs nothing. Results with status `error` are infrastructure problems and are never analysed; the UI says "Infrastructure error, re-run".

If the model returns JSON that fails validation, it is retried once and then dropped with a warning on the run. Nothing invalid is ever stored.

## Scores are honest about coverage

The readiness score weights findings by severity, normalises by `pages × personas` so a deeper crawl is not punished for looking harder, and multiplies by how much of the site was actually covered. A thin crawl cannot produce a confident `ready`. Any critical finding forces `block`.

Because of normalisation, a later run that finds more issues across more pages can score differently from a small early run — the score is comparable across runs of similar coverage, which is why trends are charted per project.

## Reports cannot invent numbers

The AI executive summary is checked server-side against the set of figures actually present in the report. A summary mentioning any other number is rejected and the report shows a plain note instead.

## Bugs are confirmed by a human

An AI analysis pre-fills a bug draft. Nothing is filed until the user confirms it.
