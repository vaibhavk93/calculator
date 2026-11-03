# What Notes, Due and Budget can do today, and what is missing

Reassessed 2026-11-03 after Phases 1 to 3. "Present" is built and in the repo (browser-tested; phone use noted in `FEATURES.md`). "Absent" items that are not already on the roadmap were added to `MASTER-ROADMAP.md` Phase 6 and marked **new** there. Phone-proven status is separate: see `FEATURES.md`.

## Notes (saved calculations, lists, To-do)
| Present | Absent |
|---|---|
| Save any calculator result with its inputs; reopen and update | A plain text note (Notes holds calculations and lists only) **new** |
| Lists ("tapes") with lines, totals, copy as text, inline rename | Share a note or list through the share sheet (only Copy) **new** |
| Three-state lines: Pending / Paid / Skipped (skipped is out of totals) | Search inside list lines **new** |
| Paste several lines, turn them into a checklist | Export all notes and lists as text/CSV **new** |
| Tags, pin, search, newest first, Trash for 7 days with confirm to empty | Add an expense from a list total (To list has no reverse) **new** |
| To-do: Today / Upcoming / All, quick add, tick with undo, task sheet | To-do priority, steps, links, quick-add parser ("pay rent fri !"), tag filter, sort options (planned, not built) |
| Repeats, including "N days after I tick it"; several heads-up times | Attach a photo of a bill (needs a permission, held back on purpose) |
| Backup and restore of everything; first-run tour | Folders, archive, version history, lock (tags and pin cover folders; lock waits on app lock) |

## Due (reminders)
| Present | Absent |
|---|---|
| Reminders once, monthly, quarterly, yearly, or after ticking | Calendar/month view (only Overdue / This week / Later) **new** |
| Mark paid, Snooze 1 day (also on the notification) | More snooze choices: 1 hour, tonight, tomorrow, next week **new** |
| Several heads-up times (on the day, 1, 3, 7, 14, 30 days) | Skip this occurrence without marking paid **new** |
| Time of day setting; test reminder; reliability guide per phone brand; "may not have shown" notice | Repeat end date or count ("EMI for 24 months") and a paid history per bill **new** |
| Advance-tax pack (4 dates) | Other packs: insurance/LIC, vehicle PUC and insurance, passport/licence expiry **new**; ITR/GST dates wait on primary sources |
| Bills and subscriptions from Budget share one record with Due | Reminder created from a bank SMS ("Total due, pay by 25-Nov") **new, high value** |
| Overdue first, 30-day total, advice to check overdue | Quiet hours, optional daily digest **new**; weekday/daily/weekly repeats (planned) |
| Add a reminder from a calculator result and a suggestion chip | Pay-now shortcut to a UPI app (left out: depends on the phone's apps) |

## Budget
| Present | Absent |
|---|---|
| Add expense; categories and subcategories; limits for every month or one month; categories for chosen months | Income and net cash flow: "did I save this month" cannot be answered **new** |
| Cards, accounts, wallets; UPI paid-from; card details; utilisation and cost; statement cycle view; bill reminder | Notification when a limit crosses 80% / 100% (only inside the app) **new** |
| Card bill payments and own transfers not counted as spending; "Owes ₹X" | Month-end summary **new** |
| Spending summary: month switcher, filters, search, heatmap, 6-month bars, categories, "Paid with" tree (mode to sub-type) | Custom date range and a year view **new** |
| Refunds; bulk recategorise; edit history; trip totals via subcategories | Tags on expenses (cross-category labels) **new** |
| Recurring bills and subscriptions with yearly cost | Explicit merchant rules the user can see and edit **new** |
| Add from bank messages (on tap, on the phone), statement CSV import, review list, duplicate hiding, add cards found, category guess, reader log (masked) | Reimbursable marker ("paid for someone, expect back") **new**; split one expense across categories **new** |
| CSV export; Add expense from a calculator result | Cash balance (ATM withdrawals vs cash spending) **new** |
| Credit utilisation, annual fee, interest and fee entries per card | Last known balance per account from "Avl bal" in messages **new** |
| First-run tour | Statement PDF import (formats differ per bank); background auto-scan of new messages (left out by design: broader permission); multi-currency; receipts (photo permission) |

## Across the three sections
| Gap | Note |
|---|---|
| Portfolio | New section planned: `docs/PORTFOLIO-PLAN.md` (Phase 5) |
| Link Notes ↔ Budget ↔ Due | Budget bills own a Due reminder, calculators can add to Notes, Due and Budget. Missing: list total to expense; card statement SMS to Due |
| Notifications from Budget | None yet (limits, month-end) |
| Phone proof | Reminder delivery, the new reliability guide on a real OnePlus, and the SMS reader beyond one inbox are still unproven |
