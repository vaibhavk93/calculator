# Handoff: where Calc stands

**Written:** 2026-11-02. **Read this first** if you are a new person or a new AI session picking the project up.
It says what exists, what was verified and how, what is not done, and how to get going. Everything here was checked
against the code on this date. Where something was not checked, it says so.

**One-line state:** a working React + Capacitor calculator app with 51 calculators, notes and lists, reminders, a
**Budget tab** and a revamped UI. 1086 unit tests pass (49 files). The **phone has an older build**. The revamp has been seen in a
browser at 360px but **not yet on the phone**. Version 0.5.0 (commit `bb17c50`, on top of `3910de7`) added cursor editing,
the Copy setting, the Budget tab and a round of page tidying. See `CHANGELOG.md`.

**Do not assume 0.5.0 works on a phone.** Nothing from it has run on a device, and the Budget screen is the least checked part.

## 1. What the product is

"Calc": a personal calculator for one user (the author), sideloaded on Android, iOS later. Everyday maths, loans, India
investment and tax tools, and a memory layer (notes, lists, reminders) that is the differentiator. No account, no
analytics, nothing leaves the device except (later) currency rates. Visible name is **Calc**. The package id stays
`com.vaibhavkumawat.vkcalc`. See `docs/PRD.md`.

## 2. What exists

| Area | State | Where |
|---|---|---|
| Calculator: brackets, live preview, history (shown only from the History sheet), Paste and Copy, bordered keys | Built, tested, seen in browser | `src/features/calculator/`, `src/engine/expression/` |
| Scientific calculator (separate screen, memory keys) | Built, seen in browser | `ScientificScreen.tsx`, opened from the top of Tools |
| 51 calculators in 9 groups, one shared screen | Built, all open and show a result | `src/features/tools/`, `src/engine/{convert,everyday,loans,investments,tax,metrics}` |
| Tools UI: groups, search, sticky answer bar, grouped digits, "More options", tap-the-tab-to-go-back | Built, seen in browser | `ToolsScreen.tsx`, `ToolScreen.tsx`, `groups.ts` |
| Notes tab (was "Saved"): cards, tags, pin, search, Trash 7 days with Undo | Built | `src/features/memory/` |
| Lists with checkboxes ("2 of 5 done, ₹3,000 left"), To list, Remind me | Built, seen in browser | `TapeScreen.tsx`, `ToListSheet.tsx`, `ResultActions.tsx` |
| Reminders and the Due tab, Mark paid, Snooze | Built, notifications **not run on a device** | `DueScreen.tsx`, `src/lib/notifications.ts` |
| Android: debug build, notification and storage plugins | Built once | `android/`, `docs/BUILD-ANDROID.md` |
| Calculator expression line: editable text box with a cursor and selection, replace an operator in place, tap after "=" to edit | Built 0.5.0, tests only | `Display.tsx`, `applyKeyAt` in `src/engine/expression/input.ts`, `src/lib/format.ts` (`caretMap`) |
| Copy setting: Settings, Copying numbers (ask, with commas, without commas) and the "Copy as" sheet | Built 0.5.0, tests only | `src/components/CopyAs.tsx` |
| Keep and share as one slim icon row; bottom answer button; 32px pills with a 44px touch area; History cards; Save sheet cards | Built 0.5.0, tests only | `KeepAndShare.tsx`, `ToolScreen.tsx`, `HistorySheet.tsx`, `SaveSheet.tsx`, `src/styles/` |
| **Budget tab** (5th tab): limit per category plus an optional overall limit, expenses by date, month switcher, Uncategorised shown, soft delete with Undo, 10 starter categories | Built 0.5.0, **unproven** | `src/features/budget/`, `src/lib/budget.ts`, `PersistedData.budget` |
| Settings: theme, accent, number system, decimals, copying numbers, "Opens on" any calculator, reminders status, backup and restore. Sections are tinted cards | Built | `src/features/settings/` |

Counts: **1086 tests in 49 files**, **51 calculators**, 9 Tools groups, 5 tabs, stored data schema **v3** (the budget was added without a bump: old data gets the starter categories).

## 3. What was verified, and how

