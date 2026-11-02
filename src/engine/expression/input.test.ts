import { describe, expect, it } from 'vitest'
import { applyKey, insertNumber, insertExpressionAt, INITIAL_INPUT } from './index'
import type { InputResult, InputState, Key } from './index'

const OPTS = { angle: 'deg' } as const

/** Presses a sequence of keys and returns the final state plus every result along the way. */
function press(keys: Key[], from: InputState = INITIAL_INPUT) {
  let state = from
  const steps: InputResult[] = []
  for (const k of keys) {
    const r = applyKey(state, k, OPTS)
    steps.push(r)
    state = r.state
  }
  return { state, last: steps[steps.length - 1]!, steps }
}
const typed = (keys: Key[]) => press(keys).state.expr

describe('typing numbers', () => {
  it('builds digits', () => expect(typed(['1', '2', '3'])).toBe('123'))
  it('replaces a leading zero', () => {
    expect(typed(['0', '5'])).toBe('5')
    expect(typed(['0', '0', '5'])).toBe('5')
  })
  it('does not stack leading zeros', () => {
    expect(typed(['0', '0'])).toBe('0')
    expect(typed(['0', '00'])).toBe('0')
  })
  it('"00" on empty is a single zero; after a digit it adds two', () => {
    expect(typed(['00'])).toBe('0')
    expect(typed(['5', '00'])).toBe('500')
  })
  it('"." on empty starts "0."', () => expect(typed(['.'])).toBe('0.'))
  it('allows only one decimal point per number', () => {
    expect(typed(['1', '.', '2', '.', '3'])).toBe('1.23')
  })
  it('allows a decimal point in each number', () => {
    expect(typed(['1', '.', '5', '+', '2', '.', '5'])).toBe('1.5+2.5')
  })
  it('ignores digits past 24 in one number', () => {
    const many = Array<Key>(30).fill('7')
    expect(typed(many)).toHaveLength(24)
  })
})

describe('operators', () => {
  it('a later operator replaces the dangling one', () => {
    expect(typed(['5', '+', '*'])).toBe('5*')
    expect(typed(['5', '*', '+'])).toBe('5+')
  })
  it('minus after * / ^ is a sign, not a replacement', () => {
    expect(typed(['5', '*', '-'])).toBe('5*-')
    expect(typed(['5', '/', '-', '2'])).toBe('5/-2')
  })
  it('and a following operator replaces both', () => {
    expect(typed(['5', '*', '-', '+'])).toBe('5+')
  })
  it('only a leading minus is allowed on an empty expression', () => {
    expect(typed(['+'])).toBe('')
    expect(typed(['*'])).toBe('')
    expect(typed(['-'])).toBe('-')
    expect(typed(['-', '-'])).toBe('-')
    expect(typed(['-', '+'])).toBe('-')
    expect(typed(['-', '5'])).toBe('-5')
  })
  it('same rule just inside a bracket', () => {
    expect(typed(['()', '+'])).toBe('(')
    expect(typed(['()', '-', '3'])).toBe('(-3')
  })
})

describe('the smart bracket key', () => {
  it('opens on empty or after an operator', () => {
    expect(typed(['()'])).toBe('(')
    expect(typed(['5', '+', '()'])).toBe('5+(')
  })
  it('closes when there is something open and an operand before it', () => {
    expect(typed(['()', '5', '()'])).toBe('(5)')
    expect(typed(['()', '5', '+', '()', '3', '()'])).toBe('(5+(3)')
  })
  it('opens (implicit multiply) when nothing is open', () => {
    expect(typed(['5', '()'])).toBe('5(')
  })
  it('opens after a bracket that was already closed', () => {
    expect(typed(['()', '5', '()', '()'])).toBe('(5)(')
  })
})

