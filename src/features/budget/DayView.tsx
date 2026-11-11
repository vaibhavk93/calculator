import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { FormField } from '../../components/FormField'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Sheet } from '../../components/Sheet'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { useBackHandler } from '../../components/useBackHandler'
import { D } from '../../engine'
import { MAX_NOTE, SETTLEMENT_LABEL, categoryName, dayKey, type BudgetExpense } from '../../lib/budget'
import { dayTitle, dayView, draftWithNote, entryKind, routeLabel } from '../../lib/dayView'
import { GuardedFooter, focusField, useDiscardGuard } from './formKit'
import { ExpenseSheet } from './sheets'
import { FitHero, useMoney } from './SpendSummary'

/** What the row is called when it has no note: its category, or what kind of entry it is. */
const nameOf = (budget: Parameters<typeof categoryName>[0], e: BudgetExpense) => {
  const kind = entryKind(e)
  return kind === 'settlement' ? SETTLEMENT_LABEL[e.settlement!] : kind === 'income' ? 'Money in' : categoryName(budget, e.categoryId)
}

/** A tiny sheet with one field: the reason for an entry that has no note. Same rules as every form sheet (docs/FORMS-AND-SHEETS.md). */
function NoteSheet({ entry, summary, onClose }: { entry: BudgetExpense; summary: string; onClose: () => void }) {
  const update = useApp((s) => s.updateExpense)
  const store = useAppStore()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  const guard = useDiscardGuard(note.trim() !== '', onClose)
  useEffect(() => ref.current?.focus(), [])
  const save = () => {
    const text = note.trim()
    if (text === '') {
      setError('Type a note, or close this')
      return focusField('day-note')
    }
    if (update(entry.id, draftWithNote(entry, text))) return onClose()
    setError(store.getState().notice?.text ?? 'Could not save this note. Tap the entry to fix it')
  }
  return (
    <Sheet
      title="Add a note"
      onClose={guard.requestClose}
      footer={
        <GuardedFooter guard={guard} question="Discard this note?">
          <button type="button" className="btn btn--primary" onClick={save}>Save note</button>
        </GuardedFooter>
      }
    >
      <div className="save">
        <p className="budget__note">{summary}</p>
        <FormField label="Why was this?" htmlFor="day-note" error={error}>
          <input
            ref={ref}
            id="day-note"
            className="field"
            value={note}
            maxLength={MAX_NOTE}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'day-note-msg' : undefined}
            onChange={(e) => { setNote(e.target.value); setError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          />
        </FormField>
      </div>
    </Sheet>
  )
}

type SheetState = null | { edit: string | null }

/**
 * One day: what was spent, how it was paid, and every entry, in the order it was entered.
 * One bare hero (the day's spend, worked out like the month total), one quiet line of per-route subtotals, then a plain ruled list.
 * Nothing is stored for it: it is a view over the entries (src/lib/dayView.ts).
 */
export function DayView({ date, onBack }: { date: string; onBack: () => void }) {
  const budget = useApp((s) => s.budget)
  const money = useMoney()
  const [sheet, setSheet] = useState<SheetState>(null)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  useBackHandler(true, onBack)

  const v = useMemo(() => dayView(budget, date), [budget, date])
  const title = dayTitle(date)
  const isToday = date === dayKey(new Date())
  const noting = noteFor === null ? undefined : v.entries.find((e) => e.id === noteFor)
  const editing = sheet?.edit == null ? undefined : budget.expenses.find((e) => e.id === sheet.edit)

  const row = (e: BudgetExpense) => {
    const kind = entryKind(e)
    const amount = new D(e.amount)
    const name = nameOf(budget, e)
    const route = kind === 'spend' ? routeLabel(budget, e) : null
    const sign = kind === 'settlement' ? '' : kind === 'income' || e.refund ? '+' : '−'
    // With no note the title already IS the category, so the second line says only how it was paid.
    const parts = [e.note || kind === 'income' ? name : '', e.refund ? 'Refund' : '', kind === 'settlement' ? 'Not counted as spending' : ''].filter(Boolean)
    const spoken = `${e.refund ? 'refund of ' : ''}${money(amount)} ${name}${route ? `, ${route}` : ''}`
    return (
      <div key={e.id} className="day__item">
        <button type="button" className="budget__recent tap-row" aria-label={`Edit ${spoken}`} onClick={() => setSheet({ edit: e.id })}>
          <span className="row__text">
            <span className="row__label">{e.note || name}</span>
            {(parts.length > 0 || route) && (
              <span className="row__hint">
                {parts.join(' · ')}
                {parts.length > 0 && route ? ' ' : ''}
                {route && <span className="day__route">{route}</span>}
              </span>
            )}
          </span>
          <span className={kind === 'income' ? 'budget__amt budget__amt--in' : 'budget__amt'}>{sign}{money(amount)}</span>
        </button>
        {e.note === '' && (
          <button type="button" className="link-btn day__note" aria-label={`Add a note to ${spoken}`} onClick={() => setNoteFor(e.id)}>Add a note</button>
        )}
      </div>
    )
  }

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label={`Day: ${title}`}>
      <ScreenHeader title={title} onBack={onBack} />
      <div className="screen__body">
        {v.entries.length === 0 ? (
          <div className="day__empty">
            <p className="budget__none">Nothing was entered for {title}.</p>
          </div>
        ) : (
          <>
            <div className="budget__sum">
              <span className="result__label">{isToday ? 'Spent today' : 'Spent this day'}</span>
              {v.spent.isNegative() && <span className="budget__note">Refunds are more than what was spent</span>}
              <FitHero text={money(v.spent)} />
              {v.routes.length > 0 && (
                <p className="day__routes">
                  {v.routes.map((r, i) => (
                    <Fragment key={r.key}>
                      {i > 0 && ' · '}
                      <span className="day__routeitem">{r.label}{'\u00a0'}<span className="day__amt">{money(r.spent)}</span></span>
                    </Fragment>
                  ))}
                </p>
              )}
              {v.moneyIn.gt(0) && <p className="day__routes">Money in <span className="day__amt">{money(v.moneyIn)}</span> (not counted as spending)</p>}
            </div>
            <div className="group" aria-label={`Entries on ${title}`}>
              {v.entries.map(row)}
            </div>
          </>
        )}
        <div className="budget__add">
          <button type="button" className="btn btn--primary" onClick={() => setSheet({ edit: null })}>Add expense</button>
        </div>
      </div>
      {sheet !== null && (sheet.edit === null || editing) && (
        <ExpenseSheet expense={editing} prefill={editing ? undefined : { amount: '', note: '', date }} onClose={() => setSheet(null)} />
      )}
      {noting && <NoteSheet entry={noting} summary={`${money(new D(noting.amount))} · ${nameOf(budget, noting)}${entryKind(noting) === 'spend' ? ` · ${routeLabel(budget, noting)}` : ''}`} onClose={() => setNoteFor(null)} />}
    </div>
  )
}
