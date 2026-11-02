import { useEffect } from 'react'
import { useApp } from './StoreProvider'

const VISIBLE_MS = 6000

/** A flat bar above the tab bar. Disappears on its own after six seconds. */
export function SnackBar() {
  const snack = useApp((s) => s.snack)
  const undo = useApp((s) => s.undoRemoval)
  const dismiss = useApp((s) => s.dismissSnack)

  useEffect(() => {
    if (!snack) return
    const t = setTimeout(() => dismiss(snack.id), VISIBLE_MS)
    return () => clearTimeout(t)
  }, [snack, dismiss])

  if (!snack) return null
  return (
    <div className="snack" role="status">
      <span>{snack.text}</span>
      {snack.canUndo && (
        <button type="button" className="link-btn" onClick={undo}>
          Undo
        </button>
      )}
    </div>
  )
}
