# Forms, sheets and feedback

**Status:** proposal, researched 2026-11-02. Nothing here is built yet.
**Reads with:** `DESIGN-SYSTEM.md` (9, 11, 12, 14) and `UX-GUIDELINES.md` (5.3, 12, 16).
**If a rule here changes a rule there, change both together** (CLAUDE.md says so).
Tags like [S3] point to section 10. A rule marked **(our choice)** has no source: it is design judgement and **unproven**
until tried on a phone.

---

## 1. Headings and hierarchy

**Problem today:** the screen title is 1rem / 500 (DS 14.1). The sheet title is 1.1875rem / 600. A screen title is
*weaker* than a sheet title and barely above a row label (0.9375rem / 400).

**Font limit:** only Plex Sans 400, 500 and 600 are loaded (`main.tsx`). A 700 would be faked, so **600 is the top weight**.
Size and colour do the rest. (`latin-700.css` could be added; not needed.)

| Level | Used for | Size | Weight | Colour | Extra (our choice) |
|---|---|---|---|---|---|
| **L1** | Screen title, sheet title | 1.25rem | 600 | `ink` | Line-height 1.25. 1px `line` under it **only once the body has scrolled under it** |
| **L2** | Section heading above a card ("Result") | 1rem | 600 | `ink`, or `tint-ink` on a tinted card | No rule: the card groups |
| **L3** | Group label in a form ("Tags", "Paid with") | 0.875rem | 600 | `ink-2` | Above chips or a row of controls |
| Body | Rows, content | 0.9375rem | 400 | `ink` | |
| Field label | Above an input | 0.8125rem | 400 | `ink-2` | Unchanged (DS 11) |

- Three steps are enough. L1 to body is a 1.33 size step plus a heavier weight: that is what a reader sees first.
- Weight 600 on small text only in `ink` or `ink-2`, never `ink-3`.
- **Banned (DS 1, 4):** uppercase, positive letter-spacing, coloured side stripes. A hairline under L1 is allowed.
- Real tags: L1 is `h1` on a screen, `h2` in a sheet; L2 is `h2`; L3 is `h3`, `legend` or `label`. Screen readers jump by heading. [S9] [S12]
- Add tokens `--t-l1`, `--t-l2`, `--t-l3`, `--w-strong: 600`. **Doc changes:** DS 14.1 and DS 4 (`title` 19 / 600) become L1.

---

## 2. Inputs

| Part | Rule | Source |
|---|---|---|
| Label | Above the field, never a placeholder. Short, sentence case, no colon | [S4] |
| Unit or prefix | Screen readers **skip** prefixes and suffixes, so the label also says it: "Amount in rupees" | [S4] |
| Hint | One short sentence, shown on focus (DS 14.2), linked by `aria-describedby` | [S4] [S16] |
| Error | Under the field, replaces the hint. `aria-describedby` plus `aria-invalid="true"` | [S1] [S14] |
| Not colour alone | The text names the problem; a red border is extra. Never clear the field | [S9] [S1] |

### Required or optional: decision

| Source | Says |
|---|---|
| NN/g [S6] | Mark every required field with `*` or the word "required". Marking optional ones too is allowed |
| GOV.UK [S5] | Mark **optional** fields "(optional)". "Never mark mandatory fields with asterisks" |
| W3C WAI [S12] [S14] | Visible text such as "(required)" in the label, plus `required` / `aria-required` |

**Decision: mark optional fields, in the label, with the word "(optional)".**
1. In our sheets optional fields **outnumber** required ones (Save: Tags, Note, Reminder). Mark the minority.
2. A word needs **no legend** and is read as written. A `*` is often read "star".
3. Calculator fields all have defaults and are all needed: **no marker**. Marking everything marks nothing.
4. Set `aria-required="true"` on the few required inputs. [S14]

**Disagrees with the first plan** (`*` plus legend). NN/g allows both; GOV.UK and W3C point to words.

### Keyboard types and autofocus

| Field | Use | Source |
|---|---|---|
| Money, percent (decimals) | `inputmode="decimal"` | [S4] [S17] |
| Whole counts (years, months, "Days before") | `inputmode="numeric"` | [S4] [S17] |
| Minus allowed | **omit `inputmode`**: some pads have no minus key | [S4] [S17] |
| Name, note, tag | text, `autocomplete="off"`, `spellcheck="false"` for tags | [S4] |
| Date | `type="date"` (DS 11). Never `type="number"`: it fights our grouping (1,50,000) | [S4] |

