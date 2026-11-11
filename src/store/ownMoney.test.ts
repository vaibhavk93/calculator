import { describe, expect, it } from 'vitest'
import { type InboxItem } from '../lib/inbox'
import { payeeKindFor, payeeKey } from '../lib/payeeKey'
import { createAppStore } from './app'
import { defaultPersisted, migrate, sanitizeBudget } from './persistence'
import { buildBackup, parseBackup } from './backup'

/** SYNTHETIC names and numbers. */
let n = 0
const NOW = new Date('2026-11-12T10:00:00+05:30').getTime()
const make = () => {
  const data = defaultPersisted()
  data.settings = { ...data.settings, smsCapture: true }
  const store = createAppStore(data, { now: () => NOW, newId: () => `id-${++n}` })
  return { store, get: () => store.getState() }
}
const item = (o: Partial<InboxItem> = {}): InboxItem => ({ id: `fp${++n}x`, date: '2026-11-12', amount: '4000.00', merchant: 'Rahul Sharma', kind: 'spend', mode: 'upi', instrumentId: null, last4: '1234', bank: 'HDFC Bank', categoryId: null, why: '', person: true, status: 'pending', at: NOW, nature: 'spend', ...o })
const give = (get: ReturnType<typeof make>['get'], items: InboxItem[]) => get().commitDrain({ items: [...items].reverse(), entries: [], seen: items.map((i) => i.id), ackIds: [], held: 0 })

describe('markPayeeSelf: "This is my own account" / "This is someone else"', () => {
  it('own account: waiting items for that payee become own money (never auto-added); it is remembered; Undo puts it back', () => {
    const { get } = make()
    const a = item()
    const other = item({ merchant: 'Chai Point', person: false })
    give(get, [a, other])
    const key = payeeKey('Rahul Sharma')!
    expect(get().markPayeeSelf(key, true)).toBe(true)
    expect(payeeKindFor(get().budget.payeeKinds, key)).toBe('self')
    const items = get().budget.inbox!
    expect(items.find((i) => i.id === a.id)).toMatchObject({ nature: 'ownMoney', ownKind: 'selfTransfer', person: false, categoryId: null })
    expect(items.find((i) => i.id === other.id)).toMatchObject({ nature: 'spend' })
    get().undoRemoval()
    expect(get().budget.payeeKinds).toBeUndefined()
    expect(get().budget.inbox!.find((i) => i.id === a.id)).toMatchObject({ nature: 'spend' })
  })
  it('someone else: a self-transfer guess goes back to a spend and is marked as a person', () => {
    const { get } = make()
    const a = item({ nature: 'ownMoney', ownKind: 'selfTransfer', ownWhy: 'x', person: false })
    give(get, [a])
    get().markPayeeSelf(payeeKey('Rahul Sharma')!, false)
    expect(payeeKindFor(get().budget.payeeKinds, 'rahul sharma')).toBe('person')
    expect(get().budget.inbox![0]).toMatchObject({ nature: 'spend', person: true })
    expect(get().budget.inbox![0]!.ownKind).toBeUndefined()
  })
  it('a deposit item is not touched by "someone else"', () => {
    const { get } = make()
    const a = item({ merchant: 'Rahul Sharma', nature: 'ownMoney', ownKind: 'fdOpen', ownWhy: 'x', person: false })
    give(get, [a])
    get().markPayeeSelf('rahul sharma', false)
    expect(get().budget.inbox![0]).toMatchObject({ nature: 'ownMoney', ownKind: 'fdOpen' })
  })
  it('refuses a key that is not a payee key; the newest answer wins; the list is capped', () => {
    const { get } = make()
    expect(get().markPayeeSelf('Not A Key!', true)).toBe(false)
    get().markPayeeSelf('rahul sharma', true)
    get().markPayeeSelf('rahul sharma', false)
    expect(get().budget.payeeKinds).toEqual([{ key: 'rahul sharma', kind: 'person', at: NOW }])
    for (let i = 0; i < 230; i++) get().markPayeeSelf(`payee${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + ((i / 26) | 0))}x`, true)
    expect(get().budget.payeeKinds!.length).toBeLessThanOrEqual(200)
  })
})

