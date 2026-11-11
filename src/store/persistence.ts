import { INITIAL_INPUT, type InputState } from '../engine'
import { ACCENT_NAMES, type AccentName, type ThemePreference } from '../lib/theme'
import type { KeyValueStorage } from '../lib/storage'
import { parseTime } from '../lib/reminders'
import { sanitizePortfolio } from '../lib/portfolio'
import { MAX_COUNT, MAX_INBOX, MAX_LEARNED, DRIFT_WINDOW, payeeKey, type AutoLogEntry, type InboxItem, type LearnedPayee } from '../lib/inbox'
import { MAX_COUNTED_TOOLS, MAX_PINNED_TOOLS, MAX_USE_COUNT } from '../lib/toolUse'
import { MAX_RECURRING, MAX_RULES, RULE_MAX, cleanRuleMatch, sanitizeEdits, isAccountType, isBillRepeat, isPaymentCount, isMonthKey, isSettlement, type MerchantRule, type RecurringItem } from '../lib/budget'
import {
  DEFAULT_SETTINGS,
  MAX_HISTORY,
  MAX_MEMO,
  isKept,
  TABS,
  TOUR_IDS,
  MAX_CARDS,
  MAX_DRAFTS,
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
const isToolId = (t: unknown): t is string => typeof t === 'string' && /^[a-z0-9-]{1,64}$/.test(t)

/** Tool id -> a whole count from 1 to the cap. Anything else is dropped; the table is trimmed to its size limit. */
function sanitizeToolUse(raw: unknown): Record<string, number> {
  if (!isObject(raw)) return {}
  const out: Record<string, number> = {}
  for (const [id, n] of Object.entries(raw)) {
    if (isToolId(id) && typeof n === 'number' && Number.isInteger(n) && n >= 1) out[id] = Math.min(n, MAX_USE_COUNT)
    if (Object.keys(out).length >= MAX_COUNTED_TOOLS) break
  }
  return out
}

/** Only the three known tours, each `done` or `skipped`. Anything else is dropped, so old backups load as "not seen". */
function sanitizeTours(raw: unknown): Settings['tours'] {
  const out: Settings['tours'] = {}
  if (!isObject(raw)) return out
  for (const id of TOUR_IDS) if (raw[id] === 'done' || raw[id] === 'skipped') out[id] = raw[id] as 'done' | 'skipped'
  return out
}

/** A missing key is ON, and so is any junk: an old backup (or a damaged file) loads as everything on. Only a real `false` hides. */
export function sanitizeModules(raw: unknown): Settings['modules'] {
  const r = isObject(raw) ? raw : {}
  return { budget: r.budget !== false, notes: r.notes !== false }
}

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
    showAdvanceTaxOffer: bool(r.showAdvanceTaxOffer, d.showAdvanceTaxOffer),
    lastBackupAt: stamp(r.lastBackupAt),
    backupNudgedAt: stamp(r.backupNudgedAt),
    backupDismissedAt: stamp(r.backupDismissedAt),
    dismissedTips: Array.isArray(r.dismissedTips) ? [...new Set(r.dismissedTips.filter((t): t is string => typeof t === 'string' && /^[a-z0-9-]{1,40}$/.test(t)))].slice(0, 20) : [],
    toolUse: sanitizeToolUse(r.toolUse),
    pinnedTools: Array.isArray(r.pinnedTools) ? [...new Set(r.pinnedTools.filter(isToolId))].slice(0, MAX_PINNED_TOOLS) : [],
    tours: sanitizeTours(r.tours),
    notesCardView: bool(r.notesCardView, d.notesCardView),
    dueCardView: bool(r.dueCardView, d.dueCardView),
    modules: sanitizeModules(r.modules),
    smsCapture: bool(r.smsCapture, d.smsCapture),
    smsMode: oneOf(r.smsMode, ['review', 'auto'] as const, d.smsMode),
    smsAutoPausedAt: stamp(r.smsAutoPausedAt),
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
    // "__proto__" as a key would swap the prototype of `out` for the value (QA-F2).
    if (k.length > 64 || k === '__proto__') continue
    if (typeof v === 'string') out[k] = v.slice(0, 200)
    else if (Array.isArray(v))
      out[k] = v.slice(0, 50).map((row) => (Array.isArray(row) ? row.slice(0, 8).map((c) => str(c, 200)) : []))
  }
  return out
}

