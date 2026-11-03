import { describe, expect, it } from 'vitest'
import { createAppStore } from './app'
import { defaultPersisted } from './persistence'
import type { HistoryEntry } from './types'

// B-05: Undo must reverse the LAST removal and nothing else.
let n = 0
function make() {
  const d = defaultPersisted()
  const history: HistoryEntry[] = [{ id: 'h1', expression: '1+1', result: '2', at: 1 }]
  const store = createAppStore({ ...d, history }, { now: () => 1_700_000_000_000, newId: () => `id-${++n}` })
  const get = () => store.getState()
  get().addExpense({ amount: '100', date: '2026-11-01', categoryId: null, mode: null, instrumentId: null, note: 'a' })
  const e = get().budget.expenses[0]!.id
  get().saveCard({ title: 'Note', kind: 'task', toolId: null, inputs: null, summary: '', amount: null, lines: [], note: '', tags: [] })
  return { get, e, c: get().cards[0]!.id }
}

describe('B-05 one thing to undo', () => {
  it('delete an expense, let the snackbar fade, delete a history row, Undo: the history row comes back, the expense stays deleted', () => {
    const { get, e } = make()
    get().deleteExpense(e)
    get().dismissSnack(get().snack!.id)
    get().deleteHistory('h1')
    get().undoRemoval()
    expect(get().history.map((h) => h.id)).toEqual(['h1'])
    expect(get().budget.expenses.find((x) => x.id === e)!.deletedAt).not.toBeNull()
  })

  it('delete an expense then a card, Undo: the card comes back, the expense stays deleted', () => {
    const { get, e, c } = make()
    get().deleteExpense(e)
    get().deleteCard(c)
    get().undoRemoval()
    expect(get().cards.find((x) => x.id === c)!.deletedAt).toBeNull()
    expect(get().budget.expenses.find((x) => x.id === e)!.deletedAt).not.toBeNull()
  })

  it('delete a card then an expense, Undo: the expense comes back, the card stays in Trash', () => {
    const { get, e, c } = make()
    get().deleteCard(c)
    get().deleteExpense(e)
    get().undoRemoval()
    expect(get().budget.expenses.find((x) => x.id === e)!.deletedAt).toBeNull()
    expect(get().cards.find((x) => x.id === c)!.deletedAt).not.toBeNull()
  })

  it('Undo with no snackbar showing does nothing', () => {
    const { get, e } = make()
    get().deleteExpense(e)
    get().dismissSnack(get().snack!.id)
    get().undoRemoval()
    expect(get().budget.expenses.find((x) => x.id === e)!.deletedAt).not.toBeNull()
  })
})

describe('B-27 old deleted entries leave the 20,000 cap', () => {
  it('an entry deleted more than 30 days ago is purged at start; a recent one is kept', () => {
    const now = 1_700_000_000_000
    const d = defaultPersisted()
    const e = (id: string, deletedAt: number | null) => ({ id, date: '2026-11-01', amount: '5', categoryId: null, mode: null, instrumentId: null, note: '', deletedAt })
    d.budget = { ...d.budget, expenses: [e('live', null), e('recent', now - 5 * 86_400_000), e('old', now - 40 * 86_400_000)] }
    const store = createAppStore(d, { now: () => now, newId: () => 'x' })
    expect(store.getState().budget.expenses.map((x) => x.id)).toEqual(['live', 'recent'])
  })
})
