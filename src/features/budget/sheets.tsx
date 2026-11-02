import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FormField, RequiredNote } from '../../components/FormField'
import { PickerSelect, type PickOption } from '../../components/PickerSelect'
import { Sheet } from '../../components/Sheet'
import { tintStyle } from '../../components/tint'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { useBackHandler } from '../../components/useBackHandler'
import {
  PAYMENT_MODES,
  categoryName,
  dayKey,
  eligibleInstruments,
  instrumentLabel,
  networkLabel,
  paymentError,
  suggestFor,
  validateCategoryName,
  validateExpense,
  validateInstrumentDraft,
  type BudgetExpense,
  type ExpenseErrors,
  type InstrumentKind,
  type PaymentModeId,
} from '../../lib/budget'

/** Keep digits and one dot. The store checks the rest and says what to fix. */
export const cleanMoney = (v: string) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 16)

/** Moves focus to a field by id and scrolls it into view, for the first bad field after a failed press. */
export function focusField(id: string) {
  const el = document.getElementById(id)
  el?.focus()
  el?.scrollIntoView?.({ block: 'center' })
}

/**
 * A form sheet that asks before it throws away typed values. X, the scrim, Escape and Android back all go through
 * `requestClose`: a clean form closes at once, a dirty one asks first, and back from the question means "Keep editing".
 */
export function useDiscardGuard(dirty: boolean, onClose: () => void) {
  const [asking, setAsking] = useState(false)
  const requestClose = () => {
    if (asking) setAsking(false)
    else if (dirty) setAsking(true)
    else onClose()
  }
  useBackHandler(true, requestClose)
  return { asking, requestClose, keep: () => setAsking(false), discard: onClose }
}

/** The sheet footer: the one main action, or (after a close on a dirty form) the question "Discard ...?" with its two answers. */
export function GuardedFooter({ guard, question, children }: { guard: ReturnType<typeof useDiscardGuard>; question: string; children: ReactNode }) {
  const keepRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (guard.asking) keepRef.current?.focus()
  }, [guard.asking])
  if (!guard.asking) return <>{children}</>
  return (
    <div className="expense__discard" role="group" aria-label={question}>
      <p className="expense__ask">{question}</p>
      <button ref={keepRef} type="button" className="btn btn--primary" onClick={guard.keep}>Keep editing</button>
      <button type="button" className="btn btn--danger" onClick={guard.discard}>Discard</button>
    </div>
  )
}

function MoneyField({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="field-row">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="field-wrap">
        <span className="field-unit" aria-hidden="true">₹</span>
        <input id={id} className="field field--mono" inputMode="decimal" autoComplete="off" placeholder={placeholder} value={value} onChange={(e) => onChange(cleanMoney(e.target.value))} />
      </div>
    </div>
  )
}

const KIND_FOR_MODE: Record<PaymentModeId, InstrumentKind | null> = { cash: null, upi: 'bank', credit: 'credit', debit: 'debit', netbanking: 'bank', wallet: 'wallet' }
const INSTRUMENT_NOUN: Record<InstrumentKind, string> = { credit: 'card', debit: 'card', bank: 'account', wallet: 'wallet' }
const UPI_HINT = 'A bank account, a debit card, a wallet or a RuPay credit card'

type Field = keyof ExpenseErrors
const FIELD_ID: Record<Field, string> = { amount: 'exp-amount', date: 'exp-date', category: 'exp-cat', paidWith: 'exp-inst' }

/**
 * Add or edit one entry. Checked when the field is left (after it was touched) and when Add or Save is pressed;
 * the button is never disabled. The store checks again before it saves.
 */
