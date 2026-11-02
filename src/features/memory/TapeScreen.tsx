import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { useApp } from '../../components/StoreProvider'
import { useBackHandler } from '../../components/useBackHandler'
import { D, toPlain } from '../../engine'
import { copyText } from '../../lib/device'
import { formatDecimal } from '../../lib/format'
import { listProgress, listSummary, parseTapeLine, tapeTotal } from '../../lib/tape'
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

  const lines: TapeLine[] = stored?.lines ?? []
  const opts = { system, decimals }
  const total = tapeTotal(lines)
  const checklist = !!stored?.checklist
  const progress = listProgress(lines)
  const money = (v: string) => formatCell(new D(v), 'money', opts)

  const persist = (next: TapeLine[], nextTitle = title) => {
    const t = tapeTotal(next)
    const patch = { title: nextTitle, lines: next, amount: toPlain(t), summary: listSummary(next, checklist, opts) }
    if (id) updateCard(id, patch)
    else {
      const created = saveCard({ ...patch, kind: 'tape', toolId: null, inputs: null })
      if (created) setId(created)
    }
  }

  const submit = () => {
    const r = parseTapeLine(text)
    if (!r.ok) return setError(r.error)
    const line: TapeLine = { id: editing ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, label: r.label, value: toPlain(r.value) }
    persist(editing ? lines.map((l) => (l.id === editing ? line : l)) : [...lines, line])
    setText('')
    setEditing(null)
    setError(null)
  }

  const copy = async () => {
    // For a checklist the text says who has paid, so it can go straight into a group chat.
    const mark = (l: TapeLine) => (checklist ? (l.done ? '✔ ' : '☐ ') : '')
    const body = lines.map((l) => `${mark(l)}${l.label || '—'}  ${money(l.value)}`)
    const foot = checklist
      ? [`Collected ${formatCell(progress.doneAmount, 'money', opts)} of ${formatCell(total, 'money', opts)}`, `Left ${formatCell(progress.leftAmount, 'money', opts)}`]
      : [`Total  ${formatCell(total, 'money', opts)}`]
    const ok = await copyText([`${title}`, ...body, ...foot].join('\n'))
    showNotice(ok ? 'Copied as text' : "Couldn't copy", ok ? 'info' : 'error')
  }

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="List">
      <div className="screen__bar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <Icon name="back" size={20} />
        </button>
        <input
          className="field screen__title-input"
          aria-label="List name"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => id && updateCard(id, { title: title.trim() || 'List' })}
        />
        {stored && (
          <button type="button" className="icon-btn" aria-label="Delete list" onClick={() => { deleteCard(stored.id); onBack() }}>
            <Icon name="trash" size={20} />
          </button>
        )}
      </div>

      <div className="screen__body tape">
        <div className="tape__total">
          <span className="result__label">
            {checklist && lines.length > 0 ? `${progress.done} of ${lines.length} done · ${formatCell(progress.leftAmount, 'money', opts)} left` : 'Total'}
          </span>
          <span className="tape__sum" aria-live="polite">
            {checklist && lines.length > 0 ? formatCell(progress.doneAmount, 'money', opts) : formatCell(total, 'money', opts)}
          </span>
        </div>
        {checklist && lines.length > 0 && <p className="tape__of">collected of {formatCell(total, 'money', opts)}</p>}

        {lines.length === 0 && <p className="result__note tape__hint">Type a label and an amount, like “Flights 24000”, then press Add.</p>}
        <ul className="tape__lines">
          {lines.map((l) => (
            <li key={l.id} className={l.done ? 'tape__line tape__line--done' : 'tape__line'}>
              {checklist && id && (
                <label className="tick-wrap">
                  <input type="checkbox" className="tick" checked={!!l.done} aria-label={`${l.label || 'Line'} done`} onChange={() => toggleLine(id, l.id)} />
                </label>
              )}
              <button
                type="button"
                className="tape__edit"
                aria-label={`Edit ${l.label || 'line'}`}
                onClick={() => { setEditing(l.id); setText(`${l.label} ${formatDecimal(new D(l.value), { system: 'international', decimals: 'auto' }).replace(/,/g, '').replace('−', '-')}`.trim()) }}
              >
                <span>{l.label || '—'}</span>
                <span className="result__value">{money(l.value)}</span>
              </button>
              <button type="button" className="icon-btn" aria-label={`Remove ${l.label || 'line'}`} onClick={() => persist(lines.filter((x) => x.id !== l.id))}>
                <Icon name="close" size={18} />
              </button>
            </li>
          ))}
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
        <div className="tape__row">
          <input className="field" aria-label="Label and amount" placeholder="Label and amount" value={text} onChange={(e) => { setText(e.target.value); setError(null) }} enterKeyHint="done" />
          <button type="submit" className="btn btn--primary">{editing ? 'Change' : 'Add'}</button>
        </div>
      </form>
    </div>
  )
}
