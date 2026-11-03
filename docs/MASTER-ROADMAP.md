# Master roadmap: everything, consolidated

**Written:** 2026-11-03, **corrected the same day** after the owner asked directly whether every
discussed feature was actually in this file. The first pass had missed real items because it read
the planning/research docs in full but only skimmed `PRD.md`, `FEATURES.md`, `HANDOFF.md`,
`MEMORY-LAYER.md`, `TOOLS-UX-REVIEW.md`, `UI-UX-PLAN.md` and `IMPROVEMENT-PLAN.md`. A second pass
read those in full. What it found and fixed:

- **4 whole calculators from the original spec that were never flagged as missing anywhere else**:
  Runway (C12), multi-loan avalanche/snowball payoff (C13), debt-to-income (D15), savings rate (D17)
  — plus the Emergency Fund calculator (D16) itself, which this file had previously only listed an
  *enhancement* to, wrongly implying the base calculator already existed.
- **One whole tax calculator**: Exit settlement / full-and-final (E8).
- **The proactive "smart suggestion" chip** (G7) — a named, specific differentiator feature in
  `MEMORY-LAYER.md` ("Remind me every month on the 5th" after an EMI) that no other source mentioned.
- **6 platform/reliability items** from `PRD.md` section H: remote rules packs (H1), per-result
  freshness labels (H2), silently-dropped-notification detection (H6), guided OEM battery-setting
  deep links (H7, flagged **Critical** risk in the PRD itself), boot/timezone reminder rescheduling
  (H10), a Quick Settings tile (H11).
- **A handful of smaller items**: share-as-image, PDF export, inline list-line rename, a single
  "loan term" field, formula cross-checks against official calculators, amount quick-chips, Share/
  Reset on a result, scenario compare, three-state checklist lines, exposing the engine as an
  AI-assistant tool, and a few more — each added below with its real source.
- **One status question, not a feature**: `PRD.md`/`FEATURES.md` list "resume per calculator"
  (drafts restored on reopening) as built; this session's own tools1 e2e report found a draft *is*
  lost on reload. Flagged as a discrepancy, not silently resolved either way.

This file merges `ROADMAP.md`, `BACKLOG.md`, `IMPROVEMENT-PLAN.md`, `REVIEW-NEW-FEATURES.md`,
`COMPETITIVE-RESEARCH-AND-PLAN.md`, `TEST-PLAN-REMAINING.md`, `BUDGET-PLAN.md` section H,
`NOTES-TODO-PLAN.md` section H, `PRD.md`, `FEATURES.md`, `HANDOFF.md`, `MEMORY-LAYER.md`,
`TOOLS-UX-REVIEW.md`, `UI-UX-PLAN.md`, and this session's own bug-fix round, into one list,
organised by when it should happen rather than which document it came from.
**The source files are not deleted** — they hold the full reasoning, sources, and rejected
alternatives behind each line here. See the cross-reference at the bottom for exactly which
file to open for more detail on any item.

Status marks: **Done** · **In progress** · **Planned** (decided, not started) · **Blocked** (on
what) · **Unproven** (built, but never confirmed in real use) · **Ruled out** (why, so it isn't
re-suggested).

---

## Phase 0 — Now / this build

Everything in this phase either already landed this session or is small enough to go in the
same build.

| Item | What it is | Why it matters for Calc | Source | Effort | Status |
|---|---|---|---|---|---|
| Sheet Escape closing every open sheet at once | A shared bug: two sheets both listen on `document`, so Escape closed both instead of just the top one | A confirmed bug, not a maybe — found by this session's e2e suite | This session | S | **Done** |
| Card-bill payments detaching on any edit | Editing a credit card's holder name silently un-linked its bill payments (B-04) | A wrong "Owes" figure is exactly the class of bug CLAUDE.md calls unacceptable | This session | S | **Done** |
| Corrupted save white-screening the app (B-16) | A tampered/corrupted `fresh:true` value crashed the whole app on launch | App must never die on bad stored data | This session | S | **Done** |
| Keypad rows under the tab bar at 360×640 | Same fix already applied to Scientific, now applied to Calculate | A 360×640 phone is a common low-end Android size in India | This session | S | **Done** |
| Backup filename using UTC instead of local date | Landed on the wrong day near midnight IST | Small but a real correctness bug | This session | S | **Done** |
| Junk text silently read as 0 (balance transfer, card EMI, 10 tax fields and more) | "12abc" became ₹0 with no warning, everywhere an optional field existed | "A missing calculator is recoverable; a confidently wrong figure is not" — CLAUDE.md's own words | This session | M | **Done**, 27 regression tests |
| Below-absolute-zero temperature, GST over 100% | Accepted silently; now a plain-word error | Same principle as above | This session | S | **Done** |
| No `<h1>` on Tools/Notes/Due; Budget's Summary/Manage had two h1s at once | Owner decision: add titles to match Budget | Accessibility (heading navigation) and visual consistency across the 4 tabs | This session, owner decision | S | **Done** |
| Accent-colour contrast | Investigated: the real colours are fine (lowest is 6.19:1, well past 4.5). The *test* was checking a pairing that's never actually rendered (`--accent-fill` directly on `--bg`) | Owner asked to verify; turned out to be a test bug, not a colour bug | This session, owner decision | S | **Done** (test fixed, no colour changed) |
| Remove "Open calculators" button from the empty Notes screen | Redundant: Tools is one tap away on the tab bar already, and it duplicated the header's own "New list" action | Owner's explicit request, and it also serves "no two buttons doing the same thing" | This session, owner request | S | **Done** |
| Icon vertical alignment: Budget's chevron and delete icon mismatched on wrapped rows | The chevron centred on just the first line of text; the delete icon centred on the whole (often taller) row | Small but visible on nearly every Budget entry with a note or a card attached | This session, owner request | S | **Done** |
| This roadmap file itself | Consolidating 8 planning docs into one | Can't act on a plan scattered across 8 files | Owner request | M | **Done** |

