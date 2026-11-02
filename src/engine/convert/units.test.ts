import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { convertAll, convertUnit } from './units'

const c = (cat: string, from: string, to: string, v: string) => convertUnit(cat, from, to, new D(v))?.toDecimalPlaces(10).toFixed() ?? null

// Source for the exact factors: NIST SP 811, Appendix B (1 in = 0.0254 m, 1 lb = 0.45359237 kg,
// 1 US gal = 3.785411784 L, 1 acre = 4046.8564224 m2, 1 mi = 1609.344 m). Test values are those definitions.
describe('convertUnit', () => {
  it('length, mass, volume, area follow the NIST definitions', () => {
    expect(c('length', 'in', 'cm', '1')).toBe('2.54')
    expect(c('length', 'mi', 'km', '1')).toBe('1.609344')
    expect(c('mass', 'lb', 'g', '1')).toBe('453.59237')
    expect(c('volume', 'galus', 'ml', '1')).toBe('3785.411784')
    expect(c('area', 'acre', 'sqm', '1')).toBe('4046.8564224')
  })
  it('Indian land: 1 acre is 100 cents and 43,560 sq ft', () => {
    expect(c('area', 'acre', 'cent', '1')).toBe('100')
    expect(c('area', 'acre', 'sqft', '1')).toBe('43560')
    expect(c('area', 'ha', 'acre', '1')).toBe('2.4710538147')
  })
  it('speed, time and data', () => {
    expect(c('speed', 'kmh', 'ms', '36')).toBe('10')
    expect(c('speed', 'kn', 'kmh', '1')).toBe('1.852')
    expect(c('time', 'd', 'h', '1')).toBe('24')
    expect(c('data', 'GiB', 'MiB', '1')).toBe('1024')
    expect(c('data', 'GB', 'MB', '1')).toBe('1000')
    expect(c('data', 'B', 'bit', '1')).toBe('8')
  })
  it('temperature, including the points where scales meet', () => {
    expect(c('temperature', 'C', 'F', '100')).toBe('212')
    expect(c('temperature', 'F', 'C', '-40')).toBe('-40')
    expect(c('temperature', 'C', 'K', '0')).toBe('273.15')
    expect(c('temperature', 'K', 'C', '0')).toBe('-273.15')
  })
  it('same unit gives the same value; unknown unit is null', () => {
    expect(c('length', 'm', 'm', '7.5')).toBe('7.5')
    expect(c('length', 'm', 'zz', '1')).toBeNull()
    expect(c('nope', 'm', 'm', '1')).toBeNull()
  })
  it('convertAll lists every unit of the category', () => {
    expect(convertAll('mass', 'kg', new D(1)).map((r) => r.unit.id)).toContain('lb')
    expect(convertAll('nope', 'x', new D(1))).toEqual([])
  })
})
