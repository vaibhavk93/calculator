import { D } from '../engine'
import {
  HOLDING_KINDS,
  MAX_HOLDINGS,
  MAX_VALUES,
  STALE_DAYS,
  daysBetween,
  isAmount,
  isDay,
  isHoldingKind,
  withValue,
  type Holding,
  type HoldingKind,
  type HoldingValue,
} from '../engine/investments/portfolio'

/**
 * Portfolio data on the phone: the types, the words, the form checks and the sanitiser. The maths is in
 * engine/investments/portfolio.ts. docs/THE-PLAN.md, "Portfolio P1". Rupees only; there is no currency field.
 */
export type { Holding, HoldingKind, HoldingValue }
export { MAX_HOLDINGS, MAX_VALUES, STALE_DAYS }

export const MAX_HOLDING_NAME = 60
export const MIN_VALUE_DAY = '2000-01-01'
const MAX_AMOUNT = new D('1000000000000') // 1,00,000 crore: far above anything real, keeps the maths bounded

/** What each kind is called on screen. */
export const KIND_LABEL: Record<HoldingKind, string> = {
  bank: 'Bank accounts',
  fd_rd: 'Fixed and recurring deposits',
  stocks_mf: 'Stocks and mutual funds',
  gold: 'Gold',
  property: 'Property',
  retirement: 'Retirement (EPF, PPF, NPS)',
  other: 'Other',
  loan: 'Loans',
  card_debt: 'Card dues',
}
/** The short, singular form for the add form's picker ("Bank account", "Loan"). */
export const KIND_ONE: Record<HoldingKind, string> = {
  bank: 'Bank account',
  fd_rd: 'Fixed or recurring deposit',
  stocks_mf: 'Stocks or mutual funds',
  gold: 'Gold',
  property: 'Property',
  retirement: 'Retirement (EPF, PPF, NPS)',
  other: 'Other thing I own',
  loan: 'Loan (I owe this)',
  card_debt: 'Card due (I owe this)',
}
export const KIND_ORDER: readonly HoldingKind[] = HOLDING_KINDS

/** A real day, today at most. Used by the add and update forms and by the store. `today` is 'YYYY-MM-DD'. */
export function validateValueDay(day: string, today: string): string | null {
  if (!isDay(day)) return 'Pick a date'
  if (day < MIN_VALUE_DAY) return 'Pick a date from the year 2000 onward'
  if (day > today) return 'A value cannot be dated in the future'
  return null
}

/** A positive amount in rupees, up to 2 decimals. Accepts what the money box produces (commas and the rupee sign are dropped first). */
export function validateHoldingAmount(text: string): string | null {
  const clean = text.replace(/[,₹\s]/g, '')
  if (!/^(\d+\.?\d*|\.\d+)$/.test(clean)) return 'Enter an amount above zero'
  const v = new D(clean)
  if (v.isZero()) return 'Enter an amount above zero'
  if (v.decimalPlaces() > 2) return 'Use up to 2 decimal places'
  if (v.gt(MAX_AMOUNT)) return 'That amount is too large'
  return null
}

/** The clean plain string for an amount that passed `validateHoldingAmount`. */
export const cleanHoldingAmount = (text: string): string => new D(text.replace(/[,₹\s]/g, '')).toFixed()

export const cleanHoldingName = (name: string): string => name.replace(/\s+/g, ' ').trim().slice(0, MAX_HOLDING_NAME)

export function validateHolding(d: { name: string; kind: string; amount: string; date: string }, today: string): { name?: string; kind?: string; amount?: string; date?: string } {
  const out: { name?: string; kind?: string; amount?: string; date?: string } = {}
  if (!cleanHoldingName(d.name)) out.name = 'Give it a name'
  if (!isHoldingKind(d.kind)) out.kind = 'Pick what kind it is'
  const amount = validateHoldingAmount(d.amount)
  if (amount) out.amount = amount
  const date = validateValueDay(d.date, today)
  if (date) out.date = date
  return out
}

/** "updated today", "updated yesterday", "updated 41 days ago". Never colour alone: the word "old" is added by the screen past STALE_DAYS. */
export function updatedWords(date: string, today: string): string {
  const n = daysBetween(date, today)
  if (n <= 0) return 'updated today'
  if (n === 1) return 'updated yesterday'
  return `updated ${n} days ago`
}

export const isOld = (date: string, today: string): boolean => daysBetween(date, today) > STALE_DAYS

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** A value saved in a time zone ahead of this one can look a day early or late; one day of room, so it is never thrown away. */
const dayAfter = (today: string): string => {
  const [y = 1970, m = 1, d = 1] = today.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + 1))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}
const localToday = (): string => {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

/**
 * Whatever was in storage or a backup, turned into valid holdings. Never throws; old data with no portfolio gives [].
 * Drops: junk, unknown kinds, repeated ids, holdings with no name or no good value, values with a bad date, a future date, or
 * an amount that is not a positive plain number. On one day the LATER value in the list wins. Values are put in date order and
 * capped (the oldest go). Only live holdings count toward MAX_HOLDINGS (the ones in Trash do not), with a hard stop for damaged files.
 */
export function sanitizePortfolio(raw: unknown, today: string = localToday()): Holding[] {
  if (!Array.isArray(raw)) return []
  const latestDay = dayAfter(today)
  const out: Holding[] = []
  const seen = new Set<string>()
  let liveCount = 0
  for (const item of raw) {
    if (!isObject(item)) continue
    const { id, kind } = item
    if (typeof id !== 'string' || id === '' || id.length > 64 || seen.has(id) || !isHoldingKind(kind)) continue
    const name = typeof item.name === 'string' ? cleanHoldingName(item.name) : ''
    if (!name) continue
    let values: HoldingValue[] = []
    // Newest-capped inside withValue; a long junk list is cut first so one damaged holding cannot cost time.
    for (const v of (Array.isArray(item.values) ? item.values : []).slice(0, MAX_VALUES * 4)) {
      if (!isObject(v) || !isDay(v.date) || v.date < MIN_VALUE_DAY || v.date > latestDay || !isAmount(v.amount) || new D(v.amount).gt(MAX_AMOUNT)) continue
      values = withValue(values, { date: v.date, amount: v.amount })
    }
    if (values.length === 0) continue
    const deletedAt = typeof item.deletedAt === 'number' && Number.isFinite(item.deletedAt) ? item.deletedAt : null
    seen.add(id)
    out.push({ id, name, kind, deletedAt, values })
    if (deletedAt === null) liveCount++
    if (liveCount >= MAX_HOLDINGS || out.length >= MAX_HOLDINGS * 2) break
  }
  return out
}
