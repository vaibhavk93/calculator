import { describe, expect, it, vi } from 'vitest'
import { createMemoryStorage } from '../lib/storage'
import { buildBackup, parseBackup } from './backup'
import { bootStore } from './boot'
import { createAppStore } from './app'
import { STORAGE_KEY, defaultPersisted, loadPersisted, sanitizeBudget } from './persistence'
import { monthFlow, spentIn } from '../lib/budget'

let n = 0
const make = () => {
  const store = createAppStore(defaultPersisted(), { now: () => 1_700_000_000_000, newId: () => `inc-${++n}` })
  return { get: () => store.getState() }
}
const draft = (over = {}) => ({ amount: '90000', categoryId: null, date: '2026-11-01', note: 'Salary', income: true, ...over })

describe('saving money in (the store)', () => {
  it('keeps income with no category, mode or card, even if the draft sends them', () => {
    const { get } = make()
    const food = get().budget.categories[0]!.id
    const cc = get().addInstrument({ name: 'Neo', kind: 'credit', network: 'rupay' })!
    expect(get().addExpense(draft({ categoryId: food, mode: 'credit', instrumentId: cc }))).toBe(true)
    expect(get().budget.expenses[0]).toMatchObject({ income: true, categoryId: null, mode: null, instrumentId: null, note: 'Salary' })
    expect(get().budget.expenses[0]).not.toHaveProperty('settlement')
    expect(get().budget.expenses[0]).not.toHaveProperty('refund')
  })

  it('income never starts a repeating bill', () => {
    const { get } = make()
    expect(get().addExpense(draft(), 'monthly')).toBe(true)
    expect(get().budget.expenses[0]!.recurringId).toBeUndefined()
    expect(get().budget.recurring ?? []).toEqual([])
  })

  it('a settlement or a refund wins over income in the same draft (one kind only)', () => {
    const { get } = make()
    const cc = get().addInstrument({ name: 'Neo', kind: 'credit', network: 'rupay' })!
    get().addExpense(draft({ settlement: 'cardBill', instrumentId: cc }))
    expect(get().budget.expenses[0]).toMatchObject({ settlement: 'cardBill' })
    expect(get().budget.expenses[0]).not.toHaveProperty('income')
    get().addExpense(draft({ refund: true }))
    expect(get().budget.expenses[0]).toMatchObject({ refund: true })
    expect(get().budget.expenses[0]).not.toHaveProperty('income')
  })

  it('money in must still be a positive amount on a real date', () => {
    const { get } = make()
    expect(get().addExpense(draft({ amount: '0' }))).toBe(false)
    expect(get().addExpense(draft({ date: 'nope' }))).toBe(false)
    expect(get().budget.expenses).toEqual([])
  })

  it('an edit can turn spending into money in and back, and the flag follows', () => {
    const { get } = make()
    get().addExpense(draft({ income: false, note: 'Tea', mode: 'cash' }))
    const id = get().budget.expenses[0]!.id
    get().updateExpense(id, draft({ note: 'Tea' }))
    expect(get().budget.expenses[0]).toMatchObject({ income: true, mode: null })
    get().updateExpense(id, draft({ income: false, note: 'Tea', mode: 'cash' }))
    expect(get().budget.expenses[0]).not.toHaveProperty('income')
    expect(get().budget.expenses[0]!.mode).toBe('cash')
  })

  it('editing money in keeps it money in, and the amount edit is on the trail', () => {
    const { get } = make()
    get().addExpense(draft())
    const id = get().budget.expenses[0]!.id
    get().updateExpense(id, draft({ amount: '95000' }))
    expect(get().budget.expenses[0]).toMatchObject({ income: true, amount: '95000' })
    expect(get().budget.expenses[0]!.edits?.length).toBe(1)
  })

  it('delete then Undo brings the income back with its flag', () => {
    const { get } = make()
    get().addExpense(draft())
    const id = get().budget.expenses[0]!.id
    get().deleteExpense(id)
    expect(get().budget.expenses[0]!.deletedAt).not.toBeNull()
    get().undoRemoval()
    expect(get().budget.expenses[0]).toMatchObject({ id, income: true, deletedAt: null })
  })

  it('recategorise skips money in (it has no category)', () => {
    const { get } = make()
    const food = get().budget.categories[0]!.id
    get().addExpense(draft())
    const id = get().budget.expenses[0]!.id
    expect(get().recategorise([id], food)).toBe(0)
    expect(get().budget.expenses[0]!.categoryId).toBeNull()
  })

  it('adding income changes neither the month spent nor Spending totals, only monthFlow', () => {
    const { get } = make()
    get().addExpense(draft({ income: false, amount: '300', note: 'Lunch', mode: 'cash' }))
    const spent = spentIn(get().budget, '2026-11').toFixed()
    get().addExpense(draft())
    expect(spentIn(get().budget, '2026-11').toFixed()).toBe(spent)
    expect(monthFlow(get().budget, '2026-11')).toEqual({ cameIn: '90000', spent: '300', kept: '89700', keptPercent: 100 })
  })
})

