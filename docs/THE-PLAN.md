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
| **Calculators** | **60** (docs elsewhere still say 51 or 57 — those are stale) |
| **Tabs** | Calculate · Tools · Notes (+To-do) · Due · Budget |
| **Budget** | expenses, categories + subcategories, cards/accounts, limits per month, bills & subscriptions, statement cycles, refunds, trips, heatmap, CSV export/import, bank-message scan |
| **Notes** | saved calculations, lists (label + amount), to-dos. **No plain text note** |
| **Due** | reminders, lead times, repeats, advance-tax pack, battery-settings guide |
| **Platform** | offline, no account, no analytics. Android only. Local backup file |
| **Tests** | 2529 unit tests + 7 e2e suites |

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

### Block A — Make the audit trustworthy *(do this first; everything else is guesswork without it)*

| # | Item | Size |
|---|---|---|
| A1 | `.nvmrc` + `engines` pinning Node 20+, and an `npm run e2e` script, so the browser suites actually run | S |
| A2 | **Layout contract suite**: every screen × 3 widths (320/360/412) × 2 font scales (100%/200%) × seeded long content. Fails on sideways overflow, on any interactive element covered by another, on clipped text, on a tap target under 44px | M |
| A3 | Put `npm run check` + the layout suite in one command, and never report a result from a piped exit code | S |

### Block B — The design reset *(see §7 for the thinking)*

| # | Item | Size |
|---|---|---|
| B1 | Write the **three-tier hierarchy rule** into `DESIGN-SYSTEM.md` and apply it to one screen as the reference | S |
| B2 | Rebuild **Budget home** to that rule: money above the fold, navigation below it | M |
| B3 | Demote the post-"=" actions (To list / Remind me / Add expense) from equal chips to a quiet icon row | S |
| B4 | Replace tinted section cards with hairline groups on Tools, Notes, Budget | M |
| B5 | Apply to Notes, Due, Tools | M |

### Block C — Notes becomes a real Notes tab

| # | Item | Size |
|---|---|---|
| C1 | `kind: 'text'` — a plain note. **Critic verdict: plain note only, no auto-maths** | S |
| C2 | One prominent `+` replacing the "New list" text link | S |
| C3 | Share a note or list as text; export all notes | S |
| C4 | Search inside note bodies and list lines | S |

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

**⚠ Do D1 and B2 before D2–D7.** Budget home is already five equal cards over one number; adding
features before it has a hierarchy makes it worse, not better.

### Block E — Due

Repeat end date / "EMI for 24 months" (M) · more snooze choices (S) · skip one occurrence (S) ·
calendar view (M) · quiet hours and a daily digest (S-M) · **boot & timezone rescheduling (S)**.

**⚠ Boot rescheduling is small and was filed under "Later", but today one reboot silently cancels every
reminder with no sign anything is wrong.** It belongs here, not in Later.

### Block F — Phone truth

Reminders really firing · backup/restore round-trip · TalkBack · rotation · the SMS scan window fix.
None of these can be proven in a browser.

---

## 5. Decisions only the owner can make

| Question | Options |
|---|---|
| **`ink-3` contrast on tints** | **A.** Lighten `ink-3` to `#929292` — passes everywhere, but ink-2 and ink-3 become nearly identical (separation drops 1.56 → 1.25). **B.** Stop using `ink-3` for hint text; hints become `ink-2` — ramp kept, ink-3 becomes a border colour only. **C.** Accept it and write the exception into the design system |
| **Dates** | Force `en-IN` everywhere, or keep following the phone's locale |
| **Phase 7 "turn modules on/off"** | 8 items, planned, never critiqued. It changes behaviour for every user, so the project rule says a critic runs first. Worth it only if the app really is too big — which the design reset in §7 may fix more cheaply |
| **Portfolio** | P1 (holdings + dated value history) is ready to build. Adds a 6th thing to an app you already find too big — do it after the design reset, not before |

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
| India small-savings pack (SSY/NSC/VPF/SCSS) | 4 quarterly rates from a primary source |
| HRA + rent receipt | Income-tax Rules text (section number, metro list, PAN threshold) |
| FD ladder | DICGC cover limit from a primary source |
| Gold jewellery bill | GST split — sources disagree (3% vs 3%+5%) |
| LTCG harvesting | Exemption limit from a primary source |
| Exit settlement (E8) | Labour Codes notification status + Income Tax Act text |
| Sequence-of-returns, split charts, world-time globe | A chart-library decision |
| Widget, Quick Settings tile, share-in, exact alarms | Native Android work |
| iOS | A Mac with signing |
| Multi-currency per entry | Wiring the existing rate fetch into Budget |
| Remote rules packs (H1) | Nothing — it is just large. Every "rates stay fresh" promise assumes it |

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
anyway** and is still in the Calculation sheet. Remove it when that sheet is next touched.
