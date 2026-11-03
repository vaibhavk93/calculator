import { Capacitor, registerPlugin } from '@capacitor/core'
import { createStorage } from './storage'
import { mergeLog, type InboxMessage, type ParseLogEntry } from './smsParse'

/**
 * The local SmsInbox plugin (android/.../SmsInboxPlugin.java). Reads bank-style messages only when the user taps
 * "Scan messages". Nothing is read in the background and nothing leaves the phone.
 */
interface SmsInboxPlugin {
  checkPermission(): Promise<{ granted: boolean }>
  requestPermission(): Promise<{ granted: boolean }>
  readRecent(o: { days: number }): Promise<{ messages: InboxMessage[] }>
}
const plugin = registerPlugin<SmsInboxPlugin>('SmsInbox')

export const smsSupported = () => Capacitor.isNativePlatform()

export type ScanOutcome = { ok: true; messages: InboxMessage[] } | { ok: false; reason: 'unsupported' | 'denied' | 'failed' }

/** Asks for permission only when needed, then reads the last `days` days of bank-style messages. */
export async function readBankMessages(days: number): Promise<ScanOutcome> {
  if (!smsSupported()) return { ok: false, reason: 'unsupported' }
  try {
    const have = (await plugin.checkPermission()).granted || (await plugin.requestPermission()).granted
    if (!have) return { ok: false, reason: 'denied' }
    return { ok: true, messages: (await plugin.readRecent({ days })).messages }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

// The parser log lives under its own key: it is NOT part of backups or the main data, and holds redacted text only.
export const PARSE_LOG_KEY = 'vkcalc.smslog2'
/** The first version of the log only blanked digits. It is deleted on first use of the new one. */
const OLD_LOG_KEY = 'vkcalc.smslog'
const storage = createStorage()

export async function loadParseLog(): Promise<ParseLogEntry[]> {
  try {
    await storage.remove(OLD_LOG_KEY)
    const raw = await storage.get(PARSE_LOG_KEY)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter((e) => e && typeof e.template === 'string' && typeof e.sender === 'string' && typeof e.outcome === 'string') : []
  } catch {
    return []
  }
}

export async function addToParseLog(add: ParseLogEntry[]): Promise<ParseLogEntry[]> {
  if (add.length === 0) return loadParseLog()
  const next = mergeLog(await loadParseLog(), add)
  try { await storage.set(PARSE_LOG_KEY, JSON.stringify(next)) } catch { /* the log is a convenience */ }
  return next
}

export async function clearParseLog(): Promise<void> {
  try { await storage.remove(PARSE_LOG_KEY) } catch { /* nothing to clear */ }
}

/** A random secret for this phone, used to mask the reader log. Created once, kept under its own key, never exported. */
export async function logSalt(): Promise<string> {
  try {
    const have = await storage.get('vkcalc.smslog.salt')
    if (have) return have
    const bytes = new Uint8Array(16)
    globalThis.crypto.getRandomValues(bytes)
    const salt = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    await storage.set('vkcalc.smslog.salt', salt)
    return salt
  } catch {
    return 'fallback-salt'
  }
}
