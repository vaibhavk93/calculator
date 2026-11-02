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

/*
 * BIG AND TINY NUMBERS: one rule for every place a number is shown (display, history, tools, budget, copy).
 *   - up to 15 integer digits: plain grouped digits (Indian or international), as before;
 *   - 1e15 and above: scientific notation with up to 10 significant digits, "1.234567890E+25" (trailing zeros
 *     trimmed, only the letters E, + and digits; a negative exponent reads "E-12"). No grouping in the mantissa;
 *   - in "auto" decimals, a non-zero value too small for 10 places ("0.0000000000") reads "1E-12", never "0";
 *   - the words line (magnitudeWords) names a size only where a name exists, otherwise it is null;
 *   - the engine's own limit is 1e100: past it the calculator says "Too large to show" in words. Below that,
 *     every result is a number, never NaN, Infinity or undefined.
 * Copy follows the same switch but keeps 20 significant digits and an ASCII minus, and the engine reads
 * "1.2345E+25" back as a number (tokenizer), so a copied huge number pastes and calculates.
 */
/** Integer digits shown in full; a value of 1e15 or more is scientific. */
export const MAX_PLAIN_INTEGER_DIGITS = 15
const SCI_LIMIT = new D(10).pow(MAX_PLAIN_INTEGER_DIGITS)
const SCI_SIGNIFICANT = 10
const COPY_SIGNIFICANT = 20

/** 1.2345678E+25 style text. `minus` is the sign character to use. */
function sci(value: Dec, significant: number, minus: string): string {
  const [mantissa = '0', exp = '+0'] = value.abs().toSignificantDigits(significant, D.ROUND_HALF_UP).toExponential().split('e')
  return (value.isNegative() ? minus : '') + mantissa + 'E' + exp
}

/** The short scientific form of any number: what a display falls back to when the plain digits do not fit. */
export function formatCompact(value: Dec): string {
  return value.isFinite() ? (value.isZero() ? '0' : sci(value, SCI_SIGNIFICANT, MINUS)) : '—'
}

/** True when a number of this size is shown in scientific notation. */
export const isHuge = (v: Dec): boolean => v.isFinite() && v.abs().gte(SCI_LIMIT)

export function formatDecimal(value: Dec, opts: FormatOptions): string {
  if (!value.isFinite()) return '—'

  const places = opts.decimals === 'auto' ? AUTO_MAX_DECIMALS : opts.decimals
  const rounded = value.toDecimalPlaces(places, D.ROUND_HALF_UP)
  if (isHuge(rounded)) return formatCompact(value)
  // Too small for ten places: "0" would hide that there is something there.
  if (opts.decimals === 'auto' && rounded.isZero() && !value.isZero()) return formatCompact(value)
  const text = opts.decimals === 'auto' ? rounded.toFixed() : rounded.toFixed(places)

  // -0.001 at 2 places rounds to zero; showing "-0.00" would be a lie.
  const negative = rounded.isNegative() && !rounded.isZero()
  const [int = '0', frac] = text.replace('-', '').split('.')
  return (negative ? MINUS : '') + groupInteger(int, opts.system) + (frac ? '.' + frac : '')
}

/**
 * What goes on the clipboard: the value at the user's chosen precision, with no
 * grouping commas and an ASCII minus, so it pastes cleanly into a spreadsheet.
 * 1e15 and above (and a tiny value in auto) is scientific, "1.2345E+25", which the calculator reads back.
 */
