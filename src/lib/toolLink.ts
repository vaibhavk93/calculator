import type { Dec } from '../engine'
import type { Fmt, Output, ToolSpec, Unit } from './tool'

/**
 * "Use this result in another tool": which calculators have a box a result can go into.
 * Only plain numbers travel. Money goes to a rupee box, a percent to a percent box, a count or measure to a
 * box with no unit or a time unit. Text answers ("5 years, 2 months"), negatives and dates never do.
 * The person always picks the field, so nothing here guesses which of two rupee boxes is meant.
 */
export interface LinkField { id: string; label: string; unit: Unit | undefined }
export interface LinkTarget { toolId: string; title: string; fields: LinkField[] }

const COUNT_UNITS: (Unit | undefined)[] = [undefined, 'none', 'years', 'months', 'days']

/** The result to offer: the headline row, if it is a finite, non-negative number. Null means no "Use in" action. */
export function linkable(out: Output): { value: Dec; fmt: Fmt; label: string } | null {
  const row = out.rows.find((r) => r.main) ?? out.rows[0]
  if (!row || typeof row.value === 'string') return null
  const fmt = row.fmt ?? 'number'
  if (fmt === 'text' || !row.value.isFinite() || row.value.isNegative()) return null
  return { value: row.value, fmt, label: row.label }
}

/** The plain digits that go into the box: 2 decimals for money and percent, up to 4 for other numbers. */
export function linkText(value: Dec, fmt: Fmt): string {
  const dp = fmt === 'money' || fmt === 'percent' ? 2 : fmt === 'int' ? 0 : 4
  return value.toDecimalPlaces(dp).toFixed()
}

const fits = (fmt: Fmt, unit: Unit | undefined) =>
  fmt === 'money' ? unit === 'rupee' : fmt === 'percent' ? unit === 'percent' : COUNT_UNITS.includes(unit)

/** Every other calculator that has at least one number box this result fits, with those boxes. */
export function linkTargets(specs: ToolSpec[], fromToolId: string, fmt: Fmt): LinkTarget[] {
  const out: LinkTarget[] = []
  for (const s of specs) {
    if (s.id === fromToolId) continue
    const fields = s.fields.flatMap((f): LinkField[] => (f.kind === 'number' && fits(fmt, f.unit) ? [{ id: f.id, label: f.label, unit: f.unit }] : []))
    if (fields.length) out.push({ toolId: s.id, title: s.title, fields })
  }
  return out
}
