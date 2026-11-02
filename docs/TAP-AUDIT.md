# Tap audit: what can be tapped, and does it look tappable (2 Nov 2026)

Rule: `docs/FORMS-AND-SHEETS.md` section 12. Shared classes (in `global.css`): **`.tap-row`** (48px, pressed state, pointer), **`.tap-row__chev`** (accent chevron pushed to the trailing edge), **`.link-btn`** (accent + underline), **`.btn:disabled`** (quiet border and text, no opacity), **`.radio-ring`** (empty ring on an unchosen option row). `.navrow__chev` is now accent too.
Use: `<button className="row tap-row">... <Icon name="chevron" size={18} className="tap-row__chev" /></button>`.

## A. Fixed in this pass (tools, due, settings, calculator, components)

| Element | Does | Before | Now |
|---|---|---|---|
| Tools home tile (group) | opens a group | wash only, no cue | trailing accent chevron, `tile__foot` |
| Tools "Scientific calculator" hero | opens screen | grey chevron | accent chevron, `tap-row` |
| Group page rows, search results | open a calculator | grey chevron / none on search | accent chevron on both, `tap-row` |
| Settings: Export, Restore, Notifications, Alarms | do something | plain text rows | `tap-row` + chevron (chevron hidden when already allowed) |
| Settings: choice rows (number system, etc.) | pick one | tick only on the chosen row | empty ring on the others |
| Settings segmented control | pick one | grey text, invisible track | ink-2 text, hairline under every option, accent under the chosen |
| Due row | opens the note | plain text | `tap-row` + chevron |
| Due: Mark paid / Snooze / Remove | act | accent text, no underline | underline; **Remove now asks first** (see C) |
| Tool "More options" | opens a section | grey text, "+" | accent label, accent "+/-", pressed state |
| Tool "How this is worked out" | opens | grey text, arrow | accent label and arrow, pressed state |
| Tool answer bar (sticky) | scrolls to the result | bordered, no cue | accent down icon |
| Keep and share icons | share, list, remind | accent icon, no frame | 1px frame, aria-label and title (already) |
| Chips ("To list", "Remind me", tags) | act or filter | border | + pressed state |
| `.link-btn` everywhere | act | accent only | accent + underline + pressed state |
| Icon-only buttons: History, Settings, Back, Close sheet, Remove row, Delete | act | aria-label only | aria-label **and** title |
| Tab bar | go to a tab | colour change only | selected tab: bold plus a 2px line on top |
| Disabled buttons | n/a | `opacity: .5` | border `--line`, text `--ink-3`, `cursor: not-allowed` |
| Paste sheet "Use" | submit | disabled when empty | enabled, shows "Paste or type a calculation" |
| Not tappable, left alone | | | section headings, `sect__count`, result values, hints, About row, Settings value labels, `tile__meta` |

## B. Read-only findings for the other workers (not edited)

### Budget worker (`src/features/budget/**`)
| Where | Does | Problem | Needs |
|---|---|---|---|
| `BudgetScreen.tsx:117` `.budget__row` (category row) | opens its entries / limit | **the owner's accident**: no chevron, no frame | `tap-row` + chevron (`budget.css` `.budget__row` is `display:flex; flex-wrap`, so put the chevron on the name line) |
| `BudgetScreen.tsx:127` "Spending summary" `.budget__row` | opens summary | same | `tap-row` + chevron |
| `BudgetScreen.tsx:104`, `SpendSummary.tsx:348` "Change limits" / "Set a limit" `.link-btn` | opens limits | now underlined by the shared class | check it still reads as a verb |
| `SpendSummary.tsx:98` `.budget__main` (entry row, edit) | opens edit sheet | no cue | `tap-row` + chevron (or a pencil icon) |
| `SpendSummary.tsx:226` category drill row | filters entries | no cue | `tap-row` + chevron |
| `SpendSummary.tsx:168,181` `.chip.spend__scope` | opens scope picker / removes filter | chip border only | trailing `down` icon on the picker chip, `close` icon on the remove chip |
| `SpendSummary.tsx:65,69` month arrows | previous / next | icon only | add `title` (aria-label exists) |
| `SpendSummary.tsx:103` per-row delete icon | deletes an expense | has Undo via store | add `title` |
| `ManageScreen.tsx:341` `.navrow` rows | open editor | already chevron, now accent | ok |
| `sheets.tsx` Done / Add buttons | actions | `btn:disabled` now quiet | check Add in Limits sheet |
| Display-only rows: `SpendSummary.tsx:278-339` (`row__label` in summary tables) | none | make sure none picks up accent or a pressed state | keep plain |

### Notes worker (`SavedScreen.tsx`, `TapeScreen.tsx`, `CardView.tsx`)
| Where | Does | Problem | Needs |
|---|---|---|---|
| `SavedScreen.tsx:116` `.row__main` | opens a note | no chevron | `tap-row` + chevron (row is `row--split` with a pin button, so put the chevron inside `row__main`) |
| `SavedScreen.tsx:125` pin button | pins | icon only | aria-label + title, `aria-pressed` |
| `SavedScreen.tsx:57,59` New list / Trash | open | now underlined | ok |
| `TapeScreen.tsx:120` line button | edits a line | check for a cue | edit icon or "Tap to edit" hint |
| `TapeScreen.tsx:93,129` delete / remove icons | delete | aria-label only | add `title` |
| `CardView.tsx` | n/a | not audited line by line | apply section 12 |

### History worker (`HistorySheet.tsx`)
| Where | Does | Problem | Needs |
|---|---|---|---|
| `:127` `.hrow__expr` | reuse the expression | plain text | accent or underline, or a "Use" label |
| `:130` `.hrow__result` | reuse the result | plain text with "=" | same |
| `:134` memo edit button | edits the note | check | edit icon, aria-label and title |
| `:142` delete icon | deletes | has Undo | add `title` |

### Not mine, not edited
| Where | Problem |
|---|---|
| `Display.tsx:138` big result is a button (tap to copy) | looks like a number. Copy button sits below, so low risk. Add `title="Copy"` if wanted. |
| `PickerSelect.tsx`, `FormField.tsx` | already have the `down` icon and border |

## C. Destructive actions

| Action | State |
|---|---|
| Due "Remove" (reminder) | **Fixed with an inline "Remove this reminder? Keep it / Yes, remove".** The store's `removeReminder` has no undo (the snackbar's `undoRemoval` only knows history rows, cards and expenses). If you prefer Undo to a question, the store needs a `removedReminder` slot. |
| Tool screen delete (saved calculator) | goes to Trash with Undo (store) |
| History clear | confirmation already (HistorySheet) |
| Restore from backup | confirmation already |
