import { describe, expect, it } from 'vitest'
import type { BudgetData, BudgetExpense, PayInstrument } from './budget'
import { dayTitle, dayView, draftWithNote, entryKind, neighbourDays, routeLabel } from './dayView'

const e = (id: string, amount: string, o: Partial<BudgetExpense> = {}): BudgetExpense => ({ id, date: '2026-11-04', amount, categoryId: null, mode: null, instrumentId: null, note: '', deletedAt: null, ...o })
const inst = (id: string, name: string, kind: PayInstrument['kind'], last4 = ''): PayInstrument => ({ id, name, kind, network: null, bank: '', last4, rewardNote: '', deletedAt: null })
const budgetOf = (expenses: BudgetExpense[]): BudgetData => ({
  overall: null,
  categories: [],
  instruments: [inst('hdfc', 'HDFC Regalia', 'credit', '4321'), inst('axis', 'Axis Flipkart', 'credit'), inst('sal', 'HDFC Salary', 'bank', '1234')],
  expenses,
})

// The store keeps the NEWEST entry first, so these are listed newest first, like the real thing.
const busy = budgetOf([
  e('g', '2000', { income: true, note: 'Salary advance' }),
  e('f', '100', { mode: 'cash' }),
  e('e', '50', { mode: 'cash' }),
  e('d', '999', { mode: 'credit', instrumentId: 'axis' }),
  e('c', '2500', { mode: 'credit', instrumentId: 'hdfc', note: 'Dinner' }),
  e('b', '1200.50', { mode: 'upi' }),
  e('a', '300', { mode: 'upi', instrumentId: 'sal' }),
])

