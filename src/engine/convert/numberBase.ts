export type Base = 2 | 8 | 10 | 16
const DIGITS = '0123456789ABCDEF'

/** A whole number written in `base`, or null if empty, signed, or it has a digit the base does not allow. */
export function parseBase(text: string, base: Base): bigint | null {
  const s = text.trim().toUpperCase().replace(/^0[XBO]/, '').replace(/[\s_]/g, '')
  if (s === '' || [...s].some((ch) => DIGITS.indexOf(ch) < 0 || DIGITS.indexOf(ch) >= base)) return null
  return [...s].reduce((acc, ch) => acc * BigInt(base) + BigInt(DIGITS.indexOf(ch)), 0n)
}

export const toBase = (n: bigint, base: Base): string => n.toString(base).toUpperCase()

export interface BitOps { and: bigint; or: bigint; xor: bigint; not: bigint | null; shl: bigint; shr: bigint }

/**
 * Bitwise results for two non-negative whole numbers. NOT needs a width, so it is done inside `width` bits
 * and is null when `a` does not fit. Shifts move `a` by `shift` places (0 or more).
 */
export function bitOps(a: bigint, b: bigint, shift: number, width: 8 | 16 | 32 | 64): BitOps | null {
  if (a < 0n || b < 0n || shift < 0 || !Number.isInteger(shift) || shift > 1024) return null
  const mask = (1n << BigInt(width)) - 1n
  return { and: a & b, or: a | b, xor: a ^ b, not: a > mask ? null : ~a & mask, shl: a << BigInt(shift), shr: a >> BigInt(shift) }
}
