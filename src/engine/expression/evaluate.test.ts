import { describe, expect, it } from 'vitest'
import { closeExpression, evaluateExpression, evaluatePreview, toPlain } from './index'
import type { AngleMode } from './index'

const val = (src: string, angle: AngleMode = 'deg'): string => {
  const r = evaluateExpression(src, { angle })
  if (!r.ok) throw new Error(`"${src}" failed: ${r.code}`)
  return toPlain(r.value)
}
const code = (src: string, angle: AngleMode = 'deg') => {
  const r = evaluateExpression(src, { angle })
  return r.ok ? 'ok' : r.code
}

describe('exact decimal arithmetic', () => {
  it('0.1 + 0.2 is exactly 0.3, not 0.30000000000000004', () => {
    expect(val('0.1+0.2')).toBe('0.3')
  })
  it('1/3*3 comes back to 1', () => {
    expect(val('1/3*3')).toBe('1')
  })
  it('keeps large money figures exact', () => {
    expect(val('1630*645+493436+229168-(327075+5085)')).toBe('1441794')
    expect(val('((1630*645+493436+229168-(327075+5085)))+147000+48*1634')).toBe('1667226')
  })
  it('never reports negative zero', () => {
    expect(val('0*-5')).toBe('0')
    expect(val('5-5')).toBe('0')
  })
})

describe('precedence and associativity', () => {
  it.each([
    ['2+3*4', '14'],
    ['(2+3)*4', '20'],
    ['10-4-3', '3'],
    ['100/10/5', '2'],
    ['2^3^2', '512'],
    ['-2^2', '-4'],
    ['(-2)^2', '4'],
    ['2^-1', '0.5'],
    ['-3!', '-6'],
    ['2^3!', '64'],
  ])('%s = %s', (src, want) => expect(val(src)).toBe(want))

  it('accepts display characters as well as ASCII', () => {
    expect(val('6×7÷2')).toBe('21')
    expect(val('−5+2')).toBe('-3')
  })
})

describe('implicit multiplication', () => {
  it.each([
    ['2(3+4)', '14'],
    ['(1+2)(3+4)', '21'],
    ['3π/π', '3'],
  ])('%s = %s', (src, want) => expect(val(src)).toBe(want))

  it('2π is two times pi (20 significant digits in plain form)', () => {
    expect(val('2π')).toBe('6.2831853071795864769')
  })
  it('the engine itself holds 40 digits; only the plain form is trimmed to 20', () => {
    const r = evaluateExpression('2π', { angle: 'deg' })
    expect(r.ok && r.value.toFixed()).toBe('6.283185307179586476925286766559005768394')
  })
  it('does not glue two bare numbers: "2 3" is an error', () => {
    expect(code('2 3')).toBe('syntax')
  })
})

describe('percent', () => {
  it.each([
    ['200+10%', '220'],
    ['200-10%', '180'],
    ['100+10%+10%', '121'],
    ['50%', '0.5'],
    ['200*10%', '20'],
    ['(5+5)%', '0.1'],
    ['5+10%*3', '5.3'], // % is only "of the left side" when it is the whole right operand
  ])('%s = %s', (src, want) => expect(val(src)).toBe(want))
})

describe('factorial', () => {
  it.each([
    ['0!', '1'],
    ['5!', '120'],
    ['10!', '3628800'],
  ])('%s = %s', (src, want) => expect(val(src)).toBe(want))
  it('rejects non-integers and negatives', () => {
    expect(code('3.5!')).toBe('domain')
    expect(code('(-1)!')).toBe('domain')
  })
  it('69! fits, 70! is too large to show', () => {
    expect(code('69!')).toBe('ok')
    expect(code('70!')).toBe('overflow')
    expect(code('101!')).toBe('overflow')
  })
})

describe('trigonometry in degrees', () => {
  it.each([
    ['sin(30)', '0.5'],
    ['sin(180)', '0'],
    ['cos(60)', '0.5'],
    ['cos(90)', '0'],
    ['tan(45)', '1'],
    ['asin(0.5)', '30'],
    ['acos(0.5)', '60'],
    ['atan(1)', '45'],
    ['sin(90)', '1'],
  ])('%s = %s', (src, want) => expect(val(src, 'deg')).toBe(want))

  it('tan(90) is undefined, not a huge number', () => {
    expect(code('tan(90)', 'deg')).toBe('domain')
  })
  it('asin/acos reject arguments outside -1..1', () => {
    expect(code('asin(2)')).toBe('domain')
    expect(code('acos(-1.5)')).toBe('domain')
  })
})

