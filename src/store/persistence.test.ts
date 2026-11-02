import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../lib/storage'
import { buildBackup, backupFilename, parseBackup } from './backup'
import {
  CURRENT_SCHEMA,
  STORAGE_KEY,
  capHistory,
  defaultPersisted,
  loadPersisted,
  migrate,
  sanitizeBudget,
  sanitizeCards,
  sanitizeReminders,
  sanitizeHistory,
  sanitizeInput,
  sanitizeSettings,
  savePersisted,
} from './persistence'
import type { HistoryEntry } from './types'
import { DEFAULT_SETTINGS, starterBudget, type PersistedData } from './types'

const sample = (): PersistedData => ({
  schemaVersion: CURRENT_SCHEMA,
  settings: { ...DEFAULT_SETTINGS, theme: 'light', accent: 'sky', decimals: 2, numberSystem: 'international' },
  history: [
    { id: 'a', expression: '18450+7200', result: '25650', at: 1_700_000_000_000 },
    { id: 'b', expression: '5*-3', result: '-15', at: 1_700_000_001_000 },
  ],
  cards: [],
  reminders: [],
  memory: '42.5',
  input: { expr: '5+3', fresh: false },
  budget: starterBudget(),
})

describe('sanitizeSettings', () => {
  it('returns defaults for anything that is not an object', () => {
    for (const junk of [null, undefined, 5, 'x', [], true]) expect(sanitizeSettings(junk)).toEqual(DEFAULT_SETTINGS)
  })
  it('keeps valid values', () => {
    const s = { ...DEFAULT_SETTINGS, theme: 'system', accent: 'amber', decimals: 4, angle: 'rad', startupTab: 'saved' } as const
    expect(sanitizeSettings(s)).toEqual(s)
  })
  it('replaces invalid values field by field, keeping the valid ones', () => {
    const out = sanitizeSettings({ theme: 'neon', accent: 'sky', decimals: 99, angle: 'grad', haptics: 'yes', keepHistory: false })
    expect(out.theme).toBe(DEFAULT_SETTINGS.theme)
    expect(out.accent).toBe('sky')
    expect(out.decimals).toBe('auto')
    expect(out.angle).toBe('deg')
    expect(out.haptics).toBe(true)
    expect(out.keepHistory).toBe(false)
  })
  it.each([[-1], [11], [2.5], ['3'], [NaN]])('rejects decimals = %s', (d) => {
    expect(sanitizeSettings({ decimals: d }).decimals).toBe('auto')
  })
  it.each([[0], [10], ['auto']])('accepts decimals = %s', (d) => {
    expect(sanitizeSettings({ decimals: d }).decimals).toBe(d)
  })
})

describe('sanitizeHistory', () => {
  it('keeps well-formed entries', () => expect(sanitizeHistory(sample().history)).toEqual(sample().history))
  it('drops malformed entries without losing the good ones', () => {
    const out = sanitizeHistory([
      { id: 'ok', expression: '1+1', result: '2', at: 1 },
      { id: '', expression: '1+1', result: '2', at: 1 },
      { id: 'x', expression: '', result: '2', at: 1 },
      { id: 'y', expression: '1+1', result: 'two', at: 1 },
      { id: 'z', expression: '<script>alert(1)</script>', result: '2', at: 1 },
      'junk',
      null,
      { id: 'ok', expression: '2+2', result: '4', at: 1 }, // duplicate id
    ])
    expect(out.map((h) => h.id)).toEqual(['ok'])
  })
  it('is not an array -> empty', () => expect(sanitizeHistory('nope')).toEqual([]))
  it('caps at 200 entries', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ id: `id${i}`, expression: '1+1', result: '2', at: i }))
    expect(sanitizeHistory(many)).toHaveLength(200)
  })
  it('keeps a memo, trimmed and capped at 80 characters', () => {
    const out = sanitizeHistory([{ id: 'a', expression: '1+1', result: '2', at: 1, memo: `  ${'x'.repeat(100)}  ` }])
    expect(out[0]!.memo).toHaveLength(80)
  })
  it('a blank or non-string memo is dropped, not stored as an empty string', () => {
    const out = sanitizeHistory([
      { id: 'a', expression: '1+1', result: '2', at: 1, memo: '   ' },
      { id: 'b', expression: '1+1', result: '2', at: 1, memo: 42 },
    ])
    expect(out.every((h) => h.memo === undefined)).toBe(true)
  })
})

