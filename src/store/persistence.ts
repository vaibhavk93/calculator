import { INITIAL_INPUT, type InputState } from '../engine'
import { ACCENT_NAMES, type AccentName, type ThemePreference } from '../lib/theme'
import type { KeyValueStorage } from '../lib/storage'
import { parseTime } from '../lib/reminders'
import { MAX_RECURRING, isAccountType, isBillRepeat, isMonthKey, isSettlement, type RecurringItem } from '../lib/budget'
import {
  DEFAULT_SETTINGS,
  MAX_HISTORY,
  MAX_MEMO,
  isKept,
  TABS,
  MAX_CARDS,
  MAX_TASK_TAGS,
  MAX_PINNED,
  REPEATS,
  MAX_CATEGORIES,
  MAX_EXPENSES,
  MAX_INSTRUMENTS,
  instrumentFitsMode,
  isInstrumentKind,
  isNetwork,
  isPaymentMode,
  starterBudget,
  type PayInstrument,
  type BudgetCategory,
  type BudgetData,
  type BudgetExpense,
  type HistoryEntry,
  type PersistedData,
  type Reminder,
  type Repeat,
  type SavedCard,
  type Settings,
  type Tab,
  type TapeLine,
} from './types'
import type { Values } from '../lib/tool'

export const STORAGE_KEY = 'vkcalc.data'
/** Bump when the stored shape changes, and add a step to MIGRATIONS. */
export const CURRENT_SCHEMA = 3

export function defaultPersisted(): PersistedData {
  return {
    schemaVersion: CURRENT_SCHEMA,
    settings: { ...DEFAULT_SETTINGS },
    history: [],
    cards: [],
    reminders: [],
    memory: null,
    input: { ...INITIAL_INPUT },
    budget: starterBudget(),
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

/** A time in ms, or null. */
const stamp = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

/** Never trusts what is on disk: every field is checked and falls back to its default. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = isObject(raw) ? raw : {}
  const d = DEFAULT_SETTINGS
  const decimals =
    r.decimals === 'auto' || (typeof r.decimals === 'number' && Number.isInteger(r.decimals) && r.decimals >= 0 && r.decimals <= 10)
      ? (r.decimals as Settings['decimals'])
      : d.decimals

  return {
    theme: oneOf<ThemePreference>(r.theme, ['dark', 'light', 'system'], d.theme),
    accent: oneOf<AccentName>(r.accent, ACCENT_NAMES, d.accent),
    numberSystem: oneOf(r.numberSystem, ['indian', 'international'] as const, d.numberSystem),
    decimals,
    angle: oneOf(r.angle, ['deg', 'rad'] as const, d.angle),
    startupTab: oneOf<Tab>(r.startupTab, TABS, d.startupTab),
    startupTool: typeof r.startupTool === 'string' && /^[a-z0-9-]{1,64}$/.test(r.startupTool) ? r.startupTool : null,
    haptics: bool(r.haptics, d.haptics),
    keepAwake: bool(r.keepAwake, d.keepAwake),
    keepHistory: bool(r.keepHistory, d.keepHistory),
    copyFormat: oneOf(r.copyFormat, ['ask', 'with', 'without'] as const, d.copyFormat),
    reminderTime: parseTime(r.reminderTime) ? (r.reminderTime as string) : d.reminderTime,
    lastBackupAt: stamp(r.lastBackupAt),
    backupNudgedAt: stamp(r.backupNudgedAt),
    backupDismissedAt: stamp(r.backupDismissedAt),
    dismissedTips: Array.isArray(r.dismissedTips) ? [...new Set(r.dismissedTips.filter((t): t is string => typeof t === 'string' && /^[a-z0-9-]{1,40}$/.test(t)))].slice(0, 20) : [],
  }
}

const PLAIN_NUMBER = /^-?\d{1,110}(\.\d{1,110})?$/
const RAW_EXPRESSION = /^[0-9a-z.+\-*/^()%!π√−×÷ ]*$/i

export const isRawExpression = (v: string) => v.length <= 500 && RAW_EXPRESSION.test(v)

export const isPlainNumber = (v: unknown): v is string => typeof v === 'string' && PLAIN_NUMBER.test(v)

/**
 * Caps history at `max`. Named and locked rows are never evicted (only Clear all's confirmation, or deleting
 * an unlocked one, removes them); the oldest plain rows go first. `entries` is newest-first.
 */
export function capHistory(entries: HistoryEntry[], max: number): HistoryEntry[] {
  if (entries.length <= max) return entries
  const [newest, ...rest] = entries
  if (!newest) return entries
  // The newest row's own slot is reserved before anything else: a calculation you just
  // finished must never vanish the instant it is made, even if every other row happens
  // to be kept (named or locked) already -- e2e/calculator.test.mjs CALC-254.
  const kept = rest.filter(isKept).length
  const room = new Set(rest.filter((e) => !isKept(e)).slice(0, Math.max(0, max - 1 - kept)).map((e) => e.id))
  return [newest, ...rest.filter((e) => isKept(e) || room.has(e.id))]
}

export function sanitizeHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const out: HistoryEntry[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!isObject(item)) continue
    const { id, expression, result, at } = item
    if (typeof id !== 'string' || id === '' || id.length > 64 || seen.has(id)) continue
    if (typeof expression !== 'string' || expression === '' || expression.length > 500 || !RAW_EXPRESSION.test(expression)) continue
    if (!isPlainNumber(result)) continue
    seen.add(id)
    const memo = typeof item.memo === 'string' ? item.memo.trim().slice(0, MAX_MEMO) : ''
    out.push({ id, expression, result, at: typeof at === 'number' && Number.isFinite(at) ? at : 0, ...(memo ? { memo } : {}), ...(item.locked === true ? { locked: true } : {}) })
  }
  return capHistory(out, MAX_HISTORY)
}

