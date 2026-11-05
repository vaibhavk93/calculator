import { describe, expect, it } from 'vitest'
import { D, type Dec } from '../../engine'
import { balanceTransfer, compoundInterest, simpleInterest } from '../../engine/loans/loan'
import { defaultValues, isError, type Computed, type ToolSpec, type Values } from '../../lib/tool'
import { ALL_TOOLS } from './registry'

const tool = (id: string): ToolSpec => ALL_TOOLS.find((s) => s.id === id)!
const run = (id: string, over: Values = {}) => {
  const s = tool(id)
  return s.compute({ ...defaultValues(s), ...over }) as Computed
}
const row = (id: string, over: Values, label: string) => {
  const out = run(id, over)
  if (isError(out)) throw new Error(out.error)
  return out.rows.find((r) => r.label === label)!.value
}
const j = (c: Computed) => JSON.stringify(c)

describe('balance-transfer: months or years left', () => {
  const bt = (over: Values) => run('balance-transfer', over)
  it("GOLDEN: no unit key is months, and the answer is the engine's for 180 months", () => {
    const old = { ...defaultValues(tool('balance-transfer')) }
    delete old.months__unit
    const out = tool('balance-transfer').compute(old) as Exclude<Computed, { error: string }>
    const e = balanceTransfer(new D(4000000), new D(9.5), 180, new D(8.5), new D(20000))
    expect(out.rows[0]!.value).toEqual(e.netSaving.abs())
    expect(out.rows[2]!.value).toEqual(e.oldEmi)
  })
  it('15 years equals 180 months', () => {
    expect(j(bt({ months: '15', months__unit: 'years' }))).toBe(j(bt({ months: '180', months__unit: 'months' })))
    expect(j(bt({ months: '15', months__unit: 'years' }))).toBe(j(bt({ months: '180' })))
  })
  it('years that do not come to whole months, and 0 or more than 600 months, give the plain error', () => {
    const msg = 'Time left must come to whole months, 1 to 600'
    expect(bt({ months: '1.55', months__unit: 'years' })).toEqual({ error: msg })
    expect(bt({ months: '0', months__unit: 'months' })).toEqual({ error: msg })
    expect(bt({ months: '601' })).toEqual({ error: msg })
    expect(bt({ months: '51', months__unit: 'years' })).toEqual({ error: msg })
    expect(bt({ months: '12.5' })).toEqual({ error: msg })
    expect(isError(bt({ months: '600' }))).toBe(false)
    expect(isError(bt({ months: '50', months__unit: 'years' }))).toBe(false)
    expect(isError(bt({ months: '1.5', months__unit: 'years' }))).toBe(false)
  })
})

