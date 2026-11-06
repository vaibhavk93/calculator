import { describe, expect, it } from 'vitest'
import { D } from '../engine'
import {
  cardCostIn, cardOutstanding, categoryTotal, compareLastMonth, countsAsSpend, dailyTotals, entriesIn, monthFlow, recentCategoryIds, searchEntries, spentIn, suggestFor, summarise,
  topEntries, trend, validateExpense,
  type BudgetData, type BudgetExpense,
} from './budget'
import { buildExpensesCsv } from './csv'
import { paymentTree } from './paymentTree'
import { looksMonthly } from './recurring'

const e = (id: string, date: string, amount: string, o: Partial<BudgetExpense> = {}): BudgetExpense => ({ id, date, amount, categoryId: null, mode: null, instrumentId: null, note: '', deletedAt: null, ...o })
const income = (id: string, date: string, amount: string, note = 'Salary', o: Partial<BudgetExpense> = {}) => e(id, date, amount, { note, income: true, ...o })
const cat = (id: string, parentId: string | null = null) => ({ id, name: id, limit: null, parentId, deletedAt: null })
const card = { id: 'cc', name: 'HDFC', kind: 'credit' as const, network: 'visa' as const, bank: 'HDFC', last4: '1234', rewardNote: '', deletedAt: null }

/** A month with every kind of entry that already exists: spending (cash, UPI, card), a refund, a card bill, a transfer. */
const seeded = (): BudgetData => ({
  overall: '50000',
  categories: [cat('food'), cat('fees'), cat('rent')],
  instruments: [card],
  expenses: [
    e('1', '2026-11-02', '1500.10', { categoryId: 'food', mode: 'cash', note: 'Swiggy' }),
    e('2', '2026-11-05', '2600.20', { categoryId: 'food', mode: 'credit', instrumentId: 'cc', note: 'Dinner' }),
    e('3', '2026-11-05', '5000', { categoryId: 'rent', mode: 'upi', note: 'Rent' }),
    e('4', '2026-11-07', '400', { categoryId: 'food', mode: 'credit', instrumentId: 'cc', refund: true, note: 'Returned' }),
    e('5', '2026-11-08', '1000', { settlement: 'cardBill', instrumentId: 'cc', note: 'HDFC bill' }),
    e('6', '2026-11-09', '3000', { settlement: 'transfer', note: 'To savings' }),
    e('7', '2026-11-10', '90', { categoryId: 'fees', mode: 'credit', instrumentId: 'cc', note: 'Late fee' }),
    e('8', '2026-10-30', '777', { categoryId: 'food', note: 'Swiggy' }),
  ],
})

/** Everything a spend total can say, as plain text (the `entries` list is checked separately: it lists every entry). */
function totals(b: BudgetData) {
  const s = summarise(b, '2026-11')
  const { entries: _entries, ...rest } = s
  return JSON.stringify({
    rest,
    cycle: summarise(b, '2026-11', { cycleDay: 20 }).spent,
    spent: spentIn(b, '2026-11'),
    spentTo5: spentIn(b, '2026-11', {}, 5),
    credit: spentIn(b, '2026-11', { modeId: 'credit' }),
    trend: trend(b, '2026-11', 3),
    compare: compareLastMonth(b, '2026-11', new Date(2026, 10, 20)),
    daily: dailyTotals(b, '2026-11'),
    owed: cardOutstanding(b, 'cc'),
    cost: cardCostIn(b, card, 2026, (v) => v.toFixed(2)),
    catTotal: ['food', 'rent', 'fees'].map((c) => categoryTotal(b, c)),
    top: topEntries(entriesIn(b, '2026-11'), 10).map((x) => x.id),
    recent: recentCategoryIds(b, 5, '2026-11'),
    tree: paymentTree(b, '2026-11'),
    suggest: ['Swiggy', 'Dinner', 'Rent', 'Salary', 'Gift'].map((n) => suggestFor(b, n)),
  })
}

describe('countsAsSpend', () => {
  it('is true only for plain spending and refunds', () => {
    expect(countsAsSpend(e('a', '2026-11-01', '1'))).toBe(true)
    expect(countsAsSpend(e('a', '2026-11-01', '1', { refund: true }))).toBe(true)
    expect(countsAsSpend(e('a', '2026-11-01', '1', { settlement: 'transfer' }))).toBe(false)
    expect(countsAsSpend(e('a', '2026-11-01', '1', { settlement: 'cardBill' }))).toBe(false)
    expect(countsAsSpend(income('a', '2026-11-01', '1'))).toBe(false)
  })
})

