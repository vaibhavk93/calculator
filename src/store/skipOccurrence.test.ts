import { describe, expect, it } from 'vitest'
import { createAppStore } from './app'
import { defaultPersisted } from './persistence'
import { starterBudget } from './types'
import { canSkip } from '../lib/reminders'
import { planNotifications } from '../lib/notifications'
import type { ExpenseDraft } from '../lib/budget'

const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).getTime()
const NOW = at(2026, 11, 10)
const money = (a: string) => `Rs ${a}`

function setup() {
  let t = NOW
  let n = 0
  const store = createAppStore({ ...defaultPersisted(), budget: starterBudget() }, { now: () => t, newId: () => `id${++n}` })
  return { store, get: store.getState, tick: (ms: number) => (t += ms) }
}
const task = (repeat: 'none' | 'monthly' | 'yearly', dueAt: number) => {
  const s = setup()
  const id = s.get().saveCard({ title: 'Rent', kind: 'task', toolId: null, inputs: null, summary: '', amount: null, lines: [], note: '', tags: [] }, { dueAt, repeat, leadDays: 0 })!
  return { ...s, rem: () => s.get().reminders.find((r) => r.cardId === id)! }
}

describe('skip one occurrence', () => {
  it('a monthly reminder moves to next month once, records no payment, and keeps repeating', () => {
    const { get, rem } = task('monthly', at(2026, 11, 15))
    expect(get().skipOccurrence(rem().id)).toBe(true)
    expect(rem().dueAt).toBe(at(2026, 12, 15))
    expect(rem().repeat).toBe('monthly')
    expect(rem().history).toEqual([])
    expect(rem().done).toBe(false)
    expect(get().snack).toMatchObject({ text: 'Skipped "Rent" this time. Next: 15 Dec 2026', canUndo: true })
    // the repeat carries on: skipping again moves one more month
    get().skipOccurrence(rem().id)
    expect(rem().dueAt).toBe(at(2027, 1, 15))
  })
  it('Undo puts the old date back exactly', () => {
    const { get, rem } = task('monthly', at(2026, 11, 15))
    const before = rem()
    get().skipOccurrence(rem().id)
    get().undoRemoval()
    expect(rem()).toEqual(before)
  })
  it('an overdue one jumps to the first date still ahead, not just one step', () => {
    const { get, rem } = task('monthly', at(2026, 8, 5)) // three months overdue
    get().skipOccurrence(rem().id)
    expect(rem().dueAt).toBe(at(2026, 12, 5))
  })
  it('keeps the day of the month: 31 Jan skips to 28 Feb, then back to 31 Mar', () => {
    const { get, rem } = task('monthly', at(2027, 1, 31))
    get().skipOccurrence(rem().id)
    expect(rem().dueAt).toBe(at(2027, 2, 28))
    get().skipOccurrence(rem().id)
    expect(rem().dueAt).toBe(at(2027, 3, 31))
  })
  it('a one-time reminder cannot be skipped and is left alone', () => {
    const { get, rem } = task('none', at(2026, 11, 15))
    expect(canSkip(rem())).toBe(false)
    expect(get().skipOccurrence(rem().id)).toBe(false)
    expect(rem().dueAt).toBe(at(2026, 11, 15))
    expect(get().snack).toBeNull()
  })
  it('an unknown or finished reminder is refused', () => {
    const { get, rem } = task('monthly', at(2026, 11, 15))
    expect(get().skipOccurrence('nope')).toBe(false)
    expect(canSkip({ ...rem(), done: true })).toBe(false)
  })
  it('the phone is told: the old alarm is replaced by one for the new date', () => {
    const { get, rem } = task('monthly', at(2026, 11, 15))
    const plan = () => planNotifications(get().reminders, get().cards, NOW, money)
    expect(plan().map((p) => p.at)).toEqual([at(2026, 11, 15)])
    get().skipOccurrence(rem().id)
    expect(plan().map((p) => p.at)).toEqual([at(2026, 12, 15)])
  })
  it('a bill: skipping adds no entry to the budget and keeps its payments left', () => {
    const { get } = setup()
    const draft: ExpenseDraft = { amount: '5000', categoryId: 'starter-bills', date: '2026-11-03', note: 'Car loan' }
    expect(get().addExpense(draft, 'monthly', 4)).toBe(true) // 3 left
    const bill = () => get().budget.recurring![0]!
    const rem = () => get().reminders[0]!
    const entries = get().budget.expenses.length
    const due = rem().dueAt
    expect(get().skipOccurrence(rem().id)).toBe(true)
    expect(get().budget.expenses).toHaveLength(entries)
    expect(bill().remaining).toBe(3)
    expect(rem().dueAt).toBeGreaterThan(due)
  })
})
