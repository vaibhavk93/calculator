import { useState, type ReactNode } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { FormField, RequiredNote } from '../../components/FormField'
import { Icon } from '../../components/Icon'
import { PickerSelect, type PickOption } from '../../components/PickerSelect'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Sheet } from '../../components/Sheet'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { D, type Dec } from '../../engine'
import {
  ASSET_KINDS,
  LIABILITY_KINDS,
  countedHoldings,
  isLiability,
  latestValue,
  monthlySeries,
  netWorth,
  oldestAsOf,
  splitByKind,
  staleCount,
} from '../../engine/investments/portfolio'
import { KIND_LABEL, KIND_ONE, STALE_DAYS, cleanHoldingName, isOld, updatedWords, validateHolding, type Holding, type HoldingKind } from '../../lib/portfolio'
import { dayText, shortDate } from '../../lib/tasks'
import { monthShortLabel } from '../../lib/budget'
import { GuardedFooter, MoneyInput, focusField, useDiscardGuard } from './formKit'
import { Bar, FitHero, useMoney } from './SpendSummary'

const HIDDEN = '••••'
type SheetState = null | { kind: 'add' } | { kind: 'edit'; id: string }

const KIND_OPTIONS: PickOption[] = [
  ...ASSET_KINDS.map((k) => ({ value: k, label: KIND_ONE[k], group: 'I own this' })),
  ...LIABILITY_KINDS.map((k) => ({ value: k, label: KIND_ONE[k], group: 'I owe this' })),
]

const pctOf = (part: Dec, whole: Dec): number => (whole.isZero() ? 0 : part.div(whole).times(100).toNumber())

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="sect" aria-label={title}>
      <h2 className="sect__head">
        <span>{title}</span>
        {count !== undefined && <span className="sect__count">{count}</span>}
      </h2>
      <div className="sect__body">{children}</div>
    </section>
  )
}

/**
 * Portfolio: a list of what you own and what you owe, each with one current value and the day it was set. Net worth, the split and
 * the last 6 months are worked out from that (engine/investments/portfolio.ts), never stored. Rupees only. Reached from
 * "More in Budget", so it hides with the Budget tab. Back is handled by BudgetScreen.
 *
 * "Hide amounts" is this screen's own state only: it is never saved, never in a backup and never logged. It starts hidden.
 */
export function PortfolioScreen({ onBack }: { onBack: () => void }) {
  const portfolio = useApp((s) => s.portfolio)
  const money = useMoney()
  const [hidden, setHidden] = useState(true)
  const [sheet, setSheet] = useState<SheetState>(null)

  const today = dayText(Date.now())
  const live = portfolio.filter((h) => h.deletedAt === null)
  const shown = (v: Dec) => (hidden ? HIDDEN : money(v))

  const total = netWorth(live)
  const counted = countedHoldings(live)
  const stale = staleCount(live, today)
  const oldest = oldestAsOf(live)
  const split = splitByKind(live)
  const owns = split.filter((r) => !r.liability)
  const owes = split.filter((r) => r.liability)
  const ownTotal = owns.reduce((a, r) => a.plus(r.total), new D(0))
  const oweTotal = owes.reduce((a, r) => a.plus(r.total), new D(0))
  const names = new Map(live.map((h) => [h.id, h.name]))
  const months = monthlySeries(live, today).filter((m) => m.included > 0)
  const peak = months.reduce((a, m) => (m.total.abs().gt(a) ? m.total.abs() : a), new D(0))

  const holdings = [...live].sort((a, b) => (latestValue(b)?.date ?? '').localeCompare(latestValue(a)?.date ?? '') || a.name.localeCompare(b.name))

  const sheets = (
    <>
      {sheet?.kind === 'add' && <AddSheet onClose={() => setSheet(null)} />}
      {sheet?.kind === 'edit' && <UpdateSheet id={sheet.id} onClose={() => setSheet(null)} />}
    </>
  )

  if (live.length === 0) {
    return (
      <div className="screen" role="dialog" aria-modal="true" aria-label="Portfolio">
        <ScreenHeader title="Portfolio" onBack={onBack} />
        <div className="screen__body">
          <EmptyState title="No portfolio yet" action={<button type="button" className="btn btn--primary" onClick={() => setSheet({ kind: 'add' })}>Add</button>}>
            List what you own and what you owe, and this page works out your net worth. It is in rupees and stays on this phone.
          </EmptyState>
        </div>
        {sheets}
      </div>
    )
  }

  const kindRows = (rows: typeof split, side: Dec) =>
    rows.map((r) => (
      <div key={r.kind} className="budget__row budget__row--plain">
        <span className="row__label">{KIND_LABEL[r.kind]}</span>
        <span className="budget__amt spend__amt">{shown(r.total)}</span>
        <Bar pct={pctOf(r.total, side)} />
        <span className="budget__note">{r.count} {r.count === 1 ? 'item' : 'items'} · {Math.round(pctOf(r.total, side))}% of {r.liability ? 'what you owe' : 'what you own'}</span>
      </div>
    ))

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="Portfolio">
      <ScreenHeader title="Portfolio" onBack={onBack} />
      <div className="screen__body">
        <div className="sections">
          <section className="sect" aria-label="Net worth">
            <div className="budget__sum">
              <span className="result__label">Net worth</span>
              {!hidden && total.isNegative() && <span className="budget__note">You owe more than you own</span>}
              <FitHero text={shown(total)} />
              <span className="budget__note">{stale} of {counted} {counted === 1 ? 'value' : 'values'} older than {STALE_DAYS} days</span>
              {stale > 0 && oldest && <span className="budget__note">Includes values from {shortDate(Date.parse(`${oldest}T00:00:00`))}</span>}
              <button type="button" className="link-btn" aria-pressed={!hidden} onClick={() => setHidden((h) => !h)}>{hidden ? 'Show amounts' : 'Hide amounts'}</button>
            </div>
          </section>

          {owns.length > 0 && <Section title="What you own">{kindRows(owns, ownTotal)}</Section>}
          {owes.length > 0 && <Section title="What you owe">{kindRows(owes, oweTotal)}</Section>}

          {months.length > 1 && (
            <Section title="Last 6 months">
              {[...months].reverse().map((m) => {
                const left = m.excluded.map((id) => names.get(id)).filter((n): n is string => !!n)
                return (
                  <div className="budget__row budget__row--plain" key={m.month}>
                    <span className="row__label">{monthShortLabel(m.month)}</span>
                    <span className="budget__amt spend__amt">{shown(m.total)}</span>
                    <Bar pct={pctOf(m.total.abs(), peak)} />
                    {left.length > 0 && <span className="budget__note">Leaves out {left.join(', ')}: no value yet</span>}
                  </div>
                )
              })}
            </Section>
          )}

          <Section title="Your list" count={live.length}>
            {holdings.map((h) => (
              <HoldingRow key={h.id} h={h} today={today} shown={shown} onOpen={() => setSheet({ kind: 'edit', id: h.id })} />
            ))}
            <div className="manage__actions">
              <button type="button" className="btn btn--primary" onClick={() => setSheet({ kind: 'add' })}>Add</button>
            </div>
          </Section>
        </div>
      </div>
      {sheets}
    </div>
  )
}

