import { D, type Dec } from '../engine'

export type NumberSystem = 'indian' | 'international'
/** "auto" shows up to 10 decimals with trailing zeros trimmed; a number fixes the places. */
export type DecimalSetting = 'auto' | number

export interface FormatOptions {
  system: NumberSystem
  decimals: DecimalSetting
}

/** U+2212, the real minus sign. Hyphen-minus is too short next to digits. */
export const MINUS = '−'

export const AUTO_MAX_DECIMALS = 10
export const MAX_FIXED_DECIMALS = 10

/** 1234567 -> "12,34,567" (Indian) or "1,234,567" (international). Digits only. */
export function groupInteger(digits: string, system: NumberSystem): string {
  if (digits.length <= 3) return digits
  if (system === 'international') return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const head = digits.slice(0, -3)
  const tail = digits.slice(-3)
  return head.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + tail
}

export function formatDecimal(value: Dec, opts: FormatOptions): string {
  if (!value.isFinite()) return '—'

  const places = opts.decimals === 'auto' ? AUTO_MAX_DECIMALS : opts.decimals
  const rounded = value.toDecimalPlaces(places, D.ROUND_HALF_UP)
  const text = opts.decimals === 'auto' ? rounded.toFixed() : rounded.toFixed(places)

  // -0.001 at 2 places rounds to zero; showing "-0.00" would be a lie.
  const negative = rounded.isNegative() && !rounded.isZero()
  const [int = '0', frac] = text.replace('-', '').split('.')
  return (negative ? MINUS : '') + groupInteger(int, opts.system) + (frac ? '.' + frac : '')
}

/**
 * What goes on the clipboard: the value at the user's chosen precision, with no
 * grouping commas and an ASCII minus, so it pastes cleanly into a spreadsheet.
 */
export function formatForCopy(value: Dec, decimals: DecimalSetting): string {
  if (!value.isFinite()) return ''
  const places = decimals === 'auto' ? AUTO_MAX_DECIMALS : decimals
  const rounded = value.toDecimalPlaces(places, D.ROUND_HALF_UP)
  if (rounded.isZero()) return decimals === 'auto' || decimals === 0 ? '0' : rounded.abs().toFixed(places)
  return decimals === 'auto' ? rounded.toFixed() : rounded.toFixed(places)
}

/** For stored plain-decimal strings (history results, memory). Falls back to the input if unparseable. */
export function formatPlain(plain: string, opts: FormatOptions): string {
  try {
    return formatDecimal(new D(plain), opts)
  } catch {
    return plain
  }
}

type Prev = 'start' | 'op' | 'open' | 'operand'

/**
 * Turns the raw typed expression into what the user reads:
 * numbers grouped as they are typed, real operators, a true minus sign.
 *   "150000+2.5*-3" -> "1,50,000 + 2.5 × −3"
 */
export function formatExpression(raw: string, system: NumberSystem): string {
  const re = /(\d+\.?\d*|\.\d+)|([+\-*/^])|([^\d.+\-*/^]+|\.)/g
  let out = ''
  let prev: Prev = 'start'

  for (const m of raw.matchAll(re)) {
    const [, num, op, other] = m

    if (num !== undefined) {
      const dot = num.indexOf('.')
      if (dot === -1) out += groupInteger(num, system)
      else if (dot === 0) out += num
      else out += groupInteger(num.slice(0, dot), system) + num.slice(dot)
      prev = 'operand'
    } else if (op !== undefined) {
      const unary = prev === 'start' || prev === 'op' || prev === 'open'
      if (op === '^') out += '^'
      else if (unary) out += op === '-' ? MINUS : op
      else out += op === '-' ? ` ${MINUS} ` : op === '*' ? ' × ' : op === '/' ? ' ÷ ' : ` ${op} `
      prev = 'op'
    } else if (other !== undefined) {
      out += other
      prev = other.endsWith('(') ? 'open' : 'operand'
    }
  }
  return out
}

const INDIAN_UNITS = [
  { size: 1e12, name: 'lakh crore' },
  { size: 1e7, name: 'crore' },
  { size: 1e5, name: 'lakh' },
] as const

const INTERNATIONAL_UNITS = [
  { size: 1e12, name: 'trillion' },
  { size: 1e9, name: 'billion' },
  { size: 1e6, name: 'million' },
] as const

/**
 * A plain-language echo for big numbers: 16672260 -> "1.67 crore".
 * Returns null when the number is small enough to read at a glance.
 */
export function magnitudeWords(value: Dec, system: NumberSystem): string | null {
  if (!value.isFinite()) return null
  const abs = value.abs()
  const units = system === 'indian' ? INDIAN_UNITS : INTERNATIONAL_UNITS

  // A unit applies only once the number actually reaches it: 99,999 is not "1 lakh".
  let i = units.findIndex((u) => abs.gte(u.size))
  if (i === -1) return null

  let scaled = abs.div(units[i]!.size).toDecimalPlaces(2, D.ROUND_HALF_UP)

  // ...but within the units, roll up rather than print "100 lakh" for 99,99,999.
  const larger = units[i - 1]
  if (larger && scaled.gte(larger.size / units[i]!.size)) {
    i -= 1
    scaled = abs.div(larger.size).toDecimalPlaces(2, D.ROUND_HALF_UP)
  }

  return `${value.isNegative() ? MINUS : ''}${scaled.toFixed()} ${units[i]!.name}`
}

/**
 * For a cursor in the formatted expression: for every position 0..text.length, the matching position in the
 * raw expression. Formatting only ever adds commas and spaces and swaps one symbol for another (* for ×), so
 * walking the two together is enough. The display's cursor and the engine's cursor can then be the same one.
 */
export function caretMap(formatted: string, raw: string): number[] {
  const map: number[] = [0]
  let r = 0
  for (const ch of formatted) {
    const inserted = ch === ',' || (ch === ' ' && raw[r] !== ' ')
    if (!inserted) r = Math.min(r + 1, raw.length)
    map.push(r)
  }
  return map
}

/** The display position for a raw position: just after an operator's own spaces, otherwise before any. */
export function displayCaret(map: number[], raw: string, rawIndex: number): number {
  const prevIsOp = /[+\-*/^]/.test(raw.charAt(rawIndex - 1))
  if (prevIsOp) {
    for (let p = map.length - 1; p >= 0; p--) if (map[p] === rawIndex) return p
  }
  const p = map.indexOf(rawIndex)
  return p === -1 ? map.length - 1 : p
}
