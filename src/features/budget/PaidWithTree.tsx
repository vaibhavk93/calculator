import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { type BudgetData, type Filter } from '../../lib/budget'
import { paymentTree, type PayNode } from '../../lib/paymentTree'
import { useMoney } from './SpendSummary'

const entriesWord = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`

/**
 * "Paid with": each way of paying (UPI, credit card...) with what actually paid under it (which bank account, which card).
 * Tap a way of paying to open its sub-types; tap "See entries" on any row to list exactly those entries.
 */
export function PaidWithTree({ budget, month, scope, onPick }: { budget: BudgetData; month: string; scope: Filter; onPick: (f: Filter) => void }) {
  const money = useMoney()
  const [open, setOpen] = useState<string | null>(null)
  const tree = paymentTree(budget, month, scope)

  const see = (n: PayNode) => (
    <button type="button" className="link-btn spend__link" aria-label={`See the ${entriesWord(n.count)} paid with ${n.label}`} onClick={() => onPick(n.filter)}>
      See {entriesWord(n.count)}
    </button>
  )

  return (
    <>
      {tree.map((m) => {
        const expandable = m.children.length > 0
        const isOpen = open === m.id
        return (
          <div key={m.id}>
            {expandable ? (
              <button type="button" className="budget__row tap-row" aria-expanded={isOpen} aria-label={`${m.label}, ${money(m.spent)}, ${entriesWord(m.count)}. ${isOpen ? 'Hide' : 'Show'} what paid`} onClick={() => setOpen(isOpen ? null : m.id)}>
                <span className="row__label">{m.label}</span>
                <Icon name="chevron" size={18} className={isOpen ? 'tap-row__chev tap-row__chev--open' : 'tap-row__chev'} />
                <span className="budget__amt spend__amt">{money(m.spent)}</span>
                <span className="budget__note">{entriesWord(m.count)} · {m.children.length} {m.children.length === 1 ? 'source' : 'sources'}</span>
              </button>
            ) : (
              <div className="budget__row budget__row--plain">
                <span className="row__label">{m.label}</span>
                <span className="budget__amt spend__amt">{money(m.spent)}</span>
                <span className="budget__note">{entriesWord(m.count)}</span>
                {see(m)}
              </div>
            )}
            {expandable && isOpen && (
              <div className="paid__subs">
                {m.children.map((c) => (
                  <div className="budget__row budget__row--plain paid__sub" key={c.id}>
                    <span className="row__label">{c.label}</span>
                    <span className="budget__amt spend__amt">{money(c.spent)}</span>
                    <span className="budget__note">{[c.detail, entriesWord(c.count)].filter(Boolean).join(' · ')}</span>
                    {see(c)}
                  </div>
                ))}
                <div className="paid__all">{see(m)}</div>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
