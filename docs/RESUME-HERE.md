# RESUME HERE: what is running, what is done, how to continue from any account

**Written 2026-11-11 12:27 IST.** Purpose: if the owner's usage limit is hit, or a session dies, anyone (another Claude account, another
session, or a person) can pick up from this file alone. **Update the status table when an agent finishes.** Plain language on purpose.
The long-term plans live in `docs/THE-PLAN.md` (everything) and `docs/SMS-INBOX-PLAN.md` (SMS capture). This file is the **live work log**.

---

## 1. Ten-second summary

| | |
|---|---|
| **App** | Calc: a personal Android calculator + budget + notes + reminders app (React, TypeScript, Vite, Capacitor). One user, the owner |
| **Repo / branch** | `github.com/vaibhavk93/calculator`, branch `dev` (about 200 commits). Local folder: `~/Desktop/Personal/Cowork/Calculator` |
| **Pushed to GitHub** | Up to `677e6c3` (2026-11-11 11:45). **79 commits are local only**, including `c709f64`/`0885c58`. Nothing is pushed until the owner says so |
| **On the owner's phone** | Build installed 11:44 (SMS capture, Inbox, modes, learning). OnePlus CPH2573, Android 16, installed over Wi-Fi debugging |
| **Tests** | `npm run check` = typecheck + unit tests. **3,685 pass / 16 skipped** (2026-11-11 13:20). Browser tests (`e2e/`) have known pre-existing failures (section 6) |

---

## 2. Rules that must never be broken (learned the hard way)

