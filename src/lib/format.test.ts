import { describe, expect, it } from 'vitest'
import { D, evaluateExpression } from '../engine'
import { formatCompact, formatDecimal, formatExpression, formatForCopy, formatPlain, groupInteger, magnitudeWords, MINUS } from './format'
import { caretMap, displayCaret } from './format'
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
    expect(fd('-0.00000000001', { system: 'indian', decimals: 2 })).toBe('0.00')
    expect(formatDecimal(new D(-0), IN)).toBe('0')
  })
  it('plain digits up to 15 integer digits, scientific from 1e15', () => {
    expect(fd('999999999999999')).toBe('99,99,99,99,99,99,999')
    expect(fd('999999999999999', { system: 'international', decimals: 'auto' })).toBe('999,999,999,999,999')
    expect(fd('1000000000000000')).toBe('1E+15')
    expect(fd('1000000000000000', { system: 'international', decimals: 'auto' })).toBe('1E+15')
    expect(fd('999999999999999.99999999999')).toBe('1E+15') // rounds up across the line
    expect(fd('-1.23456789012345e25')).toBe(`${MINUS}1.23456789E+25`)
    expect(fd('1e30')).toBe('1E+30')
    expect(fd('1.5e99')).toBe('1.5E+99')
    expect(fd('1e-7')).toBe('0.0000001')
  })
  it('keeps 10 significant digits and trims trailing zeros', () => {
    expect(fd('12345678901234567890123')).toBe('1.23456789E+22')
    expect(fd('12345678912345678912345')).toBe('1.234567891E+22')
    expect(fd('123456789123456789123456')).toBe('1.234567891E+23')
  })
  it('a tiny non-zero value is not shown as 0 in auto', () => {
    expect(fd('0.00000000001')).toBe('1E-11')
    expect(fd('-0.00000000001')).toBe(`${MINUS}1E-11`)
    expect(fd('0.0000000001')).toBe('0.0000000001')
    expect(fd('0.00000000001', { system: 'indian', decimals: 4 })).toBe('0.0000')
  })
  it('never prints NaN, Infinity or undefined, however big', () => {
    for (const v of ['1e99', '9e99', '-9e99', '1e-99', '123456789e90']) expect(fd(v)).toMatch(/^[−0-9.,E+-]+$/)
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

describe('formatForCopy', () => {
  const c = (s: string, d: FormatOptions['decimals'] = 'auto') => formatForCopy(new D(s), d)
  it('has no grouping and an ASCII minus, so it pastes into a spreadsheet', () => {
    expect(c('1667226')).toBe('1667226')
    expect(c('-57650.5')).toBe('-57650.5')
  })
  it('honours the decimal setting', () => {
    expect(c('2.345', 2)).toBe('2.35')
    expect(c('5', 2)).toBe('5.00')
  })
  it('never copies "-0"', () => {
    expect(c('-0.001', 2)).toBe('0.00')
    expect(c('-0.00000000001', 2)).toBe('0.00')
  })
  it('plain digits to 15 integer digits, scientific text above, which the engine reads back', () => {
    expect(c('999999999999999')).toBe('999999999999999')
    expect(c('1000000000000000')).toBe('1E+15')
    expect(c('-12345678901234567890123456')).toBe('-1.234567890123456789E+25')
    expect(c('0.00000000001')).toBe('1E-11')
    const back = evaluateExpression(c('1.2345e25'), { angle: 'deg' })
    expect(back.ok && back.value.eq('1.2345e25')).toBe(true)
  })
  it('non-finite copies nothing', () => expect(formatForCopy(new D(NaN), 'auto')).toBe(''))
})

describe('names above lakh crore', () => {
  const w = (s: string, sys: 'indian' | 'international' = 'indian') => magnitudeWords(new D(s), sys)
  it('Indian: arab, kharab, lakh crore, neel, padma, shankh', () => {
    expect(w('1000000000')).toBe('1 arab')
    expect(w('99999999999')).toBe('1 kharab') // rolls up, not "100 arab"
    expect(w('150000000000')).toBe('1.5 kharab')
    expect(w('1000000000000')).toBe('1 lakh crore')
    expect(w('5e12')).toBe('5 lakh crore')
    expect(w('1e13')).toBe('1 neel')
    expect(w('1e15')).toBe('1 padma')
    expect(w('2.5e17')).toBe('2.5 shankh')
    expect(w('-1e17')).toBe(`${MINUS}1 shankh`)
  })
  it('Indian: silent where no name exists', () => {
    expect(w('999e17')).toBe('999 shankh')
    expect(w('1e20')).toBeNull()
    expect(w('1e60')).toBeNull()
  })
  it('international: up to decillion, then silent', () => {
    expect(w('1e12', 'international')).toBe('1 trillion')
    expect(w('1e15', 'international')).toBe('1 quadrillion')
    expect(w('1e18', 'international')).toBe('1 quintillion')
    expect(w('1e21', 'international')).toBe('1 sextillion')
    expect(w('1.5e24', 'international')).toBe('1.5 septillion')
    expect(w('1e27', 'international')).toBe('1 octillion')
    expect(w('1e30', 'international')).toBe('1 nonillion')
    expect(w('1e33', 'international')).toBe('1 decillion')
    expect(w('999e33', 'international')).toBe('999 decillion')
    expect(w('1e36', 'international')).toBeNull()
    expect(w('999999999999', 'international')).toBe('1 trillion') // rolls up
  })
})

describe('formatCompact', () => {
  it('is scientific for any size, trimmed', () => {
    expect(formatCompact(new D('123456'))).toBe('1.23456E+5')
    expect(formatCompact(new D('-0.00012'))).toBe(`${MINUS}1.2E-4`)
    expect(formatCompact(new D(0))).toBe('0')
    expect(formatCompact(new D(NaN))).toBe('—')
  })
})

describe('huge numbers in the expression line', () => {
  const big = '1'.padEnd(40, '0')
  it('a result too long to have been typed is shortened; a typed number is not', () => {
    expect(formatExpression(`${big}*9`, 'indian')).toBe('1E+39 × 9')
    expect(formatExpression('1234567890123456789012', 'international')).toBe('1,234,567,890,123,456,789,012')
    expect(formatExpression(`-${big}`, 'indian')).toBe(`${MINUS}1E+39`)
    expect(formatExpression(`0.${'0'.repeat(30)}1+1`, 'indian')).toBe('1E-31 + 1')
  })
  it('a long ordinary result (many decimals) is left alone', () => {
    expect(formatExpression('1234567.1234567890123456789', 'international')).toBe('1,234,567.1234567890123456789')
  })
  it('scientific notation that was pasted keeps its exponent', () => {
    expect(formatExpression('1.2345E+25*2', 'indian')).toBe('1.2345E+25 × 2')
    expect(formatExpression('2e+3', 'indian')).toBe('2e+ 3'.replace('e+ 3', 'e + 3'))
  })
  it('the cursor map treats a shortened number as one step', () => {
    const raw = `${big}*9`
    const text = formatExpression(raw, 'indian')
    const map = caretMap(text, raw)
    expect(map).toHaveLength(text.length + 1)
    expect(map[text.length]).toBe(raw.length)
    expect(map[5]).toBe(40) // just after "1E+39"
    expect(displayCaret(map, raw, raw.length)).toBe(text.length)
  })
})

describe('60 factors of 9 and of 99999999999 never break anything', () => {
  const fmts: FormatOptions[] = [IN, INTL, { system: 'indian', decimals: 2 }]
  it('every size formats to a short string of safe characters', () => {
    for (const base of ['9', '99999999999']) {
      for (let n = 1; n <= 60; n++) {
        const r = evaluateExpression(Array(n).fill(base).join('*'), { angle: 'deg' })
        if (!r.ok) {
          expect(['Too large to show', 'Expression is too long']).toContain(r.message)
          continue
        }
        for (const o of fmts) {
          const t = formatDecimal(r.value, o)
          expect(t).toMatch(/^[−0-9.,E+-]+$/)
          expect(t.length).toBeLessThanOrEqual(24)
        }
        expect(formatForCopy(r.value, 'auto')).toMatch(/^[0-9.E+-]+$/)
        const words = magnitudeWords(r.value, 'indian')
        expect(words === null || /^[0-9.]+ [a-z ]+$/.test(words)).toBe(true)
      }
    }
  })
  it('the 1e100 limit is the only place a result is refused, in words', () => {
    const ok = evaluateExpression('9^99', { angle: 'deg' })
    expect(ok.ok).toBe(true)
    const no = evaluateExpression('9^105', { angle: 'deg' })
    expect(no).toEqual({ ok: false, code: 'overflow', message: 'Too large to show' })
  })
})
