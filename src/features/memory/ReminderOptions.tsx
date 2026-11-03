import { useId } from 'react'
import { FormField } from '../../components/FormField'
import { leadLabel } from '../../lib/reminders'
import { Toggle } from '../settings/controls'

const LEAD_CHOICES = [0, 1, 3, 7, 14, 30]

/**
 * "Remind me": pills for how many days ahead, with "On the day" included. Pick one or more; each is its own
 * reminder. At least one stays picked, so a reminder always has a time.
 */
export function LeadPills({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const labelId = useId()
  const choices = [...new Set([...LEAD_CHOICES, ...value])].sort((a, b) => a - b)
  const toggle = (n: number) => {
    if (!value.includes(n)) return onChange([...value, n].sort((a, b) => b - a))
    if (value.length > 1) onChange(value.filter((x) => x !== n))
  }
  return (
    <div className="lead">
      <span className="field-label" id={labelId}>Remind me</span>
      <div className="chips" role="group" aria-labelledby={labelId}>
        {choices.map((n) => (
          <button key={n} type="button" className="chip" aria-pressed={value.includes(n)} onClick={() => toggle(n)}>
            {leadLabel(n)}
          </button>
        ))}
      </div>
      <p className="ffield__hint">Pick one or more. You get a reminder for each.</p>
    </div>
  )
}

/**
 * "Repeat after I tick it": the next date counts from the day the task is ticked off, not from the calendar.
 * `days` is the text in the box, or null when it is off.
 */
export function AfterDone({ days, onChange, error, idPrefix }: { days: string | null; onChange: (v: string | null) => void; error?: string | null; idPrefix: string }) {
  const on = days !== null
  const n = Number(days)
  return (
    <div className="afterdone">
      <div className="save__switch">
        <span className="field-label">Repeat after I tick it</span>
        <Toggle label="Repeat after I tick it" checked={on} onChange={(v) => onChange(v ? '30' : null)} />
      </div>
      {on && (
        <FormField
          label="Days after"
          htmlFor={`${idPrefix}-after`}
          error={error}
          hint={`The next date is ${Number.isInteger(n) && n > 0 ? `${n} ${n === 1 ? 'day' : 'days'}` : 'some days'} after the day you tick it, not a fixed calendar date.`}
        >
          <input
            id={`${idPrefix}-after`}
            className="field field--mono"
            inputMode="numeric"
            value={days}
            maxLength={3}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${idPrefix}-after-msg`}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 3))}
          />
        </FormField>
      )}
    </div>
  )
}
