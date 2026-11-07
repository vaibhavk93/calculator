import { D, type Dec } from '../decimal'

/**
 * Portfolio: a list of things you own or owe. Each has ONE current value (its newest dated value) and an append-only
 * history. Net worth, the split by kind and the monthly totals are all derived here, never stored.
 *
 * Rupees only. `amount` is always a positive plain decimal string; whether it adds or subtracts comes from `kind` alone.
 * Dates are 'YYYY-MM-DD' strings (compared as text, so no time zone can move a day).
 */

/** Old bundled groups. Still valid so saved data and backups load; the add form no longer offers them. */
export const LEGACY_KINDS = ['stocks_mf', 'retirement'] as const
export const ASSET_KINDS = ['bank', 'fd_rd', 'stocks', 'mutual_funds', 'reits', 'bonds', 'sgb', 'gold', 'property', 'nps', 'epf', 'ppf', 'other', ...LEGACY_KINDS] as const
export const LIABILITY_KINDS = ['loan', 'card_debt'] as const
export const HOLDING_KINDS = [...ASSET_KINDS, ...LIABILITY_KINDS] as const
export type HoldingKind = (typeof HOLDING_KINDS)[number]

export interface HoldingValue {
  date: string
  amount: string
}

export interface Holding {
  id: string
  name: string
  kind: HoldingKind
  /** Set when deleted (it sits in Trash for a while so Undo works). A deleted holding is ignored by every function here. */
  deletedAt: number | null
  values: HoldingValue[]
}

export const MAX_HOLDINGS = 100
export const MAX_VALUES = 120
export const STALE_DAYS = 30

export const isHoldingKind = (v: unknown): v is HoldingKind => typeof v === 'string' && (HOLDING_KINDS as readonly string[]).includes(v)
export const isLegacyKind = (kind: HoldingKind): boolean => (LEGACY_KINDS as readonly string[]).includes(kind)
export const isLiability = (kind: HoldingKind): boolean => (LIABILITY_KINDS as readonly string[]).includes(kind)

/** A positive-or-zero plain number: the same shape as persistence's PLAIN_NUMBER, without the minus sign. */
const AMOUNT = /^\d{1,110}(\.\d{1,110})?$/
export const isAmount = (v: unknown): v is string => typeof v === 'string' && AMOUNT.test(v) && new D(v).gt(0)

/** A real calendar day written 'YYYY-MM-DD' (so not 2026-02-31). */
export function isDay(v: unknown): v is string {
  const m = typeof v === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}

const dayNumber = (iso: string): number => {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export const daysBetween = (from: string, to: string): number => dayNumber(to) - dayNumber(from)

const live = (holdings: readonly Holding[]) => holdings.filter((h) => h.deletedAt === null)

/** The newest value, or null when there is none. Does not assume the list is in order. */
export function latestValue(h: Pick<Holding, 'values'>): HoldingValue | null {
  let best: HoldingValue | null = null
  for (const v of h.values) if (best === null || v.date >= best.date) best = v
  return best
}

/** The last value on or before `day` (inclusive), or null when the holding had none yet. */
export function valueOn(h: Pick<Holding, 'values'>, day: string): HoldingValue | null {
  let best: HoldingValue | null = null
  for (const v of h.values) if (v.date <= day && (best === null || v.date >= best.date)) best = v
  return best
}

/** +amount for something you own, -amount for something you owe. */
const signed = (kind: HoldingKind, amount: string): Dec => (isLiability(kind) ? new D(amount).neg() : new D(amount))

/** Everything you own minus everything you owe, each at its latest value. */
export function netWorth(holdings: readonly Holding[]): Dec {
  let sum = new D(0)
  for (const h of live(holdings)) {
    const v = latestValue(h)
    if (v) sum = sum.plus(signed(h.kind, v.amount))
  }
  return sum
}

/** How many holdings (live, with a value) have a latest value older than `days` days. */
export function staleCount(holdings: readonly Holding[], today: string, days = STALE_DAYS): number {
  let n = 0
  for (const h of live(holdings)) {
    const v = latestValue(h)
    if (v && daysBetween(v.date, today) > days) n++
  }
  return n
}

/** How many live holdings have at least one value. */
export const countedHoldings = (holdings: readonly Holding[]): number => live(holdings).filter((h) => latestValue(h) !== null).length

/** The oldest of the holdings' latest dates: "this total includes values from ...". Null when there are no values. */
export function oldestAsOf(holdings: readonly Holding[]): string | null {
  let oldest: string | null = null
  for (const h of live(holdings)) {
    const v = latestValue(h)
    if (v && (oldest === null || v.date < oldest)) oldest = v.date
  }
  return oldest
}

export interface KindTotal {
  kind: HoldingKind
  liability: boolean
  /** The sum of the latest values of this kind, always positive. */
  total: Dec
  count: number
}

/** Latest values summed per kind. Kinds with nothing in them are left out. Assets first, then what you owe, each biggest first. */
export function splitByKind(holdings: readonly Holding[]): KindTotal[] {
  const by = new Map<HoldingKind, KindTotal>()
  for (const h of live(holdings)) {
    const v = latestValue(h)
    if (!v) continue
    const row = by.get(h.kind) ?? { kind: h.kind, liability: isLiability(h.kind), total: new D(0), count: 0 }
    row.total = row.total.plus(v.amount)
    row.count++
    by.set(h.kind, row)
  }
  return [...by.values()].sort((a, b) => Number(a.liability) - Number(b.liability) || b.total.comparedTo(a.total))
}

export interface MonthTotal {
  /** 'YYYY-MM' */
  month: string
  /** Net worth of the holdings that had a value by the end of this month. */
  total: Dec
  included: number
  /** Ids of holdings with no value yet by the end of this month. They are left out of `total`, never guessed. */
  excluded: string[]
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Last `lastN` months ending with the month of `today`, oldest first. Each month uses every holding's last value on or before that month's end. */
export function monthlySeries(holdings: readonly Holding[], today: string, lastN = 6): MonthTotal[] {
  const [ty = 1970, tm = 1] = today.split('-').map(Number)
  const out: MonthTotal[] = []
  for (let i = lastN - 1; i >= 0; i--) {
    const idx = ty * 12 + (tm - 1) - i
    const y = Math.floor(idx / 12)
    const m = (idx % 12) + 1
    const month = `${y}-${pad2(m)}`
    // Day 31 is safe: a day that does not exist in a short month is simply never equal to a value's date, and text order still holds.
    const end = `${month}-31`
    let total = new D(0)
    let included = 0
    const excluded: string[] = []
    for (const h of live(holdings)) {
      const v = valueOn(h, end)
      if (v) {
        total = total.plus(signed(h.kind, v.amount))
        included++
      } else excluded.push(h.id)
    }
    out.push({ month, total, included, excluded })
  }
  return out
}

/**
 * The values with `value` added: a value on a day that already has one REPLACES it (never two on one date), and the list stays
 * in date order. When the list is longer than `max` the oldest values go first. The input is not changed.
 */
export function withValue(values: readonly HoldingValue[], value: HoldingValue, max = MAX_VALUES): HoldingValue[] {
  const next = [...values.filter((v) => v.date !== value.date), value].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return next.length > max ? next.slice(next.length - max) : next
}
