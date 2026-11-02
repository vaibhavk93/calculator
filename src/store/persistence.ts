import { INITIAL_INPUT, type InputState } from '../engine'
import { ACCENT_NAMES, type AccentName, type ThemePreference } from '../lib/theme'
import type { KeyValueStorage } from '../lib/storage'
import {
  DEFAULT_SETTINGS,
  MAX_HISTORY,
  MAX_MEMO,
  TABS,
  MAX_CARDS,
  MAX_PINNED,
  REPEATS,
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
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

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
  }
}

const PLAIN_NUMBER = /^-?\d{1,110}(\.\d{1,110})?$/
const RAW_EXPRESSION = /^[0-9a-z.+\-*/^()%!π√−×÷ ]*$/i

export const isPlainNumber = (v: unknown): v is string => typeof v === 'string' && PLAIN_NUMBER.test(v)

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
    out.push({ id, expression, result, at: typeof at === 'number' && Number.isFinite(at) ? at : 0, ...(memo ? { memo } : {}) })
    if (out.length >= MAX_HISTORY) break
  }
  return out
}

export function sanitizeInput(raw: unknown): InputState {
  if (!isObject(raw)) return { ...INITIAL_INPUT }
  const expr = typeof raw.expr === 'string' && raw.expr.length <= 500 && RAW_EXPRESSION.test(raw.expr) ? raw.expr : ''
  return { expr, fresh: expr !== '' && raw.fresh === true }
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
    const kind = oneOf(c.kind, ['tool', 'tape'] as const, 'tool')
    const toolId = typeof c.toolId === 'string' ? c.toolId.slice(0, 64) : null
    if (kind === 'tool' && !toolId) continue
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
      lines: kind === 'tape' ? sanitizeLines(c.lines) : [],
      ...(kind === 'tape' && c.checklist === true ? { checklist: true } : {}),
      note: str(c.note, 5000),
      tags: Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === 'string').map((t) => t.slice(0, 30)).slice(0, 10) : [],
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
