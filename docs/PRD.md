# PRD — Personal Calculator Suite ("VK Calc")

**Owner:** Vaibhav Kumawat
**Status:** Draft v1.0 — awaiting approval to build
**Date:** 2026-11-02

---

## 1. Executive Summary

A single personal calculator app that replaces ClevCalc and the five India-finance
websites currently used alongside it. Full parity with ClevCalc's everyday
utilities, plus a deep loan/EMI engine, an India-specific investment and tax
layer, and a product-metrics pack — with no ads, no paywall, and no cloud
dependency for anything except currency rates.

**Target platform:** Android first (Play Store), iOS second, from one codebase.

---

## 2. Problem

| Today | Pain |
|---|---|
| ClevCalc handles everyday math well | Ads on every screen; cloud backup is paywalled |
| Its loan calculator exists | Gives only the EMI number — no amortisation, no prepayment, no comparison |
| No India tax/investment support | Forces a jump to 4–6 different websites (ClearTax, Groww, HDFC) per question |
| No PM/business metrics anywhere | Spreadsheet every time for CAC, LTV, payback |
| Calculations are disposable | History is a flat log; can't name, save or compare a scenario a week later |

**Core insight:** the gap is not *more calculators*. It's (a) depth on loans,
(b) India-specific finance, and (c) **scenario persistence** — the ability to
name, save and compare a calculation instead of re-entering it.

## 3. Goals & Non-Goals

### Goals
1. Replace ClevCalc entirely for day-to-day use within one week of install.
2. Answer any personal-finance question (loan, investment, tax) without leaving the app.
3. Every result shows the formula and inputs used — trustworthy, auditable math.
4. Fully offline except currency rates.
5. Zero ads, zero paywall, zero account.

### Non-Goals
- Monetisation, subscriptions, ads.
- Multi-user / sharing / collaboration.
- Live stock, crypto or mutual-fund NAV data.
- Breadth-for-breadth's-sake (CalcKit's electronics/geometry/algebra packs).
- Being a tax-filing tool. Outputs are estimates, labelled as such.

## 4. Success Metrics

| Metric | Target | How measured |
|---|---|---|
| ClevCalc uninstalled | Within 14 days of V1 | Self-reported |
| Daily active use | ≥ 5 days/week | Local usage counter (on-device only) |
| Website fallbacks for finance questions | 0 after V2 | Self-reported |
| Cold start to first keystroke | < 800 ms | Measured on device |
| Formula correctness | 100% of calculators covered by unit tests | CI test suite |

## 5. Users & Use Cases

**Primary (and only) user:** Vaibhav — Senior PM, India-based, financially
active, comfortable with dense information.

| Use case | Frequency | Today's workaround |
|---|---|---|
| Split a bill, apply a discount, GST on an invoice | Daily | ClevCalc |
| "Should I prepay my home loan or invest the surplus?" | Monthly | Spreadsheet |
| "Old regime or new regime this year?" | Annual, high stakes | ClearTax website |
| "What does ₹X/month SIP become in 15 years?" | Weekly | Groww calculator |
| "What's our CAC payback on this segment?" | Weekly, at work | Spreadsheet |
| Unit conversion, currency, dates | Daily | ClevCalc |

## 6. Scope — Phased

Everything in sections A–F is in scope (approved). Build order is sequenced by
dependency and risk, not by cutting features.

| Phase | Contents | Rationale |
|---|---|---|
| **P1 — Foundation** | Core calculator engine, history, settings, navigation shell, theming, Indian number format | Everything else renders inside this shell |
| **P2 — Everyday** | All converters & utilities (Section B) | Highest daily-use frequency; ClevCalc parity achieved here |
| **P3 — Loans** | Full EMI/loan suite (Section C) | The primary stated gap |
| **P4 — Investments** | SIP/FD/PPF/NPS/EPF suite (Section D) | Pure math, no external data, low risk |
| **P5 — Tax & Salary** | Income tax, HRA, capital gains, salary (Section E) | Highest maintenance risk — isolated behind a rules config |
| **P6 — Personalisation + PM pack** | Scenarios, compare, NL input, export, product metrics (Section F) | Depends on P1–P5 existing |

