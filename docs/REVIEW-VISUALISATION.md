# Review: making information easy to see at a glance (360px phone)

Written 2026-11-02, round 5. Read-only review, no code changed. Read the five docs named in the brief and the screens in
`src/features` (tools, budget, memory, calculator) with `budget.css` / `tools.css`. I did not run the app. **Every suggestion is unproven** until the owner uses it.

---

## 1. Verdict

**The app is good at "number first, picture second". It is weak at four things: comparing two options, time (pace, week,
statement cycle), part-of-a-whole, and one chart with no numbers in text.**

| Works today | Missing |
|---|---|
| Every bar has its number beside it | The EMI chart has **no numbers in text** |
| Heat cells have spoken labels | Heat shade is flattened by one big day |
| Tables become row blocks, no sideways scroll | No "A vs B" picture; a limit ignores the date |
| Colour never the only signal | Due and To-do have no week view or progress |

## 2. Findings in the current code

| # | Finding | Where | Why it matters |
|---|---|---|---|
| F1 | Over-limit text uses `--alert` (the **overdue** colour) | `.budget__note--over`, `budget.css` | Over-limit is "against you" = `--negative`. Same hue, wrong token |
| F2 | EMI chart: screen readers get series names only. No values, no table (SIP has one) | `Chart`, `emiSpec` | Fails "numbers in text" |
| F3 | Chart ticks are SVG text, about 9px, fixed | `.chart__tick` | Ignores 200% font; DS says type is `rem` |
| F4 | Heat level = `ceil(day / biggestDay * 4)` | `dailyTotals`, `budget.ts` | One rent day makes all other days level 1 |
| F5 | Limit state ignores the date | `limitState` | 80% on the 3rd and on the 28th both say "Close to the limit" |
| F6 | "Last 6 months" draws the current month ("so far") short beside full months | `SpendSummary.tsx` | Reads as "spending fell" |
| F7 | History row has 3 icons, about 114px of a 296px card | `.hrow__acts` | Expression gets about 180px. Edit and delete are already in the "more" sheet |
| F8 | One `Bar` look means three things: share, limit use, size vs biggest month | `Bar` | Words must say which |
| F9 | Spending summary stacks 8 sections (scroll length not measured) | `SpendSummary.tsx` | Limits, the "how am I doing" part, sit near the bottom |

---

## 3. Which picture for which question

Lengths on a shared baseline are read most accurately; angles and areas worse. So bars, never pies.

```
                    WHAT IS THE USER ASKING?
                             |
   +-----------+-------------+------------+-------------+-------------+
   v           v             v            v             v             v
+--------+ +=========+ +----------+ +----------+ +----------+ +-----------+
|How big?| # A or B?  # | Part of  | | Over     | | Which    | | How far   |
|        | # PAIR *   # | a whole  | | time?    | | days?    | | along?    |
+---+----+ +====+====+ +----+-----+ +----+-----+ +----+-----+ +-----+-----+
    |           |           |            |            |             |
 number     two bars,    split bar    Strip /        Heat        Bar + pace
 (+ Bar)    same scale   (2-3 parts)  sparkline    (calendar)    tick
  * = build first      x ruled out: pie, 3D, dual axis, count-up animation
```

---

## 4. The mini visual language (5 parts)

All `div`s plus one SVG circle, in `src/components/viz.tsx` and `src/styles/viz.css`. **No chart library:** five rectangles
do not justify one, and a library brings its own colours (breaks "raw colours only in `theme.ts`") and text that will not scale.

| Part | Job | Size at 360px | Tokens |
|---|---|---|---|
| **Bar** | One size against a whole or a limit | track 8px high (now 6), full row | track `--line`, fill `--ink-2`, radius `--r-sm` |
| **Pair** | Compare 2 or 3 things | label + value + Bar per row, one shared scale | "now" fill `--ink`; "other" 1px `--ink-3` outline, no fill |
| **Strip** | A few slots in a row | `repeat(N, minmax(0,1fr))`, 44px touch, art max 32px | column `--ink-2`, empty slot 1px `--line` |
| **Heat** | Days of a month | 7 columns, cell 44px high, gap 4px | 5 steps of `--ink`, selected 2px `--accent` outline |
| **Ring** | One count out of a total (last) | 48px, stroke 6, r 20 | track `--line`, arc `--ink-2`, number **beside** it |

**Rules for all five**

1. **The number is text, beside or under the picture.** The picture is `aria-hidden`; the row's `aria-label` says it in words
   ("Food, ₹12,000, 32 percent, ₹3,000 left of ₹15,000").
