import type { ReactNode } from 'react'
import { Icon } from '../../components/Icon'

/** Text options with an underline on the chosen one. For 2 to 4 short choices. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="seg__opt"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)} />
  )
}

/** A row with a label, an optional hint, and a control on the right. */
export function Row({ label, hint, children }: { label: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="row">
      <span className="row__text">
        <span className="row__label">{label}</span>
        {hint && <span className="row__hint">{hint}</span>}
      </span>
      {children}
    </div>
  )
}

/** A whole row you tap to choose it, with a tick on the chosen one. */
export function OptionRow({
  label,
  sample,
  checked,
  onSelect,
}: {
  label: string
  sample: string
  checked: boolean
  onSelect: () => void
}) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="row row--button" onClick={onSelect}>
      <span className="row__text">
        <span className="row__label">{label}</span>
        <span className="row__value">{sample}</span>
      </span>
      {checked && <Icon name="check" size={20} className="check" />}
    </button>
  )
}
