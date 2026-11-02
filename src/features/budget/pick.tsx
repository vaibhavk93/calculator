import { useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import type { PickOption } from '../../components/PickerSelect'
import { Sheet } from '../../components/Sheet'

/** More than this many options get a search box (same as PickerSelect). */
const SEARCH_FROM = 8

/** The look of PickerSelect (underline, accent down icon) for a choice that opens a swapped-in PickView, never a second sheet. */
export function PickTrigger({ id, label, valueLabel, placeholder = 'Choose', onOpen, invalid, describedBy }: {
  id: string
  label: string
  valueLabel?: string
  placeholder?: string
  onOpen: () => void
  invalid?: boolean
  describedBy?: string
}) {
  return (
    <button
      type="button"
      id={id}
      className="pick pick--start"
      aria-haspopup="dialog"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      aria-label={`${label}: ${valueLabel ?? placeholder}. Change.`}
      onClick={onOpen}
    >
      <span className={valueLabel ? 'pick__value' : 'pick__value pick__value--empty'}>{valueLabel ?? placeholder}</span>
      <Icon name="down" size={18} />
    </button>
  )
}

/**
 * A list of choices that takes the place of a form sheet's content (docs/FORMS-AND-SHEETS.md section 4: never stack a picker on a
 * sheet). The back arrow and the X both return to the form. One tap on a row picks it. `extra` rows (such as "+ Add bank account")
 * come last; `onAddName` adds a plain name typed into a small form.
 */
export function PickView({ title, options, value, onPick, onBack, extra, onAddName, validateAdd, addLabel = 'Add new' }: {
  title: string
  options: PickOption[]
  value: string
  onPick: (v: string) => void
  onBack: () => void
  extra?: { key: string; label: string; onClick: () => void }[]
  /** Adds a new option named `name` and returns its value, or null when it could not be added. */
  onAddName?: (name: string) => string | null
  validateAdd?: (name: string) => string | null
  addLabel?: string
}) {
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? options.filter((o) => `${o.label} ${o.hint ?? ''} ${o.group ?? ''}`.toLowerCase().includes(needle)) : options
  }, [options, q])

  const submitAdd = () => {
    const why = validateAdd?.(newName.trim()) ?? null
    if (why) return setAddError(why)
    const id = onAddName?.(newName.trim()) ?? null
    if (id === null) return setAddError('Could not add that. Check the name')
    onPick(id)
  }

  return (
    <Sheet
      title={title}
      onClose={onBack}
      action={
        <button type="button" className="icon-btn" aria-label="Back to the form" title="Back to the form" onClick={onBack}>
          <Icon name="back" size={20} />
        </button>
      }
    >
      {options.length > SEARCH_FROM && (
        <input className="field pick__search" type="search" placeholder="Search" aria-label={`Search ${title}`} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" spellCheck={false} />
      )}
      <div className="pick__list" role="listbox" aria-label={title}>
        {shown.length === 0 && <p className="note">Nothing matches &ldquo;{q}&rdquo;.</p>}
        {shown.map((o, i) => (
          <div key={o.value}>
            {o.group && o.group !== shown[i - 1]?.group && <h3 className="pick__group">{o.group}</h3>}
            <button type="button" role="option" aria-selected={o.value === value} className="pick__opt" onClick={() => onPick(o.value)}>
              <span className="pick__text">
                <span className="pick__label">{o.label}</span>
                {o.hint && <span className="pick__hint">{o.hint}</span>}
              </span>
              {o.value === value && <Icon name="check" size={20} />}
            </button>
          </div>
        ))}
      </div>
      {extra?.map((x) => (
        <button key={x.key} type="button" className="pick__opt pick__opt--add" onClick={x.onClick}>
          <span className="pick__label">{x.label}</span>
        </button>
      ))}
      {onAddName &&
        (adding ? (
          <form className="pick__add" onSubmit={(e) => { e.preventDefault(); submitAdd() }}>
            <label className="ffield__label" htmlFor="pick-add-name">Name</label>
            <div className="pick__addrow">
              <input
                id="pick-add-name"
                className="field"
                value={newName}
                maxLength={40}
                autoFocus
                autoComplete="off"
                aria-invalid={addError ? true : undefined}
                aria-describedby={addError ? 'pick-add-msg' : undefined}
                onChange={(e) => { setNewName(e.target.value); setAddError(null) }}
              />
              <button type="submit" className="btn btn--primary">Add</button>
            </div>
            {addError && <p className="ffield__error" id="pick-add-msg" role="alert">{addError}</p>}
          </form>
        ) : (
          <button type="button" className="pick__opt pick__opt--add" onClick={() => setAdding(true)}>
            <span className="pick__label">{`+ ${addLabel}…`}</span>
          </button>
        ))}
    </Sheet>
  )
}
