import type { KeyValueStorage } from '../lib/storage'
import { createAppStore, type AppStore } from './app'
import { loadChecked, savePersisted } from './persistence'

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
  const { data: initial, failed } = await loadChecked(storage)
  const store = createAppStore(initial)

  const pick = (s: ReturnType<typeof store.getState>) => [s.input, s.history, s.cards, s.reminders, s.memory, s.settings, s.budget, s.drafts] as const
  let saved = pick(store.getState())
  let timer: ReturnType<typeof setTimeout> | undefined

  // After a failed load the app starts empty. Writing that empty app back would destroy the real data (B-01), so:
  // storage that could not be read is never written this session; a damaged file (already copied aside) is
  // replaced only once the person has actually changed something.
  let changed = false
  const flush = async () => {
    if (failed === 'unreadable' || (failed === 'damaged' && !changed)) return
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    await savePersisted(storage, store.getState().snapshot())
  }

  store.subscribe((s) => {
    const now = pick(s)
    if (now.every((v, i) => v === saved[i])) return
    saved = now
    changed = true
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