describe('sanitizeInput', () => {
  it('keeps a valid expression', () => expect(sanitizeInput({ expr: '5+sin(30)', fresh: false })).toEqual({ expr: '5+sin(30)', fresh: false }))
  it('"fresh" cannot be true on an empty expression', () => expect(sanitizeInput({ expr: '', fresh: true }).fresh).toBe(false))
  it('rejects hostile or oversized text', () => {
    expect(sanitizeInput({ expr: '<img src=x>' }).expr).toBe('')
    expect(sanitizeInput({ expr: '1'.repeat(501) }).expr).toBe('')
  })
  it('"fresh" cannot be true on a half-typed function call (B-16, white-screened the app)', () => {
    expect(sanitizeInput({ expr: 'sin(', fresh: true })).toEqual({ expr: 'sin(', fresh: false })
    expect(sanitizeInput({ expr: '5+3', fresh: true })).toEqual({ expr: '5+3', fresh: false })
    expect(sanitizeInput({ expr: '-12.5', fresh: true })).toEqual({ expr: '-12.5', fresh: true })
  })
})

describe('migrate', () => {
  it('null, garbage and non-objects give clean defaults', () => {
    for (const junk of [null, undefined, 3, 'str', []]) expect(migrate(junk)).toEqual(defaultPersisted())
  })
  it('a partial object is filled out with defaults', () => {
    const out = migrate({ schemaVersion: 1, settings: { theme: 'light' } })
    expect(out.settings.theme).toBe('light')
    expect(out.settings.accent).toBe(DEFAULT_SETTINGS.accent)
    expect(out.history).toEqual([])
    expect(out.memory).toBeNull()
  })
  it('reads data written by a newer app, keeping what it understands', () => {
    const out = migrate({ ...sample(), schemaVersion: 99, somethingNew: { a: 1 } })
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA)
    expect(out.history).toHaveLength(2)
    expect(out).not.toHaveProperty('somethingNew')
  })
  it('rejects a memory value that is not a plain number', () => {
    expect(migrate({ memory: '1e999' }).memory).toBeNull()
    expect(migrate({ memory: 'abc' }).memory).toBeNull()
    expect(migrate({ memory: '-3.5' }).memory).toBe('-3.5')
  })
})

describe('load and save', () => {
  it('round-trips everything', async () => {
    const storage = createMemoryStorage()
    await savePersisted(storage, sample())
    expect(await loadPersisted(storage)).toEqual(sample())
  })
  it('first run: nothing stored -> defaults', async () => {
    expect(await loadPersisted(createMemoryStorage())).toEqual(defaultPersisted())
  })
  it('corrupt JSON on disk -> defaults, no crash', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: '{not json' })
    expect(await loadPersisted(storage)).toEqual(defaultPersisted())
  })
  it('a storage that throws never breaks the app', async () => {
    const broken = {
      get: async () => {
        throw new Error('blocked')
      },
      set: async () => {
        throw new Error('full')
      },
      remove: async () => undefined,
    }
    expect(await loadPersisted(broken)).toEqual(defaultPersisted())
    await expect(savePersisted(broken, sample())).resolves.toBeUndefined()
  })
})

describe('backup and restore', () => {
  it('exports then imports without losing anything', () => {
    const text = buildBackup(sample(), new Date('2026-11-02T10:00:00Z'))
    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data).toEqual(sample())
      expect(parsed.exportedAt).toBe('2026-11-02T10:00:00.000Z')
    }
  })
  it('names the file by the phone\'s local date, not UTC', () => {
    expect(backupFilename(new Date(2026, 10, 2, 10, 0, 0))).toBe('vkcalc-backup-2026-11-02.json')
    // Past 9pm IST (UTC+5:30) is still the same local day, but would roll to the next day in UTC.
    expect(backupFilename(new Date(2026, 10, 2, 23, 30, 0))).toBe('vkcalc-backup-2026-11-02.json')
  })
  it('refuses files that are not backups, in plain words', () => {
    for (const text of ['hello', '[]', '{"a":1}', '{"kind":"something-else","data":{}}']) {
      const r = parseBackup(text)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toBe("That file isn't a Calc backup.")
    }
  })
  it('refuses a backup with no data', () => {
    const r = parseBackup('{"kind":"vkcalc-backup"}')
    expect(!r.ok && r.message).toBe('That backup is damaged.')
  })
  it('sanitises a tampered backup instead of trusting it', () => {
    const tampered = JSON.stringify({
      kind: 'vkcalc-backup',
      schemaVersion: 1,
      data: { settings: { theme: 'evil', decimals: 9999 }, history: [{ id: 'x', expression: '<b>', result: '1' }], memory: 'DROP TABLE' },
    })
    const r = parseBackup(tampered)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.settings.theme).toBe('dark')
      expect(r.data.settings.decimals).toBe('auto')
      expect(r.data.history).toEqual([])
      expect(r.data.memory).toBeNull()
    }
  })
  it('rejects an oversized file', () => {
    const r = parseBackup('x'.repeat(6 * 1024 * 1024))
    expect(r.ok).toBe(false)
  })
})

