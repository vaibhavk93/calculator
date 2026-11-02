import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { gradeAverage } from './grades'

// Not externally verified: universities publish their own marks-to-grade-point tables and this uses a straight scale.
// Recomputed by hand: (80 x 4 + 60 x 2) / 6 = 73.33.
const row = (marks: string, max: string, credits: string) => ({ marks: new D(marks), maxMarks: new D(max), credits: new D(credits) })

describe('gradeAverage', () => {
  it('weights by credits', () => {
    const r = gradeAverage([row('80', '100', '4'), row('60', '100', '2')])!
    expect(r.percent.toDecimalPlaces(2).toFixed()).toBe('73.33')
    expect(r.gpa10.toDecimalPlaces(3).toFixed()).toBe('7.333')
    expect(r.totalCredits.toFixed()).toBe('6')
  })
  it('different max marks per row', () => {
    const r = gradeAverage([row('45', '50', '1'), row('160', '200', '1')])!
    expect(r.percent.toFixed()).toBe('85')
  })
  it('full marks is 100% and 10.0', () => {
    const r = gradeAverage([row('100', '100', '3')])!
    expect([r.percent.toFixed(), r.gpa10.toFixed()]).toEqual(['100', '10'])
  })
  it('invalid rows are null', () => {
    expect(gradeAverage([])).toBeNull()
    expect(gradeAverage([row('101', '100', '1')])).toBeNull()
    expect(gradeAverage([row('50', '0', '1')])).toBeNull()
    expect(gradeAverage([row('50', '100', '0')])).toBeNull()
    expect(gradeAverage([row('-1', '100', '1')])).toBeNull()
  })
})