export function sanitizeInput(raw: unknown): InputState {
  if (!isObject(raw)) return { ...INITIAL_INPUT }
  const expr = typeof raw.expr === 'string' && raw.expr.length <= 500 && RAW_EXPRESSION.test(raw.expr) ? raw.expr : ''
  // `fresh: true` means expr is already a finished answer -- always a plain number, per
  // equals() in input.ts, never a bare operator or function call like "sin(". A damaged or
  // tampered file claiming otherwise white-screens the app (B-16): treat it as mid-typing instead.
  return { expr, fresh: isPlainNumber(expr) && raw.fresh === true }
}

const str = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v.slice(0, max) : fallback)
const ts = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const goodId = (v: unknown): v is string => typeof v === 'string' && v !== '' && v.length <= 64

/** Calculator form values: text, or lists of rows of text. Anything else is dropped. */
function sanitizeValues(raw: unknown): Values | null {
  if (!isObject(raw)) return null
  const out: Values = {}
  for (const [k, v] of Object.entries(raw).slice(0, 60)) {
    if (k.length > 64) continue
    if (typeof v === 'string') out[k] = v.slice(0, 200)
    else if (Array.isArray(v))
      out[k] = v.slice(0, 50).map((row) => (Array.isArray(row) ? row.slice(0, 8).map((c) => str(c, 200)) : []))
  }
  return out
}

function sanitizeLines(raw: unknown): TapeLine[] {
  if (!Array.isArray(raw)) return []
  const out: TapeLine[] = []
  for (const l of raw.slice(0, 1000)) {
    if (isObject(l) && goodId(l.id) && isPlainNumber(l.value)) out.push({ id: l.id, label: str(l.label, 80), value: l.value, ...(l.done === true ? { done: true } : {}) })
  }
  return out
}

export function sanitizeCards(raw: unknown): SavedCard[] {
  if (!Array.isArray(raw)) return []
  const out: SavedCard[] = []
  const seen = new Set<string>()
  let pinned = 0
  for (const c of raw) {
    if (!isObject(c) || !goodId(c.id) || seen.has(c.id)) continue
    const kind = oneOf(c.kind, ['tool', 'tape', 'task'] as const, 'tool')
    const toolId = typeof c.toolId === 'string' ? c.toolId.slice(0, 64) : null
    if (kind === 'tool' && !toolId) continue
    // A task with no name has nothing to show: drop it, as a calculation with no calculator is dropped.
    if (kind === 'task' && (typeof c.title !== 'string' || !c.title.trim())) continue
    seen.add(c.id)
    const wantsPin = c.pinned === true && c.deletedAt == null && pinned < MAX_PINNED
    if (wantsPin) pinned++
    out.push({
      id: c.id,
      title: str(c.title, 120, 'Untitled'),
      kind,
      toolId,
      inputs: kind === 'tool' ? sanitizeValues(c.inputs) : null,
      summary: str(c.summary, 200),
      amount: isPlainNumber(c.amount) ? c.amount : null,
      // Absent on anything saved before units existed: those were all money.
      ...(typeof c.amountFmt === 'string' && ['money', 'percent', 'number', 'int', 'text'].includes(c.amountFmt)
        ? { amountFmt: c.amountFmt as SavedCard['amountFmt'] }
        : {}),
      lines: kind === 'tape' ? sanitizeLines(c.lines) : [],
      ...(kind === 'tape' && c.checklist === true ? { checklist: true } : {}),
      ...(kind === 'task' && c.done === true ? { done: true, ...(typeof c.doneAt === 'number' && Number.isFinite(c.doneAt) ? { doneAt: c.doneAt } : {}) } : {}),
      note: str(c.note, 5000),
      tags: Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === 'string').map((t) => t.slice(0, 30)).slice(0, kind === 'task' ? MAX_TASK_TAGS : 10) : [],
      pinned: wantsPin,
      createdAt: ts(c.createdAt),
      updatedAt: ts(c.updatedAt),
      deletedAt: typeof c.deletedAt === 'number' && Number.isFinite(c.deletedAt) ? c.deletedAt : null,
    })
    if (out.length >= MAX_CARDS) break
  }
  return out
}

