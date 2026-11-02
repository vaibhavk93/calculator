import { describe, expect, it } from 'vitest'
import { advance, addMonths, dueLabel, dueSoonTotal, groupReminders } from './reminders'
import type { Reminder, SavedCard } from './memory'

const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).getTime()
const rem = (over: Partial<Reminder>): Reminder => ({ id: 'r', cardId: 'c', dueAt: at(2026, 11, 5), repeat: 'monthly', anchorDay: 5, leadDays: 3, done: false, history: [], ...over })

describe('addMonths', () => {
  it('clamps to the end of a short month, then returns to the anchor day', () => {
    const feb = addMonths(at(2027, 1, 31), 1, 31)
    expect(new Date(feb).getDate()).toBe(28)
    expect(new Date(addMonths(feb, 1, 31)).getDate()).toBe(31)
  })
  it('handles leap years and year rollover, keeping the time of day', () => {
    expect(new Date(addMonths(at(2028, 1, 31), 1, 31)).getDate()).toBe(29)
    const d = new Date(addMonths(at(2026, 12, 15, 18), 1, 15))
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2027, 0, 15, 18])
  })
})

describe('advance', () => {
  it('monthly, quarterly and yearly step', () => {
    expect(new Date(advance(rem({}))!).getMonth()).toBe(11)
    expect(new Date(advance(rem({ repeat: 'quarterly' }))!).getMonth()).toBe(1)
    expect(new Date(advance(rem({ repeat: 'yearly' }))!).getFullYear()).toBe(2027)
  })
  it('a one-time reminder has no next date', () => expect(advance(rem({ repeat: 'none' }))).toBeNull())
})

describe('groupReminders', () => {
  const now = at(2026, 11, 10, 12)
  it('splits overdue, this week and later, and skips finished ones', () => {
    const g = groupReminders(
      [rem({ id: 'a', dueAt: at(2026, 11, 9) }), rem({ id: 'b', dueAt: at(2026, 11, 10, 8) }), rem({ id: 'c', dueAt: at(2026, 11, 17) }), rem({ id: 'd', dueAt: at(2026, 11, 16) }), rem({ id: 'e', dueAt: at(2026, 11, 1), done: true })],
      now,
    )
    expect(g.overdue.map((r) => r.id)).toEqual(['a'])
    expect(g.week.map((r) => r.id)).toEqual(['b', 'd'])
    expect(g.later.map((r) => r.id)).toEqual(['c'])
  })
})

describe('dueSoonTotal and dueLabel', () => {
  const card = (id: string, amount: string | null, deletedAt: number | null = null) => ({ id, amount, deletedAt }) as SavedCard
  it('adds amounts due within 30 days, ignoring far ones, finished ones and trashed cards', () => {
    const now = at(2026, 11, 10)
    const total = dueSoonTotal(
      [rem({ cardId: 'a', dueAt: at(2026, 11, 12) }), rem({ cardId: 'b', dueAt: at(2026, 12, 8) }), rem({ cardId: 'c', dueAt: at(2027, 2, 1) }), rem({ cardId: 'd', dueAt: at(2026, 11, 12), done: true }), rem({ cardId: 'e', dueAt: at(2026, 11, 12) })],
      [card('a', '57650.50'), card('b', '10000'), card('c', '999'), card('d', '5'), card('e', '7', 1)],
      now,
    )
    expect(total.toFixed()).toBe('67650.5')
  })
  it('counts a reminder due on day 30 (the list says "In 30 days") but not day 31', () => {
    const now = at(2026, 11, 2, 15)
    const total = (due: number) => dueSoonTotal([rem({ cardId: 'a', dueAt: due })], [card('a', '100')], now).toFixed()
    expect(total(at(2026, 12, 2, 9))).toBe('100')
    expect(total(at(2026, 12, 3, 9))).toBe('0')
  })
  it('labels dates in plain words', () => {
    const now = at(2026, 11, 10, 15)
    expect(dueLabel(at(2026, 11, 10, 8), now)).toBe('Today')
    expect(dueLabel(at(2026, 11, 11), now)).toBe('Tomorrow')
    expect(dueLabel(at(2026, 11, 13), now)).toBe('In 3 days')
    expect(dueLabel(at(2026, 11, 8), now)).toBe('2 days overdue')
  })
})
