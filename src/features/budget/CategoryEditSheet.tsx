import { useState } from 'react'
import { FormField, RequiredNote } from '../../components/FormField'
import { Sheet } from '../../components/Sheet'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { monthWindow, validateCategoryMonths, validateCategoryName, validateNewCategoryMonths } from '../../lib/budget'
import { Confirm, GuardedFooter, focusField, useDiscardGuard } from './formKit'
import { AvailableIn, LimitField, useLimitDraft } from './limits'

/**
 * Add a category, or change one: name, limit (every month or one month only), the months it is available in, and its
 * subcategories. A subcategory has no subcategories of its own. `month` is the month the person is looking at.
 */
export function CategoryEditSheet({ id, month, onClose }: { id: string | null; month: string; onClose: () => void }) {
  const budget = useApp((s) => s.budget)
  const store = useAppStore()
  const { addCategory, renameCategory, setCategoryLimit, setCategoryMonths, clearMonthLimit, deleteCategory } = store.getState()
  const cat = id === null ? undefined : budget.categories.find((c) => c.id === id && c.deletedAt === null)
  const parent = cat?.parentId ? budget.categories.find((c) => c.id === cat.parentId) : undefined
  const parentMonths = parent?.months && parent.months.length > 0 ? parent.months : null
  const [start] = useState(() => ({ name: cat?.name ?? '', months: cat?.months && cat.months.length > 0 ? cat.months : null }))
  const [name, setName] = useState(start.name)
  const [months, setMonths] = useState<string[] | null>(start.months)
  const d = useLimitDraft(cat?.limit ?? null, cat?.limitByMonth, month)
  const [sub, setSub] = useState('')
  const [subError, setSubError] = useState<string | null>(null)
  const [touchedName, setTouchedName] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  const monthsChanged = JSON.stringify(months) !== JSON.stringify(start.months)
  const guard = useDiscardGuard(name !== start.name || d.dirty || monthsChanged, onClose)
  const parentId = cat?.parentId ?? null
  const isTop = id === null || parentId === null
  const subs = cat && isTop ? budget.categories.filter((c) => c.deletedAt === null && c.parentId === cat.id) : []

  const nameError = validateCategoryName(name, budget, parentId, id ?? undefined)
  const monthsError = cat ? validateCategoryMonths(budget, cat.id, months) : validateNewCategoryMonths(budget, null, months)
  const showName = submitted || touchedName ? nameError : null
  const monthOptions = parentMonths ?? [...new Set([...monthWindow(month), ...(months ?? [])])].sort()

  const save = () => {
    setSubmitted(true)
    d.submit()
    if (nameError) return focusField('cat-name')
    if (d.problem) return focusField('cat-limit')
    if (monthsError) return focusField('avail-months')
    if (cat) {
      if (name.trim() !== cat.name) renameCategory(cat.id, name)
      if (monthsChanged && !setCategoryMonths(cat.id, months)) return setStoreError(store.getState().notice?.text ?? 'Could not change the months')
      if (!d.apply((lim, sc) => setCategoryLimit(cat.id, lim, sc), () => clearMonthLimit(cat.id, month))) return setStoreError(store.getState().notice?.text ?? 'Could not save the limit')
      return onClose()
    }
    const newId = addCategory(name, null, months)
    if (newId === null) return setStoreError(store.getState().notice?.text ?? 'Could not add that category')
    if (!d.apply((lim, sc) => setCategoryLimit(newId, lim, sc), () => clearMonthLimit(newId, month))) return setStoreError(store.getState().notice?.text ?? 'Added, but could not save the limit')
    onClose()
  }

  const addSub = () => {
    if (!cat) return
    const why = validateCategoryName(sub, budget, cat.id)
    if (why) return setSubError(why)
    if (addCategory(sub, cat.id) === null) return setSubError(store.getState().notice?.text ?? 'Could not add that')
    setSub('')
    setSubError(null)
  }

  const removeText = !cat
    ? ''
    : subs.length > 0
      ? `Delete ${cat.name} and its ${subs.length} subcategor${subs.length === 1 ? 'y' : 'ies'}?`
      : `Delete ${cat.name}?`

  return (
    <Sheet
      title={cat ? (isTop ? 'Edit category' : 'Edit subcategory') : 'Add category'}
      onClose={guard.requestClose}
      footer={
        <GuardedFooter guard={guard} question={cat ? 'Discard your changes?' : 'Discard this category?'}>
          <button type="button" className="btn btn--primary" onClick={save}>{cat ? 'Save' : 'Add category'}</button>
        </GuardedFooter>
      }
    >
      <div className="save">
        <RequiredNote />
        {storeError && <p className="ffield__error" role="alert">{storeError}</p>}
        <div className="save__card" style={tintStyle(7)}>
          <FormField label="Name" htmlFor="cat-name" required error={showName}>
            <input
              id="cat-name"
              className="field"
              value={name}
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              autoFocus={!cat}
              aria-required="true"
              aria-invalid={showName ? true : undefined}
              aria-describedby={showName ? 'cat-name-msg' : undefined}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouchedName(true)}
            />
          </FormField>
        </div>

        <div className="save__card" style={tintStyle(7)}>
          <LimitField
            d={d}
            id="cat-limit"
            label="Limit in rupees"
            onUseEvery={() => { if (cat) clearMonthLimit(cat.id, month); d.resetToEveryMonth() }}
          />
        </div>

        <div className="save__card" style={tintStyle(7)}>
          <AvailableIn
            value={months}
            onChange={setMonths}
            options={monthOptions}
            defaultMonth={month}
            error={submitted ? monthsError : null}
            note={parentMonths ? `Inside ${parent!.name}'s months` : 'Entries already added stay, even outside these months'}
          />
        </div>

        {cat && isTop && (
          <div className="save__card" style={tintStyle(7)}>
            <h3 className="manage__kind">Subcategories</h3>
            {subs.length > 0 && <p className="save__sum">{subs.map((c) => c.name).join(', ')}. Tap one on the list to change or delete it.</p>}
            <FormField label="Add a subcategory" htmlFor="cat-sub" error={subError}>
              <div className="save__add">
                <input
                  id="cat-sub"
                  className="field"
                  value={sub}
                  maxLength={40}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={subError ? true : undefined}
                  aria-describedby={subError ? 'cat-sub-msg' : undefined}
                  onChange={(e) => {
                    setSub(e.target.value)
                    setSubError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSub()
                    }
                  }}
                />
                <button type="button" className="btn" onClick={addSub}>Add</button>
              </div>
            </FormField>
          </div>
        )}

        {cat &&
          (asking ? (
            <Confirm
              question={removeText}
              detail="Its entries stay, as Uncategorised. This can't be undone."
              doText="Delete"
              onKeep={() => setAsking(false)}
              onDo={() => {
                deleteCategory(cat.id)
                onClose()
              }}
            />
          ) : (
            <div>
              <button type="button" className="link-btn link-btn--danger" onClick={() => setAsking(true)}>Delete {isTop ? 'category' : 'subcategory'}</button>
              <p className="save__sum">Its entries stay, as Uncategorised.</p>
            </div>
          ))}
      </div>
    </Sheet>
  )
}
