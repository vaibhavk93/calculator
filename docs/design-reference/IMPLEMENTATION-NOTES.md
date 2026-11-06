# Implementing the design reference: decisions and deliberate deviations (2026-11-06)

The owner asked to build the Claude Design pass in this folder. This file is what builders follow. Where it differs from the
screens, this file wins, and each difference says why. `docs/DESIGN-SYSTEM.md` and `src/architecture.test.ts` still apply.

## Build exactly as designed

| Screen | What to build |
|---|---|
| Budget home | Top **Spending / Net worth** segmented control (existing `Segmented`). Spending: bare hero "Spent this month" (or "Over budget by"), one quiet line "Kept ₹X of ₹Y that came in" (from `monthFlow`, only when the month has money in; when spending is larger, "Spent ₹X more than came in", no percentage), ONE flat panel holding the monthly-limit bar plus "Needs attention", plain ruled "Recent entries", collapsed "More in Budget" list. Net worth: the Portfolio content (hero, staleness line, split bar, 6-month trend, holdings "tap to update") rendered inside Budget home, with the eye icon (hide amounts) in the header |
| Tools home | Search, "Your tools" as a horizontal row of small flat **icon tiles** (raised background, one-colour stroke icon, label under), Scientific calculator row, "Groups" ruled list with tint dot + count + chevron |
| Tool page | Input panel (one flat panel: the bundle of controls), the unit switch under the duration box, bare hero answer, "Breakdown" label over bare hairline rows (NOT in a panel), a principal-vs-interest bar, the floating answer bar only when the hero has scrolled away |
| Notes List / Card | List: dense rows. Card: one flat card per item showing content: a checklist shows its first lines and running total, a calculation shows its result as a number, a note shows its first lines and age, a to-do shows due + subtasks. `+ New` beside the List/Card switch |
| Due List / Card | Hero "Amounts due in the next 30 days". List: Overdue / This week / Later; a bill row has an icon, title, one meta line (due + amount + "N payments left") and a **Mark paid** button; a task row has a round check and "More". Card: one card per item with the amount as its own number, a thin progress bar when a bill has a payment count, and the Mark paid / check control INSIDE the card |
| Settings | Each section is ONE flat panel of rows under a small heading (Appearance, Numbers, Show in the app, Behaviour, Reminders, then Backup and export / Tips and tours rows). Values right-aligned in ink-2 |

## Deliberate deviations (keep these)

1. **No invented settings.** The design shows "Font size", "Date format", "Confirm before deleting", "Calculator history limit", "Bill reminders: 3 days before". Those settings do not exist; do not add them. Restyle the REAL rows only.
2. **Colours come from `src/lib/theme.ts`, not `tokens.css`.** The token values match ours. The design's invented `positive` (#8BC48A) maps to our existing `--positive`; its tint hex values map to our existing tint dot colours. No new raw colours anywhere (architecture test).
3. **Staleness is not `alert`.** The design paints stale holdings and the "3 of 8 values are older than 30 days" line in red. `alert` means overdue or error only. Use ink with a clock icon and the word "old" (never colour alone). Negative net worth uses `--negative` plus the words "Liabilities are larger than assets".
4. **Income in Recent entries** may use `--positive` for "+₹90,000" because money in is unambiguous, AND the meta line says "Money in" (never colour alone).
5. **Hidden amounts hide the bars too** (split and trend), not just the numbers: proportions leak the split.
6. **No standalone Portfolio page.** The design supersedes it; remove the "Portfolio" row from More in Budget and the separate screen route once the Net worth segment works. Keep the add/update sheets.
7. **`ink-3` is never text** (design rule, matches the owner's decision 2026-11-04). Sweep `color: var(--ink-3)` to `ink-2` in a final pass.
8. The design canvas did not draw 200% font or 360x640. Every screen must still pass `e2e/layout-contract.test.mjs` (144/144) and work at 200% font.
9. Screens not drawn (editors, Spending summary, Bills, Categories and cards, Rules, Import, empty states) keep their current structure but pick up the same panel/hairline/hero rules where it is a direct, obvious application.
