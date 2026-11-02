import { describe, expect, it } from 'vitest'
import { computeDisplay, recentWork } from './displayLogic'

const INITIAL = { expr: '', fresh: false }

const S = { numberSystem: 'indian', decimals: 'auto', angle: 'deg' } as const
const show = (expr: string, fresh = false, last: string | null = null, s: Parameters<typeof computeDisplay>[2] = S) =>
  computeDisplay({ expr, fresh }, last, s)

describe('computeDisplay', () => {
  it('empty shows 0', () => {
    expect(show('')).toMatchObject({ exprLine: '', resultLine: '0', copyText: null, echo: null, preview: false })
  })

  describe('a single number being typed', () => {
    it('groups as you type and shows no redundant expression line', () => {
      expect(show('150000')).toMatchObject({ exprLine: '', resultLine: '1,50,000' })
    })
    it('keeps what was typed: a trailing point and trailing zeros survive', () => {
      expect(show('12.').resultLine).toBe('12.')
      expect(show('1.50').resultLine).toBe('1.50')
      expect(show('0.').resultLine).toBe('0.')
    })
    it('a leading minus', () => expect(show('-5').resultLine).toBe('−5'))
    it('echoes the size of big numbers', () => {
      expect(show('16672260').echo).toEqual({ text: '1.67 crore', tone: 'info' })
    })
  })

  describe('an expression', () => {
    it('shows the expression and the live result', () => {
      const v = show('18450+7200+32000')
      expect(v.exprLine).toBe('18,450 + 7,200 + 32,000')
      expect(v.resultLine).toBe('57,650')
      expect(v.copyText).toBe('57650')
    })
    it('previews through a dangling operator', () => {
      expect(show('18450+7200+').resultLine).toBe('25,650')
    })
    it('previews through an unclosed bracket', () => {
      expect(show('2*(3+4').resultLine).toBe('14')
    })
    it('honours the decimal setting', () => {
      const v = show('10/4', false, null, { ...S, decimals: 2 })
      expect(v.resultLine).toBe('2.50')
      expect(v.copyText).toBe('2.50')
    })
    it('honours the number system', () => {
      expect(show('1234567+1', false, null, { ...S, numberSystem: 'international' }).resultLine).toBe('1,234,568')
    })
    it('honours the angle mode', () => {
      expect(show('sin(30)').resultLine).toBe('0.5')
      expect(show('sin(30)', false, null, { ...S, angle: 'rad' }).resultLine).not.toBe('0.5')
    })
  })

  describe('unfinished or wrong expressions', () => {
    it('input with nothing computable yet is silent, not an error', () => {
      for (const e of ['(', 'sin(', '-']) {
        const v = show(e)
        expect(v.resultLine).toBe('')
        expect(v.echo).toBeNull()
      }
    })
    it('a dangling "(" is ignored, so the live result is whatever came before it', () => {
      expect(show('5+(').resultLine).toBe('5')
    })
    it('a maths problem is named in plain words, in the error tone', () => {
      expect(show('5/0').echo).toEqual({ text: "Can't divide by zero", tone: 'error' })
      expect(show('sqrt(-4)').echo?.tone).toBe('error')
      expect(show('10^100').echo).toEqual({ text: 'Too large to show', tone: 'error' })
    })
    it('nothing to copy while there is no result', () => {
      expect(show('5/0').copyText).toBeNull()
    })
  })

  describe('just after "="', () => {
    it('shows the result large, with the expression that made it', () => {
      const v = show('57650', true, '18450+7200+32000')
      expect(v.resultLine).toBe('57,650')
      expect(v.exprLine).toBe('18,450 + 7,200 + 32,000 =')
      expect(v.copyText).toBe('57650')
    })
    it('a bare number has no expression line', () => {
      expect(show('123', true, null).exprLine).toBe('')
    })
    it('formats the stored result with the current settings', () => {
      expect(show('0.3333333333333333', true, '1/3', { ...S, decimals: 3 }).resultLine).toBe('0.333')
    })
    it('negative results use the true minus sign', () => {
      expect(show('-5', true, '3-8').resultLine).toBe('−5')
    })
  })
})

describe('preview versus answer', () => {
  it('an expression being typed is a preview', () => expect(show('23*36').preview).toBe(true))
  it('after "=" it is the answer', () => expect(show('828', true, '23*36').preview).toBe(false))
  it('a bare number being typed is not dimmed', () => expect(show('828').preview).toBe(false))
  it('nothing computable is not a preview', () => expect(show('5/0').preview).toBe(false))
})

describe('recentWork', () => {
  const h = (id: string, expression: string, result: string) => ({ id, expression, result })
  const src = [h('c', '3+3', '6'), h('b', '2+2', '4'), h('a', '1+1', '2'), h('z', '9+9', '18')]

  it('oldest first, at most max', () => {
    expect(recentWork({ expr: '7', fresh: false }, null, src, 3).map((l) => l.id)).toEqual(['a', 'b', 'c'])
  })
  it('does not repeat the calculation the big number is showing', () => {
    expect(recentWork({ expr: '6', fresh: true }, '3+3', src, 3).map((l) => l.id)).toEqual(['z', 'a', 'b'])
  })
  it('after a restart (no last expression) the newest stays above', () => {
    expect(recentWork({ expr: '6', fresh: true }, null, src, 2).map((l) => l.id)).toEqual(['b', 'c'])
  })
  it('max 0 or no source shows nothing', () => {
    expect(recentWork(INITIAL, null, src, 0)).toEqual([])
    expect(recentWork(INITIAL, null, [], 3)).toEqual([])
  })
})
