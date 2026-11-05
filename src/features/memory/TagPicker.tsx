import { useState } from 'react'

/**
 * Tag chips plus a box for your own tag, as the Task and Note sheets show them. `known` is every tag in use, so one tap
 * re-uses it. A tag is cut to 30 characters; the same tag in another case is not added twice. `limit` is only the number
 * the hint names: the sheet's own check refuses too many on Save, with `error` in words.
 */
export function TagPicker({ known, tags, onChange, limit, error, idPrefix }: { known: string[]; tags: string[]; onChange: (t: string[]) => void; limit: number; error?: string; idPrefix: string }) {
  const [custom, setCustom] = useState('')
  const toggle = (t: string) => onChange(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])
  const add = () => {
    const t = custom.trim().slice(0, 30)
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...tags, t])
    setCustom('')
  }
  return (
    <>
      <span className="field-label" id={`${idPrefix}-tags`}>Tags</span>
      <div className="chips" role="group" aria-labelledby={`${idPrefix}-tags`}>
        {known.map((t) => (
          <button key={t} type="button" className="chip" aria-pressed={tags.includes(t)} onClick={() => toggle(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="save__add">
        <input className="field" placeholder="Your own tag" aria-label="Add your own tag" value={custom} maxLength={30} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button type="button" className="btn" onClick={add}>Add tag</button>
      </div>
      <p className={error ? 'ffield__error' : 'ffield__hint'} role={error ? 'alert' : undefined}>{error ?? `Up to ${limit} tags.`}</p>
    </>
  )
}
