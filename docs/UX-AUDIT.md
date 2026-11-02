# UX audit: journeys, gaps and the fix order

**Date:** 2026-11-02. **Method:** each journey was traced through the code as it stands, then checked on the phone
(OnePlus, Android 16) and in a 360px browser frame. Status marks: **works**, **partly**, **missing**.
A visual pass over the revamped screens follows once the in-flight UI work lands; its findings go in section 4.

## 1. The journeys

| # | Journey (what the person wants) | Today | The gap |
|---|---|---|---|
| J1 | Do quick maths, copy the answer | works | Copy depended on a WebView permission Android refuses (being fixed) |
| J2 | Paste a calculation from a note | missing | Only a single bare number was accepted (being fixed) |
| J3 | **Act on a number**: remind me, save it, split it | **missing** | Save and Remind exist only inside Tools calculators. The basic calculator and History have no way to act on a result |
| J4 | **Split an amount among friends and tick who paid** | **missing** | No split, and tape lines have no checkbox |
| J5 | Keep a running list (trip, groceries) | partly | A tape exists but is hidden under Saved > New tape. Not reachable from the calculator, no checkboxes |
| J6 | Remember a bill, get nudged, mark it paid | partly | Reminders fire at 9:00 am only. No test to prove delivery on a phone that kills background apps |
| J7 | Find something saved earlier | works | The tab is called "Saved", but the person says "notes" |
| J8 | Work out a loan or SIP and keep the answer | works | Save is top-right, far from the thumb |
| J9 | Compare two options (two loans, two regimes) | partly | Compare exists inside some calculators. Saved scenarios cannot be compared side by side (PRD F2) |
| J10 | Send an answer to someone | partly | Copy as text only. No share sheet, image or PDF (PRD F4, F5) |
| J11 | Use one number in another calculator (5,000 into GST) | missing | Retype every time |
| J12 | Undo a mistake | works | History, cards and tapes all have Undo or Trash |
| J13 | Back up and restore | works | Buried in Settings. Worth a one-time nudge |
| J14 | First launch | partly | Empty states say what goes where, but nothing teaches "tap a result to act on it" |

## 2. Cross-cutting findings

| Area | Finding | Fix |
|---|---|---|
| Naming | "Saved" holds notes, tapes and calculator cards. The person calls it notes | Rename the tab "Notes" |
| Reach | Primary actions (Save, Update, Delete) sit in the top-right corner, the hardest place for a thumb | Keep Save in the bar but also offer it from the result itself |
| Discoverability | Tapping the result copies it. Nothing says so | The result opens one actions sheet (Copy, Save, Remind, Split, Add to list). Copy also stays as a button |
| Consistency | Three different "back" behaviours (arrow, tab, system back) | One back stack (done) |
| Feedback | Saving a card gives no confirmation except the button label changing | A short snackbar: "Saved. Undo" |
| Reminders | Time is fixed at 9:00 am. No way to confirm a notification can reach the phone | Time picker, plus Settings "Send a test reminder" |
| Noise | Hints, blurbs and boxes compete with the answer | Hints on focus only, one answer bar, grouped lists (in flight) |
| Money entry | Amounts typed as 5000000 with no grouping | Group as typed and show "50 lakh" (in flight) |
| Accessibility | Needs a pass: every control has a name, focus order, 200% font | Checked in section 4 |

## 3. The design for acting on a number

