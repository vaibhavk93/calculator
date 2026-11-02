import { describe, expect, it } from 'vitest'
import { computeDisplay } from './displayLogic'


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

describe('big results', () => {
  const nines = (n: number) => Array(n).fill('9').join('*')
  it('plain digits at 15 integer digits, scientific from 1e15, with a compact fallback', () => {
    expect(show('999999999999999', true, '1+1').resultLine).toBe('99,99,99,99,99,99,999')
    const v = show('1000000000000000', true, '1+1')
    expect(v.resultLine).toBe('1E+15')
    expect(v.echo).toEqual({ text: '1 padma', tone: 'info' })
    expect(v.copyText).toBe('1E+15')
  })
  it('a live preview of 9*9*...*9 (40 factors) is scientific and named only where a name exists', () => {
    const v = show(nines(40))
    expect(v.resultLine).toBe('1.478088294E+38')
    expect(v.compactLine).toBe('1.478088294E+38')
    expect(v.echo).toBeNull() // Indian names end at shankh
    expect(show(nines(40), false, null, { ...S, numberSystem: 'international' }).echo).toBeNull() // 1e38 is past decillion
    expect(show(nines(20), false, null, { ...S, numberSystem: 'international' }).echo).toEqual({ text: '12.16 quintillion', tone: 'info' })
  })
  it('the copy text of a huge preview pastes back as a number', () => {
    expect(show(nines(40)).copyText).toMatch(/^1\.4780882941434\d*E\+38$/)
  })
  it('a typed number of 16+ digits is shortened like a pocket calculator, with the words line', () => {
    const v = show('1234567890123456')
    expect(v.resultLine).toBe('1.23456789E+15')
    expect(v.echo?.text).toBe('1.23 padma')
    expect(show('123456789012345').resultLine).toBe('12,34,56,78,90,12,345')
  })
  it('still says "Too large to show" in plain words only past the engine limit', () => {
    expect(show('9^99').resultLine).not.toBe('')
    expect(show('9^105').echo).toEqual({ text: 'Too large to show', tone: 'error' })
    expect(show('9^105').resultLine).toBe('')
  })
  it('a normal number has no compact line needing to differ in meaning, and zero has none', () => {
    expect(show('0', true, '1-1').compactLine).toBeNull()
    expect(show('', false).compactLine).toBeNull()
  })
})

describe('pressing 9 x 9 x ... with the real keys, = after each step', () => {
  it('never throws and always shows safe text, even past the 1e100 limit', async () => {
    const { applyKey, INITIAL_INPUT } = await import('../../engine')
    let state = INITIAL_INPUT
    let last: string | null = null
    for (let i = 0; i < 120; i++) {
      for (const k of i === 0 ? ['9'] : ['*', '9', '=']) {
        const r = applyKey(state, k as never, { angle: 'deg' })
        if (r.error) {
          expect(r.error).toBe('Too large to show')
          return
        }
        if (r.commit) last = r.commit.expression
        state = r.state
      }
      const v = computeDisplay(state, last, S)
      expect(v.resultLine).toMatch(/^[−0-9.,E+-]+$/)
      expect(v.resultLine.length).toBeLessThanOrEqual(22)
      expect(v.exprLine.length).toBeLessThanOrEqual(60)
    }
  })
})
