import { describe, expect, it } from 'vitest'
import { cleanMoney } from './formKit'

describe('cleanMoney (B-06)', () => {
  it('reads a comma typed as the decimal point', () => {
    expect(cleanMoney('99,5')).toBe('99.5')
    expect(cleanMoney('99,')).toBe('99.')
  })
  it('still drops grouping commas, letters and a second dot', () => {
    expect(cleanMoney('1,50,000')).toBe('150000')
    expect(cleanMoney('₹1,234.5.6')).toBe('1234.56')
    expect(cleanMoney('1e5')).toBe('15')
  })
})
