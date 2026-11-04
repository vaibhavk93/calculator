# Improvement plan: six areas, 2026-11-04

Owner's request: finish the open tasks, then plan improvements to (1) the Calculation bottom sheet,
(2) the floating ARR answer on Recurring revenue forecast, (3) copy/share icons, (4) Notes + To-do,
(5) what "Notes" can hold, (6) Budget — each looked at from **UI, UX, Features, User flow, Improvement**.

Everything below marked **Measured** was reproduced in a real browser at 375×812 on this build, not read off the code.

---

## Part A — Open tasks: what was actually wrong

| # | Task | State before | Now |
|---|---|---|---|
| A1 | `npm run check` | **Failing.** `tsc` exited 2 on 3 errors in the uncommitted QA files, so unit tests never ran at all | **Fixed.** Typecheck clean |
| A2 | Unit tests | Never ran (blocked by A1) | **Run.** 2504 pass, 9 fail |
| A3 | 8 of the 9 failures | `qa-contrast.test.ts` — `ink-3` and `alert` text on all 8 dark section tints | **Real bug, not fixed.** See C3 |
| A4 | The 9th failure | `expenseEdits.test.ts` expects `2 Nov`, gets `Nov 2` | **Test bug.** See below |
| A5 | 4,103 lines of uncommitted QA work | Untracked, unknown state | Typechecks and runs; ready to commit |

**A1 fix** — two one-line changes:
- `src/store/qa-fuzz.test.ts:235` — `big()` returned `unknown[]`, so `Object.fromEntries` rejected it. Made it generic (`<T,>`).
- `src/store/qaNotesDue.test.ts:6` — removed the unused `atTime` import.

**⚠ Remember:** `npm run check` was reported as passing in the last session. It was not. A piped
`npm run check | tail` returns *tail's* exit code, so the failure was invisible. Check `${PIPESTATUS[0]}`
or don't pipe.

**A4 is a test bug with a product question behind it.** Dates use `Intl.DateTimeFormat(undefined, …)`
— the *device* locale — in 10 places (`budget.ts`, `DueScreen.tsx`, `SpendSummary.tsx`, `Heatmap.tsx`).
On a US-locale phone an Indian user sees `Nov 2`; the test asserts `2 Nov`. Respecting the device locale
is defensible, so **fix the test** (pin the locale), and separately decide whether an India-first app
should force `en-IN` regardless of phone settings.

---

## Part B — The six areas

### 1. The "Calculation" bottom sheet

The sheet literally titled **"Calculation"** is `src/features/calculator/HistoryRowSheet.tsx` — it opens
from the "more" button on a history row. It offers **8 actions** for one row.

```
                        TAP A HISTORY ROW
                                |
                    +-----------+-----------+
                    v                       v
            [ footer button ]        [ 7 menu items ]
            "Use expression"          Use result
                    |                 Name / Rename ....... edit icon
                    |                 Edit expression ..... edit icon  (same icon!)
                    |                 Lock / Unlock
                    |                 Share
                    |                 Copy
                    |                 Delete
                    |
          near-duplicate of "Use result",
          but one is a footer and one is a list row
```

| POV | Finding |
|---|---|
| **UI** | "Name" and "Edit expression" use the **same `edit` icon** — indistinguishable at a glance. "Use result" uses `chevron`, which means nothing. |
| **UX** | "Use expression" (footer, the one main action) and "Use result" (first list item) are two near-identical phrases doing different things. Users will not predict which is which. |
| **Features** | **Lock is redundant and was already ruled out.** `docs/MASTER-ROADMAP.md` → "Ruled out — do not re-suggest these" says: *"A 'lock a history row' control separate from naming it — Naming already means 'keep this'"*, marked **deliberately dropped**. It shipped anyway. And the Name sheet's own hint says *"Named calculations are kept when you clear history."* Two controls, one meaning. |
| **User flow** | **Dead end.** From a history row you cannot: save to Notes, add to a list, add as a Budget expense, or set a reminder. Every one of those exists for a *fresh* result (`ResultActions`) but is unreachable for a *past* one. This is the real gap, not an excess of buttons. |
| **Improvement** | Cut 8 actions to 6 and add the missing destinations. |

**Proposed sheet:**