describe('dayView', () => {
  it('adds up the day and splits it by route, biggest first', () => {
    const v = dayView(busy, '2026-11-04')
    expect(v.spent.toString()).toBe('5149.5')
    expect(v.routes.map((r) => [r.label, r.spent.toString(), r.count])).toEqual([
      ['HDFC Regalia ••4321', '2500', 1],
      ['UPI', '1200.5', 1],
      ['Axis Flipkart', '999', 1],
      ['UPI · HDFC Salary ••1234', '300', 1],
      ['Cash', '150', 2],
    ])
  })

  it('lists entries oldest-entered first and counts them', () => {
    const v = dayView(busy, '2026-11-04')
    expect(v.entries.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
    expect(v.counts).toEqual({ entries: 7, spend: 6, moneyIn: 1, settlements: 0 })
  })

  it('shows money in but does not count it as spend or as a route', () => {
    const v = dayView(budgetOf([e('i', '5000', { income: true }), e('s', '40', { mode: 'cash' })]), '2026-11-04')
    expect(v.spent.toString()).toBe('40')
    expect(v.moneyIn.toString()).toBe('5000')
    expect(v.routes).toHaveLength(1)
  })

  it('takes a refund off the day and its route', () => {
    const v = dayView(budgetOf([e('r', '300', { mode: 'upi', refund: true }), e('s', '1000', { mode: 'upi' })]), '2026-11-04')
    expect(v.spent.toString()).toBe('700')
    expect(v.routes[0]).toMatchObject({ label: 'UPI', count: 2 })
    expect(v.routes[0]!.spent.toString()).toBe('700')
  })

  it('lists a card bill and a transfer but never counts them', () => {
    const v = dayView(budgetOf([e('t', '3000', { settlement: 'transfer' }), e('c', '1000', { settlement: 'cardBill', instrumentId: 'hdfc' }), e('s', '40', { mode: 'cash' })]), '2026-11-04')
    expect(v.spent.toString()).toBe('40')
    expect(v.routes).toHaveLength(1)
    expect(v.entries).toHaveLength(3)
    expect(v.counts).toEqual({ entries: 3, spend: 1, moneyIn: 0, settlements: 2 })
  })

  it('puts "No route" last even when it is the biggest', () => {
    const v = dayView(budgetOf([e('a', '9000'), e('b', '10', { mode: 'cash' })]), '2026-11-04')
    expect(v.routes.map((r) => r.label)).toEqual(['Cash', 'No route'])
  })

  it('leaves out deleted entries and other days', () => {
    const v = dayView(budgetOf([e('x', '777', { mode: 'cash', deletedAt: 5 }), e('y', '10', { mode: 'cash', date: '2026-11-05' }), e('z', '20', { mode: 'cash' })]), '2026-11-04')
    expect(v.entries.map((x) => x.id)).toEqual(['z'])
    expect(v.spent.toString()).toBe('20')
  })

  it('is all zeros for a day with nothing', () => {
    const v = dayView(busy, '2026-01-01')
    expect(v.spent.toString()).toBe('0')
    expect(v.moneyIn.toString()).toBe('0')
    expect(v.routes).toEqual([])
    expect(v.entries).toEqual([])
    expect(v.counts).toEqual({ entries: 0, spend: 0, moneyIn: 0, settlements: 0 })
  })

  it('keeps exact decimals', () => {
    const v = dayView(budgetOf([e('a', '0.1', { mode: 'cash' }), e('b', '0.2', { mode: 'cash' })]), '2026-11-04')
    expect(v.spent.toString()).toBe('0.3')
  })

  it('does not change the list it was given', () => {
    const before = busy.expenses.map((x) => x.id)
    dayView(busy, '2026-11-04')
    expect(busy.expenses.map((x) => x.id)).toEqual(before)
  })
})

describe('routeLabel', () => {
  it('names a card by itself, UPI by its account, and says "No route" for nothing', () => {
    expect(routeLabel(busy, { mode: 'credit', instrumentId: 'hdfc' })).toBe('HDFC Regalia ••4321')
    expect(routeLabel(busy, { mode: 'upi', instrumentId: null })).toBe('UPI')
    expect(routeLabel(busy, { mode: 'upi', instrumentId: 'sal' })).toBe('UPI · HDFC Salary ••1234')
    expect(routeLabel(busy, { mode: null, instrumentId: null })).toBe('No route')
  })
})

describe('draftWithNote', () => {
  it('keeps every field and changes only the note', () => {
    const x = e('a', '250', { mode: 'credit', instrumentId: 'hdfc', categoryId: 'food', refund: true })
    expect(draftWithNote(x, 'Lunch')).toEqual({ amount: '250', categoryId: 'food', mode: 'credit', instrumentId: 'hdfc', date: '2026-11-04', note: 'Lunch', settlement: null, refund: true, income: false })
  })
  it('keeps money in and a card bill what they are', () => {
    expect(draftWithNote(e('i', '5', { income: true }), 'x')).toMatchObject({ income: true, settlement: null })
    expect(draftWithNote(e('s', '5', { settlement: 'cardBill', instrumentId: 'hdfc' }), 'x')).toMatchObject({ income: false, settlement: 'cardBill' })
  })
})

describe('entryKind', () => {
  it('tells spending, money in and settlements apart', () => {
    expect(entryKind(e('a', '1'))).toBe('spend')
    expect(entryKind(e('a', '1', { refund: true }))).toBe('spend')
    expect(entryKind(e('a', '1', { income: true }))).toBe('income')
    expect(entryKind(e('a', '1', { settlement: 'transfer' }))).toBe('settlement')
  })
})

describe('dayTitle', () => {
  it('adds the year only when it is not this year', () => {
    expect(dayTitle('2026-11-04', new Date(2026, 10, 11))).toBe('Wed 4 Nov')
    expect(dayTitle('2025-11-04', new Date(2026, 10, 11))).toBe('Tue 4 Nov 2025')
  })
})

describe('neighbourDays', () => {
  const b = budgetOf([e('n', '5', { date: '2026-11-10' }), e('o', '5', { date: '2026-10-31' }), e('x', '5', { date: '2026-09-01', deletedAt: 1 })])
  it('steps one calendar day either way, across a month end', () => {
    expect(neighbourDays(b, '2026-11-01', '2026-11-15')).toEqual({ prev: '2026-10-31', next: '2026-11-02' })
  })
  it('has no day before the first live entry and none after today', () => {
    expect(neighbourDays(b, '2026-10-31', '2026-11-15').prev).toBeNull()
    expect(neighbourDays(b, '2026-11-15', '2026-11-15').next).toBeNull()
    expect(neighbourDays(b, '2026-11-16', '2026-11-15').next).toBeNull()
  })
  it('has no way back when nothing was ever entered', () => {
    expect(neighbourDays(budgetOf([]), '2026-11-15', '2026-11-15')).toEqual({ prev: null, next: null })
  })
})
