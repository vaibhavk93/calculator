# Competitive research and plan — the delta

**Written:** 2026-11-02. **Read-only research.** No code was changed.
**Sources:** this repo's own docs; the two sibling repos `Financial Advisor/` and `Retirement Plan/`; web pages for ET Money, ClearTax, CalcKit and TickTick.

## ⚠ Read this before anything else

`docs/REVIEW-NEW-FEATURES.md` already did a competitor sweep on the same day. It covered
Splitwise, CRED, Walnut, YNAB, Money Manager, ClevCalc, Samsung, Groww and Zerodha, and it
produced 25 candidates and a three-release order. **This file does not repeat it.**

This file is the **delta**: what the two sibling repos and four catalogues add on top, and
what is already planned so it does not get suggested a third time. Section 4 names every
overlap explicitly.

**The one-line verdict:** the sibling repos contribute **correctness rules and conditions**,
not features. The best things found are four cheap arithmetic additions over data Calc already
stores, and one design rule that makes every rule-of-thumb result honest. The catalogues
(ET Money, ClearTax, CalcKit) contribute **one real tool gap** — the India small-savings
schemes Calc is missing — and nothing else worth building.

---

## 1. Every idea found, and whether it fits

**Fit** is judged against Calc's stated promise: offline, no account, almost no permissions,
money is never a JavaScript `number`, and *"a missing calculator is recoverable; a confidently
wrong tax figure is not."*
**New?** = not already in `BACKLOG.md`, `ROADMAP.md`, `REVIEW-NEW-FEATURES.md`, `BUDGET-PLAN.md`
or `NOTES-TODO-PLAN.md`.

### From the sibling repos

