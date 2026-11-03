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
| 10 | Tools | 51 calculators in 8 groups, one shared page layout | Phone |
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
| Planned | "Use result in…" (send a result into a calculator field); each calculator remembers its inputs | Planned (A22, A23) |

### Phase 3: Loans (11 calculators)
| Feature | Status |
|---|---|
| EMI, amortisation, reverse EMI, prepayment, rate change, balance transfer, loan compare, card EMI, home-loan tax, simple vs compound, loan presets | Phone |
| Schedule closes in exactly N instalments (rounding goes in the last one) | Planned (C2) |
| Runway (how many months your money lasts) | Planned (C12) |
| Several loans at once: avalanche vs snowball | Planned (C13) |
| Card minimum-due trap | Planned (C14) |
| Card annual fee: worth it? | Planned (C15) |

### Phase 4: Savings and investing (12 calculators)
| Feature | Status |
|---|---|
| SIP, step-up SIP, lump sum, goal SIP, FD, RD, PPF, NPS, EPF, SWP, inflation, CAGR/XIRR | Phone |
| Net worth | Planned (D14) |
| Debt-to-income | Planned (D15) |
| Emergency fund | Planned (D16) |
| Savings rate | Planned (D17) |

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
| 7f | Statement-month view and card bill reminder | Planned (needs statement day, now stored) |
| 7g | Rewards helper: "best card for this category" (user-typed rates only) | Planned, risky, last |
| 7h | Per-month category budgets beyond limits, refunds as negative entries | Planned |

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
