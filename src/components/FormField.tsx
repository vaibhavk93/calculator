import type { ReactNode } from 'react'

/**
 * One labelled form field: the label (with a * when it is required), the control, a hint, and an error in words.
 * The control should carry `id={htmlFor}`, `aria-describedby={`${htmlFor}-msg`}` and `aria-invalid` when `error` is set.
 * The error and the hint share one element id, `${htmlFor}-msg`, so a screen reader reads whichever is showing.
 * See docs/FORMS-AND-SHEETS.md.
 */
export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="ffield" data-invalid={error ? '' : undefined}>
      <label className="ffield__label" htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="req" aria-hidden="true">
            {' '}*
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {error ? (
        <p className="ffield__error" id={`${htmlFor}-msg`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="ffield__hint" id={`${htmlFor}-msg`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Shown once at the top of a form that has required fields. */
export function RequiredNote() {
  return (
    <p className="ffield__legend">
      <span className="req" aria-hidden="true">*</span> Required
    </p>
  )
}
