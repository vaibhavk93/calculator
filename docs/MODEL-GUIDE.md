# Which Model to Build With

**Status:** v1.0 · pricing cached 2026-10-06 — re-check before relying on exact figures
**Question:** can a cheaper model do the implementation work?

**Short answer: yes, for most of it — and that is precisely what all the
planning bought you.**

---

## 1. The Prices

All current models have a 1M-token context window.

| Model | Model ID | Input $/1M | Output $/1M | vs Opus 5.5 |
|---|---|---|---|---|
| Claude Fable 5.1 | `claude-fable-5-1` | $10.00 | $50.00 | 2.5× more |
| Claude Opus 5.5 | `claude-opus-5-5` | $4.00 | $20.00 | — |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | $2.00 | $10.00 | **½ the cost** |
| Claude Haiku 5.5 | `claude-haiku-5-5` | $0.10 | $0.50 | **1/40th** |

> ⚠️ **Haiku's headline price only holds under 100K tokens.** Above that it's
> $0.50 / $2.50 — still 8× cheaper than Opus 5.5. Coding sessions routinely
> exceed 100K context, so budget at the higher rate.

---

## 2. The Principle

> **A detailed spec is what lets you drop a model tier.**

Model capability substitutes for specification. When a task is vague, you need a
stronger model to infer intent. When the task is pinned down — exact inputs,
exact outputs, exact hex values, exact file layout — a cheaper model executes it
fine, because there is nothing left to infer.

That is the real return on the planning work. You now have:

- Input→output contracts for all 111 calculators (`PRD.md`)
- Exact tokens, type rules and layout rules (`DESIGN-SYSTEM.md`)
- Nine built screens to copy patterns from (the design canvas)
- A phased build order with a definition of done per phase

**This is a spec a cheaper model can follow.** Without it, you'd be paying Opus
rates to re-derive decisions every session.

---

## 3. Recommendation

### Default: Sonnet 5.5 for implementation

Use it for **P1 through P4** — the app shell, core calculator, all converters,
loans/EMI, investments. Half the cost of Opus, strong at code, and every one of
those tasks is "build what the spec says."

### Haiku 5.5 for mechanical repetition

Once **one** instance of a pattern exists, the next twenty are copy-and-adapt.
Switch to Haiku for:

- Calculators #2–#15 after #1 establishes the screen pattern
- Test fixtures and scaffolding
- Repetitive form screens
- Mechanical refactors (renames, moving files, extracting constants)

At 1/8th to 1/40th of Opus pricing this is where the real saving sits.

### Keep Opus for four things

| Where | Why |
|---|---|
| **The financial engine's math** | A wrong EMI or tax figure is *silently* wrong — it looks like a number either way. This is the one place where being cheap costs you trust in the whole app. |
| **Tax rules interpretation** | Reading a Finance Act notification and turning it into a rules pack is judgement, not transcription |
| **Architecture decisions** | Schema changes, the rules-pack mechanism, anything in `TECH-DECISIONS.md` |
| **Debugging what Sonnet got stuck on** | When a cheaper model loops on the same failure twice, escalate rather than re-prompt |

### Suggested split by phase

| Phase | Model | Why |
|---|---|---|
| P1 — shell + core calculator | **Sonnet 5.5** | Establishes patterns everything copies. Worth the better model. |
| P2 — 15 everyday converters | **Haiku** after the first two | Pure repetition against a pattern |
| P3 — loans & EMI | **Sonnet**, engine math reviewed by **Opus** | Amortisation and prepayment logic is easy to get subtly wrong |
| P4 — investments | **Sonnet**, engine math reviewed by **Opus** | Same |
| P5 — tax & salary | **Opus** | Highest stakes, genuine interpretation needed |
| P6 — memory layer | **Sonnet** | Well-specified, mostly CRUD + UI |
| P7 — native Android, rules packs | **Opus** | Native Kotlin, signing, OEM quirks — least specified |
| P8 — build & ship | **Sonnet** | Mechanical |

---

## 4. Why Downgrading Is Safe Here

**The unit tests are the safety net.** The plan requires every one of the 86
formulas to be tested against published external values — bank EMI tables,
official scheme calculators, CA-verified tax figures.

