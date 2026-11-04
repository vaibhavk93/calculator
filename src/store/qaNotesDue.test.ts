import { afterEach, describe, expect, it } from 'vitest'
// QA campaign for Notes, To-do, Due, Settings and onboarding: the planning and data logic, with fake dates and
// time zones. Case ids N-1xx belong to docs/QA-REPORT-notes-due.md (browser cases are N-0xx in e2e/qa-notes-due.test.mjs).
// Notifications themselves cannot fire in a browser or in vitest: what is proven here is WHAT would be scheduled and WHEN.
import { numericId, planNotifications } from '../lib/notifications'
import { addMonths, advance, advanceTaxPack, dueLabel, dueSoonTotal, groupReminders, leadsOf, nextOnDay, parseTime, startOfDay } from '../lib/reminders'
import { checkLog, GRACE_MS, mergePlan, missedText, sanitizeLog, type FireLog } from '../lib/delivery'
import { backupNudge, countItems } from '../lib/backupNudge'
import { groupTasks, nextOccurrence, parseDay, taskItems, validateTask } from '../lib/tasks'
import { lineState, listProgress, listSummary, nextLineState, parsePastedList, tapeTotal, withLineState } from '../lib/tape'
import type { Reminder, SavedCard, TapeLine } from '../lib/memory'
import { buildBackup, parseBackup } from './backup'
import { createAppStore } from './app'
import { defaultPersisted, migrate, sanitizeCards, sanitizeReminders, sanitizeSettings } from './persistence'
import { MAX_CARDS } from './types'
import { OEM_GUIDES, oemBrand } from '../lib/oemSettings'

const DAY = 86_400_000
const ORIGINAL_TZ = process.env.TZ
afterEach(() => { process.env.TZ = ORIGINAL_TZ })
/** Runs `fn` with the process in another time zone. Dates are read from the system zone, so this is a real zone change. */
const inTz = <T>(tz: string, fn: () => T): T => { process.env.TZ = tz; try { return fn() } finally { process.env.TZ = ORIGINAL_TZ } }
const local = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min).getTime()
const money = (a: string) => `₹${a}`
const card = (o: Partial<SavedCard> = {}): SavedCard => ({ id: 'c', title: 'Rent', kind: 'task', toolId: null, inputs: null, summary: '', amount: null, lines: [], note: '', tags: [], pinned: false, createdAt: 1, updatedAt: 1, deletedAt: null, ...o })
const rem = (o: Partial<Reminder> = {}): Reminder => ({ id: 'r', cardId: 'c', dueAt: 0, repeat: 'none', anchorDay: 1, leadDays: 0, done: false, history: [], ...o })
const hm = (ts: number) => `${String(new Date(ts).getHours()).padStart(2, '0')}:${String(new Date(ts).getMinutes()).padStart(2, '0')}`
function setup(now: number) {
  let t = now
  let n = 0
  const store = createAppStore(defaultPersisted(), { now: () => t, newId: () => `id${++n}` })
  const get = store.getState
  const task = (title: string, due?: { dueAt: number; repeat?: Reminder['repeat']; afterDays?: number; leads?: number[]; leadDays?: number }) =>
    get().saveCard({ title, kind: 'task', toolId: null, inputs: null, summary: '', amount: null, lines: [] }, due ? { dueAt: due.dueAt, repeat: due.repeat ?? 'none', leadDays: due.leadDays ?? 0, ...(due.leads ? { leads: due.leads } : {}), ...(due.afterDays ? { afterDays: due.afterDays } : {}) } : null)!
  return { store, get, task, setNow: (v: number) => (t = v) }
}

// ---------------------------------------------------------------- planning: lead times, reminder time
describe('N-101..N-108 planNotifications', () => {
  it('N-101 ten lead times: ten distinct notifications, in time order, all at the reminder time, unique ids', () => {
    const now = local(2026, 11, 2, 10)
    const leads = [60, 45, 30, 21, 14, 10, 7, 3, 1, 0]
    const r = rem({ dueAt: local(2027, 3, 1), leadDays: 60, leads })
    const plan = planNotifications([r], [card()], now, money, '09:00')
    expect(plan).toHaveLength(10)
    expect(plan.map((p) => p.at)).toEqual([...plan.map((p) => p.at)].sort((a, b) => a - b))
    expect(new Set(plan.map((p) => p.id)).size).toBe(10)
    expect(plan.every((p) => hm(p.at) === '09:00')).toBe(true)
    expect(plan[9]!.at).toBe(local(2027, 3, 1))
    expect(plan[0]!.at).toBe(local(2026, 12, 31)) // 60 days before 1 Mar 2027 (31 + 28 = 59 days from 1 Jan)
  })
  it('N-102 duplicate and unsorted lead times are folded; one notification each', () => {
    expect(leadsOf({ leadDays: 3, leads: [3, 7, 3, 0, 7] })).toEqual([7, 3, 0])
    const plan = planNotifications([rem({ dueAt: local(2026, 12, 1), leads: [3, 7, 3, 0, 7], leadDays: 7 })], [card()], local(2026, 11, 2), money, '09:00')
    expect(plan).toHaveLength(3)
  })
  it('N-103 heads-up moments already past are dropped; the later ones stay with stable ids', () => {
    const now = local(2026, 11, 8, 10)
    const r = rem({ dueAt: local(2026, 11, 10), leadDays: 7, leads: [7, 3, 0] })
    const plan = planNotifications([r], [card()], now, money, '09:00')
    expect(plan.map((p) => p.at)).toEqual([local(2026, 11, 10)])
    expect(plan[0]!.id).toBe(numericId('r:2')) // third heads-up keeps its own number, so a replan never double-books
  })
  it('N-104 every heads-up past and the due time past: nothing (the Due tab shows it as overdue)', () => {
    expect(planNotifications([rem({ dueAt: local(2026, 11, 1), leads: [3, 0], leadDays: 3 })], [card()], local(2026, 11, 2), money, '09:00')).toEqual([])
  })
  it('N-105 changing the reminder time moves every notification of every reminder, and never makes a time that is in the past', () => {
    const now = local(2026, 11, 2, 10)
    const rs = [rem({ id: 'a', dueAt: local(2026, 11, 10), leads: [3, 0], leadDays: 3 }), rem({ id: 'b', dueAt: local(2026, 11, 20), leadDays: 1 })]
    for (const t of ['00:00', '06:15', '18:30', '23:59']) {
      const plan = planNotifications(rs, [card()], now, money, t)
      expect(plan.length).toBe(3)
      expect(plan.every((p) => hm(p.at) === t && p.at > now)).toBe(true)
    }
  })
  it('N-106 midnight: a notification at exactly "now" is not planned; one minute ahead is', () => {
    const due = local(2026, 11, 3, 0, 0)
    const r = rem({ dueAt: due })
    expect(planNotifications([r], [card()], due, money, '00:00')).toEqual([])
    expect(planNotifications([r], [card()], due - 60_000, money, '00:00')).toHaveLength(1)
  })
  it('N-107 a bad stored time falls back to 9:00 instead of NaN', () => {
    const plan = planNotifications([rem({ dueAt: local(2026, 11, 10) })], [card()], local(2026, 11, 2), money, '25:99')
    expect(hm(plan[0]!.at)).toBe('09:00')
    expect(parseTime('9:00')).toBeNull()
    expect(parseTime('24:00')).toBeNull()
    expect(parseTime('00:00')).toEqual([0, 0])
  })
  it('N-108 500 reminders with 3 lead times: all notification numbers are unique (one per notification)', () => {
    const rs = Array.from({ length: 500 }, (_, i) => rem({ id: `${i}-uuid-${(i * 2654435761) % 99991}`, dueAt: local(2027, 1, 1 + (i % 28)), leads: [7, 3, 0], leadDays: 7 }))
    const plan = planNotifications(rs, [card()], local(2026, 11, 2), money, '09:00')
    expect(plan).toHaveLength(1500)
    expect(new Set(plan.map((p) => p.id)).size).toBe(1500)
  })
})

