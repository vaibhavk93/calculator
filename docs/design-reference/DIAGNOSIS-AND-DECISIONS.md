# Diagnosis and decisions

## Why a dense money app gets cluttered, and what the calculator does differently

A dense money app gets cluttered when every row fights for the same attention. Each screen has one real answer buried among five supporting facts, and when all six get the same visual weight — same size text, same card, same icon — the eye has nowhere to land. That's the "card on card" problem: wrapping everything in a surface gives everything a border, so nothing stands out. The opposite, a wall of hairline rows, fails the same way from the other side.

The calculator avoids both because it only ever shows one answer: one huge bare number, one quiet expression above it, sixteen keys at one size, three small follow-up icons. Nothing else competes for the eye.

The rule applied everywhere else: pick the one thing that is the answer on this screen, make it the only large bare number, and demote everything else to one of three roles — a quiet label, a grouped row, or a single flat panel. Never let two things be "large" on one screen. A panel means "these are bundled controls," never "this needs emphasis."

## The five open choices — decided

**A · Tools home (57 tools, 8 groups) — final: 2-column icon grid.** Search → "Recents" (a row of icon tiles, not text chips — a shape reads faster than a word when scanning half-asleep) → the 8 groups as flat 2-column tiles, each with a small tint-coloured icon, name and count. This replaced an earlier plain-ruled-list version after a side-by-side comparison; the list version no longer exists as a separate file. A "Shelf" alternative (horizontal preview cards) was also considered and rejected; it and its working-copy duplicates have since been removed from this folder (see below) — nothing to build from but the grid.

**A2 · Tools subcategory — new screen.** Tapping a group tile opens a subcategory page (`ToolsGroup`, worked example "Loans & EMI," 9 tools): back + group identity dot in the header, a search scoped to that group, a "Recents" row scoped to that group, then the group's tools in the same 2-column grid. Icons here are tinted with the group's own colour rather than individually hued per tool — you already know which group you're in from the header, so per-tool colour would just be noise.

**B · Result on a tool page.** Chosen: bare hero, exactly like the calculator's own number, plus a floating answer bar that appears only once the hero has scrolled off-screen. No panel behind the hero ever.

**C · Budget home (the most-cluttered screen).** Chosen: bare hero ("Spent this month") → one quiet line about money in → one flat panel holding the limit bar + "Needs attention" (these are one idea: how worried should you be) → plain ruled recent entries → a collapsed "More in Budget" list. One hero, one panel, one list.

**D · List vs Card on Notes and Due.** List is for scanning many items fast. Card is for previewing content — a checklist shows its first lines and running total, a saved calculation shows its actual result, a due bill shows its amount as its own number instead of squeezed into a meta line. Both views exist for both screens.

**E · Portfolio.** Lives inside Budget as a "Spending / Net worth" segmented control at the top of Budget home — not a sixth tab, not a page three taps deep. Net worth is a view on the same money Budget already tracks, not a new category of thing.

## Redesign pass — three changes applied on top of the above

1. **Portfolio surfaced, not buried.** Was: Budget → More in Budget → Portfolio (3 taps for a number that matters at 11pm). Now: a segmented control at the top of Budget home, one tap. Trade-off taken deliberately: one more structural element on the screen the owner called most cluttered, in exchange for removing two taps from the number he's most anxious about.
2. **Panels reserved for bundled controls, never for emphasis.** The Loan EMI tool page's "Total interest / Total amount payable" pair came out of its flat-panel wrapper and became bare, hairline-separated rows under a "Breakdown" label — they're related facts, not a control group. The input card (amount + rate + duration + unit switch) keeps its panel, because that genuinely is one bundle of controls.
3. **Icon tiles over text chips for fast-scan recency.** "Your tools" on Tools home changed from four text-only chips to small flat icon tiles (raised background, single-color stroke icon, label beneath). Same horizontal scroll, same tokens — just recognizable by shape before the word is read.

## What was deliberately NOT changed

The five decisions above, the token values, hairlines-over-cards as the default grouping tool, and the floating answer bar. A "redesign" that touched those without new evidence would be imposing taste over the owner's own explicit feedback rather than correcting something.

## Fix — Due (Card view) layout bug

