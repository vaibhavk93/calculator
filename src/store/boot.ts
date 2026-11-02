import type { KeyValueStorage } from '../lib/storage'
import { createAppStore, type AppStore } from './app'
import { loadPersisted, savePersisted } from './persistence'

export interface Booted {
  store: AppStore
  /** Writes immediately. Resolves when storage has accepted the data. */
  flush: () => Promise<void>
}

const SAVE_DELAY_MS = 250

/**
 * Loads saved data, builds the store, and keeps storage in step with it.
 * Only the persisted slices trigger a write: a snackbar appearing or a panel
 * opening never touches storage.
 */
export async function bootStore(storage: KeyValueStorage): Promise<Booted> {
  const initial = await loadPersisted(storage)
  const store = createAppStore(initial)

  let saved = { input: store.getState().input, history: store.getState().history, memory: store.getState().memory, settings: store.getState().settings }
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = async () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    await savePersisted(storage, store.getState().snapshot())
  }

  store.subscribe((s) => {
    const changed =
      s.input !== saved.input || s.history !== saved.history || s.memory !== saved.memory || s.settings !== saved.settings
    if (!changed) return
    saved = { input: s.input, history: s.history, memory: s.memory, settings: s.settings }
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => void flush(), SAVE_DELAY_MS)
  })

  // Don't lose the last 250ms if the app is backgrounded or closed.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flush()
    })
    window.addEventListener('pagehide', () => void flush())
  }

  return { store, flush }
}
