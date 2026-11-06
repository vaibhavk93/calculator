# Design reference — from the Claude design canvas

This folder is reference material handed off from a Claude (Cowork) design pass, done on a separate interactive canvas — **not** a replacement for anything already in `docs/` (in particular `docs/DESIGN-SYSTEM.md` and `docs/UX-GUIDELINES.md`, which this session did not read or touch). Treat this as input to merge or diff against, not as the source of truth.

Canvas (view/comment, owner's account): https://claude.ai/artifact/Xt4sR1nbBUBXihoTmbEE4V

## What's here

- `tokens.css` / `tokens.json` — the color, type, radius and spacing tokens used across the pass, dark + light.
- `DIAGNOSIS-AND-DECISIONS.md` — why the screens are structured the way they are: the core diagnosis, the five open-choice decisions (Tools home layout, tool-page result treatment, Budget home structure, List/Card on Notes & Due, where Portfolio lives), and the three redesign changes applied in the last pass (Net worth as a Budget segment, panels-mean-bundled-controls-not-emphasis, icon tiles over text chips).
- `screens/*.html` — every artboard as a static, self-contained HTML file (inline CSS, no build step). Each one renders at 390×844 if opened directly in a browser; `support.js` is referenced but not included — harmless 404, the markup and styles render fine without it. These are **reference for structure, copy, states and token usage** — not production components.

## Screens included

Dark: `ToolsHome`, `ToolPage` (Loan EMI), `BudgetHome`, `BudgetHomeNetWorth`, `NotesList`, `NotesCard`, `Due`, `DueCard`, `Portfolio` *(superseded — see below)*, `Settings`, `Components` (component library sheet).

Light: same set, `*Light.html`.

**`Portfolio.html` / `PortfolioLight.html` are superseded.** In the latest pass, net worth moved from a standalone page to a "Spending / Net worth" segmented control at the top of `BudgetHome` — `BudgetHomeNetWorth.html` is that second state. The standalone Portfolio page is kept here only so you can see what changed; don't build the back-button/full-screen version.

## Known gaps / not done in this pass

- No 200%-font-size or short-phone (360×640) variants.
- Screens not built: note/checklist/to-do editors, Spending summary, Bills & subscriptions, Categories & cards, Rules, Add-from-bank-messages, empty states.
- `positive` color (`#8BC48A` dark / `#1F7A3D` light) was invented — the original brief's hard-rule color table never defines a "good money" color, only `alert` for bad. Worth a deliberate decision before this becomes load-bearing elsewhere in the app.