describe('schema v1 -> v2 (adds saved cards and reminders)', () => {
  // A real v1 file: what every existing user has on their phone today.
  const v1 = {
    schemaVersion: 1,
    settings: { ...DEFAULT_SETTINGS, theme: 'light' },
    history: [{ id: 'a', expression: '2+2', result: '4', at: 5 }],
    memory: '7',
    input: { expr: '9', fresh: false },
  }
  it('keeps everything the user had and starts with no cards or reminders', () => {
    const out = migrate(v1)
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA)
    expect(out.settings.theme).toBe('light')
    expect(out.history).toHaveLength(1)
    expect(out.memory).toBe('7')
    expect(out.cards).toEqual([])
    expect(out.reminders).toEqual([])
  })
})

describe('schema v2 -> v3 (adds a name on a history entry)', () => {
  // A real v2 file: cards and reminders exist, but no history entry has ever had a memo.
  const v2 = {
    schemaVersion: 2,
    settings: { ...DEFAULT_SETTINGS },
    history: [{ id: 'a', expression: '2+2', result: '4', at: 5 }],
    cards: [],
    reminders: [],
    memory: null,
    input: { expr: '', fresh: false },
  }
  it('loads with no memo, since the field is new and additive', () => {
    const out = migrate(v2)
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA)
    expect(out.history).toEqual([{ id: 'a', expression: '2+2', result: '4', at: 5 }])
    expect(out.history[0]!.memo).toBeUndefined()
  })
  it('a memo already on disk (written by a v3 build, re-read by migrate) survives', () => {
    const out = migrate({ ...v2, history: [{ id: 'a', expression: '2+2', result: '4', at: 5, memo: 'Rent' }] })
    expect(out.history[0]!.memo).toBe('Rent')
  })
})

describe('sanitizeCards and sanitizeReminders', () => {
  const card = (over: object = {}) => ({ id: 'c1', title: 'HDFC', kind: 'tool', toolId: 'emi', inputs: { principal: '1000' }, summary: 's', amount: '5000.5', note: '', tags: ['Loan'], pinned: false, createdAt: 1, updatedAt: 1, deletedAt: null, ...over })
  it('drops junk, duplicate ids, and tool cards with no tool', () => {
    expect(sanitizeCards([card(), card(), card({ id: 'c2', toolId: null }), 5, null, { id: '' }])).toHaveLength(1)
  })
  it('allows at most 5 pinned cards, and a deleted card cannot stay pinned', () => {
    const many = Array.from({ length: 7 }, (_, i) => card({ id: `p${i}`, pinned: true }))
    expect(sanitizeCards(many).filter((c) => c.pinned)).toHaveLength(5)
    expect(sanitizeCards([card({ pinned: true, deletedAt: 9 })])[0]!.pinned).toBe(false)
  })
  it('rejects a non-numeric amount and bad input values', () => {
    const c = sanitizeCards([card({ amount: 'NaN', inputs: { a: { x: 1 }, b: [['1', 2]] } })])[0]!
    expect(c.amount).toBeNull()
    expect(c.inputs).toEqual({ b: [['1', '']] })
  })
  it('a reminder with no card is dropped; bad fields fall back', () => {
    const cards = sanitizeCards([card()])
    const r = { id: 'r1', cardId: 'c1', dueAt: 1_700_000_000_000, repeat: 'weekly', anchorDay: 99, leadDays: -4, done: false, history: [] }
    expect(sanitizeReminders([r, { ...r, id: 'r2', cardId: 'gone' }], cards)).toEqual([
      { ...r, repeat: 'none', anchorDay: new Date(r.dueAt).getDate(), leadDays: 3 },
    ])
  })
})

