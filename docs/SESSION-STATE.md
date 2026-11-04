# Session state: resume here

## Round 12 (2026-11-04): Block B3/B4/B5 done, built and installed on the real phone, verified live

**Last prompt:** "yes, continue with B3 and B4/B5" then "I connected my phone as well i want you to build
everything, create the build, install on phone and then test on my phone".

**Built:** B3 (post-"=" chips -> 3 quiet icon buttons, `.result-actions__btn`, same visual language as
KeepAndShare) and B4/B5 (the three-tier rule applied to Due's Overdue/This week/Later and Notes'
Pinned/Lists/Calculations and To-do's Overdue/Today/Upcoming/No date/Done -- all tinted cards became
hairline `.group`/`.group__title` lists). Full reasoning and the exact verification method in commit
`4d25b3b`.

**One real, pre-existing bug found and fixed while verifying B4/B5:** Due's "Add a pack: advance tax"
panel sat outside the scrollable list as a flex:none sibling with no height limit, so at 200% font with
enough reminders it could overflow past the viewport and bleed under the tab bar. Confirmed pre-existing
against the commit before this change using an isolated `git worktree` (not stash -- see the note below)
at the SAME commit, byte-identical numbers. Fixed by moving it inside the scrollable list.

**⚠ A stash incident, for next time:** combined `git stash` + a 5-minute-timeout test run + `git stash pop`
in one shell call. The run hit the timeout and the whole command was killed BEFORE `git stash pop` ran,
leaving the B4/B5 work sitting in `stash@{0}` with a clean-looking working tree. Caught it immediately
(`git stash list` still showed it) and restored with a bare `git stash pop`, no data lost. **The fix used
for the rest of the session: `git worktree add /tmp/calc-baseline <commit>` instead of stashing** --
tests the old code in a completely separate directory, zero risk to the working tree, no restore step
needed. Prefer worktree over stash whenever a baseline comparison needs the OLD code to actually run
(not just be read).

**Verified zero regressions, three ways:** `npm run check` (2529 pass) · `layout-contract` + `answerbar`
e2e 100% (144/144, 7/7) · `budget.test.mjs` / `qa-notes-due.test.mjs` / `reminders-lists.test.mjs` failure
lists diffed against the pre-change worktree, byte-identical.

**Then built and installed the REAL app (not Calc QA) on the connected phone**
(`scripts/build-android.sh install`, phone `fb83a61a`) at the owner's explicit request. The first `adb
install` in the script's own run failed with a truncated error (likely transient); a direct retry
succeeded immediately. **Verified live on the device, with the owner's real data, via screenshot** (not
just "it built"): B3's icon-only row under a finished calculation, B2's bare Budget hero + hairline Recent
+ collapsed "More in Budget", B4/B5's hairline Due groups with the `due__pack` overflow fix confirmed
(no longer bleeding under the tab bar), Notes' hairline Pinned/Lists groups, To-do's empty state. Zero
errors in `adb logcat` across the whole session. Per the established safety rule, this was READ-ONLY
navigation (tab taps, one scroll) on the real app with real data -- no bulk taps, no edits, no deletes.

**Not yet done:** Phase 7-adjacent items not in B1-B5 scope. The `ink-3` contrast decision and date-locale
decision from Round 10 are still open (`docs/THE-PLAN.md` section 5). `docs/THE-PLAN.md` itself has not
been updated with B3/B4/B5's "Done" status yet -- do that first on resume.

## Round 11 (2026-11-04): Block A (trustworthy tests) and Block B1/B2 (Budget home redesign) done

**Last prompt:** "sure lets start" (confirming Block A + B2 from `docs/THE-PLAN.md`).

**Built:**
- `.nvmrc` (22) + `engines` in `package.json` + `e2e/run-all.mjs` (`npm run e2e` / `npm run e2e:fast`) —
  checks the Node version itself first, with the fix in the error message.
- `e2e/layout-contract.test.mjs` — every tab x 3 widths x 2 font scales x seeded long content. **144/144
  passing.** Caught and fixed two bugs in the TEST ITSELF while building it (both documented at length
  in `docs/THE-PLAN.md` Block A): `getBoundingClientRect()` ignoring scroll-clipping caused false
  "overlap with the tab bar" reports; the 44px rule was wrongly encoded as "both dimensions" when the
  project's own rule (`DESIGN-SYSTEM.md` section 9) is "one direction".
- Budget home rebuilt per a new "three tiers" design rule (`DESIGN-SYSTEM.md`, new section after Section
  colours): the hero figure is now bare (no card), Needs attention + Recent are hairline lists (no tint),
  and 4 separate tinted navigation cards (Spending summary / Bills / Add from bank messages / Categories
  and cards) collapsed into one `.navrow` list under "More in Budget" — reusing the exact pattern
  `ManageScreen.tsx` already had, not inventing a new one.
- Fixed a real pre-existing bug found while verifying B2: `qa-budget-new.test.mjs`'s `toBills`/`toSummary`
  helpers were pinned to `.tap-row`, which Budget's EMPTY state doesn't use (it uses `.link-btn`) — fixed
  by matching on accessible name instead. Confirmed pre-existing with `git stash` before fixing (not
  something this session's edits caused).

**Verified, zero regressions:** `npm run check` (2529 pass, 16 skipped) + `answerbar`/`layout-contract` e2e
(both 100%) + `budget.test.mjs`/`qa-budget-new.test.mjs` failure lists diffed against the pre-change commit
— identical except one test (B-206) now passing. Visually confirmed in the browser against real seeded
Budget data (12 expenses, categories, a card): bare hero, hairline Recent list, collapsed nav list, no
console errors.

**Still open (not this round):** B-401 (Spending Summary unreachable from a *fully* empty budget — no
such link exists in the empty state; a real product question, not a selector bug) and B-212 (a stopped
bill possibly leaving a ghost reminder) — both pre-existing, found while verifying, out of scope to chase
further right now. B3/B4/B5 (demote post-"=" chips, apply the three-tier rule to Notes/Due/Tools) not
started. The `ink-3` contrast decision from Round 10 is still open.

**Not committed, not pushed yet when this was written** — commit and push next.

## Round 10 (2026-11-04): all plans consolidated into `docs/THE-PLAN.md`

**`docs/THE-PLAN.md` is now the single plan.** It replaces MASTER-ROADMAP, ROADMAP, BACKLOG,
IMPROVEMENT-PLAN, UI-UX-PLAN, UX-AUDIT, TOOLS-UX-REVIEW, TAP-AUDIT, UX-IMPROVEMENT-PLAN-2026-11-04,
CAPABILITY-GAPS, TEST-PLAN-REMAINING, the 6 REVIEW-* files, the 6 TEST-REPORT-* files,
COMPETITIVE-RESEARCH-AND-PLAN, GTM-STRATEGY, and the "what's left" halves of BUDGET-PLAN /
NOTES-TODO-PLAN / PORTFOLIO-PLAN / FEATURES. Those files are kept as history, not plans.

**Two infrastructure facts that explain why audits kept missing real bugs:**
1. **`npm run check | tail` returns tail's exit code.** A previous session reported green while
   typecheck was exiting 2. Never read a result from a piped exit code.
2. **Default `node` here is 18; Playwright needs 20+.** Node 22 is installed at
   `~/.nvm/versions/node/v22.23.1/bin`. **e2e suites cannot run without putting it on PATH:**
   `export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"`. Needs an `.nvmrc` (Block A1).

