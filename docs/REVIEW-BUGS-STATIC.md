# Static bug review (code reading plus throwaway probes)

Date: 2026-11-02. Scope: `src/lib/budget.ts`, `src/store/*`, `src/features/{budget,memory,calculator}/*`,
`src/lib/{format,clipboard,notifications}.ts`, `src/features/tools/ToolScreen.tsx`. Nothing in `src/` was changed.

**How to read this.** "Confirmed by probe" means I wrote a small throwaway test, ran it, and saw the wrong result.
"By reading" means the code says so but I did not run it. The probes lived in a temp folder and are not in the repo.
Line numbers are from the files as they stood during the review. `src/store/app.ts` was being edited by someone
else at the same time, so its numbers may be off by a few lines.

**Severity.** High = data loss or wrong money in a core flow. Medium = wrong behaviour. Low = polish.

**Verdict: 6 High, 12 Medium, 9 Low.** The money maths itself (exact decimals, month and 29 Feb handling) is sound.
The serious problems are in what surrounds it: saving, loading, undo, backup, and card links.

---

## Index

| ID | Sev | One line |
|---|---|---|
| B-01 | High | A failed or damaged load is overwritten with an empty app |
| B-02 | High | Categories past 60 (deleted ones count) are dropped at the next start |
| B-03 | High | A backup the app wrote near its own size limit cannot be restored |
| B-04 | High | Editing any field of a credit card detaches all its bill payments |
| B-05 | High | Undo can restore a different, older item |
| B-06 | High | A comma typed as a decimal point multiplies the amount by 10 or 100 |
| B-07 | Med | Second delete in a row: the first can never come back |
| B-08 | Med | Changing a card's network unlinks its UPI entries; deleting a card unlinks everything |
| B-09 | Med | Delete category, delete card, remove list line: no undo (breaks the project rule) |
| B-10 | Med | Due total and notification text show any reminder amount as rupees |
| B-11 | Med | "Snooze 1 day" on a heads-up moves the due date, and shifts the time of day |
| B-12 | Med | Re-dating a finished task re-opens its reminder and notification |
| B-13 | Med | A repeating reminder alerts once, then goes silent |
| B-14 | Med | List line "Refund −500" (real minus sign) is saved as +500 |
| B-15 | Med | Capital gains: a negative "exemption already used" lowers the tax |
| B-16 | Med | One damaged saved value turns the whole app white on every start |
| B-17 | Med | A failed save gives no sign at all |
| B-18 | Med | Reminder date box: empty does nothing, no limits on the year |
| B-19 | Low | 200 named or locked history rows make new calculations vanish |
| B-20 | Low | Paste glues onto typed digits; a pasted date becomes a division |
| B-21 | Low | Held Backspace can keep running after the screen is gone |
| B-22 | Low | Tapping another payment mode silently drops the chosen card |
| B-23 | Low | Money box deletes minus signs and `e`; tools accept `0x10` |
| B-24 | Low | A tiny result says "Too large to show" |
| B-25 | Low | Backup file name uses the UTC date |
| B-26 | Low | Accessibility: focus after a sheet closes, list roles, future heatmap days |
| B-27 | Low | Deleted entries never leave the 20,000 cap |

---

## High

### B-01 A failed or damaged load is overwritten with an empty app
- **Where:** `src/store/persistence.ts:376-384` (`loadPersisted`), `src/store/boot.ts:42-45`.
- **What happens:** If reading storage throws, or the saved text is cut off (bad JSON), the app starts empty.
  Then `boot.ts` saves on every "app hidden" event, even if the user changed nothing. The empty data replaces the real data.
  No copy of the old text is kept.
- **Repro (confirmed by probe):** Storage holding one expense "keep me", with `get` throwing once. Boot, then `flush()`
  (what the hide event does). The stored text no longer contains "keep me". Same result for a truncated JSON string.
