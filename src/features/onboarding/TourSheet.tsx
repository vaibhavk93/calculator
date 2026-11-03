import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { useApp } from '../../components/StoreProvider'
import type { TourId } from '../../store/types'
import { TOURS, type TryAction } from './tours'

/**
 * A short guided tour in a sheet: one step at a time, "Step 2 of 6", Back and Next (Done on the last step).
 * X closes at any time and loses nothing. `onTry` is given only when the tour can open the screen a step talks about.
 */
export function TourSheet({ tour: id, onClose, onTry }: { tour: TourId; onClose: () => void; onTry?: (a: TryAction) => void }) {
  const tour = TOURS[id]
  const tours = useApp((s) => s.settings.tours)
  const update = useApp((s) => s.updateSettings)
  const [i, setI] = useState(0)
  const step = tour.steps[i]!
  const last = i === tour.steps.length - 1
  const n = tour.steps.length

  // Finishing counts as done. Closing early counts as skipped, but never takes a finished tour back.
  const finish = (how: 'done' | 'skipped') => {
    if (how === 'done' || !tours[id]) update({ tours: { ...tours, [id]: how } })
    onClose()
  }

  return (
    <Sheet
      title={tour.title}
      onClose={() => finish('skipped')}
      footer={
        <>
          <button type="button" className="btn btn--primary" onClick={() => (last ? finish('done') : setI(i + 1))}>
            {last ? 'Done' : 'Next'}
          </button>
          {/* Hidden (not removed) on step 1, so the footer keeps its height from step to step. */}
          <button type="button" className="link-btn tour__back" style={i === 0 ? { visibility: 'hidden' } : undefined} onClick={() => setI(i - 1)}>
            Back
          </button>
        </>
      }
    >
      <div className="tour">
        <div className="tour__track" role="progressbar" aria-label="Tour progress" aria-valuemin={1} aria-valuemax={n} aria-valuenow={i + 1} aria-valuetext={`Step ${i + 1} of ${n}`}>
          <div className="tour__fill" style={{ width: `${((i + 1) / n) * 100}%` }} />
        </div>
        {/* Polite live region: a screen reader reads the new step when Next or Back is pressed. */}
        <div className="tour__step" aria-live="polite" aria-atomic="true">
          <p className="tour__count">{`Step ${i + 1} of ${n}`}</p>
          <h3 className="tour__heading">{step.heading}</h3>
          <p className="tour__text">{step.text}</p>
        </div>
        {step.try && onTry && (
          <button type="button" className="link-btn tour__try" onClick={() => { const a = step.try!.action; finish('skipped'); onTry(a) }}>
            {step.try.label}
          </button>
        )}
      </div>
    </Sheet>
  )
}
