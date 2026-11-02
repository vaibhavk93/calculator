import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { compareRegimes, incomeTax, inHandSalary, presumptive, round10, type TaxInput } from './incomeTax'

const d = (v: string | number) => new D(v)
/** Normal income only, no salary, so no standard deduction gets in the way. */
const onIncome = (regime: 'new' | 'old', income: number, age: TaxInput['age'] = 'below60') =>
  incomeTax({ regime, age, salary: d(0), otherIncome: d(income) })

describe('new regime slab tax', () => {
  // Source: Budget Speech 2025-26, Annexure to Part B, table "Tax on slabs and rates, Proposed"
  // (https://www.indiabudget.gov.in/budget2025-26/doc/budget_speech.pdf). Slabs unchanged for FY 2026-27
  // per Finance Bill 2026 Memorandum Part A.II and Income-tax Act 2025 s.202(1).
  it.each([
    [800000, 20000],
    [900000, 30000],
    [1000000, 40000],
    [1100000, 50000],
    [1200000, 60000],
    [1600000, 120000],
    [2000000, 200000],
    [2400000, 300000],
    [5000000, 1080000],
  ])('income %i: slab tax %i', (income, tax) => {
    expect(onIncome('new', income).slabTax.toFixed()).toBe(String(tax))
  })

  // Same table, "Tax after rebate" column: zero up to 12 lakh, then full tax.
  it.each([
    [1200000, '0'],
    [1600000, '124800'], // 1,20,000 + 4% cess
    [2400000, '312000'], // 3,00,000 + 4% cess
  ])('income %i: total with cess %s', (income, total) => {
    expect(onIncome('new', income).total.toFixed()).toBe(total)
  })
})

describe('new regime rebate and its marginal relief (s.156(2))', () => {
  // Not externally verified with a published figure for 2026-27: independent recomputation.
  // At 12,10,000: slab tax 61,500. Rebate leaves tax = income above 12 lakh = 10,000; +4% cess = 10,400.
  it('at, just below and just above 12 lakh', () => {
    expect(onIncome('new', 1199990).total.toFixed()).toBe('0')
    expect(onIncome('new', 1200000).total.toFixed()).toBe('0')
    expect(onIncome('new', 1200010).total.toFixed()).toBe('10') // tax 10, cess 0.4 -> 10.4 -> 10
    const r = onIncome('new', 1210000)
    expect(r.slabTax.toFixed()).toBe('61500')
    expect(r.rebate.toFixed()).toBe('51500')
    expect(r.total.toFixed()).toBe('10400')
  })
  it('relief ends where the full tax is lower than the income above 12 lakh', () => {
    // Break-even: 60,000 + 15% x (I - 12L) = I - 12L  =>  I - 12L = 70,588.2  => I ~ 12,70,588.
    expect(onIncome('new', 1270000).rebate.toFixed()).toBe('500')
    expect(onIncome('new', 1280000).rebate.toFixed()).toBe('0')
  })
  it('salary of 12.75 lakh is tax-free after the 75,000 standard deduction', () => {
    const r = incomeTax({ regime: 'new', age: 'below60', salary: d(1275000), otherIncome: d(0) })
    expect(r.totalIncome.toFixed()).toBe('1200000')
    expect(r.total.toFixed()).toBe('0')
  })
})

describe('old regime', () => {
  // Source: incometax.gov.in "Return applicable" page, old-regime slab table (cumulative tax at 5L and 10L
  // by age), https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1. Same slabs for
  // 2026-27 per Finance Bill 2026 Memorandum Part I-B Para A.
  it.each([
    ['below60', 1000000, '112500'],
    ['60to80', 1000000, '110000'],
    ['80plus', 1000000, '100000'],
    ['below60', 500000, '12500'],
    ['60to80', 500000, '10000'],
    ['80plus', 500000, '0'],
  ] as const)('%s at %i: slab tax %s', (age, income, tax) => {
    expect(onIncome('old', income, age).slabTax.toFixed()).toBe(tax)
  })
  it('rebate up to 12,500 at 5 lakh, none just above, no marginal relief', () => {
    expect(onIncome('old', 500000).total.toFixed()).toBe('0')
    expect(onIncome('old', 500010).total.toFixed()).toBe('13000') // 12,502 x 1.04 = 13,002.08 -> 13,000
  })
  it('caps deductions at their limits', () => {
    const r = incomeTax({
      regime: 'old',
      age: 'below60',
      salary: d(1500000),
      otherIncome: d(0),
      sec123: d(200000),
      ownNps: d(80000),
      healthSelf: d(40000),
      healthParents: d(60000),
      parentsSenior: true,
      homeLoanInterest: d(300000),
      professionalTax: d(3000),
    })
    const byLabel = Object.fromEntries(r.deductions.map((x) => [x.label.split(/[ ,]/)[0], x.amount.toFixed()]))
    expect(byLabel).toMatchObject({ Standard: '50000', Professional: '2500', 'Home-loan': '200000', PF: '150000', Own: '50000' })
    // 15,00,000 - 50,000 - 2,500 - 2,00,000 - 1,50,000 - 50,000 - 25,000 - 50,000 = 9,72,500
    expect(r.totalIncome.toFixed()).toBe('972500')
  })
  it('the new regime ignores old-regime deductions', () => {
    const r = incomeTax({ regime: 'new', age: 'below60', salary: d(1500000), otherIncome: d(0), sec123: d(150000), hraExempt: d(100000) })
    expect(r.totalIncome.toFixed()).toBe('1425000')
  })
})

