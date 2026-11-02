import { createStore, type StoreApi } from 'zustand/vanilla'
import {
  D,
  INITIAL_INPUT,
  applyKey,
  evaluatePreview,
  insertNumber,
  toPlain,
  type InputState,
  type Key,
} from '../engine'
import { sanitizeSettings } from './persistence'
import {
  MAX_HISTORY,
  MAX_UNDO,
  type HistoryEntry,
  type PersistedData,
  type Settings,
  type Tab,
} from './types'

export type Overlay = 'none' | 'settings' | 'history'
export type Panel = 'none' | 'more' | 'scientific'

export interface Removed {
  entry: HistoryEntry
  index: number
}

export interface Snack {
  id: number
  text: string
  /** When set, the snackbar offers Undo for the last history removal. */
  canUndo: boolean
}

export interface AppState {
  input: InputState
  undoStack: InputState[]
  history: HistoryEntry[]
  memory: string | null
  settings: Settings

  tab: Tab
  overlay: Overlay
  panel: Panel
  /** Short-lived notice shown on the calculator's preview line ("Copied", an error). */
  notice: { id: number; text: string } | null
  snack: Snack | null
  removed: Removed[] | null

  press: (key: Key) => void
  undoInput: () => void
  memoryAdd: (sign: 1 | -1) => void
  memoryRecall: () => void
  memoryClear: () => void
  insertPlain: (plain: string) => void

  reuseExpression: (id: string) => void
  reuseResult: (id: string) => void
  deleteHistory: (id: string) => void
  clearHistory: () => void
  undoRemoval: () => void

  updateSettings: (patch: Partial<Settings>) => void
  setTab: (tab: Tab) => void
  setOverlay: (overlay: Overlay) => void
  setPanel: (panel: Panel) => void
  showNotice: (text: string) => void
  clearNotice: (id: number) => void
  dismissSnack: (id: number) => void
  restore: (data: PersistedData) => void
  snapshot: () => PersistedData
}

export interface StoreDeps {
  now: () => number
  newId: () => string
}

const defaultDeps: StoreDeps = {
  now: () => Date.now(),
  newId: () =>
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
}

const sameInput = (a: InputState, b: InputState) => a.expr === b.expr && a.fresh === b.fresh

export type AppStore = StoreApi<AppState>

export function createAppStore(initial: PersistedData, deps: StoreDeps = defaultDeps): AppStore {
  let counter = 0
  const nextId = () => ++counter

  return createStore<AppState>()((set, get) => {
    /** Records the current input so it can be undone, if the next state actually differs. */
    const withUndo = (next: InputState): Pick<AppState, 'input' | 'undoStack'> => {
      const { input, undoStack } = get()
      if (sameInput(input, next)) return { input, undoStack }
      return { input: next, undoStack: [...undoStack, input].slice(-MAX_UNDO) }
    }

    const currentValue = () => {
      const { input, settings } = get()
      const r = evaluatePreview(input.expr, { angle: settings.angle })
      return r.ok ? r.value : null
    }

    return {
      input: initial.input,
      undoStack: [],
      history: initial.history,
      memory: initial.memory,
      settings: initial.settings,

      tab: initial.settings.startupTab,
      overlay: 'none',
      panel: 'none',
      notice: null,
      snack: null,
      removed: null,

      press: (key) => {
        const { input, settings, history } = get()
        const res = applyKey(input, key, { angle: settings.angle })

        const patch: Partial<AppState> = withUndo(res.state)
        patch.notice = res.error ? { id: nextId(), text: res.error } : null

        if (res.commit && settings.keepHistory) {
          const entry: HistoryEntry = {
            id: deps.newId(),
            expression: res.commit.expression,
            result: res.commit.result,
            at: deps.now(),
          }
          patch.history = [entry, ...history].slice(0, MAX_HISTORY)
        }
        set(patch)
      },

      undoInput: () => {
        const { undoStack } = get()
        const prev = undoStack[undoStack.length - 1]
        if (!prev) return
        set({ input: prev, undoStack: undoStack.slice(0, -1), notice: null })
      },

      memoryAdd: (sign) => {
        const v = currentValue()
        if (!v) return set({ notice: { id: nextId(), text: 'Nothing to add to memory' } })
        const base = new D(get().memory ?? 0)
        set({ memory: toPlain(sign === 1 ? base.plus(v) : base.minus(v)), notice: { id: nextId(), text: 'Memory updated' } })
      },

      memoryRecall: () => {
        const { memory, input } = get()
        if (memory === null) return set({ notice: { id: nextId(), text: 'Memory is empty' } })
        set(withUndo(insertNumber(input, memory)))
      },

      memoryClear: () => set({ memory: null, notice: { id: nextId(), text: 'Memory cleared' } }),

      insertPlain: (plain) => set(withUndo(insertNumber(get().input, plain))),

      reuseExpression: (id) => {
        const entry = get().history.find((h) => h.id === id)
        if (!entry) return
        set({ ...withUndo({ expr: entry.expression, fresh: false }), overlay: 'none', panel: 'none' })
      },

      reuseResult: (id) => {
        const entry = get().history.find((h) => h.id === id)
        if (!entry) return
        set({ ...withUndo(insertNumber(get().input, entry.result)), overlay: 'none' })
      },

      deleteHistory: (id) => {
        const { history } = get()
        const index = history.findIndex((h) => h.id === id)
        const entry = history[index]
        if (index === -1 || !entry) return
        set({
          history: history.filter((h) => h.id !== id),
          removed: [{ entry, index }],
          snack: { id: nextId(), text: 'Removed from history', canUndo: true },
        })
      },

      clearHistory: () => {
        const { history } = get()
        if (history.length === 0) return
        set({
          history: [],
          removed: history.map((entry, index) => ({ entry, index })),
          snack: { id: nextId(), text: `Cleared ${history.length} calculations`, canUndo: true },
        })
      },

      undoRemoval: () => {
        const { removed, history } = get()
        if (!removed) return
        const restored = [...history]
        // Re-insert in ascending original position so indexes line up again.
        for (const { entry, index } of [...removed].sort((a, b) => a.index - b.index)) {
          restored.splice(Math.min(index, restored.length), 0, entry)
        }
        set({ history: restored.slice(0, MAX_HISTORY), removed: null, snack: null })
      },

      updateSettings: (patch) => set({ settings: sanitizeSettings({ ...get().settings, ...patch }) }),

      setTab: (tab) => set({ tab, overlay: 'none' }),
      setOverlay: (overlay) => set({ overlay }),
      setPanel: (panel) => set({ panel: get().panel === panel ? 'none' : panel }),

      showNotice: (text) => set({ notice: { id: nextId(), text } }),
      clearNotice: (id) => {
        if (get().notice?.id === id) set({ notice: null })
      },
      dismissSnack: (id) => {
        if (get().snack?.id === id) set({ snack: null, removed: null })
      },

      restore: (data) =>
        set({
          input: data.input,
          undoStack: [],
          history: data.history,
          memory: data.memory,
          settings: data.settings,
          removed: null,
          snack: null,
          notice: null,
        }),

      snapshot: () => {
        const { input, history, memory, settings } = get()
        return { schemaVersion: initial.schemaVersion, input, history, memory, settings }
      },
    }
  })
}

export { INITIAL_INPUT }
