import { MAX_TASK_TAGS, MAX_TASK_TITLE, type Reminder, type Repeat, type SavedCard } from './memory'
import { advance, startOfDay } from './reminders'

/**
 * To-do, as plain data. A task is a SavedCard of kind 'task'; its date is an ordinary Reminder on that card,
 * so Trash, tags, pin, search, backup, the Due tab and notifications all work with no extra code.
 */

export const TASK_TITLE_ERROR = 'Write what needs doing'
/** A due date is 9 in the morning, local time, like every reminder in the app. */
const DUE_HOUR = 9
const MIN_YEAR = 2000
const MAX_YEARS_AHEAD = 5

const pad = (n: number) => String(n).padStart(2, '0')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-11-05" for a timestamp, in local time. The shape `<input type="date">` uses. */
export function dayText(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "5 Nov 2026". Fixed words, so it reads the same on every phone. */
export function shortDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** The day in "YYYY-MM-DD" as 9:00 local, or null when it is not a real calendar day (31 Feb, 2026-13-01, blank). */
export function parseDay(text: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(y, mo - 1, d, DUE_HOUR)
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date.getTime() : null
}

export interface TaskInput {
  title: string
  /** "YYYY-MM-DD", or "" for no date. */
  date: string
  repeat: Repeat
  tags: string[]
}

export interface TaskErrors {
  title?: string
  date?: string
  repeat?: string
  tags?: string
}

export interface TaskChecked {
  errors: TaskErrors
  title: string
  /** Null when the task has no date. */
  dueAt: number | null
}

/** Checks a task before it is saved. Every message is in words and says what to do. */
export function validateTask(input: TaskInput, now: number): TaskChecked {
  const errors: TaskErrors = {}
  const title = input.title.trim()
  if (!title) errors.title = TASK_TITLE_ERROR
  else if (title.length > MAX_TASK_TITLE) errors.title = `Keep the name to ${MAX_TASK_TITLE} characters or fewer`

  let dueAt: number | null = null
  if (input.date.trim()) {
    dueAt = parseDay(input.date)
    if (dueAt === null) errors.date = 'That date does not exist'
    else if (new Date(dueAt).getFullYear() < MIN_YEAR) errors.date = `Pick a date from the year ${MIN_YEAR} on`
    else {
      const n = new Date(now)
      const limit = new Date(n.getFullYear() + MAX_YEARS_AHEAD, n.getMonth(), n.getDate() + 1).getTime()
      if (dueAt >= limit) errors.date = `Pick a date within the next ${MAX_YEARS_AHEAD} years`
    }
  } else if (input.repeat !== 'none') errors.repeat = 'Pick a date first, so we know when it repeats'

  if (new Set(input.tags.map((t) => t.trim().toLowerCase())).size > MAX_TASK_TAGS) errors.tags = `${MAX_TASK_TAGS} tags is the most`
  return { errors, title, dueAt: errors.date ? null : dueAt }
}

export const hasErrors = (e: TaskErrors) => Object.keys(e).length > 0

/** The one line a task shows in Trash and in search. */
export function taskSummary(dueAt: number | null, repeat: Repeat): string {
  if (dueAt === null) return 'No date'
  return `Due ${shortDate(dueAt)}${repeat === 'none' ? '' : ` · ${repeat}`}`
}

// ------------------------------------------------------------------ grouping

export interface TaskItem {
  card: SavedCard
  reminder: Reminder | undefined
  /** Null for an undated task (the inbox). */
  dueAt: number | null
  done: boolean
}

/** Done in the Notes sense, or finished from the Due tab (Mark paid on its reminder). */
export const isTaskDone = (card: SavedCard, reminder: Reminder | undefined) => card.done === true || reminder?.done === true

/** Every live task with its reminder. Trashed ones are left out. */
export function taskItems(cards: SavedCard[], reminders: Reminder[]): TaskItem[] {
  const byCard = new Map<string, Reminder>()
  for (const r of reminders) byCard.set(r.cardId, r)
  return cards
    .filter((c) => c.kind === 'task' && c.deletedAt === null)
    .map((card) => {
      const reminder = byCard.get(card.id)
      return { card, reminder, dueAt: reminder ? reminder.dueAt : null, done: isTaskDone(card, reminder) }
    })
}

export interface TaskGroups {
  overdue: TaskItem[]
  today: TaskItem[]
  /** Dated after today. */
  upcoming: TaskItem[]
  /** No date. */
  inbox: TaskItem[]
  done: TaskItem[]
}

/** Pinned first, then soonest, then newest. */
const byUrgency = (a: TaskItem, b: TaskItem) =>
  Number(b.card.pinned) - Number(a.card.pinned) || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || b.card.createdAt - a.card.createdAt

/**
 * Splits tasks by calendar day in local time. "Today" is midnight to midnight, so a task due at 9:00 is still
 * Today at 23:59 and Overdue at 00:00; a month end or a daylight-saving change cannot move it by a day.
 */
export function groupTasks(items: TaskItem[], now: number): TaskGroups {
  const d = new Date(now)
  const todayStart = startOfDay(now)
  const tomorrowStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
  const g: TaskGroups = { overdue: [], today: [], upcoming: [], inbox: [], done: [] }
  for (const t of [...items].sort(byUrgency)) {
    if (t.done) g.done.push(t)
    else if (t.dueAt === null) g.inbox.push(t)
    else if (t.dueAt < todayStart) g.overdue.push(t)
    else if (t.dueAt < tomorrowStart) g.today.push(t)
    else g.upcoming.push(t)
  }
  g.done.sort((a, b) => (b.card.doneAt ?? 0) - (a.card.doneAt ?? 0))
  return g
}

/** What the To-do switch shows next to its name: due today, plus overdue. */
export const todayCount = (g: TaskGroups) => g.overdue.length + g.today.length

/**
 * Ticking a repeating task moves it to its next date, never to one already past
 * (a monthly task left for three months jumps to the next future month, not to last month).
 * Returns null for a one-time task: it is finished.
 */
export function nextOccurrence(r: Pick<Reminder, 'dueAt' | 'repeat' | 'anchorDay'>, now: number): number | null {
  let next = advance(r)
  const today = startOfDay(now)
  for (let i = 0; next !== null && next < today && i < 1000; i++) next = advance({ ...r, dueAt: next })
  return next
}
