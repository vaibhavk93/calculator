import { D, type Dec } from '../engine'

/**
 * A budget bucket. `limit` is a plain decimal string for every month, or null for "no limit".
 * Two levels only: a top-level category (parentId null) may have subcategories; a subcategory never has children.
 */
export interface BudgetCategory {
  id: string
  name: string
  limit: string | null
  /** The top-level category this is a subcategory of, or null for a top-level one. */
  parentId: string | null
  deletedAt: number | null
}

/** How an entry was paid. The six modes are fixed; the cards, accounts and wallets under them are the user's own (PayInstrument). */
export const PAYMENT_MODES = [
  { id: 'cash', label: 'Cash' },
  { id: 'upi', label: 'UPI' },
  { id: 'credit', label: 'Credit card' },
  { id: 'debit', label: 'Debit card' },
  { id: 'netbanking', label: 'Net banking' },
  { id: 'wallet', label: 'Wallet' },
] as const
export type PaymentModeId = (typeof PAYMENT_MODES)[number]['id']
export const isPaymentMode = (v: unknown): v is PaymentModeId => PAYMENT_MODES.some((m) => m.id === v)
export const modeLabel = (id: PaymentModeId): string => PAYMENT_MODES.find((m) => m.id === id)!.label

export const INSTRUMENT_KINDS = [
  { id: 'credit', label: 'Credit card' },
  { id: 'debit', label: 'Debit card' },
  { id: 'bank', label: 'Bank account' },
  { id: 'wallet', label: 'Wallet' },
] as const
export type InstrumentKind = (typeof INSTRUMENT_KINDS)[number]['id']
export const isInstrumentKind = (v: unknown): v is InstrumentKind => INSTRUMENT_KINDS.some((k) => k.id === v)

export const NETWORKS = [
  { id: 'visa', label: 'Visa' },
  { id: 'mastercard', label: 'Mastercard' },
  { id: 'rupay', label: 'RuPay' },
  { id: 'amex', label: 'Amex' },
  { id: 'diners', label: 'Diners Club' },
] as const
export type NetworkId = (typeof NETWORKS)[number]['id']
export const isNetwork = (v: unknown): v is NetworkId => NETWORKS.some((n) => n.id === v)
export const networkLabel = (id: NetworkId): string => NETWORKS.find((n) => n.id === id)!.label

/** A card, bank account or wallet the user pays from. `rewardNote` is free text the user types; the app never assumes rewards. */
export interface PayInstrument {
  id: string
  name: string
  kind: InstrumentKind
  /** Only for credit and debit cards. */
  network: NetworkId | null
  bank: string
  /** '' or exactly 4 digits. */
  last4: string
  rewardNote: string
  deletedAt: number | null
}

export const MAX_INSTRUMENTS = 40
export const MAX_INSTRUMENT_NAME = 40
export const MAX_REWARD_NOTE = 200

/** "Tata Neo ••4321" */
export const instrumentLabel = (i: PayInstrument): string => (i.last4 ? `${i.name} ••${i.last4}` : i.name)

/**
 * Which instruments a mode accepts. Credit, debit, net banking and wallet take their own kind.
 * UPI takes its funding source: a bank account, a debit card, a wallet, or a credit card only on RuPay.
 * Cash takes none.
 */
export function instrumentFitsMode(mode: PaymentModeId, i: Pick<PayInstrument, 'kind' | 'network'>): boolean {
  switch (mode) {
    case 'credit': return i.kind === 'credit'
    case 'debit': return i.kind === 'debit'
    case 'netbanking': return i.kind === 'bank'
    case 'wallet': return i.kind === 'wallet'
    case 'upi': return i.kind === 'bank' || i.kind === 'debit' || i.kind === 'wallet' || (i.kind === 'credit' && i.network === 'rupay')
    case 'cash': return false
  }
}

