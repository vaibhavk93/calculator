import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { hraExemption, type HraInput } from './hra'
import { RULES_FY2026_27 } from './rules.FY2026-27'

/** A full year in Bengaluru (a 50% city under Rule 279 since 1 Apr 2026). */
const base = (o: Partial<HraInput> = {}): HraInput => ({
  basic: new D('50000'),
  da: new D('0'),
  hra: new D('25000'),
  rent: new D('20000'),
  metro: true,
  months: 12,
  newRegime: false,
  ...o,
})
const n = (x: { toString(): string }) => Number(x.toString())

describe('HRA exemption, Rule 279', () => {
  it('matches the worked example in docs/RESEARCH-BLOCKED-2026-11-06.md section 2', () => {
    // That example is stated in YEARLY figures: salary 6,00,000, HRA 3,00,000, rent 2,40,000, Bengaluru.
    // Limbs: (a) 3,00,000  (b) 2,40,000 - 60,000 = 1,80,000  (c) 50% of 6,00,000 = 3,00,000.
    // Exempt 1,80,000, taxable HRA 1,20,000.
    const r = hraExemption(base({ basic: new D('50000'), hra: new D('25000'), rent: new D('20000') }))!
    expect(n(r.salary)).toBe(600000)
    expect(n(r.received)).toBe(300000)
    expect(n(r.rentPaid)).toBe(240000)
    expect(n(r.limbs.actual)).toBe(300000)
    expect(n(r.limbs.rentOverTenth)).toBe(180000)
    expect(n(r.limbs.shareOfSalary)).toBe(300000)
    expect(n(r.exempt)).toBe(180000)
    expect(n(r.taxable)).toBe(120000)
    expect(r.binding).toBe('rentOverTenth')
  })

  it('uses 40% outside the eight listed cities, which can change the answer', () => {
    // Salary 6,00,000: metro limb 3,00,000, non-metro limb 2,40,000. Rent limb 1,80,000 still binds here...
    const metro = hraExemption(base())!
    const other = hraExemption(base({ metro: false }))!
    expect(n(metro.exempt)).toBe(180000)
    expect(n(other.exempt)).toBe(180000)
    // ...so push rent up until the city share is what bites.
    const highRent = { rent: new D('60000') } // 7,20,000 a year, limb (b) = 6,60,000
    expect(n(hraExemption(base({ ...highRent }))!.exempt)).toBe(300000) // 50% of salary
    expect(n(hraExemption(base({ ...highRent, metro: false }))!.exempt)).toBe(240000) // 40% of salary
    expect(hraExemption(base({ ...highRent, metro: false }))!.binding).toBe('shareOfSalary')
  })

  it('counts DA only when it is passed (terms of employment), and never other allowances', () => {
    const withDa = hraExemption(base({ basic: new D('40000'), da: new D('10000') }))!
    // Same 50,000 a month of basic+DA, so the same salary and the same answer as basic-only.
    expect(n(withDa.salary)).toBe(600000)
    expect(n(withDa.exempt)).toBe(180000)
  })

  it('gives nothing in the new regime, and still reports the HRA as fully taxable', () => {
    const r = hraExemption(base({ newRegime: true }))!
    expect(n(r.exempt)).toBe(0)
    expect(n(r.taxable)).toBe(300000)
    // The limbs are still computed, so the screen can show what the old regime would have given.
    expect(n(r.limbs.rentOverTenth)).toBe(180000)
  })

  it('never goes negative when rent is under a tenth of salary', () => {
    const r = hraExemption(base({ rent: new D('1000') }))! // 12,000 a year vs a tenth of salary 60,000
    expect(n(r.limbs.rentOverTenth)).toBe(-48000)
    expect(n(r.exempt)).toBe(0)
    expect(n(r.taxable)).toBe(300000)
  })

  it('no rent paid means no exemption (Schedule III Sl.11(d))', () => {
    expect(n(hraExemption(base({ rent: new D('0') }))!.exempt)).toBe(0)
  })

  it('caps at the HRA actually received, however high the rent', () => {
    const r = hraExemption(base({ hra: new D('5000'), rent: new D('90000') }))!
    expect(n(r.exempt)).toBe(60000) // the whole year's HRA, nothing more
    expect(n(r.taxable)).toBe(0)
    expect(r.binding).toBe('actual')
  })

  it('prorates by the months the home was occupied (Rule 279(2)(a) relevant period)', () => {
    const half = hraExemption(base({ months: 6 }))!
    expect(n(half.salary)).toBe(300000)
    expect(n(half.received)).toBe(150000)
    expect(n(half.rentPaid)).toBe(120000)
    expect(n(half.exempt)).toBe(90000) // 1,20,000 - 30,000
  })

  it('flags the landlord PAN strictly above Rs 1,00,000 of rent in the year (Rule 205)', () => {
    expect(hraExemption(base({ rent: new D('20000') }))!.landlordPanNeeded).toBe(true)
    // Exactly 1,00,000 is not "exceeds 1,00,000".
    const at = hraExemption(base({ rent: new D('100000'), months: 1 }))!
    expect(n(at.rentPaid)).toBe(100000)
    expect(at.landlordPanNeeded).toBe(false)
    const over = hraExemption(base({ rent: new D('100001'), months: 1 }))!
    expect(over.landlordPanNeeded).toBe(true)
  })

  it('rejects impossible inputs rather than inventing an answer', () => {
    expect(hraExemption(base({ months: 0 }))).toBeNull()
    expect(hraExemption(base({ months: 13 }))).toBeNull()
    expect(hraExemption(base({ months: 1.5 }))).toBeNull()
    expect(hraExemption(base({ basic: new D('-1') }))).toBeNull()
    expect(hraExemption(base({ rent: new D('-1') }))).toBeNull()
    expect(hraExemption(base({ hra: new D('-1') }))).toBeNull()
    expect(hraExemption(base({ da: new D('-1') }))).toBeNull()
  })

  it('reads its percentages from the rules pack, not from literals in the code', () => {
    const k = RULES_FY2026_27.hra
    expect([k.metroPct, k.otherPct, k.rentLessSalaryPct]).toEqual(['50', '40', '10'])
    expect(k.metroCities).toContain('Bengaluru')
  })

  it('keeps full precision on amounts that do not divide evenly', () => {
    // basic 33,333.33 x 12 = 3,99,999.96; a tenth is 39,999.996.
    const r = hraExemption(base({ basic: new D('33333.33'), rent: new D('10000'), hra: new D('15000') }))!
    expect(r.salary.toString()).toBe('399999.96')
    expect(r.limbs.rentOverTenth.toString()).toBe('80000.004')
    expect(n(r.exempt)).toBeCloseTo(80000.004, 3)
  })
})
