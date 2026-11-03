import { useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useApp } from '../../components/StoreProvider'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useBackHandler } from '../../components/useBackHandler'
import { D, toPlain } from '../../engine'
import { copyText } from '../../lib/device'
import { formatDecimal } from '../../lib/format'
import { LINE_STATE_WORD, lineState, listProgress, listSummary, MAX_PASTE_LINES, nextLineState, parsePastedList, parseTapeLine, tapeTotal, type PastedList } from '../../lib/tape'
import { formatCell } from '../../lib/toolFormat'
import type { SavedCard, TapeLine } from '../../store/types'
import { SaveSheet } from './SaveSheet'

/**
 * A running tally. Type "Flights 24000" and press Add; the total stays live. It is saved as you go,
 * so it can stay open for days. Tap a line to change it.
 */
export function TapeScreen({ card, onBack }: { card?: SavedCard; onBack: () => void }) {
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const saveCard = useApp((s) => s.saveCard)
  const updateCard = useApp((s) => s.updateCard)
  const deleteCard = useApp((s) => s.deleteCard)
  const showNotice = useApp((s) => s.showNotice)
  const toggleLine = useApp((s) => s.toggleLine)
  const setChecklist = useApp((s) => s.setChecklist)
  useBackHandler(true, onBack)

  const [id, setId] = useState<string | null>(card?.id ?? null)
  const stored = useApp((s) => s.cards.find((c) => c.id === id && c.deletedAt === null))
  const reminder = useApp((s) => s.reminders.find((r) => r.cardId === id))
  const [reminding, setReminding] = useState(false)
  const [title, setTitle] = useState(card?.title ?? 'List')
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Several lines pasted into the box: offered as checklist items instead of being squashed into one line.
  const [pasted, setPasted] = useState<PastedList | null>(null)
  // A line being renamed in place. `rename.current` is cleared on Enter/Escape so the blur that follows does not save twice.
  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null)
  const renameLive = useRef(false)

  const lines: TapeLine[] = stored?.lines ?? []
  const opts = { system, decimals }
  const total = tapeTotal(lines)
  const checklist = !!stored?.checklist
  const progress = listProgress(lines)
  const money = (v: string) => formatCell(new D(v), 'money', opts)

  /** Saves the lines. Returns the list's id (new or not), or null if it could not be made. */
  const persist = (next: TapeLine[], nextTitle = title): string | null => {
    const t = tapeTotal(next)
    const patch = { title: nextTitle, lines: next, amount: toPlain(t), summary: listSummary(next, checklist, opts) }
    if (id) {
      updateCard(id, patch)
      return id
    }
    const created = saveCard({ ...patch, kind: 'tape', toolId: null, inputs: null })
    if (created) setId(created)
    return created
  }

  const newLineId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

  const addPasted = () => {
    if (!pasted) return
    const added: TapeLine[] = pasted.items.map((i) => ({ id: newLineId(), label: i.label, value: i.value, ...(i.done ? { done: true } : {}) }))
    const cid = persist([...lines, ...added])
    if (cid) setChecklist(cid, true)
    setPasted(null)
    setText('')
    setError(null)
  }

  const finishRename = (save: boolean) => {
    if (!renameLive.current || !renaming) return
    renameLive.current = false
    const { id: lineId, text: label } = renaming
    setRenaming(null)
    if (save && lines.some((l) => l.id === lineId && l.label !== label.trim())) persist(lines.map((l) => (l.id === lineId ? { ...l, label: label.trim() } : l)))
  }

  const submit = () => {
    const r = parseTapeLine(text)
    if (!r.ok) return setError(r.error)
    // Editing a line keeps its ticked or skipped state.
    const kept = editing ? lines.find((l) => l.id === editing) : undefined
    const line: TapeLine = { id: editing ?? newLineId(), label: r.label, value: toPlain(r.value), ...(kept?.done ? { done: true } : kept?.skip ? { skip: true } : {}) }
    persist(editing ? lines.map((l) => (l.id === editing ? line : l)) : [...lines, line])
    setText('')
    setEditing(null)
    setError(null)
  }

  const copy = async () => {
    // For a checklist the text says who has paid, so it can go straight into a group chat.
    const mark = (l: TapeLine) => (checklist ? (l.done ? '✔ ' : l.skip ? '✖ ' : '☐ ') : '')
    const body = lines.map((l) => `${mark(l)}${l.label || '—'}  ${money(l.value)}${checklist && l.skip && !l.done ? '  (skipped)' : ''}`)
    const foot = checklist
      ? [
          `Collected ${formatCell(progress.doneAmount, 'money', opts)} of ${formatCell(total, 'money', opts)}`,
          `Left ${formatCell(progress.leftAmount, 'money', opts)}`,
          ...(progress.skipped > 0 ? [`Skipped ${progress.skipped}, not counted`] : []),
        ]
      : [`Total  ${formatCell(total, 'money', opts)}`]
    const ok = await copyText([`${title}`, ...body, ...foot].join('\n'))
    showNotice(ok ? 'Copied as text' : "Couldn't copy", ok ? 'info' : 'error')
  }

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="List">
      <ScreenHeader
        title={title}
        onBack={onBack}
        titleSlot={
          <input
            className="field screen__title-input"
            aria-label="List name"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => id && updateCard(id, { title: title.trim() || 'List' })}
          />
        }
        icons={
          stored && (
            <button type="button" className="icon-btn" aria-label={`Delete ${stored.title}`} onClick={() => { deleteCard(stored.id); onBack() }}>
              <Icon name="trash" size={20} />
            </button>
          )
        }
      />

      <div className="screen__body tape">
        <div className="tape__total">
          <span className="result__label">
            {checklist && lines.length > 0 ? `${progress.done} of ${progress.total} done · ${formatCell(progress.leftAmount, 'money', opts)} left` : 'Total'}
          </span>
          <span className="tape__sum" aria-live="polite">
            {checklist && lines.length > 0 ? formatCell(progress.doneAmount, 'money', opts) : formatCell(total, 'money', opts)}
          </span>
        </div>
        {checklist && lines.length > 0 && (
          <p className="tape__of">
            collected of {formatCell(total, 'money', opts)}
            {progress.skipped > 0 ? ` · ${progress.skipped} skipped, not counted` : ''}
          </p>
        )}

        {lines.length === 0 && <p className="result__note tape__hint">Type a label and an amount, like “Flights 24000”, then press Add.</p>}
        <ul className="tape__lines">
          {lines.map((l) => {
            const st = lineState(l)
            const name = l.label || 'line'
            return (
              <li key={l.id} className={`tape__line${st === 'paid' ? ' tape__line--done' : ''}${st === 'skip' ? ' tape__line--skip' : ''}`}>
                {checklist && id && (
                  <button
                    type="button"
                    className="tri"
                    data-state={st}
                    aria-label={`${name}: ${LINE_STATE_WORD[st].toLowerCase()}. Tap to change to ${LINE_STATE_WORD[nextLineState(st)].toLowerCase()}`}
                    onClick={() => toggleLine(id, l.id)}
                  >
                    {LINE_STATE_WORD[st]}
                  </button>
                )}
                {renaming?.id === l.id ? (
                  <input
                    className="field tape__rename"
                    aria-label={`Rename ${name}`}
                    value={renaming.text}
                    maxLength={80}
                    enterKeyHint="done"
                    autoFocus
                    onChange={(e) => setRenaming({ id: l.id, text: e.target.value })}
                    onBlur={() => finishRename(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.preventDefault(), finishRename(true))
                      else if (e.key === 'Escape') (e.stopPropagation(), finishRename(false))
                    }}
                  />
                ) : (
                  <button type="button" className="tape__name" aria-label={`Rename ${name}`} onClick={() => { renameLive.current = true; setRenaming({ id: l.id, text: l.label }) }}>
                    <span className="tape__label">{l.label || '—'}</span>
                    {!checklist && st === 'skip' && <span className="tape__skipword">Skipped</span>}
                    <Icon name="edit" size={14} className="tape__pencil" />
                  </button>
                )}
                <button
                  type="button"
                  className="tape__amt"
                  aria-label={`Edit ${name}`}
                  onClick={() => { setEditing(l.id); setText(`${l.label} ${formatDecimal(new D(l.value), { system: 'international', decimals: 'auto' }).replace(/,/g, '').replace('−', '-')}`.trim()) }}
                >
                  <span className="result__value">{money(l.value)}</span>
                </button>
                <button type="button" className="icon-btn" aria-label={`Remove ${name}`} onClick={() => persist(lines.filter((x) => x.id !== l.id))}>
                  <Icon name="close" size={18} />
                </button>
              </li>
            )
          })}
        </ul>
        {lines.length > 0 && (
          <div className="tape__tools">
            <button type="button" className="link-btn" onClick={() => setReminding(true)}>
              {reminder && !reminder.done ? 'Change reminder' : 'Remind me'}
            </button>
            {id && (
              <button type="button" className="link-btn" onClick={() => setChecklist(id, !checklist)}>
                {checklist ? 'Hide checkboxes' : 'Show checkboxes'}
              </button>
            )}
            <button type="button" className="link-btn" onClick={copy}>
              Copy as text
            </button>
          </div>
        )}
      </div>

      {reminding && stored && (
        <SaveSheet
          draft={{ title: stored.title, kind: 'tape', toolId: null, inputs: null, summary: stored.summary, amount: stored.amount, lines: stored.lines }}
          card={stored}
          reminder={reminder}
          onClose={() => setReminding(false)}
          onSaved={() => {}}
        />
      )}

      <form className="tape__bar" onSubmit={(e) => { e.preventDefault(); submit() }}>
        {error && <p className="tape__error" role="alert">{error}</p>}
        {pasted && (
          <div className="tape__offer" role="status">
            <p>
              Found {pasted.items.length} lines in what you pasted.
              {pasted.dropped > 0 ? ` Only the first ${MAX_PASTE_LINES} will be used.` : ''}
            </p>
            <div className="tape__offer-acts">
              <button type="button" className="btn btn--primary" onClick={addPasted}>Add {pasted.items.length} lines as checklist items</button>
              <button type="button" className="link-btn" onClick={() => setPasted(null)}>Not now</button>
            </div>
          </div>
        )}
        <div className="tape__row">
          <input
            className="field"
            aria-label="Label and amount"
            placeholder="Label and amount"
            value={text}
            onChange={(e) => { setText(e.target.value); setError(null) }}
            onPaste={(e) => {
              const list = parsePastedList(e.clipboardData.getData('text'))
              if (!list) return
              e.preventDefault()
              setPasted(list)
              setError(null)
            }}
            enterKeyHint="done"
          />
          <button type="submit" className="btn btn--primary">{editing ? 'Change' : 'Add'}</button>
        </div>
      </form>
    </div>
  )
}