- **Autofocus** the first field when typing is the whole job (Paste, Add expense: Amount). Focus after mount, or Android may skip the keyboard. [S22]
- **Don't** autofocus a calculator (the keyboard hides the Result) or a choice sheet (Copy as, pickers).
- After a failed press, focus goes to the **first bad field** (section 3).

---

## 3. Validation

| Place | Check | Source |
|---|---|---|
| Sheet or form with a button (Add expense, Save, Limits) | **On press.** After the first error, re-check that field **as it changes** so the message clears | [S2] |
| Live calculator (no button) | When a **touched** field is left. Hide the Result while any field is bad | [S8] |
| Never | On every keystroke for a first error ("12" is fine on the way to "120") | [S2] |

**Sources disagree:** GOV.UK says do *not* check on leaving a field [S2]; NN/g says check when a field is finished [S8].
We follow GOV.UK for sheets and NN/g for calculators, which have no button. `UX-GUIDELINES.md` 5.3 ("validate on blur") becomes this table.

### Do not disable the submit button (decided)

A greyed Done gives no reason and is skipped by screen-reader focus [S29]. **Keep it enabled, check on press, say what to fix.**
GOV.UK does not discuss disabling [S2]; the case rests on an NN/g video title and Adrian Roselli [S29]:
**weak evidence, cheap to follow.** Exception: a *secondary* control beside an obviously empty input ("Add" next to an empty tag box).
**Code:** `PasteSheet` "Use" is disabled when empty: enable it and answer "Paste something first".
`.btn:disabled { opacity: .5 }` breaks DS 7 ("no opacity trick"): use `ink-3` text and a `line` border.

### A failed press, in order

1. Keep the sheet open and every typed value. [S1]
2. Message under each bad field.
3. **Focus the first bad field**, scrolled above the keyboard. [S3]
4. Screen readers hear label, "invalid", message. No `role="alert"` needed when focus moves. [S11]
5. Three or more bad: one line above the footer, "Fix 3 fields to continue". (our choice)

Live calculators keep one line under the form with `role="status"` (polite), not `role="alert"` per keystroke:
over-announcing is a listed failure. [S11]

### Wording

| Do | Don't | Source |
|---|---|---|
| "Enter an amount above zero" | "Invalid input", "This field is required" | [S1] |
| "Rate can't be more than 50%" | "Out of range" | [S1] [S10] |
| "Name must be 30 characters or less" | "Too long" | [S1] |
| "Pick a date after today" (suggest the fix) | "Date error" | [S10] |
| Reuse the label's words | "sorry", "please", "valid", "invalid" | [S1] |

### Limits per field type (proposed defaults, tune per tool)

| Field | Required | Allowed | Message |
|---|---|---|---|
| **Money** (₹) | Yes in a form | Above 0. 2 decimals shown. 14 digits typed. Cap ₹1,000 crore | "Enter an amount above zero" / "Amount can't be more than ₹1,000 crore" |
| **Percent, rate** | Yes | 0 to 100; a tool may cap lower (loan 50) | "Rate can't be more than 50%" |
| **Percent, change** | Yes | -100 to 1000; no `inputmode` | "Enter a number between -100 and 1000" |
| **Years, months** | Yes | Years: above 0, up to 50. Months: whole, 1 to 600 | "Term can't be more than 50 years" |
| **Date** | Yes (expense, reminder) | Real date. Reminder: today or later. Expense: at most 1 day ahead | "Pick a date" / "Pick a date after today" |
| **Text name** | Category yes; title no (falls back) | 1 to 30 (category, tag), 120 (title). Trim. Duplicate: reuse and say so | "Give it a name" |
| **Note** | No | 0 to 5000. `maxLength` stops typing | none |
| **Phone-free** | | No phone, email or card number is ever asked. `last4`: exactly 4 digits | "Last 4 digits must be exactly 4 numbers" |

A rule typing cannot break needs no message (`maxLength`, `cleanMoney`). **No silent fixing:** if a value is changed or
dropped, say so. [S9] Today `cleanLimit` drops a limit typed "0" or "abc" (section 8).

