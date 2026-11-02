# UI and UX plan: status, and every micro-step

**Date:** 2026-11-02. Two parts. **Part A** answers "is anything not done?" against everything the owner asked for.
**Part B** is the improvement plan for each micro-step, tied to the guidelines. Where the guidelines did not cover a
step, they were extended in the same change (`docs/DESIGN-SYSTEM.md` sections 9 to 13, `docs/UX-GUIDELINES.md`
sections 11 to 19). References look like **DS 9** (design system) and **UX 12** (UX guidelines).

**Status key:** **Done** means built, tested and seen in a 360px browser. **Built** means built and tested but not seen.
**Phone** means it still needs the new build on the phone. **Open** means not done.

## Part A. Is anything not done?

### From the first message (calculator, Tools, paste)

| # | Ask | Status | Evidence, or what is left |
|---|---|---|---|
| 1 | Tools feels noisy, selection unclear | **Done** | Tools home is a compact search, a Scientific row and 9 groups with counts. Rows darken when pressed. Seen in browser |
| 2 | "Everyday" holds unrelated things | **Done** | 9 groups: Money and shopping, Convert, Dates and time, Fuel and travel, Health and study, Loans and EMI, Savings and investing, Tax and salary, Business metrics. A test checks every calculator is in exactly one |
| 3 | Thorough revamp, analyse each mini calculator | **Done** | All 51 reviewed against a checklist (`docs/TOOLS-UX-REVIEW.md`): 22 titles made plain, about 60 rare fields moved under "More options". 8 items need your decision (end of that file) |
| 4 | Tools tab should return to the Tools list | **Done** | Tapping the tab you are on resets it. Seen working. Android back button: **Phone** |
| 5 | Too much space above search | **Done** | A doubled status-bar padding was removed. Seen |
| 6 | Paste does not work | **Built, Phone** | Native clipboard plugin, a "Paste here" sheet if reading fails, and a parser for `23*36`, `Rent 25000 + 3000`, lists. Not on the phone yet |
| 7 | Copy may be broken | **Built, Phone** | Same plugin. Not on the phone yet |
| 8 | Operator keys need a border | **Done** | 1px border, 5.2:1 contrast dark, 6.6:1 light. Seen |
| 9 | The "..." and chevron panels hide information | **Done** | Removed. Basic calculator has Paste, Copy, Undo, Backspace only. Seen |
| 10 | Scientific as a separate calculator | **Done** | Own screen from the top of Tools, with memory keys. Seen. Missing: Paste, Copy, Undo there (backlog 10) |
| 11 | Keep the basic calculator very clean | **Done** | Seen |
| 12 | "Opens on" should pick a calculator | **Built** | Settings has a picker with every calculator. Not looked at |
| 13 | "=" is meaningless, and details are lost | **Done** | While typing the answer is dimmed and has no "=". After "=" it is full strength with "23 × 36 =". "=" again does nothing. Past lines stay above. Seen and tested |
| 14 | Brand name "Calc" | **Built, Phone** | Header, page title, Android app name, Settings About, backup messages. The phone still shows the old name until rebuilt. The internal storage key and backup file marker keep the old id so old data and backups still load |

### From the second message (acting on a number)

| # | Ask | Status | Evidence, or what is left |
|---|---|---|---|
| 15 | Tap a number to remind or save | **Partly done** | After "=": **To list** and **Remind me** chips. On every calculator's answer: **To list**. **Open:** History rows have no actions |
| 16 | 5000 ÷ 5, send 1000 to 5 friends with checkboxes | **Done** | Seen: 5 lines of ₹1,000, tick two, "2 of 5 done · ₹3,000.00 left", ₹2,000 collected |
| 17 | Radio buttons if needed | **Open (decision)** | Lists use checkboxes: paid or not. A third state is backlog 22 |
| 18 | Think through the flows, similar needs too | **Done** | `docs/UX-AUDIT.md`: 14 journeys with gaps. Critic review changed the design |
| 19 | Audit UI and UX end to end | **Partly done** | Journeys audited; browser pass of the calculator, Tools home, Loan EMI, Scientific, the split flow. **Open:** Settings, Due, Notes list, Save sheet after the revamp, light theme, 200% font, the phone |
| 20 | Plan every micro-step, extend the guidelines | **Done** | This file and the guideline sections |

**Where nothing is "Done" for the phone:** the phone has the build from before the revamp. Everything marked Phone waits
for `scripts/build-android.sh install`.

## Part B. The micro-step plan

Each row is one small step a person takes. "Guideline" names the rule that governs it.

### Calculate

