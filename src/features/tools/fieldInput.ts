import { D } from '../../engine/decimal'
import { legacyTermText } from '../../engine/loans/term'
import { groupInteger, type NumberSystem } from '../../lib/format'
import { parseNum, unitOf, type Field, type Values } from '../../lib/tool'

/** A field that is one input (not a list of rows). */
export type Leaf = Exclude<Field, { kind: 'rows' }>

/** Money and plain counts get grouping as you type. Percent, years, months and days never do. */
export const shouldGroup = (f: Leaf) => f.kind === 'number' && (f.unit === undefined || f.unit === 'none' || f.unit === 'rupee')

/** What is stored: an optional leading minus, digits and at most one dot. "₹1,50,000" -> "150000". */
export function rawNumber(text: string): string {
  const t = text.replace(/−/g, '-')
  const neg = t.trim().startsWith('-')
  let seenDot = false
  const body = t.replace(/[^\d.]/g, '').replace(/\./g, () => (seenDot ? '' : ((seenDot = true), '.')))
  return (neg ? '-' : '') + body
}

/** What is shown while typing: "-1234567.5" -> "-12,34,567.5". A trailing dot is kept so "12." can be typed. */
export function groupTyped(raw: string, system: NumberSystem): string {
  const neg = raw.startsWith('-') ? '-' : ''
  const [int = '', ...rest] = raw.replace('-', '').split('.')
  return neg + groupInteger(int, system) + (rest.length ? '.' + rest[0] : '')
}

const SIGNIFICANT = /[\d.-]/

/** How many digits, dots and minus signs sit before the caret. Commas do not count, so formatting can move them freely. */
export function significantBefore(text: string, caret: number): number {
  return [...text.slice(0, caret)].filter((c) => SIGNIFICANT.test(c)).length
}

/** Where the caret goes in `display` so it sits after the same `significant` characters as before. */
export function caretFor(display: string, significant: number): number {
  if (significant <= 0) return 0
  let seen = 0
  for (let i = 0; i < display.length; i++) {
    if (SIGNIFICANT.test(display[i]!) && ++seen === significant) return i + 1
  }
  return display.length
}

const sameAsDefault = (f: Field, v: Values): boolean => {
  const now = v[f.id]
  if (f.kind === 'rows') return JSON.stringify(now ?? null) === JSON.stringify(f.defaultRows)
  const def = 'default' in f && f.default !== undefined ? f.default : ''
  // A changed unit counts as a change too, or a saved card would hide the unit it used under a closed "More options".
  if ((f.kind === 'number' || f.kind === 'text') && f.units && unitOf(f, v) !== f.units[0]) return false
  return (now ?? '') === def
}

/** "More options" opens by itself when a hidden-by-default field has been changed, so a saved card never hides what it used. */
export function advancedOpen(fields: Field[], v: Values): boolean {
  return fields.some((f) => f.advanced && (!f.visibleIf || f.visibleIf(v)) && !sameAsDefault(f, v))
}

/**
 * Loan cards saved before the single "Loan term" box kept a number (`tenure`) and a years/months pick
 * (`tenureUnit`). Folds the pair into the one text the box holds ("18 months") and drops the old key.
 * Handles the box as a field and as a column of a rows field (loan compare). Values already in the new shape pass through.
 */
export function migrateLegacyTerm(fields: Field[], v: Values): Values {
  const unit = v.tenureUnit
  if (unit === undefined) return v
  const { tenureUnit: _gone, ...rest } = v
  for (const f of fields) {
    if (f.kind === 'text' && f.id === 'tenure' && typeof rest.tenure === 'string') rest.tenure = legacyTermText(rest.tenure, unit)
    if (f.kind === 'rows') {
      const at = f.columns.findIndex((c) => c.id === 'tenure')
      const rows = rest[f.id]
      if (at >= 0 && Array.isArray(rows)) rest[f.id] = rows.map((row) => row.map((cell, i) => (i === at ? legacyTermText(cell, unit) : cell)))
    }
  }
  return rest
}

/** The quick-add chips under a money box: +1K, +10K and a lakh (+1L) or, in the international system, +100K. */
export function chipSteps(system: NumberSystem): { step: string; label: string; spoken: string }[] {
  return [
    { step: '1000', label: '+1K', spoken: '1,000' },
    { step: '10000', label: '+10K', spoken: '10,000' },
    system === 'indian' ? { step: '100000', label: '+1L', spoken: '1 lakh' } : { step: '100000', label: '+100K', spoken: '100,000' },
  ]
}

/** What the box holds after a chip adds `step` to it: blank counts as 0. Null when the text is not a number, so a chip never wipes what was typed. */
export function addAmount(raw: string, step: string): string | null {
  const now = raw.trim() === '' ? new D(0) : parseNum(raw)
  return now === null ? null : now.plus(step).toFixed()
}
