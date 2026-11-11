import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../lib/storage'
import { MAX_INBOX, MAX_LEARNED, type InboxItem } from '../lib/inbox'
import { memorySmsQueue } from '../lib/smsQueue'
import { drainQueue } from '../lib/inbox'
import { bootStore } from './boot'
import { createAppStore } from './app'
import { STORAGE_KEY, defaultPersisted, migrate, sanitizeBudget, sanitizeSettings } from './persistence'
import { buildBackup, parseBackup } from './backup'

let n = 0
const NOW = new Date('2026-11-12T10:00:00+05:30').getTime()
const FOOD = 'starter-food'
const SHOP = 'starter-shopping'
const CARD = { name: 'HDFC Regalia', kind: 'credit' as const, bank: 'HDFC Bank', last4: '1234' }

const make = (mode: 'review' | 'auto' = 'review') => {
  const data = defaultPersisted()
  data.settings = { ...data.settings, smsCapture: true, smsMode: mode }
  const store = createAppStore(data, { now: () => NOW, newId: () => `id-${++n}` })
  const card = store.getState().addInstrument(CARD)!
  return { store, get: () => store.getState(), card }
}
const item = (o: Partial<InboxItem> = {}): InboxItem => ({ id: `fp${++n}x`, date: '2026-11-12', amount: '450.00', merchant: 'Swiggy', kind: 'spend', mode: 'credit', instrumentId: null, last4: '1234', bank: 'HDFC Bank', categoryId: null, why: '', person: false, status: 'pending', at: NOW, ...o })
const give = (get: () => ReturnType<ReturnType<typeof make>['store']['getState']>, items: InboxItem[]) => get().commitDrain({ items: [...items].reverse(), entries: [], seen: items.map((i) => i.id), ackIds: [], held: 0 })

describe('approving or rejecting a club of one payee', () => {
  it('Approve all: each payment its own entry in the chosen category, the payee learned ONCE, one Undo, never auto-eligible from the guess', () => {
    const { get, card } = make()
    const x = [item({ merchant: 'Amazon Pay', amount: '100.00', instrumentId: card }), item({ merchant: 'Amazon Pay', amount: '200.00', instrumentId: card }), item({ merchant: 'Amazon Pay', amount: '300.00', instrumentId: card })]
    give(get, x)
    expect(get().approveGroup(x.map((i) => i.id), SHOP)).toBe(3)
    expect(get().budget.expenses.map((e) => [e.amount, e.categoryId, e.note]).sort()).toEqual([['100', SHOP, 'Amazon Pay'], ['200', SHOP, 'Amazon Pay'], ['300', SHOP, 'Amazon Pay']])
    expect(get().budget.learned).toEqual([{ key: 'amazon pay', categoryId: SHOP, count: 1, lastAt: NOW }])
    expect(get().budget.inbox!.every((i) => i.status === 'approved')).toBe(true)
    get().undoRemoval()
    expect(get().budget.expenses).toHaveLength(0)
    expect(get().budget.learned).toBeUndefined()
    expect(get().budget.inbox!.every((i) => i.status === 'pending')).toBe(true)
  })
  it('Approve all refuses a category that is not usable, and Reject all has one Undo', () => {
    const { get, card } = make()
    const x = [item({ merchant: 'Amazon Pay', instrumentId: card }), item({ merchant: 'Amazon Pay', instrumentId: card })]
    give(get, x)
    expect(get().approveGroup(x.map((i) => i.id), 'nope')).toBe(0)
    expect(get().budget.expenses).toHaveLength(0)
    expect(get().rejectGroup(x.map((i) => i.id))).toBe(2)
    expect(get().budget.inbox!.every((i) => i.status === 'rejected')).toBe(true)
    get().undoRemoval()
    expect(get().budget.inbox!.every((i) => i.status === 'pending')).toBe(true)
  })
})

