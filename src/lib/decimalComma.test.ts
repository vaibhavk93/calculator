import { describe, expect, it } from 'vitest'
import { validateAmount } from './budget'
import { decimalComma } from './decimalComma'
import { parseNum } from './tool'
import { parseTapeLine } from './tape'

// B-06: a comma typed as a decimal point. B-14: a real minus sign in a list line.
describe('decimalComma', () => {
  it.each([
    ['99,5', '99.5'],
    ['1,5', '1.5'],
    ['12,50', '12.50'],
    ['99,', '99.'],
    ['1.234,56', '1234.56'],
    ['₹1.234,5', '₹1234.5'],
  ])('reads %s as a decimal', (from, to) => expect(decimalComma(from)).toBe(to))

  it.each(['1,500', '1,50,000', '12,34,567', '1,234,567', '1500', '12.5', '1,234.56', '1.5,5'])('leaves %s alone', (v) => expect(decimalComma(v)).toBe(v))

  it('the validator, parseNum and the list line all agree', () => {
    expect(validateAmount('99,5')).toBeNull()
    expect(validateAmount('99,555')).toBeNull() // 99,555 is grouping: ninety-nine thousand
    expect(parseNum('99,5')!.toFixed()).toBe('99.5')
    expect(parseNum('1,50,000')!.toFixed()).toBe('150000')
    const t = parseTapeLine('Cab 12,50')
    expect(t.ok && t.value.toFixed()).toBe('12.5')
    const r = parseTapeLine('Rent 1,5')
    expect(r.ok && r.value.toFixed()).toBe('1.5')
  })
})

describe('B-14: the real minus sign in a list line', () => {
  it.each(['Refund −500', 'Refund –500', 'Refund -500'])('%s is minus 500 with the label "Refund"', (line) => {
    const t = parseTapeLine(line)
    expect(t.ok && t.label).toBe('Refund')
    expect(t.ok && t.value.toFixed()).toBe('-500')
  })
})
