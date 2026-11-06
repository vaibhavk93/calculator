import { createStore, type StoreApi } from 'zustand/vanilla'
import {
  D,
  INITIAL_INPUT,
  applyKey,
  applyKeyAt,
  evaluateExpression,
  evaluatePreview,
  insertExpressionAt,
  insertNumber,
  toPlain,
  type InputState,
  type Key,
} from '../engine'
import { parseNum } from '../lib/tool'
import {
  MAX_PAYMENTS,
  MAX_RECURRING,
  isPaymentCount,
  MAX_RULES,
  MAX_SUBCATEGORIES,
  cleanRuleMatch,
  categoryName,
  categoryActiveIn,
  categoryUsable,
  cleanInstrument,
  countsAsSpend,
  expenseChanges,
  withEdits,
  type BudgetExpense,
  dayKey,
  dropInapplicable,
  instrumentFitsMode,
  instrumentLabel,
  isMonthKey,
  paymentError,
  type BillRepeat,
  type PaymentModeId,
  type RecurringItem,
  validateCategoryMonths,
  validateExpense,
  validateLimit,
  validateNewCategoryMonths,
  type ExpenseDraft,
} from '../lib/budget'
import { capHistory, isRawExpression, sanitizeSettings } from './persistence'
import type { Values } from '../lib/tool'
import {
  MAX_CATEGORIES,
  MAX_EXPENSES,
  MAX_INSTRUMENTS,
  isPaymentMode,
  type InstrumentDraft,
  type PayInstrument,
  MAX_CARDS,
  MAX_DRAFTS,
  MAX_HISTORY,
  MAX_LOCKED,
  MAX_MEMO,
  isKept,
  MAX_PINNED,
  MAX_UNDO,
  TRASH_DAYS,
  type HistoryEntry,
  type PersistedData,
  type Reminder,
  type Repeat,
  type SavedCard,
  type TapeLine,
  type Settings,
  type Tab,
  type BudgetData,
} from './types'
import { addDaysAt, advance, advanceTaxPack, atTime } from '../lib/reminders'
import { billForCard, cardBillDue, cardBillFor, firstDue, liveBills, rollForward, validateBill } from '../lib/recurring'
import { isTaskDone, nextOccurrence, parseDay, shortDate, taskSummary } from '../lib/tasks'
import { lineState, listSummary, nextLineState, repeatLines, tapeTotal, withLineState } from '../lib/tape'

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
  /** A highlighted action in the message, such as "Open folder". */
  link?: { label: string; run: () => void }
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
  /** Several heads-up times in days before, biggest first (see `leadFields`). Absent: just `leadDays`. */
  leads?: number[]
  /** Repeat this many days after it is ticked off, instead of on the calendar. */
  afterDays?: number
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

