import { describe, expect, it } from 'vitest'
import { D, type Dec } from '../../engine'
import { effectiveYield, fd, lumpsum, sip } from '../../engine/investments/invest'
import { defaultValues, isError, type Computed, type Field, type Output, type ToolSpec, type Values } from '../../lib/tool'
import golden from './savingsGolden.json'
import { SAVINGS_CASES } from './savingsGolden.cases'
import { ALL_TOOLS } from './registry'

const tool = (id: string): ToolSpec => ALL_TOOLS.find((s) => s.id === id)!
const run = (id: string, over: Values = {}) => {
  const s = tool(id)
  return s.compute({ ...defaultValues(s), ...over }) as Computed
}
const ok = (id: string, over: Values = {}): Output => {
  const out = run(id, over)
  if (isError(out)) throw new Error(`${id}: ${out.error}`)
  return out
}
const row = (id: string, over: Values, label: string) => ok(id, over).rows.find((r) => r.label === label)!.value as Dec
const j = (c: Computed) => JSON.stringify(c)
const unitFields = (spec: ToolSpec) => spec.fields.filter((f): f is Extract<Field, { kind: 'number' }> => f.kind === 'number' && !!f.units)
const err = (id: string, over: Values) => {
  const out = run(id, over)
  return isError(out) ? out.error : null
}

// ---- the same field gets the same units on the screen ---------------------------------------------------

describe('which boxes got a unit switch', () => {
  const UNITS: Record<string, Record<string, string[]>> = {
    sip: { years: ['years', 'months'] },
    'step-up-sip': { years: ['years', 'months'] },
    'goal-sip': { years: ['years', 'months'] },
    lumpsum: { years: ['years', 'months', 'days'] },
    swp: { wait: ['years', 'months'] },
    fd: { years: ['years', 'months', 'days'] },
    rd: { years: ['years', 'months'] },
    inflation: { years: ['years', 'months'] },
    'cagr-xirr': { years: ['years', 'months'] },
  }
  for (const [id, want] of Object.entries(UNITS)) {
    it(`${id}: ${Object.keys(want).join(', ')}, labels unchanged`, () => {
      const got = Object.fromEntries(unitFields(tool(id)).map((f) => [f.id, f.units]))
      expect(got).toEqual(want)
    })
  }
  it('the labels the e2e files match are untouched', () => {
    for (const id of ['sip', 'step-up-sip', 'lumpsum', 'goal-sip', 'fd', 'rd', 'inflation', 'cagr-xirr']) {
      expect(tool(id).fields.find((f) => f.id === 'years')!.label).toBe('Number of years')
    }
    expect(tool('swp').fields.find((f) => f.id === 'wait')!.label).toBe('Years of saving first')
  })
  it('ppf, nps, epf, emergency fund and the rest are not touched', () => {
    for (const id of ['ppf', 'nps', 'epf']) expect(unitFields(tool(id))).toEqual([])
  })
})

// ---- GOLDEN: an old saved card (no unit key) gives the answer it gave before ----------------------------

/** New code may ADD a row, a formula line or a sentence to a note. It may not change or drop what was there. */
function expectSameAsBefore(now: Computed, before: unknown) {
  const was = before as Computed
  if (isError(was)) return expect(now).toEqual(was)
  expect(isError(now)).toBe(false)
  const n = now as Output
  for (const old of was.rows) {
    const same = n.rows.find((r) => r.label === old.label)
    expect(same, `row ${old.label}`).toBeDefined()
    expect(JSON.stringify({ ...same, timeUnit: undefined }), old.label).toBe(JSON.stringify({ ...old, timeUnit: undefined }))
  }
  // The table and chart may only GROW at the end (rd: the part year it used to drop).
  if (was.table) {
    expect({ ...n.table, rows: undefined }).toEqual({ ...was.table, rows: undefined })
    expect(JSON.stringify(n.table!.rows.slice(0, was.table.rows.length))).toBe(JSON.stringify(was.table.rows))
  } else expect(n.table).toBeUndefined()
  if (was.chart) {
    expect(n.chart!.labels.slice(0, was.chart.labels.length)).toEqual(was.chart.labels)
    was.chart.series.forEach((sr, i) => expect(JSON.stringify(n.chart!.series[i]!.values.slice(0, sr.values.length))).toBe(JSON.stringify(sr.values)))
  } else expect(n.chart).toBeUndefined()
  expect(n.formula?.slice(0, was.formula?.length ?? 0)).toEqual(was.formula)
  expect((n.note ?? '').startsWith(was.note ?? '')).toBe(true)
}

