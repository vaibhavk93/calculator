# Calc — instructions for AI assistants

A personal calculator for Android (iOS later): everyday math, loans/EMI, India-specific
investment and tax tools, notes and reminders. React + TypeScript + Vite, wrapped with
Capacitor for the stores. **Read the docs before writing code.**

## Read first

| For | Read |
|---|---|
| What to build, per calculator (inputs → outputs) | `docs/PRD.md` |
| Colours, type, layout, the bans | `docs/DESIGN-SYSTEM.md` |
| Interaction, copy, accessibility | `docs/UX-GUIDELINES.md` |
| Notes / reminders / tapes | `docs/MEMORY-LAYER.md` |
| Rates, tax rules, Android reminder reliability | `docs/DATA-FRESHNESS.md` |
| Why each technical choice was made | `docs/TECH-DECISIONS.md` |
| Which model for which phase | `docs/MODEL-GUIDE.md` |
| **Where the project stands, what is not done** (start here) | `docs/HANDOFF.md` |
| Folder map, data flow, how to add a calculator or store field | `docs/ARCHITECTURE.md` |
| Running several AI workers without collisions | `docs/PARALLEL-WORK.md` (and `.claude/agents/`) |
| Building and installing on a phone, the proxy certificate fix | `docs/BUILD-ANDROID.md` |
| Tests, the browser pass, the phone and reminder checklists | `docs/TESTING.md` |
| What to build next, in order | `docs/BACKLOG.md`, `docs/IMPROVEMENT-PLAN.md` |
| How each formula was checked | `docs/VERIFICATION.md` |
| UX audit and the screen-by-screen plan | `docs/UX-AUDIT.md`, `docs/UI-UX-PLAN.md`, `docs/TOOLS-UX-REVIEW.md` |
| The logo and icon rules | `docs/BRAND.md` |

## Commands

```bash
npm run dev          # dev server
npm run check        # typecheck + all unit tests   <- run before every commit
npm run build        # runs the architecture gate, typechecks, builds to dist/
npm run preview -- --port 4173
scripts/build-android.sh [install]   # tests, web build, cap sync, debug APK, optionally install on the phone
node e2e/smoke.mjs   # real-browser checks (needs playwright). STALE: still taps removed buttons, update before use
```

**A UI change is not done until `e2e/smoke.mjs` passes and you have looked at the screenshots.**
Unit tests cannot see focus bugs, clipped glyphs or layout on a short phone. P1 had four of those
and every one was found only in the browser.

## Layering: enforced by `src/architecture.test.ts`

```
engine  <-  lib  <-  store  <-  components  <-  features
```

- `src/engine/` is pure TypeScript on `decimal.js`. It imports nothing from outside itself, touches
  no browser API, and knows no UI exists. All financial math lives here. This is what makes the
  verified formulas portable to any other framework or platform.
- Money is never a JavaScript `number`. Use `D` / `Dec` from the engine.
- Add a calculator by adding engine functions + tests first, then a screen.

## Design rules: also enforced by `architecture.test.ts`

- Raw colours exist only in `src/lib/theme.ts`. Everywhere else: `var(--token)`.
- `border-radius` is `var(--r-sm|md|lg)` (4 / 10 / 20) or `0`. Nothing else.
- No `text-transform: uppercase`, no positive `letter-spacing`, no `box-shadow`, no gradients,
  no `backdrop-filter`, no coloured side-stripe borders.
- Accent means "you can act on this", never "this is good".
- `positive` / `negative` are the only colours meaning good or bad. Use them only where good
  and bad are unambiguous (money saved, a penalty owed), never on a plain fact or a tie, and
  never as the only signal — a screen reader must get the same meaning in words.
- Numbers the user *reads* are Plex Mono, tabular. Sans for words and for keys you press.
- Every control is at least 44px in one direction. Type is `rem` so it follows system font size.
- Grouping is by 1px hairline, not by boxes. No nested cards.
- Every delete is undoable. Errors are plain words ("Can't divide by zero"), never `NaN`.
- A control's border is `var(--ink-3)`; `var(--line)` (1.3:1) is for separators only. See `docs/DESIGN-SYSTEM.md` section 9.
- Tool ids and field ids never change: saved items store inputs by field id.

If a rule blocks something you genuinely need, change the rule and the doc together, deliberately.
Do not work around it.

## Hard-won rules

- **Keys fire on pointer-down** and must not keep focus (`onMouseDown` preventDefault), and
  `App.tsx` blurs any button activated by a pointer. Otherwise Enter on a hardware keyboard
  re-presses the last button tapped instead of meaning "=".
- A scrolling box (`overflow: auto`) clips anything taller than its line box. `.display__result`
  pads and negative-margins for this; keep it.
- Flex items with `overflow` set can shrink below their content. Mark must-not-shrink items `flex: none`.
- `ResizeObserver`, not text changes, is the trigger when *available room* changes.
- Storage is async (`KeyValueStorage`) so Capacitor Preferences can replace localStorage in the
  Android build as a one-file change. Everything read from storage goes through `sanitize*`.
- Where sources conflict or are missing (surcharge rates, GST slabs), that calculator does not
  ship until a primary source is checked. A missing calculator is recoverable; a confidently
  wrong tax figure is not.

- A screen with a "back" calls `useBackHandler`; tapping the tab you are on resets it (`tabTap`). Android back is a stack (`src/lib/backStack.ts`).
- `npx cap sync android` after any web or plugin change, or the phone gets an old app. The company proxy (Zscaler) breaks Java HTTPS: `docs/BUILD-ANDROID.md` section 3.

## Known issues

- `npm audit` reports advisories in **dev tooling only** (vite 5.x, vitest 2.x). Runtime
  dependencies have none. The fixes are major upgrades (vite 8, vitest 5); take them deliberately.
- Android: one older debug build ran on a OnePlus (Android 16). Since the UI revamp, nothing has run on a device: paste, copy, the back button,
  reminders (fire at 9:00 am only, unproven on a phone that kills background apps). See `docs/HANDOFF.md` and `docs/TESTING.md` section 4.
- The calculator logs every expression to localStorage at DEBUG level (`src/lib/logger.ts`). Under review, see `docs/IMPROVEMENT-PLAN.md`.
