import { describe, expect, it } from 'vitest'
import { parseDate, toIso } from './dates'
import { ovulation } from './ovulation'

// Rules are those in the product spec (luteal phase of 14 days; fertile window ovulation -5 to +1).
// Not externally verified against a clinical source. Worked by hand: 1 Nov + 28 d = 29 Nov; - 14 = 15 Nov.
const o = (d: string, n: number) => {
  const r = ovulation(parseDate(d)!, n)
  return r && { next: toIso(r.nextPeriod), ov: toIso(r.ovulation), from: toIso(r.fertileStart), to: toIso(r.fertileEnd) }
}

describe('ovulation', () => {
  it('28-day cycle', () => {
    expect(o('2026-11-01', 28)).toEqual({ next: '2026-11-29', ov: '2026-11-15', from: '2026-11-10', to: '2026-11-16' })
  })
  it('a longer cycle moves ovulation later and crosses a month end', () => {
    expect(o('2026-11-20', 35)).toEqual({ next: '2026-12-25', ov: '2026-12-11', from: '2026-12-06', to: '2026-12-12' })
  })
  it('crosses a year end and a leap day', () => {
    expect(o('2027-12-20', 30)!.next).toBe('2028-01-19')
    expect(o('2028-02-10', 28)!.next).toBe('2028-03-09')
  })
  it('cycle length outside 21 to 45 or not whole is null', () => {
    expect(o('2026-11-01', 20)).toBeNull()
    expect(o('2026-11-01', 46)).toBeNull()
    expect(ovulation(parseDate('2026-11-01')!, 28.5)).toBeNull()
  })
})