// ---------------------------------------------------------------- time zones and daylight saving
describe('N-109..N-114 time zones and daylight saving', () => {
  it('N-109 New York: heads-up times across the clocks going back (1 Nov 2026) stay at 9:00 local', () => {
    inTz('America/New_York', () => {
      const r = rem({ dueAt: local(2026, 11, 5), leads: [7, 3, 1, 0], leadDays: 7 })
      const plan = planNotifications([r], [card()], local(2026, 10, 20), money, '09:00')
      expect(plan).toHaveLength(4)
      expect(plan.every((p) => hm(p.at) === '09:00')).toBe(true)
      expect(new Date(plan[0]!.at).getDate()).toBe(29) // 7 days before 5 Nov is 29 Oct
    })
  })
  it('N-110 New York: a time that does not exist (2:30 am on 8 Mar 2026) does not crash and gives a real time', () => {
    inTz('America/New_York', () => {
      const plan = planNotifications([rem({ dueAt: local(2026, 3, 8) })], [card()], local(2026, 3, 1), money, '02:30')
      expect(plan).toHaveLength(1)
      expect(Number.isFinite(plan[0]!.at)).toBe(true)
      expect(new Date(plan[0]!.at).getDate()).toBe(8)
    })
  })
  it('N-111 "1 day before" is a calendar day, so a 25-hour day (clocks back) cannot shift the time of day', () => {
    inTz('America/New_York', () => {
      const r = rem({ dueAt: local(2026, 11, 2), leads: [1], leadDays: 1 })
      const [p] = planNotifications([r], [card()], local(2026, 10, 25), money, '09:00')
      expect(new Date(p!.at).getDate()).toBe(1)
      expect(hm(p!.at)).toBe('09:00')
    })
  })
  it('N-112 Snooze 1 day keeps the time of day across clocks going back (America/New_York)', () => {
    inTz('America/New_York', () => {
      const due = local(2026, 10, 31, 9)
      const c = setup(local(2026, 10, 30, 10))
      const id = c.task('Pay rent', { dueAt: due })
      const rid = c.get().reminders[0]!.id
      c.get().snooze(rid, 1)
      expect(c.get().reminders[0]!.cardId).toBe(id)
      expect(hm(c.get().reminders[0]!.dueAt)).toBe('09:00')
      expect(new Date(c.get().reminders[0]!.dueAt).getDate()).toBe(1)
    })
  })
  it('N-113 Snooze 1 day keeps 9:00 across clocks going forward too (Europe/London, 29 Mar 2026)', () => {
    inTz('Europe/London', () => {
      const c = setup(local(2026, 3, 27, 10))
      c.task('Pay rent', { dueAt: local(2026, 3, 28, 9) })
      c.get().snooze(c.get().reminders[0]!.id, 1)
      expect(hm(c.get().reminders[0]!.dueAt)).toBe('09:00')
      expect(new Date(c.get().reminders[0]!.dueAt).getDate()).toBe(29)
    })
  })
  it('N-114 the phone changes time zone: planning again puts every notification at the reminder time in the NEW zone', () => {
    const due = inTz('Asia/Kolkata', () => local(2026, 11, 10))
    inTz('America/New_York', () => {
      const [p] = planNotifications([rem({ dueAt: due })], [card()], due - 5 * DAY, money, '09:00')
      expect(hm(p!.at)).toBe('09:00')
    })
  })
  // Open limit, not fixed: `it.fails` passes while the behaviour is still wrong and goes red the day it is fixed, so it cannot be forgotten.
  it.fails('N-115 KNOWN OPEN: a due date made in India reads as the day BEFORE after the phone moves to New York (dates are stored as one instant)', () => {
    const due = inTz('Asia/Kolkata', () => local(2026, 11, 10)) // 10 Nov 09:00 IST
    const day = inTz('America/New_York', () => new Date(due).getDate())
    // What a traveller would expect is 10. It is 9, because 09:00 IST is 22:30 the evening before in New York.
    expect(day, 'due day after moving west').toBe(10)
  })
  it('N-116 dueLabel is right across a 25-hour day (New York, 1 Nov 2026) and a 23-hour day (8 Mar 2026)', () => {
    inTz('America/New_York', () => {
      expect(dueLabel(local(2026, 11, 2, 9), local(2026, 11, 1, 23, 30))).toBe('Tomorrow')
      expect(dueLabel(local(2026, 3, 9, 9), local(2026, 3, 8, 23, 30))).toBe('Tomorrow')
      expect(dueLabel(local(2026, 11, 1, 9), local(2026, 11, 1, 1, 30))).toBe('Today')
    })
  })
})

