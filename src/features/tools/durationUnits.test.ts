import { describe, expect, it } from 'vitest'
import { defaultValues, isError, unitKey, unitOf, type Field, type TimeUnit, type ToolSpec, type Values } from '../../lib/tool'
import { inputLines } from '../../lib/shareText'
import type { AppStore } from '../../store/app'
import { advancedOpen } from './fieldInput'
import { prefillDraft } from './ToolScreen'
import { ALL_TOOLS } from './registry'

const IN = { system: 'indian', decimals: 'auto' } as const
const withUnits = (spec: ToolSpec) => spec.fields.filter((f): f is Extract<Field, { kind: 'number' | 'text' }> => (f.kind === 'number' || f.kind === 'text') && !!f.units)

describe('unitOf', () => {
  const f: { id: string; unit: 'years'; units: TimeUnit[] } = { id: 'y', unit: 'years', units: ['years', 'months', 'days'] }
  it('returns units[0] for a missing, empty or garbage key', () => {
    expect(unitOf(f, {})).toBe('years')
    expect(unitOf(f, { [unitKey('y')]: '' })).toBe('years')
    expect(unitOf(f, { [unitKey('y')]: 'weeks' })).toBe('years')
    expect(unitOf(f, { [unitKey('y')]: 'MONTHS' })).toBe('years')
  })
  it('returns a valid stored unit', () => {
    expect(unitOf(f, { y__unit: 'months' })).toBe('months')
    expect(unitOf(f, { y__unit: 'days' })).toBe('days')
  })
  it('a unit that is not on offer cannot be picked', () => {
    expect(unitOf({ id: 'y', unit: 'years', units: ['years', 'months'] }, { y__unit: 'days' })).toBe('years')
  })
})

describe('every duration box opens on its old meaning', () => {
  it('units[0] is the old unit, and ids hold no "__"', () => {
    for (const spec of ALL_TOOLS) for (const f of withUnits(spec)) {
      expect(f.units![0], `${spec.id}.${f.id}`).toBe(f.kind === 'number' ? f.unit : 'years')
      expect(f.id.includes('__')).toBe(false)
    }
  })
  it('an old saved card (no unit key) merged under the defaults reads units[0], as ToolScreen builds the form', () => {
    for (const spec of ALL_TOOLS) for (const f of withUnits(spec)) {
      const oldCard: Values = { [f.id]: '10' }
      const form = { ...defaultValues(spec), ...oldCard }
      expect(unitOf(f, form), `${spec.id}.${f.id}`).toBe(f.units![0])
      // and the stored text is untouched
      expect(form[f.id]).toBe('10')
    }
  })
})

// ---- the loan term ----------------------------------------------------------------------------------

const LOAN_TOOLS = ALL_TOOLS.filter((s) => s.fields.some((f) => f.id === 'tenure' && f.kind === 'text'))

describe('loan term with the Years / Months switch', () => {
  it('is on every loan tool that has the term box (and loan compare keeps its own column)', () => {
    expect(LOAN_TOOLS.map((s) => s.id).sort()).toEqual(['amortisation', 'emi', 'home-loan-tax', 'prepayment', 'rate-change', 'reverse-emi'])
    for (const s of LOAN_TOOLS) expect(withUnits(s).map((f) => [f.id, f.units])).toEqual([['tenure', ['years', 'months']]])
    expect(withUnits(ALL_TOOLS.find((s) => s.id === 'loan-compare')!)).toEqual([])
  })
  for (const spec of LOAN_TOOLS) {
    const j = (v: Values) => JSON.stringify(spec.compute(v))
    describe(spec.id, () => {
      const base = defaultValues(spec)
      it('GOLDEN: an old saved card (bare number, no unit key) still means years', () => {
        const { tenure__unit: _u, ...old } = base
        expect(old.tenure).toBe('20')
        const form = { ...defaultValues(spec), ...old }
        expect(j(old)).toBe(j({ ...base, tenure: '20 years' }))
        expect(j(form)).toBe(j({ ...base, tenure: '20 years', tenure__unit: 'years' }))
        expect(isError(spec.compute(old))).toBe(false)
      })
      it('a bare number with Months means months, same as typing "N months"', () => {
        expect(j({ ...base, tenure: '18', tenure__unit: 'months' })).toBe(j({ ...base, tenure: '18 months', tenure__unit: 'years' }))
        expect(j({ ...base, tenure: '18', tenure__unit: 'months' })).not.toBe(j({ ...base, tenure: '18' }))
      })
      it('a typed unit word wins over the switch', () => {
        expect(j({ ...base, tenure: '2 years', tenure__unit: 'months' })).toBe(j({ ...base, tenure: '24 months', tenure__unit: 'years' }))
      })
      it('a garbage unit key is read as years', () => {
        expect(j({ ...base, tenure: '20', tenure__unit: 'fortnights' })).toBe(j({ ...base, tenure: '20' }))
      })
      it('a card saved with the older tenureUnit pick still works', () => {
        const { tenure__unit: _u, ...old } = base
        expect(j({ ...old, tenure: '18', tenureUnit: 'months' })).toBe(j({ ...base, tenure: '18 months' }))
      })
    })
  }
  it('the EMI for 20 years is the known figure', () => {
    const emi = ALL_TOOLS.find((s) => s.id === 'emi')!
    const out = emi.compute({ ...defaultValues(emi), tenure: '20' })
    expect(isError(out) ? 'error' : out.rows[0]!.value.toString()).toMatch(/^43391\.16/)
  })
})

