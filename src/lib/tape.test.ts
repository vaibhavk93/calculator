import { describe, expect, it } from 'vitest'
import { parseTapeLine, tapeTotal } from './tape'

const ok = (t: string) => {
  const r = parseTapeLine(t)
  return r.ok ? [r.label, r.value.toFixed()] : r.error
}

describe('parseTapeLine', () => {
  it('splits label and amount', () => {
    expect(ok('Flights 24000')).toEqual(['Flights', '24000'])
    expect(ok('Hotel 18,500')).toEqual(['Hotel', '18500'])
    expect(ok('24000')).toEqual(['', '24000'])
  })
  it('keeps digits inside the label', () => {
    expect(ok('Wifi 2.4G 500')).toEqual(['Wifi 2.4G', '500'])
  })
  it('accepts a sum or a product as the amount, and a negative for refunds', () => {
    expect(ok('Rent 25000+3000')).toEqual(['Rent', '28000'])
    expect(ok('Tea 3 × 20')).toEqual(['Tea', '60'])
    expect(ok('Refund -500')).toEqual(['Refund', '-500'])
  })
  it('says what is wrong in plain words', () => {
    expect(ok('Flights')).toMatch(/amount/)
    expect(ok('Cake 5/0')).toMatch(/divide by zero/i)
  })
})

describe('tapeTotal', () => {
  it('adds exactly: 0.1 + 0.2 is 0.3', () => {
    expect(tapeTotal([{ value: '0.1' }, { value: '0.2' }]).toFixed()).toBe('0.3')
    expect(tapeTotal([]).toFixed()).toBe('0')
  })
})

import { listProgress, listSummary, repeatLines } from './tape'

const L = (value: string, done = false, id = value) => ({ id, label: '', value, ...(done ? { done } : {}) })
const IN = { system: 'indian', decimals: 'auto' } as const

describe('listProgress', () => {
  it('counts done lines and splits the money into collected and left', () => {
    const p = listProgress([L('1000', true, 'a'), L('1000', true, 'b'), L('1000', false, 'c'), L('1000', false, 'd'), L('1000', false, 'e')])
    expect([p.done, p.total, p.doneAmount.toFixed(), p.leftAmount.toFixed()]).toEqual([2, 5, '2000', '3000'])
  })
  it('an empty list is zero of zero', () => {
    const p = listProgress([])
    expect([p.done, p.total, p.leftAmount.toFixed()]).toEqual([0, 0, '0'])
  })
  it('splitting 100 three ways keeps the exact total: three lines of 100/3 add back to 100', () => {
    const third = '33.33333333333333333333333333333333333333'
    const p = listProgress(repeatLines(third, 3, 'Friend', () => Math.random().toString()))
    expect(p.leftAmount.toDecimalPlaces(2).toFixed()).toBe('100')
  })
})

describe('repeatLines', () => {
  it('makes N numbered lines of the same value', () => {
    const lines = repeatLines('1000', 5, 'Friend', (() => { let i = 0; return () => `id${++i}` })())
    expect(lines.map((l) => l.label)).toEqual(['Friend 1', 'Friend 2', 'Friend 3', 'Friend 4', 'Friend 5'])
    expect(new Set(lines.map((l) => l.id)).size).toBe(5)
    expect(lines.every((l) => l.value === '1000')).toBe(true)
  })
  it('one line keeps the plain label, and an empty label on many lines becomes "Person N"', () => {
    expect(repeatLines('50', 1, 'Rent', () => 'x')[0]!.label).toBe('Rent')
    expect(repeatLines('50', 2, '', () => 'x').map((l) => l.label)).toEqual(['Person 1', 'Person 2'])
  })
  it('keeps the count between 1 and 50', () => {
    expect(repeatLines('1', 0, '', () => 'x')).toHaveLength(1)
    expect(repeatLines('1', 500, '', () => 'x')).toHaveLength(50)
  })
})

describe('listSummary', () => {
  it('a plain list says lines and total; a checklist says how many are done and what is left', () => {
    const lines = [L('1000', true, 'a'), L('1000', false, 'b'), L('1000', false, 'c')]
    expect(listSummary(lines, false, IN)).toBe('3 lines, total ₹3,000.00')
    expect(listSummary(lines, true, IN)).toBe('1 of 3 done, ₹2,000.00 left')
    expect(listSummary(lines.map((l) => ({ ...l, done: true })), true, IN)).toBe('All 3 done, total ₹3,000.00')
    expect(listSummary([L('5')], false, IN)).toBe('1 line, total ₹5.00')
  })
})
