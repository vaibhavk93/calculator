import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { matchesCard } from '../../lib/cardSearch'
import { dueLabel } from '../../lib/reminders'
import { groupTasks, shortDate, taskItems, taskSummary, validateTask, type TaskItem } from '../../lib/tasks'
import { Segmented } from '../settings/controls'
import { TaskSheet } from './TaskSheet'

type View = 'today' | 'upcoming' | 'all'

/** Overdue is the one section that earns a hue by meaning, as on the Due tab: a plain card with an alert heading. */
const OVERDUE = { '--tint': 'var(--surface)', '--tint-ink': 'var(--alert)' } as React.CSSProperties

/** The last view chosen, kept while the app runs and forgotten on restart. */
let lastView: View = 'today'

/**
 * To-do, inside the Notes tab. Today (due today and overdue), Upcoming (dated, later), All (with an undated Inbox).
 * Tick a task to finish it; tap its text to open it. `query` and `tag` come from the Notes search box.
 */
export function TodoScreen({ query, tag }: { query: string; tag: string | null }) {
  const cards = useApp((s) => s.cards)
  const reminders = useApp((s) => s.reminders)
  const tabTap = useApp((s) => s.tabTap)
  const setTaskDone = useApp((s) => s.setTaskDone)
  const clearDone = useApp((s) => s.clearDoneTasks)
  const store = useAppStore()
  const [view, setViewState] = useState<View>(lastView)
  const [sheet, setSheet] = useState<{ id: string | null } | null>(null)
  const [title, setTitle] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Tapping the Notes tab while on it closes an open task.
  useEffect(() => setSheet(null), [tabTap])

  const setView = (v: View) => {
    lastView = v
    setViewState(v)
  }

  const now = Date.now()
  const items = useMemo(() => taskItems(cards, reminders).filter((t) => (!tag || t.card.tags.includes(tag)) && matchesCard(t.card, query)), [cards, reminders, tag, query])
  const g = groupTasks(items, now)
  const total = cards.filter((c) => c.kind === 'task' && c.deletedAt === null).length
  const open = sheet?.id ? cards.find((c) => c.id === sheet.id && c.deletedAt === null) : undefined

  const add = () => {
    // In Today a new task is due today, so it shows where it was added. Elsewhere it goes to the undated Inbox.
    const date = view === 'today' ? new Date(now) : null
    const day = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : ''
    const r = validateTask({ title, date: day, repeat: 'none', tags: [] }, now)
    if (r.errors.title) return setAddError(r.errors.title)
    const id = store.getState().saveCard(
      { title: r.title, kind: 'task', toolId: null, inputs: null, summary: taskSummary(r.dueAt, 'none'), amount: null, lines: [] },
      r.dueAt === null ? null : { dueAt: r.dueAt, repeat: 'none', leadDays: 0 },
    )
    if (!id) return setAddError(store.getState().notice?.text ?? 'Could not add that task')
    setTitle('')
    setAddError(null)
  }

  const row = (t: TaskItem, overdue = false) => (
    <div className={t.done ? 'todo__row todo__row--done' : 'todo__row'} key={t.card.id}>
      <label className="tick-wrap">
        <input type="checkbox" className="tick" checked={t.done} aria-label={`${t.card.title}, done`} onChange={() => setTaskDone(t.card.id, !t.done)} />
      </label>
      <button type="button" className="todo__main" onClick={() => setSheet({ id: t.card.id })}>
        <span className="todo__text">
          <span className="row__label">{t.card.title}</span>
          <span className={overdue ? 'row__hint due__alert' : 'row__hint'}>{hint(t, now)}</span>
        </span>
        <span className="todo__chev" aria-hidden="true"><Icon name="chevron" size={18} /></span>
      </button>
    </div>
  )

  const section = (name: string, list: TaskItem[], tint: number, overdue = false) =>
    list.length > 0 && (
      <section className="sect" style={overdue ? OVERDUE : tintStyle(tint)} aria-label={name}>
        <h2 className="sect__head">
          <span>{name}</span>
          <span className="sect__count">{list.length}</span>
        </h2>
        <div className="sect__body">{list.map((t) => row(t, overdue))}</div>
      </section>
    )

  const body =
    view === 'today' ? [section('Overdue', g.overdue, 8, true), section('Today', g.today, 5)] : view === 'upcoming' ? [section('Upcoming', g.upcoming, 8)] : [section('No date', g.inbox, 4), section('Overdue', g.overdue, 8, true), section('Today', g.today, 5), section('Upcoming', g.upcoming, 8)]
  const anyShown = body.some(Boolean)

  return (
    <div className="todo">
      <form className="todo__add" onSubmit={(e) => { e.preventDefault(); add() }} noValidate>
        <div className="todo__addrow">
          <input
            className="field"
            aria-label="New task"
            placeholder={view === 'today' ? 'Add a task for today' : 'Add a task'}
            value={title}
            maxLength={120}
            enterKeyHint="done"
            aria-invalid={addError ? true : undefined}
            aria-describedby={addError ? 'todo-add-msg' : undefined}
            onChange={(e) => { setTitle(e.target.value); setAddError(null) }}
          />
          <button type="submit" className="btn btn--primary">Add</button>
        </div>
        {addError && <p className="tape__error" id="todo-add-msg" role="alert">{addError}</p>}
        <button type="button" className="link-btn todo__more" onClick={() => setSheet({ id: null })}>Add with a date, repeat or note</button>
      </form>

      <div className="todo__views">
        <Segmented
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      <div className="tools__list sections">
        {total === 0 ? (
          <EmptyState title="No tasks yet" level="h2">Write what needs doing in the box above. Give a task a date and it shows in Today and in the Due tab.</EmptyState>
        ) : (
          <>
            {body}
            {!anyShown && (
              <p className="tools__none">
                {query || tag ? 'Nothing matches.' : view === 'today' ? 'Nothing due today. Add a task, or look at All.' : view === 'upcoming' ? 'Nothing coming up. Give a task a date and it shows here.' : 'Nothing open. Everything is done.'}
              </p>
            )}
            {g.done.length > 0 && (
              <section className="sect todo__done" style={tintStyle(7)} aria-label="Done">
                <h2 className="sect__head todo__donehead">
                  <button type="button" className="todo__toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
                    <span>Done</span>
                    <span className="sect__count">{g.done.length}</span>
                    <span className={showDone ? 'todo__chev todo__chev--open' : 'todo__chev'} aria-hidden="true"><Icon name="chevron" size={18} /></span>
                  </button>
                </h2>
                {showDone && (
                  <div className="sect__body">
                    {g.done.map((t) => row(t))}
                    {confirming ? (
                      <div className="confirm todo__confirm" role="group" aria-label="Clear done tasks">
                        <p>Move {g.done.length} done {g.done.length === 1 ? 'task' : 'tasks'} to Trash? Trash keeps them for 7 days, and you can undo this.</p>
                        <div className="confirm__actions">
                          <button type="button" className="btn" onClick={() => setConfirming(false)}>Keep them</button>
                          <button type="button" className="btn btn--danger" onClick={() => { clearDone(); setConfirming(false) }}>Clear done</button>
                        </div>
                      </div>
                    ) : (
                      <div className="todo__clear-row">
                        <button type="button" className="link-btn link-btn--danger" onClick={() => setConfirming(true)}>Clear done</button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {sheet && (sheet.id === null || open) && <TaskSheet card={open} onClose={() => setSheet(null)} />}
    </div>
  )
}

/** "Today · 5 Nov 2026 · monthly · Home". Undated tasks say nothing about a date. */
function hint(t: TaskItem, now: number): string {
  const parts: string[] = []
  if (t.dueAt !== null) parts.push(`${dueLabel(t.dueAt, now)} · ${shortDate(t.dueAt)}`)
  if (t.reminder && t.reminder.repeat !== 'none') parts.push(t.reminder.repeat)
  if (t.card.pinned) parts.push('pinned')
  parts.push(...t.card.tags)
  return parts.join(' · ')
}
