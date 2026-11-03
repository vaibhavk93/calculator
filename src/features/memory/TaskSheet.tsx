import { useState } from 'react'
import { FormField, RequiredNote } from '../../components/FormField'
import { Sheet } from '../../components/Sheet'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { MAX_PINNED, MAX_TASK_TAGS, MAX_TASK_TITLE, type Repeat, type SavedCard } from '../../lib/memory'
import { leadFields, leadsOf, timeLabel } from '../../lib/reminders'
import { dayText, hasErrors, taskSummary, validateTask } from '../../lib/tasks'
import { Segmented, Toggle } from '../settings/controls'
import { AfterDone, LeadPills } from './ReminderOptions'

/**
 * Add a task, or change one. A task is a saved card; its date is an ordinary reminder, so the Due tab and
 * notifications see it too. Only the title is required. Errors appear under the field, in words, after Save is pressed.
 */
export function TaskSheet({ card, onClose }: { card?: SavedCard; onClose: () => void }) {
  const saveCard = useApp((s) => s.saveCard)
  const updateCard = useApp((s) => s.updateCard)
  const deleteCard = useApp((s) => s.deleteCard)
  const togglePin = useApp((s) => s.togglePin)
  const cards = useApp((s) => s.cards)
  const reminderTime = useApp((s) => s.settings.reminderTime)
  const reminder = useApp((s) => (card ? s.reminders.find((r) => r.cardId === card.id) : undefined))

  const [title, setTitle] = useState(card?.title ?? '')
  const [note, setNote] = useState(card?.note ?? '')
  const [date, setDate] = useState(reminder ? dayText(reminder.dueAt) : '')
  const [repeat, setRepeat] = useState<Repeat>(reminder?.repeat ?? 'none')
  // "Repeat N days after I tick it": the days as typed, or null when off. Several heads-up times, biggest first.
  const [after, setAfter] = useState<string | null>(reminder?.afterDays ? String(reminder.afterDays) : null)
  const [leads, setLeads] = useState<number[]>(reminder ? leadsOf(reminder) : [0])
  const [tags, setTags] = useState<string[]>(card?.tags ?? [])
  const [pinned, setPinned] = useState(card?.pinned ?? false)
  const [custom, setCustom] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)
  const store = useAppStore()

  const known = [...new Set([...cards.flatMap((c) => c.tags), ...tags])].sort()
  const checked = validateTask({ title, date, repeat, afterDays: after, tags }, Date.now())
  const err = submitted ? checked.errors : {}

  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))
  const addCustom = () => {
    const t = custom.trim().slice(0, 30)
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) setTags([...tags, t])
    setCustom('')
  }

  const save = () => {
    setSubmitted(true)
    if (hasErrors(checked.errors)) return
    if (pinned && !card?.pinned && cards.filter((c) => c.pinned && c.deletedAt === null).length >= MAX_PINNED) {
      return setStoreError(`You can pin up to ${MAX_PINNED}. Unpin one first.`)
    }
    const { dueAt } = checked
    const { afterDays } = checked
    const summary = taskSummary(dueAt, repeat, afterDays)
    // Pass a reminder only when the date, repeat or heads-up times changed, so editing a note never re-opens a finished one.
    const sameLeads = reminder !== undefined && leadsOf(reminder).join() === [...leads].sort((a, b) => b - a).join()
    const changed =
      (dueAt === null) !== (reminder === undefined) ||
      (dueAt !== null && reminder !== undefined && (reminder.dueAt !== dueAt || reminder.repeat !== repeat || (reminder.afterDays ?? null) !== afterDays || !sameLeads))
    const draft = dueAt === null ? null : { dueAt, repeat, ...leadFields(leads), ...(afterDays ? { afterDays } : {}) }
    let id = card?.id ?? null
    if (card) updateCard(card.id, { title: checked.title, note, tags, summary }, changed ? draft : undefined)
    else id = saveCard({ title: checked.title, kind: 'task', toolId: null, inputs: null, summary, amount: null, lines: [], note, tags }, draft)
    // The card limit refused it: the store says why.
    if (!id) return setStoreError(store.getState().notice?.text ?? 'Could not save this task')
    if (pinned !== (card?.pinned ?? false)) togglePin(id)
    onClose()
  }

  return (
    <Sheet title={card ? 'Task' : 'New task'} onClose={onClose} footer={<button type="button" className="btn btn--primary" onClick={save}>Save</button>}>
      <div className="save">
        <RequiredNote />
        <div className="save__card">
          <FormField label="Title" htmlFor="task-title" required error={err.title}>
            <input
              id="task-title"
              className="field"
              value={title}
              maxLength={MAX_TASK_TITLE}
              aria-required="true"
              aria-invalid={err.title ? true : undefined}
              aria-describedby={err.title ? 'task-title-msg' : undefined}
              onChange={(e) => setTitle(e.target.value)}
            />
          </FormField>
          <FormField label="Note" htmlFor="task-note">
            <textarea id="task-note" className="field" rows={2} value={note} maxLength={5000} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </div>

        <div className="save__card">
          <FormField label="Due date" htmlFor="task-date" error={err.date} hint={`Optional. Reminders come at ${timeLabel(reminderTime)} on that day.`}>
            <input
              id="task-date"
              className="field field--mono field--date"
              type="date"
              min="2000-01-01"
              value={date}
              aria-invalid={err.date ? true : undefined}
              aria-describedby="task-date-msg"
              onChange={(e) => setDate(e.target.value)}
            />
          </FormField>
          {date && (
            <button type="button" className="link-btn todo__clear" onClick={() => { setDate(''); setRepeat('none'); setAfter(null) }}>
              Clear date
            </button>
          )}
          <div className="ffield" data-invalid={err.repeat ? '' : undefined}>
            <span className="ffield__label" id="task-repeat-label">Repeat</span>
            <Segmented<Repeat | 'after'>
              label="Repeat"
              value={after !== null ? 'after' : repeat}
              onChange={(v) => {
                if (v === 'after') return
                setRepeat(v)
                setAfter(null)
              }}
              options={[
                { value: 'none', label: 'Never' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'yearly', label: 'Yearly' },
              ]}
            />
            {err.repeat && <p className="ffield__error" role="alert">{err.repeat}</p>}
          </div>
          <AfterDone days={after} onChange={(v) => { setAfter(v); if (v !== null) setRepeat('none') }} error={err.afterDays} idPrefix="task" />
          {date && <LeadPills value={leads} onChange={setLeads} />}
        </div>

        <div className="save__card">
          <span className="field-label" id="task-tags">Tags</span>
          <div className="chips" role="group" aria-labelledby="task-tags">
            {known.map((t) => (
              <button key={t} type="button" className="chip" aria-pressed={tags.includes(t)} onClick={() => toggleTag(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="save__add">
            <input className="field" placeholder="Your own tag" aria-label="Add your own tag" value={custom} maxLength={30} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustom()} />
            <button type="button" className="btn" onClick={addCustom}>Add tag</button>
          </div>
          <p className={err.tags ? 'ffield__error' : 'ffield__hint'} role={err.tags ? 'alert' : undefined}>{err.tags ?? `Up to ${MAX_TASK_TAGS} tags.`}</p>
          <div className="save__switch">
            <span className="field-label">Pin to the top</span>
            <Toggle label="Pin to the top" checked={pinned} onChange={(on) => { setPinned(on); setStoreError(null) }} />
          </div>
          {storeError && <p className="ffield__error" role="alert">{storeError}</p>}
        </div>

        {card && (
          <button type="button" className="link-btn link-btn--danger todo__delete" onClick={() => { deleteCard(card.id); onClose() }}>
            Delete task
          </button>
        )}
      </div>
    </Sheet>
  )
}
