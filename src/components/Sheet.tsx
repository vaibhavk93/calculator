import { useEffect, useId, useRef, type ReactNode } from 'react'

interface SheetProps {
  title: string
  onClose: () => void
  /** Sits on the right of the title row. */
  action?: ReactNode
  children: ReactNode
}

/**
 * A bottom sheet. Closes on Escape and on a tap outside it, moves focus in when
 * it opens and back to where it was when it closes.
 */
export function Sheet({ title, onClose, action, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose

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
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </>
  )
}
