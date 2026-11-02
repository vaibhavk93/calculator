import { describe, expect, it } from 'vitest'
import type { Reminder, SavedCard } from './memory'
import { groupTasks, nextOccurrence, parseDay, shortDate, taskItems, taskSummary, todayCount, validateTask, type TaskInput } from './tasks'

const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min).getTime()
const NOW = at(2026, 11, 10, 15)

const card = (id: string, over: Partial<SavedCard> = {}): SavedCard => ({
  id, title: id, kind: 'task', toolId: null, inputs: null, summary: '', amount: null, lines: [], note: '', tags: [], pinned: false, createdAt: 1, updatedAt: 1, deletedAt: null, ...over,
})
const rem = (cardId: string, dueAt: number, over: Partial<Reminder> = {}): Reminder => ({ id: `r-${cardId}`, cardId, dueAt, repeat: 'none', anchorDay: new Date(dueAt).getDate(), leadDays: 0, done: false, history: [], ...over })
const input = (over: Partial<TaskInput> = {}): TaskInput => ({ title: 'Call plumber', date: '', repeat: 'none', tags: [], ...over })

describe('validateTask', () => {
  it('needs a title, trimmed, and says so in words', () => {
    expect(validateTask(input({ title: '   ' }), NOW).errors.title).toBe('Write what needs doing')
    expect(validateTask(input({ title: '  Pay rent  ' }), NOW).title).toBe('Pay rent')
    expect(validateTask(input({ title: 'x'.repeat(121) }), NOW).errors.title).toMatch(/120/)
    expect(validateTask(input({ title: 'x'.repeat(120) }), NOW).errors).toEqual({})
  })
  it('a task needs no date; a date is 9:00 local', () => {
    expect(validateTask(input(), NOW)).toMatchObject({ errors: {}, dueAt: null })
    expect(validateTask(input({ date: '2026-12-31' }), NOW).dueAt).toBe(at(2026, 12, 31, 9))
  })
  it('refuses days that do not exist', () => {
    for (const date of ['2026-02-30', '2026-13-01', '2026-00-10', '2027-02-29', 'soon']) expect(validateTask(input({ date }), NOW).errors.date).toBe('That date does not exist')
    expect(validateTask(input({ date: '2028-02-29' }), NOW).errors.date).toBeUndefined()
  })
  it('allows past dates from 2000 on, refuses earlier ones', () => {
    expect(validateTask(input({ date: '2026-01-01' }), NOW).errors).toEqual({})
    expect(validateTask(input({ date: '2000-01-01' }), NOW).errors).toEqual({})
    expect(validateTask(input({ date: '1999-12-31' }), NOW).errors.date).toMatch(/2000/)
  })
  it('allows up to exactly 5 years ahead, not a day more', () => {
    expect(validateTask(input({ date: '2031-11-10' }), NOW).errors).toEqual({})
    expect(validateTask(input({ date: '2031-11-11' }), NOW).errors.date).toMatch(/5 years/)
  })
  it('a repeat needs a date; more than 5 tags is refused, case-insensitively', () => {
    expect(validateTask(input({ repeat: 'monthly' }), NOW).errors.repeat).toMatch(/Pick a date first/)
    expect(validateTask(input({ repeat: 'monthly', date: '2026-12-01' }), NOW).errors).toEqual({})
    expect(validateTask(input({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] }), NOW).errors.tags).toBe('5 tags is the most')
    expect(validateTask(input({ tags: ['a', 'A', 'b', 'c', 'd', 'e'] }), NOW).errors.tags).toBeUndefined()
  })
})

describe('parseDay and summaries', () => {
  it('only real calendar days', () => {
    expect(parseDay('2026-11-10')).toBe(at(2026, 11, 10))
    expect(parseDay('2026-11-31')).toBeNull()
    expect(parseDay('')).toBeNull()
  })
  it('fixed wording', () => {
    expect(shortDate(at(2026, 11, 5))).toBe('5 Nov 2026')
    expect(taskSummary(null, 'none')).toBe('No date')
    expect(taskSummary(at(2026, 11, 5), 'monthly')).toBe('Due 5 Nov 2026 · monthly')
  })
})

