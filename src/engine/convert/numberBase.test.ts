import { describe, expect, it } from 'vitest'
import { bitOps, parseBase, toBase } from './numberBase'

// Not checked against an external tool. These are well-known identities: 255 = 0xFF = 0o377 = 0b11111111,
// 255 & 15 = 15, 255 ^ 15 = 0xF0, 8-bit NOT 0xFF = 0.
describe('number base', () => {
  it('converts between the four bases', () => {
    expect(toBase(parseBase('255', 10)!, 16)).toBe('FF')
    expect(toBase(parseBase('255', 10)!, 8)).toBe('377')
    expect(toBase(parseBase('255', 10)!, 2)).toBe('11111111')
    expect(parseBase('ff', 16)).toBe(255n)
    expect(parseBase('0xFF', 16)).toBe(255n)
    expect(parseBase('1010', 2)).toBe(10n)
  })
  it('big values do not lose precision', () => {
    expect(toBase(parseBase('18446744073709551615', 10)!, 16)).toBe('FFFFFFFFFFFFFFFF')
  })
  it('rejects digits the base does not have, blanks and signs', () => {
    expect(parseBase('12', 2)).toBeNull()
    expect(parseBase('8', 8)).toBeNull()
    expect(parseBase('G', 16)).toBeNull()
    expect(parseBase('', 10)).toBeNull()
    expect(parseBase('-5', 10)).toBeNull()
  })
  it('bit operations', () => {
    const o = bitOps(255n, 15n, 2, 8)!
    expect([o.and, o.or, o.xor, o.not, o.shl, o.shr]).toEqual([15n, 255n, 240n, 0n, 1020n, 63n])
    expect(bitOps(5n, 0n, 0, 8)!.not).toBe(250n)
  })
  it('NOT is null when the value is wider than the width; bad shift is null', () => {
    expect(bitOps(256n, 0n, 1, 8)!.not).toBeNull()
    expect(bitOps(1n, 0n, -1, 8)).toBeNull()
    expect(bitOps(1n, 0n, 1.5, 8)).toBeNull()
  })
})
