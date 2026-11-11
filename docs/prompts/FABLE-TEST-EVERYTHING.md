# Prompt: test Calc end to end with Claude Fable 5.2

Written 2026-11-11. Paste everything under "The prompt" as the **first message of a new Claude Code session**
in this repository. Before pasting, set the model to Fable 5.2 (`/model`) and the effort to `high` (`/effort high`).

Companion to `docs/prompts/FABLE-5-2-IMPROVE.md`. That one is for *fixing*; this one is for *finding out what is true*.

## Why the prompt looks like this

| Guidance | How the prompt uses it |
|---|---|
| Give the reason, not only the request | Opens with why a test pass is needed at all: results have been reported green while failing |
| State the goal and constraints, not step-by-step scaffolding | Names the four layers and the deliverable; does not script the clicks |
| Approval rules are applied literally | Two explicit lists: allowed without asking, and needs the owner |
| Progress claims must be checked against tool output | A verification block, and a ban on reporting a pass it did not see |
| It stops early on long tasks unless told to finish | A "finish the whole pass" block |
| Say what is NOT there | **"There is no backend"** is stated up front, so it does not spend the session hunting for an API |

## The prompt

---

I'm Vaibhav, the owner and only user of Calc: an Android app (React, TypeScript, Vite, Capacitor) with a calculator,
60+ calculators for loans and Indian investments and tax, notes, to-dos, reminders (the Due tab), and a budget that can
read bank SMS. I want a **full, honest test pass**: front end, the logic underneath, the stored data, and the app actually
running on my phone. Not new features. Not fixes I did not ask for. I want to know what works and what does not.

Why I am asking: over many sessions several models built this fast. Tests have reported green while actually failing, some
browser suites are stale or flaky, and docs disagree with each other. I do not currently trust "all tests pass".

## First, the thing that will otherwise waste your session

**There is no backend.** No server, no API, no database, no auth, no network calls except one currency-rate fetch.
Do not look for one. When I say "BE", I mean the three layers under the screens:

```
                         WHAT TO TEST
                              |
   +--------------+-----------+-----------+---------------+
   v              v                       v               v
+----------+  +------------+      +--------------+  +-----------+
| ENGINE   |  | STORE and  |      | FRONT END    |  | RUNTIME   |
| + lib    |  | PERSISTENCE|      | the screens  |  | the phone |
+----------+  +------------+      +--------------+  +-----------+
 pure TS       zustand +            React, browser    Android,
 decimal.js    sanitize on load     e2e suites        Capacitor,
 no browser    backup/restore       360px, 200%       native Java
    |               |                     |                |
 vitest         vitest              node e2e/*.mjs     QA copy on
 unit tests     unit tests          + a real look      the phone
```

Money is never a JavaScript `number` (`D`/`Dec` from `src/engine`). Layering is enforced by `src/architecture.test.ts`:
`engine <- lib <- store <- components <- features`.

## What I want by the end

**One report that tells me, per layer, what passed, what failed, and for each failure whether it is new or was already
broken.** A failure list with no "new or old?" column is useless to me: most suites already have failures, and I need to
know which ones this code caused.

Priority order:

1. **Does the test tooling itself tell the truth?** Before trusting any result, confirm the suites really ran (a count of
   test files and tests, not an exit code).
2. **Engine and lib.** The maths and the parsers.
3. **Store and persistence.** Saving, loading, sanitising junk, backup and restore.
4. **Front end.** Every tab at phone sizes, including 200% font.
5. **Runtime on the phone.** Only the QA copy. See the rules below.

## How to run things

```bash
npm run check          # typecheck + unit tests. THE REAL OUTPUT MATTERS, see the trap below
npm run build          # architecture gate (356 tests), typecheck, build
npm run e2e            # every browser suite; npm run e2e:fast for the quick set
node e2e/layout-contract.test.mjs      # phone-size layout gate, currently 216/216
node e2e/smsinbox.test.mjs             # one suite on its own
```

