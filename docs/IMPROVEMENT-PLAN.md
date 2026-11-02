# Improvement plan: a seven-role audit

**Date:** 2026-11-02. Audited as UX designer, UI designer, senior developer, engineering manager, product manager, product
head and CEO. Evidence is from this repo and the sessions that built it, not opinion. One independent reviewer challenged the
five strategic calls; its verdict changed three of them (section 5).

## 1. The verdict

**The product is better than its proof.** The breadth is real (51 calculators, 981 passing tests, a small 132 KB bundle) and
the screens now follow one design system. But the thing that makes Calc different, **calculate, then remember, then act**,
depends on reminders that have **never run on a real phone since the revamp**, and the phone has a **stale build**. Everything
else is polish until that loop is proven.

| Role | Grade | The one thing |
|---|---|---|
| UX designer | **B+** | Flows are coherent. Gaps: History rows cannot act on a number; saving gives no confirmation |
| UI designer | **B+** | One system, now. Gaps: the answer appears twice; list header wraps; light theme and 200% font unchecked |
| Senior developer | **B** | Clean layers, strict TypeScript, 981 tests. **A debug logger persists every expression** |
| Engineering manager | **C+** | **83 uncommitted paths against 6 commits.** Stale e2e script. No commit hook |
| Product manager | **B-** | The differentiator is unproven. Success is not defined |
| Product head | **B** | Right position (private money notebook), too much breadth for one user |
| CEO | **B** | Low cost, low risk, and one real exposure: tax figures if the app is ever shared |

## 2. Findings by role

### UX designer
- **Acting on a number** works after "=" and on a calculator's answer, but **not from History**, where old numbers live.
- **No confirmation after saving.** The button label changes and nothing else does.
- **Renaming a list line** goes through the bottom input bar. It works but is indirect; rename in place is expected.
- **The chips appear only after "="**, which is right for cleanliness, but nothing tells a new user they exist.
- **Reminders fire at 9:00 am only**, and a person cannot test that a notification can reach them.

### UI designer
- **The answer is shown twice** on a calculator: in the sticky bar and again as the first result row.
- **List header** ("2 of 5 done · ₹3,000 left") wraps; put the amount left on its own line.
- **The sticky bar** holds a label, a value and "To list". It fits at 360px but is the tightest spot in the app.
- **Not yet checked:** light theme on every new screen, 200% font, Settings and Due after the revamp.
- **Fixed this round:** control borders were 1.3:1 contrast (invisible); now `ink-3`.

### Senior developer
- **P0, privacy and speed: `src/lib/logger.ts`.** `computeDisplay` logs the expression on **every key press**, at DEBUG level in
  the production build, and writes up to 500 entries to localStorage (parse and re-write each time). It ignores the "keep
  history" setting. It contradicts the privacy position ("nothing leaves the phone, and you control the record").
- `@capacitor/cli` is in runtime dependencies. It is a build tool, so it should be a dev dependency (clears 4 audit warnings).
- `TapeScreen` makes line ids with `Date.now()` and `Math.random()`, while the store uses an injected id function. Use one.
- **Tests:** strong on the engine and store. **No tests of screens**, and `e2e/smoke.mjs` is stale.
- Strict TypeScript with `noUncheckedIndexedAccess` is on, which is excellent. No lint, no formatter.

### Engineering manager
- **Risk number one: the work exists in one working folder.** 83 uncommitted paths, 6 commits. Commit it first.
- **Process is good:** the parallel protocol, the shared brief, ownership by folder, and a QA pass by one person worked.
  It is written down (`docs/PARALLEL-WORK.md`, `.claude/agents/`).
- **Release is manual** (a 7-minute first build, now scripted: `scripts/build-android.sh`). There is no release keystore.
- **Proportionality:** CI for a one-person repo adds little. A pre-commit `npm run check` gives the same protection.

### Product manager
- **Job to be done:** "I just worked out a number. Help me not forget it, and act on it." That is the memory layer, not the calculators.
- **Parity vs advantage:** 51 calculators are parity. Reliable reminders and "number to list" are the advantage.
- **Success for a personal app:** reminders that arrive on time, notes and lists the owner actually creates, the owner still opening
  it after a month. No analytics needed: the owner can feel this.

### Product head
- **Position:** the private money notebook for India: calculate, then commit. Not a calculator-count race.
- **Themes, in order:** **Reliable** (reminders), **Fast** (one-handed flows), **Trusted** (verification shown on each result),
  **Shareable** (a list as text now, an image later), **Native** (a "next due" widget is the retention engine).
- **Freeze** new calculators until reminders are proven. Nothing is removed.

### CEO
- **Bet:** reliability and trust over breadth. Cost is near zero (no backend). The moat is on-device data and a habit.
- **Exposure:** a wrong tax or EMI figure in someone else's hands is a liability. **No sharing the app until the tax figures the owner
  relies on are verified** (`docs/VERIFICATION.md`).
- **If it ever goes to a store:** a release keystore, a privacy policy, the Play data-safety form, and review of the notification
  permission. None needed for sideloading.

## 3. The plan

