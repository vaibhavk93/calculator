# Review: flows and intuitiveness

Date: 2026-11-02. Round 5 helper report (read-only). Nothing was edited and the app was not run.

**How to read this.** Every finding is **by reading** the code and docs (`CLAUDE.md`, `SESSION-STATE`, `FEATURES`,
`FORMS-AND-SHEETS`, `UX-AUDIT`, `UX-GUIDELINES`, `src/App.tsx`, `TabBar`, every screen in `src/features`). No tap count
was timed on a phone. "Taps" means taps only, typing not counted, starting from the app open on Calculate.
Anything that adds a feature is **unproven** until the owner or a critic agrees (global rule).

**Verdict.** The app is strong on safety (undo, Trash, discard checks, plain errors). It is weak on **finding things**:
Settings and backup live only on the Calculate tab, there is no first-run help, tools forget your numbers on restart,
and the best features hide behind small icons. Most fixes below are small.

---

## A. Flows, tap by tap

### A1. Summary table

| # | Flow | Taps now | Friction (by reading) | Proposed flow | Taps after |
|---|---|---|---|---|---|
| 1 | First launch | 0 to a working keypad | No tour. Hamburger icon opens Settings. Action chips hide until `=`. Notification permission pops up later, mid-Save | One dismissible tip card, gear icon, ask permission with a reason (D) | 0 (+1 dismiss) |
| 2a | Calc, then name it | 3 (History, pencil, Save) | Calculate has no Save. Naming is inside History | Chip "Name it" after `=` | 2 |
| 2b | Calc, to a new list | 3 (`=`, To list, Add) | App then jumps to Notes. You lose your place | Stay on Calculate, snack "Added. View" | 3, no jump |
| 2c | Calc, to an existing list | 5 | Plain system dropdown. Last list not remembered | Last list pre-picked | 3 |
| 2d | Calc, remind me | 3 (`=`, Remind me, Save) | Title is just "Reminder". Date is silently 30 days out | Title = the sum, date shown in the first line | 3 |
| 3a | Open EMI / SIP / tax | 3 (Tools, group tile, row) | Breaks the "2 taps" rule in `UX-GUIDELINES` 3. No recents | "Recent" row on Tools home | 2 |
| 3b | Save the result | 2 (Save top-right, Save) | Top-right is the hardest reach. No "Saved" message | Save in the bottom icon row, snack "Saved. View" | 2 |
| 3c | Share the result | 2 + Android picker | Icons only, no words | Keep icons, add words under them | 2 |
| 3d | Find it later | 2 (Notes, row) | Reopening from Tools shows defaults, not last numbers (kept in memory only) | Recents show last numbers | 2 |
| 4a | Expense, no category | 3 (Budget, Add, Add) | Silent "Uncategorised". Fine, but never offered again | Keep. Add "Add another" | 3 |
| 4b | Expense, category, cash | 5 | Category pills good. Note field is LAST, so its autofill comes too late | Note under Amount. Remember last mode | 4 |
| 4c | UPI from a RuPay card | 7 (+2 first time) | UPI hides "Paid from" behind a picker. Default label says "Bank account (default)" | Pills for up to 5 sources | 6 |
| 4d | Card bill payment | 6 | Hidden under "What is this". No "paid from which account" | Keep. Say it clearly in the sheet title | 6 |
| 4e | Where did money go | 2 (Budget, Spending summary) | Home shows one line "Biggest: ..." | Top 3 categories on home | 1 to 2 |
| 4f | Limit for one month only | 5 (Budget, Change limits, row, "Only Nov", Save) | Month is whichever month Budget shows. From Settings it is always today's month | Tap the hero number, pick month in the sheet | 4 |
| 5a | Add a card or account | 5 + scroll | Button is at the bottom, under every category | Cards as their own segment | 4 |
| 5b | See what a card owes | 2 | "Owes" only counts entries made here. No opening balance. Not on Budget home | "Cards owe" row on home, opening-balance field | 1 |
| 6a | Create a to-do | 3 (Notes, To-do, Add) | Same text gets a date in Today, none in All. Hidden rule | Always show the date chip before Add | 3 |
| 6b | Tick it | +1 | Works, Undo shown | Keep | +1 |
| 6c | Date it, see it in Due | 5 to 6 (row, date picker, Save, Due) | Tasks appear in Due, but Due says "Mark paid" | Say "Done" for tasks | 5 |
| 7a | Backup | 4 (Calculate, menu, Export, Create folder) | Only from Calculate. Row is below the fold | Gear on every tab | 3 from any tab |
| 7b | Restore | about 8 | Confirm text says "history and settings". It really replaces notes, reminders and budget too | Counts of everything, as a sheet | about 8, safer |
| 7c | Number format | 3 (Calculate, menu, radio) | Hidden from other tabs | Gear on every tab | 3 |
| 8 | Recover from mistakes | see A3 | Four different confirm styles | One style (E) | n/a |

