# Budget plan: spend summary, payment methods, subcategories

Written 2026-11-02. A plan, not code. Nothing here is built. **Unproven** means no evidence yet that it
helps. The Budget tab itself is still unproven on a phone (`docs/ROADMAP.md` section 4).

**Bottom line:** keep the Budget home small. Move every "where did it go" view to a new **Spend
Summary** page. Give each entry a **leaf category** (so subcategories work) and an optional
**instrument** (so cards and bank accounts work). Both are optional, so adding an expense stays at
amount plus note.

---

## A. What other apps show

**How sure am I?** I could not open the apps. Rows come from help pages, store listings and blogs.
**Indian apps are low confidence** (vendor marketing or third-party blogs). Monarch and YNAB are well documented.

| App | Screen | Information | Layout | Sure? |
|---|---|---|---|---|
| Paytm | Spend Summary (from Balance & History "Total Spent", or All UPI Services) | Month total; spend by auto-tag (food, travel, shopping, bills); tap a tag for its payments; switch month to compare; tags editable | Month header, tag breakdown, payments under each tag | Medium. Paytm blog; no filter or chart detail found |
| Paytm | Balance & History | Payments list, each with a tag; category filter; statement download by date range | Long list, filter row | Medium |
| PhonePe | History + statistics | Filter by date (this month, past 6 months), merchant, amount; said to show pie, bar, line charts and subcategories | Filter row over list; charts | Low. One blog, no official page |
| Google Pay | Year in review (2020); "Ask Google Pay" (July 2026, limited) | Top categories, 12-month trend chart; chat answers ("largest spend last month") with a pie | Cards; chat | Medium. Press only |
| CRED, SBI Card | Spend analysis / Spend Analyzer | Card statements pulled in; monthly outflow by category; monthly and yearly totals | Not found | Low. Third-party blogs |
| Walnut / Axio | Home + category analysis | Reads SMS alerts; groups by category; reports; bill reminders. No account filter found | Not found | Low. Reviews from 2017 to 2022 |
| Fold | Home | Linked-account spends, cash flow chart, past and upcoming recurring items, search and filter | Not found | Low. Store text |
| Money Manager | Calendar, Stats, Accounts | Month calendar with daily totals; pie with percentages; accounts (cash, cards); filter by account or card; weekly, monthly, yearly budgets | Calendar grid + pie | Medium. Store listings |
| Spendee | Wallets, Budgets | Many wallets; pie per period; budget per category and wallet; "left per day"; alerts at 75, 90, 100 percent; subcategories are paid "labels" | Wallet cards | Medium |
| YNAB | Budget screen | Per category **Assigned, Activity, Available**; header "Ready to Assign"; separate Spending Trends report | Category-group table, month switcher | High. YNAB docs |
| Monarch | Reports: Cash Flow, Spending, Income | Filters: date, **accounts**, categories, tags. Charts: Sankey, trend bars, pie, ranked bars, treemap. Summary card: income, spending, net, savings rate | Chart, summary card, breakdown list | High. Monarch help |
| Mint (closed March 2024) | Trends, Budgets | Spend by category and average per category. Budgets and custom categories did **not** move to Credit Karma | n/a | Medium. NerdWallet |
| Splitwise | Balances | "You owe", "You are owed", "Total balance"; category charts are paid | Three-number header | Medium |
| Zoho Expense | Analytics | Expenses by category and by merchant over a date range. No payment-mode filter found | Report list | Medium |

**What Calc copies:** month on top with arrows and one number first (Paytm, YNAB, Splitwise); a ranked category list you tap into (Paytm, Monarch); an **account filter** over the whole report (Monarch, Money Manager); trend vs last month, "left per day" and alerts at 75, 90, 100 percent (Monarch, Spendee), in words and in-app only. **What Calc skips:** pie, treemap and Sankey (a picture must show what a number cannot, ROADMAP section 3), and SMS or bank feeds (section I).

---

## B. Budget home: leaner layout

**Rule:** the home answers "how am I doing this month?" and lets me add. The Spend Summary answers "where did it go?".

