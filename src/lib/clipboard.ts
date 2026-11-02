import { evaluateExpression } from '../engine'

/**
 * Reads a number out of whatever was on the clipboard: "₹1,50,000.50",
 * "$ 2,500", "(500)", "-12". Returns a plain decimal string, or null when it
 * isn't clearly a single number.
 */
export function parseClipboardNumber(text: string): string | null {
  if (text.length > 60) return null

  let s = text.trim().replace(/[\s  ,₹$€£]/g, '').replace(/[−–]/g, '-')

  // Accounting style: (500) means -500.
  const paren = /^\((.*)\)$/.exec(s)
  if (paren) s = '-' + (paren[1] ?? '')

  const m = /^(-?)(\d+\.?\d*|\.\d+)$/.exec(s)
  if (!m) return null

  const sign = m[1] ?? ''
  let body = m[2] ?? ''
  if (body.startsWith('.')) body = '0' + body
  if (body.endsWith('.')) body = body.slice(0, -1)
  // Trim redundant leading zeros but keep "0" and "0.5".
  body = body.replace(/^0+(?=\d)/, '')
  return sign + body
}

export const MAX_PASTE_CHARS = 500

export type PastedExpression = { raw: string; lines: number } | { raw: null; reason: string }

const NO_NUMBER = "There's no number in what you copied"

/**
 * Turns pasted text into the engine's raw expression form ("23*36+5"). Handles notes-app text:
 * "23 x 36", "₹1,200 - ₹300", "Rent 25000 + 3000", "= 828", "23*36 = 828", "(500)".
 * Several lines become one sum, one term per line that has a number; a line that starts with
 * "-" is subtracted. Only rewrites characters: nothing pasted is ever run as code.
 */
export function parseClipboardExpression(text: string): PastedExpression {
  if (text.length > MAX_PASTE_CHARS) return { raw: null, reason: `That's too long. Paste up to ${MAX_PASTE_CHARS} characters.` }

  const terms = text.split(/\r?\n/).map(parseLine).filter((t): t is string => t !== null)
  if (terms.length === 0) return { raw: null, reason: NO_NUMBER }

  let raw = terms[0] ?? ''
  for (const t of terms.slice(1)) raw += t.startsWith('-') ? t : `+${t}`
  return { raw, lines: terms.length }
}

/** One line to one expression, or null when the line has nothing usable (a heading, a blank). */
function parseLine(line: string): string | null {
  let s = line
    .replace(/[−–—]/g, '-')
    .replace(/[÷]/g, '/')
    .replace(/[₹$€£]|\b(?:rs\.?|inr)(?=\s*[\d(])/gi, '')
    .replace(/(\d),(?=\d)/g, '$1') // 1,50,000 and 1,234,567
    .trim()
    .replace(/^=\s*/, '') // "= 828"
    .replace(/=.*$/, '') // "23*36 = 828" or "23*36 ="
    .trim()

  // Accounting negative: "(500)" is -500, not 500.
  const acct = /^\(\s*([\d.]+)\s*\)$/.exec(s)
  if (acct) s = `-${acct[1]}`
  const negated = (t: string) => (!s.startsWith('-') || t.startsWith('-') ? t : /^[\d.]+$/.test(t) ? `-${t}` : `-(${t})`)

  // The calculation runs from the first thing that can start one to the last thing that can end
  // one, so a label before or after it ("Rent 25000", "25000 rent") falls away.
  const start = s.search(/-?\s*[\d(.]/)
  const ends = [...s.matchAll(/[\d)%]/g)]
  const end = ends.length ? (ends[ends.length - 1]?.index ?? -1) + 1 : -1
  if (start === -1 || end <= start) return null
  let body = s.slice(start, end).replace(/[xX×*]/g, '*')

  // Two numbers with only a space between them ("12 34") are not a calculation.
  if (!/[\d.]\s+[\d.]/.test(body)) {
    body = body.replace(/\s+/g, '').replace(/^\+/, '')
    if (/^[\d.+\-*/()%^]+$/.test(body) && wellFormed(body)) return negated(body)
  }

  // A label in the middle ("Item 3 costs 500"): fall back to the last number on the line.
  // Without any words, "12 34" is a typo, not a label, so it is refused.
  if (!/[a-z]/i.test(s)) return null
  const nums = s.match(/-?\d+(?:\.\d+)?|\.\d+/g)
  const lastNum = nums?.[nums.length - 1]
  return lastNum ? negated(lastNum) : null
}

function wellFormed(body: string): boolean {
  let open = 0
  for (const ch of body) {
    if (ch === '(') open++
    else if (ch === ')' && --open < 0) return false
  }
  if (open !== 0) return false
  // Domain problems (5/0) are still worth pasting: the display explains them. Only broken syntax is refused.
  const r = evaluateExpression(body, { angle: 'deg' })
  return r.ok || (r.code !== 'syntax' && r.code !== 'empty')
}
