## Overall diagnosis

All 17 findings collapse into two root causes on `/projects`:

1. **No public entry point** — unauthenticated visits to `/projects` silently redirect to `/auth`, so the reviewer only ever saw the auth form and judged it as the product's landing page. That explains findings 1, 2, 3, 10, 17 (and the "conflicting branding" — the URL says `/projects` but the page renders "Welcome back").
2. **The auth form itself is under-polished** — no `<label htmlFor>`, weak focus rings, small tap targets, weak CTA hierarchy, low-contrast helper text, no inline validation, unlabeled Google button. That covers findings 4–9, 11–16.

Fixing both root causes clears all 17 findings.

## Fix plan

### 1. Public landing + honest redirect (fixes 1, 2, 3, 10, 17)
- `src/routes/index.tsx`: make the home route render a real public landing page — hero, "How it works" (Crawl → Inspect → Score → Fix), what a "run" is, 3-free-runs callout, and a primary "Get started" CTA to `/auth`. If the user is already signed in, keep the current authed dashboard.
- Protected routes (`/projects`, `/qa`, `/agents`, `/apps`, etc.): when unauthenticated, redirect to `/auth?redirect=<path>` and show a toast "Sign in to continue" instead of a silent bounce. `/auth` already redirects home post-login; extend it to honor `redirect`.
- `/auth` head: keep title "Sign in · Walkthrough Wizard QAOS" so title/URL/header align (no more "Welcome back" on `/projects`).

### 2. Auth form accessibility + polish (fixes 4–9, 11–16)
Edit `src/routes/auth.tsx`:
- Replace hand-written labels with `<Label htmlFor>` bound to input `id`s (email, password).
- Add `aria-label="Continue with Google"` on the Google button and a visible focus ring; ensure it's a real `<button>` (already is) with `focus-visible:ring-2 ring-ring`.
- Add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` to inputs.
- Promote heading to a single `<h1>` for the page; brand mark gets `aria-label="Walkthrough Wizard QAOS home"`.
- Inline validation: show error text under email/password on submit when empty/invalid; disable submit only while busy.
- Turn "Need an account? Sign up" into a full-width secondary button (min-h-11) instead of a tiny text link — meets 44px tap target and strengthens CTA hierarchy.
- Add vertical spacing (`space-y-4`, divider margin) between primary submit and mode-toggle.
- Bump helper copy ("3 free QA / agent runs…") from `text-muted-foreground` to `text-foreground/80` for ≥4.5:1 contrast, and move the promotional "3 free runs" line to a small badge under the H1 (kept, but de-emphasized) — the reviewer's concern was location, not existence.
- Wrap form in a `min-h-dvh` scrollable container so mobile keyboards don't obscure it.

### 3. No business logic changes
Auth flow, Supabase calls, subscription logic, and routing context stay as-is. Purely presentation + one new public landing route body + one redirect-with-toast helper.

## Files touched
- `src/routes/index.tsx` — new public landing (authed users see current dashboard)
- `src/routes/auth.tsx` — labels, focus rings, h1, validation, CTA hierarchy, spacing, contrast, honor `?redirect=`
- Protected route guards (`/projects`, `/qa`, `/agents`, `/apps`, `/analytics`, etc.) — swap silent redirect for `navigate({to:'/auth', search:{redirect}})` + toast. Likely a small shared `useRequireAuth()` hook in `src/hooks/useAuth.tsx`.

No DB, no server functions, no new deps.
