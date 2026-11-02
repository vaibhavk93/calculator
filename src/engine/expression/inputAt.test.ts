import { describe, expect, it } from 'vitest'
import { applyKeyAt } from './index'
import type { Key } from './index'

const OPTS = { angle: 'deg' } as const
/** "|" marks the cursor, "[" and "]" a selection. Returns the text with the cursor after the key. */
function at(before: string, key: Key) {
  const sel = /\[(.*)\]/.exec(before)
  let expr: string, a: number, b: number
  if (sel) {
    const i = before.indexOf('[')
    expr = before.replace('[', '').replace(']', '')
    a = i
    b = i + sel[1]!.length
  } else {
    a = b = before.indexOf('|')
    expr = before.replace('|', '')
  }
  const r = applyKeyAt({ expr, fresh: false }, key, OPTS, a, b)
  return r.state.expr.slice(0, r.caret) + '|' + r.state.expr.slice(r.caret)
}

describe('typing with the cursor inside the expression', () => {
  it('inserts a digit at the cursor', () => expect(at('12|34', '9')).toBe('129|34'))
  it('at the very end it is the ordinary behaviour', () => expect(at('5+3|', '2')).toBe('5+32|'))
  it('backspace deletes the character before the cursor', () => expect(at('12|34', 'backspace')).toBe('1|34'))
  it('backspace removes a whole function opener', () => expect(at('sin(|30)', 'backspace')).toBe('|30)'))
  it('typing an operator right after an operator swaps it', () => expect(at('5+|3', '*')).toBe('5*|3'))
  it('typing an operator right before an operator swaps it too', () => expect(at('5|+3', '*')).toBe('5*|3'))
  it('an operator between two numbers is inserted', () => expect(at('53|', '+')).toBe('53+|'))
  it('splits a number with an operator', () => expect(at('12|34', '+')).toBe('12+|34'))
  it('minus after a multiply is a sign, not a swap', () => expect(at('5*|3', '-')).toBe('5*-|3'))
  it('ignores a point inside a number that has one', () => expect(at('1|2.5', '.')).toBe('1|2.5'))
  it('does not put two decimal points in one number', () => expect(at('1.2|5', '.')).toBe('1.2|5'))
})

describe('selecting part of the expression', () => {
  it('backspace removes the selection', () => expect(at('5+[3*4]+1', 'backspace')).toBe('5+|+1'))
  it('a digit replaces the selection', () => expect(at('5+[3*4]', '7')).toBe('5+7|'))
  it('an operator replaces a selected operator', () => expect(at('5[+]3', '*')).toBe('5*|3'))
  it('selecting everything and typing starts over', () => expect(at('[5+3]', '9')).toBe('9|'))
})

describe('keys that act on the whole expression', () => {
  it('= evaluates it all, wherever the cursor is', () => {
    const r = applyKeyAt({ expr: '5+3', fresh: false }, '=', OPTS, 1, 1)
    expect(r.state).toEqual({ expr: '8', fresh: true })
  })
  it('clear empties it', () => {
    expect(applyKeyAt({ expr: '5+3', fresh: false }, 'clear', OPTS, 1, 1).state.expr).toBe('')
  })
})
