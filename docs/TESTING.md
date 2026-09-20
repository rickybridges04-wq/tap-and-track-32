# Testing

Two layers: unit tests of this app's own pure logic, and a self-test suite that drives the running app through the automated pipeline.

## Unit tests

```bash
bun run test        # vitest run
bun run typecheck   # tsgo --noEmit
```

Config: `vitest.config.ts` (node environment, `src/**/*.test.ts`). Only pure logic is covered — no database, no network, no AI.

| File | Covers |
| --- | --- |
| `src/lib/qa/scoring.test.ts` | severity weights, exclusion of *inferred* visual/performance findings, penalty normalisation by pages × personas, coverage multiplier, critical → `block`, 0..100 clamp |
| `src/lib/qa/steps.test.ts` | step schema: allowed actions, timeout bounds, selector/value length caps, 200-step cap, label/field coverage |
| `src/lib/qa/signature.test.ts` | error normalisation (numbers, UUIDs, hex, whitespace) and signature stability across differing timings and ids |
| `src/lib/qa/regression.test.ts` | diff states, flaky detection (2+ flips), diff ordering, median |
| `src/lib/qa/report-summary.test.ts` | executive-summary number guard: accepts real figures and the seconds form of millisecond values, rejects invented numbers |
| `src/lib/api-keys.test.ts` | key format, uniqueness, hashing, constant-time verification |

Actual output at the time of writing:

```
 ✓ src/lib/qa/scoring.test.ts (8 tests)
 ✓ src/lib/api-keys.test.ts (5 tests)
 ✓ src/lib/qa/regression.test.ts (6 tests)
 ✓ src/lib/qa/signature.test.ts (6 tests)
 ✓ src/lib/qa/steps.test.ts (6 tests)
 ✓ src/lib/qa/report-summary.test.ts (5 tests)

 Test Files  6 passed (6)
      Tests  36 passed (36)
```

Two assumptions were corrected by these tests rather than papered over:

- A single *low* finding across 10 pages rounds away entirely after normalisation. That is intended; the test pins one page so the weight is visible.
- The explicit "cap the verdict at minor when coverage is thin" branch in `scoring.ts` is unreachable, because the coverage multiplier already pushes a thin crawl below the `ready` threshold. The test asserts the true behaviour (thin coverage is flagged and never `ready`) and the branch stays as a defensive guard.

## Self-test suite

`Load self-test suite` on the **Test projects** page (owner only) creates a project pointing at this app's own published URL with four cases:

1. Landing page returns 200 and the hero heading is visible.
2. The sign-in page shows the email and password fields.
3. The "How it works" section is visible on the landing page.
4. An unknown route shows the not-found page.

These run through the normal automated pipeline, so they only produce results while the `bridges-qa-worker` process is running against the queue. That is the point: it proves the queue, worker, evidence storage, scoring and reporting path end to end on a target we control.

## Manual verification done per phase

Each phase was verified against the live database on throwaway data, then cleaned up: worker claim `200`/`204`, wrong-worker report `409`, unauthenticated claim `401`, duplicate failure signatures producing one AI analysis with `occurrences = 2`, a two-run regression diff with a flipped case, and a generated PDF (2,116 bytes) containing the pass rate, score, diff lines and failure group.
