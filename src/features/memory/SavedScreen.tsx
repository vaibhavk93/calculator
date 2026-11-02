import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { useApp } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useBackHandler } from '../../components/useBackHandler'
import { matchesCard } from '../../lib/cardSearch'
import { dueLabel } from '../../lib/reminders'
import { groupTasks, taskItems, todayCount } from '../../lib/tasks'
import type { SavedCard } from '../../store/types'
import { CardView } from './CardView'
import { Segmented } from '../settings/controls'
import { TapeScreen } from './TapeScreen'
import { TodoScreen } from './TodoScreen'

/** Which side of the Notes tab was last open. Kept while the app runs, forgotten on restart. */
let lastMode: 'notes' | 'todo' = 'notes'

type View = { kind: 'list' } | { kind: 'card'; id: string } | { kind: 'newTape' } | { kind: 'trash' }

export function SavedScreen() {
  const cards = useApp((s) => s.cards)
  const reminders = useApp((s) => s.reminders)
  const togglePin = useApp((s) => s.togglePin)
  const setTab = useApp((s) => s.setTab)
  const [view, setView] = useState<View>({ kind: 'list' })
  const [mode, setModeState] = useState(lastMode)
  const setMode = (m: 'notes' | 'todo') => {
    lastMode = m
    setModeState(m)
    setTag(null)
  }
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const tabTap = useApp((s) => s.tabTap)
  const openCard = useApp((s) => s.openCard)
  const showCard = useApp((s) => s.showCard)

  // Tapping the Saved tab while on it closes whatever is open and clears the search.
  useEffect(() => {
    setView({ kind: 'list' })
    setQuery('')
    setTag(null)
  }, [tabTap])

  // "Add to a list" sends the user here with the new list open.
  useEffect(() => {
    if (!openCard) return
    setView({ kind: 'card', id: openCard })
    setMode(cards.find((c) => c.id === openCard)?.kind === 'task' ? 'todo' : 'notes')
    showCard(null)
  }, [openCard, showCard])

  // Tasks live on the To-do side; every card is Notes or To-do, never both.
  const live = useMemo(() => cards.filter((c) => c.deletedAt === null && (c.kind === 'task') === (mode === 'todo')), [cards, mode])
  const openToday = useMemo(() => todayCount(groupTasks(taskItems(cards, reminders), Date.now())), [cards, reminders])
  const trashed = cards.filter((c) => c.deletedAt !== null)
  const tags = useMemo(() => [...new Set(live.flatMap((c) => c.tags))].sort(), [live])
  const shown = live
    .filter((c) => (!tag || c.tags.includes(tag)) && matchesCard(c, query))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)

  const open = view.kind === 'card' ? live.find((c) => c.id === view.id) : undefined
  const back = () => setView({ kind: 'list' })

  return (
    <div className="tools">
      <div className="saved__head">
        <Segmented
          label="Notes or To-do"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'notes', label: 'Notes' },
            { value: 'todo', label: openToday > 0 ? `To-do (${openToday})` : 'To-do' },
          ]}
        />
        <input className="field" type="search" placeholder={mode === 'todo' ? 'Search tasks' : 'Search notes'} aria-label={mode === 'todo' ? 'Search tasks' : 'Search notes'} value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="saved__actions">
          {mode === 'notes' && <button type="button" className="link-btn" onClick={() => setView({ kind: 'newTape' })}>New list</button>}
          {trashed.length > 0 && (
            <button type="button" className="link-btn" onClick={() => setView({ kind: 'trash' })}>Trash ({trashed.length})</button>
          )}
        </div>
        {tags.length > 0 && (
          <div className="chips" role="group" aria-label="Filter by tag">
            {tags.map((t) => (
              <button key={t} type="button" className="chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === 'todo' ? (
        <TodoScreen query={query} tag={tag} />
      ) : live.length === 0 ? (
        <EmptyState
          title="No notes yet"
          action={<button type="button" className="btn btn--primary" onClick={() => setTab('tools')}>Open calculators</button>}
        >
          Press Save on any calculator, or start a list for a running total. Add a reminder and the Due tab will keep track.
        </EmptyState>
      ) : (
        <div className="tools__list sections">
          {/* Pinned first, then lists, then saved calculations: three cards you can tell apart at a glance. */}
          {[
            { title: 'Pinned', tint: 4, items: shown.filter((c) => c.pinned) },
            { title: 'Lists', tint: 5, items: shown.filter((c) => !c.pinned && c.kind === 'tape') },
            { title: 'Calculations', tint: 3, items: shown.filter((c) => !c.pinned && c.kind !== 'tape') },
          ]
            .filter((sec) => sec.items.length > 0)
            .map((sec) => (
              <section className="sect" key={sec.title} style={tintStyle(sec.tint)} aria-label={sec.title}>
                <h2 className="sect__head">
                  <span>{sec.title}</span>
                  <span className="sect__count">{sec.items.length}</span>
                </h2>
                <div className="sect__body">
                  {sec.items.map((c) => (
                    <CardRow key={c.id} card={c} due={reminders.find((r) => r.cardId === c.id && !r.done)?.dueAt} onOpen={() => setView({ kind: 'card', id: c.id })} onPin={() => togglePin(c.id)} />
                  ))}
                </div>
              </section>
            ))}
          {shown.length === 0 && <p className="tools__none">Nothing matches.</p>}
        </div>
      )}

      {open && <CardView card={open} onBack={back} />}
      {view.kind === 'newTape' && <TapeScreen onBack={back} />}
      {view.kind === 'trash' && <TrashScreen onBack={back} />}
    </div>
  )
}

function CardRow({ card, due, onOpen, onPin }: { card: SavedCard; due: number | undefined; onOpen: () => void; onPin: () => void }) {
  return (
    <div className="row row--split">
      <button type="button" className="row__main" onClick={onOpen}>
        <span className="row__label">{card.title}</span>
        <span className="row__hint">{card.summary || (card.kind === 'tape' ? 'Empty list' : '')}</span>
        {(card.tags.length > 0 || due !== undefined) && (
          <span className="row__hint">
            {[...card.tags, due !== undefined ? `Due ${dueLabel(due, Date.now()).toLowerCase()}` : ''].filter(Boolean).join(' · ')}
          </span>
        )}
      </button>
      <button
        type="button"
        className="icon-btn row__pin"
        aria-pressed={card.pinned}
        aria-label={card.pinned ? `Unpin ${card.title}` : `Pin ${card.title}`}
        onClick={onPin}
      >
        <Icon name={card.pinned ? 'pinFilled' : 'pin'} size={20} />
      </button>
    </div>
  )
}

function TrashScreen({ onBack }: { onBack: () => void }) {
  useBackHandler(true, onBack)
  const cards = useApp((s) => s.cards.filter((c) => c.deletedAt !== null))
  const restore = useApp((s) => s.restoreCard)
  const empty = useApp((s) => s.emptyTrash)
  const [asking, setAsking] = useState(false)
  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="Trash">
      <ScreenHeader
        title="Trash"
        onBack={onBack}
        action={
          cards.length > 0 && !asking && (
            <button type="button" className="link-btn link-btn--danger" onClick={() => setAsking(true)}>
              Empty Trash
            </button>
          )
        }
      />
      <div className="screen__body">
        <p className="result__note tape__hint">Deleted items stay here for 7 days, then go for good.</p>
        {asking && cards.length > 0 && (
          <div className="confirm todo__confirm" role="group" aria-label="Empty Trash">
            <p>Empty Trash? This deletes {cards.length} {cards.length === 1 ? 'item' : 'items'} for good. You cannot undo it.</p>
            <div className="confirm__actions">
              <button type="button" className="btn" autoFocus onClick={() => setAsking(false)}>Keep them</button>
              <button type="button" className="btn btn--danger" onClick={() => { empty(); onBack() }}>Empty Trash</button>
            </div>
          </div>
        )}
        <div className="group">
          {cards.map((c) => (
            <div className="row" key={c.id}>
              <span className="row__text">
                <span className="row__label">{c.title}</span>
                <span className="row__hint">{c.summary}</span>
              </span>
              <button type="button" className="link-btn" onClick={() => { restore(c.id); if (cards.length === 1) onBack() }}>Restore</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