One sheet, opened by tapping any result (calculator, History row, a calculator's main answer):

```
Tap a result  ->  [ Copy ] [ Save as note ] [ Remind me ] [ Split ] [ Add to list ]
```

| Action | What it creates | Reuses |
|---|---|---|
| Save as note | A card with the amount, a title, a note, tags | The existing Save sheet as its editor |
| Remind me | The same card with a reminder switched on | Existing reminders and the Due tab |
| Split | A list with N lines of the share, a checkbox on each | Tape |
| Add to list | One more line on an existing or new list | Tape |

A split and a tape are the **same object** with a "checklist" switch. Shares always sum exactly to the total (100 / 3 gives 33.34, 33.33, 33.33).
Data change: schema v3 with a tested upgrade. `kind` gains `note`, `checklist` is added to cards, `done` to tape lines.

**Deliberately later:** use a number in another calculator, unequal splits and who-owes-whom, pasting a list to make a checklist.
These are listed, not built, so the first version stays simple.

## 4. Visual findings (360px browser, after the revamp)

Seen working: the calculator ("23 × 36" with a dimmed answer, then "23 × 36 =" at full strength and two chips); the split flow
(1,000 as 5 lines, tick two, "2 of 5 done · ₹3,000.00 left"); Tools home (compact search, Scientific row, 9 groups with
counts); Loan EMI (sticky answer bar, "50,00,000" with "50 lakh", Years or Months switch); Scientific (fits 360px); tapping
the Tools tab inside a calculator returns to the Tools list.

| Finding | Fix |
|---|---|
| Chip, stepper, button and input borders used the faint separator colour and were almost invisible | **Fixed**: controls use `ink-3` (DS 9) |
| The answer appears twice on a calculator (sticky bar and first result row) | Backlog 9 |
| The list header label wraps ("...₹3,000.00 left" onto a second line) | Backlog 14 |
| The sticky answer bar is the tightest spot (label, value and "To list") | Watch at 200% font |
| Money values wrapped across two lines in some results | **Fixed**: money never wraps (DS 12) |
| The launch screen would flash white on a dark app | **Fixed**: dark launch theme and the Calc mark |

Not yet looked at after the revamp: Settings, the Due tab, the Notes list, the Save sheet, the light theme, 200% font, and the phone.

## 5. Full-page audit, 2026-11-02 (every calculator and every app page)

**Method:** a scripted checker (`e2e/audit-harness.js`) opened all **51 calculators** and **25 app pages** (calculator,
Scientific, History, Settings, Tools home and search, all 8 group pages, Notes and its list, calculator and new-list views,
Trash, Due, and the Save, To list, Remind me and Paste sheets), at normal size and at **200% font**. It checks sideways
scrolling, off-screen content, cut-off text, controls under 44px, unnamed controls, bad text and wrapping money.

| # | Bug found | Where | Fix |
|---|---|---|---|
| 1 | The answer was shown twice (answer bar and first result row) | All 51 calculators | The answer bar floats under the header only while the Result is scrolled away, and takes no room |
| 2 | **To list** ran off the screen at large font | About 25 calculators | Moved out of the answer bar into the new Keep and share section |
| 3 | Text results ran off the screen ("From 7.50% a year") | Loan presets, Date, Savings withdrawal, Funnel, Capital gains | Words wrap; only money refuses to. A row wraps its value under its label |
| 4 | Two-column tables ran off the right edge | Unit converter, In-hand salary | Two columns become label and value rows that stack when they must |
| 5 | The five-way "No / Once / Monthly / Quarterly / Yearly" switch overflowed | Save and Remind me sheets at large font | The segmented control wraps |
| 6 | Settings switches were 42 by 24px | Settings | A 56 by 44 tap area around the same track |
| 7 | The backup file input had no name | Settings | Labelled "Choose a backup file" |
| 8 | Six hand-built headers had drifted (icon sizes, "Delete" versus "Delete list", two styles for the main action) | Calculator, group page, list, Trash, Settings, Scientific | One `ScreenHeader`, and a test that fails if any file draws its own |
| 9 | "New regime is cheaper by ₹42150": the amount was baked into the label, ungrouped, and repeated by the value beside it | Income tax | The label says which regime; the value shows the saving |
| 10 | Worked-out lines showed ungrouped amounts (₹5000000, ₹1425000) | Loans, Savings, Tax, Metrics | Grouped the Indian way (₹50,00,000) in each module's number helper |

After the fixes the checker reports **no real findings** (two known false alarms are listed in its header).

**Not fixed, and why:**

| Item | Why |
|---|---|
| World time is a table and the time does not tick | A presentation redesign (a clock, a globe or map), not a bug. See ROADMAP section 3 |
| Light theme checked on Tools and Notes only | Contrast is proven by tests; the full light sweep is not done |
| Android back button, share sheet, paste | Need the phone. Not run |