**The answer-bar fix took three attempts; the first two looked right and were not:**
- Attempt 1 (`padding-bottom` on the scrolling box) fails because **a sticky element is clamped to its
  parent's content box** and cannot travel into padding.
- Attempt 2 (real-height anchor) fails because **showing the bar made the page taller**, so arriving at
  the bottom pushed the bottom further away and the bar stayed pinned over the Copy/Share row.
- Attempt 3, correct: the bar is **always in the DOM** and only becomes `visibility: hidden`
  (`.answer--idle`), so the page height never changes.
- **A manual browser check at 375×812 passed attempt 2. The automated test at 360×790 caught it.**
  This is the strongest evidence yet that checking one size by hand produces false passes.

**Verified before pushing:** typecheck clean · 2529 unit tests pass, 16 skipped · `e2e/answerbar.test.mjs`
7/7 · `e2e/tools1.test.mjs` 417/461 (was 384/461 — improved, no regression).

**Open SMS findings (need a phone to confirm):** `SmsInboxPlugin.java:73` uses `now − N×24h`, not calendar
days, so "last 7 days" means something different depending on the hour. And `markSmsSeen` (`app.ts:779`)
silently hides already-reviewed messages with no count shown, so a scan can look broken when it is not.

**Owner decisions still open:** see `docs/THE-PLAN.md` §5 — `ink-3` contrast (3 options), date locale,
Phase 7 module switches, Portfolio timing.

## Round 9 (2026-11-04): open tasks closed, six-area improvement plan written

**Last prompt (verbatim):** "start with open / not yet done tasks / create plan to improve / 1. Calculation
bottomsheet UI and UX, check if we need all the details present or not Or if any other use case is missing /
2. On Recurring revenue forecast and other similar pages - yearly revenue (ARR) after 12 months is partly
floating and inappropriately show/hide at any times - review and make corrections. if this is hyperlink then
it should be appropriately presented on UI and UX / 3. Icons of copy, share are not appropriate shown, placed
in terms of UI and UX / 4. UI, UX, capability and features of Notes and to-do is not appropriate / 5. Notes
can be anything but we specifically only created list, Label + amount, it is only limited to few cases. I want
you to research on how to improve "Notes" / 6. Same goes for budget as well, check what and how can we improve
/ 7. For all above i want you to look or research from multiple POV - UI, UX, Features, User Flow, improvement"

**Plan written: `docs/UX-IMPROVEMENT-PLAN-2026-11-04.md`.** Nothing from Part B/C is built yet.

