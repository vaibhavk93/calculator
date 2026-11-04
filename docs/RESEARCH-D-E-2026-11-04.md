# Research for Blocks D and E (2026-11-04)

Read-only research. No source file was changed. Tags: **[P]** primary source, **[S]** secondary (blog, forum, user reports), **[I]** my inference. "Fetched" means I read the page; "search summary" means I only saw a search-engine summary of it.

## Verdicts first

| # | Verdict |
|---|---|
| D1 | **Build.** One optional `income` flag. Transfers and card bills are already excluded (`settlement`). |
| D2 | **Cut the push.** Keep the in-app line. |
| D3 | **Build small.** In-app card on the 1st, plus an opt-in generic push. |
| D4 tags, D7 owed-back | **Cut.** Subcategory trips and the existing Refund entry already cover them. |
| D6 split | **Small version** (one entry becomes N entries). |
| D5 rules | **Build.** The import code already has the injection point. |
| E boot | **The plugin already does it. No native code.** Fix one real silent-loss path. |
| E repeat | **Build** `remaining`, `skip`, day-only snooze. **Cut** quiet hours and digest. |

## Sources

| ID | Source | Tag |
|---|---|---|
| A1-A5 | developer.android.com: notification permission, alarms, channels (fetched); Android 15 changes, DND (search summary) | P |
| C1 | capacitorjs.com Local Notifications docs (fetched) | P |
| C2 | `@capacitor/local-notifications` 8.3.1 Kotlin source in `node_modules`, and the merged `qa` manifest (read) | P |
| M1-M3 | Monarch help: Transfers and Card Payments, Transaction Rules (fetched); Tags, Splitting, Cash Flow (search summary) | P |
| S1, B1, R1 | Spendee, BudgetBakers (Automatic Rules fetched), Realbyte help (search summary) | P |
| Y1, P1, T1 | YNAB support, Splitwise KB, Google Tasks help (search summary) | P |
| T2 | RFC 5545 COUNT/UNTIL (fetched, partial) | P |
| B2, G1 | BudgetBakers feedback board, Goodbudget forums (user reports) | S |

**Could not find or verify:** Walnut/Axio (card bills, salary: nothing found; not covered). Realbyte's report-level treatment of transfers. Monarch's savings-rate formula. YNAB's income article (page did not load). Snooze presets and Apple Reminders. Any cap on pending Capacitor notifications. **Nothing here was run on a phone.**

---

## D1. Income and "did I save this month"

### Findings
- **Transfers and card payments are excluded from spending everywhere checked.**
  - Monarch: "excluded from your budget, cash flow, and spending totals". The card purchase counts as spending; the later bill payment is a transfer, "which prevents double-counting" [P, M1].
  - Spendee: transfers stay out of income and expense reports [P, S1].
  - Realbyte: a card payment is a transfer; payments to other people are income or expense [P, R1].
  - Wallet: loan payments are recorded as a transfer [P, B1].
  - Goodbudget: paying the card is an account transfer [S, G1].
