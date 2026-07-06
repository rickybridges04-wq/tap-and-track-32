## Problem

Today's three runs on the same target scored very differently because they used different depth + persona counts, not because the app changed:

- deep + 25 personas → ~275 findings, 9 criticals → low score
- standard/quick + 4 personas → ~45 findings, 2 criticals → higher score

`computeScore` in `src/lib/qa/scoring.ts` sums a per-finding weight into `funcPenalty / visualPenalty / a11yPenalty` with no denominator, so more coverage mechanically drives the score down. Two runs with identical per-page/per-persona quality get very different scores.

## Fix: normalize penalties by workload

Change `computeScore` (only file touched for logic) so each category penalty is divided by an "inspection units" denominator instead of being a raw sum.

**Inspection units** = `max(1, pagesCrawled × personaCount)` — passed in as a new arg. This is the number of (page × persona) inspections that could have produced findings.

Rescaled per category:
```
rawPenalty  = Σ WEIGHT[severity] × confidence         // as today
density     = rawPenalty / inspectionUnits             // penalty per inspection
normalized  = density × NORMALIZATION_CONSTANT (e.g. 12)
score_cat   = clamp(0, 100 - normalized)
```

`NORMALIZATION_CONSTANT` picked so a "typical" run (~1 medium finding per 4 inspections) lands near current standard-run scores — calibrated against the 18:17 standard run so historical scores stay in the same ballpark.

Criticals keep an **absolute floor**: any `critical` finding still forces `verdict = "block"` regardless of density (unchanged), so normalization can't hide a hard blocker.

## Call-site changes

- `src/routes/qa.runs.$runId.tsx` — pass `run.personas.length` as the new arg to `computeScore` (already available in the component). No UI change.
- `src/routes/qa.index.tsx` — same, wherever the list computes a score (verify during implementation; add arg if used).
- Any other caller of `computeScore` gets the new arg.

Signature change:
```ts
computeScore(findings, pagesCrawled, linksDiscovered, personaCount)
```

## Small UI addition (run detail)

Under the readiness number, add a one-line footnote:
`Normalized across N pages × M personas` — so users understand the score is coverage-adjusted and two runs at different depths are directly comparable.

## Out of scope

- No DB migration, no schema change, no re-scoring of historical runs on read (they'll just recompute with the new formula next time they're viewed — that's fine, scoring lives client-side).
- No change to finding generation, crawler, or personas.
- No change to the root-cause analyzer added last turn.

## Files touched

- `src/lib/qa/scoring.ts` — new signature + normalized formula + calibration constant
- `src/routes/qa.runs.$runId.tsx` — pass `personaCount`, add footnote line
- `src/routes/qa.index.tsx` — pass `personaCount` if it calls `computeScore`

## Verification

- `bunx tsgo --noEmit` clean
- Re-open the three runs above and confirm the standard, quick, and deep runs land within a much tighter band, while the deep run's `verdict` still shows `block` because of its 9 criticals.
