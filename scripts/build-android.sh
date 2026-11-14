#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -n "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]] || { echo 'Install Android Studio + SDK 35, accept its licenses, and set ANDROID_HOME first. See docs/ANDROID.md.'; exit 1; }
command -v java >/dev/null || { echo 'JDK 21 is required.'; exit 1; }
java -version
cd "$ROOT/mobile"
npm ci --no-audit --no-fund
npm run build
npx cap sync android
cd android
chmod +x gradlew
./gradlew assembleDebug
printf '\nDebug APK: %s/mobile/android/app/build/outputs/apk/debug/app-debug.apk\n' "$ROOT"
echo 'Debug/testing only. Sign release builds with your own keystore; never commit it.'