### A2. Traces with confusion points

```
1  FIRST LAUNCH (owner has data, so he lands on the "Opens on" tab, default Calculate)
   open -> [Calc bar: title | History | hamburger] -> empty display ("No result yet")
        -> [Paste Copy Undo Back] -> keypad -> tab bar (5)
   ? Hamburger = Settings.   ? Chips To list / Remind me are invisible until "=".
   ? Tap the big number: if it is a lone number it opens the edit line, otherwise it copies. Two meanings.
   ? Copy default is "Ask each time", so every Copy costs a second tap (sheet).

2  QUICK CALC -> SAVE / LIST / REMIND
   12000/4 = ---+--> [To list] -> sheet: Lines, List(select), Name, tick box -> Add -> JUMPS to Notes
                |--> [Remind me] -> sheet "Save": title "Reminder", Remind=ON Once, date +30 days -> Save
                |       -> notice "See the Due tab"  (notification permission may pop up NOW)
                '--> History (top-right) -> pencil -> Name   (the only way to keep it by name)
   ? "Save" does not exist on Calculate. Wording differs: To list / Remind me / Name.
   ? Chips show only for a plain number result (not for 12000/4 before "=").

3  TOOL -> SAVE -> SHARE -> FIND AGAIN
   Tools -> "Loans and EMI" tile -> "Loan EMI" row -> [form pre-filled] -> Result
   Header: [Back] Title ........ [Save]      Under result: [copy][share][list][remind] (icons only)
   Save -> sheet (title pre-filled, tags, note, remind switch) -> Save
        -> header flips to "Update" + trash icon.  NO message. (by reading: SaveSheet.done has none)
   Later: Notes -> "Calculations" card -> row -> opens with saved numbers.
   ? Income tax opens with salary 15,00,000, 80C 1,50,000, 80D 25,000, home loan 2,00,000 already typed.
     A first-time user can read a real-looking tax answer for someone else's numbers.
   ? Numbers typed in a tool are kept only until the app closes (a Map in memory).

4  EXPENSE
   Budget -> [Add expense] -> sheet: Amount* (auto focus) | Date* | What is this (Spending/Card bill/Transfer)
        | Category pills (5 recent + More) | Paid with pills | (UPI: "Paid from" row -> picker) | Note | Add
   Without category: Amount -> Add.  Saved as Uncategorised, hint says so.
   UPI from RuPay: Paid with=UPI -> Paid from row -> picker -> pick card (or "+ Add credit card (RuPay)" -> form -> Add)
   Card bill: What is this = Card bill -> "Card being paid" pills -> Add. Not counted as spending (says so).
   ? Note autofills category and mode, but Note is the last field and autofill stops once you pick anything.
   ? Entry rows have a trash icon beside the edit area: one tap deletes (Undo for 8 seconds only).

5  CARD / ACCOUNT
   Budget -> "Categories and cards" -> scroll: Limits, ALL categories, then "Payment methods" -> Add a card
        -> sheet: Type* | Name* | Bank | Network | Last 4 | More details (variant, holder, statement day,
           due day, credit limit, fee, UPI id, notes)
   Outstanding = "Owes Rs X" in that list only.
   ? Statement day, due day, credit limit are asked, but NOTHING reads them yet (by reading: only stored).
   ? Owes starts at zero, so a card with an old balance shows a wrong figure.

6  TO-DO
   Notes -> [Notes | To-do] -> quick add field + "Add with a date, repeat or note" -> [Today|Upcoming|All]
   ? Quick add in Today = dated today (so it also shows in Due and gets a 9:00 reminder).
     Quick add in All or Upcoming = no date. Same typing, different result.
   Tick -> moves to Done, Undo snack.  Date: tap row -> sheet -> date -> Save -> see Upcoming and Due.

7  BACKUP / RESTORE / FORMAT
   Calculate -> hamburger -> Settings -> "Your data": Export | Restore  (Numbers section is higher up)
   Restore -> system file picker -> confirm card appears under "Your data" (may be off screen)
   ? Copy says "history and settings"; the code replaces cards, reminders, budget too. No safety copy first.
```

### A3. Recovering from mistakes