2. **Bars start at zero.** If two values differ by under 3% the bars look equal. That is honest. Say the gap in words.
3. **Identity without colour:** filled vs outlined, position, a word. Never two greys close together.
4. **`positive` / `negative` go on words, not bars.** One exception: an over-limit fill is `--negative`, with "Over by ₹X" beside it.
   `--accent` marks only "tappable" or "selected".
5. **Art in px, text in `rem`.** At 200% font the art stays, text wraps, rows stack.
6. **One scale per picture.** No tint behind a Result picture (DS section 3).

**States**

| State | Bar | Pair | Strip / Heat | Ring |
|---|---|---|---|---|
| Empty | Track only, "Nothing yet" | Not drawn; plain rows | Empty slots (1px `--line`), hint "Nothing spent" | Track only |
| One value | Fill = share (100% if whole) | Not drawn (needs two) | One column or one dark cell | Full arc |
| Huge value | Bar is a percent, never overflows; value drops **under its label** (money never breaks) | Same | Strip labels show counts; Heat shows day number, amount in the label | Unchanged |
| Negative / over | Fill 100%, `--negative`, "Over by ₹X". Bars never run backwards | Word "less", never a negative length | A word, not a column below the line | Full arc, "Over" |
| 200% font | Stacks: label, value, Bar, note | Label over value over bar | Slot label shrinks to a letter; date moves to the list | Number moves under |

---

## 5. Place by place

### 5.1 Calculator: result and words line

| Now | Big mono result, expression above, words line under (`display__echo`) |
|---|---|
| Question | "Did I read that number right?" |
| Visual | **None.** Grouped digits plus the words line answer it. Do not chart |


### 5.2 History

| Now | Card per row: name, expression, "= answer", edit + delete + more icons (F7) |
|---|---|
| Question | "Where was yesterday's sum, and its answer?" |
| Visual | **Ledger:** day headers, answer right-aligned in mono, one `...` icon |

```
 Today -------------------------------
  18% of 4,50,000             [ ... ]
                    = 81,000.00
 Yesterday ---------------------------
```
Day header is an `h3`; `...` keeps its name. No action is lost.

### 5.3 Loan EMI

| Now | 4 rows + stacked yearly chart with no numbers (F2, F3) |
|---|---|
| Question | "How much is interest, and when does it turn?" |
| Visual | **Split bar** (loan / interest) + words row "Principal passes interest in year 9" + chart kept, year table collapsed |

```
 [########|:::::::::::::]  EMI ₹43,391
  Loan ₹50,00,000  Interest ₹54,13,840
 Principal passes interest in year 9
```
Needs one small engine function (first year principal is at least interest) with a test. Chart ticks become HTML text.

### 5.4 Repayment schedule

One block per year today. Add a **Bar per block** (balance still owed as share of the loan) and "Half repaid in year 14". Yearly view
only; the 240-row monthly view gets no bars.

### 5.5 SIP growth (also step-up, lump sum, goal, RD, PPF, NPS, EPF)

| Now | Stacked yearly bars + up to 60 year blocks |
|---|---|
| Question | "How much is my money, how much is growth?" |
| Visual | **Split bar** + **sparkline** of year-end value + table collapsed past 12 rows |

```
 [#####:::::::::::::::::]  Final ₹23,23,391
  You put in ₹12,00,000   Growth ₹11,23,391
  Returns are not guaranteed.   > Show all 10 years
```
**⚠ Remember:** a growth picture invites over-trust. Keep the "not guaranteed" note under the bar, not at the foot.

### 5.6 Income tax: old vs new

| Now | Main row "New regime is cheaper, you save ₹X" (positive), 5 rows, slab table |
|---|---|
| Question | "Which regime, by how much?" |
| Visual | **Pair** on tax under each regime; cheaper one tagged by the word "Lower" |

```
 New  ₹1,24,800 [########:::::]  Lower
 Old  ₹1,48,200 [###########::]
```
`positive` stays on the saving only; a tie has no tone. **Do not chart slabs:** the rate column is the picture.

### 5.7 FD maturity (also RD, PPF)

| Now | Rows: maturity, interest, tax, after tax |
|---|---|
| Question | "What do I end with after tax?" |
| Visual | **Split bar in three:** deposit, interest kept, tax. The tax part is outlined, not red (a slab fact has no tone) |


### 5.8 Prepayment, rate change, balance transfer

Rows "Interest without / with prepayment" and months saved become two **Pairs:** interest, and loan length (240 to 214 months).

### 5.9 Comparison screens (loan offers, card EMI, simple vs compound)

| Now | 3 to 6 column table drawn as one block per offer |
|---|---|
| Question | "Which costs least overall?" |
| Visual | **Pair** on the one deciding number (total cost); other columns stay as block text |

