import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/EmptyState'
import { useApp } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { formatCell } from '../../lib/toolFormat'
import { D } from '../../engine'
import { dueLabel, dueSoonTotal, groupReminders } from '../../lib/reminders'
import type { Reminder } from '../../store/types'
import { CardView } from './CardView'

/** Overdue is the one section that earns a hue by meaning: its heading takes the alert colour on a plain card. */
const OVERDUE = { '--tint': 'var(--surface)', '--tint-ink': 'var(--alert)' } as React.CSSProperties

const WHEN = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

export function DueScreen() {
  const cards = useApp((s) => s.cards)
  const all = useApp((s) => s.reminders)
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const markPaid = useApp((s) => s.markPaid)
  const snooze = useApp((s) => s.snooze)
  const remove = useApp((s) => s.removeReminder)
  const setTab = useApp((s) => s.setTab)
  const [openId, setOpenId] = useState<string | null>(null)
  // A reminder cannot be brought back once removed, so Remove asks first (the store has no undo for reminders).
  const [askId, setAskId] = useState<string | null>(null)
  const tabTap = useApp((s) => s.tabTap)

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
      <EmptyState
        title="No reminders yet"
        action={<button type="button" className="btn btn--primary" onClick={() => setTab('saved')}>Open notes</button>}
      >
        Save a calculation, such as a card total or an EMI, and add a reminder. It will show up here and tell you when it is due. No account, no internet.
      </EmptyState>
    )
  }

  const section = (title: string, items: Reminder[], tint: number, overdue = false) =>
    items.length > 0 && (
      <section className="sect" style={overdue ? OVERDUE : tintStyle(tint)} aria-label={title}>
        <h2 className="sect__head">
          <span>{title}</span>
          <span className="sect__count">{items.length}</span>
        </h2>
        <div className="sect__body">
          {items.map((r) => {
            const card = cards.find((c) => c.id === r.cardId)!
            return (
              <div className="due" key={r.id}>
                <button type="button" className="due__main tap-row" onClick={() => setOpenId(card.id)}>
                  <span className="row__text">
                    <span className="row__label">{card.title}</span>
                    <span className={overdue ? 'row__hint due__alert' : 'row__hint'}>
                      {dueLabel(r.dueAt, now)} · {WHEN.format(r.dueAt)}
                      {r.repeat !== 'none' ? ` · ${r.repeat}` : ''}
                    </span>
                  </span>
                  <Icon name="chevron" size={18} className="tap-row__chev" />
                </button>
                {card.amount !== null && <span className="result__value">{formatCell(new D(card.amount), card.amountFmt ?? 'money', { system, decimals })}</span>}
                <div className="due__actions">
                  {askId === r.id ? (
                    <>
                      <span className="due__ask" role="alert">Remove this reminder? The note stays.</span>
                      <button type="button" className="link-btn" onClick={() => setAskId(null)}>Keep it</button>
                      <button type="button" className="link-btn link-btn--danger" onClick={() => { remove(r.id); setAskId(null) }}>Yes, remove</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="link-btn" onClick={() => markPaid(r.id)}>Mark paid</button>
                      <button type="button" className="link-btn" onClick={() => snooze(r.id, 1)}>Snooze 1 day</button>
                      <button type="button" className="link-btn link-btn--danger" onClick={() => setAskId(r.id)}>Remove</button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    )

  return (
    <div className="tools">
      <div className="due__total">
        <span className="result__label">Due in the next 30 days</span>
        <span className="tape__sum">{formatCell(total, 'money', { system, decimals })}</span>
      </div>
      <div className="tools__list sections">
        {section('Overdue', g.overdue, 8, true)}
        {section('This week', g.week, 5)}
        {section('Later', g.later, 8)}
      </div>
      {open && <CardView card={open} onBack={() => setOpenId(null)} />}
    </div>
  )
}
