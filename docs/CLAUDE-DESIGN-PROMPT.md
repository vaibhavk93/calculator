# Prompt for Claude Design: the Calc app interface

Paste everything below the line into Claude Design. Written 2026-11-06 from the real design system (`docs/DESIGN-SYSTEM.md`),
the owner's feedback, and the screens that exist today. Attach screenshots of the calculator page and two or three other screens if you can.

---

## ROLE AND GOAL

You are a senior product designer. Design the complete mobile interface for **Calc**, a personal calculator and money-tools app for India.
The **basic calculator page already works and the owner loves it. It is the quality bar. Do not redesign it.** Every other screen feels
wrong to the owner, so your job is to bring all of them up to the calculator's level.

Deliver high-fidelity mobile screens, a small component library, and written reasoning. Design for an **Android phone, 360 px wide**, one thumb.

## THE PRODUCT

A personal tool, local-only (no accounts, no cloud, no ads, no paywall). Five tabs plus a Settings screen:

| Tab | What it is |
|---|---|
| **Calculate** | A calculator with history. Fast, big numbers. The bar. |
| **Tools** | About 57 calculators in 8 groups: loans and EMI, savings and investing, tax and salary, dates and units, business, and more. |
| **Notes** | Plain notes, checklists, saved calculations, and a to-do list. |
| **Due** | Reminders: bills, EMIs, tasks. Overdue, this week, later. |
| **Budget** | Spending tracker, money in, bills, categories, card tracking, import from bank messages, and soon a small net-worth list (Portfolio). |

### The person and the moment (design for this, not for "users")

A senior product manager in Bengaluru. Phone in one hand at **11 pm at his desk** working out whether to prepay a home loan, and again at
**7:40 am in bed** checking what is due this week. Low light both times. Real money at stake. He wants **calm precision, not encouragement**.
So **dark is the default**, light is complete and equal in quality.

All money is Indian rupees with Indian digit grouping (12,34,567.89; 50 lakh). Dates are Indian format (5 Nov 2026). Numbers are the content.

## WHAT THE OWNER SAID (this is the brief behind the brief)

1. "The UI is very stupidly designed." Earlier: "bulky", "a lot of list, a lot of card".
2. We then removed most cards and used thin lines (hairlines) between rows. The owner's reaction: **"too cluttered, too much in list."**
   They want **some things back in a card or another structured view, not a blanket reversal.**
3. The owner explicitly wants a **List / Card view toggle on Notes and Due.**
4. Budget home and Tools home feel cluttered. No direction chosen yet: **propose options** (see "Open choices").
5. Everything except the calculator page feels wrong. So look at it as a system, not screen by screen.

**Your central design problem: how do you give a data-dense money app clear structure, hierarchy and calm,
without the "card on card on card" look and without a wall of identical thin-lined rows?**
Think about hierarchy first: one clear first thing to look at on every screen, then groups, then rows.

## WHY THE CALCULATOR WORKS (learn from it)

One huge bare number. A quiet expression above it. Sixteen keys, all one size, three little icon buttons for follow-up actions.
Nothing else asks for attention. Every other screen should have the same discipline: **one answer, quiet supporting text, one obvious action.**

## HARD RULES (non-negotiable, they are tested by machine in our code)

### Colour
Dark default, light complete. Neutral greys with **chroma exactly 0** (no tint). **One accent, used on under 10% of any screen.**

| Token | Dark | Light | Use |
|---|---|---|---|
| bg | #060606 | #FFFFFF | App ground |
| surface | #0D0D0D | #F7F7F7 | Recessed panels |
| raised | #181818 | #F2F2F2 | Elevated rows, digit keys |
| line | #262626 | #DEDEDE | Separators only (1.3:1, never a control border) |
| ink | #F5F5F5 | #121212 | Primary text, results |
| ink-2 | #A4A4A4 | #525252 | Labels, hints |
| ink-3 | #818181 | #5D5D5D | **Borders and fills only. Do not use for text.** |
| accent (citron) | #CCD539 | #5C6100 text, #CCD539 fill | **Means "you can act on this".** Never "good". |
| accent-ink | #121300 | #121300 | Text on an accent fill |
| alert | #EF675A | #BE241F | Overdue / errors only |

- **Accent means tappable or actionable, never success.**
- `positive` and `negative` are the only colours for good and bad money. Use only where it is unambiguous (money saved, over budget),
  **never as the only signal** (a screen reader must get the same meaning in words), never on a plain fact.
- **Eight section tints** (one per Tools group: indigo, cyan, amber, plum, blue, violet, slate, sand), hues kept away from red, green and citron.
  A tint is **identity, never state**. Allowed: a small dot or heading touch, a calculator's own input card. Not allowed: behind a result,
  on a button, or behind a number that carries positive/negative colour.