---

## 4. Selects and pickers

| Options | Control | Notes |
|---|---|---|
| 2 to 4, labels of 10 characters or less | **Segmented** | Wraps 2 by 2 at large font (DS 14.3). Today's rule is 2 to 3; 4 is **unproven** at 360px and 200% font |
| A set the person builds, up to about 8 | **Chips** that wrap | Multi: `aria-pressed`. Single: one pressed |
| 5 or more, or a growing list | **Picker row** opening a **picker sheet** | Below |
| Many and grouped ("Opens on": 51 tools) | Picker sheet **with search** and group headings | |
| A date | Native `type="date"` | Already a platform picker |

**Why not the phone's `<select>`:** the open list is drawn by the system and **you cannot set its colours or spacing** [S18].
In dark theme it can open light, in another font, ignoring our radii and `ink-3` border (DS 9). Mobile research found native
dropdowns can reduce control and overview [S19]. **Honest limit:** no source says they are *unusable* on Android; the issue
is looks and consistency. Try both on the phone before removing every `<select>`. **Unproven.**

### Picker sheet anatomy

| Part | Rule |
|---|---|
| Title, footer | What is chosen ("Pay from"), not "Select". X top-right. No footer: a row tap is one step and closes |
| Search | Only above 8 rows. Filters as you type. Empty: "No match. Add it?" |
| Row | 48px, label left, **tick right on the chosen one** (not colour alone, DS 9). `listbox` and `option`, or radios |
| Recents | Up to 3 on top under an L3 heading, only when the list has 6 or more |
| Add new | The **last** row, accent text: "Add new..." |
| Height | Content height, **max 60% of the visible area**, list scrolls inside |
| Opened from | A **full screen**: a sheet. From **inside a sheet**: do **not** stack. Swap the sheet's content for the list, with a Back arrow. Stacked sheets confuse Back and X [S7] |

---

## 5. Bottom sheets and dialogs

```
   +---------------------------------------+
   |              -- grab handle --        |   decoration only
   |  Add expense                      [X] |   L1 left, Close right, 44px
   |  ...content scrolls here...           |   hairline under header once scrolled
   |  [ Cancel ]        [ Add expense   ]  |   sticky footer, above the keyboard
   +---------------------------------------+
```

| Part | Rule | Source |
|---|---|---|
| Title | Left, names the job | [S15] |
| **Close (X)** | Top-right, 44px, named "Close", **always visible**. The grab handle alone is missed | [S7] [S15] |
| **Footer** | Sticky. **One primary action**, `accent-fill`, named for the job. Optional "Cancel" to its left, bordered `ink-3` | our choice |
| Never | The primary action in the header. Info and choice sheets: no footer, X only | our choice |

### Where evidence disagrees with the plan

- **X top-right: supported.** NN/g wants a clear Close at the **top** (no side given) [S7]; APG wants a visible closer [S15];
  BT uses top-right [S30]. Material's full-screen dialog puts X **top-left** [S26]. Our full screens use a left Back arrow,
  so a right X makes "this closes" differ from "this goes back".
- **Primary in the footer: not what Apple or Material do.** Material puts Save top-right [S26]. Apple says Done is "typically"
  top-right, **and** that people expect dismissing buttons "at the bottom, in the trailing corner" [S25]. We choose the footer
  because DS 8 says "primary actions in the bottom 60%" and a footer rides above the keyboard. **A design choice, not evidence.**
  Today's code (Done in the header) breaks our own DS 8.
- Sheets that save as you go (nothing to submit) get X only.
- **Doc changes:** DS 12 ("primary action right in the title row"), DS 14.5b, `Sheet.tsx`'s `action` slot.

### Dismiss and dirty forms

| Rule | Detail | Source |
|---|---|---|
| Ways to dismiss | X, Cancel, scrim tap, Escape, Android back. All do the same | [S7] [S15] |
| Clean form | Close at once | [S24] |
| **Dirty form** | Ask "Discard changes?" with **Keep editing** (default, focused) and **Discard** (`alert` text) | [S24] [S28] |
| Never | "Are you sure?", a "don't ask again" tick. No ask on choice or info sheets | [S24] [S28] |

"Dirty" = values differ from when the sheet opened. A discarded **draft** is not a delete, so no Undo needed.