describe('own money is never counted by a tap that was meant for spending', () => {
  it('money that came IN cannot be approved as an expense; own money is skipped by "approve all"', () => {
    const { get } = make()
    const fd = item({ merchant: '', nature: 'ownMoney', ownKind: 'fdBreak', ownWhy: 'x', direction: 'in', person: false })
    const own = item({ merchant: 'Amazon Pay', nature: 'ownMoney', ownKind: 'selfTransfer', ownWhy: 'x', person: false })
    give(get, [fd, own])
    expect(get().approveInbox(fd.id)).toBe(false)
    expect(get().approveGroup([fd.id, own.id], 'starter-shopping')).toBe(0)
    expect(get().approveSuggested()).toBe(0)
    expect(get().budget.expenses).toHaveLength(0)
    get().rejectInbox(fd.id, true) // "Not a spend, not income": counted nowhere
    expect(get().budget.inbox!.find((i) => i.id === fd.id)).toMatchObject({ status: 'rejected', notSpend: true })
    expect(get().budget.expenses).toHaveLength(0)
  })
})

describe('saving and backup', () => {
  const full = (): ReturnType<typeof make> => {
    const t = make()
    give(t.get, [item({ nature: 'ownMoney', ownKind: 'fdBreak', ownWhy: 'Looks like a fixed deposit closing: the money came back to your account.', direction: 'in', merchant: '', mergedFrom: 2, refKey: 'abcd12ef' })])
    t.get().markPayeeSelf('rahul sharma', true)
    return t
  }
  it('own money, merged count, reference hash and payee kinds survive a save and a backup round trip', () => {
    const t = full()
    const back = migrate(JSON.parse(JSON.stringify(t.get().snapshot()))).budget
    expect(back.inbox![0]).toMatchObject({ nature: 'ownMoney', ownKind: 'fdBreak', direction: 'in', mergedFrom: 2, refKey: 'abcd12ef' })
    expect(back.payeeKinds).toEqual([{ key: 'rahul sharma', kind: 'self', at: NOW }])
    expect(sanitizeBudget(JSON.parse(JSON.stringify(back)))).toEqual(back)
    const parsed = parseBackup(buildBackup(t.get().snapshot(), new Date(NOW)))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.data.budget.payeeKinds).toEqual(back.payeeKinds)
  })
  it('a damaged file cannot invent own money or a payee kind', () => {
    const raw = { ...defaultPersisted().budget, inbox: [
      { id: 'abc123', date: '2026-11-12', amount: '5', status: 'pending', nature: 'ownMoney' }, // no kind
      { id: 'abc124', date: '2026-11-12', amount: '5', status: 'pending', nature: 'ownMoney', ownKind: 'bogus' },
      { id: 'abc125', date: '2026-11-12', amount: '5', status: 'pending', nature: 'spend', direction: 'in' }, // 'in' only with own money
      { id: 'abc126', date: '2026-11-12', amount: '5', status: 'pending', mergedFrom: 9999, refKey: '!!', ownWhy: 'x'.repeat(500) },
    ], payeeKinds: [{ key: 'ok name', kind: 'self', at: 1 }, { key: 'Bad Key', kind: 'self', at: 1 }, { key: 'good one', kind: 'wizard', at: 1 }, { key: 'ok name', kind: 'person', at: 1 }, 7] }
    const b = sanitizeBudget(raw)
    expect(b.inbox!.map((i) => [i.nature, i.ownKind, i.direction])).toEqual([[undefined, undefined, undefined], [undefined, undefined, undefined], ['spend', undefined, undefined], [undefined, undefined, undefined]])
    expect(b.inbox![3]).toMatchObject({ mergedFrom: 20 })
    expect(b.inbox![3]!.refKey).toBeUndefined()
    expect(b.payeeKinds).toEqual([{ key: 'ok name', kind: 'self', at: 1 }])
  })
})