```
+--------------------------------------+
| Budget                  <  Nov 2026 >|   month switcher (as today)
+--------------------------------------+
| LEFT THIS MONTH                      |   hero card (as today)
| ₹12,400   [=========-----------]     |
| ₹37,600 spent of ₹50,000             |
| ₹620 a day for the next 20 days      |   new; only with a limit
+--------------------------------------+
| [        Add expense        ]        |   primary, 44px+
+--------------------------------------+
| Needs attention              (max 3) |   only items at 80% or more
| Food            Over by ₹400         |
+--------------------------------------+
| Spending summary                   > |   one row, opens page C
| Biggest: Rent ₹18,000 · 41 entries   |
+--------------------------------------+
| Recent (last 5)                      |
| ₹849  Food › Delivery · UPI  2 Nov   |
| All entries >                        |   opens Summary, Entries tab
+--------------------------------------+
```

| Moves off the home | To |
|---|---|
| Full category list with every bar; "Paid with"; full entry list | Spend Summary |
| "Change limits", category management | Spend Summary > Limits; Settings > Categories & payment methods |

Stays: hero, month switcher, Add, empty state, limit alerts. Android back from the summary returns
here (`useBackHandler`); tapping the Budget tab resets to this month, as today.

---

## C. Spend Summary page

**Reached from** the "Spending summary" row and "All entries". **Header:** back, title, month
switcher (same state as the home). **Tabs:** `Summary` | `Entries`. Both obey the month and the filter.

### Filter: one chip, one bottom sheet, one choice

| Group in the sheet | Choices | Matches entries whose... |
|---|---|---|
| Everything | All accounts | anything, including no instrument |
| How paid | Cash, UPI, Credit card, Debit card, Net banking, Wallet | **mode** is that |
| Card type | All credit cards; **RuPay cards**; Visa; Mastercard; Amex; Diners | instrument has that kind or network |
| My accounts | Tata Neo, Swiggy HDFC, Diners Club Black, Amex Travel Platinum, Amazon Pay, bank accounts | instrument is that, **whatever the mode** |

**Note:** the groups overlap on purpose. The sheet says: *"UPI shows everything paid by UPI, from any
account. Tata Neo shows everything charged to that card, even by UPI."* No entry is counted twice within one view.

### Summary tab

```
+--------------------------------------+
| <  Spending summary         Nov 2026 >|
| [ All accounts v ]   [Summary|Entries]|
+--------------------------------------+
| SPENT IN NOVEMBER           ₹37,600  |   Card 1
| ₹1,880 a day (20 days) · 41 entries  |
| ₹2,100 more than 1-20 Oct (+6%)      |   words and sign, not colour only
+--------------------------------------+
| Last 6 months                        |   Card 2 (plain bars + exact numbers)
| Jun ▇▇▇▇▇▇▇▇▇▇  ₹41,000   ...        |
| Nov ▇▇▇▇▇▇▇▇    ₹37,600 so far       |
+--------------------------------------+
| By category                          |   Card 3
| Food        ₹12,000  32% [====-]     |
|   Eating out ₹5,200 · Delivery ₹4,800|   tap a row to open
|   Groceries ₹2,000 · no subcat. ₹0   |
| Rent        ₹18,000  48%             |
| Uncategorised ₹1,200                 |   never hidden
+--------------------------------------+
| Biggest spends (top 5)               |   Card 4
| Paid with: UPI · Credit card · Cash  |   Card 5 (hidden if filter is one
|   Tata Neo ₹9,800 · Swiggy HDFC ₹6,100|   instrument: it would repeat)
| Limits: Food ₹3,000 left of ₹15,000  |   Card 6 (only items with a limit)
+--------------------------------------+
```

| Card | Rule |
|---|---|
| Total | Live entries in the filter, **settlements excluded** (G20). Entry count beside it |
| Daily average | This month: spent / day of month today (inclusive). Past month: / days in that month. Future month: not shown. Never divide by "days with entries" |
| Vs last month | This month: against the **same days** last month (1st to today), because half a month against a whole month says "down 50%" in week two. Past month: whole to whole. Last month zero: "Nothing to compare: no spending in October", no percent |
| Trend strip | Six months to the selected one, same filter. `div` widths, exact amount printed, **no chart library**. **Unproven** |
| By category | Parents ranked biggest first. Parent total = own entries + subcategories. A "no subcategory" row for entries put on the parent. Share is a whole percent; rows under 1% still listed |
| Biggest spends | Top 5 by amount; ties newest first; tap to edit |
| Paid with | By mode, then by instrument. Each is one sum over the same entries, so modes add up to the total. "No mode" row for the rest |
| Entries tab | Month's entries in the filter, newest first, tap to edit, trash with Undo (existing) |

