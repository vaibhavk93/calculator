# Research Findings

**Status:** v1.0 · 2026-11-02
**Method:** market, competitive, user-review and platform-constraint research.
Where a figure is self-reported by a vendor or comes from an aggregator rather
than a primary source, it says so. **Gaps are named rather than filled with
guesses.**

---

## 1. What the research changed

Four findings **invalidate or correct** parts of the earlier plan. These are
listed first because they matter most.

| # | Finding | What it breaks | Fix |
|---|---|---|---|
| 1 | **Exact alarms are denied by default on Android 14+**, and the replacement permission `USE_EXACT_ALARM` is restricted by Play policy to alarm clocks, timers and calendar apps | A calculator app plausibly does **not** qualify. Reminders — the whole differentiator — could be rejected at review. | Don't use exact alarms at all. A bill reminder doesn't need second-precision. Inexact scheduling with a ±1 hour window needs **no restricted permission**. |
| 2 | **Indian OEMs silently kill scheduled background work.** One developer report describes Redmi phones dropping notifications scheduled more than ~10 minutes out while Samsung worked. Vivo/Funtouch rated "very high" risk, Oppo/Realme/ColorOS "high". | These brands dominate the Indian Android market. A reminder that doesn't fire is worse than no reminder. | Guided per-OEM autostart setup, delivery self-verification, and a widget fallback that doesn't depend on notifications at all. Detailed in `DATA-FRESHNESS.md`. |
| 3 | **Capacitor cannot render home-screen widgets.** They require native Kotlin (Jetpack Glance / AppWidgetProvider) with a shared-storage bridge. | I previously listed widgets as a normal feature. That was wrong. | Widgets are a small **native module**, not web code. Moved to a later phase and costed honestly. |
| 4 | **Android notification opt-in has collapsed since Android 13.** Reported medians range ~49–67% (Airship 53.3%, Batch 67%, down from ~85% pre-Android-13). Sources conflict and several "2026" articles summarise 2024–25 data. | Up to half of users may never grant notification permission. | Ask in context (after the first reminder is set), never at launch. Design a no-notification fallback path. |

---

## 2. Competitive research

### The category's top complaint is ads — by a wide margin

An aggregator analysis of 2,127 US App Store reviews across 10 calculator apps
found ads were the most common complaint, present in negative reviews for
**every app listed**. Ads appeared in **26.8% of negative reviews against a
10.2% baseline** across apps generally.

Specific complaints: ads that **cover the buttons**; fake "your phone has a
virus" ads interrupting calculations; and some users reporting ads continuing
*after* paying to remove them.

> *Caveat: these are one aggregator's counts across a specific app set, not an
> audited study. Directionally very strong; treat the exact percentage as
> indicative.*

### Other recurring complaints

| Complaint | Representative review |
|---|---|
| Destructive delete | *"If you accidentally hit the trash bin button all your history and work is gone"* — user asked for a confirmation or recovery |
| Hidden running total | *"It doesn't show your additions or subtractions when you enter more than one number without checking history"* |
| No backspace | *"the option to backspace instead of starting a calculation all over"* |

### Feature coverage across competitors

| Capability | Apps offering it |
|---|---|
| Calculator + history | Dozens |
| Calculator + notes / labels | ~6 — Calculator Note, Calculator Plus with History, Simple Calculator with History, MonoTape, NoteCalc, Smart Notes |
| **Calculator + notes + reminders** | **None found on either store** |

A 2026 comparison of calculator-with-notes apps concluded that a reminder would
need a separate calendar or reminders app. That is the gap this product is built
on.

### Breadth is not the axis

CalcKit ships **150+ calculators** across Algebra, Geometry, Unit Converters,
Electronics, Finance and Health. ClevCalc ships ~16. Neither competes on
memory or reminders. **Adding calculator #151 is not a differentiator; it is
noise.**

---

## 3. Market research

| Question | Finding | Confidence |
|---|---|---|
| Category size | Google's own Calculator shows **1B+ Play downloads**, 4.3★ from 798K reviews | High (Play listing) |
| India-specific category size | **Not found.** Would need Sensor Tower / data.ai / Similarweb, which are paid. | **Gap — unresolved** |
| Calculator MAU benchmarks | **Not found** in public sources | **Gap — unresolved** |
| Utility app monetisation | Utility apps are "opened frequently but don't generate revenue" — the classic flashlight/scanner problem | Medium (industry commentary) |
| Established price point | ~$2.99 one-time ad-removal is the category norm | Medium |

> **Honest statement:** I could not size the India calculator market from free
> sources. Any number I gave you would be invented. If this moves beyond a
> personal project, that's a question for a paid data provider — not for me to
> guess at.

### Acquisition mechanics

