# Build and install on an Android phone

A runbook, written from doing it once on 2026-11-02. It includes the corporate-proxy problem that costs time.
Also available as a script: `scripts/build-android.sh`.

## 1. What you need

| Need | This Mac |
|---|---|
| Java 21 (Capacitor 8 requires it) | `~/.local/jdks/jdk-21.0.13+9/Contents/Home` |
| Android SDK platform 36 and build-tools 36.0.0 | `~/Library/Android/sdk` (installed with `sdkmanager`) |
| `adb` | `~/Library/Android/sdk/platform-tools/adb` |
| A phone with USB debugging on, cable in File transfer mode | OnePlus CPH2573, Android 16 |

Installing Java 21 without admin rights (Eclipse Temurin, into the home folder):

```bash
mkdir -p ~/.local/jdks/dl && cd ~/.local/jdks/dl
curl -fL -o temurin21.tar.gz "https://api.adoptium.net/v3/binary/latest/21/ga/mac/aarch64/jdk/hotspot/normal/eclipse"
tar -xzf temurin21.tar.gz -C ~/.local/jdks
```

Installing the SDK pieces (needs Java 21 on the path):

```bash
export JAVA_HOME=$(echo ~/.local/jdks/jdk-21*/Contents/Home) PATH="$JAVA_HOME/bin:$PATH"
~/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager "platforms;android-36" "build-tools;36.0.0"
```

## 2. The build, step by step

```bash
npm run check                    # tests first
npm run build                    # makes dist/
npx cap sync android             # copies dist/ and the plugins into android/  (REQUIRED after adding a plugin)
cd android
export JAVA_HOME=$(echo ~/.local/jdks/jdk-21*/Contents/Home) ANDROID_HOME=~/Library/Android/sdk
export PATH="$JAVA_HOME/bin:$PATH"
export JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStore=$HOME/.local/jdks/cacerts-with-zscaler -Djavax.net.ssl.trustStorePassword=changeit"
./gradlew assembleDebug --console=plain
~/Library/Android/sdk/platform-tools/adb devices          # the phone must say "device"
~/Library/Android/sdk/platform-tools/adb -s <serial> install -r app/build/outputs/apk/debug/app-debug.apk
```

The app file is `android/app/build/outputs/apk/debug/app-debug.apk`. The first build takes about 7 minutes because
Gradle and its libraries download. Later builds are much faster.

**⚠ Remember:** `npx cap sync android` must run after any change to the web app or to a Capacitor plugin. Skipping it
installs an old copy of the app. This is the most likely cause of "my change is not on the phone".

## 3. The Zscaler certificate problem

**Symptom:** `PKIX path building failed: unable to find valid certification path` while Gradle downloads.

**Cause:** the company network runs Zscaler, which re-signs HTTPS traffic with its own root certificate. macOS trusts
it (IT installed it). Java keeps its own separate trust list and does not.

**Fix (does not disable any check):** make a private copy of Java's trust list and add the Zscaler root to it.

```bash
export JAVA_HOME=$(echo ~/.local/jdks/jdk-21*/Contents/Home) PATH="$JAVA_HOME/bin:$PATH"
security find-certificate -a -p -c "Zscaler" > ~/.local/jdks/zscaler-all.pem
cp "$JAVA_HOME/lib/security/cacerts" ~/.local/jdks/cacerts-with-zscaler && chmod u+w ~/.local/jdks/cacerts-with-zscaler
keytool -importcert -noprompt -trustcacerts -alias zscaler-root -file ~/.local/jdks/zscaler-all.pem \
  -keystore ~/.local/jdks/cacerts-with-zscaler -storepass changeit
```

Then use `JAVA_TOOL_OPTIONS` as in step 2. It applies only to the command where you set it. Do not use
`-Djavax.net.ssl.trustStoreType=KeychainStore`: it skips the normal root list and fails on other hosts.

**Second symptom:** `Downloading ... failed: timeout (10000ms)`. The proxy is slow on large files. The wrapper timeout
was raised to 120000 in `android/gradle/wrapper/gradle-wrapper.properties`.

## 4. Phone troubleshooting

| Symptom | Fix |
|---|---|
| `adb devices` is empty | Replug. Unlock the phone. Pull down the notification shade and choose **File transfer**. Accept "Allow USB debugging?" |
| Device was seen, then vanished | Cable or port. Try another. Run `adb kill-server && adb start-server` |
| Install blocked on a OnePlus | Developer options, turn on **Install via USB** |
| Wireless instead (Android 11+) | Developer options, Wireless debugging, Pair with code, then `adb pair <ip:port>` and `adb connect` |
| App installed but old | You skipped `npx cap sync android` |
| Notifications never arrive | Settings, Apps, Calc, Battery, **Don't optimize**; allow auto-launch |

## 5. Things that are set on purpose

- `SCHEDULE_EXACT_ALARM` is kept (the notification plugin adds it). Removing it hides Android's "Alarms & reminders" switch, so the
  owner could not turn it on. Check with `aapt2 dump permissions app-debug.apk`: INTERNET, RECEIVE_BOOT_COMPLETED, WAKE_LOCK, POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM.
- `applicationId` is `com.vaibhavkumawat.vkcalc`. Do not change it: a different id installs as a different app.
- Debug builds are signed with `~/.android/debug.keystore`. Reinstalling from the same Mac keeps your data. A build from
  another computer has a different key and cannot update it: export a backup first (Settings).

## 6. Before a release build

Not done yet: a release keystore, `assembleRelease`, and a signed APK. Create a keystore once, keep it outside the repo,
back it up, and use it for every release. Lose it and you cannot update the app.
