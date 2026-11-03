import { describe, expect, it } from 'vitest'
import { paymentTree } from './paymentTree'
import { starterBudget, type BudgetData, type BudgetExpense, type PayInstrument } from './budget'

const inst = (o: Partial<PayInstrument>): PayInstrument => ({ id: 'i', name: 'HDFC', kind: 'bank', network: null, bank: 'HDFC Bank', last4: '1234', rewardNote: '', deletedAt: null, ...o }) as PayInstrument
const exp = (o: Partial<BudgetExpense>): BudgetExpense => ({ id: Math.random().toString(36), date: '2026-11-02', amount: '100', categoryId: null, mode: null, instrumentId: null, note: '', deletedAt: null, ...o }) as BudgetExpense
const base = (expenses: BudgetExpense[], instruments: PayInstrument[] = []): BudgetData => ({ ...starterBudget(), instruments, expenses })

describe('paymentTree', () => {
  const b = base(
    [
      exp({ mode: 'upi', amount: '500' }),
      exp({ mode: 'upi', amount: '200', instrumentId: 'bank1' }),
      exp({ mode: 'upi', amount: '50', instrumentId: 'dc1' }),
      exp({ mode: 'credit', amount: '1000', instrumentId: 'cc1' }),
      exp({ mode: 'credit', amount: '300', instrumentId: 'cc2' }),
      exp({ mode: 'cash', amount: '40' }),
      exp({ mode: null, amount: '10' }),
    ],
    [inst({ id: 'bank1', name: 'HDFC Savings' }), inst({ id: 'dc1', kind: 'debit', name: 'SBI Debit', last4: '9999' }), inst({ id: 'cc1', kind: 'credit', network: 'visa', name: 'Regalia', last4: '4321' }), inst({ id: 'cc2', kind: 'credit', name: 'Neu', last4: '1111' })],
  )
  const tree = paymentTree(b, '2026-11')
  it('orders modes by spend and totals each', () => {
    expect(tree.map((n) => [n.id, n.spent.toString(), n.count])).toEqual([['credit', '1300', 2], ['upi', '750', 3], ['cash', '40', 1], ['none', '10', 1]])
  })
  it('breaks UPI down by the source that paid, including the default bank account', () => {
    const upi = tree.find((n) => n.id === 'upi')!
    expect(upi.children.map((c) => [c.label, c.spent.toString()])).toEqual([[ 'Bank account (default)', '500'], ['HDFC Savings ••1234', '200'], ['SBI Debit ••9999', '50']])
    expect(upi.children[1]!.detail).toContain('Bank account')
    expect(upi.children[2]!.detail).toContain('Debit card')
  })
  it('breaks credit down per card with a filter that shows exactly its entries', () => {
    const cc = tree.find((n) => n.id === 'credit')!
    expect(cc.children[0]!.filter).toMatchObject({ modeId: 'credit', instrumentId: 'cc1' })
    expect(cc.children[0]!.detail).toContain('Visa')
  })
  it('cash and no-mode have no sub-types', () => {
    expect(tree.find((n) => n.id === 'cash')!.children).toEqual([])
    expect(tree.find((n) => n.id === 'none')!.children).toEqual([])
  })
  it('leaves out settlements, deleted entries and other months; refunds subtract', () => {
    const t = paymentTree(base([
      exp({ mode: 'credit', amount: '900', settlement: 'cardBill', instrumentId: 'cc1' }),
      exp({ mode: 'upi', amount: '100', deletedAt: 1 }),
      exp({ mode: 'upi', amount: '100', date: '2026-10-30' }),
      exp({ mode: 'upi', amount: '300' }),
      exp({ mode: 'upi', amount: '50', refund: true }),
    ], [inst({ id: 'cc1', kind: 'credit' })]), '2026-11')
    expect(t).toHaveLength(1)
    expect(t[0]!.spent.toString()).toBe('250')
    expect(t[0]!.count).toBe(2)
  })
  it('empty month gives an empty tree', () => {
    expect(paymentTree(base([]), '2026-11')).toEqual([])
  })
  it('respects a filter', () => {
    const t = paymentTree(b, '2026-11', { modeId: 'upi' })
    expect(t.map((n) => n.id)).toEqual(['upi'])
  })
})
