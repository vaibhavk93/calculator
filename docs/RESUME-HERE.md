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
| **Pushed to GitHub** | Up to `677e6c3` (2026-11-11 11:45). Everything after is local only until someone pushes |
| **On the owner's phone** | Build installed 11:44 (SMS capture, Inbox, modes, learning). OnePlus CPH2573, Android 16, installed over Wi-Fi debugging |
| **Tests** | `npm run check` = typecheck + unit tests. About 3,600 unit tests pass. Browser tests (`e2e/`) have known pre-existing failures (section 6) |

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

## 4. Agents running when this was written (12:27)

Each agent works **in place on `dev`** (no worktrees), owns a set of files, and commits with specific `git add`. None may push or install.

| Agent | Task | Owns (do not edit elsewhere) | Status |
|---|---|---|---|
| **Findability** | Make SMS features easy to find: permanent "Bank messages" row on Budget home, entries in More in Budget, move **Bank messages to the top of Settings**, clearer empty Inbox, Day view prev/next arrows and "Auto-added" label. **Then:** category sections + payee clubbing in the Inbox | `BudgetScreen.tsx`, `SettingsScreen.tsx`, `BankMessages.tsx`, `InboxScreen.tsx`, `DayView.tsx` | Running |
| **Design screens** | Restyled five screens to the owner's new designs. **Now:** category sections + payee clubbing in the manual-scan list | `SpendSummary.tsx`, `BillsScreen.tsx`, `ManageScreen.tsx`, `ImportScreen.tsx`, `DueScreen.tsx` (card view) | Screens done and committed; scan grouping running |
| **Reminders** | Reminders survive reboot/timezone change; skip one occurrence; optional quiet hours | `src/lib/reminders*`, notifications, Due store code, `android/` boot receiver | Running |
| **Tests and docs** | Bank-message parser coverage (124-row table, 9 parser fixes), classify the 12 failing browser suites, docs hygiene, privacy and Play drafts, move `@capacitor/cli` to dev dependencies | `src/lib/smsParse*`, `e2e/*`, `docs/*` | Parser, docs and drafts committed; e2e classification running |
| **Calculators** | Extra EMI (done), Goal SIP by date (done), FD maturity date, Break-even | `src/engine/*`, `src/features/tools/*` | Two of four done |

**Shared helpers (committed):** `src/lib/groupItems.ts` (group by category then payee), `src/lib/categoryGuess.ts` (keyword category guess), `src/lib/smsQueue.ts` (the app/phone contract), `src/lib/inbox.ts` (Inbox logic), `src/lib/smsIgnore.ts`.

### If an agent died (usage limit, network): how to restart its task

1. `cd ~/Desktop/Personal/Cowork/Calculator && git status --short && git log --oneline -15`.
2. Files that are modified but not committed belong to a dead agent's unfinished work. Read them, run `npm run check`; if green, commit with specific `git add`; if red, finish or `git diff` and fix.
3. Restart the task with this prompt skeleton: *"Repo ... branch dev, work in place. READ CLAUDE.md first. Your task: <row above>. You own only <files>. Before each commit run `npm run check` and `npm run build`; commit with specific `git add`; do not push; do not install on the phone."*

---

## 5. What is still to do (needs no decision from the owner)

| Item | Notes |
|---|---|
| Review the final reports of the five agents above, then run the full check myself | `npm run check`, `npm run build`, `node e2e/layout-contract.test.mjs` |
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
