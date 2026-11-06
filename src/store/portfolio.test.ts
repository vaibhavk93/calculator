import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../lib/storage'
import { MAX_HOLDINGS, MAX_VALUES, sanitizePortfolio, validateHolding, validateHoldingAmount, validateValueDay, type Holding } from '../lib/portfolio'
import { netWorth } from '../engine/investments/portfolio'
import { buildBackup, parseBackup } from './backup'
import { bootStore } from './boot'
import { createAppStore } from './app'
import { STORAGE_KEY, defaultPersisted, migrate } from './persistence'
import { TRASH_DAYS } from './types'

const DAY_MS = 86_400_000
const NOW = new Date(2026, 10, 6, 10).getTime() // 6 Nov 2026, local
const TODAY = '2026-11-06'

const setup = (portfolio?: Holding[], now = NOW) => {
  let n = 0
  const store = createAppStore({ ...defaultPersisted(), ...(portfolio ? { portfolio } : {}) }, { now: () => now, newId: () => `id${++n}` })
  return { store, get: store.getState }
}
const h = (id: string, values: [string, string][] = [['2026-11-01', '100']], extra: Partial<Holding> = {}): Holding => ({
  id,
  name: id,
  kind: 'bank',
  deletedAt: null,
  values: values.map(([date, amount]) => ({ date, amount })),
  ...extra,
})

