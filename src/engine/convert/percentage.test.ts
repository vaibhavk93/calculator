import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { percentage } from './percentage'

const p = (m: Parameters<typeof percentage>[0], x: string, y: string) => percentage(m, new D(x), new D(y))?.toFixed() ?? null

describe('percentage', () => {
  it('X% of Y', () => {
    expect(p('of', '18', '45000')).toBe('8100')
    expect(p('of', '12.5', '80')).toBe('10')
  })
  it('X is what % of Y', () => {
    expect(p('whatPercent', '25', '200')).toBe('12.5')
    expect(p('whatPercent', '1', '3')).toBe('33.33333333333333333333333333333333333333')
  })
  it('% change, up and down', () => {
    expect(p('change', '80', '100')).toBe('25')
    expect(p('change', '100', '80')).toBe('-20')
  })
  it('undefined cases are null, never NaN or Infinity', () => {
    expect(p('whatPercent', '5', '0')).toBeNull()
    expect(p('change', '0', '5')).toBeNull()
  })
})