describe('a saved amount knows what it is', () => {
  const base = { id: 'c1', kind: 'tool', toolId: 'date', title: 'Days apart', summary: '', amount: '300', lines: [], note: '', tags: [], createdAt: 1, updatedAt: 1, deletedAt: null }

  it('keeps the unit, so 300 days is not drawn as money', () => {
    expect(sanitizeCards([{ ...base, amountFmt: 'int' }])[0]!.amountFmt).toBe('int')
  })

  it('leaves it absent on a card saved before units existed, which means money', () => {
    expect(sanitizeCards([base])[0]!.amountFmt).toBeUndefined()
  })

  it('drops a unit it does not recognise rather than trusting the file', () => {
    expect(sanitizeCards([{ ...base, amountFmt: 'rupees-ish' }])[0]!.amountFmt).toBeUndefined()
  })
})

describe('checklist fields on stored lists', () => {
  const card = (over: object = {}) => ({ id: 'c1', title: 'Split', kind: 'tape', toolId: null, inputs: null, summary: '', amount: '2000', note: '', tags: [], pinned: false, createdAt: 1, updatedAt: 1, deletedAt: null, ...over })
  it('keeps the checklist flag and ticked lines, and an old list without them is simply not a checklist', () => {
    const [c] = sanitizeCards([card({ checklist: true, lines: [{ id: 'a', label: 'Ravi', value: '1000', done: true }, { id: 'b', label: 'Asha', value: '1000' }] })])
    expect(c!.checklist).toBe(true)
    expect(c!.lines).toEqual([{ id: 'a', label: 'Ravi', value: '1000', done: true }, { id: 'b', label: 'Asha', value: '1000' }])
    const [old] = sanitizeCards([card({ lines: [{ id: 'a', label: 'x', value: '5' }] })])
    expect(old!.checklist).toBeUndefined()
    expect(old!.lines[0]).not.toHaveProperty('done')
  })
  it('ignores junk in those fields', () => {
    const [c] = sanitizeCards([card({ checklist: 'yes', lines: [{ id: 'a', label: 'x', value: '5', done: 'true' }] })])
    expect(c!.checklist).toBeUndefined()
    expect(c!.lines[0]).not.toHaveProperty('done')
  })
})