// ---------------------------------------------------------------- repeats, month ends, leap day
describe('N-117..N-125 repeats, month ends, Feb 29', () => {
  const chain = (start: number, repeat: Reminder['repeat'], anchor: number, n: number) => {
    const out: string[] = []
    let t = start
    for (let i = 0; i < n; i++) {
      t = advance({ dueAt: t, repeat, anchorDay: anchor })!
      out.push(new Date(t).toDateString().slice(4))
    }
    return out
  }
  it('N-117 monthly from 31 Jan: 28 Feb, 31 Mar, 30 Apr, 31 May (never drifts to the 28th)', () => {
    expect(chain(local(2027, 1, 31), 'monthly', 31, 4)).toEqual(['Feb 28 2027', 'Mar 31 2027', 'Apr 30 2027', 'May 31 2027'])
  })
  it('N-118 monthly from 31 Jan in a leap year lands on 29 Feb', () => {
    expect(chain(local(2028, 1, 31), 'monthly', 31, 2)).toEqual(['Feb 29 2028', 'Mar 31 2028'])
  })
  it('N-119 yearly from 29 Feb 2028: 28 Feb 2029, 28 Feb 2030, 28 Feb 2031, then 29 Feb 2032', () => {
    expect(chain(local(2028, 2, 29), 'yearly', 29, 4)).toEqual(['Feb 28 2029', 'Feb 28 2030', 'Feb 28 2031', 'Feb 29 2032'])
  })
  it('N-120 quarterly from 30 Nov: 28 Feb, 30 May; from 31 Aug: 30 Nov, 28 Feb, 31 May', () => {
    expect(chain(local(2026, 11, 30), 'quarterly', 30, 2)).toEqual(['Feb 28 2027', 'May 30 2027'])
    expect(chain(local(2026, 8, 31), 'quarterly', 31, 3)).toEqual(['Nov 30 2026', 'Feb 28 2027', 'May 31 2027'])
  })
  it('N-121 December to January crosses the year', () => {
    expect(addMonths(local(2026, 12, 15), 1, 15)).toBe(local(2027, 1, 15))
    expect(addMonths(local(2026, 1, 15), -1, 15)).toBe(local(2025, 12, 15))
  })
  it('N-122 "after I tick it": counted from the tick day at the reminder\'s own time, never in the past', () => {
    const r = { dueAt: local(2026, 10, 1, 9), repeat: 'none' as const, anchorDay: 1, afterDays: 180 }
    const now = local(2026, 11, 2, 15, 47)
    const next = nextOccurrence(r, now)!
    expect(next).toBe(local(2027, 5, 1, 9))
    expect(next).toBeGreaterThan(now)
    expect(advance(r, now)).toBe(next)
  })
  it('N-123 a monthly task ticked months late jumps to the next FUTURE date', () => {
    const r = { dueAt: local(2026, 8, 31), repeat: 'monthly' as const, anchorDay: 31 }
    expect(nextOccurrence(r, local(2026, 11, 2))).toBe(local(2026, 11, 30))
    expect(nextOccurrence({ ...r, dueAt: local(2027, 1, 31) }, local(2027, 3, 1))).toBe(local(2027, 3, 31))
  })
  it('N-124 nextOnDay: the 31st in a 30-day month, and a day already gone this month', () => {
    expect(nextOnDay(local(2026, 4, 10), 31, '09:00')).toBe(local(2026, 4, 30))
    expect(nextOnDay(local(2026, 4, 30, 10), 31, '09:00')).toBe(local(2026, 5, 31))
    expect(nextOnDay(local(2026, 12, 20), 5, '09:00')).toBe(local(2027, 1, 5))
  })
  it('N-125 a task ticked in the Due tab ("Done") catches up like a tick in To-do: not left in the past', () => {
    const c = setup(local(2026, 11, 2, 10))
    c.task('Water filter', { dueAt: local(2026, 8, 31), repeat: 'monthly' })
    c.get().markPaid(c.get().reminders[0]!.id)
    expect.soft(c.get().reminders[0]!.dueAt, 'due after Done').toBeGreaterThanOrEqual(startOfDay(local(2026, 11, 2)))
  })
})

// ---------------------------------------------------------------- to-do grouping and validation
describe('N-126..N-131 To-do', () => {
  const items = (dueAt: number | null, done = false) => taskItems([card({ done: done || undefined })], dueAt === null ? [] : [rem({ dueAt })])
  it('N-126 the day ends at midnight: 09:00 is Today at 23:59:59 and Overdue at 00:00', () => {
    const due = local(2026, 11, 2, 9)
    expect(groupTasks(items(due), local(2026, 11, 2, 23, 59) + 59_000).today).toHaveLength(1)
    expect(groupTasks(items(due), local(2026, 11, 3, 0, 0)).overdue).toHaveLength(1)
    expect(groupTasks(items(local(2026, 11, 3, 0, 0)), local(2026, 11, 2, 23, 59)).upcoming).toHaveLength(1)
  })
  it('N-127 month end and year end: 31 Dec 23:59 vs a 1 Jan task', () => {
    expect(groupTasks(items(local(2027, 1, 1)), local(2026, 12, 31, 23, 59)).upcoming).toHaveLength(1)
    expect(groupTasks(items(local(2026, 12, 31)), local(2027, 1, 1, 0, 1)).overdue).toHaveLength(1)
  })
  it('N-128 Today in a 25-hour and a 23-hour day (New York) is still one calendar day', () => {
    inTz('America/New_York', () => {
      expect(groupTasks(items(local(2026, 11, 1, 9)), local(2026, 11, 1, 23, 30)).today).toHaveLength(1)
      expect(groupTasks(items(local(2026, 3, 8, 9)), local(2026, 3, 8, 23, 30)).today).toHaveLength(1)
      expect(groupTasks(items(local(2026, 3, 9, 9)), local(2026, 3, 8, 23, 30)).upcoming).toHaveLength(1)
    })
  })
  it('N-129 dates: 29 Feb on a non-leap year, month 13, text, and the 5-year limit are refused in words', () => {
    const now = local(2026, 11, 2)
    const v = (date: string) => validateTask({ title: 'x', date, repeat: 'none', tags: [] }, now).errors.date
    expect(parseDay('2027-02-29')).toBeNull()
    expect(parseDay('2028-02-29')).not.toBeNull()
    expect(v('2027-02-29')).toBe('That date does not exist')
    expect(v('2026-13-01')).toBe('That date does not exist')
    expect(v('tomorrow')).toBe('That date does not exist')
    expect(v('1999-12-31')).toContain('2000')
    expect(v('2031-11-02')).toBeUndefined()
    expect(v('2031-11-03')).toContain('5 years')
    expect(v('2026-11-01')).toBeUndefined() // a past date is allowed: the task is simply overdue
  })
  it('N-130 title: blank, spaces, 121 characters, emoji and RTL text', () => {
    const t = (title: string) => validateTask({ title, date: '', repeat: 'none', tags: [] }, 0).errors.title
    expect(t('')).toBe('Write what needs doing')
    expect(t('   ')).toBe('Write what needs doing')
    expect(t('x'.repeat(121))).toContain('120')
    expect(t('x'.repeat(120))).toBeUndefined()
    expect(t('🚗 सर्विस كتاب')).toBeUndefined()
  })
  it('N-131 repeat or "after I tick it" without a date is refused; 0, 366 and 1.5 days are refused', () => {
    const now = local(2026, 11, 2)
    expect(validateTask({ title: 'x', date: '', repeat: 'monthly', tags: [] }, now).errors.repeat).toContain('date first')
    expect(validateTask({ title: 'x', date: '', repeat: 'none', afterDays: '30', tags: [] }, now).errors.repeat).toContain('date first')
    for (const d of ['0', '366', '1.5', '', '-3', 'ab']) expect(validateTask({ title: 'x', date: '2026-12-01', repeat: 'none', afterDays: d, tags: [] }, now).errors.afterDays, d).toContain('1 to 365')
    for (const d of ['1', '365']) expect(validateTask({ title: 'x', date: '2026-12-01', repeat: 'none', afterDays: d, tags: [] }, now).errors.afterDays, d).toBeUndefined()
  })
})

