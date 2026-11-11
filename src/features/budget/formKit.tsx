import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useBackHandler } from '../../components/useBackHandler'
import type { PickOption } from '../../components/PickerSelect'
import { categoryName, type BudgetData } from '../../lib/budget'
import { decimalComma } from '../../lib/decimalComma'

/** Live categories, each followed by its subcategories, as picker options. */
export function categoryPickOptions(budget: Pick<BudgetData, 'categories'>): PickOption[] {
  const options: PickOption[] = []
  for (const top of budget.categories.filter((c) => c.deletedAt === null && c.parentId === null)) {
    options.push({ value: top.id, label: top.name })
    for (const sub of budget.categories.filter((c) => c.deletedAt === null && c.parentId === top.id)) options.push({ value: sub.id, label: categoryName(budget, sub.id) })
  }
  return options
}

/** Keep digits and one dot. The store checks the rest and says what to fix. */
export const cleanMoney = (v: string) => decimalComma(v).replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 16)

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

/** A question inside a sheet, answered by two buttons. Used where there is no Undo: the keep choice comes first. */
export function Confirm({ question, detail, doText, onKeep, onDo }: { question: string; detail: string; doText: string; onKeep: () => void; onDo: () => void }) {
  const keepRef = useRef<HTMLButtonElement>(null)
  useEffect(() => keepRef.current?.focus(), [])
  return (
    <div className="manage__confirm" role="group" aria-label={question}>
      <p className="manage__ask">{question}</p>
      <p className="save__sum">{detail}</p>
      <button ref={keepRef} type="button" className="btn btn--primary" onClick={onKeep}>Keep it</button>
      <button type="button" className="btn btn--danger" onClick={onDo}>{doText}</button>
    </div>
  )
}

/** The rupee input box used for amounts and limits. */
export function MoneyInput({ id, value, onChange, placeholder, describedBy, invalid, onBlur, inputRef }: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  describedBy?: string
  invalid?: boolean
  onBlur?: () => void
  inputRef?: React.Ref<HTMLInputElement>
}) {
  const [minus, setMinus] = useState(false)
  return (
    <div className="field-wrap">
      <span className="field-unit" aria-hidden="true">₹</span>
      <input
        ref={inputRef}
        id={id}
        className="field field--mono"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => { setMinus(e.target.value.includes('-')); onChange(cleanMoney(e.target.value)) }}
        onBlur={onBlur}
      />
      {minus && <p className="ffield__hint" role="status">A minus sign is not used here. Type the amount without it.</p>}
    </div>
  )
}