describe('literal brackets (hardware keyboard)', () => {
  it('"(" always opens', () => {
    expect(typed(['(', '5', '(' ])).toBe('(5(')
  })
  it('")" closes only when something is open and there is an operand before it', () => {
    expect(typed(['(', '5', ')'])).toBe('(5)')
    expect(typed([')'])).toBe('')
    expect(typed(['5', ')'])).toBe('5')
    expect(typed(['(', ')'])).toBe('(')
    expect(typed(['(', '5', '+', ')'])).toBe('(5+')
  })
  it('a stray ")" after "=" leaves the result untouched', () => {
    const afterSum = press(['2', '+', '3', '=']).state
    expect(press([')'], afterSum).state).toEqual(afterSum)
  })
})

describe('% and !', () => {
  it('only after an operand', () => {
    expect(typed(['%'])).toBe('')
    expect(typed(['5', '+', '%'])).toBe('5+')
    expect(typed(['5', '%'])).toBe('5%')
    expect(typed(['!'])).toBe('')
    expect(typed(['5', '!'])).toBe('5!')
  })
})

describe('functions and constants', () => {
  it('function keys open their bracket', () => {
    expect(typed(['sin'])).toBe('sin(')
    expect(typed(['sqrt'])).toBe('√(')
    expect(typed(['5', 'ln'])).toBe('5ln(')
  })
  it('backspace removes a whole function opener, not one letter', () => {
    expect(typed(['sin', 'backspace'])).toBe('')
    expect(typed(['5', '+', 'asin', 'backspace'])).toBe('5+')
    expect(typed(['sqrt', 'backspace'])).toBe('')
  })
  it('backspace removes one ordinary character', () => {
    expect(typed(['1', '2', '3', 'backspace'])).toBe('12')
    expect(typed(['backspace'])).toBe('')
  })
  it('pi and e', () => {
    expect(typed(['2', 'pi'])).toBe('2π')
    expect(typed(['e'])).toBe('e')
  })
})

describe('equals', () => {
  it('commits the expression and the result', () => {
    const { state, last } = press(['1', '8', '4', '5', '0', '+', '7', '2', '0', '0', '+', '3', '2', '0', '0', '0', '='])
    expect(last.commit).toEqual({ expression: '18450+7200+32000', result: '57650' })
    expect(state).toEqual({ expr: '57650', fresh: true })
  })

  it('closes open brackets and drops a trailing operator, and records what it actually evaluated', () => {
    expect(press(['()', '1', '+', '2', '=']).last.commit?.expression).toBe('(1+2)')
    expect(press(['5', '*', '3', '+', '=']).last.commit).toEqual({ expression: '5*3', result: '15' })
  })

  it('a bare number has nothing to record', () => {
    const { last, state } = press(['1', '2', '3', '='])
    expect(last.commit).toBeUndefined()
    expect(state).toEqual({ expr: '123', fresh: true })
  })

  it('on an empty expression does nothing', () => {
    const { last, state } = press(['='])
    expect(last.commit).toBeUndefined()
    expect(state).toEqual(INITIAL_INPUT)
  })

  it('reports a plain-language error and leaves the input alone', () => {
    const { last, state } = press(['5', '/', '0', '='])
    expect(last.error).toBe("Can't divide by zero")
    expect(last.commit).toBeUndefined()
    expect(state).toEqual({ expr: '5/0', fresh: false })
  })

  it('negative results round-trip as plain text', () => {
    expect(press(['3', '-', '8', '=']).state.expr).toBe('-5')
  })
})

describe('after equals', () => {
  const afterSum = press(['2', '+', '3', '=']).state

  it('"=" again does nothing: same state, no second record', () => {
    const r = applyKey(afterSum, '=', OPTS)
    expect(r.state).toBe(afterSum)
    expect(r.commit).toBeUndefined()
    expect(r.error).toBeUndefined()
  })

  it('a digit starts a new calculation', () => {
    expect(press(['7'], afterSum).state).toEqual({ expr: '7', fresh: false })
  })
  it('an operator continues from the result', () => {
    expect(press(['*', '4'], afterSum).state.expr).toBe('5*4')
  })
  it('% and ! continue from the result', () => {
    expect(press(['%'], afterSum).state.expr).toBe('5%')
  })
  it('a function or bracket starts fresh', () => {
    expect(press(['sin'], afterSum).state.expr).toBe('sin(')
    expect(press(['()'], afterSum).state.expr).toBe('(')
  })
  it('backspace edits the result as ordinary text', () => {
    expect(press(['backspace'], press(['1', '2', '+', '3', '4', '=']).state).state).toEqual({
      expr: '4',
      fresh: false,
    })
  })
  it('continuing from a negative result keeps its sign', () => {
    const neg = press(['3', '-', '8', '=']).state
    expect(press(['*', '2', '='], neg).last.commit).toEqual({ expression: '-5*2', result: '-10' })
  })
})

