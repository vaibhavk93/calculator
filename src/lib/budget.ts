import { D, type Dec } from '../engine'

/** A budget bucket. `limit` is a plain decimal string for every month, or null for "no limit". */
export interface BudgetCategory {
  id: string
  name: string
  limit: string | null
  deletedAt: number | null
}

/** One thing spent. `date` is "YYYY-MM-DD" on the user's calendar. A null category means "Uncategorised". */
export interface BudgetExpense {
  id: string
  date: string
  amount: string
  categoryId: string | null
  note: string
  deletedAt: number | null
}

export interface BudgetData {
  /** One limit for all spending in a month, or null. */
  overall: string | null
  categories: BudgetCategory[]
  expenses: BudgetExpense[]
}

export const MAX_EXPENSES = 20000
export const MAX_CATEGORIES = 40

/** The categories a new install starts with: names only, no limits. They can all be renamed or removed. */
export const STARTER_CATEGORIES = ['Rent', 'Food', 'Groceries', 'Transport', 'Bills', 'Health', 'Shopping', 'Travel', 'Loan EMI', 'Savings']

export const starterBudget = (): BudgetData => ({
  overall: null,
  categories: STARTER_CATEGORIES.map((name) => ({ id: `starter-${name.toLowerCase().replace(/\W+/g, '-')}`, name, limit: null, deletedAt: null })),
  expenses: [],
})

/**
 * Budget maths. Totals are always worked out from the entries, never stored, so a deleted or edited
 * entry can never leave a stale total behind. Money is Decimal; entries keep it as plain strings.
 */

/** "2026-11" for a date. Local time, because "today" means the day on the user's phone. */
export const monthKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** "2026-11-02" for a date, in local time. */
export const dayKey = (d: Date): string => `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`

export function shiftMonth(key: string, delta: number): string {
  const [y = 1970, m = 1] = key.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + delta, 1))
}

export function monthLabel(key: string): string {
  const [y = 1970, m = 1] = key.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
}

export interface CategoryLine {
  id: string
  name: string
  spent: Dec
  /** The monthly limit, or null when none is set. */
  limit: Dec | null
  /** limit minus spent; negative means over. Null without a limit. */
  left: Dec | null
  /** 0 to 100+, for the bar. Null without a limit. */
  pct: number | null
}

export interface MonthSummary {
  month: string
  spent: Dec
  overall: { limit: Dec; left: Dec; pct: number } | null
  lines: CategoryLine[]
  /** Spent in the month on entries with no category, or whose category was deleted. Never hidden. */
  uncategorised: Dec
  entries: BudgetExpense[]
}

const parse = (s: string | null): Dec | null => {
  if (s === null) return null
  try {
    const v = new D(s)
    return v.isFinite() && !v.isNegative() ? v : null
  } catch {
    return null
  }
}

const pctOf = (spent: Dec, limit: Dec): number => (limit.isZero() ? (spent.isZero() ? 0 : 100) : Math.round(spent.div(limit).times(100).toNumber()))

/** Live entries in a month, newest first. */
export function entriesIn(budget: BudgetData, month: string): BudgetExpense[] {
  return budget.expenses.filter((e) => e.deletedAt === null && e.date.startsWith(month)).sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
}

export function summarise(budget: BudgetData, month: string): MonthSummary {
  const entries = entriesIn(budget, month)
  const live = budget.categories.filter((c) => c.deletedAt === null)
  const liveIds = new Set(live.map((c) => c.id))

  const spentBy = new Map<string, Dec>()
  let uncategorised = new D(0)
  let spent = new D(0)
  for (const e of entries) {
    const amount = parse(e.amount) ?? new D(0)
    spent = spent.plus(amount)
    if (e.categoryId !== null && liveIds.has(e.categoryId)) spentBy.set(e.categoryId, (spentBy.get(e.categoryId) ?? new D(0)).plus(amount))
    else uncategorised = uncategorised.plus(amount)
  }

  const lines: CategoryLine[] = live.map((c: BudgetCategory) => {
    const s = spentBy.get(c.id) ?? new D(0)
    const limit = parse(c.limit)
    return { id: c.id, name: c.name, spent: s, limit, left: limit ? limit.minus(s) : null, pct: limit ? pctOf(s, limit) : null }
  })

  const overallLimit = parse(budget.overall)
  return {
    month,
    spent,
    overall: overallLimit ? { limit: overallLimit, left: overallLimit.minus(spent), pct: pctOf(spent, overallLimit) } : null,
    lines,
    uncategorised,
    entries,
  }
}