describe('grouping across midnight and month ends', () => {
  const build = (now: number) => {
    const cards = [card('inbox'), card('last-night'), card('today-9'), card('today-late'), card('tomorrow'), card('later'), card('done', { done: true, doneAt: 5 }), card('trashed', { deletedAt: 9 })]
    const d = new Date(now)
    const day = (n: number, h: number, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, h, m).getTime()
    const reminders = [
      rem('last-night', day(-1, 23, 59)),
      rem('today-9', day(0, 9)),
      rem('today-late', day(0, 23, 59)),
      rem('tomorrow', day(1, 0, 0)),
      rem('later', day(40, 9)),
      rem('trashed', day(0, 9)),
    ]
    return groupTasks(taskItems(cards, reminders), now)
  }
  const ids = (l: { card: SavedCard }[]) => l.map((t) => t.card.id)

  it('mid-afternoon', () => {
    const g = build(NOW)
    expect(ids(g.overdue)).toEqual(['last-night'])
    expect(ids(g.today)).toEqual(['today-9', 'today-late'])
    expect(ids(g.upcoming)).toEqual(['tomorrow', 'later'])
    expect(ids(g.inbox)).toEqual(['inbox'])
    expect(ids(g.done)).toEqual(['done'])
    expect(todayCount(g)).toBe(3)
  })
  it('23:59 is still today; 00:00 the next day it is overdue (a task at 9:00 yesterday)', () => {
    const lateNight = build(at(2026, 11, 10, 23, 59))
    expect(ids(lateNight.today)).toEqual(['today-9', 'today-late'])
    const afterMidnight = build(at(2026, 11, 11, 0, 0))
    expect(ids(afterMidnight.today)).toEqual(['today-9', 'today-late'])
  })
  it('on 30 Nov, tomorrow is 1 Dec; on 31 Dec, tomorrow is 1 Jan; on 29 Feb, tomorrow is 1 Mar', () => {
    for (const now of [at(2026, 11, 30, 10), at(2026, 12, 31, 10), at(2028, 2, 29, 10)]) {
      const g = build(now)
      expect(ids(g.today)).toEqual(['today-9', 'today-late'])
      expect(ids(g.upcoming)).toEqual(['tomorrow', 'later'])
      expect(ids(g.overdue)).toEqual(['last-night'])
    }
  })
  it('exact boundary: 23:59:00 on the 10th is today, 00:00 on the 11th is not', () => {
    const items = taskItems([card('a')], [rem('a', at(2026, 11, 10, 23, 59))])
    expect(groupTasks(items, at(2026, 11, 10, 0, 0)).today).toHaveLength(1)
    expect(groupTasks(items, at(2026, 11, 11, 0, 0)).overdue).toHaveLength(1)
  })
  it('pinned first, then soonest, then newest; undated newest first', () => {
    const cards = [card('a', { createdAt: 1 }), card('b', { createdAt: 2 }), card('c', { createdAt: 3, pinned: true })]
    const g = groupTasks(taskItems(cards, []), NOW)
    expect(ids(g.inbox)).toEqual(['c', 'b', 'a'])
  })
  it('a task finished from the Due tab (reminder done) counts as done', () => {
    const g = groupTasks(taskItems([card('a')], [rem('a', NOW, { done: true })]), NOW)
    expect(ids(g.done)).toEqual(['a'])
  })
  it('notes and calculations are never tasks', () => {
    expect(taskItems([card('t', { kind: 'tape' }), card('u', { kind: 'tool' })], [])).toEqual([])
  })
})

describe('nextOccurrence', () => {
  it('moves a monthly task one month, keeping the anchor day through short months', () => {
    const jan31 = rem('a', at(2026, 1, 31), { repeat: 'monthly', anchorDay: 31 })
    expect(nextOccurrence(jan31, at(2026, 1, 31, 10))).toBe(at(2026, 2, 28))
    expect(nextOccurrence({ ...jan31, dueAt: at(2026, 2, 28) }, at(2026, 2, 28, 10))).toBe(at(2026, 3, 31))
  })
  it('skips dates already past, so a task left for months jumps to the next future one', () => {
    const old = rem('a', at(2026, 8, 5), { repeat: 'monthly', anchorDay: 5 })
    expect(nextOccurrence(old, at(2026, 11, 10))).toBe(at(2026, 12, 5))
  })
  it('a yearly task on 29 Feb goes to 28 Feb, then back to 29 Feb', () => {
    const leap = rem('a', at(2028, 2, 29), { repeat: 'yearly', anchorDay: 29 })
    expect(nextOccurrence(leap, at(2028, 2, 29, 10))).toBe(at(2029, 2, 28))
  })
  it('a one-time task has none', () => {
    expect(nextOccurrence(rem('a', NOW), NOW)).toBeNull()
  })
})
