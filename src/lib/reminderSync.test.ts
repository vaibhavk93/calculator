import { beforeEach, describe, expect, it, vi } from 'vitest'

// A fake phone. `os.alarms` = the real alarms (a reboot or force-stop wipes them); `os.saved` = the notifications plugin's own saved
// copies (they survive). `coldStart()` does what ReminderAlarmsPlugin.noteLost + the plugin's own repair do when the app process starts.
const os = vi.hoisted(() => ({
  alarms: new Map<number, { id: number; at: number }>(),
  saved: new Map<number, { id: number; at: number }>(),
  lostNote: 0,
  scheduleCalls: [] as number[][],
  coldStart(now: number) {
    for (const s of os.saved.values()) if (s.at > now && !os.alarms.has(s.id)) os.lostNote++ // counted first (native, before the repair)
    for (const s of os.saved.values()) if (s.at > now) os.alarms.set(s.id, s) // then the plugin silently re-arms
  },
}))
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: 'granted' }),
    checkExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
    registerActionTypes: async () => undefined,
    getPending: async () => ({ notifications: [...os.saved.values()].map((a) => ({ id: a.id })) }),
    cancel: async ({ notifications }: { notifications: { id: number }[] }) =>
      notifications.forEach((n) => {
        os.alarms.delete(n.id)
        os.saved.delete(n.id)
      }),
    schedule: async ({ notifications }: { notifications: { id: number; schedule: { at: Date } }[] }) => {
      os.scheduleCalls.push(notifications.map((n) => n.id))
      notifications.forEach((n) => {
        const a = { id: n.id, at: n.schedule.at.getTime() }
        os.alarms.set(n.id, a) // same id replaces, as the Android plugin does
        os.saved.set(n.id, a)
      })
    },
  },
}))
const prefs = vi.hoisted(() => new Map<string, string>())
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void prefs.set(key, value),
    remove: async ({ key }: { key: string }) => void prefs.delete(key),
  },
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({
    takeLost: async () => {
      const lost = os.lostNote
      os.lostNote = 0
      return { lost }
    },
  }),
}))

import { getRestored, setRestored } from './delivery'
import { planNotifications } from './notifications'
import { syncReminders } from './reminderSync'
import type { Reminder, SavedCard } from './memory'

const DAY = 86_400_000
const NOW = new Date(2026, 10, 10, 8).getTime()
const cards = [1, 2, 3, 4, 5].map((i) => ({ id: `c${i}`, title: `Bill ${i}`, amount: null, deletedAt: null }) as unknown as SavedCard)
const rem = (i: number): Reminder => ({ id: `r${i}`, cardId: `c${i}`, dueAt: NOW + (i + 1) * DAY, repeat: 'none', anchorDay: 10, leadDays: 0, done: false, history: [] })
const reminders = [1, 2, 3, 4, 5].map(rem)
const plan = (rs = reminders, now = NOW) => planNotifications(rs, cards, now, (p) => p)

beforeEach(() => {
  os.alarms.clear()
  os.saved.clear()
  os.lostNote = 0
  os.scheduleCalls.length = 0
  setRestored(0)
  prefs.clear()
})

/** The phone restarts (or the app is force-stopped): every real alarm is gone, the saved copies stay. Then the app starts again. */
const rebootAndOpen = (now: number) => {
  os.alarms.clear()
  os.scheduleCalls.length = 0
  os.coldStart(now)
}

describe('syncReminders: restoring after the phone loses its alarms', () => {
  it('a normal first plan schedules everything and reports nothing restored', async () => {
    expect(await syncReminders(plan(), reminders, NOW)).toBe(true)
    expect(os.alarms.size).toBe(5)
    expect(getRestored()).toBe(0)
  })

  it('simulated reboot: 5 reminders in the store, the OS scheduler empty -> exactly 5 alarms, each scheduled once, and the app notes 5 restored', async () => {
    await syncReminders(plan(), reminders, NOW)
    os.alarms.clear() // the phone restarted and dropped every alarm; the plugin repairs nothing yet
    os.scheduleCalls.length = 0
    os.coldStart(NOW + 60_000) // the app starts: native counts 5 lost, the plugin re-arms them
    os.alarms.clear() // worst case: even that repair is not there (a phone that kills the app straight away)

    expect(await syncReminders(plan(), reminders, NOW + 60_000)).toBe(true)
    const scheduled = os.scheduleCalls.flat()
    expect(scheduled).toHaveLength(5)
    expect(new Set(scheduled).size).toBe(5)
    expect(os.alarms.size).toBe(5)
    expect(getRestored()).toBe(5)
  })

  it('opening the app again once everything is back changes nothing and says nothing new', async () => {
    await syncReminders(plan(), reminders, NOW)
    rebootAndOpen(NOW + 60_000)
    await syncReminders(plan(), reminders, NOW + 60_000)
    expect(getRestored()).toBe(5)
    setRestored(0)
    os.coldStart(NOW + 120_000) // nothing lost this time
    await syncReminders(plan(), reminders, NOW + 120_000)
    expect(os.alarms.size).toBe(5)
    expect(getRestored()).toBe(0)
  })

  it('says nothing for a reminder that is no longer open (paid or removed since)', async () => {
    await syncReminders(plan(), reminders, NOW)
    rebootAndOpen(NOW + 60_000) // 5 alarms lost...
    const edited = reminders.slice(0, 2) // ...but the store now only has 2 open reminders
    await syncReminders(plan(edited), edited, NOW + 60_000)
    expect(getRestored()).toBe(2) // never more than what is actually open
    expect(os.alarms.size).toBe(2)
  })

  it('a time-zone change is fixed by planning again and replaces alarms by id, never doubling them', async () => {
    await syncReminders(planNotifications(reminders, cards, NOW, (p) => p, '09:00'), reminders, NOW)
    const before = [...os.alarms.keys()].sort()
    await syncReminders(planNotifications(reminders, cards, NOW, (p) => p, '10:30'), reminders, NOW + 60_000)
    expect([...os.alarms.keys()].sort()).toEqual(before)
    expect(getRestored()).toBe(0)
  })
})
