# Verification ledger

How each calculator was actually checked, as of **2026-11-02**. Source: the build workers' own reports
and the test comments. Update a row when you check something; never upgrade a row on a hunch.

**Status key**

| Mark | Meaning |
|---|---|
| **A** | Matches an outside source (law text, regulator, published table, Excel/R documentation) |
| **B** | Outside source recalled from memory or a secondary site, plus a second-method recomputation |
| **C** | Recomputed a second way only. No outside source |
| **D** | Hand-worked numbers only (plain arithmetic or calendar rules) |

A wrong number that looks right is the worst failure here, so rows marked **C** or **D** that handle
**money you might act on** are the ones to cross-check first (last column).

## What the app shows

A result carries a quiet "Checked against <source>" line only for tools rated **A** here: unit converter, GST (preset rates), EMI, home loan tax (rules), card EMI (GST rate), investment return (XIRR), PPF (limit and term), income tax (slabs), A/B sample size. It is the `verified` field on the tool spec. Rows rated B, C or D show nothing, because "recomputed only" is not a claim worth printing. When a row is upgraded to A, add `verified` to that spec.

## Everyday

| Calculator | Status | Basis | Next cross-check |
|---|---|---|---|
| Unit converter | A | NIST SP 811 exact factors | — |
| GST | A for presets, D for arithmetic | PIB release, 3 Sep 2025 (5 / 18 / 40%) | — |
| Currency | A for rates, D for cross rates | ECB via Frankfurter, dated 2026-10-30. Bundled snapshot, **not live** | Live refresh (not built) |
| Fuel efficiency | B | mpg conversions recalled from memory | — |
| Discount, tip, unit price, number base, fuel cost, grade average | D | Plain arithmetic | — |
| Split allocation (Tip and split shares) | D | Largest-remainder method. Tests check the shares always add to the total exactly (100/3, 0.01/3, 1/7, weights, zero, negative). No outside source needed: it is integer arithmetic | — |
| Date calculator, world time | D | Calendar and time-zone rules | — |
| Body metrics (BMI, BMR, ideal weight, body fat) | D | Published coefficients, not compared with another calculator | Low priority |
| Ovulation | D | Rule given in the brief, **no clinical source** | Low priority. Not contraception |

## Loans

| Calculator | Status | Basis | Next cross-check |
|---|---|---|---|
| EMI | **A** | Bajaj Finserv tables, Excel PMT | — |
| Amortisation schedule | A | Property test: balance ends at 0, principal sums to loan | — |
| Prepayment, rate change, reverse EMI | **C** | Second method (NPER, inverse EMI) | **Yes**: a bank's prepayment calculator |
| Balance transfer, credit card EMI | **D** | Hand check | **Yes**: one real card statement |
| Pay off several loans (C13) | **C** | Month-by-month plan (each EMI first, the rest to the first open loan, cleared EMIs roll on, last instalment is only what is left). Hand-worked one loan (₹1,000 at 12%, EMI 600: 2 months, ₹14.10 interest) and the first month of a two-loan case. Reference totals for two- and three-loan cases (months, interest, order, avalanche vs snowball) come from a separate exact-fraction re-run of the same method in Python, written for this check, **not an outside calculator**. No lender or bank tool was compared | **Yes**: a debt-payoff calculator or a lender statement, for avalanche vs snowball on the same loans |
| Money runway (C12) | **D** | Hand-worked: ₹7,00,000 at ₹85,000 a month = 8 months, 7 days, rounded down (20,000 ÷ 85,000 × 30 = 7.06). Part-pay interest saved hand-checked on ₹1,000 at 12%, EMI 600, ₹500 paid (₹9.10, one month sooner). Month = 30 days for the leftover days, by our choice. Uses the same loan maths as prepayment | Low: plain division. The part-pay figure (**C**) should be compared with a bank's prepayment calculator |
| Loan term box ("18 months", "20 years") | **D** | Parsing only, no new maths: 1.5 years = 18 months, a bare number is years, anything not a whole number of months is refused. Old saved cards (number plus years/months pick) are migrated and give identical results, tested | — |
| Home loan tax benefit | A for rules, D for results | Income-tax Act 2025 gazette sections read directly | An official worked example, if one exists |
| Card EMI GST (18%) | A | CBIC notifications 11/2017 and 12/2017 | — |
| Simple vs compound interest | B | NCERT examples, recalled | — |
| Typical loan rates | n/a | SBI only. Education, gold and car shown without rates | Add only with a dated source |

## Investments

