import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../lib/storage'
import { buildBackup, parseBackup } from './backup'
import { bootStore } from './boot'
import { BAD_KEY, CURRENT_SCHEMA, STORAGE_KEY, defaultPersisted, loadChecked, migrate, sanitizeBudget, sanitizeCards, sanitizeDrafts, sanitizeHistory, sanitizeInput, sanitizeReminders, sanitizeSettings } from './persistence'
import { DEFAULT_SETTINGS, type PersistedData } from './types'

// QA (cross-cutting): data integrity and hostile input. Written 2026-11-03. See docs/QA-REPORT-cross.md.

const DAY = '2026-11-02'
const MS = Date.now() - 3_600_000 // recent: deleted items older than TRASH_DAYS are purged when the store starts

/** Every feature and every field added up to Phase 3, each with a non-default value. */
function fullData(): PersistedData {
  const d = defaultPersisted()
  d.settings = {
    ...DEFAULT_SETTINGS,
    theme: 'light', accent: 'citron', numberSystem: 'international', decimals: 4, angle: 'rad', startupTab: 'budget', startupTool: 'emi',
    haptics: false, keepAwake: true, keepHistory: false, copyFormat: 'without',
    reminderTime: '07:45', lastBackupAt: MS, backupNudgedAt: MS - 1000, backupDismissedAt: MS - 2000,
    dismissedTips: ['tip-a', 'tip-b'], toolUse: { emi: 7, gst: 3 }, pinnedTools: ['sip'],
    tours: { budget: 'done', notes: 'skipped' },
  }
  d.history = [
    { id: 'h1', expression: '12*3', result: '36', at: MS, memo: 'Rent share', locked: true },
    { id: 'h2', expression: '1+1', result: '2', at: MS - 1 },
  ]
  d.cards = [
    { id: 'c-tool', title: 'Home loan', kind: 'tool', toolId: 'emi', inputs: { principal: '5000000', rows: [['a', 'b'], ['c', 'd']] }, summary: 'EMI', amount: '43391', amountFmt: 'money', lines: [], note: 'n', tags: ['Loan'], pinned: true, createdAt: MS, updatedAt: MS, deletedAt: null },
    { id: 'c-tape', title: 'Trip', kind: 'tape', toolId: null, inputs: null, summary: '3 lines', amount: '300', lines: [{ id: 'l1', label: 'Hotel', value: '100', done: true }, { id: 'l2', label: 'Cab', value: '100', skip: true }, { id: 'l3', label: 'Food', value: '100' }], checklist: true, note: '', tags: [], pinned: false, createdAt: MS, updatedAt: MS, deletedAt: null },
    { id: 'c-task', title: 'Pay rent', kind: 'task', toolId: null, inputs: null, summary: '', amount: null, lines: [], done: true, doneAt: MS, note: 'x', tags: ['Rent', 'Work'], pinned: false, createdAt: MS, updatedAt: MS, deletedAt: null },
    { id: 'c-trash', title: 'Old', kind: 'task', toolId: null, inputs: null, summary: '', amount: null, lines: [], note: '', tags: [], pinned: false, createdAt: MS, updatedAt: MS, deletedAt: MS },
  ]
  d.reminders = [
    { id: 'r1', cardId: 'c-task', dueAt: MS + 86400000, repeat: 'monthly', anchorDay: 5, leadDays: 7, leads: [7, 3, 0], done: false, history: [{ paidAt: MS, amount: '100' }, { paidAt: MS - 5, amount: null }] },
    { id: 'r2', cardId: 'c-tool', dueAt: MS + 2 * 86400000, repeat: 'none', anchorDay: 6, leadDays: 1, afterDays: 30, done: false, history: [] },
  ]
  d.memory = '123.45'
  d.input = { expr: '123', fresh: true }
  d.drafts = { emi: { principal: '100', rate: '9' }, sip: { rows: [['x', '1']] } }
  d.budget = {
    overall: '30000',
    overallByMonth: { '2026-11': '35000', '2026-12': null },
    categories: [
      { id: 'k1', name: 'Food', limit: '5000', parentId: null, deletedAt: null, limitByMonth: { '2026-11': '6000' }, months: ['2026-11', '2026-12'] },
      { id: 'k2', name: 'Eating out', limit: null, parentId: 'k1', deletedAt: null },
      { id: 'k3', name: 'Old', limit: null, parentId: null, deletedAt: MS },
    ],
    instruments: [
      { id: 'i1', name: 'Regalia', kind: 'credit', network: 'visa', bank: 'HDFC', last4: '1234', rewardNote: '4x', deletedAt: null, variant: 'Gold', holder: 'A', statementDay: 5, dueDay: 25, creditLimit: '200000', annualFee: '2500' },
      { id: 'i2', name: 'Salary a/c', kind: 'bank', network: null, bank: 'ICICI', last4: '9876', rewardNote: '', deletedAt: null, upiHandle: 'me@okicici', accountType: 'salary' },
    ],
    expenses: [
      { id: 'e1', date: DAY, amount: '250.50', categoryId: 'k2', mode: 'credit', instrumentId: 'i1', note: 'tea', deletedAt: null, edits: [{ at: MS, field: 'amount', from: '200', to: '250.50' }, { at: MS, field: 'category', from: null, to: 'k2' }] },
      { id: 'e2', date: DAY, amount: '500', categoryId: 'k1', mode: 'upi', instrumentId: 'i2', note: 'refund', deletedAt: null, refund: true },
      { id: 'e3', date: DAY, amount: '9000', categoryId: null, mode: 'netbanking', instrumentId: 'i1', note: 'card bill', deletedAt: null, settlement: 'cardBill' },
      { id: 'e4', date: DAY, amount: '999', categoryId: 'k1', mode: 'upi', instrumentId: null, note: 'netflix', deletedAt: MS, recurringId: 'rec1' },
    ],
    smsSeen: ['abcd1234', 'zz99yy88'],
    recurring: [
      { id: 'rec1', kind: 'bill', title: 'Netflix', amount: '999', repeat: 'monthly', categoryId: 'k1', mode: 'upi', instrumentId: 'i2', cardId: 'c-task', paused: true, pausedDue: MS, deletedAt: null },
      { id: 'rec2', kind: 'cardBill', title: 'Regalia bill', amount: null, repeat: 'monthly', categoryId: null, mode: null, instrumentId: 'i1', cardId: null, deletedAt: null },
    ],
  }
  return d
}

