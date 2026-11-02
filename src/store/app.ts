import { createStore, type StoreApi } from 'zustand/vanilla'
import {
  D,
  INITIAL_INPUT,
  applyKey,
  applyKeyAt,
  evaluatePreview,
  insertExpressionAt,
  insertNumber,
  toPlain,
  type InputState,
  type Key,
} from '../engine'
import { parseNum } from '../lib/tool'
import { sanitizeSettings } from './persistence'
import {
  MAX_CATEGORIES,
  MAX_EXPENSES,
  MAX_CARDS,
  MAX_HISTORY,
  MAX_MEMO,
  MAX_PINNED,
  MAX_UNDO,
  TRASH_DAYS,
  type HistoryEntry,
  type PersistedData,
  type Reminder,
  type Repeat,
  type SavedCard,
  type Settings,
  type Tab,
  type BudgetData,
} from './types'
import { advance } from '../lib/reminders'
import { listSummary, repeatLines, tapeTotal } from '../lib/tape'

/**
 * Caps history at `max`, but a named row is never evicted this way (only Clear all's
 * confirmation, or deleting it directly, removes one). When over the cap, the oldest
 * unnamed rows go first; `entries` is newest-first.
 */
function capHistory(entries: HistoryEntry[], max: number): HistoryEntry[] {
  if (entries.length <= max) return entries
  const named = entries.filter((e) => e.memo)
  const budget = Math.max(0, max - named.length)
  const keepUnnamed = new Set(entries.filter((e) => !e.memo).slice(0, budget).map((e) => e.id))
  return entries.filter((e) => e.memo || keepUnnamed.has(e.id))
}

export type Overlay = 'none' | 'settings' | 'history'
export type Panel = 'none' | 'more' | 'scientific'

export interface Notice {
  id: number
  text: string
  tone: 'info' | 'error'
}

export interface Removed {
  entry: HistoryEntry
  index: number
}

export interface Snack {
  id: number
  text: string
  /** When set, the snackbar offers Undo for the last removal (history rows, or a card). */
  canUndo: boolean
}

/** What the user fills in to keep something. Everything but the title can stay empty. */
export type CardDraft = Pick<SavedCard, 'title' | 'kind' | 'toolId' | 'inputs' | 'summary' | 'amount' | 'lines'> &
  Partial<Pick<SavedCard, 'note' | 'tags' | 'amountFmt'>>

export interface ReminderDraft {
  dueAt: number
  repeat: Repeat
  leadDays: number
}

/** Where the user is inside the Tools tab. Lives in the store so the tab bar and the Android back button can pop it. */
export interface ToolsNav {
  /** A group id from the Tools list, or null at the top. */
  category: string | null
  /** A ToolSpec id, or null when no calculator is open. */
  tool: string | null
  /** Whether the scientific calculator is open. */
  scientific: boolean
}

export const TOOLS_HOME: ToolsNav = { category: null, tool: null, scientific: false }

/**
 * Where the cursor is inside `expr`, or what part of it is selected. Null means "at the end", which is
 * where typing normally goes. It names the text it belongs to, so as soon as the input changes by any
 * other route (undo, history, restore) it quietly stops applying.
 */
export interface Selection {
  expr: string
  start: number
  end: number
}

export interface AppState {
  input: InputState
  selection: Selection | null
  undoStack: InputState[]
  history: HistoryEntry[]
  cards: SavedCard[]
  reminders: Reminder[]
  memory: string | null
  settings: Settings
  budget: BudgetData

  tab: Tab
  /** Where the user is inside the Tools tab. */
  nav: ToolsNav
  /** A card the Notes tab should open as soon as it shows (set after "Add to a list"). The Notes screen clears it. */
  openCard: string | null
  /** Goes up by one each time the user taps the tab they are already on, so that tab's screens can return to their start. */
  tabTap: number
  overlay: Overlay
  panel: Panel
  /** Short-lived notice shown under the result ("Copied", or an error). */
  notice: Notice | null
  /** The expression "=" just evaluated, for the line above the result. Null when nothing was computed. */
  lastExpression: string | null
  snack: Snack | null
  removed: Removed[] | null

  press: (key: Key) => void

