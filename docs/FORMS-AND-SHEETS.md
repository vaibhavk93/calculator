# Forms, sheets and feedback

**Status:** proposal, researched 2026-11-02. Nothing here is built yet.
**Reads with:** `DESIGN-SYSTEM.md` (sections 9, 11, 12, 14) and `UX-GUIDELINES.md` (5.3, 12, 16).
**If a rule here changes a rule there, change both together** (CLAUDE.md says so).

Source tags like [S3] point to the list at the bottom. A rule with **(our choice)** has no
source. It is design judgement and is **unproven** until tried on a phone.

---

## 0. The short version

| Topic | Decision |
|---|---|
| Sheet layout | Title left, **Close (X) top-right**, content, **sticky footer with the one primary action** |
| Primary action | In the footer, never in the header. (Apple and Material put it in the header. See section 5.) |
| Required fields | Mark the **optional** ones with "(optional)". No asterisks |
| Validation | Forms with a button: check **on press**. Live calculators: check **after the field is left** |
| Submit button | **Never disabled** because of a bad value. Press it, then say what is wrong |
| 5 or more choices | A **picker sheet**. Never the phone's own dropdown |
| Back | Every screen and sheet has a visible Back or Close. Android back still works |
| Toast with action | One action, accent text, 8 seconds, polite announcement |

---

## 1. Headings and hierarchy

**Problem today:** the screen title is 1rem / weight 500 (DS 14.1). The sheet title is 1.1875rem / 600.
A screen title is *weaker* than a sheet title and barely stronger than a row label (0.9375rem / 400).

**Font limit:** only Plex Sans 400, 500 and 600 are loaded (`main.tsx`). A 700 would be faked.
So **600 is the top weight**. Size and colour make up the rest. Adding `latin-700.css` is possible but not needed.

### Three levels (our choice, built from the DS scale)

| Level | Used for | Size | Weight | Colour | Extra |
|---|---|---|---|---|---|
| **L1** | Screen title, sheet title | 1.25rem | 600 | `ink` | Line-height 1.25. 1px `line` under it **only when the body has scrolled under it** |
| **L2** | Section heading above a card ("Result", "Appearance") | 1rem | 600 | `ink`, or `tint-ink` on a tinted card | No rule. The card is the grouping |
| **L3** | Group label inside a form ("Tags", "Paid with") | 0.875rem | 600 | `ink-2` | Sits above chips or a row of controls |
| Body | Rows, content | 0.9375rem | 400 | `ink` | |
| Field label | Above an input | 0.8125rem | 400 | `ink-2` | Unchanged (DS 11) |

Rules:
- **Three steps are enough.** A fourth level means the screen has too much on it.
- L1 to body is a 1.33 size step plus a heavier weight. That is the difference a reader sees first.
- Weight 600 on small text only works with `ink` or `ink-2`. Never on `ink-3` (it drops below 4.5:1 once thin).
- Allowed: sentence case, a hairline under L1. **Banned (DS 1 and 4):** uppercase, positive letter-spacing, coloured side stripes.
- Real heading tags: L1 is `h1` on a screen, `h2` in a sheet. L2 is `h2`. L3 is `h3` or a `legend`/`label`.
  Screen readers jump by heading, so the tag must match the level. [S9] [S12]
- Tokens to add in `theme.ts` or `global.css`: `--t-l1`, `--t-l2`, `--t-l3` (size) and one weight `--w-strong: 600`.

**Doc changes needed:** DS 14.1 ("1rem, weight 500") and DS 4 (`title` 19 / 600) become L1.

---

## 2. Inputs

### Anatomy, top to bottom

```
  Label (0.8125rem, ink-2, optional marker)      <- always above, never a placeholder
  [ ₹ | 50,00,000                      ]         <- unit inside the row, value in mono
  50 lakh                                        <- echo, only for rupee fields
  Hint (12 words max, only while focused)
  Error (alert colour, under the field)          <- replaces the hint
```

