# App Readiness Rules (Condensed — Workspace Knowledge)

## Rules
1. Never report a feature "complete/working/deployed" without evidence (screenshot, log, network trace, test result). Uncertainty must be stated, not hidden.
2. Fabricated status is worse than honest failure.
3. No button/link/form may exist without a real connected backend action. Mock data must be labeled "Demo Mode" — never presented as live.
4. API keys called server-side only (Edge Functions). Client-side exposure = Tier 1 blocking violation.
5. Validate input client + server side. RLS enabled and tested on every user-data table.
6. Decisions beyond agent's tier → escalate to founder, don't guess.

## Skills
- **Trace**: follow each feature from UI action → API call → backend handler → DB → response. Identify where the chain breaks.
- **Flow-test**: walk full user journeys (signup→onboarding→core action→payment→confirmation), including edge cases (empty input, no network, expired session, double-submit).
- **Security-audit**: grep for exposed keys/secrets in client code; confirm RLS matches intended access.
- **Store-check**: cross-check build against Apple 4.2 / Google Play minimum-functionality policy before submission.
- **Report**: always separate "Built" from "Verified" — never merge them.

## Known Failure Patterns
- Hardcoded metrics posted as live/verified data.
- Success notifications firing before deploy/metric-check steps complete.
- UI shells with no backend — the #1 recurring blocker across this portfolio.

## Priority Tie-Break
Profit → Growth → Impact → Freedom. Smaller verified feature > larger unverified one.

## Verification Protocol (required before marking anything complete)
1. **Inventory** — classify every screen/button/form: Fully Connected / Partial / Not Connected / Unknown.
2. **Analyze** — trace break point for anything not Fully Connected; check against Known Failure Patterns; assign severity (Blocking / Degraded / Cosmetic).
3. **Fix** — Blocking items first, in journey order (auth→core→payment→confirmation→secondary). Document what/why/how tested.
4. **Verify** — re-test the exact failing flow, capture evidence, update Inventory, log to Verification Log.

## Status Report Format
```
Feature: [name]
Claimed: [Built/Partial/Not Started]
Verified: [Verified/Unverified/Failed]
Evidence: [attach or "none — flagging unverified"]
Severity: [Blocking/Degraded/Cosmetic]
Next: [fix/re-test/escalate]
```

## Founder Override
Only Ricky (Tier 4) can approve: store-ready sign-off, shipping a "Degraded" item with known limitation, or a Demo Mode exception to the No Shell UI Rule. No agent self-approves these.

*Full version with detailed rationale: app-readiness-agent-rules.md (Project Knowledge / AGENTS.md).*
