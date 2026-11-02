import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { fuelCost, fuelEfficiency } from './fuel'

const e = (v: string, u: Parameters<typeof fuelEfficiency>[1]) => fuelEfficiency(new D(v), u)

describe('fuelCost', () => {
  // Not externally verified (arithmetic): 300 km at 15 km/l = 20 l; at Rs 100 = Rs 2,000; Rs 6.67/km.
  it('litres, trip cost and cost per km', () => {
    const r = fuelCost(new D(300), new D(15), new D(100))!
    expect([r.litres, r.cost].map((v) => v.toFixed())).toEqual(['20', '2000'])
    expect(r.perKm.toDecimalPlaces(2).toFixed()).toBe('6.67')
  })
  it('invalid input is null', () => {
    expect(fuelCost(new D(0), new D(15), new D(100))).toBeNull()
    expect(fuelCost(new D(100), new D(0), new D(100))).toBeNull()
    expect(fuelCost(new D(100), new D(10), new D(-1))).toBeNull()
  })
})

// Published conversions (Wikipedia "Fuel economy in automobiles", derived from NIST exact units):
// 1 mpg (US) = 235.215 l/100 km, 1 mpg (UK) = 282.481 l/100 km, 1 mpg (US) = 0.425144 km/l.
describe('fuelEfficiency', () => {
  it('matches the published figures', () => {
    expect(e('1', 'mpgus')!.l100.toDecimalPlaces(3).toFixed()).toBe('235.215')
    expect(e('1', 'mpguk')!.l100.toDecimalPlaces(3).toFixed()).toBe('282.481')
    expect(e('1', 'mpgus')!.kmpl.toDecimalPlaces(6).toFixed()).toBe('0.425144')
  })
  it('km/l and l/100km are reciprocal', () => {
    expect(e('20', 'kmpl')!.l100.toFixed()).toBe('5')
    expect(e('5', 'l100')!.kmpl.toFixed()).toBe('20')
  })
  it('zero or negative is null', () => {
    expect(e('0', 'l100')).toBeNull()
    expect(e('-3', 'kmpl')).toBeNull()
  })
})
