import { describe, expect, it } from 'vitest'
import { D } from '../engine'
import { formatCell } from './toolFormat'

const IN = { system: 'indian', decimals: 'auto' } as const
const INT = { system: 'international', decimals: 'auto' } as const

describe('formatCell', () => {
  it('money: rupee sign, grouping by the chosen system, 2 places on auto unless whole', () => {
    expect(formatCell(new D('1667226.5'), 'money', IN)).toBe('₹16,67,226.50')
    expect(formatCell(new D('1667226.5'), 'money', INT)).toBe('₹1,667,226.50')
  })

  it('money: the sign leads, and a value that rounds to zero has none', () => {
    expect(formatCell(new D('-1000'), 'money', IN)).toBe('−₹1,000')
    expect(formatCell(new D('-0.001'), 'money', IN)).toBe('₹0')
  })

  it('money: respects fixed decimals from settings', () => {
    expect(formatCell(new D('43391.16'), 'money', { system: 'indian', decimals: 0 })).toBe('₹43,391')
  })

  it('money on auto drops .00 only when whole after rounding to 2 places', () => {
    const f = (v: string, o: typeof IN | typeof INT = IN) => formatCell(new D(v), 'money', o)
    expect(f('24000')).toBe('₹24,000')
    expect(f('24000.00')).toBe('₹24,000')
    expect(f('43391.004')).toBe('₹43,391') // rounds to 43,391.00, so whole
    expect(f('43391.996')).toBe('₹43,392')
    expect(f('43391.16')).toBe('₹43,391.16')
    expect(f('1250.5')).toBe('₹1,250.50') // never 1,250.5
    expect(f('0.004')).toBe('₹0')
    expect(f('0.005')).toBe('₹0.01')
    expect(f('-0.004')).toBe('₹0') // no sign on a zero
    expect(f('-0.005')).toBe('−₹0.01')
    expect(f('-24000')).toBe('−₹24,000')
    expect(f('-1250.5')).toBe('−₹1,250.50')
    expect(f('1234567', INT)).toBe('₹1,234,567')
    expect(f('999999999999999.004')).toBe('₹99,99,99,99,99,99,999')
  })

  it('explicit decimals ignore the whole-amount rule, so columns stay aligned', () => {
    const f = (v: string, decimals: 0 | 2 | 4) => formatCell(new D(v), 'money', { system: 'indian', decimals })
    expect(f('24000', 2)).toBe('₹24,000.00')
    expect(f('24000', 4)).toBe('₹24,000.0000')
    expect(f('24000.4', 0)).toBe('₹24,000')
    expect(f('0.004', 2)).toBe('₹0.00')
  })

  it('percent and other formats are unchanged by the whole-amount rule', () => {
    expect(formatCell(new D('8'), 'percent', IN)).toBe('8.00%')
    expect(formatCell(new D('8.5'), 'percent', IN)).toBe('8.50%')
  })

  it('percent keeps two places so 8.5% is not shown as 9%', () => {
    expect(formatCell(new D('8.5'), 'percent', IN)).toBe('8.50%')
  })

  it('int rounds, number follows settings, strings pass through', () => {
    expect(formatCell(new D('239.6'), 'int', IN)).toBe('240')
    expect(formatCell(new D('0.1').plus('0.2'), 'number', IN)).toBe('0.3')
    expect(formatCell('Home loan', undefined, IN)).toBe('Home loan')
  })
})

describe('formatCell with huge amounts', () => {
  it('money turns scientific from 1e15 and stays short', () => {
    expect(formatCell(new D('999999999999999'), 'money', IN)).toBe('₹99,99,99,99,99,99,999')
    expect(formatCell(new D('1e30'), 'money', IN)).toBe('₹1E+30')
    expect(formatCell(new D('-1.5e40'), 'money', INT)).toBe('−₹1.5E+40')
    expect(formatCell(new D('1.2345678912e40'), 'money', IN)).toBe('₹1.234567891E+40')
  })
  it('numbers, ints and percentages follow the same rule', () => {
    expect(formatCell(new D('1e40'), 'number', IN)).toBe('1E+40')
    expect(formatCell(new D('1e40'), 'int', IN)).toBe('1E+40')
    expect(formatCell(new D('1e40'), 'percent', IN)).toBe('1E+40%')
  })
})
