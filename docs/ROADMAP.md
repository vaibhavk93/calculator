# Roadmap: everything asked for, and where it stands

**Written:** 2026-11-02. This is the single list of what the owner has asked for across
the whole project, whether it exists, and — where it does not — the honest reason.

Status marks: **Built** = in the code and tested. **Partly** = some of it works.
**Not built** = nothing exists yet.

---

## 1. The full request register

### Setup and build

| Asked for | Built? | If not, why |
|---|---|---|
| Link the folder to the GitHub repo "calculator" | **Built** | — |
| Produce an APK to install on the phone | **Partly** | A debug APK exists but is **stale** — older than the last six commits. Needs `scripts/build-android.sh install` |
| Versioning so P1 → P4 phases can be tracked | **Built** | `0.1.0-P1` in `package.json` + `CHANGELOG.md` |
| Logs so problems and bugs are visible | **Built** | Console-only, dev builds. Never written to storage |
| Full debug traces of calculations | **Built** | Every `computeDisplay` call is traced |
| Android now, iOS later | **Partly** | Both Capacitor platforms are configured; only Android has ever been built |

### The seven-role audit

| Asked for | Built? | If not, why |
|---|---|---|
| Audit as UX / UI / senior dev / EM / PM / product head / CEO | **Built** | `docs/IMPROVEMENT-PLAN.md` |
| Audit of the P1.1 history features (A16–A20) | **Built** | Nobody had reviewed the phone session's specs; done, and it cut A17 |
| A plan to improve each part | **Built** | This file plus `docs/BACKLOG.md` |

### History

| Asked for | Built? | If not, why |
|---|---|---|
| Keep old calculations **off** the calculator's front screen | **Built** | — |
| A dedicated icon that opens the full history | **Built** | Already existed before the request |
| **Name a calculation** in history | **Built** | A named row also survives Clear-all and the 200-row cap |
| Picking a history entry **adds** to what is being typed, never replaces it | **Built** | `1+2+3+` plus a tapped entry gives `1+2+3+(9*9)` |
| History row menu: Copy · Share · Edit · Lock · Delete (A16) | **Not built** | Five tap targets on one 360px row needs a redesign first |
| Lock a row separately from naming it (A17) | **Will not build** | **Dropped deliberately.** Naming already means keeping; a second control for one intent is redundant |
| Edit a past entry's expression and date (A19) | **Not built** | Editing the *date* of a past calculation makes the record falsifiable. Only the name is editable |
| Share one history row as text (A20) | **Not built** | Small and wanted; simply not reached yet |

### Look and feel