| Part | Rule | Source |
|---|---|---|
| Label | Above the field. Short, sentence case, no colon. Never use a placeholder as the label | [S4] |
| Unit or prefix | Fine for a symbol (₹, %). **Screen readers skip prefixes and suffixes**, so the *label or hint* must also carry the unit when it matters: "Amount in rupees" | [S4] |
| Hint | One short sentence, no full stop. Shown only on focus (DS 14.2). Linked with `aria-describedby` | [S4] [S16] |
| Error | Under the field, after the hint. Replaces the hint. Linked with `aria-describedby`. Field gets `aria-invalid="true"` | [S1] [S14] |
| Error never colour alone | The text names the problem. A red border is only extra | [S9] |
| Keep what was typed | Never clear a field because it has an error | [S1] [S2] |

### Required and optional: the decision

Sources disagree on the method:

| Source | Says |
|---|---|
| NN/g [S6] | Mark every required field with `*` or the word "required". Marking optional ones too is allowed |
| GOV.UK [S5] | Mark **optional** fields with "(optional)". "Never mark mandatory fields with asterisks" |
| W3C WAI [S14] [S12] | Put visible text such as "(required)" in the label. Also set `required`/`aria-required` |

**Decision: mark the optional fields, in the label, with the word "(optional)".**

Why, for this app:
1. In our sheets **optional fields outnumber required ones**. Save has Tags, Note and Reminder as optional; only Title matters. Marking the minority is less noise.
2. A word needs **no legend** ("* required") and screen readers read it as written. A `*` is often read as "star".
3. Calculator fields all have defaults and are all needed. **No marker at all** there. Marking everything marks nothing.
4. Still set `aria-required="true"` on the few required inputs. [S14]

**Where this disagrees with the first plan:** the plan was `*` plus a legend. NN/g supports it, GOV.UK and the
W3C tutorial point to words. Words win here.

### Keyboard types

| Field | Use | Why | Source |
|---|---|---|---|
| Money, percent (decimals allowed) | `inputmode="decimal"` | Digits and a decimal key | [S4] [S17] |
| Whole counts (years, months, days, "Days before") | `inputmode="numeric"` | Digits only | [S4] [S17] |
| Negative allowed | **omit `inputmode`** | Some phones show no minus key on the number pad | [S4] [S17] |
| Name, note, tag | default `text`, `autocomplete="off"` | | |
| Date | `type="date"` (DS 11) | The phone's own picker is accessible | |
| Never | `type="number"` | Fights our grouping (1,50,000) and scroll-wheel edits | [S4] |

`spellcheck="false"` on names of things that are not words (tags, category names). [S4]

### Autofocus

- **Do** focus the first field when a sheet opens *if typing is the whole job* (Paste, Add expense: Amount).
  On Android the keyboard may not appear unless the window is focused. Focus after the sheet is mounted. [S22]
- **Do not** autofocus on a form that mostly has defaults (a calculator). The keyboard would cover the Result.
- **Do not** autofocus a sheet that is a choice list (Copy as, a picker).
- After an error on press: focus goes to the **first invalid field** (section 3).

---

## 3. Validation

### When

| Place | When to check | Why | Source |
|---|---|---|---|
| A sheet or form with a button (Add expense, Save, Limits) | **On press** of the primary button. After the first error, re-check a field **as it changes** so the message clears when fixed | Early errors while typing are noise | [S2] |
| A live calculator (no button) | When the person **leaves a field that has been touched**. Hide the Result while any field is invalid | There is no press to wait for | [S8] |
| Never | On every keystroke for a first error | "12" is not an error on the way to "120" | [S2] |

**Where the sources disagree:** GOV.UK says do *not* check when leaving a field, only on continue [S2].
NN/g says check once the person has finished a field [S8]. We follow GOV.UK for sheets and NN/g for
calculators because calculators have no continue button. `UX-GUIDELINES.md` 5.3 ("validate on blur") becomes this table.

### Don't disable the submit button (decided)

| Option | Result |
|---|---|
| Grey out Done until valid | The person cannot tell *why*. A disabled button gives no message and is skipped by screen-reader focus [S29] |
| **Leave it enabled, check on press, say what to fix** | Always works, always explains |

**Decision: never disable a primary button for a bad or empty value.** GOV.UK does not discuss disabling [S2];
the case rests on NN/g's "Why disabled buttons hurt UX" [S29, title only] and Adrian Roselli's write-up [S29].
**Weak evidence, but cheap to follow.**
Allowed exceptions: a *secondary* control whose only input is empty and obvious ("Add" next to an empty tag box).

