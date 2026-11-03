import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { FormField, RequiredNote } from '../../components/FormField'
import { useApp } from '../../components/StoreProvider'
import type { CardDraft } from '../../store/app'
import { DEFAULT_TAGS, type Reminder, type Repeat, type SavedCard } from '../../store/types'
import { cleanAfterDays, leadFields, leadsOf } from '../../lib/reminders'
import { Segmented, Toggle } from '../settings/controls'
import { AfterDone, LeadPills } from './ReminderOptions'

type Remind = 'off' | Repeat

const pad = (n: number) => String(n).padStart(2, '0')
const toDateInput = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** A due date is 9 in the morning, local time. */
const fromDateInput = (v: string) => {
  const [y, m, d] = v.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d, 9).getTime() : null
}

/**
 * The two-tap save: Save opens this with the title already filled; Done keeps it.
 * Tags, a note and a reminder are all optional.
 */
export function SaveSheet({
  draft,
  card,
  reminder,
  suggest,
  onClose,
  onSaved,
}: {
  draft: CardDraft
  /** When editing a card that already exists. */
  card?: SavedCard
  reminder?: Reminder
  /** A reminder rhythm to start with, from a smart suggestion. */
  suggest?: Repeat
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const saveCard = useApp((s) => s.saveCard)
  const updateCard = useApp((s) => s.updateCard)
  const known = useApp((s) => s.cards)

  const [title, setTitle] = useState(card?.title ?? draft.title)
  const [tags, setTags] = useState<string[]>(card?.tags ?? [])
  const [note, setNote] = useState(card?.note ?? '')
  const [remind, setRemind] = useState<Remind>(reminder ? reminder.repeat : suggest ?? 'off')
  const [date, setDate] = useState(toDateInput(reminder?.dueAt ?? Date.now() + 30 * 86_400_000))
  // Several heads-up times (a new reminder starts with 3 days), and "repeat N days after I tick it" (days as typed, null = off).
  const [leads, setLeads] = useState<number[]>(reminder ? leadsOf(reminder) : [3])
  const [after, setAfter] = useState<string | null>(reminder?.afterDays ? String(reminder.afterDays) : null)
  const [afterError, setAfterError] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)

  const allTags = [...new Set([...DEFAULT_TAGS, ...known.flatMap((c) => c.tags), ...tags])]
  const toggle = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))
  const addCustom = () => {
    const t = custom.trim().slice(0, 30)
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) setTags([...tags, t])
    setCustom('')
  }

  const dueAt = fromDateInput(date)
  const afterDays = after === null ? null : cleanAfterDays(after)
  const reminderDraft =
    remind === 'off' || dueAt === null ? null : { dueAt, repeat: remind, ...leadFields(leads), ...(afterDays ? { afterDays } : {}) }

  const done = () => {
    const cleanTitle = title.trim()
    if (!cleanTitle) return setTitleError('Give this a name')
    if (remind !== 'off' && dueAt === null) return
    if (remind !== 'off' && after !== null && afterDays === null) return setAfterError('Enter a number of days from 1 to 365')
    setTitleError(null)
    setAfterError(null)
    if (card) {
      updateCard(card.id, { title: cleanTitle, tags, note, inputs: draft.inputs, summary: draft.summary, amount: draft.amount, lines: draft.lines }, reminderDraft)
      onSaved(card.id)
    } else {
      const id = saveCard({ ...draft, title: cleanTitle, tags, note }, reminderDraft)
      if (id) onSaved(id)
    }
    onClose()
  }

  return (
    <Sheet title={card ? 'Update' : 'Save'} onClose={onClose} footer={<button type="button" className="btn btn--primary" onClick={done}>{card ? 'Update' : 'Save'}</button>}>
      <div className="save">
        <RequiredNote />
        <div className="save__card">
          <FormField label="Title" htmlFor="save-title" required error={titleError}>
            <input
              id="save-title"
              className="field"
              value={title}
              maxLength={120}
              aria-invalid={titleError ? true : undefined}
              aria-describedby={titleError ? 'save-title-msg' : undefined}
              onChange={(e) => {
                setTitle(e.target.value)
                if (titleError) setTitleError(null)
              }}
            />
          </FormField>
          {draft.summary && <p className="save__sum">{draft.summary}</p>}
        </div>

        <div className="save__card">
          <span className="field-label" id="save-tags">Tags</span>
          <div className="chips" role="group" aria-labelledby="save-tags">
            {allTags.map((t) => (
              <button key={t} type="button" className="chip" aria-pressed={tags.includes(t)} onClick={() => toggle(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="save__add">
            <input className="field" placeholder="Your own tag" aria-label="Add your own tag" value={custom} maxLength={30} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustom()} />
            <button type="button" className="btn" onClick={addCustom} disabled={!custom.trim()}>Add</button>
          </div>
        </div>

        <div className="save__card">
          <label className="field-label" htmlFor="save-note">Note</label>
          <textarea id="save-note" className="field" rows={2} value={note} maxLength={5000} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="save__card">
          <div className="save__switch">
            <span className="field-label" id="save-remind">Remind me</span>
            <Toggle label="Remind me" checked={remind !== 'off'} onChange={(on) => setRemind(on ? 'none' : 'off')} />
          </div>
          {remind !== 'off' && (
            <>
              <Segmented<Remind | 'after'>
                label="How often"
                value={after !== null ? 'after' : remind}
                onChange={(v) => {
                  if (v === 'after') return
                  setRemind(v)
                  setAfter(null)
                }}
                options={[
                  { value: 'none', label: 'Once' },
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'quarterly', label: 'Quarterly' },
                  { value: 'yearly', label: 'Yearly' },
                ]}
              />
              <div className="save__when">
                <label className="field-row">
                  <span className="field-label">{remind === 'none' ? 'Due on' : 'First due on'}</span>
                  <input className="field field--mono" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
              </div>
              <AfterDone days={after} onChange={(v) => { setAfter(v); setAfterError(null); if (v !== null) setRemind('none') }} error={afterError} idPrefix="save" />
              <LeadPills value={leads} onChange={setLeads} />
            </>
          )}
        </div>
      </div>
    </Sheet>
  )
}
