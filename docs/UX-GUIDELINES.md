# UI/UX Guidelines — VK Calc

**Status:** v1.0
**Purpose:** The design contract. Every screen gets built against this.

---

## 1. The One-Line Design Brief

> **A calculator so simple your mother could use it, that quietly remembers
> everything you asked it.**

If a design decision makes the app cleverer but slower to use, it loses.

---

## 2. Five Design Principles

| # | Principle | What it means in practice |
|---|---|---|
| 1 | **The keypad is sacred** | The basic calculator opens in <800ms and is never covered, pushed down, or interrupted. No ad, banner, tooltip, rating prompt or upsell is ever allowed to overlap the keypad. |
| 2 | **One screen, one job** | Each calculator asks only for what it needs. No screen has two primary actions. If a screen needs a scroll to find the answer, it's badly designed. |
| 3 | **Show the working** | Every result displays the formula and the numbers that went into it. A finance answer you can't verify is an answer you can't trust. |
| 4 | **Nothing is ever lost** | Every delete is undoable. Every calculation is recoverable. The user should never feel punished for a mis-tap. |
| 5 | **Memory beats features** | Given a choice between a 75th calculator and making saved results more useful, make the saved results more useful. |

---

## 3. What the Market Gets Wrong — Research-Backed

Findings from App Store / Play Store review analysis across the calculator category.

### ❌ Bad practice #1 — Ads over function
Ads are the **single largest complaint** in the category: 26.8% of negative
reviews for the top 10 calculator apps, against a 10.2% baseline across apps
generally. Reviewers specifically describe ads that **cover the buttons**, and
fake "your phone has a virus" ads interrupting calculations.

> **Our rule:** Zero ads. Ever. Not even a "remove ads" button, because that
> implies ads exist. This is the cheapest competitive moat in the category.

### ❌ Bad practice #2 — Destructive delete with no undo
A real review: *"If you accidentally hit the trash bin button all your history
and work is gone."* No confirmation, no recovery.

> **Our rule:** Deleting history or a saved card moves it to a **7-day Trash**.
> A snackbar with **Undo** appears for 6 seconds on every delete. Clearing all
> history requires a typed confirmation.

### ❌ Bad practice #3 — Hiding the running calculation
A real review: *"After an update it doesn't show your additions or subtractions
when you enter more than one number without checking history."* The app made
the user open a separate screen to see what they'd just typed.

> **Our rule:** The full expression is always visible above the result, with a
> live preview of the answer as you type.

### ❌ Bad practice #4 — No backspace
Repeatedly requested: *"the option to backspace instead of starting a
calculation all over."* Apple's own calculator still fails this.

> **Our rule:** Backspace is a permanent, full-size key. Never hidden behind
> a long-press or a swipe.

### ❌ Bad practice #5 — Cramped keys
A banking-app study found moving buttons from 2px apart to 20px apart
**practically eliminated** input errors. Calculator keypads are the densest
grid in consumer software — this is where it matters most.

