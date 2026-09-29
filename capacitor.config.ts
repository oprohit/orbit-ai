/**
 * ORBIT AI — Android-ready via Capacitor (same React/Next codebase).
 *
 * The web app ships a mobile layout (bottom tab bar: Home · Tasks · Goals ·
 * Approvals · Profile) so the same bundle runs on Android.
 *
 * To build the Android shell:
 *   npm i @capacitor/core @capacitor/cli @capacitor/android
 *   npx cap add android
 *   npx cap sync android
 *
 * Notifications, approvals and connector status all work over the same
 * /api routes; push delivery is provided by the Notification Bridge plugin.
 */
export default {
  appId: "ai.orbit.app",
  appName: "Orbit AI",
  webDir: "out",
  server: {
    androidScheme: "https",
    url: process.env.NEXT_PUBLIC_ORBIT_URL,
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      icon: "orbit-badge",
      clearOnLaunch: false,
      showBadge: true,
    },
  },
};