| Keep | Change | Remove | Add |
|---|---|---|---|
| Use expression (footer) | Rename "Use result" → **"Use the answer"**; give it the `forward` icon, not `chevron` | **Lock / Unlock** — ruled out, duplicated by Name | **Save to Notes** |
| Name / Rename | Give "Edit expression" the `calculator` icon so it differs from Name | | **Add to a list** |
| Edit expression, Share, Copy, Delete | | | **Add as expense** (when the answer is positive money) |

Net: 8 → 10 actions but **one dead end removed and one redundant control gone**. If that is too many,
the three new ones group under a "Send to…" sub-sheet — the sheet already has a two-mode pattern
(`menu` / `name` / `edit`), so this costs no new machinery.

---

### 2. The floating ARR answer — **three separate bugs, all measured**

`src/features/tools/ToolScreen.tsx:622-631` + `src/styles/tools.css:81-117`. A bar floats at the bottom
showing the headline answer whenever that answer scrolls out of sight.

**Measured bug 1 — it strobes.** The `IntersectionObserver` uses a single `threshold: 0.2` with **no
hysteresis**, so one boundary both shows and hides it. Scrolling 3px toggles it:

```
scrollTop 592 -> hidden      594 -> hidden      593 -> hidden
scrollTop 598 -> SHOWN       597 -> SHOWN       599 -> SHOWN
```

On a phone with momentum and rubber-band scrolling this flickers continuously. **This is exactly the
owner's "inappropriately show/hide at any times".**

**Measured bug 2 — the arrow points the wrong way.** The icon is hardcoded `name="down"`
(`ToolScreen.tsx:628`). When the bar appears, the answer is *above* the viewport (measured `mainTop:
-18.5`). The arrow tells you to scroll down to reach something that is up.

**Measured bug 3 — it covers the copy/share row.** The bar (`z-index: 2`, `position: absolute`, bottom
edge) sits at y 625.6–707.8. The Keep-and-share row sits at y 643.8–687.8. It is **entirely covered** —
measured `coveredByAnswerBar: true`. At the bottom of any tool page the floating bar hides Copy, Share,
Add to a list, Remind me, Use in another tool and Reset. **This is why issues 2 and 3 are the same bug.**

**Bug 4 — the destination is not marked.** `.result__row--main` is styled *identically* to every other
row (measured: both `16px / weight 400 / transparent / no border`). You tap the bar, it scrolls you to
the answer, and nothing there looks like the answer.

| POV | Fix |
|---|---|
| **UI** | Give `.result__row--main` real emphasis (larger, Plex Mono, a hairline above). Make the bar read as a control: accent border and a verb. `flex-wrap: wrap` currently pushes the icon to a third line (measured height 82px) — stop it wrapping. |
| **UX** | Add hysteresis: two thresholds (hide when >60% visible, show when <5% visible), so the show and hide points differ and it cannot strobe. Point the arrow **up** when the answer is above, **down** when below. |
| **Features** | The bar must never overlap an interactive row. Either reserve its height (`padding-bottom` on `.screen__body` while shown) or hide the bar when the Keep row is on screen. **Reserving space is the correct fix** — it also stops content jumping. |
| **User flow** | It is a button that looks like a result. Label it so the action is obvious: `"Yearly revenue (ARR) ₹96,06,193.31 — tap to show"` with an up-arrow. |
| **Improvement** | Also set the observer's `rootMargin` to the sticky header's height. Right now the answer is hidden *behind* the header while the observer still calls it visible (measured `mainBottom: 61` with the bar still hidden). |

**Owner's question — "if this is hyperlink then it should be appropriately presented":** it is **not** a
hyperlink. It is a `<button>` that scrolls. Present it as a button, with a verb and the right arrow
direction. It applies to **every tool with a `main: true` row**, not just this one — this is an
app-level fix in one component.

---

### 3. Copy and share icons — **four different presentations of the same two actions**

| Where | Copy | Share | Presentation |
|---|---|---|---|
| Tool result — `KeepAndShare.tsx` | bare icon, **no text** | bare icon, **no text** | six identical 44px squares; **covered by the floating bar** |
| History row — `HistoryRowSheet.tsx` | menu row, text + hint | menu row, text | labelled list — **the clearest one** |
| List / tape — `TapeScreen.tsx:216` | text link "Copy as text" | **missing** | `link-btn` |
| Calculator result — `ResultActions.tsx` | **missing** (Copy is a keypad key) | **missing** | labelled chips: To list · Remind me · Add expense |

