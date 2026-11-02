#!/usr/bin/env bash
# Build the Android debug app and (optionally) install it on a connected phone.
#
#   scripts/build-android.sh            build only
#   scripts/build-android.sh install    build, then install on the one connected phone
#
# Why this exists: the build needs Java 21, Android SDK 36, and (on this network) a Java trust list that includes
# the Zscaler proxy certificate. docs/BUILD-ANDROID.md explains each step. Run from anywhere.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JDK="$(ls -d "$HOME"/.local/jdks/jdk-21*/Contents/Home 2>/dev/null | head -1 || true)"
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
TRUST="$HOME/.local/jdks/cacerts-with-zscaler"
ADB="$SDK/platform-tools/adb"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"

fail() { echo "ERROR: $1" >&2; exit 1; }

[ -n "$JDK" ] || fail "Java 21 not found in ~/.local/jdks. See docs/BUILD-ANDROID.md, section 1."
[ -d "$SDK/platforms/android-36" ] || fail "Android SDK platform 36 missing. See docs/BUILD-ANDROID.md, section 1."

export JAVA_HOME="$JDK" ANDROID_HOME="$SDK"
export PATH="$JAVA_HOME/bin:$PATH"

# Only add the private trust list if it exists; off the company network it is not needed.
if [ -f "$TRUST" ]; then
  export JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStore=$TRUST -Djavax.net.ssl.trustStorePassword=changeit"
else
  echo "Note: $TRUST not found. If Gradle fails with 'PKIX path building failed', see docs/BUILD-ANDROID.md, section 3."
fi

cd "$ROOT"
echo "1/4  tests";        npm run check
echo "2/4  web build";    npm run build
echo "3/4  sync to android (copies the web app and the plugins in)"; npx cap sync android
echo "4/4  gradle debug build (the first one takes about 7 minutes)"
( cd android && ./gradlew assembleDebug --console=plain )

[ -f "$APK" ] || fail "Build finished but $APK is missing."
echo "Built: $APK ($(du -h "$APK" | cut -f1))"

if [ "${1:-}" = "install" ]; then
  [ -x "$ADB" ] || fail "adb not found at $ADB"
  DEVICES="$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1}')"
  COUNT="$(printf '%s\n' "$DEVICES" | grep -c . || true)"
  [ "$COUNT" -ge 1 ] || fail "No phone found. Replug, unlock, choose File transfer, accept the debugging prompt. See docs/BUILD-ANDROID.md, section 4."
  [ "$COUNT" -eq 1 ] || fail "More than one device is connected. Unplug the others, or run adb -s <serial> install yourself."
  "$ADB" -s "$DEVICES" install -r "$APK"
  echo "Installed on $DEVICES."
fi