export function sanitizeReminders(raw: unknown, cards: SavedCard[]): Reminder[] {
  if (!Array.isArray(raw)) return []
  const ids = new Set(cards.map((c) => c.id))
  const out: Reminder[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    // A reminder whose card is gone has nothing to say: drop it.
    if (!isObject(r) || !goodId(r.id) || seen.has(r.id) || !goodId(r.cardId) || !ids.has(r.cardId)) continue
    if (typeof r.dueAt !== 'number' || !Number.isFinite(r.dueAt)) continue
    seen.add(r.id)
    const day = typeof r.anchorDay === 'number' && Number.isInteger(r.anchorDay) && r.anchorDay >= 1 && r.anchorDay <= 31 ? r.anchorDay : new Date(r.dueAt).getDate()
    const lead = typeof r.leadDays === 'number' && Number.isInteger(r.leadDays) && r.leadDays >= 0 && r.leadDays <= 60 ? r.leadDays : 3
    out.push({
      id: r.id,
      cardId: r.cardId,
      dueAt: r.dueAt,
      repeat: oneOf<Repeat>(r.repeat, REPEATS, 'none'),
      anchorDay: day,
      leadDays: lead,
      done: r.done === true,
      history: Array.isArray(r.history)
        ? r.history.slice(-200).flatMap((h) => (isObject(h) && typeof h.paidAt === 'number' ? [{ paidAt: h.paidAt, amount: isPlainNumber(h.amount) ? h.amount : null }] : []))
        : [],
    })
  }
  return out
}

/** 'YYYY-MM' -> plain amount or null. Empty or damaged gives undefined, so old data stays unchanged. */
const limitMap = (v: unknown): Record<string, string | null> | undefined => {
  if (!isObject(v)) return undefined
  const out: Record<string, string | null> = {}
  for (const [k, x] of Object.entries(v).slice(0, 240)) {
    if (!isMonthKey(k)) continue
    if (x === null) out[k] = null
    else if (isPlainNumber(x) && !x.startsWith('-')) out[k] = x
  }
  return Object.keys(out).length > 0 ? out : undefined
}
const monthList = (v: unknown): string[] | undefined => {
  if (!Array.isArray(v)) return undefined
  const out = [...new Set(v.filter(isMonthKey))].sort().slice(0, 240)
  return out.length > 0 ? out : undefined
}
const day28 = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 28 ? v : undefined)
const ifSet = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>

const DAY_KEY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

const seenList = (v: unknown): string[] | undefined => {
  const out = (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && /^[0-9a-z]{4,30}$/.test(x)).slice(0, 5000)
  return out.length > 0 ? out : undefined
}

