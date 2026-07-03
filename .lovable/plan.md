
## Goal
Turn Walkthrough Wizard QAOS into a real subscription product: 3 free runs for everyone, unlimited free for you (rickybridges04@gmail.com), Stripe-powered paywall for everyone else, in-app analytics, and a few store-readiness features that fit the app's purpose (App Store / Play Store QA).

---

## 1. Auth (required — owner bypass needs a real user)
Owner-only unlimited access can't work on localStorage. We need real accounts.

- Enable email + Google sign-in via Lovable Cloud auth.
- Add `src/routes/auth.tsx` (sign in / sign up) and move existing app routes under `src/routes/_authenticated/` so the whole app requires login.
- Create `profiles` table (id, email, created_at) auto-populated on signup via trigger.
- Create `user_roles` table + `has_role()` security-definer function (per workspace user-roles rule). Seed `rickybridges04@gmail.com` as role `owner` on first login via trigger.

## 2. Usage tracking (move off localStorage)
- Table `usage_events` (id, user_id, kind: 'qa_run' | 'agent_task', created_at). RLS: users read/insert own; owner reads all.
- Server fn `getUsage()` returns `{ runsUsed, runsRemaining, isOwner, isSubscribed }`.
- Rewrite `src/lib/subscription.ts` `useSubscription()` to call that server fn instead of localStorage. `canRun = isOwner || isSubscribed || runsUsed < 3`.
- Increment via server fn `recordRun({ kind })` called from `qa.new.tsx` and `RunAgentDialog.tsx` right before starting a run.
- Free limit: **3** (was 2).

## 3. Stripe subscription (real, not local)
- Run `recommend_payment_provider` → `enable_stripe_payments` (Lovable-managed, no BYOK).
- Create one product: **Pro — $29/month**, unlimited QA runs + agent tasks. (Rationale: this app runs multiple AI calls per crawl; $19 barely covers heavy users. $29 gives margin and matches "pro dev tool" positioning. Confirm before I create it.)
- Table `subscriptions` (user_id PK, stripe_customer_id, stripe_subscription_id, status, current_period_end). RLS: user reads own.
- Rewrite `src/routes/upgrade.tsx` "Subscribe" button to call server fn `createCheckoutSession()` → redirect to Stripe Checkout.
- Server route `src/routes/api/public/webhooks.stripe.tsx` — verifies Stripe signature, upserts `subscriptions` row on `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- Add "Manage billing" button (Stripe customer portal) in `src/routes/settings.tsx`.

## 4. Owner bypass
- `getUsage()` returns `isOwner: true` when `has_role(auth.uid(), 'owner')`.
- All gates (`canRun`, paywall card, "Upgrade to run" button label) skip for owner.
- Owner sees a small "Owner · unlimited" badge instead of the trial counter.

## 5. Analytics dashboard
New route `src/routes/analytics.tsx` (owner-only; regular users see their own numbers only).
Cards + charts (recharts, already available):
- Total signups, active subscribers, MRR (subscribers × $29).
- Runs per day (last 30d), QA vs agent split.
- Free → paid conversion rate.
- Top target URLs tested.
- Per-user table: email, runs used, subscription status, last active.

Data via server fns reading `profiles`, `usage_events`, `subscriptions`, `qa_runs` (add table if missing — currently runs live in localStorage; migrate qa runs to DB in the same pass so analytics has real data).

## 6. Store-readiness features (fits the product's purpose)
Small additions that make this actually useful for App Store / Play Store QA:
- **Store-readiness checklist** on each QA run detail page: privacy policy link present, terms link present, icon meets 1024×1024, no lorem-ipsum copy, no broken links, no console errors, HTTPS only, meta description present. Rendered as pass/fail rows with fix suggestions. (Runs against already-crawled pages — no new AI calls.)
- **Apple 4.2 / Google Play minimum-functionality guard**: flag runs where >50% of buttons on a page have no click handler or lead to empty routes (matches the workspace "no shell UI" rule).
- **Downloadable PDF report** per run (jsPDF) for submitting alongside store review or sharing with clients.

## 7. Cleanup
- Delete localStorage-based `subscription.ts` compute path; keep the hook signature so callers don't change.
- Update `PaywallCard` copy: "3 free runs" instead of 2.
- Update `upgrade.tsx` pricing card: $29/mo, remove the local "Reset to trial (dev)" button.

---

## Technical notes
- All secret Stripe keys live in Cloud secrets, called only from server fns / webhook route.
- Webhook signature verification uses `STRIPE_WEBHOOK_SECRET` (added via `add_secret` after `enable_stripe_payments`).
- RLS on every new table; owner role checked via `has_role()`, never via email string in client code.
- Auth-gated routes go under `_authenticated/` per the integration-managed layout — I won't hand-write the gate.

## Questions before I build
1. **Price** — I'm proposing **$29/month**. OK, or do you want $19 / $39 / something else?
2. **Sign-in methods** — Email + Google, or Google only?
3. **Analytics scope** — Owner-only dashboard, or should regular users also see their own usage page?
4. **Store-readiness extras** — Want all three (checklist + shell-UI guard + PDF export), or trim?
