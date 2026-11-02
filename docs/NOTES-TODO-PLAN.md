# Plan: Notes + To-do

**Written:** 2026-11-02. **Status:** a plan only. No code has been changed.
**Evidence level:** app research comes from help pages, store listings and blog reviews (mostly second-hand). Code facts were read in this repo on this date.
**Reviewed by one critic** (see "What the critic changed" at the end). Its main point is adopted: build the **smallest** version, then use it.

**The answer in one line:** no new tab. Put To-do **inside Notes** behind a two-way switch. A task is a **saved card of a new kind**, so it reuses Trash, tags, pin, search, backup and the Reminder system, and the Due tab shows it with no extra work. Prove reminders on the phone first.

---

## A. What other apps do

| App | Standout features | Copy | Skip |
|---|---|---|---|
| **Google Keep** | Checklist toggle on any note; pin; 11 colours; labels; archive stays searchable; one reminder per note | Checklist in a note (we have it); pin; search | Colour per note (tinted sections do this); location reminders; sharing |
| **Google Tasks** | Date plus optional time; repeat (daily to yearly); subtasks one level only; star | One-level subtasks; date-only vs date-and-time; star as cheap "important" | Calendar link; drag to reorder |
| **Todoist** | Quick Add with "tomorrow 9am", "every Friday"; priority p1 to p4; Today and Upcoming sorted by priority; ticking a repeat moves it to the next date | Quick Add (late); Today; complete-and-advance for repeats | Projects, filters, labels, karma, comments |
| **Microsoft To Do** | My Day (resets nightly); steps are plain checkboxes with no date; due date has no time, reminder is the only date with a time; repeat incl. weekdays | Steps as plain checkboxes; "due" and "remind me" are different ideas | My Day; Outlook flags; sharing |
| **Apple Reminders** | Smart lists (Today, Scheduled, Flagged, All, Completed); overdue first in Today; `#tag` typing; swipe to flag | Overdue first; `#tag`; a Completed view | Location triggers; custom smart lists |
| **Things 3** | Inbox, Today (+ This Evening), Upcoming (7 days, then by month), Anytime, Someday; areas, projects, headings | Inbox (undated is not lost); Upcoming by day then month | Areas, headings, Someday |
| **TickTick** | Habits, Pomodoro, Eisenhower matrix, kanban; each can be switched off | Extras are **off by default** | All of the extras: different products |
| **Notion** | Checkbox + Date properties; saved views: Inbox (no date), Upcoming (next 7 days, not done); wide views fail on a phone | "Inbox = no date" as a view; plain list on a phone | Databases, boards |
| **Samsung Reminder / Notes** | Reminders with checklist, image, colour. Notes has no reminder, so users ask for one inside Notes | Proof that **users want reminders inside notes**: our product | Voice, templates, location |
| **Obsidian mobile** | Capture widgets (New Note, Daily Note); Shortcuts "append to daily note" | One-tap capture to an inbox | Widgets and Shortcuts now (native code) |
| **To-do UX articles** | Add action near the thumb; a visible button beside any swipe; empty state says what, why, what next | All three | Pull-to-add (hard to find) |

**Takeaways:** simple apps share **an inbox, a Today view, a date, a repeat**. Quick add that reads "tomorrow" is praised but easy to get wrong, so it comes late. Apps that add habits and boards become other products (**Memory beats features**, `docs/UX-GUIDELINES.md`).

---

## B. Where To-do lives

**What the app already has** (so we build only the gaps)

| Already there | Where |
|---|---|
| A card with title, note, tags, pin, soft delete, Trash for 7 days | `SavedCard`, `src/lib/memory.ts` |
| A list with checkboxes ("2 of 5 done") | `TapeLine.done`, `checklist` |
| One date per card, repeat monthly to yearly, Mark paid, Snooze, notifications | `Reminder`, `reminders.ts`, `notifications.ts` |
| Overdue / This week / Later grouping | `groupReminders`, `DueScreen.tsx` |

**The real gaps are three:** capture with **no date**, a **Today** view, and a **date per item** (today it is one date per list).

