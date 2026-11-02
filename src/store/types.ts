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
}

export const MAX_MEMO = 80

export const MAX_HISTORY = 200
export const MAX_UNDO = 100

export * from '../lib/memory'

/** Everything that survives a restart, and everything in a backup file. */
export type { BudgetCategory, BudgetData, BudgetExpense } from '../lib/budget'
export { MAX_CATEGORIES, MAX_EXPENSES, STARTER_CATEGORIES, starterBudget } from '../lib/budget'

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
