import { describe, expect, it } from 'vitest'
import { parseClipboardExpression, parseClipboardNumber } from './clipboard'

describe('parseClipboardNumber', () => {
  it.each([
    ['42', '42'],
    ['  42  ', '42'],
    ['1,50,000', '150000'],
    ['1,234,567.89', '1234567.89'],
    ['₹1,50,000.50', '150000.50'],
    ['$ 2,500', '2500'],
    ['-12', '-12'],
    ['−12', '-12'],
    ['(500)', '-500'],
    ['.5', '0.5'],
    ['5.', '5'],
    ['007', '7'],
    ['0.5', '0.5'],
    ['0', '0'],
  ])('"%s" -> %s', (input, want) => expect(parseClipboardNumber(input)).toBe(want))

  it.each(['', 'abc', '12abc', '1e5', '5%', '1.2.3', '12 34 56x', '--5', '1+2'])(
    '"%s" is not a number',
    (input) => expect(parseClipboardNumber(input)).toBeNull(),
  )

  it('rejects a whole pasted document', () => {
    expect(parseClipboardNumber('1'.repeat(200))).toBeNull()
  })
})

describe('parseClipboardExpression', () => {
  const raw = (t: string) => {
    const r = parseClipboardExpression(t)
    return r.raw
  }

  it.each([
    ['23*36', '23*36'],
    ['23 x 36', '23*36'],
    ['23 X 36', '23*36'],
    ['23 × 36', '23*36'],
    ['100 ÷ 4', '100/4'],
    ['1,50,000 + 2,500', '150000+2500'],
    ['1,234,567.89 - 1', '1234567.89-1'],
    ['₹1,200 - ₹300', '1200-300'],
    ['Rs. 500 + Rs 20', '500+20'],
    ['(5+3)*2', '(5+3)*2'],
    ['12%', '12%'],
    ['200 + 12%', '200+12%'],
    ['Rent 25000 + 3000', '25000+3000'],
    ['25000 rent', '25000'],
    ['= 828', '828'],
    ['23*36 =', '23*36'],
    ['23*36 = 828', '23*36'],
    ['10 − 4', '10-4'],
    ['10 – 4', '10-4'],
    ['−12', '-12'],
    ['(500)', '-500'],
    ['(₹1,500)', '-1500'],
    ['Item 3 costs 500', '500'],
    ['5/0', '5/0'],
  ])('"%s" -> %s', (input, want) => expect(raw(input)).toBe(want))

  it('sums several lines, one term per line with a number', () => {
    expect(parseClipboardExpression('Flights 24000\nHotel 18500\nFood 9000')).toEqual({ raw: '24000+18500+9000', lines: 3 })
  })
  it('skips headings and blank lines', () => {
    expect(parseClipboardExpression('Trip costs\n\nFlights 24,000\r\nHotel ₹18,500\n')).toEqual({ raw: '24000+18500', lines: 2 })
  })
  it('a line starting with "-" is subtracted', () => {
    expect(raw('Flights 24000\n- Refund 500\n-200')).toBe('24000-500-200')
    expect(raw('100\n- 20 + 5')).toBe('100-20+5')
  })
  it('a single line counts as one', () => {
    expect(parseClipboardExpression('23 x 36')).toEqual({ raw: '23*36', lines: 1 })
  })

  it.each(['', '   ', 'hello', 'abc def', '12 34', '((5)', '5)', '+', '='])('"%s" has no usable number', (input) => {
    const r = parseClipboardExpression(input)
    expect(r.raw).toBeNull()
    if (r.raw === null) expect(r.reason).toMatch(/\w/)
  })

  it('refuses very long text, with a reason', () => {
    const r = parseClipboardExpression('1+'.repeat(300))
    expect(r.raw).toBeNull()
    if (r.raw === null) expect(r.reason).toMatch(/500/)
  })
  it('never runs pasted text as code', () => {
    expect(raw('alert(1)')).toBe('(1)')
    expect(raw('constructor')).toBeNull()
  })
})
