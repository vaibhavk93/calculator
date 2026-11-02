import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useBackHandler } from './useBackHandler'

interface SheetProps {
  title: string
  onClose: () => void
  /** A small secondary action beside the close button, such as "Clear all". Never the main action. */
  action?: ReactNode
  /** The one main action ("Add expense", "Save"), pinned to the bottom edge. See docs/FORMS-AND-SHEETS.md. */
  footer?: ReactNode
  children: ReactNode
}

/**
 * A bottom sheet. The title is on the left and a close button (X) on the right, so the sheet never needs
 * the system back button to leave. The main action lives in the footer, where the thumb already is.
 * Closes on Escape and on a tap outside it, moves focus in when it opens and back to where it was when it closes.
 */
export function Sheet({ title, onClose, action, footer, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  // The phone's back button closes this sheet and nothing else. It is never the only way out: the X does the same.
  useBackHandler(true, () => closeRef.current())

  useEffect(() => {
    // Return focus to the opener afterwards, but only if it still holds focus now, which is true
    // when a keyboard user opened this. A tap leaves nothing focused, so there is nothing to restore.
    const opener = document.activeElement as HTMLElement | null
    const previous = opener && opener !== document.body ? opener : null
    ref.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [])

  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="sheet__grab" aria-hidden="true" />
        <div className="sheet__head">
          <h2 className="sheet__title" id={titleId}>
            {title}
          </h2>
          {action}
          <button type="button" className="icon-btn sheet__close" aria-label={`Close ${title}`} onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </div>
    </>
  )
}
