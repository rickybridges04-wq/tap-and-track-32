# Play Store listing — Walkthrough Wizard QAOS

- **App name:** Walkthrough Wizard QAOS
- **Package / applicationId:** `com.bridgesai.walkthroughwizard`
- **versionCode:** 1 — **versionName:** 1.0.0
- **Category:** Developer tools / Business
- **Contains ads:** No
- **In-app purchases:** Yes (subscription via Stripe web checkout)

## Assets

| Asset | Size | Path | Status |
|---|---|---|---|
| High-res icon | 512x512 | `resources/play-icon-512.png` | Generated |
| Feature graphic | 1024x500 | `resources/feature-graphic-1024x500.png` | Generated |
| Adaptive launcher icon | all densities | `android/app/src/main/res/mipmap-*` | Generated |
| Splash screens | port + land, all densities | `android/app/src/main/res/drawable-*` | Generated |
| Phone screenshots (2+ required) | 1080x1920 or similar | — | **Pending — must be captured from the running app** |

## Short description (80 char max)

> Crawl any web app, score its release readiness, and fix what blocks launch.

(74 characters)

## Full description

Walkthrough Wizard QAOS is a release-readiness workstation for people who ship web apps.

Point it at a URL. It maps the site, pulls each page, captures a rendered screenshot and the real HTTP status and response time, then reviews every page through a set of user personas — first-time visitor, mobile-only user, power user, skeptic. What comes back is a scored readiness report: what is broken, what is confusing, what will get a store submission rejected, and what is merely cosmetic.

Every finding carries its basis. Findings backed by an observed screenshot, status code, or measured latency are marked as observed. Findings inferred only from page text are marked as inferred and are kept out of the headline score, listed separately as items that still need a human check. Coverage — pages discovered versus pages actually inspected — is shown on every run, so a shallow crawl cannot masquerade as a clean bill of health.

What is inside:

- Synapse QA OS — persona-based crawls with readiness scoring, evidence badges, and honest coverage reporting.
- Root-cause analysis — pull every finding from a run into one place and cluster it into a short list of unified fixes instead of a wall of duplicates.
- AI agent roster — Debug, SRE, Performance, Security, CFO, PM and more, each with a scoped tool set. Risky actions are held for explicit approval before anything runs.
- My Apps — a registry of the apps you ship, with one-tap sync that fills app metadata, branding, and PWA readiness straight from a crawl.
- Submit to Stores — a guided four-step submission workflow covering PWA, Apple, and Google Play requirements, producing a submission packet you can hand to a store console.
- Data manager and form submissions — lightweight tables plus a public endpoint for collecting form posts from your own apps.
- Push notification campaigns, run history, analytics, and a developer diagnostics panel showing the current session, database reachability, and the last failing function.

Built by Bridges AI Enterprises. The app reports what it actually measured — nothing is marked verified without evidence behind it.

## Notes on wording

No diagnostic, medical, financial, or legal claims are made. Readiness scores are described as measurements and reviews, never as guarantees of store approval.
