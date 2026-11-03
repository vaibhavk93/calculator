# Add from bank messages (SMS capture)

**Status:** built (code), not yet proven on a phone with real messages. Owner decision, 2026-11-03: auto-logging from messages is a must-have, so it moved out of "Ruled out" in `MASTER-ROADMAP.md`.

## What it does
Budget > **Add from bank messages**. The user picks 7, 30 or 90 days and taps **Scan messages**. Calc reads bank-style texts on the phone, lists the payments it found, and the user taps **Add**, **Review** or **Skip** on each. Nothing is saved without a tap. There is no "Add all" on purpose.

## Rules it keeps (from the critic review, same day)
| Rule | Where enforced |
|---|---|
| Permission `READ_SMS` is asked only at the first Scan | `SmsInboxPlugin.java` |
| No background receiver. The inbox is read once per tap | `SmsInboxPlugin.java` |
| Only messages from letter-style senders (HDFCBK, VM-ICICIB) leave the plugin. Texts from phone numbers (people) are never read | `HEADER` pattern in `SmsInboxPlugin.java` |
| Parser fails closed: unsure amount or direction = not offered | `src/lib/smsParse.ts`, tests in `smsParse.test.ts` |
| Message text is never stored. Only a short fingerprint of added/skipped messages (`budget.smsSeen`) | `fingerprint()` |
| Duplicates: same payment seen twice, or already in the budget, is hidden or flagged | `buildCandidates`, `alreadyAdded` |
| Money-in messages, OTPs and offers are ignored | `parseSms` |
| Android auto-backup to Google is OFF (`allowBackup=false`), so spending data cannot leave the phone that way | `AndroidManifest.xml` |

## Reader log (owner request)
So the parser can be improved from real failures, it keeps a **redacted** log of messages it skipped or only half-read. Digits become `#`, UPI IDs and links are blanked, and the name after "to / at / from / by" becomes `<name>`. Up to 200 entries, stored under its own key `vkcalc.smslog`, **not** in backups. View, copy or clear it: Add from bank messages > Reader log.
⚠ **Remember:** the blanking is best effort. Words that are not after "to/at/from/by" stay. Read the log before pasting it anywhere.

## Not in this version
- Live listener for new messages (`RECEIVE_SMS`), or a notification listener: broader access, worse battery and privacy.
- PDF statements (formats differ per bank, many are password-protected). CSV statements ARE built: Add from bank messages > Pick statement file (file chooser, no permission, `src/lib/statementParse.ts`).
- Email: Gmail access needs sign-in and network, so no. Save the statement attachment and import the file instead.

## ⚠ Play Store
`READ_SMS` is restricted by Google Play. An expense tracker will probably be refused. Fine for a sideloaded personal app. If Calc is ever published, this feature has to be removed or changed first. Unproven for 2026, check the current policy page then.

## Wording changed
"No account, almost no permissions, nothing leaves the phone" is now: **no account, nothing leaves the phone, and the only sensitive permission (reading messages) is optional and asked only when you tap Scan.**
