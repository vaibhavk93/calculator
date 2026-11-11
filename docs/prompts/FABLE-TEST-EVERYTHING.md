# Prompt: test Calc end to end with Claude Fable 5.2

Written 2026-11-11, revised the same day after comparing it against `docs/prompts/FABLE-5-2-IMPROVE.md`.
Paste everything under "The prompt" as the **first message of a new Claude Code session** in this repository.
Before pasting, set the model to Fable 5.2 (`/model`) and the effort to `high` (`/effort high`).

Companion to `FABLE-5-2-IMPROVE.md`. That one is for **fixing**; this one is for **finding out what is true**.

## What changed in the revision, and why

The first draft was a good brief but it was missing most of the machinery the improve-prompt already had, and it
left the one job it exists for — "do the tests tell the truth?" — as a wish rather than a method.

| Added | Why |
|---|---|
| **A canary: prove the harness can fail** | The whole reason for this session is that tests reported green while failing. Asking "check the tooling is honest" is not a method. Deliberately breaking something in a throwaway worktree and confirming the suite goes red is |
| **A hard definition of "new failure"** | "New or old?" was asked for but never defined, so the answer would have been a guess. Now: fails on HEAD **and** passes on a named baseline, each confirmed twice |
| **A named baseline commit, not "an older commit"** | A vague baseline gives inconsistent answers |
| **A flakiness rule with a number** | `qa-notes-due` once gave 14 and 29 failures on identical code. One run is not evidence |
| **The expected test count as a tripwire** | A broken `node_modules` once made `npm run check` "pass" while running nothing. A count far below ~3,700 means it is not really running |
| **`qa-verifier` named** | `.claude/agents/qa-verifier.md` exists precisely for "verify a build without changing code". The first draft never mentioned it |
| **Triage order for 26 browser suites** | `npm run e2e` is long. Without an order it runs out of room half way and reports a partial pass as a pass |
| **A cap on test repairs** | Allowing "fix a wrong test" with no limit turns a test pass into a fixing session |
| **The four blocks from the improve-prompt** | Finishing work, Verifying your work, Communicating clearly, Keeping state. All four come from Anthropic's Fable guidance and all four were missing |
| **A written output file** | `docs/E2E-STATUS-2026-11-11.md` is already an outstanding to-do in `RESUME-HERE.md`. This pass produces it anyway |
| **"Docs are history, not orders"** | This prompt quotes failure lists that age. Without that line, a stale list becomes an instruction |
| **A full caveats section** | Disk, the pre-commit hook, the usage limit, the proxy, `cap sync`, `npm audit` noise, and the git tracking trap. Each has already cost someone a session |
| **Layer 5: the numbers themselves (audit)** | The biggest hole. Running the repo's own tests cannot catch a wrong formula that has a matching wrong test. `VERIFICATION.md` grades 34 calculators A to D: **22 are C or D**, meaning no outside source was ever checked. That is where a confidently wrong tax figure hides |
| **Layer 6: dated claims (research)** | `OFFICIAL_TO = '31 Dec 2026'` in `rates.ts`. Small-savings rates go stale in about seven weeks and every screen repeats that date. A test pass that ignores expiry dates reports green on numbers that are about to be wrong |
| **A worked example of a stale doc** | `CLAUDE.md` claims the calculator logs expressions to localStorage. It does not, and two tests prove it. Handing over one confirmed example makes "verify, don't trust" concrete |

Deliberately **not** added: step-by-step scaffolding. Anthropic's guide is explicit that prescriptive click-by-click
prompts lower Fable's output quality. Everything above is a constraint or a definition, not a script.

## The prompt

---

I'm Vaibhav, the owner and only user of Calc: an Android app (React, TypeScript, Vite, Capacitor) with a calculator,
60+ calculators for loans and Indian investments and tax, notes, to-dos, reminders (the Due tab), and a budget that can
read bank SMS. I want a **full, honest test pass**: the screens, the logic underneath, the stored data, and the app
actually running on my phone. Not new features. Not fixes I did not ask for. I want to know what works and what does not.

Why I am asking: over many sessions several models built this fast. Tests have reported green while actually failing,
some browser suites are stale or flaky, and docs disagree with each other. **I do not currently trust "all tests pass."**
Your job is to make that sentence mean something again.

## First, the thing that will otherwise waste your session