> **Our rule:** Minimum 56dp key height (above Android's 48dp floor), minimum
> 8dp gap between keys, and the hit area extends into the gap.

### ❌ Bad practice #6 — Feature menus that bury the basics
CalcKit ships 150+ calculators behind a category tree. Breadth becomes a maze.

> **Our rule:** Max 2 taps to any calculator. Search is always one tap away.
> Your 6 most-used calculators self-promote to the home screen automatically.

### ✅ Good practices worth stealing

| From | What | Why it works |
|---|---|---|
| ClevCalc | Live result preview before `=` | Removes a whole interaction step |
| ClevCalc | Indian lakh/crore digit grouping | ₹16,67,226 is instantly readable to an Indian user; 1,667,226 is not |
| Apple Calculator | Ruthless restraint on the main screen | Proves the basic screen needs nothing else |
| Calculator Note | Labelling each line of a running tally | Turns a number into a record |
| Banking apps | Confirm-before-destroy | Trust is built at the moment of risk |
| Google Keep | Everything is undoable via snackbar | Users explore freely when mistakes are cheap |

---

## 4. Design System

### 4.1 Colour

Semantic tokens only — never raw hex in a component. Every token is defined
for light and dark.

| Token | Role | Light | Dark |
|---|---|---|---|
| `bg` | App background | `#F7F8F8` | `#0E1211` |
| `surface` | Cards, sheets, keypad | `#FFFFFF` | `#192220` |
| `surface-alt` | Nested rows, table stripes | `#F0F2F2` | `#222C2A` |
| `text` | Primary text, results | `#101514` | `#F2F5F4` |
| `text-muted` | Labels, hints, units | `#5C6967` | `#9AA8A5` |
| `border` | Dividers, input outlines | `#E2E6E5` | `#2C3836` |
| `accent` | Operators, primary action | `#0E7C66` | `#2EBD9A` |
| `accent-soft` | Accent backgrounds | `#DFF3EE` | `#123A32` |
| `positive` | Gains, savings, "you save" | `#17865A` | `#3DC98C` |
| `negative` | Interest paid, losses, overdue | `#C2453B` | `#F0766B` |
| `warning` | Due soon, estimate caveats | `#B4740C` | `#E5A33C` |

**Accent is user-selectable** (teal default, plus indigo, amber, rose, slate).
Only `accent` and `accent-soft` change — never the semantic colours.

**Contrast rule:** all text meets WCAG AA — 4.5:1 for body, 3:1 for large text.
`positive` and `negative` are never the *only* signal; always paired with a
sign (`+`/`−`) or an icon, for colour-blind users.

### 4.2 Type

| Token | Size / Weight | Used for |
|---|---|---|
| `display` | 48–64dp, 300 | The live result on the calculator |
| `expression` | 24dp, 400 | The expression line above it |
| `title` | 20dp, 600 | Screen titles |
| `body` | 16dp, 400 | Form labels, content |
| `label` | 13dp, 500, +0.3 tracking | Field labels, units, table headers |
| `mono` | 16dp, 500, tabular | **All numbers in tables** |

**Hard rules:**
- Every numeral uses **tabular lining figures** so columns align. A loan
  amortisation table with jittering digits is unreadable.
- The display font-size **auto-shrinks** from 64dp down to 32dp as the number
  grows. It never wraps, never truncates, never shows `1.66e6`.
- Respect the OS font-size setting. Layouts use flexible height, never fixed.

### 4.3 Spacing & Layout

- 4dp base grid. Spacing values: 4, 8, 12, 16, 24, 32, 48.
- Screen gutter: 16dp. Card padding: 16dp. Card radius: 16dp. Key radius: 14dp.
- **Thumb zone:** everything interactive on a primary screen sits in the bottom
  60% of the display. Titles and results go up top; actions go down low.
- Designed for 360dp width first (the most common Android screen), then scaled up.

### 4.4 The Keypad — Specification

```
┌─────────────────────────────────────┐
│                                     │
│                      1,24,500       │  expression  (24dp, muted)
│                      = 1,24,500     │  live result (56dp, text)
│                                     │
│   ⋯        ^        ↶        ⌫      │  utility row
├─────────────────────────────────────┤
│   C    │   ( )  │   %    │   ÷      │
│   7    │   8    │   9    │   ×      │
│   4    │   5    │   6    │   −      │
│   1    │   2    │   3    │   +      │
│   0    │   00   │   .    │   =      │  = is accent-filled
└─────────────────────────────────────┘
```

| Property | Value | Reason |
|---|---|---|
| Key height | 56dp min, grows to fill | Above Android's 48dp floor |
| Key gap | 8dp | Research: wider gaps near-eliminate mis-taps |
| Hit area | Extends 4dp into the gap | Forgiving without visual clutter |
| Press feedback | Scale to 0.96 + 10ms haptic + 60ms colour flash | Three channels: visual, tactile, immediate |
| Long-press `C` | Clear everything (with undo snackbar) | Power action, discoverable via hint |
| Long-press `⌫` | Clear the current line | Common expectation |
| Digit keys | `surface`, `text` | Neutral, highest frequency |
| Operators | `surface`, `accent` text | Scannable without shouting |
| `=` | `accent` fill, white text | The one primary action on the screen |

### 4.5 Motion

| Interaction | Animation | Duration |
|---|---|---|
| Key press | Scale 0.96 | 80ms |
| Result update | Count-up tween on the number | 180ms |
| Screen push | Slide from right | 220ms, ease-out |
| Bottom sheet | Slide up + scrim fade | 240ms |
| Snackbar | Slide up from bottom | 160ms |
| Delete row | Collapse height + fade | 200ms |

Everything respects `prefers-reduced-motion` — motion drops to instant opacity
changes, never removed entirely (users still need the state-change signal).

---

## 5. Interaction Rules

### 5.1 Input
- Numeric fields open the **numeric keypad**, never the full QWERTY.
- Amount fields format **as you type**: typing `150000` shows `1,50,000`.
- Every amount field has a `₹` prefix and quick-chips: `+1K  +10K  +1L`.
- Percentage and tenure fields pair a text input with a **slider** — type for
  precision, drag to explore. Dragging updates the result live.
- Fields have sensible defaults pre-filled. An empty form is a hostile form.

### 5.2 Results
- The headline number is huge and alone. Supporting numbers are secondary.
- Below every result: a **"How this was calculated"** expander showing the
  formula and substituted values.
- Every result screen has exactly three actions: **Save**, **Share**, **Reset**.
- Long tables (amortisation) collapse to yearly by default; expand to monthly.

### 5.3 Errors
- Validate on blur, never on every keystroke.
- Errors appear inline under the field, in words: *"Tenure can't be more than
  30 years"* — never *"Invalid input"*.
- Impossible states are prevented, not reported: you cannot type a tenure of
  500 years because the field caps.
- Division by zero returns *"Can't divide by zero"* in the display, not `NaN`
  or `Infinity`.

### 5.4 Empty states
Never a blank screen. Every empty state has: an illustration or icon, one line
explaining what goes here, and a button that creates the first item.

### 5.5 Destruction (the trust moment)
| Action | Treatment |
|---|---|
| Delete one history row | Swipe → removes instantly + **Undo** snackbar (6s) |
| Delete a saved card | Confirm sheet → moves to Trash (recoverable 7 days) |
| Clear all history | Confirm sheet, requires typing `CLEAR` |
| Trash | Auto-purges after 7 days; "Restore" on every item |

---

## 6. Navigation Architecture

Four tabs. Never more.

```
┌──────────┬──────────┬──────────┬──────────┐
│   Calc   │   Tools  │  Saved   │ Reminders│
│    ▣     │    ⊞     │    ◈     │    ◔     │
└──────────┴──────────┴──────────┴──────────┘
```

| Tab | Contains | Why it's a tab |
|---|---|---|
| **Calc** | The basic/scientific calculator + history drawer | Opens here. 70% of sessions never leave it. |
| **Tools** | All 74 calculators, grouped, searchable, with Favourites pinned on top | Breadth without burying the basics |
| **Saved** | Saved cards, notes, tallies, scenario comparisons | The memory layer — the differentiator |
| **Reminders** | Upcoming and overdue money events | The reason to re-open the app when you weren't calculating |

**Rules:**
- Max 2 taps from launch to any calculator.
- Search (in Tools) matches calculator names *and* synonyms: "home loan",
  "interest", "mortgage" all find the EMI calculator.
- Back always goes back. No screen traps the user.

---

## 7. Accessibility — Non-Negotiable

| Requirement | Standard |
|---|---|
| Touch targets | ≥48dp always; 56dp on the keypad |
| Text contrast | WCAG AA: 4.5:1 body, 3:1 large |
| Font scaling | Honours OS setting up to 200% without breaking layout |
| Screen readers | Every key, field and result has a content label. Results announce on change. |
| Colour independence | Gains/losses carry a sign or icon, never colour alone |
| Motion | Honours reduce-motion |
| One-handed | All primary actions reachable in the bottom 60% |

---

## 8. Copy & Tone

**Plain, short, human. Never jargon when a word will do.**

| ❌ Don't say | ✅ Say |
|---|---|
| "Principal outstanding" | "Loan left to pay" |
| "Tenure: 240 months" | "20 years" |
| "Invalid input" | "Enter an amount above ₹0" |
| "Amortisation schedule" | "Payment plan" *(with the formal term as a subtitle)* |
| "Corpus" | "What you'll have" |
| "Compounded annually" | "Interest added once a year" |

- Numbers in the UI are always formatted: `₹16,67,226`, never `1667226.00`.
- Large numbers get a plain-language echo: `₹1,66,72,260` → *"about 1.67 crore"*.
- Every tax or projection result carries: *"Estimate only — check with your CA."*

---

## 9. Performance Budget

| Metric | Budget | Why |
|---|---|---|
| Cold start to usable keypad | < 800ms | A calculator you wait for is a calculator you don't open |
| Key press to display update | < 16ms (1 frame) | Typing must feel physical |
| Tab switch | < 100ms | Tabs should feel like one screen |
| Bundle size | < 2.5MB initial | Each calculator lazy-loads on first open |
| Works offline | 100% except currency rates | Never show a spinner for arithmetic |

---

## 10. Design Review Checklist

Every screen must pass before it ships:

- [ ] Works at 360dp width, no horizontal scroll
- [ ] Works in light and dark
- [ ] Works at 200% system font size
- [ ] All touch targets ≥48dp
- [ ] Exactly one primary action
- [ ] Every number is tabular-aligned and locale-formatted
- [ ] Every destructive action is undoable
- [ ] Empty state designed
- [ ] Error states written in plain words
- [ ] Primary actions in the bottom 60% of the screen
- [ ] Screen-reader labels on every interactive element
- [ ] No spinner for anything that is pure arithmetic
