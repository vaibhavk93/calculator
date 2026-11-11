# Plan: less typing. Day view, always-on SMS capture, Inbox, and an app that learns your tags

First written 2026-11-11. **Updated the same day with the owner's decisions** (always-on capture, two modes, auto-tag after two
identical confirmations with Undo, Play Store rules, masking check). A critic had said "build smaller"; the owner chose to keep
always-on capture, so it is built WITH the safeguards the critic asked for (see section 8).
Plain language on purpose. Terms are explained the first time they appear, and again in the glossary at the end.

---

## 1. The goal, in one line

**You should not have to type what the app can already work out, and the budget must stay clean while it does.**

| Your pain | What we build |
|---|---|
| "On a busy day (card, UPI, cash) I can't tell which transactions, which route, or why." | **Day view** (built) |
| "Typing every payment is too much work." | **Always-on capture + Inbox + learning** (being built) |
| "If auto-adding gets one wrong, the budget drifts into a mess." | **Quality guards**: strict rules, Undo, a drift circuit breaker (section 6) |

---

## 2. How it works, start to finish

```
   A bank SMS arrives (app can be closed)
                |
                v
   +------------------------------------------+
   | PHONE SIDE (Android)                     |
   | Only bank-style senders. Held encrypted, |
   | on this phone only, until you open Calc  |
   +--------------------+---------------------+
                        |  you open the app
                        v
   +------------------------------------------+
   | APP SIDE: read it, work out amount,      |
   | merchant, card/UPI. Save it. THEN tell   |
   | the phone side to forget the message     |
   +--------------------+---------------------+
                        |
          +-------------+--------------+
          v                            v
  +----------------+      #==============================#
  |  REVIEW FIRST  |      # * AUTO-ADD THE CONFIDENT    #
  |  (default)     |      #==============================#
  +-------+--------+                   |
          |                  +---------+----------+
          |                  v                    v
          |         passes ALL strict       anything less
          |         checks (section 6)      sure
          |                  |                    |
          |                  v                    |
          |         added to entries,             |
          |         marked "Auto-added",          |
          |         one-tap Undo                  |
          v                                       v
  +--------------------------------------------------+
  |  INBOX: you Approve, Change, Not a spend, Reject |
  |  Approve  => becomes a real entry                |
  |  Reject   => gone, never counted                 |
  +--------------------------------------------------+

   * = the mode for people who trust it   (Review first is the default)
```

**Review first (default).** Nothing becomes a real entry until you approve it. Your budget only holds what you confirmed.
**Auto-add the confident ones.** Only payments that pass every strict check are added for you. Everything else still waits in the Inbox.

---

## 3. What is built and what is next

| Phase | What | State |
|---|---|---|
| 0 | Prove the manual **Scan messages** button on your phone | Your step: tap Scan on the installed build |
| 1 | **Day view**: tap a day, see its spend, route totals, every entry | **Built and installed** |
| 2 | **Always-on capture** (phone side) + **Inbox** + permission explainer | **Being built now** |
| 3 | **Learning**: same payee, 2 identical confirmations, with Undo | **Being built now** |
| 4 | **Measure** for 2 to 4 weeks: accepted, changed, undone | After you use it |
| 5 | **Context hints** (time of day, UPI to a person), suggestions only | Only if Phase 4 shows they help |

---

## 4. The permission screen (so you always know why we ask)

Before Android's own dialog, Calc shows its own short explanation:

| Section | What it says (plain words) |
|---|---|
| Why | So you don't have to type each payment |
| What is read | Only messages from bank-style senders. Personal chats are never read. OTPs and offers are ignored |
| Where it stays | Only on this phone. Held encrypted until you open Calc. Not backed up. Never sent anywhere. Nobody else can see it |
| Diagnostics | Any text kept for debugging is masked (real digits and names are replaced) |
| Control | Turn capture off any time. "Delete captured messages" button |
| Buttons | **Allow messages** / **Not now** (Not now leaves everything else working) |

Cases handled: allowed, denied (with "Open settings"), blocked by Android's **restricted settings** on newer phones (3-step help:
App info, three dots, "Allow restricted settings", come back), and not available on the web.

---

## 5. Learning: counting, never guessing

| What the app has seen | What it does |
|---|---|
| A payee you tagged **once** | **Suggests** the same tag. You tap to accept |
| The **same tag twice in a row** | Becomes **auto-eligible**. In Auto mode it is added for you, marked "Auto-added", with **Undo** |
| You **undo or change** it | The count **resets**. It goes back to suggest-only until you confirm twice again |
| The payee is a **person** (UPI to a name) | **Never auto-added.** At most a hint |

Every suggestion says why ("You tagged Swiggy as Food twice"). "Learned payees" in Settings shows the list. You can change or forget any of them.

---

## 6. Quality guards (so the budget never drifts)

An item is auto-added **only if ALL of these are true**:

1. Auto mode is on.
2. Exactly **one** of your cards or accounts matches the message.
3. The amount and direction (money out) were read clearly.
4. It is **not a duplicate** of an entry or an earlier message.
5. The payee has a learned category with **two identical confirmations**.
6. The payee is **not a person**.

Plus:

| Guard | How it works |
|---|---|
| **Never the first time** | A new payee always goes to review |
| **Undo** | One tap. It removes the entry, resets that payee's count, puts the item back in the Inbox |
| **"Auto-added" label** | Visible in the Day view and lists, so you always know what you did not type |
| **Drift circuit breaker** | If 2 or more of the last 10 auto-added entries were undone or edited, the app **switches itself back to Review first** and tells you why |
| **No loss, no double count** | The phone side forgets a message only after the app has saved it. The same message can never enter twice (shared fingerprint with the manual scan) |

