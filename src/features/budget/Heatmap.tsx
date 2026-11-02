import { useMemo } from 'react'
import { dailyTotals, dayKey, dayLongLabel, monthWeeks, type BudgetData, type DayTotal, type Filter } from '../../lib/budget'
import type { Dec } from '../../engine'

const LEVELS: DayTotal['level'][] = [0, 1, 2, 3, 4]
const entriesWord = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`

/** Mon to Sun in the phone's language, from a Monday in 2026. */
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(2026, 5, 1 + i)))

/**
 * A grid of the month, one cell for each day, Monday first. The shade says how much was spent that day compared with the
 * month's biggest day (five steps, neutral greys, never the accent and never red or green). The day number and the spoken
 * label carry the same facts, so shade is never the only signal. Tapping a past or present day picks it.
 */
export function Heatmap({ budget, month, filter, selected, onPick, money, today = new Date() }: {
  budget: BudgetData
  month: string
  filter: Filter
  selected: string | null
  onPick: (date: string) => void
  money: (v: Dec) => string
  today?: Date
}) {
  const totals = useMemo(() => dailyTotals(budget, month, filter), [budget, month, filter])
  const weeks = useMemo(() => monthWeeks(month), [month])
  const todayKey = dayKey(today)

  return (
    <div className="heat">
      <p className="heat__hint">Tap a day to see what you spent on it.</p>
      <div className="heat__grid" role="group" aria-label="Spending by day">
        {WEEKDAYS.map((d, i) => <span key={i} className="heat__dow" aria-hidden="true">{d}</span>)}
        {weeks.flat().map((day, i) => {
          if (day === null) return <span key={`s${i}`} className="heat__slot" aria-hidden="true" />
          const t = totals[day - 1]!
          if (t.date > todayKey) return <span key={t.date} className="heat__cell heat__cell--future">{day}</span>
          const label = t.count === 0 ? `${dayLongLabel(t.date)}: nothing spent` : `${dayLongLabel(t.date)}: ${money(t.spent)}, ${entriesWord(t.count)}`
          return (
            <button key={t.date} type="button" className={`heat__cell heat__cell--${t.level}`} aria-label={label} title={label} aria-pressed={selected === t.date} onClick={() => onPick(t.date)}>
              {day}
            </button>
          )
        })}
      </div>
      <div className="heat__legend" aria-hidden="true">
        <span>Less</span>
        {LEVELS.map((l) => <span key={l} className={`heat__swatch heat__cell--${l}`} />)}
        <span>More</span>
      </div>
    </div>
  )
}
