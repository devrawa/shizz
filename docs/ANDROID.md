# Android app build and installation

## What this delivery is

A **Capacitor 7 Android source project**, not a prebuilt APK. The web client has been typechecked and built; the native project has been generated and synced. The sandbox did not have an Android SDK/JDK 21 device build environment, so Gradle compilation, signing, emulator tests and physical-device tests were **not performed**.

This is an honest starting implementation, not a claim of store readiness. The project targets SDK 35 and minimum SDK 26 (Android 8). Store submission in your year may require a newer target SDK, Capacitor update or additional policy review. Use an up-to-date Android System WebView. Beta speech features must be evaluated on the device you intend to use.

## Local build (recommended)

1. Install Node.js 20+, Android Studio, JDK 21, Android SDK Platform 35 and build tools.
2. Review/accept SDK licenses yourself through Android Studio or your SDK manager. Set `ANDROID_HOME` and `JAVA_HOME` appropriately.
3. Deploy your private backend over HTTPS. The app can accept its URL in Settings; it is **not** compiled with a provider key.
4. From the extracted project:

```bash
bash scripts/build-android.sh
```

Equivalent steps:

```bash
cd mobile
npm ci
npm run build
npx cap sync android
npx cap open android
```

Select your device in Android Studio and run a debug build. Or:

```bash
cd android
./gradlew assembleDebug
```

The expected debug APK path is `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Install on your own test device using Android Studio or `adb install -r` with that path. A debug APK is not a store release. Treat enabling “install unknown apps” as a temporary, deliberate security decision; do not install files from untrusted people.

## Optional remote build recipe

An on-demand CI workflow is included at `.github/workflows/android-debug.yml`. If you deliberately place this source in a repository under your control, review that workflow, then run **Build Android debug APK**. It sets up Node 20, JDK 21 and SDK 35, syncs Capacitor, invokes Gradle and uploads a debug APK artifact. It has not been run or connected to any of your accounts. Review build-service costs, action permissions and SDK-license terms first. No API credentials are needed to build the client.

## First launch on the phone

1. Go to Models & settings.
2. Enter your **real deployed HTTPS backend URL**, without `/api`.
3. Enter your private device access token, matching the backend `APP_ACCESS_TOKEN`.
4. Save, choose a configured provider and model, then try a harmless chat.
5. Configure speech on the backend before starting Voice. Grant microphone access only when you decide to record.
6. The token is not persisted. After closing/killing the app, enter it again.

Do not enter `localhost` or `127.0.0.1` to reach a server on a different computer. Those addresses refer to the **phone itself**. The app's internal `https://localhost` packaged origin is different from its configured backend URL. Cleartext and mixed content are intentionally disabled.

## Native integration included

- App ID `ai.shizz.agent`, display name `shizz ai agent`, version `0.1.0`.
- Internet, microphone and audio-routing permissions; no broad storage permissions or background microphone service.
- Explicit HTTPS network security policy; backup disabled.
- Capacitor's microphone WebView permission bridge, with manifest permissions declared.
- `MainActivity.onPause` dispatches a background event. Voice cleanup closes tracks, playback and peer connections; browser visibility/page-unmount cleanup is also present.
- Licensed fonts are bundled in the app's built web assets; no runtime font CDN.
- Export uses the app cache and Android's share sheet; the temporary file is deleted afterward. A recipient you share with may retain its own copy.

## Release checklist (still your responsibility)

- Build and test on a real supported phone, including denied/revoked permissions.
- Test speaker/Bluetooth/headset routing, slow/offline network, interruption, app backgrounding, permission prompts and end-call cleanup.
- Have Sorani native speakers evaluate your chosen models and voices.
- Use your own release signing key in Android Studio. Keep the keystore and passwords outside version control; do not reuse debug signing for production.
- Review store target-API policy, privacy disclosure, data safety form, subscriptions, AI content and microphone requirements.
- Independent security review, patch strategy and operating budget before public distribution.