const clean = (v: unknown) => JSON.parse(JSON.stringify(v))
const SECTIONS = ['settings', 'history', 'cards', 'reminders', 'memory', 'input', 'budget', 'drafts'] as const

describe('QA-D1 full data set survives export and restore, section by section', () => {
  const src = fullData()
  const text = buildBackup(src)
  const parsed = parseBackup(text)
  it('parses', () => expect(parsed.ok).toBe(true))
  for (const s of SECTIONS) {
    it(`section ${s} is identical after export then restore`, () => {
      if (!parsed.ok) throw new Error('parse failed')
      expect(clean(parsed.data[s])).toEqual(clean(src[s]))
    })
  }
  it('the source set really contains every new field (the test is not vacuous)', () => {
    const j = JSON.stringify(src)
    for (const k of ['reminderTime', 'lastBackupAt', 'backupNudgedAt', 'backupDismissedAt', 'dismissedTips', 'toolUse', 'pinnedTools', 'tours', 'smsSeen', 'recurring', 'refund', 'edits', 'leads', 'afterDays', 'skip', 'done', 'checklist', 'drafts', 'overallByMonth', 'limitByMonth', 'upiHandle', 'settlement']) expect(j).toContain(`"${k}"`)
  })
  it('a second round trip is stable (restore of a restore changes nothing)', () => {
    if (!parsed.ok) throw new Error()
    const again = parseBackup(buildBackup(parsed.data))
    expect(again.ok && clean(again.data)).toEqual(clean(parsed.data))
  })
  it('goes through a real store: restore() then snapshot() then storage then boot returns the same data', async () => {
    if (!parsed.ok) throw new Error()
    const a = await bootStore(createMemoryStorage())
    a.store.getState().restore(parsed.data)
    const snap = a.store.getState().snapshot()
    expect(clean(snap)).toEqual(clean(src))
    const storage = createMemoryStorage()
    await storage.set(STORAGE_KEY, JSON.stringify(snap))
    const b = await bootStore(storage)
    expect(clean(b.store.getState().snapshot())).toEqual(clean(src))
  })
})

