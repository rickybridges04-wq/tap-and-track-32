## Goal
1. Add a **Sync All** button that scrapes the app's live URL and auto-fills every field, checklist, and data table so registering a new app is a one-click experience.
2. Verify the **Submit to Stores** wizard actually saves each step and produces a valid packet end-to-end.

---

## Part 1 — Sync All (auto-fill from crawl)

### New server function `syncAppFromCrawl` (in `src/lib/apps.functions.ts`)
Given `appId`, load the app, then in parallel via Firecrawl:
- `scrape(base_url, { formats: ['markdown','links','screenshot','branding','summary'] })` → title, description, colors, logo, favicon, fonts, hero image
- `map(base_url, { limit: 50 })` → link inventory (used to detect `/privacy`, `/support`, `/contact`)
- Fetch `/manifest.webmanifest`, `/sw.js`, `/apple-touch-icon.png`, `/icon-192.png`, `/icon-512.png`, `/robots.txt` via `fetch()` (HEAD) → PWA readiness signals
- Pull latest `qa_runs` row for this base URL (if any) → surface beta-test findings

Then update in one transaction:
- **apps**: name (if empty), short_desc (from branding/summary, 80 chars), long_desc (from summary), theme_color + bg_color (from branding.colors), icon_url (from branding.logo), category (heuristic from summary keywords)
- **app_store_submissions** (upsert per store): pre-check PWA items detected (`manifest`, `icon192`, `icon512`, `apple_touch`, `service_worker`, `https`, `responsive`); pre-fill Apple/Google `privacy_url`, `support_url`, `description`, `short_desc`
- **app_tables**: if none exist, seed a `Feedback` table (name/email/message) and a `Contacts` table (name/email) so the Data Manager is ready

Return `{ ok, filled: {...}, warnings: [...] }` for the UI toast.

### UI wiring
- `src/routes/apps.new.tsx`: after `createApp` succeeds, call `syncAppFromCrawl` (only when a base URL was provided) with a "Syncing from your site…" loading state, then navigate to `/apps/$id`.
- `src/routes/apps.$id.tsx`: add a **Sync All** button next to Delete that reruns the sync on demand and refetches. Show last-sync timestamp.
- `src/routes/apps.index.tsx`: add a small Sync icon-button on each card (stops event propagation) for one-click refresh from the list.

### Prereqs
- Firecrawl connector is already linked (`FIRECRAWL_API_KEY` present in secrets), so no new setup.

---

## Part 2 — Verify Submit to Stores works

Reproduce the full flow against the running preview with Playwright:
1. Register a throwaway app with a base URL.
2. Open `/apps/$id/submit`, click through Step 1 → PWA → Apple → Google.
3. Tick every checkbox in each store step, click **Save & continue** / **Mark ready & continue**.
4. Confirm each click round-trips to Supabase (row appears in `app_store_submissions`, progress bar hits 100%, status flips to `ready`).
5. Click **Download submission packet (JSON)** and inspect the file for the three store entries with checklist=true.
6. Fix any breakage found (upsert error, step advancement, packet contents).

Screenshots at each step saved to `/tmp/browser/submit-verify/`; report Built vs Verified per the app-readiness rules.

---

## Files touched
- `src/lib/apps.functions.ts` — add `syncAppFromCrawl`
- `src/routes/apps.new.tsx` — auto-sync after create
- `src/routes/apps.$id.tsx` — Sync All button + last-sync display
- `src/routes/apps.index.tsx` — per-card sync button
- No DB migration needed (existing columns/tables cover it)

## Out of scope
- Real Apple/Google API submission (still manual packet download — no public API for either store).
- Icon generation / resizing (uses detected logo as-is; can add later).