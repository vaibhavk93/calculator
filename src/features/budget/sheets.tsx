import { useEffect, useMemo, useRef, useState } from 'react'
import { FormField, RequiredNote } from '../../components/FormField'
import type { PickOption } from '../../components/PickerSelect'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { tintStyle } from '../../components/tint'
import { useApp, useAppStore } from '../../components/StoreProvider'
import {
  type BillRepeat,
  type ExpenseDraft,
  BILL_REPEATS,
  PAYMENT_MODES,
  UPI_DEFAULT_LABEL,
  activeCategories,
  categoryMonths,
  categoryName,
  dayKey,
  editWords,
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
import { D } from '../../engine'
import { firstDue, looksMonthly, repeatWord } from '../../lib/recurring'
import { formatCell } from '../../lib/toolFormat'
import { shortDate } from '../../lib/tasks'
import { Row, Segmented, Toggle } from '../settings/controls'
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

/** Notes the person said "Not now" to for the monthly-bill guess, for as long as the app stays open. */
const dismissedHints = new Set<string>()
/** How many past changes the edit sheet lists (newest first); the rest are summed up in one line. */
const TRAIL_SHOWN = 3

type View = { v: 'form' } | { v: 'category' } | { v: 'inst' } | { v: 'newInst'; add: AddChoice }

/**
 * Add or edit one entry. Checked when the field is left (after it was touched) and when Add or Save is pressed;
 * the button is never disabled. The store checks again before it saves. A list of choices or the card form takes the
 * place of this form inside the same sheet (docs/FORMS-AND-SHEETS.md: never stack a sheet on a sheet), then returns here.
 */
export function ExpenseSheet({ expense, prefill, title, startRepeat, rememberAs, onSaved, onClose }: { expense?: BudgetExpense; /** A new entry that starts with these values (a calculator result, or a bank message being reviewed). */ prefill?: Partial<ExpenseDraft> & { amount: string; note: string }; /** Replaces "Add expense" as the sheet's title. */ title?: string; /** "Repeats" starts on this (the Bills page opens the sheet on Monthly). */ startRepeat?: BillRepeat; /** Bank-message review only: the short merchant word a rule can be made from. When the person changes the suggested category, a "Remember this merchant" switch appears. */ rememberAs?: string; /** Called after a NEW entry is saved. */ onSaved?: () => void; onClose: () => void }) {
  const budget = useApp((s) => s.budget)
  const add = useApp((s) => s.addExpense)
  const update = useApp((s) => s.updateExpense)
  const remove = useApp((s) => s.deleteExpense)
  const addCategory = useApp((s) => s.addCategory)
  const store = useAppStore()
  const reminderTime = useApp((s) => s.settings.reminderTime)

  // A category or card that was deleted since this entry was saved starts as "none", so editing never trips over it.
  // The category stays even when it is not used in the entry's month: an old entry keeps what it was.
  const [start] = useState(() => {
    const keep = expense?.categoryId ?? null
    const card = expense?.settlement === 'cardBill' ? budget.instruments.find((i) => i.id === expense.instrumentId && i.deletedAt === null && i.kind === 'credit') : undefined
    return {
      amount: expense?.amount ?? prefill?.amount ?? '',
      date: expense?.date ?? prefill?.date ?? dayKey(new Date()),
      categoryId: expense ? (!validateExpense({ ...expense, amount: '1' }, budget, new Date(), keep).category ? expense.categoryId : null) : (prefill?.categoryId ?? null),
      mode: expense?.mode ?? prefill?.mode ?? null,
      instrumentId: expense?.settlement === 'cardBill' ? (card?.id ?? null) : expense ? (paymentError(budget, expense.mode, expense.instrumentId) === null ? expense.instrumentId : null) : (prefill?.instrumentId ?? null),
      note: expense?.note ?? prefill?.note ?? '',
      settlement: (expense?.settlement ?? prefill?.settlement ?? null) as Settlement | null,
      refund: expense?.refund ?? prefill?.refund ?? false,
      income: expense?.income ?? prefill?.income ?? false,
      repeat: (startRepeat ?? 'none') as BillRepeat | 'none',
    }
  })
  const [amount, setAmount] = useState(start.amount)
  const [date, setDate] = useState(start.date)
  const [categoryId, setCategoryId] = useState<string | null>(start.categoryId)
  const [mode, setMode] = useState<PaymentModeId | null>(start.mode)
  const [instrumentId, setInstrumentId] = useState<string | null>(start.instrumentId)
  const [note, setNote] = useState(start.note)
  const [settlement, setSettlement] = useState<Settlement | null>(start.settlement)
  const [refund, setRefund] = useState(start.refund)
  const [income, setIncome] = useState(start.income)
  const [repeat, setRepeat] = useState<BillRepeat | 'none'>(start.repeat)
  const [view, setView] = useState<View>({ v: 'form' })
  // Category and mode pre-fill from an earlier entry with the same note, until the user picks one themselves.
  const [picked, setPicked] = useState(expense !== undefined)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)
  const [hintGone, setHintGone] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [remember, setRemember] = useState(false)
  const addRule = useApp((s) => s.addRule)
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)

  const amountRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!expense) amountRef.current?.focus()
  }, [expense])

  const dirty = amount !== start.amount || date !== start.date || categoryId !== start.categoryId || mode !== start.mode || instrumentId !== start.instrumentId || note !== start.note || settlement !== start.settlement || refund !== start.refund || income !== start.income || repeat !== start.repeat
  const guard = useDiscardGuard(dirty, onClose)

  const month = /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : monthKey(new Date())
  const errors = validateExpense({ amount, date, categoryId, mode, instrumentId, settlement, income }, budget, new Date(), expense?.categoryId ?? null)
  const shown = (f: Field) => (submitted || touched[f] ? errors[f] : undefined)
  const touch = (f: Field) => () => setTouched((t) => ({ ...t, [f]: true }))
  const aria = (f: Field, hint = false) => ({
    'aria-invalid': shown(f) ? (true as const) : undefined,
    'aria-describedby': shown(f) || hint ? `${FIELD_ID[f]}-msg` : undefined,
  })

  const canRemember = !expense && !!rememberAs && settlement === null && !income && categoryId !== null && categoryId !== start.categoryId

  const submit = () => {
    setSubmitted(true)
    const first = (['amount', 'date', 'category', 'paidWith'] as Field[]).find((f) => errors[f])
    if (first) return focusField(first === 'paidWith' && mode === null && settlement === null ? 'exp-mode' : FIELD_ID[first])
    const draft = { amount, categoryId, mode, instrumentId, date, note: note.trim(), settlement, refund: settlement === null && !income && refund, income: settlement === null && income }
    const rep = settlement === null && !refund && !income && repeat !== 'none' ? repeat : null
    if (expense ? update(expense.id, draft, rep) : add(draft, rep)) {
      // The entry is saved first; a rule that cannot be made (cap reached) says so in a notice but never loses the entry.
      if (!expense && canRemember && remember && categoryId) addRule(rememberAs!, categoryId)
      if (!expense) onSaved?.()
      return onClose()
    }
    setStoreError(store.getState().notice?.text ?? 'Could not save this entry')
  }

  const changeNote = (v: string) => {
    setNote(v)
    const hit = picked || settlement || income ? null : suggestFor(budget, v)
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
  /** Spending, a refund (spending turned round), a card bill payment or an own-account transfer. Only spending repeats. */
  const chooseKind = (v: 'spend' | 'refund' | 'income' | Settlement) => {
    setRefund(v === 'refund')
    setIncome(v === 'income')
    if (v === 'income') {
      // Money in has no category, mode or card: clear them so nothing stale is sent.
      setCategoryId(null)
      setMode(null)
      setInstrumentId(null)
    }
    if (v === 'spend' || v === 'refund' || v === 'income') {
      if (settlement !== null) chooseSettlement(null)
    } else chooseSettlement(v)
    if (v !== 'spend') setRepeat('none')
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
  const payMode: PaymentModeId | null = settlement === 'cardBill' ? 'credit' : settlement === 'transfer' || income ? null : mode
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
  const linked = expense?.recurringId ? (budget.recurring ?? []).find((r) => r.id === expense.recurringId && r.deletedAt === null) : undefined
  const nextDue = repeat !== 'none' && !errors.date ? firstDue(date, repeat, Date.now(), reminderTime).dueAt : null
  // A quiet guess from the person's own repeats. Never automatic: it only offers, and "Not now" is remembered for this note.
  const hintKey = note.trim().toLowerCase()
  const guess = !linked && !expense?.recurringId && settlement === null && !refund && !income && repeat === 'none' && !hintGone && hintKey !== '' && !dismissedHints.has(hintKey) ? looksMonthly(budget, { note, amount, date }, expense?.id ?? null) : null
  const trail = expense?.edits ?? []
  const trailMoney = (plain: string) => formatCell(new D(plain), 'money', { system, decimals })

  return (
    <Sheet
      title={expense ? (expense.refund ? 'Edit refund' : expense.income ? 'Edit money in' : 'Edit expense') : (title ?? (refund ? 'Add refund' : income ? 'Add money in' : 'Add expense'))}
      onClose={guard.requestClose}
      footer={
        <GuardedFooter guard={guard} question={income ? 'Discard this entry?' : 'Discard this expense?'}>
          <button type="button" className="btn btn--primary" onClick={submit}>{expense ? 'Save changes' : refund ? 'Add refund' : income ? 'Add money in' : 'Add expense'}</button>
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
        </div>

        {settlement === null && !income && (
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

            {canRemember && (
              <Row label="Remember this merchant" hint={`Next time, "${rememberAs}" goes to ${categoryName(budget, categoryId!)}`}>
                <Toggle label={`Remember ${rememberAs} as ${categoryName(budget, categoryId!)}`} checked={remember} onChange={setRemember} />
              </Row>
            )}
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
        {instError && payMode === null && settlement === null && !income && <p className="ffield__error" id="exp-inst-msg" role="alert">{instError}</p>}

        <div className="save__card" style={tintStyle(7)}>
          <div className="ffield">
            <span className="ffield__label" id="exp-kind-label">What is this</span>
            <Segmented<'spend' | 'refund' | 'income' | Settlement>
              label="What is this"
              value={settlement ?? (refund ? 'refund' : income ? 'income' : 'spend')}
              onChange={chooseKind}
              options={[{ value: 'spend', label: 'Spending' }, { value: 'refund', label: 'Refund' }, { value: 'income', label: 'Money in' }, { value: 'cardBill', label: 'Card bill' }, { value: 'transfer', label: 'Transfer' }]}
            />
            {refund && settlement === null && <p className="ffield__hint">Money that came back, such as a returned item. It lowers your spending. Use this when someone pays you back.</p>}
            {income && settlement === null && <p className="ffield__hint">Money that came in, such as salary. It is not spending. Put where it came from in the note.</p>}
            {settlement === 'cardBill' && <p className="ffield__hint">Paying off a credit card. Not counted as spending.</p>}
            {settlement === 'transfer' && <p className="ffield__hint">Moving money between your own accounts. Not counted as spending. Sending money to another person is spending: use Spending.</p>}
          </div>
        </div>

        <div className="save__card" style={tintStyle(7)}>
          <FormField label="Note" htmlFor="exp-note">
            <input id="exp-note" className="field" value={note} maxLength={200} autoComplete="off" onChange={(e) => changeNote(e.target.value)} />
          </FormField>
        </div>

        {settlement === null && !refund && (
          <>
            {guess && (
              <div className="ffield">
                <p className="ffield__hint" role="status">Looks like a monthly bill. Make it a bill?</p>
                <div className="expense__guess">
                  <button type="button" className="link-btn" onClick={() => { setRepeat('monthly'); setMoreOpen(true) }}>Make it a bill</button>
                  <button type="button" className="link-btn" onClick={() => { dismissedHints.add(hintKey); setHintGone(true) }}>Not now</button>
                </div>
              </div>
            )}
            <details className="more" open={moreOpen || repeat !== 'none' || linked !== undefined} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
              <summary>More options</summary>
              <div className="more__body">
                {linked ? (
                  <p className="ffield__hint">This entry is part of a bill that repeats {repeatWord(linked.repeat)}. Change or stop it in Bills.</p>
                ) : (
                  <div className="ffield">
                    <span className="ffield__label" id="exp-repeat-label">Repeats</span>
                    <Segmented<BillRepeat | 'none'>
                      label="Repeats"
                      value={repeat}
                      onChange={setRepeat}
                      options={[{ value: 'none', label: 'Never' }, ...BILL_REPEATS.map((r) => ({ value: r.id, label: r.label }))]}
                    />
                    <p className="ffield__hint" role="status">
                      {repeat === 'none' || nextDue === null
                        ? 'For a bill or subscription, such as rent or Netflix.'
                        : `This entry counts as the first payment. Next due ${shortDate(nextDue)}: it shows in Due, and marking it paid adds the entry.`}
                    </p>
                  </div>
                )}
              </div>
            </details>
          </>
        )}

        {trail.length > 0 && (
          <div className="expense__trail" role="group" aria-label="Changes to this entry">
            {trail.slice(-TRAIL_SHOWN).reverse().map((t, i) => <p key={i} className="ffield__hint">{editWords(t, trailMoney, (id) => (id === null ? 'Uncategorised' : categoryName(budget, id)))}</p>)}
            {trail.length > TRAIL_SHOWN && <p className="ffield__hint">and {trail.length - TRAIL_SHOWN} earlier {trail.length - TRAIL_SHOWN === 1 ? 'change' : 'changes'}</p>}
          </div>
        )}

        {expense && (
          <button type="button" className="link-btn link-btn--danger expense__delete" aria-label="Delete this expense" onClick={() => { remove(expense.id); onClose() }}>
            Delete
          </button>
        )}
      </div>
    </Sheet>
  )
}