describe('budget data', () => {
  it('data saved before the Budget tab existed gets the starter categories, not an error', () => {
    const { budget: _drop, ...old } = sample()
    const out = migrate(old)
    expect(out.budget.categories.length).toBeGreaterThan(5)
    expect(out.budget.expenses).toEqual([])
  })
  it('drops damaged entries and keeps the good ones', () => {
    const out = migrate({
      ...sample(),
      budget: {
        overall: '-5',
        categories: [{ id: 'c1', name: 'Food', limit: '4000', deletedAt: null }, { id: '', name: 'x' }, { id: 'c2', name: '   ' }],
        expenses: [
          { id: 'e1', date: '2026-11-02', amount: '120.50', categoryId: 'c1', mode: 'upi', note: 'tea', deletedAt: null },
          { id: 'e2', date: '2026-13-40', amount: '5', categoryId: 'c1' },
          { id: 'e3', date: '2026-11-02', amount: '-5', categoryId: 'c1' },
          { id: 'e4', date: '2026-11-03', amount: '9', categoryId: 'nope', mode: 'bitcoin' },
        ],
      },
    })
    expect(out.budget.overall).toBeNull()
    expect(out.budget.categories.map((c) => c.id)).toEqual(['c1'])
    expect(out.budget.expenses.map((e) => e.id)).toEqual(['e1', 'e4'])
    // An entry whose category is gone stays, as Uncategorised.
    expect(out.budget.expenses[1]!.categoryId).toBeNull()
    // A known mode is kept; an unknown or missing one becomes null.
    expect(out.budget.expenses.map((e) => e.mode)).toEqual(['upi', null])
  })
  it('old data without parentId, instruments or instrumentId loads unchanged, with safe defaults', () => {
    const out = migrate({
      ...sample(),
      budget: {
        overall: '500',
        categories: [{ id: 'c1', name: 'Food', limit: '4000', deletedAt: null }],
        expenses: [{ id: 'e1', date: '2026-11-02', amount: '120.50', categoryId: 'c1', mode: 'upi', note: 'tea', deletedAt: null }],
      },
    })
    expect(out.budget.categories).toEqual([{ id: 'c1', name: 'Food', limit: '4000', parentId: null, deletedAt: null }])
    expect(out.budget.instruments).toEqual([])
    expect(out.budget.expenses[0]).toMatchObject({ id: 'e1', mode: 'upi', instrumentId: null, amount: '120.50' })
  })
  it('a budget with none of the new fields round-trips equal', () => {
    const budget = {
      overall: '500',
      categories: [{ id: 'c1', name: 'Food', limit: '4000', parentId: null, deletedAt: null }, { id: 'c2', name: 'Swiggy', limit: null, parentId: 'c1', deletedAt: null }],
      instruments: [{ id: 'i1', name: 'Neo', kind: 'credit', network: 'rupay', bank: 'Tata', last4: '1234', rewardNote: '', deletedAt: null }],
      expenses: [{ id: 'e1', date: '2026-11-02', amount: '120.50', categoryId: 'c2', mode: 'credit', instrumentId: 'i1', note: 'tea', deletedAt: null }],
    }
    expect(sanitizeBudget(JSON.parse(JSON.stringify(budget)))).toEqual(budget)
    expect(sanitizeBudget(sanitizeBudget(budget))).toEqual(budget)
  })
  it('keeps month limits, category months, card details and settlements; drops damaged ones', () => {
    const out = sanitizeBudget({
      overall: '500',
      overallByMonth: { '2026-11': '900', '2026-12': null, 'nov': '5', '2027-01': '-4' },
      categories: [
        { id: 'p', name: 'Diwali', limit: null, deletedAt: null, months: ['2026-12', '2026-11', 'x', '2026-11'], limitByMonth: { '2026-11': '100', bad: '1' } },
        { id: 'k', name: 'Sweets', limit: null, parentId: 'p', deletedAt: null, months: ['2027-05'] }, // outside its parent: follows the parent
        { id: 'k2', name: 'Lamps', limit: null, parentId: 'p', deletedAt: null, months: ['2026-11'] },
      ],
      instruments: [
        { id: 'cc', name: 'HDFC', kind: 'credit', variant: 'Regalia', holder: 'A', statementDay: 5, dueDay: 29, creditLimit: '200000', annualFee: '-1', upiHandle: 'a@b', accountType: 'savings' },
        { id: 'bk', name: 'Savings', kind: 'bank', upiHandle: 'me@okhdfc', accountType: 'salary', creditLimit: '5' },
      ],
      expenses: [
        { id: 'e1', date: '2026-11-20', amount: '100', categoryId: 'p', instrumentId: 'cc', settlement: 'cardBill' },
        { id: 'e2', date: '2026-11-21', amount: '100', instrumentId: 'bk', mode: 'upi', settlement: 'weird' },
      ],
    })
    expect(out.overallByMonth).toEqual({ '2026-11': '900', '2026-12': null })
    expect(out.categories[0]).toMatchObject({ months: ['2026-11', '2026-12'], limitByMonth: { '2026-11': '100' } })
    expect('months' in out.categories[1]!).toBe(false)
    expect(out.categories[2]!.months).toEqual(['2026-11'])
    expect(out.instruments[0]).toMatchObject({ variant: 'Regalia', holder: 'A', statementDay: 5, creditLimit: '200000' })
    expect(out.instruments[0]).not.toHaveProperty('dueDay')
    expect(out.instruments[0]).not.toHaveProperty('annualFee')
    expect(out.instruments[0]).not.toHaveProperty('upiHandle')
    expect(out.instruments[0]).not.toHaveProperty('accountType')
    expect(out.instruments[1]).toMatchObject({ upiHandle: 'me@okhdfc', accountType: 'salary' })
    expect(out.instruments[1]).not.toHaveProperty('creditLimit')
    expect(out.expenses[0]).toMatchObject({ settlement: 'cardBill', categoryId: null, instrumentId: 'cc' })
    expect(out.expenses[1]).toMatchObject({ mode: 'upi', instrumentId: 'bk' })
    expect(out.expenses[1]).not.toHaveProperty('settlement')
  })
  it('keeps two-level categories; flattens deeper, missing and circular parents', () => {
    const c = (id: string, parentId?: unknown, deletedAt: number | null = null) => ({ id, name: id, limit: null, parentId, deletedAt })
    const out = migrate({
      ...sample(),
      budget: {
        categories: [c('kid', 'top'), c('top'), c('grand', 'kid'), c('lost', 'nope'), c('self', 'self'), c('a', 'b'), c('b', 'a'), c('dtop', undefined, 9), c('dkid', 'dtop')],
        expenses: [],
      },
    })
    const p = Object.fromEntries(out.budget.categories.map((x) => [x.id, x.parentId]))
    expect(p).toEqual({ kid: 'top', top: null, grand: null, lost: null, self: null, a: null, b: null, dtop: null, dkid: 'dtop' })
    // A child of a deleted parent is deleted with it.
    expect(out.budget.categories.find((x) => x.id === 'dkid')!.deletedAt).toBe(9)
  })
  it('sanitizes instruments and ties entries to them only when the pair is valid', () => {
    const i = (o: Record<string, unknown>) => ({ id: 'x', name: 'Card', kind: 'credit', network: 'rupay', bank: 'Tata', last4: '1234', rewardNote: 'note', deletedAt: null, ...o })
    const e = (id: string, mode: unknown, instrumentId: unknown) => ({ id, date: '2026-11-02', amount: '1', categoryId: null, mode, instrumentId, note: '', deletedAt: null })
    const out = migrate({
      ...sample(),
      budget: {
        instruments: [
          i({ id: 'neo' }),
          i({ id: 'visa', network: 'visa' }),
          i({ id: 'w', kind: 'wallet', network: 'visa', last4: '12', bank: 'b'.repeat(99), rewardNote: 'r'.repeat(999) }),
          i({ id: 'gone', deletedAt: 5 }),
          i({ id: 'neo' }), // duplicate id
          i({ id: 'bad', kind: 'crypto' }),
          i({ id: 'noname', name: '  ' }),
          i({ id: 'badnet', network: 'discover' }),
        ],
        expenses: [e('1', 'upi', 'neo'), e('2', 'upi', 'visa'), e('3', 'cash', 'neo'), e('4', 'credit', 'gone'), e('5', 'credit', 'ghost'), e('6', null, 'neo'), e('7', 'wallet', 'w'), e('8', 'credit', 'neo')],
      },
    })
    expect(out.budget.instruments.map((x) => x.id)).toEqual(['neo', 'visa', 'w', 'gone', 'badnet'])
    const w = out.budget.instruments.find((x) => x.id === 'w')!
    expect(w).toMatchObject({ network: null, last4: '' })
    expect(w.bank).toHaveLength(40)
    expect(w.rewardNote).toHaveLength(200)
    expect(out.budget.instruments.find((x) => x.id === 'badnet')!.network).toBeNull()
    // UPI from RuPay credit stays; UPI from Visa credit, cash+instrument, deleted, unknown, no mode all lose the instrument but the entry stays.
    expect(out.budget.expenses.map((x) => x.instrumentId)).toEqual(['neo', null, null, null, null, null, 'w', 'neo'])
    expect(out.budget.expenses.map((x) => x.mode)).toEqual(['upi', 'upi', 'cash', 'credit', 'credit', null, 'wallet', 'credit'])
  })
  it('a non-array instruments field is ignored', () => {
    expect(migrate({ ...sample(), budget: { instruments: 'x', categories: [], expenses: [] } }).budget.instruments).toEqual([])
  })
})

