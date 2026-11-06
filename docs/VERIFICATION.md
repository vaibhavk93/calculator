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
| **HRA exemption** | **A** | Income-tax Rules 2026 Rule 279 (G.S.R. 198(E)) read from a Gazette copy; worked example from `docs/RESEARCH-BLOCKED-2026-11-06.md` section 2 reproduced in `hra.test.ts` | — |

## Product metrics

| Calculator | Status | Basis |
|---|---|---|
| A/B sample size | **A** | R `power.prop.test` documentation (two examples) and inverse-normal values |
| CAC/LTV, payback, funnel, ARR/MRR, retention, Rule of 40 | D | Standard definitions, hand-worked numbers |
| Markup and margin | B | Textbook example recalled, not fetched live: cost 80, price 100 gives markup 25% (on cost) and margin 20% (on price); second method margin = markup ÷ (1 + markup), so 50% markup = 33.33% margin. Both tested in `markup.test.ts` |

## Calculators from the 2026-11-06 research (`docs/RESEARCH-BLOCKED-2026-11-06.md`)

| Calculator | Status | Basis | Next cross-check |
|---|---|---|---|
| FD ladder | **A** for the two limits, **D** for the maths | DICGC cover Rs 5,00,000 per depositor per bank, principal and interest together (dicgc.org.in guide and FAQs). TDS limits Rs 50,000 / Rs 1,00,000 at 10%: Act s.393(1) Table Sl.5(ii), Finance Act 2026. Compounding: 1,00,000 at 7% quarterly for 5 years = 1,00,000 × 1.0175^20 = 1,41,478 (hand-worked). **Assumptions on screen:** one bank name = one depositor in one capacity; the "first year's interest" is each FD's first 12 months, not a tax-year tally. The no-PAN TDS rate is not modelled (not read). Tested in `fdLadder.test.ts` | A bank's own interest certificate |
| LTCG harvesting | **A** for the rules, **D** for the numbers | Act text read from the Gazette PDF: s.198(2)(a) 12.5% above Rs 1,25,000, s.2(101) long-term = more than 12 months, s.90(7)-(8) grandfathering (research section 5). Hand-worked: holdings gaining 60,000 and 1,00,000 fill the 1,25,000 room (60,000 + 65,000); 12.5% of 1,25,000 = 15,625, with 4% cess 16,250. Grandfathering cases (cost used 1,50,000 / 1,40,000 / 1,60,000) and the exact-12-months edge are in `harvest.test.ts`. **Not modelled, said on screen:** s.198(3) low-income reduction, surcharge, brokerage; no anti-wash-sale rule was read, so none is assumed. The 31 Jan 2018 value is an input and a pre-2018 holding without it is refused | An AMC capital-gains statement |

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

## Duration units: loans, unit converter, capital gains (2026-11-05)

| What | Grade | How it was checked |
|---|---|---|
| Balance transfer: months or years left | D | 15 years gives the same result as 180 months. A saved card with no unit reads as months and gives the engine's figure. Whole-month rule and 1 to 600 limit tested in `loanDurationUnits.test.ts` |
| Simple vs compound: years, months or days | D | P 100000 at 12% simple for 90 days: 100000 × 12 × 90 ÷ 365 ÷ 100 = 2958.9041 (hand-worked, matches). 3 months compounded monthly = 100000 × 1.01^3 − 100000 = 3030.10 exactly. 12 months, 365 days and 1 year give the same numbers. Old saved card gives the same four rows as before |
| Part of a compounding period | **Unproven** | Compounding a part period fractionally is one convention. Some lenders charge plain simple interest for the part period. The result says so; no lender document was checked |
| Unit converter: Month (1/12 of a 365-day year) | D | 1 year = 12 months, 1 month = 2,628,000 s = 30.4167 days. Other time units unchanged |
| Capital gains: "held 38 months, 3 years 2 months" | D | Display only. Months held comes from the same function as before; the tax rules were not touched |

## Duration units: savings calculators (2026-11-05)

| What | Grade | How it was checked |
|---|---|---|
| SIP in months: 5000 a month, 12%, 18 months | D | Hand loop, month by month, payment at the start of the month: 99,054.48 (float loop 99054.4752, closed form P × ((1+i)^n − 1) ÷ i × (1+i) with 1.01^18 = 1.196147 gives the same). 120 months gives 11,61,695, equal to 10 years (the audit figure was right). Step-up starts at month 13: 13 months with 10% invests 65,500. Tested in `savingsDuration.test.ts` |
| SIP for a goal in months | D | Whole years equal the old `goalSip` to the last digit. 18 months: the SIP asked for, run through an independent loop, plus the savings grown by 1.12^1.5, hits the target to 1e-9. "Already saved" still grows once a year; the note now says so (the monthly SIP part grows every month) |
| Lump sum in months and days | D | Whole years equal the old `lumpsum()`. 90 days at 12% on 1,00,000: 1,00,000 × 1.12^(90 ÷ 365) = 1,02,833.82. 365 days = 1 year exactly. A 365-day year is used; leap years are ignored (stated in the note) |
| Fixed deposit in days, months, years | D | 90 days, 7% compounded quarterly: 1,00,000 × 1.0175^(4 × 90 ÷ 365) = 1,01,725.82. 6 months equals 0.5 years |
| Effective yearly yield | D | (1 + 0.07 ÷ 4)^4 = 1.0175^4 = 1.0718590, so 7.1859% (the audit's 7.1859% and 1.07186 were right). Yearly compounding gives the rate itself; 12% monthly gives 12.6825% |
| Odd days in a deposit | **Unproven** | A part of a compounding period is compounded fractionally here. A bank may pay plain simple interest for that part instead. The result says so; no bank document was checked |
| Recurring deposit in months | D | 18 months equals 1.5 years; the table now ends with a "Month 18" row (it used to drop the part year); that row equals the headline maturity. Part months give "Time must come to whole months" |
| Inflation and CAGR in months | D | 18 months equals 1.5 years, 24 months equals 2 years. CAGR has no days option (1% in one day would read as 1.01^365 = 37.8 times a year) |
| Input limits | D | Return or rate 0 to 100 on sip, step-up, goal-sip, lump sum, swp, fd, rd, inflation; rates of 1e6, 100.01 and -1 are refused. Months 1 to 720 (sip family, rd); lumpsum at most 60 years; fd at most 50; inflation at most 100. Huge years in any unit give a plain error, never NaN or Infinity |
| Old saved cards | D | `savingsGolden.json` holds what the code gave before this change for the default and two samples of each of the nine tools. A card with no unit key must give the same rows, table, chart, formula and note. Only additions are allowed: the fd "Effective yearly yield" row and formula line, the rd part-year table row, the goal-sip cautious-side sentence |
