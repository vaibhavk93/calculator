# Handoff — where we are and what to build next

Last updated: 2026-11-02 · branch `claude/app-phases-overview-d5xazn`

Read `CLAUDE.md` first for the rules. `docs/PRD.md` is the contract for **what** to build;
this file is the state of play and the decisions that are not in the PRD.

## State in one paragraph

P1 (foundation) is built: expression calculator, history, settings, themes, backup, Indian number
format. A21 (landscape layout) is built on top of it. Everything else is **planned, not built**.
Verified in this repo's environment: `npm run check` (typecheck + 395 unit tests) and
`node e2e/smoke.mjs` (75 browser checks, portrait and landscape). **Never run on a real Android
device**, and the Capacitor/Android build (P8) does not exist yet.

## What to build, in this order

| # | Work | Why this position |
|---|---|---|
| 1 | **P1.1** History power-ups, A16–A20 (row menu, lock, memo, edit, share) | Small, wanted, and the seed of the memory layer. Spec and test gate are in PRD §12. **Gotcha:** history is capped with `.slice(0, MAX_HISTORY)`, which would silently evict locked rows. Evict unlocked rows only. Adds fields, so bump `CURRENT_SCHEMA` with a migration and a fixture test. |
| 2 | **P2** Everyday converters B1–B15, plus A22 (Use result in…) and A23 (per-calculator drafts) | ClevCalc parity |
| 3 | **Reminder spike** (recommended, not yet decided): a minimal Capacitor build that schedules one notification about 15 minutes out, tested on a Redmi/Realme phone | Reminders are the differentiator and the riskiest piece. The docs cite a report of Redmi dropping notifications scheduled more than ~10 minutes out. Learn this before building P3–P5 on top. |
| 4 | **P3** Loans C1–C15 | C2 must close in exactly N instalments (residue in the final one). Reference: ₹80L at 8% over 240 months = ₹66,915. |
| 5 | **P4** Investments D1–D17 | |
| 6 | **P5** Tax & salary E1–E8 | Highest upkeep. E8 (exit settlement) does not ship until its rules are checked against primary sources. |
| 7 | **H14 schema migration**, before any real saved data exists | Recommended: pull forward to just before P6 |
| 8 | **P6** Memory layer G1–G20, PM pack F7–F13 | Categories, payment methods, pickers, settlement lines are G13–G20, specified in `MEMORY-LAYER.md` §4.6b–4.6c |
| 9 | **P7 / P8** Platform, native, Android build | |

**Suggested first release (a recommendation, not a decision):** P1, P1.1, P2, P3, P6 with only
Save + Tape + reminders, P8, and from P5 just E1 and E3 (old-vs-new regime, HRA) as the India
wedge. Defer P4, the rest of P5 and the PM pack.

## Decisions the user has made

- Landscape layout: yes (built).
- Take the history features from ClevCalc (A16–A20). Not adopted from ClevCalc: ads, a promo line
  on shares, teal operator colouring, a hamburger drawer, a share-confirm dialog.
- Spend categories, subcategories and payment methods are **user-managed lists chosen from a picker**,
  not typed (G13–G19). Payment methods are two-level: mode → instrument (card or account).
- Tier 1 ideas from the earlier finance repos are in the plan (A22–A23, C12–C15, D14–D17, E8, G20).

## Decisions still open

| Question | Recommendation |
|---|---|
| Build P1.1 or P2 next? | P1.1 |
| Keep the calculator free of SMS / email / statement capture? | Yes. Capture breaks "no account, almost no permissions" and the Play listing. |
| PDF export: free (PRD F5) or Pro (GTM-STRATEGY §5)? | Decide before any public launch |
| Run the reminder spike before P3? | Yes |

## Later list (not in the PRD)

From `credit-card-optimiser`, `financial-planner`, `EMI-Calculator`. Do these only after the core ships.

- **Which card for this spend?** The rules engine in `credit-card-optimiser` is pure JavaScript, so it
  ports directly. Upkeep is the cost: card terms change often and its rules file flags some as unconfirmed.
- Statement day, due day, limit and utilisation on each card instrument (extends G14).
- Budget alerts that say "at most" when the data is incomplete (extends G17).
- Expose the calculator engine as an MCP tool for AI assistants. Cheap because the engine has no UI.

**Not adopted:** SMS, Gmail and statement-PDF capture; a double-entry ledger; ESOP/RSU tax; Account
Aggregator and investment advice.

## Known inconsistencies in the docs (not yet fixed)

| Where | Problem |
|---|---|
| `PRD.md` §10 | Definition of Done names branch `claude/personalized-calculator-research-dl43uk`; use the branch above |
| `PRD.md` §9 risk table | "70 features"; the real count is 111 in sections A–G, plus 14 platform items (H) |
| `TECH-DECISIONS.md`, `GTM-STRATEGY.md`, `UX-GUIDELINES.md`, `README.md` | "74" and "86" calculators / formulas in several places |
| `PRD.md` §6 vs §12 | Phase table stops at P7; build sequence adds P8 |
| `PRD.md` §7 H | H4 (currency cache) is listed under P5–P7 but P2's currency converter needs it |

## Facts that are not verified

Tax slabs, Labour Code and gratuity rules, and the 74 "golden" test values mentioned in the PRD's
provenance table come from the author's other repos and have **not** been checked here. Treat them
as claims. The calculator rule is: no primary source, no ship.

## Reference material that is not in this repo

The five ClevCalc screenshots behind A16–A20 were deliberately **not** committed: this repo is public
and the screenshots show personal figures. The PRD describes the behaviour in text. Re-attach them
to the next session if you want the layout matched exactly.