| Asked for | Built? | If not, why |
|---|---|---|
| **Red and green** to show good and bad | **Built** | Rule changed in `DESIGN-SYSTEM.md` deliberately. Only where good/bad is unambiguous; never colour alone |
| Remove the clutter / wasted space | **Partly** | The calculator's empty third is fixed (keys grew). Other screens untouched |
| **Headers are not highlighted; two sections do not look separate** | **Built** | Every list is now titled sections on tinted cards (Tools groups, Notes, Due), with a count on each heading. Eight section colours, chosen clear of red, green and the accent, and never used on a result (DESIGN-SYSTEM "Section colours"). Seen in dark and light |
| **The same design is used for different things** | **Built** | A calculator's inputs sit on a tinted card headed "What you are working out"; the result is a plain card headed "Result". An input no longer looks like an answer |
| Step-by-step flow is hard to follow | **Partly** | The two cards above fix the main cause. A guided step-by-step mode for the long forms (income tax) is not built |
| **An accordion with no sign that it opens** | **Not built** | Cause found: `display: flex` on `<summary>` removes the browser's own disclosure triangle |
| Rethink the design from scratch | **Not built** | A full redesign would throw away a working design system. Fixing the four rows above addresses the real complaints |
| Light theme and 200% font checked | **Partly** | **200% font: Built and checked** (all 51 calculators and 25 app pages, the sweep found and fixed the overflow bugs). Light theme: Tools and Notes seen; the full light sweep is not done |
| **Multi-colour cards so sections are easy to tell apart** | **Built** | Eight tints; hues kept out of red, green and the accent, enforced by test |
| **No horizontal scrolling** unless there is no other way | **Built** | A table of three or more columns is drawn as one block per row (heading, then labelled values). Measured: no scrolling box anywhere in the repayment schedule. Two-column tables stay tables |
| **Sort the categories properly** (Convert mixed units, currency, binary/hex) | **Built** | "Convert" is gone. Currency is under Money, binary/hex under Math and numbers, units under Units and travel. 8 groups, each split into 2 to 4 titled sections (Loans: Plan a loan, Change a loan, Special cases) |
| **The calculator layout must not shift** to show To list / Remind me | **Built** | The action row is always in the layout at a fixed height. Measured: key, button-row and answer positions identical before and after "=" |
| **Pin / unpin icons on Notes** | **Built** | A pushpin: outline when loose, filled and accent-coloured when pinned. Notes are grouped Pinned, Lists, Calculations |
| Research how to handle long sectioned lists | **Done** | Apple's inset grouped style (one wash around a section, heading to last row); one card per row for tables on a phone (works when rows are read one at a time, not compared) |
| **A thorough UI audit of every page of every tool and the whole app**; find and fix bugs | **Built** | 76 pages checked by a scripted sweep at normal and 200% font; 10 kinds of bug fixed (`docs/UX-AUDIT.md` section 5). The sweep is saved as `e2e/audit-harness.js` |
| **Guidelines for the page header, back, save, the information on a page, the result, the edit and the sharing sections** | **Built** | `docs/DESIGN-SYSTEM.md` section 14, "Page anatomy"; one shared `ScreenHeader`, enforced by a test |
| **An information-sharing section** | **Built** | "Keep and share": Copy, Share (the phone's share sheet), To list, Remind me. The shared text carries the title, what was typed, the answers and the note |
| **World time should look like a clock** | **Not built** | Still a table that does not tick. A redesign, listed above |

### Calculators that present themselves badly

| Asked for | Built? | If not, why |
|---|---|---|
| **World time should look like a clock**, with a globe or map, and popular cities | **Not built** | It renders 20+ cities today, but as a *spreadsheet*. The time is also **frozen** — it never ticks |
| **A date result must not be saved as rupees** | **Not built** | Cause found: every numeric result is stored as `amount` and rendered with `'money'`. 300 days shows as ₹300 |
| Saving from the date calculator should keep a **date and time**, not a number | **Not built** | Needs a unit on the saved value, which is the same fix as the row above |

### Memory, notes and money

| Asked for | Built? | If not, why |
|---|---|---|
| **Label a calculation** and assign it to a thing (credit card, travel, rent) | **Not built** | Planned next. The `memo` field already shipped is the foundation |
| **Budget tracker** with pre-filled and user-made categories | **Planned** | See §3. The owner has asked for it; the risk is written down there honestly |
| Notes should be multipurpose | **Not built** | "Multipurpose" has not been pinned down yet — needs one worked example |
| Actions on History rows (To list, Remind me) | **Not built** | Only results and tool answers have them |

### Platform and data

| Asked for | Built? | If not, why |
|---|---|---|
| **Why is the alarm / reminder permission blocked?** | **Fixed 2026-11-02** | It was removed on purpose in the manifest, so Android showed no switch. Now declared again; Settings, Reminders shows both permissions with a button that opens the right Android screen. Needs a real-phone check |
| Make reminders fire exactly | **Not built** | Needs a deliberate trade-off: Play restricts exact alarms to real alarm apps. Prove delivery first |
| **Currency rates from the web** | **Partly** | The source is already known and used: **Frankfurter** (`api.frankfurter.dev`, ECB rates). Only the bundled snapshot exists; the live fetch is not written |
| **Test every feature end to end** (positive, negative, error) | **Not built** | `e2e/smoke.mjs` is **stale** — it taps buttons that no longer exist. The harness must be repaired before it can test anything |

---

## 2. What is actually wrong, in priority order

Three findings share one cause, which is why one job fixes all of them.

```
            "Headers aren't clear"   "Same design for
                      |               different things"
                      |                      |
                      +----------+-----------+
                                 |
                   AN INPUT LOOKS LIKE AN OUTPUT
              label left · value right · hairline under
                                 |
                 +---------------+---------------+
                 v                               v
        You cannot tell what              No section ever
        you are allowed to change         announces itself
```

| # | Fix | Repairs |
|---|---|---|
| 1 | Inputs look clearly editable; results clearly not | "Same design", "step by step", half of "headers" |
| 2 | Real section headers on Tools and inside every calculator | "Headers", "two sections not separate" |
| 3 | A unit on every saved value | Date saved as ₹300; BMI as ₹24.50 |
| 4 | Restore the disclosure arrow on "How this is worked out" | The invisible accordion |
| 5 | Rebuild the stale APK | Nothing above can be judged on the phone otherwise |

---

## 3. Making results *look* like what they are

The complaint under World time is general: **this app draws everything as a table, whatever it is.**
A time is not a row. A share of a total is not a row. A date range is not a row.

| Result is really a… | Drawn today | Should be |
|---|---|---|
| Time in a place | table row | A **clock face**, live and ticking, with the city under it |
| Several cities' times | table | A **list of clocks**, home pinned at the top |
| A share of a total (interest vs principal, tax vs income) | two rows | One **bar**, split and labelled |
| Money over years (SIP, EMI, PPF) | table of 240 rows | A **line**, with the table underneath for whoever wants it |
| A date difference | a number | A **span**: start date → end date, with the count between |
| Over / under a budget | — | A **bar against a limit** |

**Rule to hold on to:** a picture replaces a number only when it shows something the
number cannot — a proportion, a trend, a passage of time. It never replaces the number
itself, which must always still be readable and copyable.

**Order to build them in:** clock (fixes a named complaint) → split bar (reusable across
loans, tax, investments) → line chart (the heaviest, and no chart library is wired in yet).

---

## 4. Budget tracker

**The owner has asked for this, so it is on the roadmap.** The risk is recorded here rather
than argued about again later.

**The risk, from the owner's own earlier work** (`Financial Advisor/product-planning/13-master-feature-universe.md`):

> Budgeting is a *behaviour-change* product (YNAB's business). Done badly it is abandoned
> in week two. It also needs a trustworthy record first.

That applies harder here: **this app never sees a real transaction.** It has numbers that were
typed into it. So the honest version is built in two steps, and the second only happens if the
first earns it.

### Step 1 — Categories and totals (safe, useful on its own)

- Pre-filled categories: Credit card, Rent, Travel, Food, Bills, Tax, Savings — plus any the owner adds
- Two levels, parent and child, borrowed from the MoneyMap data model
- Deleting a category is **soft** and never silently re-files what was in it
- Uncategorised is **shown**, never quietly dropped
- One tap from a result: "Save to Travel"
- A total per category: *"Travel · ₹48,200 across 6 calculations"*

Labelled honestly as **what you calculated** — never as what you spent.

### Step 2 — A real budget (only if step 1 gets used)

A monthly limit per category, a bar showing how much is used, and a warning before it is
passed. This needs numbers that reflect reality, which means either entering spending by
hand (which people abandon) or reading it automatically (which this app does not do).

**The gate:** if the owner uses categories for a month without being asked to, step 2 is
worth building. If not, step 2 would have failed exactly as the earlier analysis predicted,
and the cost of finding out was one small feature instead of a rewrite.

### What the app already has toward it, and what the research found

Everything below was already in the project. Nothing here is new research; it is gathered in one place.

| Found | Where | What it gives the budget tracker |
|---|---|---|
| Budgeting is a behaviour-change product (YNAB's business), abandoned in week two, and needs a trustworthy record first | The owner's `Financial Advisor/product-planning/13-master-feature-universe.md` | **The gate above stays.** Step 2 is earned, not assumed |
| Two-level categories, soft delete, uncategorised shown | The owner's MoneyMap data model (same planning folder) | The shape of step 1 |
| **Eight ready-made tags already exist**: Credit Card, Loan, Rent, Investment, Tax, Travel, Work, Shopping (plus your own) | `DEFAULT_TAGS` in `src/lib/memory.ts`; the tag chips on Notes | **Tags are the seed of categories.** Step 1 can promote them: a per-tag total, not a new system |
| Lists with exact totals, checkboxes, "left" amounts | `TapeScreen`, `listProgress` | Trip budget and monthly card spends are already a list |
| Every saved card keeps an amount (and a unit) | `SavedCard.amount`, `amountFmt` | The number a category total adds up |
| A 30-day total of what is due, recurring reminders, Mark paid history | Due tab | The "bills this month" half of a budget |
| Use cases the owner named | `docs/MEMORY-LAYER.md` A1 credit card bill, C1 monthly card spends, C2 trip budget, C4 flatmate split, C6 renovation budget, D2 80C shortfall | The first categories and the first screens |
| "A bar against a limit" for over or under a budget | §3 above | The picture for step 2 |

**The smallest first slice (all of step 1's value, none of step 2's risk):**

1. Show a **total per tag** on Notes ("Travel · ₹48,200 across 6 notes"), labelled as *what you saved*, not what you spent.
2. **Tag from the result**: one tap from "To list" or "Remind me" to put it under a category.
3. A **Categories** view: the ready-made tags plus your own, two levels (parent and child), delete is soft, Uncategorised is shown.

Only after a month of use without being asked: a monthly limit per category and a bar. That is step 2 and it keeps its gate.

---

## 5. Build order

| Stage | Contents | Why here |
|---|---|---|
| **A — Make it readable** | Inputs vs outputs · section headers · accordion arrow · units on saved values | **Done 2026-11-02** (sections, tinted cards, row blocks, stable layout, pin icons). Still to judge on the phone |
| **B — Put it on the phone** | Rebuild the APK, install, walk the checklist | Nothing above is proven until it is on the device |
| **C — Draw the right picture** | World clock · split bar · date span | Turns named complaints into something better than a table |
| **D — Label it** | Categories, one-tap assign, per-category totals | The budget question, answered safely |
| **E — Prove the promises** | Repair `e2e/smoke.mjs`, then the real end-to-end pass · reminder delivery test · live currency fetch | Each needs a working harness or a real device |
| **F — Earned, not assumed** | Real budgets with limits · history row menu · share a row · exact alarms | Only after the evidence from A–E |

---

## 6. Two things that never arrived

- **`Financial Advisor 2.0/` is an empty folder.** The real planning lives in
  `Financial Advisor/` and was read from there.
- **The screenshots of other apps were never found** — not on the Desktop, in Downloads,
  or in this repo. The labelling design in §4 was written without them. If they exist,
  the design should be revisited against them.
