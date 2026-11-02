# Critic: the top 8 feature proposals

Written 2026-11-02 by an independent critic (not the author of `REVIEW-NEW-FEATURES.md`).
I read section C of that file, `FEATURES.md`, `SESSION-STATE.md`, `CLAUDE.md`, and the code in
`src/lib/notifications.ts`, `reminders.ts`, `budget.ts`, `App.tsx`, the Android manifest and the notifications plugin manifest.
No code was changed. Nothing was run.

## Verdict first

**Build 3 now: (1) the test reminder, (4) CSV export, (5) "Add expense" after `=`.
Everything else waits, because the owner has not yet shown that he uses Budget, and the reminders are still unproven on a phone.**

Two facts the author's file did not weigh:
- **No proposal has evidence from the owner.** The sources are blogs and app-store pages about other apps. The doc's own three owner questions (section F) are still unanswered.
- **"Almost no permissions" is already stretched.** The app asks for `INTERNET`, plus (added by the notifications plugin) `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`. See the last section.

---

## Table

| # | Proposal | Verdict | Main reason | One test that settles it |
|---|---|---|---|---|
| 1 | Reminder time picker + test reminder | **BUILD NOW (test button and one global time only)** | The test is itself the measurement. Per-reminder time is polish. | Schedule a real reminder for 9:00 tomorrow on the OnePlus, swipe the app away, lock the phone. Did it ring? |
| 2 | Reminder packs, advance tax first | **BUILD LATER** | Four fixed dates are wrong for some owners. A wrong tax date is the worst bug this app can have. | Read the Income Tax Department page and write down who pays on which dates |
| 3 | Recurring bills, one record for reminder and expense | **BUILD LATER** | Biggest data-model change. Budget itself is unproven. | Count repeating reminders in the owner's Due tab, after one month of real Budget use |
| 4 | CSV export | **BUILD NOW (small)** | One day, no new permission, reuses the backup writer. Needs two safety fixes. | Export 6 expenses, open in Excel and Sheets, check rupee sign, commas, and a note that starts with `=` |
| 5 | "Add expense" after `=` | **BUILD NOW (money results only)** | No new data. One more button. Risk is layout. | Look at it on the real phone at 360px width and at 200% font |
| 6 | Use a result in a tool | **BUILD LATER** | 51 tools, each needs a field map. Copy and paste already works. | Ask: in the last month, how often did you copy a result and type it into a tool? |
| 7 | Card statement view + bill reminder | **BUILD LATER (split it)** | Statement view will not match the bank. The reminder part has a cheaper path. | Compare one real card statement with the app's number for the same period |
| 8 | Unequal split calculator | **BUILD LATER** | Safe and cheap, but no sign the owner splits bills. | Ask: did you split a bill unequally in the last 3 months? |

---

## Notes per proposal

### 1. Time picker + test reminder

