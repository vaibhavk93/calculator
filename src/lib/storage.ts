import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

/**
 * Async on purpose. Browser localStorage is synchronous, but on Android the
 * WebView's copy can be evicted under storage pressure, so the Android build
 * swaps in Capacitor Preferences, which is async. Keeping the interface async
 * now makes that a one-file change.
 */
export interface KeyValueStorage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(initial))
  return {
    async get(key) {
      return map.get(key) ?? null
    },
    async set(key, value) {
      map.set(key, value)
    },
    async remove(key) {
      map.delete(key)
    },
    dump: () => Object.fromEntries(map),
  }
}

/**
 * localStorage, guarded. It can throw or be absent (private windows, blocked
 * site data), and the app must still run, just without remembering anything.
 */
export function createLocalStorage(): KeyValueStorage {
  const fallback = createMemoryStorage()
  const ls = (): Storage | null => {
    try {
      return globalThis.localStorage ?? null
    } catch {
      return null
    }
  }
  return {
    async get(key) {
      try {
        const s = ls()
        return s ? s.getItem(key) : await fallback.get(key)
      } catch {
        return fallback.get(key)
      }
    },
    async set(key, value) {
      try {
        const s = ls()
        if (s) s.setItem(key, value)
        else await fallback.set(key, value)
      } catch {
        await fallback.set(key, value)
      }
    },
    async remove(key) {
      try {
        ls()?.removeItem(key)
      } catch {
        /* nothing to do */
      }
      await fallback.remove(key)
    },
  }
}

/** Capacitor Preferences: Android's own key-value store, which the system does not evict like the WebView's localStorage. */
export function createNativeStorage(): KeyValueStorage {
  return {
    async get(key) {
      return (await Preferences.get({ key })).value
    },
    async set(key, value) {
      await Preferences.set({ key, value })
    },
    async remove(key) {
      await Preferences.remove({ key })
    },
  }
}

/** The right store for where the app is running. */
export const createStorage = (): KeyValueStorage => (Capacitor.isNativePlatform() ? createNativeStorage() : createLocalStorage())