**There is no backend.** No server, no API, no database, no auth, no network calls except one currency-rate fetch.
Do not look for one. When I say "the logic underneath", I mean the three layers below the screens:

```
                         WHAT TO TEST
                              |
   +--------------+-----------+-----------+---------------+
   v              v                       v               v
+----------+  +------------+      +--------------+  +-----------+
| ENGINE   |  | STORE and  |      | SCREENS      |  | RUNTIME   |
| + lib    |  | PERSISTENCE|      | the front end|  | the phone |
+----------+  +------------+      +--------------+  +-----------+
 pure TS       zustand +            React, browser    Android,
 decimal.js    sanitize on load     e2e suites        Capacitor,
 no browser    backup/restore       360px, 200%       native Java
    |               |                     |                |
 vitest         vitest              node e2e/*.mjs     QA copy on
 unit tests     unit tests          + a real look      the phone

      and two the test suite itself cannot see:

 +--------------------------+   +--------------------------+
 | THE NUMBERS (audit)      |   | DATED CLAIMS (research)  |
 +--------------------------+   +--------------------------+
  is the formula right, or      a rate or rule with an
  just consistent with a        expiry date that has passed
  test that is also wrong?      or is about to
```

Money is never a JavaScript `number` (`D`/`Dec` from `src/engine`). Layering and the design bans are enforced by
`src/architecture.test.ts` (356 tests) — treat that gate as its own result worth reporting.

## Priority order

1. **Prove the harness can fail.** Before trusting any green result, see the next section. Nothing else counts until this is done.
2. **Engine and lib.** The maths and the parsers.
3. **Store and persistence.** Saving, loading, sanitising junk, backup and restore.
4. **Screens.** Every tab at phone sizes, including 200% font.
5. **Runtime on the phone.** Only if I say a phone is connected, and only the QA copy.
6. **The numbers, and anything with an expiry date.** See "What the tests cannot see" below. Do this even if
   you have to cut it short — a green suite hiding a wrong tax figure is the single worst outcome of this session.

## Step 1: prove the harness can fail (do this first)

A passing suite only means something if the same suite would have gone red. Prove it:

- Make a throwaway worktree (`git worktree add /tmp/calc-canary HEAD`, symlink `node_modules` in).
- **In that worktree only**, break something small and obvious — change a number an engine test asserts, or a
  string an e2e suite looks for.
- Run the suite. Confirm it actually goes **red**, and that the failure names the thing you broke.
- Remove the worktree. Never do this in the real tree.

Do this for one unit test and one browser suite. If either stays green, stop and tell me: the harness is lying and
nothing after that is worth running.

**Two tripwires while you work:**

- `npm run check` should report roughly **3,700 unit tests across about 139 files**. A count far below that means the
  suite is not really running, whatever the exit code says.
- `git ls-files node_modules | wc -l` must be `0`. A broken `node_modules` once made `npm run check` "pass" while
  running nothing at all.

## What counts as a NEW failure

This is the part I actually care about, so I am defining it rather than leaving it to judgement.

A failure is **new** only when **both** are true:

- it fails on the current code, **twice**; and
- it passes on the baseline, **twice**.

The baseline is a worktree at the last commit before this session's work — find it with `git log --oneline` and say in
your report which commit you picked. **Use `git worktree`, never `git stash`.** A stash plus a command timeout once
left real work stranded in `stash@{0}` behind a clean-looking tree.

Anything else is **already broken** or **unsure**. "Unsure" is a perfectly good answer and I would much rather have it
than a confident wrong one. A failure list without this classification is useless to me, because most suites already
have failures and I need to know which ones the recent code caused.

**Flakiness is real here.** `qa-notes-due` once gave 14 failures and 29 failures on byte-identical code. If another
session is busy on this machine, browser suites contend for it and get slower and less reliable — check first, and say
so in the report if it applied. Never call a suite flaky from one run; say how many times you ran it and what you got
each time.

## What the tests cannot see (do not skip this)

**A passing suite only proves the code does what a test says. It cannot prove the test is right.** Two kinds of
wrongness are invisible to every command in this repo, and they are the two that would actually cost me money.

**The numbers.** `docs/VERIFICATION.md` grades each calculator on how it was checked:

| Grade | Meaning | How many |
|---|---|---|
| **A** | Matches an outside source — law text, regulator, published table | 10 |
| **B** | Outside source from memory, plus a second-method recomputation | 2 |
| **C** | Recomputed a second way only. **No outside source** | 9 |
| **D** | Hand-worked arithmetic or calendar rules only | 13 |

