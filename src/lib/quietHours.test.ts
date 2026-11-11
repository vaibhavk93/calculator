import { describe, expect, it } from 'vitest'
import { inQuietHours, quietEnd, shiftOutOfQuiet } from './quietHours'

/** A local moment, so these read the same way the phone does. */
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).getTime()
const hm = (ts: number) => `${String(new Date(ts).getHours()).padStart(2, '0')}:${String(new Date(ts).getMinutes()).padStart(2, '0')}`
const day = (ts: number) => new Date(ts).getDate()

const NIGHT = { from: '22:00', until: '07:00' } // crosses midnight
const NOON = { from: '12:00', until: '14:00' } // same day

describe('inQuietHours', () => {
  it('a window across midnight covers the evening and the early morning', () => {
    expect(inQuietHours(at(2026, 11, 11, 22, 0), NIGHT)).toBe(true) // the start is included
    expect(inQuietHours(at(2026, 11, 11, 23, 30), NIGHT)).toBe(true)
    expect(inQuietHours(at(2026, 11, 12, 0, 0), NIGHT)).toBe(true)
    expect(inQuietHours(at(2026, 11, 12, 6, 59), NIGHT)).toBe(true)
  })
  it('the end is not included, so a reminder exactly at the end time is let through', () => {
    expect(inQuietHours(at(2026, 11, 12, 7, 0), NIGHT)).toBe(false)
  })
  it('outside is outside', () => {
    for (const h of [7, 9, 12, 18, 21]) expect(inQuietHours(at(2026, 11, 11, h, 0), NIGHT)).toBe(false)
  })
  it('a window inside one day does not wrap', () => {
    expect(inQuietHours(at(2026, 11, 11, 13, 0), NOON)).toBe(true)
    expect(inQuietHours(at(2026, 11, 11, 11, 59), NOON)).toBe(false)
    expect(inQuietHours(at(2026, 11, 11, 2, 0), NOON)).toBe(false)
  })
  it('a window of no length is off, not quiet all day (a setting must never silence everything by accident)', () => {
    const none = { from: '22:00', until: '22:00' }
    for (const h of [0, 7, 22, 23]) expect(inQuietHours(at(2026, 11, 11, h, 0), none)).toBe(false)
  })
  it('nonsense times do not throw', () => {
    expect(() => inQuietHours(at(2026, 11, 11, 23, 0), { from: '99:99', until: 'x' })).not.toThrow()
  })
})

describe('quietEnd', () => {
  it('from the evening half, the window ends tomorrow morning', () => {
    const e = quietEnd(at(2026, 11, 11, 23, 30), NIGHT)
    expect(hm(e)).toBe('07:00')
    expect(day(e)).toBe(12)
  })
  it('from the early-morning half, it ends the same morning', () => {
    const e = quietEnd(at(2026, 11, 12, 2, 0), NIGHT)
    expect(hm(e)).toBe('07:00')
    expect(day(e)).toBe(12)
  })
  it('a same-day window ends that day', () => {
    const e = quietEnd(at(2026, 11, 11, 13, 0), NOON)
    expect(hm(e)).toBe('14:00')
    expect(day(e)).toBe(11)
  })
  it('the evening half of the last day of a month rolls into the next month', () => {
    const e = quietEnd(at(2026, 11, 30, 23, 0), NIGHT)
    expect(day(e)).toBe(1)
    expect(new Date(e).getMonth()).toBe(11) // December
  })
  it('new year', () => {
    const e = quietEnd(at(2026, 12, 31, 23, 0), NIGHT)
    expect(new Date(e).getFullYear()).toBe(2027)
    expect(day(e)).toBe(1)
  })
})

describe('shiftOutOfQuiet', () => {
  const due = at(2026, 11, 20, 9)
  it('no quiet hours set: nothing moves', () => {
    const t = at(2026, 11, 11, 23, 0)
    expect(shiftOutOfQuiet(t, null, due)).toBe(t)
  })
  it('a time outside the window does not move', () => {
    const t = at(2026, 11, 11, 9, 0)
    expect(shiftOutOfQuiet(t, NIGHT, due)).toBe(t)
  })
  it('a late-night heads-up moves to the end of the quiet hours', () => {
    const moved = shiftOutOfQuiet(at(2026, 11, 11, 22, 30), NIGHT, due)
    expect(hm(moved)).toBe('07:00')
    expect(day(moved)).toBe(12)
  })
  it('an early-morning heads-up moves up to the same morning', () => {
    const moved = shiftOutOfQuiet(at(2026, 11, 12, 3, 0), NIGHT, due)
    expect(hm(moved)).toBe('07:00')
    expect(day(moved)).toBe(12)
  })
  it('it is never pushed to at or after the due moment: the original time is kept instead', () => {
    // Due at 23:00; a heads-up at 22:30 the same night would move to 07:00 the NEXT day, i.e. after the bill was due.
    const sameNight = at(2026, 11, 11, 23, 0)
    const t = at(2026, 11, 11, 22, 30)
    expect(shiftOutOfQuiet(t, NIGHT, sameNight)).toBe(t)
  })
  it('a reminder due inside the quiet hours still rings then (the user chose that time)', () => {
    const t = at(2026, 11, 11, 23, 0)
    expect(shiftOutOfQuiet(t, NIGHT, t)).toBe(t)
  })
})
