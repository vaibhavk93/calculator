# Prompt: test Calc on the phone with Claude Fable 5.2

Written 2026-11-11. Paste everything under "The prompt" as the **first message of a new Claude Code session**
in this repository, **only when the phone is connected and you are at the keyboard**.
Set the model to Fable 5.2 (`/model`) and the effort to `high` (`/effort high`) first.

Third in the set:

| Prompt | For |
|---|---|
| `FABLE-5-2-IMPROVE.md` | Fixing the app |
| `FABLE-TEST-EVERYTHING.md` | Finding out what is true, on the machine |
| **`FABLE-TEST-ON-PHONE.md`** | **The things only a real phone can prove** |

## Why this is a separate prompt

A browser pass can be left running unattended. A phone pass cannot, and the risk is not a failing test — it is
**the owner's real data**. Four mistakes have already been made on this phone (blind taps on the live app, a
device screenshot showing real entries, assuming `pm clear` worked, and a real promotional SMS being read into
tool output). All four are in this prompt as rules, not as history.

It is also deliberately **small**. A phone session should do a few things carefully, not everything quickly.

## The prompt

---

I'm Vaibhav. My phone is connected and I am here. I want you to test Calc on it — the real device, not a
browser — and nothing else this session. The browser suites are covered by another pass; do not repeat them.

**This is my daily phone with my real money data on it.** The rules below are not suggestions, and nothing in
this session is worth breaking one.

## The two apps, and the line between them

| App | Package | What you may do |
|---|---|---|
| **Calc** | `com.vaibhavkumawat.vkcalc` | My real app with my real data. **Never drive it, never screenshot the device while it is open, never inject a message into it, never install over it unless I say so in this session.** |
| **Calc QA** | `com.vaibhavkumawat.vkcalc.qa` | A separate copy with its own data. **Everything happens here.** |

Both apps contain the SMS receiver. If capture is on in QA, QA receives my **real** bank messages too. Keep it
off unless a test needs it, and assume anything live can catch something real.

## Before you touch anything

1. `git status --short` — if the tree is dirty, someone else is mid-work. Say so and stop.
2. `adb devices -l` must say `device`, not `offline`. Wireless debugging: `adb mdns services`, then
   `adb connect <ip>:<port>`. **The port changes every time the toggle or the phone restarts.**
3. **Ask me to clear Calc QA** (Settings, Apps, Calc QA, Storage, Clear data). `adb shell pm clear` is
   **refused** on this phone, and so are `pm grant` and `pm revoke` for SMS. It failed silently once and a
   script printed real-looking data out of a QA copy everyone believed was empty.
4. **Verify QA is actually empty before injecting anything** — look for "No spending yet", and report a yes/no
   or a count, never the screen text. `localStorage` proves nothing on Android: the app uses native Preferences.

## How to drive it: never blind taps

QA is a debug build, so its WebView can be driven like a browser tab. Use that, not `adb shell input tap`.

```bash
QA=com.vaibhavkumawat.vkcalc.qa
adb shell monkey -p $QA -c android.intent.category.LAUNCHER 1
PID=$(adb shell pidof $QA | tr -d '\\r')
adb forward tcp:9333 localabstract:webview_devtools_remote_$PID
```

Then Playwright `chromium.connectOverCDP('http://127.0.0.1:9333')`. Screenshots come from
**`page.screenshot()` inside the QA WebView**, never `adb exec-out screencap` — a device screenshot once
captured my real entries, a person's name and a card's last digits.

`scripts/phone-qa/phonetest.mjs` and `scripts/phone-qa/inboxview.mjs` already do the common scenarios; read
them before writing anything new. `docs/PHONE-TESTING-GUIDE.md` has the rest.

Native Android dialogs (the SMS permission) are **not** in the WebView. Either dump the view and tap the
button's bounds, or ask me to tap it. If you are unsure which dialog is on screen, ask me.

## Fake messages only

