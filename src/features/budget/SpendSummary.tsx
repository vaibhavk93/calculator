import { useState, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useApp } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { useBackHandler } from '../../components/useBackHandler'
import { D, type Dec } from '../../engine'
import {
  SETTLEMENT_LABEL,
  categoryName,
  compareLastMonth,
  dailyAverage,
  dayLongLabel,
  instrumentLabel,
  limitState,
  modeLabel,
  monthKey,
  monthLabel,
  monthShortLabel,
  shiftMonth,
  sharePercent,
  summarise,
  topEntries,
  trend,
  type BudgetExpense,
  type CategoryLine,
  type LimitState,
} from '../../lib/budget'
import { formatCell } from '../../lib/toolFormat'
import { Segmented } from '../settings/controls'
import { FilterSheet, scopeKey, scopeLabel, type Scope } from './FilterSheet'
import { Heatmap } from './Heatmap'
import { ExpenseSheet } from './sheets'

export type SummaryTab = 'summary' | 'entries'

/** Money in the user's number system and decimals. */
export function useMoney() {
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  return (v: Dec) => formatCell(v, 'money', { system, decimals })
}

const SHORT = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
export const shortDate = (key: string) => {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number)
  return SHORT.format(new Date(y, m - 1, d))
}

const monthName = (key: string, style: 'long' | 'short' | 'strip') => {
  const [y = 1970, m = 1] = key.split('-').map(Number)
  const opts: Intl.DateTimeFormatOptions = style === 'strip' ? { month: 'short', year: '2-digit' } : { month: style }
  return new Intl.DateTimeFormat(undefined, opts).format(new Date(y, m - 1, 1))
}

