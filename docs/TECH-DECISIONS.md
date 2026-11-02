# Technical Decisions & Scalability

**Status:** v1.0
**Audience:** written for a non-engineer. Each decision states what it means in
plain terms, why, and what it costs to reverse.

---

## The Guiding Principle

> **Keep the valuable part separate from the replaceable part.**

The valuable part is the **math and the data** — 74 verified formulas and your
saved financial records. The replaceable part is the **screens**.

Frameworks go out of fashion every ~4 years. Math doesn't. So the architecture
puts all the math in one isolated box that knows nothing about buttons, colours
or Android. If we ever switch to a different framework, a different platform, or
plug the calculators into something else entirely, **that box moves across
unchanged.**

```
┌──────────────────────────────────────────────┐
│  SCREENS  (React + Capacitor)                │  ← replaceable
│  buttons, colours, navigation, animations    │
└───────────────────┬──────────────────────────┘
                    │  calls into, never the reverse
┌───────────────────▼──────────────────────────┐
│  ENGINE  (pure TypeScript)                   │  ← the asset
│  74 formulas · 100% unit tested              │
│  zero knowledge of UI, Android, or React     │
└───────────────────┬──────────────────────────┘
┌───────────────────▼──────────────────────────┐
│  DATA  (plain JSON schema)                   │  ← the asset
│  saved cards · reminders · settings          │
└──────────────────────────────────────────────┘
```

**Hard rule enforced in the build:** nothing in the engine may import anything
from the screens. If someone tries, the build fails.

---

## The Decisions

### 1. React + TypeScript + Capacitor, not Flutter or native Kotlin

**In plain terms:** we write the app once as a web app, then wrap it so it
installs from the Play Store like any normal Android app, and later the App
Store.

| | Why it wins here |
|---|---|
| One codebase → Android, iOS, and web | Three products for the price of one |
| I can fully test it in this environment | There's no Android emulator here — with Flutter I could compile but never *run* it. I will not tell you 74 calculators work if I've never executed them. |
| Fastest path to a working app | Hours, not days |
| The web version is a free marketing channel | 74 SEO landing pages, same code |

**What it costs:** the app runs in a system WebView rather than true native
widgets. For a calculator — forms, numbers, tables — this is imperceptible. For
a game or a video editor it would be the wrong call.

**Reversibility: high.** Because the engine is isolated, switching to Flutter
later means rewriting the screens only. The math and the data come across
untouched.

---

### 2. All financial math uses `decimal.js`, not normal computer numbers

**In plain terms:** computers are natively bad at decimal arithmetic. In
ordinary JavaScript, `0.1 + 0.2` gives `0.30000000000000004`. Harmless in most
apps. Unacceptable in one that tells you your EMI.

`decimal.js` is a library that does exact decimal arithmetic.

**What it costs:** slightly larger app, slightly slower math (irrelevant at this
scale).

**Reversibility: low — and that's fine.** This is one of the few decisions I'd
call permanent. It's also uncontroversial; every serious finance app does this.

---

### 3. Tax rules live in a config file, not in code

**In plain terms:** every tax slab, rate, exemption limit and threshold sits in
a file called `tax-rules.FY2026-27.json`. The code reads that file. The numbers
are nowhere else.

**Why:** the Budget changes these every single year. If the rates were scattered
through the code, each Budget is a developer task. In a config file, it's an
edit you could make yourself in ten minutes.

It also lets us keep *old* years: a `tax-rules.FY2025-26.json` stays alongside,
so you can recompute a past year. And it's how we'd add other countries later —
drop in `tax-rules.UK-2026.json` and the same engine works.

**Reversibility: n/a.** This is pure upside.

---

### 4. No backend, no accounts, no server

**In plain terms:** there is no server. Your data lives on your phone only. You
never create an account or log in.

**Why:**
- **No running costs.** No hosting bill, no database, nothing to maintain at 3am.
- **No breach risk.** Data that was never uploaded cannot leak.
- **Works offline.** Arithmetic should never need a network connection.
- **It's a marketing asset.** *"We don't have an account system because we don't
  want your data"* is a genuinely strong line in a category where competitors
  upload your financial records.
- **Nothing to scale.** 10 users or 10 million, our infrastructure cost is zero.

**What it costs:** no sync across devices. You back up with a file export.

**Reversibility: medium.** Adding optional end-to-end-encrypted sync later is a
real project (a few weeks), but the data schema is already designed to allow it
— every record has an `id` and `updatedAt`, which is what sync needs.

---

### 5. Saved data uses one universal record shape

**In plain terms:** a basic calculation, an EMI scenario, a tax comparison and a
running shopping tally are all stored as **the same kind of record**, with the
calculator-specific bits held in a flexible `inputs` field.

**Why this matters more than it sounds:** it means **adding calculator #75 never
requires changing how data is stored.** One list view, one search, one backup
format, one export, forever. The alternative — a different table per calculator
— would mean touching the storage layer every time we add a feature, which is
exactly how apps become impossible to extend.

**Reversibility: n/a.** Pure upside.

---

### 6. Every calculator loads only when first opened

**In plain terms:** the app doesn't load all 74 calculators at startup. It loads
the basic calculator, and fetches the others the first time you tap them.

**Why:** keeps cold start under 800ms no matter how many calculators we add.
We could go to 200 calculators and startup time would not change.

**Reversibility: high.** Trivial to change either way.

---

### 7. Local notifications for reminders, not push notifications

**In plain terms:** reminders are scheduled by your phone itself, not sent from
a server.

**Why:** no server (see #4), works with no internet, no permission to track you,
and it cannot break because a backend went down. The phone's own alarm system is
more reliable than anything we'd build.

**What it costs:** reminders don't follow you to a new phone unless you restore
from the backup file.

**Reversibility: high.**

---

## What This Buys You Long-Term

| Future scenario | What we'd have to do |
|---|---|
| Ship on iOS | Already supported. Needs a Mac to build. |
| Ship as a website | Already supported — it *is* a web app. |
| Add 50 more calculators | Add engine functions + screens. No storage, navigation or architecture change. |
| Add UK / US / UAE tax | New rules config files. Engine unchanged. |
| Switch to Flutter or native | Rewrite the screens. **Engine and data come across unchanged** — the expensive, verified 74 formulas are preserved. |
| Add cloud sync | Schema already has `id` + `updatedAt`. Needs a backend built. |
| Plug the calculators into something else (a bot, an API, a spreadsheet add-in) | The engine is a plain TypeScript library with no UI dependency — it can be imported directly. |

---

## What I'm Deliberately Not Doing

| Not doing | Why |
|---|---|
| A backend "for later" | Building infrastructure before a user needs it is the most common way solo projects die |
| User accounts | No value to a single-user offline tool, large cost and risk |
| A plugin architecture for calculators | Premature abstraction. 74 hardcoded calculators in a consistent shape is simpler and faster than a plugin framework nobody else will use. |
| Analytics / crash reporting SDKs | Contradicts the privacy position. You'll tell me when something breaks. |
| Server-side tax rules | A config file in the app does the same job with zero infrastructure |
| State management beyond Zustand | A single-user offline app does not need Redux |

Each of these is a real option I considered and rejected because the cost
landed before the benefit. All of them remain addable later — none are
foreclosed by the choices above.
