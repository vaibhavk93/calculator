# Calc: all features and phases

Updated 2026-11-02 (round 4). Status key:
- **Phone** = built and in the build installed on the owner's phone (19:05 build).
- **Code** = built and tested by machine, in the repo, **not yet installed**.
- **Running** = a helper is building it now.
- **Planned** = written in a plan, not built.
- **Gated** = must not ship until a rule is checked against an official source.

Nothing is proven on a real phone except the items the owner has used. Reminders in the background are still untested.

## 1. Every feature, one table

| # | Area | Feature | Status |
|---|---|---|---|
| 1 | Calculator | Basic keypad, live preview, Indian or international grouping | Phone |
| 2 | Calculator | Scientific screen, memory keys, degrees or radians | Phone; keypad-under-tab-bar fix is Code |
| 3 | Calculator | Edit with a cursor: move, select, delete, swap an operator, edit after `=` | Phone |
| 4 | Calculator | Huge numbers like a real calculator (plain to 15 digits, then 1.2E+25, number words up to shankh / decillion) | Code |
| 5 | Calculator | Paste, Copy, Copy as (with or without commas, or remember) | Phone |
| 6 | Calculator | History: cards, name, reuse, delete with undo | Phone |
| 7 | Calculator | History power-ups: row menu, lock, edit expression, share, All/Locked filter | Code |
| 8 | Calculator | To list / Remind me after `=` | Phone |
| 9 | Calculator | Landscape layout, side rail, two-pane keypad (basic and scientific) | Phone (scientific landscape is Code) |
| 10 | Tools | 57 calculators in 8 groups, one shared page layout | Phone |
| 11 | Tools | Slim icon row: Copy, Share, Add to a list, Remind me | Phone |
| 12 | Tools | Bottom answer button that scrolls back to the result | Phone |
| 13 | Tools | Themed picker instead of system dropdowns | Phone |
| 14 | Notes | Saved calculations and lists, tags, pin, Trash 7 days | Phone |
| 15 | Notes | To-do inside Notes: Today / Upcoming / All, quick add, tick with undo, task sheet | Code |
| 16 | Due | Reminders (once, monthly, quarterly, yearly), Mark paid, Snooze | Phone; background delivery unproven |
| 17 | Due | Alarms and reminders permission and its Settings buttons | Phone |
| 18 | Budget | Add expense with amount, date, category, payment mode, note, validation, Discard check | Phone |
| 19 | Budget | Subcategories; cards, bank accounts and wallets; UPI paid from a bank, debit card, wallet or RuPay credit card | Phone |
| 20 | Budget | Lean home, Spending summary with month switcher, filters, 6-month bars, category and payment breakdown | Phone |
| 21 | Budget | Limits for "every month" or "this month only"; categories for chosen months only | Code (data); Running (screens) |
| 22 | Budget | Card details: variant, holder, statement and due day, credit limit, annual fee, UPI ID, account type | Code (data); Running (form) |
| 23 | Budget | Card bill payments and own-account transfers not counted as spending; "Owes ₹X" per card | Code (data); Running (screens) |
| 24 | Budget | Day-by-day spend heatmap; last 6 months newest first | Running |
| 25 | Budget | Category pills with recents, UPI "Bank account (default)" and "Add credit card" | Running |
| 26 | Settings | Themes, accent, number system, decimals, angle, opens-on, vibrate, keep-awake, keep history | Phone |
| 27 | Settings | Copying numbers, Reminders permissions, calm single-colour sections | Phone |
| 28 | Data | Backup to a Calc folder in Downloads, asks first, Open folder link; restore | Phone (folder link unverified) |
| 29 | App-wide | Close X and a footer button on every pop-up; system back never required | Phone |
| 30 | App-wide | Required fields marked `*`, errors in words, no disabled submit | Phone |
| 31 | App-wide | Tappable things look tappable (chevrons, underlines, press states) | Code (Tools, Settings, Due); Running (Budget); to do (Notes, History rows) |
| 32 | App-wide | Safe deletes: Empty Trash and Remove reminder ask first | Code |
| 33 | App-wide | Pop-ups cover the tab bar; keyboard resizes the page | Code |
| 33a | Settings | Reminder time (default 9:00 am) and "Send a test reminder" (one notification about a minute out) | Browser (web toast); phone delivery unproven |
| 33b | Due | "Add a pack": 4 advance-tax reminders (15 Jun/Sep/Dec/Mar, 15/45/75/100%), yearly, never doubled. ITR dates left out on purpose | Browser |
| 33d | Budget | Credit utilisation per card: "Using 34% of ₹1,50,000 limit" on the card row (only when a limit is set; over the limit says so in words) | Browser |
| 33e | Budget | "What this card has cost you": annual fee plus entries the user put in an interest/fee/charge category, for this year, in the card's edit form. Nothing is guessed | Browser |
| 33f | Data | Export expenses as CSV (BOM for Excel, RFC 4180 quoting, formula-injection guard). Range: This month / Last 3 months / This year / All. From Settings > Your data and the Spending summary. Saves to Download/Calc like a backup; browser downloads. Needs `npx cap sync android` (plugin now takes a mime type) | Browser; phone unproven |
| 33g | Calculate | "Add expense" chip after "=" for a positive result (opens Add expense with the amount and note "from calculator"). Fits 360px at 100% and 200% font. Not added to tool results: their headline is not always money and that icon row is already full | Browser |
| 33h | Budget | **Bills and subscriptions.** "Repeats" on Add expense (Never / Monthly / Quarterly / Yearly) makes ONE record (`budget.recurring`) that owns the Due reminder (a task card plus its reminder; the next due date lives only there) and the budget entries (each carries `recurringId`). Marking it paid in Due, or ticking it in To-do, adds that period's entry (dated the due day, or today if paid early; once per date) with Undo. A Bills page from the Budget home lists each ("₹199 a month = ₹2,388 a year"), the total a year and a month, next due, Edit, Pause (no reminder, no entries; Resume carries on), Stop (Undo; past entries stay). Removing the reminder in Due stops the bill. Older entries can be turned into a bill by editing them. Data: additive only, schema stays 3 | Unit tests; browser at 360px and 200% font; phone unproven |
| 33i | Budget | **Card statement cycle + bill reminder.** With one card chosen in Spending summary: "Calendar month / Statement cycle". The cycle ends on the statement day of the chosen month (day after last statement day through this one). Uses each entry's own date, not the bank's posting date (one plain line says so). Day-by-day and last-month comparison are calendar-only and hidden in cycle view; limits stay calendar months (said on screen). "Remind me about this card's bill" (card form, and on the summary) is a monthly Due reminder on the due day, the same recurring record with no amount; it never adds an entry. It follows the card's due day and name, and ends if the day is cleared or the card is deleted | Unit tests; browser |
| 33j | Budget | **Search** in the Entries tab: note, category (and parent), payment mode, card or account, amount, or the words refund / card bill. Case-insensitive, every word must match, all months at once (respects the card filter), shows a count and total, first 200 rows. No new data | Unit tests; browser |
| 33k | Budget | **Refunds.** A "Refund" choice beside Spending / Card bill / Transfer. Stored as `refund: true` with a positive amount. Every total, category, mode, card, daily total, trend, limit, and "what a card owes" subtracts it; it is shown as a minus and the word "Refund" (not only colour); "Biggest spends" leaves it out. CSV: negative amount and Type "refund". A normal entry still needs an amount above zero | Unit tests; browser |
| 33l | Budget | **Trip or event total.** Uses subcategories as they are (Travel > Goa trip). The Entries tab with a category chosen shows "Goa trip · ₹18,400 across 9 entries" for the month (or cycle) and for all months; By category rows show entry counts. No new data | Unit tests; browser |
| 33c | Settings | Backup nudge: one dismissible line plus one launch message (25+ items, no backup or older than 30 days, at most once per 14 days) | Browser |

