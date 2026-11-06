import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useApp } from '../../components/StoreProvider'
import { useBackHandler } from '../../components/useBackHandler'
import { tabOn } from '../../lib/modules'
import type { TourId } from '../../store/types'
import { TourSheet } from './TourSheet'
import { TOUR_LIST } from './tours'

const TOUR_TAB: Record<TourId, string> = { budget: 'budget', notes: 'saved', due: 'due' }

/** Settings > Tips and tours: replay any tour, or bring the first-visit tip rows back. A full screen with a visible Back. */
export function TipsAndToursScreen({ onBack }: { onBack: () => void }) {
  useBackHandler(true, onBack)
  const [open, setOpen] = useState<TourId | null>(null)
  const update = useApp((s) => s.updateSettings)
  const toast = useApp((s) => s.toast)
  const settings = useApp((s) => s.settings)
  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="Tips and tours">
      <ScreenHeader title="Tips and tours" onBack={onBack} />
      <div className="screen__body">
        <section className="sect sect--settings" aria-label="Tips and tours">
          <h2 className="sect__head">Replay</h2>
          {TOUR_LIST.filter((t) => tabOn(settings, TOUR_TAB[t.id])).map((t) => (
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
        </section>
      </div>
      {open && <TourSheet tour={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