| Idea | Source | Fits? | New? | One line |
|---|---|---|---|---|
| Emergency-fund months by **situation** (3 / 6 / 12 / 18–24; near-subsistence ≈ 1 month of income) | Retirement Plan `ROADMAP.md` §3b | **Yes** | **New** | Calc's planned D16 defaults to one number; a freelancer must never be shown "3 months" silently |
| Every rule-of-thumb carries **three fields: the number, the condition it assumes, what changes it** | Retirement Plan `ROADMAP.md` §3b | **Yes** | **New** | A design rule, not a feature. Pairs with backlog #4 ("checked against X") and costs almost nothing |
| **Two inflation rates** — general vs medical — instead of one | Retirement Plan `APP-PLAN.md` §5 | **Yes** | **New** | Calc's D11 blends them into one number, which that repo calls the standard error |
| **Different return rate for the saving years and the withdrawing years** | Retirement Plan `research/03-competitive.md` | **Yes** | **New** | Calc's SWP takes one rate; one source there calls a single rate "one of the most common errors" |
| **Largest-remainder allocation** so split parts sum to the whole exactly | Financial Advisor `26-financial-calculation-specifications.md` CALC-RULE-004 | **Yes** | **New** | A ₹100 bill split 3 ways must total ₹100.00, not ₹99.99. Affects tip split today and backlog #20 |
| **Posting date, not transaction date**, decides which card statement a purchase lands in | Financial Advisor CALC-040 | **Yes** | **New** | A caveat for the planned statement-month view (7f): get it wrong and both cycles are wrong |
| **Credit utilisation and available credit** per card | Financial Advisor FEAT-CARD-008/009 | **Yes** | **New** | Calc already stores the credit limit; this is one subtraction and one percentage |
| **"What this card has cost you"**: annual fee + fee and interest entries, per card per year | Financial Advisor FEAT-CARD-011 | **Yes** | **New** | Calc stores the annual fee but never adds up what a card took back |
| Reward suggestion must show **cap headroom** and must **refuse** when rules are missing | Financial Advisor UX Screen 7 | **Partial** | **New detail** | Refines the already-planned, already-risky 7g. The refusal pattern is worth keeping even if 7g never ships |
| **Bulk recategorise** several entries at once | Financial Advisor FEAT-EXP-028 | **Yes** | **New** | After a month of entries, renaming a habit by hand row by row is the thing that stops people tidying |
| **Suggest** that an entry looks recurring, from repeats already in your own data | Financial Advisor FEAT-EXP-020/021 | **Partial** | **New** | Cheaper than typing a recurring bill, but unproven and it can guess wrong |
| **Edit history on an entry** ("changed 2 Nov, was ₹900") | Financial Advisor FEAT-EXP-017 | **Partial** | **New** | Undo exists; a trail does not. Useful only once entries are weeks old |
| **CSV import** of expenses, with preview-and-confirm and duplicate tiers | Financial Advisor FEAT-CORE-012, CALC-030 | **Partial** | **New** | Calc plans export only. Import means parsing someone else's file — a correctness risk, so it needs the preview rule |
| **Reconcile a month** against the bank statement (tick "this matches") | Financial Advisor FEAT-EXP-024 | **Partial** | **New** | Honest, but it only pays off for someone who opens a statement monthly |
| **One monthly-income field** so "savings rate" is real, not typed twice | Financial Advisor FEAT-FLOW-001/005 | **Partial** | **New** | Makes Budget's "left this month" mean something; also a screen the owner did not ask for |
| **Multi-currency per entry** with a dated rate | Financial Advisor FEAT-CORE-004, CALC-070 | **Partial** | **New** | Needs the live-rate fetch that is still unbuilt (PRD H4) |
| **Multiple goals**, each with its own horizon and priority, and **what each costs retirement** | Retirement Plan M3b | **Partial** | **New** | Calc's D4 plans one goal. This is planning, not calculating — a bigger step than it looks |
| **LTCG harvesting**: how much gain can be booked tax-free this year | Retirement Plan `APP-PLAN.md` §5 | **Partial** | **New** | Plain arithmetic, but the exempt limit must come from a primary source |
| **Direct vs regular plan cost drag** over N years | Retirement Plan §5 | **Yes** | **New** | One multiplication; the expense ratios are typed by the user |
| **Sequence-of-returns stress test** (a crash in year 1 vs year 10) | Retirement Plan §5 | **Partial** | **New** | Needs a chart to be readable, and no chart library is wired in |
| **Readiness gates** (emergency fund, term cover, health cover, savings rate) as a "money check-up" | Retirement Plan M2 | **Partial** | **New** | Edges from "calculate" into "advise". Only safe if every gate shows its condition |
| **Check-in**: snapshot state, diff it next time | Retirement Plan M8 | **Partial** | **New** | Interesting for net worth and scenarios; no evidence it is wanted |
| **Portfolio X-ray** (fund overlap, look-through concentration) | Retirement Plan M4 | **No** | New | Needs uploaded AMC disclosure files. Out of scope and out of promise |
| Account Aggregator / bank connect | Both repos | **No** | Already ruled out | Needs a licence and a server. Both repos independently found it blocked |

### From the four catalogues

