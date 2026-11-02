# Test report: Calculator (e2e/calculator.test.mjs)

Run for the first time this round. 282 cases, 243 passed, **39 failed**.

## Root cause found: one test helper explains 12 "cursor editing is broken" failures

CALC-160, 162, 163, 164, 165, 166, 169, 170, 171, 173, 174, 176 all failed the same way: typing or
backspacing always acted at the **end** of the expression, never at the cursor position the test placed.

**Checked against the real code, and it is not broken.** The app genuinely supports cursor-aware editing —
[Display.tsx:98-102](src/features/calculator/Display.tsx:98) listens for the textarea's native `select`
event and saves the position; [app.ts:374-381](src/store/app.ts:374) uses that saved position
(`applyKeyAt`) instead of always appending, as long as the expression hasn't changed since. The deciding
evidence: **CALC-161, which moves the cursor with a real `page.mouse.click()`, passed.** Every failing case
instead uses the test's own `caret()` helper
([calculator.test.mjs:31-34](e2e/calculator.test.mjs:31)), which sets the cursor with
`el.setSelectionRange(x, y)` called from `page.evaluate` — and setting selection that way does **not** fire
the browser's `select` event, so the app is never told the cursor moved, and correctly falls back to its
normal end-of-expression behaviour.

**Not an app bug.** The fix is in the test helper: after `setSelectionRange`, dispatch the event by hand —
`el.dispatchEvent(new Event('select', { bubbles: true }))` — so the app's own listener fires the same way
a real tap would.

## Real, minor, confirmed: a dangling binary operator leaves a trailing space

CALC-076, 085, 088, 129 all show the same pattern: `"12 +"` typed/undone-to ends up displayed as `"12 + "`
(trailing space). **Checked the formatter** ([format.ts:144](src/lib/format.ts:144)): a binary operator
always renders with a leading *and* trailing space (`` ` ${op} ` ``), including when it's the very last
character with nothing after it yet. Real, reproducible, cosmetic (an invisible trailing space in a text
box) — not urgent, but a one-line fix (`.trimEnd()` on the formatted result, or strip only the case where
the operator is the final token) when there's time for polish.

## Known bugs, reconfirmed live (already tagged `known` in the test's own assertions)

| ID | What |
|---|---|
| B-16 | Stored expression that isn't a valid number, loaded with `fresh:true`, hangs on a 10s wait for the screen |
| B-19 (= the capHistory bug) | **Already fixed this round** — a brand-new calculation could vanish the instant it was made, once 200 rows were already named/locked. Confirmed by this same case (CALC-254), fixed in [persistence.ts](src/store/persistence.ts), tests added |
| B-20 | Pasting glues onto typed digits instead of replacing/separating them ("typed 12 then pasted 34 gives 1,234"); pasting a date like `12/05/2026` is read as a division and gives `5 ÷ 0` |
| B-24 | A tiny result like `1/10^120` can't be brought back into Edit — it shows "Too large to show" instead |

## Other real findings worth a look

- **CALC-350/351/352/353**: Scientific mode overflows sideways at 360×790, 360×640, 360×790@200% font, and
  800×360 landscape — a genuinely recurring layout gap in Scientific specifically (Calculate mode is fine at
  the same sizes), matching the owner's own earlier complaint about layout breaking with long expressions.
- **CALC-331**: at 360×640 the bottom keypad row (0, 00, ., =) sits under the tab bar — matches a previously
  documented complaint, now reproduced with exact coordinates.
- **CALC-383**: `.display__result` has `cursor: not-allowed` even though tapping it (after "=") is a real,
  working action (brings the last expression back to edit) — the cursor icon tells the user the opposite of
  what's true.
- **CALC-140**: Indian number-words claim needs a second look — not yet traced to source, logged as
  "not yet investigated" rather than confirmed.
- **CALC-056**: a 500-character cap is documented but the test got a 600-character string through — needs
  the cap's enforcement point checked (likely enforced on typed input but not on paste, consistent with the
  paste-related gaps above).
- **CALC-267 / Y-TAP-history**: the "All" chip in History is 41×32px, under the project's 44px rule in both
  directions where only one is required to pass — a real, small miss.
- **CALC-237**: a strict-mode Playwright error (two elements matched "Unlock") — likely the test's own
  selector is too loose, not two real buttons; not yet confirmed either way.
- **CALC-307 / CALC-304**: both are timing-sensitive (100 key presses in under 6s; a 200-key run raising no
  errors) and failed by a small margin (6998ms) or timed out entirely — could be real slowness or just a
  slow CI/laptop moment; needs a re-run to tell.

## Not yet investigated

CALC-140, CALC-237, CALC-304/307 need a second look before being called confirmed either way.
