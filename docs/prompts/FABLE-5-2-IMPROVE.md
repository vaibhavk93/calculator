# Prompt: improve Calc with Claude Fable 5.2

Written 2026-11-11. Paste everything under "The prompt" as the **first message of a new Claude Code session**
in this repository. Before you paste it, set the model to Fable 5.2 (`/model`) and the effort to `high` (`/effort high`).

## Why the prompt looks like this

It follows Anthropic's "Prompting Claude Fable 5.2" guide (platform.claude.com, build-with-claude /
prompt-engineering / prompting-claude-fable-5-2) and the Fable 5.1 guidance that guide builds on:

| Guidance | How the prompt uses it |
|---|---|
| Give the reason, not only the request | Opens with who the app is for and what "better" means |
| State the goal and constraints, not step-by-step scaffolding (old-style prescriptive prompts lower its quality) | Four outcomes and a priority order; no click-by-click steps |
| Start at `high` effort; `xhigh` only where a gain is measured; "think less" lines do not work | Set in the session, not in the text. No "be quick" lines |
| It stops early on long tasks unless told to finish | The "Finishing work" block, copied from the guide |
| Approval rules are applied literally, so name the exact actions | Two explicit lists: approved, and needs the owner |
| Say who owns the code, or it only adds and reports | Ownership sentence included, because the owner wants app-level fixes. Its cost (about 1.5x tokens, some unrequested changes) is handled by asking for every behaviour change in the report |
| Cautions pile up in notes and instruction files | Separates the few hard rules from history docs that may be stale |
| Progress claims must be checked against tool output | The verification block |
| Delegation costs tokens; the repo's agents already run on Sonnet | When to delegate and when not to |
| Reports for a low-context reader | The "Communicating clearly" block, copied from the guide |

## The prompt

---

I'm Vaibhav, the owner and only user of Calc: an Android calculator app (React, TypeScript, Vite, Capacitor) with everyday maths,
60 calculators for loans and Indian investments and tax, notes, to-dos, reminders (the Due tab) and a budget. I want to use it every day
and later put it on the Play Store. Over many sessions, several AI models built a lot, fast. The result works, but I don't fully trust
it: tests have reported green while failing, some e2e suites are flaky or stale, docs disagree with each other, and I still find most
screens less good than the basic calculator page. You are the most capable model I have. I'm using you for the hard part: finding
what is actually wrong across the whole app and fixing it, not adding features.

## What "better" means

By the end of this session I want these four things, in this priority order:

1. **The checks tell the truth.** `npm run check`, `npm run build` and the e2e suites (`npm run e2e:fast`, then the suites you touch)
   run, and their result means something. A flaky test is found and fixed or quarantined with a written reason. A known pre-existing
   failure is listed, not hidden. Note: e2e needs Node 22 (`.nvmrc`); the default shell may have Node 18.
2. **Every number is right, or clearly marked as an estimate.** Review the money maths in `src/engine/` the way an auditor would:
   rank findings by how wrong a real user could be and how likely it is. Tax is the highest risk. Check against primary sources
   (Income Tax Act and Finance Act text, RBI, the scheme rules) and update `docs/VERIFICATION.md` with what you checked and how.
   Where a rule cannot be confirmed from a primary source, the project rule holds: that calculator does not ship, or it says plainly
   that it is unverified.
3. **The screens I use most feel as good as the basic calculator page.** That page is my quality bar. Look at the real screens:
   run the app, take screenshots at 320, 360 and 412 px wide, at 100% and 200% font, in dark and light, and look at them yourself.
   Judge hierarchy, spacing, density, number of taps and pop-ups against `docs/DESIGN-SYSTEM.md`, `docs/UX-GUIDELINES.md` and
   `docs/FORMS-AND-SHEETS.md`. Fix what you can defend; for anything subjective, show me before and after screenshots and say why.
   Tools home is the open complaint (see `docs/SESSION-STATE.md`, Rounds 17 to 19).
4. **A new session can start from the docs without reading 50 files.** There are about 50 files in `docs/`. Many are history, and some
   counts in them are stale. Make one current map: what each doc is for, which are history, and a short honest state of the app.
   Don't delete docs files; mark them.

After those four, continue with "Owner's order of work" in `docs/THE-PLAN.md` section 4. Don't reopen decisions recorded there or in
section 5; they are mine and already made.

## Where to start reading

`CLAUDE.md`, then `docs/THE-PLAN.md` (the current plan) and `docs/SESSION-STATE.md` (where the last session stopped), then
`docs/ARCHITECTURE.md`. When two docs disagree, the code wins, then `THE-PLAN.md`. Use `git log` to find out why something is the way it is.

## The rules that are hard, and why

These come from real failures. Keep them. If one genuinely blocks a better design, change the rule and its doc together, deliberately,
and tell me in the report.

