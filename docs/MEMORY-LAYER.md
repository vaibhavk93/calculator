# The Memory Layer — Notes, Reminders & Saved Calculations

**Status:** v1.0
**This is the differentiator.** Everything else in the app is table stakes.

---

## 1. The Insight

Every calculator app on both stores is **stateless**. You calculate, you get a
number, the number dies. Open the app tomorrow and it has forgotten you exist.

But **no one calculates for fun.** Every calculation is about something real:
a bill that's due, a purchase you're deciding on, a goal you're planning
toward. The number is never the point — the *decision* is the point.

> **The product idea: capture the intent behind the number, and give it back
> to the user at the moment they need it.**

### Why this matters commercially

Utility apps have a structural problem: high install counts, terrible
retention, no reason to re-open. Calculator apps are the purest example —
opened in a specific moment, then forgotten.

Reminders invert this. A reminder is **the app opening you**, instead of you
opening the app. It converts a stateless utility into a habit.

### Market validation

| Capability | Apps that have it |
|---|---|
| Calculator + history | Dozens |
| Calculator + notes/labels | ~6 (Calculator Note, Calculator Plus, MonoTape, Smart Notes) |
| Calculator + notes + **reminders** | **Zero found on either store** |

A 2026 comparison of calculator-with-notes apps found **no app combining
notes, reminders and labelled expenses**. Users currently have to leave the
app and set a reminder somewhere else — which means they mostly don't.

---

## 2. The Loop

```
   ┌──────────────┐
   │  1. CALCULATE│   "18,450 + 7,200 + 32,000"
   └──────┬───────┘
          │  one tap: Save
          ▼
   ┌──────────────┐
   │  2. REMEMBER │   Title: "HDFC card — November"
   │              │   Tag: Credit Card · Note: "incl. flight booking"
   └──────┬───────┘
          │  one tap: Remind me
          ▼
   ┌──────────────┐
   │  3. ACT      │   "HDFC card ₹57,650 due in 3 days"
   │              │   [Mark paid] [Snooze] [Open]
   └──────┬───────┘
          │  Mark paid → rolls to next month
          └──────────► back to 1
```

**The entire loop is three taps.** If saving a calculation takes more effort
than re-doing it, nobody saves anything.

---

## 3. Use Cases — Researched & Designed For

### Group A — Money that is due (reminder-led)

| # | Use case | The calculation | The reminder |
|---|---|---|---|
| A1 | **Credit card bill** *(your example)* | Tally up spends across the month | 3 days before due date, recurring monthly |
| A2 | **Loan EMI** | EMI calculator result | Every month on the debit date |
| A3 | **Rent + utilities** | Rent + electricity + water + internet | Monthly, 2 days before |
| A4 | **Insurance premium** | Premium + GST | Annually, 2 weeks before lapse |
| A5 | **Advance tax** | Advance tax calculator | 15 Jun / 15 Sep / 15 Dec / 15 Mar, auto-set |
| A6 | **FD maturity** | FD calculator maturity date | On maturity: "reinvest or withdraw?" |
| A7 | **Subscription renewals** | Annual cost tally | 3 days before auto-debit |
| A8 | **School / course fees** | Fee + transport + books | Per term |

### Group B — Decisions parked for later (comparison-led)

| # | Use case | What gets saved |
|---|---|---|
| B1 | **Which loan offer?** | 2–3 EMI scenarios side by side, with the winner flagged |
| B2 | **Is this deal actually good?** | Unit-price comparison of 3 pack sizes, saved while standing in the shop |
| B3 | **Prepay the loan or invest the bonus?** | Prepayment interest-saved vs SIP returns, same horizon |
| B4 | **Old regime or new regime?** | Tax comparison, saved each FY for year-on-year reference |
| B5 | **Job offer comparison** | In-hand salary from 2–3 CTCs |
| B6 | **Rent vs buy** | EMI + maintenance vs rent + invested down payment |

### Group C — Running tallies (tape-led)

| # | Use case | Behaviour |
|---|---|---|
| C1 | **Monthly credit card spends** | Labelled line items that total live; add to it all month |
| C2 | **Trip budget** | "Flights 24,000 · Hotel 18,500 · Food 9,000" — running total |
| C3 | **Grocery / shopping list** | Add as you put things in the trolley; see the total before the till |
| C4 | **Flatmate split** | Shared expenses with who-paid-what, settles at month end |
| C5 | **Freelance invoice** | Line items + GST, exported as a shareable total |
| C6 | **Renovation / project budget** | Quotes from multiple vendors, tallied by category |

### Group D — Annual rituals (recurring-led)

