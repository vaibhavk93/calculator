import type { SmsPermission } from './smsQueue'

export const MODE_NAME = { review: 'Review first', auto: 'Auto-add the confident ones' } as const

/**
 * One plain sentence on where bank-message capture stands, for the empty To review screen.
 * `perm` is null until the phone has answered. `hasPort` is false in a browser (capture is a phone feature).
 */
export function captureStatus(o: { hasPort: boolean; capture: boolean; mode: 'review' | 'auto'; perm: SmsPermission | null }): string {
  if (!o.hasPort) return 'Capture works in the Android app only.'
  if (!o.capture) return 'Capture is off. Calc reads no messages.'
  if (o.perm !== null && o.perm !== 'granted') return 'Capture is on, but Android is not allowing it. In Settings, turn Capture off and on again to fix this.'
  return `Capture is on. When a payment arrives: ${MODE_NAME[o.mode]}.`
}
