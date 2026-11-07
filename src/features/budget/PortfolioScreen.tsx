import { useState, type CSSProperties } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { FormField, RequiredNote } from '../../components/FormField'
import { Icon } from '../../components/Icon'
import { PickerSelect, type PickOption } from '../../components/PickerSelect'
import { Sheet } from '../../components/Sheet'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { D, type Dec } from '../../engine'
import {
  ASSET_KINDS,
  isLegacyKind,
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
import { DATE_LOCALE } from '../../lib/dateLocale'
import { GuardedFooter, MoneyInput, focusField, useDiscardGuard } from './formKit'
import { FitHero, useMoney } from './SpendSummary'

const HIDDEN = '••••'
/** A trend column's label: just the month ("Jun"); the full month and year are in the chart's spoken label. */
const MONTH = new Intl.DateTimeFormat(DATE_LOCALE, { month: 'short' })
type SheetState = null | { kind: 'add' } | { kind: 'edit'; id: string }

/** The kinds the form offers: the old bundled groups stay valid for saved data but are not offered for new holdings. */
const KIND_OPTIONS: PickOption[] = [
  ...ASSET_KINDS.filter((k) => !isLegacyKind(k)).map((k) => ({ value: k, label: KIND_ONE[k], group: 'I own this' })),
  ...LIABILITY_KINDS.map((k) => ({ value: k, label: KIND_ONE[k], group: 'I owe this' })),
]

const pctOf = (part: Dec, whole: Dec): number => (whole.isZero() ? 0 : part.div(whole).times(100).toNumber())
/** Each kind's mark: one of the eight section inks. Identity only, never good or bad, and always next to its name. */
/** `order` is the kinds on screen right now, so two kinds the user really has never share an ink (there are 15 kinds but 8 inks). */
const kindMark = (k: HoldingKind, order: readonly HoldingKind[]): CSSProperties => ({ background: `var(--tint-${(Math.max(0, order.indexOf(k)) % 8) + 1}-ink)` })

/**
 * Net worth, inside Budget home (the "Net worth" side of its switch). A list of what you own and what you owe, each with
 * one current value and the day it was set. Net worth, the split and the last 6 months are worked out from that
 * (engine/investments/portfolio.ts), never stored. Rupees only.
 *
 * `hidden` ("hide amounts", the eye in Budget's header) belongs to BudgetScreen: never saved, never in a backup, never
 * logged, and it starts hidden. Hidden also hides the bars, because proportions give the split away.
 */
export function PortfolioView({ hidden }: { hidden: boolean }) {
  const portfolio = useApp((s) => s.portfolio)
  const money = useMoney()
  const [sheet, setSheet] = useState<SheetState>(null)

  const today = dayText(Date.now())
  const live = portfolio.filter((h) => h.deletedAt === null)
  const shown = (v: Dec) => (hidden ? HIDDEN : money(v))

  const sheets = (
    <>
      {sheet?.kind === 'add' && <AddSheet onClose={() => setSheet(null)} />}
      {sheet?.kind === 'edit' && <UpdateSheet id={sheet.id} onClose={() => setSheet(null)} />}
    </>
  )

  if (live.length === 0) {
    return (
      <div className="networth" role="region" aria-label="Net worth">
        <EmptyState title="Nothing listed yet" level="h2" action={<button type="button" className="btn btn--primary" onClick={() => setSheet({ kind: 'add' })}>Add</button>}>
          List what you own and what you owe, and this page works out your net worth. It is in rupees and stays on this phone.
        </EmptyState>
        {sheets}
      </div>
    )
  }

  const total = netWorth(live)
  const counted = countedHoldings(live)
  const stale = staleCount(live, today)
  const oldest = oldestAsOf(live)
  const split = splitByKind(live)
  const names = new Map(live.map((h) => [h.id, h.name]))
  const order = split.map((r) => r.kind)
  const months = monthlySeries(live, today).filter((m) => m.included > 0)
  const peak = months.reduce((a, m) => (m.total.abs().gt(a) ? m.total.abs() : a), new D(0))
  const holdings = [...live].sort((a, b) => (latestValue(b)?.date ?? '').localeCompare(latestValue(a)?.date ?? '') || a.name.localeCompare(b.name))
  const negative = !hidden && total.isNegative()
  const staleWords = `${stale} of ${counted} ${counted === 1 ? 'value' : 'values'} older than ${STALE_DAYS} days`

  // One side of the split: a bar (only while amounts show) and a legend that names every colour in words.
  const side = (title: string, rows: typeof split) => {
    if (rows.length === 0) return null
    const whole = rows.reduce((a, r) => a.plus(r.total), new D(0))
    return (
      <div className="networth__side">
        <span className="budget__note">{title}</span>
        {!hidden && (
          <div className="networth__split" aria-hidden="true">
            {rows.map((r) => <span key={r.kind} style={{ ...kindMark(r.kind, order), width: `${pctOf(r.total, whole)}%` }} />)}
          </div>
        )}
        <ul className="networth__legend">
          {rows.map((r) => (
            <li key={r.kind}>
              <span className="networth__dot" style={kindMark(r.kind, order)} aria-hidden="true" />
              <span className="networth__kind">{KIND_LABEL[r.kind]}{hidden ? '' : ` · ${Math.round(pctOf(r.total, whole))}%`}</span>
              <span className="budget__amt">{shown(r.total)}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="networth" role="region" aria-label="Net worth">
      <div className="budget__sum">
        <span className="result__label">Net worth</span>
        <FitHero text={negative ? `−${money(total.abs())}` : shown(total)} negative={negative} />
        {negative && <span className="budget__note">Liabilities are larger than assets</span>}
      </div>

      {stale > 0 ? (
        <div className="networth__stale">
          <Icon name="clock" size={16} />
          <span>
            {staleWords}
            {oldest && <span className="networth__stale-sub">Includes values from {shortDate(Date.parse(`${oldest}T00:00:00`))}</span>}
          </span>
        </div>
      ) : (
        <p className="networth__fresh budget__note">{staleWords}</p>
      )}

      <h2 className="group__title">Split by kind</h2>
      {side('What you own', split.filter((r) => !r.liability))}
      {side('What you owe', split.filter((r) => r.liability))}

      {months.length > 1 && !hidden && (
        <>
          <h2 className="group__title">Last 6 months</h2>
          <div className="networth__trend" role="img" aria-label={`Net worth by month: ${months.map((m) => `${monthShortLabel(m.month)} ${money(m.total)}`).join(', ')}`}>
            {months.map((m, i) => (
              <span key={m.month} className="networth__col">
                <span className="networth__well">
                  <span
                    className={`networth__bar${m.total.isNegative() ? ' networth__bar--negative' : i === months.length - 1 ? ' networth__bar--now' : ''}`}
                    style={{ height: `${Math.max(4, pctOf(m.total.abs(), peak))}%` }}
                  />
                </span>
                <span className="networth__month">{MONTH.format(new Date(`${m.month}-15T00:00:00`))}</span>
              </span>
            ))}
          </div>
          {months.map((m) => {
            const left = m.excluded.map((id) => names.get(id)).filter((n): n is string => !!n)
            return left.length > 0 && <p key={m.month} className="budget__note networth__gap">Leaves out {left.length > 2 ? `${left.length} holdings` : left.join(' and ')} in {monthShortLabel(m.month)}: no value yet</p>
          })}
        </>
      )}

      <h2 className="group__title">Holdings · tap to update</h2>
      {/* By category (what you own first, then what you owe): the category's total, then each holding by name. */}
      {split.map((r) => (
        <section key={r.kind} className="networth__cat" aria-label={KIND_LABEL[r.kind]}>
          <div className="networth__cathead">
            <span className="networth__dot" style={kindMark(r.kind, order)} aria-hidden="true" />
            <h3 className="networth__catname">{KIND_LABEL[r.kind]} · {holdings.filter((h) => h.kind === r.kind).length}</h3>
            <span className="budget__amt">{r.liability && !hidden ? `−${shown(r.total)}` : shown(r.total)}</span>
          </div>
          <div className="group">
            {holdings.filter((h) => h.kind === r.kind).map((h) => (
              <HoldingRow key={h.id} h={h} order={order} today={today} shown={shown} onOpen={() => setSheet({ kind: 'edit', id: h.id })} />
            ))}
          </div>
        </section>
      ))}
      <div className="budget__add">
        <button type="button" className="btn btn--primary" onClick={() => setSheet({ kind: 'add' })}>Add</button>
      </div>
      {sheets}
    </div>
  )
}

function HoldingRow({ h, order, today, shown, onOpen }: { h: Holding; order: readonly HoldingKind[]; today: string; shown: (v: Dec) => string; onOpen: () => void }) {
  const v = latestValue(h)
  if (!v) return null
  const old = isOld(v.date, today)
  const words = `${updatedWords(v.date, today)}${old ? ' · old' : ''}`
  const owe = isLiability(h.kind)
  const kind = `${KIND_LABEL[h.kind]}${owe ? ' · you owe this' : ''}`
  const amount = shown(new D(v.amount))
  return (
    <button type="button" className="networth__row tap-row" aria-label={`Update value of ${h.name}. ${kind}. ${words}`} onClick={onOpen}>
      <span className="networth__dot" style={kindMark(h.kind, order)} aria-hidden="true" />
      <span className="row__text">
        <span className="row__label">{h.name}</span>
        <span className="row__hint networth__age">{old && <Icon name="clock" size={14} />}{owe ? 'you owe this · ' : ''}{words}</span>
      </span>
      <span className="budget__amt">{owe && amount !== HIDDEN ? `−${amount}` : amount}</span>
    </button>
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
  const [kind, setKind] = useState<string>(holding?.kind ?? '')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)
  const guard = useDiscardGuard(amount !== start.amount || date !== today || name !== start.name || kind !== holding?.kind, onClose)
  if (!holding || !last) return null

  const errors = validateHolding({ name, kind: holding.kind, amount, date }, today)
  const shownErr = (f: 'name' | 'amount' | 'date') => (submitted || touched[f] ? errors[f] : undefined)
  const touch = (f: string) => () => setTouched((t) => ({ ...t, [f]: true }))
  const aria = (f: 'name' | 'amount' | 'date') => ({ 'aria-invalid': shownErr(f) ? (true as const) : undefined, 'aria-describedby': shownErr(f) ? `pfu-${f}-msg` : undefined })
  const replaces = holding.values.some((v) => v.date === date)
  // Same side only (own to own, owe to owe), so net worth never flips sign. The current kind stays listed even if it is an old group.
  const sameSide = KIND_OPTIONS.filter((o) => isLiability(o.value as HoldingKind) === isLiability(holding.kind)).concat(isLegacyKind(holding.kind) ? [{ value: holding.kind, label: KIND_ONE[holding.kind], group: 'I own this' }] : [])

  const save = () => {
    setSubmitted(true)
    const first = (['amount', 'date', 'name'] as const).find((f) => errors[f])
    if (first) return focusField(`pfu-${first}`)
    const s = store.getState()
    if (cleanHoldingName(name) !== holding.name && !s.renameHolding(id, name)) return setStoreError(store.getState().notice?.text ?? 'Could not rename this')
    if (kind !== holding.kind && !s.setHoldingKind(id, kind as HoldingKind)) return setStoreError(store.getState().notice?.text ?? 'Could not change the kind')
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
          <FormField label="Kind" htmlFor="pfu-kind" hint={isLegacyKind(holding.kind) ? 'This is an old group. Pick the exact kind' : undefined}>
            <PickerSelect id="pfu-kind" label="Kind" title="What kind is it?" value={kind} options={sameSide} onChange={setKind} />
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