**Strongest case against.** A one-minute test proves only that the channel and permission work with the phone awake.
It does not prove what matters: does a 9:00 reminder fire after the phone has been idle all night and the app was swiped away.
OnePlus phones are known for killing background apps (the doc's source for this is the Android docs plus general knowledge, not a OnePlus test).

**Two real problems in the code.**
- `App.tsx` re-plans on every screen return. `applyNotifications` cancels all pending notifications, then schedules again. A test notification scheduled one minute ahead is cancelled the moment the owner locks and unlocks the phone. The test needs its own id and must be skipped by the cancel step.
- 9:00 is baked into each reminder's `dueAt` when it is saved (`SaveSheet.tsx`, `new Date(y, m-1, d, 9)`). A global "reminder time" setting would not change reminders that already exist. Either re-time them at planning time or apply the setting to new ones only. Per-reminder time adds a field to every reminder: that is the data sprawl.

**Evidence.** The doc gives none beyond "backlog #6, #35". Fine: this one needs no evidence, it is a measurement tool.

**Cheaper alternative.** The test button only, with the same exact-or-inexact path real reminders use, and a line saying which mode it used. Skip the picker for now.

### 2. Reminder packs

**Strongest case against.** Advance tax is not four dates for everyone. As far as I know, people under the presumptive scheme (Section 44AD and 44ADA) pay one instalment by 15 March. The app already has a 44ADA calculator, so the owner may be one of them. A pack that sets four dates would be confidently wrong. Also: dates move after extensions, and the 2025 Act renumbers sections. The app then has a yearly job to keep dates right, with no way to push an update except a new build.

**Evidence.** Five blogs agree on 15 Jun, 15 Sep, 15 Dec, 15 Mar. No official page was read. By the project's own rule in `CLAUDE.md`, that is not enough to ship.

**Cheaper alternative.** The advance-tax calculator already shows amounts. Add "Remind me" on its result (the app already has this button on tools). The owner picks the date. No table of dates to keep.

### 3. Recurring bills

**Strongest case against.** It creates a new idea, a "planned" expense that is not yet real. That touches every total: month totals, limits at 80%, the heatmap, "Owes" per card, settlements, the double-count test. The author names this risk and still says build. Two sources of truth (Due and Budget) is a classic place for silent drift, and the Budget tab has never been used for a month.

**Evidence.** CRED and subscription-tracker blogs. Nothing from the owner. Question 1 in section F (does he miss bills?) is the real test, and it is open.

**Cheaper alternative.** Due already stores an amount and a repeat. Make "Mark paid" offer "Add as expense", with amount, category and date pre-filled. One tap, no generated rows, no second record. It gets 80% of the link at 10% of the change.

### 4. CSV export

**Strongest case against.** The owner may never open it. The JSON backup already exports everything. And a CSV is plaintext spending sitting in Downloads or in any app he shares it to.

**Fixes the author missed.**
- **Spreadsheet formula trap.** A note that starts with `=`, `+`, `-` or `@` runs as a formula in Excel and Sheets. Prefix such cells with a quote mark. Cheap, and it is a safety rule.
- **Reuse, do not rebuild.** `BackupFilePlugin.java` already writes into the Calc folder in Downloads without a storage permission. Use it.
- The doc's own BOM and warning-line ideas are right.

**Evidence.** Thin. "For a CA or ITR" is a guess about the owner. Question 3 is open.
Still a day of work and easy to remove, so it passes.

### 5. "Add expense" after `=`

**Strongest case against.** It is the third way in to Add expense, next to the Budget button and the Due flow. The action row has fixed height by design. Four buttons may not fit at 360px or at 200% font, and phone testing is currently slow and risky (see the 21:06 incident in `SESSION-STATE.md`).

**Evidence.** Reasoning only: Calc already has "To list" and "Remind me" in that row, so the pattern exists. No owner request in the doc.

**Cheaper alternative.** Put it in the existing history row menu (`HistoryRowSheet`) first. No layout risk. Promote to the `=` row only if used.
**Condition if built:** show it only when the result is a plain money amount, as the author says.

### 6. Use result in a tool

**Strongest case against.** Every tool needs a "which field takes a number" tag. That is 51 tools of tiny rules. Ids never change (project rule), so bad tags are hard to fix later. The author's own "wrong field" risk is real.

**Cheaper alternative.** Copy, then Paste into the tool field. Both already exist. "Copy as" can drop commas.

### 7. Card statement view + reminder

**Strongest case against.** Banks post purchases late, so the app's statement-month total will not match the real statement. An owner who trusts it may under-pay. The label "your estimate" helps, but numbers on a phone look official.

**Cheaper alternative for the reminder part.** When a card has a due day, offer "Remind me on the 18th every month" and create a normal monthly Due reminder. No new field (`billReminderId` is not needed if the card just shows the reminder it made). Do this at the same time as the test button, if at all.
Leave the statement-month toggle until Budget has real use.

### 8. Unequal split

**Strongest case against.** The author is right that a one-person offline app cannot hold a shared ledger. What is left is a sum with a rounding rule (who gets the extra paisa?). With one payer, "fewest payments" is trivial, so the clever part only matters for multi-payer groups. That is the part that goes stale.

**In its favour.** Pure engine code with tests, no stored data, no permission, no rules that go out of date. If the owner says yes to the question above, build it in a day, in parallel, with no collision.

---

## Which 3 first, and why

```
                    WHAT TO BUILD FIRST
                           |
    +----------------------+----------------------+
    v                      v                      v
#==============#    #==============#    #==============#
# * 1 TEST     #    # * 4 CSV      #    # * 5 ADD      #
#   REMINDER   #    #   EXPORT     #    #   EXPENSE    #
#==============#    #==============#    #==============#
 + proves reminders  + reuses backup      + no new data
   work, cheaply       writer, 1 day      + one button
 + no new permission + owner owns data    - layout risk on
 - cancel-bug to fix - formula trap to      small phones
                       guard
```
`*` = recommended. Items 2, 3, 6, 7, 8 are held back.

1. **Test reminder.** Every reminder feature (2, 3, 7) stands on it. It is a measurement, so it beats any debate about reminders.
2. **CSV export.** Smallest change that adds real value and reuses code that exists.
3. **"Add expense" after `=`.** No new storage, so nothing to corrupt. Do it as a money-only button.

**Why not recurring bills, the doc's value-5 item?** Because it is the riskiest for the data and it rests on a Budget tab nobody has used for a month. Do the cheap "Mark paid, then Add as expense" link first and see if it is used.

---

## Conflicts with "almost no permissions"

| Item | Conflict? | Detail |
|---|---|---|
| Already in the app | **Yes, today** | Manifest: `INTERNET`. Plugin adds: `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`. That is five, not "almost none". `SESSION-STATE.md` notes Play Store exact-alarm is still undecided. |
| 1 Time picker | **Soft** | No new permission. But a picked time like 7:30 makes the exact-alarm permission matter more. Without it, delivery may be minutes late. |
| 2, 3, 7 | **Soft** | No new permission. Each adds more reminders, so each leans harder on the same exact-alarm and boot permissions. |
| 4 CSV | **Soft, on privacy** | No permission. But it creates a plaintext file or a share to any app. The promise "stays on the phone" gets weaker. Warn in one line. |
| 5, 6, 8 | No | Pure screens and sums. |

**⚠ Remember:** the `INTERNET` permission is already used for live currency rates. Say so in the privacy wording. Do not describe the app as "no network" anywhere.

---

## What I did not check

- Whether the OnePlus kills the app overnight. Nobody has tested it.
- The real advance-tax rules for presumptive-scheme owners. I am working from general knowledge, so treat it as **unproven** until read from the official page.
- How the owner actually uses Budget. No usage data exists.