/** A thin bar. Colour is never the only signal: the words beside it carry the same numbers. */
export function Bar({ pct }: { pct: number }) {
  return (
    <div className="budget__track" aria-hidden="true">
      <div className="budget__fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

/** Previous month, the month, next month. */
export function MonthNav({ month, onMonth }: { month: string; onMonth: (m: string) => void }) {
  return (
    <>
      <button type="button" className="icon-btn" aria-label="Previous month" title="Previous month" onClick={() => onMonth(shiftMonth(month, -1))}>
        <Icon name="back" size={20} />
      </button>
      <span className="budget__month" aria-live="polite">{monthLabel(month)}</span>
      <button type="button" className="icon-btn budget__next" aria-label="Next month" title="Next month" onClick={() => onMonth(shiftMonth(month, 1))}>
        <Icon name="chevron" size={20} />
      </button>
    </>
  )
}

/** Where spending stands against a limit, in words. Never colour alone. */
export function limitWords(state: LimitState, left: Dec, limit: Dec, money: (v: Dec) => string): string {
  switch (state) {
    case 'fine': return `${money(left)} left of ${money(limit)}`
    case 'close': return `Close to the limit: ${money(left)} left of ${money(limit)}`
    case 'reached': return `Limit reached (${money(limit)})`
    case 'over': return `Over by ${money(left.abs())} (limit ${money(limit)})`
  }
}

/** One entry: tap the row to edit it, the trash to remove it (the snack bar offers Undo). A bill payment or transfer says it is not spending. */
export function EntryRow({ e, onEdit }: { e: BudgetExpense; onEdit: (id: string) => void }) {
  const budget = useApp((s) => s.budget)
  const remove = useApp((s) => s.deleteExpense)
  const money = useMoney()
  const amount = new D(e.amount)
  const name = e.settlement ? SETTLEMENT_LABEL[e.settlement] : categoryName(budget, e.categoryId)
  const inst = e.instrumentId === null ? undefined : budget.instruments.find((i) => i.id === e.instrumentId)
  const how = [e.mode ? modeLabel(e.mode) : '', inst ? instrumentLabel(inst) : ''].filter(Boolean).join(' · ')
  const hint = [shortDate(e.date), how, e.settlement ? 'Not counted as spending' : '', e.note].filter(Boolean).join(' · ')
  const spoken = `${money(amount)} ${name}${e.settlement ? ', not counted as spending' : ''}`
  return (
    <div className="budget__entry">
      <button type="button" className="budget__main tap-row" aria-label={`Edit ${spoken}`} onClick={() => onEdit(e.id)}>
        <span className="budget__amt spend__amt">{money(amount)}</span>
        <span className="row__label">{name}</span>
        <Icon name="chevron" size={18} className="tap-row__chev" />
        <span className="row__hint">{hint}</span>
      </button>
      <button type="button" className="icon-btn" aria-label={`Delete ${spoken}`} title="Delete this entry" onClick={() => remove(e.id)}>
        <Icon name="trash" size={18} />
      </button>
    </div>
  )
}

function Card({ tint, title, count, children }: { tint: number; title: string; count?: number; children: ReactNode }) {
  return (
    <section className="sect" style={tintStyle(tint)} aria-label={title}>
      <h2 className="sect__head">
        <span>{title}</span>
        {count !== undefined && <span className="sect__count">{count}</span>}
      </h2>
      <div className="sect__body">{children}</div>
    </section>
  )
}

const entriesWord = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`

/**
 * Where did the money go. Summary and Entries tabs over one month and one filter (docs/BUDGET-PLAN.md section C).
 * Every figure is worked out from the entries with exact decimals in src/lib/budget.ts.
 */
export function SpendSummary({
  month,
  onMonth,
  onBack,
  onManage,
  initialTab = 'summary',
  initialCategory = null,
}: {
  month: string
  onMonth: (m: string) => void
  onBack: () => void
  onManage: () => void
  initialTab?: SummaryTab
  initialCategory?: string | null
}) {
  const budget = useApp((s) => s.budget)
  const money = useMoney()
  const [scope, setScope] = useState<Scope>({})
  const [tab, setTab] = useState<SummaryTab>(initialTab)
  const [cat, setCat] = useState<string | null>(initialCategory)
  const [day, setDay] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  useBackHandler(editing !== null, () => setEditing(null))

  const today = new Date()
  const everything = scopeKey(scope) === 'all'
  const s = summarise(budget, month, scope)
  const byCat = cat ? summarise(budget, month, { ...scope, categoryId: cat }).entries : s.entries
  const entries = day ? byCat.filter((e) => e.date === day) : byCat
  const catLabel = cat ? categoryName(budget, cat) : ''
  const monthWord = monthName(month, 'long')

  const showAll = () => { setScope({}); setCat(null); setDay(null) }
  const drill = (id: string) => { setCat(id); setTab('entries') }
  const pickDay = (date: string) => { setDay(date); setTab('entries') }
  const changeMonth = (m: string) => { setDay(null); onMonth(m) }

  const header = (
    <>
      <div className="spend__nav">
        <MonthNav month={month} onMonth={changeMonth} />
      </div>
      <div className="spend__tools">
        <button type="button" className="chip spend__scope" aria-haspopup="dialog" aria-label={`Showing: ${scopeLabel(budget, scope)}. Change.`} title="Change which accounts are shown" onClick={() => setPicking(true)}>
          <span>{scopeLabel(budget, scope)}</span>
          <Icon name="down" size={14} />
        </button>
        <Segmented<SummaryTab>
          label="View"
          value={tab}
          onChange={setTab}
          options={[{ value: 'summary', label: 'Summary' }, { value: 'entries', label: 'Entries' }]}
        />
      </div>
      {tab === 'entries' && (cat || day) && (
        <div className="spend__tools spend__tools--chips">
          {cat && (
            <button type="button" className="chip spend__scope" aria-label={`Remove the ${catLabel} filter`} title={`Remove the ${catLabel} filter`} onClick={() => setCat(null)}>
              <span>{catLabel}</span>
              <Icon name="close" size={14} />
            </button>
          )}
          {day && (
            <button type="button" className="chip spend__scope" aria-label={`Remove the ${dayLongLabel(day)} filter`} title={`Remove the ${dayLongLabel(day)} filter`} onClick={() => setDay(null)}>
              <span>{dayLongLabel(day)}</span>
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      )}
    </>
  )

  const emptyText = tab === 'entries' && day ? `Nothing on ${dayLongLabel(day)}${cat ? ` in ${catLabel}` : ''}.` : tab === 'entries' && cat ? `Nothing in ${catLabel} in ${monthWord}.` : everything ? `Nothing spent in ${monthWord}.` : `Nothing spent in ${monthWord} with this filter.`
  const empty =
    (tab === 'summary' ? s.entries.length === 0 : entries.length === 0) ? (
      <div className="spend__empty">
        <p className="budget__none">{emptyText}</p>
        {tab === 'entries' && day && <button type="button" className="link-btn" onClick={() => setDay(null)}>Show the whole month</button>}
        {tab === 'entries' && cat && <button type="button" className="link-btn" onClick={() => setCat(null)}>Show all categories</button>}
        {!everything && <button type="button" className="link-btn" onClick={showAll}>Show All accounts</button>}
      </div>
    ) : null

  // ---- cards
  const cmp = compareLastMonth(budget, month, today, scope)
  const avg = dailyAverage(s.spent, month, today)
  const range = cmp ? (cmp.throughDay ? `1 to ${cmp.throughDay} ${monthName(cmp.prevMonth, 'short')}` : monthName(cmp.prevMonth, 'long')) : ''
  const cmpText = !cmp
    ? ''
    : cmp.previous.isZero()
      ? `Nothing to compare: no spending in ${range}`
      : cmp.diff.isZero()
        ? `Same as ${range}`
        : `${money(cmp.diff.abs())} ${cmp.diff.gt(0) ? 'more' : 'less'} than ${range}${cmp.pct === null ? '' : ` (${cmp.pct > 0 ? '+' : cmp.pct < 0 ? '-' : ''}${Math.abs(cmp.pct)}%)`}`

  const months = trend(budget, month, 6, scope)
  const newestFirst = [...months].reverse()
  const peak = months.reduce((m, t) => (t.spent.gt(m) ? t.spent : m), new D(0))
  const thisMonth = monthKey(today)

  const ranked = [...s.lines].filter((l) => l.spent.gt(0)).sort((a, b) => b.spent.comparedTo(a.spent))
  const share = (v: Dec) => {
    const p = sharePercent(v, s.spent)
    return { pct: p, text: p === 0 && v.gt(0) ? 'under 1%' : `${p}%` }
  }
  const catRow = (c: CategoryLine, sub: boolean) => {
    const sh = share(c.spent)
    const state = everything && c.limit ? limitState(c.spent, c.limit) : null
    const words = state && c.limit && c.left ? limitWords(state, c.left, c.limit, money) : ''
    return (
      <button
        key={c.id}
        type="button"
        className={sub ? 'budget__row tap-row spend__sub' : 'budget__row tap-row'}
        aria-label={`${c.name}, ${money(c.spent)}, ${sh.text.replace('%', ' percent')}${words ? `, ${words}` : ''}. Show its entries`}
        onClick={() => drill(c.id)}
      >
        <span className="row__label">{c.name}</span>
        <span className="budget__amt spend__amt">{money(c.spent)} <span className="spend__pct">{sh.text}</span></span>
        <Icon name="chevron" size={18} className="tap-row__chev" />
        {!sub && <Bar pct={sh.pct} />}
        {words && <span className={state === 'over' ? 'budget__note budget__note--over' : 'budget__note'}>{words}</span>}
      </button>
    )
  }

  const limitRows: { id: string; name: string; spent: Dec; limit: Dec; scope: 'month' | 'always' }[] = []
  const all = everything ? s : summarise(budget, month)
  for (const p of all.lines) for (const c of [p, ...p.children]) if (c.limit) limitRows.push({ id: c.id, name: c.parentId ? `${p.name} › ${c.name}` : c.name, spent: c.spent, limit: c.limit, scope: c.limitScope })

  const summaryCards = (
    <>
      <section className="sect" style={tintStyle(3)} aria-label="Total">
        <div className="budget__sum">
          <span className="result__label">Spent in {monthWord}</span>
          <span className="budget__hero">{money(s.spent)}</span>
          <span className="budget__note">
            {avg ? `${money(avg.perDay)} a day (${avg.days} ${avg.days === 1 ? 'day' : 'days'}) · ` : ''}
            {entriesWord(s.entries.length)}
          </span>
          {cmpText && <span className="budget__note">{cmpText}</span>}
        </div>
      </section>

      <Card tint={5} title="Day by day">
        <Heatmap budget={budget} month={month} filter={scope} selected={day} onPick={pickDay} money={money} today={today} />
      </Card>

      <Card tint={4} title="Last 6 months">
        {newestFirst.map((t) => (
          <div className="budget__row budget__row--plain" key={t.month} aria-current={t.month === month ? 'true' : undefined}>
            <span className={t.month === month ? 'row__label spend__cur' : 'row__label'}>{monthName(t.month, 'strip')}</span>
            <span className="budget__amt spend__amt">{money(t.spent)}{t.month === thisMonth ? ' so far' : ''}</span>
            <Bar pct={peak.isZero() ? 0 : t.spent.div(peak).times(100).toNumber()} />
          </div>
        ))}
      </Card>

      <Card tint={5} title="By category">
        {ranked.map((c) => {
          const kids = c.children.filter((k) => k.spent.gt(0)).sort((a, b) => b.spent.comparedTo(a.spent))
          return (
            <div key={c.id}>
              {catRow(c, false)}
              {kids.map((k) => catRow(k, true))}
              {kids.length > 0 && c.direct.gt(0) && (
                <div className="budget__row budget__row--plain spend__sub">
                  <span className="row__label">No subcategory</span>
                  <span className="budget__amt spend__amt">{money(c.direct)}</span>
                </div>
              )}
            </div>
          )
        })}
        {s.uncategorised.gt(0) && (
          <div className="budget__row budget__row--plain">
            <span className="row__label">Uncategorised</span>
            <span className="budget__amt spend__amt">{money(s.uncategorised)} <span className="spend__pct">{share(s.uncategorised).text}</span></span>
          </div>
        )}
        {ranked.length === 0 && <p className="budget__none">Pick a category when you add an expense, and it shows up here.</p>}
      </Card>

      <Card tint={3} title="Biggest spends">
        {topEntries(s.entries, 5).map((e) => <EntryRow key={e.id} e={e} onEdit={setEditing} />)}
      </Card>

      <Card tint={4} title="Paid with">
        {s.byMode.map((m) => (
          <div className="budget__row budget__row--plain" key={m.id}>
            <span className="row__label">{m.label}</span>
            <span className="budget__amt spend__amt">{money(m.spent)}</span>
          </div>
        ))}
        {s.noMode.gt(0) && (
          <div className="budget__row budget__row--plain">
            <span className="row__label">No mode</span>
            <span className="budget__amt spend__amt">{money(s.noMode)}</span>
          </div>
        )}
      </Card>

      {scope.instrumentId === undefined && s.byInstrument.length > 0 && (
        <Card tint={5} title="Cards and accounts">
          {s.byInstrument.map((r) => (
            <div className="budget__row budget__row--plain" key={r.instrument.id}>
              <span className="row__label">{instrumentLabel(r.instrument)}{r.instrument.deletedAt === null ? '' : ' (hidden)'}</span>
              <span className="budget__amt spend__amt">{money(r.spent)}</span>
              <span className="budget__note">{entriesWord(r.count)}</span>
            </div>
          ))}
        </Card>
      )}

      <Card tint={3} title="Limits">
        {all.overall && (
          <div className="budget__row budget__row--plain">
            <span className="row__label">Whole month</span>
            <span className="budget__amt spend__amt">{money(all.spent)}</span>
            <Bar pct={all.overall.pct} />
            <span className={all.overall.left.isNegative() ? 'budget__note budget__note--over' : 'budget__note'}>{limitWords(limitState(all.spent, all.overall.limit), all.overall.left, all.overall.limit, money)}</span>
            {all.overall.scope === 'month' && <span className="budget__note">Limit for {monthShortLabel(month)} only</span>}
          </div>
        )}
        {limitRows.map((r) => {
          const left = r.limit.minus(r.spent)
          const pct = r.limit.isZero() ? 100 : Math.round(r.spent.div(r.limit).times(100).toNumber())
          return (
            <div className="budget__row budget__row--plain" key={r.id}>
              <span className="row__label">{r.name}</span>
              <span className="budget__amt spend__amt">{money(r.spent)}</span>
              <Bar pct={pct} />
              <span className={left.isNegative() ? 'budget__note budget__note--over' : 'budget__note'}>{limitWords(limitState(r.spent, r.limit), left, r.limit, money)}</span>
              {r.scope === 'month' && <span className="budget__note">Limit for {monthShortLabel(month)} only</span>}
            </div>
          )
        })}
        {!all.overall && limitRows.length === 0 && <p className="budget__none">No limits set.</p>}
        {!everything && <p className="budget__none">Limits count spending from all accounts.</p>}
        <button type="button" className="link-btn spend__link" onClick={onManage}>{!all.overall && limitRows.length === 0 ? 'Set a limit' : 'Change limits'}</button>
      </Card>
    </>
  )

  const entryList = (
    <section className="sect" style={tintStyle(5)} aria-label="Entries">
      <h2 className="sect__head">
        <span>Entries</span>
        <span className="sect__count">{entries.length}</span>
      </h2>
      <div className="sect__body">
        {entries.map((e) => <EntryRow key={e.id} e={e} onEdit={setEditing} />)}
      </div>
    </section>
  )

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="Spending summary">
      <ScreenHeader title="Spending summary" onBack={onBack} />
      <div className="screen__body">
        {header}
        <div className="sections">
          {empty ?? (tab === 'summary' ? summaryCards : entryList)}
        </div>
      </div>
      {picking && <FilterSheet budget={budget} value={scope} onPick={setScope} onClose={() => setPicking(false)} />}
      {editing !== null && <ExpenseSheet expense={budget.expenses.find((e) => e.id === editing)} onClose={() => setEditing(null)} />}
    </div>
  )
}