```
                 WHERE DOES TO-DO GO?
          bottom bar already has 5 tabs (the limit)
                          |
     +--------------------+--------------------+
     v                    v                    v
+-----------------+ #=======================# +-----------------+
| x New 6th tab   | # * MODE INSIDE NOTES   # | x Separate task |
+--------+--------+ #  task = card kind     # |   table + merge |
         |          #  Due shows it free    # +--------+--------+
  x breaks 5-tab    #=============+=========#          |
    limit; crowds                 |            x new Trash, new backup
    at 200% font          + no new tab           code, generic
                          + reuses Trash, tags,    reminder functions
                            search, backup,        touching working code
                            Reminder, Due
                          - Notes gets a switch
                          - Card cap (500) is shared

  * = recommended        # box = the pick        x prefix = ruled out
```

| Question | Answer | Why |
|---|---|---|
| New tab? | **No.** Tabs stay at five | Five labels at 200% font are still unchecked (`docs/HANDOFF.md` section 3) |
| Where? | **Notes, a switch: `Notes` / `To-do`** | Capture and keep belong together |
| What is a task? | **A `SavedCard` with `kind: 'task'`** and no calculator fields | The critic's point, checked in code: a card already has most of what a task needs |
| Its date? | **A normal `Reminder`** on that card | "Reminder reuse" as asked. Due, notifications, snooze work as they are |
| Due tab? | **Unchanged.** A dated task already appears there as a row (no amount) | Due stays a money screen. Two small text changes only: see E |
| Tab name | Stays **Notes** | Short labels survive 200% font |

---

## C. The to-do item

| Field | Phase | Required | Rule |
|---|---|---|---|
| Title | 1 | **Yes** | 1 to 120 characters (same as cards), trimmed |
| Done | 1 | auto | Checkbox. Undo for 6 seconds. A one-time task's reminder is marked done too |
| Note | 1 | No | Existing card note field |
| Due date, optional time | 1 | No | Native date input. Stored as the reminder's `dueAt`. **No time means 9:00 am**, as bills do today |
| Reminder on/off | 1 | No | On when a date is set. A task with no date has no reminder |
| Tags, pin | 2 | No | Existing. Tags are the only grouping. **No projects** |
| Repeat | 2 | No | Add `daily` and `weekly` to the existing none / monthly / quarterly / yearly. Ticking moves it to the next date and logs it in `history` |
| Priority | 2 | No | none / medium / high. Sorts first in a group. Shown as the **words**, never red or green |
| Steps (one level) | 2 | No | Checkbox + title each, max 30. No date or note. Ticking all does **not** tick the task |
| Link to a calculation or Budget entry | 3 | No | Stores an id. If the target is gone: "Linked item was deleted"; the task stays |

**Rules**

- Every delete is undoable. Deleted tasks go to the **existing Trash for 7 days**.
- **Overdue is shown, never hidden**, at the top of Today. Not re-notified (the existing rule).
- Done tasks stay in their group struck through for 5 seconds, then move to a collapsed **Done** section. "Clear done" is undoable. Nothing is auto-deleted.

---

## D. Screens

### D1. Notes + To-do home

The switch sits under the header. The add bar sits at the bottom, in thumb reach.

```
+----------------------------------------+
|  Notes                          (search)|
|  +-----------+-----------+              |
|  |   Notes   | [ To-do ] |   <- switch  |
|  +-----------+-----------+   44px each  |
|  ( Today 3 ) ( Upcoming ) ( All )       |
|                                         |
| +- Overdue ----------------------- 1 -+ |
| | [ ] Pay rent            2 days overdue| |
| +--------------------------------------+ |
| +- Today ------------------------- 2 -+ |
| | [ ] Call plumber     6:00 pm   High  | |
| | [ ] Renew insurance  every month     | |
| |     1 of 3 steps · Insurance         | |
| +--------------------------------------+ |
| +- Done today ------------------- 1 -+ |
| |  v  (collapsed)                      | |
| +--------------------------------------+ |
|  [ Add a task...                  ] [+] |
+----------------------------------------+
|  Calc  Tools  [Notes]  Due  Budget      |
+----------------------------------------+
```

