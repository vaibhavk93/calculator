import { Capacitor, registerPlugin } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { shiftOutOfQuiet, type QuietHours } from './quietHours'
import { atTime, dueLabel, leadsOf } from './reminders'
import type { Reminder, SavedCard } from './memory'

const DAY = 86_400_000
const ACTION_TYPE = 'REMINDER'
/** The one-off "test reminder" notification. Reminders never use this id, and rescheduling leaves it alone. */
const TEST_ID = 2_147_483_000

export interface Planned {
  id: number
  at: number
  title: string
  body: string
  reminderId: string
}

/** A stable positive 31-bit number for a reminder id, which the Android notification API needs. */
export function numericId(id: string): number {
  let h = 7
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}

/** The same time of day, `n` calendar days earlier (a daylight-saving change cannot shift it). */
const daysBefore = (ts: number, n: number) => {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - n, d.getHours(), d.getMinutes()).getTime()
}

/**
 * Which notifications should exist right now: one per heads-up time (`leadDays`, or the `leads` list) of each open
 * reminder (or one at the due time, if every heads-up moment has already passed). Overdue ones are left to the
 * Due tab: re-notifying forever is how apps get muted. With `time` ("HH:MM"), every notification
 * comes at that time of day instead of the 9:00 a reminder is stored with, worked out in the phone's
 * current time zone, so a time-zone change is fixed by planning again.
 *
 * With `quiet`, a notification landing in those hours is moved to the end of them instead (lib/quietHours.ts).
 * It is never dropped, and never moved to at or after the moment the thing was due.
 */
export function planNotifications(reminders: Reminder[], cards: SavedCard[], now: number, money: (plain: string, fmt?: SavedCard['amountFmt']) => string, time?: string, quiet?: QuietHours | null): Planned[] {
  const out: Planned[] = []
  const when = (ts: number) => (time ? atTime(ts, time) : ts)
  for (const r of reminders) {
    const card = cards.find((c) => c.id === r.cardId && c.deletedAt === null)
    const dueAt = when(r.dueAt)
    if (r.done || !card || dueAt <= now) continue
    // One notification per heads-up time that is still ahead; if none is (all passed), one at the due time.
    const times = new Map<number, number>()
    leadsOf(r).forEach((lead, i) => {
      // Shifted BEFORE the map, so two heads-ups moved to the same morning become one notification, not two buzzes.
      const heads = shiftOutOfQuiet(time ? atTime(daysBefore(r.dueAt, lead), time) : r.dueAt - lead * DAY, quiet ?? null, dueAt)
      if (heads > now && !times.has(heads)) times.set(heads, i)
    })
    if (times.size === 0) times.set(dueAt, 0)
    for (const [at, i] of [...times].sort((x, y) => x[0] - y[0])) {
      out.push({
        id: i === 0 ? numericId(r.id) : numericId(`${r.id}:${i}`),
        at,
        title: card.title,
        body: [card.amount !== null ? money(card.amount, card.amountFmt) : '', `due ${dueLabel(dueAt, at).toLowerCase()}`].filter(Boolean).join(' · '),
        reminderId: r.id,
      })
    }
  }
  return out
}

export const notificationsSupported = () => Capacitor.isNativePlatform()

/** Asks only when the system would still ask. Returns whether notifications may be shown. */
export async function ensurePermission(): Promise<boolean> {
  if (!notificationsSupported()) return false
  try {
    let { display } = await LocalNotifications.checkPermissions()
    if (display === 'prompt' || display === 'prompt-with-rationale') display = (await LocalNotifications.requestPermissions()).display
    return display === 'granted'
  } catch {
    return false
  }
}

export interface ReminderPermissions {
  /** May notifications be shown at all? */
  notifications: boolean
  /** May reminders fire at the exact minute ("Alarms & reminders" in Android settings)? Otherwise they may be late by minutes. */
  exact: boolean
}

/** What the phone currently allows. Never asks. */
export async function checkReminderPermissions(): Promise<ReminderPermissions> {
  if (!notificationsSupported()) return { notifications: false, exact: false }
  try {
    const [n, e] = await Promise.all([LocalNotifications.checkPermissions(), LocalNotifications.checkExactNotificationSetting()])
    return { notifications: n.display === 'granted', exact: e.exact_alarm === 'granted' }
  } catch {
    return { notifications: false, exact: false }
  }
}

/** Opens Android's "Alarms & reminders" screen for this app. Returns what is allowed once the user is back. */
export async function openExactAlarmSettings(): Promise<boolean> {
  if (!notificationsSupported()) return false
  try {
    return (await LocalNotifications.changeExactNotificationSetting()).exact_alarm === 'granted'
  } catch {
    return false
  }
}

