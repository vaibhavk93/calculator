# Design reference — from the Claude design canvas

This folder is reference material handed off from a Claude (Cowork) design pass, done on a separate interactive canvas — **not** a replacement for anything already in `docs/` (in particular `docs/DESIGN-SYSTEM.md` and `docs/UX-GUIDELINES.md`, which this session did not read or touch). Treat this as input to merge or diff against, not as the source of truth.

Canvas (view/comment, owner's account): https://claude.ai/artifact/Xt4sR1nbBUBXihoTmbEE4V

## What's here

- `tokens.css` / `tokens.json` — the color, type, radius and spacing tokens used across the pass, dark + light.
- `DIAGNOSIS-AND-DECISIONS.md` — why the screens are structured the way they are: the core diagnosis, the five open-choice decisions (Tools home layout, tool-page result treatment, Budget home structure, List/Card on Notes & Due, where Portfolio lives), the three redesign changes applied in a later pass (Net worth as a Budget segment, panels-mean-bundled-controls-not-emphasis, icon tiles over text chips), and the final call on Tools home (grid layout, plus a new subcategory screen).
- `screens/*.html` — every artboard as a static, self-contained HTML file (inline CSS, no build step). Each one renders at 390×844 if opened directly in a browser; `support.js` is referenced but not included — harmless 404, the markup and styles render fine without it. These are **reference for structure, copy, states and token usage** — not production components.

## Screens included

Dark: `ToolsHome` (the 2-column icon grid, final layout), `ToolsGroup` (Tools subcategory, worked example: "Loans & EMI"), `ToolPage` (Loan EMI), `BudgetHome`, `BudgetHomeNetWorth`, `MoreInBudget`, `SpendingSummary`, `AddFromMessages`, `CategoriesAndCards` (Categories state), `CategoriesAndCardsAlt` (Cards state), `BillsAndSubscriptions`, `NotesList`, `NotesCard`, `Due`, `DueCard`, `Settings`, `Components` (component library sheet).

Light: same set, `*Light.html`.

**More in Budget — now a real screen.** `MoreInBudget` / `MoreInBudgetLight` replaces what used to be a label over four dead rows. It's a back-header list: Spending summary, Bills & subscriptions, Add from bank messages, Categories & cards — each with a live meta line (today's count/amount) — plus a dimmed, un-tappable "Rules" row tagged "Soon." The Budget tab stays active in the bottom bar on all five destination screens (this is browsing within Budget, not a separate flow) except `AddFromMessages`, which drops the tab bar for a floating "Add N transactions" bar instead, the same way `ToolPage` does for the Loan EMI flow.

- `SpendingSummary` — bare hero (same "spent this month" number as Budget home) + trend line, then a flat-bar "By category" list and a plain "Top merchants" list. Category colors reuse the same 8 hues already defined for Tools groups (Food→tax-yellow, Bills→dates-purple, etc.) rather than a second palette — flagged in Known gaps below as worth a deliberate confirm.
- `AddFromMessages` — a review-and-confirm list, 8 detected transactions, 7 pre-checked (the one the system couldn't categorize confidently is left unchecked on purpose).
- `CategoriesAndCards` / `CategoriesAndCardsAlt` — a segmented control, each state its own file (same pattern as BudgetHome/BudgetHomeNetWorth): Categories (dot + name + monthly total) and Cards (color block + name + account type + transaction count).
- `BillsAndSubscriptions` — bare hero ("Recurring spend," monthly-normalized) + the same Due-screen "this week / later" grouping.

All six were checked against the Due Card-view nested-button bug (see DIAGNOSIS-AND-DECISIONS.md) — none had it.

This is the complete, final set — every rejected alternative and superseded screen (the old plain-list Tools home, the Shelf alternative, the standalone Portfolio page) has been removed from this folder so there's nothing stale to build from by mistake. Build only from what's listed above.

**Tools home — final layout.** `ToolsHome` / `ToolsHomeLight` is the 2-column icon grid of the 8 groups, with a "Recents" row (icon tiles) directly below the search bar.

**Tools subcategory — new screen.** Tapping a group tile on Tools home opens `ToolsGroup` / `ToolsGroupLight`: back + group identity dot, a scoped search ("Search 9 tools in this group"), a "Recents" row scoped to that group, then the group's tools in the same 2-column grid pattern as Tools home. Built for "Loans & EMI" (9 tools) as the worked example — the other 7 groups follow the identical pattern with their own tool lists and tint colour.

**Net worth.** Lives inside `BudgetHome` as the "Net worth" state of a Spending/Net worth segmented control — `BudgetHomeNetWorth.html` is that second state. There is no standalone Portfolio page anymore.

## Known gaps / not done in this pass

- No 200%-font-size or short-phone (360×640) variants.
- Screens not built: note/checklist/to-do editors, Rules (the "More in Budget" row for it is a dimmed placeholder only), empty states.
- `positive` color (`#8BC48A` dark / `#1F7A3D` light) was invented — the original brief's hard-rule color table never defines a "good money" color, only `alert` for bad. Worth a deliberate decision before this becomes load-bearing elsewhere in the app.
- Spending-category colors (Food, Travel, Bills, Shopping, Health, Groceries, Entertainment, Other) reuse the 8 Tools-group hues by slot, not by meaning — not yet explicitly confirmed. If a user ever sees both taxonomies on screen together this could read as confusing; flagging before it's load-bearing.
