import { D, type Dec } from '../engine'
import type { TimeUnit } from '../engine/duration'
import { decimalComma } from './decimalComma'

/**
 * A calculator, described as data. The generic ToolScreen renders the form and the result,
 * so adding a calculator means: engine function + tests, then one ToolSpec. No new screen.
 * Specs live in src/features/tools/<module>.ts and call the engine; they never format.
 */

export type Category = 'everyday' | 'loans' | 'invest' | 'tax' | 'metrics'

export const CATEGORY_LABEL: Record<Category, string> = {
  everyday: 'Everyday',
  loans: 'Loans and EMI',
  invest: 'Investments',
  tax: 'Tax and salary',
  metrics: 'Product metrics',
}

/** Text typed by the user. Rows are lists of rows of text (unit-price rows, grade rows, cashflows). */
export type Values = Record<string, string | string[][]>

/** How a unit sits next to a number field. Display only. */
export type Unit = 'rupee' | 'percent' | 'years' | 'months' | 'days' | 'none'

export type { TimeUnit }

/**
 * A duration box the person can switch between years, months and days. `units[0]` MUST equal what the box meant
 * before the switch existed (the field's `unit`; "years" for a text box where a bare number means years), because a
 * saved card has no unit key and reopens on `units[0]`. The chosen unit lives in `values['<id>__unit']`, not in the spec.
 */
export interface WithUnits {
  units?: TimeUnit[]
}

/** The key under which the chosen unit of field `id` is stored in the form values. */
export const unitKey = (id: string): string => `${id}__unit`

/** The unit chosen for a duration field: the stored one if it is on offer, else `units[0]` (a missing, empty or garbage key). */
export function unitOf(f: { id: string; unit?: Unit; units?: TimeUnit[] }, v: Values): TimeUnit {
  const raw = v[unitKey(f.id)]
  return f.units?.find((u) => u === raw) ?? f.units?.[0] ?? (f.unit as TimeUnit)
}

interface FieldBase {
  id: string
  label: string
  hint?: string
  /** Hide the field unless this is true for the current values. */
  visibleIf?: (v: Values) => boolean
  /** Rarely needed: the screen tucks it under a closed "More options" line. Keep the 3 to 5 fields that matter on top. */
  advanced?: boolean
  /** The label as a function of the current values ("MRP" / "Final price"). The screen, the share text and the answer use it; `label` stays the fixed fallback and the field id never changes. */
  labelFor?: (v: Values) => string
  /** Neighbouring fields with the same `cluster` text are drawn as one block under that heading (advance tax: four payments). Ids and values are untouched. */
  cluster?: string
  /** Set on an advanced money field whose default is an example the person should check: while it still holds the default, the result says "uses example values". */
  example?: boolean
  /** The id of a select field this one trades values with. The screen shows one "Swap from and to" button after this field. Both ids stay as they are. */
  swapWith?: string
}

/** The label to show for a field right now. */
export const labelOf = (f: { label: string; labelFor?: (v: Values) => string }, v: Values): string => f.labelFor?.(v) || f.label

export type Field =
  | (FieldBase & WithUnits & { kind: 'number'; unit?: Unit; default?: string })
  | (FieldBase & { kind: 'select'; options: { value: string; label: string }[]; default: string })
  | (FieldBase & { kind: 'date'; default?: string })
  /** A time of day, "HH:MM" (24 hour). Blank is allowed when the spec says what blank means. */
  | (FieldBase & { kind: 'time'; default?: string })
  /** `chip` adds a small unit label after the box, worked out from the typed text (the loan term shows "years" for a bare number). */
  | (FieldBase & WithUnits & { kind: 'text'; default?: string; chip?: (text: string) => string })
  /** A growable list of rows. `columns` are the fields of one row (number, select, date or text). */
  | (FieldBase & { kind: 'rows'; columns: Exclude<Field, { kind: 'rows' }>[]; min: number; max: number; defaultRows: string[][] })

/** How a number is shown. 'text' passes a string through untouched. */
export type Fmt = 'money' | 'percent' | 'number' | 'int' | 'text'

export type Cell = string | Dec

export interface ResultRow {
  label: string
  value: Cell
  fmt?: Fmt
  /** The headline figure. One per result. */
  main?: boolean
  /** A unit shown after the number ("0.62 Mile"). Display and share text only: `value` stays a plain number. */
  unit?: string
  /** Set on a headline row that is a duration: its unit, so "Use in another tool" sends it only to a box that offers that unit. A row without it goes only to unit-less boxes. */
  timeUnit?: TimeUnit
  /**
   * "This is good / bad for you." Colours the value green or red.
   *
   * Use it only where good and bad are genuinely unambiguous (you save money,
   * you pay a penalty, an option is the cheaper one). A number that is merely
   * large, or merely a fact, has no tone. Colour is never the only signal: the
   * renderer also states it for a screen reader, since roughly 1 in 12 men
   * cannot separate red from green.
   */
  tone?: 'positive' | 'negative'
}

