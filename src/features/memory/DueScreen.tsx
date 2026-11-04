import { useEffect, useState } from 'react'
import { setMissed, missedText } from '../../lib/delivery'
import { useMissedReminder } from '../../components/useMissedReminder'
import { ReliableRemindersSheet } from '../settings/ReliableRemindersSheet'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/EmptyState'
import { useApp } from '../../components/StoreProvider'
import { formatCell } from '../../lib/toolFormat'
import { D } from '../../engine'
import { billForCard } from '../../lib/recurring'
import { afterDaysLabel, dueLabel, dueSoonTotal, groupReminders } from '../../lib/reminders'
import type { Reminder } from '../../store/types'
import { CardView } from './CardView'
import { useTour } from '../onboarding/useTour'

const WHEN = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

export function DueScreen() {
  const cards = useApp((s) => s.cards)
  const all = useApp((s) => s.reminders)
  const budget = useApp((s) => s.budget)
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const markPaid = useApp((s) => s.markPaid)
  const snooze = useApp((s) => s.snooze)
  const remove = useApp((s) => s.removeReminder)
  const setTab = useApp((s) => s.setTab)
  const addPack = useApp((s) => s.addAdvanceTaxPack)
  const [openId, setOpenId] = useState<string | null>(null)
  // A reminder cannot be brought back once removed, so Remove asks first (the store has no undo for reminders).
  const [askId, setAskId] = useState<string | null>(null)
  const tabTap = useApp((s) => s.tabTap)
  // "A reminder may not have shown": found when the app was opened (lib/delivery.ts). Calm, and never certain.
  const missed = useMissedReminder()
  const [fixing, setFixing] = useState(false)
  const tour = useTour('due', (a) => a === 'reliable' && setFixing(true))

  // Tapping the Due tab while on it closes an open card.
  useEffect(() => setOpenId(null), [tabTap])

  const now = Date.now()
  // A reminder whose card is in Trash stays quiet until the card is restored.
  const live = all.filter((r) => cards.some((c) => c.id === r.cardId && c.deletedAt === null))
  const g = groupReminders(live, now)
  const total = dueSoonTotal(live, cards, now)
  const open = cards.find((c) => c.id === openId && c.deletedAt === null)

  if (g.overdue.length + g.week.length + g.later.length === 0) {
    return (
      <>
      {tour.row}
      <EmptyState
        title="No reminders yet"
        action={
          <>
            <button type="button" className="btn btn--primary" onClick={() => setTab('saved')}>Open notes</button>
            <button type="button" className="btn" onClick={addPack}>Add advance tax reminders</button>
            {tour.link}
          </>
        }
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
        <div className="group" aria-label={title}>
          {items.map((r) => {
            const card = cards.find((c) => c.id === r.cardId)!
            // A bill or card-bill reminder belongs to a record in Budget: paying it adds the entry, and Remove ends the bill.
            const bill = billForCard(budget, r.cardId)
            return (
              <div className="due" key={r.id}>
                <button type="button" className="due__main tap-row" onClick={() => setOpenId(card.id)}>
                  <span className="row__text">
                    <span className="row__label">{card.title}</span>
                    <span className={overdue ? 'row__hint due__alert' : 'row__hint'}>
                      {dueLabel(r.dueAt, now)} · {WHEN.format(r.dueAt)}
                      {r.afterDays ? ` · repeats ${afterDaysLabel(r.afterDays)}` : r.repeat !== 'none' ? ` · ${r.repeat}` : ''}
                    </span>
                  </span>
                  <Icon name="chevron" size={18} className="tap-row__chev" />
                </button>
                {card.amount !== null && <span className="result__value">{formatCell(new D(card.amount), card.amountFmt ?? 'money', { system, decimals })}</span>}
                <div className="due__actions">
                  {askId === r.id ? (
                    <>
                      <span className="due__ask" role="alert">{bill ? 'Stop this bill? Past entries stay in your budget.' : 'Remove this reminder? The note stays.'}</span>
                      <button type="button" className="link-btn" onClick={() => setAskId(null)}>Keep it</button>
                      <button type="button" className="link-btn link-btn--danger" onClick={() => { remove(r.id); setAskId(null) }}>{bill ? 'Yes, stop it' : 'Yes, remove'}</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="link-btn" onClick={() => markPaid(r.id)}>{card.kind === 'task' && !bill ? 'Done' : 'Mark paid'}</button>
                      <button type="button" className="link-btn" onClick={() => snooze(r.id, 1)}>Snooze 1 day</button>
                      <button type="button" className="link-btn link-btn--danger" onClick={() => setAskId(r.id)}>{bill ? 'Stop' : 'Remove'}</button>
                    </>
                  )}
                </div>
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
          <span className="result__label">Amounts due in the next 30 days</span>
          <span className="tape__sum">{formatCell(total, 'money', { system, decimals })}</span>
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
        <div className="due__pack">
          <p className="note">Advance tax is due 15 Jun, 15 Sep, 15 Dec and 15 Mar. Add all four, then edit them like any reminder.</p>
          <button type="button" className="btn" onClick={addPack}>Add a pack: advance tax</button>
        </div>
      </div>
      {open && <CardView card={open} onBack={() => setOpenId(null)} />}
      {fixing && <ReliableRemindersSheet onClose={() => setFixing(false)} />}
      {tour.sheet}
    </div>
  )
}
