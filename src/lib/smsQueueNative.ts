import { Capacitor, registerPlugin } from '@capacitor/core'
import type { QueuedMessage, SmsPermission, SmsQueuePort } from './smsQueue'

/**
 * The Android-backed queue: maps the local SmsQueue plugin (android/.../SmsQueuePlugin.java) onto SmsQueuePort.
 * Returns null on the web, so callers fall back to nothing (or to memorySmsQueue in tests).
 *
 * Failure rules, chosen so a failure can never lose a message:
 *  - permission() / request() / captureEnabled() never throw: an unusable plugin reads as 'unavailable' / 'denied' / false.
 *  - drain(), ack(), clear(), setCaptureEnabled() DO throw. A caller that gets an error from drain has not saved
 *    anything, and one whose ack failed must try again, so neither may be silently swallowed.
 */
export interface SmsQueuePlugin {
  permission(): Promise<{ state: SmsPermission }>
  request(): Promise<{ granted: boolean }>
  captureEnabled(): Promise<{ enabled: boolean }>
  setCaptureEnabled(o: { on: boolean }): Promise<void>
  drain(): Promise<{ messages: unknown[] }>
  ack(o: { ids: string[] }): Promise<void>
  clear(): Promise<void>
  openAppSettings(): Promise<void>
}

const STATES: SmsPermission[] = ['granted', 'denied', 'prompt', 'unavailable']

function isMessage(m: unknown): m is QueuedMessage {
  const x = m as Partial<QueuedMessage> | null
  return !!x && typeof x.id === 'string' && typeof x.sender === 'string' && typeof x.body === 'string' && typeof x.receivedAt === 'number'
}

/** Exposed for tests: the mapping, given any plugin object. */
export function queueFromPlugin(p: SmsQueuePlugin): SmsQueuePort {
  return {
    permission: async () => {
      try {
        const s = (await p.permission()).state
        return STATES.includes(s) ? s : 'unavailable'
      } catch { return 'unavailable' }
    },
    request: async () => {
      try { return (await p.request()).granted === true ? 'granted' : 'denied' } catch { return 'denied' }
    },
    captureEnabled: async () => {
      try { return (await p.captureEnabled()).enabled === true } catch { return false }
    },
    setCaptureEnabled: async (on) => { await p.setCaptureEnabled({ on }) },
    drain: async () => {
      const r = await p.drain()
      return (Array.isArray(r?.messages) ? r.messages : []).filter(isMessage).sort((a, b) => a.receivedAt - b.receivedAt)
    },
    ack: async (ids) => { if (ids.length > 0) await p.ack({ ids }) },
    clear: async () => { await p.clear() },
    openAppSettings: async () => { await p.openAppSettings() },
  }
}

export function nativeSmsQueue(): SmsQueuePort | null {
  if (!Capacitor.isNativePlatform()) return null
  return queueFromPlugin(registerPlugin<SmsQueuePlugin>('SmsQueue'))
}

/**
 * TEST ONLY. Feeds a fake incoming text through the phone's real receiver code (same sender filter, same on/off
 * switch, same permission check, same queue). The native side exists only in the debug and qa builds: in a release
 * build this resolves null. Returns how many were queued (0 = filtered, a duplicate, or capture off).
 */
export async function debugInjectSms(sender: string, body: string, receivedAt?: number): Promise<number | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const r = await registerPlugin<{ inject(o: { sender: string; body: string; receivedAt?: number }): Promise<{ queued: number }> }>('SmsDebug')
      .inject({ sender, body, receivedAt })
    return typeof r?.queued === 'number' ? r.queued : null
  } catch { return null }
}
