# Add from bank messages (SMS capture)

**Status:** the manual scan is built (code), not yet proven on a phone with real messages. Owner decision, 2026-11-03: auto-logging from messages is a must-have, so it moved out of "Ruled out" in `MASTER-ROADMAP.md`.
**Always-on capture (phone side) built 2026-11-11** and proven on a phone with fake messages (section "Capture while the app is closed"). Owner decision, 2026-11-11: capture bank messages always, even when the app is closed, so they wait for review when the app opens. This replaces the old rules "No background receiver" and "Message text is never stored" below; the rest of the rules still hold.

## What it does
Budget > **Add from bank messages**. The user picks 7, 30 or 90 days and taps **Scan messages**. Calc reads bank-style texts on the phone, lists the payments it found, and the user taps **Add**, **Review** or **Skip** on each. Nothing is saved without a tap. There is no "Add all" on purpose.

## Rules it keeps (from the critic review, same day)
| Rule | Where enforced |
|---|---|
| Permission `READ_SMS` is asked only at the first Scan, or together with `RECEIVE_SMS` when the user turns on capture | `SmsInboxPlugin.java`, `SmsQueuePlugin.java` |
| ~~No background receiver~~ **Replaced 2026-11-11.** The manual scan still reads the inbox once per tap. A receiver exists, but it is off until the user turns capture on, and is disabled again when they turn it off | `SmsInboxPlugin.java`, `SmsReceiver.java`, `SmsCapture.applyComponent` |
| Only messages from letter-style senders (HDFCBK, VM-ICICIB) leave the plugin or enter the queue. Texts from phone numbers (people) are never read or kept | `HEADER` pattern, via `SmsInboxPlugin.isBankSender()` (the scan and the receiver both call it) |
| Parser fails closed: unsure amount or direction = not offered | `src/lib/smsParse.ts`, tests in `smsParse.test.ts` |
| ~~Message text is never stored~~ **Now:** the phone holds a bank message only until the app next opens. Encrypted with a Keystore key, app-private, excluded from backups, capped 500 messages / 30 days, deleted the moment the app acks it, never logged. After that, only a short fingerprint of added/skipped messages is kept (`budget.smsSeen`) | `SmsQueueStore.java`, `KeystoreCrypto.java`, `fingerprint()` |
| Duplicates: same payment seen twice, or already in the budget, is hidden or flagged | `buildCandidates`, `alreadyAdded` |
| Money-in messages, OTPs and offers are ignored | `parseSms` |
| Android auto-backup to Google is OFF (`allowBackup=false`), so spending data cannot leave the phone that way | `AndroidManifest.xml` |

## Reader log (owner request) and how it is masked
So the parser can be improved from real failures, it keeps a log of messages it skipped or only half-read (`vkcalc.smslog2`, up to 200, **not** in backups). View, copy or clear it: Add from bank messages > Reader log.

**Masking (`src/lib/maskText.ts`), so a person or an AI assistant reading the log sees look-alike data, not real data:**
| Part of the message | What the log holds |
|---|---|
| Every digit (amounts, card digits, refs, phone numbers) | another digit chosen by a keyed hash. Same length, commas and decimals |
| Dates | a valid fake date in the same layout (03/11/26 stays dd/mm/yy) |
| UPI handle before `@` | fake letters; the bank part after `@` stays |
| Every word not on a short list of layout words (debited, A/c, Ref, UPI, bank names…) | fake letters, same case and length. Names, merchants, fund names all become nonsense |
| Links | `<link>` |
| What was understood | shapes only: "4 digits, 2 decimals", "6 characters" |
The key (`salt`) is random, made on this phone, never leaves it. The same real value always maps to the same fake one on this phone, so repeats stay visible. ⚠ **Remember:** this is not encryption. It is meant to stop a reader learning real values, not to stop someone who also has the phone's salt.
History: the first version only swapped digits, and an account holder's name inside an "Info:" line was visible. That log was deleted and masking switched to the word list above.

## Merchant rules (D5, built 2026-11-06)
`BudgetData.rules` (max 100, newest first, `{ id, match, categoryId }`), edited at Budget > Categories and cards > Rules (`RulesScreen.tsx`).
- **Match:** the cleaned merchant contains `match` as whole words, ignoring case, at least 3 characters. Done with `indexOf` plus a letter/digit check on both sides (`ruleMatches`), not a regex, so any typed character is safe and non-English letters count as letters.
- **Priority:** newest matching rule, then `suggestFor` (last entry with the same note), then the built-in word list. Wired by passing `(note) => ruleFor(...) ?? suggestFor(...)` as the existing `suggest` argument. No parser change.
- **A rule never creates a category.** A rule whose category is deleted is skipped and shown as "Category removed". It is kept (categories are only soft-deleted, so a backup or undo brings it back). There is no category merge in the app today; if one is added, rules must follow it.
- **Privacy:** a rule holds only a short merchant word. "Remember this merchant" builds it from the cleaned merchant with every word that has a digit dropped and at most two words kept (`ruleTextFromMerchant`). Message text, amounts and card digits are never stored.
- **Not built:** applying rules to old entries, card-specific rules, amount filters, ordering controls. Typing a note by hand does not use rules (it still uses the older "same note" suggestion).

