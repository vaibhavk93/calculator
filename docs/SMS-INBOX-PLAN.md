# Plan: less typing. Day view, SMS Inbox, and an app that learns your tags

Written 2026-11-11. Owner's two asks, merged into one plan, after a critic review (verdict: **build smaller**).
Plain language on purpose. Terms are explained the first time they appear, and again in the glossary at the end.

---

## 1. The goal, in one line

**You should not have to type what the app can already guess, and on a busy day you should be able to see what happened.**

Two pains drive this:

| Your pain | What we build |
|---|---|
| "On a day with many transactions (credit card, UPI, cash) I can't tell which ones, by which route, or why." | **Day view**: one screen per day |
| "Typing every transaction is too much work. The app should capture, learn and suggest." | **Inbox + learning**: bank messages land in a review list, and the app remembers your tags |

---

## 2. What you asked for, and what the plan does with it

| You asked for | Plan | Why |
|---|---|---|
| App always listens to SMS and logs each one | **Later, not first.** First: the app reads your messages when you open it and fills the Inbox | Same Inbox, same result, far fewer ways to fail or leak (see section 7) |
| Review later: assign, mark, accept | **Yes, Phase 2** | This is the heart of the idea |
| Remember my tag, tag the same thing next time | **Yes, Phase 3**, for the same payee (counting, no AI) | Safe and accurate |
| Context ("UPI to a person on my office commute = Travel") | **Suggestion only, and only after we measure** (Phase 5) | The same person can be rent, a lunch split, or a loan back. A wrong tag that looks right is worse than an empty one |
| Suggest while reviewing: "tag as Travel?" | **Yes**, one tap to accept | |
| Reduce manual effort overall | The whole point. Success is measured (section 8) | |

---

## 3. Where we are today

| Piece | State |
|---|---|
| Add from bank messages (tap **Scan**, pick 7/30/90 days, review, Add) | Built. **Never proven on your phone with real messages** |
| Remember a merchant's category | Built (merchant rules): a repeat merchant gets its old category pre-filled |
| Message text stored? | **No.** Only a short fingerprint, so a message is not offered twice |
| Listening in the background | **Not built, on purpose.** An earlier review set the rule "no background receiver" |
| Day view | Being built now |

---

## 4. The plan, in order

```
                     START: today
                          |
                          v
        +-----------------------------------+
        |  PHASE 0  Prove the scan works    |   you + me, on your phone
        +-----------------+-----------------+
                          |
                          v
        +-----------------------------------+
        |  PHASE 1  Day view                |   in progress
        +-----------------+-----------------+
                          |
                          v
        #===================================#
        # * PHASE 2  Inbox (scan on open)   #   the big win
        #===================================#
                          |
                          v
        +-----------------------------------+
        |  PHASE 3  Learning: same payee    |
        +-----------------+-----------------+
                          |
                          v
        +-----------------------------------+
        |  PHASE 4  Measure for 2 to 4 weeks|
        +--------+-----------------+--------+
                 |                 |
        enough proof?         not enough proof
                 |                 |
                 v                 v
   +---------------------------+  +------------------+
   | PHASE 5  Optional extras: |  | Stop here. Keep  |
   | context hints, always-on  |  | it simple.       |
   | listening                 |  +------------------+
   +---------------------------+

   * = recommended next step      # box = the biggest payoff
```

---

## 5. Each phase

### Phase 0. Prove the scan works (small, do first)

| | |
|---|---|
| What | Tap **Scan messages** on your phone with your real bank messages |
| Look for | Does Android ask for the SMS permission? Is it blocked ("restricted settings" on Android 15 and later)? Are your banks' message formats read correctly? |
| Done when | A real scan shows your real payments, with the right amounts, cards and merchants |
| Why first | Everything else sits on top of this. It has only ever been tested on made-up messages |

### Phase 1. Day view (in progress)