describe('approve, learn, suggest', () => {
  it('Approve makes a real entry, links it, and learns the tag (1, then 2 in a row)', () => {
    const { get, card } = make()
    const a = item({ instrumentId: card, categoryId: FOOD })
    const b = item({ instrumentId: card, categoryId: FOOD })
    give(get, [a, b])
    expect(get().approveInbox(a.id)).toBe(true)
    expect(get().budget.expenses[0]).toMatchObject({ amount: '450', categoryId: FOOD, note: 'Swiggy', date: '2026-11-12', mode: 'credit', instrumentId: card })
    expect(get().budget.expenses[0]!.auto).toBeUndefined()
    expect(get().budget.inbox!.find((i) => i.id === a.id)).toMatchObject({ status: 'approved', entryId: get().budget.expenses[0]!.id })
    expect(get().budget.learned).toEqual([{ key: 'swiggy', categoryId: FOOD, count: 1, lastAt: NOW }])
    // the other pending Swiggy is now suggested with a plain reason
    expect(get().budget.inbox!.find((i) => i.id === b.id)).toMatchObject({ categoryId: FOOD, why: 'You tagged Swiggy as Food once' })
    get().approveInbox(b.id)
    expect(get().budget.learned![0]!.count).toBe(2)
  })
  it('Change: a different category resets the count to 1 with the new tag; a note is added after the payee', () => {
    const { get } = make()
    const a = item({ categoryId: FOOD })
    const b = item({ categoryId: FOOD })
    give(get, [a, b])
    get().approveInbox(a.id)
    get().approveInbox(b.id, { categoryId: SHOP, note: 'birthday gift' })
    expect(get().budget.learned![0]).toMatchObject({ categoryId: SHOP, count: 1 })
    expect(get().budget.expenses[0]).toMatchObject({ categoryId: SHOP, note: 'Swiggy: birthday gift' })
  })
  it('an uncategorised approval teaches nothing', () => {
    const { get } = make()
    const a = item({ merchant: 'Rahul S' })
    give(get, [a])
    expect(get().approveInbox(a.id)).toBe(true)
    expect(get().budget.learned).toBeUndefined()
  })
  it('a payment with a removed card still adds, without the card', () => {
    const { get, card } = make()
    const a = item({ instrumentId: card })
    give(get, [a])
    get().deleteInstrument(card)
    expect(get().approveInbox(a.id)).toBe(true)
    expect(get().budget.expenses[0]!.instrumentId).toBeNull()
  })
  it('Reject and Not a spend remove it with Undo, and never add an entry or teach anything', () => {
    const { get } = make()
    const a = item({ categoryId: FOOD })
    const b = item()
    give(get, [a, b])
    get().rejectInbox(a.id)
    get().rejectInbox(b.id, true)
    expect(get().budget.inbox!.map((i) => [i.status, i.notSpend ?? false])).toEqual([['rejected', true], ['rejected', false]])
    expect(get().budget.expenses).toHaveLength(0)
    expect(get().budget.learned).toBeUndefined()
    get().snack && get().dismissSnack(get().snack!.id)
  })
  it('Reject can be undone', () => {
    const { get } = make()
    const a = item()
    give(get, [a])
    get().rejectInbox(a.id)
    expect(get().snack?.canUndo).toBe(true)
    get().undoRemoval()
    expect(get().budget.inbox![0]).toMatchObject({ status: 'pending' })
    expect(get().budget.inbox![0]!.resolvedAt).toBeUndefined()
  })
  it('Approve all suggested takes only the confirmed ones, never a person, and has one Undo', () => {
    const learned = [{ key: 'swiggy', categoryId: FOOD, count: 2, lastAt: 1 }, { key: 'rahul s', categoryId: FOOD, count: 5, lastAt: 1 }, { key: 'zomato', categoryId: FOOD, count: 1, lastAt: 1 }]
    const s = createAppStore({ ...defaultPersisted(), budget: { ...defaultPersisted().budget, learned } }, { now: () => NOW, newId: () => `ia-${++n}` })
    const c = s.getState().addInstrument(CARD)!
    const x = [item({ instrumentId: c, categoryId: FOOD }), item({ merchant: 'Rahul S', person: true, categoryId: FOOD }), item({ merchant: 'Zomato', categoryId: FOOD }), item({ merchant: 'Unknown Shop' })]
    give(s.getState, x)
    expect(s.getState().approveSuggested()).toBe(1)
    expect(s.getState().budget.expenses).toHaveLength(1)
    expect(s.getState().budget.inbox!.filter((i) => i.status === 'pending')).toHaveLength(3)
    expect(s.getState().budget.learned!.find((l) => l.key === 'swiggy')!.count).toBe(3)
    s.getState().undoRemoval()
    expect(s.getState().budget.expenses).toHaveLength(0)
    expect(s.getState().budget.inbox!.filter((i) => i.status === 'pending')).toHaveLength(4)
    expect(s.getState().budget.learned!.find((l) => l.key === 'swiggy')!.count).toBe(2)
  })
  it('Delete captured messages empties the waiting items and keeps entries', () => {
    const { get } = make()
    const a = item()
    const b = item()
    give(get, [a, b])
    get().approveInbox(a.id)
    expect(get().clearInbox()).toBe(1)
    expect(get().budget.inbox!.map((i) => i.status)).toEqual(['approved'])
    expect(get().budget.expenses).toHaveLength(1)
  })
})