| Step | Status |
|---|---|
| `npm run check` was **broken** — tsc exited 2 on 3 errors in the uncommitted QA files, so unit tests never ran | **FIXED** (`qa-fuzz.test.ts` generic `big<T>`, unused `atTime` import dropped) |
| Unit tests now run | 2504 pass, **9 fail** |
| 8 failures = `qa-contrast.test.ts`, `ink-3`/`alert` on all 8 dark tints | **Real bug, not fixed** — palette change, needs a deliberate decision |
| 1 failure = `expenseEdits.test.ts` "2 Nov" vs "Nov 2" | **Test bug** — dates use device locale (`Intl.DateTimeFormat(undefined,…)`, 10 call sites). Pin the locale in the test |
| ARR floating bar: 4 bugs **measured in a real browser**, not inferred | planned, not fixed |
| Critic run on "calculation-aware notes" | **Verdict: BUILD SMALLER.** Auto-detect cut; plain `kind: 'text'` note only |

**⚠ Remember:** a previous session reported `npm run check` as passing when it was not. `npm run check | tail`
returns *tail's* exit code. Check `${PIPESTATUS[0]}`, or do not pipe.

**The four measured ARR-bar bugs** (`ToolScreen.tsx:622-631`, `tools.css:81-117`) — all app-level, they affect
every tool with a `main: true` row:
1. **Strobes.** One `threshold: 0.2` with no hysteresis; scrolling 3px (592↔598) toggles it on and off.
2. **Arrow points down** while the answer is above (measured `mainTop: -18.5`). Hardcoded `name="down"`.
3. **Covers the Copy/Share row entirely** (measured `coveredByAnswerBar: true`). This makes owner issues 2 and 3 the same bug.
4. `.result__row--main` is styled identically to every other row, so the bar's destination is unmarked.

**Still unresolved from Round 8, still needs the owner:** the real Budget entry that changed from Spending to
"Transfer between own accounts" between 21:08 and 21:45 on 2 Nov 2026.

**Not committed, not pushed.** Branch `dev`, 5 commits ahead of origin.


**How to resume (another account, a new session, or after a token limit):** open this folder in Claude Code and say
"Read docs/SESSION-STATE.md and continue from the status table." Everything needed is in this file, `CLAUDE.md` and `docs/`.
This file is updated after each step. The full history is in git (`git log --oneline`).

Last updated: 2026-11-02 20:55. Round 4 running. At ~19:20 the account hit its 5-hour limit and the 5 helper agents stopped before saving code; limit reset 20:20 and they were restarted from the start of their briefs. Phone was disconnected at 20:50 (adb: device not found). Branch `dev` (tracks `origin/claude/personalized-calculator-research-dl43uk`).

## Round 6 (2026-11-03): work the MASTER-ROADMAP phase by phase

**Last prompt (verbatim):** "check the updated roadmap and start working on phase 1, phase 2 and others one by one. also let me cherry pic from "Ruled out — do not re-suggest these" items like "Read SMS, email, or bank statements to auto-log spending" is absolute must to actually make things easy for users."
**Later message:** "for SMS parser let it keep log so that we can check where it failed and improve the parser next time based on that."

Roadmap = `docs/MASTER-ROADMAP.md` (Phase 0 done, 1 next, 2 soon, 3 later, Ruled out). Order of work: Phase 1 -> Phase 2 -> pick from Phase 3.

| Step | Status |
|---|---|
| Critic on SMS capture (verdict: build, smaller v1, 8 guard-rails) | done |
| SMS capture: plugin, parser + 29 tests, review screen, redacted reader log, `docs/SMS-CAPTURE.md`, allowBackup=false | built (code); not yet on a phone |
| Phase 1 reminders (time picker, test reminder, advance-tax pack, backup nudge, stale e2e) | done (helper) |
| Phase 1 Budget (utilisation, card cost, CSV export, add expense from calculator) | helper running |
| Phase 1 tools (exact split, rule-of-thumb conditions, checked-against label, budget e2e) | helper running |
| Phase 2 backup/restore bugs SH-K16/19/26 | done: not app bugs, test clicked wrong element (fixed in e2e/shell.test.mjs; restore.test.ts added) |
| Phase 2 calculators part 1 (emergency fund, DTI, savings rate, markup, two inflation rates, SWP split rate; 51->55 tools) | done |
| Phase 2 loans (runway, multi-loan avalanche/snowball, one loan-term box; 57 tools): done. TODO: e2e/tools1.test.mjs still taps the removed tenureUnit switch | done |
| Phase 2 Budget: bills and subscriptions, card statement cycle + bill reminder, search, refunds, trip total | done in code + unit tests + 360px browser pass (docs/BUDGET-PLAN.md section J); not on a phone. Tool UI half (use-in/chip/invalid marking/world time/unequal split): other helper |
| Phase 3 tool-screen items (freshness line, example-values note, labelFor, advance-tax cluster, amount chips, Reset+Undo, date span, one 80C name, Your tools, tools1 e2e fixed) | built, unit tests; 360px and 200% browser pass `e2e/phase3.test.mjs`; not on a phone |
| Import screen e2e (e2e/import.test.mjs) + Budget remount bug fixed | done, 10/10 |
| Statement CSV import (extension of SMS capture) | planned |
| Owner still to pick from "Ruled out": list shown in final report |  |
| Not pushed. Owner must say "push". Phone: only Calc QA gets test installs. |  |