---

## 7. Feature Specification

Each calculator below lists **required inputs → outputs**. This is the contract
the engine and UI are built against.

### A. Core Calculator Engine (P1)

| # | Feature | Inputs | Outputs |
|---|---|---|---|
| A1 | Expression calculator | Expression string with `+ − × ÷ ( ) % ^` | Evaluated result |
| A2 | Live preview | Partial expression | Running result, updated per keystroke |
| A3 | Scientific functions | Expression incl. sin/cos/tan/asin/log/ln/√/x!/π/e, deg\|rad mode | Result |
| A4 | History | — | Last 200 expressions + results; tap to reuse, swipe to delete, clear all |
| A5 | Number format | Toggle: Indian (12,34,567.89) \| International (1,234,567.89) | Formatted display |
| A6 | Decimal places | Integer 0–10 | Rounded display (full precision retained internally) |
| A7 | Memory | M+ / M− / MR / MC | Stored value |
| A8 | Keyboard input | Physical keyboard | Full expression entry, Enter = evaluate |
| A9 | Copy/paste | — | Result to clipboard; number from clipboard |
| A10 | Themes | Light \| Dark \| System + accent colour | Applied theme |
| A11 | Favourites | Reorderable calculator list | Pinned list on home |
| A12 | Startup screen | Calculator choice | Opens on launch |
| A13 | Backup / restore | JSON file | Export/import history, scenarios, settings |
| A14 | Formula transparency | — | Every result screen shows formula + substituted values |
| A15 | Haptics & keep-screen-on | Toggles | Vibration on key press; screen stays awake |

### B. Everyday Converters & Utilities (P2)

| # | Calculator | Inputs | Outputs |
|---|---|---|---|
| B1 | Unit converter | Category, from-unit, to-unit, value | Converted value + all sibling units |
| B2 | Currency converter | From, to, amount | Converted amount, rate, last-updated timestamp |
| B3 | Percentage | Mode (X% of Y / X is what % of Y / % change), two values | Result + working |
| B4 | Discount | MRP, discount %(s), optional flat-off | Final price, amount saved, effective % |
| B5 | GST | Amount, rate (0/5/12/18/28/custom), add-or-remove, intra/inter-state | Base, GST amount, CGST+SGST or IGST, total |
| B6 | Tip | Bill, tip %, number of people | Tip amount, total, per-person |
| B7 | Unit price compare | 2–5 rows of (price, quantity, unit) | Cost per standard unit, cheapest highlighted |
| B8 | Date calculator | Mode (difference / add-subtract / age), date(s), N days | Days between, resulting date, or Y-M-D age |
| B9 | World time | Home city, list of cities | Current time in each, offset |
| B10 | Number base | Value, from-base, to-base (2/8/10/16) | Converted value + AND/OR/XOR/NOT/shift ops |
| B11 | Fuel cost | Distance, mileage (km/l), fuel price | Fuel needed, trip cost, cost per km |
| B12 | Fuel efficiency | Value + unit (km/l, mpg-US, mpg-UK, l/100km) | All equivalents |
| B13 | Body metrics | Height, weight, age, sex, activity level | BMI + category, BMR, TDEE, ideal weight range, body-fat estimate |
| B14 | Grade average | Rows of (subject, marks/grade, credits) | Weighted average, GPA, percentage |
| B15 | Ovulation | Last period date, cycle length | Fertile window, ovulation date, next period |

### C. Loans & EMI (P3)

