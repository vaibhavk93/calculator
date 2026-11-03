import { useState } from 'react'
import { FormField, RequiredNote } from '../../components/FormField'
import { Sheet } from '../../components/Sheet'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import type { Dec } from '../../engine'
import { formatCell } from '../../lib/toolFormat'
import {
  ACCOUNT_TYPES,
  INSTRUMENT_KINDS,
  KNOWN_BANKS,
  MAX_REWARD_NOTE,
  NETWORKS,
  cardCostIn,
  cardOutstanding,
  utilisationWords,
  dropInapplicable,
  validateInstrumentDraft,
  type AccountType,
  type InstrumentErrors,
  type InstrumentKind,
  type NetworkId,
} from '../../lib/budget'
import { Confirm, GuardedFooter, MoneyInput, focusField, useDiscardGuard } from './formKit'
import { PickTrigger, PickView } from './pick'

const OTHER_BANK = '__other__'
const MORE_FIELDS: (keyof InstrumentErrors)[] = ['variant', 'holder', 'statementDay', 'dueDay', 'creditLimit', 'annualFee', 'accountType', 'upiHandle', 'rewardNote']
const ORDER: (keyof InstrumentErrors)[] = ['kind', 'name', 'bank', 'last4', ...MORE_FIELDS]

const kindName = (k: InstrumentKind) => INSTRUMENT_KINDS.find((x) => x.id === k)!.label

/**
 * Add a card, account or wallet, or change one. Always shown: type, name, bank, last four, network. Everything else is under
 * "More details". Calc stores only the last four digits, never a full number. It is a sheet of its own, used from the
 * Manage screen and, swapped in for the expense form, from Add expense (`onSaved` gets the new id).
 */