**Code to change:** `PasteSheet` "Use" is disabled when empty. Make it enabled and answer "Paste something first".
Also `.btn:disabled { opacity: .5 }` breaks DS 7 ("no opacity trick"): use `ink-3` text and the `line` border.

### What happens on a failed press (in order)

1. Do not close the sheet. Keep every typed value. [S1]
2. Show the message under each bad field.
3. **Move focus to the first bad field** and scroll it into view above the keyboard. [S3]
4. Screen readers hear the label, "invalid", then the message, because of `aria-invalid` + `aria-describedby`. No `role="alert"` is needed when focus moves. [S11]
5. If 3 or more fields are bad, add one line above the footer: "Fix 3 fields to continue". (our choice)

Live calculators keep today's single line under the form with `role="status"` (polite). Do not use
`role="alert"` for every keystroke: over-announcing is a listed failure. [S11]

### Wording

| Do | Don't | Source |
|---|---|---|
| "Enter an amount above zero" (empty or wrong: say the action) | "Invalid input", "This field is required" | [S1] |
| "Rate can't be more than 50%" (say the limit) | "Out of range" | [S1] [S10] |
| "Name must be 30 characters or less" | "Too long" | [S1] |
| Reuse the label's words | "Please enter a valid value" | [S1] |
| Suggest the fix when known: "Pick a date after today" | "Date error" | [S10] |
| Avoid "sorry", "please", "valid", "invalid" | | [S1] |

### Limits per field type (proposed defaults, tune per tool)

| Field | Required | Allowed | Message |
|---|---|---|---|
| **Money** (₹) | Yes in a form, no for limits | Above 0. Up to 2 decimals shown. Up to 14 digits typed. Cap at ₹1,000 crore | "Enter an amount above zero" / "Amount can't be more than ₹1,000 crore" |
| **Money, zero allowed** (opening balance) | Yes | 0 or more | "Enter 0 or more" |
| **Percent, rate** | Yes | 0 to 100. A tool may set a lower cap (loan rate 50) | "Rate can't be more than 50%" |
| **Percent, change** (growth, return) | Yes | -100 to 1000. Minus allowed, so no `inputmode` | "Enter a number between -100 and 1000" |
| **Years** | Yes | Above 0, up to 50. Decimals only if the tool says so | "Term can't be more than 50 years" |
| **Months** | Yes | Whole number, 1 to 600 | "Enter a whole number of months" |
| **Date** | Yes in expense, reminder | A real calendar date. Reminder: today or later. Expense: not more than 1 day ahead | "Pick a date" / "Pick a date after today" |
| **Text name** (title, category, list) | Title: no (falls back to the default). Category: yes | 1 to 30 (category, tag) or 120 (title) characters. Trim. Duplicate names: reuse the existing one, say so | "Give it a name" |
| **Note** | No | 0 to 5000 characters. No error: `maxLength` stops typing and a counter shows near the end | none |
| **Phone-free** | | We never ask for phone, email or card numbers. `last4` is the one numeric ID and is exactly 4 digits | "Last 4 digits must be exactly 4 numbers" |

- A rule that **cannot be broken by typing** needs no message: `maxLength`, `cleanMoney` already do this (UX 5.3).
- **Silent fixing is not allowed.** If a value is changed or dropped, say so. [S9]
  Today `cleanLimit` quietly removes a limit typed as "0" or "abc" (section 8).

---

## 4. Selects and pickers

### Which control

| Options | Control | Notes |
|---|---|---|
| 2 to 4, labels of 10 characters or less | **Segmented** | Wraps to 2 by 2 at large font (DS 14.3). Today's rule is 2 to 3; 4 is allowed if short. 4 is **unproven** at 360px and 200% font |
| A set the person builds (tags, categories) up to about 8 | **Chips** that wrap | Multi-select: `aria-pressed`. Single choice: radio-like, one pressed |
| 5 or more, or a list that grows | **Picker row** that opens a **picker sheet** | Section below |
| Many and grouped ("Opens on": 51 tools) | Picker sheet **with search** and group headings | |
| A date | Native `type="date"` | It is already a platform picker |

