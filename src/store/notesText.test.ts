import { describe, expect, it } from 'vitest'
import { buildBackup, parseBackup } from './backup'
import { createAppStore } from './app'
import { CURRENT_SCHEMA, defaultPersisted, migrate, sanitizeCards } from './persistence'
import { MAX_CARDS, MAX_NOTE_BODY, TRASH_DAYS } from './types'

const raw = (o: object = {}) => ({ id: 'n1', title: 'Wifi', kind: 'text', toolId: null, inputs: null, summary: 'router', amount: null, lines: [], note: 'password is on the TV', tags: ['Home'], pinned: false, createdAt: 1, updatedAt: 2, deletedAt: null, ...o })

function setup(now = 1_000_000) {
  let t = now
  let n = 0
  const store = createAppStore(defaultPersisted(), { now: () => t, newId: () => `id${++n}` })
  return { store, get: store.getState, tick: (ms: number) => (t += ms) }
}
const draft = (o = {}) => ({ title: 'Wifi', kind: 'text' as const, toolId: null, inputs: null, summary: 'router', amount: null, lines: [], note: 'password is on the TV', tags: ['Home'], ...o })

describe('sanitizeCards: a plain note (kind text)', () => {
  it('keeps a good note exactly, body in the note field', () => {
    expect(sanitizeCards([raw()])).toEqual([raw()])
  })
  it('keeps a note that has only a body and gives it a title', () => {
    const [c] = sanitizeCards([raw({ title: '   ', note: 'buy milk' })])
    expect(c).toMatchObject({ kind: 'text', title: 'Untitled note', note: 'buy milk' })
  })
  it('keeps a note that has only a title', () => {
    expect(sanitizeCards([raw({ title: 'Idea', note: '' })])).toHaveLength(1)
  })
  it('drops a note with no title and no body, or with junk where the title was', () => {
    expect(sanitizeCards([raw({ title: '', note: '' }), raw({ id: 'n2', title: 5, note: '  ' }), raw({ id: 'n3', title: null, note: null })])).toEqual([])
  })
  it('cuts the body at the limit, the title at 120 and the tags at 10 of 30 characters', () => {
    const [c] = sanitizeCards([raw({ title: 't'.repeat(300), note: 'x'.repeat(MAX_NOTE_BODY + 50), tags: Array.from({ length: 14 }, (_, i) => `tag${i}-` + 'z'.repeat(40)) })])
    expect(c?.title).toHaveLength(120)
    expect(c?.note).toHaveLength(MAX_NOTE_BODY)
    expect(c?.tags).toHaveLength(10)
    expect(c?.tags.every((t) => t.length <= 30)).toBe(true)
  })
  it('a note carries no calculator inputs, lines, ticks or checklist, even if the file says so', () => {
    const [c] = sanitizeCards([raw({ inputs: { a: '1' }, lines: [{ id: 'l', label: 'x', value: '5' }], checklist: true, done: true, doneAt: 5 })])
    expect(c).toMatchObject({ inputs: null, lines: [] })
    expect(c).not.toHaveProperty('checklist')
    expect(c).not.toHaveProperty('done')
  })
  it('stores the text as written: dates and sums in it are not turned into numbers', () => {
    const body = '2-11-2026 and 50% off and 3+4'
    const [c] = sanitizeCards([raw({ note: body })])
    expect(c?.note).toBe(body)
    expect(c?.amount).toBeNull()
  })
  it('an unknown kind still falls back to a calculation, which needs a calculator, so it is dropped', () => {
    expect(sanitizeCards([raw({ kind: 'diary' })])).toEqual([])
  })
})

describe('plain notes in the store', () => {
  it('saves, shows its body, and counts toward the card limit with a plain message', () => {
    const c = setup()
    const id = c.get().saveCard(draft())
    expect(c.get().cards[0]).toMatchObject({ id, kind: 'text', note: 'password is on the TV', pinned: false, deletedAt: null })
    for (let i = 1; i < MAX_CARDS; i++) c.get().saveCard(draft({ title: `n${i}` }))
    expect(c.get().saveCard(draft({ title: 'one too many' }))).toBeNull()
    expect(c.get().snack?.text).toBe(`You can keep up to ${MAX_CARDS} notes and tasks. Delete some first.`)
  })
  it('edits, pins and unpins like any card', () => {
    const c = setup()
    const id = c.get().saveCard(draft())!
    c.tick(5)
    c.get().updateCard(id, { title: 'Wifi at home', note: 'new password', summary: 'new password' })
    c.get().togglePin(id)
    expect(c.get().cards[0]).toMatchObject({ title: 'Wifi at home', note: 'new password', pinned: true, updatedAt: 1_000_005 })
    c.get().togglePin(id)
    expect(c.get().cards[0]?.pinned).toBe(false)
  })
  it('delete goes to Trash with Undo, restores whole, and is gone for good after the Trash period', () => {
    const c = setup()
    const id = c.get().saveCard(draft())!
    c.get().deleteCard(id)
    expect(c.get().cards[0]?.deletedAt).not.toBeNull()
    expect(c.get().snack?.canUndo).toBe(true)
    c.get().undoRemoval()
    expect(c.get().cards[0]).toMatchObject({ deletedAt: null, note: 'password is on the TV', tags: ['Home'] })
    c.get().deleteCard(id)
    c.get().restoreCard(id)
    expect(c.get().cards[0]?.deletedAt).toBeNull()
  })
  it('a note in Trash is purged on the next start once it is 7 days old, and not before', () => {
    const DAY = 86_400_000
    const gone = [raw({ id: 'a', deletedAt: 1_000 - TRASH_DAYS * DAY - 1 }), raw({ id: 'b', deletedAt: 1_000 - TRASH_DAYS * DAY + 1 })]
    const s = createAppStore({ ...defaultPersisted(), cards: sanitizeCards(gone) }, { now: () => 1_000, newId: () => 'x' })
    expect(s.getState().cards.map((x) => x.id)).toEqual(['b'])
  })
  it('a note survives a backup and a restore, and loads back unchanged through migrate', () => {
    const c = setup()
    const a = c.get().saveCard(draft({ note: 'line one\nline two' }))!
    c.get().togglePin(a)
    c.get().saveCard(draft({ title: 'Trashed', note: 'x' }))
    c.get().deleteCard(c.get().cards[0]!.id)
    const text = buildBackup(c.get().snapshot())
    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.data.cards.map((x) => [x.id, x.kind, x.note, x.pinned, x.deletedAt !== null])).toEqual([
      ['id2', 'text', 'x', false, true],
      ['id1', 'text', 'line one\nline two', true, false],
    ])
    const d = setup()
    d.get().restore(parsed.data)
    expect(d.get().cards).toEqual(c.get().cards)
  })
  it('needs no schema bump: a file saved at the current version with a note loads as it is', () => {
    const out = migrate({ schemaVersion: CURRENT_SCHEMA, cards: [raw()] })
    expect(out.cards).toEqual([raw()])
  })
})