describe('GOLDEN: saved cards without a unit key give the same answers as before', () => {
  for (const [id, cases] of Object.entries(SAVINGS_CASES)) {
    cases.forEach((over, i) => {
      it(`${id} sample ${i + 1}`, () => {
        const s = tool(id)
        const withoutUnitKeys = { ...defaultValues(s), ...over }
        for (const k of Object.keys(withoutUnitKeys)) if (k.endsWith('__unit')) delete withoutUnitKeys[k]
        expectSameAsBefore(s.compute(withoutUnitKeys), (golden as Record<string, unknown[]>)[id]![i])
      })
    })
  }
  it('the saved-card form (defaults merged under the old values) reads units[0] = years', () => {
    for (const id of Object.keys(SAVINGS_CASES)) for (const f of unitFields(tool(id))) expect(f.units![0]).toBe('years')
  })
})

// ---- months ----------------------------------------------------------------------------------------------

describe('SIP in months', () => {
  it('120 months equals 10 years, to the paisa', () => {
    expect(j(run('sip', { years: '120', years__unit: 'months' }))).toBe(j(run('sip', { years: '10' })))
    expect(j(run('step-up-sip', { years: '120', years__unit: 'months', step: '8' }))).toBe(j(run('step-up-sip', { years: '10', step: '8' })))
  })
  it('1.5 years is 18 months, and gives a last row at month 18', () => {
    expect(j(run('sip', { years: '1.5' }))).toBe(j(run('sip', { years: '18', years__unit: 'months' })))
    const out = ok('sip', { years: '18', years__unit: 'months' })
    expect(out.table!.rows.map((r) => String(r[0]))).toEqual(['1', 'Month 18'])
    expect(out.chart!.labels).toEqual(['Y1', 'M18'])
    expect(out.rows[1]!.value.toString()).toBe('90000')
    expect((out.rows[0]!.value as Dec).toDecimalPlaces(2).toString()).toBe('99054.48')
  })
  it('whole-year answer equals the engine sip()', () => {
    expect(row('sip', { years: '7', monthly: '12000', rate: '9' }, 'Value at the end').toString()).toBe(sip(new D(12000), new D(9), 7).at(-1)!.value.toString())
  })
  it('step-up: 13 months invests one raised payment', () => {
    expect(row('step-up-sip', { years: '13', years__unit: 'months', step: '10' }, 'Total invested').toString()).toBe('65500')
  })
  it('a month count that is not whole, zero, or over 720 is refused in words', () => {
    const msg = 'Time must come to whole months, from 1 month to 60 years'
    for (const id of ['sip', 'step-up-sip', 'goal-sip']) {
      expect(err(id, { years: '18.5', years__unit: 'months' })).toBe(msg)
      expect(err(id, { years: '0', years__unit: 'months' })).toBe(msg)
      expect(err(id, { years: '721', years__unit: 'months' })).toBe(msg)
      expect(err(id, { years: '61' })).toBe(msg)
      expect(err(id, { years: '1.55' })).toBe(msg)
      expect(err(id, { years: '720', years__unit: 'months' })).toBeNull()
      expect(err(id, { years: '60' })).toBeNull()
    }
  })
})

