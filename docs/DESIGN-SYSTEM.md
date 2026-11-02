# Design System v2

**Status:** v2.0 — replaces the colour and type sections of `UX-GUIDELINES.md`
**Why there's a v2:** v1 was generic. This document says exactly why, and what
replaced it.

---

## 1. What Was Wrong With v1

An honest post-mortem, because the same mistakes recur if they aren't named.

| # | The tell | What I did | Why it reads as machine-made |
|---|---|---|---|
| 1 | **Uppercase tracked eyebrows** | `TAPE · HDFC CARD`, `PINNED`, `THIS MONTH`, `ALL CATEGORIES` — a tiny all-caps letter-spaced label above *every* section | This is the single most saturated AI layout reflex. One deliberate kicker is a voice. An eyebrow on every section is grammar, applied without thought. |
| 2 | **Identical card grids** | Saved was card, card, card — same radius, same border, same padding, same internal structure | Repetition without hierarchy. Nothing earns attention because everything looks equally important. |
| 3 | **Cards as the default answer** | Every grouping became a bordered rounded box. The EMI screen had a card *inside* a card. | Nested cards are always wrong. A card is a strong affordance spent on nothing. |
| 4 | **Category-reflex colour** | Teal on white | If you can guess the palette from the category alone, it's the first reflex. "Calculator app" → teal/blue Material is exactly that guess. |
| 5 | **Radius and spacing soup** | 11, 12, 13, 14, 15, 16, 17, 18, 19px radii; near-identical padding everywhere | No rhythm. Real systems have few, deliberate values. |
| 6 | **One font, one weight, no contrast** | Inter at 400/500/600 throughout, numbers and words treated identically | The numbers are the entire content of a calculator. They were styled like labels. |

**The fix is not to be weird.** For product UI, familiarity is a feature and the
failure mode is strangeness without purpose. The fix is **craft and restraint**:
fewer decisions, each one actually made.

---

## 2. The Scene

Before colour, one concrete sentence about who uses this and where:

> *A senior PM in Bengaluru, phone in one hand at 11pm at his desk working out
> whether to prepay a home loan — and again at 7:40am in bed, checking what's
> due this week. Low ambient light both times. One thumb. Real money at stake.
> He wants calm precision, not encouragement.*

**That sentence forces dark.** Not "dark because tools look cool dark" — dark
because both real usage moments are in low light, held close to the face.
Light theme exists and is complete, but dark is the default.

### Category-reflex check

| Altitude | The obvious answer | Ours |
|---|---|---|
| **First-order** — guessable from "calculator app"? | White, Material, teal or blue | ❌ Rejected — that was v1 |
| **Second-order** — guessable from "calculator, but not Material-light"? | Terminal green on black, or neo-brutalism | ❌ Also rejected |

Our accent is a **citron-olive at hue 113°**. Terminal green sits around 145°
at full chroma. These are not the same colour and do not read the same: 113°
reads as brass, patina, an instrument's active indicator. The surface is a
true neutral at **chroma exactly 0** — no hidden warm or cool tint.

---

## 3. Colour

**Strategy: Restrained** — the product default. Neutral surfaces, **one accent,
used on under 10% of any screen.**

Authored in OKLCH; hex is the compiled output.

### Dark (default)

| Token | OKLCH | Hex | Role |
|---|---|---|---|
| `bg` | `oklch(0.12 0 0)` | `#060606` | App ground |
| `surface` | `oklch(0.16 0 0)` | `#0D0D0D` | Recessed panels, operator keys |
| `raised` | `oklch(0.21 0 0)` | `#181818` | Digit keys, elevated rows |
| `line` | `oklch(0.27 0 0)` | `#262626` | Hairlines — the primary grouping device |
| `ink` | `oklch(0.97 0 0)` | `#F5F5F5` | Results, amounts, primary text |
| `ink-2` | `oklch(0.72 0 0)` | `#A4A4A4` | Labels, secondary |
| `ink-3` | `oklch(0.60 0 0)` | `#818181` | Tertiary, timestamps |
| `accent` | `oklch(0.84 0.17 113)` | `#CCD539` | **Interaction only** |
| `accent-ink` | `oklch(0.18 0.04 113)` | `#121300` | Text on accent |
| `accent-dim` | `oklch(0.52 0.10 113)` | `#6A6F20` | Accent borders, inactive |
| `alert` | `oklch(0.68 0.17 28)` | `#EF675A` | Overdue only |