export function InstrumentForm({ id, initialKind, initialNetwork, onClose, onSaved }: {
  id: string | null
  initialKind?: InstrumentKind
  initialNetwork?: NetworkId
  onClose: () => void
  onSaved?: (id: string) => void
}) {
  const budget = useApp((s) => s.budget)
  // Same formatting as useMoney in SpendSummary; not imported from there because SpendSummary imports the sheets that import this form.
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const money = (v: Dec) => formatCell(v, 'money', { system, decimals })
  const store = useAppStore()
  const { addInstrument, updateInstrument, deleteInstrument } = store.getState()
  const cur = id === null ? undefined : budget.instruments.find((i) => i.id === id && i.deletedAt === null)
  const [start] = useState(() => ({
    kind: (cur?.kind ?? initialKind ?? null) as InstrumentKind | null,
    name: cur?.name ?? '',
    bank: cur?.bank ?? '',
    network: cur?.network ?? initialNetwork ?? (null as NetworkId | null),
    last4: cur?.last4 ?? '',
    variant: cur?.variant ?? '',
    holder: cur?.holder ?? '',
    statementDay: cur?.statementDay == null ? '' : String(cur.statementDay),
    dueDay: cur?.dueDay == null ? '' : String(cur.dueDay),
    creditLimit: cur?.creditLimit ?? '',
    annualFee: cur?.annualFee ?? '',
    upiHandle: cur?.upiHandle ?? '',
    accountType: (cur?.accountType ?? null) as AccountType | null,
    rewardNote: cur?.rewardNote ?? '',
  }))
  const [f, setF] = useState(start)
  const set = <K extends keyof typeof start>(k: K, v: (typeof start)[K]) => setF((x) => ({ ...x, [k]: v }))
  const [bankOther, setBankOther] = useState(() => start.bank !== '' && !(KNOWN_BANKS as readonly string[]).includes(start.bank))
  const [view, setView] = useState<'form' | 'bank'>('form')
  const [moreOpen, setMoreOpen] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  const dirty = (Object.keys(start) as (keyof typeof start)[]).some((k) => f[k] !== start[k])
  const guard = useDiscardGuard(dirty, onClose)
  const { kind } = f
  const isCard = kind === 'credit' || kind === 'debit'
  const draft = dropInapplicable({ ...f, network: isCard ? f.network : null })
  const errors = validateInstrumentDraft(draft, budget, cur?.id)
  const shown = (k: keyof InstrumentErrors) => (submitted || touched[k] ? errors[k] : undefined)
  const touch = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }))
  const aria = (k: keyof InstrumentErrors, hint = false) => ({ 'aria-invalid': shown(k) ? (true as const) : undefined, 'aria-describedby': shown(k) || hint ? `inst-${k}-msg` : undefined })

  const save = () => {
    setSubmitted(true)
    const first = ORDER.find((k) => errors[k])
    if (first) {
      if (MORE_FIELDS.includes(first)) {
        setMoreOpen(true)
        return void setTimeout(() => focusField(`inst-${first}`), 0)
      }
      return focusField(`inst-${first}`)
    }
    const clean = { ...draft, kind: kind!, statementDay: f.statementDay.trim() || null, dueDay: f.dueDay.trim() || null, creditLimit: draft.creditLimit || null, annualFee: f.annualFee.trim() || null }
    if (cur) {
      if (updateInstrument(cur.id, clean)) return onClose()
    } else {
      const newId = addInstrument(clean)
      if (newId !== null) {
        onSaved?.(newId)
        return onClose()
      }
    }
    setStoreError(store.getState().notice?.text ?? 'Could not save this')
  }

  if (view === 'bank') {
    return (
      <PickView
        title="Bank"
        value={bankOther ? OTHER_BANK : f.bank}
        options={[...KNOWN_BANKS.map((b) => ({ value: b, label: b })), { value: OTHER_BANK, label: 'Other (type the name)' }, { value: '', label: 'No bank' }]}
        onBack={() => setView('form')}
        onPick={(v) => {
          setBankOther(v === OTHER_BANK)
          set('bank', v === OTHER_BANK ? (bankOther ? f.bank : '') : v)
          setView('form')
        }}
      />
    )
  }

  const bankLabel = bankOther ? 'Other' : f.bank || undefined
  const last4Label = kind === 'bank' ? 'Account number, last 4 digits (optional)' : 'Last 4 digits (optional)'
  const title = cur ? 'Edit card or account' : kind ? `Add ${kindName(kind).toLowerCase()}` : 'Add a card or account'

  return (
    <Sheet
      title={title}
      onClose={guard.requestClose}
      footer={
        <GuardedFooter guard={guard} question="Discard your changes?">
          <button type="button" className="btn btn--primary" onClick={save}>{cur ? 'Save' : 'Add'}</button>
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
                <button key={k.id} type="button" className="chip" aria-pressed={kind === k.id} onClick={() => set('kind', k.id)}>{k.label}</button>
              ))}
            </div>
            {shown('kind') && <p className="ffield__error" id="inst-kind-msg" role="alert">{shown('kind')}</p>}
          </div>
          <FormField label="Name" htmlFor="inst-name" required error={shown('name')} hint="For example Tata Neo or HDFC Salary">
            <input id="inst-name" className="field" value={f.name} maxLength={40} placeholder="e.g. Tata Neo" autoComplete="off" spellCheck={false} aria-required="true" onChange={(e) => set('name', e.target.value)} onBlur={touch('name')} {...aria('name', true)} />
          </FormField>
          <FormField label="Bank (optional)" htmlFor="inst-bank" error={bankOther ? undefined : shown('bank')}>
            <PickTrigger id="inst-bank" label="Bank" valueLabel={bankLabel} placeholder="Choose a bank" onOpen={() => setView('bank')} />
          </FormField>
          {bankOther && (
            <FormField label="Bank name" htmlFor="inst-bank-other" error={shown('bank')}>
              <input id="inst-bank-other" className="field" value={f.bank} maxLength={40} autoComplete="off" spellCheck={false} onChange={(e) => set('bank', e.target.value)} onBlur={touch('bank')} {...aria('bank')} aria-describedby={shown('bank') ? 'inst-bank-other-msg' : undefined} />
            </FormField>
          )}
          {isCard && (
            <div className="ffield">
              <span className="ffield__label" id="inst-network-label">Network (optional)</span>
              <div className="chips" role="group" aria-labelledby="inst-network-label">
                {NETWORKS.map((n) => (
                  <button key={n.id} type="button" className="chip" aria-pressed={f.network === n.id} onClick={() => set('network', f.network === n.id ? null : n.id)}>{n.label}</button>
                ))}
              </div>
              {kind === 'credit' && <p className="ffield__hint">Only a RuPay credit card can pay by UPI</p>}
            </div>
          )}
          <FormField label={last4Label} htmlFor="inst-last4" error={shown('last4')} hint="Never type the full number">
            <input id="inst-last4" className="field field--mono" inputMode="numeric" value={f.last4} autoComplete="off" onChange={(e) => set('last4', e.target.value.replace(/\D/g, '').slice(0, 16))} onBlur={touch('last4')} {...aria('last4', true)} />
          </FormField>

          {kind !== null && (
            <details className="more" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
              <summary>More details</summary>
              <div className="more__body">
                {isCard && (
                  <>
                    <FormField label="Variant or card name (optional)" htmlFor="inst-variant" error={shown('variant')}>
                      <input id="inst-variant" className="field" value={f.variant} maxLength={40} autoComplete="off" onChange={(e) => set('variant', e.target.value)} onBlur={touch('variant')} {...aria('variant')} />
                    </FormField>
                    <FormField label="Name on card (optional)" htmlFor="inst-holder" error={shown('holder')}>
                      <input id="inst-holder" className="field" value={f.holder} maxLength={40} autoComplete="off" onChange={(e) => set('holder', e.target.value)} onBlur={touch('holder')} {...aria('holder')} />
                    </FormField>
                  </>
                )}
                {kind === 'credit' && (
                  <>
                    <FormField label="Statement day (optional)" htmlFor="inst-statementDay" error={shown('statementDay')} hint="Day of the month, 1 to 28">
                      <input id="inst-statementDay" className="field field--mono" inputMode="numeric" value={f.statementDay} autoComplete="off" onChange={(e) => set('statementDay', e.target.value.replace(/\D/g, '').slice(0, 2))} onBlur={touch('statementDay')} {...aria('statementDay', true)} />
                    </FormField>
                    <FormField label="Due day (optional)" htmlFor="inst-dueDay" error={shown('dueDay')} hint="Day of the month, 1 to 28">
                      <input id="inst-dueDay" className="field field--mono" inputMode="numeric" value={f.dueDay} autoComplete="off" onChange={(e) => set('dueDay', e.target.value.replace(/\D/g, '').slice(0, 2))} onBlur={touch('dueDay')} {...aria('dueDay', true)} />
                    </FormField>
                    <FormField label="Credit limit in rupees (optional)" htmlFor="inst-creditLimit" error={shown('creditLimit')}>
                      <MoneyInput id="inst-creditLimit" value={f.creditLimit} onChange={(v) => set('creditLimit', v)} invalid={!!shown('creditLimit')} describedBy={shown('creditLimit') ? 'inst-creditLimit-msg' : undefined} onBlur={touch('creditLimit')} />
                    </FormField>
                  </>
                )}
                {isCard && (
                  <FormField label="Annual fee in rupees (optional)" htmlFor="inst-annualFee" error={shown('annualFee')}>
                    <MoneyInput id="inst-annualFee" value={f.annualFee} onChange={(v) => set('annualFee', v)} invalid={!!shown('annualFee')} describedBy={shown('annualFee') ? 'inst-annualFee-msg' : undefined} onBlur={touch('annualFee')} />
                  </FormField>
                )}
                {kind === 'bank' && (
                  <div className="ffield">
                    <span className="ffield__label" id="inst-accountType-label">Account type (optional)</span>
                    <div className="chips" role="group" aria-labelledby="inst-accountType-label" id="inst-accountType" tabIndex={-1}>
                      {ACCOUNT_TYPES.map((a) => (
                        <button key={a.id} type="button" className="chip" aria-pressed={f.accountType === a.id} onClick={() => set('accountType', f.accountType === a.id ? null : a.id)}>{a.label}</button>
                      ))}
                    </div>
                  </div>
                )}
                {(kind === 'bank' || kind === 'wallet') && (
                  <FormField label="UPI ID (optional)" htmlFor="inst-upiHandle" error={shown('upiHandle')} hint="Looks like name@bank">
                    <input id="inst-upiHandle" className="field" value={f.upiHandle} maxLength={40} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={(e) => set('upiHandle', e.target.value)} onBlur={touch('upiHandle')} {...aria('upiHandle', true)} />
                  </FormField>
                )}
                {isCard && (
                  <FormField label="Reward notes (optional)" htmlFor="inst-rewardNote" error={shown('rewardNote')} hint="Your own notes. Calc never assumes reward rates.">
                    <textarea id="inst-rewardNote" className="field" rows={2} value={f.rewardNote} maxLength={MAX_REWARD_NOTE} onChange={(e) => set('rewardNote', e.target.value)} onBlur={touch('rewardNote')} {...aria('rewardNote', true)} />
                  </FormField>
                )}
              </div>
            </details>
          )}
        </div>

        {cur?.kind === 'credit' && (
          <div className="save__card" style={tintStyle(7)} aria-label="This card so far">
            <p className="ffield__hint">
              {[utilisationWords(cardOutstanding(budget, cur.id), cur.creditLimit, money), cardCostIn(budget, cur, new Date().getFullYear(), money).words].filter(Boolean).join(' ')}
            </p>
          </div>
        )}

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
