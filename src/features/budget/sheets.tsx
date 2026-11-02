import { useEffect, useMemo, useRef, useState } from 'react'
import { FormField, RequiredNote } from '../../components/FormField'
import type { PickOption } from '../../components/PickerSelect'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { tintStyle } from '../../components/tint'
import { useApp, useAppStore } from '../../components/StoreProvider'
import {
  PAYMENT_MODES,
  UPI_DEFAULT_LABEL,
  activeCategories,
  categoryMonths,
  categoryName,
  dayKey,
  eligibleInstruments,
  instrumentLabel,
  monthKey,
  networkLabel,
  onlyForLabel,
  paymentError,
  recentCategoryIds,
  suggestFor,
  validateCategoryName,
  validateExpense,
  type BudgetExpense,
  type ExpenseErrors,
  type InstrumentKind,
  type NetworkId,
  type PayInstrument,
  type PaymentModeId,
  type Settlement,
} from '../../lib/budget'
import { Segmented } from '../settings/controls'
import { GuardedFooter, MoneyInput, focusField, useDiscardGuard } from './formKit'
import { InstrumentForm } from './InstrumentForm'
import { PickTrigger, PickView } from './pick'

const INSTRUMENT_NOUN: Record<InstrumentKind, string> = { credit: 'card', debit: 'card', bank: 'account', wallet: 'wallet' }
const UPI_HINT = 'A bank account, a debit card, a wallet or a RuPay credit card'
/** At most this many pills in a row-pair: more recent categories or cards than this go behind "More" or a picker. */
const PILLS_MAX = 5

type Field = keyof ExpenseErrors
const FIELD_ID: Record<Field, string> = { amount: 'exp-amount', date: 'exp-date', category: 'exp-cat', paidWith: 'exp-inst' }

interface AddChoice { key: string; label: string; kind: InstrumentKind; network?: NetworkId }

/** The "+ Add ..." choices for a way of paying. UPI can come from a bank account or from a RuPay credit card. */
function addChoices(pay: PaymentModeId): AddChoice[] {
  switch (pay) {
    case 'upi': return [{ key: 'bank', label: '+ Add bank account', kind: 'bank' }, { key: 'rupay', label: '+ Add credit card (RuPay)', kind: 'credit', network: 'rupay' }]
    case 'credit': return [{ key: 'credit', label: '+ Add credit card', kind: 'credit' }]
    case 'debit': return [{ key: 'debit', label: '+ Add debit card', kind: 'debit' }]
    case 'netbanking': return [{ key: 'bank', label: '+ Add bank account', kind: 'bank' }]
    case 'wallet': return [{ key: 'wallet', label: '+ Add wallet', kind: 'wallet' }]
    case 'cash': return []
  }
}

const UPI_GROUP: Record<InstrumentKind, string> = { bank: 'Bank accounts', debit: 'Debit cards', wallet: 'Wallets', credit: 'RuPay credit cards' }

const hintOf = (i: PayInstrument) => [i.network ? networkLabel(i.network) : '', i.bank].filter(Boolean).join(' · ') || undefined

type View = { v: 'form' } | { v: 'category' } | { v: 'inst' } | { v: 'newInst'; add: AddChoice }

/**
 * Add or edit one entry. Checked when the field is left (after it was touched) and when Add or Save is pressed;
 * the button is never disabled. The store checks again before it saves. A list of choices or the card form takes the
 * place of this form inside the same sheet (docs/FORMS-AND-SHEETS.md: never stack a sheet on a sheet), then returns here.
 */