| Idea | Source | Fits? | New? | One line |
|---|---|---|---|---|
| **SSY, NSC, VPF, SCSS / Post Office MIS** calculators | ET Money + ClearTax catalogues (read 2026-11-02) | **Partial** | **New** | The same shape as PPF, which Calc already has; the only hard part is the quarterly rate, which `DATA-FRESHNESS.md` already has a mechanism for |
| **Margin / markup** | CalcKit Finance folder | **Yes** | **New** | A genuine everyday gap: Calc has 7 business metrics and no markup |
| **Speed, distance and time** | CalcKit Miscellaneous | **Yes** | **New** | Pairs with fuel cost under "Trip costs". Tiny, and no evidence it is wanted |
| **FIRE number** | ET Money | **Yes** | **New** | Trivial arithmetic — but Retirement Plan's own research says corpus calculators are "free, crowded and already decent" |
| **Term-insurance cover needed** | ET Money; Retirement Plan M2 | **Partial** | **New** | A rule of thumb. Only ships with its condition attached |
| **80C / tax-saving shortfall** ("how much more to invest") | ClearTax | **Partial** | Partly planned | `MEMORY-LAYER.md` D2 names the use case; no tool exists |
| **TDS calculator**, GST late-fee and interest, HSN lookup | ET Money, ClearTax | **No** | New | Rates and penalty rules change by circular. Gated, and no evidence of need |
| **Leave encashment**, **Cost Inflation Index lookup** | ClearTax | **Partial** | Partly planned | Both are inside the gated E8 and the existing capital-gains tool |
| **Custom, user-written calculators** | CalcKit "Custom Tools" | **No** | **New** | Collides with the hard rule *"tool ids and field ids never change"* — a saved card stores inputs by field id, so a user-editable form breaks old saves |
| **Mathpad** — a multi-line pad where each line computes and carries a label | CalcKit | **Partial** | **New framing** | Calc half has it: Notes lists already label lines and total them. Letting a list line accept arithmetic is the cheap half of PRD F6 |
| Algebra, geometry, electronics packs (150+ tools) | CalcKit | **No** | Already ruled out | `PRD.md` non-goals: "breadth-for-breadth's-sake (CalcKit's electronics/geometry/algebra packs)" |
| **Repeat by completion date** ("30 days after I tick it") | TickTick help centre (checked) | **Yes** | **New** | The right answer for "service the car every 6 months"; Calc's repeats are all fixed-calendar |
| **Several reminders on one item** (7 days before *and* on the day) | Apple Reminders, TickTick (reportedly) | **Yes** | **New** | Calc's `Reminder` has a single `leadDays`; making it a short list is a small change |
| Custom repeat: daily, weekly, every N days, weekdays | TickTick (checked) | **Yes** | Already planned | `NOTES-TODO-PLAN` phases 2 and 4. Worth noting the code `Repeat` type is still only `none \| monthly \| quarterly \| yearly` |
| **Photo on a note** (a receipt or bill) | Google Keep; PRD G3 | **Partial** | Specced, unplanned | PRD G3 names it; nothing is built and it is in no backlog. Needs a photo permission, which fights the promise |
| **Voice capture** | Google Keep, Samsung Notes | **n/a** | — | Android's own keyboard mic already dictates into any Calc text field. **Build nothing** |
| **"Last day of the month" repeat** | Apple Reminders, TickTick | **n/a** | Already solved | Calc's `anchorDay` already clamps 31 → 28 → 31 without drifting |
| **Savings goal tied to the budget** | Monefy, Money Manager (low-confidence sources) | **Partial** | **New** | Behaviour-change again. My sources were listicles and store pages: **low confidence** |

---

## 2. What to do, if anything — by area

Priority is value to **this** owner over effort, under Calc's own rules. Anything whose only
argument is "other apps have it" is not here.

```
                    THE DELTA, IN THREE SIZES
           (everything already in BACKLOG/ROADMAP is excluded)
                              |
      +-----------------------+-----------------------+
      v                       v                       v
#===================#  +-----------------+   +-------------------+
# * A. FIVE SMALL   #  |  B. ONE TOOL    |   | C. EVERYTHING     |
#   CORRECTIONS     #  |     GROUP       |   |    ELSE           |
#   + 1 design rule #  +--------+--------+   +---------+---------+
#===================#           |                      |
      |                  + fills a real India    - unproven demand
 + each is hours, not     gap (SSY/NSC/VPF)      - or needs a chart
   days                  - each needs a          - or needs a new
 + all are arithmetic      quarterly rate from     permission
   over data already       a primary source      - or fights a rule
   stored                - gated until checked
 + several are bug-
   prevention, not
   features

  * = recommended first    # box = the pick
```

---

### A. Tools — high

