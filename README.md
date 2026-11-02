# VK Calc — Personal Calculator Suite

An all-in-one personal calculator for Android (iOS later): everyday math and
converters, a deep loan/EMI engine, India-specific investment and tax
calculators, and a product-metrics pack. No ads, no paywall, no account,
offline-first.

**Status:** Planning complete. See [`docs/PRD.md`](docs/PRD.md) for the full
product requirements, feature specification and build sequence.

## Scope at a glance

| Section | Contents | Count |
|---|---|---|
| A | Core calculator engine, history, settings, theming | 15 |
| B | Everyday converters and utilities | 15 |
| C | Loans & EMI | 11 |
| D | Investments & savings | 13 |
| E | Tax & salary (India) | 7 |
| F | Personalisation + product metrics | 13 |

## Stack

React + TypeScript + Vite, wrapped with Capacitor for native Android/iOS.
All financial math lives in a pure, UI-free, fully unit-tested `src/engine/`
module so it stays portable and auditable.
