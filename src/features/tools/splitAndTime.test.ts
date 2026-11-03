import { describe, expect, it } from 'vitest'
import { defaultValues, isError, type Output, type Values } from '../../lib/tool'
import { invalidFieldIds } from '../../lib/toolInvalid'
import { ALL_TOOLS } from './registry'

const tool = (id: string) => ALL_TOOLS.find((t) => t.id === id)!
const run = (id: string, patch: Values) => {
  const spec = tool(id)
  return { spec, values: { ...defaultValues(spec), ...patch } }
}
const ok = (id: string, patch: Values) => {
  const { spec, values } = run(id, patch)
  const out = spec.compute(values)
  if (isError(out)) throw new Error(out.error)
  return out as Output
}
const err = (id: string, patch: Values) => {
  const { spec, values } = run(id, patch)
  const out = spec.compute(values)
  return isError(out) ? out.error : null
}
const cell = (o: Output, label: string) => o.rows.find((r) => r.label === label)?.value?.toString()

describe('Tip and split, unequal', () => {
  it('equal mode is unchanged, and an old saved card (no mode) still opens', () => {
    expect(cell(ok('tip', {}), 'Each person pays')).toBe('660')
    const { spec } = run('tip', {})
    const old = { bill: '2400', pct: '10', people: '4' }
    expect(isError(spec.compute(old))).toBe(false)
  })
  it('by percent: your share is row 1, and the tip is shared in proportion', () => {
    const o = ok('tip', { mode: 'percent', rows: [['Me', '50'], ['Asha', '30'], ['Ravi', '20']] })
    expect(cell(o, 'Your share')).toBe('1320')
    expect(o.table?.rows.map((r) => [r[0], String(r[1])])).toEqual([['Me', '1320'], ['Asha', '792'], ['Ravi', '528']])
    expect(o.expense?.amount.toString()).toBe('1320')
  })
  it('names default to You and Person N', () => {
    const o = ok('tip', { mode: 'shares', rows: [['', '1'], ['', '1']] })
    expect(o.table?.rows.map((r) => r[0])).toEqual(['You', 'Person 2'])
  })
  it('who paid: the others owe the payer, who is not listed as owing', () => {
    const o = ok('tip', { mode: 'shares', payer: '1', rows: [['Me', '2'], ['Asha', '1'], ['Ravi', '1']] })
    expect(o.table?.title).toBe('Who pays Me')
    expect(o.table?.rows.map((r) => [r[0], String(r[1])])).toEqual([['Asha pays Me', '660'], ['Ravi pays Me', '660']])
    expect(o.note).toContain('Me paid the whole bill')
  })
  it('says what is wrong, and marks the right box', () => {
    const cases: [Values, RegExp, string][] = [
      [{ mode: 'percent', rows: [['', '60'], ['', '30']] }, /Percentages add to 90/, 'rows'],
      [{ mode: 'exact', rows: [['', '1000'], ['', '500']] }, /Amounts add to ₹1500, but the bill is ₹2400/, 'rows'],
      [{ mode: 'shares', rows: [['', '1'], ['', '']] }, /Enter a share for Person 2/, 'rows'],
      [{ mode: 'shares', payer: '7', rows: [['', '1'], ['', '1']] }, /person number from 1 to 2/, 'payer'],
    ]
    for (const [patch, re, field] of cases) {
      const e = err('tip', patch)
      expect(e).toMatch(re)
      const { spec, values } = run('tip', patch)
      expect([...invalidFieldIds(spec, values, e)]).toContain(field)
    }
  })
})

describe('World time, a chosen time', () => {
  it('3:00 pm in Mumbai on a December day is 04:30 in New York', () => {
    const o = ok('world-time', { when: 'chosen', at: '15:00', day: '2026-12-10' })
    expect(o.rows[0]!.value).toBe('15:00, Thu 10 Dec')
    expect(o.table!.rows.find((r) => r[0] === 'New York')!.slice(1, 3)).toEqual(['04:30', 'Thu 10 Dec'])
  })
  it('needs a time, and a real day', () => {
    expect(err('world-time', { when: 'chosen', at: '' })).toMatch(/Enter the time/)
    expect(err('world-time', { when: 'chosen', at: '15:00', day: '2026-02-31' })).toMatch(/real day/)
  })
  it('the default is still "now"', () => {
    expect(ok('world-time', {}).rows[0]!.label).toMatch(/now$/)
  })
})
