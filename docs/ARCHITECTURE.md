# Architecture

How the code is laid out, how data moves, and the steps for the three changes people make most often.
Stack: React 18, TypeScript, Vite, Zustand, `decimal.js`, Capacitor 8, Vitest. Reasons are in `docs/TECH-DECISIONS.md`.

## 1. Layers

```
engine  <-  lib  <-  store  <-  components  <-  features
 pure       helpers    state      shared UI      screens
```

A layer may import only the layers to its left. `src/architecture.test.ts` checks this on every test run, and
`npm run build` runs it first, so a violation fails the build. It also enforces the design bans (raw colours, radii,
shadows and so on) and which third-party packages each layer may use.

| Layer | Folder | Rule |
|---|---|---|
| engine | `src/engine/` | Pure TypeScript on `decimal.js`. No browser API. All financial maths lives here |
| lib | `src/lib/` | Formatting, parsing, dates, plugin wrappers. May use Capacitor plugins |
| store | `src/store/` | One Zustand store, persistence, backup, migrations |
| components | `src/components/` | Shared UI: tab bar, sheet, snackbar, icons, `useBackHandler` |
| features | `src/features/` | Screens: `calculator`, `tools`, `memory`, `settings` |

## 2. Folder map

```
src/
  engine/
    expression/      tokenizer, parser, evaluator, keypad input rules  (the calculator)
    convert/         percentage, units, currency, GST, discount, tip, number base, fuel
    everyday/        date, world time, body metrics, grade average, ovulation
    loans/           EMI, schedule, prepayment, home-loan tax, rules.ts (dated limits)
    investments/     SIP, FD, RD, PPF, NPS, EPF, XIRR, rates.ts (dated example rates)
    tax/             income tax, capital gains, advance tax, gratuity, rules.FY2026-27.ts
    metrics/         CAC/LTV, funnel, ARR, A/B sample size, retention
  lib/
    tool.ts          the ToolSpec contract: Field, Output, ToolSpec, helpers
    toolFormat.ts    turns a result cell into text (money, percent, int)
    memory.ts        SavedCard, TapeLine, Reminder types
    reminders.ts     date maths: next due, grouping, 30-day total
    tape.ts          list maths: parse "Flights 24000", totals, progress, summary
    notifications.ts plan and schedule local notifications (Capacitor)
    storage.ts       KeyValueStorage: localStorage or Capacitor Preferences
    clipboard.ts     parse pasted text into an expression
    backStack.ts     the Android back button as a stack
    theme.ts         the ONLY place raw colours live
  store/
    app.ts           the store and all its actions
    types.ts         Settings, PersistedData, re-exports lib/memory types
    persistence.ts   sanitizers, schema version, migrations
    boot.ts          load, build the store, debounced save
    backup.ts        export and restore a JSON backup
  features/
    calculator/      CalculatorScreen, ScientificScreen, Display, Keypad, History
    tools/           ToolsScreen, ToolScreen, groups.ts, registry.ts, one spec file per module
    memory/          Notes (SavedScreen), Due, list screen (TapeScreen), SaveSheet, ToListSheet
    settings/        SettingsScreen and its controls
  styles/            global.css (calculator + shell), tools.css, lists.css
android/             Capacitor Android project
docs/                everything in this folder
```

## 3. Data flow

```
 user input -> store action -> state -> screens (useApp selectors)
                                  |
                                  +--> boot.ts subscribes: debounced save (250 ms) -> KeyValueStorage
                                  +--> App.tsx effect: reminders -> notifications.ts -> Android
```

- **Persisted:** `settings`, `history`, `cards`, `reminders`, `memory`, `input`. Nothing else. A snackbar or an open
  panel never touches storage.
- **Not persisted:** `nav` (where you are in Tools), `tab`, `overlay`, `notice`, form values (kept in memory for the
  session by `ToolScreen`).
- **Everything read from disk goes through a `sanitize*` function** in `persistence.ts`. Never trust stored data.
- **Schema:** `CURRENT_SCHEMA = 2`. Add a step to `MIGRATIONS` and a test with a fixture of the old shape when you
  change what is stored. New optional fields (like `checklist`, `done`) need no bump.

## 4. The calculator (`ToolSpec`) contract

A calculator is data. `src/lib/tool.ts` defines it. The shared `ToolScreen` renders any spec.

```ts
{ id, title, blurb, category, keywords, fields: Field[], compute(values) => Output | { error } }
```

- `Field` kinds: `number` (with a unit), `select`, `date`, `text`, `rows` (a growable list).
- `advanced: true` tucks a field under "More options". Keep 3 to 5 fields on top.
- `Output`: `rows` (one is `main: true`), optional `table`, `chart`, `formula`, `note`.
- `compute` never formats. `ToolScreen` formats using the user's settings.
- Money in `rows` and `table` is `Dec`. `chart` data is plain numbers, for drawing only.

## 5. Navigation

- Four tabs: Calculate, Tools, Notes, Due. The internal ids are `calculate | tools | saved | due`.
- Tools nests three deep: home, then a group page, then a calculator. `nav` in the store holds the position.
- Tapping the tab you are already on calls `setTab` with the same id, which resets that tab to its start and bumps
  `tabTap`. Screens with local state reset in an effect on `tabTap`.
- The Android back button: `App.tsx` closes an overlay, then runs the newest handler registered with
  `useBackHandler`, then goes to the Calculate tab, then exits.

## 6. Recipes

### Add a calculator
1. Engine function in `src/engine/<module>/` with tests that cite an outside source in a comment.
2. A `ToolSpec` in `src/features/tools/<module>.ts` with realistic defaults. Use `need()` for required numbers.
3. Add its id to a group in `src/features/tools/groups.ts` (a test fails if a tool is in no group).
4. `npm run check`. Then open it in a browser at 360px.
5. If it uses a rate or limit that can change: one dated data file with the source URL, and say "as of" in the note.
6. Add a row to `docs/VERIFICATION.md`.

### Add something to the store
1. Type in `src/store/types.ts` or `src/lib/memory.ts`. Prefer an optional field.
2. Sanitizer in `persistence.ts`. Bump the schema and add a migration only if an old file would be misread.
3. Action in `app.ts`. Test in `src/store/*.test.ts` (look at `memory.test.ts` for the pattern).
4. If it must survive a restart, include it in `snapshot()`, `restore()` and the change check in `boot.ts`.

### Add a screen with a back button
1. Call `useBackHandler(true, onBack)` while it is open.
2. Reset it on `tabTap` if it keeps local state.
3. Use the `.screen` and `.screen__bar` pattern. Controls at least 44px.

## 7. Files that several people touch (careful)

`src/styles/global.css` (calculator and shell), `src/styles/tools.css`, `src/styles/lists.css`, `src/store/app.ts`,
`src/App.tsx`, `src/lib/tool.ts`. When working in parallel, see `docs/PARALLEL-WORK.md` for who owns what.
