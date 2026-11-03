import type { RatesStamp } from './tool'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-11-02" -> { day: 2, month: 'Nov', year: 2026 }. Plain text split, so no time zone can move the day. */
function parts(iso: string): { day: number; month: string; year: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined
  return m && month ? { day: Number(m[3]), month, year: Number(m[1]) } : null
}

/**
 * The quiet line under a result whose answer depends on a rate that changes.
 * Before `until`: "Rates as of Nov 2026". From `until` on: a plain warning to check the official source.
 * `now` is in ms. Text only: a rate pack never blocks a result.
 */
export function ratesLine(stamp: RatesStamp, now: number): string {
  const a = parts(stamp.asOf)
  if (!a) return ''
  const until = Date.parse(`${stamp.until}T00:00:00`)
  if (Number.isFinite(until) && now >= until) return `These rates may have changed since ${a.day} ${a.month} ${a.year}. Check the official source.`
  return `Rates as of ${a.month} ${a.year}`
}
