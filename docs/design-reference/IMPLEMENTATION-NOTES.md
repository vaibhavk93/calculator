# Implementing the design reference: decisions and deliberate deviations (2026-11-06)

The owner asked to build the Claude Design pass in this folder. This file is what builders follow. Where it differs from the
screens, this file wins, and each difference says why. `docs/DESIGN-SYSTEM.md` and `src/architecture.test.ts` still apply.

## Build exactly as designed

| Screen | What to build |
|---|---|
| Budget home | Top **Spending / Net worth** segmented control (existing `Segmented`). Spending: bare hero "Spent this month" (or "Over budget by"), one quiet line "Kept ₹X of ₹Y that came in" (from `monthFlow`, only when the month has money in; when spending is larger, "Spent ₹X more than came in", no percentage), ONE flat panel holding the monthly-limit bar plus "Needs attention", plain ruled "Recent entries", collapsed "More in Budget" list. Net worth: the Portfolio content (hero, staleness line, split bar, 6-month trend, holdings "tap to update") rendered inside Budget home, with the eye icon (hide amounts) in the header |
| Tools home | **2-column grid of the 8 groups** (owner decision 2026-11-07, after seeing the plain list and the grid side by side; screens `ToolsHome` / `ToolsHomeLight`). Order: search, "Recents" row of small flat **icon tiles** (raised background, one-colour stroke icon, label under), Scientific calculator row, "Groups · tap to open" label, then the group tiles (small group-tint icon, name, "N tools"; each tile keeps aria-label `Name, N calculators`). The tint is only the icon stroke, never a wash. The Shelf alternative was not chosen. |
| Group page | Back + the group's dot and name, a search scoped to the group, a "Recents" row scoped to the group (hidden when none), "All tools" and the group's calculators in the same 2-column tile grid; every tile icon carries the GROUP's colour (screens `ToolsGroup` / `ToolsGroupLight`). Replaces the old sectioned list. The Recents row also sits under the search in Settings "Opens on" and under the "Use in" picker (only calculators that fit). Reuses `yourTools()`; no new store fields. |
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

10. **Tools home is the grid (owner decision 2026-11-07).** The earlier plain ruled list is gone. The design draws a different tool icon per tile on a group page; the app has one icon per group, so group-page tiles all show the group icon in the group colour. Per-tool icons are not invented.
11. **Section headings stay bold.** The design draws small regular-weight labels ("Recents", "Groups", "Recent entries"). `docs/FORMS-AND-SHEETS.md` makes section headings 700 on purpose (a heading must be clearly heavier than body text), and that rule is kept.
12. **Controls keep their `ink-3` border and inputs their underline** (`docs/DESIGN-SYSTEM.md` section 9), so the search fields, chips and "Mark paid" buttons are outlined rather than filled like the screens.
13. **Notes stays grouped by kind** (Notes, Lists, Calculations) and keeps its Notes / To-do switch, which the design does not draw. Bills keep the date and repeat in the meta line, and a bill card has no progress bar because only the payments LEFT are stored.