| # | Calculator | Inputs | Outputs |
|---|---|---|---|
| C1 | EMI | Principal, annual rate %, tenure (months\|years) | Monthly EMI, total interest, total payable, principal-vs-interest split |
| C2 | Amortisation schedule | (from C1) | Month-by-month table: EMI, principal, interest, closing balance; yearly roll-up |
| C3 | Prepayment impact | Loan inputs + prepayment amount, month, mode (reduce EMI \| reduce tenure) | New tenure/EMI, interest saved, months saved, revised schedule |
| C4 | Reverse EMI (affordability) | Affordable EMI, rate, tenure | Maximum loan eligible |
| C5 | Rate change simulator | Loan inputs, rate delta, effective month | New EMI or new tenure, cost delta |
| C6 | Loan comparison | 2–3 offers (principal, rate, tenure, processing fee) | Side-by-side EMI, total interest, total cost, winner |
| C7 | Home loan tax benefit | Loan inputs, tax slab %, self-occupied\|let-out | Yearly 24(b) interest + 80C principal deduction, tax saved, effective interest rate |
| C8 | Balance transfer | Existing loan state, new rate, fees | Breakeven month, net saving, verdict |
| C9 | Simple vs compound interest | Principal, rate, time, compounding frequency | SI, CI, difference, growth table |
| C10 | Credit card EMI | Purchase amount, rate, tenure, processing fee | True EMI incl. 18% GST on interest + fee, effective annual cost |
| C11 | Loan presets | Type (home/car/personal/education/gold) | Pre-filled typical rate & tenure ranges |

### D. Investments & Savings (P4)

| # | Calculator | Inputs | Outputs |
|---|---|---|---|
| D1 | SIP | Monthly amount, expected return %, years | Corpus, invested, gains, year-wise table + chart |
| D2 | Step-up SIP | SIP inputs + annual step-up % | Corpus, total invested, gains vs flat SIP |
| D3 | Lumpsum | Amount, return %, years | Maturity value, gains |
| D4 | Goal SIP (reverse) | Target corpus, return %, years, existing corpus | Required monthly SIP |
| D5 | SWP | Corpus, monthly withdrawal, return % | Months the corpus lasts, balance curve, depletion date |
| D6 | FD | Principal, rate, tenure, compounding (M/Q/H/Y) | Maturity, interest earned, post-tax value |
| D7 | RD | Monthly deposit, rate, tenure | Maturity, interest earned |
| D8 | PPF | Yearly contribution, rate, years (15 + extensions) | Maturity, year-wise balance, tax-free gain |
| D9 | NPS | Monthly contribution, return %, age now, retire age, annuity % & rate | Corpus at 60, lumpsum, annuity purchase, monthly pension |
| D10 | EPF | Basic salary, employee %, employer %, growth %, years | Retirement corpus, year-wise balance |
| D11 | Inflation / real return | Amount, inflation %, years | Future value of today's money, today's value of future money |
| D12 | CAGR / XIRR | Start value, end value, years — or dated cashflow list | CAGR % / XIRR % |
| D13 | Growth visualiser | (shared component) | Stacked chart: invested vs returns over time |

### E. Tax & Salary — India (P5)

> ⚠️ **All rates, slabs and limits live in `src/config/tax-rules.<FY>.json`, never in code.**
> A Budget change is a config edit, not a release. Every output carries the
> assessment year used and an "estimate — verify with a CA" disclaimer.

| # | Calculator | Inputs | Outputs |
|---|---|---|---|
| E1 | Income tax | Gross income, age bracket, deductions (80C/80D/NPS/home-loan interest), regime | Tax under old regime, tax under new regime, cheaper option, effective rate, slab-wise breakdown |
| E2 | In-hand salary | CTC, basic %, HRA %, PF opt-in, city type, other allowances | Monthly take-home, annual, deduction breakdown (PF, tax, gratuity, professional tax) |
| E3 | HRA exemption | Basic salary, HRA received, rent paid, metro\|non-metro | Exempt amount (least of 3 rules shown), taxable HRA |
| E4 | Capital gains | Asset type (equity/debt/property/gold), buy & sell date + value, expenses | Holding period, STCG/LTCG classification, indexation (where applicable), tax payable |
| E5 | Advance tax | Estimated annual income & tax, TDS already paid | Quarterly instalment amounts and due dates, shortfall interest (234B/C) |
| E6 | Gratuity | Last basic+DA, years of service, covered\|not covered under Act | Gratuity payable, tax-exempt portion |
| E7 | Freelancer / 44ADA | Gross receipts, actual expenses, other income | Presumptive vs actual-books comparison, tax under each, recommendation |