- Light mode is **not an inversion**: dark digit keys are lighter than the ground; light digit keys are darker than the ground. Elevation is a relationship.

### Type
- **IBM Plex Mono, tabular figures, for every number the user reads.** IBM Plex Sans for words and for keys you press.
- Sizes in rem so they follow the phone's font size. **Everything must survive 200% font size** (titles wrap, never clip; money never breaks mid-number: shrink to fit instead).
- **No uppercase text, no letter-spacing.** No tiny all-caps eyebrow labels. (They are the number one "AI-made" tell.)

### Shape, depth, space
- Radius: **4, 10 or 20 px, or 0. Nothing else.**
- **No shadows, no gradients, no blur, no glass, no coloured side-stripe borders.**
- **Every control at least 44 px in one direction.**
- **No nested cards.** A card holds rows, never another card. One level of surface only.
- Grouping tools you may use: whitespace, a hairline, a single flat surface panel, a small heading, a tint dot. Choose deliberately. Few spacing values, used consistently.

### Behaviour the design must show
- **Every delete is undoable** (a snackbar with Undo). Show it.
- Errors are plain words ("Can't divide by zero"), never codes or NaN.
- **Sheets:** close button (X) top right, the one main action is a footer button (never in the header), never stack one sheet on another
  (swap the content inside, with a back arrow). Picker lists are never the phone's native dropdown.
- **Every full screen has a visible Back.** The phone's back button is never required.
- Required fields carry `*`. Placeholders are not labels.
- A state is never shown by colour alone.

## SCREENS TO DESIGN (all dark first, then light)

Use **realistic Indian sample data** (below). Show real states, not lorem ipsum.

**Core**
1. Calculate: keep as is. Show History (a sheet), and one history row's "More" sheet. Only fix what clashes with the new system.
2. **Tools home**: search, "Your tools" (recently used), Scientific calculator, the 8 groups with counts. (Open choice A.)
3. Tools group page: sections with their calculators (e.g. Savings and investing: Grow your money, Fixed returns, Retirement).
4. **Tool page** (the most important screen after the calculator). Show Loan EMI, SIP, Income tax and a text-answer tool ("Typical loan rates"):
   inputs card (money field with +1K / +10K / +1L chips and an "50 lakh" echo, a rate field, a **duration field with a Years / Months / Days switch**),
   then the **answer as a bare big number** (tier 1) with a quiet label, then supporting rows, a chart, the "how this is worked out" note, a short
   disclaimer line, and actions (Copy, Share, More). A floating answer bar appears only when the big answer has scrolled away. (Open choice B.)

**Notes and Due (each with a List view and a Card view; design both)**
5. Notes: kinds are plain note, checklist, saved calculation (shows its result), to-do. Pin, tags, search. One `+ New` button offering note / list / to-do.
6. Note editor sheet, checklist screen (lines with amounts and a total, done state), To-do (composer, Today / Upcoming / All).
7. **Due**: Overdue, This week, Later, plus "Amounts due in the next 30 days". Each row has **one round check button** and a quiet "More" button
   (Snooze 1 day / 3 days / 1 week, Remove). Bills say "Mark paid". Show a bill with "2 payments left".

**Budget**
8. **Budget home**: the hero is "Spent this month" (or **"Over budget by"** in the negative colour when over), one quiet line for money that came in
   ("Kept ₹18,400 of ₹90,000 that came in"), a monthly limit bar, Needs attention, Recent entries, and a small "More in Budget" area
   (Spending summary, Bills, Add from bank messages, Categories and cards, Rules, Portfolio). One filled primary button: Add expense. (Open choice C.)
9. **Add expense sheet**: kind choice (Spent / Money in / Refund / Transfer / Card bill), amount, date, category pills, paid with, note,
   "Repeats" with an optional "Number of payments" field and a computed hint ("Last payment on 5 Jan 2027").
10. Spending summary (month switcher, total, day-by-day heat map, last months bars, by category with sub-categories, paid-with, limits).
11. Bills and subscriptions, Categories and cards, Rules (merchant text to category), Add from bank messages (review rows with the reason, e.g. "Groceries (rule: swiggy)").
12. **Portfolio (new)**: net worth as a bare big number; "3 of 8 values older than 30 days"; a split by kind with thin bars; a 6-month trend;
    holdings list where each row shows the value and "updated 41 days ago"; one-tap update (tap row, number pre-filled, date today). A hide-amounts toggle.
    Kinds: bank, FD/RD, stocks and MF, gold, property, retirement (EPF/PPF/NPS), other, loan, card debt. Stale values must be impossible to miss without shouting.

