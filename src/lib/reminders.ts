import { D, type Dec } from '../engine'
import { REPEAT_MONTHS, type Reminder, type SavedCard } from './memory'

const DAY = 86_400_000

const daysIn = (year: number, month: number) => new Date(year, month + 1, 0).getDate()

/** Adds whole months in local time, keeping the time of day and aiming for `anchorDay` (clamped to the month's length). */
export function addMonths(ts: number, months: number, anchorDay: number): number {
  const d = new Date(ts)
  const target = d.getMonth() + months
  const year = d.getFullYear() + Math.floor(target / 12)
  const month = ((target % 12) + 12) % 12
  return new Date(year, month, Math.min(anchorDay, daysIn(year, month)), d.getHours(), d.getMinutes()).getTime()
}

/** `days` calendar days after `from`'s day, at the time of day `clock` has (a daylight-saving change cannot shift it). */
export function addDaysAt(from: number, days: number, clock: number): number {
  const d = new Date(from)
  const c = new Date(clock)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, c.getHours(), c.getMinutes()).getTime()
}

/**
 * The next due date after paying one. Returns null for a one-time reminder: it is finished.
 * A reminder with `afterDays` repeats that many days after `completedAt` (the day it was ticked), not on the calendar.
 */
export function advance(r: Pick<Reminder, 'dueAt' | 'repeat' | 'anchorDay'> & { afterDays?: number }, completedAt?: number): number | null {
  if (r.afterDays) return addDaysAt(completedAt ?? r.dueAt, r.afterDays, r.dueAt)
  const step = REPEAT_MONTHS[r.repeat]
  return step === 0 ? null : addMonths(r.dueAt, step, r.anchorDay)
}

/** Heads-up times for a reminder, in days before, biggest first. An old reminder (one number) has one. */
export function leadsOf(r: Pick<Reminder, 'leadDays' | 'leads'>): number[] {
  const list = r.leads && r.leads.length > 0 ? r.leads : [r.leadDays]
  return [...new Set(list)].sort((a, b) => b - a)
}

/** The fields a reminder draft needs for a list of lead times: `leadDays` is the biggest, `leads` only when there are several. */
export function leadFields(list: number[]): { leadDays: number; leads?: number[] } {
  const sorted = [...new Set(list)].sort((a, b) => b - a)
  const first = sorted[0] ?? 0
  return sorted.length > 1 ? { leadDays: first, leads: sorted } : { leadDays: first }
}

/** "On the day", "1 day before", "7 days before". */
export const leadLabel = (n: number) => (n === 0 ? 'On the day' : `${n} ${n === 1 ? 'day' : 'days'} before`)

/** "30" -> 30. A whole number of days from 1 to 365, else null. */
export function cleanAfterDays(text: string): number | null {
  const t = text.trim()
  if (!/^\d{1,3}$/.test(t)) return null
  const n = Number(t)
  return n >= 1 && n <= 365 ? n : null
}

/** "30 days after done" */
export const afterDaysLabel = (n: number) => `${n} ${n === 1 ? 'day' : 'days'} after done`

export const startOfDay = (ts: number) => {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Midnight at the start of the day `n` calendar days after `now`'s day. Calendar days, so a daylight-saving change cannot shift it by an hour. */
const dayStart = (now: number, n: number) => {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime()
}

export interface Groups {
  overdue: Reminder[]
  week: Reminder[]
  later: Reminder[]
}

/** Overdue (before today), this week (next 7 days including today), later. Each sorted soonest first. Finished ones are left out. */
export function groupReminders(reminders: Reminder[], now: number): Groups {
  const today = startOfDay(now)
  const weekEnd = dayStart(now, 7)
  const g: Groups = { overdue: [], week: [], later: [] }
  for (const r of [...reminders].filter((x) => !x.done).sort((a, b) => a.dueAt - b.dueAt)) {
    if (r.dueAt < today) g.overdue.push(r)
    else if (r.dueAt < weekEnd) g.week.push(r)
    else g.later.push(r)
  }
  return g
}

/** Total of the reminders due today through the 30th day from now (and anything overdue), counting only cards that have an amount. */
export function dueSoonTotal(reminders: Reminder[], cards: SavedCard[], now: number): Dec {
  // "In 30 days" is shown in the list, so it must be inside "the next 30 days": the limit is the end of day 30.
  const limit = dayStart(now, 31)
  let total = new D(0)
  for (const r of reminders) {
    if (r.done || r.dueAt >= limit) continue
    const card = cards.find((c) => c.id === r.cardId && c.deletedAt === null)
    // A reminder can sit on a percentage or a day count (B-10): only money adds up as money.
    if (card?.amount && (card.amountFmt ?? 'money') === 'money') total = total.plus(card.amount)
  }
  return total
}

/** "Today", "Tomorrow", "In 3 days", "2 days overdue". */
export function dueLabel(dueAt: number, now: number): string {
  const days = Math.round((startOfDay(dueAt) - startOfDay(now)) / DAY)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days > 1) return `In ${days} days`
  return days === -1 ? '1 day overdue' : `${-days} days overdue`
}

// ------------------------------------------------------------------ time of day

export const DEFAULT_REMINDER_TIME = '09:00'

/** "HH:MM" (24 hour) as [hour, minute], or null when it is not a real time. */
export function parseTime(text: unknown): [number, number] | null {
  const m = typeof text === 'string' ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text) : null
  return m ? [Number(m[1]), Number(m[2])] : null
}

/** The same calendar day as `ts` (local), at `time`. A bad time falls back to 9:00. */
export function atTime(ts: number, time: string): number {
  const [h, min] = parseTime(time) ?? [9, 0]
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, min).getTime()
}

/** "9:00 am", "6:30 pm". */
export function timeLabel(time: string): string {
  const [h, m] = parseTime(time) ?? [9, 0]
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

/** The next time it is `day` of a month at `time`: this month if that is still ahead of `now`, else next month (clamped to a short month). */
export function nextOnDay(now: number, day: number, time: string): number {
  const [h, min] = parseTime(time) ?? [9, 0]
  const d = new Date(now)
  const thisMonth = addMonths(new Date(d.getFullYear(), d.getMonth(), 1, h, min).getTime(), 0, day)
  return thisMonth > now ? thisMonth : addMonths(thisMonth, 1, day)
}

// ------------------------------------------------------------------ advance-tax pack

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** 15 Jun, 15 Sep, 15 Dec, 15 Mar, with the share of the year's tax that should be paid in total by then. */
const ADVANCE_TAX = [
  { month: 5, pct: 15 },
  { month: 8, pct: 45 },
  { month: 11, pct: 75 },
  { month: 2, pct: 100 },
] as const

export interface PackItem {
  title: string
  note: string
  dueAt: number
}

/** The four advance-tax reminders: each date's next occurrence after `now`, at `time`. ITR filing dates are deliberately not here. */
export function advanceTaxPack(now: number, time: string): PackItem[] {
  const [h, min] = parseTime(time) ?? [9, 0]
  const year = new Date(now).getFullYear()
  return ADVANCE_TAX.map((p, i) => {
    let dueAt = new Date(year, p.month, 15, h, min).getTime()
    if (dueAt <= now) dueAt = new Date(year + 1, p.month, 15, h, min).getTime()
    return {
      title: `Advance tax instalment ${i + 1} of 4 (${p.pct}% due)`,
      note: `By 15 ${MONTH_NAMES[p.month]}, you should have paid ${p.pct}% of this year's tax in total, counting earlier instalments. Open Tools, Advance tax, to work out the amount.`,
      dueAt,
    }
  })
}
