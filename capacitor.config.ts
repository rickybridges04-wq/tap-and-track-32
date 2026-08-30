import type { CapacitorConfig } from "@capacitor/cli";

// The app is a server-rendered TanStack Start site, so the native shell loads
// the published deployment instead of a bundled static build.
const config: CapacitorConfig = {
  appId: "com.bridgesai.walkthroughwizard",
  appName: "Walkthrough Wizard QAOS",
  webDir: "public",
  android: {
    allowMixedContent: false,
  },
  server: {
    url: "https://tap-and-track-32.lovable.app",
    androidScheme: "https",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0a0a18",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
  },
};

export default config;
