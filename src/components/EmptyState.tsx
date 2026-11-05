import type { ReactNode } from 'react'
import { Icon } from './Icon'

/** One quiet way onward from an empty screen: a row with a chevron, like "More in Budget". */
export type EmptyRow = { label: string; onClick: () => void }

/**
 * An empty screen that says what goes here and offers a way forward. Never just "nothing here".
 * `action` is the ONE filled primary button. `more` are the other ways onward, drawn as one hairline list of
 * rows (put "Take the tour" last; `null` entries are skipped, so `tour.empty` can be passed as is).
 * `level` is 'h1' (default) when this IS the whole screen (Due, Budget with nothing in it yet); pass
 * 'h2' when it sits inside a screen that already has its own h1 (Notes and To-do, under the segmented
 * switch), so a screen reader's heading list never shows two h1s for one screen.
 */
export function EmptyState({ title, children, action, more, level = 'h1' }: { title: string; children: ReactNode; action?: ReactNode; more?: (EmptyRow | null)[]; level?: 'h1' | 'h2' }) {
  const Heading = level
  const rows = (more ?? []).filter((r): r is EmptyRow => r !== null)
  return (
    <div className="empty">
      <Heading>{title}</Heading>
      <p>{children}</p>
      {action}
      {rows.length > 0 && (
        <div className="group">
          {rows.map((r) => (
            <button key={r.label} type="button" className="navrow tap-row" onClick={r.onClick}>
              <span className="navrow__label">{r.label}</span>
              <Icon name="chevron" size={18} className="navrow__chev" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