```
 NOW (this week)                      NEXT (2 to 4 weeks)              LATER (when earned)
 --------------------------------     ---------------------------     ----------------------
 1 Commit, in logical commits         8  History row actions           14 Native "next due" widget
 2 Fix the logger                     9  Inline rename of list lines   15 Share a list as an image
 3 Move cap CLI to dev deps           10 Cross-check top formulas      16 Live currency, HRA, scenarios
 4 "Send a test reminder" button      11 Accessibility pass            17 Release keystore, iOS, store
 5 Install current build, test        12 Update e2e smoke
 6 Time picker for reminders          13 Verification status on each
 7 Small UI fixes                        result
```

### Now

| # | Do | Why | Size | Done when |
|---|---|---|---|---|
| 1 | **Commit the 83 paths** in logical commits (calculator, tools, memory, store, brand, docs, android). Add a pre-commit hook that runs `npm run check` | The biggest risk is losing the work | S | `git log` shows the commits; a failing test blocks a commit |
| 2 | **Fix the logger.** Log only in a development build. Never write expressions to storage. Respect "keep history". *Decision for the owner: an earlier changelog describes this as a requested debugging feature, so confirm* | Privacy bug and a per-keystroke cost | S | No `app_logs` in a production build; a test proves nothing is persisted |
| 3 | Move `@capacitor/cli` to `devDependencies` | Cleaner audit | S | `npm audit --omit=dev` is quiet |
| 4 | **Add "Send a test reminder"** in Settings: schedules a notification 1 minute out | Turns the reminder proof from two weeks into a few minutes | S | Tap, lock the phone, a notification arrives in about a minute |
| 5 | `scripts/build-android.sh install`, then the phone checklist (`docs/TESTING.md` sections 3 and 4) | Everything else is theory until then | S | Checklist passes; reminder arrives; results written in `docs/VERIFICATION.md` |
| 6 | **Reminder time picker** | A 9:00 am-only reminder is a poor fit for real bills | M | A reminder can be set for a time of day and fires then |
| 7 | Small UI fixes: drop the duplicate answer row, un-wrap the list header, "Saved. Undo" snackbar | Seen in the browser pass | S | Seen fixed at 360px |

**Order matters:** 4 and 5 come before any new reminder feature. If the OnePlus drops the notification, fix delivery (battery
exemption prompt, guided setup, PRD H6 to H7) before building anything on top.

### Next

| # | Do | Why |
|---|---|---|
| 8 | Actions on History rows (To list, Remind me) | The gap in "act on any number" |
| 9 | Rename list lines in place | The expected interaction |
| 10 | Cross-check the weakest high-stakes formulas against an official calculator: prepayment, balance transfer, card EMI, FD, EPF, 87A relief, capital gains, advance tax | Wrong numbers look right |
| 11 | Accessibility pass: TalkBack walk-through, 200% font, focus order, both themes | Not checked since the revamp |
| 12 | Repair `e2e/smoke.mjs` | The browser safety net is stale |
| 13 | Show verification status on each result and "not checked against the final Finance Act 2026" on tax | The warning belongs where the number is |

### Later

Native "next due" widget, share a list as an image, live currency, HRA, scenario comparison, a release keystore, iOS, a store
listing. Each only after the Reliable theme is proven.

## 4. Decision gates

```
 Gate A: after the reminder test (step 5)
   +- reminders arrive on time on the OnePlus  ->  build the time picker and move on
   +- they do not                              ->  fix delivery first (battery exemption, guided setup); no new features

 Gate B: after a month of real use
   +- you open it daily and use Notes and Due  ->  widgets, share as image
   +- you only use the calculator              ->  stop; the memory layer is not earning its place
```

## 5. What the independent reviewer changed

| Call | Was | Now |
|---|---|---|
| 1 | Freeze calculators for two weeks of reminder use | Freeze, but prove delivery in one day with a test button |
| 2 | Stay personal for 30 days | Dropped. Replaced by "no sharing until the tax figures are verified" |
| 3 | Fix the logger | Kept, moved to the very top, no Diagnostics switch |
| 4 | On-device usage counters | **Dropped.** One user knows what they use |
| 5 | CI, lint, pre-commit | Commit now, and a `check` hook only. No CI, no lint yet |

It also pointed out that the build on the phone was stale, which is now step 5.

## 6. Measures that matter (no analytics)

| Measure | Target | How you know |
|---|---|---|
| Reminders delivered on time | Every one, over two weeks | The test button, then real bills in the Due tab |
| Numbers acted on | You use "To list" or "Remind me" without thinking | You notice you stopped retyping amounts |
| Still opening it | After 30 days | You do |
| Wrong numbers | Zero | `docs/VERIFICATION.md` rows moving from C and D to A |

## 7. How this audit was kept cheap

- It used evidence already gathered in the session, plus five quick probes: bundle size, tooling, accessibility counts,
  the logger, git state.
- One independent reviewer, on the five strategic calls only, not on every finding.
- The plan reuses existing documents instead of restating them: `docs/BACKLOG.md` holds the long list, this file holds the order.
