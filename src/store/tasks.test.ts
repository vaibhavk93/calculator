import { describe, expect, it } from 'vitest'
import { groupTasks, taskItems } from '../lib/tasks'
import { buildBackup, parseBackup } from './backup'
import { createAppStore } from './app'
import { MAX_CARDS } from './types'
import { defaultPersisted, migrate, sanitizeCards } from './persistence'

const DAY = 86_400_000
const T0 = new Date(2026, 10, 10, 9).getTime()
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9).getTime()

function setup(now = T0) {
  let t = now
  let n = 0
  const store = createAppStore(defaultPersisted(), { now: () => t, newId: () => `id${++n}` })
  return { store, get: store.getState, tick: (ms: number) => (t += ms) }
}
type Ctx = ReturnType<typeof setup>
const task = (c: Ctx, title: string, due?: { dueAt: number; repeat?: 'none' | 'monthly' | 'quarterly' | 'yearly' }) =>
  c.store.getState().saveCard(
    { title, kind: 'task', toolId: null, inputs: null, summary: '', amount: null, lines: [] },
    due ? { dueAt: due.dueAt, repeat: due.repeat ?? 'none', leadDays: 0 } : null,
  )!

describe('creating tasks', () => {
  it('a task is a card of kind task, undated tasks have no reminder, dated ones have an ordinary one', () => {
    const c = setup()
    const a = task(c, 'Inbox thing')
    const b = task(c, 'Pay rent', { dueAt: at(2026, 11, 12) })
    expect(c.get().cards.find((x) => x.id === a)).toMatchObject({ kind: 'task', toolId: null, amount: null, lines: [], pinned: false, deletedAt: null })
    expect(c.get().reminders.map((r) => r.cardId)).toEqual([b])
    expect(c.get().reminders[0]).toMatchObject({ dueAt: at(2026, 11, 12), repeat: 'none', leadDays: 0, done: false })
  })
  it('shares the 500 card cap and says so in words', () => {
    const c = setup()
    for (let i = 0; i < MAX_CARDS; i++) c.store.getState().saveCard({ title: `n${i}`, kind: 'tape', toolId: null, inputs: null, summary: '', amount: null, lines: [] })
    expect(c.store.getState().saveCard({ title: 'one more', kind: 'task', toolId: null, inputs: null, summary: '', amount: null, lines: [] })).toBeNull()
    expect(c.get().notice?.text).toBe('You can keep up to 500 notes and tasks. Delete some first.')
    expect(c.get().cards).toHaveLength(MAX_CARDS)
  })
})

describe('completing, undo', () => {
  it('ticking a one-time task finishes it and its reminder; Undo puts both back', () => {
    const c = setup()
    const id = task(c, 'Pay rent', { dueAt: T0 })
    expect(c.get().setTaskDone(id, true)).toBe(true)
    expect(c.get().cards[0]).toMatchObject({ done: true, doneAt: T0 })
    expect(c.get().reminders[0]!.done).toBe(true)
    expect(c.get().snack).toMatchObject({ canUndo: true })
    c.get().undoRemoval()
    expect(c.get().cards[0]!.done).toBeUndefined()
    expect(c.get().reminders[0]!.done).toBe(false)
    expect(c.get().snack).toBeNull()
  })
  it('unticking re-opens it', () => {
    const c = setup()
    const id = task(c, 'x', { dueAt: T0 })
    c.get().setTaskDone(id, true)
    c.get().setTaskDone(id, false)
    expect(c.get().cards[0]!.done).toBeUndefined()
    expect(c.get().reminders[0]!.done).toBe(false)
  })
  it('a repeating task moves to its next date, logs the tick, and is not done; Undo restores the date', () => {
    const c = setup()
    const id = task(c, 'Rent', { dueAt: at(2026, 1, 31), repeat: 'monthly' })
    // Now is 10 Nov 2026. 31 Jan steps on month by month and skips every date already past: the next one is 30 Nov.
    c.get().setTaskDone(id, true)
    const r = c.get().reminders[0]!
    expect(r.dueAt).toBe(at(2026, 11, 30))
    expect(r.done).toBe(false)
    expect(r.history).toEqual([{ paidAt: T0, amount: null }])
    expect(c.get().cards[0]!.done).toBeUndefined()
    expect(c.get().snack!.text).toBe('Done. Next on 30 Nov 2026')
    c.get().undoRemoval()
    expect(c.get().reminders[0]).toMatchObject({ dueAt: at(2026, 1, 31), history: [] })
  })
  it('Undo only applies while its own snackbar is showing', () => {
    const c = setup()
    const a = task(c, 'a')
    const b = task(c, 'b')
    c.get().setTaskDone(a, true)
    c.get().deleteCard(b)
    c.get().undoRemoval()
    expect(c.get().cards.find((x) => x.id === b)!.deletedAt).toBeNull()
    expect(c.get().cards.find((x) => x.id === a)!.done).toBe(true)
  })
  it('refuses a missing, trashed or non-task card', () => {
    const c = setup()
    const n = c.store.getState().saveCard({ title: 'N', kind: 'tape', toolId: null, inputs: null, summary: '', amount: null, lines: [] })!
    expect(c.get().setTaskDone(n, true)).toBe(false)
    expect(c.get().setTaskDone('nope', true)).toBe(false)
  })
})

