import { describe, expect, it } from 'vitest'
import { D, type Dec } from '../decimal'
import { advanceTax } from './advanceTax'
import { addMonths, capitalGains, type CgInput } from './capitalGains'
import { gratuity } from './gratuity'

const d = (v: string | number) => new D(v)

// ---- capital gains ------------------------------------------------------------------
// Rates from the Income-tax Act 2025 ss.196-198 and s.2(101) (holding periods). No published worked example
// for tax year 2026-27 was found: these are independent recomputations, labelled as such.

const cg = (o: Partial<CgInput>) =>
  capitalGains({
    asset: 'equity',
    buyDate: '2025-01-10',
    sellDate: '2026-06-10',
    buyPrice: d(500000),
    sellPrice: d(800000),
    expenses: d(0),
    slabPct: d(30),
    exemptionUsed: d(0),
    ...o,
  })

describe('holding period', () => {
  it('adds months and clamps month ends', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2025-05-10', 12)).toBe('2026-05-10')
  })
  it('long-term only when held MORE than 12 months (equity)', () => {
    expect(cg({ buyDate: '2025-05-10', sellDate: '2026-05-10' })).toMatchObject({ term: 'short' })
    expect(cg({ buyDate: '2025-05-10', sellDate: '2026-05-11' })).toMatchObject({ term: 'long' })
  })
  it('24 months for property and gold', () => {
    expect(cg({ asset: 'gold', buyDate: '2024-05-10', sellDate: '2026-05-10' })).toMatchObject({ term: 'short' })
    expect(cg({ asset: 'gold', buyDate: '2024-05-10', sellDate: '2026-05-11' })).toMatchObject({ term: 'long' })
  })
  it('debt fund bought on/after 1 Apr 2023 is always short-term (s.76)', () => {
    expect(cg({ asset: 'debtFund', buyDate: '2023-04-01', sellDate: '2026-06-01' })).toMatchObject({ term: 'short', rateKind: 'slab' })
    expect(cg({ asset: 'debtFund', buyDate: '2023-03-31', sellDate: '2026-06-01' })).toMatchObject({ term: 'long', ratePct: d('12.5') })
  })
})

describe('capital gains tax', () => {
  it('equity STCG 20%', () => {
    const r = cg({ buyDate: '2026-01-10' }) as { tax: Dec; total: Dec }
    expect(r.tax.toFixed()).toBe('60000')
    expect(r.total.toFixed()).toBe('62400')
  })
  it('equity LTCG 12.5% above Rs 1.25 lakh, minus what was already used', () => {
    expect((cg({}) as { tax: Dec }).tax.toFixed()).toBe('21875') // (3L - 1.25L) x 12.5%
    expect((cg({ exemptionUsed: d(100000) }) as { tax: Dec }).tax.toFixed()).toBe('34375') // (3L - 25k) x 12.5%
    expect((cg({ sellPrice: d(625000) }) as { tax: Dec }).tax.toFixed()).toBe('0')
  })
  it('property bought before 23 Jul 2024: lower of 12.5% flat and 20% indexed', () => {
    // Bought FY2015-16 (CII 254) for 30L, sold FY2026-27 (CII 384) for 80L.
    // Flat: 50L x 12.5% = 6,25,000. Indexed cost 30L x 384/254 = 45,35,433.07; gain 34,64,566.93 x 20% = 6,92,913.39.
    const r = cg({ asset: 'property', buyDate: '2015-06-01', sellDate: '2026-06-01', buyPrice: d(3000000), sellPrice: d(8000000) })
    if ('error' in r) throw new Error(r.error)
    expect(r.indexed!.tax.toFixed(2)).toBe('692913.39')
    expect(r.indexed!.chosen).toBe('flat')
    expect(r.tax.toFixed()).toBe('625000')
    // Smaller rise: 30L -> 50L. Flat 2,50,000; indexed gain 4,64,566.93 x 20% = 92,913.39 -> indexed wins.
    const s = cg({ asset: 'property', buyDate: '2015-06-01', sellDate: '2026-06-01', buyPrice: d(3000000), sellPrice: d(5000000) })
    if ('error' in s) throw new Error(s.error)
    expect(s.indexed!.chosen).toBe('indexed')
    expect(s.tax.toFixed(2)).toBe('92913.39')
  })
  it('property bought on/after 23 Jul 2024 gets no indexation option', () => {
    const r = cg({ asset: 'property', buyDate: '2024-07-23', sellDate: '2026-08-01', buyPrice: d(3000000), sellPrice: d(4000000) })
    if ('error' in r) throw new Error(r.error)
    expect(r.indexed).toBeUndefined()
    expect(r.tax.toFixed()).toBe('125000')
  })
  it('a loss is no tax', () => {
    expect((cg({ sellPrice: d(400000) }) as { tax: Dec }).tax.toFixed()).toBe('0')
  })
  it('refuses what it cannot do', () => {
    expect(cg({ sellDate: '2026-03-31' })).toHaveProperty('error')
    expect(cg({ buyDate: '2017-01-01' })).toHaveProperty('error')
    expect(cg({ asset: 'property', buyDate: '1999-01-01' })).toHaveProperty('error')
    expect(cg({ buyDate: '2026-07-01', sellDate: '2026-06-01' })).toHaveProperty('error')
  })
})