---

## 7. Safety and privacy

| Rule | Status |
|---|---|
| Everything is read and learned **on your phone**. Nothing is sent anywhere | Stays |
| Only **bank-style sender names** are read. Texts from people (phone numbers) are never read or kept | Stays |
| Android cloud auto-backup stays **off**; the queue is excluded from backups | Stays |
| **Changed:** the message text used to be "never stored". Now the phone **holds it briefly, encrypted** (Android Keystore key, app-private), until you open Calc, then deletes it the moment the app confirms it saved. Capped at 500 messages and 30 days | **Rule changed** (needed so capture works while the app is closed) |
| No message text or sender in any log | Enforced by a test |
| Unsure messages are not offered (the parser fails closed) | Stays |

### Masking was checked before building (2026-11-11)

Ran the masking on 5 realistic bank messages (card, UPI to a person, UPI to a merchant, account transfer, card spend) with two different
keys. **Result: every real digit, name, UPI name, date and reference changed; nothing real survived.** The only flags were a false
alarm on the bank's own `XXXX` mask and a chance "000". Same key gives the same fake value; a different key gives a different one.
Two small weaknesses, not blockers: fake times can come out invalid (cosmetic), and the same real value always masks the same way
within one phone (needed so repeats stay recognisable). Raw text is not written to any log: the Android plugin has no log calls and the
parser and import screen have none.

**Two kinds of data, kept apart:** the **working data** (real amount, merchant, card) lives only on your phone so the app can show you
your entries; the **diagnostic log** is the only place text is kept for troubleshooting, and it is masked.

---

## 8. What changed after the critic, and why

| Critic's objection | What we did |
|---|---|
| Always-on adds failure modes (battery managers, lost or double messages) | Built **with safeguards**: ack-after-save, shared fingerprint, atomic encrypted queue. The manual **Scan** button stays as a backup |
| Context learning can silently corrupt the budget | **Not built.** Phase 5, suggestion only |
| Auto-apply only for exact payee | Exactly the rule: 2 identical confirmations, never for people |
| Prove the scan on the phone first | Phase 0, your tap on the installed build |

---

## 9. Play Store: what Google actually says

**Corrected on 2026-11-11.** My first web search summary was wrong that expense tracking is not a listed use. Google's official page
lists **"SMS-based money management (e.g., apps that track and manage budget)"** as an exception that can get READ_SMS and RECEIVE_SMS.
It is **temporary, case by case, and needs Google's review and approval**.

To qualify we must:

| Requirement | How we meet it |
|---|---|
| The feature must be the app's **critical core functionality**, prominently described | Store listing and in-app text say so |
| Fill the **Permissions Declaration Form** in Play Console, and again if the use changes | Checklist in `docs/PLAY-SMS-POLICY.md` |
| **Prominent in-app disclosure and consent** before asking | The permission screen in section 4 |
| A **privacy policy** | To write before any store release |
| **No exfiltration** (a budgeting app may not share non-financial or personal SMS history) | Only bank senders; nothing leaves the phone |
| **No sale or transfer** of the data | Nothing is transferred |
| "No alternative method" must be true | Document why Notification access or SMS Retriever cannot do this |

Source: [Google Play: Use of SMS or Call Log permission groups](https://support.google.com/googleplay/android-developer/answer/10208820).
For now we build for your own phone (installed by cable or Wi-Fi). Store submission is a separate step.

---

## 10. Risks

| Risk | What we do |
|---|---|
| Phone brands (OnePlus etc.) can stop background work | The receiver is triggered by Android itself, not a background service. The manual Scan stays as a backup. We prove it on your phone |
| Android 15+ may block SMS permission for an app not from the Play Store | The permission screen explains the 3 steps |
| A wrong auto-added entry | Strict checks, label, Undo, circuit breaker |
| You stop reviewing | One minute a day, no nagging. If unused, we cut it |
| Google refuses the Play exception | The app still works on your phone. We decide then |

---

## 11. Glossary

| Term | Plain meaning |
|---|---|
| **Payee** | Who the money went to (Swiggy, "Rahul S") |
| **Inbox** | The waiting room for payments the app found. Nothing there is counted yet |
| **Receiver** | The small part of the app Android wakes when an SMS arrives, even if Calc is closed |
| **Queue** | The encrypted holding list on your phone until you open Calc |
| **Ack** | The app telling the phone side "saved it, you can forget it now" |
| **Fingerprint** | A short code for a message, so it is never counted twice, without keeping the text |
| **Auto-added** | The app added it for you after strict checks. You can Undo |
| **Circuit breaker** | If auto-adding gets too many wrong, the app switches itself off and goes back to Review first |
| **Masking** | Swapping real digits and names for look-alike fakes, so a diagnostic log shows layout but no real data |
| **Restricted settings** | An Android safety step that can block powerful permissions for apps not from the Play Store |

---

## Sources

- Critic reviews (2026-11-11): Day view; SMS Inbox and learning. Both said build smaller; the owner kept always-on capture with safeguards.
- Google Play SMS policy (link above), `docs/SMS-CAPTURE.md`, `docs/THE-PLAN.md` section 9, `docs/BUDGET-PLAN.md`.