function HoldingRow({ h, today, shown, onOpen }: { h: Holding; today: string; shown: (v: Dec) => string; onOpen: () => void }) {
  const v = latestValue(h)
  if (!v) return null
  const old = isOld(v.date, today)
  const words = `${updatedWords(v.date, today)}${old ? ' · old' : ''}`
  const kind = `${KIND_LABEL[h.kind]}${isLiability(h.kind) ? ' · you owe this' : ''}`
  return (
    <div className="bills__item">
      <button type="button" className="budget__row tap-row" aria-label={`Update value of ${h.name}. ${kind}. ${words}`} onClick={onOpen}>
        <span className="row__label">{h.name}</span>
        <span className="budget__amt spend__amt">{shown(new D(v.amount))}</span>
        <Icon name="chevron" size={18} className="tap-row__chev" />
        <span className="budget__note">{kind}</span>
        <span className="budget__note">{words}</span>
      </button>
    </div>
  )
}

/** Name, kind, first value and its day. */
function AddSheet({ onClose }: { onClose: () => void }) {
  const store = useAppStore()
  const today = dayText(Date.now())
  const [name, setName] = useState('')
  const [kind, setKind] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)
  const guard = useDiscardGuard(name !== '' || kind !== '' || amount !== '' || date !== today, onClose)

  const errors = validateHolding({ name, kind, amount, date }, today)
  const shownErr = (f: keyof typeof errors) => (submitted || touched[f] ? errors[f] : undefined)
  const touch = (f: string) => () => setTouched((t) => ({ ...t, [f]: true }))
  const aria = (f: keyof typeof errors) => ({ 'aria-invalid': shownErr(f) ? (true as const) : undefined, 'aria-describedby': shownErr(f) ? `pf-${f}-msg` : undefined })

  const save = () => {
    setSubmitted(true)
    const first = (['name', 'kind', 'amount', 'date'] as const).find((f) => errors[f])
    if (first) return focusField(`pf-${first}`)
    if (store.getState().addHolding({ name, kind: kind as HoldingKind, amount, date })) return onClose()
    setStoreError(store.getState().notice?.text ?? 'Could not save this')
  }

  return (
    <Sheet
      title="Add to portfolio"
      onClose={guard.requestClose}
      footer={
        <GuardedFooter guard={guard} question="Discard what you typed?">
          <button type="button" className="btn btn--primary" onClick={save}>Add</button>
        </GuardedFooter>
      }
    >
      <div className="save">
        <RequiredNote />
        {storeError && <p className="ffield__error" role="alert">{storeError}</p>}
        <div className="save__card" style={tintStyle(7)}>
          <FormField label="Name" htmlFor="pf-name" required error={shownErr('name')}>
            <input id="pf-name" className="field" value={name} maxLength={60} autoComplete="off" aria-required="true" onChange={(e) => setName(e.target.value)} onBlur={touch('name')} {...aria('name')} />
          </FormField>
          <FormField label="Kind" htmlFor="pf-kind" required error={shownErr('kind')}>
            <PickerSelect id="pf-kind" label="Kind" title="What kind is it?" value={kind} placeholder="Choose" options={KIND_OPTIONS} invalid={!!shownErr('kind')} describedBy={shownErr('kind') ? 'pf-kind-msg' : undefined} onChange={(v) => { setKind(v); touch('kind')() }} />
          </FormField>
          <FormField label="Value today, in rupees" htmlFor="pf-amount" required error={shownErr('amount')} hint="For a loan or card due, the amount you owe">
            <MoneyInput id="pf-amount" value={amount} onChange={setAmount} onBlur={touch('amount')} invalid={!!shownErr('amount')} describedBy={shownErr('amount') ? 'pf-amount-msg' : undefined} />
          </FormField>
          <FormField label="As of" htmlFor="pf-date" required error={shownErr('date')} hint="The day this value is from">
            <input id="pf-date" className="field field--mono field--date" type="date" max={today} aria-required="true" value={date} onChange={(e) => setDate(e.target.value)} onBlur={touch('date')} {...aria('date')} />
          </FormField>
        </div>
      </div>
    </Sheet>
  )
}

