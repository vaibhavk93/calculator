# Staying Correct Over Time

**Status:** v1.0
**The question this answers:** the app will tell people their tax, their EMI,
their currency conversion. All of those inputs change. **How does the app stay
right without me rebuilding it every quarter?**

---

## 1. The Problem, Properly Sized

Every number the app depends on but does not own:

| Data | Who changes it | How often | If stale, the result is |
|---|---|---|---|
| Currency rates | ECB / central banks | **Daily**, banking days only | Wrong conversion |
| PPF, NSC, SCSS, SSY rates | Dept. of Economic Affairs | **Quarterly** | Wrong maturity value |
| EPF rate | EPFO board | Annual | Wrong retirement corpus |
| Income tax slabs, rebates, deductions | Union Budget | Annual (~1 Feb), sometimes mid-year | **Wrong tax. Worst case.** |
| Capital gains rates & rules | Budget / Finance Act | Annual+ | Wrong tax |
| Cost Inflation Index | CBDT notification | Annual | Wrong indexed gain |
| GST rates | GST Council | **Unscheduled** | Wrong invoice |
| Repo rate (suggested loan defaults) | RBI MPC | ~6×/year | Mildly stale default, user overrides |

**The naive assumption I started with was "annual."** It's wrong. Small-savings
rates reset **every quarter**, and GST changes on no schedule at all. The
mechanism has to handle **4–8 updates a year**, arriving unpredictably.

### Three bad options, and why

| Option | Why it fails |
|---|---|
| Hardcode the rates | Every change is a code change, a release, a Play review, and a user who hasn't updated gets wrong answers silently |
| Build a backend API | Contradicts the no-server principle. Monthly cost, uptime burden, a thing that can go down at 3am, and a new privacy surface |
| Make the user enter every rate | Pushes our job onto them. They don't know the current CII. |

---

## 2. The Solution: Rules Packs

> **A static JSON file on a CDN is not a backend.** No server process, no
> database, no uptime commitment, no cost, nothing to attack. It's a file.

### How it works

```
     ┌─────────────────────────────────────────┐
     │  rules/index.json      (version marker) │   A plain static file
     │  rules/in-2026-q4.json (the actual data)│   on a CDN
     └────────────────┬────────────────────────┘   (GitHub Pages / Cloudflare)
                      │  checked ~weekly, on wifi, in background
                      │  one small GET, no account, no identifiers
                      ▼
     ┌─────────────────────────────────────────┐
     │  APP                                    │
     │                                         │
     │   3. downloaded pack   (newest)         │   ← used if present & valid
     │   2. cached pack       (last good)      │   ← used if no newer
     │   1. bundled pack      (ships in APK)   │   ← always present, day-one offline
     └─────────────────────────────────────────┘
```

**Resolution order is strict:** downloaded → cached → bundled. The bundled pack
means the app is **fully correct the moment it installs, with no network**.
A failed fetch is a non-event — the app already works.

### What a pack contains

```jsonc
{
  "packVersion": "2026-Q4.1",
  "effectiveFrom": "2026-10-01",
  "jurisdiction": "IN",
  "publishedAt": "2026-10-04T00:00:00Z",
  "sources": {
    "smallSavings": "https://dea.gov.in/... (notification ref)",
    "incomeTax":    "https://incometaxindia.gov.in/... (Finance Act ref)"
  },
  "smallSavings": { "ppf": 7.1, "nsc": 7.7, "scss": 8.2, "ssy": 8.2 },
  "incomeTax": {
    "FY2026-27": {
      "newRegime": { "slabs": [ /* … */ ], "rebate87A": 60000 },
      "oldRegime": { "slabs": [ /* … */ ] }
    }
  },
  "gst": { "slabs": [0, 5, 12, 18, 28] },
  "capitalGains": { /* … */ },
  "costInflationIndex": { "2026-27": 0 }
}
```

### Rules that make it trustworthy

| Rule | Why |
|---|---|
| **Every pack is signed**, signature verified before use | A tampered pack could give someone wrong tax numbers. Non-negotiable. |
| **Schema-validated** before being accepted | A malformed pack must never replace a good one |
| **Monotonic versions only** — never accept an older pack | Prevents rollback attacks and clock-skew bugs |
| **Old packs are kept**, keyed by financial year | So you can recompute FY2024-25 next year |
| **Every result shows its pack version and date** | The user can always see what the answer was based on |
| **Fetch is anonymous** — no identifiers, no query params, no cookies | A plain GET of a public file. Nothing to profile. |
| **Never blocks the UI.** Background, wifi-preferred, silent failure | Arithmetic must never wait on a network |

