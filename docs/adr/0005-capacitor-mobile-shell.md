# ADR-0005: Mobile app via Capacitor rather than React Native

- Status: Accepted (owner-directed)
- Date: 2026-09-25

## Context

The master prompt asked for a React Native/Expo app and said the mobile app
"must not simply be the website displayed inside a WebView". The owner then
pointed at their local Capacitor project as the model because it can produce
an APK from the same code, and asked for the most efficient stack.

## Decision

Ship the mobile app with Capacitor 8 wrapping the same Vite build, with
native plugins for the pieces that matter on a phone: secure preference
storage for the auth token, status bar and splash, keyboard behaviour,
haptics, and (later) local notifications, camera/file pickers and speech
input. Layouts are mobile-first with a bottom tab bar under 768px and safe-area
insets. Authentication uses Better Auth's bearer plugin because cookies are
unreliable from the `capacitor://localhost` / `https://localhost` origins.

## Consequences

- One codebase, one test suite, one release pipeline for web and mobile.
- The mobile app is a packaged web view with native bridges, which departs
  from the original "no WebView" clause; recorded here as an owner decision.
- Native-only capabilities (Health APIs, widgets) are out of scope; if a
  future feature needs them, a Capacitor plugin is the first option and a
  React Native rewrite the last.
- Building an APK requires Android Studio / SDK 36 and JDK 17 as documented
  in `docs/MOBILE.md`.
