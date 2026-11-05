import { describe, expect, it } from 'vitest'
import { defaultValues, isError, type Field } from '../../lib/tool'
import { ALL_TOOLS } from './registry'

/** Every optional number field, by tool id, that reads with `?? 0` -- junk here must error, not vanish into 0. */
const OPTIONAL_NUMBER_FIELDS: Record<string, string[]> = {
  'goal-sip': ['existing'],
  'multi-loan': ['extra'],
  runway: ['income', 'partpay'],
  fd: ['slab'],
  inflation: ['ret', 'medical'],
  swp: ['wait', 'saveRate'],
  'emergency-fund': ['savings'],
  'home-loan-tax': ['used123'],
  'balance-transfer': ['fees'],
  'card-emi': ['fee'],
  gratuity: ['months'],
  'income-tax': ['other', 'basicDa', 'employerNps', 'sec123', 'healthSelf', 'healthParents', 'ownNps', 'homeLoan', 'hra', 'pt'],
  'in-hand-salary': ['ptMonthly', 'hra'],
  'capital-gains': ['expenses', 'used'],
  'advance-tax': ['tds', 'p1', 'p2', 'p3', 'p4'],
  'presumptive-44ada': ['other'],
}

describe('every calculator spec', () => {
  it('has a unique id', () => {
    const ids = ALL_TOOLS.map((t) => t.id)
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
  })

  for (const spec of ALL_TOOLS) {
    describe(spec.id, () => {
      it('has unique field ids and sane selects', () => {
        const ids = spec.fields.map((f) => f.id)
        expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
        const selects = spec.fields.filter((f): f is Extract<Field, { kind: 'select' }> => f.kind === 'select')
        for (const s of selects) expect(s.options.map((o) => o.value), `${s.id} default`).toContain(s.default)
      })

      it('keeps "__" out of field ids (it is reserved for <id>__unit), and a unit switch starts on the old unit', () => {
        const all = spec.fields.flatMap((f) => (f.kind === 'rows' ? [f, ...f.columns] : [f]))
        expect(all.filter((f) => f.id.includes('__')).map((f) => f.id)).toEqual([])
        for (const f of spec.fields) {
          if ((f.kind !== 'number' && f.kind !== 'text') || !f.units) continue
          // A bare number in the loan term text box means years; a number box's old meaning is its `unit`.
          expect(f.units[0], `${f.id}: units[0] must be what the box meant before the switch`).toBe(f.kind === 'number' ? f.unit : 'years')
        }
      })

      it('shows a real result from its default values, not an error', () => {
        const out = spec.compute(defaultValues(spec))
        expect(isError(out) ? out.error : 'ok').toBe('ok')
      })

      it('never throws or shows NaN/Infinity on blank inputs', () => {
        const blank = defaultValues(spec)
        for (const f of spec.fields) if (f.kind !== 'select' && f.kind !== 'rows') blank[f.id] = ''
        const out = spec.compute(blank)
        expect(JSON.stringify(out)).not.toMatch(/NaN|Infinity/)
      })

      for (const id of OPTIONAL_NUMBER_FIELDS[spec.id] ?? []) {
        it(`junk in the optional field "${id}" is an error, not a silent 0`, () => {
          const v = defaultValues(spec)
          v[id] = '12abc'
          const out = spec.compute(v)
          expect(isError(out), `expected an error with junk in "${id}", got ${JSON.stringify(out).slice(0, 200)}`).toBe(true)
        })
      }
    })
  }
})
