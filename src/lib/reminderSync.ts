import { recordPlan, setRestored } from './delivery'
import { applyNotifications, notificationsSupported, takeLostAlarms, type Planned } from './notifications'
import type { Reminder } from './memory'

/** One sync at a time, so two overlapping plans never write the plan log over each other. */
let chain: Promise<unknown> = Promise.resolve()

/**
 * Makes the phone's alarms match `planned` and remembers the plan. Called whenever the app opens, comes back, or a
 * reminder changes, so an alarm the phone lost is put back the next time the app is seen. Also picks up the count of alarms
 * the phone had lost at startup (see takeLostAlarms) and tells the Due tab once. Returns false if scheduling failed
 * (the old alarms were kept).
 */
export function syncReminders(planned: Planned[], reminders: Reminder[], now = Date.now()): Promise<boolean> {
  const run = async () => {
    const lost = await takeLostAlarms()
    if (!(await applyNotifications(planned))) return false
    if (notificationsSupported()) await recordPlan(planned, reminders, now)
    // Said only after the plan is really back on the phone, and only for reminders still open (an unsure count would worry for nothing).
    if (lost > 0 && planned.length > 0) setRestored(Math.min(lost, new Set(planned.map((p) => p.reminderId)).size))
    return true
  }
  const next = chain.then(run, run)
  chain = next.catch(() => undefined)
  return next
}
