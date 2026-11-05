import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PickOption } from '../../components/PickerSelect'
import { Icon } from '../../components/Icon'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useApp } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { useBackHandler } from '../../components/useBackHandler'
import { D, type Dec } from '../../engine'
import {
  SETTLEMENT_LABEL,
  categoryName,
  categoryTotal,
  categoryUsable,
  validateCategoryName,
  compareLastMonth,
  cycleRange,
  dayKey,
  entryMatches,
  searchEntries,
  signedAmount,
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
import { cardBillFor } from '../../lib/recurring'
import { formatCell } from '../../lib/toolFormat'
import { useFitText } from '../calculator/useFitText'
import { Segmented } from '../settings/controls'
import { FilterSheet, scopeKey, scopeLabel, type Scope } from './FilterSheet'
import { PaidWithTree } from './PaidWithTree'
import { Heatmap } from './Heatmap'
import { ExportSheet } from './ExportSheet'
import { ExpenseSheet } from './sheets'
import { PickView } from './pick'

export type SummaryTab = 'summary' | 'entries'

/** Money in the user's number system and decimals. */
export function useMoney() {
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  return (v: Dec) => formatCell(v, 'money', { system, decimals })
}

/**
 * The big figure at the top of a Budget page. It shrinks to fit its line, like the calculator's answer, so a money
 * number is never broken across two lines at a large system font. 2rem down to 1rem; below that it scrolls sideways.
 */
export function FitHero({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const readRem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const [rem, setRem] = useState(readRem)
  const [width, setWidth] = useState(0)
  // Budget tabs stay mounted while hidden, and the root size is set just after load: when the room (or the root size) changes, fit again.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setRem(readRem())
      setWidth(el.clientWidth)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useFitText(ref, `${text}|${width}`, undefined, rem * 2, rem)
  return <span ref={ref} className="budget__hero">{text}</span>
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
export function EntryRow({ e, onEdit, select }: { e: BudgetExpense; onEdit: (id: string) => void; /** Set while picking several entries: the row becomes a tick box (a card bill or transfer has no category, so it cannot be ticked). */ select?: { checked: boolean; onToggle: () => void } }) {
  const budget = useApp((s) => s.budget)
  const remove = useApp((s) => s.deleteExpense)
  const money = useMoney()
  const amount = new D(e.amount)
  const refund = e.refund === true
  const name = e.settlement ? SETTLEMENT_LABEL[e.settlement] : categoryName(budget, e.categoryId)
  const inst = e.instrumentId === null ? undefined : budget.instruments.find((i) => i.id === e.instrumentId)
  const how = [e.mode ? modeLabel(e.mode) : '', inst ? instrumentLabel(inst) : ''].filter(Boolean).join(' · ')
  const hint = [refund ? 'Refund' : '', shortDate(e.date), how, e.settlement ? 'Not counted as spending' : '', e.note].filter(Boolean).join(' · ')
  const spoken = `${refund ? 'refund of ' : ''}${money(amount)} ${name}${e.settlement ? ', not counted as spending' : ''}`
  if (select && e.settlement) {
    return (
      <div className="budget__entry budget__entry--off">
        <div className="budget__main budget__main--pick">
          <span className="budget__amt spend__amt">{money(amount)}</span>
          <span className="row__label">{name}</span>
          <span className="row__hint">{hint}. Has no category</span>
        </div>
      </div>
    )
  }
  if (select) {
    return (
      <div className="budget__entry">
        <button type="button" role="checkbox" aria-checked={select.checked} className="budget__main budget__main--pick tap-row" aria-label={`Select ${spoken}`} onClick={select.onToggle}>
          <span className="budget__tick" aria-hidden="true">{select.checked && <Icon name="check" size={18} />}</span>
          <span className="budget__amt spend__amt">{money(refund ? amount.neg() : amount)}</span>
          <span className="row__label">{name}</span>
          <span className="row__hint">{hint}</span>
        </button>
      </div>
    )
  }
  return (
    <div className="budget__entry">
      <button type="button" className="budget__main tap-row" aria-label={`Edit ${spoken}`} onClick={() => onEdit(e.id)}>
        <span className="budget__amt spend__amt">{money(refund ? amount.neg() : amount)}</span>
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
  const [exporting, setExporting] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [cycleOn, setCycleOn] = useState(false)
  // Picking several entries to give them one category. `sel` holds ids; only the ones in the list on screen are used.
  const [selecting, setSelecting] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [recat, setRecat] = useState(false)
  const [selNote, setSelNote] = useState<string | null>(null)
  const recategorise = useApp((st) => st.recategorise)
  const addCategory = useApp((st) => st.addCategory)
  const stopSelecting = () => { setSelecting(false); setSel(new Set()); setSelNote(null) }
  useBackHandler(editing !== null, () => setEditing(null))
  useBackHandler(selecting && !recat && editing === null, stopSelecting)

  const today = new Date()
  const everything = scopeKey(scope) === 'all'
  // A credit card with a statement day can be viewed by its statement cycle instead of the calendar month.
  const card = scope.instrumentId === undefined ? undefined : budget.instruments.find((i) => i.id === scope.instrumentId)
  const cardDay = card?.kind === 'credit' && card.statementDay ? card.statementDay : null
  const cycle = cycleOn && cardDay !== null
  const eff: Scope = cycle ? { ...scope, cycleDay: cardDay! } : scope
  const range = cycle ? cycleRange(cardDay!, month) : null
  const periodWord = range ? `the cycle ending ${shortDate(range.to)}` : monthName(month, 'long')
  const billOn = card && cardBillFor(budget, card.id)
  const setBill = useApp((st) => st.setCardBillReminder)
  const s = summarise(budget, month, eff)
  const byCat = cat ? summarise(budget, month, { ...eff, categoryId: cat }).entries : s.entries
  const entries = day ? byCat.filter((e) => e.date === day) : byCat
  const catLabel = cat ? categoryName(budget, cat) : ''
  const monthWord = range ? periodWord : monthName(month, 'long')

  // Search looks through every month (it respects the card or account chosen), so a month's own filters do not apply to it.
  const needle = query.trim()
  const found = tab === 'entries' && needle
    ? searchEntries(budget, budget.expenses.filter((e) => e.deletedAt === null && entryMatches(budget, e, scope)).sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)), needle)
    : null
  const foundTotal = found ? found.filter((e) => !e.settlement).reduce((t, e) => t.plus(signedAmount(e)), new D(0)) : null
  const SEARCH_SHOWN = 200

  const listed = found ?? entries
  const chosen = listed.filter((e) => sel.has(e.id) && !e.settlement)
  const tickable = listed.filter((e) => !e.settlement)
  const rowSelect = (e: BudgetExpense) => (selecting ? { checked: sel.has(e.id), onToggle: () => { setSelNote(null); setSel((s) => { const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n }) } } : undefined)
  const categoryChoices = useMemo<PickOption[]>(() => {
    const usable = budget.categories.filter((c) => c.deletedAt === null && categoryUsable(budget, c.id))
    const out: PickOption[] = [{ value: '', label: 'Uncategorised' }]
    for (const top of usable.filter((c) => c.parentId === null)) {
      out.push({ value: top.id, label: top.name })
      for (const sub of usable.filter((c) => c.parentId === top.id)) out.push({ value: sub.id, label: categoryName(budget, sub.id) })
    }
    return out
  }, [budget])
  const pickCategory = (v: string) => {
    const moved = recategorise(chosen.map((e) => e.id), v === '' ? null : v)
    setRecat(false)
    if (moved > 0) stopSelecting()
    else setSelNote('Nothing was moved. Check the message above')
  }
  const startRecat = () => (chosen.length === 0 ? setSelNote('Tick at least one entry first') : setRecat(true))

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
      {cardDay !== null && (
        <div className="spend__cycle">
          <span className="ffield__label" id="spend-cycle-label">Show this card by</span>
          <Segmented<'calendar' | 'cycle'>
            label="Show this card by"
            value={cycle ? 'cycle' : 'calendar'}
            onChange={(v) => { setCycleOn(v === 'cycle'); setDay(null) }}
            options={[{ value: 'calendar', label: 'Calendar month' }, { value: 'cycle', label: 'Statement cycle' }]}
          />
          {range && (
            <>
              <p className="budget__note">Statement cycle: {shortDate(range.from)} to {shortDate(range.to)} {range.to.slice(0, 4)}</p>
              <p className="budget__note">Each entry has one date in Calc, so that date decides the cycle, not the day your bank posted the charge. A purchase just before the statement date may land on your next bill.</p>
            </>
          )}
          {card && (
            <button type="button" className="link-btn" onClick={() => setBill(card.id, !billOn)}>
              {billOn ? "Stop reminding me about this card's bill" : "Remind me about this card's bill"}
            </button>
          )}
        </div>
      )}
      {tab === 'entries' && (
        <div className="spend__search">
          <input className="field" type="search" placeholder="Search note, category, card or amount" aria-label="Search entries in all months" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" spellCheck={false} />
        </div>
      )}
      {tab === 'entries' && !needle && (cat || day) && (
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
  const cmp = cycle ? null : compareLastMonth(budget, month, today, scope)
  const avg = cycle ? null : dailyAverage(s.spent, month, today)
  const cmpRange = cmp ? (cmp.throughDay ? `1 to ${cmp.throughDay} ${monthName(cmp.prevMonth, 'short')}` : monthName(cmp.prevMonth, 'long')) : ''
  const cmpText = !cmp
    ? ''
    : cmp.previous.isZero()
      ? `Nothing to compare: no spending in ${cmpRange}`
      : cmp.diff.isZero()
        ? `Same as ${cmpRange}`
        : `${money(cmp.diff.abs())} ${cmp.diff.gt(0) ? 'more' : 'less'} than ${cmpRange}${cmp.pct === null ? '' : ` (${cmp.pct > 0 ? '+' : cmp.pct < 0 ? '-' : ''}${Math.abs(cmp.pct)}%)`}`

  const months = trend(budget, month, 6, eff)
  // A month with no spending is noise in a six-month list, unless it is the one being looked at.
  const newestFirst = [...months].reverse().filter((t) => !t.spent.isZero() || t.month === month)
  const peak = months.reduce((m, t) => (t.spent.gt(m) ? t.spent : m), new D(0))
  const thisMonth = monthKey(today)

  // A category that only has refunds in the month is shown too (its total is below zero).
  const ranked = [...s.lines].filter((l) => !l.spent.isZero()).sort((a, b) => b.spent.comparedTo(a.spent))
  const share = (v: Dec) => {
    const p = sharePercent(v, s.spent)
    return { pct: p, text: v.lte(0) ? '' : p === 0 ? 'under 1%' : `${p}%` }
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
        aria-label={`${c.name}, ${money(c.spent)}${sh.text ? `, ${sh.text.replace('%', ' percent')}` : ''}, ${entriesWord(c.count)}${words ? `, ${words}` : ''}. Show its entries`}
        onClick={() => drill(c.id)}
      >
        <span className="row__label">{c.name}</span>
        <span className="budget__amt spend__amt">{money(c.spent)} {sh.text && <span className="spend__pct">{sh.text}</span>}</span>
        <Icon name="chevron" size={18} className="tap-row__chev" />
        {!sub && <Bar pct={sh.pct} />}
        <span className="budget__note">{entriesWord(c.count)}</span>
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
          {s.spent.isNegative() && <span className="budget__note">Refunds are more than what you spent</span>}
          <FitHero text={money(s.spent)} />
          <span className="budget__note">
            {avg ? `${money(avg.perDay)} a day (${avg.days} ${avg.days === 1 ? 'day' : 'days'}) · ` : ''}
            {entriesWord(s.entries.length)}
          </span>
          {cmpText && <span className="budget__note">{cmpText}</span>}
        </div>
      </section>

      {!cycle && (
        <Card tint={5} title="Day by day">
          <Heatmap budget={budget} month={month} filter={scope} selected={day} onPick={pickDay} money={money} today={today} />
        </Card>
      )}

      <Card tint={4} title={cycle ? 'Last 6 cycles' : 'Last 6 months'}>
        {newestFirst.map((t) => (
          <div className="budget__row budget__row--plain" key={t.month} aria-current={t.month === month ? 'true' : undefined}>
            <span className={t.month === month ? 'row__label spend__cur' : 'row__label'}>{cycle ? `Ends ${monthName(t.month, 'strip')}` : monthName(t.month, 'strip')}</span>
            <span className="budget__amt spend__amt">{money(t.spent)}{(cycle ? cycleRange(cardDay!, t.month).to >= dayKey(today) : t.month === thisMonth) ? ' so far' : ''}</span>
            <Bar pct={peak.isZero() ? 0 : t.spent.div(peak).times(100).toNumber()} />
          </div>
        ))}
      </Card>

      <Card tint={5} title="By category">
        {ranked.map((c) => {
          const kids = c.children.filter((k) => !k.spent.isZero()).sort((a, b) => b.spent.comparedTo(a.spent))
          return (
            <div key={c.id}>
              {catRow(c, false)}
              {kids.map((k) => catRow(k, true))}
              {kids.length > 0 && !c.direct.isZero() && (
                <div className="budget__row budget__row--plain spend__sub">
                  <span className="row__label">No subcategory</span>
                  <span className="budget__amt spend__amt">{money(c.direct)}</span>
                </div>
              )}
            </div>
          )
        })}
        {!s.uncategorised.isZero() && (
          <div className="budget__row budget__row--plain">
            <span className="row__label">Uncategorised</span>
            <span className="budget__amt spend__amt">{money(s.uncategorised)} {share(s.uncategorised).text && <span className="spend__pct">{share(s.uncategorised).text}</span>}</span>
          </div>
        )}
        {ranked.length === 0 && <p className="budget__none">Pick a category when you add an expense, and it shows up here.</p>}
      </Card>

      <Card tint={3} title="Biggest spends">
        {topEntries(s.entries, 5).map((e) => <EntryRow key={e.id} e={e} onEdit={setEditing} />)}
      </Card>

      <Card tint={4} title="Paid with">
        <PaidWithTree budget={budget} month={month} scope={eff} onPick={({ cycleDay: _cycle, ...f }) => { setScope(f); setCat(null); setDay(null); setTab('entries') }} />
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
        {!everything && <p className="budget__none">Limits count spending from all accounts{cycle ? ' and whole calendar months, not statement cycles' : ''}.</p>}
        <button type="button" className="link-btn spend__link" onClick={onManage}>{!all.overall && limitRows.length === 0 ? 'Set a limit' : 'Change limits'}</button>
      </Card>
    </>
  )

  // A category's own totals: this month, and everything ever. For a trip kept as a subcategory ("Travel > Goa trip") the second is the trip's total.
  const detail = cat && !day
    ? { month: categoryTotal(budget, cat, range ?? { from: `${month}-01`, to: `${month}-31` }), all: categoryTotal(budget, cat) }
    : null
  const searchResults = found && (
    <section className="sect" style={tintStyle(5)} aria-label="Search results">
      <h2 className="sect__head">
        <span>Search results</span>
        <span className="sect__count">{found.length}</span>
      </h2>
      <div className="sect__body">
        <p className="budget__none" role="status">
          {found.length === 0 ? `Nothing matches "${needle}" in any month.` : `${entriesWord(found.length)} match "${needle}" in all months${foundTotal && !foundTotal.isZero() ? `, ${money(foundTotal)} in total` : ''}.`}
        </p>
        {found.slice(0, SEARCH_SHOWN).map((e) => <EntryRow key={e.id} e={e} onEdit={setEditing} select={rowSelect(e)} />)}
        {found.length > SEARCH_SHOWN && <p className="budget__none">Showing the first {SEARCH_SHOWN}. Type more to narrow it down.</p>}
        <button type="button" className="link-btn spend__link" onClick={() => setQuery('')}>Clear search</button>
      </div>
    </section>
  )
  const entryList = (
    <section className="sect" style={tintStyle(5)} aria-label="Entries">
      <h2 className="sect__head">
        <span>Entries</span>
        <span className="sect__count">{entries.length}</span>
      </h2>
      <div className="sect__body">
        {detail && (
          <>
            <p className="budget__note" role="status">{catLabel} · {money(detail.month.total)} across {entriesWord(detail.month.count)} {range ? 'in this cycle' : `in ${monthWord}`}</p>
            <p className="budget__note">{catLabel} · {money(detail.all.total)} across {entriesWord(detail.all.count)} in all months</p>
          </>
        )}
        {entries.length > 1 && !selecting && <button type="button" className="link-btn spend__link" onClick={() => setSelecting(true)}>Select entries to change their category</button>}
        {entries.map((e) => <EntryRow key={e.id} e={e} onEdit={setEditing} select={rowSelect(e)} />)}
      </div>
    </section>
  )

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="Spending summary">
      <ScreenHeader title="Spending summary" onBack={onBack} />
      <div className="screen__body">
        {header}
        <div className="sections">
          {found ? searchResults : (empty ?? (tab === 'summary' ? summaryCards : entryList))}
        </div>
        <button type="button" className="link-btn" onClick={() => setExporting(true)}>Export expenses as a spreadsheet</button>
      </div>
      {selecting && !recat && (
        <div className="spend__bulk" role="group" aria-label="Change category of the ticked entries">
          <p className="budget__note" role="status">{selNote ?? `${chosen.length} of ${tickable.length} selected`}</p>
          <div className="spend__bulkbtns">
            <button type="button" className="btn" onClick={stopSelecting}>Cancel</button>
            <button type="button" className="btn" onClick={() => { setSelNote(null); setSel(chosen.length === tickable.length ? new Set() : new Set(tickable.map((e) => e.id))) }}>{chosen.length === tickable.length && tickable.length > 0 ? 'Select none' : 'Select all'}</button>
            <button type="button" className="btn btn--primary" onClick={startRecat}>Change category</button>
          </div>
        </div>
      )}
      {recat && (
        <PickView
          title={`Category for ${chosen.length} ${chosen.length === 1 ? 'entry' : 'entries'}`}
          options={categoryChoices}
          value="__none__"
          onBack={() => setRecat(false)}
          onPick={pickCategory}
          onAddName={(name) => addCategory(name)}
          validateAdd={(name) => (budget.categories.some((c) => c.deletedAt === null && c.parentId === null && c.name.toLowerCase() === name.toLowerCase()) ? null : validateCategoryName(name, budget, null))}
          addLabel="Add category"
        />
      )}
      {exporting && <ExportSheet onClose={() => setExporting(false)} />}
      {picking && <FilterSheet budget={budget} value={scope} onPick={setScope} onClose={() => setPicking(false)} />}
      {editing !== null && <ExpenseSheet expense={budget.expenses.find((e) => e.id === editing)} onClose={() => setEditing(null)} />}
    </div>
  )
}
