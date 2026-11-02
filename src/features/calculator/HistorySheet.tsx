import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { useApp } from '../../components/StoreProvider'
import { formatExpression, formatPlain } from '../../lib/format'
import { MAX_MEMO } from '../../store/types'

export function HistorySheet() {
  const history = useApp((s) => s.history)
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const setOverlay = useApp((s) => s.setOverlay)
  const reuseExpression = useApp((s) => s.reuseExpression)
  const reuseResult = useApp((s) => s.reuseResult)
  const renameHistory = useApp((s) => s.renameHistory)
  const deleteHistory = useApp((s) => s.deleteHistory)
  const clearHistory = useApp((s) => s.clearHistory)

  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const fmt = { system, decimals }
  const armed = typed.trim().toUpperCase() === 'CLEAR'
  const clearable = history.filter((h) => !h.memo).length

  const close = () => setOverlay('none')
  const cancelClear = () => {
    setConfirming(false)
    setTyped('')
  }
  const startEdit = (id: string, current: string | undefined) => {
    setEditingId(id)
    setDraft(current ?? '')
  }
  const saveEdit = () => {
    if (editingId) renameHistory(editingId, draft)
    setEditingId(null)
    setDraft('')
  }

  return (
    <Sheet
      title="History"
      onClose={close}
      action={
        clearable > 0 && !confirming ? (
          <button type="button" className="link-btn link-btn--danger" onClick={() => setConfirming(true)}>
            Clear all
          </button>
        ) : null
      }
    >
      {confirming ? (
        <form
          className="confirm"
          onSubmit={(e) => {
            e.preventDefault()
            if (!armed) return
            clearHistory()
            cancelClear()
          }}
        >
          <p>
            Type CLEAR to remove {clearable} calculation{clearable === 1 ? '' : 's'}. Named calculations are kept.
            You will have a few seconds to undo.
          </p>
          <input
            className="field"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-label="Type CLEAR to confirm"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
          />
          <div className="confirm__actions">
            <button type="button" className="btn" onClick={cancelClear}>
              Cancel
            </button>
            <button type="submit" className="btn btn--danger" disabled={!armed}>
              Clear history
            </button>
          </div>
        </form>
      ) : history.length === 0 ? (
        <p className="note" style={{ margin: 0 }}>
          Nothing here yet. Calculations you finish with = are kept here, and you can tap one to use it again.
        </p>
      ) : (
        <ul className="hlist">
          {history.map((h) => {
            const expression = formatExpression(h.expression, system)
            const result = formatPlain(h.result, fmt)
            const editing = editingId === h.id
            return (
              <li key={h.id} className="hrow">
                {editing ? (
                  <form
                    className="hrow__edit"
                    onSubmit={(e) => {
                      e.preventDefault()
                      saveEdit()
                    }}
                  >
                    <input
                      className="field"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value.slice(0, MAX_MEMO))}
                      aria-label={`Name for ${expression}`}
                      placeholder="Name this calculation"
                      autoFocus
                    />
                    <button type="button" className="btn" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn">
                      Save
                    </button>
                  </form>
                ) : (
                  <>
                    {h.memo ? <span className="hrow__memo">{h.memo}</span> : null}
                    <button type="button" className="hrow__expr" aria-label={`Use expression ${expression}`} onClick={() => reuseExpression(h.id)}>
                      {expression}
                    </button>
                    <button type="button" className="hrow__result" aria-label={`Use result ${result}`} onClick={() => reuseResult(h.id)}>
                      {result}
                    </button>
                    <span className="hrow__acts">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={h.memo ? `Rename ${expression}` : `Name ${expression}`}
                        onClick={() => startEdit(h.id, h.memo)}
                      >
                        <Icon name="edit" size={18} />
                      </button>
                      <button type="button" className="icon-btn" aria-label={`Delete ${expression}`} onClick={() => deleteHistory(h.id)}>
                        <Icon name="trash" size={18} />
                      </button>
                    </span>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
