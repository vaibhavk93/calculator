# Follow-up audit: what changed since this morning

**Date:** 2026-11-02, afternoon. This is not a second seven-role audit — `docs/IMPROVEMENT-PLAN.md` already did
that this morning. This is a verification pass on top of it: what has actually moved since, checked with real
commands, not re-stated from memory.

## 1. Git state

```
7f0bc5a Name a calculation in history (A18); named rows are kept
26023e8 Stop the logger persisting what you type; add a commit hook
e9cc602 Merge the phone session's P1.1 history plan
234eb7c Plan P1.1: history lock, memo, edit and share, from ClevCalc review
cf91f48 Add the handoff, guidelines, plans and AI instruction files
96274e1 Add the Android project, the Calc logo and build tooling
edde1da Revamp the calculator: clean keypad, Scientific screen, working paste
0091abe Add Notes, lists, Due and Settings screens and the app shell
```

**The P0 item from IMPROVEMENT-PLAN.md — "commit the 87 uncommitted paths" — is done.** Six commits landed it,
then two more fixed the logger privacy bug and added the memo feature. That was this morning's single biggest
risk; it is gone.

**12 files remain uncommitted**, all one coherent piece of work, not scattered risk:

| File | What it's doing (from the diff) |
|---|---|
| `displayLogic.ts` | Deletes `recentWork()`/`PastLine` — the function that showed past calculations above the current line |
| `CalcParts.tsx`, `CalculatorScreen.tsx`, `Display.tsx`, `ScientificScreen.tsx` | Remove the call sites for that same feature |
| `displayLogic.test.ts`, `equals.test.ts` | Update tests to match |
| `CHANGELOG.md`, `HANDOFF.md`, `UI-UX-PLAN.md`, `UX-GUIDELINES.md` | Doc updates to match |
| `global.css` | Styling cleanup for the removed rows |

**This is exactly the owner's "no calculation history on the front screen, there's a dedicated icon for that"
request, being finished.** It is consistent, not half-finished, and does not collide with anything committed
today — confirmed by diffing each file and by the fact `npm run check` still passes with these 12 uncommitted.

## 2. Test count, right now

```
npm run check
Test Files  45 passed (45)
     Tests  992 passed (992)
```

Not the 981 in this morning's `IMPROVEMENT-PLAN.md`, not the 395 in an old `README.md` line, not the 91-feature
count the phone session wrote into `PRD.md`. **992, verified a few minutes ago.** This number will keep moving
as the 12 uncommitted files land — re-run `npm run check`, don't trust a written-down count.

## 3. HANDOFF.md spot-check

The phone/toolchain section (adb path, Java trust store, Gradle timeout) was not re-verified — it describes this
Mac's local setup and nothing in it is checkable from the repo alone. What is checkable:

| Claim | Check | Result |
|---|---|---|
| `scripts/build-android.sh` exists | `ls` | exists |
| `docs/BUILD-ANDROID.md` exists | `ls` | exists |
| "Nothing is committed" (item 13) | `git log` | **stale — fixed this afternoon**, see §1 |
| The logger privacy bug (item 14) | `src/lib/logger.ts` | **stale — fixed this afternoon**, console-only now, test proves it |

Items 13 and 14 are in the 12 uncommitted doc edits' queue to be corrected; they haven't landed yet because that
work is still in flight.

## 4. Is the APK stale?

```
APK file time:      2026-11-02 12:40
Latest commit time: 2026-11-02 13:12
```

**Yes — the built APK predates the logger fix and the memo feature by about 30 minutes.** Anyone installing it
right now gets the pre-fix build. `HANDOFF.md` already flags the APK as stale from before the UI revamp; this
confirms it is stale again, for a newer reason.

## 5. Bundle size

```
dist/assets/index-BmAuNK07.js   410.14 kB raw  │  gzip: 136.42 kB
```

**136 KB gzipped.** An earlier exchange this session worried this was a 3x regression against a doc's "132 KB" —
it was not; that number was already gzipped. No regression, then or now. This is the number to cite going
forward; stop re-checking it until a real feature lands that would move it.

## Verdict

The one thing that actually changed since this morning's audit: **the biggest risk on that audit's list is
closed.** 87 uncommitted paths are now 8 commits plus one coherent, non-colliding, in-progress change (removing
history from the calculator's front screen — the owner's own request). Test count is up to 992. The APK needs a
rebuild before anyone installs it, which was already known and is unsurprising. Nothing here calls for a new
multi-week plan; the existing `docs/BACKLOG.md` and `docs/IMPROVEMENT-PLAN.md` still hold the right order of
work, just rebuild the APK before the next install.