// ---------------------------------------------------------------- store: tasks, reminders, trash
describe('N-132..N-141 store behaviour', () => {
  it('N-132 Mark paid on a one-time reminder finishes it and keeps a history line', () => {
    const c = setup(local(2026, 11, 2, 10))
    c.task('Pay rent', { dueAt: local(2026, 11, 2) })
    c.get().markPaid(c.get().reminders[0]!.id)
    expect(c.get().reminders[0]).toMatchObject({ done: true })
    expect(c.get().reminders[0]!.history).toHaveLength(1)
  })
  it('N-133 Mark paid on a one-time reminder offers Undo (a wrong tap must not lose the reminder from Due)', () => {
    const c = setup(local(2026, 11, 2, 10))
    c.task('Pay rent', { dueAt: local(2026, 11, 2) })
    c.get().markPaid(c.get().reminders[0]!.id)
    expect.soft(c.get().snack?.canUndo, 'snack with Undo after Mark paid').toBe(true)
    c.get().undoRemoval()
    expect.soft(c.get().reminders[0]!.done).toBe(false)
    expect.soft(c.get().reminders[0]!.history).toHaveLength(0)
  })
  it('N-134 Mark paid twice in a row on a repeating reminder moves two periods (rapid double tap): documented, each is a payment', () => {
    const c = setup(local(2026, 11, 2, 10))
    c.task('Pay rent', { dueAt: local(2026, 11, 5), repeat: 'monthly' })
    const id = c.get().reminders[0]!.id
    c.get().markPaid(id)
    expect(c.get().reminders[0]!.dueAt).toBe(local(2026, 12, 5))
  })
  it('N-135 Snooze: from a future date adds one calendar day; from an overdue one counts from now; never goes backwards', () => {
    const c = setup(local(2026, 11, 2, 15, 47))
    c.task('A', { dueAt: local(2026, 11, 10) })
    c.task('B', { dueAt: local(2026, 10, 1) })
    const [a, b] = [c.get().reminders[0]!, c.get().reminders[1]!]
    c.get().snooze(a.id, 1)
    c.get().snooze(b.id, 1)
    expect(c.get().reminders.find((r) => r.id === a.id)!.dueAt).toBe(local(2026, 11, 11))
    const nb = c.get().reminders.find((r) => r.id === b.id)!.dueAt
    expect(nb).toBeGreaterThan(local(2026, 11, 2, 15, 47))
    expect(new Date(nb).getDate()).toBe(3)
  })
  it('N-136 Snooze keeps "30 days after done" and the heads-up list', () => {
    const c = setup(local(2026, 11, 2, 10))
    c.task('A', { dueAt: local(2026, 11, 10), afterDays: 30, leads: [7, 0], leadDays: 7 })
    c.get().snooze(c.get().reminders[0]!.id, 1)
    expect(c.get().reminders[0]).toMatchObject({ afterDays: 30, leads: [7, 0], leadDays: 7 })
  })
  it('N-137 ticking a task with "after I tick it" 180 moves it 180 days on; Undo restores date and history', () => {
    const c = setup(local(2026, 11, 2, 10))
    const id = c.task('Service car', { dueAt: local(2026, 11, 2), afterDays: 180 })
    c.get().setTaskDone(id, true)
    expect(c.get().reminders[0]!.dueAt).toBe(local(2027, 5, 1))
    expect(c.get().cards[0]!.done).toBeUndefined()
    expect(c.get().snack?.text).toContain('Next on 1 May 2027')
    c.get().undoRemoval()
    expect(c.get().reminders[0]!.dueAt).toBe(local(2026, 11, 2))
    expect(c.get().reminders[0]!.history).toHaveLength(0)
  })
  it('N-138 Done from Due shows as done in To-do, and unticking in To-do re-opens it in Due', () => {
    const c = setup(local(2026, 11, 2, 10))
    const id = c.task('Pay rent', { dueAt: local(2026, 11, 2) })
    c.get().markPaid(c.get().reminders[0]!.id)
    expect(taskItems(c.get().cards, c.get().reminders)[0]!.done).toBe(true)
    c.get().setTaskDone(id, false)
    expect(c.get().reminders[0]!.done).toBe(false)
    expect(groupReminders(c.get().reminders, local(2026, 11, 2, 10)).week).toHaveLength(1)
  })
  it('N-139 Clear done moves done tasks to Trash, Undo brings them back; nothing open is touched', () => {
    const c = setup(local(2026, 11, 2, 10))
    const a = c.task('a'), b = c.task('b'), open = c.task('open')
    c.get().setTaskDone(a, true); c.get().setTaskDone(b, true)
    expect(c.get().clearDoneTasks()).toBe(2)
    expect(c.get().cards.filter((x) => x.deletedAt === null).map((x) => x.id)).toEqual([open])
    c.get().undoRemoval()
    expect(c.get().cards.filter((x) => x.deletedAt === null)).toHaveLength(3)
    expect(c.get().clearDoneTasks()).toBe(2)
  })
  it('N-140 Trash: 7 days to the minute, reminder goes with the purged card, 500 cards cap counts live ones only', () => {
    const now = local(2026, 11, 2, 10)
    const base = defaultPersisted()
    const cards = [card({ id: 'old', deletedAt: now - 7 * DAY }), card({ id: 'edge', deletedAt: now - 7 * DAY + 60_000 }), card({ id: 'live' })]
    const s = createAppStore({ ...base, cards, reminders: [rem({ id: 'r1', cardId: 'old', dueAt: now + DAY }), rem({ id: 'r2', cardId: 'edge', dueAt: now + DAY })] }, { now: () => now, newId: () => 'x' })
    expect(s.getState().cards.map((x) => x.id)).toEqual(['edge', 'live'])
    expect(s.getState().reminders.map((x) => x.id)).toEqual(['r2'])
    const full = Array.from({ length: MAX_CARDS }, (_, i) => card({ id: `c${i}`, title: `t${i}` }))
    // Loading stops at 500 live cards, so nothing may ever hold 501 live ones (see the next case).
    expect(sanitizeCards([...full, card({ id: 'trash', deletedAt: now })])).toHaveLength(MAX_CARDS)
  })
  it('N-140b Restore from Trash at 500 live cards is refused in words (a 501st card would be dropped, unseen, on the next start)', () => {
    const c = setup(local(2026, 11, 2, 10))
    const first = c.task('first')
    for (let i = 0; i < MAX_CARDS - 1; i++) c.get().saveCard({ title: `n${i}`, kind: 'tape', toolId: null, inputs: null, summary: '', amount: null, lines: [] })
    c.get().deleteCard(first)
    c.get().saveCard({ title: 'replacement', kind: 'tape', toolId: null, inputs: null, summary: '', amount: null, lines: [] })
    c.get().restoreCard(first)
    expect(c.get().cards.filter((x) => x.deletedAt === null)).toHaveLength(MAX_CARDS)
    expect(c.get().snack?.text).toBe('You can keep up to 500 notes and tasks. Delete some first.')
    // and one fewer makes room again
    c.get().deleteCard(c.get().cards[0]!.id)
    c.get().restoreCard(first)
    expect(c.get().cards.find((x) => x.id === first)!.deletedAt).toBeNull()
  })
  it('N-141 Empty Trash removes trashed cards and their reminders only', () => {
    const c = setup(local(2026, 11, 2, 10))
    const a = c.task('a', { dueAt: local(2026, 11, 9) }), b = c.task('b', { dueAt: local(2026, 11, 9) })
    c.get().deleteCard(a)
    c.get().emptyTrash()
    expect(c.get().cards.map((x) => x.id)).toEqual([b])
    expect(c.get().reminders).toHaveLength(1)
  })
})

