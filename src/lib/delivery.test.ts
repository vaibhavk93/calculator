import { describe, expect, it } from 'vitest'
import { checkLog, GRACE_MS, mergePlan, missedText, sanitizeLog, type FireLog } from './delivery'
import type { Reminder, SavedCard } from './memory'

const MIN = 60_000
const HOUR = 60 * MIN
const T = new Date(2026, 10, 10, 9).getTime()
const card = { id: 'c', title: 'Rent', deletedAt: null } as SavedCard
const rem = (over: Partial<Reminder> = {}): Reminder => ({ id: 'r1', cardId: 'c', dueAt: T, repeat: 'none', anchorDay: 10, leadDays: 0, done: false, history: [], ...over })
const log = (over: Partial<FireLog> = {}): FireLog => ({ seenAt: T - 5 * HOUR, planned: [{ rid: 'r1', due: T, at: T, nid: 11 }], ...over })
const none = new Set<number>()
const noAck = new Set<string>()

describe('checkLog', () => {
  it('flags a reminder that came due while the app was away, more than 10 minutes ago, still open', () => {
    const v = checkLog(log(), [rem()], [card], T + 11 * MIN, none, noAck)
    expect(v.missed).toEqual({ title: 'Rent', more: 0 })
  })
  it('waits out the 10-minute grace for a late (inexact) alarm', () => {
    expect(checkLog(log(), [rem()], [card], T + GRACE_MS, none, noAck).missed).not.toBeNull()
    expect(checkLog(log(), [rem()], [card], T + GRACE_MS - 1, none, noAck).missed).toBeNull()
    // not yet checked, so it stays in the log for next time
    expect(checkLog(log(), [rem()], [card], T + 5 * MIN, none, noAck).log.planned).toHaveLength(1)
  })
  it('says nothing when the app was opened after it was due', () => {
    expect(checkLog(log({ seenAt: T + MIN }), [rem()], [card], T + HOUR, none, noAck).missed).toBeNull()
  })
  it('says nothing when it was paid, snoozed, edited or removed, or its note went to Trash', () => {
    const now = T + HOUR
    expect(checkLog(log(), [rem({ done: true })], [card], now, none, noAck).missed).toBeNull()
    expect(checkLog(log(), [rem({ dueAt: T + 86_400_000 })], [card], now, none, noAck).missed).toBeNull()
    expect(checkLog(log(), [], [card], now, none, noAck).missed).toBeNull()
    expect(checkLog(log(), [rem()], [{ ...card, deletedAt: 1 }], now, none, noAck).missed).toBeNull()
  })
  it('says nothing when the notification is still showing, or the user tapped it', () => {
    const now = T + HOUR
    expect(checkLog(log(), [rem()], [card], now, new Set([11]), noAck).missed).toBeNull()
    expect(checkLog(log(), [rem()], [card], now, none, new Set(['r1'])).missed).toBeNull()
  })
  it('counts one notice for several: the first title and how many more', () => {
    const l = log({ planned: [{ rid: 'r1', due: T, at: T, nid: 1 }, { rid: 'r2', due: T, at: T + MIN, nid: 2 }, { rid: 'r2', due: T, at: T + 2 * MIN, nid: 3 }, { rid: 'r3', due: T, at: T + 3 * MIN, nid: 4 }] })
    const rs = [rem(), rem({ id: 'r2' }), rem({ id: 'r3' })]
    const v = checkLog(l, rs, [card], T + HOUR, none, noAck)
    expect(v.missed).toEqual({ title: 'Rent', more: 2 })
    expect(missedText(v.missed!)).toBe('Reminders may not have shown: Rent and 2 more.')
    expect(missedText({ title: 'Rent', more: 0 })).toBe('A reminder may not have shown: Rent.')
  })
  it('looks at each entry once: checked ones leave the log and the app counts as seen', () => {
    const v = checkLog(log(), [rem()], [card], T + HOUR, none, noAck)
    expect(v.log).toEqual({ seenAt: T + HOUR, planned: [] })
    expect(checkLog(v.log, [rem()], [card], T + 2 * HOUR, none, noAck).missed).toBeNull()
  })
})

describe('mergePlan', () => {
  const plan = [{ id: 11, at: T + 5 * HOUR, reminderId: 'r1' }]
  it('records when each scheduled notification should arrive, with the reminder\'s due time', () => {
    expect(mergePlan({ seenAt: 5, planned: [] }, plan, [rem()], T)).toEqual({ seenAt: 5, planned: [{ rid: 'r1', due: T, at: T + 5 * HOUR, nid: 11 }] })
  })
  it('replaces old future entries, but keeps unchecked ones whose time has come', () => {
    const old: FireLog = { seenAt: 0, planned: [{ rid: 'r1', due: T, at: T - HOUR, nid: 9 }, { rid: 'r1', due: T, at: T + 9 * HOUR, nid: 10 }] }
    const out = mergePlan(old, plan, [rem()], T)
    expect(out.planned.map((e) => e.nid)).toEqual([9, 11])
  })
  it('forgets entries for a reminder that moved on, and anything over a week old', () => {
    const old: FireLog = { seenAt: 0, planned: [{ rid: 'r1', due: T - 1, at: T - HOUR, nid: 9 }, { rid: 'r1', due: T, at: T - 8 * 86_400_000, nid: 8 }] }
    expect(mergePlan(old, [], [rem()], T).planned).toEqual([])
  })
})

describe('sanitizeLog', () => {
  it('turns anything into a valid log', () => {
    expect(sanitizeLog(null)).toEqual({ seenAt: 0, planned: [] })
    expect(sanitizeLog('x')).toEqual({ seenAt: 0, planned: [] })
    expect(sanitizeLog({ seenAt: 'a', planned: [{ rid: 'r', due: 1, at: 2, nid: 3 }, { rid: 5 }, null, { rid: 'q', due: NaN, at: 1, nid: 1 }] })).toEqual({ seenAt: 0, planned: [{ rid: 'r', due: 1, at: 2, nid: 3 }] })
  })
})