### Light

| Token | Hex | Role |
|---|---|---|
| `bg` | `#FFFFFF` | Pure white — no hidden warmth |
| `surface` | `#F7F7F7` | Recessed |
| `line` | `#DEDEDE` | Hairlines |
| `ink` / `ink-2` / `ink-3` | `#121212` / `#525252` / `#5D5D5D` | Text ramp |
| `accent` | `#5C6100` | Deep olive — accent text/icons |
| `accent-fill` | `#CCD539` | Accent surfaces, with `#121300` ink |
| `alert` | `#BE241F` | Overdue |


### Light mode is not a recolour

Inverting hex values produces a bad light theme. Two things change structurally:

| Element | Dark | Light | Why |
|---|---|---|---|
| **Digit keys** | `raised` fill `#181818` — lighter than the ground | `#F2F2F2` fill — *darker* than the ground | In both themes the digits sit forward of the surface. Elevation reverses direction. |
| **Operator keys** | `surface` `#0D0D0D` — recedes | **No fill at all**, `ink-2` text | On white, any fill would push operators forward. Removing it is what makes them recede. |
| **`=` key** | `accent` fill `#CCD539` | `accent-fill` `#CCD539` — identical | The one element that stays the same in both themes, so the brand reads continuously |
| **Accent for text/icons** | `#CCD539` | `#5C6100` (deep olive) | The bright citron fails contrast as text on white. Fills keep the bright value; text uses the dark one. |
| **Undo bar** | `raised` `#181818` | `surface` `#F2F2F2` | Needs separation from the ground in both directions |

**The principle:** elevation is a *relationship*, not a colour. Something
"raised" moves away from the ground — lighter on dark, darker on light. Shadows
are used in neither theme.

### Verified contrast

Every pair computed, not eyeballed. WCAG AA needs 4.5:1 body, 3:1 large.

| Pair | Ratio | |
|---|---|---|
| `ink` on `bg` | **18.59** | ✅ |
| `ink-2` on `bg` | **8.13** | ✅ |
| `ink-3` on `surface` | **4.85** | ✅ |
| `accent` on `bg` | **12.68** | ✅ |
| `accent-ink` on `accent` | **11.75** | ✅ |
| `alert` on `bg` | **6.52** | ✅ |
| Light: `ink-3` on `bg` | **6.58** | ✅ |
| Light: `accent` on `bg` | **6.64** | ✅ |

### The rule that keeps it clean

> **Accent means "you can act on this." It never means "this is good."**

In a finance app, green naturally reads as *gains* — which would collide with
an accent that is also greenish. So the accent is reserved strictly for
**interaction**: the `=` key, the current selection, focus rings.

### Colour that means good or bad

**Changed 2026-11-02, by the owner's decision.** This section replaces an
earlier rule that banned good/bad colour outright and carried meaning through
sign and weight alone. The owner found results hard to read at a glance and
asked for red and green. The rule is changed here rather than worked around.

> **`positive` and `negative` mean "this is good / bad for you." They are the
> only colours allowed to carry that meaning, and they are never the only
> signal.**

| Token | Dark | Light |
|---|---|---|
| `positive` | `#5CD08A` | `#064A26` |
| `negative` | `#EF675A` | `#BE241F` |

Both clear 4.5:1 on `bg`, `surface` and `raised` in both themes, asserted in
`theme.test.ts`. The light green is *much* darker than it first looks on
purpose: a mid green and a mid red land at nearly the same lightness on white,
so hue would have been the only thing separating them. The test that caught
this asserts the pair are at least 1.4:1 against **each other**, which is what
makes them survive greyscale and red-green colour blindness.

Three constraints keep this from becoming decoration:

1. **Only where good and bad are unambiguous.** Money you save, a penalty you
   owe, the cheaper of two options. A number that is merely large, or merely a
   fact ("Total interest"), has **no tone**. A tie has no tone either.