### F. Personalisation & Product Metrics (P6)

| # | Feature | Inputs | Outputs |
|---|---|---|---|
| F1 | Named scenarios | Any calculator state + a name | Saved scenario, reopenable with inputs intact |
| F2 | Scenario compare | 2–3 saved scenarios of the same type | Side-by-side table with deltas highlighted |
| F3 | Natural language input | Free text ("18% gst on 45000", "emi 50L 8.5% 20y") | Routed to correct calculator with fields pre-filled |
| F4 | Share as image | A result screen | PNG result card to clipboard / share sheet |
| F5 | PDF export | Amortisation schedule, tax comparison, SIP table | Formatted PDF to device storage |
| F6 | Labelled expressions | Expression with inline labels (`rent 25000 + emi 48000`) | Readable history entries |
| **Product Metrics pack** | | | |
| F7 | CAC & LTV | Marketing spend, new customers, ARPU, gross margin %, churn % | CAC, LTV, LTV:CAC ratio, verdict vs 3:1 benchmark |
| F8 | CAC payback | CAC, monthly ARPU, gross margin % | Payback period in months |
| F9 | Funnel conversion | Stage-wise counts | Step conversion %, overall conversion, biggest drop-off |
| F10 | ARR / MRR run-rate | MRR, growth %, churn %, months | Projected ARR, net revenue retention, growth curve |
| F11 | A/B test sample size | Baseline rate, MDE, power, significance | Required sample per variant, test duration at given traffic |
| F12 | Retention / cohort | Cohort size, period-wise retained counts | Retention curve, average lifetime |
| F13 | Rule of 40 / burn multiple | Growth %, profit margin %, net burn, net new ARR | Rule-of-40 score, burn multiple, health verdict |

---

## 8. Architecture

### Stack

| Layer | Choice | Why |
|---|---|---|
| UI | React 18 + TypeScript | Type-safe formula layer; vast component ecosystem |
| Styling | Tailwind CSS | Fast, consistent, trivial theming |
| Build | Vite | Instant HMR, small bundles |
| Native shell | **Capacitor 6** | One codebase → real Android APK now, real iOS app later |
| State | Zustand | Minimal; no boilerplate for a single-user app |
| Storage | Capacitor Preferences + IndexedDB | Offline-first; survives app updates |
| Math | `decimal.js` | Floating-point errors are unacceptable in a finance tool |
| Charts | Recharts | Declarative, small, good mobile touch behaviour |
| Tests | Vitest | Every formula unit-tested against known-good values |

### Why Capacitor over Flutter / React Native

| | Capacitor | Flutter | React Native |
|---|---|---|---|
| Android + iOS from one codebase | ✅ | ✅ | ✅ |
| Verifiable in this build environment | ✅ runs headless, screenshot-testable | ❌ no emulator available | ❌ no emulator |
| Native look & feel for forms/tables/math | Adequate — indistinguishable in practice | Best | Good |
| Toolchain weight | Light (Node only) | ~2 GB SDK | Heavy |
| Time to first working APK | Hours | Days | Days |

**Decision: Capacitor.** For an app that is forms + math + tables, the WebView
penalty is negligible, and the ability to fully test the formula layer and every
screen before shipping outweighs native rendering purity. *Reversible:* the
formula layer is pure TypeScript with zero UI coupling — if we later move to
Flutter, the math ports as a spec, and the UI is a rewrite of presentation only.

### Module structure

```
src/
├── engine/           # Pure TS. Zero UI imports. 100% unit-tested.
│   ├── expression/   # Tokenizer, parser, evaluator (decimal.js)
│   ├── loans/        # EMI, amortisation, prepayment, comparison
│   ├── investments/  # SIP, FD, PPF, NPS, XIRR
│   ├── tax/          # Reads tax-rules.json — no hardcoded rates
│   ├── convert/      # Units, currency, bases
│   └── metrics/      # CAC, LTV, funnel, sample size
├── config/
│   ├── tax-rules.FY2026-27.json
│   ├── units.json
│   └── presets.json
├── features/         # One folder per calculator: screen + form + result
├── components/       # Shared: Keypad, ResultCard, DataTable, GrowthChart
├── store/            # Settings, history, scenarios
└── lib/              # Formatting (Indian digits), persistence, export
```

