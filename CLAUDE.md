# VK Calc — instructions for AI assistants

A personal calculator for Android (iOS later): everyday math, loans/EMI, India-specific
investment and tax tools, notes and reminders. React + TypeScript + Vite, wrapped with
Capacitor for the stores. **Read the docs before writing code.**

## Read first

| For | Read |
|---|---|
| **Where we are, what to build next, open decisions** | `docs/HANDOFF.md` |
| What to build, per calculator (inputs → outputs) | `docs/PRD.md` |
| Colours, type, layout, the bans | `docs/DESIGN-SYSTEM.md` |
| Interaction, copy, accessibility | `docs/UX-GUIDELINES.md` |
| Notes / reminders / tapes | `docs/MEMORY-LAYER.md` |
| Rates, tax rules, Android reminder reliability | `docs/DATA-FRESHNESS.md` |
| Why each technical choice was made | `docs/TECH-DECISIONS.md` |
| Which model for which phase | `docs/MODEL-GUIDE.md` |

## Commands

```bash
npm run dev          # dev server
npm run check        # typecheck + all unit tests   <- run before every commit
npm run build        # runs the architecture gate, typechecks, builds to dist/
npm run preview -- --port 4173
node e2e/smoke.mjs   # real-browser checks against a running preview (needs playwright)
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
- Accent means "you can act on this", never "this is good". Only overdue earns a hue.
- Numbers the user *reads* are Plex Mono, tabular. Sans for words and for keys you press.
- Every control is at least 44px in one direction. Type is `rem` so it follows system font size.
- Grouping is by 1px hairline, not by boxes. No nested cards.
- Every delete is undoable. Errors are plain words ("Can't divide by zero"), never `NaN`.

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

## Known issues

- `npm audit` reports advisories in **dev tooling only** (vite 5.x, vitest 2.x). Runtime
  dependencies have none. The fixes are major upgrades (vite 8, vitest 5); take them deliberately.
- Android-specific behaviour (haptics permission, wake lock, clipboard read, widgets, reminders)
  has not been run on a real device. See `docs/DATA-FRESHNESS.md`.
