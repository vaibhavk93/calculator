import { describe, expect, it } from 'vitest'
import { D } from '../engine'
import { formatDecimal, formatExpression, formatPlain, groupInteger, magnitudeWords, MINUS } from './format'
import type { FormatOptions } from './format'

const IN: FormatOptions = { system: 'indian', decimals: 'auto' }
const INTL: FormatOptions = { system: 'international', decimals: 'auto' }
const fd = (s: string, o: FormatOptions = IN) => formatDecimal(new D(s), o)

describe('Indian digit grouping', () => {
  it.each([
    ['0', '0'],
    ['999', '999'],
    ['1000', '1,000'],
    ['12345', '12,345'],
    ['123456', '1,23,456'],
    ['1234567', '12,34,567'],
    ['12345678', '1,23,45,678'],
    ['1667226', '16,67,226'], // the number from the ClevCalc screenshot
    ['1000000000', '1,00,00,00,000'],
  ])('%s -> %s', (n, want) => expect(groupInteger(n, 'indian')).toBe(want))
})

describe('international grouping', () => {
  it.each([
    ['999', '999'],
    ['1000', '1,000'],
    ['1667226', '1,667,226'],
    ['1000000000', '1,000,000,000'],
  ])('%s -> %s', (n, want) => expect(groupInteger(n, 'international')).toBe(want))
})

describe('formatDecimal', () => {
  it('formats the example from the settings screen: 12,34,567.89', () => {
    expect(fd('1234567.89')).toBe('12,34,567.89')
    expect(fd('1234567.89', INTL)).toBe('1,234,567.89')
  })
  it('uses a true minus sign', () => {
    expect(fd('-57650')).toBe(`${MINUS}57,650`)
    expect(fd('-57650')[0]).toBe('−')
  })
  it('auto trims trailing zeros and caps at 10 places', () => {
    expect(fd('2.50')).toBe('2.5')
    expect(fd('0.3333333333333333')).toBe('0.3333333333')
    expect(fd('100')).toBe('100')
  })
  it('a fixed setting pads and rounds half-up', () => {
    const two: FormatOptions = { system: 'indian', decimals: 2 }
    expect(fd('5', two)).toBe('5.00')
    expect(fd('2.345', two)).toBe('2.35')
    expect(fd('2.344', two)).toBe('2.34')
    expect(fd('1234.5', { system: 'indian', decimals: 0 })).toBe('1,235')
  })
  it('never prints "-0"', () => {
    expect(fd('-0.001', { system: 'indian', decimals: 2 })).toBe('0.00')
    expect(fd('-0.00000000001')).toBe('0')
    expect(formatDecimal(new D(-0), IN)).toBe('0')
  })
  it('never uses scientific notation', () => {
    expect(fd('1e30')).toBe('10,00,00,00,00,00,00,00,00,00,00,00,00,00,000')
    expect(fd('1e-7')).toBe('0.0000001')
  })
  it('non-finite values do not leak NaN or Infinity', () => {
    expect(formatDecimal(new D(NaN), IN)).toBe('—')
    expect(formatDecimal(new D(Infinity), IN)).toBe('—')
  })
})

describe('formatPlain', () => {
  it('formats stored result strings', () => expect(formatPlain('1667226', IN)).toBe('16,67,226'))
  it('returns garbage unchanged rather than throwing', () => expect(formatPlain('not a number', IN)).toBe('not a number'))
})

describe('formatExpression', () => {
  it.each([
    ['18450+7200+32000', '18,450 + 7,200 + 32,000'],
    ['150000', '1,50,000'],
    ['2.5*3', '2.5 × 3'],
    ['10/4', '10 ÷ 4'],
    ['5-3', `5 ${MINUS} 3`],
    ['-5+2', `${MINUS}5 + 2`],
    ['5*-3', `5 × ${MINUS}3`],
    ['(-3)', `(${MINUS}3)`],
    ['2^10', '2^10'],
    ['1234.', '1,234.'],
    ['150000.50', '1,50,000.50'],
    ['sin(30)+5', 'sin(30) + 5'],
    ['√(16)', '√(16)'],
    ['5%', '5%'],
    ['(1+2)*3', '(1 + 2) × 3'],
    ['2π', '2π'],
    ['', ''],
  ])('"%s" -> "%s"', (raw, want) => expect(formatExpression(raw, 'indian')).toBe(want))

  it('groups internationally when asked', () => {
    expect(formatExpression('1234567+1', 'international')).toBe('1,234,567 + 1')
  })
  it('groups as you type: every prefix of a number stays readable', () => {
    const seen = ['1', '15', '150', '1500', '15000', '150000'].map((s) => formatExpression(s, 'indian'))
    expect(seen).toEqual(['1', '15', '150', '1,500', '15,000', '1,50,000'])
  })
})

describe('magnitudeWords', () => {
  const w = (s: string, sys: 'indian' | 'international' = 'indian') => magnitudeWords(new D(s), sys)
  it('Indian', () => {
    expect(w('99999')).toBeNull()
    expect(w('100000')).toBe('1 lakh')
    expect(w('1667226')).toBe('16.67 lakh')
    expect(w('16672260')).toBe('1.67 crore')
    expect(w('1000000000000')).toBe('1 lakh crore')
  })
  it('rolls up instead of saying "100 lakh"', () => {
    expect(w('9999999')).toBe('1 crore')
  })
  it('international', () => {
    expect(w('999999', 'international')).toBeNull()
    expect(w('1500000', 'international')).toBe('1.5 million')
    expect(w('2500000000', 'international')).toBe('2.5 billion')
  })
  it('keeps the sign', () => expect(w('-16672260')).toBe(`${MINUS}1.67 crore`))
  it('is silent for small numbers and non-finite values', () => {
    expect(w('250')).toBeNull()
    expect(magnitudeWords(new D(NaN), 'indian')).toBeNull()
  })
})