### Why not the phone's own `<select>`

- The open list is drawn by the browser or system. **You cannot set its colours or spacing.** [S18]
  So in our dark theme it can open light, with the wrong font, and ignore our radii and `ink-3` border (DS 9).
- Mobile research found native dropdowns lower the sense of control and overview in some cases. [S19]
- **Honest limit:** no source says native selects are *unusable* on Android. The problem is looks and
  consistency, not function. A picker sheet costs one component and some focus code. Try both on the phone before
  removing every `<select>`. **Unproven.**

### Picker sheet anatomy

```
  +--------------------------------------+
  |  Pay from                        [X] |   L1 title, Close top-right
  |  [ Search ]                          |   only when more than 8 rows
  |  --------------------------------    |
  |  Recent                              |   L3, only if recents exist
  |  HDFC card                      tick |   row 48px, tick on the chosen one
  |  Cash                                |
  |  All                                 |   L3
  |  Axis card                           |
  |  + Add new...                        |   last row, accent text
  +--------------------------------------+
```

| Part | Rule |
|---|---|
| Title | What is being chosen ("Pay from"), not "Select" |
| Close | X top-right (section 5). Choosing a row also closes. No footer button: a pick is one tap |
| Search | Only above 8 rows. Filters as you type. Keeps the keyboard type `text`. "No match. Add it?" as the empty state |
| Row | 48px high, label left, **tick right on the chosen one** (not colour alone: DS 9). Role `option` inside a `listbox`, or radio |
| Recents | Up to 3, on top, own L3 heading, only when the list has 6 or more |
| Add new | The **last** row, accent text, "Add new..." |
| Height | Content height, **maximum 60% of the visible area**; list scrolls inside. Rows 48px means 8 fit on a short phone |
| Where it opens from | From a **full screen**: as a sheet. From **inside a sheet**: do **not** stack. Swap the sheet's content for the list, with a Back arrow on the left. NN/g warns that stacked sheets make Back and X confusing [S7] |

---

## 5. Bottom sheets and dialogs

### Anatomy

```
   +---------------------------------------+
   |              -- grab handle --        |   decoration only
   |  Add expense                      [X] |   L1 left, Close right, 44px
   |  ------------------------------------ |   hairline only when body scrolled
   |  ...content scrolls here...           |
   |  ------------------------------------ |
   |  [ Cancel ]        [ Add expense   ]  |   sticky footer, above the keyboard
   +---------------------------------------+
```

| Part | Rule | Source |
|---|---|---|
| Title | Left. Names the job | [S15] |
| **Close (X)** | Top-right, 44px, named "Close". **Visible always.** The grab handle is not enough: users miss it | [S7] [S15] |
| Content | Scrolls. Header and footer do not | |
| **Footer** | Sticky, bottom. **One primary action**, filled `accent-fill`, named for the job ("Add expense", "Save", "Use"). Optional "Cancel" to its left, bordered `ink-3` | our choice (see below) |
| Never | The primary action in the header | our choice |
| Information-only sheets | No footer. X only (History, Copy as) | |
| Choice sheets | No footer. Tapping the row is the action (section 4) | |

### Where the evidence disagrees with the plan

| Source | What it says |
|---|---|
| NN/g [S7] | A clear **Close** at the **top** of the sheet. Does not say left or right |
| APG [S15] | Every dialog should have a visible element that closes it |
| Apple HIG [S25] (summary only; page did not load) | Done "typically" at the top-right of a sheet, **and** people expect dismissing buttons "at the bottom of the view, in the trailing corner". Apple contradicts itself |
| Material full-screen dialog [S26] (secondary sources) | Close **X top-left**, **Save text button top-right** |
| BT [S30] | Close X top-right, Escape, scrim tap |

**So:**
- **X top-right: supported** (web convention, NN/g "top"). Material puts it top-left, but our full screens already use a left
  Back arrow, so a right-hand X makes "this closes" different from "this goes back". NN/g warns that Back and X confuse. [S7]