- Organic store search brings users "actively looking for a tool to solve a
  specific problem," which correlates with better engagement than paid installs.
- **First-value moment dominates retention:** if users don't hit clear value in
  the first few minutes, improvements to onboarding, messaging or monetisation
  have little effect.
- Sources disagree on whether retention directly feeds store ranking. Some
  claim a strong link; none provided data. **Treat as unproven.**

---

## 4. India finance-rules research

This determines how often the app's numbers go stale.

| Rule set | Current state | Revision cadence |
|---|---|---|
| **Income tax slabs** | Budget 2026 made **no change** to slabs or basic exemption under either regime. New regime: nil to ₹4L, rising to 30% above ₹24L. | Annual (Budget, ~1 Feb) — but may be unchanged |
| **Capital gains** | Budget 2026 changed **buyback** taxation: now taxed as capital gains, not income from other sources. Secondary sources report LTCG on equity 12.5% above ₹1.25L exemption, STCG 20% — **not verified against the Finance Act**. | Annual, occasionally mid-year |
| **§87A rebate** | ₹60,000 rebate under the new regime is **not** available on special-rate income, which includes capital gains | Annual |
| **PPF & small savings** | PPF held at **7.1%** for Oct–Dec 2026; SCSS and Sukanya Samriddhi 8.2%; NSC 7.7%. Unchanged since April 2020. | **Quarterly** — reviewed each quarter by the Department of Economic Affairs against G-sec yields |
| Surcharge rates | **Sources conflict** — one lists 37% above ₹5 crore under the new regime, another 25%. | Unresolved |
| GST slab restructuring | **Not found** in this research | **Gap — needs a dedicated search before building the GST module** |
| NPS returns | **Not found** — and NPS has no fixed rate; returns are market-linked | n/a — must be a user input, not a constant |

> ⚠️ **Two conclusions that shape the build:**
> 1. **Quarterly, not annual.** Small-savings rates reset every quarter. The
>    update mechanism has to handle 4+ changes a year, not one.
> 2. **I will not hardcode a rate I could not verify against a primary source.**
>    Where sources conflict (surcharge) or are missing (GST slabs), the build
>    pauses on that calculator until the official notification is checked —
>    rather than shipping a confident wrong number.

---

## 5. Infrastructure research

### Currency rates

| Option | Coverage | Key required | Limits | Provenance |
|---|---|---|---|---|
| **Frankfurter** ✅ | Official site claims 228 currencies from 106 central banks; several third-party blogs say ~32 from ECB — **figures conflict** | No | No quotas, only anti-abuse rate limiting | ECB / official sources. Open source, self-hostable. |
| fawazahmed0/exchange-api | 200+ incl. crypto and metals | No | None advertised | **Undocumented sources** — a reviewer flagged this |
| ExchangeRate-API free | — | Yes | 1,500/month | — |
| Open Exchange Rates free | USD base only | Yes | 1,000/month | — |

**Choice: Frankfurter.** No key, no quota, official provenance, self-hostable if
it ever dies. Its currency count needs verifying against its own docs before we
promise a number in the UI.

**Constraint found:** rates update **daily on banking days only**. Weekends and
holidays return the last published rate. The UI must show rate age rather than
imply live pricing.

### Remote configuration

The standard pattern across sources: **local defaults → cached remote values →
local overrides**, with disk caching so the app works offline. Firebase Remote
Config is the common baseline; Statsig, Flagsmith and Braze are alternatives.

One noted tradeoff: config changes "may take one app session to propagate —
usually acceptable for release toggles but not for kill switches."

> **Our variant:** we don't need a vendor. A **static JSON file on a CDN** gives
> the same result with no SDK, no account, no tracking and no cost. See
> `DATA-FRESHNESS.md`.

---

## 6. What I could not establish

Stated plainly so these aren't mistaken for settled:

| Gap | Why it matters | How to close it |
|---|---|---|
| India calculator market size / MAU | Can't size the opportunity | Paid data provider |
| Whether a calculator app qualifies for `USE_EXACT_ALARM` | Play makes a judgement call; not documented as yes/no | Moot — we've designed around it |
| Android 15/16 alarm behaviour changes | Could shift again | Check Android behaviour-change docs at build time |
| GST slab structure as of 2026 | Needed for the GST calculator | Dedicated search against CBIC notifications |
| Surcharge rates (sources conflict) | Needed for high-income tax calc | Finance Act text |
| Real opt-in rate for a *utility* app's reminders | All benchmarks are cross-category | Measure our own after launch |
| Whether **you** will actually use the save/reminder habit | The entire thesis rests on it | 3–4 weeks of dogfooding before anything else is built on top |

The last one is the real risk. Everything else is solvable engineering.