| Claim | Evidence |
|---|---|
| All tests pass, build succeeds | `npm run check` and `npm run build` on 2026-11-02 |
| All 51 calculators open and show a result, no `NaN`, no console errors | Scripted sweep in a real browser (before the UI revamp) and `registry.test.ts` (after) |
| The revamped calculator, "=" behaviour, chips, split-to-list with checkboxes, Tools home, Loan EMI, Scientific, tap-the-tab-to-go-back | Looked at in a 360px browser frame after the revamp |
| Formulas | See `docs/VERIFICATION.md`: each calculator is marked A (outside source), B (recalled source + recomputed), C (recomputed only) or D (hand-worked) |
| App builds and installs on a OnePlus (Android 16) | Debug build installed and launched with no crash. **That was the build before the UI revamp** |

**Not verified:** anything on the phone since the revamp; reminder notifications on any device; `e2e/smoke.mjs`
(stale, see backlog); Android hardware back button. New in 0.5.0 and not verified:

- The **Budget screen on a real phone** (add, delete, undo, month switch, limits).
- **Cursor editing** and **Copy as** on a phone (tap targets, the keyboard, the copied text).
- A **200% font sweep** of the new screens, including five tabs in the tab bar.
- The **light theme** on the new screens.
- The Budget design is based only on the local `Financial Advisor` folder. The GitHub repo `vaibhavk93/financial-planner` returned 404 (private or renamed), so it was not read.

## 4. What is NOT done (honest list)

| # | Item | Why | Next step |
|---|---|---|---|
| 1 | Phone has the old build | New plugins (clipboard, app, status-bar) are not in the Android project | `npx cap sync android`, rebuild, install (`docs/BUILD-ANDROID.md`) |
| 2 | Paste and Copy on the phone | Code done (native plugin plus a "Paste here" sheet fallback). Never run on the phone | Test after step 1 |
| 3 | Reminder delivery on a real phone | OnePlus kills background apps. Reminders fire at 9:00 am only | Reminder test protocol in `docs/TESTING.md` |
| 4 | Actions on History rows (To list, Remind) | Only the result and tool answers have them. History rows are now cards with edit and delete icons | `docs/BACKLOG.md` |
| 5 | Scientific screen has no Paste, Copy or Undo buttons | Space at 360x640 | Backlog |
| 6 | `e2e/smoke.mjs` | Still taps the removed "Scientific functions" and "Memory" buttons | Update selectors |
| 7 | HRA calculator | Current rule not readable from an official copy | Backlog (needs a primary source) |
| 8 | Live currency rates | Bundled snapshot dated 2026-10-30 | Backlog |
| 9 | Widgets, quick tile, share intake, app lock, boot rescheduling | Native Android work, not started | Backlog |
| 10 | Reminder time picker, "Send a test reminder" | Deferred by decision | Backlog |
| 11 | Answer shown twice on a calculator (sticky bar and first result row) | Seen in browser | Drop the main row from the list when the bar shows it |
| 12 | Radio buttons | Lists use checkboxes (paid or not). A third state is not built | Only if needed |
| 13 | Latest work is committed as one "work in progress" commit (`bb17c50`) | It mixes cursor editing, copy setting, page tidying and the Budget tab. Hard to review or undo in parts | Review it, and split future work into smaller commits |
| 14 | **The calculator saves every expression to localStorage** on each key press at DEBUG level, ignoring "keep history" (`src/lib/logger.ts`) | Audit found it | Backlog 33. Needs the owner's confirmation first |
| 15 | Logo and icons generated but **not yet built into an installed app** | Resource files written, build pending verification | Run `scripts/build-android.sh install` |
| 16 | **Budget tab never used for a month**, and never seen on a phone | The owner asked for it on 2026-11-02, which overrode the ROADMAP gate (a month of tag totals first). Budgeting apps are often abandoned in week two | Use it. Backlog 45 to 50. Per-month limits, rollover, SMS parsing and 50/30/20 were left out on purpose |
| 17 | Tag totals on Notes (ROADMAP step 1) | Not built. The Budget tab does not replace them | Backlog 37 to 39 |

Deliberately deferred ideas: use a number in another calculator, unequal splits and who-owes-whom, turning a pasted
list into a checklist, scenario comparison, share as image or PDF, natural-language input.

## 5. Caveats that matter

- **Tax is the highest-risk module.** Slabs were checked against published tables. 87A relief, surcharge, capital gains,
  advance tax, gratuity and 44ADA were only recomputed a second way. The Finance Act 2026 *as finally passed* was not
  checked. Every tax result says "Estimate for FY2026-27. Verify with a CA."
