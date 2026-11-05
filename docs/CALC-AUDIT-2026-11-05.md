# Calculator audit: time units and other gaps (2026-11-05)

Owner complaint: "everything is in years; it should be days, months and more." This file is the evidence and the build plan. Read-only audit; no source file was changed.

## Verdict

- **57 calculators. 11 need a new duration unit control.** 7 more already take months or years (the loan term box). The rest have no duration, or one that is naturally months.
- The complaint is **true for the savings group** (SIP, FD, RD, lumpsum, inflation, CAGR, SWP), simple vs compound interest and balance transfer. It is **already fixed** for loans (`tenure` accepts "18 months" or "20 years", `src/engine/loans/term.ts:10`).
- **Smallest safe design:** keep each field id; add an optional unit list to a number field; store the chosen unit in one derived key `<id>__unit`. A missing key means the unit the box meant before. Old saved cards cannot be misread (section C).
- **Three existing bugs** (section B, items 6, 9, 10). Fix them in the same pass.

Legend: **OK** fine; **UNIT** needs the new control; **ADD** needs a new field.

---

## A. Inventory

Sources: `src/features/tools/*.ts`, `src/lib/tool.ts`. "years" in a quote is the field's shown unit.

### Loans and EMI (13)

| Tool id | Time inputs (field id, as shown) | Other notable | Flag |
|---|---|---|---|
| emi | `tenure` text box, "18 months" / "20 years", bare = years | amount, yearly rate | OK. ADD: loan end date, EMI count |
| amortisation | `tenure` box; `view` yearly/monthly | same | OK. Fix: table default for short loans |
| prepayment | `tenure` box; `after` "EMI number" (months, a count) | amount, mode | OK. ADD: extra every month |
| reverse-emi | `tenure` box | EMI | OK |
| rate-change | `tenure` box; `from` "EMI number" (a count) | rate change, mode | OK |
| loan-compare | rows column `tenure` (text) | fee | OK |
| home-loan-tax | `tenure` box | slab, regime | OK |
| balance-transfer | `months` "Months left" (months) | two rates, fees | **UNIT** (months or years) |
| simple-compound | `years` "Duration" (years, up to 100) | rate per year only; `freq` | **UNIT** (years/months/days), ADD dates, rate per month |
| card-emi | `tenure` months, whole, 1 to 120 | fee | OK (months is natural) |
| loan-presets | none; shows "usual term" text | type, amount | OK |
| multi-loan | none (EMIs are monthly) | rows of loans | OK; output text "20 y 0 m" is clumsy |
| runway | none; output months + days (30-day month) | cost, loans | OK |

### Savings and investing (15)

| Tool id | Time inputs | Other notable | Flag |
|---|---|---|---|
| sip | `years` "Number of years", whole only | monthly, return | **UNIT** (years/months) |
| step-up-sip | `years`, whole only | yearly raise % | **UNIT** |
| lumpsum | `years`, whole only | yearly compounding | **UNIT** (years/months/days) |
| goal-sip | `years`, whole only | target, saved | **UNIT**, ADD "by date" |
| swp | `wait` "Years of saving first", whole, advanced | withdrawal | **UNIT** (years/months) |
| fd | `years`, fractions allowed | `comp` (quarterly default) | **UNIT** (years/months/days), ADD maturity date |
| rd | `years`, must come to whole months | monthly | **UNIT** (months/years) |
| ppf | `years` select 15 to 35 | yearly deposit | OK (scheme is in years) |
| nps | `age`, `retire` (years of age) | annuity | OK |
| epf | `years` to retirement, whole | salary rise | OK (low value) |
| inflation | `years`, fractions allowed | two rates | **UNIT** (years/months) |
| cagr-xirr | `years`; XIRR rows have dates | start, end | **UNIT** (years/months/days), ADD dates mode |
| emergency-fund | `months` target | expenses | OK |
| debt-to-income, savings-rate | none | | OK |

### Tax (6), Everyday (15), Business (8)