describe('goal-sip in months', () => {
  it('120 months equals 10 years; 18 months is 1.5 years', () => {
    expect(j(run('goal-sip', { years: '120', years__unit: 'months', existing: '50000' }))).toBe(j(run('goal-sip', { years: '10', existing: '50000' })))
    expect(j(run('goal-sip', { years: '1.5' }))).toBe(j(run('goal-sip', { years: '18', years__unit: 'months' })))
  })
  it('the cautious-side line shows only when there are savings that grow once a year', () => {
    expect(ok('goal-sip', {}).note).not.toMatch(/cautious/)
    expect(ok('goal-sip', { existing: '100000' }).note).toMatch(/once a year while the monthly SIP grows every month, so the answer is on the cautious side/)
  })
})

describe('lumpsum in years, months, days', () => {
  it('whole years equal lumpsum()', () => {
    expect(row('lumpsum', { years: '7', rate: '9' }, 'Final value').toString()).toBe(lumpsum(new D(100000), new D(9), 7).at(-1)!.value.toString())
  })
  it('18 months equals 1.5 years, with a last row named in months', () => {
    expect(row('lumpsum', { years: '18', years__unit: 'months' }, 'Final value').toString()).toBe(row('lumpsum', { years: '1.5' }, 'Final value').toString())
    const out = ok('lumpsum', { years: '18', years__unit: 'months' })
    expect(out.table!.rows.map((r) => String(r[0]))).toEqual(['1', '18 months'])
    expect(out.chart!.labels).toEqual(['Y1', 'M18'])
  })
  it('90 days is 90/365 of a year, one row, and the note says leap years are ignored', () => {
    const out = ok('lumpsum', { years: '90', years__unit: 'days', rate: '12' })
    expect(Math.abs((out.rows[0]!.value as Dec).toNumber() - 100000 * 1.12 ** (90 / 365))).toBeLessThan(1e-6)
    expect(out.table!.rows).toHaveLength(1)
    expect(out.note).toMatch(/365 days; leap years are ignored/)
  })
  it('365 days is exactly 1 year', () => {
    expect(row('lumpsum', { years: '365', years__unit: 'days' }, 'Final value').toString()).toBe(row('lumpsum', { years: '1' }, 'Final value').toString())
  })
  it('caps at 60 years', () => {
    expect(err('lumpsum', { years: '61' })).toBe('Time must be more than 0 and at most 60 years')
    expect(err('lumpsum', { years: '721', years__unit: 'months' })).toBe('Time must be more than 0 and at most 60 years')
    expect(err('lumpsum', { years: '0' })).toBe('Time must be more than 0 and at most 60 years')
    expect(err('lumpsum', { years: '60' })).toBeNull()
    expect(err('lumpsum', { years: '21900', years__unit: 'days' })).toBeNull()
    expect(err('lumpsum', { years: '21901', years__unit: 'days' })).not.toBeNull()
  })
})

describe('swp saving time in months', () => {
  it('24 months equals 2 years, and 18 months equals 1.5 years', () => {
    expect(j(run('swp', { wait: '24', wait__unit: 'months' }))).toBe(j(run('swp', { wait: '2' })))
    expect(j(run('swp', { wait: '18', wait__unit: 'months' }))).toBe(j(run('swp', { wait: '1.5' })))
  })
  it('refuses part months, negative and more than 720 months; 0 and blank mean start now', () => {
    expect(err('swp', { wait: '1.5', wait__unit: 'months' })).toMatch(/whole months/)
    expect(err('swp', { wait: '721', wait__unit: 'months' })).toMatch(/whole months/)
    expect(err('swp', { wait: '61' })).toMatch(/whole months/)
    expect(err('swp', { wait: '-1' })).toBe('Use positive numbers')
    expect(err('swp', { wait: '0' })).toBeNull()
    expect(err('swp', { wait: '' })).toBeNull()
    expect(err('swp', { wait: '720', wait__unit: 'months' })).toBeNull()
  })
  it('the headline stays tagged as months for Use in', () => {
    expect(ok('swp', {}).rows[0]!.timeUnit).toBe('months')
  })
})

