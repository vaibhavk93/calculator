# VK Calc — Personal Calculator Suite

> **The calculator that remembers.**

An all-in-one calculator for Android (iOS later): everyday math and converters,
a deep loan/EMI engine, India-specific investment and tax calculators, a
product-metrics pack — and a memory layer that turns any calculation into a
saved note with a reminder.

No ads. No account. No tracking. Works offline.

**Status:** Planning and design complete. No code written yet.

## Documents

| Doc | What's in it |
|---|---|
| [`PRD.md`](docs/PRD.md) | Full product requirements — input/output contract for all 86 calculators and features, phased build sequence, risks, definition of done |
| [`UX-GUIDELINES.md`](docs/UX-GUIDELINES.md) | Design principles, researched good/bad practices from the category, colour and type tokens, keypad spec, accessibility rules, review checklist |
| [`MEMORY-LAYER.md`](docs/MEMORY-LAYER.md) | The differentiator: notes, reminders, tapes. 30 mapped use cases, data model, privacy position |
| [`GTM-STRATEGY.md`](docs/GTM-STRATEGY.md) | How this competes for #1 downloads — positioning, ASO, retention mechanics, monetisation, launch sequence, honest counter-argument |
| [`TECH-DECISIONS.md`](docs/TECH-DECISIONS.md) | Every technical call explained in plain language, with cost and reversibility |
| [`DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) | **v2.** Colour, type and layout — plus a post-mortem of why v1 looked machine-made |
| [`RESEARCH-FINDINGS.md`](docs/RESEARCH-FINDINGS.md) | Market, competitive, user-review and platform research. Four findings that corrected the plan, and the gaps I could not close |
| [`DATA-FRESHNESS.md`](docs/DATA-FRESHNESS.md) | How the app stays correct as tax, GST, small-savings and currency rates change — and how reminders survive Android |
| [`MODEL-GUIDE.md`](docs/MODEL-GUIDE.md) | Which Claude model to build each phase with, and why a detailed spec lets you drop a tier |

## Scope

| Section | Contents | Count |
|---|---|---|
| A | Core calculator engine, history, settings, theming | 15 |
| B | Everyday converters and utilities | 15 |
| C | Loans & EMI | 11 |
| D | Investments & savings | 13 |
| E | Tax & salary (India) | 7 |
| F | Personalisation + product metrics | 13 |
| G | Memory layer — notes, reminders, tapes | 12 |
| H | Platform, freshness & reliability | 14 |

## Why it's different

Verified across both app stores:

- **Ads are 26.8% of negative reviews** in the calculator category, against a
  10.2% baseline. We ship zero ads.
- **Six apps** offer calculator notes. **Zero** offer reminders. That gap is
  the product.
- Every competitor is stateless. Calculate, forget, repeat.

## Architecture in one line

All 86 formulas live in a pure, UI-free, fully unit-tested `src/engine/` module,
and saved data uses one universal JSON record shape — so the valuable part
survives any future change of framework, platform or device.