describe('learned payees list', () => {
  it('change resets the count to 1; forget is undoable and keeps its place', () => {
    const { get } = make()
    const learned = [{ key: 'swiggy', categoryId: FOOD, count: 4, lastAt: 1 }, { key: 'zomato', categoryId: FOOD, count: 2, lastAt: 1 }]
    get().restore({ ...get().snapshot(), budget: { ...get().budget, learned } })
    expect(get().setLearned('swiggy', SHOP)).toBe(true)
    expect(get().budget.learned![0]).toMatchObject({ key: 'swiggy', categoryId: SHOP, count: 1 })
    expect(get().setLearned('swiggy', 'ghost')).toBe(false)
    get().forgetLearned('zomato')
    expect(get().budget.learned!.map((l) => l.key)).toEqual(['swiggy'])
    get().undoRemoval()
    expect(get().budget.learned!.map((l) => l.key)).toEqual(['swiggy', 'zomato'])
  })
})

describe('Auto mode through the store: undo, change, and the circuit breaker', () => {
  const autoRun = (count: number) => {
    const t = make('auto')
    const learned = Array.from({ length: count }, (_, i) => ({ key: `shop${String.fromCharCode(97 + i)}x`, categoryId: FOOD, count: 2, lastAt: 1 }))
    t.get().restore({ ...t.get().snapshot(), budget: { ...t.get().budget, learned } })
    const q = memorySmsQueue(
      learned.map((l, i) => ({ id: `q${i}`, sender: 'VM-HDFCBK', receivedAt: NOW, body: `Rs.${100 + i}.00 spent on HDFC Bank Credit Card XX1234 at ${l.key.toUpperCase()} on 12-11-26. Ref 77${i}000000${i}1. Avl limit Rs.90000` })),
    )
    return { ...t, q, drain: () => drainQueue(q, { budget: () => t.get().budget, auto: () => t.get().settings.smsMode === 'auto', commit: (p) => t.get().commitDrain(p), persist: async () => true, now: () => NOW, newId: () => `ae-${++n}` }) }
  }

  it('a confident payment is added, flagged, and the rest wait', async () => {
    const t = autoRun(1)
    const r = await t.drain()
    expect(r).toMatchObject({ status: 'done', auto: 1, pending: 0 })
    expect(t.get().budget.expenses[0]).toMatchObject({ auto: true, categoryId: FOOD })
    expect(t.get().budget.learned![0]!.count).toBe(2) // no self-reinforcing
  })
  it('Undo removes the entry, forgets the payee and puts the item back to pending', async () => {
    const t = autoRun(1)
    await t.drain()
    const it0 = t.get().budget.inbox![0]!
    t.get().undoAutoAdded(it0.id)
    expect(t.get().budget.expenses).toHaveLength(0)
    expect(t.get().budget.learned ?? []).toEqual([])
    expect(t.get().budget.inbox![0]).toMatchObject({ status: 'pending' })
    expect(t.get().budget.inbox![0]!.auto).toBeUndefined()
    expect(t.get().budget.autoLog![0]).toMatchObject({ bad: true })
    expect(t.get().settings.smsMode).toBe('auto') // one undo is not drift
  })
  it('2 undone or changed among the last 10 switch back to Review first, and say why', async () => {
    const t = autoRun(4)
    await t.drain()
    const ids = t.get().budget.expenses.map((e) => e.id)
    expect(ids).toHaveLength(4)
    // change one (category), delete another: both count
    const e0 = t.get().budget.expenses.find((e) => e.auto)!
    expect(t.get().updateExpense(e0.id, { amount: e0.amount, categoryId: SHOP, mode: e0.mode, instrumentId: e0.instrumentId, date: e0.date, note: e0.note })).toBe(true)
    expect(t.get().budget.expenses.find((e) => e.id === e0.id)!.auto).toBeUndefined()
    expect(t.get().settings.smsMode).toBe('auto')
    const e1 = t.get().budget.expenses.find((e) => e.auto)!
    t.get().deleteExpense(e1.id)
    expect(t.get().settings.smsMode).toBe('review')
    expect(t.get().settings.smsAutoPausedAt).toBe(NOW)
    expect(t.get().snack?.text).toMatch(/Auto-add is off/)
  })
  it('adding only a note to an auto entry is not a correction', async () => {
    const t = autoRun(2)
    await t.drain()
    for (const e of t.get().budget.expenses.filter((x) => x.auto)) t.get().updateExpense(e.id, { amount: e.amount, categoryId: e.categoryId, mode: e.mode, instrumentId: e.instrumentId, date: e.date, note: `${e.note} for lunch` })
    expect(t.get().settings.smsMode).toBe('auto')
    expect(t.get().budget.expenses.every((e) => e.auto)).toBe(true)
  })
  it('choosing Auto again is a fresh start', async () => {
    const t = autoRun(3)
    await t.drain()
    for (const e of t.get().budget.expenses.slice(0, 2)) t.get().deleteExpense(e.id)
    expect(t.get().settings.smsMode).toBe('review')
    t.get().setSmsMode('auto')
    expect(t.get().settings).toMatchObject({ smsMode: 'auto', smsAutoPausedAt: null })
    expect(t.get().budget.autoLog).toEqual([])
  })
})

