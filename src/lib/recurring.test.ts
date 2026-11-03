import { describe, expect, it } from 'vitest'
import { D } from '../engine'
import type { RecurringItem } from './budget'
import { billForCard, billPerMonth, billPerYear, billTotals, billWords, cardBillDue, cardBillFor, firstDue, rollForward, validateBill } from './recurring'

const money = (v: InstanceType<typeof D>) => `₹${v.toFixed(2).replace(/\.00$/, '')}`
const item = (o: Partial<RecurringItem> = {}): RecurringItem => ({ id: 'r1', kind: 'bill', title: 'Netflix', amount: '199', repeat: 'monthly', categoryId: null, mode: null, instrumentId: null, cardId: 'c1', deletedAt: null, ...o })
const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).getTime()

describe('what a bill costs', () => {
  it('turns a monthly price into a yearly one exactly', () => {
    expect(billPerYear('199', 'monthly').toFixed(2)).toBe('2388.00')
    expect(billWords(item(), money)).toBe('₹199 a month = ₹2388 a year')
  })
  it('handles quarterly and yearly prices', () => {
    expect(billPerYear('600', 'quarterly').toFixed(2)).toBe('2400.00')
    expect(billWords(item({ amount: '600', repeat: 'quarterly' }), money)).toBe('₹600 every 3 months = ₹2400 a year')
    expect(billPerMonth('999', 'yearly').toFixed(2)).toBe('83.25')
    expect(billWords(item({ amount: '999', repeat: 'yearly' }), money)).toBe('₹999 a year, about ₹83.25 a month')
  })
  it('totals only bills that are running', () => {
    const t = billTotals([
      item(),
      item({ id: 'r2', amount: '600', repeat: 'quarterly' }),
      item({ id: 'r3', paused: true }),
      item({ id: 'r4', deletedAt: 5 }),
      item({ id: 'r5', kind: 'cardBill', amount: null }),
    ])
    expect(t.count).toBe(2)
    expect(t.perYear.toFixed(2)).toBe('4788.00')
    expect(t.perMonth.toFixed(2)).toBe('399.00')
  })
  it('an empty list costs nothing', () => expect(billTotals([]).perYear.toFixed(2)).toBe('0.00'))
})

describe('next due date', () => {
  it('is one period after the last payment, at the reminder time', () => {
    const { dueAt, anchorDay } = firstDue('2026-11-03', 'monthly', at(2026, 11, 10), '09:00')
    expect(dueAt).toBe(at(2026, 12, 3))
    expect(anchorDay).toBe(3)
  })
  it('moves on in whole periods when that is already past, so an old entry is never shown overdue', () => {
    expect(firstDue('2026-06-03', 'monthly', at(2026, 11, 10), '09:00').dueAt).toBe(at(2026, 12, 3))
    expect(firstDue('2024-02-10', 'yearly', at(2026, 11, 10), '18:30').dueAt).toBe(at(2027, 2, 10, 18) + 30 * 60_000)
  })
  it('a bill on the 31st keeps aiming at the 31st', () => {
    const { dueAt, anchorDay } = firstDue('2026-01-31', 'monthly', at(2026, 1, 31), '09:00')
    expect(new Date(dueAt).getMonth()).toBe(1) // 28 Feb
    expect(new Date(dueAt).getDate()).toBe(28)
    expect(anchorDay).toBe(31)
    expect(new Date(rollForward(dueAt + 1, 'monthly', 31, at(2026, 3, 1))).getDate()).toBe(31) // March again
  })
  it('a card bill is due on its due day this month if that is today or later, else next month', () => {
    expect(cardBillDue(18, at(2026, 11, 10), '09:00')).toBe(at(2026, 11, 18))
    expect(cardBillDue(18, at(2026, 11, 18, 15), '09:00')).toBe(at(2026, 11, 18))
    expect(cardBillDue(5, at(2026, 11, 10), '09:00')).toBe(at(2026, 12, 5))
    expect(cardBillDue(5, at(2026, 12, 20), '09:00')).toBe(at(2027, 1, 5))
  })
})

describe('lookups', () => {
  const b = { recurring: [item(), item({ id: 'r2', kind: 'cardBill', amount: null, instrumentId: 'card', cardId: 'c2' }), item({ id: 'r3', cardId: 'c3', deletedAt: 1 })] }
  it('finds the item that owns a Due card, never a stopped one', () => {
    expect(billForCard(b, 'c1')?.id).toBe('r1')
    expect(billForCard(b, 'c3')).toBeUndefined()
  })
  it('finds a card\'s bill reminder', () => {
    expect(cardBillFor(b, 'card')?.id).toBe('r2')
    expect(cardBillFor(b, 'other')).toBeUndefined()
  })
})

describe('validateBill', () => {
  it('needs a name and an amount above zero', () => {
    expect(validateBill({ title: ' ', amount: '', date: null })).toEqual({ title: 'Give it a name', amount: 'Enter an amount above zero' })
    expect(validateBill({ title: 'Netflix', amount: '0', date: null }).amount).toBe('Enter an amount above zero')
    expect(validateBill({ title: 'Netflix', amount: '199', date: '2026-12-03' })).toEqual({})
  })
  it('checks the date only when it is asked for', () => {
    expect(validateBill({ title: 'x', amount: '5', date: '2026-02-31' }).date).toBe('Pick a date')
    expect(validateBill({ title: 'x', amount: '5', date: null }).date).toBeUndefined()
  })
  it('limits the name', () => expect(validateBill({ title: 'x'.repeat(121), amount: '5', date: null }).title).toBe("Name can't be more than 120 characters"))
})
