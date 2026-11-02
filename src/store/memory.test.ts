import { describe, expect, it } from 'vitest'
import { createAppStore, type CardDraft } from './app'
import { defaultPersisted } from './persistence'

const DAY = 86_400_000
const T0 = new Date(2026, 10, 10, 9).getTime()

function setup(now = T0) {
  let t = now
  let n = 0
  const store = createAppStore(defaultPersisted(), { now: () => t, newId: () => `id${++n}` })
  return { store, get: store.getState, tick: (ms: number) => (t += ms) }
}
const draft = (over: Partial<CardDraft> = {}): CardDraft => ({ title: 'HDFC card', kind: 'tool', toolId: 'emi', inputs: { principal: '1000' }, summary: 'EMI ₹8,678', amount: '8678.23', lines: [], ...over })

describe('saving', () => {
  it('keeps the inputs, newest first, with no reminder unless asked', () => {
    const { store, get } = setup()
    store.getState().saveCard(draft())
    store.getState().saveCard(draft({ title: 'Second' }))
    expect(get().cards.map((c) => c.title)).toEqual(['Second', 'HDFC card'])
    expect(get().cards[1]!.inputs).toEqual({ principal: '1000' })
    expect(get().reminders).toEqual([])
  })

  it('saves a reminder with the card in one step, anchored to its day of month', () => {
    const { store, get } = setup()
    const due = new Date(2026, 11, 31, 9).getTime()
    const id = store.getState().saveCard(draft(), { dueAt: due, repeat: 'monthly', leadDays: 3 })
    expect(get().reminders).toEqual([{ id: 'id2', cardId: id, dueAt: due, repeat: 'monthly', anchorDay: 31, leadDays: 3, done: false, history: [] }])
  })

  it('updating a card edits it and can replace or remove its reminder', () => {
    const { store, get } = setup()
    const id = store.getState().saveCard(draft(), { dueAt: T0 + DAY, repeat: 'none', leadDays: 1 })!
    store.getState().updateCard(id, { note: 'paid via UPI' }, { dueAt: T0 + 2 * DAY, repeat: 'yearly', leadDays: 7 })
    expect(get().cards[0]!.note).toBe('paid via UPI')
    expect(get().reminders).toHaveLength(1)
    expect(get().reminders[0]).toMatchObject({ dueAt: T0 + 2 * DAY, repeat: 'yearly', leadDays: 7 })
    store.getState().updateCard(id, {}, null)
    expect(get().reminders).toEqual([])
  })
})

describe('pinning', () => {
  it('allows 5, refuses a 6th with a plain message', () => {
    const { store, get } = setup()
    const ids = Array.from({ length: 6 }, (_, i) => store.getState().saveCard(draft({ title: `c${i}` }))!)
    for (const id of ids) store.getState().togglePin(id)
    expect(get().cards.filter((c) => c.pinned)).toHaveLength(5)
    expect(get().notice?.text).toMatch(/up to 5/)
  })
})

describe('delete, undo and trash', () => {
  it('delete moves to Trash with an Undo, and Undo brings it back', () => {
    const { store, get } = setup()
    const id = store.getState().saveCard(draft())!
    store.getState().deleteCard(id)
    expect(get().cards[0]!.deletedAt).toBe(T0)
    expect(get().snack?.canUndo).toBe(true)
    store.getState().undoRemoval()
    expect(get().cards[0]!.deletedAt).toBeNull()
  })

  it('emptying the Trash removes trashed cards and their reminders, and keeps the rest', () => {
    const { store, get } = setup()
    const keep = store.getState().saveCard(draft({ title: 'keep' }), { dueAt: T0, repeat: 'none', leadDays: 0 })!
    const gone = store.getState().saveCard(draft({ title: 'gone' }), { dueAt: T0, repeat: 'none', leadDays: 0 })!
    store.getState().deleteCard(gone)
    store.getState().emptyTrash()
    expect(get().cards.map((c) => c.id)).toEqual([keep])
    expect(get().reminders.map((r) => r.cardId)).toEqual([keep])
  })

  it('cards older than 7 days in Trash are gone at start-up; younger ones survive', () => {
    const base = defaultPersisted()
    const card = (id: string, deletedAt: number | null) => ({ ...draft({ title: id }), id, note: '', tags: [], pinned: false, createdAt: 0, updatedAt: 0, deletedAt })
    const store = createAppStore({ ...base, cards: [card('old', T0 - 8 * DAY), card('new', T0 - 6 * DAY), card('live', null)] }, { now: () => T0, newId: () => 'x' })
    expect(store.getState().cards.map((c) => c.id)).toEqual(['new', 'live'])
  })
})

