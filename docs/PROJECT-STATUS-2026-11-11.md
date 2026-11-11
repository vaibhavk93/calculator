# Project status, 2026-11-11: everything in one place

Written 2026-11-11 (afternoon). A complete record of what exists, how the SMS capture works, what was decided and why, what went wrong, and what is left.
Companion files: `docs/RESUME-HERE.md` (the live work log and how to restart agents), `docs/SMS-INBOX-PLAN.md` (plan in plain language),
`docs/SMS-CAPTURE.md` (technical rules), `docs/PHONE-TESTING-GUIDE.md` (how to test safely), `docs/THE-PLAN.md` (the long-term plan).
Plain language on purpose.

---

## 1. Snapshot

| | |
|---|---|
| **App** | Calc: Android calculator, budget, notes, reminders. React, TypeScript, Vite, Capacitor. One user: the owner |
| **Repo** | `github.com/vaibhavk93/calculator`, branch `dev`. About 215 commits. Local: `~/Desktop/Personal/Cowork/Calculator` |
| **On GitHub** | Pushed up to `9745d62` (2026-11-11 21:00). `dev` and `origin/dev` match |
| **On the phone** | Real Calc built from `9745d62`, installed 20:58 over Wi-Fi debugging (OnePlus CPH2573, Android 16). A separate "Calc QA" copy is also installed (older build) |
| **Tests** | `npm run check`: about 3,715 unit tests pass. Browser suites: `layout-contract` 216/216, `smsinbox` 27/27, `import` 21/21, `dayview` 12/12. Some older suites have failures that predate this work |
| **Latest work (done, installed)** | Duplicate merging across senders, FD/TD/RD never offered as accounts, own-money vs spend (FD broken, sweep, own transfer, card bill), self vs somebody else (learned), clear action buttons, tidier clubbing, "Your own money" section, "N messages merged", "Copy masked examples". Tests: 3,828 unit, smsinbox 31/31, import 51/51, layout 240/240 |

---

## 2. What changed today, in order (all on `dev`)

| Time | What |
|---|---|
| Morning | Pulled a cloud session's docs (a prompt for a Fable 5.2 session). Net worth: new holding kinds (Stocks, Mutual funds, REITs, Bonds, SGB, NPS, EPF, PPF; old bundled kinds kept and movable) and holdings grouped by category |
| 10:12 | **Day view** (Budget): tap a day, see its spend, route totals (UPI, each card, cash) and every entry; "Add a note" in place |
| 10:13 to 10:38 | **SMS plan**: owner asked for always-on capture, an Inbox, learning. A critic said "build smaller"; the owner kept always-on with safeguards. Plan written |
| 10:36 to 10:50 | **Phone side of SMS capture**: manifest receiver, encrypted on-device queue, `SmsQueue` plugin, debug injection hook. Proven on the phone with fake messages |
| 10:55 to 11:42 | **App side**: Inbox ("To review"), Review-first and Auto-add modes, learning, drift circuit breaker, permission explainer, Ignore card or sender |
| 11:44 | Installed on the phone; pushed |
| 11:57 to 12:36 | Five agents: parser coverage (124 synthetic rows, 9 parser fixes), 4 new calculators, 5 restyled screens, findability of the SMS features, reminders (skip once) |
| 13:19 | Review lists grouped: category sections, repeat payees clubbed (finished by hand after an agent died) |
| 14:18 | Quiet hours for reminders. The other session proved reboot and time-zone rescheduling were **already working** |
| 14:45 | Final build installed |
| 15:00 onward | Owner scanned REAL messages and gave feedback (section 7). Phone test on the QA copy. Two new agents started |

---

## 3. Features by area

