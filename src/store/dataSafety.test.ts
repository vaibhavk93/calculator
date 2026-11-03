import { describe, expect, it, vi } from 'vitest'
import { createMemoryStorage, type KeyValueStorage } from '../lib/storage'
import { buildBackup, parseBackup } from './backup'
import { bootStore } from './boot'
import { BAD_KEY, STORAGE_KEY, defaultPersisted, sanitizeBudget } from './persistence'
import { starterBudget } from './types'

// Regression tests for docs/REVIEW-BUGS-STATIC.md B-01, B-02, B-03.

const goodText = () => {
  const d = defaultPersisted()
  d.budget = { ...d.budget, expenses: [{ id: 'e1', date: '2026-11-01', amount: '500', categoryId: null, mode: null, instrumentId: null, note: 'keep me', deletedAt: null }] }
  return JSON.stringify(d)
}

describe('B-01: a failed or damaged load never destroys the saved data', () => {
  it('a damaged file is copied aside before the app starts empty, and is not replaced until something changes', async () => {
    const damaged = goodText().slice(0, 300) // cut off mid-way: not valid JSON
    const storage = createMemoryStorage({ [STORAGE_KEY]: damaged })
    const { flush } = await bootStore(storage)
    expect(storage.dump()[BAD_KEY]).toBe(damaged)
    await flush() // what the "app hidden" event does
    expect(storage.dump()[STORAGE_KEY]).toBe(damaged) // untouched: nothing was changed yet
  })

  it('once the person changes something, the new data is saved (the copy stays)', async () => {
    vi.useFakeTimers()
    try {
      const damaged = '{"not json'
      const storage = createMemoryStorage({ [STORAGE_KEY]: damaged })
      const { store } = await bootStore(storage)
      store.getState().press('7')
      await vi.advanceTimersByTimeAsync(300)
      expect(JSON.parse(storage.dump()[STORAGE_KEY]!).input.expr).toBe('7')
      expect(storage.dump()[BAD_KEY]).toBe(damaged)
    } finally {
      vi.useRealTimers()
    }
  })

  it('storage that throws on read is never written over, even after a change', async () => {
    vi.useFakeTimers()
    try {
      const real = createMemoryStorage({ [STORAGE_KEY]: goodText() })
      const flaky: KeyValueStorage = { ...real, get: async () => { throw new Error('storage busy') } }
      const { store, flush } = await bootStore(flaky)
      store.getState().press('7')
      await vi.advanceTimersByTimeAsync(300)
      await flush()
      expect(real.dump()[STORAGE_KEY]).toContain('keep me')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('B-02: only live items count toward the limits when loading', () => {
  it('keeps 50 live categories after 40 deleted ones were added and removed', () => {
    const cats = [
      ...Array.from({ length: 40 }, (_, i) => ({ id: `d${i}`, name: `Old ${i}`, limit: null, parentId: null, deletedAt: 5 })),
      ...Array.from({ length: 50 }, (_, i) => ({ id: `l${i}`, name: `Live ${i}`, limit: null, parentId: null, deletedAt: null })),
    ]
    const b = sanitizeBudget({ ...starterBudget(), categories: cats, expenses: [{ id: 'e', date: '2026-11-01', amount: '9', categoryId: 'l49', note: '', deletedAt: null }] })
    expect(b.categories.filter((c) => c.deletedAt === null)).toHaveLength(50)
    expect(b.expenses[0]!.categoryId).toBe('l49') // not cut off, so not turned into Uncategorised
  })

  it('still stops a damaged file from growing without end', () => {
    const cats = Array.from({ length: 2000 }, (_, i) => ({ id: `d${i}`, name: `Old ${i}`, limit: null, parentId: null, deletedAt: 5 }))
    expect(sanitizeBudget({ ...starterBudget(), categories: cats }).categories.length).toBeLessThanOrEqual(500)
  })
})

describe('B-03: the app can restore the backup it wrote near its own entry limit', () => {
  it('a backup of 20,000 entries is compact and restores', () => {
    const d = defaultPersisted()
    d.budget = { ...d.budget, expenses: Array.from({ length: 20000 }, (_, i) => ({ id: `e${i}-xxxxxxxx-xxxx-xxxx`, date: '2026-11-01', amount: '1234.50', categoryId: null, mode: 'upi' as const, instrumentId: null, note: `Order number ${i}`, deletedAt: null })) }
    const text = buildBackup(d)
    expect(text).not.toContain('\n')
    const r = parseBackup(text)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.budget.expenses).toHaveLength(20000)
  })
})
