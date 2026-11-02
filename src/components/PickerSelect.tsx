import { useId, useMemo, useState } from 'react'
import { Icon } from './Icon'
import { Sheet } from './Sheet'

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
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const autoId = useId()
  const current = options.find((o) => o.value === value)

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? options.filter((o) => `${o.label} ${o.hint ?? ''} ${o.group ?? ''}`.toLowerCase().includes(needle)) : options
  }, [options, q])

  const close = () => {
    setOpen(false)
    setQ('')
  }
  const pick = (v: string) => {
    onChange(v)
    close()
  }

  return (
    <>
      <button
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

      {open && (
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
          <div className="pick__list" role="listbox" aria-label={label}>
            {shown.length === 0 && <p className="note">Nothing matches &ldquo;{q}&rdquo;.</p>}
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
        </Sheet>
      )}
    </>
  )
}
