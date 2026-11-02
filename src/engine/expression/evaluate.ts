import { D, toPlain, type Dec } from '../decimal'
import { tokenize } from './tokenizer'
import { parse, type Node } from './parser'
import {
  ERROR_MESSAGES,
  ExprError,
  type EvalErrorCode,
  type EvalOptions,
  type EvalResult,
} from './types'

/** Anything at or beyond this is "too large to show", like a hardware calculator. */
const LIMIT = new D('1e100')
/** Transcendental results are rounded here so sin(180°) is 0, not 1e-40. */
const SCRUB_PLACES = 25
const TINY = new D('1e-25')

const PI = D.acos(-1)
const E = D.exp(1)

const guard = (v: Dec): Dec => {
  if (v.isNaN()) throw new ExprError('domain')
  if (!v.isFinite() || v.abs().gte(LIMIT)) throw new ExprError('overflow')
  return v
}

const scrub = (v: Dec): Dec => guard(v).toDecimalPlaces(SCRUB_PLACES)

function toRadians(x: Dec, o: EvalOptions): Dec {
  return o.angle === 'deg' ? x.times(PI).div(180) : x
}

function fromRadians(r: Dec, o: EvalOptions): Dec {
  return o.angle === 'deg' ? r.times(180).div(PI) : r
}

function factorial(x: Dec): Dec {
  if (!x.isInteger() || x.isNegative()) throw new ExprError('domain')
  // 70! already exceeds the 1e100 display limit.
  if (x.gt(100)) throw new ExprError('overflow')
  let acc = new D(1)
  for (let i = 2; x.gte(i); i++) acc = guard(acc.times(i))
  return acc
}

function applyFn(name: string, x: Dec, o: EvalOptions): Dec {
  switch (name) {
    case 'sin':
      return scrub(D.sin(toRadians(x, o)))
    case 'cos':
      return scrub(D.cos(toRadians(x, o)))
    case 'tan': {
      const r = toRadians(x, o)
      if (D.cos(r).abs().lt(TINY)) throw new ExprError('domain')
      return scrub(D.tan(r))
    }
    case 'asin':
      if (x.abs().gt(1)) throw new ExprError('domain')
      return scrub(fromRadians(D.asin(x), o))
    case 'acos':
      if (x.abs().gt(1)) throw new ExprError('domain')
      return scrub(fromRadians(D.acos(x), o))
    case 'atan':
      return scrub(fromRadians(D.atan(x), o))
    case 'log':
      if (!x.isPositive() || x.isZero()) throw new ExprError('domain')
      return scrub(D.log10(x))
    case 'ln':
      if (!x.isPositive() || x.isZero()) throw new ExprError('domain')
      return scrub(D.ln(x))
    case 'sqrt':
      if (x.isNegative()) throw new ExprError('domain')
      return guard(D.sqrt(x))
    default:
      throw new ExprError('syntax')
  }
}

function power(l: Dec, r: Dec): Dec {
  if (l.isZero() && r.isNegative()) throw new ExprError('div-zero')
  if (l.isNegative() && !r.isInteger()) throw new ExprError('domain')
  return guard(D.pow(l, r))
}

function ev(n: Node, o: EvalOptions): Dec {
  switch (n.k) {
    case 'num':
      return n.v
    case 'const':
      return n.name === 'pi' ? PI : E
    case 'neg':
      return ev(n.x, o).neg()
    case 'fact':
      return factorial(ev(n.x, o))
    case 'pct':
      return ev(n.x, o).div(100)
    case 'fn':
      return applyFn(n.name, ev(n.x, o), o)
    case 'bin': {
      const l = ev(n.l, o)

      // "200 + 10%" means 200 + 10% *of 200*, as on every phone calculator.
      // Only when the % is the whole right-hand operand: "5 + 10% × 3" is plain.
      if ((n.op === '+' || n.op === '-') && n.r.k === 'pct') {
        const share = l.times(ev(n.r.x, o)).div(100)
        return guard(n.op === '+' ? l.plus(share) : l.minus(share))
      }

      const r = ev(n.r, o)
      switch (n.op) {
        case '+':
          return guard(l.plus(r))
        case '-':
          return guard(l.minus(r))
        case '*':
          return guard(l.times(r))
        case '/':
          if (r.isZero()) throw new ExprError('div-zero')
          return guard(l.div(r))
        case '^':
          return power(l, r)
      }
    }
  }
}

function fail(code: EvalErrorCode): EvalResult {
  return { ok: false, code, message: ERROR_MESSAGES[code] }
}

/** Strict: the expression must be complete. */
export function evaluateExpression(src: string, opts: EvalOptions): EvalResult {
  if (src.trim() === '') return fail('empty')
  try {
    const value = ev(parse(tokenize(src)), opts)
    return { ok: true, value: value.isZero() ? new D(0) : value }
  } catch (e) {
    if (e instanceof ExprError) return fail(e.code)
    return fail('domain')
  }
}

const TRAILING_OPERATORS = /[+\-−–*×·/÷^]+$/
const DANGLING_FUNCTION = /(?:asin|acos|atan|sin|cos|tan|log|ln|√)\($/i

/**
 * Makes a half-typed expression evaluable: "18450+7200+" -> "18450+7200",
 * "2*(3+" -> "2*(3)". This is what powers the live preview and "=".
 */
export function closeExpression(src: string): string {
  let s = src.trimEnd()
  for (;;) {
    const before = s
    s = s.replace(TRAILING_OPERATORS, '').replace(DANGLING_FUNCTION, '').replace(/\($/, '').trimEnd()
    if (s === before) break
  }
  let open = 0
  for (const ch of s) {
    if (ch === '(') open++
    else if (ch === ')') open--
  }
  return open > 0 ? s + ')'.repeat(open) : s
}

/** Tolerant: evaluates the closed form of an unfinished expression. */
export function evaluatePreview(src: string, opts: EvalOptions): EvalResult {
  const closed = closeExpression(src)
  if (closed === '') return fail('empty')
  return evaluateExpression(closed, opts)
}

export { toPlain }
