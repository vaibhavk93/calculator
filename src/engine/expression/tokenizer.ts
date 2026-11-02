import { ExprError } from './types'

export const FN_NAMES = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'ln', 'sqrt'] as const
export type FnName = (typeof FN_NAMES)[number]

export type BinOp = '+' | '-' | '*' | '/' | '^'

export type Token =
  | { t: 'num'; v: string }
  | { t: 'op'; v: BinOp }
  | { t: 'post'; v: '!' | '%' }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'fn'; v: FnName }
  | { t: 'const'; v: 'pi' | 'e' }

export const MAX_EXPRESSION_LENGTH = 500

const isDigit = (c: string) => c >= '0' && c <= '9'

/**
 * Accepts both ASCII (`* / -`) and display characters (`× ÷ −`), so the
 * keypad, the keyboard and pasted text all go through one door.
 */
export function tokenize(src: string): Token[] {
  if (src.length > MAX_EXPRESSION_LENGTH) throw new ExprError('too-long')

  const out: Token[] = []
  let i = 0

  while (i < src.length) {
    const ch = src.charAt(i)

    if (ch === ' ' || ch === '\t' || ch === ' ' || ch === ' ') {
      i++
      continue
    }

    if (isDigit(ch) || ch === '.') {
      let j = i
      let sawDot = false
      let digits = 0
      while (j < src.length) {
        const c = src.charAt(j)
        if (isDigit(c)) digits++
        else if (c === '.' && !sawDot) sawDot = true
        else break
        j++
      }
      // "1.2.3" and a lone "." are not numbers.
      if (digits === 0 || src.charAt(j) === '.') throw new ExprError('syntax')
      out.push({ t: 'num', v: src.slice(i, j) })
      i = j
      continue
    }

    switch (ch) {
      case '+': out.push({ t: 'op', v: '+' }); i++; continue
      case '-': case '−': case '–': out.push({ t: 'op', v: '-' }); i++; continue
      case '*': case '×': case '·': out.push({ t: 'op', v: '*' }); i++; continue
      case '/': case '÷': out.push({ t: 'op', v: '/' }); i++; continue
      case '^': out.push({ t: 'op', v: '^' }); i++; continue
      case '!': out.push({ t: 'post', v: '!' }); i++; continue
      case '%': out.push({ t: 'post', v: '%' }); i++; continue
      case '(': out.push({ t: 'lp' }); i++; continue
      case ')': out.push({ t: 'rp' }); i++; continue
      case 'π': out.push({ t: 'const', v: 'pi' }); i++; continue
      case '√': out.push({ t: 'fn', v: 'sqrt' }); i++; continue
    }

    if (/[a-z]/i.test(ch)) {
      let j = i
      while (j < src.length && /[a-z]/i.test(src.charAt(j))) j++
      const word = src.slice(i, j).toLowerCase()
      if ((FN_NAMES as readonly string[]).includes(word)) {
        out.push({ t: 'fn', v: word as FnName })
      } else if (word === 'pi') {
        out.push({ t: 'const', v: 'pi' })
      } else if (word === 'e') {
        out.push({ t: 'const', v: 'e' })
      } else {
        throw new ExprError('syntax')
      }
      i = j
      continue
    }

    throw new ExprError('syntax')
  }

  return out
}
