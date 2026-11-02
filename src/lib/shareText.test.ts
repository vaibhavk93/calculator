import { describe, expect, it } from 'vitest'
import type { Field, Values } from './tool'
import { buildShareText, inputLines } from './shareText'

const IN = { system: 'indian', decimals: 'auto' } as const

describe('buildShareText', () => {
  it('puts the title first, then what was typed, then the answers, then where it came from', () => {
    const t = buildShareText({
      title: 'Loan EMI',
      inputs: [{ label: 'Loan amount', text: '₹50,00,000' }, { label: 'Yearly interest rate', text: '8.5%' }],
      rows: [{ label: 'Monthly EMI', text: '₹43,391.16' }],
      note: 'Banks round the EMI.',
    })
    expect(t).toBe('Loan EMI\nLoan amount: ₹50,00,000 · Yearly interest rate: 8.5%\n\nMonthly EMI: ₹43,391.16\n\nBanks round the EMI.\n\nWorked out in Calc')
  })
  it('leaves out empty sections instead of printing blank lines', () => {
    expect(buildShareText({ title: 'Tip', inputs: [], rows: [{ label: 'Total', text: '₹660.00' }] })).toBe('Tip\n\nTotal: ₹660.00\n\nWorked out in Calc')
  })
})

describe('inputLines', () => {
  const fields: Field[] = [
    { id: 'p', label: 'Loan amount', kind: 'number', unit: 'rupee' },
    { id: 'r', label: 'Rate', kind: 'number', unit: 'percent' },
    { id: 'y', label: 'Term', kind: 'number', unit: 'years' },
    { id: 'm', label: 'Mode', kind: 'select', default: 'a', options: [{ value: 'a', label: 'Reduce EMI' }, { value: 'b', label: 'Reduce term' }] },
    { id: 'd', label: 'Start', kind: 'date' },
    { id: 'h', label: 'Hidden', kind: 'number', visibleIf: () => false },
    { id: 'e', label: 'Empty', kind: 'number' },
  ]
  const values: Values = { p: '5000000', r: '8.5', y: '20', m: 'b', d: '2026-11-02', h: '9', e: '' }

  it('writes rupees with grouping, percent and years with their unit, and a choice as its label', () => {
    expect(inputLines(fields, values, IN)).toEqual([
      { label: 'Loan amount', text: '₹50,00,000' },
      { label: 'Rate', text: '8.5%' },
      { label: 'Term', text: '20 years' },
      { label: 'Mode', text: 'Reduce term' },
      { label: 'Start', text: '2026-11-02' },
    ])
  })
  it('follows the number-system setting, and skips hidden, empty and unreadable fields', () => {
    expect(inputLines(fields.slice(0, 1), values, { system: 'international', decimals: 'auto' })).toEqual([{ label: 'Loan amount', text: '₹5,000,000' }])
    expect(inputLines(fields, { ...values, p: 'abc' }, IN).some((l) => l.label === 'Loan amount')).toBe(false)
  })
})