**Browser suites need Node 22, and the default `node` here is 18.** Without this they fail in a way that looks like a
real bug:

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
```

**⚠ Three traps that have already cost whole sessions. Do not relearn them:**

1. **Never pipe `npm run check`.** `npm run check | tail` returns *tail's* exit code. A past session reported green while
   typecheck was exiting 2. Read the real output and look for `Test Files ... passed` with a count.
2. **To compare against older code, use `git worktree`, never `git stash`.** A stash plus a timeout once left the work
   sitting in `stash@{0}` with a clean-looking tree. `git worktree add /tmp/calc-base <commit>`, symlink `node_modules`
   into it, run there, then `git worktree remove`.
3. **A broken `node_modules` once made `npm run check` "pass" while running nothing.** After any merge, check
   `git ls-files node_modules | wc -l` is `0`.

## Failures that are already there: do not report these as new

Check the current list in `docs/RESUME-HERE.md` section 6 first, and re-confirm each against a worktree at an older
commit rather than trusting this list, which ages:

| Suite | Already failing |
|---|---|
| `notes-todo` | N20, N21, N22, N36, N43, N45 (trash purge, an unknown calculator, tab-tap) |
| `qa-budget-new` | B-02 x2 (200% font), B-104, B-107, B-401 |
| `shell` | 37 cases |
| `budget` | ST12, B-22, B-23, B-117 |
| `e2e/smoke.mjs` | Stale: taps buttons that no longer exist. Do not use it as a verdict |

## Before you start: the tree may not be clean

Other sessions and agents work in this repo at the same time. **Run `git status --short` and `git log --oneline -10`
first.** If files are modified but not committed, they belong to someone else's unfinished work. Say so in your report
and test the committed state in a worktree as well, so the two are not confused. Never commit someone else's files.

## The phone

Only if I say a phone is connected. Rules, and they are not negotiable:

- **Install only the QA copy**: `scripts/build-android.sh qa install` makes "Calc QA", a separate app with empty data.
  **Never install over my real app** and never tap through my real data.
- Wi-Fi debugging: the port changes every time. `adb mdns services`, then `adb connect <ip:port>`.
- `scripts/phone-qa/` and `docs/PHONE-TESTING-GUIDE.md` have the driver and the fake-message injector.
- **No real message text, amounts or payee names in logs, tool output, tests or your report.** Messages are masked
  (`src/lib/maskText.ts`). If you need an example, use a fake one.
- The Android toolchain works here: JDK 21 at `~/.local/jdks/jdk-21.0.13+9/Contents/Home` (note the nested
  `Contents/Home`; pointing `JAVA_HOME` at the parent fails). `cd android && ./gradlew :app:compileDebugJavaWithJavac
  --offline` compiles in about 6 seconds.

## What you may do without asking

- Run any test, build, typecheck, browser suite, or the Android compile.
- Create and remove git worktrees under `/tmp`.
- Start and stop a dev server, and drive a browser against it.
- **Fix a test that is wrong about the app** (a stale selector, a rule the app changed deliberately) — and say so clearly,
  separately from app bugs. A test repair is not a bug fix; do not let it hide one.
- Write your findings into `docs/` and commit with specific `git add <paths>`.

## What needs me first

- **Changing app behaviour to make a test pass.** Report it instead.
- `git push`. Installing anything on the phone. Deleting data.
- Upgrading a dependency.
- Any fix that is bigger than the bug.

## Finishing the pass

Work through all five priorities. If you run out of room, stop at a clean point, write where you got to in
`docs/SESSION-STATE.md`, and say plainly what you did **not** reach. Do not quietly narrow the scope and report done.

**Never report a pass you did not see.** If a suite did not run, say it did not run. If a result was flaky, say how many
times you ran it and what you got each time. If you are unsure whether a failure is new, say unsure — that is a useful
answer, a confident wrong one is not.

## The report I want

A single summary, in plain language, in this shape:

| Layer | Ran | Passed | Failed | New failures |
|---|---|---|---|---|
| Engine and lib | | | | |
| Store and persistence | | | | |
| Front end (browser) | | | | |
| Runtime (phone) | | | | |

Then, for each **new** failure: what breaks, the smallest way to reproduce it, and how bad it is. Then anything you could
not test and why. Then, separately, any test you repaired and why it was wrong.

Lead with the bad news. I would rather hear "three things are broken and one I could not test" than a green table I
cannot trust.

---

## After the session

Expect the report to list real failures. That is the point: the last several rounds found that the only way to catch a
real defect in this app was to measure the live page, not to read the code. Decide fixes separately, one at a time.