describe('fixed deposit in years, months, days', () => {
  it('90 days: maturity = P(1 + r/4)^(4 x 90/365)', () => {
    const t = new D(90).div(365)
    const want = fd(new D(100000), new D(7), t, 4)
    expect(row('fd', { years: '90', years__unit: 'days' }, 'Maturity value').toString()).toBe(want.toString())
    // independent float check: 100000 x 1.0175^(4 x 90/365) = 101,725.82
    expect(Math.abs(want.toNumber() - 100000 * 1.0175 ** (4 * (90 / 365)))).toBeLessThan(1e-6)
  })
  it('6 months equals 0.5 years; 12 months equals 1 year', () => {
    const vals = (o: Values) => ok('fd', o).rows.map((r) => String(r.value))
    expect(vals({ years: '6', years__unit: 'months' })).toEqual(vals({ years: '0.5' }))
    expect(vals({ years: '12', years__unit: 'months' })).toEqual(vals({ years: '1' }))
  })
  it('effective yearly yield: 7% quarterly is 7.1859%', () => {
    const y = row('fd', { years: '5' }, 'Effective yearly yield')
    expect(y.toDecimalPlaces(4).toString()).toBe('7.1859')
    expect(y.toString()).toBe(effectiveYield(new D(7), 4).toString())
    expect(row('fd', { comp: 'yearly' }, 'Effective yearly yield').toString()).toBe('7')
  })
  it('notes: odd days say a bank may pay simple interest (unproven) and that leap years are ignored', () => {
    const odd = ok('fd', { years: '100', years__unit: 'days' }).note!
    expect(odd).toMatch(/unproven/)
    expect(odd).toMatch(/leap years are ignored/)
    expect(ok('fd', { years: '5' }).note).not.toMatch(/unproven/)
    expect(ok('fd', { years: '6', years__unit: 'months' }).note).not.toMatch(/unproven/)
    expect(ok('fd', { years: '7', years__unit: 'months' }).note).toMatch(/unproven/)
  })
  it('caps: more than 0 and at most 50 years', () => {
    expect(err('fd', { years: '0' })).toBe('Enter years more than zero')
    expect(err('fd', { years: '0', years__unit: 'days' })).toBe('Enter years more than zero')
    expect(err('fd', { years: '51' })).toBe('Use 50 years or fewer')
    expect(err('fd', { years: '601', years__unit: 'months' })).toBe('Use 50 years or fewer')
    expect(err('fd', { years: '50' })).toBeNull()
    expect(err('fd', { years: '18250', years__unit: 'days' })).toBeNull()
  })
})

describe('recurring deposit in years or months', () => {
  it('18 months equals 1.5 years, and the table now ends with the part year', () => {
    expect(j(run('rd', { years: '18', years__unit: 'months' }))).toBe(j(run('rd', { years: '1.5' })))
    const out = ok('rd', { years: '18', years__unit: 'months' })
    expect(out.table!.rows.map((r) => String(r[0]))).toEqual(['1', 'Month 18'])
    expect(out.table!.rows[1]![1]!.toString()).toBe('90000')
    expect(out.table!.rows[1]![3]!.toString()).toBe(out.rows[0]!.value.toString())
  })
  it('a plan shorter than a year has a one-row table', () => {
    expect(ok('rd', { years: '6', years__unit: 'months' }).table!.rows).toHaveLength(1)
  })
  it('part months: the plain error', () => {
    expect(err('rd', { years: '1.55' })).toBe('Time must come to whole months')
    expect(err('rd', { years: '0', years__unit: 'months' })).toBe('Time must come to whole months')
    expect(err('rd', { years: '7.5', years__unit: 'months' })).toBe('Time must come to whole months')
    expect(err('rd', { years: '721', years__unit: 'months' })).toBe('Use 60 years or fewer')
  })
})

describe('inflation in years or months', () => {
  it('18 months equals 1.5 years (the worked line says how the time was read)', () => {
    const a = ok('inflation', { years: '18', years__unit: 'months' })
    const b = ok('inflation', { years: '1.5' })
    expect(a.rows.map((r) => String(r.value))).toEqual(b.rows.map((r) => String(r.value)))
    expect(a.formula!.join('\n')).toMatch(/18 months ÷ 12 = 1.5 years/)
  })
  it('caps at 100 years', () => {
    expect(err('inflation', { years: '101' })).toBe('Use 100 years or fewer')
    expect(err('inflation', { years: '1201', years__unit: 'months' })).toBe('Use 100 years or fewer')
    expect(err('inflation', { years: '100' })).toBeNull()
  })
})