| Micro-step | Improvement | Guideline | Status |
|---|---|---|---|
| Open the app | Opens where the owner chose, including straight into a calculator | UX 12 | Built |
| Read the status bar | Light icons on dark, dark icons on light | DS 9 | Built, Phone |
| Type a number | Digits filled, group as you type | DS 9 | Done |
| Type an operator | Bordered key, not filled | DS 9 | Done |
| Watch the live answer | Dimmed preview, no "=" | UX 15 | Done |
| Press "=" | Full-strength answer, "23 × 36 =", one history entry, "=" again does nothing | UX 15 | Done |
| Start the next sum | Previous lines stay above, up to 3 (1 on short screens). Tap one to reuse its result | UX 15 | Done |
| Clear | "C" clears the current line only | UX 15 | Done |
| Act on the answer | Chips: To list, Remind me. Appear only after "=" | UX 13, DS 12 | Done |
| Paste a calculation | Native clipboard, "Paste here" fallback, forgiving parser, lists summed with a notice | UX 17 | Built, Phone |
| Copy the answer | Copy button and tap the answer | UX 17 | Built, Phone |
| Open History | Row actions: To list, Remind me | UX 13 | **Open** (backlog 8) |
| Open Scientific | Separate screen, memory keys | UX 12 | Done |
| Use Scientific | Add Paste, Copy, Undo | UX 17 | **Open** (backlog 10) |

### Tools

| Micro-step | Improvement | Guideline | Status |
|---|---|---|---|
| See Tools | Compact search, Scientific row, 9 groups with counts | DS 10 | Done |
| Search | Flat results with the group name dimmed | DS 10 | Built |
| Open a group | Page with a back arrow, title only plus one dim line | DS 10 | Built |
| Open a calculator | Sticky answer bar, form below | DS 11 | Done |
| Enter an amount | Digits group as typed, "50 lakh" beneath | DS 11 | Done |
| Pick an option | 2 or 3 choices as a segmented control, more as a phone dropdown | DS 11 | Done |
| Read a hint | Only while the field is focused | DS 11 | Built |
| Find a rare option | Under a closed "More options" | DS 11 | Done |
| Read the result | Drop the answer row that the sticky bar already shows | DS 11 | **Open** (backlog 9) |
| See how it was worked out | "How this is worked out" expander | UX 5.2 | Done |
| Go back | Back arrow, the Tools tab, or the Android back button, each one level or to the list | UX 12 | Done in browser, Phone for back |
| Leave and return | Typed values are kept for the session | UX 12 | Done |
| Take the answer on | To list in the answer bar | UX 13 | Done |
| Save | Save / Update / Delete in the bar, with Undo for delete | UX 16 | Done |
| Confirm a save | A short "Saved. Undo" snackbar | UX 16 | **Open** (backlog 12) |

### Notes, lists and Due

| Micro-step | Improvement | Guideline | Status |
|---|---|---|---|
| Find the tab | Named **Notes**, as the owner calls it | UX 11 | Done |
| Browse notes | Ledger rows: title, summary, tags and due state. Pin, filter, search | DS 10 | Built |
| Open a list | Header "N of M done · ₹X left", collected amount, checkbox per line | DS 10, UX 14 | Done |
| Tick a line | 48px hit area, done text dims, summary updates | DS 12, UX 14 | Done |
| Rename a line | Tap the line, edit in the bar | UX 14 | Built |
| Share a list | "Copy as text" includes ✔ and ☐ and the totals | UX 14 | Built |
| Delete | To Trash with Undo for 7 days | UX 16 | Built |
| Set a reminder | Remind me on the list, with date, repeat and days-before | UX 14 | Built |
| Choose a reminder time | A time picker | UX 14 | **Open** (backlog 6) |
| Read the Due tab | Overdue, This week, Later, and a 30-day total | DS 10 | Built (30-day boundary bug fixed) |
| Mark paid, snooze | On the row and on the notification | UX 16 | Built, Phone |
| Trust the reminder | "Send a test reminder" and a device test protocol | UX 16 | **Open** (backlog 3, 6) |

### Settings and everything else

| Micro-step | Improvement | Guideline | Status |
|---|---|---|---|
| Choose what opens | Picker lists tabs and every calculator | UX 12 | Built |
| Back up and restore | Works. Add a one-time nudge once there is real data | UX 16 | Backlog 18 |
| Light theme | Check every new screen | DS 13 | **Open** |
| Large font | Check at 200% | DS 13 | **Open** |
| Android back | One level at a time, then Calculate, then exit | UX 12 | Built, Phone |
| Verification status | Show "checked against X" on each result, and a Finance Act caveat on tax | UX 16 | **Open** (backlog 4) |

## Part C. What the guidelines gained

| Where | Added |
|---|---|
| DS 9 | Control hierarchy (filled, bordered, accent) and why borders use `ink-3` and not `line` |
| DS 10 | Rows, lists, checkbox lines, progress header, search |
| DS 11 | Forms: labels, grouping digits, hints on focus, "More options", sticky answer |
| DS 12 | Chips, steppers, checkboxes, sheets |
| DS 13 | New review-checklist lines |
| UX 11 | One vocabulary: Notes, list, Due, To list, Remind me |
| UX 12 | Navigation: tap-the-tab, Android back, depth, startup |
| UX 13 | Acting on a number |
| UX 14 | Lists and checklists |
| UX 15 | The calculator display and what "=" means |
| UX 16 | Feedback ladder |
| UX 17 | Clipboard |
| UX 18 | Writing form copy |
| UX 19 | A log of where the older text was corrected |

**Unproven:** the past-lines display, summing a pasted list, hints only on focus, and Scientific living under Tools are my
choices. They follow your feedback but have not been used for a week. Revisit after real use.
