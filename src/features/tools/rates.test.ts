import { describe, expect, it } from 'vitest'
import { RATES_AS_OF as GST } from '../../engine/convert/gstRates'
import { RATES_AS_OF as INVEST } from '../../engine/investments/rates'
import { RATES_AS_OF as LOANS } from '../../engine/loans/rules'
import { RATES_AS_OF as TAX } from '../../engine/tax/rules.FY2026-27'
import { defaultValues, exampleFieldsInUse, labelOf } from '../../lib/tool'
import { ALL_TOOLS } from './registry'

const tool = (id: string) => ALL_TOOLS.find((t) => t.id === id)!

describe('rule packs', () => {
  it.each([['tax', TAX], ['loans', LOANS], ['invest', INVEST], ['gst', GST]])('%s pack has real dates in order', (_n, p) => {
    expect(Date.parse(p.asOf)).toBeLessThan(Date.parse(p.until))
  })
  it('the tools that depend on a changing rate carry a stamp', () => {
    const stamped = ALL_TOOLS.filter((t) => t.rates).map((t) => t.id)
    for (const id of ['income-tax', 'in-hand-salary', 'capital-gains', 'advance-tax', 'gratuity', 'presumptive-44ada', 'home-loan-tax', 'loan-presets', 'card-emi', 'gst', 'ppf', 'nps', 'epf'])
      expect(stamped, id).toContain(id)
  })
})

describe('example values note', () => {
  it('lists the hidden example fields while they still hold their default', () => {
    const nps = tool('nps')
    expect(exampleFieldsInUse(nps, defaultValues(nps))).toEqual(['Share put into annuity', 'Yearly annuity rate'])
    expect(exampleFieldsInUse(nps, { ...defaultValues(nps), annuity: '30' })).toEqual(['Yearly annuity rate'])
    expect(exampleFieldsInUse(nps, { ...defaultValues(nps), annuity: '30', annuityRate: '5.5' })).toEqual([])
  })
  it('covers the EPF ceiling and the FD slab; a tool with no example fields says nothing', () => {
    expect(exampleFieldsInUse(tool('epf'), defaultValues(tool('epf')))).toEqual(['Pension wage ceiling'])
    expect(exampleFieldsInUse(tool('fd'), defaultValues(tool('fd')))).toEqual(['Your tax slab'])
    expect(exampleFieldsInUse(tool('emi'), defaultValues(tool('emi')))).toEqual([])
  })
})

describe('labels that follow the mode', () => {
  it('percentage names its two boxes per mode, ids unchanged', () => {
    const p = tool('percentage')
    const x = p.fields.find((f) => f.id === 'x')!
    const y = p.fields.find((f) => f.id === 'y')!
    expect([labelOf(x, { mode: 'of' }), labelOf(y, { mode: 'of' })]).toEqual(['Percent', 'Of this number'])
    expect([labelOf(x, { mode: 'whatPercent' }), labelOf(y, { mode: 'whatPercent' })]).toEqual(['Part', 'Whole'])
    expect([labelOf(x, { mode: 'change' }), labelOf(y, { mode: 'change' })]).toEqual(['Old value', 'New value'])
  })
  it('the date calculator names the amount by its unit', () => {
    const n = tool('date').fields.find((f) => f.id === 'n')!
    expect(labelOf(n, { unit: 'weeks' })).toBe('How many weeks')
  })
  it('an error names the box the way the screen does', () => {
    const r = tool('percentage').compute({ mode: 'change', x: '', y: '5' })
    expect(r).toMatchObject({ error: 'Enter old value' })
  })
})

describe('advance tax payments', () => {
  it('keeps the four payment ids, grouped under one heading', () => {
    const f = tool('advance-tax').fields.filter((x) => x.cluster)
    expect(f.map((x) => x.id)).toEqual(['p1', 'p2', 'p3', 'p4'])
    expect(new Set(f.map((x) => x.cluster)).size).toBe(1)
  })
})

describe('date difference span', () => {
  it('shows start, end and the count between', () => {
    const r = tool('date').compute({ mode: 'diff', from: '2026-01-01', to: '2026-01-31' })
    expect('rows' in r && r.span).toEqual({ start: 'Thu 1 Jan 2026', end: 'Sat 31 Jan 2026', between: '30 days' })
  })
})