The debug receiver feeds the same code path as a real SMS, so fake messages prove the real thing:

```bash
adb shell "am broadcast -n com.vaibhavkumawat.vkcalc.qa/com.vaibhavkumawat.vkcalc.SmsDebugReceiver --es op inject --es sender 'HDFCBK' --es body 'Rs.450.00 debited from HDFC Bank Card x4321 at SWIGGY BANGALORE on 11-11-26.' --el at 1800000000000"
```

Quote the whole remote command as one string. The receiver exists only in debug and qa builds.

**No real message text, amount, payee or account number may appear in your output, in a test, in a log, or in
your report.** If you need an example, invent one. If something real does appear, say that it happened and
what kind of thing it was — never repeat the content.

## What is worth testing here, in order

These are the things a browser genuinely cannot prove. Everything else belongs to the other pass.

1. **Reminders surviving a restart.** The only honest test is the manual one, and only I can do it: I create a
   reminder five minutes out, restart the phone, do not open Calc, and we see whether it fires. Ask me to run
   it and wait for my answer — do not simulate it and call it proven.
2. **Battery saver and force-stop.** Reminders have never been proven on a phone that kills background apps.
3. **The permission paths that have never run.** Denying the SMS permission, and the Android 15+ "Allow
   restricted settings" block. Installing over adb is exempt from that block, which is exactly why it has
   never appeared. If you cannot trigger it, say so rather than marking it covered.
4. **Capture with the app closed.** Inject fake messages while QA is not running, reopen, and check they are
   waiting with the right payee, amount, route and category — and that an OTP, a promo and a personal chat
   never reach the list at all.
5. **The system around the app.** The Android back button from every screen and sheet, tapping the tab you are
   already on, rotation, the keyboard covering a field, and tapping a reminder notification to open the app.
6. **How it feels on real hardware.** Scrolling, tap targets under a thumb, the keypad, text at the phone's own
   font size. My basic calculator page is the quality bar; say which screens fall short of it.

## What needs me, every time

- **Installing anything.** Say what and why, then wait. `scripts/build-android.sh qa install` for QA.
  Installing over the real Calc needs a separate, explicit yes in this session.
- Clearing QA data, granting or revoking a permission, restarting the phone.
- Anything at all involving the real Calc app.

Finish everything that does not depend on me, then ask with your recommendation.

## When you are done

`adb forward --remove-all`, turn capture off in QA, delete the screenshots you took, and ask me to clear QA
again if capture was on at any point — a real message may have arrived during the test.

# Verifying your work
Before reporting anything, audit each claim against a tool result from this session. **Never report a pass you
did not see**, and never infer a phone result from a browser one. If a check needed me and I have not answered
yet, it is "not tested", not "passed".

# Communicating clearly
Write for a reader who has not seen your tool calls. Short sentences, one idea each, active voice, plain words.
Lead with the outcome. Tables are welcome.

# The report I want

Start with one paragraph: **what do we now know about the app on a real phone that we did not know this
morning?**

| Check | Result | Evidence | Needed me? |
|---|---|---|---|
| Capture with the app closed | | | |
| Permission denied path | | | |
| Restricted settings path | | | |
| Reminder after a restart | | | |
| Battery saver / force-stop | | | |
| Back, rotate, keyboard, notification tap | | | |
| Feel on real hardware | | | |

Then anything that behaved differently from the browser, which is the whole point of this session. Then what
you could not test and why. Then a plain yes or no: **did anything touch my real app or my real data?**

---

## Notes for the owner (not part of the prompt)

- **Be at the keyboard.** Several steps need you: clearing QA, permission dialogs, the restart test.
- **Expect it to be slow.** A phone pass is a handful of careful checks, not a sweep.
- **The build on the phone may be old.** Check what is installed before trusting a result:
  `adb shell dumpsys package com.vaibhavkumawat.vkcalc.qa | grep lastUpdateTime`.
- **If anything reads a real message**, stop the session, turn capture off in QA, and clear its data.