// ---- share text ---------------------------------------------------------------------------------------

describe('share text names the chosen unit', () => {
  const fields: Field[] = [
    { id: 'n', label: 'Duration', kind: 'number', unit: 'years', units: ['years', 'months', 'days'] },
    { id: 'fixed', label: 'Fixed', kind: 'number', unit: 'years' },
    { id: 'tenure', label: 'Loan term', kind: 'text', units: ['years', 'months'] },
  ]
  const lines = (v: Values) => inputLines(fields, v, IN).map((l) => l.text)
  it('prints 18 months, singular 1 month, and years when the key is missing or garbage', () => {
    expect(lines({ n: '18', n__unit: 'months' })).toEqual(['18 months'])
    expect(lines({ n: '1', n__unit: 'months' })).toEqual(['1 month'])
    expect(lines({ n: '1', n__unit: 'years' })).toEqual(['1 year'])
    expect(lines({ n: '90', n__unit: 'days' })).toEqual(['90 days'])
    expect(lines({ n: '5' })).toEqual(['5 years'])
    expect(lines({ n: '5', n__unit: 'x' })).toEqual(['5 years'])
  })
  it('a box without a switch prints as before', () => {
    expect(lines({ fixed: '20' })).toEqual(['20 years'])
  })
  it('the loan term takes the switch for a bare number, and keeps a typed phrase as typed', () => {
    expect(lines({ tenure: '18', tenure__unit: 'months' })).toEqual(['18 months'])
    expect(lines({ tenure: '20' })).toEqual(['20 years'])
    expect(lines({ tenure: '1', tenure__unit: 'months' })).toEqual(['1 month'])
    expect(lines({ tenure: '2 years', tenure__unit: 'months' })).toEqual(['2 years'])
  })
})

describe('prefillDraft writes the unit for a box with a switch', () => {
  const spec = {
    id: 't', title: 'T', blurb: '', category: 'everyday', keywords: [], compute: () => ({ rows: [] }),
    fields: [
      { id: 'n', label: 'N', kind: 'number', unit: 'years', units: ['years', 'months'], default: '5' },
      { id: 'fixed', label: 'F', kind: 'number', unit: 'months', default: '1' },
    ],
  } as unknown as ToolSpec
  const run = (fieldId: string, value: string, unit?: TimeUnit) => {
    let saved: Values | null = null
    const store = { getState: () => ({ drafts: {}, setDraft: (_id: string, v: Values) => (saved = v) }) } as unknown as AppStore
    prefillDraft(store, spec, fieldId, value, unit)
    return saved as Values | null
  }
  it('sets the number and its unit key; other boxes stay as they were', () => {
    expect(run('n', '18', 'months')).toEqual({ n: '18', n__unit: 'months', fixed: '1' })
  })
  it('a one-unit box, or a result with no unit, gets no key', () => {
    expect(run('fixed', '9', 'months')).toEqual({ n: '5', n__unit: 'years', fixed: '9' })
    expect(run('n', '9')).toEqual({ n: '9', n__unit: 'years', fixed: '1' })
  })
})

describe('More options opens when only the unit changed', () => {
  const fields: Field[] = [{ id: 'n', label: 'N', kind: 'number', unit: 'years', units: ['years', 'months'], default: '5', advanced: true }]
  it('closed at the defaults, open once the unit differs', () => {
    expect(advancedOpen(fields, { n: '5' })).toBe(false)
    expect(advancedOpen(fields, { n: '5', n__unit: 'years' })).toBe(false)
    expect(advancedOpen(fields, { n: '5', n__unit: 'months' })).toBe(true)
  })
})