## Capture while the app is closed (built 2026-11-11)
Decision: catch bank messages the moment they arrive so they wait for review. The app drains them when it opens.

```
 incoming SMS --> SmsReceiver --(capture ON + permission? letter-style sender?)--> SmsQueueStore (encrypted file)
                  (system sends                                                          |
                   SMS_RECEIVED)                                      app opens: drain() --> parse --> save --> ack(ids)
```

| Piece | What it does | File |
|---|---|---|
| Receiver | On `SMS_RECEIVED`: joins multipart pieces from one sender, keeps only letter-style senders, queues each. Does nothing when capture is off or permission missing. Never throws. Does no work after `onReceive` returns (no `goAsync`). No OTP/offer filtering: the parser decides what is money | `SmsReceiver.java` |
| Queue | One file in `getNoBackupFilesDir()`, one AES-256-GCM record per message. The key is in the Android Keystore and cannot be exported. Cap 500 (oldest dropped), 30 days by `receivedAt`. Id = hash of `sender|body|receivedAt|index`, so the same message cannot be queued twice. Writes go to a temp file, are synced, then renamed. A record that cannot be decrypted is dropped alone. One lock, so receiver and app can run together | `SmsQueueStore.java`, `KeystoreCrypto.java` |
| Switch | A saved flag (default OFF) plus the receiver component itself is enabled/disabled with `PackageManager`, so off means the system stops delivering messages to it | `SmsCapture.java` |
| Plugin `SmsQueue` | `permission`, `request`, `captureEnabled`, `setCaptureEnabled({on})`, `drain`, `ack({ids})`, `clear`, `openAppSettings`. `drain` never deletes. TS mapping: `src/lib/smsQueueNative.ts` (`nativeSmsQueue()`, null on the web) | `SmsQueuePlugin.java` |

**Permissions (all in `AndroidManifest.xml`, each with a comment there):**
| Permission | Why |
|---|---|
| `READ_SMS` | the manual scan, and asked together with the next one |
| `RECEIVE_SMS` | be told about each new text while the app is closed |
| `BROADCAST_SMS` on the `<receiver>` | not something we ask for: it means only the system can send to the receiver, so no other app can feed it fake texts. The receiver is `exported=true` because the system is another app |
| `uses-feature telephony required=false` | the SMS permissions must not hide the app from devices without a phone radio |
`allowBackup=false` stays.

**Never logged.** No `Log.*`, no printing, no exception text in any capture class (a JVM test greps the source for this: `SmsQueueStoreTest.captureCodeNeverLogs`). `capacitor.config.ts` sets `loggingBehavior: 'none'` because Capacitor's own debug logging prints every plugin call and result, which would put drained message text in the phone log (a JS test guards it). This also stops the manual scan's messages being logged.

**Known limits (honest list):**
- A message that arrives between a restart and the first unlock is not delivered to apps by Android. The manual scan still finds it.
- The id includes the sender's own timestamp (second resolution). Two different real messages with the same sender, text and second would count as one. The app's own fingerprint check is the second guard.
- Phone makers' battery savers can stop a receiver for apps they consider idle. A missed message is invisible; the manual scan is the backstop. See `docs/BUILD-ANDROID.md` section 4.
- Each queue operation decrypts the whole file (at most 500 records). Fine for a queue that is nearly always short.
- Real delivery was seen once, by accident: while capture was on in the QA copy, a real promotional text from a letter-style sender arrived and was queued, so the system does deliver `SMS_RECEIVED` to the receiver. Not yet seen with a real bank message. Note it also shows the receiver queues promotions (by design: the parser decides), so expect noise in the queue.

**Debug-only injection hook (debug and qa builds, absent from release).** Lives in `android/app/src/debug/` (the `qa` build type also compiles that folder, see `app/build.gradle`); `MainActivity` registers it by name only if the class exists. Two ways in, both go through `SmsReceiver.deliver()`, the same function a real text uses, so the on/off switch, permission check, sender filter and queue all apply:
- TS: `debugInjectSms(sender, body, receivedAt?)` in `smsQueueNative.ts` (null on the web and in release).
- From a computer, with the app closed (this starts the app process, like a real text would). The receiver needs the `DUMP` permission, which only the adb shell has:
```bash
adb shell "am broadcast -n com.vaibhavkumawat.vkcalc.qa/com.vaibhavkumawat.vkcalc.SmsDebugReceiver --es op inject --es sender 'HDFCBK' --es body 'Rs 250 debited' --el at 1800000000000"
adb shell "am broadcast -n .../com.vaibhavkumawat.vkcalc.SmsDebugReceiver --es op count"   # prints size and ids
```
Quote the whole remote command as ONE string: `adb shell` splits unquoted arguments again, which silently drops extras. Only inject into `Calc QA` (`.qa`), never the owner's real app.

