/** When to suggest a backup. Pure, so the "never nag" rule can be tested. */

export const NUDGE_MIN_ITEMS = 25
export const NUDGE_EVERY_MS = 14 * 86_400_000
const STALE_MS = 30 * 86_400_000

/**
 * The one line to show, or null. `lastShownAt` is when this kind of nudge was last shown or dismissed:
 * it is never shown again within 14 days of that.
 */
export function backupNudge(items: number, lastBackupAt: number | null, lastShownAt: number | null, now: number): string | null {
  if (items < NUDGE_MIN_ITEMS) return null
  if (lastShownAt !== null && now - lastShownAt < NUDGE_EVERY_MS) return null
  if (lastBackupAt === null) return `You have ${items} items and no backup yet. Save one in Settings > Your data.`
  const days = Math.floor((now - lastBackupAt) / 86_400_000)
  return now - lastBackupAt > STALE_MS ? `Your last backup is ${days} days old. Save a new one in Settings > Your data.` : null
}

/** Things worth losing: expenses, notes, lists and tasks that are not in Trash. */
export const countItems = (s: { cards: { deletedAt: number | null }[]; budget: { expenses: { deletedAt: number | null }[] } }) =>
  s.cards.filter((c) => c.deletedAt === null).length + s.budget.expenses.filter((e) => e.deletedAt === null).length
