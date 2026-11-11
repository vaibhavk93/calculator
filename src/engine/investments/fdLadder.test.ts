import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { RULES_FY2026_27 } from '../tax/rules.FY2026-27'
import { fdLadder, type Rung } from './fdLadder'
import { DICGC } from './rates'

const rung = (bank: string, p: string, r: string, y: string): Rung => ({ bank, principal: new D(p), ratePct: new D(r), years: new D(y) })
const run = (rs: Rung[], senior = false) => fdLadder(rs, { senior, perYear: 4 })!
const n = (x: { toString(): string }) => Number(x.toString())

describe('FD ladder', () => {
  it('uses the primary-source numbers: DICGC Rs 5,00,000; TDS Rs 50,000 / Rs 1,00,000 at 10%', () => {
    expect(DICGC.cover).toBe('500000')
    expect(RULES_FY2026_27.tdsBankInterest).toEqual({ thresholdSenior: '100000', thresholdOther: '50000', ratePct: '10' })
  })

  it('compounds quarterly: 1,00,000 at 7% for 5 years is 1,41,478.07 (fd 1.0175^20)', () => {
    // 1.0175^20 = 1.414778... (hand-worked: ln 1.0175 = 0.0173486, x20 = 0.346972, exp = 1.414778)
    const r = run([rung('A', '100000', '7', '5')])
    expect(n(r.rungs[0]!.maturity.toDecimalPlaces(0))).toBe(141478)
    expect(n(r.principal)).toBe(100000)
    expect(n(r.interest.toDecimalPlaces(0))).toBe(41478)
  })

  it('first-year interest is the whole term when the rung is shorter than a year', () => {
    const r = run([rung('A', '100000', '8', '0.5')])
    expect(r.rungs[0]!.firstYearInterest.eq(r.rungs[0]!.interest)).toBe(true)
  })

  it('DICGC: principal 4,95,000 plus 4,000 interest is covered; 5,00,000 principal leaves its interest uncovered', () => {
    // From the DICGC guide: the cover is on principal and interest together.
    const covered = run([rung('A', '495000', '1', '1')])
    // 4,95,000 at 1% for a year is about 4,975 of interest: 4,99,975 in all, still under 5,00,000.
    expect(covered.banks[0]!.notInsured.isZero()).toBe(true)
    const over = run([rung('A', '500000', '7', '1')])
    expect(over.banks[0]!.principalOver).toBe(false)
    expect(over.banks[0]!.notInsured.gt(0)).toBe(true) // the interest is uncovered
    expect(n(over.banks[0]!.insured)).toBe(500000)
  })

  it('one bank name shares one limit across rungs, ignoring case and spaces; another bank has its own', () => {
    const r = run([rung('SBI', '300000', '7', '1'), rung(' sbi  ', '300000', '7', '2'), rung('HDFC', '300000', '7', '1')])
    expect(r.banks.map((b) => [b.bank, b.rungs])).toEqual([['SBI', 2], ['HDFC', 1]])
    const sbi = r.banks[0]!
    expect(sbi.principalOver).toBe(true) // 6,00,000 at one bank
    expect(n(sbi.insured)).toBe(500000)
    expect(sbi.notInsured.gt(100000)).toBe(true)
    expect(r.banks[1]!.notInsured.isZero()).toBe(true) // 3,00,000 at another bank is fine
  })

  it('TDS flag: first-year interest strictly above 50,000 (1,00,000 if 60+)', () => {
    // 7,00,000 at 7.5% quarterly: about 53,900 in the first year.
    const rs = [rung('A', '700000', '7.5', '3')]
    expect(run(rs).banks[0]!.tdsApplies).toBe(true)
    expect(run(rs, true).banks[0]!.tdsApplies).toBe(false) // 60+ threshold is 1,00,000
    expect(n(run(rs, true).tdsThreshold)).toBe(100000)
    // Exactly at the threshold is not "exceeding": interest of exactly 50,000 simple (compounding off) is not flagged.
    const flat = fdLadder([rung('A', '500000', '10', '1')], { senior: false, perYear: 1 })!
    expect(n(flat.banks[0]!.firstYearInterest)).toBe(50000)
    expect(flat.banks[0]!.tdsApplies).toBe(false)
  })

  it('spreading the same money over two banks avoids the TDS flag', () => {
    const one = run([rung('A', '1000000', '7', '2')])
    const two = run([rung('A', '500000', '7', '2'), rung('B', '500000', '7', '2')])
    expect(one.banks[0]!.tdsApplies).toBe(true)
    expect(two.banks.some((b) => b.tdsApplies)).toBe(false)
    expect(two.banks.every((b) => b.firstYearInterest.lt(50000))).toBe(true)
  })

  it('blended rate is principal-weighted', () => {
    const r = run([rung('A', '100000', '6', '1'), rung('B', '300000', '8', '2')])
    expect(n(r.blendedPct)).toBe(7.5)
  })

  it('totals add up', () => {
    const r = run([rung('A', '100000', '6', '1'), rung('B', '300000', '8', '2')])
    expect(n(r.principal)).toBe(400000)
    expect(r.atMaturity.eq(r.rungs[0]!.maturity.plus(r.rungs[1]!.maturity))).toBe(true)
    expect(r.interest.eq(r.atMaturity.minus(r.principal))).toBe(true)
  })

  it('refuses nothing to ladder, zero money, negative rates or zero time', () => {
    expect(fdLadder([], { senior: false, perYear: 4 })).toBeNull()
    expect(run([rung('A', '1', '7', '1')])).not.toBeNull()
    expect(fdLadder([rung('A', '0', '7', '1')], { senior: false, perYear: 4 })).toBeNull()
    expect(fdLadder([rung('A', '1000', '-1', '1')], { senior: false, perYear: 4 })).toBeNull()
    expect(fdLadder([rung('A', '1000', '7', '0')], { senior: false, perYear: 4 })).toBeNull()
  })
})