**Later messages (2026-11-03, after Phase 2):**
- "for SMS parser ... add a module which changes the numbers via encoding so LLM does not read the actual data ... check how other apps allow sms reading under google ... SMS auto-logging is not working. test on phone. install ... solve issues and then push. after all these work on phase 3." DONE: sender filter bug (-S suffix) fixed, scan works on phone (117 payments found), allowlist masking module, Play policy checked (budget apps are a listed exception, needs declaration form), pushed 352f643, real Calc updated 07:43.
- "possible to add categories and payment mode from the SMS?" DONE: mode read from text + matched card, cards/accounts offered via "Add to my cards", category by earlier payee else keyword guess.
- "help user onboarding step by step for budget, notes and due, tell him what he can do. also add capability to check mode and sub payment mode or type of payment. test all the features you created step by step from 0 to 1 with all type of test cases and evaluate improvements as Experienced Product manager, UX designer, UI designer, developer and QA after building remaining phases."  PLAN: (1) wait for the 3 Phase 3 helpers; (2) onboarding tours for Budget/Notes/Due (+ replay in Settings); (3) payment-mode/sub-mode view (mode -> card/account/UPI source breakdown + filter); (4) QA campaign 0 to 1 across all features + a five-role review (PM, UX, UI, dev, QA) -> docs/ROLE-REVIEW-2026-11-03.md; (5) fix, build, install, report.

**Phase 3 helper status (11:50):** reminders/lists DONE (battery-settings guide per phone brand, may-not-have-shown notice, several lead times, repeat after tick, 3-state checklist lines, paste list, inline rename). Java for BatterySettingsPlugin built in the real APK next. Tools polish and budget/bugs helpers resumed after the 11:20 limit reset. Next: onboarding tours, payment-mode view, QA campaign, five-role review.

**All build phases done (12:35):** Phase 1, 2, 3 (non-gated items), onboarding tours, Paid-with tree, committed e353bc1 locally (pushed up to 352f643). Phase 3 items NOT built on purpose (gated/large/permission): HRA, FD ladder, gold bill, LTCG harvest, widget, share-in, Quick Settings tile, iOS, remote rules packs, PDF/image export, exit settlement, multi-goal, photo on note, app lock, rewards helper.
**Now running:** 4 QA helpers (budget-new, notes-due, tools, cross-cutting). Then: five-role review (PM, UX, UI, dev, QA) -> docs/ROLE-REVIEW-2026-11-03.md, fix, build, install real Calc, push, final report. Calc QA on phone has the 12:15 build (Java plugins compile).

## Working rules the owner set (also in CLAUDE.md)
1. **Think at app level, always.** A request that names one screen is a sample of a pattern. Find every place with the same pattern and fix them all. Say what else you found.
2. Ask only when a choice is expensive or cannot be undone. Otherwise decide, build, and report.
3. The system back button is never required. Every screen has a visible Back, every sheet a close X and a footer button.
4. Update this file between steps. Keep the last prompt below.

## The last prompt (verbatim, 2 Nov 2026, round 4)

> Under the categories, I am mistakenly clicked on a certain categories and there was a bottom sheet for me to set budget but this was done by chance and what I am pointing out as like this the design should be in a way where I am able to see or I am able to know that there is or there is should be some indication to know. That a button or clickable or this is something clickable. I want you to analyze entire app wherever you think there are some options to click. Do. Make changes to identify same. I just checked if I continuously add numbers, multiplying so till a particular lakh crore it works in Indian. But post that it doesn't work and same goes for international format also and if I even add it more and more. Then the UI gets broken, the numbers are visible and everything gets broken. I want you to analyze how calculator solve for this particular problem and implement similar thing but A person should be able to like if if there is a capability to go above lakh crore or trillion in international format then add that format and if There is no such format present in that situation. I want it to be work, I want it to be work as calculator in a way how calculator handle this particular problem. There should be capability to set monthly budget and user can select whether to make it month on month or or just that particular month. There are times when I have a new category open for a specific month but not for the whole month. So I want that to be solved for. I am just sharing all of these information from our thought process. Do these may be in, these may be very specific to a particular problem but I want you to analyze it, see it at app level, always see it at. App level if if there is certain things which I highlight could be for a very small thing but I wanted to think from app level perspective how we can incorporated. If certain behavior is told by me, certain use cases shared by me, then I want you to think from multi dimension in those certain scenario so that and plan it. So that we can create this app in a well thought format. There is no capability to add categories or add sub categories or UPI payment and sub payment mode and their inter linking. I want those also to be created if not. do this always or ask me if I want you to think it wholesomely or just what i shared (make it rule). Based on what we have discussed till now, create the app and install it. What I mean to say is create all the features, resolve all the bugs. We discuss till now. Do all the improvements and new task that we have discussed previously and accounted for in the roadmap and Then build the app and install it in my phone. Also in between each step that you are doing, I want you to either save the prompt, the last prompt and the Progress so that if in case in between certain token is in a particular account token limit is occurred then I can just switch to another account and during this. Change, I shouldn't be losing any context and I should be able to resume fair from where I was working on. scientific calculator UI issues aren't fixed. in bottomsheet for add expense navbar is also added which is incorrect. under UPI add Bank by default option and "Add credit card" as another option + previously added cards + allow more card details to be added to become better identifier and can extrapolate in future to card module. do you think we should add Name and Bank field under bank, also should we create Bank as Type or Not? could you test my app directly? for UI issues or runtime issues when phone is connected? I have seen if numbers are too large then layout is breaking at multiple places audit same and fix. in last 6 months show recent months up. show day wise spend heatmap as well similar to how claude code does. to optimise for space can we show the categories and options in pills at wherever appropriate or does it look too cluttered ? is there a way to solve the clutter? what is running if not required then close. based on the above improve the app build, test, improve, build and install the app in mobile.

