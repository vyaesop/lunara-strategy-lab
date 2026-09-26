# Mobile (Android / iOS) with Capacitor

The mobile app is the same Vite build packaged by Capacitor 8 with native
plugins (ADR-0005). The native projects are generated, not committed.

## Prerequisites (Windows)

- Node 22, pnpm 11.
- Android Studio with SDK Platform 36, Build-Tools 36 and the bundled JDK 17
  (Android Gradle Plugin requires it; plain Java 11/19 will not work).
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
pnpm --filter @lunara/client cap:sync          # vite build + cap sync
cd apps/client/android
gradlew.bat assembleDebug
# → apps/client/android/app/build/outputs/apk/debug/app-debug.apk
```

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

- Capacitor config and native plugins are wired; `cap add android` has not
  been run in this repository yet (Android SDK present on the dev machine,
  build not exercised). See `docs/PROJECT_STATUS.md`.
