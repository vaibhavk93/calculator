# Changelog

All notable changes to Calc. Dates are when the work was done.

## [0.5.0] - 2026-11-02

### Calculator
- **The expression line is now an editable text box.** It has a cursor and selection. Tap to move the cursor, type or delete there, or replace an operator in place (tap `+`, press `-`). After `=`, tap the line to edit the last expression. A lone number shows its edit line only after you tap the big number. Engine: `applyKeyAt` in `src/engine/expression/input.ts`. Store: `selection`, `setSelection`, `editLast`. `src/lib/format.ts` maps the cursor between the typed text and the grouped text (`caretMap`, `displayCaret`).
- **Copying numbers is a setting.** Settings, Copying numbers: ask each time, with commas, or without commas. The default is Ask. Ask opens a "Copy as" sheet showing both texts. If both texts are the same, it copies straight away (`src/components/CopyAs.tsx`).

### Pages
- **Keep and share is one slim row of four icon buttons** (Copy, Share, Add to a list, Remind me). No heading. The status text sits beside the icons.
- **The floating answer on calculator pages is a bordered button at the bottom edge.** Tapping it scrolls to the result. It replaces the sticky heading with an underline at the top. The sticky table header is gone too.
- **Pills are 32px tall with a 44px touch area** (a pseudo-element).
- **History is one card per calculation**: name, expression, "= answer", and the edit and delete icons in their own column.
- **Settings sections are tinted cards**: Appearance, Numbers, Behaviour, Reminders, Your data, About. Fixed a toggle bug (a duplicate `::before` rule).
- **The Save sheet is four tinted cards**: Title, Tags, Note, Reminder (with a switch).

### Budget tab (new, the fifth tab)
- One monthly limit **per category** (not per month), plus an optional overall limit. Expenses are entered by date. A month switcher shows any month. **Uncategorised is shown, never hidden.** Delete is soft, with Undo.
- Starter categories: Rent, Food, Groceries, Transport, Bills, Health, Shopping, Travel, Loan EMI, Savings.
- Data is in `src/lib/budget.ts` and saved in `PersistedData.budget`. The schema stays 3. Old data gets the starter categories.
- **This overrides the ROADMAP gate** that said to wait a month of tag totals first. The owner asked for it explicitly on 2026-11-02.
- **The design is based only on the local `Financial Advisor` folder.** The GitHub repo `vaibhavk93/financial-planner` returned 404 (private or renamed), so it was not read.
- Left out on purpose, because there is no evidence they are needed: rollover, per-month limits, card cycles, SMS parsing, a ledger, the 50/30/20 rule.

### Not verified
- The Budget screen on a real phone. All of the above on a phone. A 200% font sweep of the new screens. The light theme.
- Tests: 49 files, 1086 tests.

## [0.4.0] - 2026-11-02

### Reminder permissions
- The "Alarms & reminders" permission is declared again, so Android shows its switch. Settings has a new **Reminders** section showing what is allowed and a button to fix each. Reminders are exact when allowed, inexact otherwise.

### Page anatomy (new)
- Every calculator page has the same four parts: a shared header, a tinted **edit** card, a plain **result** card, and a **Keep and share** card (Copy, Share, To list, Remind me). Guidelines in `docs/DESIGN-SYSTEM.md` section 14.
- **Share** opens the phone's share sheet with a message that carries the title, what was typed, the answers and the note.
- The answer bar floats only while the result is scrolled out of sight, so an answer is never shown twice.
- One `ScreenHeader` for every full screen, enforced by a test.

### Bugs found by a full audit of 51 calculators and 25 app pages, and fixed
- Content running off the screen at large font sizes (about 30 calculators): the answer bar, text results, two-column tables, the reminder switch.
- Settings switches below the 44px tap size; an unnamed file input.
- Tax: "cheaper by ₹42150" had an unformatted, repeated amount. "How this is worked out" lines now group amounts (₹50,00,000) in loans, savings, tax and metrics.
- The audit checker is saved as `e2e/audit-harness.js`.

### Tools, Notes, Due
- Eight section colours; Tools home is colour tiles; each group split into titled section cards; "Convert" removed (currency under Money, binary/hex under Math, units under Units and travel).
- Tables of three or more columns are row blocks: nothing scrolls sideways. Pin and unpin icons on Notes. The calculator's action row no longer shifts the layout after `=`.

## [0.3.0] - 2026-11-02

