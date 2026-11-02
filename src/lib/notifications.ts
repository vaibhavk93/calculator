import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { dueLabel } from './reminders'
import type { Reminder, SavedCard } from './memory'

const DAY = 86_400_000
const ACTION_TYPE = 'REMINDER'

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

/**
 * Which notifications should exist right now: one per open reminder, `leadDays` before it is due
 * (or at the due time, if that heads-up moment has already passed). Overdue ones are left to the
 * Due tab: re-notifying forever is how apps get muted.
 */
export function planNotifications(reminders: Reminder[], cards: SavedCard[], now: number, money: (plain: string) => string): Planned[] {
  const out: Planned[] = []
  for (const r of reminders) {
    const card = cards.find((c) => c.id === r.cardId && c.deletedAt === null)
    if (r.done || !card || r.dueAt <= now) continue
    const heads = r.dueAt - r.leadDays * DAY
    const at = heads > now ? heads : r.dueAt
    out.push({
      id: numericId(r.id),
      at,
      title: card.title,
      body: [card.amount !== null ? money(card.amount) : '', `due ${dueLabel(r.dueAt, at).toLowerCase()}`].filter(Boolean).join(' · '),
      reminderId: r.id,
    })
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
 * Replaces everything scheduled with exactly `planned`. Exact when the phone allows it, otherwise
 * inexact. Exactness is asked for explicitly: left on by default, the plugin would throw the
 * system settings screen at the user on every reschedule.
 */
export async function applyNotifications(planned: Planned[]): Promise<void> {
  if (!notificationsSupported()) return
  try {
    const exact = (await checkReminderPermissions()).exact
    const { notifications } = await LocalNotifications.getPending()
    if (notifications.length > 0) await LocalNotifications.cancel({ notifications })
    if (planned.length === 0) return
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
  } catch {
    /* Scheduling failed: the Due tab still shows everything. */
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