| Mistake | What the app does | Gap |
|---|---|---|
| Wrong key | Undo key, Backspace | none |
| Delete a history row | Snack "Undo" 8 s | Code comment says 6 s, screen says 8 s. Fine |
| Clear all history | Type CLEAR, then Undo snack | Locked and named rows are kept (good, but explained only inside the confirm text) |
| Delete a note, list or saved calculation | Trash 7 days, Undo, Restore | none |
| Delete a task | Sheet "Delete task", Trash | No confirm. Trash covers it |
| Delete an expense | One tap, Undo snack only | **No Trash.** One snack slot: a second delete replaces the first Undo (by reading) |
| Delete category or card | Confirm, "can't be undone" | Deleting a card unlinks past entries |
| Remove reminder | Inline "Yes, remove" | Third confirm style |
| Close a form with typing | Discard check on Expense, Limits, Card form | **None** on Save, Task, Remind sheets (listed as not done in `SESSION-STATE`) |
| Restore a backup | Confirm card | No undo, no safety copy of what is replaced |

---

## Evaluation (app level)

| Area | Finding | Mark |
|---|---|---|
| **Navigation** | 5 tabs is the Android maximum and fits. Back stack, re-tap resets and X on every sheet are consistent. But `setOverlay('settings')` exists only on Calculate, so Tools, Notes, Due and Budget have no path to Settings, Backup or History | Fix |
| **Duplicate entry points** | Manage (limits, categories, cards) opens from 6 places: Budget empty state x2, hero link, "Categories and cards" row, Summary, Settings. Tasks live in three places: Notes To-do, Due (if dated), Notes search. Reminders can be created in 4 places but **not on the Due tab** | Merge |
| **Naming** | "Notes" holds notes, lists, saved calculations and To-do. "Due" holds bills and dated tasks, but its button says "Mark paid". "Tools" is vague: the page says "calculators". "Budget" is really an expense log. "Categories and cards" also holds Limits. "Calc" is the app name and a tab is "Calculate" | Rename |
| **Empty states** | Good: each tab says what goes there and offers a button. Missing: nothing teaches `=` actions, History, cursor editing or the Tools tab | Add D |
| **Onboarding** | None (grep: no tour, welcome, coach mark). Permission is asked when the first reminder exists, which is fair, but it appears with no reason on screen | Add D |
| **Consistency** | Good: one `ScreenHeader`, one `Sheet`, tap-row chevrons. Mixed: native `select` in To list vs themed picker elsewhere; `*` vs "(optional)"; an open task is a sheet, an open list is a full page; 4 confirm styles; Save top-right on tools, bottom on sheets, inline on To-do | Fix |
| **Discoverability** | Cursor editing: only an aria label, no visible cue. Copy as: found by default (ask mode). History lock: 3 taps deep (History, more, Lock). Month-only limits: found only inside the limit sheet, but the Manage help text explains it well. Heatmap day tap: no cue found | Mixed |
| **Search** | Three separate boxes: Tools (calculators only), Notes/To-do, pickers. None on History, Due, Budget entries. **No global search** | Gap |
| **Shortcuts and defaults** | Good: expense note autofill, category pills by recent, "Opens on". Weak: Notes mode and To-do view reset on restart, tool inputs reset on restart, last paid-with and last list not remembered. `UX-GUIDELINES` promised "6 most-used tools self-promote": not built | Gap |
| **Error recovery** | Strong (A3). Weak spots: expense delete, restore, Save-sheet discard | Fix |
| **Cognitive load** | Heaviest: Add expense (7 groups), Card form (14 fields, 9 folded), Budget home (6 blocks), Notes top (2 switches, search, 2 links, tag chips before any content). Income tax shows 6 fields and 7 more under "More options" | Trim |
| **One-hand reach** | Good: tab bar, keypad, sheet footers. Hard: Save and Back (top), History and Settings (top-right), Month arrows (top), "New list" and "Trash" (small top links) | Fix |

---

## B. Top 12 improvements, ranked (impact over effort)

Effort: S = under half a day, M = about a day. All **unproven** until tried on the phone; B1 to B5 are fixes of things the code already gets wrong.

