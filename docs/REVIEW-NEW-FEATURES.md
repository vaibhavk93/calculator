# Review: what to add next (product research)

Written 2026-11-02. Part of Round 5. Read-only research: no code was changed.
Method: read `CLAUDE.md`, `SESSION-STATE.md`, `FEATURES.md`, `ROADMAP.md`, `BACKLOG.md`, `PRD.md` (skim), then searched the web for each app named in the brief.

**How to read the marks**
- **Checked** = a source I read says it. The link is in the table or in section G.
- **Unproven** = I could not confirm it, or sources disagree, or I did not research it. Do not build on it yet.
- Most sources are blogs and app-store pages, not official texts. Where a rule or date matters (tax, GST, insurance), the feature needs a primary-source check before it ships. That matches the project rule in `CLAUDE.md`.

**The promise every idea is tested against:** offline, no account, almost no permissions. Money is never a JavaScript `number`. A calculator that rests on an unchecked rule does not ship.

---

## Verdict first

**The biggest gap is not more calculators. It is that the money screens do not remind you or connect to each other.**
Calc has 51 calculators and a Budget tab, but:
- a bill that repeats every month is a reminder in Due, and a separate expense in Budget, with no link;
- a calculator answer cannot become an expense or a field in another calculator;
- nothing ships you a tax date;
- you cannot get your data out for a CA (accountant) or for ITR (income-tax return).

**Do first:** reminder time picker and test, tax-date reminder packs, recurring bills, CSV export. All fit the promise with no new permission.

---

## A. Gap table: what users of other apps do that Calc cannot