/** Unsaved calculator inputs by tool id: ids shaped like real ones, values checked like a saved card's, at most MAX_DRAFTS. */
export function sanitizeDrafts(raw: unknown): Record<string, Values> | undefined {
  if (!isObject(raw)) return undefined
  const out: Record<string, Values> = {}
  for (const [id, v] of Object.entries(raw)) {
    if (!/^[a-z0-9-]{1,64}$/.test(id)) continue
    const values = sanitizeValues(v)
    if (values && Object.keys(values).length > 0) out[id] = values
    if (Object.keys(out).length >= MAX_DRAFTS) break
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function sanitizeLines(raw: unknown): TapeLine[] {
  if (!Array.isArray(raw)) return []
  const out: TapeLine[] = []
  for (const l of raw.slice(0, 1000)) {
    if (isObject(l) && goodId(l.id) && isPlainNumber(l.value)) out.push({ id: l.id, label: str(l.label, 80), value: l.value, ...(l.done === true ? { done: true } : l.skip === true ? { skip: true } : {}) })
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
    const kind = oneOf(c.kind, ['tool', 'tape', 'task', 'text'] as const, 'tool')
    const toolId = typeof c.toolId === 'string' ? c.toolId.slice(0, 64) : null
    if (kind === 'tool' && !toolId) continue
    // A task with no name has nothing to show: drop it, as a calculation with no calculator is dropped.
    if (kind === 'task' && (typeof c.title !== 'string' || !c.title.trim())) continue
    // A note with no title and no text is empty: drop it. (A note with only a body keeps it and gets a title below.)
    if (kind === 'text' && !(typeof c.title === 'string' && c.title.trim()) && !(typeof c.note === 'string' && c.note.trim())) continue
    seen.add(c.id)
    const wantsPin = c.pinned === true && c.deletedAt == null && pinned < MAX_PINNED
    if (wantsPin) pinned++
    out.push({
      id: c.id,
      title: kind === 'text' ? str(c.title, 120).trim() || 'Untitled note' : str(c.title, 120, 'Untitled'),
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
    // Only live cards count toward the limit (the ones in Trash do not), with a hard stop so a damaged file cannot grow without end (B-02).
    if (out.filter((x) => x.deletedAt === null).length >= MAX_CARDS || out.length >= MAX_CARDS * 2) break
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
    // Several lead times: a short list of whole days, biggest first. An old reminder has just `leadDays`.
    const list = Array.isArray(r.leads) ? [...new Set(r.leads.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 60))].sort((a, b) => b - a).slice(0, 6) : []
    const after = typeof r.afterDays === 'number' && Number.isInteger(r.afterDays) && r.afterDays >= 1 && r.afterDays <= 365 ? r.afterDays : undefined
    out.push({
      id: r.id,
      cardId: r.cardId,
      dueAt: r.dueAt,
      repeat: oneOf<Repeat>(r.repeat, REPEATS, 'none'),
      anchorDay: day,
      leadDays: list.length > 1 ? list[0]! : lead,
      ...(list.length > 1 ? { leads: list } : {}),
      ...(after ? { afterDays: after } : {}),
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
    // A deleted category stays in the list for good, so only live ones count toward the limit (B-02); the hard stop is for damaged files.
    if (found.filter((f) => f.cat.deletedAt === null).length >= MAX_CATEGORIES || found.length >= MAX_CATEGORIES * 8) break
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
    if (instruments.filter((x) => x.deletedAt === null).length >= MAX_INSTRUMENTS || instruments.length >= MAX_INSTRUMENTS * 12) break
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
    const income = e.income === true && !settlement && e.refund !== true
    expenses.push({
      id: e.id,
      date: e.date,
      amount: e.amount,
      // A category that no longer exists is "Uncategorised"; the entry is kept.
      // A settlement is not spending, so it has no category.
      categoryId: !settlement && !income && typeof e.categoryId === 'string' && catIds.has(e.categoryId) ? e.categoryId : null,
      mode: income ? null : mode,
      // A deleted or unknown instrument, or one the mode does not accept, is dropped; the entry is kept. A card bill keeps the card it paid off.
      instrumentId:
        settlement === 'cardBill' ? (inst && inst.deletedAt === null && inst.kind === 'credit' ? inst.id : null)
        : settlement || income ? null
        : inst && inst.deletedAt === null && mode !== null && instrumentFitsMode(mode, inst) ? inst.id : null,
      note: str(e.note, 200),
      deletedAt: num(e.deletedAt),
      ...(settlement ? { settlement } : {}),
      // A refund is spending turned round; a settlement is never one.
      ...(e.refund === true && !settlement ? { refund: true as const } : {}),
      // Money in is only kept when it is the ONLY kind the entry claims (settlement, then refund, win), so a damaged file cannot invent income.
      ...(income ? { income: true as const } : {}),
      ...(!income && goodId(e.recurringId) ? { recurringId: e.recurringId } : {}),
      // Added by the app from a bank message. Only a plain spend can carry it.
      ...(e.auto === true && !income && !settlement && e.refund !== true ? { auto: true as const } : {}),
      ...ifSet({ edits: sanitizeEdits(e.edits) }),
    })
    if (expenses.length >= MAX_EXPENSES) break
  }
  const recurring = sanitizeRecurring(raw.recurring, catIds, instById)
  const rules = sanitizeRules(raw.rules, catIds)
  const inbox = sanitizeInbox(raw.inbox, catIds, instById, seen)
  const learned = sanitizeLearned(raw.learned, catIds)
  const autoLog = sanitizeAutoLog(raw.autoLog)
  return { overall: isPlainNumber(raw.overall) && !raw.overall.startsWith('-') ? raw.overall : null, ...ifSet({ overallByMonth: limitMap(raw.overallByMonth) }), categories: cats, instruments, expenses, ...ifSet({ smsSeen: seenList(raw.smsSeen) }), ...(recurring.length > 0 ? { recurring } : {}), ...(rules.length > 0 ? { rules } : {}), ...(inbox.length > 0 ? { inbox } : {}), ...(learned.length > 0 ? { learned } : {}), ...(autoLog.length > 0 ? { autoLog } : {}) }
}

const FINGERPRINT = /^[0-9a-z]{4,30}$/

/**
 * The SMS Inbox, newest first as stored. Junk, repeats and anything past the cap are dropped. Only parsed fields are ever read: if a damaged
 * or hand-edited file carries anything else (a message body, say) it is ignored, never kept. An auto-added item must point at a real entry;
 * a pending item points at none.
 */
function sanitizeInbox(raw: unknown, catIds: Set<string>, instById: Map<string, PayInstrument>, entryIds: Set<string>): InboxItem[] {
  const out: InboxItem[] = []
  const ids = new Set<string>()
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!isObject(r) || typeof r.id !== 'string' || !FINGERPRINT.test(r.id) || ids.has(r.id)) continue
    if (typeof r.date !== 'string' || !DAY_KEY.test(r.date) || !isPlainNumber(r.amount) || r.amount.startsWith('-') || !(Number(r.amount) > 0)) continue
    const status = oneOf(r.status, ['pending', 'approved', 'rejected'] as const, 'pending')
    const kind = r.kind === 'cardBill' ? 'cardBill' : 'spend'
    const inst = typeof r.instrumentId === 'string' ? instById.get(r.instrumentId) : undefined
    const entryId = status === 'approved' && goodId(r.entryId) && entryIds.has(r.entryId) ? r.entryId : undefined
    ids.add(r.id)
    out.push({
      id: r.id,
      date: r.date,
      amount: r.amount,
      merchant: str(r.merchant, 60).trim(),
      kind,
      mode: isPaymentMode(r.mode) ? r.mode : null,
      instrumentId: inst ? inst.id : null,
      last4: typeof r.last4 === 'string' && /^\d{3,4}$/.test(r.last4) ? r.last4 : null,
      bank: typeof r.bank === 'string' && r.bank.trim() !== '' ? r.bank.trim().slice(0, 40) : null,
      categoryId: typeof r.categoryId === 'string' && catIds.has(r.categoryId) ? r.categoryId : null,
      why: str(r.why, 120).trim(),
      person: r.person === true,
      status,
      at: stamp(r.at) ?? 0,
      ...(entryId ? { entryId } : {}),
      ...(entryId && r.auto === true ? { auto: true as const } : {}),
      ...(status === 'rejected' && r.notSpend === true ? { notSpend: true as const } : {}),
      ...(status !== 'pending' && stamp(r.resolvedAt) !== null ? { resolvedAt: stamp(r.resolvedAt)! } : {}),
    })
    if (out.length >= MAX_INBOX) break
  }
  return out
}

/** Learned payees, newest first. The category must have existed; the count is a whole number from 1 to the cap. */
function sanitizeLearned(raw: unknown, catIds: Set<string>): LearnedPayee[] {
  const out: LearnedPayee[] = []
  const keys = new Set<string>()
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!isObject(r) || typeof r.key !== 'string' || payeeKey(r.key) !== r.key || keys.has(r.key)) continue
    if (typeof r.categoryId !== 'string' || !catIds.has(r.categoryId) || typeof r.count !== 'number' || !Number.isInteger(r.count) || r.count < 1) continue
    keys.add(r.key)
    out.push({ key: r.key, categoryId: r.categoryId, count: Math.min(r.count, MAX_COUNT), lastAt: stamp(r.lastAt) ?? 0 })
    if (out.length >= MAX_LEARNED) break
  }
  return out
}

function sanitizeAutoLog(raw: unknown): AutoLogEntry[] {
  const out: AutoLogEntry[] = []
  for (const r of Array.isArray(raw) ? raw : []) {
    if (isObject(r) && typeof r.id === 'string' && FINGERPRINT.test(r.id) && !out.some((x) => x.id === r.id)) out.push({ id: r.id, bad: r.bad === true })
    if (out.length >= DRIFT_WINDOW) break
  }
  return out
}

/**
 * Merchant rules, newest first as stored. Junk, repeats (by id or by the same text, the newer wins) and anything past the cap are dropped.
 * A rule is kept when its category ever existed, even if that category is now deleted: Undo and backups must bring it back. A category
 * id that never existed cannot come back, so that rule is dropped.
 */
function sanitizeRules(raw: unknown, catIds: Set<string>): MerchantRule[] {
  const out: MerchantRule[] = []
  const ids = new Set<string>()
  const texts = new Set<string>()
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!isObject(r) || !goodId(r.id) || ids.has(r.id) || !goodId(r.categoryId) || !catIds.has(r.categoryId) || typeof r.match !== 'string') continue
    const m = cleanRuleMatch(r.match.replace(/\s+/g, ' ').trim().slice(0, RULE_MAX).trim())
    if (!m.ok || texts.has(m.value.toLowerCase())) continue
    ids.add(r.id)
    texts.add(m.value.toLowerCase())
    out.push({ id: r.id, match: m.value, categoryId: r.categoryId })
    if (out.length >= MAX_RULES) break
  }
  return out
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
      ...(kind === 'bill' && isPaymentCount(r.remaining) ? { remaining: r.remaining } : {}),
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
  const drafts = sanitizeDrafts(data.drafts)
  // Absent before Portfolio existed: nothing, not an error. Left out of the data entirely when empty, so the file does not change for anyone who does not use it.
  const portfolio = sanitizePortfolio(data.portfolio)
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
    ...(portfolio.length > 0 ? { portfolio } : {}),
    ...(drafts ? { drafts } : {}),
  }
}

