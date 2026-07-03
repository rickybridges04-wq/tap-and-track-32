
# Add app-management suite (appbuild.diy-style) to Walkthrough Wizard

Turns the existing "Projects" area into a full app-management console so users can register an app, prep it as a PWA, walk a store-submission checklist, collect form submissions, and send push notifications — all owner-gated by the existing subscription.

## New sidebar layout
Replace the current "Projects" nav with:
- My Apps
- Submit App
- Published Apps
- Data Manager
- Submissions
- Push Notifications
- Analytics (existing)
- Settings (expanded)

All routes under `_authenticated/`.

## 1. My Apps (`/apps`, `/apps/new`, `/apps/$id`)
Replaces localStorage `projects`. Real table.

Table `apps`: `id`, `user_id`, `name`, `slug`, `base_url`, `icon_url`, `theme_color`, `bg_color`, `short_desc`, `long_desc`, `category`, `status` (`draft` | `pwa_ready` | `submitted` | `published`), timestamps.

Detail page tabs: Overview · PWA config · Submission · Data · Submissions · Notifications.

## 2. Submit App to Stores wizard (`/apps/$id/submit`)
4-step wizard mirroring screenshot:
1. **Select App** (auto if entered from app detail)
2. **PWA** — generate `manifest.webmanifest`, icons (192/512/apple-touch), preview install prompt. Downloadable zip of PWA bundle.
3. **Apple App Store** — checklist: 1024 icon, screenshots (6.7"/6.5"/5.5"), privacy policy URL, support URL, age rating, description ≤4000, keywords ≤100, TestFlight note. Cross-links to existing QA run for the app's URL to prove functionality (Apple 4.2 guard).
4. **Google Play** — checklist: 512 icon, feature graphic 1024×500, screenshots, short desc ≤80, full desc ≤4000, content rating, data-safety form, target API level note.

Each step stores state in `app_submissions` table (`app_id`, `store`, `status`, `checklist jsonb`, `assets jsonb`). Generates a downloadable PDF submission packet.

## 3. Published Apps (`/apps/published`)
Filter of `apps` where `status='published'`. Empty state matches screenshot ("Submit Your First App" CTA → wizard).

## 4. Push Notifications (`/notifications`)
Tabs: Create · Scheduled · Campaign History.

Tables:
- `notification_subscribers` (`app_id`, `endpoint`, `p256dh`, `auth`, `user_agent`, `created_at`, `unsubscribed_at`)
- `notification_campaigns` (`app_id`, `title`, `body`, `image_url`, `url`, `scheduled_for`, `sent_at`, `sent_count`, `status`)

Server fns: `subscribePush`, `unsubscribePush`, `createCampaign`, `sendCampaign`. Uses `web-push` from a TanStack server route (`/api/public/push/subscribe` for external apps to register). VAPID keys stored as secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) — generated on setup.

Sending is done from a server fn; scheduled sends run via `pg_cron` → `/api/public/push/dispatch` (apikey header).

## 5. Data Manager (`/data`)
Per-app key-value / table view. `app_tables` (`app_id`, `name`, `schema jsonb`) + `app_rows` (`table_id`, `data jsonb`). CRUD UI with dynamic columns. Scoped to app owner.

## 6. Submissions (`/submissions`)
Form-submission inbox for each app. Table `app_submissions_inbox` (`app_id`, `form_name`, `payload jsonb`, `created_at`, `read_at`). Public endpoint `/api/public/forms/$appId/$formName` (POST) that external apps POST to. List/detail views with export CSV.

## 7. Expanded Account Settings (`/settings`)
Tabs: Profile · Security · Billing · Preferences.
- Profile: first/last name, phone, avatar (add columns to `profiles`).
- Security: change password, sign out all sessions.
- Billing: Stripe customer portal link + current plan.
- Preferences: theme (Light / OS / Dark) persisted to `profiles.theme_pref`.

## 8. Theme switcher
Add small Light/OS/Dark toggle to sidebar footer + Settings. Persist to `profiles.theme_pref`, applied via `<html class>` on root.

---

## Owner + paywall
All new routes respect existing subscription gate — owner unlimited, others 3-free then Pro. Push sends and store PDF export count as `usage_events` kinds `push_send` and `store_submit`.

## Migrations (single pass)
- `apps`, `app_submissions`, `app_tables`, `app_rows`, `app_submissions_inbox`, `notification_subscribers`, `notification_campaigns`
- Extend `profiles` with `first_name`, `last_name`, `phone`, `avatar_url`, `theme_pref`
- RLS + GRANTs on every new table (owner reads all; users own rows only)
- `pg_cron` job for scheduled push dispatch

## Deps to add
`web-push`, `jspdf` (submission packet), `qrcode` (PWA install QR).

## Files (high level)
- Routes: `src/routes/_authenticated/apps.*`, `notifications.*`, `data.*`, `submissions.*`, `settings.*` (expanded)
- Server fns: `src/lib/apps.functions.ts`, `push.functions.ts`, `data.functions.ts`, `submissions.functions.ts`, `pwa.functions.ts`
- Server routes: `src/routes/api.public.push.*`, `api.public.forms.$appId.$formName.tsx`
- Components: `AppCard`, `SubmitWizard`, `PwaPreview`, `NotificationComposer`, `SubscriberList`, `DataTableEditor`, `ThemeToggle`, `AccountTabs`

## Out of scope
- Real .ipa/.aab build pipeline (Capacitor/TWA) — chosen path is "PWA + guided store submission"
- iOS native push (APNs) — only web push
- Auto-submission to App Store Connect / Play Console — user uploads generated packet themselves
