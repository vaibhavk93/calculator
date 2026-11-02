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

Value is carried by **sign and weight**, not hue — `+₹4,12,000` / `−₹57,650` —
which is also how a private-bank statement reads, and how a colour-blind user
reads it too.

**Only one semantic colour exists: `alert`, for overdue.** That is the one
state urgent enough to earn a hue. Everything else earns its emphasis through
typography and position.

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