/** A new value for one holding: the number is the last one, the day is today. A value on a day that already has one replaces it. */
function UpdateSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const holding = useApp((s) => s.portfolio.find((h) => h.id === id && h.deletedAt === null))
  const store = useAppStore()
  const today = dayText(Date.now())
  const last = holding ? latestValue(holding) : null
  const [start] = useState(() => ({ name: holding?.name ?? '', amount: last?.amount ?? '' }))
  const [amount, setAmount] = useState(start.amount)
  const [date, setDate] = useState(today)
  const [name, setName] = useState(start.name)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)
  const guard = useDiscardGuard(amount !== start.amount || date !== today || name !== start.name, onClose)
  if (!holding || !last) return null

  const errors = validateHolding({ name, kind: holding.kind, amount, date }, today)
  const shownErr = (f: 'name' | 'amount' | 'date') => (submitted || touched[f] ? errors[f] : undefined)
  const touch = (f: string) => () => setTouched((t) => ({ ...t, [f]: true }))
  const aria = (f: 'name' | 'amount' | 'date') => ({ 'aria-invalid': shownErr(f) ? (true as const) : undefined, 'aria-describedby': shownErr(f) ? `pfu-${f}-msg` : undefined })
  const replaces = holding.values.some((v) => v.date === date)

  const save = () => {
    setSubmitted(true)
    const first = (['amount', 'date', 'name'] as const).find((f) => errors[f])
    if (first) return focusField(`pfu-${first}`)
    const s = store.getState()
    if (cleanHoldingName(name) !== holding.name && !s.renameHolding(id, name)) return setStoreError(store.getState().notice?.text ?? 'Could not rename this')
    if (s.updateHoldingValue(id, { amount, date })) return onClose()
    setStoreError(store.getState().notice?.text ?? 'Could not save this value')
  }

  return (
    <Sheet
      title="Update value"
      onClose={guard.requestClose}
      footer={
        <GuardedFooter guard={guard} question="Discard your changes?">
          <button type="button" className="btn btn--primary" onClick={save}>Save</button>
        </GuardedFooter>
      }
    >
      <div className="save">
        <RequiredNote />
        {storeError && <p className="ffield__error" role="alert">{storeError}</p>}
        <div className="save__card" style={tintStyle(7)}>
          <FormField label={`Value of ${holding.name}, in rupees`} htmlFor="pfu-amount" required error={shownErr('amount')} hint={`Last value was from ${shortDate(Date.parse(`${last.date}T00:00:00`))}`}>
            <MoneyInput id="pfu-amount" value={amount} onChange={setAmount} onBlur={touch('amount')} invalid={!!shownErr('amount')} describedBy={shownErr('amount') ? 'pfu-amount-msg' : undefined} />
          </FormField>
          <FormField label="As of" htmlFor="pfu-date" required error={shownErr('date')} hint={replaces ? 'This day already has a value. Saving replaces it' : 'The day this value is from'}>
            <input id="pfu-date" className="field field--mono field--date" type="date" max={today} aria-required="true" value={date} onChange={(e) => setDate(e.target.value)} onBlur={touch('date')} {...aria('date')} />
          </FormField>
          <FormField label="Name" htmlFor="pfu-name" required error={shownErr('name')}>
            <input id="pfu-name" className="field" value={name} maxLength={60} autoComplete="off" aria-required="true" onChange={(e) => setName(e.target.value)} onBlur={touch('name')} {...aria('name')} />
          </FormField>
        </div>
        <div>
          <button type="button" className="link-btn link-btn--danger" onClick={() => { store.getState().deleteHolding(id); onClose() }}>Remove this from the list</button>
        </div>
      </div>
    </Sheet>
  )
}