/** Where a limit applies: every month, or one month only. */
export type LimitScope = { kind: 'always' } | { kind: 'month'; month: string }

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
  /** Unsaved calculator inputs by tool id. Saved with the app, so a half-filled calculator survives a restart. */
  drafts: Record<string, Values>

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

  press: (key: Key) => void

  /**
   * Records something spent (or, with `draft.refund`, money coming back). Returns false (and says why) when the amount is not a positive number.
   * With `repeat` the entry is also the first payment of a new recurring bill: one record that owns the Due reminder and the later entries.
   * `payments` (2 to 600, with `repeat`) is how many payments the bill has IN ALL, this entry included; the bill ends after the last.
   */
  addExpense: (draft: ExpenseDraft, repeat?: BillRepeat | null, payments?: number | null) => boolean
  /** Changes an entry. Same rules as addExpense. `repeat` turns an entry that is not yet a bill into one. */
  updateExpense: (id: string, draft: ExpenseDraft, repeat?: BillRepeat | null, payments?: number | null) => boolean
  /** Changes a bill's name, amount, repeat or (when running) next due date ("YYYY-MM-DD"). `remaining` is the payments left, the next included (null = never ends). Returns false (and says why) when refused. */
  updateBill: (id: string, patch: { title?: string; amount?: string; repeat?: BillRepeat; date?: string; remaining?: number | null }) => boolean
  /** No reminder and no new entries until resumed. Past entries stay. */
  pauseBill: (id: string) => void
  /** Carries on from where it was paused (the next due date on or after today). */
  resumeBill: (id: string) => void
  /** Ends a bill: its reminder goes, past entries stay. The snackbar offers Undo. */
  stopBill: (id: string) => void
  /** Turns the monthly reminder for a credit card's bill on or off (it needs the card's due day). Returns false (and says why) when refused. */
  setCardBillReminder: (instrumentId: string, on: boolean) => boolean
  /** Removes an entry; the snackbar offers Undo. */
  deleteExpense: (id: string) => void
  /** Remembers what is typed into a calculator (null forgets it). Keeps the newest MAX_DRAFTS. */
  setDraft: (toolId: string, values: Values | null) => void
  /**
   * Moves several entries to one category (null: Uncategorised) in one step, with one Undo. Card bills and transfers have no
   * category and are skipped, as are entries from months the category is not used in. Returns how many were changed.
   */
  recategorise: (ids: string[], categoryId: string | null) => number
  /** Remembers bank messages that were added or skipped, so a later scan does not offer them again. */
  markSmsSeen: (ids: string[]) => void
  /** A monthly limit for one category, or null to remove it. */
  setCategoryLimit: (id: string, limit: string | null, scope?: LimitScope) => boolean
  /** One limit for everything spent in a month, or null to remove it. */
  setOverallLimit: (limit: string | null, scope?: LimitScope) => boolean
  /** Goes back to the every-month limit for one month. `target` is a category id or 'overall'. */
  clearMonthLimit: (target: string, month: string) => void
  /** Which months a category exists in ('YYYY-MM'), or null for every month. Returns false (and says why) when refused. */
  setCategoryMonths: (id: string, months: string[] | null) => boolean
  /**
   * Adds a category, or a subcategory when `parentId` is given. Returns its id, or the id of the live one with the
   * same name (ignoring case) under the same parent. Returns null for a blank name, the cap, or a parent that is
   * missing or is itself a subcategory.
   */
  addCategory: (name: string, parentId?: string | null, months?: string[] | null) => string | null
  renameCategory: (id: string, name: string) => void
  /** Deleting a top-level category deletes its subcategories too. Entries stay, shown as Uncategorised. */
  deleteCategory: (id: string) => void
  /**
   * Makes a merchant rule (newest wins). The same text (ignoring case) already there: its category is replaced and it becomes the
   * newest, so there is never a second one. False, with a notice in plain words, when the text or the category is not usable or at the cap.
   */
  addRule: (match: string, categoryId: string) => boolean
  /** Removes a rule; the snackbar offers Undo, which puts it back in the same place. */
  deleteRule: (id: string) => void
  /** Adds a card, account or wallet. Returns its id, or the existing one with the same name and kind. Null (with a notice) when not valid. */
  addInstrument: (draft: InstrumentDraft) => string | null
  /** Changes some fields. Entries whose mode no longer accepts it lose it. False (with a notice) when not valid. */
  updateInstrument: (id: string, patch: Partial<InstrumentDraft>) => boolean
  /** Soft delete. Entries paid with it keep their mode and lose the instrument. */
  deleteInstrument: (id: string) => void
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
  /** Locks or unlocks a row. Locked rows survive Clear all and the history cap. At the limit, says so and does nothing. */
  setHistoryLocked: (id: string, locked: boolean) => void
  /** Re-evaluates a new expression for a row. Returns a plain-words error (and changes nothing), or null when saved. */
  editHistoryExpression: (id: string, expression: string) => string | null
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
  /** Takes one line out of a list. Offers Undo, which puts it back where it was. */
  removeLine: (cardId: string, lineId: string) => void
  togglePin: (id: string) => void
  deleteCard: (id: string) => void
  restoreCard: (id: string) => void
  emptyTrash: () => void
  markPaid: (reminderId: string) => void
  snooze: (reminderId: string, days: number) => void
  removeReminder: (reminderId: string) => void
  /**
   * To-do. Ticks a task done, or back to open. A repeating task moves to its next date instead of finishing.
   * Returns false when there is no such task. Ticking done offers Undo in the snackbar.
   */
  setTaskDone: (id: string, done: boolean) => boolean
  /** Moves every finished task to Trash (undoable). Returns how many. */
  clearDoneTasks: () => number
  /**
   * Adds the four advance-tax reminders (15 Jun, 15 Sep, 15 Dec, 15 Mar). One already there with the same
   * title is left alone, so adding twice never doubles them. Returns how many were added.
   */
  addAdvanceTaxPack: () => number

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
  /** A short message with one tappable link, for outcomes the user may want to follow up ("Backup saved. Open folder"). */
  showLinkSnack: (text: string, link: { label: string; run: () => void }) => void
  /** A plain short message at the bottom of any screen (the calculator's own notice line is only on Calculate). */
  toast: (text: string) => void
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
  /**
   * The ONE thing the snackbar's Undo can reverse (a delete, a task tick, a bill payment). Every removal replaces it, and it
   * is only valid while its own snackbar is showing, so Undo can never bring back an older, different item (B-05).
   */
  let taskUndo: { snackId: number; run: () => void } | null = null

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
        ...(draft.leads && draft.leads.length > 1 ? { leads: draft.leads } : {}),
        ...(draft.afterDays ? { afterDays: draft.afterDays } : {}),
        done: false,
        history: existing?.history ?? [],
      }
      set({ reminders: [...others, next] })
    }

    const fail = (text: string) => {
      set({ notice: { id: nextId(), text, tone: 'error' } })
      return false
    }

    /** The final guard before an entry is saved: the same checks the sheet shows (validateExpense). Returns the clean entry, or the first problem in words. */
    const checkedExpense = (d: ExpenseDraft, keepCategoryId: string | null = null) => {
      const { budget } = get()
      const settlement = d.settlement === 'cardBill' || d.settlement === 'transfer' ? d.settlement : undefined
      // A bill payment or own-account transfer is not spending: no category, no payment mode, and only a card bill keeps a card.
      // Money that came in is the third kind of not-spending: it has no category, mode or card either. A settlement or a refund wins over it.
      const income = !settlement && d.refund !== true && d.income === true
      const mode = settlement || income ? null : isPaymentMode(d.mode) ? d.mode : null
      const instrumentId = settlement === 'transfer' || income ? null : (d.instrumentId ?? null)
      // A category that no longer exists falls back to Uncategorised here; the sheet already told the person.
      const categoryId = !settlement && !income && d.categoryId !== null && categoryUsable(budget, d.categoryId) ? d.categoryId : null
      const bad = validateExpense({ amount: d.amount, date: d.date, categoryId, mode, instrumentId, settlement, income }, budget, new Date(), keepCategoryId)
      const first = bad.amount ?? bad.date ?? bad.category ?? bad.paidWith
      if (first) return first
      // A refund is spending turned round, so it only exists for ordinary spending.
      const refund = !settlement && d.refund === true
      return { amount: toPlain(parseNum(d.amount)!), categoryId, mode, instrumentId, date: d.date, note: d.note.trim().slice(0, 200), settlement, refund, income }
    }

    /** A snackbar whose Undo runs `run`. Only valid while that snackbar is showing. */
    const undoable = (text: string, run: () => void) => {
      const snackId = nextId()
      taskUndo = { snackId, run }
      set({ snack: { id: snackId, text, canUndo: true } })
    }

    const patchBill = (id: string, change: (i: RecurringItem) => RecurringItem) => {
      const { budget } = get()
      set({ budget: { ...budget, recurring: (budget.recurring ?? []).map((i) => (i.id === id ? change(i) : i)) } })
    }

    /**
     * Puts a bill's task card and reminder in place for `dueAt`, restoring or making the card as needed.
     * `anchorDay` is the day of the month it keeps aiming for (a bill on the 31st stays on the 31st). Returns the card's id, or null.
     */
    const armBill = (item: RecurringItem, dueAt: number, anchorDay: number): string | null => {
      const rem = { dueAt, repeat: item.repeat, leadDays: 1 }
      const existing = item.cardId ? get().cards.find((c) => c.id === item.cardId) : undefined
      let cardId: string | null
      if (existing) {
        get().restoreCard(existing.id)
        get().updateCard(existing.id, { title: item.title, amount: item.amount, summary: taskSummary(dueAt, item.repeat) }, rem)
        cardId = existing.id
      } else {
        cardId = get().saveCard({ title: item.title, kind: 'task', toolId: null, inputs: null, summary: taskSummary(dueAt, item.repeat), amount: item.amount, lines: [], note: '', tags: [] }, rem)
      }
      if (cardId) set({ reminders: get().reminders.map((r) => (r.cardId === cardId ? { ...r, anchorDay } : r)) })
      return cardId
    }

    /**
     * Ends a bill: it is marked stopped, and its helper card (nothing else is on it) and reminder go. Past entries stay.
     * Says nothing itself: returns the function that puts all of it back, so each caller wraps it in the ONE Undo it offers
     * (stopping a bill, or paying its last instalment, which must also take the payment back).
     */
    const endBill = (item: RecurringItem): (() => void) => {
      const { cards, reminders } = get()
      const card = cards.find((c) => c.id === item.cardId)
      const rem = reminders.find((r) => r.cardId === item.cardId)
      patchBill(item.id, (i) => ({ ...i, deletedAt: deps.now() }))
      set({ cards: cards.filter((c) => c.id !== item.cardId), reminders: reminders.filter((r) => r.cardId !== item.cardId) })
      return () => {
        patchBill(item.id, (i) => ({ ...i, deletedAt: null }))
        set({ cards: card ? [card, ...get().cards.filter((c) => c.id !== card.id)] : get().cards, reminders: rem ? [...get().reminders.filter((r) => r.cardId !== item.cardId), rem] : get().reminders })
      }
    }

    /** Makes the record together with its Due card and reminder. Returns the record's id, or null (and says why). */
    const makeBill = (d: Omit<RecurringItem, 'id' | 'cardId' | 'deletedAt'> & { dueAt: number; anchorDay: number }): string | null => {
      if (liveBills(get().budget).length >= MAX_RECURRING) return (fail(`You can keep up to ${MAX_RECURRING} bills.`), null)
      const { dueAt, anchorDay, ...fields } = d
      const id = deps.newId()
      const item: RecurringItem = { id, ...fields, cardId: null, deletedAt: null }
      const cardId = armBill(item, dueAt, anchorDay)
      if (cardId === null) return null
      const { budget } = get()
      set({ budget: { ...budget, recurring: [{ ...item, cardId }, ...(budget.recurring ?? [])] } })
      return id
    }

    /**
     * A bill's Due reminder was paid: adds the entry for that period (once; dated the due day, or today if it is not due yet).
     * Returns the new entry's id, or null when nothing was added (not a bill, paused, or already recorded).
     */
    const settleBill = (r: Reminder): string | null => {
      const { budget } = get()
      const item = billForCard(budget, r.cardId)
      if (!item || item.kind !== 'bill' || item.paused || !item.amount || budget.expenses.length >= MAX_EXPENSES) return null
      const due = dayKey(new Date(r.dueAt))
      const today = dayKey(new Date(deps.now()))
      const date = due <= today ? due : today
      if (budget.expenses.some((e) => e.deletedAt === null && e.recurringId === item.id && e.date === date)) return null
      const id = deps.newId()
      const fits = paymentError(budget, item.mode, item.instrumentId) === null
      const entry = { id, date, amount: item.amount, categoryId: item.categoryId !== null && categoryUsable(budget, item.categoryId) ? item.categoryId : null, mode: item.mode, instrumentId: fits ? item.instrumentId : null, note: item.title, deletedAt: null, recurringId: item.id }
      set({ budget: { ...budget, expenses: [entry, ...budget.expenses] } })
      return id
    }

    /** Puts removed history rows back at their old positions (ascending, so the indexes line up again). */
    const restoreHistory = (removed: { entry: HistoryEntry; index: number }[]) => {
      const restored = [...get().history]
      for (const { entry, index } of [...removed].sort((a, b) => a.index - b.index)) restored.splice(Math.min(index, restored.length), 0, entry)
      set({ history: capHistory(restored, MAX_HISTORY) })
    }

    const dropExpense = (id: string) => set({ budget: { ...get().budget, expenses: get().budget.expenses.filter((e) => e.id !== id) } })

    /** After a card is edited: keeps its bill reminder's name and day in step, or ends it when the due day is gone. */
    const syncCardBill = (instrumentId: string) => {
      const { budget, settings, reminders } = get()
      const item = cardBillFor(budget, instrumentId)
      if (!item) return
      const card = budget.instruments.find((i) => i.id === instrumentId && i.deletedAt === null)
      if (!card || card.dueDay == null) return get().stopBill(item.id)
      const title = `${instrumentLabel(card)} bill`
      patchBill(item.id, (i) => ({ ...i, title }))
      if (item.cardId) get().updateCard(item.cardId, { title })
      const rem = reminders.find((r) => r.cardId === item.cardId)
      // Only a changed due day moves the date: editing something else on the card must not undo a snooze.
      if (!item.paused && (!rem || rem.anchorDay !== card.dueDay)) armBill({ ...item, title }, cardBillDue(card.dueDay, deps.now(), settings.reminderTime), card.dueDay)
    }

    /** "Number of payments" typed on an entry that starts a bill: this entry is the first, so the bill has one fewer left. undefined = none given; false = not 2 to 600 (a bill of 1 payment is just an entry). */
    const leftAfterFirst = (payments: number | null | undefined): number | undefined | false => (payments == null ? undefined : isPaymentCount(payments) && payments >= 2 ? payments - 1 : false)
    const BAD_PAYMENTS = `Number of payments must be a whole number from 2 to ${MAX_PAYMENTS}`

    /** Starts a recurring bill from an entry that was just checked: this entry is its first payment. Returns the record's id, or null (and says why). */
    const startBill = (e: { amount: string; categoryId: string | null; mode: PaymentModeId | null; instrumentId: string | null; date: string; note: string }, repeat: BillRepeat, remaining?: number): string | null => {
      const { budget, settings } = get()
      const { dueAt, anchorDay } = firstDue(e.date, repeat, deps.now(), settings.reminderTime)
      const title = (e.note || (e.categoryId ? categoryName(budget, e.categoryId) : 'Recurring bill')).slice(0, 120)
      return makeBill({ kind: 'bill', title, amount: e.amount, repeat, categoryId: e.categoryId, mode: e.mode, instrumentId: e.instrumentId, ...(remaining !== undefined ? { remaining } : {}), dueAt, anchorDay })
    }

    /** A limit as a clean string, null for "none", or undefined (and a notice) when it is not acceptable. */
    const cleanLimit = (limit: string | null): string | null | undefined => {
      if (limit === null || limit.trim() === '') return null
      const bad = validateLimit(limit)
      if (bad) return void fail(bad)
      return toPlain(parseNum(limit)!)
    }

    /** Applies a limit to the every-month field or to one month's override. Returns the new pair, or null when refused. */
    const placeLimit = (
      limit: string | null,
      scope: LimitScope,
      standing: string | null,
      byMonth: Record<string, string | null> | undefined,
    ): { limit: string | null; byMonth: Record<string, string | null> | undefined } | null => {
      const v = cleanLimit(limit)
      if (v === undefined) return null
      if (scope.kind === 'always') return { limit: v, byMonth }
      if (!isMonthKey(scope.month)) return (fail('Pick a real month'), null)
      return { limit: standing, byMonth: { ...byMonth, [scope.month]: v } }
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
      // Entries deleted more than 30 days ago are gone for good, so deleting can free room under the 20,000 cap (B-27).
      drafts: initial.drafts ?? {},
      budget: { ...initial.budget, expenses: initial.budget.expenses.filter((e) => e.deletedAt === null || deps.now() - e.deletedAt < TRASH_DAYS * DAY) },

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

      setHistoryLocked: (id, locked) => {
        const { history } = get()
        if (locked && history.filter((h) => h.locked).length >= MAX_LOCKED) {
          return set({ notice: { id: nextId(), text: 'Unlock one to lock another.', tone: 'info' } })
        }
        set({ history: history.map((h) => (h.id === id ? (locked ? { ...h, locked: true } : { ...h, locked: undefined }) : h)) })
      },

      editHistoryExpression: (id, expression) => {
        const expr = expression.trim()
        if (expr === '') return 'Type an expression'
        if (!isRawExpression(expr)) return 'Check the expression'
        const r = evaluateExpression(expr, { angle: get().settings.angle })
        if (!r.ok) return r.message
        const result = toPlain(r.value)
        if (!/^-?\d{1,110}(\.\d{1,110})?$/.test(result)) return 'Too large to show'
        set({ history: get().history.map((h) => (h.id === id ? { ...h, expression: expr, result } : h)) })
        return null
      },

      deleteHistory: (id) => {
        const { history } = get()
        const index = history.findIndex((h) => h.id === id)
        const entry = history[index]
        if (index === -1 || !entry) return
        if (entry.locked) return set({ notice: { id: nextId(), text: 'Unlock it first to delete it.', tone: 'info' } })
        set({ history: history.filter((h) => h.id !== id) })
        undoable('Removed from history', () => restoreHistory([{ entry, index }]))
      },

      clearHistory: () => {
        const { history } = get()
        // Named and locked rows are kept: clearing is for the clutter, not for what you bothered to keep.
        const toRemove = history.map((entry, index) => ({ entry, index })).filter((r) => !isKept(r.entry))
        if (toRemove.length === 0) return
        set({ history: history.filter(isKept) })
        undoable(`Cleared ${toRemove.length} calculations`, () => restoreHistory(toRemove))
      },

      addExpense: (draft, repeat = null, payments = null) => {
        const e = checkedExpense(draft)
        if (typeof e === 'string') return fail(e)
        if (get().budget.expenses.length >= MAX_EXPENSES) return fail(`You can keep up to ${MAX_EXPENSES} entries.`)
        const { settlement, refund, income, ...rest } = e
        const makesBill = repeat && !settlement && !refund && !income
        const left = makesBill ? leftAfterFirst(payments) : undefined
        if (left === false) return fail(BAD_PAYMENTS)
        const recurringId = makesBill ? startBill(e, repeat, left) : undefined
        if (recurringId === null) return false
        const { budget } = get()
        set({ budget: { ...budget, expenses: [{ id: deps.newId(), ...rest, deletedAt: null, ...(settlement ? { settlement } : {}), ...(refund ? { refund: true } : {}), ...(income ? { income: true as const } : {}), ...(recurringId ? { recurringId } : {}) }, ...budget.expenses] }, notice: null })
        return true
      },

      updateExpense: (id, draft, repeat = null, payments = null) => {
        const old = get().budget.expenses.find((x) => x.id === id)
        const e = checkedExpense(draft, old?.categoryId ?? null)
        if (typeof e === 'string') return fail(e)
        const { settlement, refund, income, ...rest } = e
        const makesBill = repeat && old && !old.recurringId && !settlement && !refund && !income
        const left = makesBill ? leftAfterFirst(payments) : undefined
        if (left === false) return fail(BAD_PAYMENTS)
        const recurringId = makesBill ? startBill(e, repeat, left) : undefined
        if (recurringId === null) return false
        const { budget } = get()
        const at = deps.now()
        set({ budget: { ...budget, expenses: budget.expenses.map((x) => {
          if (x.id !== id) return x
          const { settlement: _s, refund: _r, income: _i, edits: _e, ...keep } = x
          // A trail of what changed (amount, date, category). It is only a note: it can never stop the save.
          const edits = withEdits(x.edits, expenseChanges(x, rest, at))
          return { ...keep, ...rest, ...(settlement ? { settlement } : {}), ...(refund ? { refund: true } : {}), ...(income ? { income: true as const } : {}), ...(recurringId ? { recurringId } : {}), ...(edits ? { edits } : {}) }
        }) } })
        return true
      },

      updateBill: (id, patch) => {
        const { budget, settings } = get()
        const item = liveBills(budget).find((i) => i.id === id)
        if (!item || item.kind !== 'bill') return false
        const title = (patch.title ?? item.title).trim()
        const amountText = patch.amount ?? item.amount ?? ''
        const bad = validateBill({ title, amount: amountText, date: patch.date ?? null })
        const first = bad.title ?? bad.amount ?? bad.date
        if (first) return fail(first)
        const amount = toPlain(parseNum(amountText)!)
        const repeat = patch.repeat ?? item.repeat
        const rem = get().reminders.find((r) => r.cardId === item.cardId)
        const dueAt = patch.date !== undefined ? atTime(parseDay(patch.date)!, settings.reminderTime) : (rem?.dueAt ?? item.pausedDue)
        if (patch.remaining != null && !isPaymentCount(patch.remaining)) return fail(`Number of payments must be a whole number from 1 to ${MAX_PAYMENTS}`)
        // Only an explicit remaining (a number, or null for "never ends") changes it. Any other edit keeps it as it is.
        const { remaining: kept, ...bare } = item
        const remaining = patch.remaining === undefined ? kept : (patch.remaining ?? undefined)
        const next: RecurringItem = { ...bare, title, amount, repeat, ...(remaining !== undefined ? { remaining } : {}), ...(item.paused && dueAt !== undefined ? { pausedDue: dueAt } : {}) }
        patchBill(id, () => next)
        if (!item.paused && dueAt !== undefined) armBill(next, dueAt, patch.date !== undefined ? new Date(dueAt).getDate() : (rem?.anchorDay ?? new Date(dueAt).getDate()))
        else if (item.cardId) get().updateCard(item.cardId, { title, amount, summary: 'Paused' })
        return true
      },

      pauseBill: (id) => {
        const item = liveBills(get().budget).find((i) => i.id === id)
        if (!item || item.paused) return
        const rem = get().reminders.find((r) => r.cardId === item.cardId)
        set({ reminders: get().reminders.filter((r) => r.cardId !== item.cardId) })
        patchBill(id, (i) => ({ ...i, paused: true, ...(rem ? { pausedDue: rem.dueAt } : {}) }))
        if (item.cardId) get().updateCard(item.cardId, { summary: 'Paused' })
        get().toast(`Paused "${item.title}". Resume it in Bills`)
      },

      resumeBill: (id) => {
        const { budget, settings } = get()
        const item = liveBills(budget).find((i) => i.id === id)
        if (!item) return
        const now = deps.now()
        const card = item.kind === 'cardBill' ? budget.instruments.find((i) => i.id === item.instrumentId && i.deletedAt === null) : undefined
        if (item.kind === 'cardBill' && (!card || card.dueDay == null)) return void fail("Add this card's due day first")
        const base = item.pausedDue ?? now
        const anchor = card?.dueDay ?? new Date(base).getDate()
        const dueAt = card?.dueDay != null ? cardBillDue(card.dueDay, now, settings.reminderTime) : rollForward(base, item.repeat, anchor, now)
        const cardId = armBill(item, dueAt, anchor)
        if (cardId === null) return
        patchBill(id, ({ paused: _p, pausedDue: _d, ...i }) => ({ ...i, cardId }))
      },

      stopBill: (id) => {
        const item = liveBills(get().budget).find((i) => i.id === id)
        if (!item) return
        // Its helper card goes with it (nothing else is on it), and comes back with Undo.
        undoable(`Stopped "${item.title}"`, endBill(item))
      },

      setCardBillReminder: (instrumentId, on) => {
        const { budget, settings } = get()
        const existing = cardBillFor(budget, instrumentId)
        if (!on) {
          if (existing) get().stopBill(existing.id)
          return true
        }
        if (existing) return true
        const card = budget.instruments.find((i) => i.id === instrumentId && i.deletedAt === null && i.kind === 'credit')
        if (!card) return fail('Pick a credit card first')
        if (card.dueDay == null) return fail("Add this card's due day first")
        const id = makeBill({ kind: 'cardBill', title: `${instrumentLabel(card)} bill`, amount: null, repeat: 'monthly', categoryId: null, mode: null, instrumentId, dueAt: cardBillDue(card.dueDay, deps.now(), settings.reminderTime), anchorDay: card.dueDay })
        if (id) get().toast(`Reminder on for day ${card.dueDay} of every month`)
        return id !== null
      },

      markSmsSeen: (ids) => {
        const { budget } = get()
        const next = [...new Set([...ids, ...(budget.smsSeen ?? [])])].slice(0, 5000)
        set({ budget: { ...budget, smsSeen: next } })
      },

      deleteExpense: (id) => {
        const { budget } = get()
        const target = budget.expenses.find((x) => x.id === id && x.deletedAt === null)
        if (!target) return
        set({ budget: { ...budget, expenses: budget.expenses.map((x) => (x.id === id ? { ...x, deletedAt: deps.now() } : x)) } })
        undoable('Removed from your budget', () => {
          const b = get().budget
          set({ budget: { ...b, expenses: b.expenses.map((x) => (x.id === id ? { ...x, deletedAt: null } : x)) } })
        })
      },

      setDraft: (toolId, values) => {
        const { [toolId]: _old, ...rest } = get().drafts
        // Re-added last, so the oldest ones are the ones dropped at the limit.
        const next = values === null ? rest : { ...rest, [toolId]: values }
        set({ drafts: Object.fromEntries(Object.entries(next).slice(-MAX_DRAFTS)) })
      },

      recategorise: (ids, categoryId) => {
        const { budget } = get()
        if (categoryId !== null && !categoryUsable(budget, categoryId)) return (fail('Pick a category from the list'), 0)
        const want = new Set(ids)
        const at = deps.now()
        const before = new Map<string, BudgetExpense>()
        let wrongMonth = 0
        const expenses = budget.expenses.map((x) => {
          if (!want.has(x.id) || x.deletedAt !== null || !countsAsSpend(x) || x.categoryId === categoryId) return x
          if (categoryId !== null && !categoryActiveIn(budget, categoryId, x.date.slice(0, 7))) return (wrongMonth++, x)
          before.set(x.id, x)
          const edits = withEdits(x.edits, expenseChanges(x, { ...x, categoryId }, at))
          return { ...x, categoryId, ...(edits ? { edits } : {}) }
        })
        if (before.size === 0) {
          if (wrongMonth > 0 && categoryId !== null) fail(`${categoryName(budget, categoryId)} is not used in ${wrongMonth === 1 ? 'that entry\'s month' : 'those entries\' months'}`)
          return 0
        }
        set({ budget: { ...budget, expenses }, notice: null })
        const name = categoryId === null ? 'Uncategorised' : categoryName(budget, categoryId)
        undoable(`${before.size} ${before.size === 1 ? 'entry' : 'entries'} moved to ${name}${wrongMonth > 0 ? `. ${wrongMonth} skipped: not used in their month` : ''}`, () => {
          const b = get().budget
          set({ budget: { ...b, expenses: b.expenses.map((x) => before.get(x.id) ?? x) } })
        })
        return before.size
      },

      setCategoryLimit: (id, limit, scope = { kind: 'always' }) => {
        const { budget } = get()
        const cur = budget.categories.find((c) => c.id === id)
        if (!cur) return false
        const r = placeLimit(limit, scope, cur.limit, cur.limitByMonth)
        if (!r) return false
        set({ budget: { ...budget, categories: budget.categories.map((c) => (c.id === id ? { ...c, limit: r.limit, ...(r.byMonth ? { limitByMonth: r.byMonth } : {}) } : c)) }, notice: null })
        return true
      },

      setOverallLimit: (limit, scope = { kind: 'always' }) => {
        const { budget } = get()
        const r = placeLimit(limit, scope, budget.overall, budget.overallByMonth)
        if (!r) return false
        set({ budget: { ...budget, overall: r.limit, ...(r.byMonth ? { overallByMonth: r.byMonth } : {}) }, notice: null })
        return true
      },

      clearMonthLimit: (target, month) => {
        const { budget } = get()
        const without = (m: Record<string, string | null> | undefined) => {
          if (!m || !Object.hasOwn(m, month)) return m
          const { [month]: _gone, ...left } = m
          return Object.keys(left).length > 0 ? left : undefined
        }
        if (target === 'overall') {
          const { overallByMonth: _o, ...rest } = budget
          const next = without(budget.overallByMonth)
          return set({ budget: { ...rest, ...(next ? { overallByMonth: next } : {}) } })
        }
        set({
          budget: {
            ...budget,
            categories: budget.categories.map((c) => {
              if (c.id !== target) return c
              const { limitByMonth: _l, ...rest } = c
              const next = without(c.limitByMonth)
              return { ...rest, ...(next ? { limitByMonth: next } : {}) }
            }),
          },
        })
      },

      setCategoryMonths: (id, months) => {
        const { budget } = get()
        const cur = budget.categories.find((c) => c.id === id && c.deletedAt === null)
        if (!cur) return false
        const bad = validateCategoryMonths(budget, id, months)
        if (bad) return fail(bad)
        const clean = months === null ? null : [...new Set(months)].sort()
        set({
          budget: { ...budget, categories: budget.categories.map((c) => { if (c.id !== id) return c; const { months: _m, ...rest } = c; return clean ? { ...rest, months: clean } : rest }) },
          notice: null,
        })
        return true
      },

      addCategory: (name, parentId = null, months = null) => {
        const clean = name.trim().slice(0, 40)
        const { budget } = get()
        if (!clean) return null
        if (parentId !== null && !budget.categories.some((c) => c.id === parentId && c.deletedAt === null && c.parentId === null)) return null
        if (budget.categories.filter((c) => c.deletedAt === null).length >= MAX_CATEGORIES) {
          fail(`You can have up to ${MAX_CATEGORIES} categories.`)
          return null
        }
        const live = budget.categories.find((c) => c.deletedAt === null && c.parentId === parentId && c.name.toLowerCase() === clean.toLowerCase())
        if (live) return live.id
        if (parentId !== null && budget.categories.filter((c) => c.deletedAt === null && c.parentId === parentId).length >= MAX_SUBCATEGORIES) {
          fail(`A category can have up to ${MAX_SUBCATEGORIES} subcategories.`)
          return null
        }
        const badMonths = validateNewCategoryMonths(budget, parentId, months)
        if (badMonths) {
          fail(badMonths)
          return null
        }
        const id = deps.newId()
        const own = months ? [...new Set(months)].sort() : null
        set({ budget: { ...budget, categories: [...budget.categories, { id, name: clean, limit: null, parentId, deletedAt: null, ...(own ? { months: own } : {}) }] } })
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
        const at = deps.now()
        set({ budget: { ...budget, categories: budget.categories.map((c) => ((c.id === id || c.parentId === id) && c.deletedAt === null ? { ...c, deletedAt: at } : c)) } })
      },

      addRule: (match, categoryId) => {
        const m = cleanRuleMatch(match)
        if (!m.ok) return fail(m.error)
        const { budget } = get()
        if (!categoryUsable(budget, categoryId)) return fail('Pick a category from the list')
        const rules = budget.rules ?? []
        const same = rules.find((r) => r.match.toLowerCase() === m.value.toLowerCase())
        if (!same && rules.length >= MAX_RULES) return fail(`You can have up to ${MAX_RULES} rules. Delete one first.`)
        const next = { id: same?.id ?? deps.newId(), match: same?.match ?? m.value, categoryId }
        set({ budget: { ...budget, rules: [next, ...rules.filter((r) => r !== same)] } })
        return true
      },

      deleteRule: (id) => {
        const { budget } = get()
        const rules = budget.rules ?? []
        const at = rules.findIndex((r) => r.id === id)
        if (at < 0) return
        const gone = rules[at]!
        set({ budget: { ...budget, rules: rules.filter((r) => r.id !== id) } })
        undoable('Rule deleted', () => {
          const b = get().budget
          const cur = (b.rules ?? []).filter((r) => r.id !== id)
          set({ budget: { ...b, rules: [...cur.slice(0, at), gone, ...cur.slice(at)] } })
        })
      },

      addInstrument: (draft) => {
        const r = cleanInstrument(draft)
        if (!r.ok) {
          fail(r.error)
          return null
        }
        const { budget } = get()
        const live = budget.instruments.filter((i) => i.deletedAt === null)
        const same = live.find((i) => i.kind === r.value.kind && i.name.toLowerCase() === r.value.name.toLowerCase())
        if (same) return same.id
        if (live.length >= MAX_INSTRUMENTS) {
          fail(`You can have up to ${MAX_INSTRUMENTS} cards, accounts and wallets.`)
          return null
        }
        const id = deps.newId()
        set({ budget: { ...budget, instruments: [...budget.instruments, { id, ...r.value, deletedAt: null }] }, notice: null })
        return id
      },

      updateInstrument: (id, patch) => {
        const { budget } = get()
        const cur = budget.instruments.find((i) => i.id === id && i.deletedAt === null)
        if (!cur) return false
        const merged = { ...cur, ...patch }
        const r = cleanInstrument(patch.kind && patch.kind !== cur.kind ? dropInapplicable(merged) : merged)
        if (!r.ok) return fail(r.error)
        if (budget.instruments.some((i) => i.id !== id && i.deletedAt === null && i.kind === r.value.kind && i.name.toLowerCase() === r.value.name.toLowerCase())) {
          return fail('You already have one with that name')
        }
        const next: PayInstrument = { ...cur, ...r.value }
        set({
          budget: {
            ...budget,
            instruments: budget.instruments.map((i) => (i.id === id ? next : i)),
            // A kind or network change can make an old pairing invalid (a Visa credit card used for UPI): the entry keeps its mode, loses the instrument.
            // A settlement (card bill, transfer) has no mode at all by design, so `mode === null` must
            // never detach one -- that check is only for an ordinary spend whose mode no longer fits.
            expenses: budget.expenses.map((x) =>
              x.instrumentId === id && countsAsSpend(x) && (x.mode === null || !instrumentFitsMode(x.mode, next)) ? { ...x, instrumentId: null } : x,
            ),
          },
          notice: null,
        })
        syncCardBill(id)
        return true
      },

      deleteInstrument: (id) => {
        const bill = cardBillFor(get().budget, id)
        if (bill) get().stopBill(bill.id)
        const { budget } = get() // read after stopBill, which changed it
        const at = deps.now()
        set({
          budget: {
            ...budget,
            instruments: budget.instruments.map((i) => (i.id === id && i.deletedAt === null ? { ...i, deletedAt: at } : i)),
            expenses: budget.expenses.map((x) => (x.instrumentId === id ? { ...x, instrumentId: null } : x)),
          },
        })
      },

      undoRemoval: () => {
        if (taskUndo && taskUndo.snackId === get().snack?.id) {
          const t = taskUndo
          taskUndo = null
          set({ snack: null })
          return t.run()
        }
      },

      saveCard: (draft, reminder) => {
        const { cards } = get()
        if (cards.filter((c) => c.deletedAt === null).length >= MAX_CARDS) {
          const text = draft.kind === 'task' || draft.kind === 'text' ? `You can keep up to ${MAX_CARDS} notes and tasks. Delete some first.` : `You can keep up to ${MAX_CARDS} saved items. Delete some first.`
          // `notice` is only drawn on Calculate, so also say it in the snackbar every screen has.
          set({ notice: { id: nextId(), text, tone: 'error' }, snack: { id: nextId(), text, canUndo: false } })
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
        const lines = card.lines.map((l) => (l.id === lineId ? withLineState(l, nextLineState(lineState(l))) : l))
        const opts = { system: settings.numberSystem, decimals: settings.decimals }
        set({ cards: cards.map((c) => (c.id === cardId ? { ...c, lines, summary: listSummary(lines, !!c.checklist, opts), updatedAt: deps.now() } : c)) })
      },

      removeLine: (cardId, lineId) => {
        const card = get().cards.find((c) => c.id === cardId && c.deletedAt === null)
        const index = card ? card.lines.findIndex((l) => l.id === lineId) : -1
        if (!card || index < 0) return
        const line = card.lines[index]!
        const { settings } = get()
        const opts = { system: settings.numberSystem, decimals: settings.decimals }
        const setLines = (lines: TapeLine[]) =>
          set({ cards: get().cards.map((c) => (c.id === cardId ? { ...c, lines, amount: toPlain(tapeTotal(lines)), summary: listSummary(lines, !!c.checklist, opts), updatedAt: deps.now() } : c)) })
        setLines(card.lines.filter((l) => l.id !== lineId))
        undoable(`Removed "${line.label || 'line'}" from the list`, () => {
          const cur = get().cards.find((c) => c.id === cardId)
          if (!cur || cur.lines.some((l) => l.id === lineId)) return
          setLines([...cur.lines.slice(0, index), line, ...cur.lines.slice(index)])
        })
      },

      togglePin: (id) => {
        const { cards } = get()
        const card = cards.find((c) => c.id === id)
        if (!card) return
        if (!card.pinned && cards.filter((c) => c.pinned && c.deletedAt === null).length >= MAX_PINNED) {
          const text = `You can pin up to ${MAX_PINNED}. Unpin one first.`
          // `notice` is what the Calculate screen's own note line reads; `snack` is the one message
          // box mounted everywhere else (the Notes list has no note line of its own to show `notice`).
          return set({ notice: { id: nextId(), text, tone: 'info' }, snack: { id: nextId(), text, canUndo: false } })
        }
        set({ cards: cards.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)) })
      },

      deleteCard: (id) => {
        const card = get().cards.find((c) => c.id === id && c.deletedAt === null)
        if (!card) return
        set({ cards: get().cards.map((c) => (c.id === id ? { ...c, deletedAt: deps.now(), pinned: false } : c)) })
        undoable(`Moved "${card.title}" to Trash`, () => get().restoreCard(id))
      },

      restoreCard: (id) => {
        const { cards } = get()
        if (!cards.some((c) => c.id === id && c.deletedAt !== null)) return
        // Restoring is saving again: past the cap the extra card would be dropped, unseen, the next time the app opens (QA N-140).
        if (cards.filter((c) => c.deletedAt === null).length >= MAX_CARDS) {
          const text = `You can keep up to ${MAX_CARDS} notes and tasks. Delete some first.`
          return set({ notice: { id: nextId(), text, tone: 'error' }, snack: { id: nextId(), text, canUndo: false } })
        }
        set({ cards: cards.map((c) => (c.id === id ? { ...c, deletedAt: null } : c)) })
      },

      emptyTrash: () => {
        const cards = get().cards.filter((c) => c.deletedAt === null)
        const ids = new Set(cards.map((c) => c.id))
        set({ cards, reminders: get().reminders.filter((r) => ids.has(r.cardId)) })
      },

      markPaid: (reminderId) => {
        const r = get().reminders.find((x) => x.id === reminderId)
        if (!r) return
        const card = get().cards.find((c) => c.id === r.cardId)
        const amount = card?.amount ?? null
        // A plain task caught up late jumps to its next FUTURE date, as ticking it in To-do does (QA N-125). A bill pays each period in turn.
        const next = card?.kind === 'task' && !billForCard(get().budget, r.cardId) ? nextOccurrence(r, deps.now()) : advance(r, deps.now())
        const paid = { ...r, history: [...r.history, { paidAt: deps.now(), amount }].slice(-200) }
        // A bill that repeats also puts this period's payment in the budget (once), and Undo takes both back.
        const added = settleBill(r)
        // A bill with a set number of payments counts this one.
        const bill = billForCard(get().budget, r.cardId)
        const left = bill?.kind === 'bill' && !bill.paused ? bill.remaining : undefined
        if (bill && left !== undefined && left <= 1) {
          // The last payment: the entry is recorded, then the bill ends. ONE Undo takes back both (there is only one undo slot).
          const restoreBill = endBill(bill)
          return undoable('Last payment recorded. This bill has ended.', () => {
            if (added) dropExpense(added)
            restoreBill()
          })
        }
        if (bill && left !== undefined) patchBill(bill.id, (i) => ({ ...i, remaining: left - 1 }))
        set({ reminders: get().reminders.map((x) => (x.id === reminderId ? (next === null ? { ...paid, done: true } : { ...paid, dueAt: next }) : x)) })
        // A wrong tap on Mark paid takes a reminder out of Due, so it always offers Undo (QA N-133).
        undoable(added ? 'Paid. Added to your budget' : card ? `${card.kind === 'task' ? 'Done' : 'Marked paid'}: "${card.title}"` : 'Marked paid', () => {
          if (added) dropExpense(added)
          if (bill && left !== undefined) patchBill(bill.id, (i) => ({ ...i, remaining: left }))
          set({ reminders: get().reminders.map((x) => (x.id === reminderId ? r : x)) })
        })
      },

      // Calendar days, so a daylight-saving change cannot move the time of day (QA N-112).
      snooze: (reminderId, days) =>
        set({ reminders: get().reminders.map((r) => (r.id === reminderId ? { ...r, dueAt: addDaysAt(Math.max(r.dueAt, deps.now()), days, Math.max(r.dueAt, deps.now())) } : r)) }),

      removeReminder: (reminderId) => {
        const r = get().reminders.find((x) => x.id === reminderId)
        // Removing a bill's reminder ends the bill (a bill without its reminder would be half alive); Undo brings it back.
        const bill = r ? billForCard(get().budget, r.cardId) : undefined
        if (bill) return get().stopBill(bill.id)
        set({ reminders: get().reminders.filter((x) => x.id !== reminderId) })
      },

      setTaskDone: (id, done) => {
        const { cards, reminders } = get()
        const card = cards.find((c) => c.id === id && c.kind === 'task' && c.deletedAt === null)
        if (!card) return false
        const rem = reminders.find((r) => r.cardId === id)
        const now = deps.now()
        const setCard = (next: SavedCard) => set({ cards: get().cards.map((c) => (c.id === id ? next : c)) })
        const setRem = (next: Reminder | undefined) => set({ reminders: [...get().reminders.filter((r) => r.cardId !== id), ...(next ? [next] : [])] })
        if (!done) {
          const { done: _d, doneAt: _t, ...rest } = card
          setCard({ ...rest, updatedAt: now })
          if (rem?.done) setRem({ ...rem, done: false })
          return true
        }
        // A bill with a set number of payments is paid the way Due pays it, so the count and the last-payment end work from here too.
        if (rem && !rem.done && billForCard(get().budget, id)?.remaining !== undefined) {
          get().markPaid(rem.id)
          return true
        }
        const next = rem && !rem.done ? nextOccurrence(rem, now) : null
        let text: string
        let addedEntry: string | null = null
        if (rem && next !== null) {
          // A repeating task is never "done": it moves on, and the tick is logged.
          setRem({ ...rem, dueAt: next, history: [...rem.history, { paidAt: now, amount: null }].slice(-200) })
          addedEntry = settleBill(rem)
          text = `Done. Next on ${shortDate(next)}${addedEntry ? '. Added to your budget' : ''}`
        } else {
          setCard({ ...card, done: true, doneAt: now, updatedAt: now })
          if (rem) setRem({ ...rem, done: true })
          text = `Done: "${card.title}"`
        }
        const snackId = nextId()
        taskUndo = {
          snackId,
          run: () => {
            set({ cards: get().cards.map((c) => (c.id === id ? card : c)) })
            setRem(rem)
            if (addedEntry) dropExpense(addedEntry)
          },
        }
        set({ snack: { id: snackId, text, canUndo: true } })
        return true
      },

      clearDoneTasks: () => {
        const { cards, reminders } = get()
        const at = deps.now()
        const doneIds = new Set(cards.filter((c) => c.kind === 'task' && c.deletedAt === null && isTaskDone(c, reminders.find((r) => r.cardId === c.id))).map((c) => c.id))
        if (doneIds.size === 0) return 0
        const before = new Map(cards.filter((c) => doneIds.has(c.id)).map((c) => [c.id, c]))
        const snackId = nextId()
        taskUndo = { snackId, run: () => set({ cards: get().cards.map((c) => before.get(c.id) ?? c) }) }
        set({
          cards: cards.map((c) => (doneIds.has(c.id) ? { ...c, deletedAt: at, pinned: false } : c)),
          snack: { id: snackId, text: `Moved ${doneIds.size} done ${doneIds.size === 1 ? 'task' : 'tasks'} to Trash`, canUndo: true },
        })
        return doneIds.size
      },

      addAdvanceTaxPack: () => {
        const now = deps.now()
        const have = new Set(get().cards.filter((c) => c.deletedAt === null).map((c) => c.title))
        let added = 0
        for (const p of advanceTaxPack(now, get().settings.reminderTime)) {
          if (have.has(p.title)) continue
          // Yearly, so ticking one off moves it to the same date next year.
          const id = get().saveCard({ title: p.title, kind: 'task', toolId: null, inputs: null, summary: taskSummary(p.dueAt, 'yearly'), amount: null, lines: [], note: p.note, tags: ['Tax'] }, { dueAt: p.dueAt, repeat: 'yearly', leadDays: 7 })
          if (!id) break
          added++
        }
        const text = added === 4 ? 'Added 4 advance tax reminders' : added === 0 ? 'Advance tax reminders are already there' : `Added ${added} advance tax reminders. The rest were already there`
        set({ snack: { id: nextId(), text, canUndo: false } })
        return added
      },

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
      toast: (text) => set({ snack: { id: nextId(), text, canUndo: false } }),

      showLinkSnack: (text, link) => set({ snack: { id: nextId(), text, canUndo: false, link } }),

      dismissSnack: (id) => {
        if (get().snack?.id === id) set({ snack: null })
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
          drafts: data.drafts ?? {},
          snack: null,
          notice: null,
          lastExpression: null,
        }),

      snapshot: () => {
        const { input, history, cards, reminders, memory, settings, budget, drafts } = get()
        return { schemaVersion: initial.schemaVersion, input, history, cards, reminders, memory, settings, budget, ...(Object.keys(drafts).length > 0 ? { drafts } : {}) }
      },
    }
  })
}

export { INITIAL_INPUT }