1. **Never `git add -A` or `git add .`.** A builder once committed a `node_modules` symlink; merging it replaced the real folder with a self-pointing link and broke every test. Always `git add <specific files>`. After any merge check `git ls-files node_modules | wc -l` is **0**.
2. **Read real test output, not exit codes.** A broken `node_modules` once made `npm run check` "pass" while running nothing. Look for `Test Files ... passed` and a test count.
3. **Do not push without the owner asking.** Do not install over the owner's real app while testing: use `scripts/build-android.sh qa install` (a separate "Calc QA" copy with empty data).
4. **No real message text or real data in logs, tool output or tests.** Messages are masked (`src/lib/maskText.ts`). Capacitor logging is off (`capacitor.config.ts`, `loggingBehavior: 'none'`).
5. **Do not tap the owner's real phone screen blindly.** Use screenshots only, or the QA copy.
6. Design rules are enforced by `src/architecture.test.ts` (no raw colours outside `src/lib/theme.ts`, radius tokens only, hairlines not cards, 44px targets). Read `CLAUDE.md`.
7. Money is never a JavaScript `number`. Use `D` / `Dec` from the engine.
8. Big feature suggestions get ONE critic review first (owner's rule in `~/.claude/CLAUDE.md`).

---

## 3. What has been built (all committed locally on `dev`)

| Area | What |
|---|---|
| Calculators | About 68 across 8 groups. New this week: HRA, FD ladder, LTCG harvesting, small-savings pack, gold jewellery bill, Extra EMI planner, Goal SIP by date (more in progress) |
| Tools | 2-column group grid, Recents row, group page, filled search box |
| Budget | Spending, categories, cards, bills, income and cash flow, merchant rules, Day view, five restyled screens (Spending summary, Bills, Categories and cards, Add from messages, Due card) |
| Net worth | In Budget. Kinds: Stocks, Mutual funds, REITs, Bonds, Sovereign gold bonds, NPS, EPF, PPF (old bundled kinds kept, movable). Holdings grouped by category |
| SMS capture | Phone side: manifest receiver, encrypted queue, Capacitor plugin `SmsQueue`. App side: Inbox ("To review"), Review-first and Auto-add modes, learning (2 identical confirmations), drift circuit breaker, Ignore card/sender, permission explainer |
| Docs | `docs/SMS-INBOX-PLAN.md`, `docs/PLAY-SMS-POLICY.md`, privacy policy draft, Play listing draft |

---

## 4. Agents: all five have finished (last checked 2026-11-11 13:20)

**Nothing is running now.** The five agents below all stopped. Four had committed their work; the fifth (the review
grouping, owned jointly by Findability and Design screens) died with its work uncommitted. That work was finished and
committed by hand as `c709f64`, and the stale browser checks as `0885c58`. See "What was finished for them" below.

| Agent | Task | Status |
|---|---|---|
| **Findability** | SMS features easy to find; then category sections + payee clubbing in the Inbox | Findability committed (`dc57a0d`); **Inbox grouping finished by hand, `c709f64`** |
| **Design screens** | Five restyled screens; then grouping in the manual-scan list | Screens committed; **scan grouping finished by hand, `c709f64`** |
| **Reminders** | Survive reboot/timezone change; skip one occurrence; quiet hours | **All four accounted for.** Skip `c734f5c`; quiet hours built `9836a31`; reboot and time zone were already working (see below) |
| **Tests and docs** | Parser coverage, classify the 12 failing browser suites, docs hygiene | Parser and docs committed; **`docs/E2E-STATUS-2026-11-11.md` was never written** |
| **Calculators** | Extra EMI, Goal SIP by date, FD maturity date, Break-even | **All four done** (`55810bb`, `c75221f`) |

### What was finished for them (2026-11-11, `c709f64`)

The grouping work was complete and `npm run check` was green, but it was never committed and had two real defects:

1. **Its own new browser test could not run.** `e2e/import.test.mjs` asked for a button named "Add all 2" inside the
   sheet, and Playwright matches a name as a *substring*: the sheet's own close button is labelled "Close Add all 2",
   so two elements matched and the suite crashed. Fixed with `exact: true`.
2. **The "guess" label never appeared on the scan list** (a real bug, not a test bug). The scan pipeline was already
   pre-filling a keyword category through smsParse's own `guessCategory`, but `categoryId` recorded nothing about
   where it came from, so a guess was indistinguishable from your own earlier entry. Candidates now carry
   `categoryGuessed`, set in one shared helper (`catFields` in `src/lib/smsParse.ts`) that **both** the message scan
   and the statement import go through. Fixing that exposed a second one: a guess was being applied to a payment to a
   person, which the owner's rule forbids. Both are locked by tests.

**⚠ Remember:** `categoryId` on a Candidate means "your own earlier entry **or** a keyword guess". Always read
`categoryGuessed` alongside it. Do not add a third place that guesses a category: extend `catFields`.

**Shared helpers (committed):** `src/lib/importGroups.ts` + `src/lib/inboxView.ts` (the two grouping views), `src/lib/groupItems.ts` (group by category then payee), `src/lib/categoryGuess.ts` (keyword category guess), `src/lib/smsQueue.ts` (the app/phone contract), `src/lib/inbox.ts` (Inbox logic), `src/lib/smsIgnore.ts`.

### If an agent died (usage limit, network): how to restart its task

Agents work **in place on `dev`** (no worktrees), each owning a set of files, committing with specific `git add`. None may push or install.


1. `cd ~/Desktop/Personal/Cowork/Calculator && git status --short && git log --oneline -15`.
2. Files that are modified but not committed belong to a dead agent's unfinished work. Read them, run `npm run check`; if green, commit with specific `git add`; if red, finish or `git diff` and fix.
3. Restart the task with this prompt skeleton: *"Repo ... branch dev, work in place. READ CLAUDE.md first. Your task: <row above>. You own only <files>. Before each commit run `npm run check` and `npm run build`; commit with specific `git add`; do not push; do not install on the phone."*

---

### Reminders: what was already there, and what was not (checked in code 2026-11-11)

| Claim | Truth |
|---|---|
| **Survives a reboot** | **Already working, and not by project code** — which is why it is in no commit. `@capacitor/local-notifications` ships a `LocalNotificationRestoreReceiver` for `BOOT_COMPLETED`; confirmed merged into the app manifest in all three variants (debug, release, qa). On top of it the project adds `ReminderAlarmsPlugin.java` (counts what the phone lost, so Due can say "N reminders are back") and `reminderSync.ts` (re-syncs on every app open) |
| **Survives a time zone change** | **Already working.** `App.tsx` re-plans on resume and `planNotifications` works the time out in the phone's current zone. 6 tests in `qaNotesDue.test.ts` really switch the process time zone (clocks going back, a 2:30 am that does not exist, snooze across a 25-hour day). **Caveat: it corrects on the NEXT app open, not the moment the zone changes.** There is no `TIMEZONE_CHANGED` receiver |
| **Skip one occurrence** | Built, `c734f5c` |
| **Quiet hours** | **Was genuinely missing** (every "quiet" in the codebase was the adjective). Built 2026-11-11, `9836a31` |

**⚠ Remember about quiet hours:** every reminder notification already comes at one time the user chose
(`settings.reminderTime`). There is no other source. So quiet hours only bite when that time falls inside the
window — and then they move *every* reminder. The Settings screen says so in words; do not "simplify" that line away.

**A "2 am buzz after a reboot" was flagged here on 2026-11-11 and then checked properly: it does not happen.**
Read the whole receiver, not just one branch. `LocalNotificationRestoreReceiver` (plugin 8.3.1) does have a
"show notifications that would have been delivered while the device was off" branch that fires them 15 seconds
after boot — but an earlier guard `continue`s before it ever gets there:

```kotlin
// Fired one-shot: kept in storage only for TRIGGERED queries — never re-arm it on boot.
if (!schedule.isPerpetual() && notification.isTriggered()) { ...; continue }
```

Every notification this app schedules is a one-shot (`schedule: { at, allowWhileIdle }` in `notifications.ts`,
no `every`/`on`/`repeats`), so `isPerpetual()` is false; a reminder missed while the phone was off has a past
`at`, so `isTriggered()` is true. The guard catches all of them. The 15-second branch is reachable only for
perpetual schedules, which this app never creates. **No native fix is needed, and none was written.**

---

## 5. What is still to do (needs no decision from the owner)

| Item | Notes |
|---|---|
| ~~Review the agents' work and run the full check~~ | **Done 2026-11-11 13:20:** check 3685, build clean, layout-contract 216/216, smsinbox 27/27, import 21/21 |
| ~~Confirm boot rescheduling and quiet hours~~ | **Done 2026-11-11.** Reboot and time zone were already working; quiet hours was genuinely missing and is now built (`9836a31`) |
| Write `docs/E2E-STATUS-2026-11-11.md` (classify the failing browser suites) | The tests agent never got to it. notes-todo's 6 and qa-budget-new's 5 are already classified in section 6 |
| Install on the owner's phone over Wi-Fi, then push | Section 7 |
| Day view, due-card and design polish | Small |
| Calendar view in Due, remaining underline search fields, light-theme and 200%-font review of newer screens | After the above |
| Budget: limit-crossed alert (D2), month-end summary (D3); tags (D4), split (D6), "owed back" (D7) need a critic first | `docs/THE-PLAN.md` Block D |
| Portfolio phase 2 (add money, XIRR) | Only if the owner keeps updating holdings |

### Needs the owner (do not build without them)

| Item | Why |
|---|---|
| Tap **Scan messages** and **turn on Capture** on the phone, then report what happens | Only the owner's phone has real bank messages. The reader has only ever been tested on synthetic messages |
| Move old holdings to exact kinds (Update sheet, Kind field) | Only they know which are stocks and which are funds |
| Turn on **Auto-add** | A trust decision, after watching suggestions for about a week |
| Play Store go or no-go, privacy policy review | Business decision. Drafts exist; Google lists budget tracking as an SMS exception, subject to review (`docs/PLAY-SMS-POLICY.md`) |
| Logger privacy fix (calculator expressions logged at debug level) | Their docs say confirm with the owner first |

---

## 6. Known test state (so nobody chases old ghosts)

| Suite | State |
|---|---|
| `npm run check` | Green (about 3,600) |
| `layout-contract` | 216/216 |
| `smsinbox`, `dayview`, `portfolio`, `rules`, `import` e2e | Green |
| `budget.test`, `qa-budget-new` | Pre-existing failures: ST12, B-02 x2 (summary and export sheet at 200% font), B-22, B-23, B-104, B-105, B-107, B-117, B-401. They fail the same way on commit `3fed36e` |
| `shell.test.mjs`, others | Many failures already present on the earlier code. See `docs/E2E-STATUS-2026-11-11.md` once the tests agent writes it |

---

## 7. Commands

```bash
cd ~/Desktop/Personal/Cowork/Calculator
npm run check                      # typecheck + unit tests (read the real output)
npm run build                      # architecture gate, typecheck, build
node e2e/layout-contract.test.mjs budget     # phone-size layout checks, filter by screen name
node e2e/smsinbox.test.mjs         # a single browser suite

# Phone (Wi-Fi debugging): turn on Wireless debugging on the phone, same Wi-Fi as the Mac
ADB=~/Library/Android/sdk/platform-tools/adb
$ADB mdns services                 # shows the phone's current ip:port (it changes every time)
$ADB connect <ip:port>
scripts/build-android.sh install   # tests, build, install on the phone (keeps data)
scripts/build-android.sh qa install   # separate "Calc QA" copy, empty data (for tests)

# Push (only when the owner says so)
git fetch origin && git status && git push origin dev
```

Other Claude sessions may push to `origin/dev` too (a cloud session added docs on 2026-11-11). Always `git fetch` and `git pull --ff-only origin dev` first.

---

## 8. The owner's decisions so far (do not re-ask)

- Tools home is the **2-column grid**. Latest design files are in `docs/design-reference/screens/`.
- SMS capture is **always on once allowed**, held encrypted on the phone until the app opens, then reviewed. **Review first** is the default mode; **Auto-add the confident ones** is optional.
- Auto-add only after **2 identical confirmations**, never for UPI-to-a-person, with **Undo** and a **circuit breaker** (2 of the last 10 undone: back to Review first).
- Keep old test-build folders: the newest 2 only (`/var/folders/.../T/calc-e2e-*`).
- Add review grouping: **category sections, repeat payees clubbed** (a view only; payments are never merged).
- Everything for a Play release is a later, separate step.

---

## 9. How to know the work is really done

1. `npm run check` shows `Test Files ... passed` and a count, with no failures.
2. `git status` is clean (apart from the owner's `docs/design-reference` files) and `git ls-files node_modules` is 0.
3. The build is installed on the phone and the owner's test sheet (given in chat) passes.
4. `git push origin dev` succeeded and `git rev-list --left-right --count origin/dev...dev` is `0 0`.

---

## 10. Live log, 2026-11-11 afternoon (owner feedback after scanning REAL messages)

**Installed on the phone:** commit `26a9f8a` (14:45). Pushed. QA copy ("Calc QA", `com.vaibhavkumawat.vkcalc.qa`) is a separate app: **clear its data from Android settings** (adb `pm clear` is refused on this phone). It once held real-looking data: always check it is empty before injecting fake messages, and never print its screen text.

**Phone test (QA copy, fake messages, 2026-11-11 ~15:30), driven over Chrome DevTools (`adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>` + Playwright `connectOverCDP`) and the debug receiver:**
PASS: Budget row with capture off; explainer before any Android dialog; messages caught while the app was closed (5 to review); Inbox lists Swiggy and Amazon clubbed (x2) with a "guess" category and a "Not sure" section; OTP, promo and a personal chat never reach the Inbox.
FAIL: a synthetic "sent via UPI from ICICI Bank A/c ... to RAHUL SHARMA rahul.s@okaxis" shows as "ICICI Bank payment" (payee name not extracted). Sent to the logic agent.
Not tested: the denied-permission and restricted-settings paths (Android did not show a dialog).

**Owner feedback (real scan), and the two agents working on it now:**
| Feedback | Agent and task |
|---|---|
| Duplicates shown (probably one payment = two messages from different senders with different names) | **Logic agent**: collapse same payment across senders (`mergedFrom`), find every cause |
| Many "SBI account not in your cards" prompts (likely FD/TD account numbers) | **Logic agent**: deposit accounts (FD/TD/RD) are never offered as bank accounts |
| Wants to know if money is theirs moving (FD broken, sweep, own-account transfer) vs real spend/income | **Logic agent**: `nature: spend|moneyIn|ownMoney`, `ownKind`, `ownWhy`; never auto-added; default "Not a spend" |
| Self transfer vs somebody else | **Logic agent**: counterparty self/person/merchant, learned per payee (`markPayeeSelf`), matches saved instruments |
| Wants real examples to refine, without exposing data | **Logic agent**: masked samples + "Copy masked examples" button |
| Skip/Ignore buttons not visually clear; clubbing "feels off" | **Screens agent**: real buttons, tidy action row, group layout; later wires `mergedFrom`, "Your own money" section, self/other choice |

Files: logic agent owns `src/lib/smsParse*`, `inbox.ts`, `maskText.ts`, store; screens agent owns `ImportScreen.tsx`, `InboxScreen.tsx`, css. After both report: run `npm run check`, smsinbox and import e2e, layout-contract; message the screens agent to wire the new fields; reinstall; ask the owner to rescan and send the masked examples.
