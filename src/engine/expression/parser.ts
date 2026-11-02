import { D, type Dec } from '../decimal'
import { ExprError } from './types'
import type { BinOp, FnName, Token } from './tokenizer'

export type Node =
  | { k: 'num'; v: Dec }
  | { k: 'const'; name: 'pi' | 'e' }
  | { k: 'neg'; x: Node }
  | { k: 'bin'; op: BinOp; l: Node; r: Node }
  | { k: 'fn'; name: FnName; x: Node }
  | { k: 'fact'; x: Node }
  | { k: 'pct'; x: Node }

const MAX_DEPTH = 100

/**
 * Precedence, loosest to tightest:
 *   + -      additive
 *   * /      multiplicative (and implicit multiplication: 2π, 3(4+5))
 *   unary -  so  -2^2 = -4
 *   ^        right-associative, exponent may be signed: 2^-3
 *   ! %      postfix
 */
class Parser {
  private pos = 0
  private depth = 0
  private prev: Token | undefined

  constructor(private readonly toks: Token[]) {}

  parse(): Node {
    const n = this.additive()
    if (this.pos < this.toks.length) throw new ExprError('syntax')
    return n
  }

  private peek(): Token | undefined {
    return this.toks[this.pos]
  }

  private next(): Token {
    const t = this.toks[this.pos]
    if (!t) throw new ExprError('syntax')
    this.pos++
    this.prev = t
    return t
  }

  private additive(): Node {
    let l = this.term()
    for (;;) {
      const p = this.peek()
      if (p?.t === 'op' && (p.v === '+' || p.v === '-')) {
        this.next()
        l = { k: 'bin', op: p.v, l, r: this.term() }
      } else return l
    }
  }

  private term(): Node {
    let l = this.unary()
    for (;;) {
      const p = this.peek()
      if (p?.t === 'op' && (p.v === '*' || p.v === '/')) {
        this.next()
        l = { k: 'bin', op: p.v, l, r: this.unary() }
      } else if (this.startsImplicitFactor(p)) {
        l = { k: 'bin', op: '*', l, r: this.unary() }
      } else return l
    }
  }

  /** `2π`, `3(4+5)`, `(1+2)(3+4)`, `2sin(30)` multiply. `2 3` does not. */
  private startsImplicitFactor(p: Token | undefined): boolean {
    if (!p) return false
    if (p.t === 'lp' || p.t === 'fn' || p.t === 'const') return true
    if (p.t === 'num') return this.prev !== undefined && this.prev.t !== 'num'
    return false
  }

  private unary(): Node {
    const p = this.peek()
    if (p?.t === 'op' && p.v === '-') {
      this.next()
      return { k: 'neg', x: this.unary() }
    }
    if (p?.t === 'op' && p.v === '+') {
      this.next()
      return this.unary()
    }
    return this.power()
  }

  private power(): Node {
    const base = this.postfix()
    const p = this.peek()
    if (p?.t === 'op' && p.v === '^') {
      this.next()
      return { k: 'bin', op: '^', l: base, r: this.unary() }
    }
    return base
  }

  private postfix(): Node {
    let n = this.primary()
    for (;;) {
      const p = this.peek()
      if (p?.t === 'post') {
        this.next()
        n = p.v === '!' ? { k: 'fact', x: n } : { k: 'pct', x: n }
      } else return n
    }
  }

  private primary(): Node {
    const t = this.next()
    switch (t.t) {
      case 'num':
        return { k: 'num', v: new D(t.v) }
      case 'const':
        return { k: 'const', name: t.v }
      case 'lp': {
        const x = this.group()
        return x
      }
      case 'fn': {
        const open = this.next()
        if (open.t !== 'lp') throw new ExprError('syntax')
        return { k: 'fn', name: t.v, x: this.group() }
      }
      default:
        throw new ExprError('syntax')
    }
  }

  /** Parses up to and including the closing ")". The "(" is already consumed. */
  private group(): Node {
    if (++this.depth > MAX_DEPTH) throw new ExprError('syntax')
    const x = this.additive()
    const close = this.next()
    if (close.t !== 'rp') throw new ExprError('syntax')
    this.depth--
    return x
  }
}

export function parse(tokens: Token[]): Node {
  return new Parser(tokens).parse()
}
