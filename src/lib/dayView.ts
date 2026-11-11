import { D, type Dec } from '../engine'
import { countsAsSpend, dayKey, dayLongLabel, instrumentLabel, modeLabel, signedAmount, type BudgetData, type BudgetExpense, type ExpenseDraft } from './budget'

/** One way of paying on a day, with what it spent. */
export interface DayRoute {
  /** Mode plus card or account, so two cards on one day stay two routes. */
  key: string
  /** Words: "UPI", "Cash", "HDFC Regalia ••4321", "UPI · HDFC Salary", or "No route". */
  label: string
  /** Spending through this route (a refund lowers it). Money in and settlements are not here. */
  spent: Dec
  count: number
}

export interface DayView {
  date: string
  /** The day's spend, worked out like the month total: money in, card bills and own-account transfers are left out, a refund is taken off. */
  spent: Dec
  /** Money that came in that day (salary, a gift). Shown, never counted as spend. */
  moneyIn: Dec
  /** Spending routes, biggest first; "No route" last. */
  routes: DayRoute[]
  /** Every live entry of the day, in the order it was entered (oldest first). */
  entries: BudgetExpense[]
  counts: { entries: number; spend: number; moneyIn: number; settlements: number }
}

/** The words for how an entry was paid. A card says its own name; UPI, a wallet or net banking add the account after the mode. */
export function routeLabel(budget: Pick<BudgetData, 'instruments'>, e: Pick<BudgetExpense, 'mode' | 'instrumentId'>): string {
  const inst = e.instrumentId === null ? undefined : budget.instruments.find((i) => i.id === e.instrumentId)
  if (e.mode === null) return inst ? instrumentLabel(inst) : 'No route'
  if (!inst) return modeLabel(e.mode)
  return e.mode === 'credit' || e.mode === 'debit' ? instrumentLabel(inst) : `${modeLabel(e.mode)} · ${instrumentLabel(inst)}`
}

/**
 * Everything that happened on one day ("YYYY-MM-DD"). Deleted entries are left out.
 * The store keeps the newest entry first, so within a day the list is turned round: oldest-entered first.
 */
export function dayView(budget: BudgetData, date: string): DayView {
  const entries = budget.expenses.filter((e) => e.deletedAt === null && e.date === date).reverse()
  let spent = new D(0)
  let moneyIn = new D(0)
  const counts = { entries: entries.length, spend: 0, moneyIn: 0, settlements: 0 }
  const byRoute = new Map<string, DayRoute>()
  for (const e of entries) {
    if (e.settlement) {
      counts.settlements++
      continue
    }
    if (!countsAsSpend(e)) {
      counts.moneyIn++
      moneyIn = moneyIn.plus(signedAmount({ amount: e.amount }))
      continue
    }
    counts.spend++
    const amount = signedAmount(e)
    spent = spent.plus(amount)
    const label = routeLabel(budget, e)
    const key = `${e.mode ?? ''}|${e.instrumentId ?? ''}`
    const cur = byRoute.get(key) ?? { key, label, spent: new D(0), count: 0 }
    byRoute.set(key, { ...cur, spent: cur.spent.plus(amount), count: cur.count + 1 })
  }
  // A stable sort keeps entry order between equal amounts. "No route" always goes last.
  const rank = (r: DayRoute) => (r.label === 'No route' ? 1 : 0)
  const routes = [...byRoute.values()].sort((a, b) => rank(a) - rank(b) || b.spent.comparedTo(a.spent))
  return { date, spent, moneyIn, routes, entries, counts }
}

/** What an entry is: spending (a refund too), money that came in, or a card bill or own-account transfer. */
export const entryKind = (e: Pick<BudgetExpense, 'settlement' | 'income'>): 'spend' | 'income' | 'settlement' => (e.settlement ? 'settlement' : countsAsSpend(e) ? 'spend' : 'income')

/** The entry as the store wants it back, with a new note and nothing else changed. */
export const draftWithNote = (e: BudgetExpense, note: string): ExpenseDraft => ({
  amount: e.amount,
  categoryId: e.categoryId,
  mode: e.mode,
  instrumentId: e.instrumentId,
  date: e.date,
  note,
  settlement: e.settlement ?? null,
  refund: e.refund === true,
  income: entryKind(e) === 'income',
})

/** "Tue 4 Nov", with the year added when it is not this year ("Tue 4 Nov 2025"). */
export const dayTitle = (date: string, now: Date = new Date()): string => (date.slice(0, 4) === String(now.getFullYear()) ? dayLongLabel(date) : `${dayLongLabel(date)} ${date.slice(0, 4)}`)

/**
 * The days either side of `date` for the Day view's arrows. A neighbour is the next calendar day, so a quiet day is still reachable.
 * `prev` is null at the first day anything was entered (or on it); `next` is null on today or later. Deleted entries do not count.
 */
export function neighbourDays(budget: Pick<BudgetData, 'expenses'>, date: string, today: string): { prev: string | null; next: string | null } {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const step = (n: number) => dayKey(new Date(y, m - 1, d + n))
  let first: string | null = null
  for (const e of budget.expenses) if (e.deletedAt === null && (first === null || e.date < first)) first = e.date
  return { prev: first !== null && date > first ? step(-1) : null, next: date < today ? step(1) : null }
}