- **Rates are examples**: PPF 7.1%, EPF 8.25%, NPS annuity share and rate are editable inputs labelled "example rate".
- **Rule from CLAUDE.md:** if a rate or rule cannot be confirmed from a primary source, that calculator does not ship.
- **Tool ids and field ids never change.** Saved cards store inputs by field id. Renaming one breaks saved items.

## 6. How to get going

```bash
npm install
npm run dev            # dev server
npm run check          # typecheck + all tests, run before every commit
npm run build          # architecture gate + typecheck + build to dist/
npm run preview -- --port 4173
```

Then read, in this order: `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/PARALLEL-WORK.md`, `docs/BUILD-ANDROID.md`,
`docs/TESTING.md`, `docs/BACKLOG.md`, `docs/IMPROVEMENT-PLAN.md`, `docs/VERIFICATION.md`, `docs/UX-AUDIT.md`, `docs/UI-UX-PLAN.md`, `docs/BRAND.md`.

## 7. The phone and the toolchain (this Mac)

| Thing | Value |
|---|---|
| Phone | OnePlus CPH2573, Android 16 (SDK 36), adb serial `fb83a61a`, about 11 GB free |
| adb | `~/Library/Android/sdk/platform-tools/adb` (not on PATH) |
| Java 21 | `~/.local/jdks/jdk-21.0.13+9/Contents/Home` (Temurin, installed in the home folder, no admin rights) |
| Android SDK | `~/Library/Android/sdk`, platform 36 and build-tools 36.0.0 installed |
| Network | The company network runs **Zscaler**, which re-signs HTTPS. Java does not trust it by default |
| Fix | A private copy of Java's trust list with the Zscaler root added: `~/.local/jdks/cacerts-with-zscaler` (password `changeit`), used through `JAVA_TOOL_OPTIONS` for builds only |
| Gradle download timeout | Raised to 120000 ms in `android/gradle/wrapper/gradle-wrapper.properties` |
| First build | About 7 minutes (downloads). Later ones are much faster |
| Permissions | `SCHEDULE_EXACT_ALARM` is declared (by the Local Notifications plugin) so Android shows the "Alarms & reminders" switch. Settings, Reminders opens it. Exact if allowed, inexact otherwise. Play may restrict it: revisit before a Play release |

OnePlus may block installs over USB: turn on "Install via USB" in Developer options. For reminders, set VK Calc to
"Don't optimize" under battery, and allow auto-launch.

## 8. Decisions and why

| Decision | Why |
|---|---|
| Capacitor, not Flutter | Verifiable in a browser, light toolchain. The engine is portable TypeScript anyway |
| Engine knows no UI, money is never a JS `number` | A wrong EMI looks like a right one. Enforced by `architecture.test.ts` |
| One shared calculator screen driven by a spec | 51 bespoke screens would be 51 places for bugs |
| Lists and checklists are one object (a tape with a checkbox switch) | One idea, not two features. No schema change needed |
| No "note" card kind | A saved number is a list with one line |
| Chips appear only after `=` | Keeps the basic calculator clean while typing |
| Budget limit is per category, not per month | Simpler. One number to set. Per-month limits are backlog 47, only if asked |
| Copy setting defaults to Ask | Whether a copied number should have commas depends on where it goes. Ask costs one tap and never guesses |
| Control borders use `ink-3`, separators use `line` | `line` is 1.3:1 contrast, too faint for a control. `ink-3` is 5.2:1 dark, 6.6:1 light |
| Reminders are inexact | Android 14+ denies exact alarms by default and Play restricts them |
| Operators bordered, not accent text | Owner's request after using the app |
| Basic calculator has no memory keys | Moved to the scientific screen to keep it clean |
| Two independent critics were used | They changed both the caveats plan and the number-actions design. See `docs/PARALLEL-WORK.md` |

## 9. Owner preferences (how to write to them)

Plain, short sentences. Say the answer first. Tables and short bullets for comparisons. Draw a tree when something
branches. Bold the answer, flag only what would cause a mistake if missed. Do not drop caveats to sound smoother.
Do not claim something is verified unless you ran it.

## 10. Housekeeping

- A preview server may still be running in the background: `pkill -f "vite preview"`.
- `~/.local/jdks/dl/` holds the Java download archive (about 190 MB). Safe to delete.
- Scratch files from past sessions live outside the repo and are not needed.
