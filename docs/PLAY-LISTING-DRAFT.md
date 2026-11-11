# Play Store listing and forms: DRAFT for the owner to review

**Status:** draft written 2026-11-11 for a LATER Play Store release. Nothing here has been submitted. The owner reviews every line.
**Marks:** unmarked text was checked against the code on 2026-11-11 (files named). **[UNVERIFIED]** = cannot be proven from the code or a test; check by hand or on a phone. **[OWNER]** = only the owner can supply it.
**Read with:** `docs/PLAY-SMS-POLICY.md` (Google's rules and our checklist), `docs/SMS-CAPTURE.md` (what the feature does), `docs/PRIVACY-POLICY-DRAFT.md` (the policy this listing links to).
**Honest risk:** Google decides SMS-permission exceptions case by case, and always-on capture (`RECEIVE_SMS`) is the part most likely to be refused. Plan B in `PLAY-SMS-POLICY.md` item 8 still stands: a store build without the receiver and SMS permissions.

---

## 1. Short description (Play limit: 80 characters)

Option A (74 chars): `Calculator, loan and tax tools, and a private budget from your bank texts.`
Option B (67 chars): `Calculator plus a private, on-device budget from your bank messages`

[OWNER: pick one. Check the character count in Play Console; the limit was recalled from memory, not re-read this session. UNVERIFIED]

## 2. Full description (draft; Play limit 4000 characters, recalled not re-read)

> **Calc: calculator, money tools and a budget that fills itself in from your bank messages. Nothing leaves your phone.**
>
> **Track spending from your bank SMS (optional)**
> Calc can read the text messages your bank and card companies send you, such as "Rs 450 debited from a/c XX1234 to SWIGGY", and turn them into budget entries. This is the core money-management feature of the app. You choose how:
> - **Scan messages:** tap once, pick the last 7, 30 or 90 days, review what Calc found, and add or skip each one.
> - **Catch messages as they arrive (off by default):** Calc keeps new bank messages in a locked, encrypted waiting list on your phone, and you review them the next time you open the app.
>
> **How your messages are treated**
> - Everything is read and worked out **on your phone**. Messages are never uploaded, shared or sold.
> - Only messages from named senders (like HDFCBK), never from people's phone numbers.
> - Only money going out becomes an expense. Money coming in, one-time passwords and offers are ignored.
> - Nothing is added without your tap, unless you switch on "auto-add" for payments Calc is very sure about. Those are labelled and can be undone.
> - Waiting messages are deleted as soon as the app has saved them.
> - Calc asks for permission first and explains why before Android's prompt.
>
> **Also in Calc**
> - A fast everyday calculator with history, copy and paste.
> - 68 tools: loans and EMI, SIP and compound growth, income tax and GST, gold, FD ladder, HRA, small-savings schemes and more, for India.
> - Notes, lists, to-dos and reminders with a due date.
> - Works offline. No account. No ads. No tracking.
>
> **Your data stays yours.** Save your own backup file whenever you like.

Checks on the text:
- "68 tools" is the registry count at commit f4182bf (2026-11-11); update it at release time.
- "No ads, no tracking, no account": per `SettingsScreen.tsx` and `package.json`. Network: only the currency-rate request (see policy).
- "Locked, encrypted waiting list": `SmsQueueStore.java`, `KeystoreCrypto.java`.
- "Only named senders": true, but shops and OTP senders are also named senders (see policy warning). The line "Only money going out becomes an expense" is true of what the app offers, not of what the phone side briefly holds. **[OWNER: keep the wording honest; Google reviewers read this against the manifest.]**
- "Auto-add" exists as a mode in the Inbox work (`docs/SMS-INBOX-PLAN.md`, commits d2431e1, d831cf5). **[UNVERIFIED on a phone with real messages.]**
- Do not name banks as if endorsed ("HDFC", etc.) in the store text, to avoid implying a partnership. [OWNER: legal choice]

## 3. Data safety form (draft answers)

Google's form asks what is **collected** (sent off the device) and **shared** (given to a third party). On-device-only processing is not "collected" under Google's definition. [UNVERIFIED: re-read Google's Data safety definitions before submitting.]

| Question | Draft answer | Basis |
|---|---|---|
| Does the app collect or share any required user data types? | **No data is collected or shared** that leaves the device | No Calc server; no analytics (`package.json`) |
| Does the app request SMS permissions? | Yes (declared separately below). Data is processed on the device only and never transmitted | `SmsInboxPlugin.java`, `SmsQueuePlugin.java`, tests |
| Is data encrypted in transit? | Not applicable (no user data is transmitted). The single request, for currency rates, carries none | `currencyRates.ts` |
| Can users request that data is deleted? | All data is on the device; the user deletes it by clearing storage or uninstalling | policy draft "Deleting your data" |
| Account creation | None | no login code |
| Messages > SMS | Not collected, not shared. Read on the device to list payments; fingerprints only afterward | `SMS-CAPTURE.md` |
| Device or other IDs | Not collected | no ID code found. **[UNVERIFIED by a network capture]** |
| App activity, location, contacts, photos, files | Not collected | no such permissions in the manifest |
| IP address | The currency-rate request to `api.frankfurter.dev` exposes the phone's IP to that provider. Decide how to answer; the safe reading is to disclose it, or remove the request from the store build | **[OWNER] [UNVERIFIED]** how Google counts this |
| Security practices: independent security review | No | none done |

## 4. Permissions Declaration Form: "SMS-based money management"

(Core-functionality declaration in Play Console, for `READ_SMS` and `RECEIVE_SMS`. Not `SEND_SMS`, which Calc never uses.)

**Core functionality (the answer to "describe the feature that needs the permission"):**

> Calc is a personal budget and calculator app. Its core function is SMS-based money management: it reads transaction alerts that a user's bank and card issuers send as text messages (debit, card spend, UPI, ATM, bill payment) and turns the payments into budget entries, so the user does not type each one. The user taps "Scan messages" to read recent alerts, or optionally turns on capture so new alerts are kept for review when the app opens. All reading and parsing happen on the device. Calc does not send messages, does not upload message content anywhere, does not sell or share it, and uses it for nothing except showing and categorising the user's own spending.

**Which permission for which feature:**

| Permission | Feature | Required for the core feature? |
|---|---|---|
| `READ_SMS` | "Scan messages": reads the inbox once per tap, last 7/30/90 days; and reads at the moment the user turns capture on | Yes for the scan |
| `RECEIVE_SMS` | "Catch messages as they arrive": lets the receiver be told of a new message when the app is closed | For the capture option only. It is off until the user turns it on |

**"No alternative method" justification (draft):**

> The SMS Retriever API and the SMS User Consent API only deliver a single one-time code addressed to the app and cannot read transaction alerts. Notification access would give broader access to every notification, with worse privacy and unreliable text, and it is not an SMS API. Bank account aggregator or bank APIs need accounts, a network and the bank's agreement, which is the opposite of a private on-device app. Reading the user's own alerts with an explicit, user-triggered permission is the only way to get the payment amount, merchant and card from the message the bank already sent.
> **[UNVERIFIED: these statements come from `PLAY-SMS-POLICY.md` item 6 and general knowledge of the APIs, not from re-reading Google's API docs this session. Re-check before submitting.]**

**Safeguards to state (all true in code on 2026-11-11):**
- Prominent in-app disclosure and consent before the Android permission prompt (the "Read bank messages?" sheet; `SMS-CAPTURE.md`). The capture-switch wording is part of the Inbox UI work. **[UNVERIFIED: re-read the final disclosure text against Google's User Data policy for required wording.]**
- Only named (non-phone-number) senders pass the filter (`SmsInboxPlugin.isBankSender`).
- Encrypted, app-private, backup-excluded waiting queue, capped at 500 messages and 30 days, deleted when the app confirms saving.
- Nothing is logged. Auto-backup off (`allowBackup=false`).
- Parser fails closed (unsure amount or direction is not offered).
- The `RECEIVE_SMS` receiver is declared disabled in the manifest and enabled only after the user turns capture on.

**Evidence Google may ask for (prepare):** a short screen recording of the disclosure, the permission prompt, the scan and the review list; the privacy policy link; a statement that the app is not a default SMS/Phone/Assistant app. **[OWNER]**

**Weak spots a reviewer may press on (honest):**
1. "Named senders" includes non-bank businesses and OTP messages, so the phone side can briefly hold messages that are not financial. A bank-sender allow-list would answer this but would miss banks not on the list. **[OWNER: decision]**
2. `RECEIVE_SMS` for always-on capture is stricter to justify than a one-off scan.
3. The `INTERNET` permission is declared (currency rates). A reviewer may ask why an offline-first SMS app has network access.

## 5. Other listing items (not drafted here)

App category, content rating questionnaire, target audience, screenshots, feature graphic, app signing, package name, a final `versionName`, a web-hosted privacy policy URL. [OWNER]