- **Fix:** In `loadPersisted`'s catch, first copy the raw text to a second key (`vkcalc.data.bad`). Return a
  `failed` flag, and in `boot.ts` do not write until the user has changed something.

### B-02 Categories past 60 (deleted ones count) are dropped at the next start
- **Where:** `src/store/persistence.ts:258` (`if (found.length >= MAX_CATEGORIES) break`). Same pattern at `:188`
  (cards, trash counts) and `:300` (instruments, 200 total).
- **What happens:** Adding a category only checks the live count (limit 60). Deleting only marks a category deleted, it
  never leaves the list. Loading stops after 60 of any kind. So after enough add and delete cycles, the newest
  categories are cut off. Their entries turn Uncategorised, and the limits are gone.
- **Repro (confirmed by probe):** 40 add-then-delete cycles, then 40 live adds, plus an entry in the last one.
  Stored: 90 categories (50 live). After reload: 60. The entry's category is `null`.
- **Fix:** Count only live categories in `sanitizeBudget` (and live cards, live instruments). Keep a large hard cap on the
  total (say 500) so a damaged file cannot grow without limit.

### B-03 A backup the app wrote near its own size limit cannot be restored
- **Where:** `src/store/backup.ts:5` (5 MB cap), `:16-17` (pretty-printed with `null, 2`), `:28`.
- **What happens:** The file is pretty-printed, which adds about 50%. The restore check rejects anything over 5 MB.
  The app allows 20,000 entries. The backup button works. The restore button then says "too large to be a Calc backup".
- **Repro (confirmed by probe):** 20,000 entries gave a 5.78 MB backup, and `parseBackup` returned "too large".
  Backups start failing at about 17,000 entries. Compact JSON of the same data is 3.6 MB.
- **Fix:** Use `JSON.stringify(x)` with no indent, and raise `MAX_BACKUP_BYTES` to 25 MB.

### B-04 Editing any field of a credit card detaches all its bill payments
- **Where:** `src/store/app.ts:689` (`updateInstrument`).
- **What happens:** After every edit it clears `instrumentId` on entries where `x.mode === null || !fits`. A card-bill
  payment has no mode by design, so it always matches. Renaming a card, or changing its statement day, makes the card
  "owe" the bills again.
- **Repro (confirmed by probe):** Card charged 5,000, bill paid 2,000: "Owes 3,000". Change only the holder name: "Owes 5,000".
  The settlement entry now has `instrumentId: null`.
- **Fix:** Skip settlements: `x.instrumentId === id && !x.settlement && (...)`.

### B-05 Undo can restore a different, older item
- **Where:** `src/store/app.ts` `deleteExpense` (~550), `deleteHistory`, `clearHistory`, `deleteCard` (~815),
  `undoRemoval` (~708-735), `dismissSnack` (~922). There are three separate "what to undo" variables
  (`removedExpenseId`, `removedCardId`, `removed`) and they do not clear each other.
- **What happens:** Delete an expense. Let the snackbar fade. Later delete a history row. The snackbar says "Removed from
  history". Tap Undo: the old expense comes back and the history row stays deleted. Same if a card is deleted
  after an expense: Undo restores the expense, not the card. The expense total changes without the user asking.
- **Repro (confirmed by probe):** Delete expense, dismiss snack, delete a history row, undo. History stays at 0, the
  expense `deletedAt` goes back to `null`. A second probe (expense then card, undo) left the card in Trash.
- **Fix:** Keep one `lastRemoval: { kind, ... } | null`. Every delete sets it (replacing the old one), and
  `dismissSnack` and `restore` clear it.

### B-06 A comma typed as a decimal point multiplies the amount by 10 or 100
- **Where:** `src/features/budget/formKit.tsx:5` (`cleanMoney`), `src/lib/budget.ts:199` (`moneyProblem`),
  `src/lib/tool.ts:112` (`parseNum`), `src/lib/tape.ts:15`. All of them delete commas.