export function ExpenseSheet({ expense, onClose }: { expense?: BudgetExpense; onClose: () => void }) {
  const budget = useApp((s) => s.budget)
  const add = useApp((s) => s.addExpense)
  const update = useApp((s) => s.updateExpense)
  const remove = useApp((s) => s.deleteExpense)
  const addCategory = useApp((s) => s.addCategory)
  const store = useAppStore()

  // A category or card that was deleted since this entry was saved starts as "none", so editing never trips over it.
  // The category stays even when it is not used in the entry's month: an old entry keeps what it was.
  const [start] = useState(() => {
    const keep = expense?.categoryId ?? null
    const card = expense?.settlement === 'cardBill' ? budget.instruments.find((i) => i.id === expense.instrumentId && i.deletedAt === null && i.kind === 'credit') : undefined
    return {
      amount: expense?.amount ?? '',
      date: expense?.date ?? dayKey(new Date()),
      categoryId: expense && !validateExpense({ ...expense, amount: '1' }, budget, new Date(), keep).category ? expense.categoryId : null,
      mode: expense?.mode ?? null,
      instrumentId: expense?.settlement === 'cardBill' ? (card?.id ?? null) : expense && paymentError(budget, expense.mode, expense.instrumentId) === null ? expense.instrumentId : null,
      note: expense?.note ?? '',
      settlement: (expense?.settlement ?? null) as Settlement | null,
    }
  })
  const [amount, setAmount] = useState(start.amount)
  const [date, setDate] = useState(start.date)
  const [categoryId, setCategoryId] = useState<string | null>(start.categoryId)
  const [mode, setMode] = useState<PaymentModeId | null>(start.mode)
  const [instrumentId, setInstrumentId] = useState<string | null>(start.instrumentId)
  const [note, setNote] = useState(start.note)
  const [settlement, setSettlement] = useState<Settlement | null>(start.settlement)
  const [view, setView] = useState<View>({ v: 'form' })
  // Category and mode pre-fill from an earlier entry with the same note, until the user picks one themselves.
  const [picked, setPicked] = useState(expense !== undefined)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)

  const amountRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!expense) amountRef.current?.focus()
  }, [expense])

  const dirty = amount !== start.amount || date !== start.date || categoryId !== start.categoryId || mode !== start.mode || instrumentId !== start.instrumentId || note !== start.note || settlement !== start.settlement
  const guard = useDiscardGuard(dirty, onClose)

  const month = /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : monthKey(new Date())
  const errors = validateExpense({ amount, date, categoryId, mode, instrumentId, settlement }, budget, new Date(), expense?.categoryId ?? null)
  const shown = (f: Field) => (submitted || touched[f] ? errors[f] : undefined)
  const touch = (f: Field) => () => setTouched((t) => ({ ...t, [f]: true }))
  const aria = (f: Field, hint = false) => ({
    'aria-invalid': shown(f) ? (true as const) : undefined,
    'aria-describedby': shown(f) || hint ? `${FIELD_ID[f]}-msg` : undefined,
  })

  const submit = () => {
    setSubmitted(true)
    const first = (['amount', 'date', 'category', 'paidWith'] as Field[]).find((f) => errors[f])
    if (first) return focusField(first === 'paidWith' && mode === null && settlement === null ? 'exp-mode' : FIELD_ID[first])
    const draft = { amount, categoryId, mode, instrumentId, date, note: note.trim(), settlement }
    if (expense ? update(expense.id, draft) : add(draft)) return onClose()
    setStoreError(store.getState().notice?.text ?? 'Could not save this entry')
  }

  const changeNote = (v: string) => {
    setNote(v)
    const hit = picked || settlement ? null : suggestFor(budget, v)
    if (hit) {
      setCategoryId(hit.categoryId)
      setMode(hit.mode)
      setInstrumentId(hit.instrumentId)
    }
  }
  const chooseCategory = (v: string | null) => {
    setCategoryId(v === '' ? null : v)
    setPicked(true)
    setTouched((t) => ({ ...t, category: true }))
  }
  const chooseMode = (m: PaymentModeId) => {
    const next = mode === m ? null : m
    setMode(next)
    if (instrumentId !== null && paymentError(budget, next, instrumentId) !== null) setInstrumentId(null)
    setPicked(true)
  }
  const chooseSettlement = (s: Settlement | null) => {
    setSettlement(s)
    setInstrumentId(null)
    if (s) {
      setCategoryId(null)
      setMode(null)
    }
    setPicked(true)
  }

  // ---- category: the five most recent as pills, the rest behind "More"
  const usable = useMemo(() => activeCategories(budget, month), [budget, month])
  const kept = categoryId !== null && !usable.some((c) => c.id === categoryId) ? budget.categories.find((c) => c.id === categoryId && c.deletedAt === null) : undefined
  const catPills = useMemo(() => {
    const recent = recentCategoryIds(budget, PILLS_MAX, month)
    const fill = usable.filter((c) => c.parentId === null && !recent.includes(c.id)).map((c) => c.id)
    let ids = [...recent, ...fill].slice(0, PILLS_MAX)
    if (categoryId !== null && !ids.includes(categoryId)) ids = [categoryId, ...ids].slice(0, PILLS_MAX)
    return ids
  }, [budget, month, usable, categoryId])
  const keptMonths = kept ? categoryMonths(budget, kept) : null
  const categoryOptions = useMemo<PickOption[]>(() => {
    const out: PickOption[] = [{ value: '', label: 'Uncategorised' }]
    for (const top of usable.filter((c) => c.parentId === null)) {
      out.push({ value: top.id, label: top.name })
      for (const sub of usable.filter((c) => c.parentId === top.id)) out.push({ value: sub.id, label: categoryName(budget, sub.id) })
    }
    if (kept) out.push({ value: kept.id, label: categoryName(budget, kept.id), hint: keptMonths ? onlyForLabel(keptMonths) : undefined })
    return out
  }, [budget, usable, kept, keptMonths])
  // A name that already exists is selected, not refused.
  const checkNewCategory = (name: string) =>
    budget.categories.some((c) => c.deletedAt === null && c.parentId === null && c.name.toLowerCase() === name.toLowerCase()) ? null : validateCategoryName(name, budget, null)

  // ---- paid from: pills for up to five (not UPI), a picker above that
  const payMode: PaymentModeId | null = settlement === 'cardBill' ? 'credit' : settlement === 'transfer' ? null : mode
  const eligible = eligibleInstruments(budget, payMode)
  const adds = payMode === null ? [] : addChoices(payMode)
  const kind: InstrumentKind | null = payMode === null || payMode === 'cash' ? null : eligible[0]?.kind ?? adds[0]?.kind ?? null
  const noun = payMode === 'upi' ? 'account' : adds[0] ? INSTRUMENT_NOUN[adds[0].kind] : ''
  const payLabel = settlement === 'cardBill' ? 'Card being paid' : payMode === 'upi' ? 'Paid from' : `Which ${noun}`
  const pills = payMode !== null && payMode !== 'upi' && eligible.length <= PILLS_MAX
  const chosen = instrumentId === null ? undefined : budget.instruments.find((i) => i.id === instrumentId)
  const instrumentOptions: PickOption[] = [
    ...(payMode === 'upi' ? [{ value: '', label: UPI_DEFAULT_LABEL }] : [{ value: '', label: 'None' }]),
    ...eligible.map((i) => ({ value: i.id, label: instrumentLabel(i), hint: hintOf(i), group: payMode === 'upi' ? UPI_GROUP[i.kind] : undefined })),
  ]
  const instrumentValueLabel = chosen ? instrumentLabel(chosen) : payMode === 'upi' ? UPI_DEFAULT_LABEL : undefined
  const chooseInstrument = (v: string | null) => {
    setInstrumentId(v === '' ? null : v)
    setPicked(true)
    setTouched((t) => ({ ...t, paidWith: true }))
  }

  // ---- swapped-in views
  if (view.v === 'category') {
    return (
      <PickView
        title="Category"
        options={categoryOptions}
        value={categoryId ?? ''}
        onBack={() => setView({ v: 'form' })}
        onPick={(v) => { chooseCategory(v); setView({ v: 'form' }) }}
        onAddName={(name) => addCategory(name)}
        validateAdd={checkNewCategory}
        addLabel="Add category"
      />
    )
  }
  if (view.v === 'inst') {
    return (
      <PickView
        title={payLabel}
        options={instrumentOptions}
        value={instrumentId ?? ''}
        onBack={() => setView({ v: 'form' })}
        onPick={(v) => { chooseInstrument(v); setView({ v: 'form' }) }}
        extra={adds.map((a) => ({ key: a.key, label: a.label, onClick: () => setView({ v: 'newInst', add: a }) }))}
      />
    )
  }
  if (view.v === 'newInst') {
    return (
      <InstrumentForm
        id={null}
        initialKind={view.add.kind}
        initialNetwork={view.add.network}
        onClose={() => setView({ v: 'form' })}
        onSaved={(id) => chooseInstrument(id)}
      />
    )
  }

  const catError = shown('category')
  const instError = shown('paidWith')

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
            <MoneyInput id="exp-amount" inputRef={amountRef} value={amount} onChange={setAmount} onBlur={touch('amount')} invalid={!!shown('amount')} describedBy={shown('amount') ? 'exp-amount-msg' : undefined} />
          </FormField>
          <FormField label="Date" htmlFor="exp-date" required error={shown('date')}>
            <input id="exp-date" className="field field--mono field--date" type="date" aria-required="true" value={date} onChange={(e) => setDate(e.target.value)} onBlur={touch('date')} {...aria('date')} />
          </FormField>
          <div className="ffield">
            <span className="ffield__label" id="exp-kind-label">What is this</span>
            <Segmented<'spend' | Settlement>
              label="What is this"
              value={settlement ?? 'spend'}
              onChange={(v) => chooseSettlement(v === 'spend' ? null : v)}
              options={[{ value: 'spend', label: 'Spending' }, { value: 'cardBill', label: 'Card bill' }, { value: 'transfer', label: 'Transfer' }]}
            />
            {settlement === 'cardBill' && <p className="ffield__hint">Paying off a credit card. Not counted as spending.</p>}
            {settlement === 'transfer' && <p className="ffield__hint">Moving money between your own accounts. Not counted as spending.</p>}
          </div>
        </div>

        {settlement === null && (
          <div className="save__card" style={tintStyle(7)}>
            <div className="ffield" data-invalid={catError ? '' : undefined}>
              <span className="ffield__label" id="exp-cat-label">Category</span>
              <div className="chips" role="group" aria-labelledby="exp-cat-label" id="exp-cat" tabIndex={-1}>
                {catPills.map((id) => (
                  <button key={id} type="button" className="chip pill" aria-pressed={categoryId === id} onClick={() => chooseCategory(categoryId === id ? '' : id)}>{categoryName(budget, id)}</button>
                ))}
                <button type="button" className="chip pill pill--more" aria-haspopup="dialog" onClick={() => setView({ v: 'category' })}>
                  <span>More</span>
                  <Icon name="down" size={14} />
                </button>
              </div>
              {catError ? (
                <p className="ffield__error" id="exp-cat-msg" role="alert">{catError}</p>
              ) : kept && keptMonths ? (
                <p className="ffield__hint" id="exp-cat-msg">{kept.name} is {onlyForLabel(keptMonths)}. This entry keeps it.</p>
              ) : categoryId === null ? (
                <p className="ffield__hint" id="exp-cat-msg">Uncategorised until you pick one</p>
              ) : null}
            </div>

            <div className="ffield" data-invalid={instError && mode === null ? '' : undefined}>
              <span className="ffield__label" id="exp-mode-label">Paid with</span>
              <div className="chips" role="group" aria-labelledby="exp-mode-label" id="exp-mode" tabIndex={-1}>
                {PAYMENT_MODES.map((m) => (
                  <button key={m.id} type="button" className="chip pill" aria-pressed={mode === m.id} onClick={() => chooseMode(m.id)}>{m.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {payMode !== null && payMode !== 'cash' && kind !== null && (
          <div className="save__card" style={tintStyle(7)}>
            {pills ? (
              <div className="ffield" data-invalid={instError ? '' : undefined}>
                <span className="ffield__label" id="exp-inst-label">{payLabel}</span>
                <div className="chips" role="group" aria-labelledby="exp-inst-label" id="exp-inst" tabIndex={-1}>
                  {eligible.map((i) => (
                    <button key={i.id} type="button" className="chip pill" aria-pressed={instrumentId === i.id} onClick={() => chooseInstrument(instrumentId === i.id ? '' : i.id)}>{instrumentLabel(i)}</button>
                  ))}
                  {adds.map((a) => (
                    <button key={a.key} type="button" className="chip pill pill--add" onClick={() => setView({ v: 'newInst', add: a })}>{a.label}</button>
                  ))}
                </div>
                {instError ? <p className="ffield__error" id="exp-inst-msg" role="alert">{instError}</p> : null}
              </div>
            ) : (
              <FormField label={payLabel} htmlFor="exp-inst" error={instError} hint={payMode === 'upi' ? UPI_HINT : undefined}>
                <PickTrigger
                  id="exp-inst"
                  label={payLabel}
                  valueLabel={instrumentValueLabel}
                  placeholder="None"
                  invalid={!!instError}
                  describedBy={instError || payMode === 'upi' ? 'exp-inst-msg' : undefined}
                  onOpen={() => setView({ v: 'inst' })}
                />
              </FormField>
            )}
          </div>
        )}
        {instError && payMode === null && settlement === null && <p className="ffield__error" id="exp-inst-msg" role="alert">{instError}</p>}

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