/** Where the raw text of a saved file that could not be read is kept, so a damaged load never destroys it (B-01). */
export const BAD_KEY = 'vkcalc.data.bad'

export type Loaded = { data: PersistedData; failed: 'none' | 'damaged' | 'unreadable' }

/**
 * Like `loadPersisted`, but says whether the load went wrong. `damaged`: the text was there but is not valid; a copy is
 * kept under BAD_KEY before anything can overwrite it. `unreadable`: storage itself threw, so the real data may be
 * untouched on disk and the caller must not write over it.
 */
export async function loadChecked(storage: KeyValueStorage): Promise<Loaded> {
  let text: string | null
  try {
    text = await storage.get(STORAGE_KEY)
  } catch {
    return { data: defaultPersisted(), failed: 'unreadable' }
  }
  if (text === null) return { data: defaultPersisted(), failed: 'none' }
  try {
    const json: unknown = JSON.parse(text)
    // Valid JSON that is not an object (null, [], 42, "x") is not our file: treat it like a damaged one so a copy is kept (QA-F4).
    if (!isObject(json)) throw new Error('not an object')
    return { data: migrate(json), failed: 'none' }
  } catch {
    try {
      await storage.set(BAD_KEY, text)
    } catch {
      /* nothing more can be done */
    }
    return { data: defaultPersisted(), failed: 'damaged' }
  }
}

export async function loadPersisted(storage: KeyValueStorage): Promise<PersistedData> {
  return (await loadChecked(storage)).data
}

/** Writes the data. Resolves true only when storage accepted it (the SMS drain waits for that before it lets the phone forget a message). */
export async function savePersisted(storage: KeyValueStorage, data: PersistedData): Promise<boolean> {
  try {
    await storage.set(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    /* Storage full or blocked: the app keeps working, it just won't remember. */
    return false
  }
}
