import { describe, expect, it } from 'vitest'
import { defaultValues, isError, type Computed, type Values } from '../../lib/tool'
import { ALL_TOOLS } from './registry'

const spec = ALL_TOOLS.find((s) => s.id === 'extra-emi')!
const run = (over: Values = {}) => spec.compute({ ...defaultValues(spec), ...over }) as Computed
const ok = (over: Values = {}) => {
  const out = run(over)
  if (isError(out)) throw new Error(out.error)
  return out
}
const text = (over: Values, label: string) => String(ok(over).rows.find((r) => r.label === label)!.value)

describe('extra-emi tool', () => {
  it('shows months saved, a new end date and interest saved (12,000 over 12 months at 0%, 1,000 extra, first EMI 5 Jan 2027)', () => {
    const base = { principal: '12000', rate: '0', tenure: '12 months', extra: '1000', lump: '', firstEmi: '2027-01-05' }
    expect(text(base, 'Months saved')).toBe('6')
    expect(text(base, 'New loan term')).toBe('6 months')
    expect(text(base, 'Loan now ends')).toBe('Sat 5 Jun 2027')
    expect(text(base, 'Loan would have ended')).toBe('Sun 5 Dec 2027')
    expect(ok(base).rows[0]!.main).toBe(true)
  })
  it('end dates are month-end safe (first EMI 31 Jan: the 2nd EMI falls on 28 Feb)', () => {
    const base = { principal: '12000', rate: '0', tenure: '12 months', extra: '6000', lump: '', firstEmi: '2027-01-31' }
    // 2 EMIs of 7,000 are not enough (12,000 / 7,000), so 2 months: last EMI on 28 Feb 2027
    expect(text(base, 'Loan now ends')).toBe('Sun 28 Feb 2027')
  })
  it('a blank first-EMI date drops the date rows only', () => {
    const labels = ok({ firstEmi: '' }).rows.map((r) => r.label)
    expect(labels).not.toContain('Loan now ends')
    expect(labels).toContain('Months saved')
  })
  it('plain errors, never NaN', () => {
    expect(run({ extra: '', lump: '' })).toEqual({ error: 'Enter an extra monthly amount, a yearly lump sum, or both', field: 'extra' })
    expect(run({ extra: '-5' })).toEqual({ error: "Extra monthly payment can't be negative", field: 'extra' })
    expect(run({ lump: '-5' })).toEqual({ error: "Yearly lump sum can't be negative", field: 'lump' })
    expect(run({ extra: '12abc' })).toEqual({ error: "Extra paid with every EMI isn't a number" })
    expect(run({ firstEmi: '2027-02-30' })).toEqual({ error: 'Enter the first EMI date as a real date', field: 'firstEmi' })
    expect(isError(run({ principal: '0' }))).toBe(true)
    expect(isError(run({ rate: '101' }))).toBe(true)
    expect(isError(run({ tenure: '0' }))).toBe(true)
  })
  it('a yearly lump alone works and an extra larger than the loan clears it in one month', () => {
    expect(text({ extra: '', lump: '100000' }, 'Months saved')).not.toBe('0')
    expect(text({ principal: '1000', rate: '12', tenure: '2 months', extra: '5000' }, 'New loan term')).toBe('1 month')
    for (const r of ok().rows) expect(String(r.value)).not.toMatch(/NaN|Infinity/)
  })
})