**Drill-down:** tapping a category filters the Entries tab to it and its subcategories. A removable
chip "Food" appears beside the scope chip. No new screen.

**Empty states:** nothing in this month and filter: "Nothing spent in November with this filter" plus a link "Show All accounts". No entries ever: the home empty state, no summary row. Hidden instrument: still selectable for months with entries, labelled "(hidden)". Only uncategorised spend: one "Uncategorised" row and "Pick a category when you add an expense". No limits: a link "Set a limit".

**Accessibility:** each bar has its numbers in text; a screen reader hears "Food, ₹12,000, 32 percent,
₹3,000 left of ₹15,000". Controls 44px; type in `rem`; amounts never wrap mid-number.

---

## D. Data model

**Principle:** every existing field and id stays valid. Add optional fields only. Totals are always
worked out from entries, never stored (existing rule, `src/lib/budget.ts`).

### D1. Payment methods are two levels

```
                    PAYMENT
     +--------+--------+--------+---------+--------+
     v        v        v        v         v        v
   Cash      UPI    Credit    Debit     Net      Wallet        MODE: the route
     |        |      card      card    banking      |           (fixed six, as built)
   (none)     |        |        |         |        +- Amazon Pay
              |        |        |         +- HDFC Savings
              |        |        +- SBI debit
              |        +- Tata Neo, Swiggy HDFC, Diners Club Black, Amex Travel Platinum
              +- paid FROM a bank account, or FROM a RuPay credit card
                                                              INSTRUMENT: the account
```

**Mode** is the route the money took. **Instrument** is the account it came out of. For UPI it is the
funding source, not the app (GPay, PhonePe). Instrument is optional for every mode.

| Mode | Instrument kind allowed | Note |
|---|---|---|
| Cash | none | |
| UPI | `bank`, or `credit` with network `rupay` | NPCI: a RuPay credit card links to a UPI ID and draws on the credit line; mainly merchant payments |
| Credit card / Debit card / Net banking / Wallet | `credit` / `debit` / `bank` / `wallet` | |

### D2. New and changed fields

| Where | Field | Meaning |
|---|---|---|
| Category | `parentId: string \| null` | null = top level |
| Expense | `instrumentId: string \| null`, `settlement: boolean` (default false) | `mode` unchanged |
| Expense | `categoryId` now means **the leaf the user picked** (parent or sub) | No second field, so parent and child cannot disagree |
| `BudgetData.instruments[]` | `id`, `name` (1 to 30), `kind` (`bank\|credit\|debit\|wallet`), `network` (`rupay\|visa\|mastercard\|amex\|diners\|other\|null`), `bank`, `last4` (4 digits or null, **never a full number**), `rewardNotes` (user text, not read by the app in v1), `billDay`, `dueDay` (1 to 31 or null), `deletedAt` | Ids never change |

### D3. Hierarchy rules

| Rule | Why |
|---|---|
| Two levels. `parentId` must point at a top-level category. A category with children cannot become a child | Deeper trees slow entry (MEMORY-LAYER 4.6b) |
| An entry may sit on a parent directly ("no subcategory") | Old entries stay valid; subcategory stays optional |
| Names unique ignoring case **among siblings** ("Other" under Food and Travel is fine). "Uncategorised" is reserved | Empty answer stays empty |
| Settlement entries have `categoryId = null` | Not spend |

### D4. A UPI payment from a RuPay credit card

Swiggy, 2 Nov, UPI from Tata Neo (RuPay):

```
instrument { id:"ins-1", name:"Tata Neo", kind:"credit", network:"rupay", bank:"HDFC", last4:null }
expense    { id:"e-9", date:"2026-11-02", amount:"849.00", categoryId:"cat-delivery",
             mode:"upi", instrumentId:"ins-1", settlement:false, note:"Swiggy", deletedAt:null }
```

| View | Counts it? |
|---|---|
| Mode: UPI | Yes |
| Mode: Credit card | **No**, mode is UPI (the sheet help line says so) |
| Instrument: Tata Neo | Yes. This total feeds the card's bill (use case A1) |
| Card type: RuPay cards, All credit cards | Yes |
| Category Food > Delivery, and Food | Yes, once each |

### D5. Rollups

Pure functions over live entries in `src/lib/budget.ts` (no browser API, `Dec` for money, strings in storage):
`scope(filter)`, `byCategory`, `byMode`, `byInstrument`, `trend(filter, month, 6)`.