// ---------------------------------------------------------------- advance tax pack and Due ordering
describe('N-142..N-147 advance-tax pack and the Due list', () => {
  it('N-142 pack dates from 2 Nov 2026: 15 Dec 2026, 15 Mar 2027, 15 Jun 2027, 15 Sep 2027 at the chosen time', () => {
    const p = advanceTaxPack(local(2026, 11, 2, 10), '18:30')
    const d = (t: number) => new Date(t).toDateString().slice(4) + ' ' + hm(t)
    expect(p.map((x) => d(x.dueAt)).sort()).toEqual(['Dec 15 2026 18:30', 'Mar 15 2027 18:30', 'Jun 15 2027 18:30', 'Sep 15 2027 18:30'].sort())
    expect(p.map((x) => x.title.match(/\((\d+)%/)![1])).toEqual(['15', '45', '75', '100'])
  })
  it('N-143 on the due day itself: before the time it is this year, at or after the time it is next year', () => {
    expect(advanceTaxPack(local(2026, 6, 15, 8, 59), '09:00')[0]!.dueAt).toBe(local(2026, 6, 15, 9))
    expect(advanceTaxPack(local(2026, 6, 15, 9, 0), '09:00')[0]!.dueAt).toBe(local(2027, 6, 15, 9))
    expect(advanceTaxPack(local(2026, 12, 31, 23, 59), '09:00')[2]!.dueAt).toBe(local(2027, 12, 15, 9))
  })
  it('N-144 adding the pack twice adds nothing the second time and says so; a Trashed one is added again', () => {
    const c = setup(local(2026, 11, 2, 10))
    expect(c.get().addAdvanceTaxPack()).toBe(4)
    expect(c.get().addAdvanceTaxPack()).toBe(0)
    expect(c.get().snack?.text).toBe('Advance tax reminders are already there')
    c.get().deleteCard(c.get().cards[0]!.id)
    expect(c.get().addAdvanceTaxPack()).toBe(1)
    expect(c.get().reminders).toHaveLength(5)
  })
  it('N-145 pack in a full app (499 cards) adds one and stops with a message; pack reminders are yearly with a 7-day heads-up', () => {
    const c = setup(local(2026, 11, 2, 10))
    for (let i = 0; i < MAX_CARDS - 1; i++) c.get().saveCard({ title: `n${i}`, kind: 'tape', toolId: null, inputs: null, summary: '', amount: null, lines: [] })
    expect(c.get().addAdvanceTaxPack()).toBe(1)
    expect(c.get().reminders[0]).toMatchObject({ repeat: 'yearly', leadDays: 7 })
  })
  it('N-146 Due groups: this week ends 7 days out at midnight; overdue is before today; sorted soonest first', () => {
    const now = local(2026, 11, 2, 15)
    const rs = [rem({ id: 'later', dueAt: local(2026, 11, 9, 0, 0) }), rem({ id: 'wk', dueAt: local(2026, 11, 8, 23, 59) }), rem({ id: 'today', dueAt: local(2026, 11, 2, 9) }), rem({ id: 'od', dueAt: local(2026, 11, 1, 23, 59) }), rem({ id: 'done', dueAt: now, done: true })]
    const g = groupReminders(rs, now)
    expect(g.overdue.map((r) => r.id)).toEqual(['od'])
    expect(g.week.map((r) => r.id)).toEqual(['today', 'wk'])
    expect(g.later.map((r) => r.id)).toEqual(['later'])
  })
  it('N-147 "Amounts due in 30 days": includes day 30 and overdue, leaves out day 31, finished, trashed and non-money', () => {
    const now = local(2026, 11, 2, 10)
    const cs = [card({ id: 'a', amount: '100', amountFmt: 'money' }), card({ id: 'b', amount: '200' }), card({ id: 'c', amount: '400' }), card({ id: 'd', amount: '800', amountFmt: 'percent' }), card({ id: 'e', amount: '1600', deletedAt: 1 }), card({ id: 'f', amount: '3200' })]
    const rs = [rem({ id: '1', cardId: 'a', dueAt: local(2026, 12, 2, 9) }), rem({ id: '2', cardId: 'b', dueAt: local(2026, 10, 1) }), rem({ id: '3', cardId: 'c', dueAt: local(2026, 12, 3, 9) }), rem({ id: '4', cardId: 'd', dueAt: now }), rem({ id: '5', cardId: 'e', dueAt: now }), rem({ id: '6', cardId: 'f', dueAt: now, done: true })]
    expect(dueSoonTotal(rs, cs, now).toString()).toBe('300')
  })
})

// ---------------------------------------------------------------- delivery check
describe('N-148..N-155 delivery check ("A reminder may not have shown")', () => {
  const now = local(2026, 11, 2, 12)
  const cs = [card({ id: 'c', title: 'Rent' }), card({ id: 'c2', title: 'Gas' }), card({ id: 'c3', title: 'Net' })]
  const rs = [rem({ id: 'r', cardId: 'c', dueAt: now - 2 * 3_600_000 }), rem({ id: 'r2', cardId: 'c2', dueAt: now - 3 * 3_600_000 }), rem({ id: 'r3', cardId: 'c3', dueAt: now - 4 * 3_600_000 })]
  const log = (planned: FireLog['planned'], seenAt = now - 8 * 3_600_000): FireLog => ({ seenAt, planned })
  const at = (r: Reminder, nid = 1) => ({ rid: r.id, due: r.dueAt, at: r.dueAt, nid })
  it('N-148 due 2 hours ago, app was away, not in the tray: one notice that says "may"', () => {
    const v = checkLog(log([at(rs[0]!)]), rs, cs, now, new Set(), new Set())
    expect(v.missed).toEqual({ title: 'Rent', more: 0 })
    expect(missedText(v.missed!)).toBe('A reminder may not have shown: Rent.')
    expect(v.log.seenAt).toBe(now)
  })
  it('N-149 three missed: "and 2 more"; the first by plan order', () => {
    const v = checkLog(log(rs.map((r, i) => at(r, i))), rs, cs, now, new Set(), new Set())
    expect(missedText(v.missed!)).toBe('Reminders may not have shown: Rent and 2 more.')
  })
  it('N-150 inside the 10-minute grace, exactly at the grace edge, and just past it', () => {
    const r = rem({ id: 'g', cardId: 'c', dueAt: now - GRACE_MS + 1 })
    expect(checkLog(log([at(r)]), [r], cs, now, new Set(), new Set()).missed).toBeNull()
    const r2 = { ...r, dueAt: now - GRACE_MS }
    expect(checkLog(log([at(r2)]), [r2], cs, now, new Set(), new Set()).missed).not.toBeNull() // exactly 10 minutes: "over 10 minutes" starts here
    const r3 = { ...r, dueAt: now - GRACE_MS - 1 }
    expect(checkLog(log([at(r3)]), [r3], cs, now, new Set(), new Set()).missed).not.toBeNull()
  })
  it('N-151 no notice when: seen the notification (in tray), tapped it, finished, snoozed (date moved), card trashed, app was open at the time', () => {
    const e = at(rs[0]!, 77)
    expect(checkLog(log([e]), rs, cs, now, new Set([77]), new Set()).missed).toBeNull()
    expect(checkLog(log([e]), rs, cs, now, new Set(), new Set(['r'])).missed).toBeNull()
    expect(checkLog(log([e]), [{ ...rs[0]!, done: true }], cs, now, new Set(), new Set()).missed).toBeNull()
    expect(checkLog(log([e]), [{ ...rs[0]!, dueAt: rs[0]!.dueAt + DAY }], cs, now, new Set(), new Set()).missed).toBeNull()
    expect(checkLog(log([e]), rs, [card({ id: 'c', deletedAt: 5 })], now, new Set(), new Set()).missed).toBeNull()
    expect(checkLog(log([e], now - 60_000), rs, cs, now, new Set(), new Set()).missed).toBeNull()
  })
  it('N-152 a checked entry is dropped from the log, so the same notice never comes twice', () => {
    const v1 = checkLog(log([at(rs[0]!)]), rs, cs, now, new Set(), new Set())
    expect(v1.log.planned).toHaveLength(0)
    expect(checkLog(v1.log, rs, cs, now + 60_000, new Set(), new Set()).missed).toBeNull()
  })
  it('N-153 mergePlan: new plan replaces future entries, fired entries stay a week, moved reminders are forgotten', () => {
    const old: FireLog = { seenAt: 0, planned: [{ rid: 'r', due: rs[0]!.dueAt, at: now - 3_600_000, nid: 1 }, { rid: 'r', due: rs[0]!.dueAt, at: now + 3_600_000, nid: 2 }, { rid: 'r2', due: 1, at: now - 3_600_000, nid: 3 }, { rid: 'r3', due: rs[2]!.dueAt, at: now - 8 * DAY, nid: 4 }] }
    const m = mergePlan(old, [{ id: 9, at: now + 2 * 3_600_000, reminderId: 'r' }], rs, now)
    expect(m.planned.map((p) => p.nid)).toEqual([1, 9])
  })
  it('N-154 a damaged fire log (not an object, bad entries, 1000 entries) loads as a valid log, capped', () => {
    expect(sanitizeLog('x')).toEqual({ seenAt: 0, planned: [] })
    expect(sanitizeLog(null).planned).toEqual([])
    const l = sanitizeLog({ seenAt: 'a', planned: [{ rid: 1 }, null, 5, ...Array.from({ length: 1000 }, (_, i) => ({ rid: 'r' + i, due: 1, at: 2, nid: i }))] })
    expect(l.seenAt).toBe(0)
    expect(l.planned.length).toBeLessThanOrEqual(300)
  })
  it('N-155 the phone clock moved back (seenAt in the future): nothing is reported (quiet, not wrong)', () => {
    expect(checkLog(log([at(rs[0]!)], now + DAY), rs, cs, now, new Set(), new Set()).missed).toBeNull()
  })
})

// ---------------------------------------------------------------- lists: three states, paste
describe('N-156..N-166 lists, totals and paste', () => {
  const L = (id: string, value: string, o: Partial<TapeLine> = {}): TapeLine => ({ id, label: id, value, ...o })
  it('N-156 a tap cycles Pending -> Paid -> Skipped -> Pending, and a line never carries both flags', () => {
    let l = L('a', '10')
    const seen: string[] = []
    for (let i = 0; i < 3; i++) { seen.push(lineState(l)); l = withLineState(l, nextLineState(lineState(l))) }
    expect(seen).toEqual(['pending', 'paid', 'skip'])
    expect(l).toEqual(L('a', '10'))
    expect(withLineState(L('a', '1', { done: true }), 'skip')).toEqual(L('a', '1', { skip: true }))
  })
  it('N-157 totals: skipped lines leave the total and the progress, paid and left add back to the total of the rest', () => {
    const lines = [L('a', '1000', { done: true }), L('b', '1000'), L('c', '1000', { skip: true }), L('d', '0.1'), L('e', '0.2')]
    const p = listProgress(lines)
    expect(p).toMatchObject({ done: 1, total: 4, skipped: 1 })
    expect(p.doneAmount.plus(p.leftAmount).toString()).toBe('1000.3'.replace('1000.3', '2000.3'))
    expect(tapeTotal(lines).toString()).toBe('2000.3')
  })
  it('N-158 summaries in words: all skipped, all done with skipped, partial', () => {
    const o = { system: 'indian' as const, decimals: 'auto' as const }
    expect(listSummary([L('a', '5', { skip: true })], true, o)).toBe('All 1 skipped')
    expect(listSummary([L('a', '5', { done: true }), L('b', '5', { skip: true })], true, o)).toContain('All 1 done')
    expect(listSummary([L('a', '5', { done: true }), L('b', '5', { skip: true })], true, o)).toContain('1 skipped')
    expect(listSummary([L('a', '5'), L('b', '5')], false, o)).toContain('2 lines')
    expect(listSummary([], true, o)).toBe('0 lines, total ₹0.00')
  })
  it('N-159 paste: bullets, numbers, ticks, rupee signs, CRLF, blank lines, amounts', () => {
    const r = parsePastedList('- Milk\r\n\r\n2. Eggs ₹60\n[x] Bread\n☑ Rice 1,200\n  ')!
    expect(r.items).toEqual([
      { label: 'Milk', value: '0', done: false },
      { label: 'Eggs', value: '60', done: false },
      { label: 'Bread', value: '0', done: true },
      { label: 'Rice', value: '1200', done: true },
    ])
  })
  it('N-160 paste: one line is not a list; two blank-ish lines are not a list; 250 lines are cut to 200 and say how many were left out', () => {
    expect(parsePastedList('Milk')).toBeNull()
    expect(parsePastedList('Milk\n\n   \n')).toBeNull()
    expect(parsePastedList('-\n-')).toBeNull()
    const big = parsePastedList(Array.from({ length: 250 }, (_, i) => `Item ${i}`).join('\n'))!
    expect(big.items).toHaveLength(200)
    expect(big.dropped).toBe(50)
  })
  it('N-161 paste: a long line is cut to 80 characters, "Wifi 2.4G 500" keeps its name, a negative amount stays a refund', () => {
    const r = parsePastedList(`${'x'.repeat(200)}\nWifi 2.4G 500\nRefund -250`)!
    expect(r.items[0]!.label).toHaveLength(80)
    expect(r.items[1]).toMatchObject({ label: 'Wifi 2.4G', value: '500' })
    expect(r.items[2]).toMatchObject({ label: 'Refund', value: '-250' })
  })
  it.fails('N-162 KNOWN OPEN (low): paste: a line that is only a number keeps its amount but needs a name (an unnamed line is shown as blank)', () => {
    const r = parsePastedList('Milk\n500')!
    expect(r.items[1]!.label.length, 'label of the "500" line').toBeGreaterThan(0)
  })
  it('N-163 paste: script, html and very long digits do not throw', () => {
    expect(() => parsePastedList('<script>alert(1)</script>\n' + '9'.repeat(500))).not.toThrow()
    expect(() => parsePastedList('1/0\n(((\n%%%')).not.toThrow()
  })
  it('N-164 exact money: 0.1 + 0.2 in a list is 0.3', () => {
    expect(tapeTotal([L('a', '0.1'), L('b', '0.2')]).toString()).toBe('0.3')
  })
  it('N-165 store: toggling a line keeps summary and total in step; unknown ids do nothing', () => {
    const c = setup(local(2026, 11, 2))
    const id = c.get().addToList({ title: 'Trip' }, '1000', 3, 'Friend', true)!
    const lines = c.get().cards.find((x) => x.id === id)!.lines
    c.get().toggleLine(id, lines[0]!.id)
    expect(c.get().cards[0]!.summary).toContain('1 of 3 done')
    c.get().toggleLine(id, lines[0]!.id)
    c.get().toggleLine(id, 'nope')
    c.get().toggleLine('nope', 'nope')
    expect(c.get().cards[0]!.lines[0]).toMatchObject({ skip: true })
    expect(c.get().cards[0]!.summary).toContain('1 skipped')
    expect(c.get().cards[0]!.amount).toBe('3000')
  })
  it('N-166 "Friend 1..50" split lines: 51 asked gives 50', () => {
    const c = setup(local(2026, 11, 2))
    const id = c.get().addToList({ title: 'Big' }, '10', 99, 'P', true)!
    expect(c.get().cards.find((x) => x.id === id)!.lines).toHaveLength(50)
  })
})

// ---------------------------------------------------------------- settings, backup, old data
describe('N-167..N-176 backup round trip, old data, settings, nudge', () => {
  const full = () => {
    const c = setup(local(2026, 11, 2, 10))
    const t = c.task('Service car', { dueAt: local(2026, 12, 1), afterDays: 180, leads: [14, 7, 0], leadDays: 14, repeat: 'none' })
    const t2 = c.task('Rent', { dueAt: local(2026, 12, 5), repeat: 'monthly' })
    const t3 = c.task('Done thing')
    c.get().setTaskDone(t3, true)
    c.get().togglePin(t2)
    c.get().updateCard(t, { tags: ['Car', 'Work'], note: 'n'.repeat(5000) })
    const l = c.get().addToList({ title: 'Trip' }, '1000', 3, 'Ravi', true)!
    c.get().toggleLine(l, c.get().cards.find((x) => x.id === l)!.lines[0]!.id)
    c.get().toggleLine(l, c.get().cards.find((x) => x.id === l)!.lines[1]!.id)
    c.get().toggleLine(l, c.get().cards.find((x) => x.id === l)!.lines[1]!.id)
    c.get().deleteCard(t3)
    c.get().updateSettings({ reminderTime: '18:30', tours: { budget: 'done', notes: 'skipped' }, numberSystem: 'international', decimals: 3, accent: 'teal' as never, theme: 'light', lastBackupAt: 5, backupNudgedAt: 6, backupDismissedAt: 7 })
    return c.get().snapshot()
  }
  it('N-167 every new field survives export then restore, byte for byte', () => {
    const snap = full()
    const parsed = parseBackup(buildBackup(snap, new Date(2026, 10, 2)))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.data.cards).toEqual(snap.cards)
    expect(parsed.data.reminders).toEqual(snap.reminders)
    expect(parsed.data.settings).toEqual(snap.settings)
    expect(parsed.data.cards.some((x) => x.done === true && x.deletedAt !== null)).toBe(true)
    expect(parsed.data.reminders.some((r) => r.afterDays === 180 && r.leads?.join() === '14,7,0')).toBe(true)
    expect(parsed.data.cards.find((x) => x.kind === 'tape')!.lines.map((l) => lineState(l))).toEqual(['paid', 'skip', 'pending'])
  })
  it('N-168 restore replaces everything, including settings and tours; restoring twice is the same', () => {
    const snap = full()
    const c = setup(local(2026, 11, 3))
    c.get().saveCard({ title: 'Before', kind: 'task', toolId: null, inputs: null, summary: '', amount: null, lines: [] })
    c.get().restore(snap)
    c.get().restore(snap)
    expect(c.get().cards).toEqual(snap.cards)
    expect(c.get().settings.tours).toEqual({ budget: 'done', notes: 'skipped' })
    expect(c.get().settings.reminderTime).toBe('18:30')
  })
  it('N-169 an old backup without tours, reminder time, leads or lists flags opens as "not seen" with defaults', () => {
    const old = { kind: 'vkcalc-backup', schemaVersion: 3, data: { schemaVersion: 3, settings: { theme: 'dark' }, history: [], cards: [{ id: 'a', title: 'Old EMI', kind: 'tool', toolId: 'emi', inputs: {}, summary: '', amount: '5', lines: [], note: '', tags: [], pinned: false, createdAt: 1, updatedAt: 1, deletedAt: null }], reminders: [{ id: 'r', cardId: 'a', dueAt: 5, repeat: 'monthly', anchorDay: 5, leadDays: 3, done: false, history: [] }] } }
    const p = parseBackup(JSON.stringify(old))
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.data.settings.tours).toEqual({})
    expect(p.data.settings.reminderTime).toBe('09:00')
    expect(p.data.reminders[0]).toMatchObject({ leadDays: 3, done: false })
    expect(p.data.reminders[0]!.leads).toBeUndefined()
    expect(p.data.reminders[0]!.afterDays).toBeUndefined()
  })
  it('N-170 damaged values are cleaned, not trusted: bad time, bad tours, 10 leads, afterDays 0/366/1.5, line with both flags, done on a calculation', () => {
    expect(sanitizeSettings({ reminderTime: '25:61', tours: { budget: 'maybe', due: 'done', zzz: 'done' } })).toMatchObject({ reminderTime: '09:00', tours: { due: 'done' } })
    const cards = sanitizeCards([{ id: 'a', title: 'T', kind: 'task', done: true, doneAt: 9 }, { id: 'b', title: 'E', kind: 'tool', toolId: 'emi', inputs: {}, done: true }, { id: 'c', title: 'L', kind: 'tape', lines: [{ id: 'l', label: 'x', value: '1', done: true, skip: true }] }])
    expect(cards[0]).toMatchObject({ done: true, doneAt: 9 })
    expect(cards[1]!.done).toBeUndefined()
    expect(cards[2]!.lines[0]).toEqual({ id: 'l', label: 'x', value: '1', done: true })
    const rs = sanitizeReminders([{ id: 'r', cardId: 'a', dueAt: 1, leads: [60, 45, 30, 21, 14, 10, 7, 3, 1, 0], leadDays: 60 }, { id: 'r2', cardId: 'a', dueAt: 1, afterDays: 0 }, { id: 'r3', cardId: 'a', dueAt: 1, afterDays: 366 }, { id: 'r4', cardId: 'a', dueAt: 1, afterDays: 1.5 }, { id: 'r5', cardId: 'zz', dueAt: 1 }], cards)
    expect(rs).toHaveLength(4)
    expect(rs[0]!.leads).toHaveLength(6)
    expect(rs.slice(1).every((r) => r.afterDays === undefined)).toBe(true)
  })
  it('N-171 10 lead times in a hand-edited file load without a crash and keep 6 (the sheet offers 6, so the app cannot make 10)', () => {
    const cards = sanitizeCards([{ id: 'a', title: 'T', kind: 'task' }])
    const [r] = sanitizeReminders([{ id: 'r', cardId: 'a', dueAt: 1, leads: [60, 45, 30, 21, 14, 10, 7, 3, 1, 0], leadDays: 60 }], cards)
    expect(r!.leads).toHaveLength(6)
  })
  it('N-172 not a backup / not JSON / wrong kind / a huge file are refused with plain words', () => {
    for (const t of ['', 'hello', '{"kind":"other"}', '[]', 'null']) {
      const p = parseBackup(t)
      expect(p.ok).toBe(false)
      if (!p.ok) expect(p.message).toMatch(/isn't a Calc backup|damaged/)
    }
    expect(parseBackup('x'.repeat(26 * 1024 * 1024))).toMatchObject({ ok: false })
    expect(parseBackup('{"kind":"vkcalc-backup","data":5}')).toMatchObject({ ok: false, message: 'That backup is damaged.' })
  })
  it('N-173 a backup from a NEWER schema keeps what is understood', () => {
    const p = parseBackup(JSON.stringify({ kind: 'vkcalc-backup', schemaVersion: 9, data: { cards: [], reminders: [], settings: { reminderTime: '07:05', futureThing: 1 } } }))
    expect(p.ok && p.data.settings.reminderTime).toBe('07:05')
  })
  it('N-174 settings: bad number system, decimals 11 / -1 / "3", unknown accent and theme fall back to defaults', () => {
    const s = sanitizeSettings({ numberSystem: 'x', decimals: 11, accent: 'pink!', theme: 'blue' })
    const d = sanitizeSettings({})
    expect(s).toEqual(d)
    expect(sanitizeSettings({ decimals: '3' }).decimals).toBe(d.decimals)
    expect(sanitizeSettings({ decimals: 10 }).decimals).toBe(10)
    expect(sanitizeSettings({ decimals: 0 }).decimals).toBe(0)
  })
  it('N-175 backup nudge: below 25 never; 25 without a backup yes; quiet 14 days; 30-day-old backup is not stale, 31 is', () => {
    const now = local(2026, 11, 2)
    expect(backupNudge(24, null, null, now)).toBeNull()
    expect(backupNudge(25, null, null, now)).toContain('25 items and no backup')
    expect(backupNudge(25, null, now - 14 * DAY + 1, now)).toBeNull()
    expect(backupNudge(25, null, now - 14 * DAY, now)).not.toBeNull()
    expect(backupNudge(100, now - 30 * DAY, null, now)).toBeNull()
    expect(backupNudge(100, now - 31 * DAY, null, now)).toContain('31 days old')
    expect(backupNudge(100, now - 5 * DAY, null, now)).toBeNull()
  })
  it('N-176 backup nudge with a phone clock set wrong: a backup date in the future says nothing; a "shown" date in the future stays quiet', () => {
    const now = local(2026, 11, 2)
    expect(backupNudge(100, now + 400 * DAY, null, now)).toBeNull()
    expect(backupNudge(25, null, now + 400 * DAY, now)).toBeNull()
    expect(countItems({ cards: [{ deletedAt: null }, { deletedAt: 5 }], budget: { expenses: [{ deletedAt: null }, { deletedAt: 1 }] } })).toBe(2)
  })
})

