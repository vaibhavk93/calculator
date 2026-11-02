# Session state: resume here

**How to resume (another account, a new session, or after a token limit):** open this folder in Claude Code and say
"Read docs/SESSION-STATE.md and continue from the status table." Everything needed is in this file, `CLAUDE.md` and `docs/`.
This file is updated after each step. The full history is in git (`git log --oneline`).

Last updated: 2026-11-02 20:55. Round 4 running. At ~19:20 the account hit its 5-hour limit and the 5 helper agents stopped before saving code; limit reset 20:20 and they were restarted from the start of their briefs. Phone was disconnected at 20:50 (adb: device not found). Branch `dev` (tracks `origin/claude/personalized-calculator-research-dl43uk`).

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