describe('QA-D2 old backups', () => {
  const file = (data: unknown, v: number) => JSON.stringify({ kind: 'vkcalc-backup', schemaVersion: v, exportedAt: '2026-01-01T00:00:00Z', app: 'Calc', data })
  it('v1 backup (no cards, no reminders, no budget) loads with starter categories', () => {
    const p = parseBackup(file({ settings: { theme: 'light' }, history: [{ id: 'h', expression: '1+1', result: '2', at: 1 }], memory: '5', input: { expr: '', fresh: false }, cards: [{ id: 'x', title: 'ignored by v1', kind: 'task' }] }, 1))
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.data.schemaVersion).toBe(CURRENT_SCHEMA)
    expect(p.data.history).toHaveLength(1)
    expect(p.data.cards).toEqual([]) // v1 migration blanks cards
    expect(p.data.budget.categories.length).toBeGreaterThan(5)
    expect(p.data.settings.reminderTime).toBe('09:00')
  })
  it('v2 backup keeps cards and reminders, and the new settings get defaults', () => {
    const p = parseBackup(file({ settings: { theme: 'light', haptics: false }, history: [], cards: [{ id: 'c', title: 'T', kind: 'task', toolId: null, inputs: null, summary: '', amount: null, lines: [], note: '', tags: [], pinned: false, createdAt: 1, updatedAt: 1, deletedAt: null }], reminders: [{ id: 'r', cardId: 'c', dueAt: 5, repeat: 'none', anchorDay: 1, leadDays: 3, done: false, history: [] }], memory: null, input: { expr: '', fresh: false } }, 2))
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.data.cards).toHaveLength(1)
    expect(p.data.reminders[0]!.leadDays).toBe(3)
    expect(p.data.settings.tours).toEqual({})
    expect(p.data.settings.toolUse).toEqual({})
    expect(p.data.settings.haptics).toBe(false)
  })
  it('a newer-version backup (schema 99) is read for what we understand, and marked current', () => {
    const p = parseBackup(file({ settings: { theme: 'light', futureThing: 1 }, history: [], futureSection: { a: 1 } }, 99))
    expect(p.ok && p.data.settings.theme).toBe('light')
    expect(p.ok && JSON.stringify(p.data)).not.toContain('future')
  })
  it('unknown extra fields are dropped from every section, not carried into storage', () => {
    const f = fullData()
    const j = clean(f)
    j.settings.evil = 'x'; j.history[0].evil = 'x'; j.cards[0].evil = 'x'; j.reminders[0].evil = 'x'; j.budget.evil = 'x'; j.budget.expenses[0].evil = 'x'; j.budget.categories[0].evil = 'x'; j.budget.instruments[0].evil = 'x'; j.budget.recurring[0].evil = 'x'; j.evilTop = 1
    const m = migrate(j)
    expect(JSON.stringify(m)).not.toContain('evil')
  })
})

describe('QA-F1 sanitizers never throw on junk', () => {
  // Deterministic generator of nasty values.
  let seed = 12345
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)]!
  const atoms: unknown[] = [null, undefined, 0, -1, 1e308, -1e308, NaN, Infinity, '', 'x', '123', '-5', '1e5', '0x10', true, false, [], {}, '__proto__', 'constructor', '\u0000', 'a'.repeat(10_000), Number.MAX_SAFE_INTEGER, '2026-02-30', '9'.repeat(200)]
  const keys = ['id', 'cardId', 'kind', 'toolId', 'title', 'amount', 'lines', 'inputs', 'tags', 'reminders', 'cards', 'history', 'budget', 'settings', 'expenses', 'categories', 'instruments', 'recurring', 'edits', 'leads', 'tours', 'toolUse', 'drafts', 'parentId', 'categoryId', 'instrumentId', 'date', 'mode', 'repeat', 'dueAt', 'limitByMonth', 'smsSeen', '__proto__', 'constructor', 'prototype', 'toString']
  function gen(depth: number): unknown {
    const r = rnd()
    if (depth <= 0 || r < 0.35) return pick(atoms)
    if (r < 0.6) return Array.from({ length: Math.floor(rnd() * 5) }, () => gen(depth - 1))
    const o: Record<string, unknown> = {}
    for (let i = 0; i < Math.floor(rnd() * 8); i++) Object.defineProperty(o, pick(keys), { value: gen(depth - 1), enumerable: true, configurable: true, writable: true })
    return o
  }
  it('migrate() on 3000 random structures never throws and always returns valid-shaped data', () => {
    for (let i = 0; i < 3000; i++) {
      const raw = gen(5)
      const m = migrate(raw)
      expect(m.schemaVersion).toBe(CURRENT_SCHEMA)
      expect(Array.isArray(m.history) && Array.isArray(m.cards) && Array.isArray(m.reminders)).toBe(true)
      expect(Array.isArray(m.budget.expenses) && Array.isArray(m.budget.categories)).toBe(true)
      JSON.stringify(m) // must be serialisable
    }
  })
  it('each sanitizer alone, given objects whose every field is junk', () => {
    for (let i = 0; i < 2000; i++) {
      const raw = gen(4)
      sanitizeSettings(raw); sanitizeHistory(raw); sanitizeInput(raw); sanitizeDrafts(raw); sanitizeBudget(raw)
      const cards = sanitizeCards(raw)
      sanitizeReminders(raw, cards)
      sanitizeCards([raw, raw]); sanitizeHistory([raw]); sanitizeBudget({ expenses: [raw], categories: [raw], instruments: [raw], recurring: [raw] })
    }
  })
  it.each([[null], [undefined], [0], ['str'], [[]], [[1, 2]], [true], [() => 1], [Symbol.iterator]])('migrate(%s) gives defaults', (v) => {
    expect(migrate(v)).toEqual(defaultPersisted())
  })
  it('wrong-typed top-level sections fall back to defaults, other sections survive', () => {
    const m = migrate({ settings: 5, history: 'x', cards: { a: 1 }, reminders: 7, memory: [], input: 'q', budget: [], drafts: 3 })
    expect(m.settings).toEqual(DEFAULT_SETTINGS)
    expect(m.history).toEqual([])
    expect(m.budget.categories.length).toBeGreaterThan(0)
    const m2 = migrate({ settings: { theme: 'light' }, history: 5 })
    expect(m2.settings.theme).toBe('light')
  })
})

