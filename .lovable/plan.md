## Goal

Make the Step 2 — Secrets card on `/settings` actually accept input. You can paste each value now, save it, and reveal/clear it. Values are stored locally until Lovable Cloud is enabled — then a single "Promote to Cloud" action will move them into real Cloud secrets.

## Changes

### `src/routes/settings.tsx`
- For each secret row, add:
  - A masked `<Input type="password">` with show/hide eye toggle
  - "Save" button (writes to localStorage via the new store)
  - "Clear" button (removes it)
  - A small status pill: `Not set` / `Saved locally` / `Managed by Lovable` (for `LOVABLE_API_KEY`, which stays read-only)
- Keep the existing "Get it" external link on each row.
- `LOVABLE_API_KEY` row stays informational (no input) — it's auto-provisioned.
- Add a top-of-card note: "Stored in this browser only until Cloud is enabled. Don't paste production secrets on a shared device."

### `src/lib/secrets-store.ts` (new)
- Tiny localStorage wrapper: `getSecret(name)`, `setSecret(name, value)`, `clearSecret(name)`, `listSecrets()`.
- Namespaced key: `bridges.secrets.v1.<NAME>`.
- Uses the same `useMounted` pattern already used in `agent-store.ts` so SSR/CSR don't mismatch.

### Agent runner / tools wiring (light touch)
- `src/lib/agent-tools.ts`: when a tool needs `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `RESEND_API_KEY`, or `TESTER_WEBHOOK_SECRET`, read from `getSecret(...)` first. If missing, the tool returns a structured "missing_secret" result instead of failing silently — the agent run shows it in the timeline and the task surfaces "needs secret: X" so you know exactly what to paste on `/settings`.
- No behavior change for `LOVABLE_API_KEY` (server-side, already provisioned).

## Out of scope
- Real Cloud secret promotion (one-click "Move to Cloud") — stub button shown but disabled with tooltip "Enable Lovable Cloud first." Wired up once Cloud is on.
- Server-side use of these secrets. They remain client-side until Cloud is on; the runner today is client-driven so this is fine for simulated execution.

## Security note
Browser localStorage is fine for dev/simulated mode but is readable by any script on the origin. The card will say so. Real production secrets should land in Lovable Cloud secrets (Step 1) — this is explicitly a stopgap so you can paste keys the moment you receive them.