| POV | Finding |
|---|---|
| **UI** | Measured: all six `KeepAndShare` buttons have `visibleText: ""`. They carry `title` tooltips, which **never appear on a touch device**. Six unlabelled glyphs in a row, same size, same colour. |
| **UX** | Nothing separates *sharing* (Copy, Share) from *keeping* (Add to a list, Remind me) from *destructive-ish* (Reset inputs). Reset sits in the same undifferentiated row as Copy. |
| **Features** | Share is **absent** from lists and from saved notes — already logged in Phase 6 ("Copy exists, Share does not"). |
| **User flow** | The row is the last thing on a tool page, so it is the row the floating bar lands on top of. |
| **Improvement** | **Reuse the pattern the app already has.** `ResultActions` uses labelled chips and reads clearly. Make `KeepAndShare` labelled chips too, in two groups separated by a hairline: `Copy · Share` then `Add to a list · Remind me · Use in…`, with **Reset moved out** to the end or into the header overflow. |

This is rung 2 of the ladder — the pattern is already in the codebase; nothing new is needed.

---

### 4 & 5. Notes and To-do

**The model.** `SavedCard.kind` is `'tool' | 'tape' | 'task'` and nothing else:

```
                      NOTES TAB
                          |
          +---------------+---------------+
          v               v               v
  +---------------+ +-------------+ +-------------+
  | 'tool'        | | 'tape'      | | 'task'      |
  | a saved       | | label +     | | a to-do     |
  | calculator    | | amount      | | (other tab) |
  | + its inputs  | | lines       | |             |
  +---------------+ +-------------+ +-------------+
          |               |
   created ELSEWHERE   "New list"
   (Save on a tool)    the only thing
                       you can start here

  x  There is no plain note. The owner is right.
```

`note` exists only as a *field* on a card, never as a card. **You cannot write a note in the Notes tab.**

**Measured, on the empty Notes screen:**
- The only way to create anything is a small underlined text link, **"New list"** — not a button.
- The empty state says *"Press Save on any calculator"* — Notes is a **destination**, not a place you start.
- There is no `+`. Roughly 55% of the screen is empty.
- A search box is shown when there is nothing to search.

| POV | Finding |
|---|---|
| **UI** | The screen's primary action is a 12px text link. Design rule says a screen's one main action should be prominent; here it is the least prominent thing. |
| **UX** | A tab named "Notes" that cannot hold a note is a broken promise. Everything arrives from somewhere else. |
| **Features** | Missing: plain note, share a note, export, search inside list lines. All four are already **Planned in Phase 6**; none built. |
| **User flow** | Every Notes item is created on another screen. The Notes tab is read-only in practice. |
| **Improvement** | See below. |

**Proposal (items 1, 2, 4, 5 are already roadmap-approved; only 3 is new):**

1. **`kind: 'text'`** — a plain note, title + body, with the same tags / pin / reminder / trash. *(Phase 6, effort S)*
2. **One prominent `+` on the Notes tab** that asks: Note · List · (Task on the To-do side). Replaces the "New list" text link.
3. ~~**Calculation-aware notes** — auto-evaluate arithmetic lines inside a text note.~~ **Cut by the critic. Replaced by: evaluate a line only when the user starts it with `=`.** See the verdict below.
4. **Share a note or list as text.** *(Phase 6, effort S)*
5. **Search inside note bodies and list lines.** *(Phase 6, effort S)*

**To-do** is less broken: `TodoScreen` + `TaskSheet` work, and priority / steps / quick-add / sort are
already scoped in `NOTES-TODO-PLAN` phases 2–4 and still unbuilt. No new analysis needed — build what is planned.

---

### 6. Budget

Budget is the most-built area (`BUDGET-PLAN.md`, plus 24 Phase-6 gaps). The problem is **not** missing
features — it is that the home screen is a menu, not a dashboard.

**Measured on Budget home:** one real number (`Spent this month ₹1.00`) followed by five equally-weighted
tinted navigation cards — Spending summary, Recent, Bills and subscriptions, Add from bank messages, and more below the fold.