| # | Do | Why for **this** app |
|---|---|---|
| A1 | **Largest-remainder split**: make the parts of any split sum to the whole, exactly, with a test | Calc's whole claim is exact decimal money. A tip split that loses a paisa is the one bug that would embarrass it. Fixes `tip` today and protects backlog #20 before it is written |
| A2 | **Rule-of-thumb = number + condition + what changes it** (a shared result row, not new screens) | Calc already plans "checked against X" on every result (backlog #4). This is the same idea for rules rather than formulas, and it is what stops D16 telling a freelancer "3 months" |
| A3 | **Emergency fund with the situation table** (3 / 6 / 12 / 18–24, and ≈1 month of income near subsistence) | Turns planned D16 from a division into the only version that is not misleading. Needs A2 to exist first |
| A4 | **Second inflation rate for medical costs** on the inflation tool | Every Indian calculator the sibling repo checked blends them. One extra optional field, user-typed, no built-in number claimed as fact |
| A5 | **Second return rate for the withdrawal years** on SWP | Same: one optional field. The sibling repo's sources call the single-rate version an error, and SWP is the tool where it bites |

### A. Budget — high

| # | Do | Why for **this** app |
|---|---|---|
| A6 | **Utilisation line per card**: "₹38,000 of ₹2,00,000 used · 19%" | The credit limit is **already stored** (FEATURES row 22) and nothing reads it. This is the cheapest unused data in the app |
| A7 | **Posting-date rule written into the statement-month plan** before 7f is built | `BUDGET-PLAN.md` §C and the 7f plan do not mention it. A 30 Mar purchase that posts 2 Apr belongs to April; getting it wrong misstates two months at once, silently |

---

### B. Medium — worth it, but not this week

| Area | Item | Why, and the catch |
|---|---|---|
| Tools | **Small-savings pack: SSY, NSC, VPF, SCSS/Post Office MIS** | The one real catalogue gap; same engine shape as PPF. **Catch:** four more quarterly rates to keep fresh. Ships only with the rate in config and a primary-source link, per the project rule |
| Tools | **Direct vs regular plan cost drag** | One multiplication over user-typed expense ratios, and it answers a question that costs real money over 20 years |
| Tools | **Margin / markup** | A genuine everyday gap next to GST and discount. Hours of work |
| Due | **Repeat by completion date** | The only repeat shape Calc cannot express at all, and the natural one for maintenance and health items. A small addition to `advance()` |
| Due | **Several lead times on one reminder** (7 days before *and* on the day) | `leadDays` is already there as a single number; a list of at most three is a small change and it is how a card bill actually wants to be remembered. **Gate:** do not touch this until reminder delivery is proven on the phone (backlog #3, #35) |
| Budget | **Bulk recategorise** | The chore that makes people stop tidying their own data. Only matters once there is a month of entries |
| Notes | **Arithmetic on a list line** ("rent 25000 + 2000") | Calc's lists already label and total; making the line itself compute is the cheap half of PRD F6, and it reuses the existing engine |
| Budget | **"What this card has cost you"** (annual fee + fee and interest entries, per year) | Honest, user-typed, and the counterweight to the risky rewards idea. Depends on nothing new |

---

### C. Low — recorded, not recommended

One line each, so none of these has to be re-derived later.

- **FIRE number** — trivial, but the sibling repo's own research says there is no gap here.
- **Term-insurance cover needed** — a rule of thumb; only with A2, and no evidence it is wanted.
- **80C shortfall tool** — the use case is named in `MEMORY-LAYER.md` D2; the income-tax tool already shows the deduction, so the gap is small.
- **LTCG harvest helper** — real money, but the exempt limit needs a primary source first.
- **Multiple goals with a priority waterfall** — crosses from calculating into planning; a week of work minimum.
- **Sequence-of-returns stress test** — needs the unbuilt chart work (ROADMAP §3).
- **Money check-up / readiness gates** — edges into advice; only with every condition shown.
- **Check-in snapshot and diff** — no evidence it is wanted.
- **Recurring-entry suggestion from your own data** — cheaper than typing, but it can guess wrong, and manual recurring bills (already planned) must come first.
- **Edit history on an entry** — only pays off on weeks-old entries.
- **Reconcile a month against a statement** — only for someone who opens statements monthly.
- **One monthly-income field in Budget** — makes savings rate real; adds a screen nobody asked for.
- **CSV import** — needs preview-and-confirm and duplicate tiers to be safe; export (already planned) delivers most of the trust for a fraction of the risk.
- **Multi-currency entries** — blocked on the unbuilt live-rate fetch (PRD H4).
- **Speed, distance and time** — tiny; no evidence of need.
- **Photo on a note** — specced in PRD G3, in no backlog; needs a photo permission that fights the promise.
- **Savings goal in Budget** — low-confidence sources, and it is the behaviour-change trap again.

---

## 3. Considered and ruled out — do not suggest these again

### 3a. Ruled out by the promise (offline, no account, almost no permissions)

| Idea | Who does it | Why not |
|---|---|---|
| Read SMS to log spending | Walnut and clones | Already rejected in `PRD.md`, `BACKLOG.md`, `BUDGET-PLAN.md` §I and `REVIEW-NEW-FEATURES.md` §D. **Confirmed from the PRD**: capture "breaks the 'no account, almost no permissions' promise" |
| Bank linking / Account Aggregator | CRED, Fold, INDmoney | Needs a licence and a server. **Both sibling repos reached this independently**: AA access requires you to already be regulated, and EPF/PPF are not even available on it |
| Statement PDF or email ingestion | Financial Advisor FEAT-ING-011/013 | A large new parsing and privacy surface for a one-person offline app |
| Accounts, cloud sync, shared or household budgets | Splitwise, Goodbudget, Monarch | Breaks "no account". Splitwise's real value is a *shared* ledger, which a one-person offline app cannot provide — so the ledger half stays out and only the split maths comes in (already decided in `REVIEW-NEW-FEATURES` C8) |
| AI categorisation, chat over your money, auto-sorting | Paytm tags, "Ask Google Pay" | Needs a cloud call or a big on-phone model. The cheap answer is already built: defaults from the last entry with the same note |
| Live gold, FD or market rates | Jeweller sites, brokers | Adds a freshness duty the app cannot honour. Rates are typed by the user |
| Built-in card reward-rate database | CRED, cardtrail | Terms changed in April 2026 and sources disagree. **A confidently wrong figure breaks the project's core rule** |
| Brokerage, margin, TDS calculators | Zerodha, Groww, ET Money | Charges and rates change by broker and by circular; no evidence the owner trades |
| Ads, analytics, crash SDKs, cloud backup | Most free apps | Breaks the privacy position outright |

### 3b. Ruled out by the design system — **these ideas are void, not deferred**

Each one is a real feature in a real competitor and each one is impossible here as drawn.
The rule is quoted so the argument does not restart.

| Idea | Who does it | The rule it breaks |
|---|---|---|
| Pie, donut, treemap or Sankey spending charts | Monarch, Money Manager, PhonePe, Spendee | No chart library, and `ROADMAP.md` §3: *"a picture replaces a number only when it shows something the number cannot"*. A pie hides small slices. Plain bars with exact numbers are already the plan |
| A user-chosen colour per category or per note | Google Keep (11 colours), Monefy, Spendee | `DESIGN-SYSTEM.md`: *"A tint is identity, never state"*; tints must stay out of red, green and the accent, and are enforced by test. Eight section tints are the whole palette |
| Red/green rings, gradient progress arcs, coloured side stripes | CRED, most trackers | No gradients, no `box-shadow`, no coloured side-stripe borders. `positive`/`negative` only where good and bad are unambiguous, and **never as the only signal** |
| A category card inside a group card | Monarch, CRED | *"One level of card. A section card holds rows, not cards"* |
| Swipe-to-complete or swipe-to-delete as the only control | Todoist, Apple Reminders, Clear | `NOTES-TODO-PLAN` §H: an edge swipe is also Android's back gesture, and a visible button must sit beside any swipe. Phases 1–3 are tap only |
| Pull-to-add a row | some to-do apps | Same section: too hard to find |
| A sixth tab (To-do, Bills, Cards) | TickTick, Money Manager | Five tabs is the limit, and the five-label check at 200% font is **still not done** (backlog #49) |
| Uppercase, letter-spaced section headers ("MY CARDS") | nearly everyone | `text-transform: uppercase` and positive letter-spacing are banned outright |
| A spinner while a 6-month trend loads | nearly everyone | *"Loading: skeleton rows… **Never a spinner**"* |
| A floating action button with a drop shadow over content | Material apps | No `box-shadow`; and every control must be at least 44px in one direction without shrinking its neighbours |
| Gamified score, streaks, coins, karma | TickTick karma, CRED coins | *"Accent means 'you can act on this.' It never means 'this is good.'"* And no evidence it helps one person |
| A fourth action button in the row after "=" | — | The action row has a **fixed height so the layout cannot shift** (a hard-won rule). `REVIEW-NEW-FEATURES` C5 already flags that a fourth button may not fit at 360px |
| User-written custom calculators | CalcKit Custom Tools / AI Builder | *"Tool ids and field ids never change: saved items store inputs by field id."* A user-editable form has no stable field ids, so it would break old saved cards |

### 3c. Ruled out on evidence, including the owner's own

| Idea | Why not |
|---|---|
| YNAB-style "give every rupee a job", rollover, age of money | A behaviour-change product. `ROADMAP.md` §4 quotes the owner's own earlier planning note: *"abandoned in week two"* |
| Any new Budget feature before a month of real use | **Corroborated three ways now.** `ROADMAP.md` §4 sets the gate; `Financial Advisor` defers budgeting out of its own MVP for the same reason; and `Retirement Plan`'s M10 — the owner's own manual expense tracker, shipped — records: *"manual entry has poor real-world sustained use — this is honest as an occasional pre-check-in tool, not a live daily tracker."* Three independent arrivals at the same conclusion |
| Net-worth **tracker** (as opposed to the planned one-off D14 snapshot) | Needs constant updating. `Financial Advisor` rejects it as *"exactly the 'fabricated financial fact'"* its own principles forbid |
| "100 minus age" asset allocation | `Retirement Plan` §3b: the evidence says do not use it; one study found it among the worst performers in a downturn |
| Another retirement corpus calculator | `Retirement Plan` `research/03-competitive.md`: *"There is no wedge in building another corpus calculator. It is free, crowded and already decent"* |
| GST invoice maker, plot a function | Separate products; Desmos exists and is free. Already in `REVIEW-NEW-FEATURES` §D |
| Voice-to-text capture | Not needed: the Android keyboard's own mic already dictates into any Calc text field |

---

## 4. Cross-reference: already planned vs genuinely new

Nothing below is a new suggestion. This section exists so a future reader can tell the two apart.

### 4a. Found again, **already planned — do not duplicate**

| Idea | Where it already lives |
|---|---|
| Reminder time picker, "Send a test reminder" | `BACKLOG.md` #6, #35; `IMPROVEMENT-PLAN.md` now-4 and now-6 |
| Daily / weekly / "every N days" / weekday repeats | `NOTES-TODO-PLAN.md` phases 2 and 4 |
| Natural-language quick add ("pay rent fri !") | `NOTES-TODO-PLAN.md` phase 3; `PRD.md` F3 |
| Subtasks / steps, priority flags, Today view, undated inbox | `NOTES-TODO-PLAN.md` phases 1 and 2 (phase 1 is built, unproven) |
| Tags, pin, search over notes and tasks | **Built** (`SavedScreen.tsx` has the search box) |
| Snooze, Mark paid, overdue first, 30-day due total | **Built** (Due tab) |
| "Remind me X days before" | **Built** — `Reminder.leadDays`, used by `notifications.ts` |
| Recurring bills and subscriptions with a per-year total | `REVIEW-NEW-FEATURES.md` #11 / C3 |
| Statement-month view and a card bill reminder | `ROADMAP` 7f; `REVIEW-NEW-FEATURES.md` #12 / C7 |
| Unequal split and who-owes-whom | `BACKLOG.md` #20; `REVIEW-NEW-FEATURES.md` #8 / C8 |
| CSV **export** for a CA or ITR | `REVIEW-NEW-FEATURES.md` #20 / C4 |
| Text search over expenses | `REVIEW-NEW-FEATURES.md` #14 |
| "Add expense" from a calculator result | `REVIEW-NEW-FEATURES.md` #13 / C5 |
| Use a result in another tool | `PRD` A22; `BACKLOG.md` #19; `REVIEW-NEW-FEATURES.md` #1 / C6 |
| HRA exemption **and a rent receipt** | `BACKLOG.md` #23; `REVIEW-NEW-FEATURES.md` #5 |
| Refunds as negative entries | `BUDGET-PLAN.md` §I and open question 2; `ROADMAP` 7h |
| Subcategories, instruments, settlements, spend summary, filters | `BUDGET-PLAN.md` D–F (**built**, FEATURES rows 19–25) |
| Limit alerts at 80% / reached / over, in words | `BUDGET-PLAN.md` §F (**built**, 80% line unproven) |
| Trip or event label with its own total | `REVIEW-NEW-FEATURES.md` #15 |
| Reward helper from **user-typed** rates only | `BUDGET-PLAN.md` §E; `ROADMAP` 7g |
| Net worth, debt-to-income, emergency fund, savings rate | `PRD` D14–D17; `FEATURES.md` phase 4, all **Planned** |
| Card minimum-due trap, card annual fee verdict, runway, multi-loan avalanche/snowball | `PRD` C12–C15; `FEATURES.md` phase 3, all **Planned** |
| Exit settlement (full and final) incl. leave encashment | `PRD` E8 — **Gated**: rules unchecked |
| Tax-date reminder packs (advance tax) | `REVIEW-NEW-FEATURES.md` #18 / C2 |
| App lock, widgets, quick tile, share-sheet intake | `PRD` H9–H13; `BACKLOG.md` #27; `REVIEW-NEW-FEATURES.md` #23–#25 |
| Backup nudge; "checked against X" on every result | `BACKLOG.md` #18, #4 |
| World clock that ticks, split bar, line chart, date span | `ROADMAP.md` §3; `BACKLOG.md` #41 |

### 4b. Genuinely new in this pass

Grouped by where they would go. Everything here is absent from every existing plan doc.

| Area | New items |
|---|---|
| **Correctness / shared rules** | Largest-remainder split allocation (A1) · rule-of-thumb three-field disclosure (A2) · posting-date rule for statement cycles (A7) |
| **Tools** | Emergency-fund situation table (A3) · medical inflation rate (A4) · withdrawal-phase return rate (A5) · small-savings pack SSY/NSC/VPF/SCSS · direct-vs-regular cost drag · margin/markup · FIRE number · term cover · LTCG harvest · multiple goals with priority · sequence-of-returns test · money check-up gates · speed/distance/time |
| **Notes** | Arithmetic on a list line · photo on a note (specced in PRD G3, in no backlog) |
| **Due** | Repeat by completion date · several lead times on one reminder |
| **Budget** | Card utilisation line (A6) · "what this card has cost you" · bulk recategorise · recurring-entry suggestion · entry edit history · CSV import with preview and duplicate tiers · monthly reconcile · monthly income field · multi-currency entries · savings goal |
| **Evidence, not a feature** | A third independent arrival at "manual expense entry is not sustained" — from the owner's own shipped `Retirement Plan` M10 |

---

## 5. Honesty notes

- **ET Money, ClearTax and CalcKit catalogues were read directly** (their own pages, 2026-11-02). The CalcKit *website* folders are a subset of the Android app's claimed 150+ tools, so "CalcKit has nothing else Calc wants" is **partly inferred**, not fully verified.
- **TickTick's custom repeat** (by due date, by completion date, by specific dates) is from TickTick's own help centre: **checked**.
- **Apple Reminders' and Todoist's behaviour** here is **reportedly** so, from second-hand pages; `NOTES-TODO-PLAN.md` carries the same caveat.
- **Monefy and Money Manager savings goals**: **low confidence** — listicles and store pages only.
- Every number quoted from the sibling repos (6.5% and 13% inflation, 0.65% / 0.35% cost drag, ₹1.25L LTCG, the 3/6/12/18–24 month table, retention percentages) is **that repo's research, not verified here**. Per `CLAUDE.md`, none of them may be shipped as a built-in default; they are user-typed inputs or labelled assumptions.
- **No critic pass was run on this file.** It recommends no new feature that changes behaviour in a way that is hard to undo; the five A-items are arithmetic corrections and one disclosure rule. If the owner wants to build anything from section B, the global rule applies: one fresh critic first.

## 6. Summary in six lines

1. `REVIEW-NEW-FEATURES.md` already did the competitor sweep. **This file is only the delta**, and section 4a lists the 28 ideas that are already planned.
2. The sibling repos' real contribution is **rules, not features**: exact split allocation, posting-date cycles, and "every rule of thumb shows its condition".
3. The five cheapest wins are all arithmetic over data Calc already has: exact splits, the condition rule, the emergency-fund situation table, a medical inflation rate, and a withdrawal-phase return rate.
4. The one unused asset in the app is the **stored credit limit** — one subtraction gives utilisation.
5. The only real catalogue gap is the **India small-savings pack** (SSY, NSC, VPF, SCSS), and it is gated on four more quarterly rates.
6. Twelve competitor features are **void, not deferred** — they break a named design rule (pies, per-category colour, nested cards, swipe-only rows, a sixth tab, uppercase headers, spinners, shadowed FABs, gamified scores, user-written calculators, a fourth button after "=", gradient arcs). Section 3b quotes the rule for each.
