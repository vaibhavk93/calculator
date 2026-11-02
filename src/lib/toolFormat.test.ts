import { describe, expect, it } from 'vitest'
import { D } from '../engine'
import { formatCell } from './toolFormat'

const IN = { system: 'indian', decimals: 'auto' } as const
const INT = { system: 'international', decimals: 'auto' } as const

describe('formatCell', () => {
  it('money: rupee sign, grouping by the chosen system, 2 places on auto', () => {
    expect(formatCell(new D('1667226.5'), 'money', IN)).toBe('₹16,67,226.50')
    expect(formatCell(new D('1667226.5'), 'money', INT)).toBe('₹1,667,226.50')
  })

  it('money: the sign leads, and a value that rounds to zero has none', () => {
    expect(formatCell(new D('-1000'), 'money', IN)).toBe('−₹1,000.00')
    expect(formatCell(new D('-0.001'), 'money', IN)).toBe('₹0.00')
  })

  it('money: respects fixed decimals from settings', () => {
    expect(formatCell(new D('43391.16'), 'money', { system: 'indian', decimals: 0 })).toBe('₹43,391')
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