| Rule | |
|---|---|
| Parent total = own entries + children. Computed, never stored | No stale totals |
| Settlements dropped before any sum | G20: ₹10,000 of purchases plus a ₹10,000 bill payment reads ₹10,000 |
| Entry in a hidden category counts under that name; unknown id counts as Uncategorised | See D7 |
| The month is the `YYYY-MM` of the entry date | As today |

### D6. Backup compatibility

Old backup (no instruments, `parentId`, `instrumentId`, `settlement`): `sanitizeBudget` fills `[]`, null, null, false. Newer backup: unknown fields ignored, unknown ids become null (existing). Bump `CURRENT_SCHEMA`, add one `MIGRATIONS` entry and a fixture test (rule in `persistence.ts`). Caps: 30 instruments, 60 categories, 20,000 entries. Test: save, wipe, restore gives the same totals to the paisa.

### D7. Deleting without orphaning

"Delete" means **hide**. Nothing is hard-deleted.

```
              USER TAPS "DELETE" ON A CATEGORY OR INSTRUMENT
                                  |
                +-----------------+-----------------+
                v                                   v
         no entries use it                   entries use it: "N entries use this"
                |                                   |
        hide it, Undo snack          +--------------+---------------+
                                     v              v               v
                           +--------------+ #===================+ +---------------+
                           | Move them to | # * HIDE, KEEP NAME # | Make them     |
                           | another item | #===================# | Uncategorised |
                           +--------------+                       +---------------+
                           old totals change  totals do not change  old totals change
                           (said out loud)    shows "Food (hidden)" (said out loud)
              * = default and recommended        # box = the pick
```

| Item | Rule |
|---|---|
| Hide a parent | Children hide too. Entries keep their `categoryId`; the summary shows "Food (hidden)" for months that have them |
| Hide a subcategory | Entries keep it; parent total unchanged |
| Hide an instrument | Entries keep it; stays in filters for months with entries as "(hidden)"; leaves the Add picker |
| Limit on a hidden item | Ignored and not shown; a parent limit still counts the hidden child's spend. Un-hide restores it |
| Edit leaves mode and instrument disagreeing | Blocked with words (section G). On load, `sanitize` clears the instrument; the entry is kept |
| Load check | Test: every `categoryId` and `instrumentId` on every entry resolves to a live or hidden item, or is null |

**Note:** today a deleted category turns its entries into "Uncategorised" and moves old totals. This
plan changes a built behaviour (open question 3).

---

## E. Rewards: what to store now, what not to promise

**Later goal:** "For Food, your Swiggy HDFC card is likely to earn most." It needs the category of each
spend, the card used, and each card's rate per category. After P1 and P2 the app has the first two.
Only the third is risky.

| Store now | Why it matters later |
|---|---|
| Category tree + leaf on every entry | "What do I spend on Dining?" |
| `instrumentId` and `mode` on every entry | Spend per card; UPI-on-credit often earns less or nothing |
| Instrument `network`, `bank`, `last4`, `rewardNotes` | Identify the card; notes are the user's own words |
| `billDay`, `dueDay` | Statement-month totals, bill reminder amounts |

**Store later (P6), only if the owner types rates:** `rewardRules` per instrument: category id, rate as
a **decimal string**, unit (percent or points per ₹100), optional monthly cap, `enteredOn` date.
**User-entered, never pre-filled by us.** Every suggestion shows "Rates entered 14 Oct 2026".

| Do not do | Why |
|---|---|
| Ship a built-in list of Indian cards with rates | Terms change often. SBI cut SimplyCLICK Swiggy 10X to 5X, then restored it; HDFC changed redemption and lounge rules in 2025 and 2026. A confidently wrong figure breaks the `CLAUDE.md` rule |
| Say "this card earns 5% on Food" | The bank decides by merchant code, not our category. Caps, minimum spends and excluded merchants are common |
| Say how many points you "would have earned" | Needs exact statement terms. Wording: "about, using the rate you entered" |
| Assume UPI on a credit card earns | Often excluded. Needs its own user-entered rule, else "no rule for UPI" |
| Rank a card with no rule for that category | Show "No rate entered" |
| Read statements or bank sites to fill rates | Section I |