| # | Change (exact) | Files | Effort | Why (evidence) |
|---|---|---|---|---|
| 1 | **Fix Restore wording and add a safety step.** Replace "history and settings" with counts of calculations, notes, reminders, expenses. Show it in a `Sheet` with footer, not a card under the list. Before replacing, call `buildBackup(snapshot())` and offer "Save current data first" | `SettingsScreen.tsx` (lines 235-256), `backup.ts` | S | `restore()` replaces `cards`, `reminders`, `budget`; text names only history. Data-loss trust |
| 2 | **Gear icon on every tab header** that opens Settings. Swap the hamburger for a gear. Give Tools a slim header. Keep History on Calculate | `App.tsx`, `CalculatorScreen.tsx`, each tab screen | S | Settings opens from one place only (grep). Backup is 4 taps from Calculate, impossible from elsewhere |
| 3 | **Say "Saved" and put Save where the thumb is.** After `SaveSheet.done` show snack "Saved to Notes. View". Add Save as the first icon in `KeepAndShare` (keep the header link too) | `SaveSheet.tsx`, `KeepAndShare.tsx`, `ToolScreen.tsx` | S | No feedback today; `UX-AUDIT` section 2 already lists it |
| 4 | **Mark example numbers.** Income tax and similar pre-filled tools show a line "Example numbers. Change them to yours." until a field is edited. Empty the 80C, 80D, home-loan and professional-tax defaults | `tax.ts`, `ToolScreen.tsx` | S | `income-tax` fields carry values like 1,50,000. `CLAUDE.md`: a confidently wrong tax figure is not recoverable |
| 5 | **Add a "+" on the Due tab** that opens `TaskSheet` with a date. For tasks, show "Done" instead of "Mark paid". Hide the "Due in the next 30 days" total when it is zero | `DueScreen.tsx` | S | Due cannot create anything; empty state sends you to Notes |
| 6 | **Reorder Add expense**: Amount, Note, Date, then pills. Remember last "Paid with" and source. Add "Add another" beside "Add expense" | `sheets.tsx` | S | `changeNote` autofill stops after any pick (`picked`), and Note is last |
| 7 | **Recents on Tools home** (last 4 opened) and keep each tool's last inputs across restarts | `ToolsScreen.tsx`, `ToolScreen.tsx` (`drafts` Map), `persistence.ts` | M | `drafts` is memory only. 3 taps to open a tool. Needs a schema change: **unproven**, check data size |
| 8 | **First-run tip and better chips** (plan in D) | `CalculatorScreen.tsx`, `ResultActions.tsx` | M | No onboarding exists |
| 9 | **Reminder from Calculate**: title = the expression, date shown, "Name it" chip | `ResultActions.tsx`, `SaveSheet.tsx` | S | Title "Reminder", date +30 days silently |
| 10 | **Cards on Budget home**: row "Cards owe Rs X". Add "Already owed" opening balance to the card form. Hide statement, due day and limit until a screen uses them (or add the bill reminder) | `BudgetScreen.tsx`, `InstrumentForm.tsx`, `budget.ts` | M | `cardOutstanding` counts only entries here; three fields are stored and never read |
| 11 | **Split "Categories and cards" into three segments**: Limits, Categories, Cards. Add a month switch in its header so Settings can set next month | `ManageScreen.tsx`, `limits.tsx` | M | Cards are below every category; Settings route fixes month to today |
| 12 | **Search in History, Budget entries and Due**, then one shared search later | `HistorySheet.tsx`, `SpendSummary.tsx`, `DueScreen.tsx` | M | Only Tools and Notes search today. Global search is **unproven**: do the three local ones first |

Also small: one confirm style (E); one picker for the To list dropdown; a distinct delete target on entry rows (move trash into the edit sheet, since Undo is only 8 s).

---

## C. Proposed information architecture

```
CALC (5 tabs, same bar)                      gear (Settings, Backup) in every header
 |
 +-- Calculate ---- keypad, History (top), Scientific (link in the display bar, not only in Tools)
 |
 +-- Calculators   (was Tools) ---- Recent | Search | 8 groups | Scientific
 |
 +-- Notes ---- [Notes | To-do]      Notes = notes, lists, saved calculations
 |                                   To-do = Today, Upcoming, All
 +-- Due ---- anything with a date   (bills, reminders, dated tasks)   [+ add]
 |
 +-- Money (was Budget) ---- This month | Spending | Cards | Limits and categories
```