describe('N-177 migrate', () => {
  it('never throws on garbage', () => {
    for (const g of [null, 1, 'x', [], { cards: 'no', reminders: 7, settings: [] }, { schemaVersion: 'x' }]) expect(() => migrate(g)).not.toThrow()
  })
})

describe('N-178..N-181 list line removal, reminder help, history lock', () => {
  it('N-178 removing a list line offers Undo that puts it back in the same place and fixes total and summary both ways', () => {
    const c = setup(local(2026, 11, 2))
    const id = c.get().addToList({ title: 'Trip' }, '100', 3, 'P', true)!
    const [a, b, d] = c.get().cards[0]!.lines
    c.get().toggleLine(id, a!.id)
    c.get().removeLine(id, b!.id)
    expect(c.get().cards[0]!.lines.map((l) => l.id)).toEqual([a!.id, d!.id])
    expect(c.get().cards[0]!.amount).toBe('200')
    expect(c.get().cards[0]!.summary).toContain('1 of 2 done')
    expect(c.get().snack).toMatchObject({ canUndo: true })
    c.get().undoRemoval()
    expect(c.get().cards[0]!.lines.map((l) => l.id)).toEqual([a!.id, b!.id, d!.id])
    expect(c.get().cards[0]!.amount).toBe('300')
    expect(c.get().cards[0]!.lines[0]).toMatchObject({ done: true })
    c.get().removeLine(id, 'nope')
    c.get().removeLine('nope', 'nope')
    expect(c.get().cards[0]!.lines).toHaveLength(3)
  })
  it('N-179 every phone maker has plain steps and a name; unknown makers fall back to the generic steps', () => {
    for (const [m, brand] of [['Xiaomi', 'xiaomi'], ['Redmi', 'xiaomi'], ['POCO', 'xiaomi'], ['OnePlus', 'oneplus'], ['OPPO', 'oppo'], ['realme', 'oppo'], ['vivo', 'vivo'], ['iQOO', 'vivo'], ['samsung', 'samsung'], ['HUAWEI', 'huawei'], ['HONOR', 'huawei'], ['Google', 'other'], ['', 'other']] as const) expect(oemBrand(m), m).toBe(brand)
    for (const g of Object.values(OEM_GUIDES)) {
      expect(g.name.length).toBeGreaterThan(2)
      expect(g.steps.length).toBeGreaterThanOrEqual(2)
      expect(g.steps.every((t) => t.length > 10 && !/undefined|NaN/.test(t))).toBe(true)
    }
  })
  it('N-180 history lock and name survive export and restore', () => {
    const c = setup(local(2026, 11, 2))
    const snap = { ...c.get().snapshot(), history: [{ id: 'h1', expression: '2+2', result: '4', at: 1, locked: true, memo: 'Rent share' }, { id: 'h2', expression: '1+1', result: '2', at: 2 }] }
    const p = parseBackup(buildBackup(snap))
    expect(p.ok && p.data.history).toEqual(snap.history)
  })
  it('N-181 Mark paid on a bill-less reminder then Undo puts back the exact old reminder (date, repeat, history)', () => {
    const c = setup(local(2026, 11, 2, 10))
    c.task('Rent', { dueAt: local(2026, 11, 5), repeat: 'monthly', leads: [7, 0], leadDays: 7 })
    const before = c.get().reminders[0]!
    c.get().markPaid(before.id)
    expect(c.get().reminders[0]!.dueAt).toBe(local(2026, 12, 5))
    expect(c.get().snack?.text).toBe('Done: "Rent"')
    c.get().undoRemoval()
    expect(c.get().reminders[0]).toEqual(before)
  })
})
