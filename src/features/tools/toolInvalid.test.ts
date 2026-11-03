import { describe, expect, it } from 'vitest'
import { ALL_TOOLS } from './registry'
import { defaultValues, isError } from '../../lib/tool'
import { invalidFieldIds } from '../../lib/toolInvalid'

/** The shared screen marks the box an error is about. This walks every calculator with one box emptied or junked. */
describe('invalidFieldIds', () => {
  for (const spec of ALL_TOOLS) {
    for (const f of spec.fields) {
      if (f.kind !== 'number' && f.kind !== 'date' && f.kind !== 'text' && f.kind !== 'time') continue
      for (const [what, bad] of [['empty', ''], ['junk', f.kind === 'number' ? '12abc' : '']] as const) {
        if (what === 'junk' && f.kind !== 'number') continue
        it(`${spec.id}.${f.id} ${what}: the error points at it`, () => {
          const v = defaultValues(spec)
          v[f.id] = bad
          const out = spec.compute(v)
          if (!isError(out)) return // an optional box: blank is allowed, nothing to mark
          expect([...invalidFieldIds(spec, v, out.error)], out.error).toContain(f.id)
        })
      }
    }
  }

  it('marks nothing when there is no error', () => {
    const spec = ALL_TOOLS[0]!
    expect(invalidFieldIds(spec, defaultValues(spec), null).size).toBe(0)
  })
})