describe('clear done, trash, restore', () => {
  it('Clear done moves finished tasks to Trash, keeps open ones, and Undo brings them back', () => {
    const c = setup()
    const a = task(c, 'a')
    task(c, 'b')
    const d = task(c, 'd', { dueAt: T0 })
    c.get().setTaskDone(a, true)
    c.get().setTaskDone(d, true)
    expect(c.get().clearDoneTasks()).toBe(2)
    expect(c.get().cards.filter((x) => x.deletedAt === null).map((x) => x.title)).toEqual(['b'])
    expect(c.get().snack!.text).toBe('Moved 2 done tasks to Trash')
    c.get().undoRemoval()
    expect(c.get().cards.filter((x) => x.deletedAt === null)).toHaveLength(3)
    expect(c.get().clearDoneTasks()).toBe(2)
  })
  it('with nothing done it does nothing', () => {
    const c = setup()
    task(c, 'a')
    expect(c.get().clearDoneTasks()).toBe(0)
    expect(c.get().snack).toBeNull()
  })
  it('a deleted task goes to Trash with Undo, vanishes from To-do, and Restore brings it back with its date', () => {
    const c = setup()
    const id = task(c, 'Pay rent', { dueAt: at(2026, 11, 12) })
    c.get().deleteCard(id)
    expect(taskItems(c.get().cards, c.get().reminders)).toEqual([])
    c.get().restoreCard(id)
    const [t] = taskItems(c.get().cards, c.get().reminders)
    expect(t!.dueAt).toBe(at(2026, 11, 12))
    c.get().deleteCard(id)
    c.get().undoRemoval()
    expect(taskItems(c.get().cards, c.get().reminders)).toHaveLength(1)
  })
  it('Empty Trash removes trashed tasks and their reminders for good', () => {
    const c = setup()
    const id = task(c, 'gone', { dueAt: T0 })
    c.get().deleteCard(id)
    c.get().emptyTrash()
    expect(c.get().cards).toEqual([])
    expect(c.get().reminders).toEqual([])
  })
  it('Today and All grouping reads from the store', () => {
    const c = setup()
    task(c, 'overdue', { dueAt: T0 - 2 * DAY })
    task(c, 'today', { dueAt: T0 })
    task(c, 'later', { dueAt: T0 + 3 * DAY })
    task(c, 'inbox')
    const g = groupTasks(taskItems(c.get().cards, c.get().reminders), T0 + 6 * 3600_000)
    expect([g.overdue, g.today, g.upcoming, g.inbox].map((l) => l.map((t) => t.card.title))).toEqual([['overdue'], ['today'], ['later'], ['inbox']])
  })
})

describe('old data and backup', () => {
  const old = (over: object = {}) => ({ id: 'c1', title: 'HDFC', kind: 'tool', toolId: 'emi', inputs: { p: '1' }, summary: 's', amount: '5', note: '', tags: [], pinned: false, createdAt: 1, updatedAt: 1, deletedAt: null, ...over })

  it('a file from before to-do existed loads unchanged, with no schema bump', () => {
    const v3 = { schemaVersion: 3, cards: [old(), old({ id: 'c2', kind: 'tape', toolId: null, inputs: null, lines: [{ id: 'l', label: 'a', value: '5', done: true }], checklist: true })], reminders: [] }
    const r = migrate(v3)
    expect(r.cards).toHaveLength(2)
    expect(r.cards[0]).toMatchObject({ id: 'c1', title: 'HDFC', kind: 'tool', toolId: 'emi', inputs: { p: '1' }, amount: '5' })
    expect(r.cards.map((c) => c.kind)).toEqual(['tool', 'tape'])
    expect(r.cards.every((c) => c.done === undefined && c.doneAt === undefined)).toBe(true)
    expect(Object.keys(r.cards[0]!)).not.toContain('done')
  })
  it('sanitize keeps task cards, drops an unnamed task, caps tags at 5, ignores done on non-tasks', () => {
    const t = (over: object = {}) => old({ id: 't1', kind: 'task', toolId: null, inputs: null, ...over })
    const out = sanitizeCards([t({ done: true, doneAt: 7, tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }), t({ id: 't2', title: '  ' }), t({ id: 't3', title: undefined }), old({ id: 'x', done: true })])
    expect(out.map((c) => c.id)).toEqual(['t1', 'x'])
    expect(out[0]).toMatchObject({ kind: 'task', done: true, doneAt: 7, lines: [], inputs: null })
    expect(out[0]!.tags).toHaveLength(5)
    expect(out[1]!.done).toBeUndefined()
  })
  it('a task with a junk done flag is simply open', () => {
    expect(sanitizeCards([old({ id: 't', kind: 'task', toolId: null, done: 'yes', doneAt: 'x' })])[0]!.done).toBeUndefined()
  })
  it('backup round trip keeps dated, repeating, done and trashed tasks', () => {
    const a = setup()
    task(a, 'inbox')
    const rent = task(a, 'Rent', { dueAt: at(2026, 12, 1), repeat: 'monthly' })
    const fin = task(a, 'Finished', { dueAt: T0 })
    const gone = task(a, 'Gone')
    a.get().setTaskDone(fin, true)
    a.get().deleteCard(gone)
    a.get().togglePin(rent)
    const parsed = parseBackup(buildBackup(a.get().snapshot()))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const b = setup()
    b.store.getState().restore(parsed.data)
    expect(b.get().cards).toEqual(a.get().cards)
    expect(b.get().reminders).toEqual(a.get().reminders)
    expect(b.get().cards.find((c) => c.id === fin)).toMatchObject({ done: true, doneAt: T0 })
    expect(b.get().cards.find((c) => c.id === rent)!.pinned).toBe(true)
  })
})
