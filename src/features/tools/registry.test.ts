import { describe, expect, it } from 'vitest'
import { defaultValues, isError, type Field } from '../../lib/tool'
import { ALL_TOOLS } from './registry'

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
    })
  }
})