## 2. By phase

### Phase 1: Foundation
| Feature | Status |
|---|---|
| Expression engine on exact decimals, history, themes, Indian numbers | Phone |
| Cursor editing, Copy as, huge-number display | Phone / Code |
| Landscape layout | Phone |

### Phase 2: Everyday tools (14 calculators)
| Group | Calculators | Status |
|---|---|---|
| Math | Percentage, number bases | Phone |
| Money | Discount, GST, unit price, tip split, currency | Phone |
| Units | Unit converter, fuel efficiency, fuel cost | Phone |
| Life | Date, world time, body metrics, ovulation, grade average | Phone (world time is a table that does not tick) |
| Result to field | "Use in another tool" (arrow icon under a result): pick the calculator, then which box. Money goes to rupee boxes, percent to percent boxes, plain numbers to unit-less or time boxes. Headline row only; not offered for text, negative or date answers, nor from a saved card | Code |
| Planned | Each calculator remembers its inputs (it does for the session; across restarts is not built) | Planned (A23) |

### Phase 3: Loans (13 calculators)
| Feature | Status |
|---|---|
| EMI, amortisation, reverse EMI, prepayment, rate change, balance transfer, loan compare, card EMI, home-loan tax, simple vs compound, loan presets | Phone |
| Schedule closes in exactly N instalments (rounding goes in the last one) | Planned (C2) |
| Runway (how many months your money lasts, which loan to part-pay) | Code (C12, 2026-11-03). Not yet on a phone |
| Several loans at once: avalanche vs snowball, debt-free date (2 to 6 loans) | Code (C13, 2026-11-03). Not yet on a phone |
| One "Loan term" box ("18 months", "20 years", a plain number means years) on every loan tool; old saved cards migrate | Code (2026-11-03) |
| Card minimum-due trap | Planned (C14) |
| Card annual fee: worth it? | Planned (C15) |