export function ExpenseSheet({ expense, onClose }: { expense?: BudgetExpense; onClose: () => void }) {
  const budget = useApp((s) => s.budget)
  const add = useApp((s) => s.addExpense)
  const update = useApp((s) => s.updateExpense)
  const remove = useApp((s) => s.deleteExpense)
  const addCategory = useApp((s) => s.addCategory)
  const addInstrument = useApp((s) => s.addInstrument)
  const store = useAppStore()

  // A category or card that was deleted since this entry was saved starts as "none", so editing never trips over it.
  const [start] = useState(() => ({
    amount: expense?.amount ?? '',
    date: expense?.date ?? dayKey(new Date()),
    categoryId: expense && !validateExpense({ ...expense, amount: '1' }, budget).category ? expense.categoryId : null,
    mode: expense?.mode ?? null,
    instrumentId: expense && paymentError(budget, expense.mode, expense.instrumentId) === null ? expense.instrumentId : null,
    note: expense?.note ?? '',
  }))
  const [amount, setAmount] = useState(start.amount)
  const [date, setDate] = useState(start.date)
  const [categoryId, setCategoryId] = useState<string | null>(start.categoryId)
  const [mode, setMode] = useState<PaymentModeId | null>(start.mode)
  const [instrumentId, setInstrumentId] = useState<string | null>(start.instrumentId)
  const [note, setNote] = useState(start.note)
  // Category and mode pre-fill from an earlier entry with the same note, until the user picks one themselves.
  const [picked, setPicked] = useState(expense !== undefined)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)

  const amountRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!expense) amountRef.current?.focus()
  }, [expense])

  const dirty = amount !== start.amount || date !== start.date || categoryId !== start.categoryId || mode !== start.mode || instrumentId !== start.instrumentId || note !== start.note
  const guard = useDiscardGuard(dirty, onClose)

  const errors = validateExpense({ amount, date, categoryId, mode, instrumentId }, budget)
  const shown = (f: Field) => (submitted || touched[f] ? errors[f] : undefined)
  const touch = (f: Field) => () => setTouched((t) => ({ ...t, [f]: true }))
  const aria = (f: Field, hint = false) => ({
    'aria-invalid': shown(f) ? (true as const) : undefined,
    'aria-describedby': shown(f) || hint ? `${FIELD_ID[f]}-msg` : undefined,
  })

  const submit = () => {
    setSubmitted(true)
    const first = (['amount', 'date', 'category', 'paidWith'] as Field[]).find((f) => errors[f])
    if (first) return focusField(first === 'paidWith' && mode === null ? 'exp-mode' : FIELD_ID[first])
    const draft = { amount, categoryId, mode, instrumentId, date, note: note.trim() }
    if (expense ? update(expense.id, draft) : add(draft)) return onClose()
    setStoreError(store.getState().notice?.text ?? 'Could not save this entry')
  }

  const changeNote = (v: string) => {
    setNote(v)
    const hit = picked ? null : suggestFor(budget, v)
    if (hit) {
      setCategoryId(hit.categoryId)
      setMode(hit.mode)
      setInstrumentId(hit.instrumentId)
    }
  }
  const chooseCategory = (v: string) => {
    setCategoryId(v === '' ? null : v)
    setPicked(true)
  }
  const chooseMode = (m: PaymentModeId) => {
    const next = mode === m ? null : m
    setMode(next)
    if (instrumentId !== null && paymentError(budget, next, instrumentId) !== null) setInstrumentId(null)
    setPicked(true)
  }

  const categoryOptions = useMemo<PickOption[]>(() => {
    const live = budget.categories.filter((c) => c.deletedAt === null)
    const out: PickOption[] = [{ value: '', label: 'Uncategorised' }]
    for (const top of live.filter((c) => c.parentId === null)) {
      out.push({ value: top.id, label: top.name })
      for (const sub of live.filter((c) => c.parentId === top.id)) out.push({ value: sub.id, label: categoryName(budget, sub.id) })
    }
    return out
  }, [budget])
  // A name that already exists is selected, not refused.
  const checkNewCategory = (name: string) =>
    budget.categories.some((c) => c.deletedAt === null && c.parentId === null && c.name.toLowerCase() === name.toLowerCase()) ? null : validateCategoryName(name, budget, null)

  const kind = mode === null ? null : KIND_FOR_MODE[mode]
  const instruments = eligibleInstruments(budget, mode)
  const instrumentOptions: PickOption[] = [
    { value: '', label: 'None' },
    ...instruments.map((i) => ({ value: i.id, label: instrumentLabel(i), hint: [i.network ? networkLabel(i.network) : '', i.bank].filter(Boolean).join(' · ') || undefined })),
  ]
  const noun = kind ? INSTRUMENT_NOUN[kind] : ''

  return (
    <Sheet
      title={expense ? 'Edit expense' : 'Add expense'}
      onClose={guard.requestClose}
      footer={
        <GuardedFooter guard={guard} question="Discard this expense?">
          <button type="button" className="btn btn--primary" onClick={submit}>{expense ? 'Save changes' : 'Add expense'}</button>
        </GuardedFooter>
      }
    >
      <div className="save">
        <RequiredNote />
        {storeError && <p className="ffield__error" role="alert">{storeError}</p>}
        <div className="save__card" style={tintStyle(7)}>
          <FormField label="Amount in rupees" htmlFor="exp-amount" required error={shown('amount')}>
            <div className="field-wrap">
              <span className="field-unit" aria-hidden="true">₹</span>
              <input
                ref={amountRef}
                id="exp-amount"
                className="field field--mono"
                inputMode="decimal"
                autoComplete="off"
                aria-required="true"
                value={amount}
                onChange={(e) => setAmount(cleanMoney(e.target.value))}
                onBlur={touch('amount')}
                {...aria('amount')}
              />
            </div>
          </FormField>
          <FormField label="Date" htmlFor="exp-date" required error={shown('date')}>
            <input id="exp-date" className="field field--mono field--date" type="date" aria-required="true" value={date} onChange={(e) => setDate(e.target.value)} onBlur={touch('date')} {...aria('date')} />
          </FormField>
        </div>

        <div className="save__card" style={tintStyle(7)}>
          <FormField label="Category" htmlFor="exp-cat" error={shown('category')}>
            <PickerSelect
              id="exp-cat"
              label="Category"
              value={categoryId ?? ''}
              options={categoryOptions}
              onChange={chooseCategory}
              invalid={!!shown('category')}
              describedBy={shown('category') ? 'exp-cat-msg' : undefined}
              onAdd={(name) => addCategory(name)}
              validateAdd={checkNewCategory}
              addLabel="Add category"
            />
          </FormField>

          <div className="ffield" data-invalid={shown('paidWith') && mode === null ? '' : undefined}>
            <span className="ffield__label" id="exp-mode-label">Paid with</span>
            <div className="chips" role="group" aria-labelledby="exp-mode-label" id="exp-mode" tabIndex={-1}>
              {PAYMENT_MODES.map((m) => (
                <button key={m.id} type="button" className="chip" aria-pressed={mode === m.id} onClick={() => chooseMode(m.id)}>{m.label}</button>
              ))}
            </div>
          </div>

          {kind !== null && mode !== null && (
            <FormField label={mode === 'upi' ? 'Paid from' : `Which ${noun}`} htmlFor="exp-inst" error={shown('paidWith')} hint={mode === 'upi' ? UPI_HINT : undefined}>
              <PickerSelect
                id="exp-inst"
                label={mode === 'upi' ? 'Paid from' : `Which ${noun}`}
                value={instrumentId ?? ''}
                options={instrumentOptions}
                onChange={(v) => setInstrumentId(v === '' ? null : v)}
                placeholder="None"
                invalid={!!shown('paidWith')}
                describedBy={shown('paidWith') || mode === 'upi' ? 'exp-inst-msg' : undefined}
                onAdd={(name) => addInstrument({ name, kind })}
                validateAdd={(name) => validateInstrumentDraft({ name, kind }, budget).name ?? null}
                addLabel={`Add ${noun}`}
              />
            </FormField>
          )}
          {shown('paidWith') && mode === null && <p className="ffield__error" id="exp-inst-msg" role="alert">{shown('paidWith')}</p>}
        </div>

        <div className="save__card" style={tintStyle(7)}>
          <FormField label="Note" htmlFor="exp-note">
            <input id="exp-note" className="field" value={note} maxLength={200} autoComplete="off" onChange={(e) => changeNote(e.target.value)} />
          </FormField>
        </div>

        {expense && (
          <button type="button" className="link-btn link-btn--danger expense__delete" aria-label="Delete this expense" onClick={() => { remove(expense.id); onClose() }}>
            Delete
          </button>
        )}
      </div>
    </Sheet>
  )
}