| # | Use case | Trigger |
|---|---|---|
| D1 | **Step up your SIP** | Every April: "increase SIP by 10%?" with the new amount pre-calculated |
| D2 | **80C shortfall** | Every February: "you're ₹40,000 short of 80C — invest by 31 March" |
| D3 | **Salary hike re-plan** | On appraisal month: recompute in-hand and savings rate |
| D4 | **Credit card fee break-even** | 1 month before the annual fee hits: "did you earn back the ₹2,500?" |
| D5 | **Policy / rent agreement renewal** | 30 days before expiry |

---

## 4. Features

### 4.1 Save anything
- A **Save** button on every single result screen in the app — basic
  calculator, EMI, SIP, tax, everything.
- Saving opens a lightweight sheet: **Title** (auto-suggested), optional
  **Note**, optional **Tag**, optional **Reminder**. Everything but the title
  is skippable. Default path is: tap Save → tap Done. Two taps.
- The saved card keeps the **live inputs**, not just the answer. Reopening a
  saved EMI card restores the form so you can tweak and recalculate.

> **History is the seed of this layer (P1.1).** A locked history row with a memo is a
> lightweight Saved Card. It must not become a second mechanism. Field mapping, so P6 promotes
> rather than rebuilds: `memo` → `title`, `expression` + `result` → `inputs` + `result`,
> `at` → `createdAt`, `locked` → "kept". In P6, **Save** on a locked row converts it in place
> and the row leaves history.

### 4.2 Tape mode (running tally)
- A mode on the main calculator where each `=` becomes a **line item**.
- Each line can be given a label by typing it, inline: `Flights 24000`.
- Lines are individually editable and deletable; the total recalculates.
- A tape can be named, saved, and added to later — it stays open for days.
- Export a tape as text, image or PDF.

### 4.3 Notes
- Free-text note on any saved card.
- Notes are searchable.
- A note can hold a photo (a receipt, a bill, a quote) — stored on-device.

### 4.4 Reminders
- Attach to any saved card: **one-time** (a date) or **recurring**
  (monthly / quarterly / yearly / custom).
- Delivered as a **local notification** — no server, no account, works offline.
- Notification shows the amount and the title, with actions directly on it:
  **Mark paid** · **Snooze 1 day** · **Open**.
- **Mark paid** on a recurring reminder auto-advances it to the next cycle and
  logs the payment to that card's history.
- A **Reminders tab** shows Overdue (red) → Due this week → Upcoming.

### 4.5 Smart suggestions — the magic moment
The app offers the next step *without being asked*, based on what was just
calculated:

| After the user calculates... | The app quietly offers |
|---|---|
| An EMI | "Remind me every month on the 5th" |
| A credit card total | "Set a payment reminder" |
| An FD maturity | "Remind me on the maturity date" |
| Advance tax | "Add all four quarterly due dates" |
| A SIP | "Remind me every April to step this up" |
| 80C deductions with a gap | "Remind me in February to invest the shortfall" |
| The same calculation 3 times in a month | "Save this as a recurring tally?" |

These appear as a **single dismissible chip** below the result. Never a modal,
never a blocking dialog. If dismissed twice for a given type, stop offering it.

### 4.6 Organisation
- **Tags**, with sensible pre-made ones: Credit Card, Loan, Rent, Investment,
  Tax, Travel, Work, Shopping. Users can add their own.
- **Pin** up to 5 cards to the top of Saved.
- **Search** across titles, notes, tags and amounts.
- **Filter** Saved by tag, by date, by "has reminder".

### 4.6b Categories, subcategories and payment mode (G13–G17)

**Recommendation: tag tape lines. Do not build a budget app.** A full expense tracker is a
different product with strong incumbents. The tape already holds labelled line items, so adding
*what kind* and *how paid* to each line gives 95% of the value (answering "where did it go?" and
"what is on my HDFC card?") for a fraction of the build, and it stays inside the three-tap loop.

| Tier | Contents |
|---|---|
| **MVP (P6)** | Category → subcategory on each tape line, payment mode on each line, last-used defaults, totals by category and by mode for a period |
| **Production-ready** | Edit the category list, move entries when a subcategory is removed, instrument names, include in backup and PDF/text export |
| **Long-term** | Category budgets with "left / over" (G17), recurring spends from reminders, CSV export |

**Why payment mode matters more than it looks.** It is the grouping key for the credit-card
bill (use case A1): every line whose payment mode has `type = credit` and `instrumentId` = HDFC Regalia, in a statement
month sums to "HDFC card, November", and that total becomes the reminder amount. This is the
link between spending and the differentiator.

**Seed list** (data in `config/categories.json`, not code; editable by the user):