describe('income survives loading, restarting and backups (sanitizeBudget)', () => {
  const base = { overall: null, categories: [], instruments: [] }
  const one = (over: object) => sanitizeBudget({ ...base, expenses: [{ id: 'e1', date: '2026-11-01', amount: '100', note: 'Salary', ...over }] }).expenses[0]!

  it('keeps income: true', () => {
    expect(one({ income: true })).toMatchObject({ income: true, categoryId: null, mode: null, instrumentId: null })
  })
  it('drops any value that is not exactly true', () => {
    for (const v of [false, 'true', 1, 'yes', null, {}, [], 0]) expect(one({ income: v })).not.toHaveProperty('income')
  })
  it('income with a settlement keeps only the settlement; with a refund keeps only the refund', () => {
    expect(one({ income: true, settlement: 'transfer' })).toMatchObject({ settlement: 'transfer' })
    expect(one({ income: true, settlement: 'transfer' })).not.toHaveProperty('income')
    expect(one({ income: true, refund: true })).toMatchObject({ refund: true })
    expect(one({ income: true, refund: true })).not.toHaveProperty('income')
    expect(one({ income: true, refund: true, settlement: 'cardBill' })).not.toHaveProperty('refund')
  })
  it('strips a category, mode, card and bill link that a damaged file attached to income', () => {
    const b = sanitizeBudget({
      overall: null,
      categories: [{ id: 'food', name: 'Food', limit: null, deletedAt: null }],
      instruments: [{ id: 'cc', name: 'HDFC', kind: 'credit', network: 'visa' }],
      expenses: [{ id: 'e1', date: '2026-11-01', amount: '100', income: true, categoryId: 'food', mode: 'credit', instrumentId: 'cc', recurringId: 'r1' }],
    })
    expect(b.expenses[0]).toMatchObject({ income: true, categoryId: null, mode: null, instrumentId: null })
    expect(b.expenses[0]).not.toHaveProperty('recurringId')
  })
  it('is stable: sanitising twice, and through JSON, changes nothing', () => {
    const b = sanitizeBudget({ ...base, expenses: [{ id: 'e1', date: '2026-11-01', amount: '100', note: 'Salary', income: true, deletedAt: null }] })
    expect(sanitizeBudget(JSON.parse(JSON.stringify(b)))).toEqual(b)
    expect(sanitizeBudget(b)).toEqual(b)
  })

  it('reload: stored income is still income after a restart', async () => {
    vi.useFakeTimers()
    try {
      const storage = createMemoryStorage()
      const first = await bootStore(storage)
      first.store.getState().addExpense(draft())
      await vi.advanceTimersByTimeAsync(500)
      expect(storage.dump()[STORAGE_KEY]).toBeDefined()
      const back = await loadPersisted(storage)
      expect(back.budget.expenses[0]).toMatchObject({ income: true, note: 'Salary', amount: '90000' })
      const second = await bootStore(storage)
      expect(second.store.getState().budget.expenses[0]).toMatchObject({ income: true })
    } finally {
      vi.useRealTimers()
    }
  })

  it('backup export then restore keeps income', async () => {
    vi.useFakeTimers()
    try {
      const src = await bootStore(createMemoryStorage())
      src.store.getState().addExpense(draft())
      src.store.getState().addExpense(draft({ income: false, amount: '300', note: 'Lunch', mode: 'cash' }))
      const text = buildBackup(src.store.getState().snapshot())
      const p = parseBackup(text)
      if (!p.ok) throw new Error(p.message)
      const dst = await bootStore(createMemoryStorage())
      dst.store.getState().restore(p.data)
      const kinds = dst.store.getState().budget.expenses.map((e) => [e.note, e.income === true])
      expect(kinds).toContainEqual(['Salary', true])
      expect(kinds).toContainEqual(['Lunch', false])
      expect(monthFlow(dst.store.getState().budget, '2026-11').cameIn).toBe('90000')
    } finally {
      vi.useRealTimers()
    }
  })
})
