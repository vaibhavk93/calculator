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