| Category | Subcategories |
|---|---|
| Food | Groceries · Eating out · Delivery · Snacks & chai · Office lunch |
| Transport | Fuel · Cab & auto · Metro & bus · Parking & tolls · Vehicle service |
| Home & bills | Rent · Electricity · Water & gas · Mobile & internet · Maintenance |
| Shopping | Clothes · Electronics · Household · Gifts |
| Health | Doctor · Medicines · Insurance premium · Fitness |
| Travel | Flights & trains · Stay · Local |
| Entertainment | Subscriptions · Movies & events · Games |
| Education | Fees · Books & courses |
| Money | EMI · Investments · Taxes & fees |
| Other | (none) |

**Rules**

| Rule | Why |
|---|---|
| Two levels, never deeper | Deeper trees make entry slower and reports sparser |
| Category and mode are always optional | If a tag is mandatory, people stop logging |
| Defaults come from the last line with the same label | Typing "Swiggy" should be enough |
| "Delete" a category means hide it. If lines use it, ask where to move them. | Old totals must not change under the user |
| One payment, two categories = two lines | Keeps every line single-category and the sums exact |
| A refund is a negative line, shown with its sign | No separate refund type to build |
| ATM withdrawals and transfers are not spend. Not modelled in V1. | Avoids double counting |

**Risks:** entry friction (the main one: measure taps per entry), category drift
(Eating out vs Delivery), and scope creep toward budgets and charts before the tag habit is proven.
PDF/CSV export is a free feature here but a Pro feature in `GTM-STRATEGY.md`; decide before launch.

**Dependency:** needs Save and Tape (G1, G2), so it ships inside P6. It must not be built as a
separate expense table beforehand: that would duplicate `SavedCard` and `TapeLine`.

### 4.6c Add your own, then pick instead of typing (G18, G19)

**Recommendation: one mechanism for every list.** Categories, subcategories, payment modes and
instruments are all the same two-level `ListItem`, managed by one screen and chosen with one
picker. Tags (G8) can reuse it later. Building it once is cheaper than building four editors.

**Payment methods are two levels too.** The *mode* is the kind of payment; the *instrument* is
your specific card or account under it.

| Mode (seeded, or add your own) | Instruments you add, for example |
|---|---|
| Cash | none |
| UPI | GPay · PhonePe · Paytm |
| Credit card | HDFC Regalia · Amex MRCC |
| Debit card | SBI debit · ICICI debit |
| Net banking | HDFC · SBI |
| Wallet | Paytm wallet · Amazon Pay |

A mode you create (Cheque, Gift card) gets `type = other`. When adding one the app asks one
question: "Is this a credit card?" Only `credit` modes roll up into a bill total and offer a bill
reminder. Seeded modes carry their type already.

**The picker** (a bottom sheet in portrait, the right-hand side panel in landscape):

| Behaviour | Why |
|---|---|
| Opens on tap of the field. A native dropdown (`<select>`) is not used. | It cannot show recents, filter, nest two levels, or add an item in place |
| Recents first, then the full list, hidden items excluded | The item you want is usually one of your last few |
| Typing filters the list. It never becomes the saved value. | Entries store ids, so "Food" and "food" can never become two things |
| A last row, `Add "xyz"`, creates the item and selects it | Adding must not take you out of the entry |
| Subcategory is disabled until a category is chosen, then shows only that category's children | Prevents mismatched pairs |
| Instrument works the same way under the chosen mode | Same reason |
| Each option is a 44px row; screen readers hear "Eating out, 2 of 5" | Accessibility rules apply to pickers too |

**Manage lists screen** (Settings → Categories & payment methods): hairline rows, tap to rename,
a toggle to hide, an Add row at the foot of each group. "Restore defaults" brings back seeded
items you hid and never overwrites or removes anything you added or renamed.

**Rules**

| Rule | Why |
|---|---|
| Names are trimmed and compared case-insensitively. Adding an existing name selects it instead. | Stops "Groceries" / "groceries " duplicates at the door |
| Renaming changes the name everywhere, because lines point at ids | Old reports stay correct |
| Hiding an item that lines use is allowed; they keep showing its name | Totals must not change under you |
| Moving lines to another item, and merging two items, are long-term | Needed eventually, but not for a first version |
| Manual reordering is long-term; recency ordering is the default | Recents already put the right item first |
| Cards store a nickname and optional last four digits, never a full number | The app holds no payment secrets, so it has none to leak |
| Both lists are included in backup and restore, with a migration and fixture test | A restored backup must bring its categories with it |

**Build tiers.** *MVP (P6):* manage screen with add / rename / hide, the picker with recents and
inline add, seeded lists. *Production-ready:* restore defaults, the credit-type question, last four
digits, instrument-level totals. *Long-term:* merge, move, manual order, per-card statement and due
day to pre-fill bill reminders.

