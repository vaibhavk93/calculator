import { EmptyState } from '../../components/EmptyState'
import { useApp } from '../../components/StoreProvider'

/** Honest placeholders for tabs whose features arrive in later builds. No fake data. */
export function ToolsPlaceholder() {
  const setTab = useApp((s) => s.setTab)
  return (
    <EmptyState
      title="More calculators are coming"
      action={
        <button type="button" className="btn btn--primary" onClick={() => setTab('calculate')}>
          Back to the calculator
        </button>
      }
    >
      Everyday converters come next, then loans and EMI, investments and tax. For now, this is the calculator.
    </EmptyState>
  )
}

export function SavedPlaceholder() {
  const setOverlay = useApp((s) => s.setOverlay)
  return (
    <EmptyState
      title="Nothing saved yet"
      action={
        <button type="button" className="btn btn--primary" onClick={() => setOverlay('history')}>
          Open history
        </button>
      }
    >
      Saving a calculation with a note is coming. Until then, everything you finish with = is kept in history.
    </EmptyState>
  )
}

export function DuePlaceholder() {
  const setTab = useApp((s) => s.setTab)
  return (
    <EmptyState
      title="No reminders yet"
      action={
        <button type="button" className="btn btn--primary" onClick={() => setTab('calculate')}>
          Back to the calculator
        </button>
      }
    >
      Bill and EMI reminders arrive once saving does. They will work with no account and no internet.
    </EmptyState>
  )
}
