# Test report: Tools 1 (e2e/tools1.test.mjs)

Run for the first time this round (it had been written but never executed — see SESSION-STATE.md "Round 6").
461 cases, 384 pass, **77 fail**. Full raw results: recovered from `/tmp/tools1-results.json` after the console
output itself was accidentally truncated to the last ~40 lines by a `| tail -40` on the first run.

**Not yet investigated against the real app code** — these are the test's own claims. Each needs a quick look at
the actual screen/engine before being trusted as a real bug, especially the MATH and TIMEOUT ones.

## 1. The two MATH failures: checked by hand, both are false positives (app is correct)

| Case | Claim | Verdict |
|---|---|---|
| `T1-MATH-discount` | Combined discount: page 32.0000, test expected 28.0000 | **App correct.** `effectivePercent = (mrp − final) / mrp × 100` ([discount.ts:15](src/engine/convert/discount.ts:15)) deliberately includes the flat ₹100 off, not just the two percentages multiplied. 2499 → 1699.28 is genuinely 32.00% off. The test only computed 0.8×0.9, forgetting the flat amount. |
| `T1-MATH-loan-compare` | Rate with fee: page 8.8700, test expected 8.5275 | **App correct.** The app returns the *effective annual* rate, `(1+m)^12 − 1` ([loan.ts:158](src/engine/loans/loan.ts:158)), documented in its own code comment. The test only annualised the monthly rate as `m × 1200` (nominal, no compounding). Converting the test's own nominal 8.5275% to effective gives exactly 8.87% — matches the app. |

Both test cases need their expected-value formula fixed, not the app. Left as-is pending the owner's say, since
fixing a test is still a code change.

## 2. Systemic: invalid fields are described but not visually marked

Same failure, ~16 calculators: an empty required box shows the right error text, but the box itself gets no red
text / `aria-invalid`. Affects: currency, tip, unit-converter, fuel-efficiency, fuel-cost, body-metrics, emi,
amortisation, reverse-emi, prepayment, rate-change, balance-transfer, card-emi, home-loan-tax, simple-compound,
discount, number-base. This is an app-level pattern, not 16 separate bugs — one shared component likely needs
the fix.

## 3. Systemic: layout overflow at 360px, some only at 200% font

~20 calculators show sideways overflow in at least one of {light/dark} x {100%/200% font}: percentage, number-base,
discount, unit-price, currency, tip, unit-converter, fuel-efficiency, date, world-time, body-metrics, ovulation,
grade-average, emi, amortisation, rate-change, prepayment, balance-transfer, loan-compare, card-emi, home-loan-tax,
loan-presets, and a 320px-wide check on EMI. Matches the owner's own report ("if numbers are too large then layout
is breaking at multiple places").

## 3b. Confirmed known bugs (previously static-only, now reproduced live)

| ID | What |
|---|---|
| B-06 | "1,5" typed in a percent box is read as 15, not 1.5 (comma mistaken for a decimal point) |
| B-23 | "0x10" and "1e1" are accepted as plain numbers in ordinary number boxes |
| B-18 | Reminder save with the date cleared does nothing and says nothing |

## 4. Input validation gaps (letters/junk silently become 0)

- Balance transfer: "12abc" in switching costs treated as 0 or 12 with no warning
- Card EMI: letters in the fee box treated as 0 silently
- Both produce a **wrong, confident-looking number** rather than an error.

## 5. Other real findings worth a look

- Below-absolute-zero temperature (-300°C) converts without any warning
- GST custom rate accepted up to 500% with no sanity warning
- Backspace right after a comma only deletes the comma, not the digit before it (first press "does nothing")
- No "Copied" confirmation on some copy actions; asked "With/Without commas" even when the number has none
- Draft is lost on a reload (documented as intended, but worth the owner confirming that's really the choice)
- Date calculator: swapping start/end is silent except inside "How this is worked out"

## 6. Timeouts — unclear whether app bug or stale test selector

These all failed with `Timeout 30000ms exceeded` / `Element is not an <input>...`, which usually means the test's
selector no longer matches the current screen, not necessarily that the app hung:
`T1-MATH-gst`, `T1-MATH-currency`, `T1-DATE-add-month-end`, `T1-DATE-add-huge`, `T1-MORE-conditional-fields`,
`T1-PICKER-unit-converter`, `T1-DRAFT-back-and-reopen`, `T1-SEM-emi-1-month`, `T1-SEM-simple-100-years-daily`,
`T1-SELECTS-unit-price`, `T1-SAVE-persist-all-tools` (120s timeout saving all 26 tools). **Needs a human or a
second pass to tell which is a real hang.**

## Not investigated yet

Severity triage above is from reading the failure messages only; nothing here has been checked against the actual
engine code or screen. Section 1 should be checked first.