**Verification:** adding a duplicate selects the existing item; rename shows on old entries; hiding
an in-use item leaves old lines intact; inline add returns to the entry with the new item selected;
the picker works by keyboard and at 200% font, portrait and landscape; backup → wipe → restore
round-trips both lists.

**Risk to watch:** list sprawl. If the average user ends up with 30 categories, picking gets slower
than typing, which defeats the point. Recents-first and filter-as-you-type are the mitigation; measure
taps per entry before adding anything more.

### 4.7 Safety — directly answering the category's worst flaw
| Action | Behaviour |
|---|---|
| Swipe-delete a history row | Deletes + **Undo** snackbar for 6 seconds |
| Delete a saved card | → **Trash**, recoverable for 7 days |
| Delete a reminder | → Trash, and the parent card survives |
| Clear all history | Confirm sheet requiring the user to type `CLEAR` |
| Uninstall-proofing | One-tap export of everything to a JSON file |

### 4.8 Home-screen widgets
Widgets are the single best retention mechanism for a utility app — the app
stays visible without being opened.

| Widget | Size | Shows |
|---|---|---|
| Quick calculator | 4×2 | A working mini keypad, no app launch needed |
| Next due | 2×2 | The nearest reminder: amount, title, days left |
| Tape total | 2×2 | The running total of your active tally |

---

## 5. Data Model

Deliberately simple and portable — this is the schema that outlives any
framework choice.

```
SavedCard
├── id                  uuid
├── title               string          "HDFC card — November"
├── calculatorType      enum            "basic" | "emi" | "sip" | "tax" | ...
├── inputs              json            the full form state, for re-opening
├── result              json            headline value + supporting values
├── note                string?
├── photoRef            string?         local file path
├── tags                string[]
├── pinned              boolean
├── createdAt           timestamp
├── updatedAt           timestamp
└── deletedAt           timestamp?      soft delete → Trash

Reminder
├── id                  uuid
├── cardId              uuid → SavedCard
├── dueAt               timestamp
├── repeat              enum?           monthly | quarterly | yearly | custom
├── leadDays            int             notify N days before (default 3)
├── status              enum            pending | done | snoozed | dismissed
└── history             [{ paidAt, amount }]

TapeLine
├── id                  uuid
├── tapeId              uuid → SavedCard (type: "tape")
├── label               string?         "Flights"
├── expression          string          "24000"
├── value               decimal
├── spentAt             timestamp       the date of the spend, editable
├── categoryId          uuid? → ListItem (kind: category, top level)
├── subcategoryId       uuid? → ListItem (kind: category, child of categoryId)
├── paymentModeId       uuid? → ListItem (kind: payment, top level)    "Credit card"
├── instrumentId        uuid? → ListItem (kind: payment, child of paymentModeId)   "HDFC Regalia"
└── order               int

ListItem                                 (one shape for every user-managed list)
├── id                  uuid            stable: renames never break old lines
├── kind                enum            category | payment      (tags can join later)
├── name                string          ≤ 30 chars, trimmed
├── parentId            uuid?           null = top level. Two levels maximum.
├── type                enum?           payment modes only: cash | upi | credit | debit |
│                                       netbanking | wallet | other. Only "credit" rolls
│                                       up into a card bill.
├── lastFour            string?         instruments only, optional, 4 digits. Never a full number.
├── hidden              boolean         "delete" = hide, so history stays intact
├── seeded              boolean         came from config/*.json rather than the user
├── lastUsedAt          timestamp?      drives "recents first" in the picker
└── order               int
```

**Why this shape matters for scalability:**
- `inputs` as a JSON blob means **adding a new calculator never changes the
  schema**. Calculator #75 saves and reloads with zero migration.
- `SavedCard` is the single universal container — a basic calculation, an EMI
  scenario and a running tape are all the same record type. One list view, one
  search, one sync path.
- Soft deletes (`deletedAt`) give Trash and undo for free.
- Nothing here is coupled to React, Capacitor, or any UI technology. If the app
  is ever rebuilt in Flutter or on the web, **this schema ports unchanged.**

---

## 6. Privacy Position

This data is a map of the user's financial life. That deserves an explicit
stance, and it's also a marketing asset.

| Rule | Implementation |
|---|---|
| Everything stays on the device | Local storage only. No account required, ever. |
| No analytics, no telemetry | Nothing is transmitted. Zero third-party SDKs. |
| The only network call | Currency exchange rates. Nothing else leaves the phone. |
| Optional cloud sync (later) | End-to-end encrypted, opt-in, off by default |
| Honest permissions | Only notifications (for reminders) and optional camera (for receipt photos) |

**Store listing line:** *"Your money stays on your phone. We don't have an
account system, because we don't want your data."*