That changes the risk profile completely. A weaker model **cannot silently break
the math**, because the test suite catches it. The worst case becomes "the model
writes code that fails tests," which is visible and cheap to fix — not "the
model writes code that quietly computes the wrong EMI."

**Write the tests with the stronger model, then let the cheaper one make them
pass.** That is the pattern that makes this work.

---

## 5. When to Escalate

Switch back up the moment you see any of these:

| Signal | What it means |
|---|---|
| Invents props, APIs or imports that don't exist | Out of its depth on this codebase |
| Drifts from the design tokens — teal creeps back, uppercase eyebrows return, new radius values | Not holding the spec in context |
| Rewrites a whole file to change ten lines | Doesn't understand the code well enough to edit surgically |
| Tests pass but the number is wrong | **Stop immediately.** Escalate and review every formula it touched. |
| You correct it twice on the same thing | Cheaper per token, more expensive per outcome |

**The metric that matters is cost per completed task, not cost per token.** A
cheap model that needs four rounds of correction is not cheap.

---

## 6. Practical Setup

- In Claude Code, `/model` switches model **mid-session** — no need to start over.
- Start a phase on Sonnet. If the first task goes cleanly, stay. If you're
  correcting it, switch up.
- Keep `CLAUDE.md` in the repo root pointing at the docs, so every session
  starts with the spec loaded regardless of model.
- Before a Haiku run, make sure a **worked example already exists** in the
  codebase. Haiku copies patterns well and invents them poorly.

### The prompt to open a phase with

> Read `docs/PRD.md` section C and `docs/DESIGN-SYSTEM.md` before writing
> anything. Build the EMI calculator exactly to the input/output contract in
> the PRD. Use only the tokens in the design system — no new colours, no new
> radius values, no uppercase letter-spaced labels. Put all math in
> `src/engine/loans/`, which must not import from `features/` or
> `components/`. Write unit tests first, validated against a published bank
> EMI table. Show me the failing tests before you implement.

That prompt works on Sonnet. It works less well on Haiku unless a sibling
calculator already exists to copy.

---

## 7. What I Can't Tell You

I haven't benchmarked these models on *this* codebase — it doesn't exist yet.
The recommendation above reasons from task structure (how well-specified the
work is), not from measurement.

**The cheap way to find out:** build P1 on Sonnet. It's the phase that
establishes every pattern, so it's the most honest test. If it comes out clean,
the rest of the plan is safe at that tier or below. If you're fighting it,
you'll know within one session and the only thing lost is one session.


---

## 8. Field report: P1 built on Sonnet 5.5

P1 was built exactly as recommended above: Sonnet 5.5 against the spec, tests first.

**What held up.** The spec did its job. Engine, formatting, theme and store were written against the
contracts in the PRD and design system, and the 395 unit tests passed essentially first time. A
deliberate bug planted in percent handling and in operator replacement turned tests red each time,
so the safety net is real. The design rules held too: `architecture.test.ts` makes teal, uppercase
eyebrows, shadows and stray radii a failing build instead of a matter of discipline.

**What the unit tests could not see.** Every real defect in P1 was found only by running the app in a
browser:

| Bug | Why tests missed it |
|---|---|
| A tapped key kept keyboard focus, so Enter re-pressed it instead of meaning "=" | Needs real focus and real key events |
| A tapped *utility* button did the same; the first fix only covered number keys, and the second (`:focus-visible`) failed because typing flips Chromium into keyboard mode | Same |
| Result digits sliced by a scrolling box on a 640px phone; my first check measured the box, not the glyphs | A passing test that tested the wrong thing |
| Long numbers scrolled from the left, hiding the digits being typed | Layout only |
| Expression squeezed to a half-height sliver | Layout only |

**Conclusion for the model question.** The recommendation was sound: the cheaper model was not the
limiting factor, and the unit-test net did catch what it was meant to. But the plan was missing a
gate. **For any phase that touches UI, a real-browser run (`e2e/smoke.mjs`) and looking at the
screenshots is part of "done"**, whichever model writes the code. It is now in `CLAUDE.md`.

One more honest data point: two of my first four fixes were wrong and were only exposed because the
browser test was specific enough to fail. A weaker verification step would have shipped them.