describe('money in changes no spend total (the leak guard)', () => {
  it('adding income entries to a seeded month leaves every existing total identical', () => {
    const before = seeded()
    const base = totals(before)
    const withIncome: BudgetData = {
      ...before,
      expenses: [
        income('i1', '2026-11-01', '90000'),
        income('i2', '2026-11-05', '250', 'Swiggy'), // same note as a spend: must not feed its suggestion
        income('i3', '2026-11-05', '5000', 'Rent', { mode: 'credit', instrumentId: 'cc', categoryId: 'rent' }), // damaged: still not a charge on the card
        income('i4', '2026-10-31', '10', 'Salary'),
        ...before.expenses,
      ],
    }
    const after = totals(withIncome)
    const strip = (t: string) => JSON.parse(t)
    expect(strip(after)).toEqual(strip(base))
  })

  it('the entries list still shows the income, in date order, with the spending', () => {
    const b: BudgetData = { ...seeded(), expenses: [income('i1', '2026-11-06', '500'), ...seeded().expenses] }
    expect(summarise(b, '2026-11').entries.map((x) => x.id)).toContain('i1')
  })

  it('a damaged income entry with a card does not raise what the card owes', () => {
    const b = seeded()
    const owed = cardOutstanding(b, 'cc')
    b.expenses.unshift(income('i', '2026-11-11', '9999', 'Salary', { mode: 'upi', instrumentId: 'cc' }))
    expect(cardOutstanding(b, 'cc').eq(owed)).toBe(true)
  })

  it('topEntries leaves out income, even the biggest', () => {
    const b: BudgetData = { ...seeded(), expenses: [income('i', '2026-11-01', '999999'), ...seeded().expenses] }
    expect(topEntries(entriesIn(b, '2026-11'), 3).map((x) => x.id)).toEqual(['3', '2', '1'])
  })

  it('income does not suggest a category, and spending notes are not suggested from it', () => {
    const b: BudgetData = { ...seeded(), expenses: [income('i', '2026-11-12', '100', 'Rent'), ...seeded().expenses] }
    expect(suggestFor(b, 'Salary')).toBeNull() // only income has this note
    expect(suggestFor(b, 'Rent')).toMatchObject({ categoryId: 'rent', mode: 'upi' }) // the newer income entry does not win
  })

  it('income never feeds the "make it a monthly bill" guess, either way', () => {
    const salary = (d: string) => income(`s${d}`, d, '90000', 'Salary')
    const b = { expenses: [salary('2026-09-01'), salary('2026-10-01'), salary('2026-08-01')], recurring: [] }
    expect(looksMonthly(b, { note: 'Salary', amount: '90000', date: '2026-11-01' })).toBeNull()
    // A spending entry with the same note and day pattern is still guessed: the guard is about the kind, not the word.
    const spend = (d: string) => e(`p${d}`, d, '90000', { note: 'Salary' })
    expect(looksMonthly({ expenses: [spend('2026-09-01'), spend('2026-10-01')], recurring: [] }, { note: 'Salary', amount: '90000', date: '2026-11-01' })).toEqual({ count: 3 })
    // Mixed: two income and one spend are not three repeats.
    expect(looksMonthly({ expenses: [salary('2026-09-01'), salary('2026-10-01')], recurring: [] }, { note: 'Salary', amount: '90000', date: '2026-11-01' })).toBeNull()
  })

  it('validateExpense accepts money in with no category and no payment mode', () => {
    const b = seeded()
    expect(validateExpense({ amount: '500', date: '2026-11-01', categoryId: null, mode: null, instrumentId: null, income: true }, b, new Date(2026, 10, 20))).toEqual({})
    // A bad mode and card pairing is ignored for money in (it is thrown away on save), but still an error for spending.
    expect(validateExpense({ amount: '500', date: '2026-11-01', categoryId: null, mode: 'cash', instrumentId: 'cc', income: true }, b, new Date(2026, 10, 20))).toEqual({})
    expect(validateExpense({ amount: '500', date: '2026-11-01', categoryId: null, mode: 'cash', instrumentId: 'cc' }, b, new Date(2026, 10, 20)).paidWith).toBeDefined()
    expect(validateExpense({ amount: '0', date: '2026-11-01', categoryId: null, mode: null, instrumentId: null, income: true }, b, new Date(2026, 10, 20)).amount).toBeDefined()
  })

  it('search finds income by "money in" or "salary"', () => {
    const b: BudgetData = { ...seeded(), expenses: [income('i', '2026-11-12', '100', 'Salary'), ...seeded().expenses] }
    expect(searchEntries(b, b.expenses, 'salary').map((x) => x.id)).toEqual(['i'])
    expect(searchEntries(b, b.expenses, 'money in').map((x) => x.id)).toEqual(['i'])
  })
})

