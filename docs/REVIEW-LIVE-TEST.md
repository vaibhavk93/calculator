# Live test, 2 Nov 2026 (browser, 360px frame, made-up data)

Flows run step by step with scripted taps against a fresh build. No errors reached the console in any flow.

## Flows that worked end to end
| Flow | Result |
|---|---|
| First launch, all five tabs | Each tab has a clear empty state with a button |
| 5000 ÷ 5 = then To list | Sheet opens, "Add to list", lands in Notes with the list open |
| Loan EMI: empty field, huge value, save with empty name | Plain-words errors, `*` legend, "Give this a name", saved |
| Add expense: empty submit, UPI, Paid from, inline "Add credit card", add | Errors in words; the amount survives the inline card form; the new card is selected |
| Limit "Only Nov 2026" on Food, then spend over it | "Over by ₹50.00" in Needs attention; December shows no limit |
| To-do quick add, Today count, Due tab | Works; the task appears in Due |
| History row menu | Name, Edit, Lock, Share, Copy, Delete all present |

## Problems found
| ID | Severity | Where | What happens | Suggested fix |
|---|---|---|---|---|
| L1 | Medium | Tool inputs (Loan EMI and the other money fields) | A 20-digit loan amount is accepted and the result is `₹8.678E+17`. No upper limit message | Cap money inputs (for example ₹1,000 crore) with "That amount is too large" |
| L2 | Medium | Tool header | **Save** is greyed out when the form is incomplete, with no reason given. Our own rule says never disable the main action | Keep it enabled; on tap say "Fill in loan amount first" and focus the field |
| L3 | Medium | Tool Save | After saving there is no confirmation. The header just changes to Delete + Update. The user cannot tell it went to Notes | Snackbar "Saved to Notes" with a **View** link |
| L4 | Low | Budget home | A future or past month says "Spent this month" | Say "Spent in December 2026" when it is not the current month |
| L5 | Medium | History | Each row has five buttons (Use expression, Use result, Name, Delete, More). Name and Delete repeat in the More menu. The menu is a second sheet on top of History, against our own "no stacked sheets" rule | Keep two actions on the row (tap the row to use; More). Swap the menu into the same sheet |
| L6 | Medium | Due tab | A task shows "Mark paid" and a "₹0.00 due in 30 days" total | Say "Done" for tasks; hide the money total when it is zero or when there are no amounts |
| L7 | Low | Add expense amount | Typing `1,250.50` shows `1250.50` (grouping removed) | Keep Indian grouping as the user types, like the calculator pages do |
| L8 | Medium | First run | No hint that you can edit with a cursor, lock history rows, or that Budget has Categories and cards | One-time tips, or a "What's new" row in Settings |
| L9 | Low | To-do | Tick box is visually separate from the row but the row's only button is the whole row | Confirm the tick has its own name and 44px target (checked by the helper's list) |

## Not tested yet
Notifications firing, backup "Open folder" link, share sheet, haptics, the keypad staying still while typing (phone), landscape on the phone.