- **The common failure is a transfer that lands as income.** Wallet users report the incoming leg arriving as Income and inflating income [S, B2]. Monarch warns that a debt payment can count twice [P, M1].
- **Income lives in the same list as spending** (category group, type, or YNAB's Inflow category) [P/S].
- **Recurring salary:** no evidence it matters. Spendee's scheduled transactions were manual-wallet only (old page) [P, S1].
- **Savings rate:** Monarch's summary card shows income, spending, net cash flow and savings rate [P, M3]. Formula (income minus spending) / income [I].
- **This app already has the hard half.** `BudgetExpense.settlement` (`cardBill` | `transfer`) is skipped by every spend total; `refund` subtracts via `signedAmount` [P, `budget.ts`]. `settlement` appears in 8 source files, about 80 times.

### Recommendation
Add **one optional flag, `income?: true`**, to `BudgetExpense`. Same list, same edit, undo, backup and CSV code.

```
Money entry
+- income: true         -> "came in"
+- settlement: transfer -> neither (own accounts)
+- settlement: cardBill -> neither (the swipe already counted)
+- refund: true         -> reduces spending
+- none of these        -> spending
```

- `income`, `settlement` and `refund` are mutually exclusive; sanitise on load. Income gets no category in v1 (the note is the source).
- **Leak guard (the real risk).** Every total only skips `settlement`, so an unaware total would count income as spending. Replace the `!e.settlement` tests with one `countsAsSpend(e)`, test that an income entry changes no existing total, and ban `.settlement` outside that helper in `architecture.test.ts`.
- **Do not auto-detect income.**
  - `parseSms` already skips credits, which is correct: a "credited" message can be your own transfer or a refund (the Wallet failure above [S]).
  - If ever offered, it must be a review choice: Income / Transfer in / Ignore, never defaulted.
- **Salary recurrence: cut for v1.** `suggestFor` pre-fills last month's "Salary" amount (two taps). A `RecurringItem` kind `income` is a later M item, unproven.
- **Presentation (one bare number).** The home hero **stays "Spent this month"** (limits are about spending); no second large number. When the month has income, add **one tier-2 hairline row**: "Kept ₹X of ₹Y that came in". Spending Summary gets a three-row group (Came in, Spent, Kept) and one sentence: "You kept 18% of what came in." If spend exceeds income, **no percentage**: "Spent ₹4,000 more than came in". Show nothing until the month has income.

### Risks
- A leak into totals if a consumer is missed (see Leak guard).
- A transfer to another person is spending; say so in the transfer hint.
- Use calendar months for income; card statement cycles would mismatch [I].
- Hero-stays-spending is unproven, and untested on a phone.

---

## D2 and D3. Limit alerts and month-end summary

### Findings
- **Permission:** Android 13+ needs `POST_NOTIFICATIONS`; fresh installs start off; denying blocks every channel; ask in context [P, A1].
- **Channels:** every notification needs one; importance cannot be changed after creation, only by the user [P, A3]. A notification on a missing channel won't fire [P, C1]. `notifications.ts` never calls `createChannel`, so the plugin default is used [P, read].
- **Android 15:** bursts are softened for up to two minutes; four or more ungrouped notifications from one app are auto-grouped [P, A4].
- **Thresholds:** Spendee alerts at 75% and 90% [P, S1]. No standard exists; keep 80/100 as one constant.
- **When can a local-only app compute?** Only while it runs, plus what it scheduled ahead [I]:
  - Spend changes only when the user adds, imports or scans, all inside the app.
  - A scheduled notification carries fixed text [I], so it cannot say "you are at 83%" unless re-planned on every save.

### Recommendation
- **D2: no push.** The in-app crossing line is built; a push would arrive after the user already saw it, and add permission, channel and battery-kill risk while reminder delivery is unproven.
- **D3: build small.** On the 1st to 3rd, one dismissible tier-2 row on Budget home: "October: spent ₹X, kept ₹Y". Optional push (Settings toggle, off by default) with generic text and no figures, on schedule `on: {day: 1, hour, minute}`; the plugin re-arms `on` schedules after firing [P, C2 `rescheduleNotificationIfNeeded`], so the app need not be opened. Create **two channels** first ("Reminders" high, "Budget" default) so summaries can be muted without losing bills. Reuse `reminderTime`.

### Risks
- `on` re-arm after reboot is unproven (the restore receiver special-cases `schedule.at` only) [P, C2]. Test it.
- Hide the toggle if notifications are denied.

---

## D4, D6, D7. Tags, split, owed-back

### Findings
- **Tags:** Monarch has one category and many tags per transaction; tags filter reports (a trip is the example) [P, M2]. **This app already covers the trip case** with a subcategory ("Travel > Goa trip", `budget.ts:1190`) [P, read].
- **Tag explosion:** no source measured it; a plain risk of free-text labels [I].
- **Split:** Monarch makes each part its own transaction [P, M2]. "Must sum to the total" is not stated on any page I read.
- **Rounding:** Splitwise pages did not explain it [P1]. `COMPETITIVE-RESEARCH-AND-PLAN.md` A1 (largest remainder) covers it.
- **Owed-back:** YNAB offers three workarounds and no clean model [P, Y1]. Splitwise's value is a shared ledger, which this app rules out (`THE-PLAN.md` section 9). A payback logged as a Refund in the same category already subtracts from spending [P, read].

### Recommendation

| Item | Verdict | Smallest honest version |
|---|---|---|
| **D4 Tags** | **CUT** | None. Use a subcategory for a trip. Revisit only if a cross-category need is named. |
| **D6 Split** | **Keep, small** | "Split" in the edit sheet turns one entry into N entries, each with its own category and amount; "Remaining ₹x" must reach zero to Save; largest-remainder for equal splits. No new field required (optional `splitId` for Undo). Totals logic is untouched, so nothing double counts. |
| **D7 Owed-back** | **CUT** | Zero code. Log the payback as a Refund in the same category. Add one sentence to the Refund hint: "Use this when someone pays you back." |

### Risks
- Splitting an imported row can break duplicate detection (`alreadyAdded` compares amount, date, card) [I]; mark children as seen.
- Cutting D7 means no "who owes me" list: deliberate; single-user need is unproven.

---

## D5. Merchant rules

### Findings
- **Monarch:** "Exactly matches" or "Contains" on merchant, plus amount and account filters; rules run in listed order, can apply to existing transactions, and are editable in Settings > Rules [P, M2].
- **Wallet:** keyword on note or payee sets category and labels; optionally applies to existing records [P, B1].
- **This app today:** two hidden layers, `suggestFor` (exact note match gives the last entry's category) and `guessCategory` (built-in regex list the user cannot see). Both feed `buildCandidates` and `buildStatementCandidates` via the `suggest` callback [P, read].

### Recommendation
- Add `rules?: { id; match: string; categoryId; instrumentId? }[]` to `BudgetData`, max 100, sanitised on load.
- **Match:** case-insensitive "contains", minimum 3 characters, matched on word boundaries. "ola" must not hit "Cola" [I].
- **Priority:** user rules in list order, then `suggestFor`, then `guessCategory`.
- **Wiring, no parser change:** pass `(note) => ruleFor(budget, note) ?? suggestFor(budget, note)` as the existing `suggest` argument. Statement rows already match on the `merchantFromNarration` text.
- **Visible:** the review row says why ("Food (rule: swiggy)"); a "Rules" row under Manage lists, edits, deletes.
- **Creation:** "Remember this merchant" checkbox when the user changes a category in review. Never creates categories; a rule with a deleted category is skipped and flagged.
- **Retroactive:** off in v1; later only "Apply to N uncategorised entries" with confirm and Undo.

### Risks
- A too-broad "contains" miscategorises quietly; the visible reason on every row is the mitigation.
- Rule order needs a plain move up/down control.

---

## E(a). Reboot, force-stop, time zone and Doze

### Findings
- **Android clears alarms on reboot, and the app must re-register** [P, A2].
- **The plugin already does this. I read it.** The merged `qa` manifest contains `RECEIVE_BOOT_COMPLETED` and `LocalNotificationRestoreReceiver`, listening on `LOCKED_BOOT_COMPLETED`, `BOOT_COMPLETED` and `QUICKBOOT_POWERON` [P, C2].
  - On boot it reloads every saved notification and re-arms the future ones.
  - A notification whose time passed while the phone was off is fired about 15 seconds after boot.
  - Already-fired one-shots are not re-fired.
  - It waits for the user to unlock.
- **So `THE-PLAN.md` Block E's "one reboot silently cancels every reminder" is not supported by the code.** The Capacitor docs are silent on reboot [P, C1]. Not proven either way on a phone (`TESTING.md` section 4, step 5 never run).
- **Real holes that remain**

| Case | What happens | Covered by |
|---|---|---|
| **Phone maker blocks the boot broadcast** (Xiaomi, Vivo, Oppo) | Nothing re-arms until the app opens [S, `DATA-FRESHNESS.md`; I] | App re-plans on every open (`App.tsx`); `verifyDelivery` warns |
| **Force-stop** | Android 15 cancels pending intents; the boot broadcast comes at the next user launch [P, A4]. Alarm-specific wording not found [I] | Same re-plan on open |
| **Time-zone or clock change** | No time-zone receiver in the plugin (grep). Alarms are fixed instants, so they fire at the old zone's 9:00 until the app opens [P/I] | Re-plan on open; native receiver not worth it |
| **Doze** | `allowWhileIdle`: one per 9 minutes per app [P, C1]; inexact alarms up to 1 hour late on Android 12+ [P, A2] | Fine for bills |
| **`applyNotifications` unsafe** | Cancels every pending id, then schedules; a throw is swallowed (`catch {}`): **nothing scheduled, no message** [P, `notifications.ts:113-138`] | Fix below. The one confirmed silent-loss path |

### Recommendation: the exact fix
1. **Prove it first (10 minutes, no code).** With 3 reminders set: `adb shell dumpsys alarm | grep vkcalc`, note the count, `adb reboot`, unlock, repeat. Expect the same entries; any that were due fire about 15 seconds after boot. Repeat once with the phone maker's autostart off.
2. **No native code.** Do not add a boot receiver. One already exists.
3. **Change `applyNotifications` to a diff** (size S):
   - Schedule first. Reusing the same id replaces the earlier alarm (the plugin uses the id as the request code with `FLAG_CANCEL_CURRENT`) [P, C2; confirm in test].
   - Then cancel only the pending ids that are not in `planned` and are not `TEST_ID`.
   - On any exception, keep the old alarms and record a "could not schedule" flag. Show that in the existing delivery message.
4. **Add one guard:** a line in `scripts/build-android.sh` that fails if the merged manifest lacks `LocalNotificationRestoreReceiver`.
5. **Fix the docs:** `THE-PLAN.md` Block E and `DATA-FRESHNESS.md` ("`RECEIVE_BOOT_COMPLETED` → reschedule everything on boot") should say the plugin does it, pending the phone test in step 1.

### Risks
- Step 1 may show failure on a specific phone maker; `oemSettings.ts` already guides autostart.
- Same-id replacement is read from source, not run.

---

## E(b). Repeat end, skip, snooze, quiet hours, digest

### Findings
- **Repeat end:** Google Tasks and Calendar offer "Ends: Never / On a date / After N occurrences" [P, T1]. RFC 5545 forbids `COUNT` and `UNTIL` together [P, T2].
- **Skip:** Google offers "This task / All tasks", no skip button found [P, T1]. iCalendar uses an exclusion date (`EXDATE`) [I, not read].
- **Quiet hours:** Android Do Not Disturb has a reminders exception [P, A5].
- **Digest:** every notification already lands at `reminderTime` (`planNotifications` rewrites the time of day) [P, read], and Android groups four or more [P, A4].
- **Constraint found in code:** an hour-level snooze ("in 3 hours") would be ignored, because `planNotifications` pins the time of day to `reminderTime`. Only whole days work [P, read].

### Recommendation (smallest model on `Reminder`)

| Item | Change |
|---|---|
| **End after N** | `remaining?: number`, the payments left including this one. "EMI for 24 months" stores 24. `markPaid`: if `remaining <= 1`, set `done` (for a bill, call the existing `stopBill` path, as `removeReminder` already does). Otherwise `remaining - 1` and advance. The edit sheet shows the computed last date. One field only: no end date, since `COUNT` and `UNTIL` are exclusive in the standard. |
| **Skip one** | `skip(id)`: advance the date with `nextOccurrence`, **no history entry, no budget entry, no decrement of `remaining`**. A skipped month moves the end out by one. Offer Undo through the existing `undoable`. Hide it on a one-time reminder. |
| **Snooze** | Days only. Notification action stays "Snooze 1 day". In-app choices: 1 day, 3 days, 1 week, all through the existing `snooze(id, days)`. No hours. |
| **Quiet hours** | **CUT.** Android DND exists. |
| **Daily digest** | **CUT.** One time of day plus Android's grouping already behaves like one. |

### Risks
- The skip-does-not-decrement rule is a decision, not a fact from a source. State it in the sheet.
- A bill reaching zero must end its `RecurringItem` too, or Budget keeps a half-alive bill. Cover with a test.
- Only the next occurrence is scheduled, so 24 months is not 24 alarms.

---
