import { drainQueue, type DrainResult } from '../lib/inbox'
import type { SmsQueuePort } from '../lib/smsQueue'
import { defaultDeps, type AppStore } from './app'

/**
 * Where the app meets the phone-side SMS queue. Set once at startup (main.tsx); screens reach the queue only through here, so a test can
 * hand in `memorySmsQueue` and the web build gets none ("Capture bank messages" then says it works in the Android app only).
 */
interface Runtime {
  store: AppStore
  port: SmsQueuePort | null
  /** Resolves true only when the data is really on disk (boot.ts `persist`). The queue is acked only after this. */
  persist: () => Promise<boolean>
}

let rt: Runtime | null = null

export function initSmsRuntime(r: Runtime): void {
  rt = r
}

export const smsPort = (): SmsQueuePort | null => rt?.port ?? null

const NOTHING: DrainResult = { status: 'empty', pending: 0, auto: 0, held: 0 }
let inflight: Promise<DrainResult> | null = null

/**
 * Reads what the phone caught, saves it to the Inbox, waits until it is on disk, and only then lets the phone forget it (lib/inbox.ts drainQueue).
 * Does nothing unless "Capture bank messages" is on. One drain runs at a time; a second call joins the first.
 */
export function drainNow(): Promise<DrainResult> {
  if (!rt?.port || !rt.store.getState().settings.smsCapture) return Promise.resolve(NOTHING)
  if (inflight) return inflight
  const { store, port, persist } = rt
  inflight = drainQueue(port, {
    budget: () => store.getState().budget,
    auto: () => store.getState().settings.smsMode === 'auto',
    ignored: () => store.getState().settings.smsIgnored,
    commit: (plan) => store.getState().commitDrain(plan),
    persist,
    now: () => Date.now(),
    newId: defaultDeps.newId,
  }).finally(() => { inflight = null })
  return inflight
}
