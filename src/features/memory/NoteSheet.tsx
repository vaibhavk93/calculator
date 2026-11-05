import { useEffect, useRef, useState } from 'react'
import { FormField } from '../../components/FormField'
import { Sheet } from '../../components/Sheet'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { shareText } from '../../lib/share'
import { MAX_NOTE_BODY, MAX_NOTE_TAGS, MAX_PINNED, type SavedCard } from '../../lib/memory'
import { bodyLimitHint, noteShareText, validateNote } from '../../lib/notes'
import { Toggle } from '../settings/controls'
import { TagPicker } from './TagPicker'

/**
 * Write a plain note, or change one. A note is a saved card of kind 'text'; its words are the card's note field.
 * Only text: nothing typed here is ever read as maths. A title is optional (the first line is used). Leaving with
 * unsaved changes asks first, because a note is written, not picked, and cannot be rebuilt from a tap.
 */
export function NoteSheet({ card, onClose }: { card?: SavedCard; onClose: () => void }) {
  const saveCard = useApp((s) => s.saveCard)
  const updateCard = useApp((s) => s.updateCard)
  const deleteCard = useApp((s) => s.deleteCard)
  const togglePin = useApp((s) => s.togglePin)
  const toast = useApp((s) => s.toast)
  const cards = useApp((s) => s.cards)
  const store = useAppStore()

  const [title, setTitle] = useState(card?.title ?? '')
  const [body, setBody] = useState(card?.note ?? '')
  const [tags, setTags] = useState<string[]>(card?.tags ?? [])
  const [pinned, setPinned] = useState(card?.pinned ?? false)
  const [submitted, setSubmitted] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // A new note opens ready to type. Focus lands after the sheet has taken its own focus, or the keyboard may not open.
  useEffect(() => {
    if (card) return
    const t = setTimeout(() => bodyRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [card])

  const known = [...new Set([...cards.flatMap((c) => c.tags), ...tags])].sort()
  const checked = validateNote({ title, body, tags })
  const err = submitted ? checked.errors : {}
  const dirty = title !== (card?.title ?? '') || body !== (card?.note ?? '') || tags.join('\n') !== (card?.tags ?? []).join('\n') || pinned !== (card?.pinned ?? false)
  const requestClose = () => (dirty ? setAsking(true) : onClose())

  const save = () => {
    setSubmitted(true)
    if (checked.errors.body) return bodyRef.current?.focus()
    if (checked.errors.tags) return
    if (pinned && !card?.pinned && cards.filter((c) => c.pinned && c.deletedAt === null).length >= MAX_PINNED) {
      return setStoreError(`You can pin up to ${MAX_PINNED}. Unpin one first.`)
    }
    let id = card?.id ?? null
    if (card) updateCard(card.id, { title: checked.title, note: checked.body, tags, summary: checked.summary })
    else id = saveCard({ title: checked.title, kind: 'text', toolId: null, inputs: null, summary: checked.summary, amount: null, lines: [], note: checked.body, tags })
    // The card limit refused it: the store says why.
    if (!id) return setStoreError(store.getState().notice?.text ?? 'Could not save this note')
    if (pinned !== (card?.pinned ?? false)) togglePin(id)
    onClose()
  }

  const share = async () => {
    if (checked.errors.body) {
      setSubmitted(true)
      return bodyRef.current?.focus()
    }
    const r = await shareText(checked.title, noteShareText({ title: checked.title, note: checked.body }))
    if (r === 'copied') toast('Copied as text')
    else if (r === 'failed') toast("Couldn't share")
  }

  return (
    <Sheet
      title={card ? 'Note' : 'New note'}
      onClose={requestClose}
      footer={
        asking ? (
          <>
            <p className="note" role="alert" style={{ margin: 0 }}>Discard your changes? What you wrote will be lost.</p>
            <button type="button" className="btn btn--primary" autoFocus onClick={() => setAsking(false)}>Keep editing</button>
            <button type="button" className="btn btn--danger" onClick={onClose}>Discard</button>
          </>
        ) : (
          <button type="button" className="btn btn--primary" onClick={save}>Save</button>
        )
      }
    >
      <div className="save">
        <div className="save__card">
          <FormField label="Title" htmlFor="note-title" hint="Optional. Without one, the first line is the title.">
            <input id="note-title" className="field" value={title} maxLength={120} aria-describedby="note-title-msg" onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Note" htmlFor="note-body" error={err.body} hint={bodyLimitHint(body.length) ?? undefined}>
            <textarea
              id="note-body"
              ref={bodyRef}
              className="field"
              rows={8}
              value={body}
              maxLength={MAX_NOTE_BODY}
              aria-invalid={err.body ? true : undefined}
              aria-describedby={err.body || bodyLimitHint(body.length) ? 'note-body-msg' : undefined}
              onChange={(e) => setBody(e.target.value)}
            />
          </FormField>
        </div>

        <div className="save__card">
          <TagPicker known={known} tags={tags} onChange={setTags} limit={MAX_NOTE_TAGS} error={err.tags} idPrefix="note" />
          <div className="save__switch">
            <span className="field-label">Pin to the top</span>
            <Toggle label="Pin to the top" checked={pinned} onChange={(on) => { setPinned(on); setStoreError(null) }} />
          </div>
          {storeError && <p className="ffield__error" role="alert">{storeError}</p>}
        </div>

        <div className="note__acts">
          <button type="button" className="link-btn" onClick={() => void share()}>Share as text</button>
          {card && (
            <button type="button" className="link-btn link-btn--danger" onClick={() => { deleteCard(card.id); onClose() }}>
              Delete note
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
