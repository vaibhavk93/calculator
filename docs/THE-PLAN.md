# Calc — the one plan

**This file replaces every other "what to build next" list.** Written 2026-11-04 after the owner asked why
plans were scattered across many files.

It answers four questions, in order: **what exists**, **what is broken**, **what we do next**, **what we
have decided not to do**. Status words: **Done** · **Next** · **Later** · **Blocked** (on what) · **Ruled out**.

---

## 1. Which files this replaces, and which stay

| Merged into this file (stop editing them) | Still the source of truth (keep) |
|---|---|
| `MASTER-ROADMAP.md`, `ROADMAP.md`, `BACKLOG.md`, `IMPROVEMENT-PLAN.md` | `PRD.md` — what each calculator does |
| `UI-UX-PLAN.md`, `UX-AUDIT.md`, `TOOLS-UX-REVIEW.md`, `TAP-AUDIT.md` | `DESIGN-SYSTEM.md`, `UX-GUIDELINES.md`, `FORMS-AND-SHEETS.md` |
| `UX-IMPROVEMENT-PLAN-2026-11-04.md` | `ARCHITECTURE.md`, `TECH-DECISIONS.md` |
| `CAPABILITY-GAPS-2026-11-03.md`, `TEST-PLAN-REMAINING.md` | `DATA-FRESHNESS.md` — rates and their sources |
| `REVIEW-*.md` (6 files), `AUDIT-2026-11-02-FOLLOWUP.md` | `VERIFICATION.md` — how each formula was checked |
| `COMPETITIVE-RESEARCH-AND-PLAN.md`, `GTM-STRATEGY.md` | `BUILD-ANDROID.md`, `TESTING.md`, `SMS-CAPTURE.md` |
| the "what's left" halves of `BUDGET-PLAN.md`, `NOTES-TODO-PLAN.md`, `PORTFOLIO-PLAN.md`, `FEATURES.md` | the "how it works" halves of those same three plans |
| `TEST-REPORT-*.md` (6 files) — findings pulled into §3 | `SESSION-STATE.md` — where the current session stopped |

The merged files are **not deleted**: they hold the reasoning and the rejected alternatives. They are now
history, not plans.

---

## 2. What exists today

| | |
|---|---|
| **Calculators** | **68** (counted 2026-11-11 from `ALL_TOOLS` in `src/features/tools/registry.ts` at commit f4182bf; docs elsewhere still say 51/55/57/60/61 — those are stale) |
| **Tabs** | Calculate · Tools · Notes (+To-do) · Due · Budget |
| **Budget** | expenses, categories + subcategories, cards/accounts, limits per month, bills & subscriptions, statement cycles, refunds, trips, heatmap, CSV export/import, bank-message scan |
| **Notes** | saved calculations, lists (label + amount), to-dos, **plain text notes** (Block C, 2026-11-05) |
| **Due** | reminders, lead times, repeats, advance-tax pack, battery-settings guide |
| **Platform** | offline, no account, no analytics. Android only. Local backup file |
| **Tests** | 3508 unit tests pass, 16 skipped (126 files, `npm run check`, commit f4182bf, 2026-11-11) + 26 browser (e2e) suites; what passes and fails today: `docs/E2E-STATUS-2026-11-11.md` |

**⚠ The old roadmap's status column was a whole session out of date.** Verified in code on 2026-11-04:
every Phase 1 item and nearly every Phase 2 item it marked "Planned" is actually built — reminder time
picker, advance-tax pack, backup nudge, CSV export, credit utilisation, card annual cost, exact split,
emergency fund, DTI, savings rate, markup, runway, avalanche/snowball, "use in another tool", unequal
split, smart suggestion chip, invalid-field marking, world-time convert. **Do not rebuild these.**

---

## 3. What is broken

### 3a. Confirmed, with evidence

| What | Where | Evidence |
|---|---|---|
| **`npm run check` can report success while failing** | — | A piped `npm run check \| tail` returns *tail's* exit code. A previous session reported green while typecheck was exiting 2. **Fixed**, but the habit is the real bug |
| **e2e tests cannot run in a default shell** | — | Default `node` here is 18; Playwright needs 20+. Node 22 is installed but not selected. **This is the single biggest reason runtime and scroll bugs are not being caught** |
| `ink-3` hint text fails contrast on all 8 dark tints | `theme.ts` | Measured 3.60–4.32 against the design system's own 4.5 target. Real text: `.field-hint`, `.field-words` inside tinted input cards. **Decision needed, see §5** |
| SMS scan window is "now − N×24h", not calendar days | `SmsInboxPlugin.java:73` | "Last 7 days" covers a different span depending on the hour you tap it |
| A scan silently hides messages you already reviewed | `app.ts:779 markSmsSeen` | No "N already reviewed" line, so a scan returning nothing from today looks broken |
| Dates follow the device locale | 10 call sites | An India-first app shows "Nov 2" on a US-locale phone. Defensible, but undecided |