`DueCard` / `DueCardLight` originally wrapped each card in a `<button class="card">`, with a second interactive control (the "More" button, or "Mark paid") nested inside it. A button can't legally contain another button — browsers auto-close the outer one the moment they hit the inner one, which silently broke the DOM: on the Overdue card this ejected the title and "More" button from the styled card entirely (they rendered as bare, unstyled, flush-left text with no card background), and on the "This week" cards it split "Mark paid" out from its card as a detached element. Fixed by making `.card` a plain `<div>` (a container, not a single tap target) with its inner controls — the checkbox, "More", "Mark paid" — as their own independently-tappable buttons inside it, matching the same container-vs-control pattern already used by `.row` in List view. Applies to both dark and light. Worth remembering if this pattern (a card with its own nested affordances) comes up again elsewhere: never nest a tappable control inside a tappable wrapper — give the wrapper a `div`/`li` role and keep every actual action as its own `button`.

## Tools home — final decision

The grid layout (decision A, above) is the selected default, with Recents added below search and a new subcategory screen (A2) completing the flow from group tile to tool list.

## F · More in Budget, and the five screens behind it (new)

"More in Budget" on Budget home was previously just a label over four dead-end rows. It's now a real screen (`MoreInBudget`): back header, then the four destinations as icon rows with a live meta line each (today's count or amount, not a static label), plus a fifth row for "Rules" shown dimmed with a "Soon" tag — honest that it isn't built, rather than a working-looking link to nothing. All five keep the Budget tab active in the bottom bar, since this is browsing within Budget, not a separate task.

- **Spending summary** — bare hero ("Spent this month" + the same number as Budget home, since it's the same fact) with a plain trend line under it, then a "By category" list: each row is a flat bar (height 5px, no pie or donut — pies invite comparing angles the eye is bad at; a sorted bar list reads at a glance and reuses the limit-bar pattern already in the system) tinted with the category's own color, then a plain "Top merchants" list. Category colors reuse the eight hues already defined for Tools groups rather than inventing a second palette — Food/Bills/Shopping/etc. borrow Tax-yellow/Dates-purple/Loans-blue etc. by slot, not by meaning. Worth a deliberate look before this is load-bearing: tying two unrelated taxonomies (Tools groups, spending categories) to the same eight colors can get confusing if a user ever sees them side by side.
- **Add from messages** — a review-and-confirm list, not a settings screen: every detected transaction is pre-checked except one the system couldn't categorize confidently (shown unchecked, "Uncategorized," so the user's attention goes where the system is unsure, not where it's confident). A floating "Add N transactions" bar at the bottom counts only the checked rows. This screen drops the bottom tab bar — like the Loan EMI tool page, it's a task flow you complete and leave, not a place you browse from.
- **Categories & cards** — a segmented control (Categories / Cards), each state its own board (matching how Spending/Net worth on Budget home is built as two boards, not one with JS state). Categories: dot + name + monthly total + chevron, plus "Add category." Cards: a flat color block standing in for the card/account's own brand color + name + account type + this month's transaction count, plus "Add card."
- **Bills & subscriptions** — bare hero ("Recurring spend," already monthly-normalized — a yearly subscription is shown divided by 12 so it sits in the same unit as everything else on the screen) then the exact Due-screen grouping (Due this week / Later), reusing that pattern rather than inventing a new one since it's the same underlying idea: things that will cost you money on a schedule.

## Budget screens re-checked for the Due-style nested-button bug

After the Due Card-view fix, `BudgetHome`, `BudgetHomeNetWorth` (both themes) and all six new screens above were checked for the same mistake (a `<button>` nested inside another `<button>`). None had it — every row with its own inner controls uses a plain container (`div`, or a row that itself has no nested interactive children), and every row that's a single tap target has no inner buttons. No fix needed there.

## Cleanup — stale and rejected screens removed from this folder

`ToolsHomeGrid` / `ToolsHomeGridLight` (duplicates of the live `ToolsHome`), `ToolsHomeShelf` / `ToolsHomeShelfLight` (the rejected alternative), and `Portfolio` / `PortfolioLight` (superseded by the Net worth segment on Budget home) have all been removed from `screens/` so there's only one version of each screen to build from. They're still sitting as boards on the canvas itself — the canvas tool can't delete boards, so remove those six manually if you want the canvas to match this folder exactly.
