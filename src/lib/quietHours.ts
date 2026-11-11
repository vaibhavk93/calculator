import { atTime, parseTime } from './reminders'

/**
 * Quiet hours: a window of the day when a reminder must not make a sound.
 *
 * A reminder inside the window is **moved to the end of it**, never dropped. Dropping would lose a bill
 * reminder, which is the one thing reminders exist to prevent; arriving a few hours late still works.
 *
 * Worth knowing: every reminder notification in this app already comes at one time the user chose
 * (`settings.reminderTime`), so these hours only do something when that time, or a heads-up worked out from
 * it, falls inside the window. The Settings screen says so in words when that is the case.
 */
export interface QuietHours {
  /** "HH:MM" (24 hour), when the quiet starts. */
  from: string
  /** "HH:MM" (24 hour), when it ends. May be earlier in the day than `from`: the window then crosses midnight. */
  until: string
}

/** Minutes since midnight, 0 when the text is not a time. */
const mins = (time: string): number => {
  const [h, m] = parseTime(time) ?? [0, 0]
  return h * 60 + m
}

/** Minutes since midnight of `ts`, read in the phone's own time zone. */
const minsOf = (ts: number): number => {
  const d = new Date(ts)
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Is `ts` inside the window? A window that crosses midnight (22:00 to 07:00) counts both the evening and
 * the early-morning part. The end is not included, so a reminder exactly at the end time is allowed.
 *
 * A window of no length (the same time twice) is treated as OFF, never as "quiet all day": a setting that
 * silenced every reminder because two fields happened to match would be a trap.
 */
export function inQuietHours(ts: number, q: QuietHours): boolean {
  const from = mins(q.from)
  const until = mins(q.until)
  if (from === until) return false
  const cur = minsOf(ts)
  return from < until ? cur >= from && cur < until : cur >= from || cur < until
}

/** The moment the window containing `ts` ends. */
export function quietEnd(ts: number, q: QuietHours): number {
  const from = mins(q.from)
  const until = mins(q.until)
  const d = new Date(ts)
  // In the evening half of a window that crosses midnight, the end is tomorrow. Built from the calendar date
  // (not ts + 24h), so a day that is 23 or 25 hours long because the clocks changed still lands on the right date.
  const next = from > until && minsOf(ts) >= from
  return atTime(new Date(d.getFullYear(), d.getMonth(), d.getDate() + (next ? 1 : 0)).getTime(), q.until)
}

/**
 * `at`, moved to the end of the quiet window if it falls inside one.
 *
 * `notAfter` is a moment the result must stay before: the reminder's own due time. Pushing a heads-up to
 * after the thing was due would make it useless, so in that case the original time is kept. That also means
 * a reminder due *inside* the quiet hours still rings then: the user set that time, and a late warning
 * about a bill already due is worse than a buzz at a quiet hour.
 */
export function shiftOutOfQuiet(at: number, q: QuietHours | null, notAfter: number): number {
  if (!q || !inQuietHours(at, q)) return at
  const moved = quietEnd(at, q)
  return moved < notAfter ? moved : at
}