describe('cagr-xirr in years or months', () => {
  it('24 months equals 2 years; days are not offered', () => {
    expect(row('cagr-xirr', { years: '24', years__unit: 'months' }, 'Yearly growth (CAGR)').toString()).toBe(row('cagr-xirr', { years: '2' }, 'Yearly growth (CAGR)').toString())
    expect(row('cagr-xirr', { years: '5', years__unit: 'days' }, 'Yearly growth (CAGR)').toString()).toBe(row('cagr-xirr', { years: '5' }, 'Yearly growth (CAGR)').toString())
  })
})

// ---- guards ------------------------------------------------------------------------------------------------

describe('guards: rate 0 to 100, plain-word errors, never NaN or Infinity', () => {
  const RATE_TOOLS: [string, string, string][] = [
    ['sip', 'rate', 'Enter a yearly return from 0 to 100%'],
    ['step-up-sip', 'rate', 'Enter a yearly return from 0 to 100%'],
    ['lumpsum', 'rate', 'Enter a yearly return from 0 to 100%'],
    ['goal-sip', 'rate', 'Enter a yearly return from 0 to 100%'],
    ['swp', 'rate', 'Enter a yearly return from 0 to 100%'],
    ['fd', 'rate', 'Enter a yearly interest rate from 0 to 100%'],
    ['rd', 'rate', 'Enter a yearly interest rate from 0 to 100%'],
    ['inflation', 'infl', 'Enter a yearly inflation rate from 0 to 100%'],
  ]
  for (const [id, field, msg] of RATE_TOOLS) {
    it(`${id}: ${field} of 1e6, 100.01 and -1 are refused; 0 and 100 are fine`, () => {
      for (const bad of ['1000000', '1e6', '100.01', '-1']) expect(err(id, { [field]: bad }), `${id} ${bad}`).toBe(msg)
      expect(err(id, { [field]: '0' })).toBeNull()
      expect(err(id, { [field]: '100' })).toBeNull()
    })
  }
  it('blank and junk are plain words, in every unit', () => {
    for (const id of ['sip', 'step-up-sip', 'lumpsum', 'goal-sip', 'fd', 'rd', 'inflation', 'cagr-xirr']) {
      for (const u of ['years', 'months', 'days']) {
        for (const bad of ['', '12abc', ' ']) {
          const e = err(id, { years: bad, years__unit: u })
          expect(e, `${id} ${u} "${bad}"`).toMatch(/^[A-Z]/)
          expect(e).not.toMatch(/NaN|Infinity|undefined/)
        }
      }
    }
  })
  it('huge years never gives NaN or Infinity', () => {
    for (const id of ['sip', 'step-up-sip', 'lumpsum', 'goal-sip', 'fd', 'rd', 'inflation']) {
      for (const [n, u] of [['1e9', 'years'], ['1e12', 'months'], ['1e15', 'days'], ['99999999999999999999', 'years']] as const) {
        const out = run(id, { years: n, years__unit: u })
        expect(isError(out), `${id} ${n} ${u}`).toBe(true)
      }
    }
  })
  it('swp with a huge wait or a huge rate is refused', () => {
    expect(err('swp', { wait: '1e9' })).toMatch(/whole months/)
    expect(err('swp', { saveRate: '1e6' })).toMatch(/saving years/)
  })
  it('nothing in any default result is NaN or Infinity', () => {
    for (const id of Object.keys(SAVINGS_CASES)) expect(j(run(id))).not.toMatch(/NaN|Infinity/)
  })
})

// ---- Use in: a time-valued headline carries its unit --------------------------------------------------------

describe('Use in', () => {
  it('swp "Months it lasts" is tagged months, so it goes only to a box that offers months', () => {
    expect(ok('swp').rows.find((r) => r.main)!.timeUnit).toBe('months')
  })
})
