# Testing

What is tested by machine, what must be checked by eye, and the checklist for a real phone.
**A UI change is not done until you have looked at it.** Unit tests cannot see focus bugs, clipped text or layout.

## 1. By machine: `npm run check` (1086 tests, 49 files)

| Suite | Where | Catches |
|---|---|---|
| Engine maths | `src/engine/**/*.test.ts` | Wrong formulas. Each cites an outside source, or says "not externally verified" |
| Calculator input and "=" | `src/engine/expression/*.test.ts`, `src/features/calculator/equals.test.ts` | Key sequences, editing at a cursor (`inputAt.test.ts`), history, "=" doing nothing when nothing is new |
| Architecture and design bans | `src/architecture.test.ts` | Layer breaks, raw colours, bad radii, shadows, gradients, uppercase. `npm run build` runs it first |
| Every calculator spec | `src/features/tools/registry.test.ts` | Unique ids, valid defaults, a real result from the defaults, no `NaN` on blank input |
| Groups | `src/features/tools/groups.test.ts` | Every calculator is in exactly one group |
| Store, persistence, migrations | `src/store/*.test.ts` | Cards, reminders, lists, navigation, budget, old data getting starter categories, damaged data |
| Helpers | `src/lib/*.test.ts` | Formatting, cursor mapping (`caretMap`), paste parsing, dates, tape and list maths, budget maths, back stack, notifications plan |

Run one folder while working: `npx vitest run src/engine/loans`. Run everything before you call a change done.

Rules for new tests:
- Money must be exact: test 0.1 + 0.2 = 0.3, and lines that add back to the total.
- Every formula test names its source. If there is none, say so in the comment. A recomputation is not a source.
- Test the boundary (zero, empty, the largest allowed) and the invalid case with its plain-words error.
- A migration needs a fixture of the old shape.

## 2. By eye: the browser pass (360px, dark and light)

**The audit sweep (use this first).** `e2e/audit-harness.js` opens every calculator (51) and every app page (25) in a 360px
iframe and checks each for sideways scrolling, off-screen content, cut-off text, controls under 44px, unnamed controls,
`NaN` on screen and wrapping money. Run it at normal size **and at 200% font**; the 200% run found most of the bugs. The
file's header says how. On 2026-11-02 the first sweep found 7 kinds of bug across 30 pages; after fixes it reports none.
It needs no install, unlike `e2e/smoke.mjs`, which is stale.

**Not yet done for 0.5.0:** the Budget tab and the reworked History, Settings, Save sheet and Copy as sheet have not been through the sweep at 200% font or in the light theme. Do that before calling them finished (`docs/BACKLOG.md` items 49 and 50).

`e2e/smoke.mjs` is the scripted browser test (needs Playwright). It is **stale**: it still taps buttons that were removed.
Update its selectors before relying on it. Until then, do this by hand or with the Chrome tools:

1. `npm run build && npm run preview -- --port 4173`
2. Open it in a 360px-wide frame. Check each screen you changed, in both themes.
3. Check: nothing clipped, nothing overlapping, numbers never wrap, every control easy to hit, empty states say what to do.
4. Open every calculator once. None may show an error or `NaN`.
5. Tap the tab you are on from inside a calculator: it must return to that tab's start.

## 3. By hand: the phone checklist

Build and install first (`docs/BUILD-ANDROID.md`). Run after every release candidate.

| # | Check | Pass when |
|---|---|---|
| 1 | Launch | Opens with no crash; clock and battery icons are readable in dark and light |
| 2 | Paste a calculation from a notes app (`23*36`, `Rent 25000 + 3000`, a three-line list) | It lands in the calculator; no "can't read the clipboard" message |
| 3 | Copy a result, paste it in another app | The right number arrives |
| 4 | 5000 ÷ 5 = then **To list**, 5 lines, tick two | List shows "2 of 5 done, ₹3,000 left" |
| 5 | Android back button, in each of: a calculator, a group page, Scientific, a list, Settings | Goes up one level each time; from Calculate it exits |
| 6 | Tap the Tools tab while inside a calculator | Returns to the Tools list |
| 7 | Settings, Opens on, choose GST, close and reopen the app | Opens straight into GST |
| 8 | Rotate; set system font to the largest | Nothing is cut off |
| 9 | Settings, Backup, then restore | Notes, lists and reminders come back |
| 10 | **Cursor editing.** Type `12+34`. Tap between the digits and type. Tap `+`, press `-`. Press `=`, then tap the line | The cursor lands where you tapped. The operator is replaced, not doubled. After `=` the last expression is editable. A lone number shows its edit line only after you tap the big number. The keyboard does not cover the keys |
| 11 | **Copy as.** Settings, Copying numbers: try Ask, With commas, Without commas. Copy `1234567` and paste it elsewhere | Ask shows a "Copy as" sheet with both texts. With a number that has no commas (`12`) both texts match, so it copies straight away. The pasted text matches the choice |
| 12 | **Budget.** Add an expense in a category, add one with no category, switch month, delete one, tap Undo, set a category limit | Totals are exact. Uncategorised is shown. Delete is soft and Undo brings it back. Nothing is cut off in the five-tab bar. Closing and reopening the app keeps everything |
| 13 | Keep and share icon row, and the bottom answer button, on a long calculator (a loan) | Four icons, each named for a screen reader. The answer button sits at the bottom edge and scrolls to the result |

## 4. Reminder test protocol (the one most likely to fail silently)

Reminders are the reason to reopen the app, and phones such as OnePlus stop background apps. A missed reminder is only
noticed when you miss the thing. Reminders fire at **9:00 am** (no time picker yet), so tests are by day.

1. Make a note with a reminder for **tomorrow**, days-before **0**. Accept the notification permission when asked.
2. Confirm it appears in the Due tab under "This week".
3. Lock the phone, leave it overnight, and check at about 9 am. Record: arrived / did not.
4. If it did not arrive: Settings, Apps, Calc, Battery, **Don't optimize**; allow auto-launch; repeat.
5. Repeat with: the phone rebooted in between; the app force-stopped in between; battery saver on.
6. Tap **Mark paid** and **Snooze 1 day** on the notification itself. A recurring reminder must move to its next date.
7. Write the result for each case in `docs/VERIFICATION.md` under a "Reminders" heading. Do not mark it verified from one pass.

Once a time picker and a "Send a test reminder" button exist (see `docs/BACKLOG.md`), steps 1 to 3 take minutes, not a night.

## 5. When something breaks on the phone

Read the log: `adb -s <serial> logcat -d | grep -E "FATAL|Uncaught|chromium.*rror"`. A web error in the app shows as a
`chromium` line. A crash shows as `FATAL EXCEPTION`. The lines `AndroidRuntime: START ... Monkey` are only the launch tool.