- **What happens:** On a phone keyboard set to a comma-decimal language, "99,5" becomes 995 and "1,5" becomes 15. The entry
  saves with no warning. A pasted "1.234,56" becomes 1.23456.
- **Repro (confirmed by probe):** `validateAmount('99,5')` returns no error. `addExpense({amount:'99,5'})` saves `"995"`.
  Tape: "Rent 1,5" saves 15; "Cab 12,50" saves 1250.
- **Fix:** A comma followed by one or two digits at the very end can never be Indian or western grouping (the last
  group is 3 digits). Treat that case as a decimal point, in one shared helper used by all four places.

---

## Medium

### B-07 Second delete in a row: the first can never come back
- **Where:** `src/store/app.ts` `deleteExpense` (~550), `addExpense` cap (~531).
- **What happens:** One undo slot. Deleting B overwrites A's slot. A stays "deleted" forever: hidden everywhere,
  not purged, and still counted in the 20,000 cap. (History rows and cards have the same one-slot rule.)
- **Repro (confirmed by probe):** Delete two entries, tap Undo: only the second returns. `deletedAt` is `[set, null]`.
- **Fix:** Keep a short list of recent removals (last 5) and let Undo pop the newest. Optionally purge deleted
  expenses older than 30 days at start.

### B-08 Changing a card's network unlinks its UPI entries; deleting a card unlinks everything
- **Where:** `src/store/app.ts:689` and `deleteInstrument` (~703). UI: `InstrumentForm.tsx`, no warning.
- **What happens:** A RuPay credit card used for UPI is edited to another network, or to no network: every UPI entry
  silently loses the card. "Owes" for that card falls. Deleting a card nulls the card on every entry and on its bill payments.
- **Repro (confirmed by probe):** RuPay card, UPI entry 700: owes 700. Change network to Visa: owes 0, entry `instrumentId: null`.
  Delete a card with a bill payment: the settlement keeps no card.
- **Fix:** Before saving, count the entries that would lose the card and ask ("12 entries will lose this card"). Better:
  keep the old `instrumentId` on the entry and let the display say "(removed)".

### B-09 Delete category, delete card, remove list line: no undo
- **Where:** `CategoryEditSheet.tsx` (Confirm says "This can't be undone"), `InstrumentForm.tsx` (same),
  `TapeScreen.tsx:129` (remove a line, no question), `DueScreen.tsx` Remove (asks, no undo).
- **What happens:** `CLAUDE.md` says "Every delete is undoable". These four are not. A deleted category keeps its entries, but if
  the user re-creates "Food" it gets a new id, so old entries stay Uncategorised.
- **Repro (by reading):** Delete category "Food" with 30 entries. Add "Food" again. The 30 entries are not in it.
- **Fix:** Use the same snackbar-undo as expenses (the one-list fix in B-05/B-07 covers it). For categories, restore by
  clearing `deletedAt`. For tape lines, put the line back at its index.

### B-10 Due total and notification text show any reminder amount as rupees
- **Where:** `src/lib/reminders.ts:61` (`dueSoonTotal`), `src/lib/notifications.ts:40`.
- **What happens:** A reminder can be put on any calculator result (a percentage, a BMI, a day count). The Due row formats it
  correctly using `amountFmt`. But "Due in the next 30 days" adds it up as money, and the notification body prefixes "₹".
- **Repro (confirmed by probe):** Card with `amountFmt: 'number'`, amount 24.5, due tomorrow: total shows 24.5 (as ₹). Notification
  body "₹24.5 · due today".
- **Fix:** Sum only cards where `(c.amountFmt ?? 'money') === 'money'`, and format the notification with the same
  `formatCell(amount, amountFmt)` the Due row uses.

### B-11 "Snooze 1 day" on a heads-up moves the due date, and shifts the time of day
- **Where:** `src/store/app.ts` `snooze` (~840), used by `App.tsx` notification action and `DueScreen.tsx`.
- **What happens:** The notification arrives `leadDays` early with a Snooze button. Snooze changes `dueAt` itself, so
  the real due date moves a day. For an overdue reminder, the new time is now plus 24 hours, not 9:00, and a monthly
  reminder then keeps that odd time every month.
