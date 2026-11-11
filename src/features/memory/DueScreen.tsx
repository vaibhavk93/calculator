import { useEffect, useState } from 'react'
import { setMissed, missedText } from '../../lib/delivery'
import { useMissedReminder } from '../../components/useMissedReminder'
import { ReliableRemindersSheet } from '../settings/ReliableRemindersSheet'
import { Icon } from '../../components/Icon'
import { dotStyle } from '../../components/tint'
import { Sheet } from '../../components/Sheet'
import { EmptyState } from '../../components/EmptyState'
import { useApp } from '../../components/StoreProvider'
import { formatCell } from '../../lib/toolFormat'
import { D } from '../../engine'
import { billForCard } from '../../lib/recurring'
import { advanceTaxPack, afterDaysLabel, dueLabel, dueSoonTotal, groupReminders } from '../../lib/reminders'
import type { Reminder } from '../../store/types'
import { CardView } from './CardView'
import { Segmented } from '../settings/controls'
import { useTour } from '../onboarding/useTour'
import { DATE_LOCALE } from '../../lib/dateLocale'

/** Snooze moves the date by whole days: the reminder time of day is pinned, so an hour-level snooze would be ignored. */
const SNOOZES: [number, string][] = [[1, 'Snooze 1 day'], [3, 'Snooze 3 days'], [7, 'Snooze 1 week']]

const WHEN = new Intl.DateTimeFormat(DATE_LOCALE, { day: 'numeric', month: 'short' })