describe('simple-compound: years, months or days', () => {
  const sc = (over: Values) => run('simple-compound', over)
  it('GOLDEN: no unit key is years; the old four rows are unchanged', () => {
    const old = { ...defaultValues(tool('simple-compound')) }
    delete old.years__unit
    const out = tool('simple-compound').compute(old) as Exclude<Computed, { error: string }>
    expect(out.rows.slice(0, 4).map((r) => [r.label, String(r.value)])).toEqual([
      ['Compound interest', '61051'],
      ['Simple interest', '50000'],
      ['Difference', '11051'],
      ['Total with compound interest', '161051'],
    ])
    expect(out.table!.rows.length).toBe(5)
    expect(out.table!.title).toBe('Growth by year')
  })
  it('100000 at 12% simple for 90 days is 2958.9041 (12000 x 90 / 365)', () => {
    const si = row('simple-compound', { principal: '100000', rate: '12', years: '90', years__unit: 'days' }, 'Simple interest') as Dec
    expect(si.toDecimalPlaces(4).toFixed()).toBe('2958.9041')
    expect(si.eq(simpleInterest(new D(100000), new D(12), new D(90).div(365)))).toBe(true)
    expect(String(row('simple-compound', { rate: '12', years: '90', years__unit: 'days' }, 'Days'))).toBe('90')
  })
  it('3 months compounded monthly is P x 1.01^3 - P exactly', () => {
    const ci = row('simple-compound', { principal: '100000', rate: '12', years: '3', years__unit: 'months', freq: 'monthly' }, 'Compound interest') as Dec
    expect(ci.toFixed()).toBe(new D(100000).times('1.030301').minus(100000).toFixed())
    expect(ci.toFixed()).toBe('3030.1')
  })
  it('12 months equals 1 year, 18 months equals 1.5 years, 365 days equals 1 year', () => {
    // the formula line names the unit typed, so compare the numbers and the table
    const nums = (c: Computed) => JSON.stringify({ ...(c as object), formula: [] })
    const y1 = nums(sc({ years: '1' }))
    expect(nums(sc({ years: '12', years__unit: 'months' }))).toBe(y1)
    expect(nums(sc({ years: '365', years__unit: 'days' }))).toBe(y1)
    expect(nums(sc({ years: '18', years__unit: 'months' }))).toBe(nums(sc({ years: '1.5' })))
  })
  it('limits: 0 and over 100 years are errors in every unit', () => {
    expect(isError(sc({ years: '0', years__unit: 'days' }))).toBe(true)
    expect(isError(sc({ years: '1201', years__unit: 'months' }))).toBe(true)
    expect(isError(sc({ years: '1200', years__unit: 'months' }))).toBe(false)
    expect(isError(sc({ years: '36501', years__unit: 'days' }))).toBe(true)
  })
  it('under 2 years the table has a row per month (at most 24); from 2 years, per year', () => {
    const t = (over: Values) => {
      const o = sc(over)
      if (isError(o)) throw new Error(o.error)
      return o.table!
    }
    expect(t({ years: '90', years__unit: 'days' }).rows.map((r) => String(r[0]))).toEqual(['1', '2', '2.96'])
    expect(t({ years: '18', years__unit: 'months' }).rows.length).toBe(18)
    expect(t({ years: '23', years__unit: 'months' }).rows.length).toBe(23)
    expect(t({ years: '1.9' }).rows.length).toBe(23)
    expect(t({ years: '1' }).rows.length).toBe(12)
    expect(t({ years: '24', years__unit: 'months' }).rows.length).toBe(2)
    expect(t({ years: '24', years__unit: 'months' }).title).toBe('Growth by year')
    expect(t({ years: '7', years__unit: 'months' }).rows.length).toBe(7)
    const last = t({ years: '18', years__unit: 'months' }).rows.at(-1)!
    expect(last[2]).toEqual(new D(100000).plus(compoundInterest(new D(100000), new D(10), new D('1.5'), 1)))
  })
  it('the part-period note shows only when a compounding period is cut short', () => {
    const note = (over: Values) => (sc(over) as { note?: string }).note
    expect(note({ years: '90', years__unit: 'days' })).toMatch(/unproven/)
    expect(note({ years: '7', years__unit: 'months', freq: 'monthly' })).toBeUndefined()
    expect(note({ years: '5' })).toBeUndefined()
  })
})

describe('capital-gains: held months also read as years and months', () => {
  const held = (buyDate: string, sellDate: string) => String(row('capital-gains', { asset: 'equity', buyDate, sellDate }, 'Holding type'))
  it('3 years 2 months, whole years, under a year, and a singular month', () => {
    expect(held('2023-04-10', '2026-06-20')).toMatch(/\(held 38 months, 3 years 2 months\)$/)
    expect(held('2023-06-15', '2026-06-20')).toMatch(/\(held 36 months, 3 years\)$/)
    expect(held('2025-12-15', '2026-06-20')).toMatch(/\(held 6 months\)$/)
    expect(held('2026-05-15', '2026-06-20')).toMatch(/\(held 1 month\)$/)
  })
})
