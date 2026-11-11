# Privacy policy: DRAFT for the owner to review

**Status:** draft written 2026-11-11 for a LATER Play Store release. Not published, not legal advice. The owner must read it, fix the placeholders and (ideally) have it checked before it is hosted at a public link.
**How to read the marks:** text with no mark was checked against the code on 2026-11-11 (the file is named). **[UNVERIFIED]** means it could not be proven from the code or a test, and must be checked by hand or on a phone before the policy goes live. **[OWNER]** means a fact only the owner can fill in.

---

## Calc: Privacy Policy

**Effective date:** [OWNER: date of publication]
**Developer:** [OWNER: name or business name] · **Contact:** [OWNER: email address]
**App:** Calc (Android package `com.vaibhavkumawat.vkcalc`; confirm the final store package name [OWNER])

### The short version

- **Calc keeps your data on your phone. We do not have a server that receives it.**
- There is **no account, no sign-in, no ads and no analytics** in the app. (`SettingsScreen.tsx` says so; no analytics or ad library is in `package.json`.)
- If you turn on "bank messages", Calc reads **text messages (SMS) from the phone's own message inbox, on the phone only**, to help you log your spending. They are **not uploaded, shared or sold**.
- You can delete everything at any time (see "Deleting your data").

### What Calc stores, and where

All of this is stored **only on your phone**, in the app's private storage:

| Data | Why | Where it lives |
|---|---|---|
| Calculations and history, saved calculations, lists, to-dos, notes | So you can come back to them | App storage on the phone |
| Budget entries (amount, date, category, note, card or account name and last digits you typed) | The budget tab | App storage on the phone |
| Reminders (text and date) | To notify you | App storage and the phone's alarm system |
| Settings | Your choices | App storage on the phone |

### Bank messages (SMS): what is read, when, and what happens to it

This part is **optional**. It is off until you tap "Scan messages" or turn on capture, and Android asks your permission first. Before the Android prompt, Calc shows its own screen explaining this. (`docs/SMS-CAPTURE.md`, the "Read bank messages?" sheet.)

**Permissions used:** `READ_SMS` and `RECEIVE_SMS`. Calc never asks for `SEND_SMS` and never sends a message. (`AndroidManifest.xml`.)

**What is read**
- Only messages from **named senders** (letters and digits, such as `HDFCBK` or `VM-ICICIB`). Messages from **ordinary phone numbers, meaning people, are never read into the app.** (`SmsInboxPlugin.isBankSender`, shared by the scan and the receiver.)
- ⚠ **Be exact here:** the filter is "named sender", not "confirmed bank". Shops, delivery apps and one-time-password (OTP) messages also come from named senders, so these messages can be read by the phone side too. The app then discards what is not a money message, and it never offers a one-time-code message as an expense. The policy must NOT say "only banks" unless the code is changed to a bank list. **[OWNER: decide wording; verify on a phone that an OTP from a named sender is discarded.]**
- Manual scan: reads the inbox once, for the last 7, 30 or 90 days you choose, when you tap Scan.
- Capture while the app is closed (only if you turn it on): the phone side is told about each new message and keeps named-sender messages in a **waiting queue**.

**What happens to a message**
1. The waiting queue is **encrypted** (AES-256-GCM) with a key held in the Android Keystore that cannot be exported, in app-private storage that is **excluded from backups**. (`SmsQueueStore.java`, `KeystoreCrypto.java`.)
2. It holds at most 500 messages and at most 30 days. Older ones are dropped.
3. When you open Calc, it reads each message **on the phone**, works out the amount, payee and card digits, and shows them for you to approve. Nothing becomes a budget entry unless you approve it, **except** if you switch on "auto-add" for payments Calc is very sure about. Those carry an "Auto-added" label and an Undo.
4. **The waiting copy is deleted once the app has saved the result** (the app confirms to the phone side after saving, and only then is it deleted).
5. After that, Calc keeps only a short **fingerprint** (a one-way code, not the text) of messages you added or skipped, so the same message is not offered twice. The message text is not kept.
6. Money-in messages, OTPs, offers and failed payments are not turned into expenses.
7. The message text is **never written to the phone's log**. (A test checks the source code; Capacitor's own logging is switched off in `capacitor.config.ts`.)

