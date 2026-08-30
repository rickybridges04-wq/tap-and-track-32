# Store submission checklist — Walkthrough Wizard QAOS

Package: `com.bridgesai.walkthroughwizard` · versionCode 1 · versionName 1.0.0

## Native wrapper (AAB-ready, not built)

- Capacitor 8 installed; `capacitor.config.ts` at project root.
- `android/` platform added and synced.
- Native shell loads the published deployment (`https://tap-and-track-32.lovable.app`); mixed content and cleartext are disabled.
- Permissions: `INTERNET` only — nothing else is requested because no native feature needs it.
- No deep links / intent filters configured (the app uses none).
- Offline fallback: `OfflineBanner` renders an explicit offline state instead of a blank webview.
- Adaptive launcher icon background `#0A0A18`, foreground generated from the app icon art.

**A signed AAB has NOT been built.** This environment has no Android SDK, JDK, or keystore. Build it with `npx cap open android` locally (Android Studio → Build → Generate Signed Bundle) or through CI.

## Compliance

- **Privacy policy:** https://rickybridges04-wq.github.io/bae-privacy-policies/apps/walkthrough-wizard-qaos.md
- **Content rating questionnaire:** pending — completed manually inside Play Console.
- **Data Safety section:** pending — completed manually inside Play Console. Declare: account email, app URLs the user submits, crawl results; data is transmitted and stored; account deletion available on request.
- **Ads:** No.
- **In-app purchases:** subscription is billed through Stripe on the web, not Play Billing — confirm this is acceptable for the chosen category before submission, or gate the purchase out of the Android build.

## Remaining human actions

1. Build and sign the AAB outside this sandbox.
2. Capture 2+ phone screenshots from the live app.
3. Fill Content rating + Data Safety in Play Console.
4. Upload to a closed testing track and opt in 12+ testers to start the 14-day clock.
5. Set the `AI_GATEWAY_API_KEY` secret and register this app in the gateway's `apps` table.
