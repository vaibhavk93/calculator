import { D, ERROR_MESSAGES, evaluateExpression, toPlain, type Dec } from '../engine'
import type { FormatOptions } from './format'
import type { TapeLine } from './memory'
import { formatCell } from './toolFormat'

export type TapeParse = { ok: true; label: string; value: Dec } | { ok: false; error: string }

/**
 * "Flights 24000" -> label "Flights", value 24000. The label is everything before the numeric
 * tail, so "Wifi 2.4G 500" is "Wifi 2.4G" and "Refund -500" is a refund. The tail may be a sum: "Rent 25000+3000".
 */
export function parseTapeLine(text: string): TapeParse {
  const m = /^(.*?)\s*([-+]?\s*[\d.(][\d.,+\-*/×÷()%\s]*)$/.exec(text.trim())
  if (!m) return { ok: false, error: 'Add an amount, like "Flights 24000"' }
  const expr = m[2]!.replace(/[,\s]/g, '').replace(/×/g, '*').replace(/÷/g, '/')
  const r = evaluateExpression(expr, { angle: 'deg' })
  if (!r.ok) return { ok: false, error: ERROR_MESSAGES[r.code] }
  return { ok: true, label: m[1]!.trim(), value: r.value }
}

export const tapeTotal = (lines: { value: string }[]): Dec => lines.reduce((sum, l) => sum.plus(l.value), new D(0))

export interface Progress {
  done: number
  total: number
  doneAmount: Dec
  leftAmount: Dec
}

/** How far a checklist has got: counts, and the money collected and still to collect. */
export function listProgress(lines: TapeLine[]): Progress {
  let doneAmount = new D(0)
  let leftAmount = new D(0)
  let done = 0
  for (const l of lines) {
    if (l.done) {
      done++
      doneAmount = doneAmount.plus(l.value)
    } else leftAmount = leftAmount.plus(l.value)
  }
  return { done, total: lines.length, doneAmount, leftAmount }
}

/** The one line shown for a list in Saved: "3 lines, total ₹5,000.00", or for a checklist "2 of 5 done, ₹3,000.00 left". */
export function listSummary(lines: TapeLine[], checklist: boolean, opts: FormatOptions): string {
  const n = lines.length
  if (checklist && n > 0) {
    const p = listProgress(lines)
    return p.done === n ? `All ${n} done, total ${formatCell(tapeTotal(lines), 'money', opts)}` : `${p.done} of ${n} done, ${formatCell(p.leftAmount, 'money', opts)} left`
  }
  return `${n} ${n === 1 ? 'line' : 'lines'}, total ${formatCell(tapeTotal(lines), 'money', opts)}`
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
