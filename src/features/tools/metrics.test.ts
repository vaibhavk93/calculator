import { describe, expect, it } from 'vitest'
import { defaultValues, isError, type Computed, type Values } from '../../lib/tool'
import { TOOLS } from './metrics'

const run = (id: string, over: Values = {}): Computed => {
  const spec = TOOLS.find((t) => t.id === id)!
  return spec.compute({ ...defaultValues(spec), ...over })
}
const rowOf = (c: Computed, label: RegExp) => ('rows' in c ? c.rows.find((r) => label.test(r.label))?.value : undefined)
const text = (c: Computed) => (typeof rowOf(c, /./) === 'string' ? 'x' : String(rowOf(c, /./)))

describe('metrics specs', () => {
  it('default results are the hand-worked figures', () => {
    expect(text(run('cac-ltv'))).toBe('2000')
    expect(String(rowOf(run('cac-ltv'), /^LTV/))).toBe('8750')
    expect(String(rowOf(run('cac-payback'), /Payback/)).slice(0, 6)).toBe('5.7142')
    expect(String(rowOf(run('rule-of-40'), /Rule of 40/))).toBe('25')
    expect(String(rowOf(run('ab-sample-size'), /per variant/))).toBe('1094')
    expect(String(rowOf(run('ab-sample-size'), /duration/))).toBe('5')
  })
  it('zero churn says so in words and gives no LTV number', () => {
    const c = run('cac-ltv', { churn: '0' })
    expect(isError(c)).toBe(false)
    expect(rowOf(c, /^LTV/)).toBe('Not defined')
    expect(JSON.stringify(c)).not.toMatch(/Infinity|NaN/)
  })
  it('plain-words errors', () => {
    expect(run('cac-ltv', { customers: '0' })).toEqual({ error: 'New customers must be more than 0' })
    expect(run('arr-mrr', { months: '0' })).toHaveProperty('error')
    expect(run('ab-sample-size', { baseline: '98', mde: '5' })).toHaveProperty('error')
    expect(run('funnel', { stages: [['A', '10'], ['B', '20']] })).toEqual({ error: "B can't be bigger than A" })
    expect(run('retention', { periods: [['M1', '2000']] })).toHaveProperty('error')
    expect(run('rule-of-40', { newArr: '0' })).not.toHaveProperty('error')
    expect(rowOf(run('rule-of-40', { newArr: '0' }), /Burn multiple/)).toBe('Not defined')
  })
  it('relative MDE reaches the same answer as the matching absolute one', () => {
    expect(String(rowOf(run('ab-sample-size', { mdeType: 'relative', mde: '25' }), /per variant/))).toBe('1094')
  })
  it('chart has at most 25 bars for a long projection', () => {
    const c = run('arr-mrr', { months: '120' })
    expect('chart' in c && c.chart!.labels.length).toBeLessThanOrEqual(25)
  })
})
