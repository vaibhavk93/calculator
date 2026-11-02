import { describe, expect, it, vi } from 'vitest'
import { createMemoryStorage } from '../lib/storage'
import { bootStore } from './boot'
import { STORAGE_KEY, defaultPersisted } from './persistence'

describe('bootStore', () => {
  it('first run starts from defaults', async () => {
    const { store } = await bootStore(createMemoryStorage())
    expect(store.getState().settings).toEqual(defaultPersisted().settings)
    expect(store.getState().history).toEqual([])
  })

  it('writes persisted changes after a short delay', async () => {
    vi.useFakeTimers()
    try {
      const storage = createMemoryStorage()
      const { store } = await bootStore(storage)
      store.getState().press('1')
      store.getState().press('+')
      store.getState().press('1')
      store.getState().press('=')

      expect(storage.dump()[STORAGE_KEY]).toBeUndefined() // debounced, not written yet
      await vi.advanceTimersByTimeAsync(300)

      const written = JSON.parse(storage.dump()[STORAGE_KEY]!)
      expect(written.history[0]).toMatchObject({ expression: '1+1', result: '2' })
      expect(written.input).toEqual({ expr: '2', fresh: true })
    } finally {
      vi.useRealTimers()
    }
  })

  it('many quick presses cause one write, not one per key', async () => {
    vi.useFakeTimers()
    try {
      const storage = createMemoryStorage()
      const setSpy = vi.spyOn(storage, 'set')
      const { store } = await bootStore(storage)
      for (const k of ['1', '2', '3', '4', '5'] as const) store.getState().press(k)
      await vi.advanceTimersByTimeAsync(300)
      expect(setSpy).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('transient UI state never causes a write', async () => {
    vi.useFakeTimers()
    try {
      const storage = createMemoryStorage()
      const setSpy = vi.spyOn(storage, 'set')
      const { store } = await bootStore(storage)
      store.getState().setPanel('scientific')
      store.getState().setOverlay('history')
      store.getState().setTab('tools')
      store.getState().showNotice('hello')
      await vi.advanceTimersByTimeAsync(1000)
      expect(setSpy).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('flush writes immediately', async () => {
    const storage = createMemoryStorage()
    const { store, flush } = await bootStore(storage)
    store.getState().press('9')
    await flush()
    expect(JSON.parse(storage.dump()[STORAGE_KEY]!).input.expr).toBe('9')
  })

  it('a restart restores what was there', async () => {
    const storage = createMemoryStorage()
    const first = await bootStore(storage)
    first.store.getState().press('4')
    first.store.getState().press('*')
    first.store.getState().press('5')
    first.store.getState().press('=')
    first.store.getState().updateSettings({ theme: 'light', decimals: 2 })
    await first.flush()

    const second = await bootStore(storage)
    expect(second.store.getState().history[0]).toMatchObject({ expression: '4*5', result: '20' })
    expect(second.store.getState().settings).toMatchObject({ theme: 'light', decimals: 2 })
    expect(second.store.getState().input).toEqual({ expr: '20', fresh: true })
  })
})