- **Primary in the footer: not what Apple or Material do.** They put Done or Save at the top. We still pick the footer because
  our own rule is "primary actions in the bottom 60%" (DS 8) and a footer rides above the keyboard. This is a **design choice,
  not an evidence-backed one**. Today's code (Done in the header) breaks our own DS 8.
- Keep "Done" for **settings-style sheets** that save as you go (nothing to submit): those show only X.

**Doc changes needed:** DS 12 ("primary action right in the title row"), DS 14.5b, and `Sheet.tsx`'s `action` slot.

### Dismiss and dirty forms

| Rule | Detail | Source |
|---|---|---|
| Dismiss ways | X, Cancel, scrim tap, Escape, Android back. All do the same thing | [S7] [S15] |
| Clean form | Close at once. No question | [S24] |
| **Dirty form** (any value changed) | Ask first: title "Discard changes?", buttons **Keep editing** (default, focused) and **Discard** (`alert` text) | [S24] [S28] |
| Never | "Are you sure?", a "don't ask again" tick | [S24] [S28] |
| Choice, info and tiny sheets | Never ask (Copy as, History, Paste with empty box) | [S24] |

"Dirty" = current values differ from the values the sheet opened with. Compare once on close.
This is a **draft** being thrown away, not a delete, so it does not need Undo (CLAUDE.md "every delete is undoable" is about saved items).

### Height and keyboard

| Rule | Detail | Source |
|---|---|---|
| Height | Fits its content. Maximum **88% of the visible height**, not 78% of the screen. Body scrolls | our choice |
| Keyboard open | The footer must stay visible above the keyboard. Resize the layout, do not let the keyboard cover it | [S22] |
| Android | `adjustResize` (or the Capacitor Keyboard resize mode). **`capacitor.config.ts` sets neither today: check on the phone** | [S22] |
| In a WebView | Read `visualViewport.height`, not `innerHeight`: the keyboard shrinks the visual viewport only | [S23] |
| Focused field | `scrollIntoView({ block: 'center' })` after the keyboard opens | our choice |
| Landscape | Side panel, 440px max (DS 5). Same anatomy | DS 5 |
| No overlap | One sheet at a time. The snackbar sits **above** an open sheet's footer or waits | [S7] |

### Focus

- On open: focus the first field, or the title if there is no field. Focus a static title when the content is long. [S15]
- **Trap Tab inside** the sheet and make the page behind `inert`. Today `App.tsx` makes the page inert only for Settings and History, not for Save, Add to list or Expense sheets. [S15]
- Escape closes. On close, **focus returns to the button that opened it**. [S15]
- If the sheet confirms something hard to undo, start focus on the safe button ("Keep editing"). [S15]
- Keep `aria-modal="true"` and `aria-labelledby` (already done in `Sheet.tsx`). [S15]

---

## 6. Back navigation independence

**Rule:** a person must be able to leave any screen or sheet with something **on the screen**. The Android back
button must also work, but is never the only way. Reasons: some people use gestures badly, some phones
have a hardware key that is hard to reach, and the sheet may look like a page. [S7]

| Thing | Visible exit | Android back does |
|---|---|---|
| Full screen (calculator page, Settings, Trash, a note) | **Back arrow**, top-left, 44px (`ScreenHeader`) | Goes up one level |
| Bottom sheet with a form | **X** top-right and **Cancel** in the footer | Closes the sheet (asks first if dirty) |
| Choice or info sheet | **X** top-right | Closes the sheet |
| Picker swapped into a sheet | **Back arrow** top-left | Returns to the sheet's form |
| Discard confirm | **Keep editing** button | Same as Keep editing |
| Snackbar | None needed. It leaves by itself | Not involved |
| Side panel (landscape history) | **X** top-right | Closes it |

Order of Android back (already in `App.tsx`, keep it): confirm, then sheet, then overlay (Settings, History),
then screen, then tab, then exit. It is a stack, so the **newest** layer closes first.

**Today's gap:** only `PasteSheet` calls `useBackHandler`. Every other sheet ignores it, so back probably closes the
whole screen *under* the sheet and throws the draft away. **Fix once, in `Sheet.tsx`**, so every sheet gets it:
`useBackHandler(true, requestClose)` where `requestClose` runs the dirty check. (Not run on a phone yet.)