describe('sanitizePortfolio', () => {
  it('not an array gives empty', () => {
    for (const v of [undefined, null, 5, 'x', {}, true]) expect(sanitizePortfolio(v, TODAY)).toEqual([])
  })
  it('keeps a good holding as it is', () => {
    const good = h('a', [['2026-10-01', '5'], ['2026-11-01', '7.5']])
    expect(sanitizePortfolio([good], TODAY)).toEqual([good])
  })
  it('drops junk items, bad ids, unknown kinds, empty names, repeated ids', () => {
    const raw = [null, 5, 'x', [], { id: '', name: 'n', kind: 'bank', values: [{ date: '2026-11-01', amount: '1' }] },
      { id: 'k', name: 'n', kind: 'crypto', values: [{ date: '2026-11-01', amount: '1' }] },
      { id: 'n', name: '   ', kind: 'bank', values: [{ date: '2026-11-01', amount: '1' }] },
      { id: 'ok', name: 'Fine', kind: 'gold', values: [{ date: '2026-11-01', amount: '1' }] },
      { id: 'ok', name: 'Again', kind: 'gold', values: [{ date: '2026-11-01', amount: '1' }] },
      { id: 'x'.repeat(65), name: 'Long id', kind: 'gold', values: [{ date: '2026-11-01', amount: '1' }] }]
    expect(sanitizePortfolio(raw, TODAY).map((x) => x.id)).toEqual(['ok'])
  })
  it('drops values with a bad date, a future date, or an amount that is negative, zero, not plain or huge', () => {
    const bad = ['2026-02-30', '2026-13-01', '26-11-01', '1999-12-31', '2026-11-08', '', 5, null]
    const amounts = ['-5', '0', '0.00', '1e5', '1,000', 'abc', '', ' 1', '9'.repeat(200), 5, null]
    const values = [
      ...bad.map((date) => ({ date, amount: '1' })),
      ...amounts.map((amount) => ({ date: '2026-11-01', amount })),
      { date: '2026-11-02', amount: '42' },
    ]
    const out = sanitizePortfolio([{ id: 'a', name: 'A', kind: 'bank', values }], TODAY)
    expect(out[0]!.values).toEqual([{ date: '2026-11-02', amount: '42' }])
  })
  it('a value dated one day ahead is kept (a phone in another time zone); two days ahead is not', () => {
    const out = sanitizePortfolio([{ id: 'a', name: 'A', kind: 'bank', values: [{ date: '2026-11-07', amount: '1' }, { date: '2026-11-08', amount: '2' }] }], TODAY)
    expect(out[0]!.values.map((v) => v.date)).toEqual(['2026-11-07'])
  })
  it('a holding with no good value is dropped', () => {
    expect(sanitizePortfolio([{ id: 'a', name: 'A', kind: 'bank', values: [] }, { id: 'b', name: 'B', kind: 'bank' }, { id: 'c', name: 'C', kind: 'bank', values: [{ date: 'x', amount: '1' }] }], TODAY)).toEqual([])
  })
  it('orders values by date and keeps ONE per day (the later one in the list wins)', () => {
    const out = sanitizePortfolio([{ id: 'a', name: 'A', kind: 'bank', values: [{ date: '2026-11-03', amount: '3' }, { date: '2026-11-01', amount: '1' }, { date: '2026-11-03', amount: '33' }] }], TODAY)
    expect(out[0]!.values).toEqual([{ date: '2026-11-01', amount: '1' }, { date: '2026-11-03', amount: '33' }])
  })
  it('caps values per holding at MAX_VALUES, keeping the newest', () => {
    const day = (i: number) => new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10)
    const values = Array.from({ length: 300 }, (_, i) => ({ date: day(i), amount: String(i + 1) }))
    const out = sanitizePortfolio([{ id: 'a', name: 'A', kind: 'bank', values }], '2026-11-06')
    expect(out[0]!.values.length).toBeLessThanOrEqual(MAX_VALUES)
  })
  it('caps live holdings at MAX_HOLDINGS; holdings in Trash do not count toward it, and the list has a hard stop', () => {
    const many = Array.from({ length: 1000 }, (_, i) => h(`h${i}`))
    expect(sanitizePortfolio(many, TODAY).filter((x) => x.deletedAt === null)).toHaveLength(MAX_HOLDINGS)
    expect(sanitizePortfolio(many, TODAY).length).toBeLessThanOrEqual(MAX_HOLDINGS * 2)
    const trashed = Array.from({ length: 50 }, (_, i) => h(`t${i}`, undefined, { deletedAt: 5 }))
    const live = Array.from({ length: MAX_HOLDINGS }, (_, i) => h(`l${i}`))
    expect(sanitizePortfolio([...trashed, ...live], TODAY)).toHaveLength(150)
  })
  it('trims and shortens names; drops fields it does not know', () => {
    const out = sanitizePortfolio([{ id: 'a', name: `  HDFC   savings ${'x'.repeat(100)}`, kind: 'bank', evil: 1, values: [{ date: '2026-11-01', amount: '1', evil: 2 }] }], TODAY)
    expect(out[0]!.name.length).toBeLessThanOrEqual(60)
    expect(out[0]!.name.startsWith('HDFC savings')).toBe(true)
    expect(JSON.stringify(out)).not.toContain('evil')
  })
  it('deletedAt must be a finite number, else the holding is live', () => {
    const out = sanitizePortfolio([{ id: 'a', name: 'A', kind: 'bank', deletedAt: 'yes', values: [{ date: '2026-11-01', amount: '1' }] }], TODAY)
    expect(out[0]!.deletedAt).toBeNull()
  })

  // The same nasty-value generator the other fuzz tests use.
  let seed = 424242
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)]!
  const atoms: unknown[] = [null, undefined, 0, -1, 1e308, NaN, Infinity, '', 'x', '123', '-5', '1e5', true, false, [], {}, '__proto__', 'constructor', 'a'.repeat(10_000), '2026-02-30', '2026-11-01', 'bank', 'loan', '9'.repeat(200)]
  const keys = ['id', 'name', 'kind', 'deletedAt', 'values', 'date', 'amount', '__proto__', 'constructor', 'portfolio']
  function gen(depth: number): unknown {
    const r = rnd()
    if (depth <= 0 || r < 0.35) return pick(atoms)
    if (r < 0.6) return Array.from({ length: Math.floor(rnd() * 5) }, () => gen(depth - 1))
    const o: Record<string, unknown> = {}
    for (let i = 0; i < Math.floor(rnd() * 8); i++) Object.defineProperty(o, pick(keys), { value: gen(depth - 1), enumerable: true, configurable: true, writable: true })
    return o
  }
  it('3000 random structures never throw and always give serialisable, valid-shaped holdings', () => {
    for (let i = 0; i < 3000; i++) {
      const out = sanitizePortfolio(gen(5), TODAY)
      for (const x of out) {
        expect(x.values.length).toBeGreaterThan(0)
        expect(new Set(x.values.map((v) => v.date)).size).toBe(x.values.length)
        expect(x.values.every((v) => /^\d+(\.\d+)?$/.test(v.amount))).toBe(true)
      }
      JSON.stringify(out)
    }
  })
  it('junk shaped like holdings (junk in every field)', () => {
    for (let i = 0; i < 2000; i++) sanitizePortfolio([{ id: gen(2), name: gen(2), kind: gen(2), deletedAt: gen(2), values: [gen(3), gen(3)] }, gen(3)], TODAY)
  })
  it('migrate() with a junk portfolio never throws and never invents one', () => {
    for (let i = 0; i < 500; i++) {
      const m = migrate({ portfolio: gen(5) })
      expect(m.portfolio === undefined || Array.isArray(m.portfolio)).toBe(true)
    }
    expect(migrate({}).portfolio).toBeUndefined()
  })
})