describe('trigonometry in radians', () => {
  it.each([
    ['sin(0)', '0'],
    ['cos(π)', '-1'],
    ['sin(π/2)', '1'],
    ['sin(π)', '0'],
    ['tan(π/4)', '1'],
  ])('%s = %s', (src, want) => expect(val(src, 'rad')).toBe(want))
})

describe('logs, roots, constants', () => {
  it.each([
    ['log(1000)', '3'],
    ['log(1)', '0'],
    ['ln(e)', '1'],
    ['sqrt(144)', '12'],
    ['√(16)', '4'],
    ['e^0', '1'],
  ])('%s = %s', (src, want) => expect(val(src)).toBe(want))

  it('rejects log/ln of zero and negatives, sqrt of negatives', () => {
    expect(code('log(0)')).toBe('domain')
    expect(code('ln(-1)')).toBe('domain')
    expect(code('sqrt(-4)')).toBe('domain')
  })
  it('irrational results carry real precision', () => {
    expect(val('2^0.5')).toBe('1.4142135623730950488')
  })
})

describe('errors, in plain language', () => {
  it('division by zero', () => {
    expect(code('5/0')).toBe('div-zero')
    expect(code('0/0')).toBe('div-zero')
    expect(code('0^-1')).toBe('div-zero')
    const r = evaluateExpression('5/0', { angle: 'deg' })
    expect(!r.ok && r.message).toBe("Can't divide by zero")
  })
  it('negative base with a fractional exponent', () => {
    expect(code('(-8)^0.5')).toBe('domain')
  })
  it('overflow at 1e100', () => {
    expect(code('10^99')).toBe('ok')
    expect(code('10^100')).toBe('overflow')
    expect(code('10^10^10')).toBe('overflow')
  })
  it.each(['5+', '(', ')', '()', '1.2.3', '.', 'abc', 'sin30', '2*(3', '5)', '*5', '5**3'])(
    'malformed "%s" is a syntax error',
    (src) => expect(code(src)).toBe('syntax'),
  )
  it('empty input', () => {
    expect(code('')).toBe('empty')
    expect(code('   ')).toBe('empty')
  })
  it('refuses absurdly long input instead of hanging', () => {
    expect(code('1+'.repeat(300) + '1')).toBe('too-long')
  })
  it('refuses absurd nesting instead of overflowing the stack', () => {
    expect(code('('.repeat(150) + '1' + ')'.repeat(150))).toBe('syntax')
  })
  it('never throws, whatever it is given', () => {
    const junk = ['\u0000', '😀', '1e5', '5,000', '\\', '5%%%', '!!', '^', '%']
    for (const j of junk) expect(() => evaluateExpression(j, { angle: 'deg' })).not.toThrow()
  })
})

describe('closing a half-typed expression', () => {
  it.each([
    ['18450+7200+', '18450+7200'],
    ['2*(3+', '2*(3)'],
    ['(1+2', '(1+2)'],
    ['sin(', ''],
    ['5+(', '5'],
    ['5×', '5'],
    ['5.', '5.'],
    ['2*sin(30', '2*sin(30)'],
    ['5+-', '5'],
    ['', ''],
  ])('"%s" -> "%s"', (src, want) => expect(closeExpression(src)).toBe(want))

  it('previews as you type', () => {
    const r = evaluatePreview('2*(3+', { angle: 'deg' })
    expect(r.ok && toPlain(r.value)).toBe('6')
  })
  it('preview of nothing is "empty", not an error', () => {
    const r = evaluatePreview('', { angle: 'deg' })
    expect(!r.ok && r.code).toBe('empty')
  })
})

describe('scientific notation, as the calculator writes it', () => {
  it('reads a capital E with an exponent', () => {
    expect(val('1.2345E+25')).toBe('12345000000000000000000000')
    expect(val('5E-3')).toBe('0.005')
    expect(val('2E3*2')).toBe('4000')
    expect(val('1E+15+1')).toBe('1000000000000001')
  })
  it('a lowercase e stays Euler\'s number, so "2e+3" is 2 x e + 3', () => {
    expect(Number(val('2e+3'))).toBeCloseTo(2 * Math.E + 3, 10)
  })
})