## Status (update as steps finish)

| # | Work | Owner | Status |
|---|---|---|---|
| 0 | Resume file, rules in CLAUDE.md, close idle processes | main | done (gradle daemon to stop after final build) |
| 1 | Add-expense sheet must cover the tab bar (portal) | main | done (Sheet draws into .app); needs phone check |
| 2 | Huge numbers: calculator-style handling (words up to the largest named unit, then scientific notation), layouts never break | agent A | DONE (formatBig: plain to 15 digits, then 1.2345E+25; words tables extended; fit fallback). Remaining risk: text values with spaces may wrap |
| 3 | Budget model: limits "every month" vs "this month only", categories for chosen months only, card details, UPI default bank, settlements | agent B | DONE (limitByMonth, months, card fields, settlement, cardOutstanding, KNOWN_BANKS) |
| 4 | (RUNNING, agent C) Budget UI: limit scope, UPI paid-from (bank default, add card, saved cards), card form, category pills with recents, heatmap, six months newest first, discoverable Categories and cards | agent C (after B) | todo |
| 5 | Tappable things look tappable, app-wide; confirm/undo for destructive actions; disabled style; keyboard | agent D | DONE for tools/settings/due/components (docs/TAP-AUDIT.md). TODO: apply the same to Budget rows, Notes rows, History rows (their workers) |
| 6 | Notes + To-do phase 1 (docs/NOTES-TODO-PLAN.md) | agent E | DONE phase 1 (TodoScreen, TaskSheet, tasks in Notes). Not done: Discard-changes on task sheet; 'Done' wording in notifications |
| 7 | History power-ups A16-A20 | agent H | DONE (HistoryRowSheet, lock, edit, share) |
| 8 | Test on the phone directly (adb): scientific layout, runtime errors | main | in progress |
| 9 | Scientific calculator: fix what the phone shows | main | FOUND on phone: bottom key row hidden under tab bar on a tall phone (display min-height 22dvh + keypad rows >= 52px). FIXED in CSS (global.css .sci-screen), needs phone re-check after rebuild |
| 10 | Full checks, build, install, final phone test | main | todo |

## Decisions made this round
- Bank is both a **type** (a bank account instrument) and a **field** (the issuing bank on every card or account). Fields on a bank account: Name, Bank, last four digits of the account, optional UPI handle.
- Pills (chips) are used when there are about 6 or fewer options; more than that, show the 5 most recent as pills plus "More" which opens the picker.

## Where things are
- Plans: `docs/BUDGET-PLAN.md`, `docs/NOTES-TODO-PLAN.md`, `docs/FORMS-AND-SHEETS.md`, `docs/ROADMAP.md`, `docs/BACKLOG.md`, `docs/HANDOFF.md`.
- Build and install: `scripts/build-android.sh install` (phone `fb83a61a`, see `docs/BUILD-ANDROID.md`).
- Tests: `npm run check`. Audit harness: `e2e/audit-harness.js` (see `docs/TESTING.md`).

## If you resume after a limit
1. `git status` and `npx tsc --noEmit -p .` first: helper agents may have left files half edited (SettingsScreen was mid-edit at 20:55).
2. Check which helpers finished by looking for their reports in this file's status table; re-run any that did not.
3. Then: `npm run check`, `scripts/build-android.sh install` (phone must be connected: File transfer, unlocked).

## Phone test log (21:02 build, OnePlus, light theme)
- Scientific portrait: all keys visible above the tab bar. FIXED and confirmed.
- Huge number (eight 12-digit nines multiplied): result shows 9.99999E+41, no overflow. Confirmed.
- BUG found and fixed in CSS (needs rebuild + phone re-check): the keypad slid DOWN as the expression grew because `.display` was as tall as its content. Now `.display` has a fixed height (26dvh; scientific 17dvh).
- Budget home, Spending summary fit the real phone. Row tap cues come from agent C (running).