**Restricted settings (Android 13+, tighter on 15 and 16).** A sideloaded app's SMS permission can be blocked: the dialog does not appear, or the request returns "denied" at once. The user must open **App info > the three dots (top right) > Allow restricted settings**, then ask again. The three dots only appear after a blocked attempt. The app cannot tell this apart from an ordinary "Don't allow", so there is no extra flag: `permission()` returns `'denied'` after a first ask, and `request()` returning `'denied'` is when the UI should explain this and offer `openAppSettings()`. Not tested on a phone that is actually restricted: an app installed with `adb install` is exempt (the phone showed `RESTRICTION_INSTALLER_EXEMPT`), so this path is unproven.

## Not in this version
- A notification listener: broader access, worse battery and privacy. (The `RECEIVE_SMS` listener is now built, above.)
- PDF statements (formats differ per bank, many are password-protected). CSV statements ARE built: Add from bank messages > Pick statement file (file chooser, no permission, `src/lib/statementParse.ts`).
- Email: Gmail access needs sign-in and network, so no. Save the statement attachment and import the file instead.

## Google Play (checked 2026-11-03 against the Play Console policy page)
Play restricts `READ_SMS` / `RECEIVE_SMS` to default SMS apps, **plus listed exceptions. "SMS-based money management, for example apps that track and manage budget" is one of the listed exceptions.** So this feature has a legal route, not a ban. It is not automatic. What Play asks:
1. Declare the permission in Play Console's Permissions Declaration Form and get it approved. Google decides, case by case.
2. In-app **prominent disclosure and consent** before the permission prompt. Built: the "Read bank messages?" sheet shown before the first scan.
3. A privacy policy that says what is read and that nothing leaves the phone. **Not written yet.**
4. No sending or selling of SMS data, and no reading of non-financial messages. We read only letter-style bank senders, on the phone, on a tap.
5. Request only what is needed: `READ_SMS` and `RECEIVE_SMS` (no SEND_SMS). **Changed 2026-11-11:** `RECEIVE_SMS` was added for always-on capture. The plan's own risk note applies: Play treats it more strictly than a one-off scan, and the always-on route is the one most likely to be refused. For a personal (sideloaded) app this does not matter.
Not proven: that Google will approve this app. Check the live policy page before any release.

## Categories and cards from messages
- **Payment mode** is read from the text (UPI, credit card, debit card, net banking) and from the matched card or account.
- **Cards and accounts**: if a message names a bank and the last digits of something you have not added, the screen offers "Add to my cards" (kind taken from the text: credit card, debit card or bank account). All payments naming it are then attached to it.
- **Category**: first the category of an earlier entry with the same payee; otherwise a keyword guess (Swiggy → Food, Myntra → Shopping, fund or SIP → Savings…) used only if you already have a category of that name. Nothing is created without you.

## Wording changed
"No account, almost no permissions, nothing leaves the phone" is now: **no account, nothing leaves the phone, and the only sensitive permissions (reading and receiving messages) are optional: asked when you tap Scan or turn on capture.**

## Duplicates, own money, deposits (2026-11-11, all bank wordings SYNTHETIC / ASSUMED: no real message was read)
**Why duplicates showed** (full list in the header of `src/lib/dupes.ts`): one payment sends two messages (bank alert + UPI app) with different payee text, so two fingerprints; the twin arrives in a later drain and was never compared with the Inbox item; the manual scan never looked at the Inbox; `alreadyAdded` knew only one spelling; midnight resends. Fix: `samePayment` (same direction and amount, within 1 day, then same reference, or same card/account, or one payee name inside the other, or one message with no payee; never when both have different references or are different known cards). A merged candidate has `mergedFrom` and `alsoIds` (mark all of `seenIdsOf(c)` as seen).
**Deposit accounts** (FD, TD, RD, MOD, Fixed/Term/Recurring/Flexi Deposit, "deposit a/c"): their digits are cut out before card/account digits are read, and an FD/RD/sweep message never offers an account to add.
**Nature** (`src/lib/ownMoney.ts`): `spend` | `moneyIn` (reserved; real credits are still not offered) | `ownMoney` with `ownKind` fdOpen, fdBreak, rd, sweep, selfTransfer, cardBill and a plain-words `ownWhy`. Own money that came in (an FD paying out) is listed in `ScanResult.own`, never in `found`. Never auto-added. Unsure = spend. A penalty, fee or TDS on a deposit stays a spend.
**Self vs someone else:** the other account is one saved bank account, or the text says own account / to SELF, or the person taught it (`markPayeeSelf`, stored in `budget.payeeKinds`).
**Masked examples:** `ScanResult.maskedSamples` + `maskedSamplesText()` give a pasteable block (digits and names swapped) for merged, own-money and deposit messages.
