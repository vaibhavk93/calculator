# AGENTS.md: instructions for any AI coding assistant

This file is for assistants other than Claude Code (Codex, Cursor, Gemini, Copilot and so on). Claude Code reads
`CLAUDE.md`, which holds the same rules in more detail. If the two ever disagree, **`CLAUDE.md` wins**.

**Calc** is a personal calculator for Android (iOS later): maths, loans, India investment and tax tools, notes, lists
and reminders. React + TypeScript + Vite, wrapped with Capacitor. Start with `docs/HANDOFF.md`.

## Commands

```bash
npm run check          # typecheck + all unit tests. Run before every change is called done
npm run build          # architecture gate + typecheck + build
npm run preview -- --port 4173
```

A UI change is not done until you have looked at it in a browser at 360px wide. Unit tests cannot see layout,
focus or clipped text.

## Layers (enforced by `src/architecture.test.ts`)

```
engine  <-  lib  <-  store  <-  components  <-  features
```

- `src/engine` is pure TypeScript on `decimal.js`. It imports nothing outside itself and uses no browser API.
- Money is never a JavaScript `number`. Use `D` and `Dec` from the engine.
- Add a calculator: engine function and tests first, then one `ToolSpec` in `src/features/tools/<module>.ts`,
  then add its id to `src/features/tools/groups.ts`. No new screen.

## Rules you must not break

1. **Tool ids and field ids never change.** Saved items store inputs by field id.
2. **Raw colours only in `src/lib/theme.ts`.** Everywhere else use `var(--token)`.
3. Radius is `var(--r-sm|md|lg)` or 0. No shadows, gradients, uppercase, positive letter-spacing, backdrop-filter.
4. Every control is at least 44px in one direction. Type is in `rem`.
5. A control's border uses `var(--ink-3)`. `var(--line)` is for separators only.
6. Errors are plain words ("Can't divide by zero"), never `NaN` or "Invalid input".
7. Every delete is undoable.
8. Where a tax rule, rate or limit cannot be confirmed from a primary source, that calculator or default does not ship.
   Put every rate in one dated data file with its source URL.
9. Do not change what is stored without a schema bump and a tested migration (`src/store/persistence.ts`).
10. Use `useBackHandler` for any screen with a "back". The Android back button depends on it.

## Never claim what you did not run

Say "tests pass" only after running them. Say "verified" only with the evidence: which command, which screen,
which source. `docs/VERIFICATION.md` shows how each formula was checked. Keep it honest.

## Working in parallel with other assistants

Read `docs/PARALLEL-WORK.md`. In short: stay inside the files you own, do not edit shared files, do not run
git commands unless asked, and report anything you could not do.

## Where things are

| Need | Read |
|---|---|
| Current state, what is not done | `docs/HANDOFF.md` |
| Folder map, data flow, how to add things | `docs/ARCHITECTURE.md` |
| Building and installing on a phone | `docs/BUILD-ANDROID.md` |
| Test strategy and the device checklist | `docs/TESTING.md` |
| What to build next | `docs/BACKLOG.md` |
| Colours, type, layout, components | `docs/DESIGN-SYSTEM.md` |
| Interaction, copy, navigation | `docs/UX-GUIDELINES.md` |
| Screen-by-screen improvement plan | `docs/UI-UX-PLAN.md` |
| How each formula was checked | `docs/VERIFICATION.md` |