**Test later:** rate 5 percent, cap ₹1,000, on ₹30,000 of spend gives ₹1,000 (cap hit), with its entry
date. A rule older than 90 days shows "Check this rate is still right" (90 is a guess: **unproven**).

---

## F. Limits

| Level | Rule |
|---|---|
| Overall | One monthly amount (exists) |
| Category (parent) | One monthly amount; counts the parent's entries **plus all its subcategories** |
| Subcategory | One monthly amount; counts only its own entries |
| Every month | Same amount, as built. No rollover or per-month overrides (left out in ROADMAP) |
| Child limits sum above the parent's | Allowed with a note: "Subcategory limits add up to ₹16,000, above the Food limit of ₹15,000." Never blocked |
| Parent has no limit, child does | Allowed |
| Limit below what is already spent | Allowed; shows over at once |

**Alert wording** (in words, never colour alone; computed on exact decimals, so 99.6% never says "reached"):

| State | Test | Words |
|---|---|---|
| Fine | under 80% | "₹3,000 left of ₹15,000" |
| Close | 80% up to the limit | "Close to the limit: ₹800 left of ₹15,000" |
| Reached | spent equals limit | "Limit reached" |
| Over | spent above limit | "Over by ₹400" |
| Pace | limit set, days left, money left | "₹620 a day for the next 20 days" (not shown if left is zero or less) |

Shown on rows, in "Needs attention" on the home, and as a one-line snack after saving an entry that
crosses 80% or 100% ("Food is now ₹400 over its limit"), once per crossing per month. **No push
notifications in v1**: 9:00 am reminders are unproven on phones that kill background apps (HANDOFF).
The 80% line is a guess (Spendee reviews cite 75, 90, 100): **unproven**; keep it one constant.

---

## G. Validation rules

Errors are plain words, never `NaN`. The sheet stays open until the entry is accepted (existing).
Each rule is enforced in the store **and** again in `sanitize` on load and import.

| Field | Rule | Error text |
|---|---|---|
| Amount | Required; digits and one dot; above zero; at most 2 decimals; at most ₹10,00,00,000; no exponent or sign | "Enter an amount above zero" / "Use up to 2 decimals" / "That is more than ₹10 crore" |
| Date | Real calendar day; not before 2000-01-01; not over 1 year ahead; a future date gets a hint | "Pick a date" |
| Note | Trimmed; at most 200; control characters removed | cut at 200, counter near the end |
| Category | Exists and live (a hidden one only if the entry already had it) | "Pick a category from the list" |
| Mode, instrument | Mode one of six or none. Instrument live and matching D1; clearing mode clears it | "Only RuPay credit cards can pay by UPI. Pick one, or set this card's network" |
| Settlement | On: category cleared, picker disabled | "A bill payment is not spending, so it has no category" |
| Category name | 1 to 30 trimmed; unique among siblings, ignoring case; not "Uncategorised"; an existing name selects it | "That name is already used here" |
| Subcategory | Parent top-level; at most 12 per parent; at most 60 categories | "Subcategories can't have their own subcategories" |
| Limit | Blank = none; else above zero, 2 decimals, at most ₹10 crore | "Enter a limit above zero, or leave it empty" |
| Instrument name | 1 to 30; unique among live instruments of the same kind, ignoring case; at most 30 instruments | "You already have a card named that" / "Hide one you no longer use" |
| Kind, network | Kind required. Network optional, needed for a credit card on UPI | "Pick what this is" |
| Last four | Blank or exactly 4 digits. Longer is **refused, not shortened** | "Enter only the last 4 digits. Calc never keeps a full card number" |
| Bank | At most 30 | |
| Reward notes | At most 300; a run of 13 or more digits refused | "Remove the long number. Calc does not store card numbers" |
| Bill day, due day | Whole number 1 to 31 or blank | "Enter a day from 1 to 31" |
| Import and load | Duplicate ids dropped; unknown references null; wrong types dropped; sizes capped | Silent, with a count shown if anything was dropped |

---

## H. Build plan

Sizes: **S** under a day, **M** 1 to 3 days, **L** more. Every phase ends with `npm run check`. A phase
that changes a screen also needs the browser pass with screenshots. **`e2e/smoke.mjs` is stale**
(taps removed buttons), so repairing it gates P3.