## Phone test at 21:06 (build ea10474): incident and rules
- Install OK (21:06:42). I typed a long expression by sending adb taps at coordinates taken from a screenshot. The app was no longer on the Calculate screen when the taps landed; they opened the Budget 'Edit expense' sheet instead (unsaved) and the phone screen then went black (locked).
- Checked the stored data afterwards (counts only): 6 expenses, 0 deleted, 0 settlements, 11 categories, 3 instruments, 6 notes, 22 history rows, calculator input empty. **Nothing was changed or lost.** The temporary copy of the data was deleted.
- RULES for phone testing from now on: (1) take a screenshot and confirm the screen before EVERY batch of taps; (2) never tap in bulk on screens that have delete or save controls (Budget, Notes, Due, History); do bulk typing only on Calculate/Scientific after confirming; (3) wake the phone first (it may be locked and needs the owner's PIN); (4) the owner's real data is on the phone: read counts only, never contents.
- Still to re-check on the phone: keypad stays still while typing a long expression; new Budget screens (limit scope, pills, UPI paid-from, heatmap).

## Round 5 request (2 Nov 2026, ~21:20), saved verbatim
> test all the features and the flows step by step and find 1. bugs 2. areas to improve 3. find what else can be added to system to make system better and improved 4. how flows can be improved 5. check how can we make different information easy to visualise 5. how can we make make things, flows, pages, section, app easy and more intuitive to use.

Plan: main session tests live flows in the browser with seeded test data (never the owner's real data) and on the phone with a screenshot before every step; four read-only helpers write `docs/REVIEW-BUGS-STATIC.md`, `docs/REVIEW-FLOWS.md`, `docs/REVIEW-VISUALISATION.md`, `docs/REVIEW-NEW-FEATURES.md`. Then main merges everything into `docs/REVIEW-2026-11-02.md` and a critic checks the top feature suggestions (owner's global rule). Status: STARTED.

## 21:45 finding on the phone (owner's real data)
- The owner's Budget entry 'Rs 100, Food, UPI, HDFC, tiffin lost and found' (2 Nov) now reads 'Transfer between own accounts: Not counted as spending' (month total 58,310 -> 58,210). At 21:08 the stored data had NO transfers, so the save happened after that. Either the owner saved it or a later tap of mine did: unknown. DO NOT edit it without asking. Ask the owner; if they did not intend it, restore by opening the entry and choosing 'Spending' under 'What is this', then check category Food and Paid with UPI from HDFC are still set.
- Verified working on the phone: keypad stays still while typing a long expression; result 9E+72 correct.
- Idea from this: switching an entry to Transfer or Card bill changes totals silently; add a one-line confirmation or an 'Undo' snackbar after Save (see docs/REVIEW-LIVE-TEST.md).

## Round 5b (22:05): thorough test campaign
Owner asked whether everything was tested negatively, positively, error/corner/UI/UX/runtime, and for an improvement plan. Honest answer: not thoroughly. Built `e2e/lib.mjs` (Playwright core + installed Chrome, phone viewport, seeded data, console-error capture). Six test helpers (calculator, tools 1, tools 2, budget, notes/to-do/due, app shell/settings/backup/a11y) each write `e2e/<area>.test.mjs` and `docs/TEST-REPORT-<area>.md` (bugs are REPORTED, not fixed). Then main merges all reports + REVIEW-*.md into `docs/IMPROVEMENT-PLAN-ROUND5.md`.

## Calc QA (22:20): the safe phone-test app
`scripts/build-android.sh qa install` builds and installs **Calc QA** (`com.vaibhavkumawat.vkcalc.qa`, own empty data) next to the owner's real Calc (`com.vaibhavkumawat.vkcalc`, untouched, last updated 21:06:42). ALL automated phone taps, bulk typing and screenshots go to Calc QA only: `adb shell am start -n com.vaibhavkumawat.vkcalc.qa/com.vaibhavkumawat.vkcalc.MainActivity`. Never run taps against the real app. Never change the debug applicationId.

## Round 6 (this session, continuing after a session switch)

**calculator-93 archived at the owner's request** ("I do not think it is doing anything"). Found via
`mcp__ccd_session_mgmt__list_sessions`: it was `local_e893111a-2cbb-4ad3-be16-7309fc010d53`, title "Merge and push",
the only other running session in this folder. Archived cleanly (stops the process, not a raw `kill -9` on a guessed
PID). **Confirmed as the cause of every `adb shell` hang this session saw** (`echo hello` itself was timing out):
the instant it was archived, `adb shell echo hello` answered immediately. It had been holding the device's one
shell/transport slot the whole time.

**Still unresolved, needs the owner's answer, asked again:** the real Budget entry that silently changed from
Spending to "Transfer between own accounts" between 21:08 and 21:45 (see "Phone test at 21:06" above). Not
touched by this session.

**e2e suites, run for real for the first time (started before the archive, in background):**
- `tools1.test.mjs` (26 cases): started, result pending
- `budget.test.mjs` (79), `notes-todo.test.mjs` (45), `calculator.test.mjs` (272), `shell.test.mjs` (166): queued
  sequentially in background, result pending
- `tools2.test.mjs`: confirmed to have **zero actual test cases** -- real, independently-verified reference
  formulas (SIP, PPF, tax slabs, XIRR) and the runner scaffold exist, but no `T(...)` case was ever written and
  the file never calls `runAll()`. Calculators 27-51 (SIP, investments, tax, business metrics) have no e2e
  coverage. Needs the actual cases written.

**Now switching to phone testing per the owner's instruction** ("execute the test mobile first"), using **Calc QA**
(`com.vaibhavkumawat.vkcalc.qa`, own empty data) -- never the owner's real Calc app -- and the safety rules already
written above (screenshot before every tap batch, no bulk taps on Budget/Notes/Due/History, wake the phone first).

## Round 6 continued: results

**Committed:** `453ba23` (capHistory fix, real bug CALC-254 found by the test run, verified by hand and fixed) and
`42ef20d` (the six e2e suites, previously written but never committed).

**Phone (Calc QA, com.vaibhavkumawat.vkcalc.qa):** huge-number multiply (8x 12-digit nines) gives `1E+96`, no crash,
keypad stays in place -- confirmed fixed. Scientific portrait: all rows visible, no clipping -- confirmed fixed.
Tools home: tinted section cards render correctly, re-sorted taxonomy live. Notes/Due/Budget empty states all
render cleanly. Not yet checked on the phone: Scientific landscape, Budget with real data entered, Notes/Due with
items (deliberately not bulk-tested per the safety rules).

**e2e suites, run for the first time:**

| Suite | Cases | Fail | Report |
|---|---|---|---|
| tools1 | 461 | 77 | `docs/TEST-REPORT-tools1.md` -- the 2 MATH failures checked by hand: **both false positives**, app is correct |
| budget | 117 | 18 | `docs/TEST-REPORT-budget.md` -- B-23/B-06 money-entry bugs reconfirmed; one real card/bill-payment bug (B-04) |
| notes-todo | 45 | 12 | printed twice by the harness (a harness bug, not re-tested); real finds: tag case-folding ("Rent"/"rent" not merged), pin-limit message not shown, trash purge boundary off |
| calculator | 282 | 39 | **biggest single finding: cursor-aware editing does not work at all** -- tapping mid-expression and typing/backspacing/pasting always acts at the end, never at the tap position (~12 cases, one root cause). Also: bottom key row hidden under the tab bar at 360x640 (CALC-331, matches an old complaint); Scientific overflows sideways with a long expression (4 cases); `.display__result` has `cursor: not-allowed` even though tapping it works (CALC-383); **found and fixed** CALC-254 (see above) |
| shell | 286 | 215 pass / 71 fail / 29 notes | done. Full triage in [TEST-REPORT-shell.md](TEST-REPORT-shell.md) |
| tools2 | 208 (was 0) | 205 pass / 3 fail | wrote all 208 cases this round (scaffold existed, zero cases were ever registered). Full writeup in [TEST-REPORT-tools2.md](TEST-REPORT-tools2.md) |

## Round 7: full triage complete, all 6 suites done, 2 more bugs fixed, tools2 written from scratch

All six e2e suites are now finished and triaged against the real source, not just the test's own claims.
Full per-suite detail: [TEST-REPORT-tools1.md](TEST-REPORT-tools1.md), [TEST-REPORT-budget.md](TEST-REPORT-budget.md),
[TEST-REPORT-notes-todo.md](TEST-REPORT-notes-todo.md), [TEST-REPORT-calculator.md](TEST-REPORT-calculator.md),
[TEST-REPORT-shell.md](TEST-REPORT-shell.md), [TEST-REPORT-tools2.md](TEST-REPORT-tools2.md).

**Root causes found that explain clusters of "failures" as ONE cause each (not N separate bugs):**

| Cause | Explains | Real or test bug |
|---|---|---|
| `setSelectionRange()` in a test helper doesn't fire the browser's `select` event | 12 calculator "cursor editing broken" cases | **Test bug** — app's cursor editing works (proven by the one case using a real mouse click, which passed) |
| A test selector `[role=radio][aria-label=Light]` that never matches (the real buttons have no `aria-label`, just text) | 13 shell.test.mjs timeouts | **Test bug** |
| A contrast-edge check that only reads `borderTopWidth`/`borderTopColor`, never `border-bottom` | 8 shell.test.mjs "0.00<3" failures on `.field` inputs, which are intentionally bottom-underlined per the design system | **Test bug** |
| Tools home screen was restructured into categories this round; 4 old tests still try `getByText('Loan EMI')` directly on the home screen | N29/N39/N40/N41 in notes-todo.test.mjs | **Test bug** (stale after this round's own UI change) |

**Real bugs found and fixed this round:**

1. `capHistory` could silently drop a brand-new calculation once 200 rows were already named/locked — fixed, 5 new tests (CALC-254 / B-19).
2. `SaveSheet.tsx`'s custom-tag box only de-duped tags by exact match; `TaskSheet.tsx` already did it case-insensitively. "Rent" + "rent" became two tags on a saved calculation. Fixed to match `TaskSheet.tsx` (N11).

**Real bugs found, not fixed (flagged for a deliberate decision, not a safe one-liner):**

- The pin-limit message (`notice`) is set correctly in the store when a 6th item is pinned from the Notes list, but `SavedScreen.tsx` never reads `notice` at all — only Calculate, TaskSheet, TodoScreen and some Budget sheets do. The message is silently lost on the one screen this action lives on (N14/N15).
- A dangling binary operator (`"12 +"`) renders with a trailing space (`"12 + "`) — cosmetic, confirmed in the formatter, not fixed (CALC-076/085/088/129).
- Scientific mode overflows sideways at several phone sizes specifically (Calculate mode is fine at the same sizes) — CALC-350/351/352/353.
- The bottom keypad row sits under the tab bar at 360×640 — CALC-331, matches an old complaint.
- `.display__result` shows a "not allowed" cursor even though tapping it is a real, working action — CALC-383.
- Accent colours sky/violet/amber (and citron in light mode) fail their own 3:1/4.5:1 contrast checks; only citron in dark mode had ever been checked this rigorously before this round.
- No `<h1>` on 5 screens; 2 screens have more than one `<h1>`.

**tools2.test.mjs now has real coverage.** It had a complete scaffold (every field, every default,
several independent reference formulas) but zero registered test cases — the 25 calculators from SIP
through A/B sample size had never been tested at all. Wrote 208 cases: a smoke test, every required-field
validation, a negative-money check, a 360px overflow check and a 44px tap-target check for all 25, plus 9
independent numeric cross-checks (SIP, step-up SIP, lump sum, goal SIP, FD, RD, PPF, CAGR, XIRR against a
second, independently-written formula) and 9 corner cases. 205/208 pass; the 3 failures are the same
already-known systemic overflow issue tools1 found elsewhere, not new bugs. Deliberately did **not**
re-derive capital gains, gratuity, advance tax, EPF, NPS or the salary/presumptive-tax calculators
independently — that's real tax/EPFO law already covered by dedicated engine unit tests
(`docs/VERIFICATION.md`), and re-deriving it for an e2e test risks writing a wrong "independent" formula
and reporting a false bug, which is exactly what happened twice in tools1.

**Still open, not yet investigated:**
- CALC-140 (Indian number-words at a boundary), CALC-237 (a Playwright strict-mode error, possibly a loose test selector), CALC-304/307 (timing, could be a slow machine not a real regression).
- budget.test.mjs's 9-case Timeout cluster on category/payment-mode pickers (still only "likely a stale selector," not confirmed).
- shell.test.mjs's SH-K16/K19/K26 (backup/restore edge cases) and the borderline 3.83-4.06 text-contrast findings — measured correctly, not yet traced to the exact fix.
- The real owner Budget entry that changed category between 21:08 and 21:45 on 2 Nov 2026 — still never confirmed with the owner directly.

All fixes verified: `npm run check` — 1310/1310 unit tests pass.

## Round 8: fixed the real bugs, built, installed on the real phone, planned what's left, competitive research

**9 real app bugs fixed** (commit after 5e528d1): Sheet Escape closing every open sheet at once (routed
through the existing back-button stack, which already only runs the topmost handler); editing any field
on a credit card silently detaching its card-bill payments (B-04, root cause: a settlement's `mode: null`
was wrongly read as "its mode stopped fitting"); a corrupted/tampered save claiming `fresh: true` on a
half-typed function call white-screening the app (B-16, `sanitizeInput` now requires a plain number, the
only shape the app itself ever produces for a fresh value); the regular keypad's rows not shrinking below
52px, pushing the bottom row under the tab bar at 360x640 (same bug already fixed for Scientific, now
applied to Calculate); backup filename using UTC instead of local date; the web build's "Open folder"
link doing nothing; a dangling operator rendering a trailing space; the pin-limit notice never rendering
on the Notes screen (added to the global snackbar too); SaveSheet's tag box only de-duping exact matches
while TaskSheet already did it case-insensitively.

**One test-infrastructure fix with outsized leverage**: every e2e suite's shared browser-context helper
(`e2e/lib.mjs`) didn't disable CSS animations. Every `.screen` slides in over 220ms; a geometry check run
right after navigation could catch that transform mid-flight and report fake sideways overflow. This
alone explained roughly 20 of the "systemic layout overflow" findings across three suites. Fixed by
turning on `prefers-reduced-motion` in the shared context (the app's own CSS already honours it).

**Confirmed false positives from my own earlier analysis** (not fixed, because nothing is broken):
CALC-383 (the "not-allowed" cursor on an empty result — correct, there's nothing to copy yet), CALC-267/
Y-TAP-history (History's "All" chip — it uses an invisible hit-slop technique that already satisfies the
44px rule), CG04 (the category pill toggle works correctly; manually reproducing it needed a clean reload
and real waits, which is a sign the *test* has a timing issue, not the app).

Built (`npm run build`), synced, and installed the **real** `Calc` app (not QA) on the phone at the
owner's request — this updates their live app, not a disposable test copy. Confirmed healthy with one
screenshot per the established safe-testing rule (no bulk automated taps against the real app with its
real data). `docs/TEST-PLAN-REMAINING.md` written: what's still only tested in a browser and needs a real
device (reminders actually firing, backup/restore round-trip, TalkBack, native clipboard, rotation), what's
a confirmed bug not yet fixed (the 16-calculator invalid-field-marking gap, junk-input validation, the
backup/restore data bugs, accent contrast), and what's unconfirmed either way (the budget CG/PM timeout
cluster, three calculator cases, four stale notes-todo cases from this round's own Tools regrouping).

`docs/COMPETITIVE-RESEARCH-AND-PLAN.md` written by a background agent: read the two sibling repos
(Financial Advisor, Retirement Plan) and four competitor catalogues, cross-referenced against this
repo's own `REVIEW-NEW-FEATURES.md` (which already did a competitor sweep the same day) so nothing is
suggested twice. Verdict: the sibling repos contribute correctness *rules* more than features (exact
split allocation, posting-date statement cycles, "every rule of thumb shows its condition"); the only
real missing *tool* is the India small-savings pack (SSY/NSC/VPF/SCSS); 12 competitor features are
explicitly ruled out for breaking a named design rule, listed so they don't resurface later.