Wireframe as 5.6, with a last line "₹12,000 apart (under 1%)".

**⚠ Remember:** when two bars look the same, that is the truth. The words line is what the user needs. Never cut the axis.

### 5.10 Budget home: hero, limits, needs attention

| Now | Hero (2rem mono), 6px Bar, spent-of-limit, pace sentence, Add, up to 3 attention rows, summary row, 5 recent |
|---|---|
| Question | "Am I fine this month? What next?" |
| Visual | Keep. Add a **pace tick** to the hero Bar, `--negative` for over (F1), a mini Bar on attention rows |

```
 Left this month  ₹12,400
 [########:::::::|::::]    | = today
 ₹37,600 spent of ₹50,000 - ahead of pace
 Needs attention
  Food       Over by ₹400 [#########] >
```

### 5.11 Limits: "on track" or "ahead"

| Now | Four states by spent vs limit only (F5) |
|---|---|
| Question | "At this speed do I run out before month end?" |
| Visual | **Bar with a pace tick** at `day / days in month`; words choose the state |

```
 spent/limit <= day/days        -> "On track"
 spent/limit  > day/days, <100% -> "Ahead of pace: ₹1,200 above where you would be"
 spent >= limit                 -> "Limit reached" / "Over by ₹X"  (--negative)
 Food [######:|:::::::]  ₹6,000 of ₹15,000   (tick at 40%, spent 40%: on track)
```
Tick is `aria-hidden`; words carry it. Needs one tested pure function in `budget.ts` (month length, leap February). **Unproven:** whether the owner wants "ahead of pace" wording.

### 5.12 Spending summary

| Section | Question | Visual | Change |
|---|---|---|---|
| Total | "More than usual?" | Number + **Pair** (so far vs same days last month) | Pair beside the existing sentence |
| Day by day | "Which days were big?" | **Heat** | Levels by rank, legend shows real amounts (F4) |
| Last 6 months | "High or low?" | Bars (as built) | Tick at last month's same-day amount for the current month (F6) |
| By category | "Where did it go?" | Ranked Bar list (as built) | Keep. Top 5 + "Other" past 7. Never a pie |
| Biggest spends | "What was the big one?" | Ledger rows | No picture |
| Paid with | "Cash, UPI or card?" | **Split bar** (up to 4 parts) + rows | Add the bar |
| Cards and accounts | "Which card took most?" | Ranked Bar list | Add Bar |
| Limits | "What is left?" | Bar + pace tick | See 5.11 |

```
  This ₹37,600 [##############]   same days
  Last ₹35,500 [#############:]   last month +6%
 [########|#####|##|.]  UPI 58%  Card 31%  Cash 9%
```
**Page order** (answer first): Total, Limits, Day by day, By category, Last 6 months, Paid with, Cards, Biggest spends.

### 5.13 Card outstanding and statement cycle

| Now | One line per card, "Owes ₹X" (`owesWords`). Statement day and due day are stored, not drawn |
|---|---|
| Question | "How much do I owe, when is the bill, how much limit is used?" |
| Visual | **Bar** for use of the credit limit + a one-line **cycle strip** statement to due, today marked |

```
 Tata Neo (RuPay)         Owes ₹34,200
 [#########::::::::]  34% of ₹1,00,000
 [12 Nov ----T------------------ 2 Dec]  due in 30 days
```
High use is a fact, so no `negative`. A passed due date is `alert` (overdue), as on Due. Needs feature 7f; until then Bar and words only.

### 5.14 Due: week strip

| Now | "Due in the next 30 days" total, then Overdue / This week / Later |
|---|---|
| Question | "What falls on which day this week?" |
| Visual | **Strip of 7 days:** weekday, date, a dot per item (max 3, then +), today ringed, tap filters the list |

```
  M   T   W   T   F   S   S
 [3] [4] [5] [6] [7] [8] [9]
  .       ..          .
```
Each slot is a button ("Wed 5 Nov, 2 reminders, ₹12,400"); dots are `aria-hidden`. The total says 30 days but "Later" can go
beyond 30: say so in one of the two labels.

### 5.15 To-do: Today progress

| Now | Add box, Today / Upcoming / All, checkbox sections. No progress |
|---|---|
| Question | "How much of today is done?" |
| Visual | **Bar** "3 of 5 done" under the switch, Today only, when at least 1 task. Ring optional (section 8) |

DS section 10 already has the wording ("N of M done"). No colour celebration: all done = the words "All done today".

### 5.16 Notes list and 5.17 Settings

