import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useApp } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { useBackHandler } from '../../components/useBackHandler'
import { D } from '../../engine'
import {
  INSTRUMENT_KINDS,
  cardOutstanding,
  effectiveLimit,
  effectiveOverall,
  hasMonthLimit,
  instrumentLabel,
  limitLabel,
  monthKey,
  monthLabel,
  monthShortLabel,
  networkLabel,
  owesWords,
  type PayInstrument,
} from '../../lib/budget'
import { CategoryEditSheet } from './CategoryEditSheet'
import { InstrumentForm } from './InstrumentForm'
import { OverallLimitSheet } from './limits'
import { useMoney } from './SpendSummary'

type Target =
  | null
  | { kind: 'overall' }
  | { kind: 'category'; id: string }
  | { kind: 'newCategory' }
  | { kind: 'instrument'; id: string | null }

/**
 * Limits, categories (with subcategories) and the cards, accounts and wallets entries can be paid from. Opened from Budget and
 * from Settings. `month` is the month whose limits are shown and changed when a limit is "for one month only".
 */
export function ManageScreen({ onBack, month = monthKey(new Date()) }: { onBack: () => void; month?: string }) {
  useBackHandler(true, onBack)
  const budget = useApp((s) => s.budget)
  const money = useMoney()
  const [target, setTarget] = useState<Target>(null)

  const live = budget.categories.filter((c) => c.deletedAt === null)
  const tops = live.filter((c) => c.parentId === null)
  const instruments = budget.instruments.filter((i) => i.deletedAt === null)
  const close = () => setTarget(null)
  const amountText = (limit: string | null) => (limit ? money(new D(limit)) : null)

  const instrumentHint = (i: PayInstrument) =>
    [i.network ? networkLabel(i.network) : '', i.bank, i.kind === 'credit' ? owesWords(cardOutstanding(budget, i.id), money) : ''].filter(Boolean).join(' · ')

  const row = (key: string, label: string, hint: string | undefined, onOpen: () => void, sub = false) => (
    <button key={key} type="button" className={sub ? 'navrow tap-row manage__sub' : 'navrow tap-row'} onClick={onOpen}>
      <span className="row__text">
        <span className="row__label">{label}</span>
        {hint && <span className="row__hint">{hint}</span>}
      </span>
      <Icon name="chevron" size={18} className="navrow__chev" />
    </button>
  )

  const catHint = (c: (typeof live)[number]) => {
    const limit = limitLabel(amountText(effectiveLimit(c, month)), hasMonthLimit(c, month) ? 'month' : 'always', month)
    return c.months && c.months.length > 0 ? `${limit} · Only in ${c.months.map(monthShortLabel).join(', ')}` : limit
  }
  const overallHint = limitLabel(amountText(effectiveOverall(budget, month)), hasMonthLimit({ overallByMonth: budget.overallByMonth }, month) ? 'month' : 'always', month)

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="Categories and cards">
      <ScreenHeader title="Categories and cards" onBack={onBack} />
      <div className="screen__body">
        <section className="sect sect--settings" style={tintStyle(7)} aria-label="Limits">
          <h2 className="sect__head">Limits</h2>
          <div className="sect__body">{row('overall', 'Overall limit', overallHint, () => setTarget({ kind: 'overall' }))}</div>
          <p className="manage__help">Limits shown are for {monthLabel(month)}. Tap one to change it for every month or for {monthShortLabel(month)} only.</p>
        </section>

        <section className="sect sect--settings" style={tintStyle(7)} aria-label="Categories">
          <h2 className="sect__head">Categories</h2>
          <div className="sect__body">
            {tops.map((c) => (
              <div key={c.id}>
                {row(c.id, c.name, catHint(c), () => setTarget({ kind: 'category', id: c.id }))}
                {live.filter((s) => s.parentId === c.id).map((s) => row(s.id, s.name, catHint(s), () => setTarget({ kind: 'category', id: s.id }), true))}
              </div>
            ))}
            {tops.length === 0 && <p className="manage__none">No categories yet.</p>}
          </div>
          <div className="manage__actions">
            <button type="button" className="btn" onClick={() => setTarget({ kind: 'newCategory' })}>Add a category</button>
          </div>
        </section>

        <section className="sect sect--settings" style={tintStyle(7)} aria-label="Payment methods">
          <h2 className="sect__head">Payment methods</h2>
          <div className="sect__body">
            {instruments.length === 0 && <p className="manage__none">No cards or accounts yet. Add the ones you pay with, so an entry can say which one.</p>}
            {INSTRUMENT_KINDS.map((k) => {
              const list = instruments.filter((i) => i.kind === k.id)
              if (list.length === 0) return null
              return (
                <div key={k.id}>
                  <h3 className="manage__kind">{k.label}s</h3>
                  {list.map((i) => row(i.id, instrumentLabel(i), instrumentHint(i) || undefined, () => setTarget({ kind: 'instrument', id: i.id })))}
                </div>
              )
            })}
          </div>
          <p className="manage__help">A RuPay credit card can pay by UPI. Add it as a credit card with the network RuPay.</p>
          <div className="manage__actions">
            <button type="button" className="btn" onClick={() => setTarget({ kind: 'instrument', id: null })}>Add a card or account</button>
          </div>
        </section>
      </div>

      {target?.kind === 'overall' && <OverallLimitSheet month={month} onClose={close} />}
      {target?.kind === 'category' && <CategoryEditSheet id={target.id} month={month} onClose={close} />}
      {target?.kind === 'newCategory' && <CategoryEditSheet id={null} month={month} onClose={close} />}
      {target?.kind === 'instrument' && <InstrumentForm id={target.id} onClose={close} />}
    </div>
  )
}