- Tinted section cards from the existing `sect` classes and `tintStyle(n)`. No shadows. Overdue takes the alert heading on a plain card, as Due does.
- Each row has two targets: the checkbox (44px) and the text (opens the sheet).
- **All** shows "No date" first (the inbox), then dated, then Done. **Upcoming** groups by day for 7 days, then by month. Phase 1 may ship with **All and Today only**.
- Empty state says what, why, next: "Nothing due today. Add a task, or look at All."
- Search and tag chips filter the current side. The switch is remembered. Notes hides task cards; To-do shows only them.

### D2. Quick add

```
  Phase 1: title only.     Phase 3: parser
+----------------------------------------+
|  ( Fri 6 Nov ) ( High )   <- read back  |
|  [ pay rent fri !                  ] [+]|
+----------------------------------------+
```

| Rule | Why |
|---|---|
| Phase 1 to 2: Enter adds an undated task | Capture speed first |
| Phase 3: understand `today`, `tomorrow`, weekday names, `!` / `!!`, `#tag` | Small set, and Todoist and Apple both do versions of it |
| Understood words show as **chips before adding**, and a tap removes one | "may" or "sat" inside a title must not silently become a date |
| Never parse times or "every ..." | The biggest source of wrong guesses. Use the sheet |

### D3. Task sheet

```
+----------------------------------------+
|  Task                               [X] |
|----------------------------------------|
| +- Task ------------------------------+ |
| | Title *                             | |
| | [ Call plumber                    ] | |
| +--------------------------------------+ |
| +- When ------------------------------+ |
| | Date    [ Mon 2 Nov     ] [clear]   | |
| | Time    [ 6:00 pm       ] [clear]   | |
| | Repeat  [ Never        v]   (Ph. 2) | |
| | Remind me            [ on ]         | |
| +--------------------------------------+ |
| +- Details ---------------------------+ |
| | Priority ( None )( Medium )( High )  | |
| | Steps    [ ] Get quote        [x]    | |
| | Note     [                     ]     | |
| | Tags     ( Home )( + )               | |
| +--------------------------------------+ |
|  Delete task                  (text btn) |
|----------------------------------------|
|  [            Save                    ]  |  <- sticky footer
+----------------------------------------+
```

