# Use cases — what Calc actually covers

A living list, not a plan. ✅ = built and working today. ⏳ = specified but not built (or only partly). Checked
against the code on 2026-11-02 (`docs/PRD.md` sections A–H, `src/features/*`, `src/engine/*`). Add rows as you
think of more — see **Future ideas** at the bottom.

## Basic calculator

| Use case | | Maps to |
|---|---|---|
| Type an expression with `+ − × ÷ ( ) %`, see a live preview, press = to commit | ✅ | PRD A1–A2, `src/engine/expression/` |
| Keep up to 200 past calculations, tap one in History to reuse it | ✅ | PRD A4, `HistorySheet.tsx` |
| Switch Indian (12,34,567) vs International (1,234,567) number format | ✅ | PRD A5, Settings → Numbers |
| Set decimal places 0–10 or auto | ✅ | PRD A6, Settings → Numbers |
| Type on a physical/hardware keyboard, Enter = evaluate | ✅ | PRD A8, `useKeyboard.ts` |
| Copy a result, paste a number or expression (native clipboard + "Paste here" fallback) | ✅ | PRD A9, `CalcParts.tsx`, `lib/clipboard.ts` |
| Light / Dark / System theme, pick an accent colour | ✅ | PRD A10, Settings → Appearance |
| Pick which calculator or screen the app opens on | ✅ | PRD A12, Settings → Behaviour |
| Export/import a full backup (history + settings) as a JSON file | ✅ | PRD A13, Settings → Your data |
| Every result shows the formula/substituted values | ✅ | PRD A14, `ToolScreen.tsx` result cards |
| Vibrate on key press, keep screen on | ✅ | PRD A15, Settings → Behaviour |
| Reorderable favourites/pinned calculator list on the Tools home | ⏳ | PRD A11 — not built; only saved-card pinning (Notes) exists |
| History row menu: Copy · Share · Edit · Lock/Unlock · Delete | ⏳ | PRD A16, P1.1 — `HistorySheet.tsx` has tap-to-reuse, delete and name, not yet a `⋮` menu |
| **Name a calculation**, it is then kept — Clear-all and the 200 cap can't touch it | ✅ | PRD A18, P1.1 — `renameHistory()` + inline edit in `HistorySheet.tsx`, `capHistory()` in `store/app.ts`. **A17's separate "lock" state was dropped**: naming already means keeping, a second mechanism would be redundant |
| Edit a history entry's expression/date, re-evaluated on save | ⏳ | PRD A19, P1.1 — only the name is editable so far; the expression/date part was deliberately not built (see IMPROVEMENT-PLAN follow-up: editing the date of a past calculation lets history be falsified) |
| Share a history entry through the system share sheet | ⏳ | PRD A20, P1.1 — not built |

## Scientific calculator

