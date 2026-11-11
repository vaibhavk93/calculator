/**
 * The contract between the app and the phone-side SMS capture (docs/SMS-INBOX-PLAN.md, Phase 2+).
 *
 * The phone side (Android, a manifest receiver) catches bank-style messages while the app is closed and holds them,
 * encrypted and app-private, until the app opens. The app drains the queue, parses each message with `parseSms`,
 * saves the result, and only THEN acks, so a crash between drain and save can never lose a message.
 *
 * Rules (also in docs/SMS-CAPTURE.md): only letter-style senders are queued, nothing is logged, nothing is backed up,
 * and a message is deleted from the queue the moment the app acks it.
 */

export interface QueuedMessage {
  /** Stable id from the phone side (also what `ack` takes). */
  id: string
  sender: string
  body: string
  /** Epoch ms the phone received it. */
  receivedAt: number
}

export type SmsPermission = 'granted' | 'denied' | 'prompt' | 'unavailable'

export interface SmsQueuePort {
  /** Whether SMS access is allowed. 'unavailable' on the web or a phone without SMS. */
  permission(): Promise<SmsPermission>
  /** Shows Android's own permission dialog (the app shows its own explainer BEFORE calling this). */
  request(): Promise<'granted' | 'denied'>
  /** Whether the phone side is catching messages right now (receiver enabled AND permission granted). */
  captureEnabled(): Promise<boolean>
  /** Turns catching on or off. Off also stops the receiver; it does not delete what is already queued. */
  setCaptureEnabled(on: boolean): Promise<void>
  /** Everything waiting, oldest first. Does NOT delete anything. */
  drain(): Promise<QueuedMessage[]>
  /** Deletes these from the queue. Call only after the parsed result is saved. Unknown ids are ignored. */
  ack(ids: string[]): Promise<void>
  /** Deletes everything waiting (the "Delete captured messages" button). */
  clear(): Promise<void>
  /** Opens this app's page in Android settings (for a denied or restricted permission). */
  openAppSettings(): Promise<void>
}

/** An in-memory queue: the web build, tests, and the screens' browser tests. `push` simulates a message arriving. */
export function memorySmsQueue(initial: QueuedMessage[] = [], permission: SmsPermission = 'granted'): SmsQueuePort & { push: (m: QueuedMessage) => void } {
  let items = [...initial]
  let perm = permission
  let on = permission === 'granted'
  return {
    push: (m) => { items = [...items, m] },
    permission: async () => perm,
    request: async () => { if (perm === 'unavailable') return 'denied'; perm = 'granted'; on = true; return 'granted' },
    captureEnabled: async () => on && perm === 'granted',
    setCaptureEnabled: async (v) => { on = v },
    drain: async () => [...items],
    ack: async (ids) => { items = items.filter((m) => !ids.includes(m.id)) },
    clear: async () => { items = [] },
    openAppSettings: async () => {},
  }
}