### Height, keyboard and focus

| Rule | Detail | Source |
|---|---|---|
| Height | Fits content, max **88% of the visible height** (today 78%). Body scrolls | our choice |
| Keyboard open | Footer stays visible above it: resize the layout, do not cover it | [S22] |
| Android | `adjustResize` or the Capacitor Keyboard resize mode. **`capacitor.config.ts` sets neither: check on the phone** | [S22] |
| WebView | Read `visualViewport.height`: the keyboard shrinks only the visual viewport | [S23] |
| Focused field | `scrollIntoView({ block: 'center' })` once the keyboard opens | our choice |
| One at a time | No overlap. A snackbar sits above an open footer | [S7] |
| Focus in | First field, else the title (a static title for long content) | [S15] |
| Focus trap | Trap Tab and make the page behind `inert`. Today `App.tsx` does this only for Settings and History, not Save, Add to list or Expense | [S15] |
| Focus out | Escape closes; focus returns to the opener. A hard-to-undo confirm starts on the safe button | [S15] |

Keep `aria-modal` and `aria-labelledby` (done in `Sheet.tsx`). Landscape: side panel, 440px max (DS 5).

---

## 6. Back navigation independence

**Rule:** any screen or sheet can be left with something **on the screen**. Android back must also work but is never the
only way. Sheets can look like pages, and gestures fail for some people. [S7]

| Thing | Visible exit | Android back |
|---|---|---|
| Full screen (calculator page, Settings, Trash, a note) | **Back arrow** top-left, 44px (`ScreenHeader`) | Up one level |
| Form sheet | **X** top-right and **Cancel** in the footer | Closes (asks first if dirty) |
| Choice or info sheet, landscape side panel | **X** top-right | Closes |
| Picker swapped into a sheet | **Back arrow** top-left | Returns to the form |
| Discard confirm | **Keep editing** button | Same as Keep editing |
| Snackbar | None needed: it leaves by itself | Not involved |

Order of back (already in `App.tsx`, keep): confirm, sheet, overlay (Settings, History), screen, tab, exit.
It is a stack: the **newest** layer closes first.

**Gap:** only `PasteSheet` calls `useBackHandler`. Other sheets ignore it, so back probably closes the whole screen *under*
the sheet and drops the draft (not run on a phone). **Fix once in `Sheet.tsx`:** `useBackHandler(true, requestClose)`.

---

## 7. Toasts and snackbars with an action

Example: "Backup saved to Downloads/Calc   Open folder".

| Rule | Detail | Source |
|---|---|---|
| Use for | Feedback on something just done. Blocking errors go under the field | [S20] |
| Text | One line, two on a narrow phone. Says the result | [S27] |
| Actions | **One**, never "Dismiss" or "Cancel". Label is verb and noun ("Open folder", "Undo"), not "OK" | [S27] |
| Action style | **Accent text, no fill, no border** (DS 9). Material: a coloured text button; filled draws too much attention | [S27] |
| Action size | 44px high touch area, 16px side padding | [S13] |
| Duration, no action | **4 s** | our choice (one secondary source: 4 to 10 s) |
| Duration, with action | **8 s** for "Open folder". Keep **6 s** for Undo if Undo also lives in History | our choice, **unproven** |
| Timer | Pause while pressed or focused. If it must stay: no timer, add a Close icon | [S21] |
| Announce | `role="status"` (polite). Not `role="alert"` for success | [S11] |
| One at a time | A new one replaces the old. No queue | [S21] |
| Position | Above an open sheet's footer, else above the tab bar. Never over the keypad | UX 2 |
| Look | `raised` ground, `ink` text, not `positive`/`negative` (DS 3). Slide 160ms; reduced motion: fade | DS 3, 6 |

**Caveat:** today's web download (`downloadTextFile`) cannot know the folder and has no "Open folder". Use that wording
only once the native Filesystem plugin is in. Until then keep "Backup saved to your downloads", no action.

---

## 8. Apply to the app

Read from `src/features` and `src/components` on 2026-11-02. Nothing here has been run on a phone.

### Shared pieces (one change fixes many screens)

