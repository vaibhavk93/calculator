import { useEffect, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { useApp } from '../../components/StoreProvider'
import { useBackHandler } from '../../components/useBackHandler'
import { limitState, monthKey, monthLabel, monthShortLabel, needsAttention, paceLeft, summarise } from '../../lib/budget'
import { billTotals, liveBills } from '../../lib/recurring'
import { useTour } from '../onboarding/useTour'
import { BillsScreen } from './BillsScreen'
import { ImportScreen } from './ImportScreen'
import { ManageScreen } from './ManageScreen'
import { PortfolioScreen } from './PortfolioScreen'
import { ExpenseSheet } from './sheets'
import { Bar, EntryRow, FitHero, MonthNav, SpendSummary, limitWords, useMoney, type SummaryTab } from './SpendSummary'

type Page = 'home' | 'summary' | 'manage' | 'import' | 'bills' | 'portfolio'
type SheetState = null | { id: string | null }

const entriesWord = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`

/**
 * The Budget tab: a small home that says how this month is going, and two pages one tap away.
 * Spending summary (where did it go) and Manage (limits, categories, cards). docs/BUDGET-PLAN.md sections B and C.
 */
export function BudgetScreen() {
  const budget = useApp((s) => s.budget)
  const tabTap = useApp((s) => s.tabTap)
  const money = useMoney()
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [page, setPage] = useState<Page>('home')
  const [showPace, setShowPace] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [open, setOpen] = useState<{ tab: SummaryTab; categoryId: string | null }>({ tab: 'summary', categoryId: null })
  const [sheet, setSheet] = useState<SheetState>(null)

  // Tapping the Budget tab while on it goes back to this month, on the home.
  useEffect(() => {
    setMonth(monthKey(new Date()))
    setPage('home')
    setSheet(null)
    setShowPace(false)
    setMoreOpen(false)
  }, [tabTap])

  useBackHandler(page !== 'home', () => setPage('home'))
  useBackHandler(sheet !== null, () => setSheet(null))

  const s = summarise(budget, month)
  const bills = billTotals(liveBills(budget))
  const never = budget.expenses.every((e) => e.deletedAt !== null)
  const goSummary = (tab: SummaryTab, categoryId: string | null = null) => {
    setOpen({ tab, categoryId })
    setPage('summary')
  }
  const tour = useTour('budget', (a) => {
    if (a === 'add-expense') setSheet({ id: null })
    else if (a === 'manage' || a === 'import' || a === 'bills') setPage(a)
    else if (a === 'summary') goSummary('summary')
  })

  const sheets = sheet !== null && <ExpenseSheet expense={budget.expenses.find((e) => e.id === sheet.id)} onClose={() => setSheet(null)} />
  const pages = (
    <>
      {page === 'summary' && <SpendSummary month={month} onMonth={setMonth} onBack={() => setPage('home')} onManage={() => setPage('manage')} initialTab={open.tab} initialCategory={open.categoryId} />}
      {page === 'manage' && <ManageScreen onBack={() => setPage('home')} month={month} />}
      {page === 'import' && <ImportScreen onBack={() => setPage('home')} />}
      {page === 'bills' && <BillsScreen onBack={() => setPage('home')} />}
      {page === 'portfolio' && <PortfolioScreen onBack={() => setPage('home')} />}
    </>
  )

  if (never && s.entries.length === 0) {
    return (
      <>
        <>
        {tour.row}
        <EmptyState
          title="No spending yet"
          action={<button type="button" className="btn btn--primary" onClick={() => setSheet({ id: null })}>Add expense</button>}
          more={[
            { label: 'Add from bank messages', onClick: () => setPage('import') },
            { label: 'Bills and subscriptions', onClick: () => setPage('bills') },
            { label: 'Portfolio', onClick: () => setPage('portfolio') },
            { label: 'Set a monthly limit', onClick: () => setPage('manage') },
            { label: 'Categories and cards', onClick: () => setPage('manage') },
            tour.empty,
          ]}
        >
          Add what you spend, one entry at a time. Set a monthly limit and this page shows what is left. It all stays on this phone.
        </EmptyState>
        </>
        {sheets}
        {pages}
        {tour.sheet}
      </>
    )
  }

  const over = s.overall !== null && s.overall.left.isNegative()
  const heroValue = s.overall ? s.overall.left : s.spent
  const pace = s.overall ? paceLeft(s.overall.left, month, new Date()) : null
  const paceDay = pace ? pace.perDay.floor() : null
  const attention = needsAttention(s.lines, 3)
  const biggest = s.lines.filter((l) => l.spent.gt(0)).sort((a, b) => b.spent.comparedTo(a.spent))[0]
  const recent = s.entries.slice(0, 5)

  return (
    <>
    <div className="tools">
      {/* Summary and Manage stack on top via {pages} below without unmounting this -- so their own
          h1 (from ScreenHeader) must be the only one while either is open, not two at once. */}
      {page === 'home' && (
        <header className="tabroot__bar">
          <h1 className="screen__title">Budget</h1>
          <span className="screen__spacer" />
          <MonthNav month={month} onMonth={setMonth} />
        </header>
      )}

      {tour.row}
      <div className="tools__list">
        {/* Tier 1, the answer: the one figure this screen exists to show. No card, no tint -- see
            docs/THE-PLAN.md section 7. */}
        <div className="budget__sum">
          <span className="result__label">{over
            ? `Over budget ${month === monthKey(new Date()) ? 'by' : `in ${monthLabel(month)}`}`
            : `${s.overall ? 'Left' : 'Spent'} ${month === monthKey(new Date()) ? 'this month' : `in ${monthLabel(month)}`}`}</span>
          <FitHero text={money(over ? heroValue.abs() : heroValue)} negative={over} />
          {s.overall ? (
            <>
              <Bar pct={s.overall.pct} />
              {!over && <span className="budget__note">{`${money(s.spent)} spent of ${money(s.overall.limit)}`}</span>}
              {pace && paceDay && (
                showPace ? (
                  <span className="budget__note">About {money(paceDay.gt(0) ? paceDay : pace.perDay)} a day for the next {pace.days} {pace.days === 1 ? 'day' : 'days'}{s.overall.scope === 'month' ? ` · limit for ${monthShortLabel(month)} only` : ''}</span>
                ) : (
                  <button type="button" className="link-btn budget__link" onClick={() => setShowPace(true)}>Pace for the rest of the month</button>
                )
              )}
            </>
          ) : null}
          <button type="button" className="link-btn budget__link" onClick={() => setPage('manage')}>{s.overall ? 'Change limits' : 'Set a monthly limit'}</button>
        </div>

        <div className="budget__add">
          <button type="button" className="btn btn--primary" onClick={() => setSheet({ id: null })}>Add expense</button>
        </div>

        {/* Tier 2, content: hairline rows, no card. Needs attention only shows when there is something
            to act on, so it never competes with Recent for the top of the list when empty. */}
        {attention.length > 0 && (
          <>
            <h2 className="group__title">Needs attention</h2>
            <div className="group">
              {attention.map((a) => (
                <button key={a.id} type="button" className="budget__row tap-row" aria-label={`${a.name}: ${limitWords(a.state, a.left, a.limit, money)}. Show its entries`} onClick={() => goSummary('entries', a.id)}>
                  <span className="row__label">{a.name}</span>
                  <Icon name="chevron" size={18} className="tap-row__chev" />
                  <span className={a.state === 'over' ? 'budget__note budget__note--over' : 'budget__note'}>{limitWords(limitState(a.spent, a.limit), a.left, a.limit, money)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <h2 className="group__title">Recent</h2>
        <div className="group" aria-label="Recent">
          {recent.length === 0 && <p className="budget__none">Nothing spent in {monthLabel(month)}. Tap Add expense to add the first.</p>}
          {recent.map((e) => <EntryRow key={e.id} e={e} onEdit={(id) => setSheet({ id })} />)}
        </div>
        {s.entries.length > 0 && (
          <button type="button" className="link-btn spend__link" onClick={() => goSummary('entries')}>
            All entries ({s.entries.length})
          </button>
        )}

        {/* Tier 3, navigation: four destinations, collapsed behind one row instead of standing open on
            the home screen all the time -- the owner's own "too many rows, too much on screen" complaint
            about this exact screen. Progressive disclosure (NN/g), not a new visual language: the same
            Sheet + navrow pattern already used for KeepAndShare's "More" and Notes' "Filter". */}
        <div className="group">
          <button type="button" className="navrow tap-row" onClick={() => setMoreOpen(true)}>
            <span className="row__text">
              <span className="row__label">More in Budget</span>
            </span>
            <Icon name="chevron" size={18} className="navrow__chev" />
          </button>
        </div>
      </div>
      {moreOpen && (
        <Sheet title="More in Budget" onClose={() => setMoreOpen(false)}>
          <div className="group" aria-label="More in Budget">
            <button type="button" className="navrow tap-row" onClick={() => { setMoreOpen(false); goSummary('summary') }}>
              <span className="row__text">
                <span className="row__label">Spending summary</span>
                <span className="row__hint">
                  {s.entries.length === 0
                    ? `Nothing spent in ${monthLabel(month)}`
                    : `Biggest: ${biggest ? `${biggest.name} ${money(biggest.spent)}` : `Uncategorised ${money(s.uncategorised)}`} · ${entriesWord(s.entries.length)}`}
                </span>
              </span>
              <Icon name="chevron" size={18} className="navrow__chev" />
            </button>
            <button type="button" className="navrow tap-row" onClick={() => { setMoreOpen(false); setPage('bills') }}>
              <span className="row__text">
                <span className="row__label">Bills and subscriptions</span>
                {bills.count > 0 && <span className="row__hint">{`${bills.count} running · about ${money(bills.perMonth)} a month = ${money(bills.perYear)} a year`}</span>}
              </span>
              <Icon name="chevron" size={18} className="navrow__chev" />
            </button>
            <button type="button" className="navrow tap-row" onClick={() => { setMoreOpen(false); setPage('portfolio') }}>
              <span className="row__text">
                <span className="row__label">Portfolio</span>
                <span className="row__hint">What you own and what you owe</span>
              </span>
              <Icon name="chevron" size={18} className="navrow__chev" />
            </button>
            <button type="button" className="navrow tap-row" onClick={() => { setMoreOpen(false); setPage('import') }}>
              <span className="row__text">
                <span className="row__label">Add from bank messages</span>
              </span>
              <Icon name="chevron" size={18} className="navrow__chev" />
            </button>
            <button type="button" className="navrow tap-row" onClick={() => { setMoreOpen(false); setPage('manage') }}>
              <span className="row__text">
                <span className="row__label">Categories and cards</span>
              </span>
              <Icon name="chevron" size={18} className="navrow__chev" />
            </button>
          </div>
        </Sheet>
      )}
    </div>
    {/* sheets and pages sit at the same place in the tree as in the empty-state return above, so adding the first
        entry from inside one of them does not unmount it (that used to reset the Add from messages screen). */}
    {sheets}
    {pages}
    {tour.sheet}
    </>
  )
}