| POV | Finding |
|---|---|
| **UI** | Five cards, five different tints, same visual weight. Tint is doing decoration, not meaning. The eye has no entry point after the hero number. |
| **UX** | *Analysis* ("Spending summary"), *data* ("Recent"), and an *input method* ("Add from bank messages") are presented as peers. They are not peers. |
| **Features** | The hero answers "what did I spend" but **cannot answer "did I save"** — there is no income, so no net. Already Phase 6 ("Income and net cash flow", effort M). This is the single biggest content gap. |
| **User flow** | The destructive trash icon sits directly on each Recent row, one tap from deletion, at the same weight as the "open" chevron. |
| **Improvement** | Three changes, in order: **(a)** add income so the hero can show *spent / in / net*; **(b)** collapse the five navigation cards into one "More in Budget" group so the dashboard shows *information* above the fold and *navigation* below it; **(c)** demote the row-level trash to the row's detail sheet. |

**⚠ Note:** Do **not** add new Budget features before (a) and (b). The existing 24 planned items will
make the menu-soup worse, not better, until the home screen has a hierarchy.

---

## Part C — What to do, in order

Sequenced so that cheap, measured, zero-risk fixes land first.

### C1 — Now (measured bugs, small diffs, no new features)

| # | Fix | File | Size |
|---|---|---|---|
| 1 | Hysteresis on the answer bar (two thresholds) | `ToolScreen.tsx:537` | S |
| 2 | Arrow direction follows where the answer actually is | `ToolScreen.tsx:628` | S |
| 3 | Stop the bar covering the Keep row (reserve its height) | `tools.css:98-111` | S |
| 4 | `rootMargin` for the sticky header | `ToolScreen.tsx:537` | S |
| 5 | Give `.result__row--main` real emphasis | `tools.css` | S |
| 6 | Pin the locale in `expenseEdits.test.ts` | test | S |

All six are app-level: they fix every tool with a `main` row, not just ARR.

### C2 — Next (consistency, still no new data)

| # | Fix | Size |
|---|---|---|
| 7 | `KeepAndShare` → labelled chips, grouped, Reset moved out | S-M |
| 8 | Add Share to lists and notes; one shared copy/share component | M |
| 9 | Calculation sheet: drop Lock, fix the two `edit` icons, rename "Use result" | S |
| 10 | Calculation sheet: add Save to Notes / Add to a list / Add as expense | M |

### C3 — Decide before building

| Question | Why it needs a decision |
|---|---|
| **Accent contrast** (8 failing tests) | `ink-3` and `alert` fail their own contrast rule on all 8 dark tints. Fixing means changing the palette — a design-system change, so it is deliberate, not a patch. |
| **Force `en-IN` dates?** | Or keep following the device locale. Affects 10 call sites. |
| **Budget income** | The biggest content gap; effort M; unlocks "did I save". |

### C4 — Notes rebuild (after C1–C2)

Build the roadmap-approved parts first — `kind: 'text'`, the `+` button, Share, search — then decide on
calculation-aware notes using the critic's verdict recorded below.

---

## Critic verdict — calculation-aware notes

*(Project rule: a suggestion that adds a feature or changes behaviour goes to one critic first.)*

**Verdict: BUILD SMALLER.** Ship the plain text note now; auto-detection is cut.

Items 1, 2, 4 and 5 of the Notes proposal need **no** critic: they are already approved in
`MASTER-ROADMAP.md` Phase 6. Only the auto-evaluation half was new, and it does not survive.

**The decisive objection, verified by running this repo's own engine:**

| Note text a person would really type | What auto-detect would print beside it |
|---|---|
| `Pay by 2-11-2026` | **−2035** |
| `50% off` | **0.5** |
| `Call Amit 3!` | **6** |

Those are real outputs from `evaluateExpression`, not guesses. `CLAUDE.md` says a confidently wrong
number is the one unrecoverable failure. Auto-detect manufactures them from ordinary prose.

**The other objections, checked:**

| Claim | Status |
|---|---|
| A 4th `kind` touches a large branch surface | **Confirmed, smaller than claimed** — 75 sites across 20 files (critic said 96/26). Still the dominant cost. |
| `tokenize` throws on letters, so label-stripping cannot live in `src/engine/` | **Correct.** It would need a new heuristic parser in `src/lib/`, outside the layer that is verified against outside sources. |
| TapeScreen already covers the money case | **Correct.** "rent 25000 + maid 3000" is a two-line tape with a running total today. |

**What to build instead:** `kind: 'text'` (title + body) only. If maths in notes is ever wanted, make
the intent **explicit** — evaluate a line only when it starts with `=`. The user declares it, so there
are zero false positives on dates, percentages or product names; it needs no label-stripping parser;
and the engine is untouched. **Do not build even that until the owner asks for it.**