describe('QA-F2 prototype pollution', () => {
  const hostile = '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted2":"yes"}},' +
    '"settings":{"__proto__":{"polluted3":"yes"},"toolUse":{"__proto__":5,"constructor":3},"tours":{"__proto__":"done","budget":"done"},"dismissedTips":["__proto__","constructor"],"pinnedTools":["constructor"]},' +
    '"drafts":{"__proto__":{"a":"b"},"constructor":{"x":"y"},"emi":{"__proto__":[["p"]],"constructor":"c","ok":"1"}},' +
    '"cards":[{"id":"__proto__","kind":"tool","toolId":"emi","inputs":{"__proto__":[["x"]]}}],' +
    '"budget":{"__proto__":{"polluted4":"yes"},"overallByMonth":{"__proto__":"1"},"categories":[{"id":"__proto__","name":"A","parentId":"constructor"}],"expenses":[{"id":"constructor","date":"2026-01-01","amount":"1","categoryId":"__proto__"}]}}'
  it('JSON.parse + migrate pollutes nothing global', () => {
    const m = migrate(JSON.parse(hostile))
    const probe: Record<string, unknown> = {}
    for (const k of ['polluted', 'polluted2', 'polluted3', 'polluted4']) expect(probe[k]).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(false)
    JSON.stringify(m)
  })
  it('a draft value cannot replace the prototype of the stored object (the "__proto__" key is skipped)', () => {
    const d = sanitizeDrafts(JSON.parse(hostile).drafts)
    const emi = d?.emi as Record<string, unknown> | undefined
    expect(emi).toBeDefined()
    expect(Object.getPrototypeOf(emi)).toBe(Object.prototype)
    expect(Array.isArray(emi)).toBe(false)
    expect(emi!.ok).toBe('1')
  })
  it('a saved calculator input cannot replace its own prototype either', () => {
    const c = sanitizeCards(JSON.parse(hostile).cards)
    const inputs = c[0]?.inputs
    expect(inputs).toBeDefined()
    expect(Object.getPrototypeOf(inputs)).toBe(Object.prototype)
  })
})