- **Repro (confirmed by probe):** Rent due 5 Nov 09:00, lead 3 days. Snooze at the 2 Nov heads-up: due is now 6 Nov. Overdue
  rent snoozed at 14:37, then Mark paid: next due is 5 Dec 14:37.
- **Fix:** Keep a separate `snoozedUntil` for the alert, and leave `dueAt` alone. At least reset the hour to 9:00.

### B-12 Re-dating a finished task re-opens its reminder and notification
- **Where:** `src/features/memory/TaskSheet.tsx:52`, `src/store/app.ts` `setReminder` (sets `done: false`).
- **What happens:** Editing a done task and changing its date creates a fresh open reminder. The card is still `done`, so
  the To-do list keeps it under Done, but the Due tab lists it and a notification is scheduled.
- **Repro (confirmed by probe):** Tick a task done, then `updateCard` with a new date: `rem.done false`, `card.done true`,
  one notification planned.
- **Fix:** In `planNotifications` and `groupReminders`, skip reminders whose card `isTaskDone`; or in the sheet, un-tick the task
  when the date changes.

### B-13 A repeating reminder alerts once, then goes silent
- **Where:** `src/lib/notifications.ts:31-36` (`planNotifications` skips `dueAt <= now`).
- **What happens:** Only the next due date is scheduled. After it passes, nothing moves it forward until the user opens the
  app and taps Mark paid. A monthly rent reminder that was ignored once never alerts again.
- **Repro (by reading):** Monthly reminder, never marked paid: one notification, then none the next month.
- **Fix:** When planning, roll a repeating reminder's date forward (`nextOccurrence`) for the alert only, or schedule the
  next 3 occurrences.

### B-14 List line "Refund −500" (real minus sign) is saved as +500
- **Where:** `src/lib/tape.ts:13`.
- **What happens:** The pattern only knows the plain `-`. The `−` (U+2212, which the app itself shows and copies) ends up in the label.
- **Repro (confirmed by probe):** `parseTapeLine('Refund −500')` gives label `Refund −`, value `500`.
- **Fix:** First line of the function: `text = text.replace(/[−–]/g, '-')`.

### B-15 Capital gains: a negative "exemption already used" lowers the tax
- **Where:** `src/engine/tax/capitalGains.ts:117`, field at `src/features/tools/tax.ts:241`.
- **What happens:** `left = max(0, 125000 − used)`. A negative `used` makes the exemption bigger than the law allows.
- **Repro (confirmed by probe):** Used = −100000: tax with cess falls from ₹22,750 to ₹9,750. No error.
- **Fix:** Reject or clamp negative `used` to 0. (`CLAUDE.md`: a wrongly confident tax figure is not recoverable.)

### B-16 One damaged saved value turns the whole app white on every start
- **Where:** `src/store/persistence.ts:121` (`sanitizeInput`), `src/features/calculator/displayLogic.ts:47`, `src/main.tsx` (no error boundary).
- **What happens:** `sanitizeInput` keeps `fresh: true` for any expression that matches the raw pattern, such as `sin(`.
  `computeDisplay` then runs `new D('sin(')`, which throws while drawing. With no error boundary the app is blank,
  and the bad value is loaded again on the next start. A hand-edited or partly restored backup can do this.
- **Repro (confirmed by probe):** `sanitizeInput({expr:'sin(', fresh:true})` returns it unchanged. `new D('sin(')` throws.
- **Fix:** In `sanitizeInput`, set `fresh` only when `isPlainNumber(expr)`. Add a small error boundary around `<App/>` with a "Reset the calculator line" button.

