import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useApp } from '../../components/StoreProvider'
import { dotStyle } from '../../components/tint'
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
  summarise,
  utilisationWords,
  type PayInstrument,
} from '../../lib/budget'
import { CategoryEditSheet } from './CategoryEditSheet'
import { InstrumentForm } from './InstrumentForm'
import { OverallLimitSheet } from './limits'
import { RulesScreen } from './RulesScreen'
import { Segmented } from '../settings/controls'
import { useMoney } from './SpendSummary'

type Target =
  | null
  | { kind: 'overall' }
  | { kind: 'category'; id: string }
  | { kind: 'newCategory' }
  | { kind: 'instrument'; id: string | null }
  | { kind: 'rules' }

/**
 * Limits, categories (with subcategories) and the cards, accounts and wallets entries can be paid from. Opened from Budget.
 * `month` is the month whose limits are shown and changed when a limit is "for one month only".
 */
export function ManageScreen({ onBack, month = monthKey(new Date()) }: { onBack: () => void; month?: string }) {
  useBackHandler(true, onBack)
  const budget = useApp((s) => s.budget)
  const money = useMoney()
  const [target, setTarget] = useState<Target>(null)
  const [view, setView] = useState<'categories' | 'cards'>('categories')

  const live = budget.categories.filter((c) => c.deletedAt === null)
  const tops = live.filter((c) => c.parentId === null)
  const instruments = budget.instruments.filter((i) => i.deletedAt === null)
  const close = () => setTarget(null)
  // What this month looks like, for the right-hand figures: spent per category, entries per card (design: Categories and cards).
  const sum = summarise(budget, month)
  const spentOf = new Map(sum.lines.flatMap((l) => [l, ...l.children]).map((l) => [l.id, l.spent]))
  const entriesOf = new Map(sum.byInstrument.map((r) => [r.instrument.id, r.count]))
  const amountText = (limit: string | null) => (limit ? money(new D(limit)) : null)

  const instrumentHint = (i: PayInstrument) =>
    [i.network ? networkLabel(i.network) : '', i.bank, i.kind === 'credit' ? owesWords(cardOutstanding(budget, i.id), money) : '', i.kind === 'credit' ? (utilisationWords(cardOutstanding(budget, i.id), i.creditLimit, money) ?? '') : ''].filter(Boolean).join(' · ')

  const row = (key: string, label: string, hint: string | undefined, onOpen: () => void, sub = false) => (
    <button key={key} type="button" className={sub ? 'navrow tap-row manage__sub' : 'navrow tap-row'} onClick={onOpen}>
      <span className="row__text">
        <span className="row__label">{label}</span>
        {hint && <span className="row__hint">{hint}</span>}
      </span>
      <Icon name="chevron" size={18} className="navrow__chev" />
    </button>
  )

  // No limit set (for every month) is the plain case: say nothing rather than repeat "No limit" on every row.
  const limitHint = (limit: string | null, monthOnly: boolean) => (limit === null && !monthOnly ? '' : limitLabel(limit, monthOnly ? 'month' : 'always', month))
  const catHint = (c: (typeof live)[number]) => {
    const limit = limitHint(amountText(effectiveLimit(c, month)), hasMonthLimit(c, month))
    const only = c.months && c.months.length > 0 ? `Only in ${c.months.map(monthShortLabel).join(', ')}` : ''
    return [limit, only].filter(Boolean).join(' · ') || undefined
  }
  const overallHint = limitHint(amountText(effectiveOverall(budget, month)), hasMonthLimit({ overallByMonth: budget.overallByMonth }, month)) || undefined

  // A category: its colour dot, name (and limit, when there is one), what it came to this month, a chevron.
  const catRow = (c: (typeof live)[number], sub: boolean) => {
    const spent = spentOf.get(c.id)
    const hint = catHint(c)
    return (
      <button key={c.id} type="button" className={sub ? 'navrow tap-row manage__row manage__sub' : 'navrow tap-row manage__row'} style={dotStyle(budget.categories, c.id)} onClick={() => setTarget({ kind: 'category', id: c.id })}>
        {sub ? null : <span className="catdot" aria-hidden="true" />}
        <span className="row__text">
          <span className="row__label">{c.name}</span>
          {hint && <span className="row__hint">{hint}</span>}
        </span>
        {spent && !spent.isZero() && <span className="budget__amt manage__amt">{money(spent)} / mo</span>}
        <Icon name="chevron" size={18} className="navrow__chev" />
      </button>
    )
  }
  // A card or account: a small block in its own colour, the name, "Credit card · 9 entries this month", then what it owes.
  const cardRow = (i: PayInstrument, kind: string) => {
    const n = entriesOf.get(i.id) ?? 0
    const extra = instrumentHint(i)
    return (
      <button key={i.id} type="button" className="navrow tap-row" style={dotStyle(instruments, i.id)} onClick={() => setTarget({ kind: 'instrument', id: i.id })}>
        <span className="cardblock" aria-hidden="true" />
        <span className="row__text">
          <span className="row__label">{instrumentLabel(i)}</span>
          <span className="row__hint">{kind} · {n} {n === 1 ? 'entry' : 'entries'} this month</span>
          {extra && <span className="row__hint">{extra}</span>}
        </span>
        <Icon name="chevron" size={18} className="navrow__chev" />
      </button>
    )
  }

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="Categories and cards">
      <ScreenHeader title="Categories and cards" onBack={onBack} />
      <div className="screen__body">
        <div className="budget__seg">
          <Segmented<'categories' | 'cards'>
            label="Show"
            value={view}
            onChange={setView}
            options={[{ value: 'categories', label: 'Categories' }, { value: 'cards', label: 'Cards' }]}
          />
        </div>

        {view === 'categories' ? (
          <>
            <section className="sect sect--settings" aria-label="Categories">
              <div className="sect__body">
                {tops.map((c) => (
                  <div key={c.id}>
                    {catRow(c, false)}
                    {live.filter((s) => s.parentId === c.id).map((s) => catRow(s, true))}
                  </div>
                ))}
                {tops.length === 0 && <p className="manage__none">No categories yet.</p>}
              </div>
              <div className="manage__actions">
                <button type="button" className="btn" onClick={() => setTarget({ kind: 'newCategory' })}>
                  <Icon name="plus" size={18} />
                  <span>Add a category</span>
                </button>
              </div>
            </section>

            <section className="sect sect--settings" aria-label="Limits">
              <h2 className="sect__head">Limits</h2>
              <div className="sect__body">{row('overall', 'Overall limit', overallHint, () => setTarget({ kind: 'overall' }))}</div>
              <p className="manage__help">Limits shown are for {monthLabel(month)}. Tap one to change it for every month or for {monthShortLabel(month)} only.</p>
            </section>

            <section className="sect sect--settings" aria-label="Merchant rules">
              <h2 className="sect__head">Merchant rules</h2>
              <div className="sect__body">
                {row('rules', 'Rules', (budget.rules ?? []).length === 0 ? 'Pick a category by merchant when adding from messages' : `${(budget.rules ?? []).length} ${(budget.rules ?? []).length === 1 ? 'rule' : 'rules'}`, () => setTarget({ kind: 'rules' }))}
              </div>
            </section>
          </>
        ) : (
          <section className="sect sect--settings" aria-label="Payment methods">
            <div className="sect__body">
              {instruments.length === 0 && <p className="manage__none">No cards or accounts yet. Add the ones you pay with, so an entry can say which one.</p>}
              {INSTRUMENT_KINDS.flatMap((k) => instruments.filter((i) => i.kind === k.id).map((i) => cardRow(i, k.label)))}
            </div>
            <p className="manage__help">A RuPay credit card can pay by UPI. Add it as a credit card with the network RuPay.</p>
            <div className="manage__actions">
              <button type="button" className="btn" onClick={() => setTarget({ kind: 'instrument', id: null })}>
                <Icon name="plus" size={18} />
                <span>Add a card or account</span>
              </button>
            </div>
          </section>
        )}
      </div>

      {target?.kind === 'overall' && <OverallLimitSheet month={month} onClose={close} />}
      {target?.kind === 'category' && <CategoryEditSheet id={target.id} month={month} onClose={close} />}
      {target?.kind === 'newCategory' && <CategoryEditSheet id={null} month={month} onClose={close} />}
      {target?.kind === 'instrument' && <InstrumentForm id={target.id} onClose={close} />}
      {target?.kind === 'rules' && <RulesScreen onBack={close} />}
    </div>
  )
}