---

## Phase 1 — Next build (decided, high value, no new research needed)

| Item | What it is | Why it matters for Calc specifically | Source | Effort | Status |
|---|---|---|---|---|---|
| Reminder time picker + "Send a test reminder" | Settings: a time (today fixed at 9am), and a button that fires a notification 1 minute out | **The single highest-value item in every source.** Every other reminder feature (bills, tax dates, card bills) stands on an unproven foundation until this proves delivery survives a locked, backgrounded phone | BACKLOG #6/#35, REVIEW-NEW-FEATURES C1 | S | Planned |
| Advance-tax reminder pack | Due: "Add a pack" creates the 4 advance-tax dates (15 Jun/Sep/Dec/Mar), editable, sourced from 5 agreeing sources | Freelancers/investors miss these and pay 234B/234C interest — the calculator for the penalty already exists, the reminder doesn't | REVIEW-NEW-FEATURES C2 | S | Planned. **ITR dates excluded** — sources disagree (31 Jul vs 31 Aug vs extensions); wait for the IT Department's own calendar |
| CSV export of expenses | Settings > Data: date range, via the share sheet, with a BOM for Excel | "Get my data out for a CA or ITR" is a trust feature with zero new permissions | REVIEW-NEW-FEATURES C4 | S | Planned |
| "Add expense" from a calculator result | A 4th action next to To list / Remind me — only when the result is money | Mirrors a pattern that already exists twice (To list, Remind me); closes the Due↔Budget gap named as the single biggest gap in REVIEW-NEW-FEATURES | REVIEW-NEW-FEATURES C5 | S | Planned. **Only if it fits the fixed-height action row at 360px** — check on the phone before shipping |
| Backup nudge once there's real data | A one-time prompt after N entries exist, suggesting a backup | Already in two separate backlogs; cheap, prevents real data loss | BACKLOG #18, REVIEW-NEW-FEATURES #21 | S | Planned |
| "Checked against X" label on a result | Visible marker: "recomputed only" vs "checked against [source]" | The trust feature the whole caveats plan is about — currently only in a doc, never on screen | BACKLOG #4 | S | Planned |
| Credit utilisation per card | `Owed ÷ creditLimit` — Budget already stores the credit limit and never uses it | The cheapest win found in the competitive research: one subtraction over data already collected | COMPETITIVE-RESEARCH §2 | S | Planned |
| "What this card has cost you" (fees + interest per year) | Budget already stores the annual fee; sum it against the year's entries | Same shape as utilisation — stored data, never surfaced | COMPETITIVE-RESEARCH §2 | S | Planned |
| Exact split allocation (largest-remainder method) | A ₹100 bill split 3 ways must total ₹100.00, not ₹99.99 | A real correctness bug waiting to happen the day tip-split or bill-split ships for real money | COMPETITIVE-RESEARCH §2 (Financial Advisor CALC-RULE-004) | S | Planned — apply to the existing tip-split tool now, and to any future split feature |
| "Every rule of thumb shows its condition" | A design rule, not a feature: any 3:1 benchmark, "under 12 months is healthy," etc. states the assumption and what changes it | Several tools already show bare rules of thumb (CAC payback, Rule of 40) with no caveat attached | COMPETITIVE-RESEARCH §2 (Retirement Plan) | S | Planned |
| Rewrite 4 stale e2e tests | notes-todo N29/39/40/41 reference the Tools home screen's OLD flat list, which this session's own "Browse by what you need" change replaced | They fail every run for a reason that has nothing to do with the app — pure noise until fixed | This session's test plan | S | Planned |
| Fix the budget.test.mjs CG/PM timeout cluster (15 cases) | Manually reproduced the underlying action and it worked; the *test* chains too many steps without enough settle time | Same as above — noise that hides real signal | TEST-PLAN-REMAINING §3 | M | Planned |

---

## Phase 2 — Soon (Release 1 / Release 2 candidates — real value, needs a short build)