### Phase 4: Savings and investing (15 calculators)
| Feature | Status |
|---|---|
| SIP, step-up SIP, lump sum, goal SIP, FD, RD, PPF, NPS, EPF, SWP, inflation, CAGR/XIRR | Phone |
| Net worth | Planned (D14) |
| Debt-to-income | Code (D15): bands editable under More options, common lender rule of thumb |
| Emergency fund | Code (D16): months by situation shown as a guide, you type the target |
| Savings rate | Code (D17): from spending or from savings |
| Inflation: general and medical as two rates | Code: new field `medical` (blank hides it); `infl` is now labelled "General inflation", id unchanged |
| SWP: separate return for the saving years | Code: new optional fields `wait` and `saveRate`; blank = old behaviour |

### Business: Markup and margin
| Feature | Status |
|---|---|
| Markup and margin (cost, then price, markup % or margin %) | Code, in Business metrics under "Pricing" |

### Phase 5: Tax and salary (6 calculators)
| Feature | Status |
|---|---|
| Income tax, advance tax, capital gains, 44ADA, in-hand salary, gratuity | Phone |
| Exit settlement (full and final) | Gated (E8): rules unchecked |
| Business metrics (7): CAC/LTV, payback, retention, funnel, ARR/MRR, Rule of 40, A/B sample size | Phone |

### Phase 6: Memory layer
| Feature | Status |
|---|---|
| Notes, lists, tags, pin, Trash | Phone |
| Reminders, Due tab | Phone (background delivery unproven) |
| To-do: Today / Upcoming / All, quick add, task sheet | Code |
| To-do later: priority, steps, links, quick-add parser, merge into Due, task notifications wording | Planned (plan phases 2 to 4) |
| History power-ups | Code |
| Reminder proof on a phone that kills background apps | Planned: needs a test over a night |

