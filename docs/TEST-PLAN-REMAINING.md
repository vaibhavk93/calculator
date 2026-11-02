# What's still untested end-to-end, and the plan to close it

Everything that had e2e coverage before this round now has it fully: all 51 calculators (tools1 + the
newly-written tools2), Budget, Notes/To-do, and the app shell/settings. This file is the honest list of
what's *left* — either never tested at all, or only tested in a browser and not on a real phone.

## 1. Things only a real phone can prove (highest priority — unproven since the UI revamp)

| What | Why it needs the device, not a browser | Plan |
|---|---|---|
| A reminder actually fires at 9:00am | Android can kill a backgrounded app; a browser has no equivalent to "the OS decided to stop this process" | Set a reminder for 2 minutes out on Calc QA, lock the phone, leave it alone, come back and check the notification actually arrived. Repeat once after a real phone reboot. |
| Backup/restore round-trip on-device | The browser suite already found 3 issues here (SH-K16/19/26) through a simulated file, not a real Android Storage Access Framework picker | Export a backup from Calc QA, restore it on a second fresh install of Calc QA, compare every section by eye against the TEST-REPORT-shell.md findings to see if they reproduce for real |
| Native clipboard copy/paste | `navigator.clipboard` in a headless browser isn't the same code path as Android's clipboard manager | Copy a result, switch to another app, paste it there and back |
| App backgrounding and rotation | Already found real bugs via rotation in the browser (viewport resize); a real device rotation sensor is a different code path | Rotate the phone during a calculation, during a sheet being open, and right after a notification tap |
| TalkBack (screen reader) on a real screen | The shell suite checks ARIA attributes in the DOM, never an actual screen reader voice | Turn on TalkBack, swipe through Settings, History, and one calculator end to end; note anything that's silent, mislabelled, or unreachable |

## 2. Confirmed real bugs found this round, not yet fixed (next build's work)

| Bug | Scope | Why deferred |
|---|---|---|
| ~16 calculators show an error message but don't mark the box itself invalid (red text / `aria-invalid`) | tools1, section 2 | One shared pattern across many screens — worth fixing as one change to the shared field component, not 16 separate edits. Needs the exact list re-confirmed against current code first. |
| Junk text in a few calculators (balance transfer, card EMI) is silently read as 0 | tools1, section 4 | Needs a decision on the general rule: should every number field reject non-numeric junk outright, or is "treat as 0" acceptable with a visible note? That's a product decision, not just a fix. |
| Below-absolute-zero temperature and GST rates over 100% are accepted without a warning | tools1, section 5 | Same question as above — is a sanity-check warning wanted here, or is "the user typed it, trust them" the intended behaviour? |
| SH-K16/19/26: backup restore doesn't apply a settings-only file's theme; the "Replace everything" confirm can re-show after replacing; a full round-trip crashed reading `history` from null | shell | Needs the restore code read carefully — these are data-integrity bugs, worth getting right rather than fast |
| Accent colours sky, violet and amber fail their own contrast targets in places; citron (the default) also fails in light mode on one measurement | shell | This changes brand colours — see the questions below |

## 3. Needs a second look before being called a bug either way

These failed a test, but I haven't confirmed the cause — don't treat them as bugs yet:

- `budget.test.mjs`'s CG07-10 and PM13-26 cluster (15 cases): all time out on different specific clicks. I reproduced the underlying pill toggle manually and it worked correctly, so I suspect the test's own helper chains too many steps without enough settling time between them, not a real UI defect. The test needs rewriting with more explicit waits before this cluster can be trusted either way.
- CALC-140 (Indian number words at a large boundary), CALC-237 (a Playwright "strict mode" error — possibly a selector matching two elements where only one should exist), CALC-304/307 (both timing-sensitive, could be a slow run not a real regression).
- notes-todo.test.mjs's N29/N39/N40/N41: all reference `getByText('Loan EMI')` directly on the Tools home screen, which no longer lists calculators flatly since this round's "Calculators / Browse by what you need" regrouping. These are very likely just stale tests, not app bugs — worth a quick rewrite to navigate through the category tile first, the same way `openTool()` in tools2.test.mjs already does.

## 4. Coverage that exists but is intentionally shallow

- Seven tax/EPFO calculators (capital gains, gratuity, advance tax, EPF, NPS, in-hand salary, 44ADA
  presumptive tax) only get screen-level checks (opens, validates, never shows NaN) from tools2 — their
  actual tax-law correctness is proven separately by engine unit tests cross-checked against outside
  sources (`docs/VERIFICATION.md`), not re-derived in the e2e suite. That's deliberate, not a gap, but
  it's worth a periodic refresh of `docs/VERIFICATION.md` whenever a tax year's rules change (FY2026-27
  rules are hardcoded in `src/engine/tax/rules.FY2026-27.ts`).
- Currency rate live-fetching is tested for "offline falls back to the saved snapshot" but not for the
  real failure mode of a slow/flaky network (a request that hangs for 10+ seconds rather than failing
  outright).

## 5. Suggested order

1. Reminder-fires-for-real and backup/restore-on-device (section 1) — these are the two features the
   app's own docs (`docs/HANDOFF.md`) already flag as unproven, and they're both one-time, manual,
   20-minute checks rather than more e2e code.
2. Rewrite the stale notes-todo N29/39/40/41 cases and the flaky budget CG/PM cluster, so those 19 cases
   stop being noise in every future run.
3. Decide and fix the two product questions in section 2 (junk-input handling, the sanity-warning
   question), then the shared aria-invalid fix follows from that decision.
4. The backup/restore data-integrity bugs (SH-K16/19/26) — read the actual restore code, fix for real,
   add regression tests the same way `capHistory` and `updateInstrument` got fixed this round.
5. Accent contrast — after the colour decision below.
