import { describe, expect, it } from 'vitest'
import { dayKey, modeLabel, monthKey, shiftMonth, suggestFor, summarise } from './budget'
import type { BudgetData } from './budget'

const cat = (id: string, limit: string | null = null, deletedAt: number | null = null) => ({ id, name: id, limit, deletedAt })
const exp = (id: string, date: string, amount: string, categoryId: string | null, deletedAt: number | null = null) => ({ id, date, amount, categoryId, mode: null, note: '', deletedAt })

const data: BudgetData = {
  overall: '10000',
  categories: [cat('food', '4000'), cat('rent', null), cat('gone', '500', 1)],
  expenses: [
    exp('1', '2026-11-02', '1500.10', 'food'),
    exp('2', '2026-11-05', '2600.20', 'food'),
    exp('3', '2026-11-05', '5000', 'rent'),
    exp('4', '2026-11-09', '300', 'gone'), // its category was deleted
    exp('5', '2026-11-10', '120', null), // never had one
    exp('6', '2026-11-11', '999', 'food', 5), // deleted entry
    exp('7', '2026-10-30', '777', 'food'), // another month
  ],
}

describe('summarise', () => {
  const s = summarise(data, '2026-11')
  it('adds exactly: 0.1 + 0.2 style sums do not drift', () => {
    expect(s.lines.find((l) => l.id === 'food')!.spent.toFixed(2)).toBe('4100.30')
  })
  it('counts only the month, and skips deleted entries', () => {
    expect(s.entries.map((e) => e.id)).toEqual(['5', '4', '2', '3', '1']) // same-day entries keep their stored order (newest added first)
    expect(s.spent.toFixed(2)).toBe('9520.30')
  })
  it('shows how far over a limit you are as a negative "left"', () => {
    const food = s.lines.find((l) => l.id === 'food')!
    expect(food.left!.toFixed(2)).toBe('-100.30')
    expect(food.pct).toBe(103)
  })
  it('a category with no limit has no left or percent', () => {
    const rent = s.lines.find((l) => l.id === 'rent')!
    expect(rent.limit).toBeNull()
    expect(rent.left).toBeNull()
    expect(rent.pct).toBeNull()
  })
  it('entries of a deleted category, and uncategorised ones, are shown as uncategorised, not dropped', () => {
    expect(s.uncategorised.toFixed(2)).toBe('420.00')
    expect(s.lines.some((l) => l.id === 'gone')).toBe(false)
  })
  it('the overall limit is measured against everything spent', () => {
    expect(s.overall!.left.toFixed(2)).toBe('479.70')
    expect(s.overall!.pct).toBe(95)
  })
  it('no overall limit gives none', () => {
    expect(summarise({ ...data, overall: null }, '2026-11').overall).toBeNull()
  })
  it('an empty month is all zeros', () => {
    const e = summarise(data, '2027-01')
    expect(e.spent.toFixed(2)).toBe('0.00')
    expect(e.entries).toEqual([])
  })
})

describe('months', () => {
  it('shifts across a year end both ways', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
  it('formats a date in local time', () => {
    expect(monthKey(new Date(2026, 10, 2))).toBe('2026-11')
    expect(dayKey(new Date(2026, 10, 2))).toBe('2026-11-02')
  })
})

describe('payment mode', () => {
  const m = (id: string, amount: string, mode: 'upi' | 'cash' | null, deletedAt: number | null = null, date = '2026-11-02', note = '') => ({ ...exp(id, date, amount, null, deletedAt), mode, note })
  const b: BudgetData = { overall: null, categories: [cat('food')], expenses: [m('1', '0.1', 'upi'), m('2', '0.2', 'upi'), m('3', '50', 'cash'), m('4', '999', 'upi', 5), m('5', '7', null), m('6', '9', 'cash', null, '2026-10-30')] }
  it('sums per mode exactly, skips deleted and other months', () => {
    const s = summarise(b, '2026-11')
    expect(s.byMode.map((x) => [x.id, x.label, x.spent.toString()])).toEqual([['cash', 'Cash', '50'], ['upi', 'UPI', '0.3']])
    expect(s.noMode.toString()).toBe('7')
  })
  it('modeLabel names a mode', () => expect(modeLabel('credit')).toBe('Credit card'))
  it('suggestFor matches the note ignoring case, newest date first, live entries only', () => {
    const x: BudgetData = {
      ...b,
      expenses: [
        { ...m('a', '1', 'cash', null, '2026-11-01', 'Swiggy'), categoryId: 'food' },
        { ...m('b', '1', 'upi', null, '2026-11-03', 'swiggy '), categoryId: 'food' },
        { ...m('c', '1', 'cash', 9, '2026-11-09', 'swiggy'), categoryId: 'food' },
      ],
    }
    expect(suggestFor(x, 'SWIGGY')).toEqual({ categoryId: 'food', mode: 'upi' })
    expect(suggestFor(x, 'swig')).toBeNull()
    expect(suggestFor(x, '  ')).toBeNull()
  })
})