| Tool id | Time inputs | Flag |
|---|---|---|
| gratuity | `years` + `months` (two boxes, 0 to 11) | OK |
| advance-tax | `months` after 31 Mar (part month counts) | OK |
| capital-gains | buy and sell dates; output "held N months" | OK. Show years and months |
| date | diff, add (days/weeks/months/years select), age | OK |
| unit-converter | time: ms, s, min, h, day, week, year (365 d) | ADD month (`units.ts:51`) |
| income-tax, in-hand-salary, presumptive-44ada, world-time, ovulation (`cycle` days), percentage, discount, gst, tip, unit-price, currency, number-base, fuel-cost, fuel-efficiency, body-metrics, grade-average | no duration, or days already | OK |
| cac-payback, arr-mrr (`months`), retention, funnel, rule-of-40, cac-ltv, ab-sample-size (days), markup | months or days already | OK |

**Count of UNIT tools: 11** = sip, step-up-sip, goal-sip, lumpsum, swp, fd, rd, inflation, cagr-xirr, simple-compound, balance-transfer.

"Prepay after EMI number" and "Change applies from EMI" are counts of instalments, not durations. Do not add a unit there: "after 2 years" is EMI 24 for one and EMI 25 for the other.

**Not in the app** (owner's list): notice period, late fee, bond or T-bill, salary per day or hour, break-even, savings target date. Handled in D and E.

---

## B. Top 12 improvements, by value over cost

| # | Change | Tools | Why (evidence) | Cost |
|---|---|---|---|---|
| 1 | Months for SIP family | sip, step-up-sip, goal-sip | `wholeYears` rejects 0.5 or 18 months (`invest.ts:18`). People run 18 and 30 month SIPs | M |
| 2 | FD in days, months, years + maturity date + effective yield | fd | FDs run 7 days to 10 years (secondary); field is years only (`invest.ts:245`) | M |
| 3 | RD in months | rd | RD is sold by month; field forces "1.5 for 18 months" (`invest.ts:290`) | S |
| 4 | Units for lumpsum, inflation, CAGR; CAGR from two dates | lumpsum, inflation, cagr-xirr | `years` whole-only (lumpsum) or years-only (others) | M |
| 5 | Days and months, rate per month, and a dates mode | simple-compound | Short loans and informal lending ("2% a month") cannot be entered. Rate is per year only | M |
| 6 | Short loans: show a monthly table, not a yearly one | prepayment, rate-change, amortisation | `scheduleTable(..., true)` is fixed yearly (`loans.ts:232, 336`). A 12 month loan gets one "Year 1" row | S |
| 7 | Extra EMI every month; months or years for balance transfer | prepayment, balance-transfer | Only a one-time prepayment exists. Indian EMI pages take tenure in years or months (secondary only) | M |
| 8 | EMI: number of EMIs, last EMI date, plain "1 year 6 months" | emi (and `yearsMonths` everywhere) | EMI shows no tenure echo; `yearsMonths` prints "20 y 0 m" (`loans.ts:81`) | S |
| 9 | **Bug:** "Use in another tool" can send months into a years box | all UNIT tools | `toolLink.ts:13` treats years, months, days as one family. "Days apart: 300" can go into SIP years | S |
| 10 | **Bug:** missing caps on rate and years | sip, step-up-sip, lumpsum, goal-sip, fd, rd, inflation | Only `negative()` is checked (`invest.ts:58, 120, 258`). A rate of 1e6 gives a huge or infinite power | S |
| 11 | Term quick picks under duration boxes | emi family, SIP family, fd | Money boxes already have +1K chips; terms have none | S |
| 12 | Pay-rate converter (hour, day, week, month, year, pay for N days) | new: `pay-rate` | No per-day or per-hour pay tool; notice-pay and freelance questions | M |

Lower, in the work list: break-even, goal-sip by date, month unit in the converter.

**Other findings (no action unless listed):**
- **Inconsistent growth rule (b), unproven which is right.** `goalSip` grows "already saved" yearly while the SIP part and SWP grow monthly (12.00% vs 12.68% at 12%). Do not change silently; add a one-line note and ask the owner.
- **Duplicates (h):** lumpsum, fd and simple-compound overlap. Ids are frozen, so do not merge; share one duration reader.
- **Rounding (g):** EMI is full precision with a bank-rounding note (`loans.ts:30`). No change. **Validation (f):** loan tenure 0, negative and huge are handled (`term.ts`); gaps are item 10.

---

## C. The unit control design

### Choice

Option A is a text box "18 months" (how loan tenure works). It loses the numeric keypad (text field, no `inputMode`), needs a parser per tool, and Use-in must build text. Option B is a number box plus a unit switch, with the unit in `<id>__unit`. It keeps the keypad and decimals, and the same key fixes the Use-in bug.

**Pick B** for the 11 UNIT tools. Leave the loan term box as it is (shipped, tested, migrated).

### Rules

1. The field **id never changes**. Its value stays a plain number string.
2. A number field may add `units: TimeUnit[]`. **`units[0]` must equal the field's current `unit`** (what the box means today).
3. The chosen unit is stored in `values['<id>__unit']`. It is not a spec field, so it is not in `fields`, share text loops, or the id-uniqueness test.
4. `unitOf()` returns `units[0]` when the key is missing, empty or not in the list.

### Sketch

```ts
// src/lib/tool.ts
export type TimeUnit = 'years' | 'months' | 'days'
// number field:  { kind:'number', unit:'years', units:['years','months','days'], defaultUnit?:'months', default:'5' }
// ResultRow gets:  unit?: TimeUnit   (set on time-valued headline rows, so Use-in can carry the unit)
export const unitKey = (id: string) => `${id}__unit`
export function unitOf(f: { id: string; unit?: Unit; units?: TimeUnit[] }, v: Values): TimeUnit {
  const raw = v[unitKey(f.id)]
  return f.units?.find((u) => u === raw) ?? f.units?.[0] ?? (f.unit as TimeUnit)
}
// defaultValues(): if f.defaultUnit && f.defaultUnit !== f.units[0], set out[unitKey(f.id)] = f.defaultUnit.
//   Fresh forms may open on months; old cards still read years.

// src/engine/duration.ts  (pure, Decimal only)
export const toYears = (n: Dec, u: TimeUnit): Dec => (u === 'years' ? n : u === 'months' ? n.div(12) : n.div(365))
export function toWholeMonths(n: Dec, u: 'years' | 'months'): number | null {
  const m = u === 'years' ? n.times(12) : n
  return m.isInteger() && m.gte(1) ? m.toNumber() : null
}

// a spec, e.g. fd:
const f = fdSpec.fields.find((x) => x.id === 'years')!
const t = toYears(r.n.years!, unitOf(f, v))     // then fd(principal, rate, t, n) is unchanged
```

### How each surface is affected

| Surface | Effect |
|---|---|
| Saved card inputs | `sanitizeValues` (`persistence.ts:174`) keeps any string key up to 64 chars and 60 keys. `years__unit` is 12 chars. No change needed. |
| Old saved card | No `__unit` key. `ToolScreen.tsx:398` merges defaults under it; `unitOf` gives `units[0]`. Same answer. |
| Shared text | `inputLines` (`shareText.ts:40`) must print the chosen unit: "18 months", with singular for 1. |
| Use in another tool | `linkable` returns the row's `unit`. `fits` only offers a target field whose `units` include it. `prefillDraft` also writes `<id>__unit`. A result with no unit goes only to unit-less boxes. This fixes bug 9. |
| Presets | `presets?: string[]` ("5 years") under the box. Tapping sets number and unit key. |
| Field-id contract, saved summary | Unchanged. New test: no field id contains `__`. |

### Why an old saved value cannot be misread

1. The key `<id>__unit` has never been written by any earlier build, so no old value carries it.
2. A missing key resolves to `units[0]`, which a test forces to equal the old `unit`. That is the old meaning.
3. A garbage key fails the `find` and also resolves to `units[0]`; it cannot pick another unit by accident.
4. **Golden test per UNIT field:** for the field's default and two sample numbers, `compute(values)` with no key deep-equals the stored pre-change result.

**Edge cases for the maths**

| Case | Rule |
|---|---|
| 18 months = 1.5 years | exact (18/12). 7 months = 0.58333... held at 40 digits (`decimal.ts`), error far below a paisa |
| 1 year in days | 365 (matches the XIRR convention at `invest.ts` engine). A leap year is 366 days = 1.0027 years; ignored, stated in the note |
| Monthly-cash-flow tools (SIP, RD, SWP wait, balance transfer) | whole months only. **Days are not offered.** Message: "Duration must come to whole months" |
| Fractional-year tools (lumpsum, fd, inflation, cagr, simple-compound) | any positive Decimal; days = n/365; `pow` with a Decimal exponent is fine |
| Limits | SIP/RD/SWP: 1 to 720 months. Others: at most 60 years (simple-compound keeps 100) |

---

## D. Work list

Merge order: **0a, then 0b, then Batches 1 to 4 in any order.** Each batch edits only its listed files. Put VERIFICATION.md rows under your own heading; the lead merges. Run `npm run check` and the e2e smoke before commit.

### Batch 0a: foundation (serial, first). Owns `src/lib/tool.ts`, `src/engine/duration.ts` (+test), `src/features/tools/ToolScreen.tsx`, `src/lib/shareText.ts`, `src/lib/toolLink.ts`, `src/features/tools/toolLink.test.ts`, `fieldInput.ts`, `src/styles/tools.css`

- **C-U0a** Add `TimeUnit`, `units`, `defaultUnit`, `presets`, `ResultRow.unit`, `unitKey`, `unitOf`, the `defaultValues` rule (code in section C). Tests: `unitOf` missing, garbage, valid; `toYears` (18 months = 1.5, 90 days = 90/365); `toWholeMonths` (1.5 years = 18, 0.7 years = null).
- **C-U0b** `NumberInput` in `ToolScreen.tsx`: if `units` has 2 or more entries, replace the static unit label with a `Segmented` control (44px targets, label "Unit of `<field label>`"). Write both keys on change; never clear the number.
- **C-U0c** `inputLines`: print the chosen unit, singular for 1.
- **C-U0d** `toolLink.ts`: `linkable` returns `unit`; `fits` matches time units exactly; `prefillDraft` takes an optional unit. Update the test "never offers select, date, text or row fields" (still true) and add: a months result is never offered to a years-only box; a days result offered only to a field whose `units` has days.
- **C-U0e** Preset chips under a duration box (`.chips` style). Test: tapping "6 months" sets the number and the unit key.
- **C-U0f** Test in `registry.test.ts`: for every field with `units`, `units[0] === unit`, and no field id contains `__`.

### Batch 0b: split `invest.ts` (serial, after 0a). Owns `invest.ts`, new `fixed.ts`, `registry.ts`, `groups.test.ts`

- **C-U0g** Pure move, no maths change. `invest.ts` keeps sip, step-up-sip, lumpsum, goal-sip, swp. New `fixed.ts` gets fd, rd, ppf, nps, epf, inflation, cagr-xirr, plus shared helpers. Registry imports both. Tool ids, order, field ids identical.

### Batch 1: loans. Owns `loans.ts`, `src/engine/loans/loan.ts`, `loan.test.ts`, `term.ts`

Tools: balance-transfer, simple-compound, prepayment, emi, amortisation, rate-change (6).

- **C-U1 balance-transfer.** Field `months` gets `units: ['months','years']`. `n = toWholeMonths(...)`, error "Time left must come to whole months, 1 to 600". Engine `balanceTransfer` unchanged. Test: 15 years equals 180 months.
- **C-U2 simple-compound.** Field `years` gets `units: ['years','months','days']`, label "Duration". `t = toYears(...)`, keep `0 < t <= 100`. New fields (new ids, defaults make old cards unchanged): `ratePer` select year|month, default `year`, label "Rate is per" (monthly rate x 12 becomes the yearly rate; say so in the formula line); `span` select `duration`|`dates`, default `duration`; `from`, `to` dates shown when `span === 'dates'` (days = `daysBetween`, t = days/365). Table: under 2 years, one row per month (at most 24); else per year. The engine already takes a Decimal year count; tests: P 100000, 12%, 90 days, SI = 2958.9041; 3 months compounded monthly = P(1.01)^3 - P. Add rows "Days" and "Total to repay".
- **C-U3 prepayment.** New advanced field `extra` ("Extra paid with every EMI", rupee, default blank, junk is an error, add to `OPTIONAL_NUMBER_FIELDS`). Engine: `prepay(..., extra = D(0))`. With extra above 0, months 1..`after` are paid at EMI+extra (`amortise(p, rate, emi+extra, 1, after)`), the one-time amount is then taken off, and the tail runs at EMI+extra (shorter loan) or `emi(left, rate, n-after)+extra` (lower EMI). Return `'clears'` if the balance reaches 0 early. Tests: `extra = 0` deep-equals today's result; ₹1,000 at 12% over 12 months with ₹100 extra ends earlier; closing balance 0.
- **C-U4 emi.** Add rows "Number of EMIs" and (advanced optional date `firstEmi`, blank = no row) "Last EMI on" = `addMonths(first, n-1)`. Replace `yearsMonths` with `termText(m)`: under 12 gives "18 months"; "1 year"; "20 years 3 months". Update every caller (prepayment, rate-change, multi-loan, loan-presets) and their tests.
- **C-U5 amortisation, prepayment, rate-change tables.** `view` select gets a third option `auto`, default `auto` (yearly if n > 36, else monthly). Old saved `yearly` or `monthly` still work. The other two tools use `n > 36` instead of the fixed `true`.

### Batch 2: SIP family. Owns `invest.ts` (after 0b), `src/engine/investments/invest.ts`, `invest.test.ts`

Tools: sip, step-up-sip, goal-sip, lumpsum, swp (5).

- **C-U7 sip, step-up-sip.** `years` gets `units: ['years','months']`, label "Duration", `defaultUnit` stays years. Months must be whole, 1 to 720. Engine `sipMonths(monthly, ratePct, months, stepUpPct): { months:number; invested; value }[]` with a row each 12th month plus a final row if months is not a multiple of 12; step-up applies at the start of each completed 12 months. `sip()` becomes a wrapper (whole years only) so every existing test is untouched. `growth()` labels a partial last row `M18`. Tests: `sipMonths(5000, 12, 120)` equals `sip(5000, 12, 10)` (about 11,61,695); 18 months equals a hand loop; step-up starts at month 13.
- **C-U8 goal-sip.** Same units. Engine `goalSipMonths(target, ratePct, months, existing)`; "saved" grows as today at `(1+r)^(months/12)`, so whole years are identical (golden test vs `goalSip`). New fields: `when` select `in`|`by` (default `in`), `byDate` date. For `by`: months = whole months from today to the date, a part month counts as a full month; inject "today" so tests can fix it. Error if the date is not in the future.
- **C-U9 lumpsum.** `years` gets `units: ['years','months','days']`. Engine `lumpsumAt(p, ratePct, years: Dec)` = P(1+r)^t. Rows: whole years plus a final partial row. Cap t at 60 years. Golden test: whole years equal `lumpsum()`.
- **C-U10 swp.** `wait` gets `units: ['years','months']` (default years). `growCorpus` already takes months. Months must be whole, at most 720.
- **C-U11 guards, all five.** Return rate 0 to 100 ("Enter a yearly return from 0 to 100%"). Tests: rate 1e6, blank field.

### Batch 3: fixed returns. Owns `fixed.ts` (after 0b), new `src/engine/investments/fixed.ts` (+test). Does not edit `engine/investments/invest.ts`

Tools: fd, rd, inflation, cagr-xirr (4). No change is needed to the engine `fd`, `rd` or `cagr`; they already take Decimal years or whole months.

- **C-U12 fd.** `years` gets `units: ['years','months','days']`, label "Deposit period". `t = toYears()`; keep the `fd(p, rate, t, n)` call. Caps: t > 0, at most 50 years; rate 0 to 100. New advanced optional date `start` (blank = no row): "Matures on" via `addDays` (days unit) or `addMonths` (years/months, when whole months, else `addDays(round(t*365))`). New row "Effective yearly yield" = ((1 + r/n)^n - 1) x 100, in `engine/investments/fixed.ts` with a test (7% quarterly = 7.1859%; hand check: 1.0175^4 = 1.07186). Note: odd days compound fractionally; a bank may pay simple interest for the part quarter (**unproven**).
- **C-U13 rd.** `years` gets `units: ['years','months']`; `toWholeMonths`; error "Time must come to whole months". Table: yearly rows plus a final partial row (today a partial year is dropped, `invest.ts:295`).
- **C-U14 inflation.** `years` gets `units: ['years','months']`; t at most 100 years; `pow` stays with a Decimal exponent. Golden test for whole years.
- **C-U15 cagr-xirr.** `years` gets `units: ['years','months','days']`. Add a third option `dates` to the existing `mode` select (existing `cagr` and `xirr` unchanged); new date fields `startDate`, `endDate` (shown for `dates`); years = days/365 (state it: same as XIRR). Update `visibleIf` on start, end and years so `dates` shows start and end values but not `years`. Error if end date is not after start.
- **C-U16 guards.** Rate 0 to 100 on fd, rd; years caps as above.

### Batch 4: other files. Owns `everyday.ts`, `src/engine/convert/units.ts`, `tax.ts`, new `pay.ts`, new `breakEven.ts`, `src/engine/everyday/payRate.ts`, `src/engine/metrics/breakEven.ts`, `groups.ts`, `groups.test.ts`, `registry.ts`

Tools: unit-converter, capital-gains, pay-rate (new), break-even (new) (4).

- **C-U17 unit-converter.** Add `f('mo', 'Month (1/12 of a 365-day year)', '2628000')` between week and year in the time list. Test: 1 year = 12 months; 1 month = 30.4167 days.
- **C-U18 capital-gains.** "Holding type" shows "held 3 years 2 months" from `monthsHeld`. Display only.
- **C-U19 pay-rate (new tool, tax group, section "Your pay").** Fields: `amount` (rupee, 60000), `per` select hour|day|week|month|year (month), `hoursPerDay` (8), `daysPerWeek` (5); advanced `days` (pay for N days, blank = none), `dayBasis` select `a30` "month / 30" (default), `a26` "month / 26", `week` "year / 52 / days a week". Engine: annual = amount x {hour: hours x days x 52, day: days x 52, week: 52, month: 12, year: 1}; table of all five rates. Tests: 60000 a month, 5 days, 8 hours gives annual 720000, week 13846.15, day 2769.23, hour 346.15; basis `a30` day = 2000, `a26` day = 2307.69. Note: employers differ.
- **C-U20 break-even (new tool, business group, section "Pricing").** Fields: `fixed` (rupee, 500000), `price` (1000), `variable` (600), optional `perMonth` units sold a month. Engine `breakEven(fixed, price, variable)`: units = ceil(fixed / (price - variable)); revenue = units x price. Months = units / perMonth, shown as months and days. Error when price <= variable: "Each unit loses money, so you never break even". Tests: 500000 / 400 = 1250 units; revenue 12,50,000.
- **Later:** gratuity by join and last date, advance-tax pay date to months.

Total new unit controls: 11 tools. New tools: 2. New optional fields on old tools: about a dozen. Every old field id is kept.

---

## E. BLOCKED (no primary source, or ruled out)

- **Bond and T-bill price and yield.** Needs the RBI auction yield and day-count convention from a primary page. Not fetched.
- **Notice period recovery, leave encashment tax, full and final settlement (E8).** Gated in `docs/MASTER-ROADMAP.md` (Labour Codes). A pay-rate converter is not gated; the tax parts are.
- **Gratuity eligibility changes** (for example one year for fixed-term staff, `minYears: 5` at `rules.FY2026-27.ts:202`). `docs/VERIFICATION.md` says only secondary sources back it. Do not change it until the Ministry text is read.
- **FD odd-period interest and day basis "as banks do".** Approximation only.
- **Statutory late fees and late-payment interest** (income-tax 234A and card penalties). The generic "interest between two dates" in simple-compound uses the user's own rate, which is fine.
- **GST on loan processing fee** in the EMI tool. Only card interest and fees are verified (CBIC 11/2017, 12/2017). Keep "GST not included" as loan-compare says.
- **PPF 5th-of-month rule, EPF crediting, lender prepayment charges, education, car and gold rate presets.** Already unverified in VERIFICATION.
- **Ruled out (`docs/THE-PLAN.md` section 9):** brokerage, margin, TDS calculators; live FD rates. Not proposed.

---

## F. Risks

- **Downgrade misread.** A card saved with `years__unit=months`, opened in an older build, reads "18" as 18 years. One user, forward only. Cannot be fixed without a version field. Say so in the release note.
- **Fresh forms open on months, old cards on years.** Only via `defaultUnit`; golden tests prove old cards keep `units[0]`.
- **Link fix hides some old Use-in offers** (days into a years box). Intended.
- **Segmented control on a short phone.** Check at 360px.
- **Label change** "Number of years" to "Duration": update tests that match label text (`toolInvalid` uses labels).
- **e2e smoke is stale.** Update what each batch touches; look at screenshots.
- **365-day year** ignores leap years (0.27% on one year). Say so in each note.

**Source grades.** Repo code, tests, docs: primary. SBI FD tenure (7 days to 10 years), quarterly compounding, and HDFC or other EMI calculators taking tenure in years or months: secondary only (bankbazaar.com, fyers.in, hdfcsky.com, upstox.com and similar); SBI's own calculator page returned 404 and HDFC's page was not read. Anything marked "unproven" is exactly that.
