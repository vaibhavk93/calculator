import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { useApp } from '../../components/StoreProvider'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useBackHandler } from '../../components/useBackHandler'
import { matchesCard, matchSnippet } from '../../lib/cardSearch'
import { dueLabel } from '../../lib/reminders'
import { groupTasks, taskItems, todayCount } from '../../lib/tasks'
import type { SavedCard } from '../../store/types'
import { AddSheet, type AddChoice } from './AddSheet'
import { CardView } from './CardView'
import { NoteSheet } from './NoteSheet'
import { TaskSheet } from './TaskSheet'
import { Segmented } from '../settings/controls'
import { TapeScreen } from './TapeScreen'
import { TodoScreen } from './TodoScreen'
import { useTour } from '../onboarding/useTour'

/** Which side of the Notes tab was last open. Kept while the app runs, forgotten on restart. */
let lastMode: 'notes' | 'todo' = 'notes'

type View = { kind: 'list' } | { kind: 'card'; id: string } | { kind: 'newTape' } | { kind: 'newNote' } | { kind: 'newTask' } | { kind: 'trash' }

export function SavedScreen() {
  const cards = useApp((s) => s.cards)
  const reminders = useApp((s) => s.reminders)
  const togglePin = useApp((s) => s.togglePin)
  const [view, setView] = useState<View>({ kind: 'list' })
  const [adding, setAdding] = useState(false)
  const [mode, setModeState] = useState(lastMode)
  const setMode = (m: 'notes' | 'todo') => {
    lastMode = m
    setModeState(m)
    setTag(null)
  }
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const cardView = useApp((s) => s.settings.notesCardView)
  const setCardView = useApp((s) => s.updateSettings)
  const tabTap = useApp((s) => s.tabTap)
  const openCard = useApp((s) => s.openCard)
  const showCard = useApp((s) => s.showCard)
  const setTab = useApp((s) => s.setTab)
  const tour = useTour('notes', (a) => {
    if (a === 'tools') setTab('tools')
    else if (a === 'new-list') (setMode('notes'), setView({ kind: 'newTape' }))
    else if (a === 'todo') setMode('todo')
  })

  // Tapping the Saved tab while on it closes whatever is open and clears the search.
  useEffect(() => {
    setView({ kind: 'list' })
    setAdding(false)
    setQuery('')
    setTag(null)
    setFilterOpen(false)
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
  // The Add sheet closes before the next screen opens, so two sheets are never open together.
  const choose = (c: AddChoice) => {
    setAdding(false)
    if (c === 'task') setMode('todo')
    else setMode('notes')
    setView({ kind: c === 'note' ? 'newNote' : c === 'list' ? 'newTape' : 'newTask' })
  }

  return (
    <div className="tools">
      {view.kind === 'list' && tour.row}
      <div className="saved__head">
        {/* The Notes/To-do switch below is this screen's own visible title; this just gives it a
            real heading for anyone navigating by headings, without a second, redundant title above it.
            A card, a new list or Trash stacks on top without unmounting this, each with its own h1. */}
        {view.kind === 'list' && <h1 className="sr-only">{mode === 'todo' ? 'To-do' : 'Notes'}</h1>}
        <Segmented
          label="Notes or To-do"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'notes', label: 'Notes' },
            { value: 'todo', label: openToday > 0 ? `To-do (${openToday})` : 'To-do' },
          ]}
        />
        <div className="saved__find">
          <input className="field" type="search" placeholder={mode === 'todo' ? 'Search tasks' : 'Search notes'} aria-label={mode === 'todo' ? 'Search tasks' : 'Search notes'} value={query} onChange={(e) => setQuery(e.target.value)} />
          {mode === 'notes' && (
            <button type="button" className="icon-btn" aria-pressed={cardView} aria-label={cardView ? 'Show as a list' : 'Show as cards'} title={cardView ? 'Show as a list' : 'Show as cards'} onClick={() => setCardView({ notesCardView: !cardView })}>
              <Icon name={cardView ? 'list' : 'grid'} size={20} />
            </button>
          )}
          {/* On To-do the composer under the switch is the add, so there is no second filled button here. */}
          {mode === 'notes' && (
            <button type="button" className="btn btn--primary saved__add" onClick={() => setAdding(true)}>
              <Icon name="plus" size={20} />
              <span>New</span>
            </button>
          )}
        </div>
        {trashed.length > 0 && (
          <div className="saved__actions">
            <button type="button" className="link-btn" onClick={() => setView({ kind: 'trash' })}>Trash ({trashed.length})</button>
          </div>
        )}
        {tags.length > 0 && tags.length <= 3 ? (
          <div className="chips" role="group" aria-label="Filter by tag">
            {tags.map((t) => (
              <button key={t} type="button" className="chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                {t}
              </button>
            ))}
          </div>
        ) : tags.length > 3 ? (
          <div className="chips" role="group" aria-label="Filter">
            <button type="button" className="icon-btn" aria-pressed={!!tag} aria-label={tag ? `Filter: ${tag}` : 'Filter by tag'} title="Filter by tag" onClick={() => setFilterOpen(true)}>
              <Icon name="filter" size={20} />
            </button>
            {tag && (
              <button type="button" className="chip" aria-pressed onClick={() => setTag(null)}>
                {tag}
              </button>
            )}
          </div>
        ) : null}
      </div>
      {filterOpen && (
        <Sheet title="Filter by tag" onClose={() => setFilterOpen(false)}>
          <div className="chips" role="group" aria-label="Tags">
            {tags.map((t) => (
              <button key={t} type="button" className="chip" aria-pressed={tag === t} onClick={() => { setTag(tag === t ? null : t); setFilterOpen(false) }}>
                {t}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {mode === 'todo' ? (
        <TodoScreen query={query} tag={tag} tourRow={tour.empty} />
      ) : live.length === 0 ? (
        <EmptyState title="No notes yet" level="h2" more={[tour.empty]}>
          Tap New to write a note or start a list. Press Save on any calculator to keep it here. Add a reminder and the Due tab will keep track.
        </EmptyState>
      ) : (
        <div className="tools__list">
          {/* Pinned first, then lists, then saved calculations: a hairline list per kind, no card, no
              tint (docs/THE-PLAN.md section 7) -- this was three equally-weighted tinted cards; the kind
              is still told apart by its own heading, not by colour. */}
          {[
            { title: 'Pinned', items: shown.filter((c) => c.pinned) },
            { title: 'Notes', items: shown.filter((c) => !c.pinned && c.kind === 'text') },
            { title: 'Lists', items: shown.filter((c) => !c.pinned && c.kind === 'tape') },
            { title: 'Calculations', items: shown.filter((c) => !c.pinned && c.kind === 'tool') },
          ]
            .filter((sec) => sec.items.length > 0)
            .map((sec) => (
              <div key={sec.title}>
                <h2 className="group__title">
                  <span>{sec.title}</span>
                  <span className="sect__count">{sec.items.length}</span>
                </h2>
                <div className={cardView ? 'card-grid' : 'group'} aria-label={sec.title}>
                  {sec.items.map((c) =>
                    cardView ? (
                      <CardTile key={c.id} card={c} found={matchSnippet(c, query)} due={reminders.find((r) => r.cardId === c.id && !r.done)?.dueAt} onOpen={() => setView({ kind: 'card', id: c.id })} onPin={() => togglePin(c.id)} />
                    ) : (
                      <CardRow key={c.id} card={c} found={matchSnippet(c, query)} due={reminders.find((r) => r.cardId === c.id && !r.done)?.dueAt} onOpen={() => setView({ kind: 'card', id: c.id })} onPin={() => togglePin(c.id)} />
                    ),
                  )}
                </div>
              </div>
            ))}
          {shown.length === 0 && <p className="tools__none">Nothing matches.</p>}
        </div>
      )}

      {open && <CardView card={open} onBack={back} />}
      {view.kind === 'newTape' && <TapeScreen onBack={back} />}
      {view.kind === 'newNote' && <NoteSheet onClose={back} />}
      {view.kind === 'newTask' && <TaskSheet onClose={back} />}
      {adding && <AddSheet onChoose={choose} onClose={() => setAdding(false)} />}
      {view.kind === 'trash' && <TrashScreen onBack={back} />}
      {tour.sheet}
    </div>
  )
}

function CardRow({ card, due, found, onOpen, onPin }: { card: SavedCard; due: number | undefined; found: string | null; onOpen: () => void; onPin: () => void }) {
  return (
    <div className="row row--split">
      <button type="button" className="row__main" onClick={onOpen}>
        <span className="row__label">{card.title}</span>
        <span className="row__hint">{card.summary || (card.kind === 'tape' ? 'Empty list' : '')}</span>
        {found && <span className="row__hint row__found">{found}</span>}
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

/** Same card, shown as a bordered tile in a 2-column grid instead of a hairline row. No tint: a border
    only (docs/DESIGN-SYSTEM.md's "where a tint may appear" keeps colour off plain content tiles). */
function CardTile({ card, due, found, onOpen, onPin }: { card: SavedCard; due: number | undefined; found: string | null; onOpen: () => void; onPin: () => void }) {
  return (
    <div className="item-card">
      <button type="button" className="item-card__main" onClick={onOpen}>
        <span className="row__label">{card.title}</span>
        <span className="row__hint">{card.summary || (card.kind === 'tape' ? 'Empty list' : '')}</span>
        {found && <span className="row__hint row__found">{found}</span>}
        {(card.tags.length > 0 || due !== undefined) && (
          <span className="row__hint">
            {[...card.tags, due !== undefined ? `Due ${dueLabel(due, Date.now()).toLowerCase()}` : ''].filter(Boolean).join(' · ')}
          </span>
        )}
      </button>
      <button
        type="button"
        className="icon-btn item-card__pin"
        aria-pressed={card.pinned}
        aria-label={card.pinned ? `Unpin ${card.title}` : `Pin ${card.title}`}
        onClick={onPin}
      >
        <Icon name={card.pinned ? 'pinFilled' : 'pin'} size={18} />
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