| Phase | What | Size | Needs | Test gate | Status |
|---|---|---|---|---|---|
| **P0** | **Tighten validation** of what exists: decimals, 10 crore, date range, name uniqueness, limit checks. Pure functions in `src/lib/budget.ts`, used by store and `sanitize` | S | none | A unit test per row of G that exists today | Safe |
| **P1** | **Model, no screens.** `parentId`, instruments, `instrumentId`, `settlement`; mode/instrument matching; schema bump, migration, fixture; rollups, daily average, vs last month, trend; orphan test | M | P0 | Old backup loads; round trip equal to the paisa; ₹10,000 + ₹10,000 bill reads ₹10,000; UPI-from-RuPay entry counted once in each matching view; parent = own + children | Maths checkable; model **unproven in use** |
| **P2** | **Manage lists and pickers.** Settings > Categories & payment methods (subcategories; add a card or account). Expense sheet: category then subcategory; mode then instrument; add in place | M | P1 | Hiding an in-use item leaves entries intact; inline add selects it; keyboard; 200% font; screenshots | **Unproven.** Measure taps per entry; more than 2 extra means cut it |
| **P3** | **Spend Summary + lean home** (B and C): filter sheet, Summary and Entries tabs, cards, back handler | L | P1, P2, repaired smoke test | Screen totals equal the engine to the paisa for each filter; drill-down; empty states; short-phone screenshots; Android back | **Unproven.** Judge after a real month of entries |
| **P4** | **Subcategory limits and alerts** (F): limit field, parent roll-up, "Needs attention", pace line, crossing snack | S to M | P3 | Exact-decimal threshold tests; child-over-parent note | 80% line **unproven** |
| **P5** | **Settlements and card outstanding.** "Card bill payment" entry; outstanding = charges minus payments; `billDay`/`dueDay` for a statement-month view and a pre-filled bill reminder (A1) | M | P1, P2 | G20 test; statement-month sum equals its lines | **Unproven**; depends on open question 1 |
| **P6** | **Rewards helper.** User-entered `rewardRules`; "best card for this category" with entry dates and a stale warning | L | P2, a month of card data | Cap and rate maths; no suggestion without a rule | **Unproven and risky.** Start only after the owner has typed rates for two cards by hand |

**Order:** P0, P1, P2, P3; then P4 and P5 in either order; P6 last. **Cut line:** P0 to P3 is the
feature described; P4 to P6 are separate decisions.

**Note:** `CLAUDE.md` says nothing since the UI revamp has run on a device. Put the current Budget on
the phone (ROADMAP stage B) before P3, or P3 is built on a guess.

---

## I. What to leave out, and why

| Leave out | Why |
|---|---|
| **Reading SMS** (Walnut) | Needs the SMS permission, which Google Play restricts (**not checked in this pass; verify current policy first**). Breaks "no account, nothing leaves the phone". Bank text formats change; one wrong parse corrupts a total |
| **Bank linking / Account Aggregator** (Fold, CRED, Mint) | Needs a licensed partner, a server, consent flows and running cost. Mint closed in 2024 and its budgets did not survive. Calc is offline by design |
| **AI categorisation** (Paytm tags, Ask Google Pay) | Needs a cloud call (breaks offline and privacy) or a big on-phone model that is sometimes wrong. The cheap answer is built: defaults from the last entry with the same note. Revisit only if taps per entry prove to be the problem |
| Pie, treemap, Sankey | No chart library; number-first lists say the same; pies hide small slices |
| A card reward rate database | Section E |
| Push alerts for limits | Reminder delivery unproven on real phones |
| Rollover, per-month limits, 50/30/20, shared wallets | Already left out in ROADMAP; no evidence they are needed |
| Refunds as negative entries | MEMORY-LAYER 4.6b allows them; today's check needs an amount above zero. Add when asked (open question 2) |
| Linking a debit card to a bank account | Not asked; a debit card is its own instrument |

---

## Sources

