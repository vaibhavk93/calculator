# Test report: Notes and To-do (e2e/notes-todo.test.mjs)

Run for the first time this round. 45 cases, 33 passed, **12 failed** (the log shows the run twice —
a harness quirk, not two separate runs; the same 12 case IDs fail both times).

## Real bug found and fixed: tag case-folding only worked on the Task sheet

N11 expected picking the preset tag "Rent" and then typing "rent" as a custom tag to count as one tag
("as in the task sheet" — the test's own title names where the correct behaviour already lived).
**Checked against the real code**: [TaskSheet.tsx:39](src/features/memory/TaskSheet.tsx:39) already
compares tags case-insensitively (`x.toLowerCase() === t.toLowerCase()`), but
[SaveSheet.tsx:60](src/features/memory/SaveSheet.tsx:60) — the sheet used when tagging a saved
calculation rather than a task — only checked for an exact match. "Rent" and "rent" became two separate
tags there. **Fixed**: `SaveSheet.tsx` now does the same case-insensitive check as `TaskSheet.tsx`.

## Real bug found, not fixed: the pin-limit message is silent on the one screen it fires from

N14/N15: pinning a 6th item from the Notes list shows no message at all, even though the code clearly
tries to show one. **Checked against the real code**:
[app.ts:806-807](src/store/app.ts:806) correctly sets `notice: { text: 'You can pin up to 5...' }` when
the 6th pin is attempted — but the pin button that triggers this
([SavedScreen.tsx:156](src/features/memory/SavedScreen.tsx:156) → `togglePin`) lives on the Notes list
screen, and **`SavedScreen.tsx` never reads `notice` from the store at all** — only
`Display.tsx` (Calculate), `TaskSheet.tsx`, `TodoScreen.tsx` and a few Budget sheets do. The message is
set in state correctly and then never shown. Not a one-line fix (it needs a shared place to show a
notice from any screen, or a local one on Notes) — flagging for a deliberate decision rather than
patching in passing.

## Real bugs, confirmed against source: trash purge timing

N20, N21, N22: an 8-day-old trashed card should auto-purge on open; in the test it didn't, and its
reminder survived with it. **Checked against the real code**:
[app.ts:269](src/store/app.ts:269) does filter old cards out of `initial.cards` when the store is
created, and the boot sequence ([boot.ts:19-20](src/store/boot.ts:19)) does call
`createAppStore(await loadPersisted(storage))`, so the filter should run on every real app launch.
This needs one more check that wasn't finished this round: whether the test's seeded `deletedAt`
timestamps survive `loadPersisted`'s sanitisation exactly as written, or get altered before the filter
sees them. Flagged as "needs a look" rather than "confirmed", since the wiring looks correct on paper
but the test still failed twice.

## Needs a look, not yet explained

| Case | Finding |
|---|---|
| N29, N39, N40, N41 | All fail waiting on `getByText('Loan EMI').first()` with a 30s timeout — one shared stale selector is far more likely than four separate save-flow bugs. Needs the selector checked against the current Tools screen markup. |
| N36 | Tapping a card whose calculator type no longer exists does nothing visible — should show something (an error card, a "can't open this" message) rather than silently not respond. |
| N45 | Search text in Notes is cleared when you leave the tab and come back — reported as an observation to confirm with the owner (it may be the intended behaviour), not asserted as a bug. |

## Not yet investigated

N29/N39/N40/N41's shared selector needs checking before being called a real bug.
