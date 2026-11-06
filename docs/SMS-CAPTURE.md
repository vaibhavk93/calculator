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

## Not in this version
- Live listener for new messages (`RECEIVE_SMS`), or a notification listener: broader access, worse battery and privacy.
- PDF statements (formats differ per bank, many are password-protected). CSV statements ARE built: Add from bank messages > Pick statement file (file chooser, no permission, `src/lib/statementParse.ts`).
- Email: Gmail access needs sign-in and network, so no. Save the statement attachment and import the file instead.

## Google Play (checked 2026-11-03 against the Play Console policy page)
Play restricts `READ_SMS` / `RECEIVE_SMS` to default SMS apps, **plus listed exceptions. "SMS-based money management, for example apps that track and manage budget" is one of the listed exceptions.** So this feature has a legal route, not a ban. It is not automatic. What Play asks:
1. Declare the permission in Play Console's Permissions Declaration Form and get it approved. Google decides, case by case.
2. In-app **prominent disclosure and consent** before the permission prompt. Built: the "Read bank messages?" sheet shown before the first scan.
3. A privacy policy that says what is read and that nothing leaves the phone. **Not written yet.**
4. No sending or selling of SMS data, and no reading of non-financial messages. We read only letter-style bank senders, on the phone, on a tap.
5. Request only what is needed: we ask for `READ_SMS` only (no RECEIVE_SMS, no SEND_SMS).
Not proven: that Google will approve this app. Check the live policy page before any release.

## Categories and cards from messages
- **Payment mode** is read from the text (UPI, credit card, debit card, net banking) and from the matched card or account.
- **Cards and accounts**: if a message names a bank and the last digits of something you have not added, the screen offers "Add to my cards" (kind taken from the text: credit card, debit card or bank account). All payments naming it are then attached to it.
- **Category**: first the category of an earlier entry with the same payee; otherwise a keyword guess (Swiggy → Food, Myntra → Shopping, fund or SIP → Savings…) used only if you already have a category of that name. Nothing is created without you.

## Wording changed
"No account, almost no permissions, nothing leaves the phone" is now: **no account, nothing leaves the phone, and the only sensitive permission (reading messages) is optional and asked only when you tap Scan.**
