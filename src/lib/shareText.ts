import { D } from '../engine'
import { typedUnit, unitText } from '../engine/duration'
import type { FormatOptions } from './format'
import { formatDecimal } from './format'
import { RUPEE } from './toolFormat'
import { parseNum, unitOf, type Field, type Values } from './tool'

export interface ShareLine {
  label: string
  text: string
}

/**
 * The message people paste into a chat. A bare "₹43,391" means nothing out of context, so it carries the title,
 * what was typed in, and the answers, in that order, and says where it came from.
 */
export function buildShareText(s: { title: string; inputs: ShareLine[]; rows: ShareLine[]; note?: string }): string {
  const out = [s.title]
  if (s.inputs.length) out.push(s.inputs.map((l) => `${l.label}: ${l.text}`).join(' · '))
  if (s.rows.length) out.push('', ...s.rows.map((l) => `${l.label}: ${l.text}`))
  if (s.note) out.push('', s.note)
  out.push('', 'Worked out in Calc')
  return out.join('\n')
}

/** What the person typed, as words: "₹50,00,000", "8.5%", "20 years", or the chosen option's label. Empty and hidden fields are left out. */
export function inputLines(fields: Field[], values: Values, opts: FormatOptions): ShareLine[] {
  const out: ShareLine[] = []
  for (const f of fields) {
    if (f.visibleIf && !f.visibleIf(values)) continue
    const raw = values[f.id]
    if (typeof raw !== 'string' || raw.trim() === '') continue
    if (f.kind === 'select') {
      const label = f.options.find((o) => o.value === raw)?.label
      if (label) out.push({ label: f.label, text: label })
    } else if (f.kind === 'number') {
      const n = parseNum(raw)
      if (n === null) continue
      const grouped = formatDecimal(new D(n), { ...opts, decimals: 'auto' })
      // A box with a unit switch prints the chosen unit ("18 months", "1 month"); a fixed unit prints as it always did.
      const text =
        f.unit === 'rupee' ? RUPEE + grouped : f.unit === 'percent' ? `${grouped}%` : f.units && f.units.length > 1 ? `${grouped} ${unitText(n, unitOf(f, values))}` : f.unit && f.unit !== 'none' ? `${grouped} ${f.unit}` : grouped
      out.push({ label: f.label, text })
    } else if (f.kind === 'text' && f.units && f.units.length > 1) {
      // The loan term: a bare number takes the chosen unit; a typed "18 months" already says it.
      const n = parseNum(raw)
      out.push({ label: f.label, text: typedUnit(raw) || n === null ? raw : `${raw.trim()} ${unitText(n, unitOf(f, values))}` })
    } else if (f.kind === 'date' || f.kind === 'time' || f.kind === 'text') {
      out.push({ label: f.label, text: raw })
    }
  }
  return out
}