**Hard rule:** `engine/` never imports from `features/` or `components/`. This
is what makes the math portable and testable, and what makes a future Flutter
or web version cheap.

### Data & network

| Data | Source | Offline behaviour |
|---|---|---|
| Currency rates | Frankfurter API (free, no key, ECB-backed) | Cache last successful fetch; show rate age; never block the UI |
| Tax rules | Bundled JSON per FY | Always offline |
| Units, presets | Bundled JSON | Always offline |
| History, scenarios, settings | On-device only | Always offline |

**No analytics. No telemetry. No account. Nothing leaves the device except the currency rate request.**

---

## 9. Key Risks

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| **Tax rules go stale after a Budget** | High — wrong answers on the highest-stakes calculator | Certain (annual) | Rules in versioned JSON; AY stamped on every output; disclaimer on every tax screen |
| **Floating-point errors in finance math** | High — loses trust permanently | High if unmanaged | `decimal.js` throughout `engine/`; unit tests against published bank/CA figures |
| **Currency API rate-limits or dies** | Medium | Medium | Cache aggressively, show rate age, degrade to last-known; API choice isolated behind one adapter |
| **Scope: 70 features is a lot of surface** | Medium — half-finished app | Medium | Phased build; each phase is independently shippable and usable |
| **Cannot test on a real Android device from here** | Medium | Certain | Full headless browser verification + unit tests here; you do a device smoke test per phase before I proceed |
| **Capital gains / indexation rules are genuinely complex** | Medium — subtle wrong answers | Medium | Explicitly scope to common cases; flag unsupported edge cases in-app rather than guessing |
| **WebView feel disappoints vs native** | Low | Low | Native-feeling keypad with haptics; if it disappoints, engine ports to Flutter unchanged |

## 10. Definition of Done

**Per phase:**
- [ ] Every calculator in the phase has unit tests covering normal, boundary and invalid inputs
- [ ] Every formula validated against at least one published external source (bank EMI table, CA-verified tax figure, official scheme calculator)
- [ ] All screens render correctly at 360 px width, light and dark theme
- [ ] Headless browser run captures a screenshot of every screen
- [ ] No console errors; no unhandled promise rejections
- [ ] Offline mode verified (airplane-mode equivalent)
- [ ] Committed and pushed to `claude/personalized-calculator-research-dl43uk`

**Overall V1:**
- [ ] Debug APK builds successfully and is installable
- [ ] Cold start < 800 ms on device
- [ ] Backup export → wipe → restore round-trips without data loss
- [ ] All 70 features present and functional

## 11. Open Questions

| # | Question | Blocking? | Default if unanswered |
|---|---|---|---|
| 1 | Flutter instead of Capacitor? | No — reversible | Proceed with Capacitor |
| 2 | Do you want a Play Store listing, or sideload the APK? | No | Sideload; store listing is a later decision |
| 3 | Any calculators you want added that aren't listed? | No | Build as specified |
| 4 | Should tax default to FY2026-27? | No | Yes, with a year picker |

## 12. Build Sequence

| Phase | Deliverable | Verification |
|---|---|---|
| P1 | Working app shell + core calculator, runs in browser | Screenshots + engine unit tests |
| P2 | All 15 everyday calculators | Unit tests + screenshots |
| P3 | Full loan suite with amortisation tables | Tests validated against a bank EMI table |
| P4 | Investment suite with charts | Tests validated against official scheme calculators |
| P5 | Tax & salary with FY2026-27 rules | Tests validated against published slab examples |
| P6 | Scenarios, NL input, export, PM pack | Tests + screenshots |
| P7 | Capacitor Android build → installable APK | Gradle build succeeds; you install and smoke-test |
| Later | iOS target | Requires a Mac — your machine or a CI runner |