export function sanitizeBudget(raw: unknown): BudgetData {
  if (!isObject(raw)) return starterBudget()
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

  // Categories: first collect the well-formed ones, then settle the parent links (old data has none).
  const found: { cat: BudgetCategory; rawParent: unknown }[] = []
  const catIds = new Set<string>()
  for (const c of Array.isArray(raw.categories) ? raw.categories : []) {
    if (!isObject(c) || !goodId(c.id) || catIds.has(c.id)) continue
    const name = str(c.name, 40).trim()
    if (!name) continue
    catIds.add(c.id)
    found.push({
      cat: { id: c.id, name, limit: isPlainNumber(c.limit) && !c.limit.startsWith('-') ? c.limit : null, parentId: null, deletedAt: num(c.deletedAt), ...ifSet({ limitByMonth: limitMap(c.limitByMonth), months: monthList(c.months) }) },
      rawParent: c.parentId,
    })
    if (found.length >= MAX_CATEGORIES) break
  }
  // A parent must exist and be top-level itself. Otherwise the category becomes top-level. A child of a deleted parent is deleted too.
  const topIds = new Map(found.filter((f) => typeof f.rawParent !== 'string' || !catIds.has(f.rawParent)).map((f) => [f.cat.id, f.cat]))
  const cats = found.map(({ cat, rawParent }) => {
    const parent = typeof rawParent === 'string' && rawParent !== cat.id ? topIds.get(rawParent) : undefined
    if (!parent) return cat
    // A subcategory's own months must sit inside its parent's; otherwise it just follows the parent.
    const { months: own, ...rest } = cat
    const months = own && parent.months && !own.every((m) => parent.months!.includes(m)) ? undefined : own
    return { ...rest, ...(months ? { months } : {}), parentId: parent.id, deletedAt: parent.deletedAt !== null ? (cat.deletedAt ?? parent.deletedAt) : cat.deletedAt }
  })

  const instruments: PayInstrument[] = []
  const instById = new Map<string, PayInstrument>()
  for (const i of Array.isArray(raw.instruments) ? raw.instruments : []) {
    if (!isObject(i) || !goodId(i.id) || instById.has(i.id) || !isInstrumentKind(i.kind)) continue
    const name = str(i.name, 40).trim()
    if (!name) continue
    const card = i.kind === 'credit' || i.kind === 'debit'
    const inst: PayInstrument = {
      id: i.id,
      name,
      kind: i.kind,
      network: card && isNetwork(i.network) ? i.network : null,
      bank: str(i.bank, 40).trim(),
      last4: typeof i.last4 === 'string' && /^\d{4}$/.test(i.last4) ? i.last4 : '',
      rewardNote: str(i.rewardNote, 200),
      deletedAt: num(i.deletedAt),
      ...ifSet({
        variant: str(i.variant, 40).trim() || undefined,
        holder: str(i.holder, 40).trim() || undefined,
        statementDay: day28(i.statementDay),
        dueDay: day28(i.dueDay),
        creditLimit: i.kind === 'credit' && isPlainNumber(i.creditLimit) && !i.creditLimit.startsWith('-') ? i.creditLimit : undefined,
        annualFee: isPlainNumber(i.annualFee) && !i.annualFee.startsWith('-') ? i.annualFee : undefined,
        upiHandle: (i.kind === 'bank' || i.kind === 'wallet') && /^[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9]{1,}$/.test(str(i.upiHandle, 40).trim()) ? str(i.upiHandle, 40).trim() : undefined,
        accountType: i.kind === 'bank' && isAccountType(i.accountType) ? i.accountType : undefined,
      }),
    }
    instruments.push(inst)
    instById.set(inst.id, inst)
    if (instruments.length >= MAX_INSTRUMENTS * 5) break
  }

  const expenses: BudgetExpense[] = []
  const seen = new Set<string>()
  for (const e of Array.isArray(raw.expenses) ? raw.expenses : []) {
    if (!isObject(e) || !goodId(e.id) || seen.has(e.id)) continue
    if (typeof e.date !== 'string' || !DAY_KEY.test(e.date) || !isPlainNumber(e.amount) || e.amount.startsWith('-')) continue
    seen.add(e.id)
    const mode = isPaymentMode(e.mode) ? e.mode : null
    const inst = typeof e.instrumentId === 'string' ? instById.get(e.instrumentId) : undefined
    const settlement = isSettlement(e.settlement) ? e.settlement : undefined
    expenses.push({
      id: e.id,
      date: e.date,
      amount: e.amount,
      // A category that no longer exists is "Uncategorised"; the entry is kept.
      // A settlement is not spending, so it has no category.
      categoryId: !settlement && typeof e.categoryId === 'string' && catIds.has(e.categoryId) ? e.categoryId : null,
      mode,
      // A deleted or unknown instrument, or one the mode does not accept, is dropped; the entry is kept. A card bill keeps the card it paid off.
      instrumentId:
        settlement === 'cardBill' ? (inst && inst.deletedAt === null && inst.kind === 'credit' ? inst.id : null)
        : settlement ? null
        : inst && inst.deletedAt === null && mode !== null && instrumentFitsMode(mode, inst) ? inst.id : null,
      note: str(e.note, 200),
      deletedAt: num(e.deletedAt),
      ...(settlement ? { settlement } : {}),
      // A refund is spending turned round; a settlement is never one.
      ...(e.refund === true && !settlement ? { refund: true as const } : {}),
      ...(goodId(e.recurringId) ? { recurringId: e.recurringId } : {}),
    })
    if (expenses.length >= MAX_EXPENSES) break
  }
  const recurring = sanitizeRecurring(raw.recurring, catIds, instById)
  return { overall: isPlainNumber(raw.overall) && !raw.overall.startsWith('-') ? raw.overall : null, ...ifSet({ overallByMonth: limitMap(raw.overallByMonth) }), categories: cats, instruments, expenses, ...ifSet({ smsSeen: seenList(raw.smsSeen) }), ...(recurring.length > 0 ? { recurring } : {}) }
}