**System**
13. **Settings** (about 14 rows, grouped): Appearance, Numbers, **Show in the app** (two switches: Budget, Notes and reminders; hint "Hidden, not deleted"),
    Behaviour, Reminders, **Backup and export** (one row opening a sub-screen), Tips and tours (one row), About as a quiet footer.
14. Empty states (Budget, Due, Notes, To-do): a title, one sentence, one filled button, then a quiet list. No wall of links.
15. A bottom tab bar with 5 tabs (and the variant with 3 or 4 tabs when a module is switched off), the snackbar with Undo, a confirm dialog pattern.

## OPEN CHOICES: give me 2 or 3 labelled options for each, with a recommendation and the trade-off

- **A. Tools home.** Eight groups. Options to explore: a calm ruled list with a colour dot; a 2-column set of flat tiles with no tint wash;
  "recent first, then groups"; a hybrid. We tried tinted tiles (loud) and a plain list (clear but plain).
- **B. Result on a tool page.** Bare hero over rows; hero over one flat panel; an "answer strip" pinned with a collapsible detail.
- **C. Budget home structure.** Pure rows; one flat panel per tier; a "this month" summary panel above plain rows. This is the screen the owner finds most cluttered.
- **D. List vs Card on Notes and Due.** Design both views so the toggle makes sense; say what the card view is *better at* (not just prettier).
- **E. Where Portfolio lives** is decided (a page inside Budget). Do not add a tab.

For each option, say which of the hard rules it respects and which popular pattern you rejected and why.
(Card carousels and bento grids were researched and rejected: weak accessibility and discoverability, and bento collapses to one column on a phone.)

## SAMPLE DATA (use these, show long-text and big-number stress cases too)

- Loan EMI: ₹50,00,000 at 8.5% for 20 years, EMI **₹43,391.16**, total interest ₹54,13,878.80, total ₹1,04,13,878.80.
- SIP: ₹5,000 a month, 12%, 18 months, value ₹99,054.48. Lumpsum: ₹1,00,000, 12%, 90 days, ₹1,02,833.82.
- Budget (November): spent ₹14,700, limit ₹60,000; Food ₹8,000 limit; Travel, Goa trip, Rent ₹22,000, Bills; HDFC Salary account, Tata Neo credit card; bills Netflix ₹999, Car loan ₹43,391.16 (2 payments left).
- Due: "Renew car insurance, 5 days overdue", "Pay credit card bill, monthly", "Home loan EMI, in 5 days", "Submit rent receipts".
- Notes: "Goa trip" checklist (hotel ₹18,500, flights ₹24,000, total), a calculation card "EMI 43,391", a plain note, a pinned to-do.
- Portfolio: HDFC savings ₹3,25,000; FD ₹5,00,000; Mutual funds ₹8,40,000 (updated 41 days ago); Gold ₹1,20,000; EPF ₹6,10,000; Home loan -₹38,00,000; net worth shown as one number.
- Stress cases: ₹9,99,99,999.99 (never breaks mid-number), a 60-character note, a 36-character tool label, an empty month, an overdue count of 12.

## DELIVERABLES

1. All screens above at **360 x 800, dark and light**. For the 8 most important screens also show **200% font size** and a **short phone (360 x 640)**.
2. A **component library sheet**: tab bar, header, section heading, row (plain, with check, with chevron, with More), group/panel, hero number block,
   field with unit switch, chips, segmented switch, bars, snackbar with Undo, sheet (with and without footer button), empty state, stale-value marker.
3. **Type and spacing scale** (named, few values) and the colour roles as used (which token is used where).
4. **Interaction notes** per screen: the primary action, the one-thumb reach, what happens on tap, what Undo covers.
5. A short **rationale**: for each major decision, the user problem it solves and which hard rule it honours.
6. A **self-check table**: each hard rule above, pass/fail per screen. Be honest where you broke one on purpose and say why.

## ANTI-GOALS (do not do these)

- No shadows, gradients, blur, glass, neon, or decorative illustration. No emoji as icons.
- No new tint behind results; no coloured side stripes; no uppercase labels; no pie or ring charts, treemaps or Sankey diagrams.
- No floating action button, no centre "+" tab, no sixth tab. Five tabs is the limit.
- No swipe as the only way to do something (always a visible control; swipe may add a shortcut).
- No "celebration" or encouragement copy. Calm, plain, precise words.
- Do not touch the calculator keypad, the logo (three outlined keys and one filled citron `=` key), or the colour roles.
- Do not use the phone's native dropdown; do not hide required information behind hover.

## HOW TO WORK

Start with a one-page **diagnosis** of why a data-dense money app ends up cluttered and what the calculator does differently.
Then explore the open choices, then commit to one coherent system and apply it to every screen. If a hard rule blocks something you genuinely need,
say so and propose the rule change; do not quietly break it. Ask me a question only if you are truly blocked.