| Use case | | Maps to |
|---|---|---|
| sin/cos/tan/asin/acos/atan/log/ln/√/π/e, deg\|rad toggle | ✅ | PRD A3, `ScientificScreen.tsx` |
| M+ / M− / MR / MC memory keys | ✅ | PRD A7, `ScientificScreen.tsx` |
| Paste, Copy, Undo on the Scientific screen | ⏳ | Space constraint at 360×640 — basic calculator only (`docs/HANDOFF.md` #5) |

## Everyday converters (15 calculators)

| Use case | | Maps to |
|---|---|---|
| Convert between units in a category (length, weight, etc.) | ✅ | PRD B1, `everyday.ts` → `unit-converter` |
| Convert currency with a bundled rate snapshot | ✅ | PRD B2, `unit-converter` group → `currency` |
| Percentage: X% of Y, X is what % of Y, % change | ✅ | PRD B3 → `percentage` |
| Discount: MRP, one or more % off, optional flat-off | ✅ | PRD B4 → `discount` |
| GST: add or remove, any slab, intra/inter-state split | ✅ | PRD B5 → `gst` |
| Tip: bill, tip %, split by people | ✅ | PRD B6 → `tip` |
| Unit price compare across 2–5 items, cheapest highlighted | ✅ | PRD B7 → `unit-price` |
| Date difference, add/subtract days, age in Y-M-D | ✅ | PRD B8 → `date` |
| World time across cities | ✅ | PRD B9 → `world-time` |
| Number base conversion + bitwise ops | ✅ | PRD B10 → `number-base` |
| Fuel cost for a trip | ✅ | PRD B11 → `fuel-cost` |
| Fuel efficiency across km/l, mpg, l/100km | ✅ | PRD B12 → `fuel-efficiency` |
| BMI, BMR, TDEE, ideal weight, body-fat estimate | ✅ | PRD B13 → `body-metrics` |
| Weighted grade average / GPA | ✅ | PRD B14 → `grade-average` |
| Ovulation / fertile window estimate | ✅ | PRD B15 → `ovulation` |

## Loans & EMI (11 calculators)

| Use case | | Maps to |
|---|---|---|
| EMI from principal, rate, tenure | ✅ | PRD C1 → `emi` |
| Full month-by-month amortisation schedule | ✅ | PRD C2 → `amortisation` |
| Prepayment impact (reduce EMI or tenure) | ✅ | PRD C3 → `prepayment` |
| Reverse EMI: max loan you can afford | ✅ | PRD C4 → `reverse-emi` |
| Rate-change simulator | ✅ | PRD C5 → `rate-change` |
| Compare 2–3 loan offers side by side | ✅ | PRD C6 → `loan-compare` |
| Home-loan tax benefit (24(b) + 80C) | ✅ | PRD C7 → `home-loan-tax` |
| Balance transfer breakeven | ✅ | PRD C8 → `balance-transfer` |
| Simple vs compound interest | ✅ | PRD C9 → `simple-compound` |
| Credit-card EMI incl. GST on interest+fee | ✅ | PRD C10 → `card-emi` |
| Typical rate/tenure presets by loan type | ✅ | PRD C11 → `loan-presets` |

## Investments & savings (12 calculators)

| Use case | | Maps to |
|---|---|---|
| SIP corpus/gains projection | ✅ | PRD D1 → `sip` |
| Step-up SIP (annual increase) | ✅ | PRD D2 → `step-up-sip` |
| Lumpsum maturity | ✅ | PRD D3 → `lumpsum` |
| Goal SIP (reverse: target corpus → required monthly) | ✅ | PRD D4 → `goal-sip` |
| SWP: how long a corpus lasts under withdrawal | ✅ | PRD D5 → `swp` |
| Fixed deposit maturity, any compounding frequency | ✅ | PRD D6 → `fd` |
| Recurring deposit maturity | ✅ | PRD D7 → `rd` |
| PPF maturity with 15-year + extensions | ✅ | PRD D8 → `ppf` |
| NPS corpus, annuity split, monthly pension | ✅ | PRD D9 → `nps` |
| EPF retirement corpus | ✅ | PRD D10 → `epf` |
| Inflation / real-return conversion | ✅ | PRD D11 → `inflation` |
| CAGR / XIRR from values or dated cashflows | ✅ | PRD D12 → `cagr-xirr` |
| Growth chart (invested vs returns over time) | ⏳ | PRD D13 — no chart library wired in; Recharts listed in PRD stack but not used yet |

## Tax & salary — India (6 calculators)

| Use case | | Maps to |
|---|---|---|
| Income tax: old vs new regime, slab breakdown, cheaper option | ✅ | PRD E1 → `income-tax` |
| In-hand salary from CTC | ✅ | PRD E2 → `in-hand-salary` |
| Capital gains: STCG/LTCG, indexation where applicable | ✅ | PRD E4 → `capital-gains` |
| Advance tax instalments + 234B/C shortfall interest | ✅ | PRD E5 → `advance-tax` |
| Gratuity payable + tax-exempt portion | ✅ | PRD E6 → `gratuity` |
| Freelancer 44ADA: presumptive vs actual-books | ✅ | PRD E7 → `presumptive-44ada` |
| HRA exemption computed from the official least-of-3 rule | ⏳ | PRD E3 — not shipped: the 2026 HRA rule has no primary source yet (CLAUDE.md rule: don't ship an unverified tax figure). You type the exempt amount by hand in Income tax and In-hand salary instead |

## Business metrics (7 calculators)

| Use case | | Maps to |
|---|---|---|
| CAC, LTV, LTV:CAC verdict vs 3:1 | ✅ | PRD F7 → `cac-ltv` |
| CAC payback period | ✅ | PRD F8 → `cac-payback` |
| Funnel conversion, biggest drop-off | ✅ | PRD F9 → `funnel` |
| ARR/MRR run-rate projection | ✅ | PRD F10 → `arr-mrr` |
| A/B test sample size | ✅ | PRD F11 → `ab-sample-size` |
| Retention / cohort curve | ✅ | PRD F12 → `retention` |
| Rule of 40 / burn multiple | ✅ | PRD F13 → `rule-of-40` |

## Notes (saved cards)

| Use case | | Maps to |
|---|---|---|
| Save any calculator's result as a card with live inputs, reopen and edit it | ✅ | PRD G1, `SaveSheet.tsx`, `CardView.tsx` |
| Free-text note on a card | ✅ | PRD G3, `SaveSheet.tsx` |
| Tag a card (Credit Card, Loan, Rent, Tax, Travel, …), pin up to 5 | ✅ | PRD G8, `SavedScreen.tsx` |
| Search notes by title, note text, tag, amount | ✅ | PRD G9, `lib/cardSearch.ts` |
| 7-day recoverable Trash, Undo on delete | ✅ | PRD G10, `SavedScreen.tsx` trash view |
| Attach a photo (receipt/bill) to a note | ⏳ | PRD G3 — text note only, no photo attach |
| Export a card as text / PNG / PDF | ⏳ | PRD G12 — no export beyond the JSON settings backup |

## Lists (tapes)

| Use case | | Maps to |
|---|---|---|
| Running tally of labelled line items ("Flights 24000"), live total | ✅ | PRD G2, `TapeScreen.tsx` |
| Edit or delete any line | ✅ | PRD G2, `TapeScreen.tsx` |
| Split one number into N equal lines with checkboxes to tick off who's paid | ✅ | `ToListSheet.tsx` |
| Share a list as an image or PDF | ⏳ | PRD F5/G12 — not built |

## Reminders

| Use case | | Maps to |
|---|---|---|
| Set a due date + repeat rule + lead days on any saved card | ✅ | PRD G4, `SaveSheet.tsx` |
| Local notification with Mark paid · Snooze · Open | ✅ | PRD G4, `lib/notifications.ts` — **never fired on a real device yet** |
| Mark paid auto-advances a recurring reminder | ✅ | PRD G5, `lib/reminders.ts` (`advance()`) |
| Due tab: Overdue → This week → Later, total due in 30 days | ✅ | PRD G6, `DueScreen.tsx` |
| Smart suggestion chip after a calculation ("Remind me", "To list") | ✅ | PRD G7, `ResultActions.tsx` |
| Reminder time picker (not fixed to 9am) | ⏳ | Backlog, `docs/IMPROVEMENT-PLAN.md` item 6 |

## Settings

| Use case | | Maps to |
|---|---|---|
| Theme, accent colour | ✅ | Settings → Appearance |
| Number format, decimal places, angle mode | ✅ | Settings → Numbers |
| Pick what the app opens on (any tab or any calculator) | ✅ | Settings → Behaviour |
| Vibrate on key press, keep screen on, turn history off | ✅ | Settings → Behaviour |
| Export / restore a full backup | ✅ | Settings → Your data |
| App version shown, no-ads/no-account statement | ✅ | Settings → About |

## Platform / Android

| Use case | | Maps to |
|---|---|---|
| Android debug build installs and launches | ✅ | PRD §8, `android/`, `docs/BUILD-ANDROID.md` — **but the installed APK predates the latest UI changes; rebuild before testing** |
| Hardware back button closes sheets/screens in the right order | ✅ | PRD, `lib/backStack.ts`, `lib/nativeBack.ts` |
| Status bar icons readable in both themes | ✅ | `lib/statusBar.ts` |
| Inexact reminder scheduling (no `SCHEDULE_EXACT_ALARM`) | ✅ | PRD H5, confirmed removed in `AndroidManifest.xml` |
| Rules packs fetched from a CDN (tax/GST/rates stay current without a release) | ⏳ | PRD H1 — rates are bundled JSON only, no CDN mechanism |
| Freshness disclosure ("Rates as of …") on affected results | ⏳ | PRD H2 — not built |
| Guided OEM battery-killer setup (Xiaomi/Vivo/Oppo/Realme) | ⏳ | PRD H7 — not built |
| Home-screen widgets (quick calculator, next due, tape total) | ⏳ | PRD H9 — native Kotlin work, not started |
| Quick Settings tile | ⏳ | PRD H11 — not started |
| Share-sheet intake (open Calc with a number from another app) | ⏳ | PRD H12 — not started |
| Biometric app lock | ⏳ | PRD H13 — not started |
| iOS build | ⏳ | PRD §6 — Android-only so far |

---

## Future ideas

_(Owner: add ideas here as you think of them. This section is intentionally left empty — the existing backlog docs already have plenty.)_
