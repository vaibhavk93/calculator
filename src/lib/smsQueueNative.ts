import type { SmsQueuePort } from './smsQueue'

/**
 * The Android-backed queue. Returns null on the web (no native plugin), so callers fall back to nothing.
 * TO BE IMPLEMENTED by the native-capture work: register the Capacitor plugin and map it onto SmsQueuePort.
 */
export function nativeSmsQueue(): SmsQueuePort | null {
  return null
}
