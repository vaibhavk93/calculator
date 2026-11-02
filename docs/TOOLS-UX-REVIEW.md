# Calculator forms: review of all 51 calculators

Every calculator spec was checked against one list: short plain title and blurb, labels of 5 words or fewer, the 3 to 5 inputs that matter first, rare fields under "More options", hints only where they prevent a wrong number, correct units, short selects, results in plain English, and tidy tables. No tool id or field id was changed, so saved cards still open. No engine code was touched.

Each line below reads: problem found -> change made.

## Everyday (15)

- **Unit converter.** Blurb listed eight units and ran long; "Value", "From", "To" were vague -> blurb "Length, weight, area, temperature and more"; labels "Amount to convert", "From unit", "To unit".
- **Currency.** The headline row was just "USD"; the note had three sentences -> headline "Amount in USD"; blurb "About 30 currencies, saved rates"; note trimmed to two sentences, same rate-date disclaimer.
- **Percentage.** Fields were called "X" and "Y" and the headline just "Result"; the mode options were too long for a segmented control -> options "X% of Y", "What %", "% change"; the headline now says what was worked out ("18% of 45000", "Change from 18 to 45000"); labels "Number X/Y".
- **Discount.** Two optional fields cluttered the form -> "Second discount" and "Flat amount off" moved to More options; "Effective discount" is now "Combined discount".
- **GST.** Long option labels and a long note; the same-state / other-state switch is rarely needed -> "Without GST / With GST", "Other rate", "Sold to" (Same state / Other state) moved to More options; note cut to two sentences with the date kept.
- **Tip and split.** Vague labels -> "Bill amount", "Number of people"; "Total" is now "Total with tip".
- **Compare pack prices** (was "Unit price compare"). Jargon title, long blurb -> new title and "Which pack is cheaper per kg"; price column now shows rupees; headline "Cheapest pack".
- **Date calculator.** Mode options were sentences -> "Days apart / Add time / Age" (segmented); "How many (minus to go back)" -> "How many" with a short hint; "Result" -> "New date".
- **World time.** Blurb too long -> "Time now in 20+ cities". Rest fine.
- **Binary and hex** (was "Number base"). Too technical, three bitwise fields always on screen -> new title and blurb; "Second number", "Shift by", "Bits for NOT" moved to More options; headline "Answer in base 16".
- **Fuel cost.** Hint began with "100 is only an example" -> "Example price. Enter today's price."
- **Mileage converter** (was "Fuel efficiency"). Title did not say what it does; "Value" and "Unit" were vague -> new title and blurb, "Your mileage figure", "Measured in".
- **BMI and calories** (was "Body metrics"). Jargon result labels (TDEE, BMR, "Devine", "BMI 18.5") -> "Daily calories to keep your weight (TDEE)", "Calories at rest (BMR)", "Ideal weight", "Lowest/Highest healthy weight"; age now has the years unit.
- **Marks and GPA** (was "Grade average"). Note had three sentences -> two; headline "Overall percentage"; "GPA (out of 10)".
- **Ovulation.** Label carried "(days)" twice over (unit already shows) -> "Cycle length", hint "Usually 21 to 35. First day to first day."

## Loans and EMI (11)

All loan forms: "Interest rate a year" is now "Yearly interest rate"; "Tenure" is now "Loan term" (and its "Tenure in" switch is "Years or months"); the one-line "Example rate. Enter your own." hint stays on every rate.

- **Loan EMI** (was "EMI"). "Total payable" -> "Total you pay"; blurb rewritten.
- **Repayment schedule** (was "Amortisation schedule"). Jargon title and a long blurb -> plain title, "Interest and balance, year by year". Yearly/Monthly switch is already segmented.
- **Loan prepayment** (was "Prepayment impact"). Seven fields on screen -> the years/months switch and "Use it to get" (Shorter loan / Lower EMI) moved to More options; the loan term field has a hint "In years. Switch to months under More options."; "New tenure" -> "New loan term".
- **Affordable loan** (was "Loan affordability"). Ten-word blurb -> "Biggest loan your EMI can repay"; "EMI you can pay".
- **Floating rate change** (was "Rate change"). Seven fields -> years/months switch and "Bank keeps" (Same EMI / Same term) moved to More options; labels "Current yearly rate", "Change in rate", "Change applies from EMI".
- **Compare loan offers.** Table column "True yearly cost" was jargon -> "Rate with fee" and headline "Its yearly rate with fee"; "Cheapest offer"; note cut to two sentences, GST caveat kept.
- **Home loan tax benefit.** Nine fields, blurb of 11 words -> blurb "Tax saved on your home loan"; "House is" (Self-use / Rented out), the rent field, "Section 123 limit already used" and the years/months switch moved to More options; table headers "Interest claimed / Principal claimed"; note kept all caveats in two sentences.
- **Loan balance transfer.** Rates were split by the months field -> order is balance, current rate, new rate, months, costs; "Switching costs" with hint "Fee, legal and stamp duty"; "Saving each month".
- **Simple vs compound interest.** Blurb used SI/CI; table headers "With SI / With CI" -> blurb "Simple, compound and the gap"; headers "Simple / Compound / Gap"; "Compounded" moved to More options (default yearly).
- **Credit card EMI cost** (was "Credit card EMI"). Title hid that the answer is the extra cost -> new title, blurb "True cost including GST", headline "Extra you pay over the price", "Real yearly rate (with GST and fee)"; hint "Example rate. Enter your own, or 0 for no-cost EMI."
- **Typical loan rates.** Blurb 10 words -> "Typical rates by loan type"; "Loan amount for example EMI"; "Usual loan term".

## Investments (12)

