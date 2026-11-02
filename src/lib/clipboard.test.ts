import { describe, expect, it } from 'vitest'
import { parseClipboardNumber } from './clipboard'

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
