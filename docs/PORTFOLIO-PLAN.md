# Portfolio: plan (added to the roadmap 2026-11-03)

**Owner request:** a Portfolio section where the user adds and updates logs of their portfolio, with portfolio type, categories, sub-categories, invested amount and other useful information, and checks growth from time to time.
**Critic review (same day), verdict: build smaller.** The repo already rules out a *net-worth tracker* because hand-typed values go stale and the app gets abandoned (`MASTER-ROADMAP.md` Ruled-out table; `COMPETITIVE-RESEARCH-AND-PLAN.md` 3c: "manual entry has poor real-world sustained use"). `PRD.md` D14 already accepts a smaller thing: a net-worth *snapshot* with an as-of date. So: ship the owner's holdings log with dated value history, make updating cheap, label stale values loudly, and gate the extras on real use.
Status: **Planned. Nothing built yet.**

## What the user can do (v1)
| Action | Detail |
|---|---|
| Add a holding | Name, **type** (Mutual fund, Stock, FD/RD, PPF/EPF/NPS, Gold, Real estate, Bonds, Crypto, Cash/Savings, Other), **category** and **sub-category** (reuse the Budget picker pattern; own list per type, e.g. Mutual fund > Equity > Flexi cap), platform or account (free text, e.g. "Zerodha"), folio or ID (optional), start date, **invested amount**, units and average price (optional), maturity date and expected rate (for FD/RD/bonds), note |
| Update value | One tap "Update value": type today's value, date defaults to today. Each update **appends a dated snapshot** (history is the growth record). Pre-filled with the last value |
| Add money / withdraw | A dated "invested more" or "withdrew" line, so invested amount stays honest after a SIP or a sale |
| See growth | Per holding and for the whole portfolio: invested, current value, gain in ₹ and %, **how old the value is** ("updated 41 days ago", stale after 30 days, in words not only colour). Growth over time as a plain table of snapshots; a bar per month only if the roadmap chart item is built |
| Group | By type, category, sub-category; allocation shown as numbers and bars (no pie: see Ruled out) |
| Keep it up | Monthly "Update your portfolio values" reminder through Due (one tap to create); "Copy last values" so a quiet month is one tap |
| Safety | Hidden amounts by default ("Show"), excluded from CSV/backup exports unless chosen, never sent anywhere, every delete undoable |

## Growth maths (reuse `src/engine/investments/invest.ts`)
- Absolute gain and simple % = always.
- `cagr(start, end, years)` for point-to-point growth when there is a start value and date.
- `xirr(flows)` only when dated cash flows exist (add money / withdraw lines). It returns an error variant (`too-few`, `no-sign-change`): show that in plain words.
- `growCorpus` / `sipFutureValue` are for "what if" projections only and must never be mixed into logged actuals.
- New pure functions (engine first, tests first): portfolio total, stale check, allocation share, snapshot series. Put them in `src/engine/investments/portfolio.ts`.

## Phases
| Phase | What | Gate |
|---|---|---|
| P1 | Holdings, types/categories/sub-categories, invested, update value with dated snapshots, gain and age, group totals, hidden amounts, backup round trip, onboarding tour | Build now-ish (M effort) |
| P2 | Add money / withdraw lines + XIRR; monthly Due reminder; "Copy last values"; CSV export of the portfolio | Only if the owner is still updating after about a month (unproven) |
| P3 | **Suggested lines from bank SMS**: mutual fund purchase, SIP, FD booking messages already reach the reader (real inbox has dozens). Offer "Add to Portfolio" in the review list, user confirms. The parser today only guesses a Savings *category* (`smsParse.ts` guessCategory), it does not extract folio or fund yet | After P2 |
| P4 | Allocation view by type and category; per-holding line chart (needs the chart-library decision) | Later |

## Out of scope on purpose
Live prices or NAV fetching (network + freshness duty), tax or capital-gains claims, "rebalance" or buy/sell nudges (advice), fund overlap, benchmarks, an account or cloud sync, pie charts. Brokerage and demat linking needs a licensed partner and server (Ruled out).

## Risks
| Risk | Answer |
|---|---|
| Values go stale and the screen lies | Age shown on every value, stale label in words, totals say "includes values older than 30 days" |
| Entry cost kills it | One-tap update, last values pre-filled, monthly reminder, SMS suggestions in P3 |
| Looks like advice | Only the user's own numbers, no recommendations, a plain line "Your own entries, not advice" |
| Privacy on a shared screen | Amounts hidden until tapped |
| Wrong XIRR | Shown only with dated flows; unit-test against a worked example before it ships |

## Data model sketch (additive, schema stays 3)
`portfolio?: { holdings: Holding[] }`; `Holding { id, name, type, categoryId?, subCategoryId?, platform?, ref?, startDate, invested: string, units?: string, maturityDate?, expectedRate?: string, note, snapshots: { date, value: string }[], flows?: { date, amount: string, kind: 'add'|'withdraw' }[], deletedAt }`. Money as strings, never JS numbers. Cap: 200 holdings, 120 snapshots each.