All: "Expected return a year" -> "Expected yearly return"; "Years" -> "Number of years" with a "Whole years only" hint where decimals fail; "Corpus" replaced by "Value at the end" or "Starting amount".

- **SIP: monthly investing.** Title was bare "SIP"; "Corpus" jargon -> new title and result labels ("Value at the end", "Total invested").
- **Step-up SIP.** "Raise it every year by" -> "Yearly increase"; "A flat SIP would reach" -> "Without step-up".
- **Lump sum investment** (was "Lumpsum"). Headline "Final value"; label "Amount invested".
- **SIP for a goal** (was "Goal SIP"). "Already saved" is optional -> moved to More options.
- **SWP: monthly withdrawals.** Blurb 8 words -> "How long your money lasts"; "Corpus" -> "Starting amount"; note cut to two sentences.
- **Fixed deposit.** Compounding and tax slab are secondary -> both under More options; hint "Your highest tax rate, e.g. 30".
- **Recurring deposit.** Blurb vague -> "Maturity value of a monthly deposit"; same year hint as FD.
- **Public Provident Fund** (was "PPF"). Title now spelled out ("ppf" stays a search keyword); the term select reads "20 years (1 extension)"; note in two sentences.
- **NPS pension.** Annuity share and rate are example numbers most people never change -> under More options, hints keep "Example ... check/enter your own"; "Corpus" -> "Fund".
- **Provident fund (EPF).** Seven fields -> salary, years, salary rise and interest rate on top; your share, employer share and wage ceiling under More options; hints cut to 12 words or fewer.
- **Inflation.** Headline "Costs this much then" was unclear -> "Future cost of the same thing"; optional return moved to More options; "Return after inflation, a year".
- **Investment return** (was "CAGR / XIRR"). Mode options were long -> "Two values / Many dates" (segmented); headlines "Yearly growth (CAGR)" and "Annual return (XIRR)" explain the jargon.

## Tax and salary (6)

All: age is now under More options everywhere (default "Below 60" is right for most); every old-regime-only field says "(old regime)" in its label so the warning is visible without a hint.

- **Income tax: old vs new.** Thirteen fields on screen -> five on top (salary, 80C, health insurance, home loan interest, HRA), eight under More options; slab table now shows From / Up to / Rate / Tax with grouped rupee amounts instead of text like "400000".
- **Take-home salary** (was "In-hand salary from CTC"). Eight fields -> five on top; professional tax, HRA and age under More options.
- **Capital gains tax.** Eight fields and an eight-word-plus blurb -> five on top (what, dates, prices), costs / slab / exemption under More options; option labels shortened; "STT paid" moved into a hint and the note.
- **Advance tax.** Date labels carried the year and ran long; three rare fields -> labels "Paid by 15 Jun" etc.; presumptive, age 60+ and months under More options. **Still 6 fields on top** (tax, TDS, four payments), see the list at the end.
- **Gratuity.** "Extra months" hint kept ("0 to 11"); "Gratuity actually received" is optional -> More options; "Covered (10+ employees)" -> "Covered / Not covered" (segmented) with the 10-staff rule in a hint.
- **Freelancer tax (44ADA).** Six fields -> receipts, expenses and regime on top; cash share, other income and age under More options.

## Product metrics (7)

- **Customer cost and value** (was "CAC and LTV"; "cac" and "ltv" still match in search). Jargon -> plain title; result rows "CAC (cost to win one customer)" and "LTV (lifetime value)". Test regex for the LTV row loosened to match.
- **Customer payback time** (was "CAC payback"). Hint repeated its label -> deleted; label "Cost to win one customer".
- **Funnel conversion.** Table headers "Step / Overall" were unclear -> "Of previous / Of first".
- **Recurring revenue forecast** (was "ARR and MRR run-rate"). Hint repeated label -> deleted; rows explain ARR, MRR and NRR in the label.
- **A/B test sample size.** Alpha and power are standard values -> More options; "Absolute / Relative" segmented; hint on the lift field says points or percent of current; hint repeating the label deleted.
- **Customer retention** (was "Retention and cohort"). Hint repeated the label -> deleted; "Customers at the start".
- **Rule of 40 and burn multiple.** Blurb 10 words -> "Growth plus profit, and burn efficiency"; "Burn multiple (burn per rupee of new ARR)".

## Needs a ToolScreen or engine change (owner decides)

1. **Advance tax has 6 fields on top.** Tax, TDS and the four quarter payments all change the answer, and none is optional in practice. A "rows" layout for the four payments would fit it in five.
2. **Percentage and date labels cannot change with the mode.** "X" and "Y" mean different things per mode, so they stay "Number X/Y" and the result sentence explains. A `label` that can be a function of the values would fix it.
3. **No time picker.** World time only shows "now". Converting a chosen time between cities needs a `time` field kind.
4. **No `km`, `cm`, `kg` or `litre` unit.** Those words stay in the label ("Distance (km)", "Height (cm)"). Extra `Unit` values would let the screen show them like the rupee sign.
5. **Loan term is a number plus a years/months switch.** On long forms the switch is tucked away, so a hint says "In years. Switch to months under More options." A single "term" field that accepts "18 months" or "20 years" would remove the trap.
6. **Advanced fields hide example numbers.** NPS annuity share and rate, EPF wage ceiling and the FD slab hold example values the user should check. The notes say so, but a small "using example values" badge on the More options line would be safer.
7. **Preset GST labels come from the engine** ("5% (merit)", "40% (special)"). Left as they are; shorten them in `gstRates.ts` if wanted.
8. **Tax terms are mixed.** Income tax says "80C", home loan tax says "section 123" (the 2025 Act number). Both are correct; pick one style across the app.