  /** Records something spent. Returns false (and says why) when the amount is not a positive number. */
  addExpense: (draft: { amount: string; categoryId: string | null; date: string; note: string }) => boolean
  /** Changes an entry. Same rules as addExpense. */
  updateExpense: (id: string, draft: { amount: string; categoryId: string | null; date: string; note: string }) => boolean
  /** Removes an entry; the snackbar offers Undo. */
  deleteExpense: (id: string) => void
  /** A monthly limit for one category, or null to remove it. */
  setCategoryLimit: (id: string, limit: string | null) => void
  /** One limit for everything spent in a month, or null to remove it. */
  setOverallLimit: (limit: string | null) => void
  addCategory: (name: string) => string | null
  renameCategory: (id: string, name: string) => void
  /** Its entries stay, shown as Uncategorised. */
  deleteCategory: (id: string) => void
  /** Moves the cursor or selects part of what is typed. At the very end it goes back to null. */
  setSelection: (start: number, end: number) => void
  /** Tapping the line above a finished answer: brings that expression back for editing, with the cursor there. */
  editLast: (start: number, end: number) => void
  undoInput: () => void
  memoryAdd: (sign: 1 | -1) => void
  memoryRecall: () => void
  memoryClear: () => void
  insertPlain: (plain: string) => void
  /** Puts a pasted calculation into the input. `raw` is already in the engine's form, e.g. "23*36+5". Replaces a finished result, otherwise appends. */
  insertExpression: (raw: string) => void

  reuseExpression: (id: string) => void
  reuseResult: (id: string) => void
  /** Sets or clears the name on a history row. An empty string clears it. */
  renameHistory: (id: string, memo: string) => void
  deleteHistory: (id: string) => void
  clearHistory: () => void
  undoRemoval: () => void

  /** Keeps a calculation. Returns the new card's id. Over the card limit, returns null and says why. */
  saveCard: (draft: CardDraft, reminder?: ReminderDraft | null) => string | null
  /** Changes a card; a reminder draft replaces its reminder (null removes it, undefined leaves it). */
  updateCard: (id: string, patch: Partial<Omit<SavedCard, 'id'>>, reminder?: ReminderDraft | null) => void
  /**
   * Takes a number to a list: `count` equal lines of `value`. With `target.cardId` it adds to that list,
   * otherwise it starts a new one called `target.title`. A new list from a split gets checkboxes on.
   * Returns the list's id, or null when the target is gone or the card limit is reached.
   */
  addToList: (target: { cardId: string } | { title: string }, value: string, count?: number, label?: string, checklist?: boolean) => string | null
  /** Ticks or unticks one line of a list. */
  toggleLine: (cardId: string, lineId: string) => void
  togglePin: (id: string) => void
  deleteCard: (id: string) => void
  restoreCard: (id: string) => void
  emptyTrash: () => void
  markPaid: (reminderId: string) => void
  snooze: (reminderId: string, days: number) => void
  removeReminder: (reminderId: string) => void