/** Bills and subscriptions. A bill needs a real amount; a card bill needs a card that exists and is a credit card. Anything else is dropped. */
function sanitizeRecurring(raw: unknown, catIds: Set<string>, instById: Map<string, PayInstrument>): RecurringItem[] {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const out: RecurringItem[] = []
  const seenIds = new Set<string>()
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!isObject(r) || !goodId(r.id) || seenIds.has(r.id) || !isBillRepeat(r.repeat)) continue
    const kind = r.kind === 'cardBill' ? 'cardBill' : r.kind === 'bill' ? 'bill' : null
    const title = str(r.title, 120).trim()
    if (!kind || !title) continue
    const inst = typeof r.instrumentId === 'string' ? instById.get(r.instrumentId) : undefined
    if (kind === 'bill' && !(isPlainNumber(r.amount) && !r.amount.startsWith('-') && Number(r.amount) > 0)) continue
    if (kind === 'cardBill' && !(inst && inst.kind === 'credit')) continue
    const mode = isPaymentMode(r.mode) ? r.mode : null
    seenIds.add(r.id)
    out.push({
      id: r.id,
      kind,
      title,
      amount: kind === 'bill' ? (r.amount as string) : null,
      repeat: r.repeat,
      categoryId: typeof r.categoryId === 'string' && catIds.has(r.categoryId) ? r.categoryId : null,
      mode: kind === 'bill' ? mode : null,
      // An instrument that is gone, or that the mode does not accept, is dropped; the bill is kept.
      instrumentId: kind === 'cardBill' ? inst!.id : inst && inst.deletedAt === null && mode !== null && instrumentFitsMode(mode, inst) ? inst.id : null,
      cardId: goodId(r.cardId) ? r.cardId : null,
      ...(r.paused === true ? { paused: true as const } : {}),
      ...(r.paused === true && typeof r.pausedDue === 'number' && Number.isFinite(r.pausedDue) ? { pausedDue: r.pausedDue } : {}),
      deletedAt: num(r.deletedAt),
    })
    if (out.length >= MAX_RECURRING) break
  }
  return out
}

type Migration = (data: Record<string, unknown>) => Record<string, unknown>
/**
 * One entry per schema bump: MIGRATIONS[n] upgrades version n to n+1.
 * Each gets a unit test against a fixture of the previous shape.
 */
const MIGRATIONS: Record<number, Migration> = {
  // v1 had no saved cards or reminders.
  1: (data) => ({ ...data, cards: [], reminders: [] }),
  // v2 had no memo on a history entry. It is optional and additive, so old data needs no change:
  // sanitizeHistory reads `memo` if present and leaves it out otherwise.
  2: (data) => data,
}

/** Turns whatever was in storage (or a backup file) into valid current-schema data. Never throws. */
export function migrate(raw: unknown): PersistedData {
  if (!isObject(raw)) return defaultPersisted()

  let data: Record<string, unknown> = raw
  let version = typeof data.schemaVersion === 'number' && Number.isInteger(data.schemaVersion) ? data.schemaVersion : CURRENT_SCHEMA

  while (version < CURRENT_SCHEMA) {
    const step = MIGRATIONS[version]
    if (!step) break
    data = step(data)
    version++
  }

  // A newer app wrote this: keep what we understand, and say it is current.
  const cards = sanitizeCards(data.cards)
  return {
    schemaVersion: CURRENT_SCHEMA,
    settings: sanitizeSettings(data.settings),
    history: sanitizeHistory(data.history),
    cards,
    reminders: sanitizeReminders(data.reminders, cards),
    memory: isPlainNumber(data.memory) ? data.memory : null,
    input: sanitizeInput(data.input),
    // Absent before the Budget tab existed: a fresh starter set, not an error.
    budget: sanitizeBudget(data.budget),
  }
}

export async function loadPersisted(storage: KeyValueStorage): Promise<PersistedData> {
  try {
    const text = await storage.get(STORAGE_KEY)
    if (text === null) return defaultPersisted()
    return migrate(JSON.parse(text))
  } catch {
    return defaultPersisted()
  }
}

export async function savePersisted(storage: KeyValueStorage, data: PersistedData): Promise<void> {
  try {
    await storage.set(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* Storage full or blocked: the app keeps working, it just won't remember. */
  }
}
