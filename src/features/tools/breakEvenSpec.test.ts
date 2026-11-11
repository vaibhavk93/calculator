import { describe, expect, it } from 'vitest'
import { defaultValues, isError, type Computed, type Values } from '../../lib/tool'
import { ALL_TOOLS } from './registry'

const spec = ALL_TOOLS.find((s) => s.id === 'break-even')!
const run = (over: Values = {}) => spec.compute({ ...defaultValues(spec), ...over }) as Computed
const ok = (over: Values = {}) => {
  const out = run(over)
  if (isError(out)) throw new Error(out.error)
  return out
}
const val = (over: Values, label: string) => String(ok(over).rows.find((r) => r.label === label)!.value)

describe('break-even tool', () => {
  it('defaults: 5,00,000 / 400 = 1,250 units, sales 12,50,000, margin of safety 37.5% at 2,000 planned', () => {
    expect(val({}, 'Break-even units')).toBe('1250')
    expect(val({}, 'Break-even sales')).toBe('1250000')
    expect(val({}, 'Profit on each unit')).toBe('400')
    expect(val({}, 'Margin of safety (units)')).toBe('750')
    expect(val({}, 'Margin of safety')).toBe('37.5')
    expect(val({}, 'Profit at planned units')).toBe('300000')
    expect(ok().rows[0]!.main).toBe(true)
  })
  it('a blank planned volume leaves out the margin of safety only', () => {
    const labels = ok({ planned: '' }).rows.map((r) => r.label)
    expect(labels).toEqual(['Break-even units', 'Break-even sales', 'Profit on each unit', 'Profit as a share of the price'])
  })
  it('planned below break-even says how far short and the loss, in words, with no margin', () => {
    const out = ok({ planned: '1000' })
    const labels = out.rows.map((r) => r.label)
    expect(labels).toContain('Short of break-even by (units)')
    expect(labels).toContain('Loss at planned units')
    expect(labels).not.toContain('Margin of safety')
    expect(val({ planned: '1000' }, 'Short of break-even by (units)')).toBe('250')
    expect(val({ planned: '1000' }, 'Loss at planned units')).toBe('100000')
  })
  it('the profit table runs from a loss to a profit and includes the planned volume once', () => {
    const t = ok().table!
    const profits = t.rows.map((r) => Number(String(r[3])))
    expect(profits[0]).toBe(-500000)
    expect(profits).toContain(0)
    expect(profits.at(-1)).toBeGreaterThan(0)
    expect(t.rows.map((r) => String(r[0]))).toContain('2000')
    // double break-even is 2,500 here, so the planned 2,000 sits before it in order
    const units = t.rows.map((r) => Number(String(r[0])))
    expect([...units].sort((a, b) => a - b)).toEqual(units)
    expect(new Set(units).size).toBe(units.length)
  })
  it('says the assumptions on screen', () => {
    expect(ok().note).toMatch(/Assumptions: the price and the variable cost per unit stay the same/)
    expect(ok().note).toMatch(/GST/)
  })
  it('price at or below the variable cost gives the plain error (never NaN or Infinity)', () => {
    const msg = 'Each unit loses money (the price is not above its variable cost), so you never break even. Raise the price or cut the variable cost'
    expect(run({ price: '600', variable: '600' })).toEqual({ error: msg, field: 'price' })
    expect(run({ price: '500', variable: '600' })).toEqual({ error: msg, field: 'price' })
  })
  it('other plain errors', () => {
    expect(run({ fixed: '0' })).toEqual({ error: 'Fixed costs must be more than zero', field: 'fixed' })
    expect(run({ fixed: '-1' })).toEqual({ error: 'Fixed costs must be more than zero', field: 'fixed' })
    expect(run({ price: '0' })).toEqual({ error: 'Selling price must be more than zero', field: 'price' })
    expect(run({ variable: '-1' })).toEqual({ error: "Variable cost can't be negative", field: 'variable' })
    expect(run({ planned: '0' })).toEqual({ error: 'Planned units must be more than zero. Leave it blank to skip', field: 'planned' })
    expect(run({ planned: '-5' })).toEqual({ error: 'Planned units must be more than zero. Leave it blank to skip', field: 'planned' })
    expect(run({ planned: '12abc' })).toEqual({ error: "Units you plan to sell isn't a number" })
    expect(run({ fixed: '' })).toMatchObject({ error: 'Enter fixed costs', field: 'fixed' })
  })
  it('a tiny profit per unit gives a huge but plain number, not NaN', () => {
    const out = ok({ price: '1000.0001', variable: '1000', planned: '' })
    for (const r of out.rows) expect(String(r.value)).not.toMatch(/NaN|Infinity/)
  })
})