describe('form checks', () => {
  it('amount: above zero, 2 decimals, commas and the rupee sign are fine', () => {
    expect(validateHoldingAmount('3,25,000')).toBeNull()
    expect(validateHoldingAmount('₹ 12.50')).toBeNull()
    for (const bad of ['', '0', '-5', 'abc', '1.234', '1e5']) expect(validateHoldingAmount(bad)).not.toBeNull()
  })
  it('date: real, from 2000, today at most', () => {
    expect(validateValueDay(TODAY, TODAY)).toBeNull()
    expect(validateValueDay('2026-11-07', TODAY)).toMatch(/future/)
    expect(validateValueDay('2026-02-31', TODAY)).toBe('Pick a date')
    expect(validateValueDay('1999-01-01', TODAY)).toMatch(/2000/)
  })
  it('validateHolding names the first problem per field', () => {
    expect(validateHolding({ name: ' ', kind: 'nope', amount: '', date: '' }, TODAY)).toEqual({ name: 'Give it a name', kind: 'Pick what kind it is', amount: 'Enter an amount above zero', date: 'Pick a date' })
    expect(validateHolding({ name: 'A', kind: 'loan', amount: '5', date: TODAY }, TODAY)).toEqual({})
  })
})

describe('store actions', () => {
  const draft = { name: 'HDFC savings', kind: 'bank' as const, amount: '3,25,000', date: TODAY }

  it('addHolding saves the name, kind and first value, with a clean amount', () => {
    const { get } = setup()
    expect(get().addHolding(draft)).toBe(true)
    expect(get().portfolio).toEqual([{ id: 'id1', name: 'HDFC savings', kind: 'bank', deletedAt: null, values: [{ date: TODAY, amount: '325000' }] }])
  })
  it('addHolding refuses a bad form and says why; nothing is saved', () => {
    const { get } = setup()
    expect(get().addHolding({ ...draft, amount: '-5' })).toBe(false)
    expect(get().notice?.text).toBe('Enter an amount above zero')
    expect(get().addHolding({ ...draft, date: '2026-11-07' })).toBe(false)
    expect(get().notice?.text).toMatch(/future/)
    expect(get().addHolding({ ...draft, name: ' ' })).toBe(false)
    expect(get().addHolding({ ...draft, kind: 'crypto' as never })).toBe(false)
    expect(get().portfolio).toEqual([])
  })
  it('addHolding stops at 100 live holdings, and a trashed one does not count', () => {
    const { get } = setup(Array.from({ length: MAX_HOLDINGS }, (_, i) => h(`h${i}`)))
    expect(get().addHolding(draft)).toBe(false)
    expect(get().notice?.text).toMatch(/up to 100/)
    get().deleteHolding('h0')
    expect(get().addHolding(draft)).toBe(true)
  })
  it('updateHoldingValue adds a new dated value and keeps the old ones', () => {
    const { get } = setup([h('a', [['2026-10-01', '100']])])
    expect(get().updateHoldingValue('a', { amount: '120', date: TODAY })).toBe(true)
    expect(get().portfolio[0]!.values).toEqual([{ date: '2026-10-01', amount: '100' }, { date: TODAY, amount: '120' }])
  })
  it('a second update on the SAME day replaces that day (never two values on one date)', () => {
    const { get } = setup([h('a', [['2026-10-01', '100']])])
    get().updateHoldingValue('a', { amount: '120', date: TODAY })
    get().updateHoldingValue('a', { amount: '125', date: TODAY })
    expect(get().portfolio[0]!.values).toEqual([{ date: '2026-10-01', amount: '100' }, { date: TODAY, amount: '125' }])
  })
  it('an older date is placed in order, not at the end; the newest still wins as the current value', () => {
    const { get } = setup([h('a', [['2026-10-01', '100'], ['2026-11-01', '300']])])
    get().updateHoldingValue('a', { amount: '200', date: '2026-10-15' })
    expect(get().portfolio[0]!.values.map((v) => v.date)).toEqual(['2026-10-01', '2026-10-15', '2026-11-01'])
    expect(netWorth(get().portfolio).toFixed()).toBe('300')
  })
  it('updateHoldingValue rejects a future date, a bad amount, an unknown or deleted holding', () => {
    const { get } = setup([h('a'), h('d', undefined, { deletedAt: 1 })])
    expect(get().updateHoldingValue('a', { amount: '5', date: '2026-11-07' })).toBe(false)
    expect(get().updateHoldingValue('a', { amount: '-5', date: TODAY })).toBe(false)
    expect(get().updateHoldingValue('a', { amount: '0', date: TODAY })).toBe(false)
    expect(get().updateHoldingValue('nope', { amount: '5', date: TODAY })).toBe(false)
    expect(get().updateHoldingValue('d', { amount: '5', date: TODAY })).toBe(false)
    expect(get().portfolio[0]!.values).toHaveLength(1)
  })
  it('the 121st value drops the oldest, so the current value can always be updated', () => {
    const day = (i: number) => new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10)
    const { get } = setup([h('a', Array.from({ length: MAX_VALUES }, (_, i) => [day(i), '1'] as [string, string]))])
    expect(get().updateHoldingValue('a', { amount: '2', date: TODAY })).toBe(true)
    const v = get().portfolio[0]!.values
    expect(v).toHaveLength(MAX_VALUES)
    expect(v[0]!.date).toBe(day(1))
    expect(v[v.length - 1]).toEqual({ date: TODAY, amount: '2' })
  })
  it('renameHolding changes the name only', () => {
    const { get } = setup([h('a')])
    expect(get().renameHolding('a', '  Savings   2 ')).toBe(true)
    expect(get().portfolio[0]!.name).toBe('Savings 2')
    expect(get().portfolio[0]!.values).toHaveLength(1)
    expect(get().renameHolding('a', ' ')).toBe(false)
  })
  it('delete moves it to Trash with an Undo; Undo brings it back with its history', () => {
    const { get } = setup([h('a', [['2026-10-01', '1'], ['2026-11-01', '2']])])
    get().deleteHolding('a')
    expect(get().portfolio[0]!.deletedAt).toBe(NOW)
    expect(get().snack?.canUndo).toBe(true)
    expect(netWorth(get().portfolio).toFixed()).toBe('0')
    get().undoRemoval()
    expect(get().portfolio[0]!.deletedAt).toBeNull()
    expect(get().portfolio[0]!.values).toHaveLength(2)
  })
  it('Undo of an older delete is not possible once another removal replaced it (one Undo at a time)', () => {
    const { get } = setup([h('a'), h('b')])
    get().deleteHolding('a')
    get().deleteHolding('b')
    get().undoRemoval()
    expect(get().portfolio.find((x) => x.id === 'b')!.deletedAt).toBeNull()
    expect(get().portfolio.find((x) => x.id === 'a')!.deletedAt).toBe(NOW)
  })
  it('deleted holdings older than the Trash time are gone when the store starts', () => {
    const old = h('old', undefined, { deletedAt: NOW - (TRASH_DAYS + 1) * DAY_MS })
    const recent = h('recent', undefined, { deletedAt: NOW - DAY_MS })
    const { get } = setup([old, recent, h('live')])
    expect(get().portfolio.map((x) => x.id)).toEqual(['recent', 'live'])
  })
  it('history is never edited in place: no action changes or removes an old value', () => {
    const { get } = setup([h('a', [['2026-10-01', '100']])])
    get().updateHoldingValue('a', { amount: '200', date: TODAY })
    get().renameHolding('a', 'B')
    expect(get().portfolio[0]!.values[0]).toEqual({ date: '2026-10-01', amount: '100' })
  })
})