describe('storage: additive, sanitised, old backups load', () => {
  it('defaults: capture off, Review first', () => {
    expect(defaultPersisted().settings).toMatchObject({ smsCapture: false, smsMode: 'review', smsAutoPausedAt: null })
    expect(sanitizeSettings({ smsMode: 'bogus', smsCapture: 'yes', smsAutoPausedAt: -5 })).toMatchObject({ smsCapture: false, smsMode: 'review', smsAutoPausedAt: null })
  })
  it('an old file with no inbox loads, schema stays 3, and the saved shape gains nothing when unused', () => {
    const old = { schemaVersion: 3, settings: {}, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false }, budget: { overall: null, categories: [], instruments: [], expenses: [] } }
    const d = migrate(old)
    expect(d.schemaVersion).toBe(3)
    expect(d.budget.inbox).toBeUndefined()
    expect(d.budget.learned).toBeUndefined()
    expect(d.settings.smsMode).toBe('review')
  })
  it('round trip: items, learned, autoLog and the auto flag survive; a message body never does', () => {
    const t = make('auto')
    const a = item({ instrumentId: t.card, categoryId: FOOD, why: 'You tagged Swiggy as Food once' })
    give(t.get, [a])
    t.get().approveInbox(a.id)
    const raw = JSON.parse(JSON.stringify(t.get().snapshot()))
    raw.budget.inbox[0].body = 'Rs.450 spent on HDFC Bank Credit Card XX1234 at SWIGGY'
    raw.budget.inbox[0].sender = 'VM-HDFCBK'
    raw.budget.expenses[0].auto = true
    const back = migrate(raw).budget
    expect(JSON.stringify(back)).not.toMatch(/spent on|VM-HDFCBK/)
    expect(back.inbox![0]).toMatchObject({ id: a.id, status: 'approved', merchant: 'Swiggy', amount: '450.00', categoryId: FOOD })
    expect(back.expenses[0]!.auto).toBe(true)
    expect(back.learned![0]).toMatchObject({ key: 'swiggy', count: 1 })
    expect(sanitizeBudget(JSON.parse(JSON.stringify(back)))).toEqual(back) // stable
  })
  it('junk is dropped: bad ids, amounts, dates, statuses; an auto item without a real entry loses the flag', () => {
    const b = sanitizeBudget({
      ...defaultPersisted().budget,
      inbox: [
        { id: '!!', date: '2026-11-12', amount: '5', status: 'pending' },
        { id: 'abc123', date: 'tomorrow', amount: '5', status: 'pending' },
        { id: 'abc124', date: '2026-11-12', amount: '-5', status: 'pending' },
        { id: 'abc125', date: '2026-11-12', amount: '0', status: 'pending' },
        { id: 'abc126', date: '2026-11-12', amount: '5', status: 'weird', categoryId: 'ghost', instrumentId: 'ghost', merchant: 'X'.repeat(500), why: 'y'.repeat(500) },
        { id: 'abc127', date: '2026-11-12', amount: '5', status: 'approved', auto: true, entryId: 'nope' },
        { id: 'abc126', date: '2026-11-12', amount: '5', status: 'pending' },
        'junk',
      ],
      learned: [{ key: 'Swiggy', categoryId: FOOD, count: 2 }, { key: 'swiggy', categoryId: 'ghost', count: 2 }, { key: 'swiggy', categoryId: FOOD, count: 0 }, { key: 'zomato', categoryId: FOOD, count: 500, lastAt: 9 }],
      autoLog: [{ id: 'abc127', bad: true }, { id: 'abc127', bad: false }, { id: '!', bad: true }],
    })
    expect(b.inbox!.map((i) => i.id)).toEqual(['abc126', 'abc127'])
    expect(b.inbox![0]).toMatchObject({ status: 'pending', categoryId: null, instrumentId: null })
    expect(b.inbox![0]!.merchant).toHaveLength(60)
    expect(b.inbox![0]!.why).toHaveLength(120)
    expect(b.inbox![1]).toMatchObject({ status: 'approved' })
    expect(b.inbox![1]!.auto).toBeUndefined()
    expect(b.learned).toEqual([{ key: 'zomato', categoryId: FOOD, count: 99, lastAt: 9 }])
    expect(b.autoLog).toEqual([{ id: 'abc127', bad: true }])
  })
  it('caps: 300 items, 200 learned payees', () => {
    const items = Array.from({ length: MAX_INBOX + 40 }, (_, i) => ({ id: `fp${i}aa`, date: '2026-11-12', amount: '5', status: 'pending' }))
    const word = (i: number) => String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + (Math.floor(i / 26) % 26)) + String.fromCharCode(97 + Math.floor(i / 676))
    const learned = Array.from({ length: MAX_LEARNED + 40 }, (_, i) => ({ key: `payee ${word(i)}x`, categoryId: FOOD, count: 1, lastAt: 1 }))
    const b = sanitizeBudget({ ...defaultPersisted().budget, inbox: items, learned })
    expect(b.inbox).toHaveLength(MAX_INBOX)
    expect(b.learned).toHaveLength(MAX_LEARNED)
  })
  it('a backup carries the inbox and learning and restores them', () => {
    const t = make()
    const a = item({ instrumentId: t.card, categoryId: FOOD })
    give(t.get, [a, item()])
    t.get().approveInbox(a.id)
    const file = buildBackup(t.get().snapshot(), new Date(NOW))
    const back = parseBackup(file)
    expect(back.ok).toBe(true)
    if (back.ok) {
      expect(back.data.budget.inbox).toHaveLength(2)
      expect(back.data.budget.learned).toHaveLength(1)
    }
  })
})

