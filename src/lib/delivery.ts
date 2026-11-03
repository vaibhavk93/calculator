import { createStorage } from './storage'
import type { Reminder, SavedCard } from './memory'

/**
 * Delivery check for reminders (PRD H6). A fire log remembers when each notification was planned to arrive. When the
 * app is opened again, a reminder that was due more than 10 minutes ago, is still open, and came while the app was
 * not in front of the user may have been dropped by the phone (battery savers do this). We say "may", never "did":
 * the phone cannot tell us a notification was shown and swiped away. Kept in its own storage key, outside backups,
 * so the main data and its schema are untouched.
 */

/** An inexact alarm can be minutes late, so wait this long past the planned time before suspecting anything. */
export const GRACE_MS = 10 * 60_000
const KEEP_MS = 7 * 86_400_000
const MAX_ENTRIES = 300
export const FIRE_LOG_KEY = 'vkcalc.firelog'

export interface PlannedFire {
  /** The reminder. */
  rid: string
  /** The reminder's due time when this was planned. A later edit or snooze changes it, which cancels the check. */
  due: number
  /** When the notification was planned to arrive. */
  at: number
  /** The notification's number, to look it up among those still showing. */
  nid: number
}

export interface FireLog {
  /** The last time the app was in front of the user (0 = never recorded). */
  seenAt: number
  planned: PlannedFire[]
}

export const EMPTY_LOG: FireLog = { seenAt: 0, planned: [] }

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Whatever was stored, as a valid log. Never throws. */
export function sanitizeLog(raw: unknown): FireLog {
  if (typeof raw !== 'object' || raw === null) return EMPTY_LOG
  const o = raw as Record<string, unknown>
  const planned: PlannedFire[] = []
  if (Array.isArray(o.planned)) {
    for (const e of o.planned.slice(0, MAX_ENTRIES)) {
      if (typeof e === 'object' && e !== null) {
        const p = e as Record<string, unknown>
        if (typeof p.rid === 'string' && num(p.due) && num(p.at) && num(p.nid)) planned.push({ rid: p.rid, due: p.due, at: p.at, nid: p.nid })
      }
    }
  }
  return { seenAt: num(o.seenAt) ? o.seenAt : 0, planned }
}

/**
 * The log after planning again. The new plan replaces the old future entries. Old entries whose time has already
 * come stay (for a week), because they have not been checked yet, unless the reminder moved on.
 */
export function mergePlan(old: FireLog, plan: { id: number; at: number; reminderId: string }[], reminders: Reminder[], now: number): FireLog {
  const dueOf = new Map(reminders.map((r) => [r.id, r.dueAt]))
  const fresh: PlannedFire[] = []
  for (const p of plan) {
    const due = dueOf.get(p.reminderId)
    if (due !== undefined) fresh.push({ rid: p.reminderId, due, at: p.at, nid: p.id })
  }
  const kept = old.planned.filter((e) => e.at <= now && now - e.at < KEEP_MS && dueOf.get(e.rid) === e.due && !fresh.some((f) => f.rid === e.rid && f.at === e.at))
  return { seenAt: old.seenAt, planned: [...kept, ...fresh].slice(-MAX_ENTRIES) }
}

export interface MissedNotice {
  /** The first reminder that may not have shown. */
  title: string
  /** How many more besides it. */
  more: number
}

export interface Verdict {
  missed: MissedNotice | null
  /** The log to keep: checked entries are gone, and the app counts as seen now. */
  log: FireLog
}

/**
 * Which planned notifications were due over 10 minutes ago while the app was away, are still open, and did not
 * show in the tray or get tapped. Every entry that old is dropped from the log: it is looked at once.
 */
export function checkLog(log: FireLog, reminders: Reminder[], cards: SavedCard[], now: number, delivered: ReadonlySet<number>, acked: ReadonlySet<string>): Verdict {
  const byId = new Map(reminders.map((r) => [r.id, r]))
  const titles: string[] = []
  const seen = new Set<string>()
  for (const e of log.planned) {
    if (e.at > now - GRACE_MS || e.at <= log.seenAt || seen.has(e.rid)) continue
    const r = byId.get(e.rid)
    const card = r && cards.find((c) => c.id === r.cardId && c.deletedAt === null)
    if (!r || !card || r.done || r.dueAt !== e.due || acked.has(e.rid) || delivered.has(e.nid)) continue
    seen.add(e.rid)
    titles.push(card.title)
  }
  return {
    missed: titles.length > 0 ? { title: titles[0]!, more: titles.length - 1 } : null,
    log: { seenAt: now, planned: log.planned.filter((e) => e.at > now - GRACE_MS) },
  }
}

/** "A reminder may not have shown: Rent" / "Reminders may not have shown: Rent and 2 more". */
export const missedText = (m: MissedNotice) =>
  m.more === 0 ? `A reminder may not have shown: ${m.title}.` : `Reminders may not have shown: ${m.title} and ${m.more} more.`

// ------------------------------------------------------------------ storage and the notice

const storage = createStorage()
/** Reads and writes of the log never overlap: planning and the check can both fire at once. */
let chain: Promise<unknown> = Promise.resolve()
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = chain.then(fn, fn)
  chain = next.catch(() => undefined)
  return next
}

async function load(): Promise<FireLog> {
  try {
    const raw = await storage.get(FIRE_LOG_KEY)
    return raw ? sanitizeLog(JSON.parse(raw)) : EMPTY_LOG
  } catch {
    return EMPTY_LOG
  }
}
const save = async (log: FireLog) => {
  try {
    await storage.set(FIRE_LOG_KEY, JSON.stringify(log))
  } catch {
    /* A reminder check is a nicety: losing it costs nothing. */
  }
}

/** Remember the notifications that were just scheduled. Call only after they really were. */
export const recordPlan = (plan: { id: number; at: number; reminderId: string }[], reminders: Reminder[], now = Date.now()) =>
  serial(async () => save(mergePlan(await load(), plan, reminders, now)))

/** The app is going out of view (or was just opened): note the time. */
export const markSeen = (now = Date.now()) => serial(async () => save({ ...(await load()), seenAt: now }))

/** Reminders the user tapped on a notification: they obviously arrived. Lives only until the app closes. */
const acked = new Set<string>()
export const ackReminder = (rid: string) => void acked.add(rid)

/** Runs the check and keeps the log tidy. Returns the notice to show, if any. */
export const verifyDelivery = (reminders: Reminder[], cards: SavedCard[], delivered: ReadonlySet<number>, now = Date.now()) =>
  serial(async () => {
    const v = checkLog(await load(), reminders, cards, now, delivered, acked)
    await save(v.log)
    return v.missed
  })

let current: MissedNotice | null = null
const listeners = new Set<() => void>()
export const getMissed = () => current
export function setMissed(m: MissedNotice | null) {
  current = m
  listeners.forEach((l) => l())
}
export function subscribeMissed(l: () => void) {
  listeners.add(l)
  return () => void listeners.delete(l)
}
