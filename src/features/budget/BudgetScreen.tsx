import { useEffect, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { useApp } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { D, type Dec } from '../../engine'
import { entriesIn, monthKey, monthLabel, shiftMonth, summarise, type BudgetExpense } from '../../lib/budget'
import { formatCell } from '../../lib/toolFormat'
import { CategorySheet, ExpenseSheet, LimitsSheet } from './sheets'

type SheetState = null | { kind: 'expense'; id: string | null } | { kind: 'category'; id: string } | { kind: 'limits' }

const SHORT = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const shortDate = (key: string) => {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number)
  return SHORT.format(new Date(y, m - 1, d))
}

/** A thin bar. Colour is never the only signal: the words beside it say left or over. */
function Bar({ pct }: { pct: number }) {
  return (
    <div className="budget__track" aria-hidden="true">
      <div className="budget__fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

export function BudgetScreen() {
  const budget = useApp((s) => s.budget)
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const deleteExpense = useApp((s) => s.deleteExpense)
  const tabTap = useApp((s) => s.tabTap)
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [sheet, setSheet] = useState<SheetState>(null)

  // Tapping the Budget tab while on it goes back to this month.
  useEffect(() => {
    setMonth(monthKey(new Date()))
    setSheet(null)
  }, [tabTap])

  const money = (v: Dec) => formatCell(v, 'money', { system, decimals })
  const s = summarise(budget, month)
  const nameOf = (e: BudgetExpense) => budget.categories.find((c) => c.id === e.categoryId && c.deletedAt === null)?.name ?? 'Uncategorised'
  const never = budget.expenses.every((e) => e.deletedAt !== null)

  const sheets = (
    <>
      {sheet?.kind === 'expense' && <ExpenseSheet expense={budget.expenses.find((e) => e.id === sheet.id)} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'category' && <CategorySheet id={sheet.id} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'limits' && <LimitsSheet onClose={() => setSheet(null)} />}
    </>
  )

  if (never && entriesIn(budget, month).length === 0) {
    return (
      <>
        <EmptyState
          title="No spending yet"
          action={
            <>
              <button type="button" className="btn btn--primary" onClick={() => setSheet({ kind: 'expense', id: null })}>Add expense</button>
              <button type="button" className="link-btn" onClick={() => setSheet({ kind: 'limits' })}>Set a monthly limit</button>
            </>
          }
        >
          Add what you spend, one entry at a time. Set a monthly limit and this page shows what is left. It all stays on this phone.
        </EmptyState>
        {sheets}
      </>
    )
  }

  const heroValue = s.overall ? s.overall.left : s.spent
  const over = s.overall !== null && s.overall.left.isNegative()

  return (
    <div className="tools">
      <header className="budget__bar">
        <h1 className="screen__title">Budget</h1>
        <span className="screen__spacer" />
        <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
          <Icon name="back" size={20} />
        </button>
        <span className="budget__month" aria-live="polite">{monthLabel(month)}</span>
        <button type="button" className="icon-btn budget__next" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
          <Icon name="chevron" size={20} />
        </button>
      </header>

      <div className="tools__list sections">
        <section className="sect" style={tintStyle(3)} aria-label="Summary">
          <div className="budget__sum">
            <span className="result__label">{s.overall ? 'Left this month' : 'Spent this month'}</span>
            <span className="budget__hero">{money(over ? heroValue.abs() : heroValue)}</span>
            {s.overall ? (
              <>
                <Bar pct={s.overall.pct} />
                <span className={over ? 'budget__note budget__note--over' : 'budget__note'}>
                  {over ? `Over by ${money(s.overall.left.abs())}` : `${money(s.spent)} spent of ${money(s.overall.limit)}`}
                </span>
              </>
            ) : (
              <button type="button" className="link-btn budget__link" onClick={() => setSheet({ kind: 'limits' })}>Set a monthly limit</button>
            )}
            {s.overall && (
              <button type="button" className="link-btn budget__link" onClick={() => setSheet({ kind: 'limits' })}>Change limits</button>
            )}
          </div>
        </section>

        <div className="budget__add">
          <button type="button" className="btn btn--primary" onClick={() => setSheet({ kind: 'expense', id: null })}>Add expense</button>
        </div>

        <section className="sect" style={tintStyle(4)} aria-label="Categories">
          <h2 className="sect__head"><span>Categories</span></h2>
          <div className="sect__body">
            {s.lines.map((c) => (
              <button key={c.id} type="button" className="budget__row" onClick={() => setSheet({ kind: 'category', id: c.id })}>
                <span className="row__label">{c.name}</span>
                <span className="budget__amt">{money(c.spent)}</span>
                {c.limit && c.left && c.pct !== null ? (
                  <>
                    <Bar pct={c.pct} />
                    <span className={c.left.isNegative() ? 'budget__note budget__note--over' : 'budget__note'}>
                      {c.left.isNegative() ? `Over by ${money(c.left.abs())}` : `${money(c.left)} left`} of {money(c.limit)}
                    </span>
                  </>
                ) : (
                  <span className="budget__note">No limit</span>
                )}
              </button>
            ))}
            {!s.uncategorised.isZero() && (
              <div className="budget__row budget__row--plain">
                <span className="row__label">Uncategorised</span>
                <span className="budget__amt">{money(s.uncategorised)}</span>
              </div>
            )}
          </div>
        </section>

        <section className="sect" style={tintStyle(5)} aria-label="This month">
          <h2 className="sect__head">
            <span>This month</span>
            <span className="sect__count">{s.entries.length}</span>
          </h2>
          <div className="sect__body">
            {s.entries.length === 0 && <p className="budget__none">Nothing spent in {monthLabel(month)}. Tap Add expense to add the first.</p>}
            {s.entries.map((e) => {
              const amount = new D(e.amount)
              return (
                <div className="budget__entry" key={e.id}>
                  <button type="button" className="budget__main" aria-label={`Edit ${money(amount)} ${nameOf(e)}`} onClick={() => setSheet({ kind: 'expense', id: e.id })}>
                    <span className="budget__amt">{money(amount)}</span>
                    <span className="row__label">{nameOf(e)}</span>
                    <span className="row__hint">{shortDate(e.date)}{e.note ? ` · ${e.note}` : ''}</span>
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Delete ${money(amount)} ${nameOf(e)}`} onClick={() => deleteExpense(e.id)}>
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </div>
      {sheets}
    </div>
  )
}