| Sheet rule (owner's list) | Applied |
|---|---|
| Close X top-right | Also closed by back and Escape (`useBackHandler`) |
| One primary action, sticky footer | **Save.** Delete is a quiet text button in the body |
| `*` on required fields | **Title \*** only |
| Tinted cards, no shadow | Task, When, Details: one tint each, kept off red, green and the accent (the test enforces it) |
| Closing with changes | "Discard changes?" with Keep editing / Discard |

**Mismatch to settle before building:** `docs/DESIGN-SYSTEM.md` section 12 says grab handle, title left, primary action top-right. The owner's rule is X top-right and a footer button. **If this is the new standard, change the doc and the existing sheets together** (`CLAUDE.md`). Do not build one sheet that disagrees with the rest.

---

## E. Data model, schema and backup

**Changes to existing types. No new table.**

```
SavedCard   (src/lib/memory.ts)
├── kind        'tool' | 'tape' | 'task'     <- add 'task'
├── done?       boolean                      <- new, optional; tasks only
├── doneAt?     number                       <- new, optional
├── priority?   'medium' | 'high'            <- Phase 2, absent = none
├── steps?      { id, title, done }[]        <- Phase 2, max 30
└── link?       { kind:'card'|'expense', id } <- Phase 3
    (toolId null, inputs null, amount null, lines [] for a task)

Reminder    (src/lib/memory.ts)
└── repeat      add 'daily' | 'weekly'       <- Phase 2; needs a day step
                in advance(), not a month step
```

| Topic | Decision |
|---|---|
| Schema bump | **None needed.** Every new field is optional and additive, as v2 to v3 was. `sanitizeCards` reads them if present. Add to its tests |
| Downgrade risk | `migrate()` keeps only fields it knows, then stamps the current version. **An older Calc opening newer data silently drops task fields on its next save.** Mitigation: the app is sideloaded by one person; say so in the backup screen ("restore on an older Calc loses task details") |
| Cap | Tasks share `MAX_CARDS = 500` today. 500 is plenty for a person, but at the limit the existing message ("Delete some first") is wrong for tasks. Reword it, or raise the cap to 1,000. **Owner choice** |
| Limits (my choice, unmeasured) | Title 120, note as cards, steps 30, tags 5. A longer checklist is a Note list |
| Backup | Cards and reminders are already inside `buildBackup`. **Test:** back up with tasks (dated, repeating, done), wipe, restore, same result |
| Layering | New pure functions in `src/lib/todo.ts` (group into Today / Upcoming / All, inbox filter). Imports only from `lib` and `engine`. UI in `features/memory/` |
| Notification text | `planNotifications` already works for any card. Two text fixes: the notification action **"Mark paid"** and Due's "Mark paid" button should say **"Done"** for a task card |
| Add to `sanitizeCards` | Reject a `kind: 'task'` card with empty title; cut steps over 30; unknown `priority` becomes absent |

---

## F. Reminder reliability on Android

**Plain truth:** a task reminder is a hint, not a promise. The list is the truth.
| Fact | Source | What it means |
|---|---|---|
| Every reminder fires at **9:00 am** today. Nothing is proven on a phone that kills background apps | `docs/HANDOFF.md`, `docs/TESTING.md` | Do not rely on task reminders until Phase 0 passes |
| `applyNotifications` cancels everything and schedules all again on each change (`allowWhileIdle`, exact only if allowed) | `src/lib/notifications.ts` | More tasks, a longer list. Plan only the nearest 60 and re-plan on app open (my choice) |
| Android 12+: an inexact alarm may fire up to an hour late, more under Doze or Battery Saver | [Schedule alarms](https://developer.android.com/training/scheduling/alarms) | A 6:00 pm task may arrive at 6:50. Settings should say "may be late" |
| "Alarms & reminders" is off by default for new installs on Android 13+, can be revoked, and revoking cancels exact alarms | [Android 14 changes](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms) | Settings already shows it. Re-check on app open |
| Restoring a backup to a new Android 14+ phone leaves that permission denied | same page | After restore, show the permission line and a Fix button |
| Play restricts `USE_EXACT_ALARM` to alarm and calendar apps. **Enforcement today not confirmed** | same page, [Medium](https://medium.com/gravel-engineering/exact-alarm-permission-google-plays-ticking-time-bomb-for-android-developers-e29e4d20b572) | Sideloaded now. **Decide before any Play listing** |
| OEM phones (the owner's OnePlus) add task killers and autostart limits | [ProAndroidDev](https://proandroiddev.com/beyond-doze-building-reliable-background-execution-on-modern-android-including-oem-realities-5fa0a6e05672) (secondary) | **Unproven on this phone** |
| Alarms surviving a reboot with this plugin | not checked | **Unproven.** Test: set one 10 minutes out, reboot, wait |

**Rules**

1. Today and Due are the source of truth. The notification only points at them.
2. Never re-notify overdue tasks.
3. Re-plan on app open and on resume. This heals missed schedules.
4. **Build "Send a test reminder" first** (`docs/BACKLOG.md` item 6). Without it nobody can tell "app is wrong" from "phone killed it".
5. If notifications are blocked, Today shows one quiet line: "Reminders are off. Tasks still show here."
6. The time picker is the same work as `IMPROVEMENT-PLAN.md` item 6. Build it once, for bills and tasks.

---

## G. Validation rules

| Field | Rule | Message |
|---|---|---|
| Title | Trim. Empty refused. Over 120 cut at entry | "Give the task a name" |
| Due date | Must be a real day. **Past dates allowed** (people log late) and show overdue | "That date does not exist" |
| Due time | Only with a date. Clearing the date clears the time | field disabled until a date is set |
| Repeat | Needs a date | "Pick a date first, so we know when it repeats" |
| Monthly on day 29 to 31 | Clamps to month end, anchored (Jan 31, Feb 28, Mar 31), using the existing `anchorDay` | shown as "Monthly on the 31st" |
| Remind me | Needs a date. If notifications are blocked, save anyway | "Saved. Reminders are off on this phone" |
| Steps | Blank dropped on save. Over 30 refused | "30 steps is the most. Make a list in Notes instead" |
| Tags | Trim, case-insensitive, max 5 | "5 tags is the most" |
| Link | Target must exist when picked | "Linked item was deleted" (later) |
| Storage read, errors | Always through `sanitizeCards`; bad values fixed or dropped, never thrown. Messages in plain words | |

---

## H. Phases

Sizes: **S** under a day, **M** one to three days, **L** a week or more. Gate "check" = `npm run check`. Gate "look" = real-browser pass at 360 px and 200% font, screenshots **looked at** (`CLAUDE.md`). `e2e/smoke.mjs` is stale and must be repaired before it can be a gate.

| Phase | Ships | Size | Gate | Flags |
|---|---|---|---|---|
| **0. Prove reminders, and try the cheap way** | "Send a test reminder" in Settings; time picker (bills first); overnight and reboot test on the OnePlus. **In parallel, for two weeks, use what exists:** a pinned checklist list plus Remind me, and note what is missing | M | Test notification arrives with the screen locked; result recorded in `docs/TESTING.md`. Owner writes down what the cheap way could not do | **Reminders unproven today.** Phase 1's date part depends on this |
| **1. Inbox, Today, All** | Card kind `task`; the Notes / To-do switch; add bar (title only); tick with Undo; task sheet (title, note, date, time, reminder); Today and All views; Trash and backup through existing paths | M | check; sanitize tests; backup round-trip; look | **Unproven that it beats the cheap way.** Only start if Phase 0 showed a real gap |
| **2. Depth** | Repeat daily and weekly (plus complete-and-advance); one-level steps; priority; tags and search on the To-do side; Upcoming view | M | check; repeat tests for month ends and Feb 29; look | Repeat is the most bug-prone part |
| **3. Connect** | Link to a calculation or Budget entry; "To-do" beside "To list" and "Remind me" on results; quick-add parser with chips | M | check; parser table test incl. "may" and "sat" in titles; look | Parser **unproven** to help |
| **4. Only if earned** | Merge tasks into Due with chips (All, Bills, Tasks); Android widget; swipe actions; "every N days" and weekday repeats | L | each judged alone | **Unproven.** Due is a money screen: `dueSoonTotal`, Mark paid |

**Swipe and widgets.** Guides say a visible button must sit beside any swipe, and an edge swipe is also Android's **back** gesture (my reasoning, not a test). So Phases 1 to 3 are tap only. Widgets need native code and a phone (`MEMORY-LAYER.md` 4.8): not in this plan.

---

## I. What to skip, and why

| Skip | Why |
|---|---|
| **Collaboration** (shared lists, assigning) | No account, no server. It would break "Your money stays on your phone" |
| **Cloud sync** | Same. Backup to a file covers loss. Sync stays opt-in and later (`MEMORY-LAYER.md` section 6) |
| **AI** (auto-sort, suggestions, voice parsing) | Needs a network or a model on the phone. Nothing shows it helps one person. The rule-based parser is enough |
| Projects, areas, headings, Someday | Tags cover grouping. Add only if tags prove too thin |
| Habits, Pomodoro, matrix, kanban | Different products |
| Location reminders, email-to-task | Extra permissions and servers |
| Colour per task, archive | Tinted sections give colour. The Done section is the archive |
| A separate task table | The critic showed cards already cover it |

---

## Sources

- Google Keep: [Technobezz](https://www.technobezz.com/how-to-use-google-keep-to-organize-notes-and-lists), [GCF Global](https://gcfglobal.org/en/google-keep/organizing-notes/1/)
- Google Tasks: [Android Police](https://www.androidpolice.com/google-tasks-tips-tricks/), [TasksBoard](https://tasksboard.com/blog/google-tasks-reminders-guide), [PhoneArena](https://www.phonearena.com/news/google-tasks-app-repeats-certain-chores-on-a-recurring-basis_id140045)
- Todoist: [Glossary](https://www.todoist.com/help/todoist/get-started/todoist-glossary-cA60laWMH), [Complete guide](https://www.todoist.com/de/inspiration/how-to-use-todoist-effectively)
- Microsoft To Do: [2Sync](https://2sync.com/blog/how-to-use-microsoft-to-do), [Carly](https://www.usecarly.com/blog/how-to-use-microsoft-to-do/)
- Apple Reminders: [App Store](https://apps.apple.com/gb/app/reminders/id1108187841/), [9to5Mac](https://9to5mac.com/2025/04/17/this-reminders-feature-is-a-lifesaver-when-my-task-list-grows-too-long/), [The Sweet Setup](https://thesweetsetup.com/updated-reminders/)
- Things 3: [Cultured Code](https://culturedcode.com/things/support/articles/4001304/), [Complete guide](https://vanja.io/things-3-complete-guide/)
- TickTick: [Martech Zone](https://martech.zone/ticktick-master-your-workflow-and-reclaim-your-time/)
- Notion: [Zapier template](https://zapier.com/blog/notion-to-do-list-template/)
- Samsung: [Reminder changelog](https://www.apkmirror.com/?p=10534112), [Guiding Tech](https://www.guidingtech.com/samsung-notes-app-tips-tricks-to-use/)
- Obsidian: [iOS help](https://obsidian.md/help/ios)
- To-do UX: [Kodeco](https://www.kodeco.com/77974/making-a-gesture-driven-to-do-list-app-like-clear-in-swift-part-1), [SAP empty state](https://www.sap.com/design-system/hcm/mobile-patterns/empty-state/no-item-empty-state/usage)
- Android alarms: [Schedule alarms](https://developer.android.com/training/scheduling/alarms), [Android 14 exact alarms](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms), [ProAndroidDev](https://proandroiddev.com/beyond-doze-building-reliable-background-execution-on-modern-android-including-oem-realities-5fa0a6e05672)

**Caveat:** most app facts come from reviews and guides, not vendor help centres. Verify before copying exactly.

---

## What the critic changed

| Objection (checked in code) | Result |
|---|---|
| A card already has kind, checklist, pin, tags, note, soft delete; a separate task table is not needed | **Adopted.** Task = card kind; date = existing Reminder |
| "Same Trash as notes" was wrong for a new table | Gone with the new table. Cards share Trash for real |
| Schema bump not needed (additive, like v2 to v3) | **Adopted.** No bump |
| Downgrade silently drops fields | Added to E |
| Merging into Due touches working code and a money screen | **Moved to Phase 4, "only if earned".** Due is unchanged now |
| Scope creep: priority, steps, links, parser | Pushed to Phases 2 and 3, each flagged unproven |
| Try the cheap version first; Phase 0 first | **Adopted** as Phase 0 |
| The 5-tab font check vs a second switch | Noted in B. The switch is inside Notes, not a tab |
| Uncommitted edits in `persistence.ts`, `types.ts`, `app.ts` | **Not verified** (this task could not run git). Check `git status` before starting |

---

## Summary and open questions

**Six lines**

1. No new tab. To-do is a **switch inside Notes**; the bar stays at five.
2. A task is a **saved card of kind `task`**, so Trash, tags, pin, search and backup come free. Its date is an ordinary **Reminder**, so Due and notifications work unchanged.
3. Real gaps are only: an undated inbox, a Today view, and a date per item. Phase 1 builds just those.
4. Repeat, steps, priority, links and a quick-add parser follow in Phases 2 and 3. Merging into Due is Phase 4, only if earned.
5. Reminders are **unproven on the owner's phone**. Phase 0 (test reminder, reboot test) comes first, alongside two weeks of using a pinned checklist.
6. Skipped: collaboration, cloud sync, AI, projects, habits, swipe, widgets (for now).

**Top 3 questions for the owner**

1. **Give one real to-do you would write this week.** If it is "pay this, with an amount", the existing list plus Remind me may already do it, and Phase 1 should wait until Phase 0 shows a real gap.
2. **Should tasks with no date ever notify?** The plan says no. A daily "you have 4 open tasks" nudge is the kind of thing that gets an app muted.
3. **Settle the sheet standard:** X top-right and a footer button for all sheets (existing ones change too), or only the new task sheet? Mixed styles in one app are the risk.