describe('persist: the SMS queue is acked only when the data is really on disk', () => {
  it('persist says true after a good write and false when storage cannot be read or written', async () => {
    const ok = createMemoryStorage()
    const booted = await bootStore(ok)
    booted.store.getState().addExpense({ amount: '5', categoryId: null, date: '2026-11-12', note: 'x' })
    expect(await booted.persist()).toBe(true)
    expect(JSON.parse(ok.dump()[STORAGE_KEY]!).budget.expenses).toHaveLength(1)

    const broken = createMemoryStorage()
    broken.set = async () => { throw new Error('disk full') }
    const b2 = await bootStore(broken)
    b2.store.getState().addExpense({ amount: '5', categoryId: null, date: '2026-11-12', note: 'x' })
    expect(await b2.persist()).toBe(false)

    const unreadable = createMemoryStorage()
    unreadable.get = async () => { throw new Error('cannot read') }
    const b3 = await bootStore(unreadable)
    expect(await b3.persist()).toBe(false) // never writes over data it could not read, so never says it saved
  })
  it('end to end: drain through a real boot, then ack', async () => {
    const storage = createMemoryStorage()
    const booted = await bootStore(storage)
    booted.store.getState().updateSettings({ smsCapture: true })
    const q = memorySmsQueue([{ id: 'q1', sender: 'VM-HDFCBK', receivedAt: NOW, body: 'Rs.450.00 spent on HDFC Bank Credit Card XX1234 at SWIGGY on 12-11-26. Ref 5500000000001' }])
    const r = await drainQueue(q, { budget: () => booted.store.getState().budget, auto: () => false, commit: (p) => booted.store.getState().commitDrain(p), persist: booted.persist, now: () => NOW, newId: () => 'e1' })
    expect(r.status).toBe('done')
    expect(await q.drain()).toEqual([]) // acked
    expect(JSON.parse(storage.dump()[STORAGE_KEY]!).budget.inbox).toHaveLength(1) // and it was on disk before that
  })
})