**Indian apps (low to medium confidence):** [Paytm spend summary](https://paytm.com/blog/payments/paytm-introduces-automatic-spend-categorization-and-monthly-spend-summary-for-smarter-expense-tracking) ·
[Paytm monthly tracking](https://paytm.com/blog/payments/how-to-track-your-monthly-expenses-with-paytm) ·
[PhonePe history (Hans India)](https://www.thehansindia.com/business/tips-for-managing-finances-effectively-using-phonepe-transaction-history-850763) ·
[Ask Google Pay (Tech2)](https://www.tech2.com/apps/google-pay-gets-a-gemini-powered-chatbot-for-spending-insights-in-india-text-10240689.html) ·
[Google Pay 2020 review](https://www.crowdfundinsider.com/2021/01/170868-google-pay-users-in-india-can-easily-review-analyze-all-transactions-from-2020-apple-pay-support-rolled-out-at-ny-subway-stations/) ·
[Indian card spend tools incl. CRED](https://cardtrail.pages.dev/rewards/credit-card-spend-analysis-india) ·
[SBI Card Spend Analyzer](https://www.cardexpert.in/sbicard-spend-analyzer/) ·
[Walnut (Inc42)](https://inc42.com/startups/walnut) ·
[Fold (App Store)](https://apps.apple.com/in/app/id1626994334)

**Global apps:** [Monarch Using Reports](https://help.monarch.com/hc/en-us/articles/21846787088916-Using-Reports) ·
[Monarch Cash Flow](https://help.monarch.com/hc/en-us/articles/20504904768020-Cash-Flow) ·
[YNAB dictionary](https://www.ynab.com/the-ynab-dictionary-for-budgeting) ·
[YNAB Spending Trends](https://support.ynab.com/en_us/spending-trends-H1inlhzAc.md) ·
[Money Manager](https://apps.apple.com/app/id560481810) ·
[Spendee all-wallets budgets](https://medium.com/spendee/introducing-all-wallets-budgets-1f7ccf55b9d3) ·
[Spendee review (alerts, labels)](https://theworkmaster.blogspot.com/2024/01/spendee-review.html) ·
[Mint shutdown (NerdWallet)](https://www.nerdwallet.com/article/finance/mint-app-closing-what-it-means-how-to-pick-a-new-budget-service) ·
[Splitwise](https://apps.apple.com/us/app/splitwise/id458023433) ·
[Zoho Expense Android analytics](https://www.zoho.com/us/expense/kb/android/analytical-reports/)

**RuPay on UPI:** [NPCI operating circular](https://www.npci.org.in/PDF/npci/rupay/2022/Operating-circular-for-RuPay-Credit-Cards-linked-to-UPI.pdf) ·
[Razorpay](https://razorpay.com/docs/payments/payment-methods/upi/cc-on-upi/)

**Reward terms change:** [CardTrail devaluation 2025](https://cardtrail.pages.dev/rewards/reward-devaluation-hdfc-axis-icici-2025) ·
[Business Today 2026](https://www.businesstoday.in/personal-finance/banking/story/credit-card-rewards-reset-hdfc-sbi-axis-tighten-benefits-spend-linked-perks-take-centre-stage-524485-2026-04-07) ·
[Business Standard on SBI](https://www.business-standard.com/finance/personal-finance/sbi-card-reduces-reward-points-on-simplyclick-and-other-credit-cards-125031900403_1.html)

---

## Summary in six lines

1. Keep the Budget home to a hero, Add, up to three "needs attention" rows and five recent entries; move categories, "Paid with" and the full list to a new Spend Summary page.
2. Spend Summary is a month page with one scope chip (All accounts, a mode, a card network, or one instrument), then cards: total, daily average, vs last month, by category with subcategories, biggest spends, paid with, limits.
3. Each entry gets a leaf `categoryId` (parent or sub, no second field) and an optional `instrumentId`; mode is the route, the instrument is where the money came from, so UPI from a RuPay card is mode UPI plus that card.
4. "Delete" means hide and keep the name; a test proves no entry points at a missing category or card.
5. Rewards: store category, card, network and the user's own notes now; ship no card rates; any later rate is typed by the user and dated.
6. Build P0 validation, P1 model, P2 pickers, P3 summary first; settlements, alerts and rewards are separate, **unproven** decisions.

## Top 3 open questions for the owner

1. **Statement month or calendar month?** Card bills follow the card's cycle, not the 1st to 31st. Is the calendar month enough, or do you want a per-card "by statement" view (needs `billDay`, P5)?
2. **Track card bill payments and refunds now?** Without a "bill payment" entry type, logging both purchases and the payment double counts. Without refunds, a returned item cannot be taken off. Both change the entry sheet.
3. **Is "delete becomes hide and keep the name" right?** Today deleting a category makes its entries "Uncategorised" and moves old totals. The plan keeps old totals and offers "Move entries" as a choice.

*No critic pass was run: the owner asked for these features, and the risky parts (P5, P6, deletion
behaviour) are labelled and gated.*
