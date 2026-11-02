# UI/UX Guidelines — VK Calc

**Status:** v1.1
**Purpose:** Interaction, copy, accessibility and behaviour rules.

> ⚠️ **Sections 4 (Design System) and the colour/type rules here are superseded
> by [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) v2.** The v1 palette (teal on white)
> and type choices were generic; v2 documents why and what replaced them. The
> interaction, copy, accessibility and research sections below still stand.

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
│  Paste     Copy      ↶        ⌫      │  utility row
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
| Operators | No fill, 1px `ink-3` border, `ink-2` text | Reads as an action, not a value (see DS 9) |
| `=` | `accent` fill, white text | The one primary action on the screen |

### 4.5 Motion

| Interaction | Animation | Duration |
|---|---|---|
| Key press | Scale 0.96 | 80ms |
| Result update | Opacity crossfade, no counting animation | 140ms |
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
- Every amount field has a `₹` prefix. *(Quick-chips `+1K +10K +1L` are not built yet.)*
- Percentage and tenure fields pair a text input with a **slider**. *(Sliders are not built yet.)*
- Fields have sensible defaults pre-filled. An empty form is a hostile form.

### 5.2 Results
- The headline number is huge and alone. Supporting numbers are secondary.
- Below every result: a **"How this was calculated"** expander showing the
  formula and substituted values.
