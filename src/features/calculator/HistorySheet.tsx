import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { useApp } from '../../components/StoreProvider'
import { formatExpression, formatPlain } from '../../lib/format'
import { isKept } from '../../store/types'
import { HistoryRowSheet } from './HistoryRowSheet'

export function HistorySheet() {
  const history = useApp((s) => s.history)
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const setOverlay = useApp((s) => s.setOverlay)
  const reuseExpression = useApp((s) => s.reuseExpression)
  const reuseResult = useApp((s) => s.reuseResult)
  const clearHistory = useApp((s) => s.clearHistory)

  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [rowId, setRowId] = useState<string | null>(null)
  const [lockedOnly, setLockedOnly] = useState(false)

  const fmt = { system, decimals }
  const armed = typed.trim().toUpperCase() === 'CLEAR'
  const clearable = history.filter((h) => !isKept(h)).length
  const lockedCount = history.filter((h) => h.locked).length
  const keptCount = history.length - clearable
  const shown = lockedOnly && lockedCount > 0 ? history.filter((h) => h.locked) : history

  const close = () => setOverlay('none')
  const cancelClear = () => {
    setConfirming(false)
    setTyped('')
  }

  // One sheet at a time (docs/FORMS-AND-SHEETS.md): the row menu takes this sheet's place, X returns here.
  if (rowId) return <HistoryRowSheet id={rowId} onClose={() => setRowId(null)} />

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
            Type CLEAR to remove {clearable} calculation{clearable === 1 ? '' : 's'}.
            {lockedCount > 0 ? ` ${lockedCount} locked ${lockedCount === 1 ? 'row is' : 'rows are'} kept.` : ''}
            {keptCount > lockedCount ? ' Named calculations are kept.' : ''} You will have a few seconds to undo.
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
        <>
          {lockedCount > 0 ? (
            <div className="chips hfilter" role="group" aria-label="Show">
              <button type="button" className="chip" aria-pressed={!lockedOnly} onClick={() => setLockedOnly(false)}>
                All
              </button>
              <button type="button" className="chip" aria-pressed={lockedOnly} onClick={() => setLockedOnly(true)}>
                Locked
              </button>
            </div>
          ) : null}
        <ul className="hlist">
          {shown.map((h) => {
            const expression = formatExpression(h.expression, system)
            const result = formatPlain(h.result, fmt)
            return (
              <li key={h.id} className="hrow">
                {h.memo || h.locked ? (
                  <span className="hrow__memo">
                    {h.locked ? <Icon name="lock" size={14} className="hrow__lock" /> : null}
                    {h.locked ? <span className="sr-only">Locked. </span> : null}
                    {h.memo}
                  </span>
                ) : null}
                <button type="button" className="hrow__expr" aria-label={`Use expression ${expression}`} onClick={() => reuseExpression(h.id)}>
                  {expression}
                </button>
                <button type="button" className="hrow__result" aria-label={`Use result ${result}`} onClick={() => reuseResult(h.id)}>
                  {result}
                </button>
                <span className="hrow__acts">
                  <button
                    type="button"
                    className="icon-btn hrow__more"
                    aria-label={`More for ${expression}`}
                    title="More"
                    onClick={() => setRowId(h.id)}
                  >
                    <Icon name="more" size={18} />
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
        </>
      )}
    </Sheet>
  )
}
