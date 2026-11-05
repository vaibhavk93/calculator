import { useState, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { useApp } from '../../components/StoreProvider'
import type { EmptyRow } from '../../components/EmptyState'
import type { TourId } from '../../store/types'
import { TourSheet } from './TourSheet'
import { TOURS, type TryAction } from './tours'

/** The one dismissible line at the top of a tab on the first visit. Not a pop-up: it never covers the screen. */
function TourRow({ id, onOpen }: { id: TourId; onOpen: () => void }) {
  const tours = useApp((s) => s.settings.tours)
  const update = useApp((s) => s.updateSettings)
  const place = TOURS[id].place
  return (
    <div className="tourrow">
      <button type="button" className="tourrow__open" onClick={onOpen}>
        New here? See what you can do in {place} (1 minute)
      </button>
      <button type="button" className="icon-btn" aria-label={`Dismiss the ${place} tip`} title="Dismiss" onClick={() => update({ tours: { ...tours, [id]: 'skipped' } })}>
        <Icon name="close" size={18} />
      </button>
    </div>
  )
}

/**
 * Everything a tab needs for its tour. Put `row` at the top of the screen, `sheet` anywhere (it is drawn over everything),
 * and `empty` last in an empty state's `more` rows ("Take the tour", null until the row is gone, so there is never both).
 * `onTry` handles the "Try it" links; leave it out and the tour has none.
 */
export function useTour(id: TourId, onTry?: (a: TryAction) => void): { row: ReactNode; empty: EmptyRow | null; sheet: ReactNode; show: () => void } {
  const seen = useApp((s) => s.settings.tours[id])
  const [open, setOpen] = useState(false)
  const show = () => setOpen(true)
  return {
    show,
    row: seen ? null : <TourRow id={id} onOpen={show} />,
    empty: seen ? { label: 'Take the tour', onClick: show } : null,
    sheet: open ? <TourSheet tour={id} onClose={() => setOpen(false)} onTry={onTry} /> : null,
  }
}