const MODE_HINT: Record<PaymentModeId, string> = {
  cash: 'Cash has no card or account to pick',
  upi: 'Pick a RuPay credit card, a bank account, a debit card or a wallet for UPI',
  credit: 'Pick a credit card for Credit card',
  debit: 'Pick a debit card for Debit card',
  netbanking: 'Pick a bank account for Net banking',
  wallet: 'Pick a wallet for Wallet',
}

/** Null when the pair is fine (no instrument is always fine), otherwise a plain message. */
export function paymentError(budget: Pick<BudgetData, 'instruments'>, mode: PaymentModeId | null, instrumentId: string | null): string | null {
  if (instrumentId === null) return null
  const i = budget.instruments.find((x) => x.id === instrumentId && x.deletedAt === null)
  if (!i) return 'That card or account was removed'
  if (mode === null) return 'Pick how it was paid first'
  return instrumentFitsMode(mode, i) ? null : MODE_HINT[mode]
}

/** Live instruments a picker should offer for a mode, in the order they were added. */
export const eligibleInstruments = (budget: Pick<BudgetData, 'instruments'>, mode: PaymentModeId | null): PayInstrument[] =>
  mode === null ? [] : budget.instruments.filter((i) => i.deletedAt === null && instrumentFitsMode(mode, i))

export interface InstrumentDraft {
  name: string
  kind: InstrumentKind
  network?: NetworkId | null
  bank?: string
  last4?: string
  rewardNote?: string
}

/** Trims and checks a draft. Returns the clean fields or the reason it is not acceptable. Network is kept only for cards. */
export function cleanInstrument(d: InstrumentDraft): { ok: true; value: Omit<PayInstrument, 'id' | 'deletedAt'> } | { ok: false; error: string } {
  const name = String(d.name ?? '').trim().slice(0, MAX_INSTRUMENT_NAME)
  if (!name) return { ok: false, error: 'Give it a name' }
  if (!isInstrumentKind(d.kind)) return { ok: false, error: 'Pick what kind it is' }
  const last4 = String(d.last4 ?? '').trim()
  if (last4 !== '' && !/^\d{4}$/.test(last4)) return { ok: false, error: 'Last 4 digits must be exactly 4 numbers' }
  const card = d.kind === 'credit' || d.kind === 'debit'
  return {
    ok: true,
    value: {
      name,
      kind: d.kind,
      network: card && isNetwork(d.network) ? d.network : null,
      bank: String(d.bank ?? '').trim().slice(0, 40),
      last4,
      rewardNote: String(d.rewardNote ?? '').trim().slice(0, MAX_REWARD_NOTE),
    },
  }
}

/** One thing spent. `date` is "YYYY-MM-DD" on the user's calendar. A null category means "Uncategorised". */
export interface BudgetExpense {
  id: string
  date: string
  amount: string
  /** A top-level category or a subcategory. Null is Uncategorised. */
  categoryId: string | null
  /** How it was paid, or null when not said. */
  mode: PaymentModeId | null
  /** The card, account or wallet it was paid from (see instrumentFitsMode), or null. */
  instrumentId: string | null
  note: string
  deletedAt: number | null
}

export interface BudgetData {
  /** One limit for all spending in a month, or null. */
  overall: string | null
  categories: BudgetCategory[]
  instruments: PayInstrument[]
  expenses: BudgetExpense[]
}

/** What the add/edit sheet sends. Mode and instrument must go together (see paymentError). */
export interface ExpenseDraft {
  amount: string
  categoryId: string | null
  mode?: PaymentModeId | null
  instrumentId?: string | null
  date: string
  note: string
}

export const MAX_EXPENSES = 20000
/** Live categories and subcategories together. */
export const MAX_CATEGORIES = 60

/** The categories a new install starts with: names only, no limits. They can all be renamed or removed. */
export const STARTER_CATEGORIES = ['Rent', 'Food', 'Groceries', 'Transport', 'Bills', 'Health', 'Shopping', 'Travel', 'Loan EMI', 'Savings']