export function CategorySheet({ id, onClose }: { id: string; onClose: () => void }) {
  const cat = useApp((s) => s.budget.categories.find((c) => c.id === id && c.deletedAt === null))
  const rename = useApp((s) => s.renameCategory)
  const setLimit = useApp((s) => s.setCategoryLimit)
  const remove = useApp((s) => s.deleteCategory)
  const [name, setName] = useState(cat?.name ?? '')
  const [limit, setLimitText] = useState(cat?.limit ?? '')
  if (!cat) return null

  const done = () => {
    if (name.trim() && name.trim() !== cat.name) rename(id, name)
    setLimit(id, limit.trim() || null)
    onClose()
  }

  return (
    <Sheet title="Category" onClose={onClose} action={<button type="button" className="btn btn--primary" onClick={done}>Done</button>}>
      <div className="save">
        <div className="save__card" style={tintStyle(4)}>
          <label className="field-label" htmlFor="cat-name">Name</label>
          <input id="cat-name" className="field" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="save__card" style={tintStyle(3)}>
          <MoneyField id="cat-limit" label="Monthly limit" value={limit} onChange={setLimitText} placeholder="No limit" />
        </div>
        <div className="save__card" style={tintStyle(8)}>
          <button type="button" className="link-btn link-btn--danger budget__link" onClick={() => { remove(id); onClose() }}>Delete category</button>
          <p className="save__sum">Its entries stay, as Uncategorised.</p>
        </div>
      </div>
    </Sheet>
  )
}

export function LimitsSheet({ onClose }: { onClose: () => void }) {
  const overall = useApp((s) => s.budget.overall)
  const setOverall = useApp((s) => s.setOverallLimit)
  const addCategory = useApp((s) => s.addCategory)
  const [limit, setLimit] = useState(overall ?? '')
  const [name, setName] = useState('')

  const add = () => {
    if (name.trim() && addCategory(name) !== null) setName('')
  }

  return (
    <Sheet title="Limits" onClose={onClose} action={<button type="button" className="btn btn--primary" onClick={() => { setOverall(limit.trim() || null); onClose() }}>Done</button>}>
      <div className="save">
        <div className="save__card" style={tintStyle(3)}>
          <MoneyField id="overall-limit" label="Overall monthly limit" value={limit} onChange={setLimit} placeholder="No limit" />
        </div>
        <div className="save__card" style={tintStyle(4)}>
          <label className="field-label" htmlFor="new-cat">Add a category</label>
          <div className="save__add">
            <input id="new-cat" className="field" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <button type="button" className="btn" onClick={add} disabled={!name.trim()}>Add</button>
          </div>
        </div>
      </div>
    </Sheet>
  )
}
