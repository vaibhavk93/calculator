import { isError, parseNum, type Field, type ToolSpec, type Values } from './tool'

const SAMPLE_DATE = '2025-01-15'

/** A value that is plainly fine for this field, or undefined when the field already holds it. */
function sampleFor(f: Field, current: Values[string] | undefined): Values[string] | undefined {
  let alt: Values[string]
  if (f.kind === 'rows') alt = f.defaultRows.map((r) => [...r])
  else if (f.kind === 'select') alt = f.default
  else if (f.kind === 'number') alt = f.default ? f.default : '1'
  else if (f.kind === 'date') alt = f.default || SAMPLE_DATE
  else if (f.kind === 'time') alt = f.default || '12:00'
  else alt = f.default || 'x'
  if (alt === current || JSON.stringify(alt) === JSON.stringify(current)) return f.kind === 'number' && alt === '1' ? '2' : undefined
  return alt
}

const emptyOrJunk = (f: Field, v: Values[string] | undefined) =>
  f.kind === 'number' ? parseNum(v) === null : f.kind === 'date' || f.kind === 'time' || f.kind === 'text' ? typeof v !== 'string' || v.trim() === '' : false

/**
 * Which inputs the error message is about, so the screen can mark them invalid. Specs write their own messages
 * ("Enter interest rate" for a field labelled "Yearly interest rate"), so words cannot be trusted to line up.
 * Instead: a field is the culprit when putting a sensible value in it changes or clears the error. Only the field
 * behind the FIRST error qualifies, which is the one the message describes. Blank or junk boxes are tried first,
 * so a blank optional box is not blamed for someone else's error.
 */
export function invalidFieldIds(spec: ToolSpec, values: Values, error: string | null): Set<string> {
  if (!error) return new Set()
  const shown = spec.fields.filter((f) => !f.visibleIf || f.visibleIf(values))
  const byWords = () => {
    const lower = error.toLowerCase()
    return new Set(shown.filter((f) => lower.includes(f.label.toLowerCase())).map((f) => f.id))
  }
  // The spec named the box itself: trust it.
  try {
    const own = spec.compute(values)
    if (isError(own) && own.error === error && own.field && shown.some((f) => f.id === own.field)) return new Set([own.field])
  } catch {
    /* handled below */
  }
  // An error the spec did not write (the screen's "too large" check): only the words can say which box.
  try {
    if (!isError(spec.compute(values))) return byWords()
  } catch {
    return byWords()
  }

  const blamed = (list: Field[]) =>
    list.filter((f) => {
      const alt = sampleFor(f, values[f.id])
      if (alt === undefined) return false
      try {
        const out = spec.compute({ ...values, [f.id]: alt })
        return !isError(out) || out.error !== error
      } catch {
        return true
      }
    })
  const blank = blamed(shown.filter((f) => emptyOrJunk(f, values[f.id])))
  const hit = blank.length ? blank : blamed(shown.filter((f) => f.kind !== 'select'))
  return hit.length ? new Set(hit.map((f) => f.id)) : byWords()
}
