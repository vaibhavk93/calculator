import type { AngleMode, InputState } from '../engine'
import type { DecimalSetting, NumberSystem } from '../lib/format'
import type { Reminder, SavedCard } from '../lib/memory'
import type { AccentName, ThemePreference } from '../lib/theme'

export type Tab = 'calculate' | 'tools' | 'saved' | 'due'
export const TABS: readonly Tab[] = ['calculate', 'tools', 'saved', 'due']

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
}

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
}

export interface HistoryEntry {
  id: string
  /** The closed expression that was evaluated, in the engine's raw form. */
  expression: string
  /** Plain decimal string. Formatted at render time, so a settings change applies retroactively. */
  result: string
  at: number
}

export const MAX_HISTORY = 200
export const MAX_UNDO = 100

export * from '../lib/memory'

/** Everything that survives a restart, and everything in a backup file. */
export interface PersistedData {
  schemaVersion: number
  settings: Settings
  history: HistoryEntry[]
  cards: SavedCard[]
  reminders: Reminder[]
  /** Plain decimal string, or null when memory is empty. */
  memory: string | null
  input: InputState
}
