# Backlog

Ordered by what protects the owner first. **P0** blocks real use, **P1** is the next improvement, **P2** is later.
Source of each item is in brackets. Move an item to `CHANGELOG.md` when it ships.

## P0: before relying on the app

The order to do these in is in `docs/IMPROVEMENT-PLAN.md` section 3. Numbers 33 to 36 were added by that audit.

| # | Item | Source | Done when |
|---|---|---|---|
| 33 | **Fix the logger**: development builds only, never store expressions, respect "keep history". Confirm with the owner first (an earlier changelog calls it a requested debugging feature) | Audit: privacy and speed | No `app_logs` written in a production build; a test proves it |
| 34 | Move `@capacitor/cli` to `devDependencies` | Audit | `npm audit --omit=dev` is quiet |
| 35 | **Settings: "Send a test reminder"** (a notification one minute out) | Critic: proves delivery in minutes, not weeks | Tap, lock the phone, it arrives |
| 36 | Pre-commit hook that runs `npm run check` (no CI, no lint yet) | Critic | A failing test blocks a commit |
| 1 | Sync, rebuild and install the revamped build on the phone | HANDOFF | `scripts/build-android.sh install` succeeds and the phone checklist in `docs/TESTING.md` passes |
| 2 | Prove paste and copy on the phone | Owner feedback | Checklist items 2 and 3 pass |
| 3 | Prove reminder delivery on the OnePlus, overnight, after reboot, after force-stop | Critic, HANDOFF | Results written in `docs/VERIFICATION.md` |
| 4 | Show verification status on each result ("checked against X" or "recomputed only") and "not checked against the final Finance Act 2026" on tax | Critic of the caveats plan | Visible on the result, driven by data, not a doc |
| 5 | Commit the work | HANDOFF | Reviewed diff, committed on `dev` |

## P1: the next improvements

| # | Item | Source |
|---|---|---|
| 6 | Reminder time picker (today fixed at 9:00 am) and Settings "Send a test reminder" | Critic: makes item 3 take minutes |
| 7 | Cross-check the weakest high-stakes formulas against an official calculator: prepayment, balance transfer, card EMI, FD, EPF, 87A relief, capital gains, advance tax | `docs/VERIFICATION.md` |
| 8 | Actions on History rows: To list, Remind me | UX-AUDIT J3 |
| 9 | Drop the main row from the result list when the sticky answer bar shows it | Browser pass |
| 10 | Scientific screen: Paste, Copy and Undo | Worker A report |
| 11 | Update `e2e/smoke.mjs` to the new selectors | Worker A report |
| 12 | "Saved. Undo" snackbar after saving a card | UX-AUDIT section 2 |
| 13 | Live currency refresh (Frankfurter, 6 h cache, rate age shown) | PRD H4 |
| 14 | List header: put the "left" amount on its own line so the label does not wrap | Browser pass |
| 15 | One "Loan term" field so the years or months switch is not hidden under "More options" | Tools review |
| 16 | A badge on hidden example values (NPS annuity, EPF ceiling) saying they are examples | Tools review |
| 17 | Unify tax naming (income tax says "80C", home-loan tax says "section 123") | Tools review |
| 18 | Backup nudge once there is real data | UX-AUDIT J13 |

## P2: later

| # | Item | Source |
|---|---|---|
| 19 | Use a number in another calculator ("5,000 into GST") | UX-AUDIT J11 |
| 20 | Unequal splits and who-owes-whom settle-up | Number-actions design |
| 21 | Turn a pasted multi-line list into a checklist (not a sum) | Owner idea |
| 22 | Three-state lines (paid, pending, skip) if a checkbox is not enough | Owner mentioned radio buttons |
| 23 | HRA exemption calculator (needs a readable primary source for the Income-tax Rules 2026) | Tax worker |
| 24 | Scenario comparison of saved cards (PRD F2) | UX-AUDIT J9 |
| 25 | Share as image, PDF export (PRD F4, F5) | UX-AUDIT J10 |
| 26 | Natural-language input ("emi 50L 8.5% 20y") (PRD F3) | PRD |
| 27 | Home-screen widgets, quick tile, share intake, app lock, boot rescheduling (native Kotlin) | PRD H9 to H13 |
| 28 | iOS target (needs a Mac and signing) | PRD |
| 29 | Release keystore and a signed APK | `docs/BUILD-ANDROID.md` section 6 |
| 30 | Accessibility pass: every control named, focus order, 200% font | UX-AUDIT |
| 31 | Amount quick-chips (+1K, +10K, +1L) and sliders for rate and tenure (UX 5.1) | UX guidelines |
| 32 | Share and Reset actions on a result (UX 5.2) | UX guidelines |

## Budget tracker (asked for; two steps, the second is gated)

Full reasoning, the risk and the details found earlier are in `docs/ROADMAP.md` section 4. Do not skip the gate.

| # | Item | Source | Done when |
|---|---|---|---|
| 37 | **Step 1a:** a total per tag on Notes ("Travel · ₹48,200 across 6 notes"), labelled as what you saved | ROADMAP 4 | Tag totals shown and exact |
| 38 | **Step 1b:** tag from the result: one tap from To list or Remind me to a category | ROADMAP 4 | A result can be filed in one tap |
| 39 | **Step 1c:** a Categories view: ready-made tags plus your own, two levels, soft delete, Uncategorised shown | ROADMAP 4 | Delete never silently re-files |
| 40 | **Step 2 (gated):** monthly limit per category and a bar against it. Only after a month of step 1 used without prompting | ROADMAP 4 | The owner has used categories unasked |

## Keep fresh (rules that go stale)

See the table at the end of `docs/VERIFICATION.md`: tax slabs before 1 April, small-savings rates every quarter, EPF rate
yearly, GST when the Council meets, the currency snapshot daily until live refresh exists.