### B-17 A failed save gives no sign at all
- **Where:** `src/store/persistence.ts:389` (`catch {}`), `src/lib/storage.ts:54-61` (web fallback to memory).
- **What happens:** Storage full or refused: the app goes on, shows nothing, and the data is gone on the next start. (On
  the web build, the fallback keeps the data only in memory.)
- **Repro (by reading):** `storage.set` throws: nothing is shown, no retry.
- **Fix:** Have `savePersisted` return `false`; `boot.ts` shows one notice ("Couldn't save. Make a backup now") and retries on the next change.

### B-18 Reminder date box: empty does nothing, no limits on the year
- **Where:** `src/features/memory/SaveSheet.tsx:70` (`if (remind !== 'off' && dueAt === null) return`), `fromDateInput`.
- **What happens:** If the date is cleared and the user taps Save, nothing happens and nothing is said. Years are not limited (the task
  sheet checks 2000 to +5 years, this one does not). A year like 0026 or 20266 is accepted. One out-of-range alarm can make the whole
  `LocalNotifications.schedule` call fail, and every other reminder with it (that part is unproven).
- **Fix:** Reuse `validateTask`'s date rules; show "Pick a date" under the box.

---

## Low

### B-19 200 named or locked history rows make new calculations vanish
- `src/store/persistence.ts:95-100` (`capHistory`), used at `src/store/app.ts:394`. Named and locked rows are never evicted, and
  naming has no limit (only locking: 100). With 200 kept rows, a new "=" result is dropped the moment it is added.
- **Repro (confirmed by probe):** 200 named rows plus one new row: the new row is not in the result.
- **Fix:** Cap named rows too (for example 150), or let the cap evict the oldest kept row as a last resort.
### B-20 Paste glues onto typed digits; a pasted date becomes a division
- `src/store/app.ts:456` (`insertExpression`), `src/lib/clipboard.ts` (`parseLine`).
- **Repro (confirmed by probe):** Type 12, paste "500": the input is `12500`. Pasting "12/05/2026" gives the raw expression `12/05/2026`.
- **Fix:** If the input ends in a digit and the pasted text starts with a digit, ask or insert `+`. Refuse text that looks like a date.
### B-21 Held Backspace can keep running after the screen is gone
- `src/features/calculator/Keypad.tsx:87-101` (`useRepeatingPress`). The repeat timer stops only on pointer up, leave, cancel. If a second
  finger changes the tab while Backspace is held, the button disappears and the interval keeps pressing "backspace" every 70 ms.
- **By reading.** **Fix:** add `useEffect(() => stop, [])` cleanup.
### B-22 Tapping another payment mode silently drops the chosen card
- `src/features/budget/sheets.tsx:148-152` (`chooseMode`). Credit to UPI, or tapping the selected mode off, clears the card with no message.
  Tap back and the card is gone. **By reading.** **Fix:** keep the old card in a ref and restore it if the mode returns.
### B-23 Money box deletes minus signs and `e`; tools accept `0x10`
- `formKit.tsx:5`: a pasted "−500" or "-500" becomes 500 (the refund sign is lost); "1e5" becomes 15.
  `lib/tool.ts:112`: `new D('0x10')` is accepted as 16 and "1e5" as 100000, in every calculator.
- **Repro (confirmed by probe):** `cleanMoney('1e5')` returns `15`. Tool fuzz: RD years `0x10` computed with 16.
- **Fix:** In `cleanMoney`, if the text has a minus, leave it so validation says "above zero". In `parseNum`, require `/^-?[\d.]+$/` after cleaning.
### B-24 A tiny result says "Too large to show"
- Engine message for an underflow. `1/10^130 =` gives "Too large to show". **Confirmed by probe.** **Fix:** a separate "Too small to show".
### B-25 Backup file name uses the UTC date
- `src/store/backup.ts:22` uses `toISOString()`. Between midnight and 5:30 am in India, the file name carries yesterday's date, and two
  backups on one day can have two names. **By reading.** **Fix:** use local `dayKey(now)`.