### 3b. Fixed on 2026-11-04 (the floating answer bar)

Four real defects on every calculator with a headline answer, all found by **measuring the live page**:
it strobed on a 3px scroll, its arrow pointed the wrong way, it completely covered the Copy/Share row,
and its destination row had no emphasis. Guarded now by `e2e/answerbar.test.mjs`.

**⚠ The lesson that matters more than the fix:** a manual browser check at 375×812 said the overlap was
fixed. The automated test at 360×790 proved it was not. **Checking one size by hand produces false
passes.** See §6.

### 3c. Known, not yet investigated

- Budget `CG/PM` picker timeout cluster in `budget.test.mjs` — still only "probably a stale selector".
- The real Budget entry that changed from Spending to "Transfer between own accounts" on 2 Nov 2026,
  between 21:08 and 21:45. **Never confirmed with the owner.**
- Reminders actually firing, backup/restore round-trip, TalkBack, rotation — browser-tested only, never
  proven on a phone.

---

## 4. What we do next, in order

### Block A — Make the audit trustworthy *(do this first; everything else is guesswork without it)* — **A1, A2 done 2026-11-04**

| # | Item | Size | Status |
|---|---|---|---|
| A1 | `.nvmrc` (pins 22) + `engines: {node: ">=20"}` in `package.json`, and `npm run e2e` / `npm run e2e:fast` running every `e2e/*.test.mjs` suite in one command (`e2e/run-all.mjs`). Checks the Node version itself first, with the fix in the error message, instead of a confusing Playwright crash | S | **Done** |
| A2 | **Layout contract suite** (`e2e/layout-contract.test.mjs`): every tab × 3 widths (320/360/412) × 2 font scales (100%/200%) × seeded long content (long names, 40 expenses, long notes, long tags). Asserts sideways overflow, control-on-control overlap, every control ≥44px **in one direction** (not both — matches `DESIGN-SYSTEM.md` section 9, not a stricter rule invented for the test), true text clipping (not a designed ellipsis or `sr-only`), and every button/link has a name. 144/144 passing | M | **Done** |
| A3 | Put `npm run check` + the layout suite in one command, and never report a result from a piped exit code | S | Not done — `npm run e2e` is separate from `check` on purpose (see note below) |

**Why `e2e` is not folded into `release`:** `tools1.test.mjs` alone takes 20+ minutes; the full suite is well over an hour. Gating every release on that is impractical. Run `npm run e2e:fast` (skips the 10 suites with hundreds of cases) for a quick pass, `npm run e2e` before anything that touches shared layout.

**Two false positives found and fixed *while building* A2** — worth keeping in mind for every future layout test:
1. `getBoundingClientRect()` ignores scroll clipping. A row scrolled below the fold inside an `overflow:auto` list still reports its full, unclipped position, which can coincidentally land on something real far away (a tab-bar label). Fixed by intersecting each control's rect against every scrolling/clipping ancestor's box before comparing — not a yes/no "is it visible" check, a real geometric clip, since a row can be half-clipped and the visible half still matters.
2. The 44px rule itself was mis-encoded as "both dimensions ≥44" when the project's own documented rule (`DESIGN-SYSTEM.md` section 9) is "at least 44px in **one** direction" — a wide chip or a tall narrow tab is fine. The stricter version flagged 8 controls that were working exactly as designed (the chip touch-area technique at `tools.css:696-712`, the Notes/To-do segmented tabs).

### Block B — The design reset *(see §7 for the thinking)* — **B1, B2 done 2026-11-04**