| Area | Built |
|---|---|
| **Calculators** | About 68 in 8 groups. New: HRA, FD ladder, LTCG harvesting, small-savings pack (SSY, NSC, SCSS, KVP, MIS, Time Deposit), gold jewellery bill, Extra EMI, Goal SIP by date, FD maturity date, Break-even |
| **Tools** | 2-column group grid, Recents row under a filled search box, group page with scoped search |
| **Budget** | Spending, categories, cards and accounts, limits, bills, income and cash flow, merchant rules, EMI payment counts, Day view, Spending summary, Bills and subscriptions, Categories and cards (restyled to the owner's designs) |
| **Net worth** | Segment inside Budget. Holdings by category; the Kind field moves old holdings |
| **Notes and Due** | Lists, calculations, to-dos, plain notes, search; reminders, repeats, snooze, skip this time, quiet hours, advance-tax pack (a switch, off by default) |
| **Settings** | First section **Bank messages** (capture, mode, delete captured, Ignored, Learned payees), then Appearance and the rest |
| **SMS capture** | Section 4 |
| **Docs** | Plans, Play Store checklist, privacy policy draft, Play listing draft, this file, resume log, phone testing guide |

---

## 4. How SMS capture works

```
  A bank SMS arrives (the app may be closed)
              |
              v
  PHONE SIDE (Android, SmsReceiver)
    only bank-style senders (letter names, never phone numbers)
    held in an ENCRYPTED, app-private queue (Keystore AES-256-GCM)
    cap 500 messages / 30 days, atomic writes, no logging
              |   you open Calc
              v
  APP SIDE (inbox.ts drain)
    parse (smsParse) -> candidate: amount, merchant, card/UPI, date
    skip duplicates, ignored cards/senders, OTPs, offers
    SAVE to storage, WAIT until persisted, THEN ack (phone forgets it)
              |
      +-------+---------------------+
      v                             v
  REVIEW FIRST (default)       AUTO-ADD THE CONFIDENT
  all wait in the Inbox        only items passing all 6 checks are added,
  you Approve / Change /       marked "Auto-added", with Undo;
  Not a spend / Reject /       the rest wait in the Inbox
  Ignore
```

**Auto-add needs ALL of:** auto mode on; exactly one matching card or account; amount and direction read clearly; not a duplicate; payee confirmed the same way twice in a row; payee not a person. **Never the first time.** A **circuit breaker** switches back to Review first if 2 of the last 10 auto-added entries were undone or edited.

**Learning is counting, no AI, no network:** one confirmation = suggestion; two identical in a row = auto-eligible; any change or undo resets it. Learned payees can be viewed, changed or forgotten (Merchant rules screen).

**Category sections and clubbing (review lists):** "Not sure" first, then categories by total. Repeat payees are one expandable row ("Amazon Pay x4"); payments are never merged into one entry. Category guesses come from keywords mapped onto the user's own categories and are labelled "guess" (`src/lib/categoryGuess.ts`, `groupItems.ts`).

**Where the code lives**

| Piece | Files |
|---|---|
| Contract between app and phone side | `src/lib/smsQueue.ts`, `src/lib/smsQueueNative.ts` |
| Phone side (Java) | `android/app/src/main/java/com/vaibhavkumawat/vkcalc/` `SmsReceiver`, `SmsQueueStore`, `SmsQueuePlugin`, `KeystoreCrypto`, `SmsCapture`; debug-only `android/app/src/debug/` |
| Parser | `src/lib/smsParse.ts` (+ synthetic 124-row table test), `statementParse.ts` |
| Inbox logic | `src/lib/inbox.ts`, `smsIgnore.ts`, `groupItems.ts`, `categoryGuess.ts`, `store/smsRuntime.ts` |
| Screens | `features/budget/InboxScreen.tsx`, `CaptureExplainer.tsx`, `ImportScreen.tsx`, `features/settings/BankMessages.tsx` |
| Masking | `src/lib/maskText.ts` |

---

## 5. Privacy and safety model

| Rule | Detail |
|---|---|
| Everything stays on the phone | No network use for message data. Android cloud auto-backup is off; the queue is excluded from backups |
| **Rule changed today** | The phone used to never store message text. Now it holds a bank message briefly, encrypted, until the app opens and saves it, then deletes it (cap 500, 30 days) |
| Only bank-style senders | Texts from phone numbers are never read or kept |
| No logging of message content | Plugin and parser have no log calls; Capacitor logging is off (`loggingBehavior: 'none'`); tests guard it |
| Masking for diagnostics | Real digits, names, UPI names and dates are swapped for look-alikes by a keyed hash. Checked 2026-11-11 on 5 realistic messages with 2 keys: nothing real survived. Known weaknesses: fake times can be invalid; the same value masks the same way within one phone |
| Parser fails closed | When unsure a message is not offered |
| Undo | Every auto-add can be undone |

**Play Store:** Google's policy lists "SMS-based money management (apps that track and manage budget)" as an exception for READ_SMS and RECEIVE_SMS, subject to review and a declaration form. Checklist in `docs/PLAY-SMS-POLICY.md`; drafts in `PRIVACY-POLICY-DRAFT.md` and `PLAY-LISTING-DRAFT.md`. (An early web-search summary wrongly said expense tracking was not listed; corrected from Google's page.) Not submitted.

---

## 6. Owner decisions (do not re-ask)

1. Tools home is the 2-column grid; the latest designs are in `docs/design-reference/screens/`.
2. SMS capture is always on once allowed. **Review first** is the default; **Auto-add the confident ones** is optional.
3. Auto-add only after **two identical confirmations**, never for UPI to a person, always with Undo and the circuit breaker.
4. Learning is counting; context hints (time of day, "UPI to a person on my commute") are **later** and suggestion-only.
5. Review lists: category sections, repeat payees clubbed, payments never merged.
6. Keep only the 2 newest `calc-e2e-*` temp test builds.
7. Play Store submission is a separate, later step.

---

## 7. Owner feedback after scanning REAL messages, and the response