### B-26 Accessibility
- **Focus after a sheet closes:** `components/Sheet.tsx:45` restores focus only if the opener still has it, but `App.tsx` blurs every button
  after a touch. A TalkBack user loses their place after every sheet. Swapped-in views (`PickView`, `InstrumentForm`) also lose
  the opener. **By reading.** **Fix:** save the opener at tap time (store the element in a ref on click).
- **List roles:** `pick.tsx:83` and `FilterSheet.tsx:65` put `div` wrappers and `h3` headings inside `role="listbox"`. Screen readers
  may announce wrong counts. **Fix:** use `role="group"` per section, or `role="presentation"` on the wrappers.
- **Heatmap:** future days (`Heatmap.tsx:37`) are bare numbers with no label, and future-dated entries (allowed up to one year ahead)
  are not counted in the grid, so the grid can disagree with the month total.
### B-27 Deleted entries never leave the 20,000 cap
- `src/store/app.ts:531`. The cap counts soft-deleted entries and nothing ever purges them. A user near the cap cannot free room
  by deleting. **By reading.** **Fix:** purge entries deleted more than 30 days ago in `createAppStore`, like Trash does for cards.
---

## Checked, and found fine

| Area | What I ran | Result |
|---|---|---|
| Month ends | Monthly from 31 Jan, quarterly from 30 Nov, yearly from 29 Feb 2028, December to January | Correct (28 Feb, then back to 31 or 29 as anchored) |
| `validateDate` | 29 Feb in 2027 and 2028, one-year-ahead rule | Correct |
| Heatmap grid | Monday-first rows for Nov 2026, weekday names | Correct |
| Calculator state machine | 24,000 random key, cursor, undo, paste, memory and reuse steps | No throw, cursor always in range, `caretMap` always the right length |
| Tools (all 51) | 10 odd inputs in every number field (huge, negative, `abc`, `1e400`) | No `NaN` or `Infinity` shown; a spec that throws is caught by `ToolScreen`. Only B-15 gave a wrong answer |
| Speed, 20,000 entries | Whole Spending Summary computations in one render | 8 to 20 ms on this laptop; load check 26 ms; save text 4.5 ms. No problem found (a phone may be 5 to 10 times slower: still fine) |
| Layering and design rules | `src/architecture.test.ts` (184 checks) and a search for upward imports | Pass; none found |
| Android reboot | Plugin manifest | Has the boot receiver, exact-alarm and notification permissions |
| Time zones | All dates use local time, except B-25 | Consistent |

**Note, not a bug:** `CLAUDE.md` "Known issues" says the calculator logs every expression to localStorage. The code
(`src/lib/logger.ts`) writes to the console only and is silent in a release build. The sentence is out of date.

---

## Summary (6 lines)

1. 27 problems: 6 High, 12 Medium, 9 Low. The calculator and the maths are solid; the data-keeping layer is where the real risk is.
2. Three ways to silently lose or misread data: a failed load overwrites it (B-01), the 60-item cap drops categories (B-02), a big backup cannot be restored (B-03).
3. Undo is a single shared slot and can restore the wrong thing (B-05, B-07), and three delete flows have no undo at all (B-09).
4. Card links break quietly: any edit unlinks bill payments (B-04), a network change unlinks UPI entries (B-08).
5. Typed money is fragile: comma decimals, a real minus sign, and a negative tax exemption all give wrong figures with no warning (B-06, B-14, B-15).
6. Performance, layering, month and leap-year handling, and the calculator state machine are fine.

## The 5 to fix first

| # | Bug | Why first | Size of fix |
|---|---|---|---|
| 1 | B-01 load failure overwrites data | Can erase everything; worst case of all | About 10 lines |
| 2 | B-02 categories dropped past 60 | Silent, grows with normal use | 1 line plus a hard cap |
| 3 | B-03 backup cannot be restored | The safety net fails when needed | 2 lines |
| 4 | B-04 card edit detaches bill payments | Wrong "Owes" after a harmless edit | 1 condition |
| 5 | B-05 undo restores the wrong item | Brings deleted money back by surprise | One `lastRemoval` variable |

