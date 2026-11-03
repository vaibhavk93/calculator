import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { useApp } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import type { TourId } from '../../store/types'
import { TourSheet } from './TourSheet'
import { TOUR_LIST } from './tours'

/** Settings: replay any tour, or bring the first-visit tip rows back. Same card look as the other Settings sections. */
export function TipsAndTours() {
  const [open, setOpen] = useState<TourId | null>(null)
  const update = useApp((s) => s.updateSettings)
  const toast = useApp((s) => s.toast)
  return (
    <section className="sect sect--settings" style={tintStyle(7)} aria-label="Tips and tours">
      <h2 className="sect__head">Tips and tours</h2>
      {TOUR_LIST.map((t) => (
        <button key={t.id} type="button" className="row row--button tap-row" onClick={() => setOpen(t.id)}>
          <span className="row__text">
            <span className="row__label">{t.place}</span>
            <span className="row__hint">{`A tour of ${t.steps.length} steps`}</span>
          </span>
          <Icon name="chevron" size={18} className="tap-row__chev" />
        </button>
      ))}
      <button type="button" className="row row--button tap-row" onClick={() => { update({ tours: {} }); toast('The tips will show again on each tab') }}>
        <span className="row__text">
          <span className="row__label">Show first-visit tips again</span>
          <span className="row__hint">Brings back the "New here?" line at the top of Budget, Notes and Due</span>
        </span>
        <Icon name="chevron" size={18} className="tap-row__chev" />
      </button>
      {open && <TourSheet tour={open} onClose={() => setOpen(null)} />}
    </section>
  )
}
