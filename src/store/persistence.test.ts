import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../lib/storage'
import { buildBackup, backupFilename, parseBackup } from './backup'
import {
  CURRENT_SCHEMA,
  STORAGE_KEY,
  defaultPersisted,
  loadPersisted,
  migrate,
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
      if (!r.ok) expect(r.message).toBe("That file isn't a VK Calc backup.")
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
