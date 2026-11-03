import { describe, expect, it } from 'vitest'
import { fakeNumber, fakeWord, maskText, shapeOf } from './maskText'

const SALT = 'test-salt-1'
const MSG = 'UPI Mandate: Sent Rs.1,990.00 from HDFC Bank A/c 1234 To Netflx 03/11/26 Ref 111000000001 by ramesh.k@okhdfc Not You? Call 18002586161'

describe('maskText', () => {
  const out = maskText(MSG, SALT)
  it('keeps the layout the parser reads', () => {
    expect(out).toMatch(/^[A-Z]{3} [A-Z][a-z]{6}: Sent Rs\.\d,\d{3}\.\d{2} from HDFC Bank A\/c \d{4} To [A-Z][a-z]{5} \d{2}\/\d{2}\/\d{2} Ref \d{12} by [a-z]+\.[a-z]@okhdfc Not You\? Call \d{11}$/)
  })
  it('keeps none of the real values', () => {
    for (const real of ['1,990.00', '1234', 'Netflx', '111000000001', 'ramesh', '18002586161', '03/11/26']) expect(out).not.toContain(real)
  })
  it('is stable on one phone and different on another', () => {
    expect(maskText(MSG, SALT)).toBe(out)
    expect(maskText(MSG, 'other-salt')).not.toBe(out)
  })
  it('makes valid fake dates', () => {
    for (let i = 0; i < 40; i++) {
      const m = /(\d{2})\/(\d{2})\/(\d{2})/.exec(maskText(`on 0${(i % 9) + 1}/1${i % 3}/26 x${i}`, `s${i}`))!
      expect(+m[1]!).toBeGreaterThanOrEqual(1); expect(+m[1]!).toBeLessThanOrEqual(28)
      expect(+m[2]!).toBeGreaterThanOrEqual(1); expect(+m[2]!).toBeLessThanOrEqual(12)
    }
    expect(maskText('on 03-Nov-2026 paid', SALT)).toMatch(/on \d{2}-[A-Z][a-z]{2}-\d{4} paid/)
  })
  it('hides links, and does not mistake bank words for names', () => {
    expect(maskText('visit https://hdfc.example/x/123', SALT)).toBe('visit <link>')
    expect(maskText('debited from a/c XX1234 at HDFC Bank', SALT)).toContain('at HDFC Bank')
  })
  it('masks a name that follows no keyword (e.g. in an Info: line)', () => {
    const m = maskText('UPDATE: INR 93,024.63 debited from HDFC Bank XX5486 on 04-Jan-26. Info: IB FUNDS TRANSFER DR-XXXXXXXXXX2240-RAMESH KUMAR SHARMA. Avl bal:INR 47,703.98', SALT)
    expect(m).not.toMatch(/RAMESH|KUMAR|SHARMA/)
    expect(m).toContain('IB FUNDS TRANSFER DR-XXXXXXXXXX')
    expect(m).toContain('debited from HDFC Bank')
  })
  it('masks merchants and fund names but keeps layout words', () => {
    const m = maskText('Spent Rs.305 On HDFC Bank Card 4852 At _HAMLEYS. On 12-Oct-25', SALT)
    expect(m).not.toContain('HAMLEYS')
    expect(m).toMatch(/^Spent Rs\.\d{3} On HDFC Bank Card \d{4} At _[A-Z]{7}\. On /)
  })
  it('masks "Dear <name>"', () => {
    expect(maskText('Dear Vaibhav, Rs 500 debited', SALT)).not.toContain('Vaibhav')
  })
})

describe('fakeNumber / fakeWord / shapeOf', () => {
  it('keep length, separators and case', () => {
    expect(fakeNumber('1,23,456.50', SALT)).toMatch(/^\d,\d\d,\d{3}\.\d\d$/)
    expect(fakeNumber('1,23,456.50', SALT)[0]).not.toBe('0')
    expect(fakeWord('Zomato Ltd', SALT)).toMatch(/^[A-Z][a-z]{5} [A-Z][a-z]{2}$/)
  })
  it('shapeOf never contains the value', () => {
    expect(shapeOf('1990.00')).toBe('4 digits, 2 decimals')
    expect(shapeOf('Netflx')).toBe('6 characters')
  })
})
