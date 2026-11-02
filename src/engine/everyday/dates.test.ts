import { describe, expect, it } from 'vitest'
import { addDays, addMonths, addYears, daysBetween, formatDate, parseDate, toIso, ymd } from './dates'

// Not checked against an external calculator. Expected values come from the calendar itself
// (leap years: divisible by 4, except centuries not divisible by 400).
const d = (s: string) => parseDate(s)!

describe('parseDate', () => {
  it('accepts real dates and rejects impossible ones', () => {
    expect(toIso(d('2026-11-02'))).toBe('2026-11-02')
    expect(parseDate('2026-02-30')).toBeNull()
    expect(parseDate('2025-02-29')).toBeNull()
    expect(parseDate('2024-02-29')).not.toBeNull()
    expect(parseDate('1900-02-29')).toBeNull()
    expect(parseDate('2000-02-29')).not.toBeNull()
    expect(parseDate('02/11/2026')).toBeNull()
    expect(parseDate('')).toBeNull()
  })
})

describe('adding', () => {
  it('days cross month and year ends', () => {
    expect(toIso(addDays(d('2026-12-31'), 1))).toBe('2027-01-01')
    expect(toIso(addDays(d('2026-03-01'), -1))).toBe('2026-02-28')
    expect(toIso(addDays(d('2024-02-28'), 2))).toBe('2024-03-01')
  })
  it('31 Jan + 1 month lands on the last day of Feb', () => {
    expect(toIso(addMonths(d('2026-01-31'), 1))).toBe('2026-02-28')
    expect(toIso(addMonths(d('2024-01-31'), 1))).toBe('2024-02-29')
    expect(toIso(addMonths(d('2026-03-31'), -1))).toBe('2026-02-28')
    expect(toIso(addMonths(d('2026-11-30'), 3))).toBe('2027-02-28')
    expect(toIso(addMonths(d('2026-12-15'), 1))).toBe('2027-01-15')
  })
  it('29 Feb + 1 year is 28 Feb; four years on it is 29 Feb again', () => {
    expect(toIso(addYears(d('2024-02-29'), 1))).toBe('2025-02-28')
    expect(toIso(addYears(d('2024-02-29'), 4))).toBe('2028-02-29')
  })
})

describe('daysBetween and ymd', () => {
  it('counts days across a leap day', () => {
    expect(daysBetween(d('2024-02-28'), d('2024-03-01'))).toBe(2)
    expect(daysBetween(d('2025-02-28'), d('2025-03-01'))).toBe(1)
    expect(daysBetween(d('2026-01-01'), d('2027-01-01'))).toBe(365)
    expect(daysBetween(d('2026-11-02'), d('2026-11-01'))).toBe(-1)
  })
  it('years, months, days', () => {
    expect(ymd(d('1990-06-15'), d('2026-11-02'))).toEqual({ years: 36, months: 4, days: 18 })
    expect(ymd(d('2026-01-31'), d('2026-03-01'))).toEqual({ years: 0, months: 1, days: 1 })
    expect(ymd(d('2024-02-29'), d('2025-02-28'))).toEqual({ years: 1, months: 0, days: 0 })
    expect(ymd(d('2026-11-02'), d('2026-11-02'))).toEqual({ years: 0, months: 0, days: 0 })
  })
  it('a start after the end is null', () => {
    expect(ymd(d('2026-11-03'), d('2026-11-02'))).toBeNull()
  })
  it('formats with weekday', () => {
    expect(formatDate(d('2026-11-02'))).toBe('Mon 2 Nov 2026')
  })
})
