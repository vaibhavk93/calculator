import { describe, expect, it, vi } from 'vitest'
import { createMemoryStorage } from '../lib/storage'
import { buildBackup, parseBackup } from './backup'
import { bootStore } from './boot'
import { STORAGE_KEY, loadPersisted } from './persistence'
import { DEFAULT_SETTINGS } from './types'

const file = (data: unknown, over: object = {}) => JSON.stringify({ kind: 'vkcalc-backup', schemaVersion: 3, exportedAt: '2026-10-01T10:00:00.000Z', app: 'Calc', data, ...over })

describe('restoring a backup file (SH-K16, SH-K19, SH-K26)', () => {
  it('a settings-only backup applies its theme and empties every other area (K16)', async () => {
    const { store } = await bootStore(createMemoryStorage())
    store.getState().press('1')
    store.getState().press('+')
    store.getState().press('1')
    store.getState().press('=')
    const p = parseBackup(file({ settings: { theme: 'light' } }))
    expect(p.ok).toBe(true)
    if (!p.ok) return
    store.getState().restore(p.data)
    expect(store.getState().settings.theme).toBe('light')
    expect(store.getState().history).toEqual([])
    expect(store.getState().budget.expenses).toEqual([])
  })

  it('a restore reaches storage and loads back unchanged (K26: stored data must never be null after a restore)', async () => {
    vi.useFakeTimers()
    try {
      const src = await bootStore(createMemoryStorage())
      src.store.getState().press('2')
      src.store.getState().press('*')
      src.store.getState().press('3')
      src.store.getState().press('=')
      src.store.getState().updateSettings({ theme: 'light', reminderTime: '07:30', lastBackupAt: 1_700_000_000_000 })
      src.store.getState().markSmsSeen(['abc123', 'def456'])
      const text = buildBackup(src.store.getState().snapshot())

      const storage = createMemoryStorage()
      const dst = await bootStore(storage)
      const p = parseBackup(text)
      if (!p.ok) throw new Error(p.message)
      dst.store.getState().restore(p.data)
      await vi.advanceTimersByTimeAsync(300)

      const raw = storage.dump()[STORAGE_KEY]
      expect(raw).toBeDefined()
      const back = await loadPersisted(storage)
      expect(back.history).toEqual(src.store.getState().history)
      expect(back.settings.theme).toBe('light')
      expect(back.settings.reminderTime).toBe('07:30')
      expect(back.settings.lastBackupAt).toBe(1_700_000_000_000)
      expect(back.budget.smsSeen).toEqual(['abc123', 'def456'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('a restore never crashes on null or missing sections; the result is whole', () => {
    for (const data of [{}, { history: null, cards: null, reminders: null, budget: null, settings: null, input: null, memory: null }, { history: 5, cards: 'x', budget: [] }]) {
      const p = parseBackup(file(data))
      expect(p.ok).toBe(true)
      if (!p.ok) continue
      expect(p.data.history).toEqual([])
      expect(p.data.cards).toEqual([])
      expect(p.data.reminders).toEqual([])
      expect(p.data.budget.expenses).toEqual([])
      expect(p.data.settings).toEqual(DEFAULT_SETTINGS)
    }
  })

  it('refuses a null, missing or non-object data section in plain words', () => {
    for (const data of [null, undefined, 'x', 5]) {
      const p = parseBackup(file(data))
      expect(p).toEqual({ ok: false, message: 'That backup is damaged.' })
    }
    expect(parseBackup('[]')).toEqual({ ok: false, message: "That file isn't a Calc backup." })
    expect(parseBackup('null')).toEqual({ ok: false, message: "That file isn't a Calc backup." })
  })

  it('sanitises the fields added later when they arrive junked', () => {
    const p = parseBackup(file({ settings: { reminderTime: '99:99', lastBackupAt: 'yesterday', backupNudgedAt: -5 }, budget: { smsSeen: ['ok123', '<script>', 7, 'x'.repeat(99)] } }))
    if (!p.ok) throw new Error(p.message)
    expect(p.data.settings.reminderTime).toBe('09:00')
    expect(p.data.settings.lastBackupAt).toBeNull()
    expect(p.data.settings.backupNudgedAt).toBeNull()
    expect(p.data.budget.smsSeen).toEqual(['ok123'])
  })
})