  updateSettings: (patch: Partial<Settings>) => void
  setTab: (tab: Tab) => void
  setNav: (patch: Partial<ToolsNav>) => void
  /** Goes to the Notes tab with this card open. */
  showCard: (id: string | null) => void
  /** Ticks a list on or off as a checklist. */
  setChecklist: (cardId: string, on: boolean) => void
  setOverlay: (overlay: Overlay) => void
  setPanel: (panel: Panel) => void
  showNotice: (text: string, tone?: Notice['tone']) => void
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

const DAY = 86_400_000

export function createAppStore(initial: PersistedData, deps: StoreDeps = defaultDeps): AppStore {
  let counter = 0
  const nextId = () => ++counter
  // Trash is emptied after TRASH_DAYS; a card's reminders go with it.
  const keep = initial.cards.filter((c) => c.deletedAt === null || deps.now() - c.deletedAt < TRASH_DAYS * DAY)
  const keepIds = new Set(keep.map((c) => c.id))
  let removedCardId: string | null = null
  let removedExpenseId: string | null = null

  return createStore<AppState>()((set, get) => {
    /** Records the current input so it can be undone, if the next state actually differs. */
    const withUndo = (next: InputState): Pick<AppState, 'input' | 'undoStack'> => {
      const { input, undoStack } = get()
      if (sameInput(input, next)) return { input, undoStack }
      return { input: next, undoStack: [...undoStack, input].slice(-MAX_UNDO) }
    }

    /** One reminder per card: setting replaces, null removes. */
    const setReminder = (card: SavedCard, draft: ReminderDraft | null) => {
      const others = get().reminders.filter((r) => r.cardId !== card.id)
      if (draft === null) return set({ reminders: others })
      const existing = get().reminders.find((r) => r.cardId === card.id)
      const next: Reminder = {
        id: existing?.id ?? deps.newId(),
        cardId: card.id,
        dueAt: draft.dueAt,
        repeat: draft.repeat,
        anchorDay: new Date(draft.dueAt).getDate(),
        leadDays: draft.leadDays,
        done: false,
        history: existing?.history ?? [],
      }
      set({ reminders: [...others, next] })
    }

    const fail = (text: string) => {
      set({ notice: { id: nextId(), text, tone: 'error' } })
      return false
    }

    /** A plain positive amount, a real calendar day, a category that exists. Or the reason it is not. */
    const checkedExpense = (d: { amount: string; categoryId: string | null; date: string; note: string }) => {
      const amount = parseNum(d.amount)
      if (!amount || !amount.isPositive() || amount.isZero()) return 'Enter an amount above zero'
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || Number.isNaN(new Date(`${d.date}T00:00:00`).getTime())) return 'Pick a date'
      const categoryId = d.categoryId !== null && get().budget.categories.some((c) => c.id === d.categoryId && c.deletedAt === null) ? d.categoryId : null
      return { amount: toPlain(amount), categoryId, date: d.date, note: d.note.trim().slice(0, 200) }
    }

    const cleanLimit = (limit: string | null) => {
      if (limit === null) return null
      const v = parseNum(limit)
      return v && v.isPositive() && !v.isZero() ? toPlain(v) : null
    }

    const currentValue = () => {
      const { input, settings } = get()
      const r = evaluatePreview(input.expr, { angle: settings.angle })
      return r.ok ? r.value : null
    }

    return {
      input: initial.input,
      selection: null,
      undoStack: [],
      history: initial.history,
      cards: keep,
      reminders: initial.reminders.filter((r) => keepIds.has(r.cardId)),
      memory: initial.memory,
      settings: initial.settings,
      budget: initial.budget,

      // A chosen startup calculator opens the Tools tab with that calculator already showing.
      tab: initial.settings.startupTool ? 'tools' : initial.settings.startupTab,
      nav: initial.settings.startupTool ? { ...TOOLS_HOME, tool: initial.settings.startupTool } : TOOLS_HOME,
      tabTap: 0,
      openCard: null,
      overlay: 'none',
      panel: 'none',
      notice: null,
      lastExpression: null,
      snack: null,
      removed: null,

      press: (key) => {
        const { input, settings, history, selection } = get()
        const sel = selection && !input.fresh && selection.expr === input.expr ? selection : null
        const res = sel ? applyKeyAt(input, key, { angle: settings.angle }, sel.start, sel.end) : applyKey(input, key, { angle: settings.angle })

        const patch: Partial<AppState> = withUndo(res.state)
        // Typing mid-expression keeps the cursor there; reaching the end hands it back to "the end".
        const caret: number | null = sel && 'caret' in res && typeof res.caret === 'number' ? res.caret : null
        patch.selection = caret !== null && caret < res.state.expr.length ? { expr: res.state.expr, start: caret, end: caret } : null
        patch.notice = res.error ? { id: nextId(), text: res.error, tone: 'error' } : null
        // An ignored key (state unchanged) must not wipe the "expression =" line.
        if (res.commit) patch.lastExpression = res.commit.expression
        else if (!sameInput(input, res.state)) patch.lastExpression = null

        if (res.commit && settings.keepHistory) {
          const entry: HistoryEntry = {
            id: deps.newId(),
            expression: res.commit.expression,
            result: res.commit.result,
            at: deps.now(),
          }
          patch.history = capHistory([entry, ...history], MAX_HISTORY)
        }
        set(patch)
      },

      setSelection: (start, end) => {
        const { input } = get()
        const len = input.expr.length
        const a = Math.max(0, Math.min(start, end, len))
        const b = Math.min(Math.max(start, end), len)
        const next = input.fresh || (a === len && b === len) ? null : { expr: input.expr, start: a, end: b }
        const cur = get().selection
        if (cur === next || (cur && next && cur.expr === next.expr && cur.start === next.start && cur.end === next.end)) return
        set({ selection: next })
      },

      editLast: (start, end) => {
        const { input, lastExpression } = get()
        if (!input.fresh || !lastExpression) return
        const len = lastExpression.length
        const a = Math.max(0, Math.min(start, end, len))
        const b = Math.min(Math.max(start, end), len)
        set({
          ...withUndo({ expr: lastExpression, fresh: false }),
          lastExpression: null,
          selection: a === len && b === len ? null : { expr: lastExpression, start: a, end: b },
        })
      },

      undoInput: () => {
        const { undoStack } = get()
        const prev = undoStack[undoStack.length - 1]
        if (!prev) return
        set({ input: prev, undoStack: undoStack.slice(0, -1), notice: null, selection: null })
      },

      memoryAdd: (sign) => {
        const v = currentValue()
        if (!v) return set({ notice: { id: nextId(), text: 'Nothing to add to memory', tone: 'info' } })
        const base = new D(get().memory ?? 0)
        set({ memory: toPlain(sign === 1 ? base.plus(v) : base.minus(v)), notice: { id: nextId(), text: 'Memory updated', tone: 'info' } })
      },

      memoryRecall: () => {
        const { memory, input } = get()
        if (memory === null) return set({ notice: { id: nextId(), text: 'Memory is empty', tone: 'info' } })
        set(withUndo(insertNumber(input, memory)))
      },

      memoryClear: () => set({ memory: null, notice: { id: nextId(), text: 'Memory cleared', tone: 'info' } }),

      insertPlain: (plain) => set(withUndo(insertNumber(get().input, plain))),

      insertExpression: (raw) => {
        const { input, selection } = get()
        const sel = selection && !input.fresh && selection.expr === input.expr ? selection : null
        // Pasted into the middle of an expression, it goes where the cursor is.
        if (sel) {
          const expr = (input.expr.slice(0, sel.start) + raw + input.expr.slice(sel.end)).slice(0, 500)
          const caret = Math.min(sel.start + raw.length, expr.length)
          return set({ ...withUndo({ expr, fresh: false }), notice: null, selection: caret < expr.length ? { expr, start: caret, end: caret } : null })
        }
        const base = input.fresh ? '' : input.expr
        set({ ...withUndo({ expr: (base + raw).slice(0, 500), fresh: false }), notice: null })
      },

      reuseExpression: (id) => {
        const entry = get().history.find((h) => h.id === id)
        if (!entry) return
        // Adds to what is being typed instead of replacing it: picking "9*9" while
        // "1+2+3+" is on screen gives "1+2+3+(9*9)". Only an empty or just-finished
        // input is replaced outright.
        set({ ...withUndo(insertExpressionAt(get().input, entry.expression)), overlay: 'none', panel: 'none' })
      },

      reuseResult: (id) => {
        const entry = get().history.find((h) => h.id === id)
        if (!entry) return
        set({ ...withUndo(insertNumber(get().input, entry.result)), overlay: 'none' })
      },

      renameHistory: (id, memo) => {
        const trimmed = memo.trim().slice(0, MAX_MEMO)
        set({
          history: get().history.map((h) => (h.id === id ? { ...h, memo: trimmed || undefined } : h)),
        })
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
        // Named rows are kept: clearing is for the clutter, not for what you bothered to name.
        const toRemove = history.map((entry, index) => ({ entry, index })).filter((r) => !r.entry.memo)
        if (toRemove.length === 0) return
        set({
          history: history.filter((h) => h.memo),
          removed: toRemove,
          snack: { id: nextId(), text: `Cleared ${toRemove.length} calculations`, canUndo: true },
        })
      },

      addExpense: (draft) => {
        const e = checkedExpense(draft)
        if (typeof e === 'string') return fail(e)
        const { budget } = get()
        if (budget.expenses.length >= MAX_EXPENSES) return fail(`You can keep up to ${MAX_EXPENSES} entries.`)
        set({ budget: { ...budget, expenses: [{ id: deps.newId(), ...e, deletedAt: null }, ...budget.expenses] }, notice: null })
        return true
      },

      updateExpense: (id, draft) => {
        const e = checkedExpense(draft)
        if (typeof e === 'string') return fail(e)
        const { budget } = get()
        set({ budget: { ...budget, expenses: budget.expenses.map((x) => (x.id === id ? { ...x, ...e } : x)) } })
        return true
      },

      deleteExpense: (id) => {
        const { budget } = get()
        const target = budget.expenses.find((x) => x.id === id && x.deletedAt === null)
        if (!target) return
        removedExpenseId = id
        removedCardId = null
        set({
          budget: { ...budget, expenses: budget.expenses.map((x) => (x.id === id ? { ...x, deletedAt: deps.now() } : x)) },
          snack: { id: nextId(), text: 'Removed from your budget', canUndo: true },
        })
      },

      setCategoryLimit: (id, limit) => {
        const { budget } = get()
        set({ budget: { ...budget, categories: budget.categories.map((c) => (c.id === id ? { ...c, limit: cleanLimit(limit) } : c)) } })
      },

      setOverallLimit: (limit) => set({ budget: { ...get().budget, overall: cleanLimit(limit) } }),

      addCategory: (name) => {
        const clean = name.trim().slice(0, 40)
        const { budget } = get()
        if (!clean) return null
        if (budget.categories.filter((c) => c.deletedAt === null).length >= MAX_CATEGORIES) {
          fail(`You can have up to ${MAX_CATEGORIES} categories.`)
          return null
        }
        const live = budget.categories.find((c) => c.deletedAt === null && c.name.toLowerCase() === clean.toLowerCase())
        if (live) return live.id
        const id = deps.newId()
        set({ budget: { ...budget, categories: [...budget.categories, { id, name: clean, limit: null, deletedAt: null }] } })
        return id
      },

      renameCategory: (id, name) => {
        const clean = name.trim().slice(0, 40)
        if (!clean) return
        const { budget } = get()
        set({ budget: { ...budget, categories: budget.categories.map((c) => (c.id === id ? { ...c, name: clean } : c)) } })
      },

      deleteCategory: (id) => {
        const { budget } = get()
        set({ budget: { ...budget, categories: budget.categories.map((c) => (c.id === id ? { ...c, deletedAt: deps.now() } : c)) } })
      },

      undoRemoval: () => {
        if (removedExpenseId) {
          const id = removedExpenseId
          removedExpenseId = null
          const { budget } = get()
          return set({ snack: null, budget: { ...budget, expenses: budget.expenses.map((x) => (x.id === id ? { ...x, deletedAt: null } : x)) } })
        }
        if (removedCardId) {
          const id = removedCardId
          removedCardId = null
          set({ snack: null })
          return get().restoreCard(id)
        }
        const { removed, history } = get()
        if (!removed) return
        const restored = [...history]
        // Re-insert in ascending original position so indexes line up again.
        for (const { entry, index } of [...removed].sort((a, b) => a.index - b.index)) {
          restored.splice(Math.min(index, restored.length), 0, entry)
        }
        set({ history: restored.slice(0, MAX_HISTORY), removed: null, snack: null })
      },

      saveCard: (draft, reminder) => {
        const { cards } = get()
        if (cards.filter((c) => c.deletedAt === null).length >= MAX_CARDS) {
          set({ notice: { id: nextId(), text: `You can keep up to ${MAX_CARDS} saved items. Delete some first.`, tone: 'error' } })
          return null
        }
        const now = deps.now()
        const card: SavedCard = {
          note: '',
          tags: [],
          ...draft,
          id: deps.newId(),
          pinned: false,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }
        set({ cards: [card, ...cards] })
        if (reminder) setReminder(card, reminder)
        return card.id
      },

      updateCard: (id, patch, reminder) => {
        const card = get().cards.find((c) => c.id === id)
        if (!card) return
        const next = { ...card, ...patch, updatedAt: deps.now() }
        set({ cards: get().cards.map((c) => (c.id === id ? next : c)) })
        if (reminder !== undefined) setReminder(next, reminder)
      },

      addToList: (target, value, count = 1, label = '', checklist = false) => {
        const { cards, settings } = get()
        const opts = { system: settings.numberSystem, decimals: settings.decimals }
        const lines = repeatLines(value, count, label, deps.newId)
        if ('cardId' in target) {
          const card = cards.find((c) => c.id === target.cardId && c.deletedAt === null && c.kind === 'tape')
          if (!card) return null
          const all = [...card.lines, ...lines]
          const list = !!card.checklist
          set({ cards: cards.map((c) => (c.id === card.id ? { ...c, lines: all, amount: toPlain(tapeTotal(all)), summary: listSummary(all, list, opts), updatedAt: deps.now() } : c)) })
          return card.id
        }
        const id = get().saveCard({
          title: target.title.trim() || 'List',
          kind: 'tape',
          toolId: null,
          inputs: null,
          summary: listSummary(lines, checklist, opts),
          amount: toPlain(tapeTotal(lines)),
          lines,
          ...(checklist ? { checklist: true } : {}),
        })
        return id
      },

      toggleLine: (cardId, lineId) => {
        const { cards, settings } = get()
        const card = cards.find((c) => c.id === cardId && c.deletedAt === null)
        if (!card) return
        const lines = card.lines.map((l) => (l.id === lineId ? { ...l, done: !l.done } : l))
        const opts = { system: settings.numberSystem, decimals: settings.decimals }
        set({ cards: cards.map((c) => (c.id === cardId ? { ...c, lines, summary: listSummary(lines, !!c.checklist, opts), updatedAt: deps.now() } : c)) })
      },

      togglePin: (id) => {
        const { cards } = get()
        const card = cards.find((c) => c.id === id)
        if (!card) return
        if (!card.pinned && cards.filter((c) => c.pinned && c.deletedAt === null).length >= MAX_PINNED) {
          return set({ notice: { id: nextId(), text: `You can pin up to ${MAX_PINNED}. Unpin one first.`, tone: 'info' } })
        }
        set({ cards: cards.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)) })
      },

      deleteCard: (id) => {
        const card = get().cards.find((c) => c.id === id && c.deletedAt === null)
        if (!card) return
        removedCardId = id
        set({
          cards: get().cards.map((c) => (c.id === id ? { ...c, deletedAt: deps.now(), pinned: false } : c)),
          removed: null,
          snack: { id: nextId(), text: `Moved "${card.title}" to Trash`, canUndo: true },
        })
      },

      restoreCard: (id) => set({ cards: get().cards.map((c) => (c.id === id ? { ...c, deletedAt: null } : c)) }),

      emptyTrash: () => {
        const cards = get().cards.filter((c) => c.deletedAt === null)
        const ids = new Set(cards.map((c) => c.id))
        set({ cards, reminders: get().reminders.filter((r) => ids.has(r.cardId)) })
      },

      markPaid: (reminderId) => {
        const r = get().reminders.find((x) => x.id === reminderId)
        if (!r) return
        const amount = get().cards.find((c) => c.id === r.cardId)?.amount ?? null
        const next = advance(r)
        const paid = { ...r, history: [...r.history, { paidAt: deps.now(), amount }].slice(-200) }
        set({ reminders: get().reminders.map((x) => (x.id === reminderId ? (next === null ? { ...paid, done: true } : { ...paid, dueAt: next }) : x)) })
      },

      snooze: (reminderId, days) =>
        set({ reminders: get().reminders.map((r) => (r.id === reminderId ? { ...r, dueAt: Math.max(r.dueAt, deps.now()) + days * DAY } : r)) }),

      removeReminder: (reminderId) => set({ reminders: get().reminders.filter((r) => r.id !== reminderId) }),

      updateSettings: (patch) => set({ settings: sanitizeSettings({ ...get().settings, ...patch }) }),

      setTab: (tab) => {
        const { tab: current, tabTap } = get()
        // Tapping the tab you are already on means "take me back to its start".
        if (tab === current) return set({ overlay: 'none', tabTap: tabTap + 1, nav: tab === 'tools' ? TOOLS_HOME : get().nav })
        set({ tab, overlay: 'none' })
      },
      setNav: (patch) => set({ nav: { ...get().nav, ...patch } }),
      showCard: (id) => set(id === null ? { openCard: null } : { openCard: id, tab: 'saved', overlay: 'none' }),
      setChecklist: (cardId, on) => {
        const { cards, settings } = get()
        const card = cards.find((c) => c.id === cardId && c.deletedAt === null && c.kind === 'tape')
        if (!card) return
        const opts = { system: settings.numberSystem, decimals: settings.decimals }
        set({ cards: cards.map((c) => (c.id === cardId ? { ...c, ...(on ? { checklist: true } : { checklist: undefined }), summary: listSummary(c.lines, on, opts), updatedAt: deps.now() } : c)) })
      },
      setOverlay: (overlay) => set({ overlay }),
      setPanel: (panel) => set({ panel: get().panel === panel ? 'none' : panel }),

      showNotice: (text, tone = 'info') => set({ notice: { id: nextId(), text, tone } }),
      clearNotice: (id) => {
        if (get().notice?.id === id) set({ notice: null })
      },
      dismissSnack: (id) => {
        if (get().snack?.id === id) set({ snack: null, removed: null })
      },

      restore: (data) =>
        set({
          input: data.input,
          selection: null,
          undoStack: [],
          history: data.history,
          cards: data.cards,
          reminders: data.reminders,
          memory: data.memory,
          settings: data.settings,
          budget: data.budget,
          removed: null,
          snack: null,
          notice: null,
          lastExpression: null,
        }),

      snapshot: () => {
        const { input, history, cards, reminders, memory, settings, budget } = get()
        return { schemaVersion: initial.schemaVersion, input, history, cards, reminders, memory, settings, budget }
      },
    }
  })
}

export { INITIAL_INPUT }