---

## 7. Toasts and snackbars with an action

Example: "Backup saved to Downloads/Calc   Open folder".

| Rule | Detail | Source |
|---|---|---|
| Use for | Feedback about something just done. Not for errors that block (those go under the field) | [S20] |
| Text | One line. Two on a narrow phone. Names the result ("Backup saved to Downloads/Calc") | [S27] |
| **One action only**, never "Dismiss" or "Cancel" | | [S27] |
| Action style | **Accent text button, no fill, no border** (DS 9 "a quiet text action in a bar"). Material: a coloured text button, because filled buttons draw too much attention | [S27] |
| Action size | 44px high touch area, 16px side padding | [S13] |
| Action label | A verb plus noun: "Open folder", "Undo". Not "OK" | our choice |
| Duration, no action | **4 s** | our choice (one secondary source says 4 to 10 s) |
| Duration, with action | **8 s** for "Open folder". Keep **6 s** for Undo only if the Undo is also in History | our choice, **unproven** |
| Pause the timer | While the bar is pressed or focused, and for screen-reader users | [S21] |
| Long or critical | If it must stay, use no timer and add a Close icon | [S21] |
| Announce | `role="status"` (polite). **Never** `role="alert"` for success | [S11] |
| One at a time | A new toast replaces the old one. Never queue | [S21] |
| Position | Above the footer of an open sheet, else above the tab bar. Never over the keypad | UX 2 |
| Motion | Slide up 160ms. With reduced motion: fade or instant (DS 6) | DS 6 |
| Colour | `raised` ground, `ink` text. Not `positive`/`negative` | DS 3 |

**Caveat on the example:** the web download used now (`downloadTextFile`) cannot know the folder
and has no "Open folder". Show that wording only after the native Filesystem plugin is in. Until then say
"Backup saved to your downloads" (as today), with no action. **Check before promising a path.**

---

## 8. Apply to the app

Read from `src/features` and `src/components` on 2026-11-02. "Not run on a phone" applies to all of it.

### Shared pieces first (one change fixes many screens)

| Piece | Gap today | Change |
|---|---|---|
| `Sheet.tsx` | No visible close. `action` slot puts the primary in the header. No sticky footer. No back handler. Page behind not inert (except Settings and History). No dirty check. 78% max-height, no keyboard handling | Add X, `footer` prop, `useBackHandler`, `inert` on the page, `dirty` prop, 88% / visual-viewport height |
| `ScreenHeader.tsx` | Title 1rem / 500 | L1 tokens (section 1) |
| `SnackBar.tsx` | Only "Undo", fixed 6 s, no pause, no action prop | `action: {label, onPress}`, per-snack duration, pause on press |
| New `PickerSheet` | Does not exist | Section 4. One component, used by every 5+ list |
| New `useFormErrors` or similar | Errors go to a store `notice` that **only `Display.tsx` (the calculator tab) renders** | Per-field errors in the sheet itself |

### Screens