So **22 of 34 have never been checked against anything outside this repo**. A wrong formula with a matching
wrong test passes forever. Do not re-derive all of them — spot-check a handful, **tax first** because that is
where being wrong is worst, then anything handling money over long periods. For each one you check, say which
outside source you used and update its row. Never upgrade a row on a hunch; the grades are only worth
something if they are honest.

Also confirm the three rows marked as **assumptions** still say so on screen. An assumption that quietly stops
being labelled is worse than one that was never flagged.

**Dated claims.** `src/engine/investments/rates.ts` has `OFFICIAL_TO = '31 Dec 2026'`, and screens repeat
"official to 31 Dec 2026" in their own words. The January–March 2027 rates are announced around 30 December
2026, so this goes stale in about seven weeks. Find every dated or "official to" claim in the engine, the
specs and `docs/DATA-FRESHNESS.md`, and tell me which ones expire, when, and whether the screen says so
plainly or silently implies the number still holds. **This is a report, not a fix** — do not invent a rate.

**Privacy.** `src/lib/qa-privacy.test.ts` and `src/store/qa-privacy-portfolio.test.ts` exist to prove no real
data leaks into logs, backups or exports. Run them, and say plainly whether they are real coverage or a
formality.

## How to run things

```bash
npm run check          # typecheck + unit tests. Read the real output, see the trap below
npm run build          # architecture gate (356), typecheck, build
npm run e2e            # all 26 browser suites; npm run e2e:fast for the quick set
node e2e/layout-contract.test.mjs      # phone-size layout gate, 216/216 when healthy
node e2e/smsinbox.test.mjs             # one suite on its own
```

