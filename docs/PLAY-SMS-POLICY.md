# Play Store: SMS permission checklist (for a later store release)

Written 2026-11-11 from Google's own page: [Use of SMS or Call Log permission groups](https://support.google.com/googleplay/android-developer/answer/10208820).
**Not needed for installing on your own phone.** Needed only before this app goes to the Play Store.

## What Google allows
Default SMS, Phone and Assistant apps may use SMS permissions. Other apps need a **temporary exception**, and only when the permission enables a
listed use and there is no alternative method. Our use: **"SMS-based money management (e.g., apps that track and manage budget)"**, which lists
READ_SMS and RECEIVE_SMS (not SEND_SMS). All exceptions are **subject to Google Play review and approval**. Review time is not stated.

## Checklist before submitting

| # | Step | Status |
|---|---|---|
| 1 | Remove every SMS permission we do not use. We use READ_SMS and RECEIVE_SMS only. **Never add SEND_SMS** | Keep |
| 2 | Fill the **Permissions Declaration Form** in Play Console: use case "SMS-based money management". Re-file if the use changes | To do |
| 3 | Describe the feature **prominently** in the store listing and in the app: reading bank messages to log spending is core functionality | To do |
| 4 | **Prominent disclosure and consent** in the app before the system permission dialog (the permission screen in `SMS-INBOX-PLAN.md` section 4) | Built with Phase 2 |
| 5 | Write and link a **privacy policy** (what is read, bank senders only, on-device, encrypted queue, deleted after the app saves, not shared, not sold) | To do |
| 6 | State why there is **no alternative method**: SMS Retriever / User Consent APIs only cover one-time codes; notification access is no better a fit | To write |
| 7 | **No exfiltration, no sale**: nothing leaves the phone; only bank-style senders are read; personal chats never | Built (enforced by tests) |
| 8 | If the exception is refused: ship a store build **without** the receiver and the SMS permissions (manual entry and import only), and keep the SMS build for sideloading | Plan B |

## Honest unknowns
- Google decides case by case. Approval is not guaranteed.
- The page does not describe the disclosure wording in detail; it points to the User Data policy. Re-read that policy before submitting.