// ---- advance tax --------------------------------------------------------------------
// Rules: Income-tax Act 2025 ss.404, 408, 424, 425. No published worked example under the 2025 Act was
// found; independent recomputation.

describe('advance tax', () => {
  const base = { tax: d(200000), tds: d(50000), presumptive: false, seniorNoBusiness: false, monthsAfterYear: 4 }
  it('nothing due under Rs 10,000 or for a senior with no business', () => {
    expect(advanceTax({ ...base, tds: d(195000), paid: [d(0), d(0), d(0), d(0)] })).toMatchObject({ required: false, reason: 'below' })
    expect(advanceTax({ ...base, seniorNoBusiness: true, paid: [d(0), d(0), d(0), d(0)] })).toMatchObject({ required: false, reason: 'senior' })
  })
  it('paid on time: no interest', () => {
    const r = advanceTax({ ...base, paid: [d(22500), d(45000), d(45000), d(37500)] })!
    if (!r.required) throw new Error()
    expect(r.totalInterest.toFixed()).toBe('0')
  })
  it('nothing paid: s.425 3/3/3/1% and s.424 1% a month', () => {
    // net 1,50,000. Shortfalls 22,500 / 67,500 / 1,12,500 / 1,50,000 -> 675 + 2,025 + 3,375 + 1,500 = 7,575.
    // s.424: 1,50,000 x 1% x 4 = 6,000.
    const r = advanceTax({ ...base, paid: [d(0), d(0), d(0), d(0)] })!
    if (!r.required) throw new Error()
    expect(r.interest425.toFixed()).toBe('7575')
    expect(r.interest424.toFixed()).toBe('6000')
  })
  it('12% by June and 36% by September is safe; 90% avoids s.424', () => {
    // 12% of 1,50,000 = 18,000; 36% = 54,000. Dec: due 1,12,500, paid 54,000 + 58,500 = 1,12,500. Mar: 1,35,000 paid.
    const r = advanceTax({ ...base, paid: [d(18000), d(36000), d(58500), d(22500)] })!
    if (!r.required) throw new Error()
    expect(r.rows.map((x) => x.interest.toFixed())).toEqual(['0', '0', '0', '150'])
    expect(r.interest424.toFixed()).toBe('0') // 1,35,000 is exactly 90%
  })
  it('presumptive: everything by 15 March only', () => {
    const r = advanceTax({ ...base, presumptive: true, paid: [d(0), d(0), d(0), d(100000)] })!
    if (!r.required) throw new Error()
    expect(r.rows.map((x) => x.interest.toFixed())).toEqual(['0', '0', '0', '500'])
  })
})

// ---- gratuity -----------------------------------------------------------------------
// Formula: Payment of Gratuity Act 1972 s.4(2) (wage x 15 / 26 per year, a part year over six months counts),
// exemption Income-tax Act 2025 s.19 Table Sl.5-6. No published numeric example found; independent recomputation.

describe('gratuity', () => {
  it('covered: 15/26 x wage x years, part year over 6 months rounds up', () => {
    const r = gratuity({ wage: d(52000), years: 10, months: 7, covered: true, received: null })!
    expect(r.countedYears).toBe(11)
    expect(r.formula.toFixed()).toBe('330000') // 52,000 x 15 / 26 x 11
    expect(r.exempt.toFixed()).toBe('330000')
    expect(gratuity({ wage: d(52000), years: 10, months: 6, covered: true, received: null })!.countedYears).toBe(10)
  })
  it('covered: capped at Rs 20 lakh; anything paid above it is taxable', () => {
    const r = gratuity({ wage: d(260000), years: 20, months: 0, covered: true, received: d(3000000) })!
    expect(r.formula.toFixed()).toBe('3000000')
    expect(r.payable.toFixed()).toBe('2000000')
    expect(r.taxable.toFixed()).toBe('1000000')
  })
  it('not covered: half a month per completed year, no rounding up', () => {
    const r = gratuity({ wage: d(60000), years: 10, months: 11, covered: false, received: d(400000) })!
    expect(r.countedYears).toBe(10)
    expect(r.formula.toFixed()).toBe('300000')
    expect(r.exempt.toFixed()).toBe('300000')
    expect(r.taxable.toFixed()).toBe('100000')
  })
  it('rejects bad input', () => {
    expect(gratuity({ wage: d(1), years: 1, months: 12, covered: true, received: null })).toBeNull()
  })
})