| Calculator | Status | Basis | Next cross-check |
|---|---|---|---|
| XIRR / CAGR | A for XIRR, C for CAGR | Excel XIRR documentation example, matched to 8 places | — |
| PPF yearly limit, term, extensions | A | PPF Scheme 2019 gazette | — |
| PPF maturity figure | B | Published calculator figure, recalled | The official India Post calculator |
| SIP | B | ₹5,000 at 12% for 10 years = ₹11,61,695, recalled, plus month-by-month recomputation | A fund house SIP calculator |
| RD | B | India Post table via secondary sites | — |
| Lumpsum | B | Standard compound interest | — |
| FD, goal SIP, SWP, EPF, step-up SIP | **C** | Second method only | **Yes**: a bank FD calculator, EPFO calculator |
| FD after-tax value | **C, and simplified** | Slab rate on all interest. Ignores cess, surcharge, TDS | Label as rough, or model properly |
| Emergency fund, debt-to-income, savings rate | D | Plain arithmetic, hand-worked in `planning.test.ts`. Not externally verified. The DTI bands (36% / 50%) are common lender rules of thumb, **not checked against any lender or regulator**; they are editable. The months-by-situation guide (6 / 3-4 / 9-12 / 12) is a rule of thumb from competitor research, recomputed only | A lender's FOIR rule |
| Inflation, general and medical rates | D | Same formula as before, run twice with two rates. The 10% medical default is an example, not a sourced figure | A dated source for medical inflation |
| SWP, separate saving-years return | C | Recomputed only: 1.01^12 = 1.12682503 gives 11,26,825.03 for 10,00,000 at 12% for 12 months; the withdrawal phase is the old, unchanged simulation | A fund house SWP calculator |
| **Rates**: PPF 7.1%, EPF 8.25%, NPS annuity share and rate | **Not checked** | Press reports or nothing. Shown as editable "example rate" | Quarterly: finmin notification, EPFO circular, PFRDA |

## Tax (FY2026-27, AY 2027-28)

| Calculator | Status | Basis | Next cross-check |
|---|---|---|---|
| Income tax: slabs, both regimes | **A** | Budget Speech annexure table, incometax.gov.in table | — |
| 87A rebate and marginal relief, surcharge and its relief | **C** | Own recalculation at each boundary | **Yes**: CA or the official e-filing calculator |
| Capital gains | **C** | Own recalculation. One sale at a time, no surcharge, no loss set-off | **Yes** |
| Advance tax and 234B / 234C | **C** | Own recalculation | **Yes** |
| Gratuity | C | The old Act was replaced by the Code on Social Security on 21 Nov 2025. ₹20 lakh limits confirmed only via secondary sources | Primary source for the limits |
| Freelancer 44ADA | C | Own recalculation | Yes |
| In-hand salary | C | Built on the income-tax engine. Professional tax is a user input | Real payslip |
| **CII 384** | **Not confirmed** | Seen in search snippets of the official page only | Fetch the notification |
| **Finance Act 2026 as finally passed** | **Not checked** | Checked against the Finance Bill text and memorandum | Re-check before the next FY |
| **HRA exemption** | **Not built** | Current rule is in the Income-tax Rules 2026; no readable official copy | Fetch when readable |

## Product metrics

| Calculator | Status | Basis |
|---|---|---|
| A/B sample size | **A** | R `power.prop.test` documentation (two examples) and inverse-normal values |
| CAC/LTV, payback, funnel, ARR/MRR, retention, Rule of 40 | D | Standard definitions, hand-worked numbers |
| Markup and margin | B | Textbook example recalled, not fetched live: cost 80, price 100 gives markup 25% (on cost) and margin 20% (on price); second method margin = markup ÷ (1 + markup), so 50% markup = 33.33% margin. Both tested in `markup.test.ts` |

## Things that go stale

Each rule pack has one `RATES_AS_OF = { asOf, until }` (`src/engine/tax/rules.FY2026-27.ts`, `loans/rules.ts`, `investments/rates.ts`, `convert/gstRates.ts`). The calculators that use it print "Rates as of <month year>" and, from `until`, "These rates may have changed since <date>. Check the official source." **When you re-check a pack against its source, move `asOf` to today and `until` to the next boundary.** `until` is a judgement: 1 Apr 2027 for tax, 1 Jan 2027 for loan market rates and small savings (quarterly), 31 Mar 2027 for GST (no schedule). Tests: `src/lib/ratesFresh.test.ts`, `src/features/tools/rates.test.ts`.

| What | Changes | Check |
|---|---|---|
| Tax slabs, deductions, surcharge | Every Budget (Feb) | Before 1 April |
| Small-savings rates (PPF, etc.) | Every quarter | First week of Jan, Apr, Jul, Oct |
| EPF rate | Yearly | After the EPFO announcement |
| GST slabs | No schedule | When the Council meets |
| Currency snapshot | Daily | Live refresh not built, so the snapshot ages |
| CII | Yearly | With the Budget |
