# Go-To-Market — How This Gets to #1

**Status:** v1.0
**Question being answered:** if we actually want top-of-category downloads,
what's the plan?

---

## 1. Positioning

> ### The calculator that remembers.

Everything else in the category competes on **how many calculators** it has.
That's a losing axis — CalcKit already has 150+ and nobody cares. We compete on
a different axis entirely: **what happens after you get the number.**

| | Them | Us |
|---|---|---|
| Promise | "150 calculators in one app" | "Never miss a payment you calculated" |
| Business model | Ads + ad-removal IAP | No ads, ever |
| Session | Open → calculate → close → forget | Open → calculate → save → **get reminded** |
| Retention driver | None | Reminders + widgets |
| Data | Uploaded to a cloud account | Stays on your phone |

---

## 2. The Three Wedges

### Wedge 1 — Zero ads (the cheapest moat in the category)

Ads are **26.8% of all negative reviews** across the top 10 calculator apps,
against a 10.2% baseline. Reviewers describe ads that **cover the buttons**,
and fake virus warnings interrupting calculations. Some report ads continuing
*after paying* to remove them.

This is a category where the market leaders have actively trained users to
resent them. Simply not doing it is a positioning statement.

**Store listing, first line:** *"No ads. Not now, not after an update, not ever."*

### Wedge 2 — Reminders (nobody has them)

A 2026 comparison of calculator-with-notes apps found **no app combining notes,
reminders and labelled calculations**. Six apps do notes. Zero do reminders.

This is the retention engine. A utility app's structural weakness is that it
has no reason to be opened. A reminder means **the app opens you.**

### Wedge 3 — India-grade finance depth

Every global calculator app treats India as an afterthought: no lakh/crore
formatting, no GST split, no old-vs-new regime, no HRA, no step-up SIP.
Indians currently use ClevCalc *and* 4–6 finance websites. We collapse that
into one app.

India is also the largest Android market by volume — winning there wins the
download charts.

---

## 3. ASO — The Actual Acquisition Engine

Organic store search is where utility apps are won. Users search for a
**specific job**, not a brand. Our 74 calculators are 74 search-intent
doorways.

### Keyword strategy

| Tier | Keywords | Volume | Competition | Our play |
|---|---|---|---|---|
| **Head** | calculator, calculator app | Huge | Brutal | Don't fight for this initially |
| **Body** | emi calculator, gst calculator, sip calculator, loan calculator | High | Medium | **Primary target** — specific, high intent |
| **Long tail** | home loan prepayment calculator, step up sip calculator, hra exemption calculator, old vs new regime | Low each, large in aggregate | Low | **Where we win first** |

**Tactic:** each calculator gets its own keyword cluster in the store listing
and its own screenshot. Rank for 40 long-tail terms before attacking "calculator".

### Store listing assets

| Asset | Content |
|---|---|
| Icon | High contrast, readable at 48px, not another generic `=` sign |
| Screenshot 1 | **The reminder notification** — lead with the differentiator, not the keypad |
| Screenshot 2 | Saved cards with notes and tags |
| Screenshot 3 | EMI result with amortisation |
| Screenshot 4 | "No ads. No account. No tracking." |
| Screenshot 5 | The calculator grid (what they expected) |
| Title | `VK Calc — EMI, GST, SIP & Reminders` *(keywords in the title carry weight)* |
| Short description | Lead with "no ads" and "reminders" |

**Why the notification screenshot goes first:** users scroll 2–3 screenshots.
Showing a keypad tells them nothing new. Showing a payment reminder tells them
this app is different.

### Reviews
Prompt for a review **only after a reminder has been marked paid** — the moment
of demonstrated value. Never on launch, never mid-calculation. A prompt during
a calculation is exactly the kind of interruption this app exists to avoid.

---

## 4. Retention Mechanics

Ranked by impact per unit of build effort:

| # | Mechanic | Why it works | Effort |
|---|---|---|---|
| 1 | **Reminders** | The only thing that re-opens a utility app | Medium |
| 2 | **Home-screen widgets** | Permanent visual presence without an open | Medium |
| 3 | **Saved cards** | Sunk cost — your data is in here now | Low |
| 4 | **Smart suggestions** | Teaches the save habit at the moment of relevance | Low |
| 5 | **Running tapes** | A tape stays open for days; brings you back | Low |
| 6 | **Favourites that self-promote** | App feels like it learns you | Low |