export function DueScreen() {
  const cards = useApp((s) => s.cards)
  const all = useApp((s) => s.reminders)
  const budget = useApp((s) => s.budget)
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const reminderTime = useApp((s) => s.settings.reminderTime)
  const cardView = useApp((s) => s.settings.dueCardView)
  const updateSettings = useApp((s) => s.updateSettings)
  const markPaid = useApp((s) => s.markPaid)
  const snooze = useApp((s) => s.snooze)
  const remove = useApp((s) => s.removeReminder)
  const setTab = useApp((s) => s.setTab)
  const addPack = useApp((s) => s.addAdvanceTaxPack)
  const [openId, setOpenId] = useState<string | null>(null)
  // A reminder cannot be brought back once removed, so Remove asks first (the store has no undo for reminders).
  const [askId, setAskId] = useState<string | null>(null)
  // The reminder whose "More" sheet (Snooze, Remove) is open. Remove closes it first and asks in the row, so two layers never stack.
  const [moreId, setMoreId] = useState<string | null>(null)
  const tabTap = useApp((s) => s.tabTap)
  // "A reminder may not have shown": found when the app was opened (lib/delivery.ts). Calm, and never certain.
  const missed = useMissedReminder()
  const [fixing, setFixing] = useState(false)
  const tour = useTour('due', (a) => a === 'reliable' && setFixing(true))

  // Tapping the Due tab while on it closes an open card.
  useEffect(() => { setOpenId(null); setMoreId(null) }, [tabTap])

  const now = Date.now()
  // A reminder whose card is in Trash stays quiet until the card is restored.
  const live = all.filter((r) => cards.some((c) => c.id === r.cardId && c.deletedAt === null))
  const g = groupReminders(live, now)
  const total = dueSoonTotal(live, cards, now)
  const open = cards.find((c) => c.id === openId && c.deletedAt === null)
  const moreR = live.find((r) => r.id === moreId)
  const more = moreR ? { id: moreR.id, title: cards.find((c) => c.id === moreR.cardId)?.title ?? 'Reminder' } : null
  // The pack offer is noise once it has been taken: hide it the moment all 4 titles already exist.
  const showPack = useApp((x) => x.settings.showAdvanceTaxOffer)
  const packDone = advanceTaxPack(now, reminderTime).every((p) => cards.some((c) => c.deletedAt === null && c.title === p.title))

  if (g.overdue.length + g.week.length + g.later.length === 0) {
    return (
      <>
      {tour.row}
      <EmptyState
        title="No reminders yet"
        action={<button type="button" className="btn btn--primary" onClick={() => setTab('saved')}>Open notes</button>}
        more={[{ label: 'Add advance tax reminders', onClick: addPack }, tour.empty]}
      >
        Save a calculation, such as a card total or an EMI, and add a reminder. It will show up here and tell you when it is due. No account, no internet.
      </EmptyState>
      {tour.sheet}
      {fixing && <ReliableRemindersSheet onClose={() => setFixing(false)} />}
      </>
    )
  }

  // Tier 2, content: hairline rows, no tint (docs/THE-PLAN.md section 7). Overdue still earns its own
  // meaning, not an identity colour: its heading alone takes the alert colour, same as the design system
  // already specified for the plain-card version -- a tint never did that.
  const section = (title: string, items: Reminder[], overdue = false) =>
    items.length > 0 && (
      <>
        <h2 className={overdue ? 'group__title group__title--alert' : 'group__title'}>
          <span>{title}</span>
          <span className="sect__count">{items.length}</span>
        </h2>
        <div className={cardView ? 'card-grid' : 'group'} aria-label={title}>
          {items.map((r) => {
            const card = cards.find((c) => c.id === r.cardId)!
            // A bill or card-bill reminder belongs to a record in Budget: paying it adds the entry, and Remove ends the bill.
            const bill = billForCard(budget, r.cardId)
            const doneWord = card.kind === 'task' && !bill ? 'Done' : 'Mark paid'
            const pays = doneWord === 'Mark paid'
            // A bill (or a saved amount) is paid with a worded button; a plain task keeps the round check.
            const doneBtn = pays ? (
              <button type="button" className="btn due__pay" aria-label={`Mark paid ${card.title}`} title={`Mark paid ${card.title}`} onClick={() => markPaid(r.id)}>
                Mark paid
              </button>
            ) : (
              <button type="button" className="due__check" aria-label={`Done ${card.title}`} title={`Done ${card.title}`} onClick={() => markPaid(r.id)}>
                <Icon name="check" size={20} />
              </button>
            )
            const moreBtn = (
              <button type="button" className="icon-btn due__more" aria-label={`More for ${card.title}`} title={`More for ${card.title}`} onClick={() => setMoreId(r.id)}>
                More
              </button>
            )
            const ask = askId === r.id && (
              <div className="due__actions">
                <span className="due__ask" role="alert">{bill ? 'Stop this bill? Past entries stay in your budget.' : 'Remove this reminder? The note stays.'}</span>
                <button type="button" className="link-btn" onClick={() => setAskId(null)}>Keep it</button>
                <button type="button" className="link-btn link-btn--danger" onClick={() => { remove(r.id); setAskId(null) }}>{bill ? 'Yes, stop it' : 'Yes, remove'}</button>
              </div>
            )
            const amount = card.amount !== null ? formatCell(new D(card.amount), card.amountFmt ?? 'money', { system, decimals }) : null
            // ONE meta line: when, how often, (in the list) how much, and how many payments are left.
            const meta = (withAmount: boolean) => (
              <span className={overdue ? 'row__hint due__alert' : 'row__hint'}>
                {dueLabel(r.dueAt, now)} · {WHEN.format(r.dueAt)}
                {r.afterDays ? ` · repeats ${afterDaysLabel(r.afterDays)}` : r.repeat !== 'none' ? ` · ${r.repeat}` : ''}
                {withAmount && amount && <> · <span className="due__amt">{amount}</span></>}
                {bill?.remaining ? ` · ${bill.remaining} ${bill.remaining === 1 ? 'payment' : 'payments'} left` : ''}
              </span>
            )
            return cardView ? (
              <div className="due-card" key={r.id}>
                <div className="due-card__top">
                  <button type="button" className="due-card__body" style={bill ? dotStyle(budget.categories, bill.categoryId) : undefined} onClick={() => setOpenId(card.id)}>
                    <span className="row__label">{bill && <span className="catdot" aria-hidden="true" />}{card.title}</span>
                    {amount && <span className="due-card__amt">{amount}</span>}
                    {meta(false)}
                  </button>
                  {moreBtn}
                </div>
                {/* No progress bar: a bill stores only the payments LEFT, not how many there were, so "paid of total"
                    cannot be worked out honestly (a loan added half-way through would look new). */}
                <div className="due-card__act">
                  {pays ? doneBtn : <button type="button" className="due__check" aria-label={`Done ${card.title}`} title={`Done ${card.title}`} onClick={() => markPaid(r.id)} />}
                  {!pays && <span className="due-card__word" aria-hidden="true">Tap to mark done</span>}
                </div>
                {ask}
              </div>
            ) : (
              <div className={pays ? 'due due--pay' : 'due'} key={r.id}>
                {pays ? <Icon name="budget" size={20} className="due__icon" /> : doneBtn}
                <button type="button" className="due__main" onClick={() => setOpenId(card.id)}>
                  <span className="row__label">{card.title}</span>
                  {meta(true)}
                </button>
                <span className="due__btns">
                  {pays && doneBtn}
                  {moreBtn}
                </span>
                {ask}
              </div>
            )
          })}
        </div>
      </>
    )

  return (
    <div className="tools">
      {/* CardView stacks on top below without unmounting this -- its own h1 (from ScreenHeader)
          must be the only one while it's open, not two at once. */}
      {!open && (
        <header className="tabroot__bar">
          <h1 className="screen__title">Due</h1>
        </header>
      )}
      {!open && tour.row}
      {missed && !open && (
        <div className="due__missed" role="status">
          <p>{missedText(missed)}</p>
          <div className="due__missed-acts">
            <button type="button" className="link-btn" onClick={() => setFixing(true)}>Fix reminders</button>
            <button type="button" className="link-btn" onClick={() => setMissed(null)}>Dismiss</button>
          </div>
        </div>
      )}
      {!total.isZero() && (
        <div className="due__total">
          <span className="due__label">Amounts due in the next 30 days</span>
          <span className="due__hero">{formatCell(total, 'money', { system, decimals })}</span>
        </div>
      )}
      {!open && (
        <div className="due__view">
          <Segmented
            label="Show due items as"
            value={cardView ? 'card' : 'list'}
            onChange={(v) => updateSettings({ dueCardView: v === 'card' })}
            options={[
              { value: 'list', label: 'List' },
              { value: 'card', label: 'Card' },
            ]}
          />
        </div>
      )}
      <div className="tools__list">
        {section('Overdue', g.overdue, true)}
        {section('This week', g.week)}
        {section('Later', g.later)}
        {/* Inside the scrollable list, not a flex:none sibling after it: a sibling has no height limit
            of its own, so with enough reminders plus 200% font it could overflow .tools' un-clipped box
            and bleed into the tab bar underneath -- a real, pre-existing bug the new layout-contract
            suite caught (confirmed against the commit before this change, identical numbers). Scrolling
            with everything else is what guarantees it is always reachable. */}
        {showPack && !packDone && (
          <div className="due__pack">
            <p className="note">Advance tax is due 15 Jun, 15 Sep, 15 Dec and 15 Mar. Add all four, then edit them like any reminder.</p>
            <button type="button" className="btn" onClick={addPack}>Add a pack: advance tax</button>
          </div>
        )}
      </div>
      {open && <CardView card={open} onBack={() => setOpenId(null)} />}
      {more && (
        <Sheet title={more.title} onClose={() => setMoreId(null)}>
          <div className="group" aria-label="Reminder options">
            {SNOOZES.map(([days, label]) => (
              <button key={days} type="button" className="navrow tap-row" onClick={() => { snooze(more.id, days); setMoreId(null) }}>
                <span className="navrow__label">{label}</span>
              </button>
            ))}
            <button type="button" className="navrow tap-row due__remove" onClick={() => { setAskId(more.id); setMoreId(null) }}>
              <span className="navrow__label">Remove reminder</span>
            </button>
          </div>
        </Sheet>
      )}
      {fixing && <ReliableRemindersSheet onClose={() => setFixing(false)} />}
      {tour.sheet}
    </div>
  )
}