| Place | Visual | Note |
|---|---|---|
| Notes list | **None.** Title + one dim line, amount right | Add "Used 2 Nov" to the dim line. No thumbnails |
| Settings | **Live samples, not charts** | Number format already has one; add Decimal places ("1,234.5"). "Your data" says "6 expenses, 22 history rows" |

---

## 6. What NOT to chart

| Do not chart | Why | Instead |
|---|---|---|
| One number (EMI, BMI, tip) | A picture adds nothing | Big number + one words line |
| Under 3 points over time | No trend exists | Two numbers and the gap in words |
| More than 7 categories | Slivers cannot be read | Top 5 + "Other" |
| **Pie, donut, treemap** | Angles and areas read worse than lengths; BUDGET-PLAN already skips them | Ranked Bar list with percent in text |
| Converters, date, base, percentage, discount, GST | The answer is the number | Result rows |
| Tax slabs, schedules | Exact figures matter more than shape | Row blocks |
| A forecast past the input years | Looks like a promise | Stop at the term; keep the note |
| Count-up animation, notes, reminders | DS section 6; text records | Instant; lists |

**Ring:** same job as a Bar, costs 48px of width, reads less exactly. Included because asked; **ranked last. Unproven.**

---

## 8. Top 10 by value for effort

S = under half a day, M = about a day. Value is my judgement from the findings, not measured.

| Rank | Change | Fixes | Effort | Value |
|---|---|---|---|---|
| 1 | Over-limit uses `--negative`; one shared `Bar` in `viz.tsx` | F1, F8 | S | Correctness + base for the rest |
| 2 | EMI numbers in text: "passes interest in year N" row, collapsed year table, HTML tick labels | F2, F3 | S | High |
| 3 | **Split bar** on EMI, SIP, FD, Paid with | part of whole | S to M | High |
| 4 | Heat levels by rank + legend with real amounts | F4 | S | Medium to high |
| 5 | To-do Today progress Bar | no progress | S | Medium |
| 6 | **Pair** on tax regimes, prepayment, loan offers, this vs last month | compare | M | High |
| 7 | Limit **pace tick** and "On track / Ahead of pace" | F5 | M | High (tested function needed) |
| 8 | History: one icon, day headers, right-aligned answers | F7 | S to M | Medium |
| 9 | Due **week strip** | time | M | Medium |
| 10 | Card use Bar + statement cycle line | card module | M | Medium (needs 7f data) |

Extras: reorder Spending summary (F9), current-month tick (F6), collapse tables past 12 rows.
**Order:** 1, 2, 4, 5 together (all use `Bar`), then 3 and 6, then 7, then 8 to 10.

**⚠ Remember:** a UI change is not done until `e2e/smoke.mjs` passes, you have looked at the screenshots, and it has been
checked at 360px, in both themes and at 200% font. `architecture.test.ts` must keep passing (no raw colours outside `theme.ts`,
radius `--r-sm|md|lg`, no gradients or shadows).

---

## 9. Evidence and sources

Indian apps were not opened (BUDGET-PLAN section A: low confidence; YNAB and Monarch high).

| Claim | Source |
|---|---|
| Chart data must also be available as text or a table | [DEFRA data visualisation](https://digital.defra.gov.uk/design/data-visualisation), [Analysis Function: charts](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts) |
| Dashboards meet WCAG AA; test design and accessibility | [Analysis Function: testing dashboards](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-testing-dashboards-for-design-and-accessibility) |
| Never colour alone; add labels, shapes or patterns | [Amex data viz accessibility](https://designinternet-qaeusw1green.americanexpress.com/guidelines/data-visualization/accessibility), [Material: accessible data viz](https://m2.material.io/blog/data-visualization-accessibility), WCAG [Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html), [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) |
| Sparklines are word-sized lines; small multiples repeat one chart to compare | [R Journal](https://journal.r-project.org/articles/RJ-2015-003/RJ-2015-003.pdf) (secondary; check Tufte's books for exact wording) |

Searches did not return Material 3's chart page, the GOV.UK Service Manual chart page or Datawrapper, so they are not cited.

---

## 10. Summary (6 lines)

1. **Numbers first is right; add a picture only for size, A versus B, part of a whole, time, or days.**
2. **Build five small parts (Bar, Pair, Strip, Heat, Ring) from divs and one SVG circle. No chart library.**
3. **Fix first:** over-limit uses the overdue colour token, the EMI chart has no numbers in text, one big day flattens the heatmap.
4. **Biggest gains:** a Pair on compare screens, a split bar for interest, growth and tax, and a pace tick on limits.
5. **Do not chart:** single numbers, converters, tax slabs, notes, more than 7 slices, and never a pie.
6. **All of this is unproven with the owner;** build ranks 1 to 5, check screenshots at 360px and 200% font, then decide.
