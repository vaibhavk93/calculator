import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultValues, isError, type Computed, type Values } from '../../lib/tool'
import { ALL_TOOLS } from './registry'

const spec = ALL_TOOLS.find((s) => s.id === 'goal-sip-date')!
const run = (over: Values = {}) => spec.compute({ ...defaultValues(spec), ...over }) as Computed
const ok = (over: Values = {}) => {
  const out = run(over)
  if (isError(out)) throw new Error(out.error)
  return out
}
const val = (over: Values, label: string) => ok(over).rows.find((r) => r.label === label)!.value

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 11, 10, 0, 0)) // 11 Nov 2026, local time
})
afterEach(() => vi.useRealTimers())

describe('goal-sip-date tool', () => {
  it('by a date: 12 months to 11 Nov 2027 at 12% for 1,00,000 needs 7,806.81 a month (hand-worked in goalSip.test.ts)', () => {
    const v = { target: '100000', when: 'date', byDate: '2027-11-11', rate: '12', existing: '' }
    expect(String(ok(v).rows[0]!.value)).toBe(String(val(v, 'Monthly SIP needed')))
    expect((val(v, 'Monthly SIP needed') as { toFixed: (n: number) => string }).toFixed(2)).toBe('7806.81')
    expect(val(v, 'Time to go')).toBe('1 year')
  })
  it('a part month counts as a full month (12 Nov 2027 = 13 months)', () => {
    expect(val({ when: 'date', byDate: '2027-11-12' }, 'Time to go')).toBe('1 year 1 month')
  })
  it('in years or months gives the same answer as the matching date (18 months = 1.5 years)', () => {
    const a = JSON.stringify(ok({ when: 'duration', duration: '18', duration__unit: 'months' }).rows.map((r) => String(r.value)))
    const b = JSON.stringify(ok({ when: 'duration', duration: '1.5', duration__unit: 'years' }).rows.map((r) => String(r.value)))
    const c = JSON.stringify(ok({ when: 'date', byDate: '2028-05-11' }).rows.map((r) => String(r.value)))
    expect(a).toBe(b)
    expect(a).toBe(c)
  })
  it('a step-up adds the last-year SIP row and lowers the starting SIP', () => {
    const flat = Number(String(val({ when: 'duration', duration: '10', stepUp: '0' }, 'Monthly SIP needed')))
    const out = ok({ when: 'duration', duration: '10', stepUp: '10' })
    expect(out.rows[0]!.label).toBe('Monthly SIP to start with')
    expect(Number(String(out.rows[0]!.value))).toBeLessThan(flat)
    expect(out.rows[1]!.label).toBe('Monthly SIP in the last year')
  })
  it('says the compounding convention and the open question on screen', () => {
    const note = ok().note!
    expect(note).toMatch(/monthly at the yearly return ÷ 12/)
    expect(note).toMatch(/Open question/)
    expect(ok().formula!.join(' ')).toMatch(/every month/)
  })
  it('already saved money that reaches the goal needs no SIP, with a plain note and no table', () => {
    const out = ok({ existing: '10000000' })
    expect(String(out.rows[0]!.value)).toBe('0')
    expect(out.note).toMatch(/reaches the target on its own/)
    expect(out.table).toBeUndefined()
  })
  it('plain errors, never NaN', () => {
    expect(run({ byDate: '2026-11-11' })).toEqual({ error: 'Pick a date after today', field: 'byDate' })
    expect(run({ byDate: '2020-01-01' })).toEqual({ error: 'Pick a date after today', field: 'byDate' })
    expect(run({ byDate: '' })).toEqual({ error: 'Pick the date you want the money by', field: 'byDate' })
    expect(run({ byDate: '2027-02-30' })).toEqual({ error: 'Enter a real date', field: 'byDate' })
    expect(run({ byDate: '2090-01-01' })).toEqual({ error: 'Use a date within 60 years', field: 'byDate' })
    expect(run({ target: '0' })).toEqual({ error: 'Target amount must be more than zero', field: 'target' })
    expect(run({ rate: '101' })).toEqual({ error: 'Enter a yearly return from 0 to 100%', field: 'rate' })
    expect(run({ rate: '-1' })).toEqual({ error: 'Enter a yearly return from 0 to 100%', field: 'rate' })
    expect(run({ existing: '-5' })).toEqual({ error: "Already saved can't be negative", field: 'existing' })
    expect(run({ existing: '12abc' })).toEqual({ error: "Already saved isn't a number" })
    expect(run({ stepUp: '150' })).toEqual({ error: 'Enter a yearly raise from 0 to 100%', field: 'stepUp' })
    expect(run({ when: 'duration', duration: '1.55', duration__unit: 'years' })).toEqual({ error: 'Time must come to whole months, from 1 month to 60 years', field: 'duration' })
    expect(run({ when: 'duration', duration: '0' })).toEqual({ error: 'Time must come to whole months, from 1 month to 60 years', field: 'duration' })
    expect(run({ when: 'duration', duration: '61', duration__unit: 'years' })).toEqual({ error: 'Use a date within 60 years', field: 'duration' })
  })
  it('the default form works and shows no NaN or Infinity', () => {
    for (const r of ok().rows) expect(String(r.value)).not.toMatch(/NaN|Infinity/)
    expect(Number(String(ok().rows[0]!.value))).toBeGreaterThan(0)
  })
})
