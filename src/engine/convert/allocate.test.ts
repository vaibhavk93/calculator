import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { allocate } from './allocate'

const a = (t: string, w: string[] | number, dp = 2) => allocate(new D(t), typeof w === 'number' ? w : w.map((x) => new D(x)), dp)?.map((v) => v.toFixed()) ?? null
const sum = (xs: string[]) => xs.reduce((s, x) => s.plus(x), new D(0)).toFixed()

describe('allocate (largest remainder)', () => {
  it('100 three ways: the extra paisa goes to person 1', () => {
    expect(a('100', 3)).toEqual(['33.34', '33.33', '33.33'])
  })
  it('0.01 three ways: one paisa, to the first', () => {
    expect(a('0.01', 3)).toEqual(['0.01', '0', '0'])
  })
  it('1 seven ways: 14.28 paise each, so the 2 extra paise go to the first two', () => {
    const r = a('1', 7)!
    expect(r).toEqual(['0.15', '0.15', '0.14', '0.14', '0.14', '0.14', '0.14'])
    expect(sum(r)).toBe('1')
  })
  it('always sums exactly, for many splits', () => {
    for (const [t, n] of [['2640', 7], ['999.99', 13], ['0.07', 4], ['12345.67', 9], ['100', 1]] as const) {
      expect(sum(a(t, n)!)).toBe(new D(t).toFixed())
    }
  })
  it('weights: largest remainder wins, not the first', () => {
    // 10 split 1:2 -> 3.333.. and 6.666..; the extra paisa goes to the 6.666.. share
    expect(a('10', ['1', '2'])).toEqual(['3.33', '6.67'])
    expect(a('100', ['50', '30', '20'])).toEqual(['50', '30', '20'])
  })
  it('a zero weight gets nothing', () => {
    expect(a('10', ['1', '0', '1'])).toEqual(['5', '0', '5'])
  })
  it('zero total gives zeros', () => {
    expect(a('0', 3)).toEqual(['0', '0', '0'])
  })
  it('negative total splits by size, then flips the sign', () => {
    expect(a('-100', 3)).toEqual(['-33.34', '-33.33', '-33.33'])
  })
  it('rounds the total to the unit first; zero decimals works', () => {
    expect(sum(a('10.005', 3)!)).toBe('10.01')
    expect(a('10', 3, 0)).toEqual(['4', '3', '3'])
  })
  it('null for unusable input', () => {
    expect(a('100', 0)).toBeNull()
    expect(a('100', 2.5)).toBeNull()
    expect(a('100', [])).toBeNull()
    expect(a('100', ['0', '0'])).toBeNull()
    expect(a('100', ['1', '-1'])).toBeNull()
    expect(a('100', 3, -1)).toBeNull()
  })
})