| Item | What it is | Why it matters for Calc | Source | Effort | Status |
|---|---|---|---|---|---|
| Recurring bills & subscriptions | A repeat field on Add expense; a "Bills" view totalling monthly → yearly cost | Highest-value item (5/5) across both competitor-sweep docs; a ₹199/mo subscription hiding as ₹2,388/yr is a real, common surprise | REVIEW-NEW-FEATURES M1, Financial Advisor FEAT-EXP | M | Planned. **One record owns both the Due reminder and the Budget expense** — two sources of truth was the critic's objection |
| Card statement-month view + bill reminder | Switch a card's Spend Summary between calendar month and its real statement cycle; a due-date reminder | Statement day/due day are already stored and unused for this | REVIEW-NEW-FEATURES C7 | M | Planned. **Posting date, not transaction date, decides the cycle** — a caveat the competitive research adds that the original plan missed |
| Unequal split + who-owes-whom (calculator only) | Percent/shares/exact split, simplified settle-up, "save my share" to Budget | Asked for twice in the backlog (#20); the equal-only tip split is a known gap | BACKLOG #20, REVIEW-NEW-FEATURES T8 | M | Planned. **No groups, no running ledger** — a one-person offline app can't keep a shared ledger current, so don't promise it |
| Search expenses by text | Trivial filter over local data, already exists in Spending summary's structured filters | Anyone with 6+ months of entries needs text search, not just category filters | REVIEW-NEW-FEATURES A7/M14 | S | Planned |
| "Use this result in another tool" | A result's "Use in…" opens a short tool list and fills a chosen field, user picks which field (no guessing) | Closes a real friction point — EMI result into a tax tool, discount result into a budget entry | BACKLOG #19, REVIEW-NEW-FEATURES C6 | S-M | Planned |
| **Emergency fund calculator (D16)** | Monthly essential expenses, target months, liquid savings → target amount, shortfall/surplus, months covered | **Corrected in this pass: the base calculator does not exist at all** — `FEATURES.md` lists it "Planned," not built. Previously this file only listed the situational enhancement below, which wrongly implied the calculator itself already shipped | PRD D16, FEATURES.md Phase 4 | S | Planned |
| Emergency-fund months by situation (3/6/12/18–24), once D16 exists | Not one fixed number — a small table keyed to employment situation | A freelancer silently shown "3 months" (one fixed default) is the wrong answer for them | COMPETITIVE-RESEARCH §2 (Retirement Plan) | S | Planned, depends on D16 above |
| **Runway calculator (C12)** | Net payout, liquid savings, monthly living cost, optional new income → months the money lasts (rounded down + remaining days), monthly burn, which loan to part-pay from a payout | A genuinely separate calculator from EMI/prepayment — "how long until I run out of money," not "what's my EMI." Named in the original spec, never flagged missing by any later audit | PRD C12, FEATURES.md Phase 3 | M | Planned |
| **Multi-loan portfolio: avalanche vs snowball (C13)** | 2+ loans → total EMI, total interest remaining, debt-free date, payoff order under both strategies with the interest difference for a given extra payment | Real value for anyone with more than one loan running at once (common: home + car, or home + personal) | PRD C13, FEATURES.md Phase 3 | M | Planned |
| **Debt-to-income calculator (D15)** | Monthly gross income, monthly EMIs/obligations → DTI%, with the band thresholds shown and editable | A standard lending-health check Calc doesn't have at all today | PRD D15, FEATURES.md Phase 4 | S | Planned |
| **Savings rate calculator (D17)** | Monthly income and spend (or savings) → savings rate %, annualised amount | Plain arithmetic, no external data — the kind of thing that's cheap precisely because it's missing, not because it's hard | PRD D17, FEATURES.md Phase 4 | S | Planned |
| **Scenario compare (F2)** | 2–3 saved cards of the same calculator type, side by side with deltas highlighted | Named in both the original PRD and the backlog (#24); lets "should I prepay or invest the surplus" actually be answered by comparing two saved runs instead of re-typing | PRD F2, BACKLOG #24 | M | Planned |
| **Smart suggestion chip (G7)** | A single dismissible chip offering the obvious next step right after a calculation — "Remind me every month on the 5th" after an EMI, "Add all four quarterly due dates" after advance tax | This is a named, specific piece of the app's own stated differentiator (`MEMORY-LAYER.md` calls it "the magic moment"), not a generic nice-to-have — no other source mentioned it, so it was missed in the first pass entirely | MEMORY-LAYER.md §4.5 | M | Planned |
| World time: convert a chosen time, not just "now" | Today it only shows the current time in each city; there's no way to ask "if it's 3pm in Mumbai, what time is it in New York" | A real, named functional gap, not just the cosmetic "make it look like a clock" item already in Phase 3 | TOOLS-UX-REVIEW.md item 3 | M | Planned, needs a `time`-kind field added to the form system |
| One "loan term" field (replace the years/months switch) | A single field that accepts "18 months" or "20 years" directly | The switch is tucked under "More options" on long forms today, which the owner's own usability review called a trap | BACKLOG #15, TOOLS-UX-REVIEW.md item 5 | S | Planned |
| Cross-check the weakest high-stakes formulas against an official calculator | Prepayment, balance transfer, card EMI, FD, EPF, 87A relief, capital gains, advance tax — re-verify each against a bank/official tool, not just a second internal recomputation | This is verification work, not a feature, but it's exactly the class of risk CLAUDE.md is most worried about: "a confidently wrong tax figure is not recoverable" | BACKLOG #7, IMPROVEMENT-PLAN #10 | M | Planned |
| Two inflation rates (general vs medical) | D11 currently blends them into one number | Medical inflation is well-known to run higher than general CPI in India; blending them understates a real retirement-planning error | COMPETITIVE-RESEARCH §2 | S | Planned |
| Separate return rate for saving vs withdrawing years | SWP currently takes one rate for both phases | One source calls using a single rate across both phases "one of the most common errors" in retirement math | COMPETITIVE-RESEARCH §2 | S | Planned |
| India small-savings pack (SSY, NSC, VPF, SCSS) | Same shape as the existing PPF calculator | The only genuine tool gap found against ET Money/ClearTax's catalogues | COMPETITIVE-RESEARCH §2 | M | Planned, **gated on 4 more quarterly rates** (same mechanism `DATA-FRESHNESS.md` already has for PPF) |
| Refunds as negative entries | Allowed by the data model already; today's validation blocks amount ≤ 0 | A named, already-specced use case (MEMORY-LAYER 4.6b) with no code yet | REVIEW-NEW-FEATURES M16, BUDGET-PLAN open question 2 | S | Planned |
| Trip or event label with its own total | A subcategory used as a trip label, e.g. "Goa trip · ₹18,400 across 9 entries" | Could reuse subcategories rather than a new system | REVIEW-NEW-FEATURES M15 | M | Planned |
| Markup/margin calculator | A genuine everyday gap: Calc has 7 business-metrics tools, no markup | CalcKit's finance folder; a plain, common small-business calculation Calc is missing | COMPETITIVE-RESEARCH §2 | S | Planned |
| Phone-only verification: reminder fires, backup/restore round-trip, TalkBack | The three things only a real device (not a browser) can prove | HANDOFF.md already flags these as unproven since the UI revamp | TEST-PLAN-REMAINING §1 | — | **In progress** (session attempted; the reminder test needs a ~9-hour real-world wait since reminders are hardcoded to 9am, no finer time exists yet — see Phase 1's time-picker item) |
| 16-calculator invalid-field marking gap | Error text shows, but the box itself isn't marked invalid (no red outline / `aria-invalid`) | One shared component fix covers all 16 — a UI consistency gap, not a maths one | TEST-PLAN-REMAINING §2 | M | Planned |
| Backup/restore data bugs (SH-K16/19/26) | Settings-only restore doesn't apply the theme; "Replace" can re-show after replacing; a full round-trip crashed reading `history` from null | Data-integrity bugs in the one feature meant to prevent data loss | TEST-PLAN-REMAINING §2 | M | Planned |

---

## Phase 3 — Later (real but lower priority, or gated on something outside the app)

| Item | What it is | Why it matters, and the gate | Source | Effort |
|---|---|---|---|---|
| HRA exemption + rent receipt | Least-of-three HRA formula, printable receipt text | Formula is checked; the section number, metro list, and landlord-PAN threshold are **not** — gated on reading the actual Income-tax Rules text | BACKLOG #23, REVIEW-NEW-FEATURES T5 | M |
| FD ladder planner | Split a deposit across maturities, show the DICGC cover warning | Idea is sound; the ₹5 lakh cover limit needs a primary-source check (one source says it was under review) | REVIEW-NEW-FEATURES T7 | S-M |
| Gold jewellery bill (rate, making, wastage, GST) | A gold-buying calculator | Sources disagree on the GST split (3% flat vs 3%+5% making) — gated on a primary source | REVIEW-NEW-FEATURES T6 | S |
| LTCG harvesting (how much gain can be booked tax-free this year) | Plain arithmetic against the ₹1.25L equity LTCG exemption | Needs the exemption limit pulled from a primary source, same discipline as every tax tool here | COMPETITIVE-RESEARCH §2 | S |
| Direct vs regular mutual-fund plan cost drag | One multiplication over user-typed expense ratios | Cheap, but low urgency — no evidence of demand | COMPETITIVE-RESEARCH §2 | S |
| Multiple financial goals with priority + what each costs retirement | Planned D4 currently assumes one goal | This is *planning*, not calculating — a materially bigger step than it looks | COMPETITIVE-RESEARCH §2 | L |
| Sequence-of-returns stress test | A crash in year 1 vs year 10 of retirement | Needs a chart to be readable at all, and no chart library is wired in yet | COMPETITIVE-RESEARCH §2 | M (blocked on chart library) |
| "Money check-up" readiness gates (emergency fund, term cover, health cover, savings rate) | A single pass/fail dashboard view | Real risk: this edges from "calculate" into "advise" — only safe if every gate shows its condition in words | COMPETITIVE-RESEARCH §2 | M |
| Bulk recategorise expenses | Select several entries, change category once | After a month of entries, re-tagging a habit one row at a time is what stops people tidying their data | COMPETITIVE-RESEARCH §2 (Financial Advisor) | S |
| Suggest an entry looks recurring (from repeats in your own data) | A nudge, not an automation — "this looks like it repeats, add a reminder?" | Cheaper than typing a recurring bill by hand, but unproven and can guess wrong | COMPETITIVE-RESEARCH §2 | M |
| Edit history on an expense ("changed 2 Nov, was ₹900") | An audit trail; Undo exists, a trail doesn't | Only useful once entries are weeks old — low urgency now | COMPETITIVE-RESEARCH §2 | M |
| CSV **import** of expenses | Preview-and-confirm with duplicate detection | Parsing someone else's file is a real correctness risk; only ship with the preview step | COMPETITIVE-RESEARCH §2 | M |
| Reconcile a month against the bank statement | A "this matches" tick per entry | Honest and useful, but only for someone who opens a statement monthly — narrow audience | COMPETITIVE-RESEARCH §2 | M |
| One monthly-income field | Makes "savings rate" a real number instead of typed twice | Useful, but a screen the owner never asked for — don't build ahead of a request | COMPETITIVE-RESEARCH §2 | S |
| Multi-currency per entry | A dated exchange rate on an expense | Blocked on the live-rate fetch, which exists for the currency *converter* but isn't wired into Budget yet | COMPETITIVE-RESEARCH §2 (PRD H4) | M |
| Repeat-by-completion-date ("30 days after I tick it") | For tasks like "service the car every 6 months" | Calc's repeats are all fixed-calendar today; this is the right answer for a different, real class of task | COMPETITIVE-RESEARCH §2 (TickTick) | S |
| Several reminder lead times on one item | e.g. "7 days before AND on the day" | `Reminder.leadDays` is a single number today; making it a short list is a small, contained change | COMPETITIVE-RESEARCH §2 | S |
| Photo on a note (a receipt or bill) | PRD G3 already specs this; nothing built | Needs a camera/photo permission, which is in direct tension with "almost no permissions" | COMPETITIVE-RESEARCH §2 (PRD G3) | M |
| Card cost pack (minimum-due trap, "is the annual fee worth it") | Plain arithmetic, user types the rates | Real, but lower value than the items already ahead of it | REVIEW-NEW-FEATURES T9 | S |
| Net-worth snapshot | A one-off number, not a tracker | Needs the owner to keep updating it by hand or it goes stale fast — likely abandoned | REVIEW-NEW-FEATURES T10 | S |
| App lock (fingerprint/PIN) | One small new permission | Only matters if the phone is shared — unknown whether it is | REVIEW-NEW-FEATURES #23 | M |
| Home-screen widget / quick-add tile | Native Kotlin, no new permission | Real value (4/5) but L effort and native code — a bigger investment than anything else on this list | BACKLOG #27, REVIEW-NEW-FEATURES #24 | L |
| Share-in: receive a shared payment text into "Add expense" | A share target, no permission needed | Needs native code and text parsing; reliability is unproven | REVIEW-NEW-FEATURES #25 | L |
| Exact alarms (not just "while idle") | `USE_EXACT_ALARM` on Android | Restricted by Play Store policy to alarm/clock/calendar apps — needs that classification proven first, or stays inexact-but-allow-idle as now | BACKLOG item under "platform" | — |
| World time as a real ticking clock + globe | Currently a frozen table of 20+ cities | A named, specific complaint from the owner, not yet addressed | ROADMAP §3 | M |
| Split bar / line chart for proportions and trends over time | Interest-vs-principal, tax-vs-income, SIP growth — all currently tables | "A picture replaces a number only when it shows something the number can't" — the design rule already written for this | ROADMAP §3 | M, needs a chart library decided first |
| Date-range span visual | A date-difference result shown as start→end with the count between, not just a bare number | Same family as the clock/bar items above | ROADMAP §3 | S |
| History row menu (Copy · Share · Edit · Lock · Delete) | 5 actions on one 360px row | Needs a layout redesign before it fits — not a quick add | ROADMAP #40 (A16) | M |
| Share one history row as text | Small, wanted, just not reached yet | — | ROADMAP (A20) | S |
| iOS build | Needs a Mac + signing, both unavailable today | Android-first was always the stated plan | BACKLOG #28 | L, blocked |
| Rewards helper ("best card for this category") | User-typed rates and caps only, no built-in database | Reward terms changed April 2026 and sources disagree — a wrong answer here is worse than no answer | BUDGET-PLAN P6, REVIEW-NEW-FEATURES A5 | L, **start only after the owner has typed rates for two cards by hand** |
| **Exit settlement / full-and-final (E8)** | Basic+DA+retaining allowance, dates, leave balance, notice shortfall → gratuity, leave encashment, notice recovery, gross/net settlement, estimated TDS, every figure with its formula shown | The last unbuilt income-tax calculator in the original spec. **Explicitly gated**: rests on Labour Codes still being notified when the spec was written; the project's own rule is this does not ship until the wage-base, gratuity, and exemption rules are checked against the Ministry of Labour and the Income Tax Act directly | PRD E8, FEATURES.md Phase 5 | L, **Gated on primary-source labour-law text, not a researcher's claim** |
| Remote rules packs (H1) | A small signed JSON file fetched from a CDN (weekly), carrying tax slabs, GST rates, small-savings rates, CII — so a Budget change or a quarterly rate reset is a data update, not an app release | Rates currently live in bundled JSON only; every rate change needs a rebuild and reinstall. This is the mechanism the whole "keep fresh" discipline (`DATA-FRESHNESS.md`) assumes exists, and it doesn't yet | PRD H1 | L |
| Per-result freshness label ("Rates as of Oct 2026") | A visible date stamp on every result that depends on a rate, escalating to a banner past a Budget or quarter boundary | Related to the already-planned "checked against X" label (Phase 1) but specifically about *when* a rate was last current, not just *whether* it was checked at all | PRD H2 | S |
| Delivery verification for reminders | Keep a fire-log per scheduled reminder; detect one that was silently dropped and surface a fix | Reminders are the app's stated differentiator and the single most-flagged "unproven" item across every source — this is how you'd actually find out they're failing instead of just hoping | PRD H6 | M |
| Guided OEM battery-setting deep link | Detect the phone's manufacturer, deep-link straight to that brand's autostart/battery page with specific instructions | **Flagged "Critical" risk in the PRD itself**: Xiaomi/Vivo/Oppo/Realme are named as dominant-in-India OEMs that aggressively kill backgrounded apps, which is exactly what would silently break reminders | PRD H7 | M |
| Boot & timezone reminder rescheduling | Reschedule every pending reminder when the phone reboots or its timezone changes | Without this, a single reboot silently cancels every reminder with no visible sign anything is wrong | PRD H10 | S |
| Quick Settings tile | One-tap calculator launch from the notification shade | Native Android work; a fallback channel when notification permission is denied | PRD H11 | L, native |
| Share-as-image (F4) | A result screen exported as a PNG to the clipboard or share sheet | Named in the original spec; distinct from the already-planned CSV export (that's data, this is a visual) | PRD F4, BACKLOG #25 | M |
| PDF export (F5) | Amortisation schedule, tax comparison, or SIP table exported as a formatted PDF | Same family as share-as-image; useful specifically for the longer tabular results a screenshot doesn't do justice to | PRD F5, BACKLOG #25 | M |
| Labelled expressions in history ("rent 25000 + emi 48000") | Inline labels inside a typed expression, shown back in History as readable text instead of a bare sum | Smaller and more contained than full natural-language input (already planned, Phase 1/2); this is just "let a history row carry words," not "parse free text into a calculator" | PRD F6 | M |
| Inline rename of a list line | Rename a tape line in place, not through the bottom input bar | The current path works but is indirect — renaming in place is what a person expects the first time they try it | IMPROVEMENT-PLAN #9 | S |
| Badge on hidden example values (NPS annuity, EPF ceiling, FD slab) | A small "using example values" marker on the advanced-fields line | The hint text already says so in words, but a visible badge is safer against someone missing the hint and trusting the example rate | BACKLOG #16, TOOLS-UX-REVIEW.md item 6 | S |
| Unify tax terminology (80C vs "section 123") | Pick one naming style for the same real-world deduction across income-tax and home-loan-tax | Both names are individually correct (old vs 2025 Act numbering), but using both in one app reads as an inconsistency, not a choice | BACKLOG #17, TOOLS-UX-REVIEW.md item 8 | S |
| Dynamic field labels per mode | "Number X / Y" becomes the real label for that mode ("MRP" / "Final price," etc.) instead of a generic placeholder plus an explanatory sentence | A small form-system change (a label that can be a function of the current values) that would clean up percentage and date-calculator specifically | TOOLS-UX-REVIEW.md item 2 | S, needs a form-system change |
| Advance-tax field layout (rows for the 4 quarterly payments) | The 4 quarter-payment fields become one compact "rows" layout instead of 4 separate top-level fields | None of advance tax's 6 top fields are really optional in practice; a rows layout would fit the form in about 5 | TOOLS-UX-REVIEW.md item 1 | S |
| Amount quick-chips (+1K, +10K, +1L) and sliders for rate/tenure | Tap-to-add chips and a slider alternative to typing | A faster-entry affordance named in the UX guidelines, not yet built anywhere | BACKLOG #31 | M |
| Share and Reset actions directly on a result | Two more actions alongside Copy/To-list/Remind-me | Named in the UX guidelines as a planned addition to the result row | BACKLOG #32 | S |
| Three-state checklist lines (paid / pending / skip) | A tape line's checkbox becomes a 3-way state instead of just ticked/unticked | The owner specifically raised radio buttons for this; checkboxes can't represent "skipped," only "done or not" | BACKLOG #22 | S |
| Turn a pasted multi-line list into a checklist | Paste text with several lines and have it become tappable checklist items, not just a sum | A named owner idea, distinct from the sum-a-pasted-list behaviour that already exists | BACKLOG #21 | S |
| Release keystore + signed APK | A proper signing key, separate from the debug build currently sideloaded | Needed before any Play Store listing is possible at all; today there's no path to one | BACKLOG #29 | S |
| `@capacitor/cli` → devDependencies | A one-line `package.json` move | Clears 4 `npm audit` warnings; it's a build tool, not a runtime dependency | BACKLOG #34 | S |
| Expose the calculator engine as an AI-assistant tool (MCP) | The pure-TypeScript engine (`src/engine/`) has zero UI coupling already — wrapping it as an MCP tool server is mostly packaging | Named independently in both `HANDOFF.md`'s cloud-session notes and `FEATURES.md`'s "Later" phase as cheap and interesting, though neither claims anyone asked for it | HANDOFF.md, FEATURES.md Phase 9 | S-M, **no evidence of demand — build only if genuinely wanted, not just because it's cheap** |
| To-do: priority, steps/subtasks, links, a quick-add parser, merging into Due, clearer notification wording | A cluster of To-do refinements from the original Notes/To-do plan's later phases | Several of these (quick-add parsing specifically) are already captured individually elsewhere; this row exists so the *cluster* as `NOTES-TODO-PLAN.md` actually specced it isn't lost by only capturing one piece of it | FEATURES.md Phase 6, NOTES-TODO-PLAN.md phases 2-4 | M |
| Favourites that self-promote (usage-ordered, not manual) | The favourites/pinned list quietly reorders itself by actual use instead of staying in the order you set it | Low-effort retention idea from the GTM doc; the app's monetisation strategy around it is explicitly out of scope for a personal app (see Ruled-out), but this one mechanic needs no monetisation at all | GTM-STRATEGY.md §4 | S |
| **Needs a check, not a build:** does a calculator's draft survive a reload? | `PRD.md`/`FEATURES.md` list "resume per calculator" (A23) as shipped; this session's own tools1 e2e testing explicitly found a draft is lost on reload, noted there as "documented as intended, but worth confirming" | A direct contradiction between what the spec claims and what the owner's own test suite observed — resolve by checking the code, not by trusting either source blindly | PRD A23 vs TEST-REPORT-tools1.md §5 | — | **Unresolved discrepancy** |

---

## Phase 4 — This session's open UI/UX requests (in progress alongside this roadmap)

| Item | Status |
|---|---|
| Links opposite the header, icon or text, wherever suitable | In progress |
| Icon vertical alignment consistency app-wide | Budget's entry rows fixed (Phase 0); broader sweep in progress |
| Charts wherever required | Auditing which screens would benefit; see Phase 3's chart items above — blocked on the same chart-library decision |
| No two buttons doing the same thing on one page/sheet | Notes empty-state fixed (Phase 0); broader audit in progress |
| Optimise space usage on the Tools page | In progress |
| Improve user flow, UI and UX on Budget and Due | In progress |

---

## Ruled out — do not re-suggest these

| Idea | Why ruled out | Source |
|---|---|---|
| Read SMS, email, or bank statements to auto-log spending | Breaks "almost no permissions"; bank SMS formats change and silently corrupt a parsed total | REVIEW-NEW-FEATURES D, COMPETITIVE-RESEARCH §3b |
| Bank linking / Account Aggregator | Needs a licensed partner and a server; both sibling repos independently concluded this is blocked | BUDGET-PLAN I, COMPETITIVE-RESEARCH |
| Accounts, cloud sync, shared household budgets | Breaks "no account, nothing leaves the phone" | PRD, owner promise |
| YNAB-style "give every rupee a job," rollover, age of money | A behaviour-change product, known to be abandoned in week two by the owner's own prior research; Budget is already unproven without adding this risk | ROADMAP §4, REVIEW-NEW-FEATURES D |
| "Best card for this spend" with a built-in rate database | Reward terms changed April 2026 and sources disagree on current values; a wrong answer is worse than none | REVIEW-NEW-FEATURES A5/D |
| Brokerage, margin, TDS calculators | Charges vary by broker and change by circular; no evidence the owner trades | REVIEW-NEW-FEATURES A9/D |
| GST invoice maker | A different product entirely (numbering, GSTIN, legal format) — the GST *calculator* already covers the sum | PRD non-goals, REVIEW-NEW-FEATURES D |
| Plot a function (Desmos-style) | No evidence of need, and Desmos already does this better and free | REVIEW-NEW-FEATURES A15/D |
| Net-worth *tracker* (ongoing, not a one-off) | Needs constant manual updating or it goes stale and gets abandoned | ROADMAP §4, REVIEW-NEW-FEATURES D |
| Auto-fetching live gold or FD rates | Adds network dependency and an ongoing freshness duty; user-typed is the deliberate design | DATA-FRESHNESS.md, REVIEW-NEW-FEATURES D |
| Ads, analytics, or crash-reporting SDKs | Breaks the privacy promise outright | Owner promise, PRD |
| Any paywall, subscription, or "Pro unlock" tier | This is a personal app, not a product being launched; the GTM doc that raises monetisation says explicitly to stop here for personal use. Every calculator, history, notes, reminders and widgets stay free by design regardless | GTM-STRATEGY.md §5, owner's stated use ("personal, no ads") |
| Cloud backup | Breaks "no account" — the local Calc-folder backup already covers this | FEATURES.md, REVIEW-NEW-FEATURES D |
| Pie charts, treemaps, Sankey diagrams | No chart library exists; pies specifically hide small slices, which matters for budget categories | BUDGET-PLAN I |
| Custom, user-written calculators (CalcKit-style) | Collides with the hard rule "tool ids and field ids never change" — a saved card stores inputs by field id, so a user-editable form would break old saves | COMPETITIVE-RESEARCH §1/§3b |
| Algebra/geometry/electronics calculator packs (150+ tools) | Explicit PRD non-goal: "breadth-for-breadth's-sake" | PRD non-goals |
| Portfolio X-ray (fund overlap analysis) | Needs uploaded AMC disclosure files — well outside the offline, no-account promise | COMPETITIVE-RESEARCH §1 |
| TDS calculator, GST late-fee/interest, HSN lookup | Rates and penalty rules change by circular with no stable primary source; no evidence of need | COMPETITIVE-RESEARCH §1 |
| A "lock a history row" control separate from naming it | Naming already means "keep this" — a second control for the same intent is redundant | ROADMAP (A17), **deliberately dropped** |
| Editing the *date* of a past calculation | Makes the historical record falsifiable; only the name stays editable | ROADMAP (A19) |
| A full from-scratch visual redesign | Would discard a working, tested design system; the real complaints are addressed by targeted fixes, not a rebuild | ROADMAP §1 |
| ESOP/RSU tax calculator | A separate, genuinely complex tax domain (vesting schedules, perquisite valuation, multiple exercise events); no evidence it's needed for one person's own finances | HANDOFF.md cloud-session notes, "not adopted" |
| A double-entry ledger | A fundamentally different data model from "tag your spending"; the category/payment-mode system already does what a personal budget needs without becoming accounting software | HANDOFF.md cloud-session notes, "not adopted" |

---

## Cross-reference: where each old file's content now lives

| Old file | What it had | Where it is now |
|---|---|---|
| `ROADMAP.md` | Request register, build-order stages A–F, the "results should look like what they are" chart proposal, the Budget risk/gate reasoning | Phases 0–3 above; the chart proposals are in Phase 3; the Budget gate reasoning is folded into Phase 2/3's Budget items. **Kept in full for its reasoning and the owner's original complaints verbatim.** |
| `BACKLOG.md` | Numbered P0/P1/P2 items, the 2026-11-02 audit items, Budget tracker status | Mapped item-by-item into Phases 0–3; numbers are referenced in the "Source" column so you can trace back |
| `IMPROVEMENT-PLAN.md` | The seven-role audit's Now/Next/Later | Superseded by this file's phasing for anything still open; **kept for the seven-role findings themselves**, which aren't repeated here |
| `REVIEW-NEW-FEATURES.md` | The first competitor sweep: gap table, 25 candidates, 3 releases | Candidates are folded into Phases 1–3 by their release; **kept in full** — this file doesn't repeat the gap-table evidence or the sources list |
| `COMPETITIVE-RESEARCH-AND-PLAN.md` | The delta sweep: sibling repos + 4 catalogues, what's void | Folded into Phases 1–3 and the Ruled-out table; **kept in full** for the detailed fit/new-ness table and the 12 void-feature design-rule citations |
| `TEST-PLAN-REMAINING.md` | Confirmed bugs not yet fixed, phone-only tests, unconfirmed findings | Folded into Phase 0 (done) and Phase 2 (planned); **kept in full** as the live test-tracking document, since new test rounds will keep adding to it |
| `BUDGET-PLAN.md` §H | Budget's own P0–P6 build phases | P0–P3 are built (confirmed this session via e2e testing); P4–P5 appear built; **P6 (rewards) is the only open item**, carried into Phase 3 here |
| `NOTES-TODO-PLAN.md` §H | Notes/To-do's own phases | Largely built; nothing outstanding was found that isn't already covered by Phase 1's repeat-lead-time and completion-date items |
| `HANDOFF.md` | "What is NOT done" status list, plus a merged cloud-session plan with its own "not adopted" and "later" lists | Superseded by `TEST-PLAN-REMAINING.md` and this file for status; the MCP-tool idea and the ESOP/ledger "not adopted" items are now in Phase 3 and the Ruled-out table. **Kept** as the per-session handoff snapshot, which is its actual purpose |
| `PRD.md` | The original 111-feature spec, sections A–H, letter-coded (A1, C12, D16, E8, G7, H1...) | This is the authoritative source for anything coded A–H in this file's "Source" column. **Read in full on the second pass** — the first pass had only skimmed it via other docs that quoted pieces of it, which is exactly how C12, C13, D15–D17, E8, G7 and the H-section platform items got missed the first time |
| `FEATURES.md` | A phase-by-phase status table (Phone / Code / Running / Planned / Gated), dated 2026-11-02 | Confirmed, independently of `PRD.md`, exactly which A–H items are still "Planned" rather than built; used as the second check on every PRD item added in this pass |
| `MEMORY-LAYER.md` | The full spec behind the memory-layer differentiator, including the "smart suggestions" chip (§4.5) | The smart-suggestion chip (G7) is now in Phase 2; everything else in this doc (categories, payment modes, settlement lines) was already built and confirmed via this session's own e2e testing |
| `TOOLS-UX-REVIEW.md` | A per-calculator UX review with an 8-item "needs an engine or ToolScreen change" list | Items 1, 2, 3, 5, 6, 8 are now in Phase 2/3; items 4 and 7 were judged too minor to carry forward (a missing unit label, a preset-name wording choice) |
| `UI-UX-PLAN.md` | A status check-in on two early owner requests, mostly confirming earlier work as "Done" | Nothing new found beyond what `BACKLOG.md` and `IMPROVEMENT-PLAN.md` already carried; cross-checked and nothing was missing from this one specifically |

**Conflicts found between sources:** `BUDGET-PLAN.md` planned Budget as a gated, step-1-then-step-2
feature; `ROADMAP.md` records that the owner overrode that gate on 2026-11-02 and asked for the
full Budget tab directly. Both are correct for their moment — `ROADMAP.md`'s override is the one
that actually happened, which is why Budget appears in Phase 0/2 here as mostly built rather than
gated.
