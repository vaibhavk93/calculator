import { describe, expect, it } from 'vitest'
import type { BudgetExpense, RecurringItem } from './budget'
import { looksMonthly } from './recurring'

const e = (date: string, amount: string, o: Partial<BudgetExpense> = {}): BudgetExpense => ({ id: `e-${date}`, date, amount, categoryId: null, mode: null, instrumentId: null, note: 'Netflix', deletedAt: null, ...o })
const b = (...expenses: BudgetExpense[]) => ({ expenses, recurring: [] as RecurringItem[] })
const draft = (date: string, amount = '199', note = 'Netflix') => ({ note, amount, date })

describe('looksMonthly: a quiet guess, from your own repeats', () => {
  it('3 entries about a month apart with the same amount: yes', () => {
    expect(looksMonthly(b(e('2026-09-05', '199'), e('2026-10-05', '199')), draft('2026-11-05'))).toEqual({ count: 3 })
  })
  it('month lengths and a day or two of drift are fine', () => {
    expect(looksMonthly(b(e('2026-08-31', '199'), e('2026-09-30', '199')), draft('2026-11-02'))).toEqual({ count: 3 })
  })
  it('similar amounts count (within 10%), very different ones do not', () => {
    expect(looksMonthly(b(e('2026-09-05', '199'), e('2026-10-05', '205')), draft('2026-11-05', '210'))).not.toBeNull()
    expect(looksMonthly(b(e('2026-09-05', '199'), e('2026-10-05', '999')), draft('2026-11-05', '199'))).toBeNull()
  })
  it('two entries are not enough', () => expect(looksMonthly(b(e('2026-10-05', '199')), draft('2026-11-05'))).toBeNull())
  it('three on random days are not monthly', () => {
    expect(looksMonthly(b(e('2026-10-01', '199'), e('2026-10-03', '199')), draft('2026-11-05'))).toBeNull()
    expect(looksMonthly(b(e('2026-06-05', '199'), e('2026-10-05', '199')), draft('2026-11-05'))).toBeNull()
  })
  it('a different note, a blank note, a refund or a deleted entry is not counted', () => {
    expect(looksMonthly(b(e('2026-09-05', '199', { note: 'Hotstar' }), e('2026-10-05', '199')), draft('2026-11-05'))).toBeNull()
    expect(looksMonthly(b(e('2026-09-05', '199'), e('2026-10-05', '199', { refund: true })), draft('2026-11-05'))).toBeNull()
    expect(looksMonthly(b(e('2026-09-05', '199'), e('2026-10-05', '199', { deletedAt: 5 })), draft('2026-11-05'))).toBeNull()
    expect(looksMonthly(b(e('2026-09-05', '199', { note: '' }), e('2026-10-05', '199', { note: '' })), draft('2026-11-05', '199', ''))).toBeNull()
  })
  it('never when they already belong to a bill, or a running bill has that name', () => {
    expect(looksMonthly(b(e('2026-09-05', '199', { recurringId: 'r' }), e('2026-10-05', '199', { recurringId: 'r' })), draft('2026-11-05'))).toBeNull()
    const bill = { id: 'r', kind: 'bill', title: 'netflix', amount: '199', repeat: 'monthly', categoryId: null, mode: null, instrumentId: null, cardId: null, deletedAt: null } as RecurringItem
    expect(looksMonthly({ expenses: [e('2026-09-05', '199'), e('2026-10-05', '199')], recurring: [bill] }, draft('2026-11-05'))).toBeNull()
  })
  it('editing one of the three does not count it twice', () => {
    const rows = [e('2026-09-05', '199'), e('2026-10-05', '199'), e('2026-11-05', '199')]
    expect(looksMonthly(b(...rows), draft('2026-11-05'), 'e-2026-11-05')).toEqual({ count: 3 })
    expect(looksMonthly(b(...rows.slice(0, 2)), draft('2026-10-05'), 'e-2026-10-05')).toBeNull()
  })
  it('an old habit that stopped is judged on the latest four only', () => {
    expect(looksMonthly(b(e('2025-01-05', '199'), e('2026-08-05', '199'), e('2026-09-05', '199'), e('2026-10-05', '199')), draft('2026-11-05'))).not.toBeNull()
  })
})