- Every result has **Save** and **To list**. Share and Reset are not built yet.
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
│ Calculate│  Tools   │  Notes   │   Due    │
│    ▣     │    ⊞     │    ◈     │    ◔     │
└──────────┴──────────┴──────────┴──────────┘
```

| Tab | Contains | Why it's a tab |
|---|---|---|
| **Calculate** | The basic calculator + history sheet (Scientific lives at the top of Tools) | Opens here. 70% of sessions never leave it. |
| **Tools** | All 51 calculators in 9 groups, searchable | Breadth without burying the basics |
| **Notes** | Notes, lists with checkboxes, calculator cards | The memory layer — the differentiator |
| **Due** | Upcoming and overdue money events | The reason to re-open the app when you weren't calculating |

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


---

## 11. Vocabulary: one name per thing

*Added 2026-11-02. The owner calls saved things "notes", so the tab is Notes.*

| Use | Avoid | Meaning |
|---|---|---|
| **Calculate**, **Tools**, **Notes**, **Due** | Saved, Reminders (as tab names) | The four tabs |
| **List** | tape, tally, card | A set of lines with a total, optionally with checkboxes |
| **Calculator** | tool, widget | One of the 51 under Tools |
| **To list** | split, export | Send a number to a list, as one line or several |
| **Remind me** | schedule, alert | Attach a reminder |
| **Done** | paid (in the interface), complete | A ticked line. "Paid" may appear in a person's own list names |

Internal ids (`saved`, `tape`) may differ. Only the words a person reads follow this table.

## 12. Navigation rules

| Rule | Detail |
|---|---|
| Tap the tab you are on | Returns that tab to its start (Tools to the top; Notes and Due close any open item) |
| Android back | Closes Settings or History first, then goes up one level on the current screen, then goes to Calculate, then leaves the app |
| Depth | Tools is at most three deep: home, a group, a calculator |
| Every screen with a "back" | Registers `useBackHandler`. No screen traps the user |
| Opens on | Any tab, or any single calculator |
| Keep my work | Values typed in a calculator survive a trip to another tab for the session |
| Tab bar | Always visible, never hidden by a full-screen view |
| Hard to reach | Primary actions in the top bar are duplicated near the result where it matters (To list in the answer bar) |

## 13. Acting on a number

Any finished number can become something in **one visible step**.

| Where | What is offered | How |
|---|---|---|
| After "=" on the calculator | **To list**, **Remind me** | Two chips under the answer, only after "=" |
| A calculator's answer | **To list** | A quiet action in the sticky bar |
| A History row | To list, Remind me | *(Planned)* |

- "To list" opens one sheet: how many lines (a stepper), a name for the lines, which list (new or existing), and a tick for
  "tick lines off as they are paid" (on by default when there is more than one line). The sheet shows the sum:
  "5 lines of ₹1,000.00 = ₹5,000.00".
- "Remind me" saves the number as a one-line list with a reminder switched on.
- Copy stays where it is, because it is the most common action.
- Never a blocking dialog. Never more than two chips.
- Why "To list" and not "Split": by the time the sheet opens, the number has already been divided. The job is to give each
  person a line.

## 14. Lists and checklists

- A list is lines of `label amount`. Typing "Flights 24000" adds a line. A tap on a line edits it.
- A **checklist** is the same list with checkboxes. Turn them on or off with "Show checkboxes" and "Hide checkboxes".
- A list made by sharing a number across several lines starts as a checklist.
- Totals are exact. Three lines of 100 ÷ 3 add back to exactly 100, because amounts keep full precision and only the display rounds.
- The header shows progress: "2 of 5 done · ₹3,000.00 left", with the collected amount large.
- **Copy as text** includes ✔ or ☐ per line and "Collected X of Y", so it can go straight into a group chat.
- A reminder belongs to the **list**, not to a number: "remind me Friday" is about the people who have not paid.
- A deleted list goes to Trash for 7 days with Undo.

## 15. The calculator display

| Moment | What shows |
|---|---|
| Typing | The expression, and a **dimmed** live answer with no "=" |
| After "=" | "23 × 36 =" and the answer at full strength: "=" commits it |
| "=" pressed again | Nothing changes. No duplicate history entry |
| Next digit | A new calculation starts. The finished one is in History |
| Next operator | Continues from the answer |
| "C" | Clears the current line only |
| Earlier calculations | **Never shown while you work.** They are in History (the clock icon) and appear only when you open it |

The answer announces itself to screen readers only when it is committed.

## 16. The feedback ladder

Use the lightest feedback that is honest.

| Level | Used for | Example |
|---|---|---|
| Haptic | Every key press | 10ms tick |
| Inline notice (2.2s, under the answer) | Small confirmations and soft errors | "Copied", "Added 3 lines" |
| Snackbar with **Undo** (6s) | Anything removed | "Moved to Trash. Undo" |
| Snackbar | A save | "Saved. Undo" *(planned)* |
| Confirmation sheet | What cannot be undone | Clear all history (type CLEAR) |

Errors say what to do. Silent failure is the worst case: if something might not have worked (a reminder on a phone that
kills background apps), give the person a way to test it.

## 17. Clipboard

- On the phone, use the native clipboard plugin. In a browser, use the browser clipboard.
- If reading fails or is empty, open a small sheet with a focused text box ("Paste here") and a "Use" button. A normal text
  box always supports the system long-press paste. Never show "can't read the clipboard, try Ctrl+V".
- The parser forgives: `23*36`, `23 x 36`, `23 × 36`, `1,50,000 + 2,500`, `₹1,200 - ₹300`, `(5+3)*2`, `12%`, a leading label
  ("Rent 25000 + 3000"), a leading "=" or a trailing "= result", unicode minus, accounting negatives `(500)`.
- Several lines, each with a number, are **summed**, and a notice says "Added 3 lines". A line starting with "-" subtracts.
- Pasted text is never run with `eval` or `Function`. It is turned into the engine's own expression form and checked.
- Length is capped at 500 characters.

## 18. Writing form copy

| Item | Rule |
|---|---|
| Calculator title | Short, plain, unique ("Loan EMI", not "EMI calc"). Jargon words stay in search keywords |
| Blurb | 7 words or fewer |
| Field label | 5 words or fewer, says what to type ("Yearly interest rate") |
| Hint | 12 words or fewer, only if it prevents a wrong number, never repeats the label |
| Result label | Plain English. Explain jargon in the label itself ("Annual return (XIRR)") |
| Note | At most 2 sentences. Keeps every disclaimer: "Estimate for FY2026-27. Verify with a CA", "as of <date>", "example rate" |
| Defaults | Realistic, give a real result |
| Ids | Never change a tool id or a field id. Saved items depend on them |

## 19. Corrections log

Where the earlier text of this document changed on 2026-11-02, and why.

| Section | Was | Now | Why |
|---|---|---|---|
| 4.4 keypad | Utility row "⋯ ^ ↶ ⌫"; operators in `accent` text | "Paste Copy ↶ ⌫"; operators bordered | The panels hid information. Operators looked inert |
| 4.5 motion | Count-up tween on the result | Crossfade | DS 6 says a number that animates cannot be read yet. The two documents disagreed |
| 5.1 input | Quick-chips and sliders described as present | Marked not built | They do not exist yet |
| 5.2 results | "Save, Share, Reset" on every result | "Save, To list". Share and Reset not built | Matches the build |
| 15 display | *(New)* Earlier calculations faded above the current line | Removed: History only | The owner: history should show only when asked for, not while calculating |
| 6 navigation | Tabs Calc, Tools, Saved, Reminders. 74 calculators. Favourites | Calculate, Tools, Notes, Due. 51 calculators in 9 groups | Matches the build and the owner's words |

## 20. Sections, long lists and a layout that holds still

*Added 2026-11-02 after the owner found lists that "look the same" and a calculator whose layout jumped.*

| Rule | Detail |
|---|---|
| Split any list over 6 items | Into titled sections of 1 to 4. A group of 11 loans is three sections, not one wall (`groups.test.ts` enforces it) |
| Sort by what the person is doing | Not by how the maths works. Currency is money, binary and hex are numbers, units are measuring |
| A section is a card | A tinted wash, a heading with its count, then plain rows (DS "Section colours") |
| Choose cards for navigation, rows for facts | Tools home is tiles. A schedule is rows |
| **No sideways scrolling** | A table of three or more columns becomes one block per row: a heading, then labelled values in a grid. Money never breaks. Two columns stay a table. Do not put a scroll box inside a scrolling page |
| Do not move the layout | Reserve space for anything that appears later. A finished result must not push the display or keys. Measure: the same top positions before and after |
| Say what each part is | A calculator shows "What you are working out" on a tinted card and "Result" on a plain one |
| Pin is an icon | A pushpin: outline when loose, filled and accent-coloured when pinned. Labelled "Pin" or "Unpin" for screen readers |

