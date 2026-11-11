import { describe, expect, it } from 'vitest'
import { defaultValues, isError, type Computed, type Values } from '../../lib/tool'
import { ALL_TOOLS } from './registry'

const spec = ALL_TOOLS.find((s) => s.id === 'fd-maturity')!
const run = (over: Values = {}) => spec.compute({ ...defaultValues(spec), ...over }) as Computed
const ok = (over: Values = {}) => {
  const out = run(over)
  if (isError(out)) throw new Error(out.error)
  return out
}
const val = (over: Values, label: string) => String(ok(over).rows.find((r) => r.label === label)!.value)
const base = { principal: '100000', rate: '7', start: '2026-11-11', period: '5', period__unit: 'years', comp: 'quarterly' }

describe('fd-maturity tool', () => {
  it('1,00,000 at 7% quarterly for 5 years from 11 Nov 2026: 1,41,477.82, matures Tue 11 Nov 2031', () => {
    expect(Number(val(base, 'Maturity amount')).toFixed(2)).toBe('141477.82')
    expect(Number(val(base, 'Interest earned')).toFixed(2)).toBe('41477.82')
    expect(val(base, 'Matures on')).toBe('Tue 11 Nov 2031')
    expect(val(base, 'Days in the deposit')).toBe('1826')
    expect(Number(val(base, 'Effective yearly yield')).toFixed(4)).toBe('7.1859')
  })
  it('all four ways of adding interest work, and only-at-maturity is simple interest', () => {
    const amount = (comp: string) => Number(val({ ...base, comp, period: '2' }, 'Maturity amount'))
    expect(amount('maturity')).toBeCloseTo(114000, 6)
    expect(amount('yearly')).toBeCloseTo(114490, 6)
    expect(amount('quarterly')).toBeGreaterThan(amount('yearly'))
    expect(amount('monthly')).toBeGreaterThan(amount('quarterly'))
  })
  it('days, months and years give a calendar-correct date (month-end safe)', () => {
    expect(val({ ...base, period: '90', period__unit: 'days' }, 'Matures on')).toBe('Tue 9 Feb 2027')
    expect(val({ ...base, start: '2027-01-31', period: '1', period__unit: 'months' }, 'Matures on')).toBe('Sun 28 Feb 2027')
    expect(val({ ...base, start: '2027-03-01', period: '365', period__unit: 'days' }, 'Matures on')).toBe('Tue 29 Feb 2028')
  })
  it('18 months equals 1.5 years in value', () => {
    expect(val({ ...base, period: '18', period__unit: 'months' }, 'Maturity amount')).toBe(val({ ...base, period: '1.5', period__unit: 'years' }, 'Maturity amount'))
  })
  it('a part period is flagged in the note; a whole one is not', () => {
    expect(ok({ ...base, period: '90', period__unit: 'days' }).note).toMatch(/unproven/)
    expect(ok(base).note).not.toMatch(/unproven/)
  })
  it('shows the assumptions and a year-by-year table', () => {
    const out = ok(base)
    expect(out.note).toMatch(/Assumptions/)
    expect(out.table!.rows).toHaveLength(5)
    expect(ok({ ...base, period: '6', period__unit: 'months' }).table!.rows).toHaveLength(1)
  })
  it('plain errors, never NaN', () => {
    expect(run({ ...base, principal: '0' })).toEqual({ error: 'Deposit amount must be more than zero', field: 'principal' })
    expect(run({ ...base, rate: '101' })).toEqual({ error: 'Enter a yearly interest rate from 0 to 100%', field: 'rate' })
    expect(run({ ...base, rate: '-1' })).toEqual({ error: 'Enter a yearly interest rate from 0 to 100%', field: 'rate' })
    expect(run({ ...base, start: '' })).toEqual({ error: 'Pick the start date', field: 'start' })
    expect(run({ ...base, start: '2026-02-30' })).toEqual({ error: 'Enter a real start date', field: 'start' })
    expect(run({ ...base, period: '0' })).toEqual({ error: 'Deposit period must be more than zero', field: 'period' })
    expect(run({ ...base, period: '10.5', period__unit: 'days' })).toEqual({ error: 'Days must be a whole number', field: 'period' })
    expect(run({ ...base, period: '51' })).toEqual({ error: 'Use a deposit period of 50 years or less', field: 'period' })
    expect(run({ ...base, principal: '12abc' }).hasOwnProperty('error')).toBe(true)
  })
  it('the default form works with no NaN or Infinity', () => {
    for (const r of ok().rows) expect(String(r.value)).not.toMatch(/NaN|Infinity/)
  })
})
