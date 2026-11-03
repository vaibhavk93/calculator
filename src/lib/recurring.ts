import { D, type Dec } from '../engine'
import { BILL_REPEATS, validateAmount, validateDate, type BillRepeat, type BudgetData, type RecurringItem } from './budget'
import { MAX_TASK_TITLE } from './memory'
import { addMonths, atTime, startOfDay } from './reminders'

/**
 * Bills and subscriptions, as plain maths. The record itself (RecurringItem) is in budget.ts; the store keeps it in step with
 * its Due reminder. The next due date is never stored here: it lives on the reminder, so there is one source of truth.
 */

const step = (r: BillRepeat): number => BILL_REPEATS.find((x) => x.id === r)!.months

const dateParts = (key: string): [number, number, number] => {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number)
  return [y, m, d]
}

/** Moves `ts` forward in whole periods until it is today or later. */
export function rollForward(ts: number, repeat: BillRepeat, anchorDay: number, now: number): number {
  const today = startOfDay(now)
  let next = ts
  for (let i = 0; next < today && i < 1000; i++) next = addMonths(next, step(repeat), anchorDay)
  return next
}

/**
 * When a bill last paid on `dateKey` ("YYYY-MM-DD") is next due: one period later, moved on in whole periods if that is already
 * past (so logging an old payment never shows a bill as overdue). `anchorDay` is the day of the month it aims for.
 */
export function firstDue(dateKey: string, repeat: BillRepeat, now: number, time: string): { dueAt: number; anchorDay: number } {
  const [y, m, d] = dateParts(dateKey)
  const paid = atTime(new Date(y, m - 1, d).getTime(), time)
  return { dueAt: rollForward(addMonths(paid, step(repeat), d), repeat, d, now), anchorDay: d }
}

/** The next time a card bill is due, on `dueDay` (1 to 28) at `time`: this month's if it is today or later, else next month's. */
export function cardBillDue(dueDay: number, now: number, time: string): number {
  const n = new Date(now)
  const thisMonth = atTime(new Date(n.getFullYear(), n.getMonth(), dueDay).getTime(), time)
  return thisMonth >= startOfDay(now) ? thisMonth : atTime(new Date(n.getFullYear(), n.getMonth() + 1, dueDay).getTime(), time)
}

export const billPerYear = (amount: string, repeat: BillRepeat): Dec => new D(amount).times(12 / step(repeat))
export const billPerMonth = (amount: string, repeat: BillRepeat): Dec => billPerYear(amount, repeat).div(12)

/** A bill that is still running: not stopped, not paused, with an amount. Card bills have none and are never counted. */
export const isCounted = (i: RecurringItem): boolean => i.kind === 'bill' && i.deletedAt === null && !i.paused && i.amount !== null

/** What all running bills cost. The yearly figure is exact; the monthly one is a twelfth of it. */
export function billTotals(items: RecurringItem[]): { perMonth: Dec; perYear: Dec; count: number } {
  let perYear = new D(0)
  let count = 0
  for (const i of items) {
    if (!isCounted(i)) continue
    perYear = perYear.plus(billPerYear(i.amount!, i.repeat))
    count += 1
  }
  return { perMonth: perYear.div(12), perYear, count }
}

/** "₹199 a month = ₹2,388 a year". `money` formats an amount. */
export function billWords(i: Pick<RecurringItem, 'amount' | 'repeat'>, money: (v: Dec) => string): string {
  if (i.amount === null) return ''
  const a = new D(i.amount)
  const year = money(billPerYear(i.amount, i.repeat))
  if (i.repeat === 'monthly') return `${money(a)} a month = ${year} a year`
  if (i.repeat === 'quarterly') return `${money(a)} every 3 months = ${year} a year`
  return `${money(a)} a year, about ${money(billPerMonth(i.amount, i.repeat))} a month`
}

export const repeatWord = (r: BillRepeat): string => BILL_REPEATS.find((x) => x.id === r)!.label.toLowerCase()

/** The live recurring items, newest first as stored. */
export const liveBills = (b: Pick<BudgetData, 'recurring'>): RecurringItem[] => (b.recurring ?? []).filter((i) => i.deletedAt === null)

/** The running card-bill reminder for a card, if any. */
export const cardBillFor = (b: Pick<BudgetData, 'recurring'>, instrumentId: string): RecurringItem | undefined =>
  liveBills(b).find((i) => i.kind === 'cardBill' && i.instrumentId === instrumentId)

/** The recurring item that owns a Due card, if any. */
export const billForCard = (b: Pick<BudgetData, 'recurring'>, cardId: string): RecurringItem | undefined => liveBills(b).find((i) => i.cardId === cardId)

export interface BillErrors {
  title?: string
  amount?: string
  date?: string
}

/** Every problem with a bill being added or edited. `date` is "YYYY-MM-DD" or null when the date is not asked. */
export function validateBill(d: { title: string; amount: string; date: string | null }, today: Date = new Date()): BillErrors {
  const out: BillErrors = {}
  const title = d.title.trim()
  if (!title) out.title = 'Give it a name'
  else if (title.length > MAX_TASK_TITLE) out.title = `Name can't be more than ${MAX_TASK_TITLE} characters`
  const amount = validateAmount(d.amount)
  if (amount) out.amount = amount
  if (d.date !== null) {
    const date = validateDate(d.date, today)
    if (date) out.date = date
  }
  return out
}