| Screen | Current gap | What to change |
|---|---|---|
| **Calculator pages** (`ToolScreen`) | One error line under the whole form, not next to its field. Native `<select>` for 4+ options. Title 1rem/500. Back is fine | Error under the field plus `aria-describedby`. Picker row for 5+. L1 title. Keep `role="status"` |
| **Save sheet** | "Done" in header. No X, no Cancel, no dirty check. Tags, Note, Reminder not marked optional. Reminder date in the past is accepted silently. Back not wired | Footer "Save" / "Update". X. Dirty confirm. "(optional)" on Tags, Note, Reminder. Date: "Pick a date after today" |
| **Settings** | Back arrow is right. Three native `<select>`s, one with 50+ grouped options ("Opens on"). Backup result is plain text, no action | Picker sheet with search and groups for "Opens on". Decimal places has few options: keep or segmented. Backup toast with action after Filesystem plugin |
| **Budget: Add / Edit expense** | "Done" in header. **Empty or zero amount: the message goes to a notice nobody sees here, so the sheet seems to do nothing** (verify on the phone). Amount label does not say rupees. Category chips grow without limit | Footer "Add expense". Error under Amount, focus it. Label "Amount in rupees". Above 8 categories: picker row |
| **Budget: Category sheet** | "Done" in header. A limit typed as 0 or letters is **silently dropped** (`cleanLimit`). "Delete category" is a link in the body with no confirm and no Undo seen in the sheet | Error "Enter an amount above zero, or clear the box". Delete: use the snackbar Undo (DS rule) |
| **Budget: Limits sheet** | Same as above. "Add" for a category is disabled when empty (allowed: secondary) | Same fixes. Show "Added" or "Already exists" |
| **History** (overlay sheet) | No X. "Clear all" in the **header**, next to nothing, danger colour: easy to hit. Typed CLEAR confirm is good | X top-right. Move "Clear all" to the body bottom or a row. Keep CLEAR |
| **Notes** (`SavedScreen`, `TapeScreen`) | Back arrow and back handler present. Save sheet from the tape has the same sheet gaps. Tape error is `role="alert"` with no focus move (fine) | Inherit the sheet fixes |
| **Due** | No header (it is a tab). Each row has Mark paid, Snooze, Remove in a row. **Remove has no confirm or Undo** in the code seen | Remove: snackbar Undo. Keep the 44px link buttons |
| **Trash** | Back arrow present. **"Empty Trash" deletes for good, no confirm, no Undo** (`emptyTrash` just filters). Breaks CLAUDE.md "every delete is undoable" | Confirm sheet "Delete 4 items for good?" with Keep and Delete |
| **Paste sheet** | Back wired (the only one). "Use" is disabled when empty. No X. Primary is inside the body, not a footer | Footer "Use", always enabled. Empty: "Paste something first" and focus the box. X |
| **To list sheet** | "Add" in header. Native `<select>` for "List". **If `addToList` returns nothing, the sheet does nothing and says nothing.** No X | Footer "Add". Picker row when more than 4 lists, as a swap, not a stack. Show an error. X |
| **Copy as sheet** | Title only, no X. No back handler. Rows are the actions (fine) | X. Back handler comes free from `Sheet` |
| **Snackbar / notices** | "Copied" is an inline notice under the answer (2.2 s). Undo bar is 6 s | Keep both. Add the action prop for "Open folder" later |

### Suggested order

1. `Sheet.tsx`: X, footer, back handler, inert. This fixes 7 screens.
2. Per-field errors and "focus first bad field" helper. Fix the Budget silent failure and To list silent failure.
3. Trash and Due: confirm or Undo (these are data-loss bugs, not styling).
4. L1/L2/L3 tokens.
5. `PickerSheet`, then replace the 3 Settings selects and the To list select.
6. Snackbar action prop.

---

## 9. Review checklist (add to DS 13 and 14.6)

- [ ] Sheet has a visible X (44px, named "Close") top-right
- [ ] The one primary action is in a sticky footer, not the header
- [ ] Android back closes the newest layer; X and Cancel do the same
- [ ] Dirty form asks "Discard changes?"; a clean form does not
- [ ] Primary button is never disabled for a bad value
- [ ] Failed press: message under the field, focus on the first bad field, typed values kept
- [ ] Optional fields say "(optional)"; required fields have `aria-required`
- [ ] Each input has the right `inputmode`; no `type="number"`
- [ ] Unit is in the label or hint too, not only as a prefix
- [ ] 5 or more choices use the picker sheet; none stacks a sheet on a sheet
- [ ] Toast has at most one action, accent text, 44px, `role="status"`
- [ ] Checked at 360px, both themes, 200% font, with the keyboard open

---

## 10. Sources

Fetched in full unless marked. "Summary only" means the page did not load and the claim comes from a search
result summary: treat as weaker.

