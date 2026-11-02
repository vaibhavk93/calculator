import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../lib/storage'
import { buildBackup, backupFilename, parseBackup } from './backup'
import {
  CURRENT_SCHEMA,
  STORAGE_KEY,
  defaultPersisted,
  loadPersisted,
  migrate,
  sanitizeCards,
  sanitizeReminders,
  sanitizeHistory,
  sanitizeInput,
  sanitizeSettings,
  savePersisted,
} from './persistence'
import { DEFAULT_SETTINGS, type PersistedData } from './types'

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
  it('names the file by date', () => {
    expect(backupFilename(new Date('2026-11-02T10:00:00Z'))).toBe('vkcalc-backup-2026-11-02.json')
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
