# Test report: Shell (e2e/shell.test.mjs)

Run for the first time this round. 286 cases, 215 passed, **71 failed**, 29 notes recorded (not failures,
observations the test itself flagged with `note()`).

## Root cause found: one wrong selector explains 13 "failures"

Every one of these failed with the same message, `Timeout 30000ms exceeded ... waiting for
locator('[role=radio][aria-label=Light]')`:

SH-A07, SH-A08, SH-A16, SH-A17, SH-S01, SH-S02, SH-S12, SH-S21, SH-S26, SH-S27, SH-Y16, SH-R03, SH-R10

**Checked against the real markup** ([controls.tsx:17-30](src/features/settings/controls.tsx:17)): the theme
control's three buttons are `role="radio"` but carry **no `aria-label`** — only the group has one
(`aria-label="Theme"`); each button's name comes from its visible text ("Dark"/"Light"/"System"). The
selector the test wrote can never match. **Not an app bug** — the test needs
`getByRole('radio', { name: 'Light' })` or similar, not an `aria-label` attribute selector.

## Root cause found: one wrong CSS property explains 8 more

Every `Y-EDGE-*` case ("control edges are 3:1 against their ground") failed on `input.field`, `.pick`, etc.
with `0.00<3`. **Checked the scan code** ([shell.test.mjs:173](e2e/shell.test.mjs:173)): it only reads
`borderTopWidth`/`borderTopColor`. But `.field` ([global.css:638](src/styles/global.css:638)) deliberately
sets `border: 0` then only `border-bottom: 1px solid var(--ink-3)` — the project's own "hairline, not boxed"
rule from `CLAUDE.md`. The real, visible edge is the *bottom* border; the test only ever looks at the top,
which is always 0. **Not an app bug** — the test needs to check whichever side has `borderWidth > 0`, not
hard-code top.

Affected: all 8 `SH-Y-EDGE-*` cases (calc, sci, tools, tool, notes, todo, due, settings, picker).

## Needs a look: borderline text contrast, close to 4.5:1 but under it

Real measured values, not a test bug (the contrast-measuring code itself looks correct and is reused by
`Y-TXTD`/`Y-TXTL`, which otherwise pass everywhere else). Hint text (`.row__hint`, `.field-unit`,
`.field-words`) comes in at **3.83–4.06**, just under the 4.5:1 AA body-text bar, across notes, due, budget,
tool screens, in dark mode. Likely the `ink-2`/`ink-3` tone used for hints is a notch too light against the
dark background. Worth a small token nudge; not urgent (nothing drops below 3.8).

## Needs a look: the 4 non-default accents fail their own contrast check

`SH-Y-ACC-{sky,violet,amber}-{dark,light}` all fail (citron, the default, also fails light-mode fill-on-bg at
1.60, which looks like the same root cause). `accent-dim`/`accent-fill` on background comes in around
1.6–1.7:1 against a 3:1 bar, and accent text against surface sits at 3.83 against a 4.5:1 bar. This matches
what was already flagged earlier this round: **only the default accent (citron) had ever been checked this
rigorously; the other three were not**, and it turns out citron itself also has a light-mode gap. Real,
pre-existing, not caused by anything built this round.

## Known bugs, reconfirmed live (already tagged `known` in the test's own assertions)

| ID | What |
|---|---|
| B-01 | A damaged saved file is silently overwritten with an empty app; no backup kept |
| B-16 | A corrupted saved calculator line (`sin(` with `fresh:true`) white-screens the app with a DecimalError |
| B-17 | A failed save shows no warning |
| B-25 | Backup file name uses the phone's local date, not UTC (one case landed on the next day: saved at 2026-11-02 but named `...2026-11-03`, since it's past midnight UTC) |
| B-26 | After a sheet opens and closes, keyboard focus falls back to `<body>` — a screen-reader user loses their place |

## Other real findings worth a look (not yet fixed)

- **No `<h1>` on 5 screens** (calc, tools, notes, todo — some have an h2 but no h1 at all); **2 screens have more than one h1** (summary, manage) — heading structure needs a pass.
- SH-K16: restoring a settings-only backup doesn't apply the theme from the file.
- SH-K19: the "Replace everything" confirm is still showing after a restore completes — a second accidental tap could re-trigger it.
- SH-K26: full backup/restore round-trip crashes reading `history` from a null — needs the restore path checked.
- SH-K06: the "Open folder" link does nothing on the web build and should just not render there.
- SH-F02: the app calls `api.frankfurter.dev` for live currency rates during the tour — intentional (this round's work), but it means "no outside requests" is no longer literally true; worth a one-line doc update if that was meant to be an absolute rule.
- SH-N18: closing a nested sheet with Escape closes *both* the row menu and its parent (two `Escape` listeners both fire; each should stop at the top one).
- SH-R08: tab labels truncate at 320px width + 200% font ("Calculate", "Budget" both clipped).
- CG04 (shared with budget report): tapping a chosen category again doesn't un-choose it.

## Not yet investigated

The borderline-contrast and accent clusters above are measured correctly but not yet traced to the exact
token change needed. SH-K16/K19/K26 need the restore code read before calling them confirmed, not just
reported from the test's own message.
