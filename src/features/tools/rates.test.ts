import { describe, expect, it } from 'vitest'
import { RATES_AS_OF as GST } from '../../engine/convert/gstRates'
import { EXAMPLE, PPF, RATES_AS_OF as INVEST } from '../../engine/investments/rates'
import { RATES_AS_OF as LOANS } from '../../engine/loans/rules'
import { RULES_FY2026_27 as TAX_RULES, RATES_AS_OF as TAX } from '../../engine/tax/rules.FY2026-27'
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

// Added 2026-11-06 with the primary-source research (`docs/RESEARCH-BLOCKED-2026-11-06.md`).
// These numbers now have a government document behind them, so a silent revert to the old
// "example value" guesses should fail loudly rather than ship a confidently wrong figure.
describe('numbers upgraded to a primary source on 2026-11-06', () => {
  it('PPF 7.1% is the official rate, not an example, and the screen uses it', () => {
    expect(PPF.rate).toBe('7.1')
    expect(PPF.rateSource).toContain('F.No.1/4/2019-NS')
    expect(defaultValues(tool('ppf')).rate).toBe('7.1')
    // Quarterly reset: the pack must expire with the quarter, not with the tax year.
    expect(INVEST.until).toBe('2027-01-01')
  })

  it('the EPS pension wage ceiling is the Rs 25,000 notified from 17 Sep 2026', () => {
    expect(EXAMPLE.epsWageCeiling).toBe('25000')
    expect(defaultValues(tool('epf')).ceiling).toBe('25000')
  })

  it('HRA follows Rule 279: eight 50% cities, 40% elsewhere, PAN above Rs 1 lakh', () => {
    expect(TAX_RULES.hra.metroPct).toBe('50')
    expect(TAX_RULES.hra.otherPct).toBe('40')
    expect(TAX_RULES.hra.rentLessSalaryPct).toBe('10')
    expect(TAX_RULES.hra.landlordPanAbove).toBe('100000')
    // The list grew from four cities to eight on 1 Apr 2026. Pune/Ahmedabad/Bengaluru/Hyderabad are the new ones.
    expect(TAX_RULES.hra.metroCities).toHaveLength(8)
    for (const c of ['Mumbai', 'Kolkata', 'Delhi', 'Chennai', 'Hyderabad', 'Pune', 'Ahmedabad', 'Bengaluru'])
      expect(TAX_RULES.hra.metroCities, c).toContain(c)
  })

  it('the gratuity divisor stays 26 but is flagged as an assumption, not statute', () => {
    // Code on Social Security s.53(2) has no divisor; 26 is from the repealed 1972 Act.
    expect(TAX_RULES.gratuity.coveredDivisor).toBe('26')
  })
})
