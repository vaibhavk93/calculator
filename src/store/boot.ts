import type { KeyValueStorage } from '../lib/storage'
import { createAppStore, type AppStore } from './app'
import { loadChecked, savePersisted } from './persistence'

export interface Booted {
  store: AppStore
  /** Writes immediately. Resolves when storage has accepted the data. */
  flush: () => Promise<void>
  /**
   * Like flush, but says whether the data is really on disk: false when storage could not be read this session, when the write failed,
   * or when there was nothing the app is allowed to write. The SMS drain acks the phone's queue only after this says true.
   */
  persist: () => Promise<boolean>
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

  const pick = (s: ReturnType<typeof store.getState>) => [s.input, s.history, s.cards, s.reminders, s.memory, s.settings, s.budget, s.portfolio, s.drafts] as const
  let saved = pick(store.getState())
  let timer: ReturnType<typeof setTimeout> | undefined

  // After a failed load the app starts empty. Writing that empty app back would destroy the real data (B-01), so:
  // storage that could not be read is never written this session; a damaged file (already copied aside) is
  // replaced only once the person has actually changed something.
  let changed = false
  const persist = async (): Promise<boolean> => {
    if (failed === 'unreadable' || (failed === 'damaged' && !changed)) return false
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    return savePersisted(storage, store.getState().snapshot())
  }
  const flush = async () => void (await persist())

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

  return { store, flush, persist }
}