### Phase 7: Budget
| Step | Feature | Status |
|---|---|---|
| 7a | Add expense, categories, payment modes, summary, filters | Phone |
| 7b | Cards, bank accounts, wallets, UPI-from-card, subcategories | Phone |
| 7c | Month-only limits and categories, card details, settlements (data) | Code |
| 7d | Screens for 7c, tap cues, pills, heatmap, newest-first months | Running |
| 7e | Limit alerts ("needs attention" at 80%) | Phone (80% line unproven) |
| 7f | Statement-month view and card bill reminder | Browser (2 Nov Phase 2); phone unproven. See 33h and 33i |
| 7g | Rewards helper: "best card for this category" (user-typed rates only) | Planned, risky, last |
| 7h | Refunds (33k) done. Per-month category budgets beyond limits | Refunds: Browser. Rest: planned |

### Phase 8: Platform and polish
| Feature | Status |
|---|---|
| Android build, backup folder, share sheet, landscape | Phone |
| Pop-ups with X and footer, picker, required marker, validation | Phone |
| Tap cues, safe deletes, disabled-button style, keyboard resize | Code |
| App-page audit at 200% font (the second half) | To do |
| Light-theme sweep of app pages | To do |
| Repair `e2e/smoke.mjs` (stale) | To do |
| Test on the phone: scientific keypad, huge numbers, Budget | Next after install |
| Exact split: shares add up to the total to the paisa (largest remainder, `src/engine/convert/allocate.ts`); Tip and split uses it and says "₹0.01 extra goes to person 1" | Code |
| Invalid boxes are marked on every calculator from one place (`src/lib/toolInvalid.ts`, drawn by `ToolScreen`): `aria-invalid`, `aria-describedby` the message, the alert-coloured underline (same as FormField). A spec may name the box (`{ error, field }`; `need()` does); otherwise the screen finds it by testing which box changes the error. `src/features/tools/toolInvalid.test.ts` walks every calculator with each box emptied or junked | Code |
| "Use in another tool" sheet (X, footer, two steps), compatibility in `src/lib/toolLink.ts` | Code |
| Next-step chip under a result: Loan EMI "Remind me every month on the 5th", Advance tax "Add all four quarterly due dates". Text link plus a close. One chip, gone for good after use or dismiss (`settings.dismissedTips`, additive). SIP has none | Code |
| World time can convert a chosen time and day in the home city (new `time` field kind, native time input; blank day is today; daylight saving read for that day) | Code |
| Tip and split: Equal, By percent, By shares, Exact amounts (up to 6 named people, tip shared in proportion, shares add to the total to the paisa); optional "Who paid" shows who owes whom; "Save my share to Budget" opens Add expense prefilled. No groups and no running ledger, by design | Code |
| Rules of thumb state their condition (CAC:LTV 3:1, payback, Rule of 40 and burn bands, EMI cap, BMI range). Emergency fund, DTI and savings rate do not exist yet, so they carry no text | Code |
| "Checked against <source>" line under a result, only for the 9 tools VERIFICATION.md rates A (`verified` on the tool spec); other tools show nothing | Code |
| Budget browser test: the CG07-10 and PM13-26 timeout cluster is fixed (cause: a lost first tap, see TESTING.md). 117 cases, 109 pass, 8 fail on purpose (known bugs B-06, B-22, B-23) | Code |

### Phase 9: Later (not this round)
| Feature | Why later |
|---|---|
| "Which card for this spend?" rewards engine | Card terms change often |
| Expose the calculator engine as a tool for AI assistants | Cheap, not asked |
| iOS | Needs a Mac build |
| Play Store release | Exact-alarm permission needs a decision first |
| SMS capture | **Built (Code)**, see `docs/SMS-CAPTURE.md`. Owner overruled the old rejection |
| Bank statement file import (CSV) | **Built (Code)**; PDF later |
