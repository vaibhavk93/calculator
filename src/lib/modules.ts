/**
 * "Show in the app": two switches that hide whole parts of the app. Hide, never delete: nothing is removed from
 * storage or from a backup, and turning a switch back on brings everything back. Tools and Calculate are always on.
 *
 * `notes` covers Notes AND Due together: a reminder points at a note and the two screens link to each other.
 * Reminders keep ringing while Due is hidden (the scheduler in App.tsx does not depend on the tab).
 *
 * Every screen asks through these helpers. Nothing outside the store and this file reads `settings.modules`
 * (checked by src/architecture.test.ts).
 */
export type ModuleKey = 'budget' | 'notes'
export interface Modules {
  budget: boolean
  notes: boolean
}

/** Which switch each tab belongs to. A tab not listed here (Calculate, Tools) is always on. */
const MODULE_OF: Record<string, ModuleKey | undefined> = { budget: 'budget', saved: 'notes', due: 'notes' }

type HasModules = { modules: Modules }

export const moduleOn = (s: HasModules, key: ModuleKey): boolean => s.modules[key]

/** Is this tab shown? Calculate and Tools always are. */
export const tabOn = (s: HasModules, tab: string): boolean => {
  const key = MODULE_OF[tab]
  return key === undefined || s.modules[key]
}

/** The settings patch that turns one switch on or off, leaving the other as it is. */
export const withModule = (s: HasModules, key: ModuleKey, on: boolean): HasModules => ({ modules: { ...s.modules, [key]: on } })

/** The tab to open on. A stored choice that points at a hidden tab is NOT rewritten (switching the module back on restores it); it just reads as Calculate. */
export const startTab = <T extends string>(s: HasModules & { startupTab: T }): T | 'calculate' => (tabOn(s, s.startupTab) ? s.startupTab : 'calculate')
