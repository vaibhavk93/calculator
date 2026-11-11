/**
 * "Open Settings and land on one section." Budget and To review set this, then open Settings; Settings reads it once on
 * arrival, scrolls that section into view and focuses its heading. A plain variable on purpose: it is a one-shot hand-over
 * between two screens, never saved and never shown.
 */
export type SettingsSection = 'bank'

let pending: SettingsSection | null = null

export const jumpToSettingsSection = (s: SettingsSection): void => { pending = s }

/** The section to land on, once. A second call returns null. */
export function takeSettingsSection(): SettingsSection | null {
  const s = pending
  pending = null
  return s
}
