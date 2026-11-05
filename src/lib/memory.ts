import type { Values } from './tool'

/** What the user keeps, and what reminds them. Plain data: nothing here knows about React or the store. */

export type Repeat = 'none' | 'monthly' | 'quarterly' | 'yearly'
export const REPEATS: readonly Repeat[] = ['none', 'monthly', 'quarterly', 'yearly']
export const REPEAT_MONTHS: Record<Repeat, number> = { none: 0, monthly: 1, quarterly: 3, yearly: 12 }

export interface TapeLine {
  id: string
  label: string
  /** Plain decimal string. */
  value: string
  /** Ticked off (paid, bought, done). Absent means not ticked. */
  done?: boolean
  /** Skipped: not paid and not going to be. Left out of the totals. Never set together with `done`. */
  skip?: boolean
}

/**
 * The one container for everything the user keeps: a calculator's inputs, or a running tape.
 * `inputs` is a blob, so a new calculator never changes this shape.
 */
export interface SavedCard {
  id: string
  title: string
  kind: 'tool' | 'tape' | 'task' | 'text'
  /** For kind 'tool': which calculator, and the form exactly as it was. */
  toolId: string | null
  inputs: Values | null
  /** One line shown in the list, written when the card is saved. */
  summary: string
  /** The headline number as a plain decimal, used for reminders and totals. Null when there isn't one. */
  amount: string | null
  /**
   * What `amount` *is*. Without it everything was drawn as rupees, so a date
   * difference of 300 days read as "₹300" and a BMI of 24.5 as "₹24.50".
   * Absent means money, which is what every card saved before this existed was.
   */
  amountFmt?: 'money' | 'percent' | 'number' | 'int' | 'text'
  /** For kind 'tape'. */
  lines: TapeLine[]
  /** For kind 'tape': show a checkbox on each line, and "done / left" totals. Absent means off. */
  checklist?: boolean
  /** For kind 'task': ticked off. Its date, if any, is an ordinary Reminder on this card. */
  done?: boolean
  doneAt?: number
  /** For kind 'text' this is the body of the note (plain text, no maths). On every other kind it is the optional note. */
  note: string
  tags: string[]
  pinned: boolean
  createdAt: number
  updatedAt: number
  /** Set when deleted. The card stays in Trash for TRASH_DAYS. */
  deletedAt: number | null
}

export interface Payment {
  paidAt: number
  amount: string | null
}

export interface Reminder {
  id: string
  cardId: string
  /** When it is due, in ms. */
  dueAt: number
  repeat: Repeat
  /** Day of the month it is meant for, so Jan 31 then Feb 28 then Mar 31 does not drift to the 28th. */
  anchorDay: number
  leadDays: number
  /** Several heads-up times, in days before (0 = on the day), biggest first. Absent: just `leadDays`. When present, `leadDays` is its biggest. */
  leads?: number[]
  /** Repeat this many days after it is ticked off, instead of on the calendar. Absent: use `repeat`. */
  afterDays?: number
  /** A one-time reminder that has been marked paid. Recurring ones never finish: they advance. */
  done: boolean
  history: Payment[]
}

export const MAX_PINNED = 5
export const TRASH_DAYS = 7
export const MAX_CARDS = 500
/** A task title is at most this long, like every card title. */
export const MAX_TASK_TITLE = 120
export const MAX_TASK_TAGS = 5
/** A plain note's body is the card's `note` field, so it shares that field's limit. */
export const MAX_NOTE_BODY = 5000
export const MAX_NOTE_TAGS = 10
export const DEFAULT_TAGS = ['Credit Card', 'Loan', 'Rent', 'Investment', 'Tax', 'Travel', 'Work', 'Shopping'] as const

/**
 * The tag chips a sheet shows: the user's own tags (every tag on a saved card), then the starter tags only while the
 * user has fewer than 3 of their own, then anything picked now that is not there yet. "Loan" and "loan" are one chip
 * (the first spelling wins, own tags before starters), so tapping a chip never moves it.
 */
export function mergeTags(own: readonly string[], picked: readonly string[], starters: readonly string[] = []): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (t: string) => {
    const k = t.toLowerCase()
    if (!seen.has(k)) (seen.add(k), out.push(t))
  }
  const mine = [...own].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
  mine.forEach(add)
  if (out.length < 3) starters.forEach(add)
  picked.forEach(add)
  return out
}
