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

/** The next due date after paying one. Returns null for a one-time reminder: it is finished. */
export function advance(r: Pick<Reminder, 'dueAt' | 'repeat' | 'anchorDay'>): number | null {
  const step = REPEAT_MONTHS[r.repeat]
  return step === 0 ? null : addMonths(r.dueAt, step, r.anchorDay)
}

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
    const amount = cards.find((c) => c.id === r.cardId && c.deletedAt === null)?.amount
    if (amount) total = total.plus(amount)
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