| | |
|---|---|
| What you see | Tap a day. One big number (that day's spend), one line of totals per route ("UPI ₹1,200 · HDFC Credit ₹3,400 · Cash ₹150"), then every entry in the order you added it |
| The "why" | A one-tap **Add a note** on any entry without one. No new fields, no reason chips |
| Why no chips | The critic: a fixed list (Need, Want...) is a chore you will drop, and it doesn't hold real reasons like "Rohan's birthday dinner" |

### Phase 2. The Inbox (the big win)

| | |
|---|---|
| What | A **Review** list in Budget. Each bank message the app finds becomes one card: amount, merchant, card or UPI, date, and a suggested category |
| Your actions | **Accept** (one tap), **Change** (pick another category, add a note), **Not a spend** (a refund, a transfer to yourself), **Ignore** |
| When it fills | When you open the app (and on pull-to-refresh). The app reads new messages then. Nothing runs in the background |
| Counter | A quiet "5 to review" on Budget. **No nagging notification** |
| Safety | Same rules as today: message text is never stored, OTPs and offers are ignored, unsure messages are not offered, and the same message never appears twice |
| Done when | A week of your real messages is reviewed in about a minute a day |

### Phase 3. Learning, simple and honest

No AI and no internet. The app **counts what you did** and says so.

| What the app has seen | What it does |
|---|---|
| A payee you tagged **once** | **Suggests** that tag next time. You tap to accept |
| A payee you tagged the **same way twice in a row** | **Applies it automatically**, shown as "auto-tagged" with a one-tap **Undo** |
| You undo or change an auto-tag | It **stops auto-applying** for that payee until you confirm it twice again |
| The payee is a **person** (UPI to a name) | Shows a hint, "you usually tag this one as Rent". **Never automatic** |

Every suggestion says why: "Because you tagged this payee Food 3 times". You can see and edit the list of learned rules (this builds on the existing Merchant rules screen).

### Phase 4. Measure for 2 to 4 weeks

| | |
|---|---|
| What | The app keeps three counters on the phone: suggestions accepted, suggestions changed, auto-tags undone |
| Why | So we decide on facts. If most suggestions are accepted, learning works |
| Rule of thumb | Auto-tag only keeps going if undo is rare |

### Phase 5. Optional extras (only if Phase 4 proves they help)

| Extra | Rule |
|---|---|
| **Context hints** (time of day, weekday, amount, "UPI to a person") | **Suggestion only, never automatic.** Needs several matches before it appears |
| **Always-on listening** (the app catches each SMS the moment it arrives) | Only after we decide on the Play Store question below, and only with safe draining (the app confirms it saved an entry before the queue forgets it) |

---

## 6. Learning examples

| What happens | Result |
|---|---|
| Swiggy ₹450 | Suggest Food (you tagged Swiggy before). Accept in one tap |
| Swiggy again, you accepted last time too | **Auto-tagged Food**, with Undo |
| UPI to "Rahul S" ₹150 at 9 am | Hint: "usually Travel". You decide. Could be chai or a loan back |
| UPI to "Rahul S" ₹150, you pick Food this time | The app notes the mismatch and stops the hint until you confirm again |

---

## 7. Safety and privacy (these rules stay)

| Rule | Status |
|---|---|
| All reading and learning happens **on your phone**. Nothing is sent anywhere | Stays |
| Message **text is never stored**. Only fields the parser read (amount, merchant, card digits, date) | Stays |
| Only messages from **bank-style sender names** are read. Texts from people are never read | Stays |
| Android's cloud auto-backup stays **off** | Stays |
| Unsure messages are **not offered** (the parser fails closed) | Stays |
| Every auto-tag can be **undone** | New |

**Why always-on listening is deferred.** It breaks the earlier rule "no background receiver". It adds a second route for data to arrive, with risks of lost or double-counted messages. Phone battery managers can silently stop it, so a missed message is invisible, while a scan can always be redone. For you the Inbox looks the same either way, because you review later.

---

## 8. How we will know it worked

| Measure | Target (a guess, not proven) |
|---|---|
| Time to review a normal day | Under a minute |
| Suggestions you accept without changing | Most of them (we set the bar after Phase 4 data) |
| Auto-tags you undo | Rare |
| Days you can say "what happened and why" | Every busy day, from the Day view |

---

## 9. Decisions only you can make

| # | Decision | Recommendation |
|---|---|---|
| 1 | **Always-on listening: now or later?** | **Later (Phase 5).** The Inbox does the same job without the risk |
| 2 | **Play Store or personal app?** Google restricts SMS permissions to default messaging apps and gives exceptions case by case. Expense tracking is not a listed use, so a store build may be refused. Sources: [Google Play SMS policy](https://support.google.com/googleplay/android-developer/answer/9047303), [policy summary](https://support.google.com/googleplay/android-developer/answer/16909972) | Decide before building Phase 5. For now, build for your own phone |
| 3 | Is **auto-tagging after two identical confirmations** right, or do you want suggestions only? | Auto after two, with Undo |

---

## 10. Risks

| Risk | What we do |
|---|---|
| The scan has never run on real messages | Phase 0 first |
| Android 15+ may block SMS permission for an installed-by-cable app ("restricted settings", reported by developers, not yet tested here) | Phase 0 finds out. The fix is a setting on your phone |
| Wrong tags that look right | Auto only for the same payee, always visible, always undoable. Person payees never automatic |
| You stop reviewing | One minute a day, no nag. If unused in weeks, we cut it |
| Learned rules pile up | A visible, editable list of rules |

---

## 11. Glossary

| Term | Plain meaning |
|---|---|
| **Payee** | Who the money went to (Swiggy, "Rahul S") |
| **Inbox** | The review list of payments the app found |
| **Scan on open** | The app reads your bank messages when you open it, not all day |
| **Always-on listening** | A hidden part of the app that catches each SMS as it arrives |
| **Receiver** | That hidden part. Android lets an app register one |
| **Fingerprint** | A short code of a message, so the app knows it already saw it, without keeping the text |
| **Auto-tag** | The app chose the category by itself, because of your past choices |
| **Restricted settings** | An Android safety step that can block powerful permissions for apps not installed from the Play Store |

---

## Sources

- Critic reviews (2026-11-11): Day view, and SMS Inbox and learning. Both verdicts: build smaller.
- `docs/SMS-CAPTURE.md` (the safety rules and what is built), `docs/THE-PLAN.md` section 9 (what is ruled out), `docs/BUDGET-PLAN.md`.