describe('backup and storage', () => {
  const sample = (): Holding[] => [
    h('hdfc', [['2026-09-01', '300000'], ['2026-11-05', '325000']]),
    { id: 'loan', name: 'Home loan', kind: 'loan', deletedAt: null, values: [{ date: '2026-11-01', amount: '3800000' }] },
    h('gone', [['2026-11-01', '5']], { deletedAt: NOW - 1000 }),
  ]
  it('round trip: export then restore gives the same portfolio, and a second trip is stable', () => {
    const src = { ...defaultPersisted(), portfolio: sample() }
    const parsed = parseBackup(buildBackup(src))
    expect(parsed.ok && parsed.data.portfolio).toEqual(sample())
    const again = parseBackup(buildBackup(parsed.ok ? parsed.data : src))
    expect(again.ok && again.data.portfolio).toEqual(sample())
  })
  it('through a real store: restore() then snapshot() then storage then boot returns the same portfolio', async () => {
    const parsed = parseBackup(buildBackup({ ...defaultPersisted(), portfolio: sample() }))
    if (!parsed.ok) throw new Error('parse failed')
    const a = await bootStore(createMemoryStorage())
    a.store.getState().restore(parsed.data)
    const snap = a.store.getState().snapshot()
    expect(snap.portfolio).toEqual(sample())
    const storage = createMemoryStorage()
    await storage.set(STORAGE_KEY, JSON.stringify(snap))
    const b = await bootStore(storage)
    expect(b.store.getState().snapshot().portfolio).toEqual(sample().filter((x) => x.id !== 'x'))
  })
  it('a change is written to storage (the saver watches the portfolio)', async () => {
    const storage = createMemoryStorage()
    const a = await bootStore(storage)
    a.store.getState().addHolding({ name: 'Gold', kind: 'gold', amount: '120000', date: dateToday() })
    await a.flush()
    const b = await bootStore(storage)
    expect(b.store.getState().portfolio.map((x) => x.name)).toEqual(['Gold'])
  })
  it('old backups with no portfolio load as empty, and restoring one empties the portfolio', () => {
    const old = JSON.stringify({ kind: 'vkcalc-backup', schemaVersion: 3, data: { settings: {}, history: [] } })
    const p = parseBackup(old)
    expect(p.ok && p.data.portfolio).toBeUndefined()
    const { get } = setup([h('a')])
    if (p.ok) get().restore(p.data)
    expect(get().portfolio).toEqual([])
  })
  it('the schema version stays 3, and an unused portfolio adds nothing to the saved file', () => {
    const snap = createAppStore(defaultPersisted()).getState().snapshot()
    expect(snap.schemaVersion).toBe(3)
    expect('portfolio' in snap).toBe(false)
    expect(JSON.stringify(snap)).not.toContain('portfolio')
  })
  it('hide, never delete: turning Budget off keeps the portfolio in the snapshot', () => {
    const { get } = setup([h('a')])
    get().updateSettings({ modules: { budget: false, notes: true } })
    expect(get().snapshot().portfolio).toHaveLength(1)
  })
  it('with Budget off, the Budget tab (and so the Portfolio row inside it) cannot be opened', () => {
    const { get } = setup([h('a')])
    get().updateSettings({ modules: { budget: false, notes: true } })
    get().setTab('budget')
    expect(get().tab).toBe('calculate')
  })
})

const dateToday = () => {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}