### Staleness disclosure

The app knows the *calendar*, so it knows when it ought to be suspicious:

| Condition | What the user sees |
|---|---|
| Pack is current | Quiet line: *"Rates as of Oct 2026"* |
| Past 1 Feb, no new pack since | *"Budget 2027 may have changed these. Last updated Oct 2026."* |
| Past a quarter boundary, no new pack | *"Small savings rates are reviewed quarterly. Last updated Oct 2026."* |
| Pack > 120 days old | Banner with a **Check for updates** button |

**This is the honest move:** rather than pretending to be current, the app tells
you how fresh it is and lets you judge. That's what a trustworthy financial
tool does.

### If I stop maintaining the packs

A real risk for a personal project. Mitigations:
- The app **keeps working** on the bundled pack — it degrades to "accurate as
  of the release," which is exactly how every competitor behaves permanently.
- Every rate is **user-overridable** in Settings. The config is a convenience,
  never a lock-in.
- The pack format is plain JSON in a public repo — anyone, including future me,
  can update it in ten minutes without touching app code.

---

## 3. Currency Rates — A Separate Problem

Rates change **daily**, which is too often for the rules-pack cadence.

| Decision | Choice | Why |
|---|---|---|
| Source | **Frankfurter** | No API key, no quota, ECB-backed official provenance, open-source and self-hostable if it disappears |
| Fetch timing | On opening the currency screen, if cache > 6h old | Not at app launch — launch must stay under 800ms |
| Offline / failure | Use the cached rates, always | Never an error screen for arithmetic |
| First run with no network | Ship a **bundled snapshot** of rates with the APK | The screen works on day one, visibly dated |

**The honesty rule.** Rates publish on banking days only — weekends and
holidays return Friday's rate. The UI never implies live market pricing:

> `1 USD = ₹88.42` · *ECB reference rate, 31 Oct · tap to refresh*

If rates are more than 3 days old, that line turns amber. If the source has an
outage, we say so rather than silently showing week-old numbers as current.

**What we will not do:** no live market spreads, no crypto, no "live" claims.
Those need a paid feed and create an expectation of accuracy we can't honour.

---

## 4. Android Reliability — The Harder Problem

Rules going stale is solvable. **Reminders not firing is the thing that could
actually kill this product**, and the research says it's a real threat.

### Threat 1 — Exact alarms are restricted

Android 14+ denies `SCHEDULE_EXACT_ALARM` by default. The replacement,
`USE_EXACT_ALARM`, is limited by Play policy to alarm clocks, timers and
calendar apps. **A calculator app plausibly does not qualify**, and apps that
don't qualify can't publish with it in the manifest.

**Decision: don't use exact alarms at all.**

A bill reminder does not need second-precision. "Some time on the morning of
the 15th" is entirely sufficient. Inexact scheduling with a ±1-hour window
needs **no restricted permission** and carries **no Play review risk**.

> This is a case where the constraint improved the design. Exact alarms would
> have been a liability we didn't need.

### Threat 2 — OEM battery killers (the serious one)

Xiaomi/Redmi/POCO, Vivo, Oppo and Realme ship aggressive background-process
killers. These brands **dominate the Indian market**. Reported behaviour:

- Vivo/Funtouch OS rated **"very high"** risk; autostart must be enabled per app
- Oppo/Realme/ColorOS rated **"high"** — background freeze kills many apps
- One developer report: **Redmi phones silently dropped notifications scheduled
  more than ~10 minutes out**, while Samsung worked
- Data Saver can independently block background delivery

A reminder that silently doesn't fire is **worse than no reminder at all** —
the user trusted it and got burned.

### The four-layer defence

| Layer | Mechanism | Covers |
|---|---|---|
| **1. Guided setup** | On first reminder, detect the OEM and deep-link to *that manufacturer's* autostart / battery settings page with a short, specific instruction. Not a generic "please whitelist us." | The root cause |
| **2. Delivery verification** | Each reminder records whether it actually fired. On next app open, any reminder that should have fired but didn't is surfaced: *"This didn't reach you — your phone may be blocking reminders. Fix it →"* | Detects silent failure |
| **3. Widget fallback** | The Next-due widget reads local storage and renders on the launcher's own refresh cycle — **it does not depend on notifications or background execution at all** | Works even when notifications are fully blocked |
| **4. In-app agenda** | The Reminders tab always shows what's due, with a tab-bar badge | Last resort, always works |