export interface ResultTable {
  title?: string
  columns: string[]
  /** One per column; defaults to 'text' for strings and 'number' for Decimals. */
  fmts?: Fmt[]
  rows: Cell[][]
}

/** Drawing only, so plain numbers are fine here. Money in `rows` and `table` stays Decimal. */
export interface ResultChart {
  title: string
  /** One label per bar, e.g. "Y1". */
  labels: string[]
  /** Series are stacked in order. The first is drawn at the bottom. */
  series: { name: string; values: number[] }[]
}

export interface Output {
  rows: ResultRow[]
  table?: ResultTable
  chart?: ResultChart
  /** "Formula transparency": the formula, then the substituted values. One line each. */
  formula?: string[]
  /** One plain-language line under the result: a verdict, a caveat, a disclaimer. */
  note?: string
  /** An amount the screen can offer to keep as a Budget expense ("Save my share to Budget"). Shown only when above zero. */
  expense?: { amount: Dec; note: string }
  /** A start -> end line with the count between (date difference). Plain strings, already formatted. */
  span?: { start: string; end: string; between: string }
}

/** When a rule pack's rates were last checked, and the first day they may be out of date (a new tax year, the next quarter). ISO dates. */
export interface RatesStamp {
  asOf: string
  until: string
}

/** An error may name the field id it is about (`field`); the screen then marks exactly that input. Without it the screen works it out. */
export type Computed = Output | { error: string; field?: string }

export interface ToolSpec {
  id: string
  title: string
  /** One line shown in the list. */
  blurb: string
  category: Category
  /** Extra words the search box matches, and the natural-language input later. */
  keywords: string[]
  /** Set ONLY when docs/VERIFICATION.md names an outside source (status A). Shown as a quiet line under the result. Leave unset otherwise: no label beats a weak claim. */
  verified?: { source: string }
  /** Set when the answer depends on a rate or rule that changes: shows "Rates as of ..." under the result. One stamp per rule pack (`RATES_AS_OF` next to its constants). */
  rates?: RatesStamp
  fields: Field[]
  compute: (values: Values) => Computed
}

// ---- helpers every spec uses ------------------------------------------------

/** A finite number from typed text, or null. Accepts "1,50,000", "₹", spaces and a unicode minus. */
export function parseNum(text: string | string[][] | undefined): Dec | null {
  if (typeof text !== 'string') return null
  const clean = decimalComma(text).replace(/[,₹\s]/g, '').replace(/−/g, '-')
  if (clean === '' || clean === '-' || clean === '.') return null
  try {
    const v = new D(clean)
    return v.isFinite() ? v : null
  } catch {
    return null
  }
}

/** True for a box that has text which isn't blank but doesn't parse as a number -- "12abc", not "". An
 * empty optional field is fine and means 0; junk in it must never silently become 0 too. */
export const isJunk = (text: unknown): boolean => typeof text === 'string' && text.trim() !== '' && parseNum(text) === null

/** For OPTIONAL number fields read with a `?? 0` default: the first one with junk in it, as an error. */
export function junkOptional(values: Values, fields: { id: string; label: string }[]): { error: string } | null {
  const bad = fields.find((f) => isJunk(values[f.id]))
  return bad ? { error: `${bad.label} isn't a number` } : null
}

/** Reads required numbers by id. Returns the first missing label as an error, so the screen says what to fill in. */
export function need(
  values: Values,
  fields: { id: string; label: string }[],
): { ok: true; n: Record<string, Dec> } | { ok: false; error: string; field: string } {
  const n: Record<string, Dec> = {}
  for (const f of fields) {
    const v = parseNum(values[f.id])
    if (v === null) return { ok: false, error: `Enter ${f.label.toLowerCase()}`, field: f.id }
    n[f.id] = v
  }
  return { ok: true, n }
}

export const isError = (c: Computed): c is { error: string; field?: string } => 'error' in c

/** The starting values of a spec: every field's default. */
export function defaultValues(spec: ToolSpec): Values {
  const out: Values = {}
  for (const f of spec.fields) {
    if (f.kind === 'rows') out[f.id] = f.defaultRows.map((r) => [...r])
    else out[f.id] = 'default' in f && f.default !== undefined ? f.default : ''
    // A duration box opens on `units[0]`, the old meaning, so a saved card (no unit key) and a fresh form agree.
    if ((f.kind === 'number' || f.kind === 'text') && f.units && f.units.length > 1) out[unitKey(f.id)] = f.units[0]!
  }
  return out
}

/** Labels of the example-value fields that still hold their default, in field order. Empty when the person has changed them all. */
export function exampleFieldsInUse(spec: ToolSpec, v: Values): string[] {
  return spec.fields
    .filter((f): f is Extract<Field, { kind: 'number' }> => f.kind === 'number' && f.example === true && (!f.visibleIf || f.visibleIf(v)))
    .filter((f) => (typeof v[f.id] === 'string' ? (v[f.id] as string).trim() : '') === (f.default ?? ''))
    .map((f) => labelOf(f, v))
}
