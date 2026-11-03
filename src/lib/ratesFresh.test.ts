import { describe, expect, it } from 'vitest'
import { ratesLine } from './ratesFresh'

const at = (iso: string) => Date.parse(`${iso}T12:00:00`)
const stamp = { asOf: '2026-11-02', until: '2027-04-01' }

describe('ratesLine', () => {
  it('is a quiet "as of" month before the boundary', () => {
    expect(ratesLine(stamp, at('2026-11-03'))).toBe('Rates as of Nov 2026')
    expect(ratesLine(stamp, at('2027-03-31'))).toBe('Rates as of Nov 2026')
  })
  it('warns from the boundary day on, naming the date it was checked', () => {
    expect(ratesLine(stamp, at('2027-04-01'))).toBe('These rates may have changed since 2 Nov 2026. Check the official source.')
    expect(ratesLine(stamp, at('2028-01-01'))).toMatch(/may have changed since 2 Nov 2026/)
  })
  it('says nothing for a stamp it cannot read', () => expect(ratesLine({ asOf: 'soon', until: 'later' }, at('2026-11-03'))).toBe(''))
})