describe('QA-F3 size and truncation', () => {
  it('a 25 MB+ file is refused with plain words, fast', () => {
    const t0 = Date.now()
    const r = parseBackup('x'.repeat(25 * 1024 * 1024 + 1))
    expect(r.ok).toBe(false)
    expect(!r.ok && r.message).toMatch(/too large/)
    expect(Date.now() - t0).toBeLessThan(500)
  })
  it('a ~24 MB backup of junk-padded history parses without crashing, and fast enough', () => {
    const junk = Array.from({ length: 250_000 }, (_, i) => ({ id: 'h' + i, expression: '1+1', result: '2', at: i, pad: 'p'.repeat(20) }))
    const text = JSON.stringify({ kind: 'vkcalc-backup', schemaVersion: 3, data: { history: junk } })
    expect(text.length).toBeLessThan(25 * 1024 * 1024)
    const t0 = Date.now()
    const r = parseBackup(text)
    expect(r.ok).toBe(true)
    expect(r.ok && r.data.history.length).toBeLessThanOrEqual(200)
    expect(Date.now() - t0).toBeLessThan(5000)
  })
  it('huge arrays everywhere are capped', () => {
    const big = <T,>(mk: (i: number) => T, n = 60_000) => Array.from({ length: n }, (_, i) => mk(i))
    const m = migrate({
      history: big((i) => ({ id: 'h' + i, expression: '1', result: '1', at: i })),
      cards: big((i) => ({ id: 'c' + i, kind: 'task', title: 'T' + i })),
      budget: {
        categories: big((i) => ({ id: 'k' + i, name: 'C' + i })),
        instruments: big((i) => ({ id: 'i' + i, name: 'I' + i, kind: 'wallet' })),
        expenses: big((i) => ({ id: 'e' + i, date: '2026-01-01', amount: '1' }), 30_000),
        smsSeen: big((i) => 'abcd' + i.toString(36).padStart(4, '0'), 20_000),
        recurring: big((i) => ({ id: 'r' + i, kind: 'bill', title: 'B', amount: '1', repeat: 'monthly' }), 5_000),
      },
      settings: { dismissedTips: big((i) => 'tip' + i, 5000), toolUse: Object.fromEntries(big((i) => [`t${i}`, 1], 5000)), pinnedTools: big((i) => 'p' + i, 5000) },
      drafts: Object.fromEntries(big((i) => [`d${i}`, { a: 'b' }], 5000)),
    })
    expect(m.history.length).toBeLessThanOrEqual(200)
    expect(m.cards.length).toBeLessThanOrEqual(1000)
    expect(m.budget.categories.filter((c) => c.deletedAt === null).length).toBeLessThanOrEqual(60)
    expect(m.budget.instruments.length).toBeLessThanOrEqual(480)
    expect(m.budget.expenses.length).toBeLessThanOrEqual(20000)
    expect(m.budget.smsSeen!.length).toBeLessThanOrEqual(5000)
    expect(m.budget.recurring!.length).toBeLessThanOrEqual(100)
    expect(m.settings.dismissedTips.length).toBeLessThanOrEqual(20)
    expect(Object.keys(m.settings.toolUse).length).toBeLessThanOrEqual(80)
    expect(m.settings.pinnedTools.length).toBeLessThanOrEqual(3)
    expect(Object.keys(m.drafts ?? {}).length).toBeLessThanOrEqual(40)
  })
  it('truncated and non-backup text gives a plain message, never a throw', () => {
    const full = buildBackup(fullData())
    for (const cut of [0, 1, 10, 100, Math.floor(full.length / 2), full.length - 1]) {
      const r = parseBackup(full.slice(0, cut))
      expect(r.ok).toBe(false)
    }
    for (const t of ['null', '[]', '42', '"s"', '{}', '{"kind":"other"}', '{"kind":"vkcalc-backup"}', '{"kind":"vkcalc-backup","data":5}', '{"kind":"vkcalc-backup","data":null}', '{"kind":"vkcalc-backup","data":[]}']) {
      expect(() => parseBackup(t)).not.toThrow()
    }
    expect(parseBackup('{"kind":"vkcalc-backup","data":{}}').ok).toBe(true)
  })
})

describe('QA-F4 B-01: a raw copy is kept before anything overwrites unreadable data', () => {
  const rawCases: [string, string][] = [
    ['truncated JSON', buildBackup(fullData()).slice(0, 500)],
    ['not JSON at all', 'hello world'],
    ['JSON null', 'null'],
    ['JSON array', '[1,2,3]'],
    ['JSON number', '42'],
    ['JSON string', '"abc"'],
    ['empty string', ''],
  ]
  for (const [name, text] of rawCases) {
    it(`${name}: the raw text is copied to ${BAD_KEY} and the app starts`, async () => {
      const storage = createMemoryStorage({ [STORAGE_KEY]: text })
      const loaded = await loadChecked(storage)
      expect(loaded.data.schemaVersion).toBe(CURRENT_SCHEMA)
      expect(storage.dump()[BAD_KEY]).toBe(text)
      expect(loaded.failed).toBe('damaged')
    })
  }
  it('a valid file of the wrong shape (object with nothing we know) also keeps a copy', async () => {
    const text = '{"hello":"world"}'
    const storage = createMemoryStorage({ [STORAGE_KEY]: text })
    await bootStore(storage)
    // Not asserted as failure: an object with no known section may be a newer app's file. See the report.
    expect(storage.dump()[STORAGE_KEY]).toBe(text)
  })
})
