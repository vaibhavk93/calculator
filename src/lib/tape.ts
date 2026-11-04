import { D, ERROR_MESSAGES, evaluateExpression, toPlain, type Dec } from '../engine'
import type { FormatOptions } from './format'
import type { TapeLine } from './memory'
import { formatCell } from './toolFormat'
import { decimalComma } from './decimalComma'

export type TapeParse = { ok: true; label: string; value: Dec } | { ok: false; error: string }

/**
 * "Flights 24000" -> label "Flights", value 24000. The label is everything before the numeric
 * tail, so "Wifi 2.4G 500" is "Wifi 2.4G" and "Refund -500" is a refund. The tail may be a sum: "Rent 25000+3000".
 */
export function parseTapeLine(text: string): TapeParse {
  // The real minus sign (U+2212, which the app shows and copies) and the en dash mean minus (B-14).
  text = text.replace(/[−–]/g, '-')
  const m = /^(.*?)\s*([-+]?\s*[\d.(][\d.,+\-*/×÷()%\s]*)$/.exec(text.trim())
  if (!m) return { ok: false, error: 'Add an amount, like "Flights 24000"' }
  const expr = decimalComma(m[2]!.trim()).replace(/[,\s]/g, '').replace(/×/g, '*').replace(/÷/g, '/')
  const r = evaluateExpression(expr, { angle: 'deg' })
  if (!r.ok) return { ok: false, error: ERROR_MESSAGES[r.code] }
  return { ok: true, label: m[1]!.trim(), value: r.value }
}

/** The sum of the lines that count: a skipped line is left out. */
export const tapeTotal = (lines: { value: string; skip?: boolean }[]): Dec => lines.reduce((sum, l) => (l.skip ? sum : sum.plus(l.value)), new D(0))

/** A checklist line is waiting, paid (ticked), or skipped (not paid, and not going to be). */
export type LineState = 'pending' | 'paid' | 'skip'
export const LINE_STATE_WORD: Record<LineState, string> = { pending: 'Pending', paid: 'Paid', skip: 'Skipped' }

export const lineState = (l: Pick<TapeLine, 'done' | 'skip'>): LineState => (l.done ? 'paid' : l.skip ? 'skip' : 'pending')
/** One tap moves pending to paid to skipped and back to pending. */
export const nextLineState = (s: LineState): LineState => (s === 'pending' ? 'paid' : s === 'paid' ? 'skip' : 'pending')
/** The line in state `s`. Old lines (only `done`) stay valid: a flag is added only when it is on. */
export function withLineState(l: TapeLine, s: LineState): TapeLine {
  const { done: _d, skip: _s, ...rest } = l
  return s === 'paid' ? { ...rest, done: true } : s === 'skip' ? { ...rest, skip: true } : rest
}

export interface Progress {
  /** Paid lines. */
  done: number
  /** Lines that count: everything except the skipped ones. */
  total: number
  skipped: number
  doneAmount: Dec
  leftAmount: Dec
}

/** How far a checklist has got: counts, and the money collected and still to collect. Skipped lines are in neither. */
export function listProgress(lines: TapeLine[]): Progress {
  let doneAmount = new D(0)
  let leftAmount = new D(0)
  let done = 0
  let skipped = 0
  for (const l of lines) {
    if (l.skip && !l.done) skipped++
    else if (l.done) {
      done++
      doneAmount = doneAmount.plus(l.value)
    } else leftAmount = leftAmount.plus(l.value)
  }
  return { done, total: lines.length - skipped, skipped, doneAmount, leftAmount }
}

/** The one line shown for a list in Saved: "3 lines, total ₹5,000.00", or for a checklist "2 of 5 done, ₹3,000.00 left". */
export function listSummary(lines: TapeLine[], checklist: boolean, opts: FormatOptions): string {
  const n = lines.length
  if (checklist && n > 0) {
    const p = listProgress(lines)
    if (p.total === 0) return `All ${n} skipped`
    const skipped = p.skipped > 0 ? `, ${p.skipped} skipped` : ''
    return p.done === p.total ? `All ${p.total} done, total ${formatCell(tapeTotal(lines), 'money', opts)}${skipped}` : `${p.done} of ${p.total} done, ${formatCell(p.leftAmount, 'money', opts)} left${skipped}`
  }
  return `${n} ${n === 1 ? 'line' : 'lines'}, total ${formatCell(tapeTotal(lines), 'money', opts)}`
}

// ------------------------------------------------------------------ pasted lists

/** The most lines taken from one paste. */
export const MAX_PASTE_LINES = 200

export interface PastedItem {
  label: string
  /** Plain decimal string; "0" when the line had no amount. */
  value: string
  /** The line was already ticked ("✔ ", "[x] "). */
  done: boolean
}

export interface PastedList {
  items: PastedItem[]
  /** Non-empty lines beyond MAX_PASTE_LINES that were left out. */
  dropped: number
}

/** A list bullet, a number ("1." or "2)"), a box ("[ ]", "[x]", ☐, ☑, ✔) at the start of a line. */
const BULLET = /^\s*(?:[-*•·▪◦–](?=\s|$)|\d{1,3}[.)](?=\s)|\[[ xX✓✔]?\]|[☐☑☒✔✓])\s*/

/**
 * Turns pasted text with several lines into list items: one per non-empty line. A line like "Flights 24000" keeps
 * its amount; a plain line ("Milk") becomes an item with amount 0. Bullets, numbers and tick boxes are dropped from
 * the start. Returns null unless there are at least two lines (one line is just typed text).
 */
export function parsePastedList(text: string): PastedList | null {
  const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return null
  const items: PastedItem[] = []
  for (const raw of lines.slice(0, MAX_PASTE_LINES)) {
    const done = /^\s*(?:\[[xX✓✔]\]|[☑✔✓])/.test(raw)
    const line = raw.replace(BULLET, '').replace(/₹/g, '').trim()
    if (!line) continue
    const r = parseTapeLine(line)
    items.push(r.ok ? { label: r.label.slice(0, 80), value: toPlain(r.value), done } : { label: line.slice(0, 80), value: '0', done })
  }
  return items.length < 2 ? null : { items, dropped: Math.max(0, lines.length - MAX_PASTE_LINES) }
}

/** `count` equal lines of `value`, for taking one share to a list ("1,000 x 5 friends"). Labels are numbered when there is more than one. */
export function repeatLines(value: string, count: number, label: string, newId: () => string): TapeLine[] {
  const n = Math.max(1, Math.min(50, Math.floor(count)))
  const base = label.trim()
  return Array.from({ length: n }, (_, i) => ({
    id: newId(),
    label: n === 1 ? base : `${base || 'Person'} ${i + 1}`,
    value,
  }))
}

export { toPlain }