| # | What users do | Seen in | Who needs it | Calc today | Evidence | Status |
|---|---|---|---|---|---|---|
| A1 | Track recurring bills and subscriptions, get a reminder days before renewal | CRED, subscription trackers | Anyone with OTT, SIP, rent, insurance, UPI AutoPay | Due repeats monthly/quarterly/yearly, but no amount, no "per year" total, no link to Budget | [CRED listing](https://apps.appfollow.io/ios/cred-upi-bills-credit-cards/1428580080?country=in), [subtracker.io India](https://subtracker.io/best/best-subscription-tracker-india), [Axis UPI AutoPay](https://www.axisbank.com/bank-smart/upi-autopay) | Checked (promo-heavy sources) |
| A2 | Split a bill unequally (percent, shares, exact amounts) and see who owes whom | Splitwise | Flatmates, trips, dinners | Tip split is equal only. Backlog #20 | [App Store listing](https://apps.apple.com/app/splitwise-bill-splitter/id458023433), [Simplify debts help](https://splitwise.uservoice.com/knowledgebase/articles/107220-what-does-the-simplify-debts-setting-do) | Checked |
| A3 | Auto-log spending from bank SMS | Walnut and clones | People who hate typing | Nothing, by design | [cardtrail review](https://cardtrail.in/basics/credit-card-spend-tracking-apps-india/), [moonproduct](https://moonproduct.pages.dev/insights/upi-expense-tracker-india-2026). Reviewers flag that SMS access reads every text and parsing breaks when banks change formats | Checked. **Rejected** for Calc, see D |
| A4 | See the card bill, due date, statement period, "pay by" nudge | CRED, Money Manager (card management) | Anyone with 2+ cards | Statement day and due day are stored. No statement-month view, no reminder (roadmap 7f) | [CRED](https://apps.appfollow.io/ios/cred-upi-bills-credit-cards/1428580080?country=in), [Money Manager](https://apps.apple.com/app/560481810) | Checked |
| A5 | Know what reward points are really worth | cardtrail tools, bank sites | Card users | Planned last (7g), risky | [cardtrail](https://cardtrail.in/tools/reward-value/). Sources disagree: HDFC about 0.20 per point for statement credit, SBI about 0.25, SBI statement-credit cap 60,000 points a month from 1 Apr 2026 | **Unproven numbers.** Rules changed April 2026 ([Business Today](https://www.businesstoday.in/personal-finance/banking/story/credit-card-rewards-reset-hdfc-sbi-axis-tighten-benefits-spend-linked-perks-take-centre-stage-524485-2026-04-07)) |
| A6 | "Give every rupee a job", move money between categories, age of money | YNAB | Budget nerds | Month limits only. Rollover left out on purpose | [YNAB new rules](https://www.ynab.com/blog/the-new-rules) | Checked. **Do not copy**, see D |
| A7 | Search and filter past entries by text | Money Manager (Note tab with search in 4.7.x), Paytm/PhonePe history | Anyone with 6+ months of entries | Filters exist in Spending summary. No text search | [Money Manager release notes](https://apkmirror.com/apk/realbyte-inc/money-manager-expense-budget). Paytm/PhonePe: not researched | Money Manager checked; Paytm/PhonePe **unproven** |
| A8 | Calculator with edit-by-cursor, history, unit and currency converters | ClevCalc, Samsung, Google | Everyone | **Has all of these.** Samsung probably lacks currency | [ClevCalc](https://apps.apple.com/app/id1221235593), [Samsung community thread](https://us.community.samsung.com/t5/Samsung-Apps-and-Services/Calculator-app-needs-update/td-p/3477652) | Checked. Calc is at parity or ahead |
| A9 | Brokerage, margin, TDS, P&L calculators | Zerodha, Groww | Active traders | None | [Zerodha support](https://Support.Zerodha.com/category/console/reports/other-queries/articles/brokerage-calculator-margin-calculator-and-black-scholes-calculator), [Groww calculators](https://groww.in/calculators) (snippet shows SIP, Lumpsum, SWP, EMI, Brokerage, Margin, TDS) | Checked. Owner need **unproven** |
| A10 | HRA exemption and a rent receipt | ClearTax and similar | Salaried people who pay rent | Not built (backlog #23, needs a primary source) | [Taxscan 1961 vs 2025](https://www.taxscan.in/top-stories/house-rent-allowance-hra-under-income-tax-act-1961-vs-2025-old-vs-new-tax-act-series-1441625), [calcguru](https://calcguru.in/hra-exemption-calculation-rent-pan-rules/) | Formula checked (least of three). Section number, metro list and landlord-PAN threshold **unproven** |
| A11 | Tax dates as reminders (advance tax, ITR) | ClearTax, news sites | Freelancers, business owners, investors | Advance tax calculator exists. No date reminders | [ClearTax advance tax](https://www.cleartax.in/s/advance-tax), [India Briefing](https://india-briefing.com/news/indias-advance-tax-due-dates-tax-year-2026-27-45178.html/) | Advance-tax dates agree across sources: 15 Jun, 15 Sep, 15 Dec, 15 Mar (15, 45, 75, 100 percent). ITR dates conflict, see C-R1 |
| A12 | Gold jewellery bill (rate, making, wastage, GST) | Jeweller sites | Families buying gold | No gold tool | [Tally on GST](https://tallysolutions.com/gst/how-to-calculate-gst-on-gold/), [Bluestone](https://blog.bluestone.com/making-charges-on-gold-2026/) | **Unproven:** sources split on GST (3% on all, or 3% gold plus 5% making) |
| A13 | Plan an FD ladder | Finnovate, Policybazaar guides | Retirees, savers | FD calculator only | [Finnovate](https://www.finnovate.in/learn/blog/fd-laddering-strategy-india), [Policybazaar](https://www.policybazaar.com/fd-interest-rates/fd-laddering/) | Idea checked. Deposit-cover limit (5 lakh per bank) **unproven**, one source says a higher limit was being considered |
| A14 | Insurance premium reminders with the 80D tip | Insurance sites | Everyone with a policy | Due can repeat yearly, nothing insurance-specific | [GoDigit 80D](https://www.godigit.com/health-insurance/health-insurance-tax-benefit-for-senior-citizens.amp.html) | 80D limits (25,000, 50,000 senior) and "not in new regime" agree across blogs; no official text read: **unproven** |
| A15 | Plot a graph of a function | Desmos, Wolfram | Students | Scientific keypad only | Not researched in this pass | **Unproven**, see D |
| A16 | Trip or event budget with its own total | Splitwise groups, Money Manager | Travellers | "Trip costs" calculator; Budget has no trip label | [Splitwise](https://apps.apple.com/app/splitwise-bill-splitter/id458023433) | Checked |

---

## B. 25 candidate features

**Scales**
- **Value:** 1 to 5 (5 = the owner would feel it weekly).
- **Effort:** S = about a day, M = a few days, L = a week or more or native Android code.
- **Fit:** how well it keeps "offline, no account, almost no permissions". Full / Good / Strained / Breaks.
- **Risk:** U = unproven demand or numbers, R = a rule must be checked, P = privacy or user-data touch.

### Calculator

| # | Feature | Value | Effort | Risk | Fit | Note |
|---|---|---|---|---|---|---|
| 1 | **Use result in a tool** ("5,000" into GST, EMI principal) (A22, backlog #19) | 4 | S-M | none | Full | UI plumbing only |
| 2 | Quick entry text ("emi 50L 8.5% 20y") (PRD F3) | 3 | L | U | Full | Parsing is easy to get wrong; no evidence the owner wants it |
| 3 | Inline units in the keypad ("5 km + 300 m") | 3 | L | U | Full | Big change to the expression engine |
| 4 | Plot a function | 2 | L | U | Full | Needs a chart library; Desmos is free and better |

### Tools

| # | Feature | Value | Effort | Risk | Fit | Note |
|---|---|---|---|---|---|---|
| 5 | **HRA exemption** plus printable rent receipt text | 4 | M | R | Full | Gated until the Income-tax Rules text is read |
| 6 | Gold jewellery bill | 3 | S | R, U | Full | GST split unproven |
| 7 | FD ladder planner (split, maturities, cover warning) | 3 | S-M | R | Full | Cover limit must be checked at DICGC |
| 8 | **Unequal split and who-owes-whom** (backlog #20) | 4 | M | none | Full | Names are typed, no contacts permission |
| 9 | Card cost pack: minimum-due trap, annual-fee worth it (C14, C15) | 3 | S | none | Full | Plain arithmetic, user types rates |
| 10 | Net-worth snapshot (D14) | 2 | S | P | Full | Needs the owner to keep it updated; likely abandoned |

### Money tracking (Budget)

| # | Feature | Value | Effort | Risk | Fit | Note |
|---|---|---|---|---|---|---|
| 11 | **Recurring bills and subscriptions** (amount, repeat, per-year total, renewal alert) | 5 | M | none | Full | Reuse Due repeat logic |
| 12 | **Statement-month view plus card bill reminder** (roadmap 7f) | 4 | M | none | Full | Statement day already stored |
| 13 | **Save as expense** from the calculator result | 4 | S | none | Full | Mirrors "To list" and "Remind me" |
| 14 | Search expenses by text | 3 | S | none | Full | Trivial on local data |
| 15 | Trip or event label with its own total | 3 | M | none | Full | Could reuse subcategories instead |
| 16 | Refunds as negative entries (7h) | 3 | S | none | Full | Must not break category totals |

### Reminders and To-do

| # | Feature | Value | Effort | Risk | Fit | Note |
|---|---|---|---|---|---|---|
| 17 | **Reminder time picker plus "Send a test reminder"** (backlog #6, #35) | 5 | S | none | Full | Proves delivery in minutes, not weeks |
| 18 | **Reminder packs**: advance tax, ITR, insurance renewal, card bill | 5 | S | R (dates) | Full | Dates editable, shown with "check the official calendar" |
| 19 | Quick-add parser ("pay rent 5th monthly") (to-do plan phase) | 3 | M | U | Full | Nice, not needed |

### Data and trust

| # | Feature | Value | Effort | Risk | Fit | Note |
|---|---|---|---|---|---|---|
| 20 | **CSV export** of expenses for a CA or ITR | 4 | S | P | Full | Goes through the share sheet, no storage permission |
| 21 | Backup nudge once there is real data (backlog #18) | 4 | S | none | Full | Already in backlog; do anyway |
| 22 | "Checked against X" label on every result (backlog #4) | 4 | S | none | Full | Already in backlog; this is the trust feature |

### Platform

| # | Feature | Value | Effort | Risk | Fit | Note |
|---|---|---|---|---|---|---|
| 23 | App lock (fingerprint or PIN) | 3 | M | P, U | Good | Adds one small permission. Does the owner share the phone? Unknown |
| 24 | Quick-add expense tile or widget (backlog #27) | 4 | L | U | Good | Native Kotlin; no new permission |
| 25 | Receive a shared payment text into "Add expense" | 4 | L | U, P | Good | A share target needs no permission, but needs native code and parsing. Unproven whether it is reliable |

---

## C. Top 8 by value over effort

```
Ranking rule: Value high, Effort small, Risk low, Fit full.

  R2 test reminder (5,S) --+
  R1 reminder packs (5,S)  |  all S, none needs a new permission
  D1 CSV export (4,S)      |
  M5 save as expense (4,S) |
  C1 use result in tool ---+
  M1 recurring bills (5,M)  -- M but highest value
  M2 card statement (4,M)   -- M, data already stored
  T4 unequal split (4,M)    -- M, backlog has asked twice
```

Also do, already in the backlog and not repeated here: #21 backup nudge, #22 "checked against" label.

**Critic status:** the owner's global rule says big suggestions pass one critic. The self-critique below is mine, not an independent critic. Parent session should run the critic on these 8.

### C1. Reminder time picker plus "Send a test reminder" (#17)
**Spec.** In Settings, Reminders: a time picker (default 9:00 am) and a button that sets a notification one minute away. Each reminder in Due may also override the time.
**Data.** One setting `reminderTime` ("HH:MM"). Reminder objects get an optional `time`.
**Screen.** Settings (Reminders section), Due sheet (time row).
**What could go wrong.** The strongest case against: it is polish, and the real risk is that Android kills the alarm in the background. A time picker does not fix that.
**Verdict.** Build, because the test button is the cheapest way to find out whether reminders work at all. Without it every other reminder feature stands on an unproven base.

### C2. Reminder packs (#18)
**Spec.** In Due, "Add a pack": Advance tax (4 dates), ITR filing, Insurance renewal, Card bill. Each pack creates normal reminders the owner can edit or delete. Advance-tax dates (15 Jun, 15 Sep, 15 Dec, 15 Mar) agree across five sources. ITR dates do not: sources say 31 Jul for ITR-1 and ITR-2, 31 Aug for ITR-3 and ITR-4, belated 31 Dec, and give conflicting revised-return dates ([taxguru](https://taxguru.in/income-tax/itr-filing-2026-important-due-dates-budget-2026-updates-strategies.html), [studycafe](https://studycafe.in/itr-filing-deadline-for-ay-2026-27-why-july-31-no-longer-applies-to-everyone-424085.html)). Ship advance tax first; ship ITR only after reading the Income Tax Department calendar.
**Data.** A small static table in `src/lib` (name, month, day, repeat yearly, note, source URL). Uses the existing `Repeat` type (monthly/quarterly/yearly).
**Screen.** Due tab, "Add" sheet.
**What could go wrong.** A wrong or moved date makes the app confidently wrong; a missed tax date costs real money. Dates also move (extensions happen yearly).
**Verdict.** Build advance tax only, with the date editable and "from the official calendar, check before you rely on it". ITR waits for a primary source.

### C3. Recurring bills and subscriptions (#11)
**Spec.** A "Repeats" section on Add expense: monthly, quarterly or yearly, with an end date. The app adds a "due" expense row on each date (not paid yet until ticked) and a reminder. A "Bills" view in Budget lists every repeating item with its monthly and yearly cost, so a ₹199 a month subscription shows as ₹2,388 a year. It marks the payment method so UPI AutoPay mandates stand out.
**Data.** `recurring[]`: id, label, amount (Decimal as string), category, instrument id, repeat, start, end, reminder days before. Generated expenses carry `recurringId`.
**Screen.** Budget (new "Bills" row under the lean home), Add expense sheet, Due (links to the same reminder).
**What could go wrong.** Strongest case against: it is two sources of truth (Due reminders and Budget bills). If the owner edits one, the other drifts. Also generated rows can inflate spend if the bill was not really paid (the same trap as G20, a card bill counted twice).
**Verdict.** Build, but one record owns both the reminder and the expense; generated rows stay "planned" until ticked, and the double-count test from G20 is required.

### C4. CSV export of expenses (#20)
**Spec.** In Settings, Data (next to Backup): "Export expenses (CSV)" with a month or date range, via the phone share sheet. Columns: date, amount, category, subcategory, payment mode, instrument, note. Not counted: card-bill payments and own-account transfers are flagged in a "kind" column.
**Data.** None new; reads expenses.
**Screen.** Settings, Data; also an icon in Spending summary.
**What could go wrong.** Strongest case against: the owner may never open a spreadsheet, and CSV can leak data if shared to the wrong app. Excel in India sometimes mangles UTF-8 without a BOM.
**Verdict.** Build. It is a day of work, it adds no permission, and "I can get my data out" is a trust feature. Add a UTF-8 BOM and show a one-line warning that the file has real spending in it.

### C5. Save as expense from the calculator result (#13)
**Spec.** After `=`, next to "To list" and "Remind me", add "Add expense". It opens the Add expense sheet with the amount filled and the expression as the note.
**Data.** None new.
**Screen.** Calculator action row and tool Keep-and-share row (reuse `ResultActions`).
**What could go wrong.** The action row has a fixed height by design (layout must not shift). A fourth button may not fit on a 360px phone. Also not every result is money (a date, a percentage).
**Verdict.** Build, but only show it when the result is a money amount, and drop "To list" into a menu if it will not fit. Check it on the phone.

### C6. Use result in a tool (#1)
**Spec.** On a result, "Use in..." opens a short list of tools (GST, EMI, SIP, discount, percentage) and fills the first money field. Each tool remembers its last inputs.
**Data.** A tag per field: "money", "rate", "years", so the app knows where a number can go.
**Screen.** Calculator result actions and Tools result row.
**What could go wrong.** Which field is "the" field is ambiguous (principal or EMI?). A wrong guess silently puts a number in the wrong place.
**Verdict.** Build in a small form: the user picks the field from a list; no guessing. Skip "smart" fill.

### C7. Card statement view and bill reminder (#12)
**Spec.** On a card, switch Spending summary between calendar month and statement month (from the stored statement day). Show "Owes ₹X, due on the 18th" and offer a reminder created from the due day. A paid bill is recorded as a settlement, not as spend.
**Data.** Existing: statement day, due day, `cardOutstanding`, settlements. New: a `billReminderId`.
**Screen.** Card detail and Spending summary.
**What could go wrong.** Banks differ on how they cut a statement and when a purchase lands (posting delay). The app's total will not exactly match the bank's. Owners may trust it too much.
**Verdict.** Build, labelled "your estimate, the bank statement is the truth". Do not promise the minimum due; the bank states it.

### C8. Unequal split and who owes whom (#8)
**Spec.** In the "Sharing a bill" section: pick equal, percent, shares or exact amounts, type names, say who paid. Output: each person's share, and the fewest payments to settle. Allow "Save as expense (my share only)" so Budget counts only what the owner owes.
**Data.** Names typed per split (no contacts). Optional saved groups ("Flat", "Goa trip").
**Screen.** Tools, Sharing a bill; Save as expense uses Add expense.
**What could go wrong.** Strongest case against: Splitwise does this well for groups because everyone sees the same ledger. A one-person offline app cannot keep a shared ledger, so "who owes whom" goes stale the moment a friend pays by UPI. That is the part users value most, and Calc cannot provide it.
**Verdict.** Build only the calculator part (split, simplify, save my share). Do not build groups or a running ledger.

---

## D. Do NOT build

| Idea | Why not | Evidence |
|---|---|---|
| Read SMS, email or bank statements (Walnut-style) | Breaks "almost no permissions". Reviewers say SMS access reads every message; parsing breaks when banks change formats | A3 above |
| Accounts, sync, shared groups | Breaks "no account". Needs a server and a privacy policy | Owner promise, `PRD.md` |
| YNAB style "give every rupee a job", rollover, age of money | A behaviour-change product, abandoned in week two per the owner's own planning notes. Budget is already unproven | `ROADMAP.md` section 4 |
| "Best card for this spend" engine | Reward terms changed in April 2026 and sources disagree on values; a wrong answer is worse than none | A5, [Business Today](https://www.businesstoday.in/personal-finance/banking/story/credit-card-rewards-reset-hdfc-sbi-axis-tighten-benefits-spend-linked-perks-take-centre-stage-524485-2026-04-07) |
| Reward points value tool with built-in rates | Same. Only if the user types the rate; then it is just a multiplication | A5 |
| Brokerage, margin, TDS calculators | Charges change by broker and by circular; no evidence the owner trades | A9 |
| GST invoice maker | A separate product (numbering, GSTIN, legal format). The GST calculator already covers the sum | `PRD.md` non-goals |
| Plot a function | Large change, no evidence of need, Desmos exists | A15 |
| Net-worth tracker | Needs constant updating; abandoned fast. Keep only a one-off snapshot calculator | `ROADMAP.md` section 4 |
| Auto-fetching live gold rate or FD rates | Adds network use and a freshness duty; rates must be typed by the user | `DATA-FRESHNESS.md` |
| Ads, analytics, crash SDKs | Breaks the privacy promise | Owner promise |
| Cloud backup | Breaks "no account". Keep the Calc folder backup | `FEATURES.md` row 28 |

---

## E. Three releases

```
  RELEASE 1 (next 2 weeks)         RELEASE 2 (next 6 weeks)         LATER
  "Trust the reminders"            "Connect the money screens"      "Only if used"
  +----------------------+         +----------------------+         +-------------------+
  | test reminder + time |         | recurring bills      |         | HRA + rent receipt|
  | tax reminder packs   |  --->   | card statement view  |  --->   | FD ladder, gold   |
  | CSV export           |         | unequal split        |         | widget / tile     |
  | save as expense      |         | search expenses      |         | app lock          |
  | backup nudge         |         | use result in a tool |         | share-in payments |
  | checked-against label|         | refunds, trip label  |         +-------------------+
  +----------------------+         +----------------------+
```

| Release | Items | Gate before it ships |
|---|---|---|
| **1: next 2 weeks** | #17 time picker and test reminder, #18 reminder packs (advance tax only), #20 CSV export, #13 save as expense, #21 backup nudge, #22 "checked against" label | Real-phone check: test reminder arrives with the screen locked. Advance-tax dates match the Income Tax Department calendar |
| **2: next 6 weeks** | #11 recurring bills, #12 card statement view, #8 unequal split (calculator only), #14 search, #1 use result in a tool, #16 refunds, #15 trip label | Double-count test (G20) passes. One month of the owner using Budget before adding more Budget features, per the roadmap gate |
| **Later** | #5 HRA and rent receipt (after the Income-tax Rules text is read), #7 FD ladder (after the cover limit is checked), #6 gold bill (after GST is checked), #24 widget, #23 app lock, #25 share-in, #9 card cost pack | Each only on a clear owner request or a checked primary source |

**Why this order.**
1. Reminders are the only thing here that loses real money if it fails (a missed tax or card date), and they are unproven on a phone. Prove them first.
2. Release 2 is held back until the owner has used Budget for a month. The roadmap already warns it may be abandoned.
3. Rule-dependent tools wait for primary sources, which is how the project already works.

---

## F. Summary and questions

### Six-line summary
1. Calc already matches ClevCalc, Samsung and Google on the calculator itself, and has more tools than most.
2. The real gaps are reminders, linking Due to Budget, getting data out, and unequal splits.
3. Do first: test reminder and time picker, advance-tax packs, CSV export, "Add expense" after `=`.
4. Then: recurring bills, card statement view, split calculator, text search.
5. Do not build SMS reading, accounts, a card-routing engine, YNAB-style budgeting or trading calculators.
6. Every tax date, GST rate, HRA rule and insurance limit in this file is **unproven** until read from an official source.

### Three questions for the owner
1. **Do you pay bills and subscriptions by UPI AutoPay or card auto-debit, and have you ever missed one?** This decides whether recurring bills (#11) comes before everything else.
2. **When you add an expense, do you do it right away or in a batch later?** If later, a share-in or quick tile (#24, #25) matters more than anything in Release 1.
3. **Do you share this phone, or need to show your data to a CA or family?** This decides CSV export versus app lock (#23).

---

## G. Sources used

- ClevCalc: [App Store](https://apps.apple.com/app/id1221235593), [APKMirror](https://www.apkmirror.com/?p=5149512)
- Samsung and Google calculator: [Samsung community](https://us.community.samsung.com/t5/Samsung-Apps-and-Services/Calculator-app-needs-update/td-p/3477652), [MakeUseOf](https://www.makeuseof.com/samsung-galaxy-calculator-app-tips/)
- Splitwise: [App Store](https://apps.apple.com/app/splitwise-bill-splitter/id458023433), [Simplify debts](https://splitwise.uservoice.com/knowledgebase/articles/107220-what-does-the-simplify-debts-setting-do)
- Walnut: [cardtrail](https://cardtrail.in/basics/credit-card-spend-tracking-apps-india/), [YourStory](https://yourstory.com/2016/08/walnut-visa-icici). Walnut's current status (Axis rebrand or Paytm shutdown) is **unproven**.
- CRED: [App listing](https://apps.appfollow.io/ios/cred-upi-bills-credit-cards/1428580080?country=in), [CardExpert](https://www.cardexpert.in/?p=5814)
- Money Manager: [App Store](https://apps.apple.com/app/560481810). Recurring and bookmarks features **unproven**.
- YNAB: [The new rules](https://www.ynab.com/blog/the-new-rules)
- Zerodha and Groww: [Zerodha support](https://Support.Zerodha.com/category/console/reports/other-queries/articles/brokerage-calculator-margin-calculator-and-black-scholes-calculator), [Groww](https://groww.in/calculators)
- Tax dates: [ClearTax](https://www.cleartax.in/s/advance-tax), [India Briefing](https://india-briefing.com/news/indias-advance-tax-due-dates-tax-year-2026-27-45178.html/), [taxguru ITR dates](https://taxguru.in/income-tax/itr-filing-2026-important-due-dates-budget-2026-updates-strategies.html)
- HRA: [Taxscan](https://www.taxscan.in/top-stories/house-rent-allowance-hra-under-income-tax-act-1961-vs-2025-old-vs-new-tax-act-series-1441625), [calcguru](https://calcguru.in/hra-exemption-calculation-rent-pan-rules/)
- Gold: [Tally](https://tallysolutions.com/gst/how-to-calculate-gst-on-gold/), [Bluestone](https://blog.bluestone.com/making-charges-on-gold-2026/)
- FD ladder: [Finnovate](https://www.finnovate.in/learn/blog/fd-laddering-strategy-india), [Policybazaar](https://www.policybazaar.com/fd-interest-rates/fd-laddering/)
- Subscriptions and AutoPay: [subtracker.io](https://subtracker.io/best/best-subscription-tracker-india), [PayU](https://payu.in/blog/how-upi-autopay-works-for-subscriptions/). RBI pre-debit notice rule not read from the circular: **unproven**.
- Android exact alarms (why reminders stay inexact): [Android docs](https://d.Android.com/training/scheduling/alarms). `USE_EXACT_ALARM` is limited to alarm, clock and calendar apps per the docs; the Play Console declaration claim is **unproven**.
- Not researched in this pass, so any claim about them is **unproven**: Desmos, Wolfram, Paytm and PhonePe history screens, Fold, ET Money, the Income Tax portal calculators.