describe('surcharge and its marginal relief', () => {
  // Rates: Finance Bill 2026 Memorandum, Part A.II (10% > 50L, 15% > 1Cr, 25% > 2Cr, 37% > 5Cr old only,
  // new regime capped at 25%). Not externally verified with published figures: independent recomputation.
  it('nothing at exactly 50 lakh; 10,80,000 x 1.04', () => {
    const r = onIncome('new', 5000000)
    expect(r.surcharge.toFixed()).toBe('0')
    expect(r.total.toFixed()).toBe('1123200')
  })
  it('just above 50 lakh, relief limits tax + surcharge to 10,80,000 + the excess', () => {
    // 50,10,000: tax 10,83,000; 10% = 1,08,300; ceiling 10,80,000 + 10,000 - 10,83,000 = 7,000.
    const r = onIncome('new', 5010000)
    expect(r.surcharge.toFixed()).toBe('7000')
  })
  it('well above 50 lakh, full 10%', () => {
    // 60L: tax 3,00,000 + 30% x 36L = 13,80,000; surcharge 1,38,000 (ceiling 20,80,000 - not binding).
    expect(onIncome('new', 6000000).surcharge.toFixed()).toBe('138000')
  })
  it('just above 1 crore: relief against the 10% level', () => {
    // At 1Cr: tax 3,00,000 + 30% x 76L = 25,80,000, + 10% = 28,38,000. At 1,00,10,000: tax 25,83,000;
    // 15% = 3,87,450; ceiling 28,38,000 + 10,000 - 25,83,000 = 2,65,000.
    expect(onIncome('new', 10010000).surcharge.toFixed()).toBe('265000')
  })
  it('new regime caps at 25% above 5 crore, old regime goes to 37%', () => {
    const n = onIncome('new', 60000000)
    expect(n.surcharge.div(n.slabTax).times(100).toFixed()).toBe('25')
    const o = onIncome('old', 60000000)
    expect(o.surcharge.div(o.slabTax).times(100).toFixed()).toBe('37')
  })
})

describe('rounding (s.516)', () => {
  it('nearest 10, five rounds up', () => {
    expect(round10(d('104')).toFixed()).toBe('100')
    expect(round10(d('105')).toFixed()).toBe('110')
    expect(round10(d('109.99')).toFixed()).toBe('110')
  })
})

describe('compareRegimes', () => {
  // Independent recomputation. Salary 15L, 80C 1.5L, 80D 25k, home-loan 2L.
  // Old: 15L - 50k - 1.5L - 25k - 2L = 10,75,000 -> 1,12,500 + 22,500 = 1,35,000 x 1.04 = 1,40,400.
  // New: 15L - 75k = 14,25,000 -> 60,000 + 33,750 = 93,750 x 1.04 = 97,500.
  it('names the cheaper regime and the difference', () => {
    const c = compareRegimes({ age: 'below60', salary: d(1500000), otherIncome: d(0), sec123: d(150000), healthSelf: d(25000), homeLoanInterest: d(200000) })
    expect(c.old.total.toFixed()).toBe('140400')
    expect(c.new.total.toFixed()).toBe('97500')
    expect(c.cheaper).toBe('new')
    expect(c.saving.toFixed()).toBe('42900')
  })
})

describe('in-hand salary', () => {
  // Independent recomputation. CTC 12L, basic 50% = 6L; PF 12% = 72,000 each side; gratuity 6L x 15/26/12 = 28,846.15.
  // Gross = 12L - 72,000 - 28,846.15 = 10,99,153.85 -> new regime: 10,24,150 (rounded) -> rebate -> tax 0.
  it('works out take-home', () => {
    const r = inHandSalary({
      ctc: d(1200000),
      basicPct: d(50),
      pfPct: d(12),
      employerPfInCtc: true,
      gratuityInCtc: true,
      professionalTaxMonthly: d(200),
      hraExempt: d(0),
      age: 'below60',
    })!
    expect(r.gratuity.toFixed(2)).toBe('28846.15')
    expect(r.incomeTax.toFixed()).toBe('0')
    expect(r.annualInHand.toFixed(2)).toBe('1024753.85') // 10,99,153.85 - 72,000 - 2,400
  })
  it('rejects nonsense', () => {
    expect(inHandSalary({ ctc: d(0), basicPct: d(50), pfPct: d(12), employerPfInCtc: true, gratuityInCtc: true, professionalTaxMonthly: d(0), hraExempt: d(0), age: 'below60' })).toBeNull()
  })
})

describe('presumptive (s.58 Table Sl.3)', () => {
  const base = { cashPct: d(0), expenses: d(1000000), otherIncome: d(0), regime: 'new' as const, age: 'below60' as const }
  it('limit is 75 lakh with cash at or below 5%, 50 lakh above it', () => {
    expect(presumptive({ ...base, receipts: d(7500000) })!.eligible).toBe(true)
    expect(presumptive({ ...base, receipts: d(7500010) })!.eligible).toBe(false)
    expect(presumptive({ ...base, receipts: d(5000000), cashPct: d(5) })!.eligible).toBe(true)
    expect(presumptive({ ...base, receipts: d(5000010), cashPct: d('5.01') })!.eligible).toBe(false)
  })
  it('deems 50% as profit; flags the audit when declaring less', () => {
    const r = presumptive({ ...base, receipts: d(3000000), expenses: d(2000000) })!
    if (!r.eligible) throw new Error('expected eligible')
    expect(r.presumptiveIncome.toFixed()).toBe('1500000')
    expect(r.actualProfit.toFixed()).toBe('1000000')
    expect(r.actualNeedsAudit).toBe(true)
  })
})