export function formatForCopy(value: Dec, decimals: DecimalSetting): string {
  if (!value.isFinite()) return ''
  const places = decimals === 'auto' ? AUTO_MAX_DECIMALS : decimals
  const rounded = value.toDecimalPlaces(places, D.ROUND_HALF_UP)
  if (isHuge(rounded) || (decimals === 'auto' && rounded.isZero() && !value.isZero())) return sci(value, COPY_SIGNIFICANT, '-')
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

/** A number (optionally "E+25"), an operator, or anything else. Capital E only: a lowercase "e" is Euler's number. */
const EXPR_TOKEN = String.raw`((?:\d+\.?\d*|\.\d+)(?:E[+-]?\d+)?)|([+\-*/^])|([^\d.+\-*/^]+|\.)`
/** The longest number that can be typed; a longer one in the expression came from a result. */
const TYPED_NUMBER_CHARS = 24

/** A plain number too long to have been typed (a result) and 1e15 or bigger, or tiny: its short form "1.234E+25". */
function shortNumber(num: string): string | null {
  if (num.length <= TYPED_NUMBER_CHARS || num.includes('E')) return null
  const d = new D(num)
  return isHuge(d) || (!d.isZero() && d.abs().lt('1e-9')) ? formatCompact(d) : null
}

/** One number as the expression shows it. */
function numberText(num: string, system: NumberSystem): string {
  const e = num.indexOf('E')
  if (e !== -1) return numberText(num.slice(0, e), system) + num.slice(e)
  const short = shortNumber(num)
  if (short !== null) return short
  const dot = num.indexOf('.')
  if (dot === -1) return groupInteger(num, system)
  if (dot === 0) return num
  return groupInteger(num.slice(0, dot), system) + num.slice(dot)
}

/**
 * Turns the raw typed expression into what the user reads:
 * numbers grouped as they are typed, real operators, a true minus sign.
 *   "150000+2.5*-3" -> "1,50,000 + 2.5 × −3"
 */
export function formatExpression(raw: string, system: NumberSystem): string {
  const re = new RegExp(EXPR_TOKEN, 'g')
  let out = ''
  let prev: Prev = 'start'

  for (const m of raw.matchAll(re)) {
    const [, num, op, other] = m

    if (num !== undefined) {
      out += numberText(num, system)
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

/*
 * Names, largest first. "lakh crore" (1e12) is how people say it, so it stays; arab and kharab fill 1e9-1e12,
 * neel, padma and shankh go above it. International runs on to decillion. A unit applies once the number reaches
 * it; the top one stops at 1000 of itself, and above that there is no name, so the line is silent.
 */
const INDIAN_UNITS = [
  { size: 1e17, name: 'shankh' },
  { size: 1e15, name: 'padma' },
  { size: 1e13, name: 'neel' },
  { size: 1e12, name: 'lakh crore' },
  { size: 1e11, name: 'kharab' },
  { size: 1e9, name: 'arab' },
  { size: 1e7, name: 'crore' },
  { size: 1e5, name: 'lakh' },
] as const

const INTERNATIONAL_UNITS = [
  { size: 1e33, name: 'decillion' },
  { size: 1e30, name: 'nonillion' },
  { size: 1e27, name: 'octillion' },
  { size: 1e24, name: 'septillion' },
  { size: 1e21, name: 'sextillion' },
  { size: 1e18, name: 'quintillion' },
  { size: 1e15, name: 'quadrillion' },
  { size: 1e12, name: 'trillion' },
  { size: 1e9, name: 'billion' },
  { size: 1e6, name: 'million' },
] as const

/** The top unit is used up to this many of itself ("999 shankh"); beyond that no name exists. */
const TOP_UNIT_MAX = 1000

/**
 * A plain-language echo for big numbers: 16672260 -> "1.67 crore".
 * Returns null when the number is small enough to read at a glance, or too big for any name.
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
  if (i === 0 && scaled.gte(TOP_UNIT_MAX)) return null

  return `${value.isNegative() ? MINUS : ''}${scaled.toFixed()} ${units[i]!.name}`
}

/**
 * For a cursor in the formatted expression: for every position 0..text.length, the matching position in the
 * raw expression. Formatting only ever adds commas and spaces and swaps one symbol for another (* for ×), so
 * walking the two together is enough. The display's cursor and the engine's cursor can then be the same one.
 */
export function caretMap(formatted: string, raw: string): number[] {
  const map: number[] = [0]
  // A long result is shortened ("1.2E+25"), so one stretch of display text stands for a whole raw number.
  const shortened = new Map<number, { end: number; text: string }>()
  for (const m of raw.matchAll(new RegExp(EXPR_TOKEN, 'g'))) {
    if (m[1] === undefined) continue
    const text = shortNumber(m[1])
    if (text !== null) shortened.set(m.index ?? 0, { end: (m.index ?? 0) + m[1].length, text })
  }

  let r = 0
  for (let f = 0; f < formatted.length; ) {
    const s = shortened.get(r)
    if (s && formatted.startsWith(s.text, f)) {
      for (let k = 1; k < s.text.length; k++) map.push(r)
      map.push(s.end)
      r = s.end
      f += s.text.length
      continue
    }
    const ch = formatted.charAt(f++)
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
