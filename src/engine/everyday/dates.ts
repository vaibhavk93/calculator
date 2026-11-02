/** All date math is in UTC, so a daylight-saving change can never add or lose an hour. Dates travel as 'YYYY-MM-DD'. */

const DAY = 86_400_000
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A real calendar date from 'YYYY-MM-DD', or null ("2026-02-30" is not a date). */
export function parseDate(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < 1000) return null
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null
}

export const toIso = (d: Date): string => d.toISOString().slice(0, 10)

/** "Sun 28 Feb 2027" */
export const formatDate = (d: Date): string => `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`

const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY)

/** Adds calendar months. If the day does not exist in the target month it clamps to month end (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(d: Date, n: number): Date {
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + n
  const y = Math.floor(total / 12)
  const m = total - y * 12
  const out = new Date(Date.UTC(2000, m, Math.min(d.getUTCDate(), daysInMonth(y, m))))
  out.setUTCFullYear(y)
  return out
}

export const addYears = (d: Date, n: number): Date => addMonths(d, n * 12)

/** Whole days from a to b (negative if b is earlier). */
export const daysBetween = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / DAY)

/**
 * Years, months and days from `from` up to `to` (from must not be after to).
 * Months are counted the way addMonths adds them, so 31 Jan to 1 Mar is 1 month 1 day, never a negative day count.
 */
export function ymd(from: Date, to: Date): { years: number; months: number; days: number } | null {
  if (from > to) return null
  let m = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth()
  if (addMonths(from, m) > to) m--
  return { years: Math.floor(m / 12), months: m % 12, days: daysBetween(addMonths(from, m), to) }
}
