import { INITIAL_INPUT, type InputState } from '../engine'
import { ACCENT_NAMES, type AccentName, type ThemePreference } from '../lib/theme'
import type { KeyValueStorage } from '../lib/storage'
import {
  DEFAULT_SETTINGS,
  MAX_HISTORY,
  TABS,
  type HistoryEntry,
  type PersistedData,
  type Settings,
  type Tab,
} from './types'

export const STORAGE_KEY = 'vkcalc.data'
/** Bump when the stored shape changes, and add a step to MIGRATIONS. */
export const CURRENT_SCHEMA = 1

export function defaultPersisted(): PersistedData {
  return {
    schemaVersion: CURRENT_SCHEMA,
    settings: { ...DEFAULT_SETTINGS },
    history: [],
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
    out.push({ id, expression, result, at: typeof at === 'number' && Number.isFinite(at) ? at : 0 })
    if (out.length >= MAX_HISTORY) break
  }
  return out
}

export function sanitizeInput(raw: unknown): InputState {
  if (!isObject(raw)) return { ...INITIAL_INPUT }
  const expr = typeof raw.expr === 'string' && raw.expr.length <= 500 && RAW_EXPRESSION.test(raw.expr) ? raw.expr : ''
  return { expr, fresh: expr !== '' && raw.fresh === true }
}

type Migration = (data: Record<string, unknown>) => Record<string, unknown>
/**
 * One entry per schema bump: MIGRATIONS[n] upgrades version n to n+1.
 * Each gets a unit test against a fixture of the previous shape.
 */
const MIGRATIONS: Record<number, Migration> = {}

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
  return {
    schemaVersion: CURRENT_SCHEMA,
    settings: sanitizeSettings(data.settings),
    history: sanitizeHistory(data.history),
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