describe('monthFlow', () => {
  const flow = (expenses: BudgetExpense[], month = '2026-11') => monthFlow({ overall: null, categories: [cat('food')], instruments: [card], expenses }, month)

  it('came in, spent, kept and the percent kept', () => {
    expect(flow([income('i', '2026-11-01', '100000'), e('a', '2026-11-03', '60000', { categoryId: 'food' })])).toEqual({ cameIn: '100000', spent: '60000', kept: '40000', keptPercent: 40 })
  })
  it('a refund lowers spending, so it raises what was kept', () => {
    expect(flow([income('i', '2026-11-01', '1000'), e('a', '2026-11-03', '600'), e('r', '2026-11-04', '100', { refund: true })])).toEqual({ cameIn: '1000', spent: '500', kept: '500', keptPercent: 50 })
  })
  it('transfers and card bills are on neither side', () => {
    const r = flow([income('i', '2026-11-01', '1000'), e('a', '2026-11-03', '300'), e('t', '2026-11-04', '5000', { settlement: 'transfer' }), e('c', '2026-11-05', '7000', { settlement: 'cardBill', instrumentId: 'cc' })])
    expect(r).toEqual({ cameIn: '1000', spent: '300', kept: '700', keptPercent: 70 })
  })
  it('spending more than came in has no percentage and a negative kept', () => {
    expect(flow([income('i', '2026-11-01', '1000'), e('a', '2026-11-03', '1500')])).toEqual({ cameIn: '1000', spent: '1500', kept: '-500', keptPercent: null })
  })
  it('spending exactly what came in keeps 0%', () => {
    expect(flow([income('i', '2026-11-01', '1000'), e('a', '2026-11-03', '1000')]).keptPercent).toBe(0)
  })
  it('nothing came in: no percentage, even with spending', () => {
    expect(flow([e('a', '2026-11-03', '1500')])).toEqual({ cameIn: '0', spent: '1500', kept: '-1500', keptPercent: null })
  })
  it('a month with only income keeps all of it', () => {
    expect(flow([income('i', '2026-11-01', '1000')])).toEqual({ cameIn: '1000', spent: '0', kept: '1000', keptPercent: 100 })
  })
  it('an empty month is all zero and has no percentage', () => {
    expect(flow([])).toEqual({ cameIn: '0', spent: '0', kept: '0', keptPercent: null })
  })
  it('rounds the percentage to a whole number, sums exactly', () => {
    const r = flow([income('i', '2026-11-01', '300.10'), e('a', '2026-11-03', '100.05')])
    expect(r.kept).toBe('200.05')
    expect(r.keptPercent).toBe(67) // 66.6...
    expect(flow([income('i', '2026-11-01', '0.3'), e('a', '2026-11-03', '0.1')]).kept).toBe('0.2') // no 0.1+0.2 drift
  })
  it('uses calendar months: another month, a deleted entry, and a card cycle are not mixed in', () => {
    const r = flow([income('i', '2026-11-01', '1000'), income('o', '2026-10-31', '5000'), income('d', '2026-11-02', '7000', 'Salary', { deletedAt: 5 }), e('a', '2026-11-30', '100'), e('b', '2026-12-01', '9999')])
    expect(r).toEqual({ cameIn: '1000', spent: '100', kept: '900', keptPercent: 90 })
  })
  it('never returns a negative percentage', () => {
    for (const spend of ['0', '1', '999', '1000', '1001', '100000']) {
      const p = flow([income('i', '2026-11-01', '1000'), e('a', '2026-11-03', spend)]).keptPercent
      expect(p === null || p >= 0).toBe(true)
    }
  })
  it('returns money as strings the engine can read back', () => {
    const r = flow([income('i', '2026-11-01', '1234.5')])
    expect(new D(r.cameIn).eq('1234.5')).toBe(true)
  })
})

describe('CSV: money in cannot be mistaken for spending', () => {
  const b: BudgetData = { overall: null, categories: [cat('food')], instruments: [card], expenses: [e('a', '2026-11-03', '300', { categoryId: 'food', note: 'Lunch' }), income('i', '2026-11-01', '90000', 'Salary', { categoryId: 'food' }), e('r', '2026-11-04', '50', { refund: true, categoryId: 'food' })] }
  const rows = buildExpensesCsv(b, 'month', new Date(2026, 10, 15)).trim().split('\r\n').slice(1).map((l) => l.split(','))

  it('income is a negative amount with the type "income" and no category', () => {
    const row = rows.find((r) => r[5] === 'Salary')!
    expect(row[1]).toBe('-90000')
    expect(row[2]).toBe('')
    expect(row[6]).toBe('income')
  })
  it('summing the Amount column gives spending minus refunds minus income, never spending plus income', () => {
    const sum = rows.reduce((t, r) => t.plus(r[1]!), new D(0))
    expect(sum.toFixed()).toBe('-89750')
  })
  it('a formula in the income note is still defused', () => {
    const risky: BudgetData = { ...b, expenses: [income('i', '2026-11-01', '5', '=HYPERLINK("x")')] }
    expect(buildExpensesCsv(risky, 'month', new Date(2026, 10, 15))).toContain(`"'=HYPERLINK(""x"")"`)
  })
})