- Layering `engine <- lib <- store <- components <- features`, and money is never a JavaScript `number` (use the engine's Decimal).
  A wrong EMI looks exactly like a right one. `src/architecture.test.ts` enforces this and the design bans.
- Tool ids and field ids never change. Saved items store inputs by field id, so a rename silently breaks my saved data.
- Every delete is undoable. Errors are plain words, never `NaN`.
- No native `<select>`, no stacked sheets, a visible Back on every screen (`docs/FORMS-AND-SHEETS.md`).

Most other notes in the docs are history: lessons from one session, cautions whose reason may no longer hold. Read them as context,
not as orders. If a caution looks out of date, say so and rewrite it with its scope and reason.

## What is approved, and what needs me

Approved, no need to ask: reading anything; running tests, builds, dev servers and browsers (close the servers when you finish); retrying
failed or flaky commands; editing source, tests and docs; small commits on the branch this session gives you, one change per commit;
pushing that branch; starting subagents for independent work.

Needs my go-ahead first: changing a tool id or field id; changing the stored data shape or the schema version; removing a calculator or
a feature; adding a runtime dependency; deleting files in `docs/`; pushing to `main` or `dev`; anything on a phone. If you need one of
these, finish everything that doesn't depend on it, then ask at the end with your recommendation.

This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it.
Because of that, list every change to how an existing feature behaves in your final report, small ones included. I will review the diff.

# Finishing work
Please avoid stopping while you still owe work the user asked for. Be persistent and do not stop unless needed.

While status notes are welcome, as is clarifying with the user on open decisions, carry on with work that does not depend on the user's
answer without unnecessary stops.

If you notice yourself inviting the user to redirect you or offering to wait, instead proceed on the next part of the task. You may meet
ordinary obstacles like errors, timeouts, locked files, empty results or failing tools. Diagnose them first, and when they are not real
blockers, work through them with the access you have (wait and retry, fix the request, use another tool or source) rather than stopping
unnecessarily.

If someone clearly decided something is a hard blocker, such as a file marked not to be touched, access that was intentionally withheld,
or a safety guardrail, leave it alone, say plainly what you found, and look for another safe way to finish the task. Stopping before the
task is complete is very rarely merited, as in when the task can't move forward without user input, or where the blocker is deliberate and
should not be worked past. This does not override the need for confirmation on risky or destructive actions.

# Verifying your work
Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for;
if something is not yet verified, say so explicitly. Never judge a command by a piped exit code (`npm run check | tail` once hid a failing
typecheck). A UI change is done only when the e2e suites for that screen pass and you have looked at the screenshots. A maths change is
done only when a test pins the expected value from an outside source. For your larger changes, ask a fresh-context reviewer (the
`qa-verifier` agent, or a new subagent) to check them; it catches what self-review misses.

# Subagents
`.claude/agents/` has `engine-builder`, `ui-builder`, `spec-reviewer` and `qa-verifier`; they run on a cheaper model. Each subagent
starts with no context and re-reads what it needs, so it costs a lot. Delegate work that is independent and reading-heavy, such as auditing
one engine module against its sources, or reviewing one screen's screenshots. Keep small or tightly linked work yourself. When you
delegate, brief the agent with the goal, the files, the rules above that apply, and what to return. Work on something else while it runs.
`docs/PARALLEL-WORK.md` explains how to avoid collisions.

# Keeping state
Update `docs/SESSION-STATE.md` after each of the four outcomes: what you did, what is verified, what is open. I switch sessions and
accounts, and that file is how the next session resumes.

# Communicating clearly
Write for an intelligent but low-context reader. The person reading has not seen your tool calls, your reasoning or the files you opened,
and may be switching in from other work. Messages should generally be self-contained: the reader should understand what you mean without
having to dig for other context. Put the key points in the first few sentences. Practice progressive disclosure in your sentence order,
and do not use undefined references and ideas in line 1 that won't make sense until the reader reaches line 12.

Use plain words, and write in clear, understandable full sentences. Do not use a term or abbreviation that you made up during the work.
Say what the thing is in a way any reader would understand. Write mostly in the style of ASD-STE100 Simplified Technical English: short
sentences, one idea per sentence, active voice, and consistently using the same word for the same thing. Use a paragraph of flowing prose
where ideas connect, and keep bullets for lists of separate items. Leave out unnecessary details unless the reader asks and practice
concision, but do ensure that your messages have the key context. Aim to make your user-facing text as human-readable and clear as possible.

I'm a product manager. Lead with the outcome and your recommendation. Tables are welcome for findings.

# The final report
Start with one paragraph: what is now true that was not true before. Then, for each of the four outcomes: what you changed, the evidence
(the command and its result, or the screenshot), and what is still open. Then every change to existing behaviour. Then the decisions you
need from me, each with your recommendation. Then what you found but did not fix, ranked by risk.

---

## Notes for the owner (not part of the prompt)

- **Cost.** Fable 5.2 costs $8 / $40 per million tokens, twice Opus 5.5. Anthropic still recommends Opus 5.5 as the default. Use
  Fable 5.2 for this kind of long, whole-app audit-and-fix session; go back to the split in `docs/MODEL-GUIDE.md` for routine
  feature work. `MODEL-GUIDE.md` still lists Fable 5.1 prices and should be updated.
- **Effort.** Start at `high`. Try `xhigh` only for the tax and engine audit, and only if `high` misses things.
- **Expect long, quiet stretches.** Fable 5.2 runs many tool calls between updates. Come back for the report, or ask "where are you?"
- **When it asks to continue, answer with the action** ("Yes, rename that field id"), not "go". It applies approvals literally.
- **If it does too much or too little:** too many unrequested changes means remove the ownership sentence; it stops early means check that
  the "Finishing work" block is in the first message.
