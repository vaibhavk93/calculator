import { describe, expect, it } from 'vitest'
import { numericId, planNotifications } from './notifications'
import type { Reminder, SavedCard } from './memory'

const DAY = 86_400_000
const NOW = new Date(2026, 10, 10, 12).getTime()
const card = { id: 'c', title: 'HDFC card', amount: '57650', deletedAt: null } as SavedCard
const rem = (over: Partial<Reminder>): Reminder => ({ id: 'r1', cardId: 'c', dueAt: NOW + 10 * DAY, repeat: 'monthly', anchorDay: 20, leadDays: 3, done: false, history: [], ...over })
const money = (a: string) => `₹${a}`

describe('planNotifications', () => {
  it('notifies leadDays before the due time, with title, amount and when', () => {
    const [p] = planNotifications([rem({})], [card], NOW, money)
    expect(p!.at).toBe(NOW + 7 * DAY)
    expect(p!.title).toBe('HDFC card')
    expect(p!.body).toBe('₹57650 · due in 3 days')
  })
  it('formats a non-money amount as what it is, not as rupees (B-10)', () => {
    const fmt = (a: string, f?: string) => (f === 'number' ? a : `₹${a}`)
    const [p] = planNotifications([rem({})], [{ ...card, amount: '24.5', amountFmt: 'number' } as SavedCard], NOW, fmt)
    expect(p!.body).toBe('24.5 · due in 3 days')
  })
  it('if the heads-up moment has passed but the due time has not, notifies at the due time', () => {
    const [p] = planNotifications([rem({ dueAt: NOW + 2 * DAY })], [card], NOW, money)
    expect(p!.at).toBe(NOW + 2 * DAY)
  })
  it('skips overdue, finished, and trashed-card reminders', () => {
    const plan = planNotifications([rem({ id: 'a', dueAt: NOW - DAY }), rem({ id: 'b', done: true }), rem({ id: 'c2', cardId: 'gone' })], [card], NOW, money)
    expect(plan).toEqual([])
    expect(planNotifications([rem({})], [{ ...card, deletedAt: 1 }], NOW, money)).toEqual([])
  })
  it('a card with no amount still gets a clear message', () => {
    const [p] = planNotifications([rem({})], [{ ...card, amount: null }], NOW, money)
    expect(p!.body).toBe('due in 3 days')
  })
})

describe('numericId', () => {
  it('is stable, positive, and fits a 31-bit integer', () => {
    expect(numericId('abc-123')).toBe(numericId('abc-123'))
    for (const id of ['a', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'zzzzzzzzzzzz']) {
      const n = numericId(id)
      expect(n).toBeGreaterThan(0)
      expect(n).toBeLessThanOrEqual(2 ** 31 - 1)
    }
  })
})

describe('planNotifications with a reminder time', () => {
  it('moves the notification to that time of day, for the due day and for the heads-up day', () => {
    const due = new Date(2026, 10, 20, 9).getTime()
    const [p] = planNotifications([rem({ dueAt: due })], [card], NOW, money, '18:30')
    const d = new Date(p!.at)
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([17, 18, 30])
  })
  it('a reminder due later today still notifies when the chosen time has not come yet, and is skipped once it has', () => {
    const today = new Date(2026, 10, 10, 9).getTime()
    expect(planNotifications([rem({ dueAt: today, leadDays: 0 })], [card], NOW, money, '18:00')).toHaveLength(1)
    expect(planNotifications([rem({ dueAt: today, leadDays: 0 })], [card], NOW, money, '11:00')).toHaveLength(0)
  })
})

describe('planNotifications with several lead times', () => {
  it('one notification for each heads-up time still ahead, soonest first', () => {
    const plan = planNotifications([rem({ leadDays: 7, leads: [7, 1, 0] })], [card], NOW, money)
    expect(plan.map((p) => p.at)).toEqual([NOW + 3 * DAY, NOW + 9 * DAY, NOW + 10 * DAY])
    expect(plan.map((p) => p.body)).toEqual(['₹57650 · due in 7 days', '₹57650 · due tomorrow', '₹57650 · due today'])
    // each notification has its own number, and the same reminder id
    expect(new Set(plan.map((p) => p.id)).size).toBe(3)
    expect(new Set(plan.map((p) => p.reminderId))).toEqual(new Set(['r1']))
  })
  it('a heads-up time that has passed is left out, the others stay', () => {
    const plan = planNotifications([rem({ dueAt: NOW + 3 * DAY, leadDays: 7, leads: [7, 1] })], [card], NOW, money)
    expect(plan.map((p) => p.at)).toEqual([NOW + 2 * DAY])
  })
  it('when every heads-up time has passed there is still one at the due time', () => {
    const plan = planNotifications([rem({ dueAt: NOW + 2 * DAY, leadDays: 7, leads: [7, 3] })], [card], NOW, money)
    expect(plan.map((p) => p.at)).toEqual([NOW + 2 * DAY])
  })
  it('an old reminder with only a number still gives one notification', () => {
    expect(planNotifications([rem({})], [card], NOW, money)).toHaveLength(1)
  })
  it('with a reminder time, each lands at that time on its own day', () => {
    const due = new Date(2026, 10, 20, 9).getTime()
    const plan = planNotifications([rem({ dueAt: due, leadDays: 3, leads: [3, 0] })], [card], NOW, money, '18:30')
    expect(plan.map((p) => [new Date(p.at).getDate(), new Date(p.at).getHours(), new Date(p.at).getMinutes()])).toEqual([[17, 18, 30], [20, 18, 30]])
  })
})
