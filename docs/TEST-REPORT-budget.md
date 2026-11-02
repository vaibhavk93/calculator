# Test report: Budget (e2e/budget.test.mjs)

Run for the first time this round. 117 cases, 99 passed, **18 failed**. Raw results in the background log; not
yet checked against the app code one by one except where noted.

## High confidence, real, and serious

| Case | Finding |
|---|---|
| AM06, AM07 (known B-23) | Typing `-500` or the unicode minus `−500` as an expense amount **silently saves +500**, no warning. Confirms B-23 in a money-entry context, which is worse than in a calculator box. |
| AM08, AM09 (known B-06) | Comma read as a decimal point: "1,5" saves as 15; "99,5" saves as 995 — **10x too much**, no warning. Same bug as tools1's T1-TYPE-comma-decimal, now confirmed in real money entry. |
| AM10 (known B-23) | "1e5" has the `e` silently deleted, saves as 15. |
| ST10 (known B-04) | Editing a credit card's holder name (nothing else) **detaches its bill payment** — the card then shows owing 5,700 instead of 3,700. Editing an unrelated field should never change what is owed. |

## Needs a look, not yet explained

| Case | Finding |
|---|---|
| CG04 | Tapping a chosen category pill again should un-choose it; got 0 selected, expected 1 (backwards?) |
| ST06, ST04 | Test itself crashed with "Do not know how to serialize a BigInt" — **a bug in the test's own result-printing, not evidence of an app bug**. Needs the test fixed before its claim (settlements/card-bills excluded from totals) can be trusted either way. |
| CG08, CG09, PM13-PM21 (9 cases) | All fail with the identical "Timeout 5000ms exceeded" on a `locator.click`, across category-add and UPI/payment-mode pickers. One shared cause is more likely than nine unrelated app bugs — probably a selector that no longer matches current markup after the UI changes this round. **Needs a human or a re-run with a longer timeout to tell test-staleness from a real interaction bug.** |

## Not yet investigated

Nothing above has been fixed. AM06-AM10 and ST10 are the same category of bug CLAUDE.md calls the highest risk
(a wrong money figure that looks right); they should be looked at before the test-selector timeouts.