describe('capHistory', () => {
  const row = (id: string, o: Partial<HistoryEntry> = {}): HistoryEntry => ({ id, expression: '1+1', result: '2', at: 0, ...o })

  it('does nothing under the cap', () => {
    const entries = [row('a'), row('b')]
    expect(capHistory(entries, 200)).toEqual(entries)
  })

  it('evicts the oldest unkept row first, newest-first order kept', () => {
    const entries = [row('new'), row('old')]
    expect(capHistory(entries, 1).map((e) => e.id)).toEqual(['new'])
  })

  it('never evicts a named or locked row, even past the cap', () => {
    const entries = [row('new'), row('named', { memo: 'kept' }), row('old')]
    expect(capHistory(entries, 1).map((e) => e.id).sort()).toEqual(['named', 'new'])
  })

  it('a brand-new row survives even when every other row is already kept (CALC-254)', () => {
    // Found by e2e/calculator.test.mjs: 200 locked rows plus a fresh calculation used to
    // evict the fresh one immediately, since there was no room left to reserve for it.
    const kept = Array.from({ length: 200 }, (_, i) => row(`k${i}`, { locked: true }))
    const out = capHistory([row('brand-new'), ...kept], 200)
    expect(out.some((e) => e.id === 'brand-new')).toBe(true)
    expect(out).toHaveLength(201) // one over the cap: all 200 are kept, plus the reserved newest
  })

  it('the newest row is reserved even when it is itself the only kept one', () => {
    const entries = [row('new', { memo: 'kept' }), ...Array.from({ length: 5 }, (_, i) => row(`u${i}`))]
    const out = capHistory(entries, 3)
    expect(out[0]!.id).toBe('new')
    expect(out).toHaveLength(3)
  })
})
