import { describe, expect, it } from 'vitest'
import { createAppStore } from './app'
import { defaultPersisted, sanitizeBudget } from './persistence'

let n = 0
let now = new Date(2026, 10, 2, 10).getTime()
function make() {
  const d = defaultPersisted()
  const store = createAppStore(d, { now: () => now, newId: () => `id-${++n}` })
  const get = () => store.getState()
  const food = get().addCategory('Food')!
  const travel = get().addCategory('Trip')!
  const add = (amount: string, date: string, categoryId: string | null = null) => {
    expect(get().addExpense({ amount, date, categoryId, mode: null, instrumentId: null, note: '' })).toBe(true)
    return get().budget.expenses[0]!.id
  }
  return { get, food, travel, add }
}

describe('bulk recategorise', () => {
  it('moves several entries in one step, and one Undo puts every one back', () => {
    const { get, food, travel, add } = make()
    const a = add('100', '2026-11-01', food)
    const b = add('200', '2026-11-01')
    const c = add('300', '2026-11-01', food)
    expect(get().recategorise([a, b, c], travel)).toBe(3)
    expect(get().budget.expenses.map((x) => x.categoryId)).toEqual([travel, travel, travel])
    expect(get().snack?.text).toBe('3 entries moved to Trip')
    get().undoRemoval()
    const cats = Object.fromEntries(get().budget.expenses.map((x) => [x.id, x.categoryId]))
    expect(cats).toEqual({ [a]: food, [b]: null, [c]: food })
    expect(get().budget.expenses.every((x) => x.edits === undefined)).toBe(true) // the trail went back with them
  })

  it('can move to Uncategorised', () => {
    const { get, food, add } = make()
    const a = add('100', '2026-11-01', food)
    expect(get().recategorise([a], null)).toBe(1)
    expect(get().budget.expenses[0]!.categoryId).toBeNull()
  })

  it('leaves card bills, transfers, deleted entries and entries already there alone', () => {
    const { get, food, travel, add } = make()
    const a = add('100', '2026-11-01', food)
    const already = add('100', '2026-11-01', travel)
    expect(get().addExpense({ amount: '50', date: '2026-11-01', categoryId: null, mode: null, instrumentId: null, note: '', settlement: 'transfer' })).toBe(true)
    const transfer = get().budget.expenses[0]!.id
    const gone = add('70', '2026-11-01', food)
    get().deleteExpense(gone)
    expect(get().recategorise([a, already, transfer, gone], travel)).toBe(1)
    expect(get().budget.expenses.find((x) => x.id === transfer)!.categoryId).toBeNull()
    expect(get().budget.expenses.find((x) => x.id === gone)!.categoryId).toBe(food)
  })

  it('skips an entry from a month the category is not used in, and says so', () => {
    const { get, food, add } = make()
    const may = get().addCategory('May only', null, ['2026-05'])!
    const a = add('100', '2026-11-01', food)
    expect(get().recategorise([a], may)).toBe(0)
    expect(get().notice?.text).toContain('not used')
    expect(get().budget.expenses[0]!.categoryId).toBe(food)
  })

  it('refuses a category that is gone', () => {
    const { get, food, travel, add } = make()
    const a = add('100', '2026-11-01', food)
    get().deleteCategory(travel)
    expect(get().recategorise([a], travel)).toBe(0)
    expect(get().budget.expenses[0]!.categoryId).toBe(food)
  })

  it('writes a category note into each entry\'s trail', () => {
    const { get, food, travel, add } = make()
    const a = add('100', '2026-11-01', food)
    get().recategorise([a], travel)
    expect(get().budget.expenses[0]!.edits).toEqual([{ at: now, field: 'category', from: food, to: travel }])
  })
})

describe('edit history through updateExpense', () => {
  it('notes a changed amount, date and category; an unchanged note changes nothing', () => {
    const { get, food, add } = make()
    const id = add('900', '2026-10-28', food)
    const base = { amount: '900', date: '2026-10-28', categoryId: food, mode: null, instrumentId: null, note: 'lunch' }
    expect(get().updateExpense(id, base)).toBe(true)
    expect(get().budget.expenses[0]!.edits).toBeUndefined()
    now += 1000
    expect(get().updateExpense(id, { ...base, amount: '950', date: '2026-10-29' })).toBe(true)
    expect(get().budget.expenses[0]!.edits!.map((x) => [x.field, x.from, x.to])).toEqual([['amount', '900', '950'], ['date', '2026-10-28', '2026-10-29']])
  })

  it('keeps 10 at most, and a failed save writes nothing', () => {
    const { get, food, add } = make()
    const id = add('1', '2026-11-01', food)
    for (let i = 2; i <= 16; i++) get().updateExpense(id, { amount: String(i), date: '2026-11-01', categoryId: food, mode: null, instrumentId: null, note: '' })
    const e = get().budget.expenses[0]!
    expect(e.edits).toHaveLength(10)
    expect(e.edits![9]!.to).toBe('16')
    expect(get().updateExpense(id, { amount: '0', date: '2026-11-01', categoryId: food, mode: null, instrumentId: null, note: '' })).toBe(false)
    expect(get().budget.expenses[0]!.edits).toHaveLength(10)
  })

  it('survives a save and a reload', () => {
    const { get, food, add } = make()
    const id = add('900', '2026-10-28', food)
    get().updateExpense(id, { amount: '950', date: '2026-10-28', categoryId: food, mode: null, instrumentId: null, note: '' })
    const back = sanitizeBudget(JSON.parse(JSON.stringify(get().budget)))
    expect(back.expenses[0]!.edits).toEqual(get().budget.expenses[0]!.edits)
  })
})