**Layer 3 is why widgets are not a nice-to-have.** For a meaningful share of
Indian users, the widget may be the *only reliable delivery channel*.

### Threat 3 — Notification permission

Android 13+ requires explicit permission. Reported opt-in medians are ~49–67%,
down from ~85% before.

| Decision | Rationale |
|---|---|
| **Never ask at launch** | A permission prompt before first value is how you get a denial you can't re-ask for |
| **Ask after the first reminder is set** | The user has just expressed the intent; the ask is obviously relevant |
| **Explain before prompting** | One line of our own UI first, so the system dialog isn't a surprise |
| **If denied, don't nag** | Fall back to widget + in-app badge, offer a quiet re-enable in Settings |

### Other platform realities

| Issue | Handling |
|---|---|
| Device reboot clears scheduled alarms | Three layers. (1) The notifications plugin's own `LocalNotificationRestoreReceiver` (merged into our manifest, listens for `BOOT_COMPLETED`) re-arms every saved reminder once the phone is unlocked, and fires any that came due while it was off about 15 seconds after boot (`RESEARCH-D-E-2026-11-04.md`, E(a)). `scripts/build-android.sh` fails if it is missing from the merged manifest. (2) The plugin also re-arms any saved reminder that has no live alarm every time the app process starts (`LegacyNotificationMigrator.reconcileOwnStorage`). (3) The app plans again on every open and every return to the front (`App.tsx`, `lib/reminderSync.ts`), so a lost alarm is replaced by id, never doubled. **What each case does (proved 2026-11-11 on the Calc QA copy, OnePlus Android 16):** `adb shell am force-stop` removes every alarm (5 to 0); opening the app puts all 5 back; an update (`adb install -r`) keeps all alarms; a reminder set 4 minutes out, wiped and restored, still fired on time. **Time zone and clock changes** need no receiver: alarms are fixed instants and the planner recomputes the wall-clock time on the next open. We add no TIME_SET / TIMEZONE_CHANGED receiver because it could only re-arm the same instants. **Not provable without a real reboot:** that the boot receiver itself runs (a protected broadcast cannot be sent from adb). Test: set 3 reminders, run `adb shell dumpsys alarm \| grep vkcalc`, note the count, `adb reboot`, unlock, run it again. A quiet line on Due ("N reminders went missing ... They are back now") appears only when the app found alarms missing at start (counted by `ReminderAlarmsPlugin`, numbers only), and another when notifications are blocked. |
| Timezone / DST / manual clock change | Store reminders as local wall-clock date-time; recompute on `TIMEZONE_CHANGED` |
| Recurring on the 31st in February | Clamp to the last day of the month, and say so in the UI |
| Doze mode | Inexact alarms fire in Doze maintenance windows — by design |
| Capacitor can't build widgets | A small native Kotlin module (Jetpack Glance) reading shared storage. ~1 file, but **real native work** — costed in its own phase, not hidden in a web task. |

---

## 5. Data Integrity

| Risk | Handling |
|---|---|
| App update corrupts saved data | Versioned schema + explicit migration functions, each unit-tested against fixtures of the previous version |
| Uninstall destroys everything | Prominent one-tap export; a quiet nudge to back up after 30 saved items |
| Floating-point drift in money | `decimal.js` throughout the engine — no exceptions |
| Huge numbers | Display auto-shrinks; never scientific notation, never truncation |
| Clock tampering changes due dates | Due dates are stored absolutely, not computed from "now" |

---

## 6. Trust & Liability

The app tells people their tax. That deserves an explicit position.

| Rule | Implementation |
|---|---|
| Never present an estimate as authoritative | Every tax and projection result carries *"Estimate. Verify with your CA."* |
| Always show the basis | Formula, inputs, **and the rules-pack version and date**, on every result |
| Link to the source | Each rules pack carries the official notification URL it was built from |
| Refuse to guess | Where sources conflict (surcharge rates) or are missing (GST slabs), that calculator **does not ship** until a primary source is checked. A missing calculator is recoverable; a confidently wrong tax number is not. |

---

## 7. What This Costs

| Item | Cost |
|---|---|
| CDN hosting for rules packs | **₹0** — GitHub Pages or Cloudflare Pages free tier, serving a file of a few KB |
| Currency API | **₹0** — Frankfurter, no key, no quota |
| Backend servers | **₹0** — there are none |
| Your time maintaining packs | ~15 min/quarter, ~1 hour after a Budget |
| Native widget module | One-off: a Kotlin file plus a storage bridge |

The entire freshness problem is solved for zero recurring cost and about an
hour a year of attention.
