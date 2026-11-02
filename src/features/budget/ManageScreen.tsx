import { useEffect, useRef, useState } from 'react'
import { FormField, RequiredNote } from '../../components/FormField'
import { Icon } from '../../components/Icon'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Sheet } from '../../components/Sheet'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { useBackHandler } from '../../components/useBackHandler'
import { D } from '../../engine'
import {
  INSTRUMENT_KINDS,
  MAX_REWARD_NOTE,
  NETWORKS,
  instrumentLabel,
  networkLabel,
  validateCategoryName,
  validateInstrumentDraft,
  validateLimit,
  type InstrumentKind,
  type NetworkId,
  type PayInstrument,
} from '../../lib/budget'
import { formatCell } from '../../lib/toolFormat'
import { GuardedFooter, cleanMoney, focusField, useDiscardGuard } from './sheets'

type Target =
  | null
  | { kind: 'category'; id: string }
  | { kind: 'newCategory' }
  | { kind: 'instrument'; id: string | null }

/** A question inside a sheet, answered by two buttons. Used where there is no Undo: the keep choice comes first. */
function Confirm({ question, detail, doText, onKeep, onDo }: { question: string; detail: string; doText: string; onKeep: () => void; onDo: () => void }) {
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

/** Add a category, or change one: name, monthly limit, its subcategories. A subcategory has no subcategories of its own. */
function CategoryEditSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const budget = useApp((s) => s.budget)
  const store = useAppStore()
  const { addCategory, renameCategory, setCategoryLimit, deleteCategory } = store.getState()
  const cat = id === null ? undefined : budget.categories.find((c) => c.id === id && c.deletedAt === null)
  const [start] = useState(() => ({ name: cat?.name ?? '', limit: cat?.limit ?? '' }))
  const [name, setName] = useState(start.name)
  const [limit, setLimit] = useState(start.limit)
  const [sub, setSub] = useState('')
  const [subError, setSubError] = useState<string | null>(null)
  const [touched, setTouched] = useState({ name: false, limit: false })
  const [submitted, setSubmitted] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  const guard = useDiscardGuard(name !== start.name || limit !== start.limit, onClose)
  const parentId = cat?.parentId ?? null
  const isTop = id === null || parentId === null
  const subs = cat && isTop ? budget.categories.filter((c) => c.deletedAt === null && c.parentId === cat.id) : []

  const nameError = validateCategoryName(name, budget, parentId, id ?? undefined)
  const limitError = validateLimit(limit)
  const showName = submitted || touched.name ? nameError : null
  const showLimit = submitted || touched.limit ? limitError : null

  const save = () => {
    setSubmitted(true)
    if (nameError) return focusField('cat-name')
    if (limitError) return focusField('cat-limit')
    const lim = limit.trim() === '' ? null : limit
    if (cat) {
      if (name.trim() !== cat.name) renameCategory(cat.id, name)
      setCategoryLimit(cat.id, lim)
      return onClose()
    }
    const newId = addCategory(name, null)
    if (newId === null) return setStoreError(store.getState().notice?.text ?? 'Could not add that category')
    if (lim !== null) setCategoryLimit(newId, lim)
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
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            />
          </FormField>
          <FormField label="Monthly limit in rupees (optional)" htmlFor="cat-limit" error={showLimit} hint={showLimit ? undefined : 'Leave empty for no limit'}>
            <div className="field-wrap">
              <span className="field-unit" aria-hidden="true">₹</span>
              <input
                id="cat-limit"
                className="field field--mono"
                inputMode="decimal"
                autoComplete="off"
                value={limit}
                aria-invalid={showLimit ? true : undefined}
                aria-describedby="cat-limit-msg"
                onChange={(e) => setLimit(cleanMoney(e.target.value))}
                onBlur={() => setTouched((t) => ({ ...t, limit: true }))}
              />
            </div>
          </FormField>
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

/** Add a card, account or wallet, or change one. Calc stores only the last four digits, never a full number. */
function InstrumentSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const budget = useApp((s) => s.budget)
  const store = useAppStore()
  const { addInstrument, updateInstrument, deleteInstrument } = store.getState()
  const cur = id === null ? undefined : budget.instruments.find((i) => i.id === id && i.deletedAt === null)
  const [start] = useState(() => ({
    kind: (cur?.kind ?? null) as InstrumentKind | null,
    name: cur?.name ?? '',
    bank: cur?.bank ?? '',
    network: cur?.network ?? (null as NetworkId | null),
    last4: cur?.last4 ?? '',
    rewardNote: cur?.rewardNote ?? '',
  }))
  const [kind, setKind] = useState(start.kind)
  const [name, setName] = useState(start.name)
  const [bank, setBank] = useState(start.bank)
  const [network, setNetwork] = useState(start.network)
  const [last4, setLast4] = useState(start.last4)
  const [rewardNote, setRewardNote] = useState(start.rewardNote)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  const dirty = kind !== start.kind || name !== start.name || bank !== start.bank || network !== start.network || last4 !== start.last4 || rewardNote !== start.rewardNote
  const guard = useDiscardGuard(dirty, onClose)
  const errors = validateInstrumentDraft({ name, kind, bank, last4, rewardNote }, budget, cur?.id)
  const shown = (f: keyof typeof errors) => (submitted || touched[f] ? errors[f] : undefined)
  const touch = (f: string) => () => setTouched((t) => ({ ...t, [f]: true }))
  const aria = (f: keyof typeof errors) => ({ 'aria-invalid': shown(f) ? (true as const) : undefined, 'aria-describedby': shown(f) || f === 'last4' || f === 'rewardNote' ? `inst-${f}-msg` : undefined })
  const isCard = kind === 'credit' || kind === 'debit'

  const chooseKind = (k: InstrumentKind) => {
    setKind(k)
    if (k !== 'credit' && k !== 'debit') setNetwork(null)
  }

  const save = () => {
    setSubmitted(true)
    const first = (['kind', 'name', 'bank', 'last4', 'rewardNote'] as const).find((f) => errors[f])
    if (first) return focusField(`inst-${first}`)
    const draft = { name, kind: kind!, network: isCard ? network : null, bank, last4, rewardNote }
    const ok = cur ? updateInstrument(cur.id, draft) : addInstrument(draft) !== null
    if (ok) return onClose()
    setStoreError(store.getState().notice?.text ?? 'Could not save this')
  }

  return (
    <Sheet
      title={cur ? 'Edit card or account' : 'Add a card or account'}
      onClose={guard.requestClose}
      footer={
        <GuardedFooter guard={guard} question="Discard your changes?">
          <button type="button" className="btn btn--primary" onClick={save}>{cur ? 'Save' : 'Add card'}</button>
        </GuardedFooter>
      }
    >
      <div className="save">
        <RequiredNote />
        {storeError && <p className="ffield__error" role="alert">{storeError}</p>}
        <div className="save__card" style={tintStyle(7)}>
          <div className="ffield" data-invalid={shown('kind') ? '' : undefined}>
            <span className="ffield__label" id="inst-kind-label">
              Type<span className="req" aria-hidden="true"> *</span><span className="sr-only"> (required)</span>
            </span>
            <div className="chips" role="group" aria-labelledby="inst-kind-label" id="inst-kind" tabIndex={-1}>
              {INSTRUMENT_KINDS.map((k) => (
                <button key={k.id} type="button" className="chip" aria-pressed={kind === k.id} onClick={() => chooseKind(k.id)}>{k.label}</button>
              ))}
            </div>
            {shown('kind') && <p className="ffield__error" id="inst-kind-msg" role="alert">{shown('kind')}</p>}
          </div>
          <FormField label="Name" htmlFor="inst-name" required error={shown('name')}>
            <input id="inst-name" className="field" value={name} maxLength={40} placeholder="e.g. Tata Neo" autoComplete="off" spellCheck={false} aria-required="true" onChange={(e) => setName(e.target.value)} onBlur={touch('name')} {...aria('name')} />
          </FormField>
          <FormField label="Bank (optional)" htmlFor="inst-bank" error={shown('bank')}>
            <input id="inst-bank" className="field" value={bank} maxLength={40} autoComplete="off" spellCheck={false} onChange={(e) => setBank(e.target.value)} onBlur={touch('bank')} {...aria('bank')} />
          </FormField>
          {isCard && (
            <div className="ffield">
              <span className="ffield__label" id="inst-network-label">Network (optional)</span>
              <div className="chips" role="group" aria-labelledby="inst-network-label">
                {NETWORKS.map((n) => (
                  <button key={n.id} type="button" className="chip" aria-pressed={network === n.id} onClick={() => setNetwork(network === n.id ? null : n.id)}>{n.label}</button>
                ))}
              </div>
              {kind === 'credit' && <p className="ffield__hint">Only a RuPay credit card can pay by UPI</p>}
            </div>
          )}
          <FormField label="Last 4 digits (optional)" htmlFor="inst-last4" error={shown('last4')} hint="Never type the full number">
            <input id="inst-last4" className="field field--mono" inputMode="numeric" value={last4} autoComplete="off" onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 16))} onBlur={touch('last4')} {...aria('last4')} />
          </FormField>
          <FormField label="Reward notes (optional)" htmlFor="inst-rewardNote" error={shown('rewardNote')} hint="Your own notes. Calc never assumes reward rates.">
            <textarea id="inst-rewardNote" className="field" rows={2} value={rewardNote} maxLength={MAX_REWARD_NOTE} onChange={(e) => setRewardNote(e.target.value)} onBlur={touch('rewardNote')} {...aria('rewardNote')} />
          </FormField>
        </div>

        {cur &&
          (asking ? (
            <Confirm
              question={`Delete ${cur.name}?`}
              detail="Entries paid with it keep how they were paid, but lose this card. This can't be undone."
              doText="Delete"
              onKeep={() => setAsking(false)}
              onDo={() => {
                deleteInstrument(cur.id)
                onClose()
              }}
            />
          ) : (
            <button type="button" className="link-btn link-btn--danger expense__delete" onClick={() => setAsking(true)}>Delete card or account</button>
          ))}
      </div>
    </Sheet>
  )
}

