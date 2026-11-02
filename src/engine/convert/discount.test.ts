import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { discount } from './discount'

// Not externally verified (no regulator or bank publishes this). Recomputed by hand: 1000 less 20% is 800,
// less 10% is 720; 800 - 50 = 750.
const d = (mrp: string, p: string[], flat = '0') => discount(new D(mrp), p.map((x) => new D(x)), new D(flat))

describe('discount', () => {
  it('one percent', () => {
    const r = d('1000', ['20'])!
    expect([r.final.toFixed(), r.saved.toFixed(), r.effectivePercent.toFixed()]).toEqual(['800', '200', '20'])
  })
  it('stacked percents are not added: 20% then 10% is 28%', () => {
    const r = d('1000', ['20', '10'])!
    expect([r.final.toFixed(), r.effectivePercent.toFixed()]).toEqual(['720', '28'])
  })
  it('flat amount comes off after the percents', () => {
    const r = d('1000', ['20'], '50')!
    expect([r.final.toFixed(), r.saved.toFixed(), r.effectivePercent.toFixed()]).toEqual(['750', '250', '25'])
  })
  it('no discount at all', () => {
    expect(d('500', [])!.final.toFixed()).toBe('500')
  })
  it('boundary: 100% off is free', () => {
    expect(d('999', ['100'])!.final.toFixed()).toBe('0')
  })
  it('invalid input is null', () => {
    expect(d('0', ['10'])).toBeNull()
    expect(d('100', ['101'])).toBeNull()
    expect(d('100', ['-5'])).toBeNull()
    expect(d('100', [], '-1')).toBeNull()
  })
})
