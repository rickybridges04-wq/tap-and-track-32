## Goal
Monetize Walkthrough Wizard QAOS as a subscription (2 free QA runs, then paywall), give it a real app icon, and make it installable on your phone.

## 1. Payments — Stripe subscription
Run `recommend_payment_provider` then enable Stripe via `enable_stripe_payments` (built-in, no account needed to start in test mode). Create one subscription product:
- **Pro** — single monthly tier, unlimited QA runs + agent tasks.
Price + exact $ to be set when we create the product (I'll ask before creating).

## 2. Free-trial gate (paywall after 2 runs)
- Add `src/lib/usage-store.ts` — tracks lifetime count of completed QA runs in localStorage (`bridges.usage.qaRuns`). When Cloud/Stripe is live, this moves to a `usage` table keyed by user.
- Add `src/lib/subscription.ts` — `useSubscription()` hook. Returns `{ status: "trial" | "active", runsUsed, runsRemaining, canRun }`. `active` once Stripe webhook flips a flag; until then, `canRun = runsUsed < 2`.
- Gate `src/routes/qa.new.tsx` "Start crawl" button: if `!canRun`, show a `<PaywallCard />` with run counter + "Upgrade" CTA instead of starting the run.
- Same gate on `src/components/RunAgentDialog.tsx` submit (agent tasks count toward the same 2-run budget so both surfaces are covered).
- New route `src/routes/upgrade.tsx` — pricing card, "Subscribe" button → Stripe Checkout.
- Webhook `src/routes/api/public/webhooks.stripe.tsx` — on `checkout.session.completed` / `customer.subscription.updated`, mark the user active. Until Cloud is on, this flag also lives in localStorage as `bridges.subscription.active`.

## 3. App icon
Generate a premium 1024×1024 icon matching the Deep Cosmic theme (neon gradient wizard/wand glyph on dark) → `public/icon-512.png` + `public/icon-192.png` + `public/apple-touch-icon.png` + `public/favicon.ico`.

## 4. Installable PWA (manifest-only — home-screen install, no offline)
- `public/manifest.webmanifest` with name "Walkthrough Wizard QAOS", short_name "Wizard QAOS", `display: standalone`, theme/bg colors from cosmic theme, icons above.
- Add `<link rel="manifest">`, `theme-color`, `apple-touch-icon` to `src/routes/__root.tsx` head.
- No service worker, no `vite-plugin-pwa` (per skill/pwa rules — you asked for install, not offline).

## 5. Install instructions
After build, I'll give you the published URL + 1-tap install steps for iOS (Share → Add to Home Screen) and Android (Chrome menu → Install app). I can't push-install to your device remotely — only the browser prompt can.

## Questions before I build
1. **Subscription price** — $19/mo? $29/mo? Something else?
2. **Trial budget** — you said "after the testing of the first two apps." I read that as 2 total QA runs free, then paywall. Correct, or did you mean 2 QA runs *per project*?

## Out of scope
Annual plan, team seats, coupon codes, in-app upgrade modal animations — easy to add after the base is live.