# Phone testing guide (safe method, learned 2026-11-11)

How to test Calc on the owner's real OnePlus WITHOUT touching real data. Written after three mistakes (section 6) so nobody repeats them.
Read `docs/BUILD-ANDROID.md` for building and `docs/SMS-CAPTURE.md` for how capture works. This file is about **testing**.

---

## 1. The two apps on the phone

| App | Package id | What it is | Rule |
|---|---|---|---|
| **Calc** (real) | `com.vaibhavkumawat.vkcalc` | The owner's real app with real data | **Never** drive it, screenshot it, print its text, or inject messages into it. Install over it only with `scripts/build-android.sh install` (keeps data) |
| **Calc QA** | `com.vaibhavkumawat.vkcalc.qa` | A separate copy built from the same code, with its own data | The only place for automated tests and fake messages. **It must be EMPTY before a test** |

**Both apps have the SMS receiver.** If capture is on in both, both receive the owner's real bank messages. Keep capture off in QA unless a test needs it, and clear QA when done.

### Making QA empty
`adb shell pm clear` is **refused** on this phone (`CLEAR_APP_USER_DATA` denied). The owner clears it on the phone:
Settings, Apps, **Calc QA**, Storage, **Clear data**. Then verify (section 5, "is QA empty?") before injecting anything.

---

## 2. Connect over Wi-Fi debugging

1. Phone and Mac on the **same Wi-Fi**. Phone: Settings, Developer options, **Wireless debugging** on.
2. On the Mac:

```bash
ADB=~/Library/Android/sdk/platform-tools/adb
$ADB kill-server; $ADB start-server
$ADB mdns services          # shows adb-<serial>-...  _adb-tls-connect._tcp.  <ip>:<port>
$ADB connect <ip>:<port>    # the port changes every time Wireless debugging is toggled or the phone restarts
$ADB devices -l             # must say "device", not "offline"
```

If `mdns services` shows nothing: wake the phone, toggle Wireless debugging off and on, check both are on the same Wi-Fi (the Mac's address and the phone's must share the first three numbers, for example 192.168.1.x). Company networks can block device-to-device traffic.

`adb pm grant` and `pm revoke` of SMS permissions are also **refused** on this phone. Permission changes are done by the owner in Android settings.

---

## 3. Build and install

```bash
scripts/build-android.sh install      # real Calc: tests, build, install over it (data kept)
scripts/build-android.sh qa install   # Calc QA: a separate app with its own data
adb shell dumpsys package <pkg> | grep lastUpdateTime     # confirm the install time
```

`scripts/build-android.sh` runs `npm run check` first. Read the real test count in the output.

---

## 4. Driving the QA app: Chrome DevTools over adb (no screen taps)

The QA app is a debug build, so its WebView can be driven like a browser tab.

```bash
QA=com.vaibhavkumawat.vkcalc.qa
adb shell monkey -p $QA -c android.intent.category.LAUNCHER 1     # bring it to the front
PID=$(adb shell pidof $QA | tr -d '\r')
adb forward tcp:9333 localabstract:webview_devtools_remote_$PID
curl -s http://127.0.0.1:9333/json/version                        # sanity check
```

Then Playwright: `chromium.connectOverCDP('http://127.0.0.1:9333')`, `contexts()[0].pages()[0]`. Remove the forward afterwards: `adb forward --remove-all`.

**Native Android dialogs** (the SMS permission) are not in the WebView. Use `adb shell uiautomator dump` and tap the "Allow" bounds, or let the owner tap it.

### Injecting FAKE bank messages (QA only)
The debug receiver feeds the SAME code path as a real SMS:

```bash
adb shell "am broadcast -n com.vaibhavkumawat.vkcalc.qa/com.vaibhavkumawat.vkcalc.SmsDebugReceiver --es op inject --es sender 'HDFCBK' --es body 'Rs.450.00 debited from HDFC Bank Card x4321 at SWIGGY BANGALORE on 11-11-26.' --el at 1800000000000"
adb shell "am broadcast -n .../com.vaibhavkumawat.vkcalc.SmsDebugReceiver --es op count"    # prints size and ids
```

Quote the whole remote command as ONE string. The receiver exists only in the debug and qa builds (release has none).

### The ready-made scripts

| Script | What it does |
|---|---|
| `scripts/phone-qa/phonetest.mjs <outdir>` | Full capture scenario on QA: Budget row with capture off, explainer before the Android dialog, allow permission (taps the native Allow if shown), inject 8 fake messages with the app closed (incl. an OTP, a promo, a personal-number chat, repeat payees, a UPI-to-person), reopen, check "N to review", clubbed payees, "Not sure", filters |
| `scripts/phone-qa/inboxview.mjs <outdir>` | Prints the Inbox text and saves a screenshot from inside the QA WebView. **Aborts if the QA app has entries** so real data is never printed |

Result on 2026-11-11 (commit `26a9f8a`, fake messages): checks 1 to 7 passed; check 8 (UPI to a person shown by name) failed: the payee name was not extracted ("ICICI Bank payment"). Sent to the logic agent as a regression.

---

## 5. Checks before and after a test

**Is QA empty?** Look for "No spending yet" or the absence of "Recent entries" on its Budget screen via CDP. Print only a count or a yes/no, never the screen text. (`localStorage` is NOT where the app keeps data on Android; it uses native Preferences, so an empty `localStorage` proves nothing.)

**After the test:** `adb forward --remove-all`; delete screenshots; set capture off in QA; ask the owner to clear QA data again if real messages could have arrived during the test.

---

## 6. Mistakes already made (do not repeat)

| Mistake | What happened | Rule |
|---|---|---|
| Blind screen taps on the real app | Early session: `adb shell input tap` on the owner's live phone landed on moving screens (Due prompt, empty Add form). Nothing was saved, but it could have been | Never tap the real phone blindly. Use CDP on QA, or ask the owner |
| `adb exec-out screencap` while the real app was in front | The screenshot showed the owner's real entries (a person's name, a card's last digits) | Take screenshots only from inside the QA WebView (`page.screenshot()`), never the device screen |
| Assumed `pm clear` worked | It was refused silently. The "empty" QA copy held real-looking data, and a script printed a few lines of it | Verify emptiness before every test. The owner clears QA in settings |
| A real promotional SMS was read | While capture was on in QA, a real promo arrived, was queued, and its text appeared in the agent's tool output | Keep capture off in QA unless needed; assume any live capture can receive real messages |

---

## 7. What is NOT yet proven on a phone

- The permission-denied path and the Android 15+ "Allow restricted settings" path (the install by adb is exempt, so the block never appeared).
- A real bank message (every test so far used synthetic messages).
- Behaviour after a real reboot, with battery savers on, and with the app force-stopped for days.
- Messages arriving between a reboot and the first unlock are not delivered to apps by Android. The manual **Scan messages** button is the backstop.

Manual 4-step reboot test for reminders: create a reminder 5 minutes out; restart the phone; do not open Calc; wait; it should fire.