export const starterBudget = (): BudgetData => ({
  overall: null,
  categories: STARTER_CATEGORIES.map((name) => ({ id: `starter-${name.toLowerCase().replace(/\W+/g, '-')}`, name, limit: null, parentId: null, deletedAt: null })),
  instruments: [],
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
  parentId: string | null
  /** For a top-level line: its own entries plus all its subcategories'. */
  spent: Dec
  /** Top-level only: spent on the category itself, not in any subcategory. Zero for a subcategory line. */
  direct: Dec
  /** The monthly limit, or null when none is set. A subcategory's limit never changes its parent's. */
  limit: Dec | null
  /** limit minus spent; negative means over. Null without a limit. */
  left: Dec | null
  /** 0 to 100+, for the bar. Null without a limit. */
  pct: number | null
  /** Live subcategories (empty for a subcategory line). */
  children: CategoryLine[]
}

export interface Filter {
  modeId?: PaymentModeId
  instrumentId?: string
  network?: NetworkId
  /** A top-level id matches it and all its subcategories; a subcategory id matches only itself. */
  categoryId?: string
}

export interface MonthSummary {
  month: string
  /** Everything spent in the month that matches the filter. */
  spent: Dec
  overall: { limit: Dec; left: Dec; pct: number } | null
  /** Live top-level categories, each with its subcategories as `children`. */
  lines: CategoryLine[]
  /** Spent in the month on entries with no category, or whose category was deleted. Never hidden. */
  uncategorised: Dec
  /** Spent per payment mode, only modes with spend. */
  byMode: { id: PaymentModeId; label: string; spent: Dec }[]
  /** Spent on entries with no mode. */
  noMode: Dec
  /** Per card, account or wallet with spend, biggest first. */
  byInstrument: { instrument: PayInstrument; spent: Dec; count: number }[]
  /** Per card network with spend (from the instrument's network), biggest first. */
  byNetwork: { id: NetworkId; label: string; spent: Dec; count: number }[]
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

/** "Food" or "Food › Swiggy"; "Uncategorised" for none or a deleted one. */
export function categoryName(budget: Pick<BudgetData, 'categories'>, id: string | null): string {
  const c = budget.categories.find((x) => x.id === id && x.deletedAt === null)
  if (!c) return 'Uncategorised'
  const p = c.parentId === null ? null : budget.categories.find((x) => x.id === c.parentId && x.deletedAt === null)
  return p ? `${p.name} › ${c.name}` : c.name
}

const ZERO = () => new D(0)
const bySpentDesc = (a: { spent: Dec }, b: { spent: Dec }) => b.spent.comparedTo(a.spent)

export function summarise(budget: BudgetData, month: string, filter: Filter = {}): MonthSummary {
  const instById = new Map(budget.instruments.map((i) => [i.id, i]))
  const catById = new Map(budget.categories.map((c) => [c.id, c]))
  const entries = entriesIn(budget, month).filter((e) => {
    if (filter.modeId !== undefined && e.mode !== filter.modeId) return false
    if (filter.instrumentId !== undefined && e.instrumentId !== filter.instrumentId) return false
    if (filter.network !== undefined && (e.instrumentId === null || instById.get(e.instrumentId)?.network !== filter.network)) return false
    if (filter.categoryId !== undefined && e.categoryId !== filter.categoryId && (e.categoryId === null || catById.get(e.categoryId)?.parentId !== filter.categoryId)) return false
    return true
  })
  const tops = budget.categories.filter((c) => c.deletedAt === null && c.parentId === null)
  const topIds = new Set(tops.map((c) => c.id))
  // A subcategory counts only while its parent is live; otherwise its entries show as uncategorised.
  const subs = budget.categories.filter((c) => c.deletedAt === null && c.parentId !== null && topIds.has(c.parentId))
  const liveIds = new Set([...topIds, ...subs.map((c) => c.id)])

  const spentBy = new Map<string, Dec>()
  let uncategorised = ZERO()
  let spent = ZERO()
  let noMode = ZERO()
  const modeSpent = new Map<PaymentModeId, Dec>()
  const instSpent = new Map<string, { spent: Dec; count: number }>()
  const netSpent = new Map<NetworkId, { spent: Dec; count: number }>()
  for (const e of entries) {
    const amount = parse(e.amount) ?? ZERO()
    spent = spent.plus(amount)
    if (e.mode === null) noMode = noMode.plus(amount)
    else modeSpent.set(e.mode, (modeSpent.get(e.mode) ?? ZERO()).plus(amount))
    if (e.categoryId !== null && liveIds.has(e.categoryId)) spentBy.set(e.categoryId, (spentBy.get(e.categoryId) ?? ZERO()).plus(amount))
    else uncategorised = uncategorised.plus(amount)
    const inst = e.instrumentId === null ? undefined : instById.get(e.instrumentId)
    if (inst) {
      const a = instSpent.get(inst.id) ?? { spent: ZERO(), count: 0 }
      instSpent.set(inst.id, { spent: a.spent.plus(amount), count: a.count + 1 })
      if (inst.network) {
        const n = netSpent.get(inst.network) ?? { spent: ZERO(), count: 0 }
        netSpent.set(inst.network, { spent: n.spent.plus(amount), count: n.count + 1 })
      }
    }
  }

  const line = (c: BudgetCategory, own: Dec, total: Dec, children: CategoryLine[]): CategoryLine => {
    const limit = parse(c.limit)
    return { id: c.id, name: c.name, parentId: c.parentId, spent: total, direct: own, limit, left: limit ? limit.minus(total) : null, pct: limit ? pctOf(total, limit) : null, children }
  }
  const lines = tops.map((c) => {
    const children = subs.filter((s) => s.parentId === c.id).map((s) => { const v = spentBy.get(s.id) ?? ZERO(); return line(s, ZERO(), v, []) })
    const own = spentBy.get(c.id) ?? ZERO()
    return line(c, own, children.reduce((t, k) => t.plus(k.spent), own), children)
  })

  const overallLimit = parse(budget.overall)
  return {
    month,
    spent,
    overall: overallLimit ? { limit: overallLimit, left: overallLimit.minus(spent), pct: pctOf(spent, overallLimit) } : null,
    lines,
    uncategorised,
    byMode: PAYMENT_MODES.filter((m) => modeSpent.get(m.id)?.gt(0)).map((m) => ({ id: m.id, label: m.label, spent: modeSpent.get(m.id)! })),
    noMode,
    byInstrument: budget.instruments.filter((i) => instSpent.has(i.id)).map((i) => ({ instrument: i, ...instSpent.get(i.id)! })).sort(bySpentDesc),
    byNetwork: NETWORKS.filter((n) => netSpent.has(n.id)).map((n) => ({ id: n.id, label: n.label, ...netSpent.get(n.id)! })).sort(bySpentDesc),
    entries,
  }
}

/**
 * What to pre-fill when a note exactly matches (ignoring case) an earlier live entry's note.
 * Most recent date wins; the stored order breaks ties (newest added first). Null when nothing matches.
 * `categoryId` may be a subcategory, in which case `parentId` is its parent. Anything deleted comes back null.
 */
export function suggestFor(
  budget: BudgetData,
  note: string,
): { categoryId: string | null; parentId: string | null; mode: PaymentModeId | null; instrumentId: string | null } | null {
  const key = note.trim().toLowerCase()
  if (!key) return null
  let best: BudgetExpense | null = null
  for (const e of budget.expenses) {
    if (e.deletedAt !== null || e.note.trim().toLowerCase() !== key) continue
    if (!best || e.date > best.date) best = e
  }
  if (!best) return null
  const cat = budget.categories.find((c) => c.id === best!.categoryId && c.deletedAt === null)
  const parent = cat?.parentId ? budget.categories.find((c) => c.id === cat.parentId && c.deletedAt === null) : null
  const catOk = !!cat && (cat.parentId === null || !!parent)
  return {
    categoryId: catOk ? best.categoryId : null,
    parentId: catOk && cat!.parentId !== null ? cat!.parentId : null,
    mode: best.mode,
    instrumentId: paymentError(budget, best.mode, best.instrumentId) === null ? best.instrumentId : null,
  }
}