2. **Never colour alone.** Roughly 1 in 12 men cannot separate red from green.
   Every toned value also carries the meaning in words for a screen reader, and
   signed amounts keep their `+` or `−`. Remove the colour and the result must
   still be fully readable.
3. **`negative` and `alert` share a hue on purpose.** `alert` still means
   "overdue, act now"; `negative` means "this number is against you". They never
   appear on the same row.

Everything that is *not* good or bad still earns its emphasis through
typography and position, exactly as before.

### Section colours (which part is this)

**Added 2026-11-02, by the owner's request**: lists looked the same, so two
sections were hard to tell apart. Research on grouped lists (Apple's "inset
grouped" style, used by Notes and Reminders) points the same way: one
continuous background wrapped around each section, from its heading down
through its rows.

The app now has **four colour meanings, and a colour never carries two**:

| Meaning | Colour | Where |
|---|---|---|
| You can act on this | `accent` | `=`, selected chips, focus, pinned pin |
| Good or bad for you | `positive`, `negative` | A result value, with a sign or a word |
| Overdue, act now | `alert` | The Overdue heading, an error |
| **Which section this is** | **`--tint-1` to `--tint-8`** | Tiles, section cards, an input card, headings |

A tint is **identity, never state**. It never means good, bad, tappable or
selected.

**Where a tint may appear:** the Tools home tiles; a group page's section
cards; a calculator's *input* card and its heading; the Notes and Due section
cards; the small dot in a search result.

**Where it may not:** the **Result card**, the sticky answer bar, any button,
or behind or beside a number that carries `positive` or `negative`. The Result
stays a plain `surface` card so a number's colour keeps its meaning. Overdue is
a plain card with an `alert` heading, not a tint.

| # | Used for | Dark | Light |
|---|---|---|---|
| 1 | Math and numbers (indigo) | `#201933` | `#E7E1F9` |
| 2 | Money and shopping (cyan) | `#192F33` | `#E1F5F9` |
| 3 | Units and travel (amber); Notes: calculations | `#322B1B` | `#F9F2E2` |
| 4 | Dates and health (plum); Notes: pinned | `#321B2B` | `#F9E2F2` |
| 5 | Loans and EMI (blue); Notes: lists; Due: this week | `#182435` | `#E0EBFA` |
| 6 | Savings and investing (violet) | `#2C1A32` | `#F3E1F9` |
| 7 | Tax and salary (slate) | `#23262A` | `#E5ECF5` |
| 8 | Business metrics (sand); Due: later | `#2B2722` | `#F6EFE5` |

(Exact values live in `src/lib/theme.ts`; this table is a guide.)

Constraints, all asserted in `theme.test.ts`:

1. **Hues stay out of red (345 to 25), green (110 to 175) and citron (55 to 80).** A tint can never be mistaken for bad,
   good or tappable. Tax and Business are near-neutral on purpose.
2. **Text passes.** `ink` on a tint is 12:1 or better; a heading in `tintInk` on its own tint is 6.4:1 or better (4.5 needed).
3. **Never colour alone.** Every section has a title and a count, so the colour only helps; remove it and the structure stays.
4. **One level of card.** A section card holds rows, not cards. Result and schedule rows are plain rows, never nested cards.

---

## 4. Typography

**IBM Plex Sans + IBM Plex Mono.** One superfamily, two registers. The contrast
axis is proportional vs monospace — a real axis, not two similar sans-serifs
competing. Plex was drawn for technical contexts, which is what this is.

### The rule

> **Mono for numbers you *read*. Sans for numbers you *press*, and for all words.**

| Context | Family | Why |
|---|---|---|
| The result display | **Plex Mono** | Digits don't shift width as the number changes |
| Amounts in ledgers and tables | **Plex Mono** | Columns align — the whole point of tabular figures |
| Keypad digits | **Plex Sans** | They're controls, not data. Sans reads as a key cap. |
| Labels, titles, body, buttons | **Plex Sans** | — |

A fixed rem scale, ratio ~1.2. Not `clamp()` — fluid type doesn't serve product
UI at consistent phone DPI.

| Step | Size / weight | Use |
|---|---|---|
| `display` | 44–52 / 300, mono | The live result |
| `amount` | 17–20 / 500, mono | Ledger amounts, EMI figures |
| `expression` | 15 / 400, mono, `ink-3` | The expression above the result |
| `title` | 19 / 600, sans | Screen titles |
| `body` | 15 / 400, sans | Rows, content |
| `label` | 13 / 400, sans, `ink-2` | Field labels, meta — **sentence case, normal tracking** |

**Banned outright:** `text-transform: uppercase` combined with positive
`letter-spacing` on small text. That is the v1 eyebrow. If a section needs
naming, it gets a sentence-case line in `ink-2` at 13px — or more often,
nothing, because position already says what it is.

---

## 5. Layout

### Hairlines, not boxes

The primary grouping device is a **1px rule in `line`**, not a bordered card.

| Surface | v1 (wrong) | v2 |
|---|---|---|
| Saved | Identical rounded cards in a stack | **A ledger** — full-bleed rows, hairline rules, amounts right-aligned in mono. It's a financial record; it should look like one. |
| Reminders | Identical rounded cards | **An agenda** — date in a left gutter, hairline rules, content right |
| Tools | 3×2 identical tiles + identical rows | A short favourites row, then a **dense ruled list** |
| Keypad | Keys inside a white card with a shadow | Keys directly on the ground. No container. |

Cards survive in exactly one place: the **EMI result**, where one figure genuinely
is the subject of the screen and deserves a distinct plane. **Nested cards never.**

### Few, deliberate values

| Property | Allowed values |
|---|---|
| Radius | **4** (chips, small marks) · **10** (keys) · **20** (sheets). Nothing else. |
| Spacing | 4 · 8 · 12 · 16 · 24 · 32 · 48 |
| Border | 1px, `line`. Never 2px+ as a coloured accent. |
| Elevation | Surface lightness only. **No shadows in dark mode.** |

### Landscape

Applies when `orientation: landscape` and height ≤ 520px: a phone on its side (about 360px
tall). Keyed on height, so a desktop window or tablet keeps the tall single column.

| Element | Portrait | Landscape |
|---|---|---|
| Navigation | Bottom tab bar | Left rail, `max(72px, 3.4rem)` wide so labels survive 200% font |
| Calculator | One column | Two panes: display + utilities, and the keypad full height on the right |
| Panels (scientific, memory) | Above the keypad | Under the utilities. Buttons 44px tall; memory is 3 × 2 |
| History | Bottom sheet, 78% high | Full-height side panel from the right, ≤ 440px wide |
| Undo bar | Above the tab bar | Under the history panel |
| Settings | Full width | Centred column, ≤ 640px |

Insets: the rail and panels respect `safe-area-inset-left/right` for notches.
Verified at 800×360 and 640×360, dark and light, at 200% font, and by rotating live.

### Rhythm

Density varies deliberately: the display area is generous and quiet, the
keypad is tight and active, ledger rows are medium. Uniform padding everywhere
is what made v1 feel flat.

---

## 6. Motion

150–250ms. **State only, never decoration.**

| Interaction | Treatment |
|---|---|
| Key press | Background steps `raised` → `line`, 90ms, ease-out |
| Result change | Opacity crossfade, 140ms. No counting-up animation — a number that animates is a number you can't read yet. |
| Screen push | Slide 16px + fade, 220ms, ease-out-quart |
| Sheet | Translate up, 240ms |
| Row delete | Height collapse + fade, 200ms |

Every one has a `prefers-reduced-motion` alternative — crossfade or instant.
Reveals enhance an already-visible default; content is never gated behind a
transition that might not fire.

---

## 7. Component States

Every interactive element ships all seven: default, hover, **focus-visible**,
active, disabled, loading, error. Half-built components are a product ban.

- Focus ring: 2px `accent`, 2px offset. Visible on keyboard, not on touch.
- Disabled: `ink-3` text, no background change, no opacity trick.
- Loading: skeleton rows in `surface`. **Never a spinner** — and never anything
  at all for pure arithmetic, which is instant.

---

## 8. Review Checklist

A screen ships only if every line passes:

- [ ] No uppercase + letter-spaced small text anywhere
- [ ] No two adjacent elements with the same card treatment doing different jobs
- [ ] No nested cards
- [ ] Radius is 4, 10 or 20 — nothing else
- [ ] Accent covers under 10% of the screen and marks only interaction
- [ ] Every number the user reads is Plex Mono, tabular
- [ ] Contrast verified by computation, not by eye
- [ ] Exactly one primary action
- [ ] Works at 360dp, in both themes, at 200% font size
- [ ] All primary actions in the bottom 60%
- [ ] Could a user fluent in Linear/Raycast/Stripe sit down and trust this?


---

## 9. Controls: hierarchy and borders

*Added 2026-11-02 after the owner used the app on a phone. Operators looked inert next to filled digits.*

Three treatments say three different things. Never mix them.

| Role | Treatment | Examples |
|---|---|---|
| A value you enter | Filled `key-digit` ground, no border | 0 to 9, 00, . |
| Something that acts on values | No fill, **1px `ink-3` border**, `ink-2` text | + − × ÷, ( ), %, C, Paste, Copy, Undo, chips, steppers |
| The one primary action | `accent-fill` ground, `accent-ink` text | =, Done, Add |
| Destructive | `alert` text | C, Delete |
| A quiet text action in a bar | `accent` text, no border | Save, Update, To list, Remind me on a list |

**Border colour.** A control's border and an input's underline use `ink-3`: measured 5.2:1 on the dark ground and 6.6:1 on
light. `line` is only 1.3:1, which is right for a separator and too faint for a control (WCAG non-text contrast asks for 3:1).
`line` is for separators only. A disabled control keeps `line` for its border and `ink-3` for its text. An input's underline
turns `accent` on focus.

**Pressed state.** Every pressable thing visibly responds: keys darken to `key-digit-pressed` and scale to 0.96 over 90ms;
rows darken to `key-digit-pressed`. State is never carried by colour alone: add a tick, a weight change or words.

**Size.** At least 44px in one direction. A function key may be 36px high if it is at least 62px wide.

## 10. Rows and lists

| Kind | Layout |
|---|---|
| Drill-down row (Tools home) | 56px. Name left. A small count (`ink-3`, mono) and a chevron right. Hairline below. No description at this level |
| Detail row (inside a group) | Title, and at most one dim line of 7 words or fewer |
| Ledger row (Notes, Due) | Title, one summary line, then tags and due state on one dim line. Amount right, mono |
| Search | One compact field, 8px under the status bar. While it has text, show a flat list with the group name dimmed on the right |
| Checkbox line | A 48px hit area around a 22px box (`accent-color`). A done line dims to `ink-3`. No strikethrough, so the amount stays readable |
| Progress header | Left: "N of M done · ₹X left" in `ink-2`. Right: the collected amount, large, mono. Under it: "collected of ₹Y" |
| Empty state | A title, one sentence, one button (UX 5.4) |

Grouping stays by hairline, not by box (section 5). No nested cards.

## 11. Forms (the calculator screens)

| Rule | Detail |
|---|---|
| Label | Above the field, `ink-2`, 0.8125rem, 5 words or fewer, sentence case |
| Value | Plex Mono. 16px side gutters, 16px between fields |
| Unit | Beside the value in `ink-3`: ₹ before, % and years after |
| Amounts | Digits group as you type using the Indian or international setting. Rupee fields show the amount in words under the field ("50 lakh"). The stored value stays plain digits |
| Hint | Shown only while the field is focused or when it caused an error. 12 words or fewer. Only if it prevents a wrong number |
| Choices | 2 or 3 short options: a segmented control with an underline on the chosen one. 4 or more: the phone's own dropdown |
| Rare fields | Under a closed "More options" line. At most 5 fields show by default. The line opens by itself if a hidden field differs from its default, and stays open once opened |
| The answer | A sticky bar under the header always shows the main result while you edit. The full list sits below the form |
| Defaults | Realistic, and they give a real result. A hidden example value says it is an example |
| Dates | The phone's native date input |

## 12. Chips, steppers, checkboxes and sheets

| Component | Spec |
|---|---|
| Chip | 44px high, 1px `ink-3` border, radius `r-md`, 0.875rem. Selected: `accent` text, `accent-dim` border, `aria-pressed`. Result chips appear after "=" only |
| Stepper | "−  value  +" in one bordered group. 48px buttons, mono value, a button is disabled at its limit |
| Bottom sheet | Grab handle, title left, the primary action right ("Done", "Add"). Content scrolls. One sheet at a time. Closes on scrim tap, Escape or the back button |
| Sticky answer bar | Label left (it wraps), value right (mono, never wraps), an optional quiet text action at the far right |
| Money value | Never breaks across lines. The label wraps instead |

## 13. Review checklist: additions

- [ ] Operators and utilities are bordered with `ink-3`, digits filled, one accent action
- [ ] Every control's border and every input underline is `ink-3`, never `line`
- [ ] Every pressable has a visible pressed state
- [ ] No money value wraps
- [ ] Hints show on focus only, and are 12 words or fewer
- [ ] No more than 5 fields show by default
- [ ] A screen with a "back" registers `useBackHandler`
- [ ] Checked at 360px, in both themes, and at 200% font size

---

## 14. Page anatomy: header, information, edit, result, keep and share

*Added 2026-11-02 after a full audit of every page. Six hand-built headers had drifted apart (icon sizes, the label on
Delete, a different style for the main action), and results, edits and sharing were mixed together. Every full screen now
has the same parts in the same order. Code: `ScreenHeader`, `KeepAndShare`, and the sections in `ToolScreen`.
Revised later the same day (0.5.0): Keep and share is now an icon row with no heading, and the floating answer is a bottom button.*

```
 +----------------------------------------------+
 |  <  Title (wraps, never cut off)   [icon] Save|   1. PAGE HEADER
 +----------------------------------------------+
 |  What you are working out                    |
 |  +----------------------------------------+  |   2. EDIT       tinted card
 |  |  Loan amount        Rate        Term   |  |
 |  +----------------------------------------+  |
 |  Result                                      |
 |  +----------------------------------------+  |   3. RESULT     plain card, never tinted
 |  |  Monthly EMI                 ₹43,391   |  |
 |  |  note, chart, table, how it works      |  |
 |  +----------------------------------------+  |
 |  [Copy] [Share] [List] [Remind]   Copied.    |   4. KEEP AND SHARE   one slim icon row, no heading
 +----------------------------------------------+
 |  [ Monthly EMI  ₹43,391 ]                    |   floating answer: bordered button, bottom edge
 +----------------------------------------------+
   The answer button shows only while the Result is scrolled out of sight. Tap it to scroll to the Result.
```

### 14.1 Page header

One component, `ScreenHeader`, for every full screen. A test fails if any other file draws `screen__bar`.

| Part | Rule |
|---|---|
| **Back** | First, always, a 44px icon button labelled "Back". It also answers the Android back button (`useBackHandler`) |
| **Title** | One `h1`, 1rem, weight 500. It **wraps** at a large font and is never truncated. Only a list's name is an editable title |
| **Icon actions** | Quiet icon buttons, at most two, after the title. Delete is a trash icon labelled "Delete <name>" (never plain "Delete") |
| **Primary action** | At most **one**, the rightmost: accent text, no border. "Save", "Update" (after saving), "Empty Trash". Disabled while there is nothing to save |
| **Nothing else** | No subtitle, no description, no help icon, no second text action. Information lives in the page, not the bar |
| **Section colour** | A group page tints its title. A calculator's header stays neutral |
| **Height** | At least 52px; it grows with a wrapped title |

### 14.2 Information on the page

Every piece of explanation has one home, in order of how much room it takes:

| Kind | Where | Rule |
|---|---|---|
| **Hint** | Under its field, **only while the field has focus** (or has the error) | 12 words or fewer. Only if it prevents a wrong number |
| **Error** | Under the form, `alert` colour, `role="status"` | Says what to do. Never "Invalid input". The Result is hidden while there is an error |
| **Note** | The last line of the Result card | At most 2 sentences. Keeps every disclaimer ("Estimate for FY2026-27. Verify with a CA", "as of <date>", "example rate") |
| **How this is worked out** | A disclosure at the foot of the Result | Keeps a visible arrow. Amounts are grouped (₹50,00,000) so they read |
| **Section heading** | Above each card | Says what the card is: "What you are working out", "Result", "Keep and share" |

There is no page-level intro text. The title and the blurb in the list already said what this is.

### 14.3 Edit section

| Rule | Detail |
|---|---|
| A **tinted card** under the heading "What you are working out" | The section colour of its group. It is the only tinted part of a calculator |
| Field | Label above (5 words or fewer), value in mono, unit beside it, digits grouped as typed, "50 lakh" beneath rupee fields |
| Order | The 3 to 5 fields that decide the answer, then "More options" for the rest |
| Choices | 2 to 3 short options as a segmented control (it **wraps** at a large font); more as the phone's own dropdown |
| Controls | At least 44px high. A switch has a 56 by 44 tap area around its track |

### 14.4 Result section

| Rule | Detail |
|---|---|
| A **plain `surface` card**, heading "Result" | **Never tinted**, so a number's colour keeps its meaning (good, bad) |
| The main answer | First row, largest. One per page |
| Rows | Label left, value right in mono. A value that does not fit **drops under its label**. Money never breaks; words wrap |
| Tables | Two columns: label and value rows. Three or more: one block per row (heading, then labelled values). **Nothing scrolls sideways**, at any font size |
| Chart | Only where it shows something the numbers cannot (a proportion, a trend). The numbers stay readable |
| The floating answer | A **bordered button at the bottom edge** (not a sticky heading with an underline at the top). It shows the main answer **only while the Result is scrolled out of sight**. Tapping it scrolls to the Result. It takes no room in the layout, and never duplicates an answer you can already see. Tables have no sticky header either |

### 14.5 Keep and share section

What to do with a finished answer. **One slim row of four icon buttons, with no heading and no card around it.**
Each button is at least 44px, has a visible border (`ink-3`) and an accessible name. The status text sits beside the icons.

| Button (icon) | Name | Does | Shown |
|---|---|---|---|
| Copy | **Copy** | Copies the whole story as text. Follows the Copy setting (see UX 22) | Always |
| Share | **Share** | Opens the phone's share sheet with the same text (copies, and says so, where there is none) | Always |
| List | **Add to a list** | Adds the amount to a list, as one line or several | Money answers only |
| Bell | **Remind me** | Saves the calculator with a reminder | Always |
| *Save* | | *Lives in the page header, not here: it is the page's one main action* | |

The text is built by `buildShareText`: the title, what was typed ("Loan amount: ₹50,00,000 · Rate: 8.5%"), the answers,
the note, and "Worked out in Calc". A bare number means nothing in a chat. Feedback is one line beside the icons
("Copied. Paste it anywhere."), cleared after about two seconds. An icon-only button must never rely on the icon alone:
its name is read by screen readers.

### 14.5a Pills (`.chip`) and touch area

A pill is **32px tall to look at** and has a **44px touch area**, made with a `::before` pseudo-element that extends
the hit box above and below. Do not make the pill itself 44px, and do not shrink the touch area to match. Neighbouring
pills must not overlap their touch areas by more than the gap between them.

### 14.5b Settings sections (and other sheets made of groups)

Settings is a stack of **tinted cards**, one per section, each with a heading: Appearance (1), Numbers (2), Behaviour (3),
Reminders (4), Your data (5), About (6). The tints come from the section colours (DS "Section colours") and follow the same
rules: never red, green or the accent. The Save sheet follows the same pattern: four tinted cards (Title, Tags, Note,
Reminder, where the reminder has a switch). History is one card per calculation: name, expression, "= answer", and the edit
and delete icons in their own column. No nested cards: a card holds rows, not other cards.

### 14.6 Checklist: a page is done when

- [ ] Its header is `ScreenHeader`, with at most one primary action
- [ ] It shows no answer twice at the same time
- [ ] Nothing scrolls sideways, at normal size **and at 200% font**
- [ ] Every control is at least 44px and has a name
- [ ] Only the Edit card is tinted; the Result card is plain (Settings and the Save sheet are the exception: their cards are all tinted, 14.5b)
- [ ] Pills have a 44px touch area; Keep and share is the icon row with names for screen readers
- [ ] Information is where 14.2 says, and a hint appears only on focus
- [ ] The scripted audit (`e2e/audit-harness.js`) reports nothing

