# Test report: Tools 2 (e2e/tools2.test.mjs)

This suite had a real scaffold (every calculator's fields, defaults, helper functions, and even several
independently-written reference formulas) but **zero actual test cases were ever registered** — it had
never run. Calculators 27-51 (SIP through A/B sample size, 25 calculators across Savings/Investing, Tax
and salary, and Business metrics) had no e2e coverage at all.

Written this round: 208 cases across every one of the 25 calculators —

- **SMOKE** (25): opens with its own example numbers, shows a real result, never leaks `NaN`/`undefined`/`Infinity`.
- **NEG** (115): every required field, cleared, shows a plain-words error instead of a stale result.
- **NEGNUM** (included in the above where a field is money): a negative amount never shows garbage, whether the tool refuses it or legitimately accepts a negative (margin, net new ARR can be negative).
- **UI — OVF** (25): no sideways scroll at 360px.
- **UI — TAP** (25): every control is 44px in one direction.
- **POS** (9): independent numeric cross-checks against the app's own example defaults — SIP, step-up SIP, lump sum, SIP-for-a-goal, FD, RD, PPF, CAGR, and XIRR, each computed a second, independent way (closed-form annuity formulas, a month-by-month simulation, or bisection on actual/365 days) and compared to the screen.
- **CORNER** (9): PPF over/under the legal deposit limits, SWP with a zero withdrawal, FD with zero years, an A/B test lift that would push the rate past 100%, a capital-gains sell date before the buy date, gratuity "extra months" of 12+, Rule of 40 with negative burn, a funnel stage bigger than the one before it.

**Deliberately not re-derived independently**: capital gains, gratuity, advance tax, EPF, NPS,
in-hand salary, and the presumptive-tax calculators encode real Indian tax/EPFO rules (indexation,
surcharge marginal relief, CII tables, EPS wage ceilings). Re-deriving these from scratch for an e2e test
risks writing a *wrong* independent formula and reporting a false bug — exactly what happened twice in
tools1 this round. Their numeric correctness already has dedicated engine unit tests
(`incomeTax.test.ts`, `other.test.ts`), cross-checked against outside sources per `docs/VERIFICATION.md`.
This suite's job was the screen, not re-auditing tax law.

## Result: 208 cases, 205 passed, 3 failed — all 3 the same already-known issue

```
FAIL OVF-swp                 div.screen 6..366 (6px over at 360px wide)
FAIL OVF-presumptive-44ada    div.screen 4..364 (4px over)
FAIL OVF-funnel               div.screen 6..366 (6px over)
```

All three are small (4-6px) sideways overflows of the whole screen container, not a specific field.
This is the same systemic layout-overflow pattern tools1 already found on ~20 of the first 26
calculators ([TEST-REPORT-tools1.md](docs/TEST-REPORT-tools1.md) section 3) — these are 3 more
instances of it in the second half of the catalogue, not a new or different bug.

## What this confirms

Every one of the 25 calculators: opens cleanly, validates its required fields, never shows raw
`NaN`/`undefined`/`Infinity` on a bad or negative input, and its headline number matches an
independently-computed value wherever that's safe to check. The three overflow misses belong to the
one layout issue already tracked, not a new defect per calculator.