/**
 * Makes what is scheduled match `planned`. Exact when the phone allows it, otherwise inexact. Exactness is asked
 * for explicitly: left on by default, the plugin would throw the system settings screen at the user on every reschedule.
 *
 * Schedules first, then cancels only the leftovers. Scheduling an id that already exists replaces its alarm (the
 * Android plugin uses the id as the alarm's request code and cancels the old one), so a failure part-way never leaves
 * the phone with nothing: the old alarms stay. Returns false if anything failed, so the caller can tell the user and
 * skip recording the plan (nothing in the app shows that message yet: it needs wiring in delivery.ts and App.tsx).
 */
export async function applyNotifications(planned: Planned[]): Promise<boolean> {
  if (!notificationsSupported()) return true
  try {
    if (planned.length > 0) {
      const exact = (await checkReminderPermissions()).exact
      await LocalNotifications.registerActionTypes({
        types: [{ id: ACTION_TYPE, actions: [{ id: 'paid', title: 'Mark paid' }, { id: 'snooze', title: 'Snooze 1 day' }] }],
      })
      await LocalNotifications.schedule({
        notifications: planned.map((p) => ({
          id: p.id,
          title: p.title,
          body: p.body,
          schedule: { at: new Date(p.at), allowWhileIdle: true },
          isExactNotification: exact,
          actionTypeId: ACTION_TYPE,
          extra: { reminderId: p.reminderId },
        })),
      })
    }
    const keep = new Set(planned.map((p) => p.id))
    const { notifications } = await LocalNotifications.getPending()
    const stale = notifications.filter((n) => n.id !== TEST_ID && !keep.has(n.id))
    if (stale.length > 0) await LocalNotifications.cancel({ notifications: stale })
    return true
  } catch {
    return false
  }
}

interface ReminderAlarmsPlugin {
  takeLost(): Promise<{ lost: number }>
}
const alarms = registerPlugin<ReminderAlarmsPlugin>('ReminderAlarms')

/**
 * How many reminder alarms the phone had lost (a reboot, a force-stop, a battery saver) when the app last started, once.
 * The notifications plugin re-arms them silently before any web code runs, so only the native side can count them
 * (android/.../ReminderAlarmsPlugin.java). 0 on the web, with an old build, or on any error.
 */
export async function takeLostAlarms(): Promise<number> {
  if (!notificationsSupported()) return 0
  try {
    const { lost } = await alarms.takeLost()
    return Number.isFinite(lost) && lost > 0 ? Math.floor(lost) : 0
  } catch {
    return 0
  }
}

/** Calls back when the user taps Mark paid or Snooze on a notification. Returns a function that stops listening. */
export async function onNotificationAction(cb: (reminderId: string, action: 'paid' | 'snooze' | 'open') => void): Promise<() => void> {
  if (!notificationsSupported()) return () => {}
  const handle = await LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    const reminderId = (e.notification.extra as { reminderId?: unknown } | undefined)?.reminderId
    if (typeof reminderId !== 'string') return
    cb(reminderId, e.actionId === 'paid' ? 'paid' : e.actionId === 'snooze' ? 'snooze' : 'open')
  })
  return () => void handle.remove()
}

/** The numbers of notifications still showing in the notification shade. Empty on the web or if the phone will not say. */
export async function deliveredIds(): Promise<Set<number>> {
  if (!notificationsSupported()) return new Set()
  try {
    return new Set((await LocalNotifications.getDeliveredNotifications()).notifications.map((n) => n.id))
  } catch {
    return new Set()
  }
}

export type TestResult = { ok: true; at: number; exact: boolean } | { ok: false; reason: 'web' | 'denied' | 'failed' }

/**
 * Schedules one notification about a minute from now, through the same channel and exactness as real
 * reminders. It is a notification only: no reminder, so nothing appears in the Due tab.
 */
export async function scheduleTestReminder(now = Date.now()): Promise<TestResult> {
  if (!notificationsSupported()) return { ok: false, reason: 'web' }
  if (!(await ensurePermission())) return { ok: false, reason: 'denied' }
  try {
    const exact = (await checkReminderPermissions()).exact
    const at = now + 60_000
    await LocalNotifications.schedule({
      notifications: [
        {
          id: TEST_ID,
          title: 'Test reminder',
          body: 'Reminders can reach you on this phone.',
          schedule: { at: new Date(at), allowWhileIdle: true },
          isExactNotification: exact,
        },
      ],
    })
    return { ok: true, at, exact }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}