| Tag | Source |
|---|---|
| S1 | GOV.UK, Error message: https://design-system.service.gov.uk/components/error-message/ |
| S2 | GOV.UK, Validation pattern: https://design-system.service.gov.uk/patterns/validation/ |
| S3 | GOV.UK, Error summary: https://design-system.service.gov.uk/components/error-summary/ |
| S4 | GOV.UK, Text input: https://design-system.service.gov.uk/components/text-input/ |
| S5 | GOV.UK, Question pages ("(optional)"): https://design-system.service.gov.uk/patterns/question-pages/ |
| S6 | NN/g, Required fields: https://www.nngroup.com/articles/required-fields/ |
| S7 | NN/g, Bottom sheets: https://www.nngroup.com/articles/bottom-sheet/ |
| S8 | NN/g, Errors in forms: https://www.nngroup.com/articles/errors-forms-design-guidelines/ (summary only; fetch failed) |
| S9 | WCAG 2.2, 3.3.1 Error Identification: https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html |
| S10 | WCAG 2.2, 3.3.3 Error Suggestion: https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html |
| S11 | WCAG 2.2, 4.1.3 Status Messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html |
| S12 | WCAG 2.2, 3.3.2 Labels or Instructions: https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html |
| S13 | WCAG 2.2, 2.5.8 Target Size (24px floor; our 44px is stricter): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
| S14 | W3C WAI, Form validation tutorial: https://www.w3.org/WAI/tutorials/forms/validation/ (covers `required`, not `aria-invalid`) |
| S15 | W3C APG, Modal dialog pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ |
| S16 | W3C APG, Names and descriptions: https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/ |
| S17 | MDN, `inputmode`: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode |
| S18 | MDN, Advanced form styling (select popup cannot be styled): https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Advanced_form_styling |
| S19 | Baymard, Native dropdowns on mobile: https://baymard.com/blog/mobile-dropdown-navigation (summary only) |
| S20 | Android, Compose snackbar: https://developer.android.com/develop/ui/compose/components/snackbar |
| S21 | Android, Snackbar class (close icon, one at a time, indefinite): https://developer.android.com/reference/com/google/android/material/snackbar/Snackbar |
| S22 | Android, Soft keyboard and layout: https://developer.android.com/develop/ui/views/touch-and-input/keyboard-input/visibility |
| S23 | MDN, VisualViewport: https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport |
| S24 | Cloudscape, Unsaved changes: https://cloudscape.design/patterns/general/unsaved-changes/ |
| S25 | Apple HIG, Sheets: https://developer.apple.com/design/human-interface-guidelines/sheets (summary only) |
| S26 | Material full-screen dialog, via SAP Fiori Android and mdui docs: https://www.sap.com/design-system/fiori-design-android/v25-8/components/system-components/dialogs/usage (secondary; m3.material.io did not load) |
| S27 | Material snackbars (action is a coloured text button, one action): https://material.io/components/snackbars (summary only) |
| S28 | GitHub Primer, Confirmation dialog ("Discard changes?", not "Are you sure?"): https://primer.style/product/components/confirmation-dialog/guidelines (summary only) |
| S29 | NN/g video "Why disabled buttons hurt UX": https://www.nngroup.com/videos/why-disabled-buttons-hurt-ux-and-how-to-fix-them/ (title only) and Adrian Roselli, Don't disable form controls: https://adrianroselli.com/2024/02/dont-disable-form-controls.html (summary only) |
| S30 | BT design guidelines, Modals (X top-right, Escape, scrim): https://www.bt.com/guidelines/modals (summary only) |

**Not verified:** the exact Material 3 values for snackbar duration, segmented button count and full-screen dialog
layout. `m3.material.io` pages load by script and returned nothing. The 4 to 10 second range is from a third-party doc.

---

## 11. Summary of decisions

1. **Close X top-right and primary in a sticky footer:** X is well supported. Footer primary is **our choice**: Apple and Material put Done or Save at the top.
2. **Required marking:** plan said `*` plus legend. Evidence (GOV.UK, W3C wording) favours **"(optional)" in words**; NN/g allows either. Changed.
3. **Validation:** plan said blur and submit. GOV.UK says submit only. Result: **submit for sheets, blur-after-touch for live calculators**.
4. **Never disable the primary button:** supported by weak evidence only (NN/g video title, one blog). Cheap, so adopted.
5. **Picker sheet for 5+:** native `<select>` cannot be themed [S18]. No source says it is unusable, so this is about looks. Keep one native-vs-sheet test on the phone. Never stack a picker on a sheet.
6. **Biggest finds in our code:** sheets have no X and mostly ignore Android back; Budget errors are invisible; Empty Trash and Due Remove have no undo; weight 700 is not loaded, so headings top out at 600.
