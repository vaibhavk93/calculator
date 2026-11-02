import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { tintStyle } from '../../components/tint'
import { useApp } from '../../components/StoreProvider'
import { PAYMENT_MODES, dayKey, suggestFor, type BudgetExpense, type PaymentModeId } from '../../lib/budget'

/** Keep digits and one dot. The store checks the rest and says what to fix. */
const cleanMoney = (v: string) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 16)

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

export function ExpenseSheet({ expense, onClose }: { expense?: BudgetExpense; onClose: () => void }) {
  const categories = useApp((s) => s.budget.categories).filter((c) => c.deletedAt === null)
  const budget = useApp((s) => s.budget)
  const add = useApp((s) => s.addExpense)
  const update = useApp((s) => s.updateExpense)
  const [amount, setAmount] = useState(expense?.amount ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(expense?.categoryId ?? null)
  const [mode, setMode] = useState<PaymentModeId | null>(expense?.mode ?? null)
  // Category and mode pre-fill from an earlier entry with the same note, until the user picks one themselves.
  const [touched, setTouched] = useState(expense !== undefined)
  const [date, setDate] = useState(expense?.date ?? dayKey(new Date()))
  const [note, setNote] = useState(expense?.note ?? '')

  // The store explains a bad entry in the notice; the sheet stays open until it is accepted.
  const done = () => {
    const draft = { amount, categoryId, mode, date, note: note.trim() }
    if (expense ? update(expense.id, draft) : add(draft)) onClose()
  }

  const changeNote = (v: string) => {
    setNote(v)
    const hit = touched ? null : suggestFor(budget, v)
    if (hit) {
      setCategoryId(hit.categoryId)
      setMode(hit.mode)
    }
  }
  const pick = <T,>(set: (v: T) => void, v: T) => {
    set(v)
    setTouched(true)
  }

  return (
    <Sheet title={expense ? 'Edit expense' : 'Add expense'} onClose={onClose} action={<button type="button" className="btn btn--primary" onClick={done}>Done</button>}>
      <div className="save">
        <div className="save__card" style={tintStyle(3)}>
          <MoneyField id="exp-amount" label="Amount" value={amount} onChange={setAmount} />
        </div>
        <div className="save__card" style={tintStyle(4)}>
          <span className="field-label" id="exp-cat">Category</span>
          <div className="chips" role="group" aria-labelledby="exp-cat">
            <button type="button" className="chip" aria-pressed={categoryId === null} onClick={() => pick(setCategoryId, null)}>Uncategorised</button>
            {categories.map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={categoryId === c.id} onClick={() => pick(setCategoryId, c.id)}>{c.name}</button>
            ))}
          </div>
        </div>
        <div className="save__card" style={tintStyle(6)}>
          <span className="field-label" id="exp-mode">Paid with</span>
          <div className="chips" role="group" aria-labelledby="exp-mode">
            {PAYMENT_MODES.map((m) => (
              <button key={m.id} type="button" className="chip" aria-pressed={mode === m.id} onClick={() => pick(setMode, mode === m.id ? null : m.id)}>{m.label}</button>
            ))}
          </div>
        </div>
        <div className="save__card" style={tintStyle(5)}>
          <label className="field-row">
            <span className="field-label">Date</span>
            <input className="field field--mono field--date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field-row">
            <span className="field-label">Note</span>
            <input className="field" value={note} maxLength={200} onChange={(e) => changeNote(e.target.value)} />
          </label>
        </div>
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