### Calculator
- Renamed to **Calc**. Operators, C, ( ), % and the utility buttons are bordered; digits stay filled; "=" stays accent.
- The "..." and chevron panels are gone. The basic calculator is clean: Paste, Copy, Undo, Backspace.
- **Scientific calculator** is its own screen, at the top of Tools, with memory keys.
- The live answer is dimmed; "=" makes it full strength. "=" again does nothing. Earlier calculations are shown **only in History**, never on the calculator while you work.
- **Paste works**: native clipboard on the phone, a "Paste here" sheet if reading fails, and a forgiving parser (`23*36`, `Rent 25000 + 3000`, lists are summed).
- After "=": **To list** and **Remind me** chips.

### Tools
- 51 calculators in **9 groups**. Compact search. Tapping the Tools tab returns to the list. The Android back button goes up one level.
- Sticky answer bar, digits group as you type with "50 lakh" beneath, hints on focus, rare fields under "More options".
- All 51 calculator forms reviewed (`docs/TOOLS-UX-REVIEW.md`): plain titles, fewer fields on top.
- Settings: "Opens on" can pick any calculator.

### Notes, lists, reminders
- The Saved tab is now **Notes**. Lists have optional checkboxes: "2 of 5 done, ₹3,000 left". Copy as text includes who has paid.
- Send a number to a list as one line or several: 1,000 as 5 lines for 5 friends.
- Fixed: the Due tab's 30-day total missed a reminder due exactly in 30 days.

### Platform and brand
- New **logo** and icons (`docs/BRAND.md`): adaptive, themed and legacy Android icons, favicon, dark launch screen.
- Status bar icons follow the theme. `SCHEDULE_EXACT_ALARM` stays removed.
- Docs: HANDOFF, ARCHITECTURE, PARALLEL-WORK, BUILD-ANDROID, TESTING, BACKLOG, UX-AUDIT, UI-UX-PLAN, IMPROVEMENT-PLAN, BRAND; guidelines extended (DS 9 to 13, UX 11 to 19); AGENTS.md; `.claude/agents/`; `scripts/build-android.sh`.

### Not done (see `docs/HANDOFF.md` section 4)
The phone still has the older build. Reminders are unproven on a device. History rows have no actions. Nothing is committed.

## [0.2.0] - 2026-11-02

### Calculators (51)

| Group | Count | Where the code is |
|---|---|---|
| Everyday: percentage, discount, GST, tip, unit price, units, currency, date, world time, number base, fuel, body metrics, grades, ovulation | 15 | `src/engine/convert`, `src/engine/everyday` |
| Loans: EMI, schedule, prepayment, affordability, rate change, compare, home-loan tax, balance transfer, simple vs compound, card EMI, typical rates | 11 | `src/engine/loans` |
| Investments: SIP, step-up SIP, lumpsum, goal SIP, SWP, FD, RD, PPF, NPS, EPF, inflation, CAGR/XIRR | 12 | `src/engine/investments` |
| Tax: income tax (old vs new), in-hand salary, capital gains, advance tax, gratuity, 44ADA | 6 | `src/engine/tax` |
| Product metrics: CAC/LTV, payback, funnel, ARR/MRR, A/B sample size, retention, Rule of 40 | 7 | `src/engine/metrics` |

Each is a short spec in `src/features/tools/` rendered by one shared screen. Every result has a "How this is worked out" section.

### Memory layer
- Save any result in two taps; the saved card keeps the inputs, so it reopens ready to edit.
- Tags, notes, search, pinning (up to 5), Trash for 7 days with Undo.
- Tapes: type "Flights 24000" and keep a running total.
- Reminders: one-time or monthly, quarterly, yearly. Due tab groups Overdue, This week, Later, with a 30-day total. Mark paid moves a recurring reminder to its next date.
- Stored data is now schema version 2. Version 1 data upgrades with nothing lost (tested).

### Not shipped
- **HRA exemption calculator.** The current rule could not be read from an official copy. Income tax and in-hand salary take the exempt amount from Form 16 instead.
- **Live currency refresh.** Currency uses a dated snapshot bundled in the app (ECB rates, 2026-10-30).
- **Home-screen widgets, quick tile, share intake, app lock, boot rescheduling.** Not started. They are native Android work.

### Known limits
- Reminder notifications and Android storage are written but **have not run on a real device**.
- Several formulas are checked only by recomputing a second way, not against an outside source. Each test file says which.
- Tax: capital gains handles one sale at a time with no surcharge or loss set-off. Income above ₹50 lakh is only supported where the worker could confirm the rules.

## [0.1.0-P1] - 2026-11-02

Calculator with brackets, scientific mode, Indian and international number formats, history with Undo, memory keys, themes and settings. 395 unit tests at the time.
