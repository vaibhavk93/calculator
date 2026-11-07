import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { Sheet } from './Sheet'
import { useBackHandler } from './useBackHandler'

export interface PickOption {
  value: string
  label: string
  /** A short second line, such as "Credit card, RuPay". */
  hint?: string
  /** Options with the same group sit together under a small heading. */
  group?: string
}

/** More than this many options get a search box. */
const SEARCH_FROM = 8

/**
 * A choice from a list, drawn in the app's own style. A native dropdown opens a system popup that cannot be
 * themed and clashes with the app; this opens a sheet with one row per option and a tick on the chosen one.
 * Use Segmented for up to 4 short options. See docs/FORMS-AND-SHEETS.md.
 */
export function PickerSelect({
  label,
  value,
  options,
  onChange,
  title,
  placeholder = 'Choose',
  id,
  describedBy,
  invalid,
  align = 'start',
  onAdd,
  validateAdd,
  addLabel = 'Add new',
  above,
}: {
  /** What this choice is, for screen readers and the sheet title when `title` is not given. */
  label: string
  value: string
  options: PickOption[]
  onChange: (value: string) => void
  title?: string
  placeholder?: string
  id?: string
  describedBy?: string
  invalid?: boolean
  /** "end" right-aligns the value, for use inside a settings row. */
  align?: 'start' | 'end'
  /**
   * Adds a new option named `name` and returns its value, or null if it could not be added. Turns on a last row,
   * "+ Add new", which asks for a name (or uses what was typed in the search box) and selects the new option.
   */
  onAdd?: (name: string) => string | null
  /** Says in words why `name` cannot be added, or null when it can. Shown under the name box. */
  validateAdd?: (name: string) => string | null
  /** What the last row is called when nothing is typed, such as "Add category". */
  addLabel?: string
  /** Something shown directly under the search box while nothing is typed (Settings: the recent calculators). Gets `pick`, which chooses a value and closes the sheet. */
  above?: (pick: (value: string) => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const autoId = useId()
  const addId = useId()
  const btnRef = useRef<HTMLButtonElement>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const current = options.find((o) => o.value === value)

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? options.filter((o) => `${o.label} ${o.hint ?? ''} ${o.group ?? ''}`.toLowerCase().includes(needle)) : options
  }, [options, q])

  const close = () => {
    setOpen(false)
    setQ('')
    setAdding(false)
    setNewName('')
    setAddError(null)
  }
  // Android back and Escape close this list, not the sheet it was opened from. Escape is caught first, on the way down.
  useBackHandler(open, close)
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      closeRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])
  const pick = (v: string) => {
    onChange(v)
    close()
  }

  const typed = q.trim()
  const submitAdd = (raw: string) => {
    const name = raw.trim()
    const why = validateAdd?.(name) ?? null
    if (why) return setAddError(why)
    const id = onAdd?.(name) ?? null
    if (id === null) return setAddError('Could not add that. Check the name')
    pick(id)
  }

  const sheet = (
    <Sheet title={title ?? label} onClose={close}>
      {options.length > SEARCH_FROM && (
        <input
          className="field pick__search"
          type="search"
          placeholder="Search"
          aria-label={`Search ${label}`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      )}
      {!typed && above?.(pick)}
      <div className="pick__list" role="listbox" aria-label={label}>
        {shown.length === 0 && !onAdd && <p className="note">Nothing matches &ldquo;{q}&rdquo;.</p>}
        {shown.map((o, i) => (
          <div key={o.value}>
            {o.group && o.group !== shown[i - 1]?.group && <h3 className="pick__group">{o.group}</h3>}
            <button type="button" role="option" aria-selected={o.value === value} className="pick__opt" onClick={() => pick(o.value)}>
              <span className="pick__text">
                <span className="pick__label">{o.label}</span>
                {o.hint && <span className="pick__hint">{o.hint}</span>}
              </span>
              {o.value === value && <Icon name="check" size={20} />}
            </button>
          </div>
        ))}
      </div>
      {onAdd &&
        (adding ? (
          <form
            className="pick__add"
            onSubmit={(e) => {
              e.preventDefault()
              submitAdd(newName)
            }}
          >
            <label className="ffield__label" htmlFor={addId}>Name</label>
            <div className="pick__addrow">
              <input
                id={addId}
                className="field"
                value={newName}
                maxLength={40}
                autoFocus
                autoComplete="off"
                aria-invalid={addError ? true : undefined}
                aria-describedby={addError ? `${addId}-msg` : undefined}
                onChange={(e) => {
                  setNewName(e.target.value)
                  setAddError(null)
                }}
              />
              <button type="submit" className="btn btn--primary">Add</button>
            </div>
            {addError && <p className="ffield__error" id={`${addId}-msg`} role="alert">{addError}</p>}
          </form>
        ) : (
          <>
            <button
              type="button"
              className="pick__opt pick__opt--add"
              onClick={() => (typed && options.length > SEARCH_FROM ? submitAdd(typed) : setAdding(true))}
            >
              <span className="pick__label">{typed && options.length > SEARCH_FROM ? `+ ${addLabel} \u201c${typed}\u201d` : `+ ${addLabel}\u2026`}</span>
            </button>
            {addError && <p className="ffield__error" role="alert">{addError}</p>}
          </>
        ))}
    </Sheet>
  )

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        id={id ?? autoId}
        className={`pick pick--${align}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-label={`${label}: ${current?.label ?? placeholder}. Change.`}
        onClick={() => setOpen(true)}
      >
        <span className={current ? 'pick__value' : 'pick__value pick__value--empty'}>{current?.label ?? placeholder}</span>
        <Icon name="down" size={18} />
      </button>

      {open && createPortal(sheet, btnRef.current?.closest('.app') ?? document.body)}
    </>
  )
}
