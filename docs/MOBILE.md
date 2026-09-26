# Mobile (Android / iOS) with Capacitor

The mobile app is the same Vite build packaged by Capacitor 8 with native
plugins (ADR-0005). The native projects are generated, not committed.

## Prerequisites (Windows)

- Node 22, pnpm 11.
- Android Studio with SDK Platform 36 and Build-Tools 36.
- **JDK 21.** Capacitor 8's Android library compiles with source release 21,
  so Android Studio's bundled JDK 17 fails with `invalid source release: 21`.
  A portable Temurin 21 zip is enough; no system install is needed:

  ```
  # Git Bash
  export JAVA_HOME="$LOCALAPPDATA/jdk-21"          # unzipped Temurin 21
  export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
  ```

- The first Gradle build downloads about 2.5 GB of dependencies into
  `~/.gradle`; later builds run from that cache.
- For iOS: macOS with Xcode.

## Point the app at your API

The packaged app cannot use the Vite proxy, so set the API origin at build time:

```
# apps/client/.env.production
VITE_API_BASE_URL=https://your-api.example.com
```

and allow the WebView origins on the API:

```
CLIENT_ORIGINS=https://your-web.example.com,capacitor://localhost,https://localhost
```

For a phone on the same network during development, use your machine's LAN
IP (`http://192.168.x.x:8787`) and add it to `CLIENT_ORIGINS`. Android blocks
cleartext HTTP by default; for LAN testing add
`android:usesCleartextTraffic="true"` to the generated manifest or use an
HTTPS tunnel.

## First-time setup

```
pnpm --filter @lunara/client cap:add:android   # generates apps/client/android
```

## Build a debug APK

```
# Git Bash, from the repo root; point the app at the hosted API
export VITE_API_BASE_URL=https://strat-api.vercel.app
pnpm --filter @lunara/client cap:sync          # vite build + cap sync
cd apps/client/android
./gradlew.bat :app:assembleDebug
# -> apps/client/android/app/build/outputs/apk/debug/app-debug.apk
```

Build `:app:assembleDebug`, not plain `assembleDebug`. The plain task also
packages every Capacitor plugin as a library, which downloads the Android
lint toolchain (hundreds of MB, and it times out on slow connections) for
no benefit to the app.

Or `pnpm --filter @lunara/client cap:open:android` and press Run in Android
Studio with a device connected.

## Release APK

`gradlew.bat assembleRelease` produces an unsigned APK; sign it with
`keytool` + `apksigner` (see Android docs) or use Android Studio's
*Build > Generate Signed Bundle / APK* wizard. Never commit keystores.

## Auth on mobile

Cookies are unreliable from the Capacitor origins, so the client stores the
Better Auth bearer token in Capacitor Preferences and sends it as
`Authorization: Bearer …`. The API exposes the `set-auth-token` header via
CORS for this purpose.

## Status

- 2026-09-26: debug APK built with JDK 21 against the hosted API and tested
  on the Pixel 6 API 34 emulator (WebView 113): sign-up, onboarding, token
  stored in Capacitor Preferences, session with coach reply, and sign-in
  surviving an app restart. No JavaScript errors apart from Capacitor's
  harmless "Error injecting safe area CSS" message at startup.
- The generated `apps/client/android` project is not committed; the local
  copy uses Gradle 8.14 and has `local.properties` pointing at the SDK.
- Not yet done: a signed release build, app icons and splash assets, and
  wiring local notifications for briefing reminders.