**Browser suites need Node 22, and the default `node` here is 18.** Without this they fail in a way that looks exactly
like a real bug:

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
```

**Never pipe `npm run check`.** `npm run check | tail` returns *tail's* exit code. A past session reported green while
typecheck was exiting 2. Read the output and look for `Test Files ... passed` with a count.

**Order for the browser suites**, because running all 26 blindly will use up your room before you reach the end:
`layout-contract` first (it is the broadest and the most reliable), then the suites covering whatever changed most
recently, then the rest. If you run out of room, that order means you stopped having learned the most.

## Failures that are already there

`docs/RESUME-HERE.md` section 6 has the live list; this table ages, so re-confirm against your baseline rather than
trusting either.

| Suite | Already failing |
|---|---|
| `notes-todo` | N20, N21, N22, N36, N43, N45 (trash purge, an unknown calculator, tab-tap) |
| `qa-budget-new` | B-02 x2 (200% font), B-104, B-107, B-401 |
| `shell` | 37 cases |
| `budget` | ST12, B-22, B-23, B-117 |
| `e2e/smoke.mjs` | Stale: taps buttons that no longer exist. Do not use it as a verdict |

Most notes in `docs/` are history: lessons from one session, cautions whose reason may no longer hold. Read them as
context, not as orders. When two docs disagree, the code wins. If a caution looks out of date, say so.

## Before you start: the tree may not be clean

Other sessions and agents work in this repo at the same time. **Run `git status --short` and `git log --oneline -10`
first.** Files modified but not committed belong to someone else's unfinished work. Say so in your report, and test the
committed state in a worktree as well so the two are never confused. **Never commit someone else's files.**

## The phone

Only if I say a phone is connected. These rules are not negotiable:

- **Install only the QA copy**: `scripts/build-android.sh qa install` makes "Calc QA", a separate app with empty data.
  **Never install over my real app**, and never tap through my real data.
- Wi-Fi debugging: the port changes every time. `adb mdns services`, then `adb connect <ip:port>`.
- `scripts/phone-qa/` and `docs/PHONE-TESTING-GUIDE.md` have the driver and the fake-message injector.
- **`adb shell pm clear` is refused on this phone.** I clear the QA copy by hand in Android settings. It once still
  held real-looking data while a script assumed it was empty and printed a few lines of it. **Verify the QA copy is
  empty before injecting anything, and never print its screen text.**
- **No real message text, amounts or payee names in logs, tool output, tests or your report.** Messages are masked
  (`src/lib/maskText.ts`). If you need an example, invent a fake one.
- The SMS reader has mostly been tested on synthetic messages. My own real scan found duplicates and wrong payee names,
  so treat that area as unproven rather than working.
- Android toolchain: JDK 21 at `~/.local/jdks/jdk-21.0.13+9/Contents/Home` (note the nested `Contents/Home`; pointing
  `JAVA_HOME` at the parent fails). `cd android && ./gradlew :app:compileDebugJavaWithJavac --offline` takes about 6 seconds.

## Caveats that will bite you

These are not theory. Each one has already cost someone a session here.

**The machine**

- **Check free disk before a long run.** This Mac's data volume once hit 100% full mid-session and broke the
  pre-commit hook with `ENOSPC` — which looked like a code failure and was not. Browser runs leave build folders in
  `/var/folders/.../T/calc-e2e-*`; my rule is **keep the newest two and delete the rest**. Do not clear
  `~/Library/Android` or `~/.android` without asking: that is the SDK and the emulator images.
- **The pre-commit hook runs the whole `npm run check`,** so every commit is slow. If the hook fails for a disk or
  worker-pool reason rather than a code reason, run `npm run check` directly to green, then commit with `--no-verify`
  **and say in the commit message why**.
- **My account has hit a 5-hour usage limit mid-session before,** and agents died before saving their work. Commit
  in small pieces as you go rather than holding everything to the end.
- **Another busy session makes browser suites slower and less reliable.** Check before you start, and say in the
  report if it applied.

**The tools**

- **`npm audit` findings are dev tooling only** (vite 5.x, vitest 2.x). Runtime dependencies have none. Do not
  "fix" them; the fixes are major upgrades and they are my call.
- **`npx cap sync android` after any web or plugin change**, or the phone silently runs the old app and you will
  test the wrong build.
- **The company proxy (Zscaler) breaks Java HTTPS.** Gradle needs the private trust list — `scripts/build-android.sh`
  sets it via `JAVA_TOOL_OPTIONS` from `~/.local/jdks/cacerts-with-zscaler`. A `PKIX path building failed` error means
  that, not a broken build. `docs/BUILD-ANDROID.md` section 3.

**Git**

- **Never `git add -A` or `git add .`.** A builder once committed a `node_modules` symlink and merging it replaced the
  real folder with a self-pointing link, breaking every test. Always name paths.
- **A bare `git push` goes to the wrong place.** The local `dev` branch still tracks an old branch
  (`origin/claude/personalized-calculator-research-dl43uk`) that is far behind. The live branch is **`origin/dev`**.
  If I ask you to push, it is `git push origin dev`, never a bare `git push`.

**What the docs get wrong**

Docs here age, and some are simply wrong now. One confirmed example, so you know what to expect: `CLAUDE.md`'s
known-issues list says *"the calculator logs every expression to localStorage at DEBUG level"*. It does not —
`src/lib/logger.ts` never calls `setItem`, and two tests in `logger.test.ts` pin that. **Verify a claim before you
act on it, and tell me which docs you found to be wrong.** That is a useful finding in itself.

**Things already known to be unproven — do not report these as discoveries**

- Reminders have never been proven on a phone that aggressively kills background apps.
- The permission-denied path and the Android 15+ "Allow restricted settings" path have never been exercised, because
  installing over adb is exempt from that block.
- The SMS reader has mostly seen synthetic messages. My own real scan found duplicate payments and wrong payee names.
- A time-zone change is corrected on the **next app open**, not the moment it happens. That is by design.
- Quiet hours only change anything when the reminder time itself falls inside the window. Also by design.
- Tool ids and field ids never change — saved items store inputs by field id, so a rename silently breaks my data.
  If a test wants one renamed, that is a finding for me, not a fix.

## What you may do without asking

- Run any test, build, typecheck, browser suite, or the Android compile; retry anything flaky.
- Create and remove git worktrees under `/tmp`, including the canary.
- Start and stop a dev server and drive a browser against it. Close the servers when you finish.
- **Repair a test that is wrong about the app** — a stale selector, a rule the app changed deliberately. Report these in
  their own section, never mixed in with app bugs: a test repair is not a bug fix and must not hide one.
  **Cap this at about five repairs.** Past that, list the rest instead of fixing them; I asked for a test pass, not a
  fixing session.
- Write findings into `docs/` and commit with specific `git add <paths>`.

## What needs me first

- **Changing app behaviour to make a test pass.** Report it instead, always.
- `git push`. Installing anything on a phone. Deleting data. Upgrading a dependency.
- Any fix bigger than the bug it fixes.

If you need one of these, finish everything that does not depend on it, then ask at the end with your recommendation.

## Subagents

`.claude/agents/` has `qa-verifier`, which exists for exactly this: it verifies a build without changing code. It and the
others run on a cheaper model. Each subagent starts with no context and re-reads what it needs, so it is not free.
Delegate work that is independent and reading-heavy — one suite's failure list checked against a baseline, one screen's
screenshots reviewed. Keep small or tightly linked work yourself. Brief each one with the goal, the files, the
definition of "new failure" above, and what to return. Work on something else while it runs.

# Finishing work
Please avoid stopping while you still owe work the user asked for. Be persistent and do not stop unless needed.

While status notes are welcome, as is clarifying with the user on open decisions, carry on with work that does not depend
on the user's answer without unnecessary stops.

If you notice yourself inviting the user to redirect you or offering to wait, instead proceed on the next part of the
task. You may meet ordinary obstacles like errors, timeouts, locked files, empty results or failing tools. Diagnose them
first, and when they are not real blockers, work through them with the access you have (wait and retry, fix the request,
use another tool or source) rather than stopping unnecessarily.

If someone clearly decided something is a hard blocker, such as a file marked not to be touched, access that was
intentionally withheld, or a safety guardrail, leave it alone, say plainly what you found, and look for another safe way
to finish the task. Stopping before the task is complete is very rarely merited, as in when the task can't move forward
without user input, or where the blocker is deliberate and should not be worked past. This does not override the need for
confirmation on risky or destructive actions.

# Verifying your work
Before reporting anything, audit each claim against a tool result from this session. Only report what you can point to
evidence for. **Never report a pass you did not see.** If a suite did not run, say it did not run — do not infer it from
a related suite or from the code looking correct. If a number appears in your report, it came from output you read.

# Keeping state
Write the classified failure list into `docs/E2E-STATUS-2026-11-11.md` (it is already an outstanding to-do) and update
`docs/SESSION-STATE.md` with where you got to. I switch sessions and accounts, and those files are how the next one
resumes. If you run out of room, stop at a clean point and say plainly what you did **not** reach. Do not quietly narrow
the scope and report done.

# Communicating clearly
Write for an intelligent but low-context reader who has not seen your tool calls or the files you opened. Put the key
points in the first few sentences. Use plain words and full sentences, mostly in the style of ASD-STE100 Simplified
Technical English: short sentences, one idea each, active voice, the same word for the same thing every time. Do not use
a term you invented during the work. Tables are welcome for findings.

I'm a product manager, not a test engineer. Lead with the outcome.

# The final report

Start with one paragraph answering two things: **can I trust "all tests pass" now**, and **separately, can I
trust the numbers** — because a green suite says nothing about the second. Then:

| Layer | Ran | Passed | Failed | New | Already broken | Unsure |
|---|---|---|---|---|---|---|
| Harness canary | | | | | | |
| Engine and lib | | | | | | |
| Store and persistence | | | | | | |
| Screens (browser) | | | | | | |
| Runtime (phone) | | | | | | |
| The numbers (audit) | | | | | | |
| Dated claims (research) | | | | | | |

Then, for each **new** failure: what breaks, the smallest way to reproduce it, and how bad it is for someone using the
app. Rank them — I want to know what to fix first, not an alphabetical list.

Then: what you could not test, and why. Then, separately, every test you repaired and why it was wrong. Then the
decisions you need from me, each with your recommendation.

Lead with the bad news. I would much rather hear "three things are broken and one I could not test" than a green table
I cannot trust.

---

## Notes for the owner (not part of the prompt)

- **Expect real failures.** That is the point. The last several rounds found that the only way to catch a real defect
  here was to measure the live page, not to read the code.
- **Effort.** Start at `high`. `xhigh` is not obviously worth it for a test pass; it is for the engine and tax audit.
- **Cost.** Fable 5.2 is about twice Opus 5.5 per token. A whole-app test pass is a long session.
- **Do not run this while two agents are mid-edit.** Browser suites contend for the machine and the tree moves under
  the model. Let the in-flight work land and commit first.
- **If it starts fixing instead of testing**, the repair cap is the dial — lower it, or remove permission to repair
  tests at all.
