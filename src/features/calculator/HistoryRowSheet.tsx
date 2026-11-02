import { useState, type ReactNode } from 'react'
import { useCopyAs } from '../../components/CopyAs'
import { FormField } from '../../components/FormField'
import { Icon, type IconName } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { useApp } from '../../components/StoreProvider'
import { formatExpression, formatPlain } from '../../lib/format'
import { historyShareText } from '../../lib/historyText'
import { shareText } from '../../lib/share'
import { MAX_MEMO } from '../../store/types'

type Mode = 'menu' | 'name' | 'edit'

function Item({ icon, label, hint, onClick, danger, disabled }: { icon: IconName; label: string; hint?: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" className={`hmenu__item${danger ? ' hmenu__item--danger' : ''}`} onClick={onClick} disabled={disabled}>
      <span className="hmenu__text">
        <span className="hmenu__label">{label}</span>
        {hint ? <span className="hmenu__hint">{hint}</span> : null}
      </span>
      <Icon name={icon} size={18} />
    </button>
  )
}

/** What you can do with one history row. Opens from the "more" button on the row. */
export function HistoryRowSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const entry = useApp((s) => s.history.find((h) => h.id === id))
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const reuseExpression = useApp((s) => s.reuseExpression)
  const reuseResult = useApp((s) => s.reuseResult)
  const renameHistory = useApp((s) => s.renameHistory)
  const editHistoryExpression = useApp((s) => s.editHistoryExpression)
  const setHistoryLocked = useApp((s) => s.setHistoryLocked)
  const deleteHistory = useApp((s) => s.deleteHistory)
  const showNotice = useApp((s) => s.showNotice)
  const { copy, sheet: copySheet } = useCopyAs()

  const [mode, setMode] = useState<Mode>('menu')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!entry) return null
  const fmt = { system, decimals }
  const expression = formatExpression(entry.expression, system)
  const result = formatPlain(entry.result, fmt)

  const begin = (m: Mode) => {
    setDraft(m === 'name' ? (entry.memo ?? '') : entry.expression)
    setError(null)
    setMode(m)
  }
  const save = () => {
    if (mode === 'name') {
      renameHistory(id, draft)
      return setMode('menu')
    }
    const err = editHistoryExpression(id, draft)
    if (err) return setError(err)
    setMode('menu')
  }
  const share = async () => {
    const r = await shareText('Calculation', historyShareText(entry, fmt))
    if (r === 'copied') showNotice('Copied')
    else if (r === 'failed') showNotice("Couldn't share", 'error')
    if (r !== 'cancelled') onClose()
  }

  if (mode !== 'menu') {
    const naming = mode === 'name'
    return (
      <Sheet
        title={naming ? 'Name' : 'Edit expression'}
        onClose={() => setMode('menu')}
        footer={
          <button type="button" className="btn btn--primary" onClick={save}>
            Save
          </button>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <FormField
            label={naming ? 'Name' : 'Expression'}
            htmlFor="hrow-field"
            error={error}
            hint={naming ? 'Named calculations are kept when you clear history.' : 'The answer is worked out again when you save.'}
          >
            <input
              id="hrow-field"
              className="field hrow__input"
              value={draft}
              onChange={(e) => {
                setDraft(naming ? e.target.value.slice(0, MAX_MEMO) : e.target.value)
                setError(null)
              }}
              aria-describedby="hrow-field-msg"
              aria-invalid={error ? true : undefined}
              placeholder={naming ? 'Name this calculation' : undefined}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
          </FormField>
        </form>
      </Sheet>
    )
  }

  return (
    <>
      <Sheet
        title="Calculation"
        onClose={onClose}
        footer={
          <button type="button" className="btn btn--primary" onClick={() => reuseExpression(id)}>
            Use expression
          </button>
        }
      >
        <div className="hmenu__summary">
          {entry.memo ? <span className="hrow__memo">{entry.memo}</span> : null}
          <span className="hmenu__expr">{expression}</span>
          <span className="hmenu__result">{result}</span>
        </div>
        <div className="hmenu">
          <Item icon="chevron" label="Use result" onClick={() => reuseResult(id)} />
          <Item icon="edit" label={entry.memo ? 'Rename' : 'Name'} onClick={() => begin('name')} />
          <Item icon="edit" label="Edit expression" hint="The answer is worked out again" onClick={() => begin('edit')} />
          <Item
            icon="lock"
            label={entry.locked ? 'Unlock' : 'Lock'}
            hint={entry.locked ? 'Locked rows stay when you clear history' : 'Keep this when you clear history'}
            onClick={() => setHistoryLocked(id, !entry.locked)}
          />
          <Item icon="share" label="Share" onClick={() => void share()} />
          <Item icon="copy" label="Copy" hint="Expression and answer" onClick={() => void copy(historyShareText(entry, fmt), `${entry.expression} = ${entry.result}`)} />
          <Item
            icon="trash"
            label="Delete"
            hint={entry.locked ? 'Unlock it first' : undefined}
            danger
            disabled={entry.locked}
            onClick={() => {
              deleteHistory(id)
              onClose()
            }}
          />
        </div>
      </Sheet>
      {copySheet}
    </>
  )
}
