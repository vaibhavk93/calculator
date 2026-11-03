import type { AngleMode, InputState } from '../engine'
import type { DecimalSetting, NumberSystem } from '../lib/format'
import type { BudgetData } from '../lib/budget'
import type { Reminder, SavedCard } from '../lib/memory'
import type { AccentName, ThemePreference } from '../lib/theme'

export type Tab = 'calculate' | 'tools' | 'saved' | 'due' | 'budget'
export const TABS: readonly Tab[] = ['calculate', 'tools', 'saved', 'due', 'budget']

export interface Settings {
  theme: ThemePreference
  accent: AccentName
  numberSystem: NumberSystem
  decimals: DecimalSetting
  angle: AngleMode
  startupTab: Tab
  /** When set, the app opens straight into this calculator (a ToolSpec id) and startupTab is ignored. */
  startupTool: string | null
  haptics: boolean
  keepAwake: boolean
  /** "Keep the calculation record": whether "=" adds to history. */
  keepHistory: boolean
  /** Copying a number: ask each time, or always with / without thousands commas. */
  copyFormat: CopyFormat
  /** When reminder notifications arrive, "HH:MM" (24 hour). */
  reminderTime: string
  /** When a backup file was last saved from Settings, in ms. Null: never. */
  lastBackupAt: number | null
  /** When the launch reminder to back up was last shown, in ms. At most one per 14 days. */
  backupNudgedAt: number | null
  /** When the backup line at the top of Settings was last dismissed, in ms. */
  backupDismissedAt: number | null
}

export type CopyFormat = 'ask' | 'with' | 'without'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  accent: 'citron',
  numberSystem: 'indian',
  decimals: 'auto',
  angle: 'deg',
  startupTab: 'calculate',
  startupTool: null,
  haptics: true,
  keepAwake: false,
  keepHistory: true,
  copyFormat: 'ask',
  reminderTime: '09:00',
  lastBackupAt: null,
  backupNudgedAt: null,
  backupDismissedAt: null,
}

export interface HistoryEntry {
  id: string
  /** The closed expression that was evaluated, in the engine's raw form. */
  expression: string
  /** Plain decimal string. Formatted at render time, so a settings change applies retroactively. */
  result: string
  at: number
  /** A short name you gave this calculation. A named row is never removed by Clear all or the history cap. */
  memo?: string
  /** A locked row is never removed by Clear all or the history cap, and cannot be deleted until unlocked. */
  locked?: boolean
}

export const MAX_MEMO = 80
export const MAX_LOCKED = 100

/** Rows that Clear all and the history cap leave alone: named or locked. */
export const isKept = (h: HistoryEntry) => Boolean(h.memo || h.locked)

export const MAX_HISTORY = 200
export const MAX_UNDO = 100

export * from '../lib/memory'

/** Everything that survives a restart, and everything in a backup file. */
export type { AccountType, BudgetCategory, BudgetData, BudgetExpense, InstrumentDraft, InstrumentKind, NetworkId, PayInstrument, PaymentModeId, Settlement } from '../lib/budget'
export {
  ACCOUNT_TYPES,
  KNOWN_BANKS,
  UPI_DEFAULT_LABEL,
  isAccountType,
  isSettlement,
  INSTRUMENT_KINDS,
  MAX_CATEGORIES,
  MAX_EXPENSES,
  MAX_INSTRUMENTS,
  NETWORKS,
  PAYMENT_MODES,
  STARTER_CATEGORIES,
  instrumentFitsMode,
  isInstrumentKind,
  isNetwork,
  isPaymentMode,
  starterBudget,
} from '../lib/budget'

export interface PersistedData {
  schemaVersion: number
  settings: Settings
  history: HistoryEntry[]
  cards: SavedCard[]
  reminders: Reminder[]
  /** Plain decimal string, or null when memory is empty. */
  memory: string | null
  input: InputState
  budget: BudgetData
}
