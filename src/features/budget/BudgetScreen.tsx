import { Fragment, useEffect, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { useApp } from '../../components/StoreProvider'
import { useBackHandler } from '../../components/useBackHandler'
import { D } from '../../engine'
import { limitState, monthFlow, monthKey, monthLabel, monthShortLabel, needsAttention, paceLeft, summarise } from '../../lib/budget'
import { billTotals, liveBills } from '../../lib/recurring'
import { useTour } from '../onboarding/useTour'
import { Segmented } from '../settings/controls'
import { BillsScreen } from './BillsScreen'
import { DayView } from './DayView'
import { ImportScreen } from './ImportScreen'
import { ManageScreen } from './ManageScreen'
import { PortfolioView } from './PortfolioScreen'
import { RulesScreen } from './RulesScreen'
import { ExpenseSheet } from './sheets'
import { Bar, DayHeader, EntryRow, FitHero, MonthNav, SpendSummary, limitWords, startsDay, useMoney, type SummaryTab } from './SpendSummary'

type Page = 'home' | 'summary' | 'manage' | 'import' | 'bills' | 'rules'
type View = 'spending' | 'networth'
type SheetState = null | { id: string | null }

const entriesWord = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`

/**
 * The Budget tab: a Spending / Net worth switch at the top (docs/design-reference/IMPLEMENTATION-NOTES.md, "Budget home").
 * Spending: one bare hero, one quiet "kept" line, one flat panel (monthly limit + needs attention), recent entries, and the
 * rest behind "More in Budget". Net worth: what you own and owe (PortfolioView), with the hide-amounts eye in the header.
 * The chosen view and "hide amounts" live in this component only: never saved.
 */
export function BudgetScreen() {
  const budget = useApp((s) => s.budget)
  const hasHoldings = useApp((s) => s.portfolio.some((h) => h.deletedAt === null))
  const tabTap = useApp((s) => s.tabTap)
  const money = useMoney()
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [page, setPage] = useState<Page>('home')
  const [view, setView] = useState<View>('spending')
  const [hidden, setHidden] = useState(true)
  const [showPace, setShowPace] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [open, setOpen] = useState<{ tab: SummaryTab; categoryId: string | null }>({ tab: 'summary', categoryId: null })
  const [sheet, setSheet] = useState<SheetState>(null)
  // The Day view: one day's entries, on top of whatever is open. Opened from a day heading in Recent entries or in the Entries list.
  const [day, setDay] = useState<string | null>(null)

  // Tapping the Budget tab while on it goes back to this month, on the home. The view stays; amounts hide again.
  useEffect(() => {
    setMonth(monthKey(new Date()))
    setPage('home')
    setSheet(null)
    setDay(null)
    setShowPace(false)
    setMoreOpen(false)
    setHidden(true)
  }, [tabTap])

  useBackHandler(page !== 'home', () => setPage('home'))
  useBackHandler(sheet !== null, () => setSheet(null))

  const s = summarise(budget, month)
  const bills = billTotals(liveBills(budget))
  const rules = (budget.rules ?? []).length
  const never = budget.expenses.every((e) => e.deletedAt !== null)
  const goSummary = (tab: SummaryTab, categoryId: string | null = null) => {
    setOpen({ tab, categoryId })
    setPage('summary')
  }
  const tour = useTour('budget', (a) => {
    setView('spending')
    if (a === 'add-expense') setSheet({ id: null })
    else if (a === 'manage' || a === 'import' || a === 'bills') setPage(a)
    else if (a === 'summary') goSummary('summary')
  })

  const sheets = sheet !== null && <ExpenseSheet expense={budget.expenses.find((e) => e.id === sheet.id)} onClose={() => setSheet(null)} />
  const pages = (
    <>
      {page === 'summary' && <SpendSummary month={month} onMonth={setMonth} onBack={() => setPage('home')} onManage={() => setPage('manage')} initialTab={open.tab} initialCategory={open.categoryId} onOpenDay={setDay} />}
      {page === 'manage' && <ManageScreen onBack={() => setPage('home')} month={month} />}
      {page === 'import' && <ImportScreen onBack={() => setPage('home')} />}
      {page === 'bills' && <BillsScreen onBack={() => setPage('home')} />}
      {page === 'rules' && <RulesScreen onBack={() => setPage('home')} />}
      {day !== null && <DayView date={day} onBack={() => setDay(null)} />}
    </>
  )

  const isNow = month === monthKey(new Date())
  const when = isNow ? 'this month' : `in ${monthLabel(month)}`
  const over = s.overall !== null && s.overall.left.isNegative()
  const pace = s.overall ? paceLeft(s.overall.left, month, new Date()) : null
  const paceDay = pace ? pace.perDay.floor() : null
  const attention = needsAttention(s.lines, 3)
  const biggest = s.lines.filter((l) => l.spent.gt(0)).sort((a, b) => b.spent.comparedTo(a.spent))[0]
  const recent = s.entries.slice(0, 5)
  const flow = monthFlow(budget, month)
  const cameIn = new D(flow.cameIn)
  const kept = new D(flow.kept)

  const spending = never && s.entries.length === 0 ? (
    <EmptyState
      title="No spending yet"
      level="h2"
      action={<button type="button" className="btn btn--primary" onClick={() => setSheet({ id: null })}>Add expense</button>}
      more={[
        { label: 'Add from bank messages', onClick: () => setPage('import') },
        { label: 'Bills and subscriptions', onClick: () => setPage('bills') },
        { label: 'Set a monthly limit', onClick: () => setPage('manage') },
        { label: 'Categories and cards', onClick: () => setPage('manage') },
        tour.empty,
      ]}
    >
      Add what you spend, one entry at a time. Set a monthly limit and this page shows what is left. It all stays on this phone.
    </EmptyState>
  ) : (
    <>
      {/* The answer: the one bare figure on this screen. */}
      <div className="budget__sum">
        <span className="result__label">{over ? `Over budget ${isNow ? 'by' : `in ${monthLabel(month)}`}` : `Spent ${when}`}</span>
        <FitHero text={money(over && s.overall ? s.overall.left.abs() : s.spent)} negative={over} />
        {cameIn.gt(0) && (
          <span className="budget__note">{kept.isNegative() ? `Spent ${money(kept.abs())} more than came in` : `Kept ${money(kept)} of ${money(cameIn)} that came in`}</span>
        )}
        {!s.overall && <button type="button" className="link-btn budget__link" onClick={() => setPage('manage')}>Set a monthly limit</button>}
      </div>

      {/* One flat panel: how worried should you be. The limit bar and what needs attention are one idea. */}
      {(s.overall || attention.length > 0) && (
        <div className="budget__panel">
          {s.overall && (
            <div className="budget__limit">
              <div className="budget__limit-head">
                <span className="row__label">Monthly limit</span>
                <span className="budget__amt">{money(s.spent)} / {money(s.overall.limit)}</span>
              </div>
              <Bar pct={s.overall.pct} />
              {!over && <span className="budget__note">{money(s.overall.left)} left{s.overall.scope === 'month' ? ` · limit for ${monthShortLabel(month)} only` : ''}</span>}
              {pace && paceDay && showPace && (
                <span className="budget__note">About {money(paceDay.gt(0) ? paceDay : pace.perDay)} a day for the next {pace.days} {pace.days === 1 ? 'day' : 'days'}</span>
              )}
              <div className="budget__links">
                {pace && paceDay && !showPace && <button type="button" className="link-btn" onClick={() => setShowPace(true)}>Pace for the rest of the month</button>}
                <button type="button" className="link-btn" onClick={() => setPage('manage')}>Change limits</button>
              </div>
            </div>
          )}
          {attention.length > 0 && (
            <div className="budget__attention">
              <h2 className="budget__panel-title">Needs attention</h2>
              {attention.map((a) => (
                <button key={a.id} type="button" className="budget__row tap-row" aria-label={`${a.name}: ${limitWords(a.state, a.left, a.limit, money)}. Show its entries`} onClick={() => goSummary('entries', a.id)}>
                  <span className="row__label">{a.name}</span>
                  <Icon name="chevron" size={18} className="tap-row__chev" />
                  <span className={a.state === 'over' ? 'budget__note budget__note--over' : 'budget__note'}>{limitWords(limitState(a.spent, a.limit), a.left, a.limit, money)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <h2 className="group__title">Recent entries</h2>
      <div className="group" aria-label="Recent entries">
        {recent.length === 0 && <p className="budget__none">Nothing spent in {monthLabel(month)}. Tap Add expense to add the first.</p>}
        {recent.map((e, i) => (
          <Fragment key={e.id}>
            {startsDay(recent, i) && <DayHeader date={e.date} onOpen={setDay} />}
            <EntryRow e={e} plain onEdit={(id) => setSheet({ id })} />
          </Fragment>
        ))}
      </div>
      {s.entries.length > 0 && (
        <button type="button" className="link-btn spend__link" onClick={() => goSummary('entries')}>
          All entries ({s.entries.length})
        </button>
      )}

      {/* Everything else, collapsed behind one row (the owner's "too much on screen" complaint about this screen). */}
      <div className="group budget__more">
        <button type="button" className="navrow tap-row" onClick={() => setMoreOpen(true)}>
          <span className="row__text">
            <span className="row__label">More in Budget</span>
          </span>
          <Icon name="chevron" size={18} className="navrow__chev" />
        </button>
      </div>

      <div className="budget__add">
        <button type="button" className="btn btn--primary" onClick={() => setSheet({ id: null })}>Add expense</button>
      </div>
    </>
  )

  const moreRow = (label: string, go: () => void, hint?: string) => (
    <button type="button" className="navrow tap-row" onClick={() => { setMoreOpen(false); go() }}>
      <span className="row__text">
        <span className="row__label">{label}</span>
        {hint && <span className="row__hint">{hint}</span>}
      </span>
      <Icon name="chevron" size={18} className="navrow__chev" />
    </button>
  )

  return (
    <>
    <div className="tools budget">
      {/* Summary, Manage and the rest stack on top via {pages} below without unmounting this -- so their own
          h1 (from ScreenHeader) must be the only one while either is open, not two at once. */}
      {page === 'home' && (
        <header className="tabroot__bar">
          <h1 className="screen__title">Budget</h1>
          <span className="screen__spacer" />
          {view === 'spending' && <MonthNav month={month} onMonth={setMonth} />}
          {view === 'networth' && hasHoldings && (
            <button type="button" className="icon-btn" aria-label={hidden ? 'Show amounts' : 'Hide amounts'} title={hidden ? 'Show amounts' : 'Hide amounts'} onClick={() => setHidden((h) => !h)}>
              <Icon name={hidden ? 'eyeOff' : 'eye'} />
            </button>
          )}
        </header>
      )}
      <div className="budget__seg">
        <Segmented<View>
          label="Budget view"
          value={view}
          onChange={setView}
          options={[{ value: 'spending', label: 'Spending' }, { value: 'networth', label: 'Net worth' }]}
        />
      </div>

      {view === 'spending' && tour.row}
      <div className="tools__list">
        {view === 'spending' ? spending : <PortfolioView hidden={hidden} />}
      </div>
      {moreOpen && (
        <Sheet title="More in Budget" onClose={() => setMoreOpen(false)}>
          <div className="group" aria-label="More in Budget">
            {moreRow('Spending summary', () => goSummary('summary'), s.entries.length === 0
              ? `Nothing spent in ${monthLabel(month)}`
              : `Biggest: ${biggest ? `${biggest.name} ${money(biggest.spent)}` : `Uncategorised ${money(s.uncategorised)}`} · ${entriesWord(s.entries.length)}`)}
            {moreRow('Bills and subscriptions', () => setPage('bills'), bills.count > 0 ? `${bills.count} running · about ${money(bills.perMonth)} a month = ${money(bills.perYear)} a year` : undefined)}
            {moreRow('Add from bank messages', () => setPage('import'))}
            {moreRow('Categories and cards', () => setPage('manage'))}
            {moreRow('Rules', () => setPage('rules'), rules === 0 ? 'Pick a category by merchant when adding from messages' : `${rules} ${rules === 1 ? 'rule' : 'rules'}`)}
          </div>
        </Sheet>
      )}
    </div>
    {/* sheets and pages sit at one place in the tree whatever the view, so adding the first entry from inside one of
        them does not unmount it (that used to reset the Add from messages screen). */}
    {sheets}
    {pages}
    {tour.sheet}
    </>
  )
}
