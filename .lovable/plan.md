## Root cause

`inspectPage` in `src/lib/qa/inspector.functions.ts` uses `Output.object({ schema: InspectionSchema })` with a very tight Zod schema:

- `title` max 120, `detail` max 800, `summary` max 280, `suggestion` max 400
- `severity` and `category` as strict enums
- `suggestion` optional (Gemini often returns `null` instead of omitting)
- `confidence` strictly `[0, 1]`

Gemini 3 Flash regularly overshoots those caps or emits `null` for optional fields. The AI SDK then throws `NoObjectGeneratedError` ("response did not match schema") and the entire call is discarded. Reproduced against `https://example.com` with the first-time-visitor persona — every call fails, so the runner ends with "All inspections failed".

The runner-side retry/soft-warning work is already in place. The real fix is at the schema/parsing boundary.

## Fix

Rewrite the inspector to be tolerant of imperfect model output, in a single file:

**`src/lib/qa/inspector.functions.ts`**
1. Loosen the schema handed to the model:
   - Remove `.max()` on `title`, `detail`, `summary`, `suggestion`.
   - Allow `suggestion: z.string().nullable().optional()`.
   - Widen `confidence` to `z.number()` and clamp in post-processing.
   - Keep `severity`/`category` as enums but coerce common variants (`"warn"` → `"medium"`, uppercase → lowercase, unknown → `"medium"` / `"functional"`).
2. Split into a strict wire schema (for parsing) + a normalizer that truncates strings, clamps confidence to `[0, 1]`, drops `null` suggestion, and filters findings whose required fields are missing.
3. Wrap the `generateText` call so that on `NoObjectGeneratedError` (or any parse error) we:
   - Fall back to a plain `generateText` call (no `Output`) asking explicitly for JSON.
   - Extract the first `{...}` JSON block and parse it.
   - Run it through the normalizer. If still unusable, return `{ ok: false, error: <original message + raw preview> }` so the runner logs a useful warning instead of a bare "response did not match schema".
4. Cap findings at 6 after normalization (matches current prompt).

No changes to `runner.ts` — its retry + soft-warning behavior is correct once the inspector stops throwing on cosmetic schema drift. The existing "N steps skipped" UI in `qa.runs.$runId.tsx` will surface any residual failures.

## Verification

- Re-run the reproduction (`inspectPage` against `https://example.com`, persona `first_time`) and confirm `ok: true` with a non-empty summary and 0-plus findings.
- Start a quick crawl from `/qa/new` on a real URL and confirm the run reaches `completed` with findings, not `failed`.

## Out of scope

- Switching model provider or model name (Gemini 3 Flash works; the problem is schema strictness, not the model).
- Changing crawl depth limits, persona set, or scoring.
- Server-side persistence of runs (still localStorage).
