# Working in parallel (several AI workers, or people)

How this project was built fast without workers overwriting each other, what went wrong, and the protocol to reuse.
`docs/MODEL-GUIDE.md` covers which model to use for which job.

## 1. The protocol

```
 1. ORCHESTRATOR does the shared plumbing first   (types, store, contracts, plugins, tests)
 2. ORCHESTRATOR writes ONE shared brief          (rules, decisions, ownership, interfaces)
 3. WORKERS each get one folder and a short task  (run in parallel)
 4. ORCHESTRATOR runs the full check and build    (workers only see their own folders)
 5. ORCHESTRATOR does the visual QA               (workers cannot see the UI)
 6. Fix, rebuild, repeat
```

| Step | Why |
|---|---|
| Plumbing first | Shared files (store, types) are where parallel edits collide. Settle them before anyone starts |
| One brief file | Every worker reads the same rules and decisions. Repeating them in each prompt drifts |
| One folder each | Two workers editing one file means one loses its changes, silently |
| Orchestrator verifies | A worker's "tests pass" covers only its folders and can be stale |
| Visual QA by one person | Workers cannot see a screen. Layout bugs only show in a browser |

## 2. Ownership map (current code)

| Area | Folders and files | Typical worker |
|---|---|---|
| Expression engine and calculator UI | `src/engine/expression/`, `src/features/calculator/`, calculator parts of `src/styles/global.css`, `src/lib/clipboard.ts`, `src/lib/device.ts` | calculator worker |
| Tools area and forms | `src/features/tools/*.tsx`, `groups.ts`, `registry.ts`, `src/styles/tools.css`, `src/lib/tool.ts`, `src/lib/toolFormat.ts` | tools worker |
| Memory layer screens | `src/features/memory/`, `src/styles/lists.css` | tools worker or memory worker |
| Settings | `src/features/settings/` | tools worker |
| Calculator specs (text, order, defaults) | `src/features/tools/{everyday,loans,invest,tax,metrics}.ts` | spec reviewer |
| One financial module's maths | `src/engine/<module>/` plus its spec file | engine worker, one per module |
| Store, persistence, plumbing | `src/store/`, `src/lib/{backStack,nativeBack,statusBar,notifications,memory,reminders,tape}.ts`, `src/App.tsx`, `src/components/useBackHandler.ts` | orchestrator only |
| Docs | `docs/` | whoever changed the behaviour |

**Rule:** a worker edits only its row. If it needs a change elsewhere, it stops that item and reports it.

## 3. Interfaces (agree these before starting)

Write the contract as code or a one-line signature, not a paragraph. Example used here:
`ScientificScreen({ onBack })` exported from `src/features/calculator/ScientificScreen.tsx`, shown by the tools area
when `nav.scientific` is true. The worker that builds it and the worker that shows it never talk; they both follow the line.

## 4. Brief template

Put the shared rules in one file and give each worker a short prompt that points to it.

```
Read <brief file> and CLAUDE.md first. You are WORKER <X> (<area>).
Goal: <one sentence>.
Files you own: <list>. Do not touch anything else.
Build: <numbered list, concrete: names, sizes, behaviours>.
Tests: <what must be tested, what must stay green>.
Do not: run git, install packages, change ids, edit files you do not own.
Final report (under 300 words): what you built, anything you could not do,
anything you are unsure about, and every figure you could not confirm.
```

Tell workers that errors in files they do not own are transient while others are mid-edit.

## 5. What went wrong, and the fix

| Problem | Fix used |
|---|---|
| Two workers would have edited one CSS file | Split the stylesheet by owner (`global.css`, `tools.css`, `lists.css`) before starting |
| A type-check run raced an edit and gave a stale result | Re-run the check alone, after workers finish |
| Workers could not see the UI, so layout bugs got through | The orchestrator does a browser pass at 360px after every UI round |
| A worker's selector in my script was out of date after a rewrite | Re-read the DOM before scripting a flow; do not reuse old selectors |
| Reports said "verified" for things only recomputed | Every report must say which outside source, or "not externally verified" |
| A download (Java) was blocked by the permission system | Ask the owner explicitly, then do it. Do not work around a denial |
| Corporate proxy (Zscaler) broke Java HTTPS | Private trust list plus the proxy root. See `docs/BUILD-ANDROID.md` |

## 6. Use an independent critic for big suggestions

When a suggestion adds or removes a feature, changes how the app behaves, touches user data or is hard to undo, ask
**one fresh reviewer** for the strongest case against it before building. Give it the idea, the evidence and the files, and
ask for a verdict in under 300 words. Two critics changed real decisions here: the caveats plan (reminders are silent
failures, so test them first and put verification status in the app) and the number-actions design (a visible
"To list" action, not a hidden tap; no separate "note" kind). If a test or measurement can settle it, do that instead.

## 7. Merge checklist (orchestrator)

- [ ] `npm run check` passes with every worker finished
- [ ] `npm run build` passes (this also runs the architecture gate)
- [ ] No two workers changed the same file (look at `git status`)
- [ ] Open each changed screen in a browser at 360px, dark and light
- [ ] Read each worker's "could not do" list and put it in `docs/BACKLOG.md`
- [ ] Update `docs/HANDOFF.md`, `docs/VERIFICATION.md` and `CHANGELOG.md`
- [ ] Build, install on the phone, run the checklist in `docs/TESTING.md`