| Feedback | Likely cause | Response |
|---|---|---|
| Duplicates shown, maybe under different names | One payment produces two messages (bank alert plus UPI app/bank UPI) with different merchant strings | Logic agent: merge the same payment across senders (`mergedFrom`, "2 messages merged"), list every cause found |
| Many "SBI account not in your cards" prompts | FD/TD account numbers inside deposit messages are mistaken for bank accounts | Deposit references (FD/TD/RD) are never offered as accounts |
| Wants to know if money is theirs moving (FD broken, sweep, own transfer) | Credits and debits looked like spend or income | `nature: spend / moneyIn / ownMoney`, `ownKind`, `ownWhy`; own money is "Not a spend" by default and never auto-added; the user can still count FD interest as income |
| Self transfer vs somebody else | No counterparty concept | Match against saved cards/accounts; "this is my own account" is learned per payee |
| Skip/Ignore not visually clear; clubbing "feels off" | Underlined text links wrap raggedly; the group repeats totals | Screens agent: real buttons, one action row, cleaner groups |
| (found in the phone test) a UPI payment to a person is shown as "ICICI Bank payment" | Payee name not extracted from "sent via UPI ... to NAME vpa" | Logic agent: parser fix plus regression test |
| Need real examples to refine | Cannot read real messages | "Copy masked examples" button; the owner sends the masked block after rescanning |

**⚠ The FD, deposit and self-transfer wording is built from public formats and is a GUESS.** It becomes exact only after the owner rescans and shares masked examples.

---

## 8. Tests: what is proven and what is not

| Proven | How |
|---|---|
| Capture on the phone: queue survives force-stop; duplicate and phone-number sender dropped; ack removes only acked ids; file is owner-only and holds no readable text | Phone side agent, QA copy, fake messages |
| Whole flow on the phone: row, explainer, messages caught while closed, "5 to review", clubbing, "Not sure", OTP/promo/personal chat filtered | `scripts/phone-qa/phonetest.mjs`, 2026-11-11 |
| Layout at 3 widths and 200% text | `layout-contract` 216/216 |

| NOT proven | Why |
|---|---|
| A real bank message through the whole flow | Only synthetic messages used |
| The permission-denied and Android 15 "restricted settings" paths | adb installs are exempt; Android showed no dialog. The owner is resetting the QA permission to retest |
| Behaviour after a real reboot, with battery savers, or after days force-stopped | Needs the real phone over time |
| Browser suites outside those listed | Several fail and predate this work; `docs/E2E-STATUS-2026-11-11.md` was never written |

---

## 9. Mistakes made (and the rules they created)

| Mistake | Rule now |
|---|---|
| A merge brought in a `node_modules` symlink and broke every test; "tests passed" with exit code 0 while running nothing | Never `git add -A`; read real test counts |
| Blind `adb input tap` on the owner's live phone | Never tap the real phone; test on QA via DevTools (`PHONE-TESTING-GUIDE.md`) |
| Screenshots of the device screen captured the owner's real entries | Screenshots only from inside the QA WebView |
| Assumed `pm clear` worked; the "empty" QA copy held real-looking data | Verify QA is empty; the owner clears it in Android settings |
| A real promotional SMS was captured and printed during a test | Keep capture off in QA unless needed |
| First web search wrongly said Play does not list expense tracking | Read the official page, not a summary |
| An early claim that reboot was "the most serious gap" was wrong | The reminders agent proved it already worked; check before claiming |

---

## 10. What is left

**Needs me (no decision from the owner):** finish and verify the two running agents; wire the new fields into the screens ("Your own money" section, merged count, self/other choice); the failing-browser-suite classification (`docs/E2E-STATUS-2026-11-11.md`); Due calendar view; remaining underline search fields; light-theme and 200% text reviews; Budget limit alert and month-end summary; tags, split and "owed back" (each needs a critic first).

**Needs the owner:** rescan real messages and send the masked examples; reset and retest the permission dialog on the QA copy; move old holdings to exact kinds; try Review first for about a week before Auto-add; the reboot reminder test; Play Store go or no-go and review of the policy drafts; the logger privacy fix (their docs say ask first).

**Blocked on sources:** Post Office RD, VPF/EPF rate, exit settlement.

**Later:** Portfolio phase 2 (add money, XIRR), context hints, live currency, widgets and quick tile, share as image or PDF, iOS.

---

## 11. How to continue from any account

1. `cd ~/Desktop/Personal/Cowork/Calculator && git status --short && git log --oneline -20`
2. Read `docs/RESUME-HERE.md` (agents, rules, commands, restart prompt skeleton), then this file.
3. Modified but uncommitted files belong to an unfinished agent: read, run `npm run check`, finish and commit with specific `git add` (never `-A`).
4. Phone work: `docs/PHONE-TESTING-GUIDE.md`.
5. Push only when the owner says so: `git fetch origin && git pull --ff-only origin dev && git push origin dev`.