| Piece | Gap today | Change |
|---|---|---|
| `Sheet.tsx` | No visible close. `action` puts the primary in the header. No footer. No back handler. Page behind not inert (except Settings, History). No dirty check. 78% height, no keyboard handling | X, `footer` prop, `useBackHandler`, `inert`, `dirty` prop, 88% visual-viewport height |
| `ScreenHeader.tsx` | Title 1rem / 500 | L1 tokens |
| `SnackBar.tsx` | Undo only, fixed 6 s, no pause, no action prop | `action`, per-snack duration, pause on press |
| `PickerSheet` (new) | Does not exist | Section 4. Used by every 5+ list |
| Field errors | Go to a store `notice` that **only `Display.tsx` (calculator tab) renders** | Per-field errors inside the sheet |

### Screens

| Screen | Current gap | What to change |
|---|---|---|
| **Calculator pages** (`ToolScreen`) | One error line under the whole form, not by its field. Native `<select>` for 4+ options. Title 1rem/500. Back fine | Error under the field with `aria-describedby`. Picker row for 5+. L1 title. Keep `role="status"` |
| **Save sheet** | Done in header. No X, Cancel or dirty check. Tags, Note, Reminder not marked optional. A past reminder date is accepted silently | Footer "Save" / "Update". X. Dirty confirm. "(optional)" on the three. "Pick a date after today" |
| **Settings** | Back arrow right. Three native selects, one with 50+ grouped options ("Opens on"). Backup result is plain text | Picker sheet with search for "Opens on". Backup toast with action after the Filesystem plugin |
| **Budget: Add/Edit expense** | Done in header. **Empty or zero amount: the message goes to a notice nobody sees here, so the sheet seems to do nothing** (verify on phone). Label "Amount" omits rupees. Category chips grow without limit | Footer "Add expense". Error under Amount, focus it. "Amount in rupees". Over 8 categories: picker row |
| **Budget: Category** | Done in header. A limit typed 0 or letters is **silently dropped** (`cleanLimit`). "Delete category" in the body: no confirm, no Undo seen | "Enter an amount above zero, or clear the box". Delete uses snackbar Undo |
| **Budget: Limits** | Same as Category. "Add" disabled when empty (allowed) | Same fixes |
| **History** | No X. "Clear all" in the **header**, danger colour, easy to hit. Typed CLEAR is good | X top-right. Move "Clear all" into the body. Keep CLEAR |
| **Due** | A tab, no header. Mark paid, Snooze, Remove in a row. **Remove has no confirm or Undo** | Remove: snackbar Undo. Keep 44px buttons |
| **Trash** | Back arrow present. **"Empty Trash" deletes for good: no confirm, no Undo** (`emptyTrash` only filters). Breaks CLAUDE.md "every delete is undoable" | Confirm "Delete 4 items for good?" with Keep and Delete |
| **Paste sheet** | Back wired (the only one). "Use" disabled when empty. No X. Primary in the body | Footer "Use", always enabled. Empty: "Paste something first", focus the box. X |
| **To list sheet** | Add in header. Native `<select>` for "List". **If `addToList` returns nothing the sheet does nothing and says nothing.** No X | Footer "Add". Picker swap when more than 4 lists. Show the error. X |
| **Copy as sheet** | No X, no back handler. Rows are the action (fine) | X. Back comes free from `Sheet` |

**Order:** (1) `Sheet.tsx`: fixes 7 screens. (2) Per-field errors. (3) Trash and Due undo: they lose data. (4) L1 to L3. (5) `PickerSheet`. (6) Snackbar action.

---

## 9. Sources

"Summary only" means the page did not load and the claim comes from a search summary: weaker.

