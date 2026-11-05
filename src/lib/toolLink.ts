import type { Dec } from '../engine'
import type { Fmt, Output, TimeUnit, ToolSpec, Unit } from './tool'

/**
 * "Use this result in another tool": which calculators have a box a result can go into.
 * Only plain numbers travel. Money goes to a rupee box, a percent to a percent box, a plain count or measure to a
 * box with no unit. A duration (the row says its `timeUnit`) goes only to a box that offers that unit, so a months
 * result can never land in a years box. Text answers ("5 years, 2 months"), negatives and dates never do.
 * The person always picks the field, so nothing here guesses which of two rupee boxes is meant.
 */
export interface LinkField { id: string; label: string; unit: Unit | undefined; /** Set when the box has a unit switch: the screen then also sets the switch to the result's unit. */ units?: TimeUnit[] }
export interface LinkTarget { toolId: string; title: string; fields: LinkField[] }

const TIME: Unit[] = ['years', 'months', 'days']

/** The result to offer: the headline row, if it is a finite, non-negative number. Null means no "Use in" action. */
export function linkable(out: Output): { value: Dec; fmt: Fmt; label: string; unit?: TimeUnit } | null {
  const row = out.rows.find((r) => r.main) ?? out.rows[0]
  if (!row || typeof row.value === 'string') return null
  const fmt = row.fmt ?? 'number'
  if (fmt === 'text' || !row.value.isFinite() || row.value.isNegative()) return null
  return { value: row.value, fmt, label: row.label, unit: row.timeUnit }
}

/** The plain digits that go into the box: 2 decimals for money and percent, up to 4 for other numbers. */
export function linkText(value: Dec, fmt: Fmt): string {
  const dp = fmt === 'money' || fmt === 'percent' ? 2 : fmt === 'int' ? 0 : 4
  return value.toDecimalPlaces(dp).toFixed()
}

/** The time units a box takes: its switch, or its one fixed unit. Empty for a box that is not a duration. */
const timeUnitsOf = (f: { unit?: Unit; units?: TimeUnit[] }): Unit[] => f.units ?? (f.unit && TIME.includes(f.unit) ? [f.unit] : [])

const fits = (fmt: Fmt, unit: TimeUnit | undefined, f: { unit?: Unit; units?: TimeUnit[] }) =>
  fmt === 'money' ? f.unit === 'rupee' : fmt === 'percent' ? f.unit === 'percent' : unit ? timeUnitsOf(f).includes(unit) : f.unit === undefined || f.unit === 'none'

/** Every other calculator that has at least one number box this result fits, with those boxes. */
export function linkTargets(specs: ToolSpec[], fromToolId: string, fmt: Fmt, unit?: TimeUnit): LinkTarget[] {
  const out: LinkTarget[] = []
  for (const s of specs) {
    if (s.id === fromToolId) continue
    const fields = s.fields.flatMap((f): LinkField[] => (f.kind === 'number' && fits(fmt, unit, f) ? [{ id: f.id, label: f.label, unit: f.unit, units: f.units }] : []))
    if (fields.length) out.push({ toolId: s.id, title: s.title, fields })
  }
  return out
}