const instrumentHint = (i: PayInstrument) => [i.network ? networkLabel(i.network) : '', i.bank].filter(Boolean).join(' · ')

/** Categories (with subcategories) and the cards, accounts and wallets entries can be paid from. Opened from Budget. */
export function ManageScreen({ onBack }: { onBack: () => void }) {
  useBackHandler(true, onBack)
  const budget = useApp((s) => s.budget)
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const [target, setTarget] = useState<Target>(null)

  const live = budget.categories.filter((c) => c.deletedAt === null)
  const tops = live.filter((c) => c.parentId === null)
  const instruments = budget.instruments.filter((i) => i.deletedAt === null)
  const limitText = (limit: string | null) => (limit ? `Monthly limit ${formatCell(new D(limit), 'money', { system, decimals })}` : 'No limit')
  const close = () => setTarget(null)

  const row = (key: string, label: string, hint: string | undefined, onOpen: () => void, sub = false) => (
    <button key={key} type="button" className={sub ? 'navrow manage__sub' : 'navrow'} onClick={onOpen}>
      <span className="row__text">
        <span className="row__label">{label}</span>
        {hint && <span className="row__hint">{hint}</span>}
      </span>
      <Icon name="chevron" size={18} className="navrow__chev" />
    </button>
  )

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="Categories and cards">
      <ScreenHeader title="Categories and cards" onBack={onBack} />
      <div className="screen__body">
        <section className="sect sect--settings" style={tintStyle(7)} aria-label="Categories">
          <h2 className="sect__head">Categories</h2>
          <div className="sect__body">
            {tops.map((c) => (
              <div key={c.id}>
                {row(c.id, c.name, limitText(c.limit), () => setTarget({ kind: 'category', id: c.id }))}
                {live.filter((s) => s.parentId === c.id).map((s) => row(s.id, s.name, limitText(s.limit), () => setTarget({ kind: 'category', id: s.id }), true))}
              </div>
            ))}
            {tops.length === 0 && <p className="manage__none">No categories yet.</p>}
          </div>
          <div className="manage__actions">
            <button type="button" className="btn" onClick={() => setTarget({ kind: 'newCategory' })}>Add a category</button>
          </div>
        </section>

        <section className="sect sect--settings" style={tintStyle(7)} aria-label="Payment methods">
          <h2 className="sect__head">Payment methods</h2>
          <div className="sect__body">
            {instruments.length === 0 && <p className="manage__none">No cards or accounts yet. Add the ones you pay with, so an entry can say which one.</p>}
            {INSTRUMENT_KINDS.map((k) => {
              const list = instruments.filter((i) => i.kind === k.id)
              if (list.length === 0) return null
              return (
                <div key={k.id}>
                  <h3 className="manage__kind">{k.label}s</h3>
                  {list.map((i) => row(i.id, instrumentLabel(i), instrumentHint(i) || undefined, () => setTarget({ kind: 'instrument', id: i.id })))}
                </div>
              )
            })}
          </div>
          <p className="manage__help">A RuPay credit card can pay by UPI. Add it as a credit card with the network RuPay.</p>
          <div className="manage__actions">
            <button type="button" className="btn" onClick={() => setTarget({ kind: 'instrument', id: null })}>Add a card or account</button>
          </div>
        </section>
      </div>

      {target?.kind === 'category' && <CategoryEditSheet id={target.id} onClose={close} />}
      {target?.kind === 'newCategory' && <CategoryEditSheet id={null} onClose={close} />}
      {target?.kind === 'instrument' && <InstrumentSheet id={target.id} onClose={close} />}
    </div>
  )
}