describe('unknown keys', () => {
  it('are ignored, never appended to the expression', () => {
    for (const bad of ['foo', '', '5+5', 'x', 'drop table']) {
      const r = applyKey({ expr: '5', fresh: false }, bad as Key, OPTS)
      expect(r.state).toEqual({ expr: '5', fresh: false })
    }
  })
})

describe('clear', () => {
  it('resets everything', () => {
    expect(press(['5', '+', '3', 'clear']).state).toEqual(INITIAL_INPUT)
    expect(press(['5', '=', 'clear']).state).toEqual(INITIAL_INPUT)
  })
})

describe('insertNumber (memory recall, paste)', () => {
  it('on empty or after "=" it replaces the whole expression', () => {
    expect(insertNumber(INITIAL_INPUT, '42')).toEqual({ expr: '42', fresh: false })
    expect(insertNumber({ expr: '5', fresh: true }, '42')).toEqual({ expr: '42', fresh: false })
  })
  it('replaces the number being typed instead of gluing digits on', () => {
    expect(insertNumber({ expr: '5+12', fresh: false }, '99').expr).toBe('5+99')
  })
  it('appends after an operator', () => {
    expect(insertNumber({ expr: '5+', fresh: false }, '99').expr).toBe('5+99')
  })
  it('wraps negatives so "5 + -3" can never read as "5 - 3"', () => {
    expect(insertNumber({ expr: '5+', fresh: false }, '-3').expr).toBe('5+(-3)')
    expect(insertNumber(INITIAL_INPUT, '-3').expr).toBe('(-3)')
  })
  it('pasted decimals survive', () => {
    expect(insertNumber(INITIAL_INPUT, '1234.56').expr).toBe('1234.56')
  })
})

describe('insertExpressionAt: reusing a past calculation', () => {
  it('adds to what is being typed instead of replacing it', () => {
    // The owner's case: "1+2+3+" on screen, pick "9*9" from History.
    expect(insertExpressionAt({ expr: '1+2+3+', fresh: false }, '9*9')).toEqual({ expr: '1+2+3+(9*9)', fresh: false })
  })

  it('brackets the past calculation so its value survives the surrounding precedence', () => {
    // Bare, "5*" + "1+2" would read as 5*1+2 = 7. The point of reuse is the value, 15.
    expect(insertExpressionAt({ expr: '5*', fresh: false }, '1+2')).toEqual({ expr: '5*(1+2)', fresh: false })
  })

  it('does not bracket a lone number, which has no precedence of its own', () => {
    expect(insertExpressionAt({ expr: '1+', fresh: false }, '42')).toEqual({ expr: '1+42', fresh: false })
    expect(insertExpressionAt({ expr: '1+', fresh: false }, '3.5')).toEqual({ expr: '1+3.5', fresh: false })
  })

  it('replaces when nothing has been typed', () => {
    expect(insertExpressionAt({ expr: '', fresh: false }, '9*9')).toEqual({ expr: '9*9', fresh: false })
  })

  it('replaces a finished answer, because the next thing typed starts over', () => {
    expect(insertExpressionAt({ expr: '81', fresh: true }, '9*9')).toEqual({ expr: '9*9', fresh: false })
  })

  it('ignores an empty expression', () => {
    const state = { expr: '1+', fresh: false }
    expect(insertExpressionAt(state, '   ')).toBe(state)
  })

  it('never grows past the 500-character input limit', () => {
    const long = { expr: '1'.repeat(495), fresh: false }
    expect(insertExpressionAt(long, '2*3').expr.length).toBeLessThanOrEqual(500)
  })
})