Next: B-06, B-14, B-15 (money), B-10 (wrong "₹" on non-money reminders).

---

## Status 2026-11-03

Checked against the current code. "Fixed" bugs each have a regression test. Not run on a phone.

| ID | Status | Evidence |
|---|---|---|
| B-01 | **Fixed today** | `loadChecked` copies a damaged file to `vkcalc.data.bad`; `boot.ts` never writes after an unreadable load, and after a damaged one only once something changed. `src/store/dataSafety.test.ts` |
| B-02 | **Fixed today** | `sanitizeBudget`, `sanitizeCards` count only live items; hard stop at 480 categories, 480 instruments, 2x cards. `dataSafety.test.ts` |
| B-03 | **Fixed today** | Backup is compact JSON, restore cap is 25 MB; 20,000-entry backup restores. `dataSafety.test.ts` |
| B-04 | Fixed earlier | `updateInstrument` skips `x.settlement` (comment in `app.ts`) |
| B-05 | **Fixed today** | One undo slot (`taskUndo`, tied to its snackbar id) used by every delete; the three old variables and `removed` are gone. `src/store/removal.test.ts` |
| B-06 | **Fixed today (partly)** | New `src/lib/decimalComma.ts` used by the Budget amount box, `validateAmount`, optional money, `parseNum`, list lines. **Not** the calculator number boxes: they show grouped digits while typing, so "1,50" after a deleted digit cannot be told from a decimal comma. `decimalComma.test.ts`, `formKit.test.ts` |
| B-07 | Still open | A second delete in a row still replaces the first one's Undo. The entry stays hidden until the new 30-day purge (B-27). |
| B-08 | Still open | `updateInstrument` / `deleteInstrument` still clear the card from entries, with no warning |
| B-09 | Still open | Category and card delete sheets still say "This can't be undone" |
| B-10 | **Fixed today** | `dueSoonTotal` adds money cards only; `planNotifications` formats with the card's own format. `reminders.test.ts`, `notifications.test.ts` |
| B-11 | Still open | `snooze` still moves `dueAt` (reminders are another helper's area) |
| B-12 | Still open | `planNotifications` still has no done-task check |
| B-13 | Still open | `planNotifications` still skips `dueAt <= now` |
| B-14 | **Fixed today** | `parseTapeLine` turns U+2212 and the en dash into minus. `decimalComma.test.ts` |
| B-15 | **Fixed today** | Negative "exemption already used" returns "Amounts cannot be negative". `other.test.ts` |
| B-16 | Fixed earlier | `sanitizeInput` sets `fresh` only for a plain number |
| B-17 | Still open | `savePersisted` still swallows the error |
| B-18 | Still open | `SaveSheet.tsx:70` still returns silently on an empty date |
| B-19 | Fixed earlier | `capHistory` reserves the newest row's slot (CALC-254) |
| B-20 | Still open | `insertExpression` still glues pasted digits |
| B-21 | **Fixed today** | `useRepeatingPress` stops its timers on unmount |
| B-22 | Still open | `chooseMode` still clears the card |
| B-23 | Partly | A typed minus now shows a hint (today). Pasted U+2212 gives no hint; "1e5" and `0x10` still accepted |
| B-24 | Still open | The engine still says "Too large to show" for an underflow |
| B-25 | Fixed earlier | `backupFilename` uses local time, with a test |
| B-26 | Still open | Focus restore, listbox roles and future heatmap days unchanged |
| B-27 | **Fixed today** | Entries deleted over 30 days ago are dropped when the store starts. `removal.test.ts` |

**Not reproducible:** none. **Still open:** B-07, B-08, B-09, B-11, B-12, B-13, B-17, B-18, B-20, B-22, B-24, B-26 (none loses data silently except B-07, B-17).