**Reader log (optional help for fixing the reader).** If a message cannot be read, Calc can keep a *disguised* copy: every digit, name and merchant is replaced by look-alike characters, so it shows the layout but not the content. It stays on the phone, is not in backups, holds up to 200 entries, and you can view, copy or clear it. You decide whether to share it. (`maskText.ts`.) Note: the disguise is meant to stop a reader learning real values; it is not encryption. [UNVERIFIED on real messages: only tested with made-up ones.]

**What is NOT done with messages:** not uploaded, not shared, not sold, not used for ads, not used to build a profile, not used for anything except showing you your own spending.

### Network use

- **Your data is never sent anywhere.** There is no Calc server.
- The Android app has the `INTERNET` permission, used for **one thing only**: the currency converter fetches public exchange rates from `api.frankfurter.dev` (European Central Bank reference rates). The request contains no personal data, but as with any web request the rate provider can see your phone's IP address. If the request fails, Calc uses built-in rates. (`src/lib/currencyRates.ts`.) **[UNVERIFIED: confirm in a phone network capture that nothing else is requested, and check Frankfurter's own privacy terms.]**
- Fonts are bundled in the app. [UNVERIFIED: `@fontsource` packages are bundled, no font CDN is referenced in the build; confirm by checking the built app makes no font request.]

### Backup and export

- Calc does **not** use Android's automatic Google backup (`allowBackup="false"`), so your data is not copied to Google that way.
- **Settings > Backup and export** lets *you* save a file with your notes, lists, reminders and budget. That file is **yours**: Calc does not send it anywhere. Where you save or share it (Files, Drive, email) is your choice, and that service's own policy then applies.
- Backup files are not encrypted by Calc. [UNVERIFIED: confirm; say so plainly to users if true.]

### Permissions, in plain words

| Permission | Used for | Optional? |
|---|---|---|
| Read SMS / Receive SMS | The bank-message feature above | Yes. Off until you turn it on |
| Notifications | Reminders (added by the Capacitor notifications plugin; **[UNVERIFIED]** confirm the exact merged permission list in the built APK) | Yes |
| Internet | Currency rates only | Not asked at install; always declared |

### What Calc does NOT collect

Calc does **not** collect, receive or store on any server: your name, email, phone number, contacts, location, photos, microphone or camera data, advertising ID, device ID, usage analytics, crash reports or the content of your messages. It has no ads, no tracking and no accounts. [Claim "no crash reports / no device ID": verified only by reading `package.json` and the source for analytics libraries. **[UNVERIFIED]** by a network capture.]

### Children

Calc is not directed at children. [OWNER: confirm the audience you will declare in Play Console.]

### Deleting your data

- **Delete one thing:** every delete in the app can be undone for a short time, then it is removed.
- **Delete the bank-message queue and fingerprints:** turn capture off in Settings, and use the app's clear option for the reader log. Turning capture off disables the receiver. **[UNVERIFIED: whether turning capture off also deletes messages already waiting in the queue; check `SmsQueuePlugin.setCaptureEnabled` and `clear`.]**
- **Delete everything:** on Android, **Settings > Apps > Calc > Storage > Clear storage**, or **uninstall**. Both erase all Calc data, including the encrypted queue. There is **no single "delete everything" button inside the app** today (checked in `SettingsScreen.tsx` and `BackupScreen.tsx`; the only wipe is "Replace everything" when restoring a backup). **[OWNER: Play's data-deletion rules may ask for an in-app or web route; for an app that holds no server data, the above is normally enough, but confirm.]**
- Because nothing is on our servers, we have nothing else to delete. A backup file you saved yourself is yours to delete.

### Changes to this policy

[OWNER: say how you will announce changes, for example the date at the top and the "What's new" text.]

### Contact

[OWNER: email address]
