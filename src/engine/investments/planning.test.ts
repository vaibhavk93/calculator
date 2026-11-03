import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { debtToIncome, emergencyFund, savingsRate } from './planning'

// Not externally verified: plain arithmetic, hand-worked below. The DTI band edges are lender rules of thumb, not a law.
describe('emergency fund', () => {
  it('30,000 x 6 months = 1,80,000 target; 1,20,000 saved is 4 months and 60,000 short', () => {
    const r = emergencyFund(new D(30000), new D(6), new D(120000))!
    expect(r.target.toFixed()).toBe('180000')
    expect(r.gap.toFixed()).toBe('60000')
    expect(r.monthsCovered.toFixed()).toBe('4')
  })
  it('a surplus is a negative gap', () => {
    expect(emergencyFund(new D(30000), new D(6), new D(200000))!.gap.toFixed()).toBe('-20000')
  })
  it('zero expenses is null, not a divide by zero', () => {
    expect(emergencyFund(new D(0), new D(6), new D(1))).toBeNull()
  })
})

describe('debt to income', () => {
  const dti = (inc: string, ob: string) => debtToIncome(new D(inc), new D(ob), new D(36), new D(50))!
  it('30,000 on 1,00,000 is 30%: comfortable, 6,000 of room under 36%', () => {
    const r = dti('100000', '30000')
    expect(r.pct.toFixed()).toBe('30')
    expect(r.band).toBe('comfortable')
    expect(r.roomAtComfortable.toFixed()).toBe('6000')
  })
  it('the edges belong to the lower band: 36% comfortable, 50% stretched', () => {
    expect(dti('100000', '36000').band).toBe('comfortable')
    expect(dti('100000', '36001').band).toBe('stretched')
    expect(dti('100000', '50000').band).toBe('stretched')
    expect(dti('100000', '50001').band).toBe('high')
  })
  it('zero income is null', () => {
    expect(debtToIncome(new D(0), new D(1), new D(36), new D(50))).toBeNull()
  })
})

describe('savings rate', () => {
  it('1,00,000 earned, 70,000 spent: 30% saved, 3,60,000 a year', () => {
    const r = savingsRate(new D(100000), { spend: new D(70000) })!
    expect(r.pct.toFixed()).toBe('30')
    expect(r.saved.toFixed()).toBe('30000')
    expect(r.annualSaved.toFixed()).toBe('360000')
  })
  it('giving savings instead of spend gives the same answer', () => {
    const r = savingsRate(new D(100000), { saved: new D(30000) })!
    expect(r.spent.toFixed()).toBe('70000')
    expect(r.pct.toFixed()).toBe('30')
  })
  it('spending above income is a negative rate', () => {
    expect(savingsRate(new D(100), { spend: new D(120) })!.pct.toFixed()).toBe('-20')
  })
  it('zero income is null', () => {
    expect(savingsRate(new D(0), { spend: new D(1) })).toBeNull()
  })
})