describe('mark paid, snooze', () => {
  it('a recurring reminder moves to the next month and logs the payment', () => {
    const { store, get, tick } = setup()
    store.getState().saveCard(draft(), { dueAt: new Date(2026, 10, 5, 9).getTime(), repeat: 'monthly', leadDays: 3 })
    tick(DAY)
    store.getState().markPaid(get().reminders[0]!.id)
    const r = get().reminders[0]!
    expect(new Date(r.dueAt).getMonth()).toBe(11)
    expect(r.done).toBe(false)
    expect(r.history).toEqual([{ paidAt: T0 + DAY, amount: '8678.23' }])
  })

  it('a one-time reminder is finished once paid', () => {
    const { store, get } = setup()
    store.getState().saveCard(draft(), { dueAt: T0, repeat: 'none', leadDays: 0 })
    store.getState().markPaid(get().reminders[0]!.id)
    expect(get().reminders[0]!.done).toBe(true)
  })

  it('snooze pushes an overdue reminder to one day from now, not one day from its old date', () => {
    const { store, get } = setup()
    store.getState().saveCard(draft(), { dueAt: T0 - 5 * DAY, repeat: 'none', leadDays: 0 })
    store.getState().snooze(get().reminders[0]!.id, 1)
    expect(get().reminders[0]!.dueAt).toBe(T0 + DAY)
  })
})

describe('backup round trip', () => {
  it('snapshot -> restore keeps cards and reminders', () => {
    const a = setup()
    a.store.getState().saveCard(draft(), { dueAt: T0 + DAY, repeat: 'monthly', leadDays: 3 })
    const b = setup()
    b.store.getState().restore(a.get().snapshot())
    expect(b.get().cards).toEqual(a.get().cards)
    expect(b.get().reminders).toEqual(a.get().reminders)
  })
})

describe('taking a number to a list', () => {
  const idsOf = () => {
    const ctx = setup()
    return ctx
  }
  it('1,000 sent to a new list as 5 lines gives a checklist of 5 friends worth 5,000', () => {
    const { store, get } = idsOf()
    const id = store.getState().addToList({ title: 'Trip split' }, '1000', 5, 'Friend', true)!
    const card = get().cards.find((c) => c.id === id)!
    expect(card.kind).toBe('tape')
    expect(card.checklist).toBe(true)
    expect(card.lines.map((l) => l.label)).toEqual(['Friend 1', 'Friend 2', 'Friend 3', 'Friend 4', 'Friend 5'])
    expect(card.amount).toBe('5000')
    expect(card.summary).toBe('0 of 5 done, ₹5,000.00 left')
  })

  it('ticking lines updates the summary, and unticking puts the money back', () => {
    const { store, get } = idsOf()
    const id = store.getState().addToList({ title: 'Split' }, '1000', 3, '', true)!
    const [a, b] = get().cards[0]!.lines
    store.getState().toggleLine(id, a!.id)
    store.getState().toggleLine(id, b!.id)
    expect(get().cards[0]!.summary).toBe('2 of 3 done, ₹1,000.00 left')
    store.getState().toggleLine(id, b!.id)
    expect(get().cards[0]!.summary).toBe('1 of 3 done, ₹2,000.00 left')
    expect(get().cards[0]!.lines.filter((l) => l.done)).toHaveLength(1)
  })

  it('adds to an existing list and keeps its total right; a missing list returns null', () => {
    const { store, get } = idsOf()
    const id = store.getState().addToList({ title: 'Groceries' }, '250')!
    store.getState().addToList({ cardId: id }, '120.50', 1, 'Milk')
    expect(get().cards[0]!.amount).toBe('370.5')
    expect(get().cards[0]!.lines).toHaveLength(2)
    expect(store.getState().addToList({ cardId: 'nope' }, '5')).toBeNull()
  })

  it('will not add to a trashed list or to a calculator card', () => {
    const { store, get } = idsOf()
    const tool = store.getState().saveCard({ title: 'EMI', kind: 'tool', toolId: 'emi', inputs: {}, summary: '', amount: '1', lines: [] })!
    expect(store.getState().addToList({ cardId: tool }, '5')).toBeNull()
    const list = store.getState().addToList({ title: 'L' }, '5')!
    store.getState().deleteCard(list)
    expect(store.getState().addToList({ cardId: list }, '5')).toBeNull()
    expect(get().cards.find((c) => c.id === list)!.lines).toHaveLength(1)
  })

  it('a list with a checkbox flag survives save and restore', () => {
    const a = idsOf()
    a.store.getState().addToList({ title: 'Split' }, '10', 2, 'P', true)
    a.store.getState().toggleLine(a.get().cards[0]!.id, a.get().cards[0]!.lines[0]!.id)
    const b = idsOf()
    b.store.getState().restore(a.get().snapshot())
    expect(b.get().cards[0]!.checklist).toBe(true)
    expect(b.get().cards[0]!.lines[0]!.done).toBe(true)
  })
})