**First-value moment:** research on retention is consistent — if users don't hit
value in the first few minutes, nothing downstream matters. Ours must be:
*open app → calculate something → see the "save & remind" chip → set one
reminder.* Target: within 90 seconds of first open. No onboarding carousel,
no sign-up, no permission wall before the keypad.

---

## 5. Monetisation — An Honest Take

**You said this is personal, with no ads. For personal use, stop here — there is
no monetisation layer and that's correct.**

If you later want this to be a real product competing for #1, here's the model
I'd recommend, and the reasoning:

| Model | Verdict |
|---|---|
| Ads | ❌ Destroys the entire positioning. Non-starter. |
| Subscription | ❌ Category rejects it. Users rate harshly when money is involved and the value is "arithmetic". |
| **One-time Pro unlock (₹299)** | ✅ **Recommended.** Matches category norms ($2.99 ad-removal is the established price point), no recurring resentment. |
| Free forever | ✅ Also fine. Zero revenue, maximum downloads. |

**What stays free forever (non-negotiable):** every calculator, unlimited
history, notes, reminders, widgets. The core promise cannot be behind a
paywall or the positioning collapses.

**What Pro could add:** end-to-end encrypted cloud sync across devices, PDF
export, custom themes, receipt-photo attachments, CSV export.

> ⚠️ **Warning worth stating plainly:** utility apps are opened often and
> monetise terribly. Do not build this expecting revenue. Build it because you
> want it, and treat downloads as the scoreboard.

---

## 6. Launch Sequence

| Phase | What | Goal |
|---|---|---|
| **0 — Dogfood** | You use it daily for 3–4 weeks. Nothing else happens. | Find what's actually broken. A calculator you don't open daily isn't ready. |
| **1 — Soft launch** | Play Store, India only, no promotion | 100 organic installs, read every review |
| **2 — ASO build** | Listing optimised per the keyword plan, 5 screenshots | Rank top-10 for 10+ long-tail terms |
| **3 — Content** | A web companion: one page per calculator, same engine, SEO | Google search traffic → app installs. Each calculator is a landing page. |
| **4 — Community** | Post in r/IndiaInvestments, r/personalfinanceindia, product communities. Lead with "no ads, has reminders", not "I built a calculator". | First 1,000 installs |
| **5 — iOS** | Same codebase via Capacitor | Second market |
| **6 — Global** | Add US/UK/EU tax modules behind a region picker | Expand TAM |

**The web companion in Phase 3 is the highest-leverage move.** "EMI calculator"
gets enormous Google search volume in India. One React codebase ships both the
app and 74 SEO landing pages, each ending with "get the app for reminders."

---

## 7. Why This Could Actually Win

| Factor | Assessment |
|---|---|
| Is the gap real? | **Yes** — verified: zero apps combine notes + reminders |
| Is the pain real? | **Yes** — ads are the #1 complaint, by 2.6× the baseline |
| Is it defensible? | **Partially.** The feature is copyable in ~3 months. The *no-ads* position is not — incumbents can't abandon their revenue model. |
| Is the market large? | **Yes** — calculator is a top-5 utility category; India is the largest Android market |
| Can one person build it? | **Yes** — no backend, no accounts, no infrastructure, no ops |
| Biggest risk | **Distribution, not product.** Building it is the easy half. |

### The honest counter-argument

Calculator apps are a commodity with near-zero switching costs and no network
effects. "Top of downloads" in this category is won by ASO and store-feature
luck as much as product quality. A better product improves the odds; it does
not guarantee the outcome.

**The realistic framing:** build it because you'll use it every day and it'll
be better than anything you can buy. If it takes off, that's upside — not the
thesis.

---

## 8. Metrics That Matter

| Stage | Metric | Target |
|---|---|---|
| Acquisition | Store listing conversion rate | > 25% |
| Activation | % who complete a calculation in session 1 | > 90% |
| **Activation** | **% who save their first card in week 1** | **> 35%** |
| **Activation** | **% who set their first reminder in week 1** | **> 20%** |
| Retention | D7 retention | > 40% |
| Retention | D30 retention | > 25% |
| Retention | % of sessions started *from a notification* | > 15% |
| Quality | Store rating | > 4.5 |
| Quality | % of negative reviews mentioning ads | **0%** |

The two bolded activation metrics are the real leading indicators. If users
calculate but never save, we've built another commodity calculator and the
whole strategy has failed — pivot or stop.