- **S1** GOV.UK, Error message: https://design-system.service.gov.uk/components/error-message/
- **S2** GOV.UK, Validation: https://design-system.service.gov.uk/patterns/validation/
- **S3** GOV.UK, Error summary: https://design-system.service.gov.uk/components/error-summary/
- **S4** GOV.UK, Text input: https://design-system.service.gov.uk/components/text-input/
- **S5** GOV.UK, Question pages: https://design-system.service.gov.uk/patterns/question-pages/
- **S6** NN/g, Required fields: https://www.nngroup.com/articles/required-fields/
- **S7** NN/g, Bottom sheets: https://www.nngroup.com/articles/bottom-sheet/
- **S8** NN/g, Errors in forms: https://www.nngroup.com/articles/errors-forms-design-guidelines/ (summary only)
- **S9** WCAG 2.2, 3.3.1: https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- **S10** WCAG 2.2, 3.3.3: https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html
- **S11** WCAG 2.2, 4.1.3: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- **S12** WCAG 2.2, 3.3.2: https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html
- **S13** WCAG 2.2, 2.5.8 (24px floor; our 44px is stricter): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- **S14** W3C WAI, Form validation (covers `required`, not `aria-invalid`): https://www.w3.org/WAI/tutorials/forms/validation/
- **S15** W3C APG, Modal dialog: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- **S16** W3C APG, Names and descriptions: https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/
- **S17** MDN, `inputmode`: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode
- **S18** MDN, Advanced form styling: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Advanced_form_styling
- **S19** Baymard, native dropdowns on mobile: https://baymard.com/blog/mobile-dropdown-navigation (summary only)
- **S20** Android, Compose snackbar: https://developer.android.com/develop/ui/compose/components/snackbar
- **S21** Android, Snackbar class: https://developer.android.com/reference/com/google/android/material/snackbar/Snackbar
- **S22** Android, Soft keyboard: https://developer.android.com/develop/ui/views/touch-and-input/keyboard-input/visibility
- **S23** MDN, VisualViewport: https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
- **S24** Cloudscape, Unsaved changes: https://cloudscape.design/patterns/general/unsaved-changes/
- **S25** Apple HIG, Sheets: https://developer.apple.com/design/human-interface-guidelines/sheets (summary only)
- **S26** Material full-screen dialog via SAP Fiori Android: https://www.sap.com/design-system/fiori-design-android/v25-8/components/system-components/dialogs/usage (secondary)
- **S27** Material snackbars: https://material.io/components/snackbars (summary only)
- **S28** GitHub Primer, Confirmation dialog: https://primer.style/product/components/confirmation-dialog/guidelines (summary only)
- **S29** NN/g video on disabled buttons (title only): https://www.nngroup.com/videos/why-disabled-buttons-hurt-ux-and-how-to-fix-them/ ; Adrian Roselli: https://adrianroselli.com/2024/02/dont-disable-form-controls.html (summary only)
- **S30** BT design guidelines, Modals: https://www.bt.com/guidelines/modals (summary only)

**Not verified:** Material 3 values for snackbar duration, segment count and full-screen dialog (`m3.material.io` returned nothing).

---

## 10. Summary of decisions

1. **Close X top-right plus primary in a sticky footer:** X is well supported. Footer primary is **our choice**: Apple and Material put Done or Save at the top.
2. **Required marking:** plan said `*` plus legend. GOV.UK and W3C wording favour **"(optional)" in words**; NN/g allows either. Changed.
3. **Validation:** plan said blur and submit. GOV.UK says submit only. Result: **submit for sheets, blur-after-touch for live calculators**.
4. **Never disable the primary button:** only weak evidence (NN/g video title, one blog). Cheap, so adopted.
5. **Picker sheet for 5+:** native `<select>` cannot be themed [S18], but no source says it is unusable, so test on the phone. Never stack a picker on a sheet.
6. **Biggest finds in our code:** sheets have no X and mostly ignore Android back; Budget errors are invisible; Empty Trash and Due Remove have no undo; weight 700 is not loaded, so headings top out at 600.

---

## 11. Owner decisions that override the research (2 Nov 2026)

| Topic | Research said | Decision |
|---|---|---|
| Required fields | GOV.UK: mark optional fields in words, no asterisks | **Mark required fields with `*` and show "* Required" once at the top.** The owner asked for stars so the bare minimum is clear at a glance. `FormField` and `RequiredNote` do this. |
| Sheet actions | The main action in a footer is "our choice", weakly sourced | **Keep it.** Close (X) top-right, one main action in a sticky footer, an optional second button under it. |
| Back button | A sheet should never need system back | **Done.** `Sheet` closes on the system back button too (it registers itself), and the X always works. |
| Heading weight | Only Plex Sans 400/500/600 were loaded | **700 is now loaded** (`latin-700.css`), so headings are truly bold, not faked. |
| Colours | n/a | **One calm tint (`--tint-7`) for Settings and for form cards inside sheets.** Section tints (1 to 8) identify sections in Tools, Notes, Due and Budget only. |
