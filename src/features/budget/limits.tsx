import { useState } from 'react'
import { FormField, RequiredNote } from '../../components/FormField'
import { Sheet } from '../../components/Sheet'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { hasMonthLimit, monthShortLabel, validateLimit } from '../../lib/budget'
import type { LimitScope } from '../../store/app'
import { Segmented } from '../settings/controls'
import { GuardedFooter, MoneyInput, focusField, useDiscardGuard } from './formKit'

type Scope = 'always' | 'month'

/**
 * What the person is typing for a limit: the every-month amount and, separately, this month's own amount.
 * The two texts are kept apart so flipping the switch never loses what was typed.
 * `standing` is the every-month limit; `byMonth` is the "this month only" map (docs/BUDGET-PLAN.md).
 */
export function useLimitDraft(standing: string | null, byMonth: Record<string, string | null> | undefined, month: string) {
  const override = hasMonthLimit({ limitByMonth: byMonth }, month)
  const [start] = useState(() => ({ scope: (override ? 'month' : 'always') as Scope, always: standing ?? '', month: byMonth?.[month] ?? '' }))
  const [scope, setScope] = useState<Scope>(start.scope)
  const [always, setAlways] = useState(start.always)
  const [monthText, setMonthText] = useState(start.month)
  const [touched, setTouched] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const text = scope === 'always' ? always : monthText
  const problem = validateLimit(text)
  const dirty = scope !== start.scope || always !== start.always || monthText !== start.month

  /** Writes what changed. `set` and `clear` are the store actions; returns false when the store refused. */
  const apply = (set: (limit: string | null, scope: LimitScope) => boolean, clear: () => void): boolean => {
    if (always.trim() !== start.always.trim() && !set(always.trim() || null, { kind: 'always' })) return false
    if (scope === 'month') {
      const t = monthText.trim()
      if (t) {
        if (t !== start.month && !set(t, { kind: 'month', month })) return false
      } else if (override && start.month !== '') clear()
    }
    return true
  }

  return {
    month, override, scope, setScope, always, setAlways, monthText, setMonthText, dirty, apply,
    error: submitted || touched ? problem : null,
    problem,
    touch: () => setTouched(true),
    submit: () => setSubmitted(true),
    resetToEveryMonth: () => { setScope('always'); setMonthText('') },
  }
}
export type LimitDraft = ReturnType<typeof useLimitDraft>

/** The amount box plus the two-way choice "Every month" / "Only Nov 2026", and the way back from a one-month limit. */
export function LimitField({ d, id, label, onUseEvery }: { d: LimitDraft; id: string; label: string; onUseEvery: () => void }) {
  const short = monthShortLabel(d.month)
  return (
    <>
      <div className="ffield">
        <span className="ffield__label">This limit applies to</span>
        <Segmented<Scope>
          label="This limit applies to"
          value={d.scope}
          onChange={d.setScope}
          options={[{ value: 'always', label: 'Every month' }, { value: 'month', label: `Only ${short}` }]}
        />
      </div>
      <FormField
        label={d.scope === 'always' ? `${label} (optional)` : `${label} for ${short} only (optional)`}
        htmlFor={id}
        error={d.error}
        hint={d.scope === 'always' ? 'Leave empty for no limit' : `Leave empty to keep the every-month limit for ${short}`}
      >
        <MoneyInput
          id={id}
          value={d.scope === 'always' ? d.always : d.monthText}
          onChange={d.scope === 'always' ? d.setAlways : d.setMonthText}
          invalid={!!d.error}
          describedBy={`${id}-msg`}
          onBlur={d.touch}
        />
      </FormField>
      {d.override && (
        <div className="limit__override">
          <p className="save__sum">{short} has its own limit.</p>
          <button type="button" className="link-btn" onClick={onUseEvery}>Use the every-month limit again</button>
        </div>
      )}
    </>
  )
}

/** The overall limit for all spending in a month. */
export function OverallLimitSheet({ month, onClose }: { month: string; onClose: () => void }) {
  const overall = useApp((s) => s.budget.overall)
  const byMonth = useApp((s) => s.budget.overallByMonth)
  const store = useAppStore()
  const { setOverallLimit, clearMonthLimit } = store.getState()
  const d = useLimitDraft(overall, byMonth, month)
  const [storeError, setStoreError] = useState<string | null>(null)
  const guard = useDiscardGuard(d.dirty, onClose)

  const save = () => {
    d.submit()
    if (d.problem) return focusField('overall-limit')
    if (d.apply(setOverallLimit, () => clearMonthLimit('overall', month))) return onClose()
    setStoreError(store.getState().notice?.text ?? 'Could not save this limit')
  }

  return (
    <Sheet
      title="Overall limit"
      onClose={guard.requestClose}
      footer={
        <GuardedFooter guard={guard} question="Discard your changes?">
          <button type="button" className="btn btn--primary" onClick={save}>Save</button>
        </GuardedFooter>
      }
    >
      <div className="save">
        <RequiredNote />
        {storeError && <p className="ffield__error" role="alert">{storeError}</p>}
        <p className="save__sum">One limit for everything you spend in a month.</p>
        <div className="save__card" style={tintStyle(7)}>
          <LimitField
            d={d}
            id="overall-limit"
            label="Overall limit in rupees"
            onUseEvery={() => { clearMonthLimit('overall', month); d.resetToEveryMonth() }}
          />
        </div>
      </div>
    </Sheet>
  )
}

/** "Available in: Every month | Only these months" and, for the second, a chip for each month to choose. */
export function AvailableIn({ value, onChange, options, defaultMonth, error, note }: {
  value: string[] | null
  onChange: (v: string[] | null) => void
  /** The months to offer, oldest first. */
  options: string[]
  /** What "Only these months" starts with. */
  defaultMonth: string
  error?: string | null
  note?: string
}) {
  const only = value !== null
  const toggle = (m: string) => onChange(value!.includes(m) ? value!.filter((x) => x !== m) : [...value!, m].sort())
  return (
    <div className="ffield" data-invalid={error ? '' : undefined}>
      <span className="ffield__label" id="avail-label">Available in</span>
      <Segmented<'all' | 'some'>
        label="Available in"
        value={only ? 'some' : 'all'}
        onChange={(v) => onChange(v === 'all' ? null : [options.includes(defaultMonth) ? defaultMonth : (options[0] ?? defaultMonth)])}
        options={[{ value: 'all', label: 'Every month' }, { value: 'some', label: 'Only these months' }]}
      />
      {only && (
        <div className="chips avail__chips" role="group" aria-label="Months" id="avail-months" tabIndex={-1}>
          {options.map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={value!.includes(m)} onClick={() => toggle(m)}>{monthShortLabel(m)}</button>
          ))}
        </div>
      )}
      {error ? <p className="ffield__error" id="avail-msg" role="alert">{error}</p> : note ? <p className="ffield__hint" id="avail-msg">{note}</p> : null}
    </div>
  )
}
