import { toPlain } from '../decimal'
import { closeExpression, evaluateExpression } from './evaluate'
import type { EvalOptions } from './types'

/**
 * The calculator's key-press state machine, with no UI in it.
 *
 * `expr` uses ASCII operators (+ - * / ^) plus the literal characters π and √
 * and function names like "sin(". Formatting for display happens elsewhere.
 */
export interface InputState {
  /** What has been typed so far. */
  expr: string
  /** True right after "=": `expr` holds a result, not something being typed. */
  fresh: boolean
}

export type Key =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | '.'
  | '+' | '-' | '*' | '/' | '^'
  | '()' | '(' | ')' | '%' | '!' | 'pi' | 'e'
  | 'sin' | 'cos' | 'tan' | 'asin' | 'acos' | 'atan' | 'log' | 'ln' | 'sqrt'
  | 'backspace' | 'clear' | '='

export interface Commit {
  /** The closed expression that was evaluated, e.g. "(1+2)" if the user left it open. */
  expression: string
  /** Plain decimal string of the result. */
  result: string
}

export interface InputResult {
  state: InputState
  commit?: Commit
  /** A plain-language message when "=" could not produce a result. */
  error?: string
}

export const INITIAL_INPUT: InputState = { expr: '', fresh: false }

/** A single number longer than this is almost certainly a slip; ignore further digits. */
const MAX_NUMBER_CHARS = 24

const FUNCTION_KEYS: ReadonlySet<string> = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'ln'])

const OPS = '+-*/^'
const isOp = (c: string) => c.length === 1 && OPS.includes(c)
const last = (s: string) => (s.length ? s.charAt(s.length - 1) : '')
const numberSegment = (s: string) => /[0-9.]+$/.exec(s)?.[0] ?? ''
const FN_OPEN = /(?:asin|acos|atan|sin|cos|tan|log|ln|√)\($/

/** True when the expression ends in something a binary operator or "!" can follow. */
function endsWithOperand(s: string): boolean {
  const c = last(s)
  if (c === '') return false
  return /[0-9)%!πe]/.test(c)
}

function countParens(s: string): number {
  let open = 0
  for (const ch of s) {
    if (ch === '(') open++
    else if (ch === ')') open--
  }
  return open
}

const keep = (expr: string): InputResult => ({ state: { expr, fresh: false } })

export function applyKey(state: InputState, key: Key, opts: EvalOptions): InputResult {
  if (key === 'clear') return { state: INITIAL_INPUT }
  if (key === '=') return equals(state, opts)

  if (key === 'backspace') {
    const m = FN_OPEN.exec(state.expr)
    const expr = m ? state.expr.slice(0, -m[0].length) : state.expr.slice(0, -1)
    return keep(expr)
  }

  // After "=", digits and fresh starts replace the result; operators continue from it.
  const continuesFromResult = isOp(key) || key === '%' || key === '!' || key === ')'
  let expr = state.expr
  if (state.fresh && !continuesFromResult) expr = ''

  switch (key) {
    case '0': case '1': case '2': case '3': case '4':
    case '5': case '6': case '7': case '8': case '9':
    case '00':
      return keep(typeDigit(expr, key))

    case '.': {
      const seg = numberSegment(expr)
      if (seg.includes('.')) return keep(expr)
      if (seg === '' ) return keep(expr + '0.')
      if (seg.length >= MAX_NUMBER_CHARS) return keep(expr)
      return keep(expr + '.')
    }

    case '+': case '-': case '*': case '/': case '^':
      return keep(typeOperator(expr, key))

    case '()': {
      const open = countParens(expr)
      if (open > 0 && endsWithOperand(expr)) return keep(expr + ')')
      return keep(expr + '(')
    }

    // Literal brackets, for a hardware keyboard. The on-screen "( )" key above decides for itself.
    case '(':
      return keep(expr + '(')

    case ')':
      return countParens(expr) > 0 && endsWithOperand(expr) ? keep(expr + ')') : { state }

    case '%':
      return keep(endsWithOperand(expr) ? expr + '%' : expr)

    case '!':
      return keep(/[0-9)πe!]$/.test(expr) ? expr + '!' : expr)

    case 'pi':
      return keep(expr + 'π')

    case 'e':
      return keep(expr + 'e')

    case 'sqrt':
      return keep(expr + '√(')

    default: {
      // sin, cos, tan, asin, acos, atan, log, ln
      // Checked at runtime too: a wrong string from a caller must not end up in the expression.
      const fn: string = key
      return FUNCTION_KEYS.has(fn) ? keep(expr + fn + '(') : { state }
    }
  }
}

function typeDigit(expr: string, key: string): string {
  const seg = numberSegment(expr)
  if (seg.length >= MAX_NUMBER_CHARS) return expr

  // Leading zero handling: "0" then "5" is "5"; "0" then "0" stays "0".
  if (seg === '0') {
    if (key === '0' || key === '00') return expr
    return expr.slice(0, -1) + key
  }
  if (seg === '' && key === '00') return expr + '0'
  return expr + key
}

function typeOperator(expr: string, op: string): string {
  const trailing = /[+\-*/^]+$/.exec(expr)?.[0] ?? ''
  const body = expr.slice(0, expr.length - trailing.length)
  const atStart = body === '' || last(body) === '('

  // Nothing to operate on yet: only a leading minus makes sense.
  if (atStart) {
    if (op !== '-') return expr
    return trailing === '' ? expr + '-' : expr
  }

  // "5*" then "-" is a sign ("5*-3"), not a replacement.
  if (op === '-' && trailing.length === 1 && '*/^'.includes(trailing)) return expr + '-'

  // Otherwise the new operator replaces whatever was dangling.
  return body + op
}

function equals(state: InputState, opts: EvalOptions): InputResult {
  // Already a finished result: nothing new to work out, so nothing changes and nothing is recorded.
  if (state.fresh) return { state }
  const closed = closeExpression(state.expr)
  if (closed === '') return { state }

  const res = evaluateExpression(closed, opts)
  if (!res.ok) return { state, error: res.message }

  const result = toPlain(res.value)
  const next: InputState = { expr: result, fresh: true }

  // "=" on a bare number has nothing to record.
  if (/^-?[0-9.]+$/.test(closed)) return { state: next }
  return { state: next, commit: { expression: closed, result } }
}

/**
 * Drops a whole number into the expression (memory recall, paste). It replaces
 * the number currently being typed rather than gluing digits together, and
 * wraps negatives so "5 + (-3)" can never turn into "5 - 3" by accident.
 */
export function insertNumber(state: InputState, plain: string): InputState {
  const text = plain.startsWith('-') ? `(${plain})` : plain
  if (state.fresh || state.expr === '') return { expr: text, fresh: false }
  const seg = numberSegment(state.expr)
  const base = seg ? state.expr.slice(0, state.expr.length - seg.length) : state.expr
  return { expr: base + text, fresh: false }
}