| # | Item | Size | Status |
|---|---|---|---|
| B1 | Write the **three-tier hierarchy rule** into `DESIGN-SYSTEM.md` ("Three tiers on a screen", after the Section-colour rules) and apply it to one screen as the reference | S | **Done** |
| B2 | Rebuild **Budget home** to that rule: the hero figure bare (no card), Needs attention + Recent as hairline `.group`/`.row` lists (no tint), and the four navigation links (Spending summary, Bills, Add from bank messages, Categories and cards) collapsed from four separate tinted cards into one `.navrow`/`tap-row` list under "More in Budget" — the exact pattern `ManageScreen.tsx` already used, reused rather than invented | M | **Done**, verified in browser + `npm run check` (2529 pass) + `layout-contract`/`answerbar`/`budget`/`qa-budget-new` e2e (zero regressions — confirmed by diffing the failure list against the pre-change commit, byte-identical except one test now passing, see below) |
| B3 | Demote the post-"=" actions (To list / Remind me / Add expense) from equal chips to a quiet icon row | S | **Done** — 3 icon buttons (`.result-actions__btn`), same visual language as a tool result's Copy/Share row |
| B4 | Replace tinted section cards with hairline groups on Notes, To-do | M | **Done** — Pinned/Lists/Calculations and Overdue/Today/Upcoming/No date/Done |
| B5 | Apply the B2 pattern to Due (Tools home not done — only Budget/Notes/Due had tinted-card navigation; Tools home's tiles are a group page, the case the rule explicitly keeps tinted) | M | **Done** — Overdue/This week/Later. Found and fixed one real pre-existing bug in passing: the "Add a pack: advance tax" panel could overflow past the viewport into the tab bar at 200% font; moved inside the scrollable list |

**One real pre-existing bug found and fixed in passing (B2's verification, not B2 itself):** `e2e/qa-budget-new.test.mjs`'s `toBills`/`toSummary` navigation helpers were pinned to `button.tap-row` — but Budget's empty state (zero expenses ever logged) renders the same navigation as `.link-btn`, not `.tap-row`. Any test that seeded an empty budget and then tried to reach Bills or Spending Summary timed out. Fixed by matching on accessible name (`getByRole`) instead of a CSS class, the same way `toManage` already did it correctly. This was failing identically before any of today's redesign work (verified with `git stash`) — not a regression, a pre-existing gap this session happened to touch. Fixed `toBills`'s case (B-206, now passing); `toSummary` from a **fully** empty budget still fails (B-401's second half) because the empty state has no "Spending summary" link at all — there is genuinely nowhere to send that click, which is a real product question (should an empty month still offer a — necessarily empty — Spending Summary?), not a selector bug. Left open, noted here rather than silently worked around.

### Block B continued — "very stupidly designed," re-raised 2026-11-04 after B1–B5 shipped

The owner used the rebuilt app (verified live on their phone, screenshots confirmed) and still called the UI
badly designed: wants intuitive design, proper flows, appropriate space usage, "not multiple pop ups," easy
to use. Asked to research established UI design approaches, evaluate, and apply the best fit — "feel free to
redesign the entire app if required." Before building anything, this file records **what was actually
checked**, not assumptions, because the honest answer turned out narrower than "rebuild everything" — a
critic (per the project's own rule on big suggestions) pushed back once and the finding below reflects that.

**Research done (web search, cited):**
- [We use too many damn modals](https://news.ycombinator.com/item?id=23645447) / [industry guidance](https://www.digia.tech/post/bottom-sheet-or-modal-mobile-interruption-pattern/): stacking more than one modal/sheet layer is "always bad design"; cap frequency, never nest.
- [Material Design 3 bottom sheets](https://m3.material.io/components/bottom-sheets/guidelines): a sheet complements the *main screen* it sits over — one sheet layer over one screen is the sanctioned shape, not sheet-over-sheet.
- [NN/g, reducing cognitive load in forms](https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/) and [progressive disclosure](https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/): reveal only what the current step needs.
- [Design system comparison](https://medium.com/design-bootcamp/understanding-and-comparing-design-systems-material-3-apple-ios-and-ibm-carbon-28c585f893ed): Material 3 is Android-native but built around dynamic colour and elevation this app's own rules explicitly ban (no shadows, no gradients); IBM Carbon targets enterprise dashboards and tables, the wrong device class entirely; Apple HIG is iOS-only, and this app is Android-first via Capacitor.
- [What's praised in fintech apps right now](https://genwealth.io/articles/ynab-vs-monarch-vs-copilot-i-tested-all-3-for-90-days-heres/): Copilot and Monarch are both called out specifically for "clean, no clutter" dashboards — the same direction Block B's three-tier rule already took.

**Verdict on adopting an external system: no.** None of the three major systems fit this app's own already-tested, already-shipped constraints (no shadow/elevation, Plex Mono numerals, hairline grouping) without discarding real working code. The fix is to **finish and harden the system this app already has**, not import a new one.

**Code audit, not guesses — every sheet/modal in the app checked for real stacking** (grep across all 20 files that render a `<Sheet`):

| Flow | What it actually does | Verdict |
|---|---|---|
| `ExpenseSheet` → category/card picker → "add a new card" | One sheet, internal view swap (`view.v: 'form' \| pick \| 'newInst'`) — never two sheets on screen | Correct, matches the rule |
| `SettingsScreen`, `ManageScreen`, `BillsScreen`, `ImportScreen` → their sheets | Each is a full-screen push (`.screen`) with at most **one** sheet on top | Correct — this is Material 3's own sanctioned "sheet over the main screen" shape |
| `HistorySheet` → `HistoryRowSheet` | **A sheet opening another sheet on top of itself** | **A real bug.** `docs/FORMS-AND-SHEETS.md` (section 4, picker sheet anatomy) already says *"From inside a sheet: do not stack. Swap the sheet's content for the list... Stacked sheets confuse Back and X"* — this is a confirmed violation of a rule already written, not a missing rule |

**So "multiple pop ups" is real but narrow: one confirmed violation, not a pervasive pattern.** `Sheet.tsx`'s own code comment ("Several sheets can be open at once (a picker on top of a form)") shows the component was *built* to allow stacking even though the written rule forbids it for pickers — that gap between what the component allows and what the rule requires is worth closing so the next sheet added doesn't repeat History's mistake.

**The other, larger finding: Tools home was explicitly left out of B4/B5.** `tintStyle` (the old tinted-card pattern Block B replaced on Budget/Due/Notes) is still used in 13 files — critically `ToolsScreen.tsx` (the Tools tab's tile grid and every group page) and `ToolScreen.tsx`'s own navigation chrome. **Tools is the single highest-traffic screen in the app — the entry point to all 60 calculators — and it still looks exactly like the "bulky, card-everywhere" screens the owner already complained about once.** This is the far more likely explanation for the complaint surviving after Budget/Due/Notes were fixed: the owner spends most of their time in Tools, and Tools wasn't touched.

**The critic's flagged blind spot, stated honestly:** visual density, colour/typography fatigue, and whether the 5-tab split (Calculate/Tools/Notes/Due/Budget) is even the right information architecture are **not things a grep can answer**. B6–B8 below are scoped to what the evidence actually supports (one bug, one unfinished screen). B9 is a deliberate, separate step to check the blind spot rather than silently guess at it.

| # | Item | Size | Status |
|---|---|---|---|
| B6 | Fix `HistorySheet → HistoryRowSheet`: bring it in line with the picker-sheet rule already written in `FORMS-AND-SHEETS.md` — swap the view inside one sheet, or promote History to a full-screen push with the row detail as its one sheet | S | **Done** — `HistorySheet` now returns `HistoryRowSheet` in its own place instead of rendering both; `HistoryRowSheet` does the same for its own "Copy as" sheet (the same stacking bug, one level deeper, caught in the same pass). `npm run check` 2529/2529 |
| B7 | **Finish B4/B5: apply the three-tier rule to Tools home** group pages. This is the highest-value single item here — it is the screen the owner actually spends the most time in | M | **Done** — every group page's sections converted from same-coloured tinted cards to hairline `.group` lists (confirmed in the browser: a group page was one undifferentiated colour wash, since every section inside one group shares the group's single tint — the tint never told sections apart, it just repeated). Kept: the tile grid and the small per-row colour dots (both already minimal, both explicitly sanctioned by `DESIGN-SYSTEM.md`'s "where a tint may appear" — checked, not assumed. `ToolScreen.tsx`'s own tinted input card is separately sanctioned the same way and is intentionally out of scope here |
| B8 | Sweep the remaining `tintStyle` users for the same treatment: `SpendSummary.tsx`, `ManageScreen.tsx`, `BillsScreen.tsx`, `ImportScreen.tsx`, `ExportSheet.tsx`, `CategoryEditSheet.tsx`, `InstrumentForm.tsx`, `limits.tsx`, `SettingsScreen.tsx`, `TipsAndTours.tsx` — case by case: some tint (a calculator's own input card, a group page's section cards) is explicitly correct per `DESIGN-SYSTEM.md`'s "Where a tint may appear" and should stay; only navigation-link and plain-content cards convert | M | **Done** — one CSS change instead of ten edits: `.sect` / `.sect__head` became a bare titled group (small `ink-2` heading, hairline rows, no card), which converted Settings, Manage, Import, Bills, Spend Summary and Tips at once. The Total / Per-year figures are now bare (tier 1). Kept on purpose: the `save__card` form cards inside sheets and `ToolScreen`'s input card (sanctioned input cards). Also fixed a doubled hairline between bills. Verified: `npm run check` 2529, layout-contract 144/144, qa-budget-new and shell suites show no new failures vs HEAD (7 contrast checks now pass) |
| B9 | **Ask, don't guess, about density/IA.** Once B6–B8 ship: a short, specific round with the owner — which screen still feels wrong, and in what way (too much to read, too many taps to get somewhere, colours/type feel busy, the 5-tab split itself). The critic's point stands: a grep-based audit cannot see visual fatigue or judge information architecture; only looking at it with the owner can | — | **Done** — owner's answer: Budget home and Tools felt most cluttered; Notes/Due should offer both list and card views. Researched card/carousel/bento-grid patterns first (NN/g, UX StackExchange, 2026 fintech trend pieces) before building anything — verdict: carousels/bento don't fit this app's own banned-gradient/no-shadow rules, progressive disclosure does. Led to B10/B11 below |
| B10 | List/Card view toggle for **Notes** and **Due**, owner's choice, persisted (`settings.notesCardView`, `settings.dueCardView`) | M | **Done** 2026-11-05/06 — `CardTile`/`.due-card` reuse the same non-overlapping flex geometry as the existing row components, so the layout-contract overlap/44px checks pass unmodified. Verified in browser + `npm run check` |
| B11 | **Budget home**: collapse the 4 pure-navigation rows (Spending summary, Bills, Add from bank messages, Categories and cards) behind one "More in Budget" row + sheet, same progressive-disclosure pattern as B4's Notes "More" | S | **Done** 2026-11-06 — cuts the always-visible row count from ~13 toward ~9. Fallout: ~25 e2e call sites across 7 files updated to open the sheet first; one new snackbar-intercepts-click timing bug found and fixed. Full account: `docs/SESSION-STATE.md` Round 19 |
| B12 | **Tools home density** — owner's own answer to B9 named Tools as cluttered too, but it was never acted on: the earlier critic found no equivalent collapsible low-value content there the way Budget had its 4 nav rows | M | **Not started** — needs a fresh look (B7/B8 already converted Tools' cards to hairline groups; this is a *second*, distinct complaint about row count/grouping, not card styling) |

**What this means for "redesign the entire app if required":** the evidence does not support a from-scratch rebuild — it would discard real, tested, now-verified-on-device work (Block A, B1–B5) to re-solve problems B7/B8 already have a proven fix for. The honest scope is: finish applying the already-working three-tier system everywhere (B7, B8), fix the one confirmed broken rule (B6), then check with the owner directly whether what's left is still wrong (B9) before considering anything larger. **B9's answer led to B10-B12**, not a rebuild.

**One pre-existing bug found while verifying B11, not fixed (out of scope, flagged separately):** "Use in another tool" picks the target calculator correctly but the final navigation never completes — confirmed broken on `dev` before any of this session's changes (`git stash` comparison). Spawned as its own background task rather than folded into B11.

### Block C — Notes becomes a real Notes tab

| # | Item | Size |
|---|---|---|
| C1 | **Done 2026-11-05** `kind: 'text'` — a plain note. **Critic verdict: plain note only, no auto-maths** | S |
| C2 | **Done** One prominent `+` replacing the "New list" text link | S |
| C3 | **Done** Share a note or list as text; export all notes | S |
| C4 | **Done** Search inside note bodies and list lines | S |

### Block D — Budget answers "did I save?"

| # | Item | Size |
|---|---|---|
| D1 | **Income and net cash flow** — the biggest content gap; Budget tracks spending only | M |
| D2 | Limit crossed 80% / 100% notification | S |
| D3 | Month-end summary | S |
| D4 | Expense tags (cross-category, e.g. "Goa trip", "reimbursable") | M |
| D5 | Merchant rules you can see and edit | S-M |
| D6 | Split one expense across categories | M |
| D7 | Reimbursable / "owed back" list | M |
| D8 | **Done 2026-11-11** Day view: tap a day (Recent entries, Entries list, search) to see that day's spend, per-route subtotals (UPI, each card, cash) and every entry in entered order, with one-tap "Add a note". No new stored fields. | M |

**⚠ Do D1 and B2 before D2–D7.** Budget home is already five equal cards over one number; adding
features before it has a hierarchy makes it worse, not better.

### Block E — Due

Repeat end date / "EMI for 24 months" (M) · more snooze choices (S) · skip one occurrence (S) ·
calendar view (M) · quiet hours and a daily digest (S-M) · **boot & timezone rescheduling (S)**.

**⚠ Boot rescheduling is small and was filed under "Later", but today one reboot silently cancels every
reminder with no sign anything is wrong.** It belongs here, not in Later.

### Block G — Calculator units and improvements *(owner, 2026-11-05: "everything is in years; should be days, months and more")*

Audit first: `docs/CALC-AUDIT-2026-11-05.md` (every calculator's inputs and units, the engine's day/month/year basis, one reusable
unit-control design that keeps every existing field id and saved value valid, other missing inputs/presets/validation, a batched
work list C-U1...). Rules that stay: **field and tool ids never change** (saved items store inputs by field id); an old saved value
must keep its old meaning (default unit = what the field means today); where a rule needs a primary source we lack, it stays BLOCKED.
Then build in batches, each owning separate files, in separate worktrees.

**Block G, after the critic (2026-11-05): the shrunk plan that is being built.** (1) Foundation (`units`, `<id>__unit`, `unitOf`, `toYears`,
`toWholeMonths`, the Segmented switch, share text, the Use-in fix, and a visible months/years switch on the loan term box).
**`defaultUnit` was dropped:** the form builder merges defaults under an old saved card, so a "months" default would have made a saved
"10 years" reopen as 10 months. (2) Savings tools in one batch (one builder, same file): sip, step-up-sip, lumpsum, swp wait, fd, rd,
inflation (units); cagr gets months only (days annualise to nonsense); rate 0-100 and years caps on all of them; SIP "whole years only"
hint changed; a one-line note on goal-sip. (3) balance-transfer and simple-compound units. (4) unit-converter month, capital-gains
"3 years 2 months". **Deferred:** `ratePer`, dates modes, extra EMI, goal-sip by date, FD maturity date, pay-rate (month/30 and month/26 have
no primary source), break-even. **Open:** goal-sip grows "already saved" yearly but the SIP monthly (yearly is the cautious one); left as is.

### Owner's order of work (2026-11-05)

1. Finish the UI group (B12-B20, hints) and Block G (calculator units and improvements).
2. Keep building the planned features: D1 income, D5 rules, EMI-for-N-months + snooze choices, Phase 7 modules, Portfolio P1.
3. **Then make the Android build; the owner installs it and tests on the phone** (`scripts/build-android.sh install`, `docs/BUILD-ANDROID.md`).
4. Full QA after the phone test.

### Portfolio P1 — smallest honest version (owner: build it; critic shrank it ~3x, 2026-11-05)

**A list of things you own or owe: each has ONE current value and a date, plus an append-only history of past values.** Net worth, split and
trend are all derived from that. `Holding { id, name, kind, deletedAt, values: { date, amount }[] }`, `amount` a positive Decimal string, sign from
`kind` (bank, fd_rd, stocks_mf, gold, property, retirement, other | loan, card_debt); caps 100 holdings, 120 values each. **Lives as a page inside
Budget** (like Bills; the 5-tab bar is full; hidden if Budget is switched off in Phase 7, data stays in the backup). One-glance: net worth as a bare
big number, "N of M values older than 30 days", split as a hairline list with thin bars, last 6 month totals as bars (never interpolated; a holding
with no value yet is excluded and flagged), update = tap row + number (pre-filled, date today, same-day edit replaces), staleness in words on every
row. Hide-amounts flag (local). Cut: categories/platform/folio/note, units and gold price, maturity/rate, CSV export (backup already holds it),
XIRR/invested (P2), reminders (P2). Files: `src/engine/investments/portfolio.ts`, `src/lib/portfolio.ts`, store types/persistence/app, one
screen + sheet inside `features/budget`. Additive, schema stays 3. Waits for D1 (same store files) and for the card/list design decision.

**Built (branch worktree-agent-a6463555a5fc13c7b, from dev 42e0217).** `src/engine/investments/portfolio.ts` (pure maths), `src/lib/portfolio.ts` (words, form checks,
`sanitizePortfolio`), `portfolio?` on the stored data (schema stays 3), five actions in `app.ts`, `features/budget/PortfolioScreen.tsx` reached from "More in Budget"
(and from the empty Budget list, or it could not be reached before the first expense). Choices: amounts hidden by default (screen state only); a value on the same day
replaces that day; the 121st value drops the oldest; a month that lacks a holding's first value leaves it out and says so in words on that month's row; a value dated one day ahead is
kept on load (phone in another time zone), two days ahead is dropped. Tests: `engine/investments/portfolio.test.ts`, `store/portfolio.test.ts`, `store/qa-privacy-portfolio.test.ts`,
`src/portfolio-rules.test.ts`, browser pass `e2e/portfolio.test.mjs`. One CSS line added (`.empty > .btn { flex: none }`): the extra empty-list row squeezed the Add button to 23px at 360x640.

### Phase 7 — modules on/off (owner: build it; critic shrank it, 2026-11-05)

**Two switches only: "Budget" and "Notes and reminders" (Notes + Due together). Tools is always on.** One `modules: { budget, notes }`
in settings, default on, sanitised so old backups load as everything on; one `tabOn(settings, tab)` helper read in six places
(TabBar, setTab and showCard, the initial tab, the "Opens on" list, `updateSettings` when the current tab turns off, the notification tap).
Hide, never delete; a hidden tab falls back to Calculate when read, stored `startupTab` is never rewritten. Hides the matching calculator
result icons and the bank-message reader. Reminders keep ringing with the Due tab hidden (hint line says so). Cut: presets, first-run
question, inner switches, "pause reminders". To verify first: whether Budget bills schedule notifications. Size M, after the UI group.

**Built (branch worktree-agent-aea3c8d23e875e665).** `src/lib/modules.ts` (`tabOn`, `moduleOn`, `startTab`, `withModule`), `sanitizeModules` in persistence, a
"Show in the app" group in Settings, tests in `src/store/modules.test.ts`, browser pass in `e2e/modules.test.mjs`. **Verified: Budget bills DO schedule
notifications** (every bill owns a Due card and a reminder), so the Budget switch hint says bill reminders still ring. With both switches off the bar has 2 tabs
(Calculate, Tools), not 3. Also hidden with Notes off: the Save button and the next-step chip on a calculator, "Export notes". Not hidden: reminder time and
permission rows in Settings (reminders still ring). A "missed reminder" banner lives on Due, so it is not seen while Due is hidden.

### Block H — SMS Inbox and learning *(owner, 2026-11-11; plan only, see `docs/SMS-INBOX-PLAN.md`)*

Phase 0 prove the scan on the phone, 1 Day view (Done), 2 Inbox on scan-on-open, 3 exact-payee learning with Undo, 4 measure 2-4 weeks, 5 optional context hints / always-on (gated). Critic: build smaller.

### Block F — Phone truth

Reminders really firing · backup/restore round-trip · TalkBack · rotation · the SMS scan window fix.
None of these can be proven in a browser.

---

## 5. Decisions only the owner can make

**All six answered by the owner on 2026-11-04.**

| Question | Decision | What follows |
|---|---|---|
| **B9: which screen still feels wrong** | **"All of them except the basic calculator page."** The calculator page is the quality bar | Audit every other screen against it: `docs/B9-UI-AUDIT-2026-11-04.md`, then a numbered work list (B10+) |
| **`ink-3` contrast on tints** | **B**: hints become `ink-2`; `ink-3` stays for borders and fills only | Change every `color: var(--ink-3)` text use to `ink-2` |
| **Dates** | **Indian first**: force `en-IN` everywhere | One shared `DATE_LOCALE` constant, replace every `Intl.DateTimeFormat(undefined, ...)` and bare `toLocaleDateString()` |
| **Phase 7 "turn modules on/off"** | **Build it** | The project rule still sends it through one critic first, to shrink it, not to reopen the decision |
| **Portfolio (P1)** | **Yes, build it** | After the design work, as planned |
| **Lock-a-history-row control** | **Keep it** | Remove the "remove it when next touched" note |

---

## 6. How we stop missing bugs

The honest diagnosis of why audits have been missing real defects:

1. **The tests were not running.** Node 18 vs Playwright's Node 20 floor, plus a piped exit code hiding a
   failing typecheck. Both fixed today; both were invisible for sessions.
2. **Reading code finds what the code says, not what the screen does.** Every real defect found on
   2026-11-04 came from measuring a live page, never from reading a file.
3. **Checking one screen size by hand produces false passes.** Proven today: 375×812 passed by hand,
   360×790 failed in the test, same code.
4. **Screenshots are a weak assertion.** A human glance misses a 20px overlap. A geometry assertion does not.

**The rule going forward: assert relationships, not appearances.**

| Instead of | Assert |
|---|---|
| "it looks right" | element A's box does not intersect element B's box |
| "the text fits" | `scrollWidth <= clientWidth` on every row |
| "the button is tappable" | its box is ≥44px *and* nothing overlaps its centre |
| "it works" | zero console errors, at 3 widths and 2 font scales |

Every bug fixed from now on leaves one such assertion behind. `e2e/answerbar.test.mjs` is the template:
7 assertions, each one a defect that was really on screen.

---

## 7. The design reset

**The owner's verdict: the calculator is close to right; Tools, Notes, Due and Budget are not.**
Complaints: everything is a card, everything is a list, it is bulky, layouts break, text spills, and
secondary actions (To list / Remind me / Add expense after "=") are presented as loudly as the answer.

### Why the calculator works and the rest does not

The calculator already follows a hierarchy the other screens abandoned:

```
  CALCULATOR                        BUDGET / NOTES / TOOLS
  ----------                        ----------------------
  the number     <- huge, bare      a card   <- same weight
  the expression <- quiet           a card   <- same weight
  the keys       <- uniform, calm   a card   <- same weight
                                    a card   <- same weight
  one thing shouts.                 a card   <- same weight
                                    nothing shouts.
```

**The app is breaking its own written rule.** `CLAUDE.md` says: *"Grouping is by 1px hairline, not by
boxes. No nested cards."* Budget home currently stacks five tinted cards; Notes stacks three. The fix is
not a new design language — it is applying the one already written down.

### The rule to adopt

| Tier | What it is | How it looks |
|---|---|---|
| **1 — The answer** | The number or fact the screen exists to show | Large, mono, **no container at all** |
| **2 — The content** | Entries, rows, results | Hairline-separated rows. No card, no tint, no nesting |
| **3 — Actions & navigation** | Copy, Share, To list, Remind me, "see all" | Quiet. Icon **with a word**, grouped, never competing with tier 1 |

Applied to the owner's specific complaint — after "=":

```
  TODAY                                PROPOSED
  [ To list ] [ Remind me ]            answer stays tier 1
  [ Add expense ]                      a single quiet row beneath:
  three equal chips, as loud             ⊞ List   🔔 Remind   ₹ Expense
  as the answer itself                 icon + word, tier 3 weight
```

### What to add, visually

The owner asked what visual elements would help people *see* information. Honest answers only — the
design system bans pie charts, gradients and shadows, and no chart library is wired in:

| Add | Where | Why |
|---|---|---|
| **One number, large, as the page's answer** | Budget home, Spending summary | Replaces "which of these five cards matters?" |
| **Horizontal bars** (already used in the heatmap and MRR chart) | category spend, limits, loan interest-vs-principal | Comparison at a glance, no library needed |
| **A spend-vs-limit line** with the number on it | Budget categories | Replaces reading two numbers and subtracting |
| **Sparkline-style month bars** | Budget, Portfolio | Trend without a chart library |
| **Hairline groups instead of cards** | everywhere | Removes the bulk the owner is objecting to |

**Not** pie charts, treemaps or Sankey — already ruled out, and pies hide small categories, which is
exactly wrong for budget categories.

### Order

B1 (write the rule) → B2 (Budget home as the reference screen) → owner looks at it → then B3/B4/B5 roll
it out. **One screen first, approved, then the sweep** — not a big-bang redesign.

---

## 8. Blocked, and on what

| Item | Blocked on |
|---|---|
| VPF calculator (the rest of the small-savings pack is built) | Not in the registry. Not re-checked whether the old blocker (quarterly rates from a primary source) still applies |
| Rent receipt (the HRA exemption calculator is built) | Not built. Not re-checked whether the old blocker (Income-tax Rules text) still applies |
| Exit settlement (E8) | Labour Codes notification status + Income Tax Act text |
| Sequence-of-returns, split charts, world-time globe | A chart-library decision |
| Widget, Quick Settings tile, share-in, exact alarms | Native Android work |
| iOS | A Mac with signing |
| Multi-currency per entry | Wiring the existing rate fetch into Budget |
| Remote rules packs (H1) | Nothing — it is just large. Every "rates stay fresh" promise assumes it |

**Built since this table was written, so no longer blocked (checked in the registry 2026-11-11):** SSY, NSC and SCSS (`ssy`, `nsc`, `scss`), HRA exemption (`hra`), FD ladder (`fd-ladder`), gold jewellery bill (`gold-bill`), LTCG harvesting (`ltcg-harvest`).

---

## 9. Ruled out — do not re-suggest

Bank linking / Account Aggregator · accounts, cloud sync, shared budgets · YNAB-style envelopes and
rollover · "best card for this spend" with a built-in rate database · brokerage/margin/TDS calculators ·
GST invoice maker · function plotting · live gold/FD rate fetching · ads, analytics, crash SDKs · any
paywall or Pro tier · cloud backup · pie/treemap/Sankey charts · user-written custom calculators
(breaks "field ids never change") · 150-tool algebra/geometry packs · portfolio X-ray · a double-entry
ledger · ESOP/RSU tax · editing the date of a past calculation · a full from-scratch visual redesign
(the targeted reset in §7 is the agreed alternative) · **auto-detecting maths inside a text note**
(critic, 2026-11-04: `2-11-2026` evaluates to −2035 and `50% off` to 0.5 — it manufactures wrong numbers
from ordinary prose).

**Overruled by the owner and now built:** reading SMS to auto-log spending. **Overruled, built smaller:**
net-worth tracking, as Portfolio.

A separate "lock a history row" control was ruled out as redundant with naming — **but it shipped
anyway, and the owner chose to keep it (2026-11-04).**