| Change | Why | Cost |
|---|---|---|
| Rename **Tools to Calculators** | The search box and tiles already say "calculators" | S |
| Rename **Budget to Money** or **Spends** (owner's choice) | It logs spending and cards. A budget is only the limits | S, needs a decision |
| Keep **Due**, but write "Bills and dates" under the title | Indian users read "due" as bills | S |
| Keep **Notes** as is, but name the section "Calculations" to "Saved calculations" | Matches what people say | S |
| **Merge** the six entry points to Manage into one row "Limits, categories, cards" | Fewer paths | M |
| **Do not** merge Notes and Due | A date is the only link, and Due works as a plain list. Merging adds a mode | none |
| Move **Backup and Restore** into a Settings section called "Back up", above Numbers | It is the data-safety feature | S |

---

## D. First run and empty states

```
FIRST OPEN                                  EVERY TAB EMPTY
 Calculate + one tip card                     [one line: what goes here]
   "After = you can add the answer             [one real example]
    to a list or set a reminder.               [one button]
    Tools has 51 calculators.  [Got it]"
        |
        +--> gone for good once dismissed (store a flag in settings)
```

| Where | Now | Add |
|---|---|---|
| Calculate | Nothing | The tip card above. Show the chips greyed before `=` with "after =" in the label, so they can be found |
| Tools | No hint | "Recent" empty line: "Calculators you open show up here" |
| Notes | Good text and a button | Add example title "Trip split" under the button |
| To-do | "Write what needs doing in the box above" | Add "Add a date and it also shows in Due" (already stated), plus focus the box |
| Due | Text and "Open notes" | Replace the button with "Add a reminder" (B5) |
| Budget | Text and three links | Pick one primary: "Add your first expense". Show "Set a limit" only after expense 3 |
| Cards | "No cards or accounts yet" | "Add a card to see what it owes" |
| History | Good | Add "Tap a row, then the three dots: lock, name, share" once the first row exists |
| Reminders permission | Pops up on Save | Show one line first: "Allow notifications so reminders can reach you" |

**Rules:** one tip at a time, never over the keypad (`UX-GUIDELINES` principle 1), dismissible, never returns. Do **not** build a tour or video: unproven that it helps a one-owner app.

---

## E. Checklist for every new screen

| # | Ask | Pass means |
|---|---|---|
| 1 | Where is it in the tab map? | One home. Other entry points are shortcuts that open the same screen |
| 2 | How many taps from the tab bar? | 2 or fewer for a common job, 3 for a rare one |
| 3 | What does it show when empty? | What goes here, one example, one button |
| 4 | What is the first thing a stranger does? | Visible without a hint. If not, add a cue (chevron, label, underline) |
| 5 | Is the main action reachable by thumb? | In the footer or bottom row, not top-right |
| 6 | Does the screen remember the last choice? | Last list, mode, tab, tool inputs survive a restart where it makes sense |
| 7 | What happens on a mistake? | Undo snack, Trash, or a discard check. Never silent loss |
| 8 | Which confirm style? | Same inline card as Empty Trash, buttons "Keep it" and the action name |
| 9 | Does Save say it saved? | Snack with a "View" link |
| 10 | Do the words match what a person says? | Same noun in the tab, title, button and empty state |
| 11 | How many control rows before content? | 3 or fewer. More goes behind a sheet or "More" |
| 12 | Is a default pre-filled with someone else's data? | Mark it "Example" or leave it empty |
| 13 | Does a field ask for something nothing reads? | Remove it or ship the feature that uses it |
| 14 | Is there a search if the list can pass 20 rows? | Yes, in the same place as other lists |
| 15 | Can it be done with one hand on a 360 px phone? | Check reach map: top corners are for reading, not for the main action |
| 16 | Is it checked at 200% font and in the browser? | Run `e2e/smoke.mjs` (stale, repair first) and look at the screenshots |

---

## Could not verify without running the app (by reading only)

- All tap counts, the real position of the Restore confirm card on a small screen, and whether the Android permission pop-up
  arrives mid-Save.
- Whether the cursor-edit and heatmap cues are visible enough (no visual cue found in code, styles not judged).
- The phone: nothing has run on it since the UI revamp (`CLAUDE.md`, known issues).

## Summary

1. **Safety is good, discovery is weak.** Undo, Trash and discard checks cover most mistakes; the gaps are expense delete, Restore and three sheets.
2. **Settings and backup are reachable from one tab only.** A gear in every header fixes it (B2).
3. **Restore text is wrong** and hides that notes, reminders and budget are replaced (B1). Fix first.
4. **No first-run help and no memory across restarts**: tool inputs, Notes mode and last list all reset (B7, B8, D).
5. **Add expense is fine to use but ordered badly**; card "Owes" has no opening balance and three card fields are unused (B6, B10).
6. **Keep five tabs**; rename Tools to Calculators, decide on Budget's name, and do not merge Notes and Due (C). Feature ideas stay **unproven** until a critic and the phone check them.
