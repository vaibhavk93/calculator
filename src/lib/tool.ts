import { D, type Dec } from '../engine'

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

interface FieldBase {
  id: string
  label: string
  hint?: string
  /** Hide the field unless this is true for the current values. */
  visibleIf?: (v: Values) => boolean
  /** Rarely needed: the screen tucks it under a closed "More options" line. Keep the 3 to 5 fields that matter on top. */
  advanced?: boolean
}

export type Field =
  | (FieldBase & { kind: 'number'; unit?: Unit; default?: string })
  | (FieldBase & { kind: 'select'; options: { value: string; label: string }[]; default: string })
  | (FieldBase & { kind: 'date'; default?: string })
  | (FieldBase & { kind: 'text'; default?: string })
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
}

export type Computed = Output | { error: string }

export interface ToolSpec {
  id: string
  title: string
  /** One line shown in the list. */
  blurb: string
  category: Category
  /** Extra words the search box matches, and the natural-language input later. */
  keywords: string[]
  fields: Field[]
  compute: (values: Values) => Computed
}

// ---- helpers every spec uses ------------------------------------------------

/** A finite number from typed text, or null. Accepts "1,50,000", "₹", spaces and a unicode minus. */
export function parseNum(text: string | string[][] | undefined): Dec | null {
  if (typeof text !== 'string') return null
  const clean = text.replace(/[,₹\s]/g, '').replace(/−/g, '-')
  if (clean === '' || clean === '-' || clean === '.') return null
  try {
    const v = new D(clean)
    return v.isFinite() ? v : null
  } catch {
    return null
  }
}

/** Reads required numbers by id. Returns the first missing label as an error, so the screen says what to fill in. */
export function need(
  values: Values,
  fields: { id: string; label: string }[],
): { ok: true; n: Record<string, Dec> } | { ok: false; error: string } {
  const n: Record<string, Dec> = {}
  for (const f of fields) {
    const v = parseNum(values[f.id])
    if (v === null) return { ok: false, error: `Enter ${f.label.toLowerCase()}` }
    n[f.id] = v
  }
  return { ok: true, n }
}

export const isError = (c: Computed): c is { error: string } => 'error' in c

/** The starting values of a spec: every field's default. */
export function defaultValues(spec: ToolSpec): Values {
  const out: Values = {}
  for (const f of spec.fields) {
    if (f.kind === 'rows') out[f.id] = f.defaultRows.map((r) => [...r])
    else out[f.id] = 'default' in f && f.default !== undefined ? f.default : ''
  }
  return out
}
