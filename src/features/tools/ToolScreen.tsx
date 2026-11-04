import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { PickerSelect } from '../../components/PickerSelect'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { useBackHandler } from '../../components/useBackHandler'
import { magnitudeWords, type NumberSystem } from '../../lib/format'
import {
  defaultValues,
  exampleFieldsInUse,
  isError,
  labelOf,
  parseNum,
  type Field,
  type Fmt,
  type Output,
  type ResultChart,
  type ResultTable,
  type ToolSpec,
  type Values,
} from '../../lib/tool'
import { formatCell } from '../../lib/toolFormat'
import { ratesLine } from '../../lib/ratesFresh'
import { invalidFieldIds } from '../../lib/toolInvalid'
import type { AppStore, CardDraft } from '../../store/app'
import type { SavedCard } from '../../store/types'
import { SaveSheet } from '../memory/SaveSheet'
import { ToListSheet } from '../memory/ToListSheet'
import { ScreenHeader } from '../../components/ScreenHeader'
import { tintStyle } from '../../components/tint'
import { buildShareText, inputLines } from '../../lib/shareText'
import { KeepAndShare } from './KeepAndShare'
import { UseInSheet } from './UseInSheet'
import { ExpenseSheet } from '../budget/sheets'
import { EMI_REMINDER_DAY, suggestionFor } from '../../lib/suggest'
import { nextOnDay } from '../../lib/reminders'
import { ALL_TOOLS } from './registry'
import { linkable, linkTargets, linkText } from '../../lib/toolLink'
import { groupOfTool } from './groups'
import { Segmented } from '../settings/controls'
import { bumpUse, togglePinned } from '../../lib/toolUse'
import { addAmount, advancedOpen, caretFor, chipSteps, groupTyped, migrateLegacyTerm, rawNumber, shouldGroup, significantBefore, type Leaf } from './fieldInput'

const UNIT_LABEL = { rupee: '₹', percent: '%', years: 'years', months: 'months', days: 'days', none: '' } as const

/** A number box. Money and counts show grouping as you type (50,00,000); the stored text stays plain digits. */
function NumberInput({ field, id, value, onChange, describedBy, invalid, words, chips }: {
  field: Extract<Leaf, { kind: 'number' }>
  id: string
  value: string
  onChange: (v: string) => void
  describedBy?: string
  invalid?: boolean
  words?: boolean
  /** Quick-add chips (+1K, +10K, +1L) under the box. Loan and investment money fields. */
  chips?: boolean
}) {
  const system = useApp((s) => s.settings.numberSystem)
  const group = shouldGroup(field)
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const shown = group ? groupTyped(rawNumber(value), system) : value
  const unit = field.unit && field.unit !== 'none' ? UNIT_LABEL[field.unit] : ''
  const echo = words && field.unit === 'rupee' ? wordsFor(value, system) : null

  // Put the caret back after the same digit once the commas have moved.
  useLayoutEffect(() => {
    const el = ref.current
    if (caret.current !== null && el && document.activeElement === el) {
      const at = caretFor(shown, caret.current)
      el.setSelectionRange(at, at)
    }
    caret.current = null
  })

  return (
    <>
      <span className="field-wrap">
        {field.unit === 'rupee' && <span className="field-unit">{unit}</span>}
        <input
          ref={ref}
          id={id}
          className="field field--mono"
          inputMode="decimal"
          autoComplete="off"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          value={shown}
          onChange={(e) => {
            const text = e.target.value
            if (!group) return onChange(text)
            caret.current = significantBefore(text, e.target.selectionStart ?? text.length)
            onChange(rawNumber(text))
          }}
        />
        {field.unit && field.unit !== 'rupee' && unit && <span className="field-unit">{unit}</span>}
      </span>
      {echo && <span className="field-words">{echo}</span>}
      {chips && (
        <span className="chips" role="group" aria-label={`Add to ${field.label}`}>
          {chipSteps(system).map((c) => (
            <button
              key={c.step}
              type="button"
              className="chip"
              aria-label={`Add ${c.spoken}`}
              // Keep the caret in the box: the chip adds to what is typed, it does not take over the keyboard.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const next = addAmount(value, c.step)
                if (next !== null) onChange(next)
              }}
            >
              {c.label}
            </button>
          ))}
        </span>
      )}
    </>
  )
}

const wordsFor = (value: string, system: NumberSystem) => {
  const n = parseNum(value)
  return n ? magnitudeWords(n, system) : null
}

/** One input. `value` is the typed text; the screen never parses it, the spec does. */
function Input({ field, value, onChange, describedBy, invalid, words, chips }: {
  field: Leaf
  value: string
  onChange: (v: string) => void
  describedBy?: string
  invalid?: boolean
  words?: boolean
  chips?: boolean
}) {
  const id = `f-${field.id}`
  if (field.kind === 'select') {
    return field.options.length <= 3 ? (
      <Segmented label={field.label} value={value} options={field.options} onChange={onChange} />
    ) : (
      <PickerSelect id={id} label={field.label} value={value} options={field.options} onChange={onChange} describedBy={describedBy} invalid={invalid} />
    )
  }
  if (field.kind === 'date' || field.kind === 'time') {
    return <input id={id} className="field field--mono field--date" type={field.kind} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={value} onChange={(e) => onChange(e.target.value)} />
  }
  if (field.kind === 'text') {
    const box = <input id={id} className="field" type="text" aria-describedby={describedBy} aria-invalid={invalid || undefined} value={value} onChange={(e) => onChange(e.target.value)} />
    const chip = field.chip?.(value)
    return chip ? (
      <span className="field-wrap">
        {box}
        <span className="field-unit">{chip}</span>
      </span>
    ) : box
  }
  return <NumberInput field={field} id={id} value={value} onChange={onChange} describedBy={describedBy} invalid={invalid} words={words} chips={chips} />
}

type SetValue = (id: string, v: string | string[][]) => void

/** The id of the message under the form: every marked box points at it, so a screen reader reads why. */
const ERROR_ID = 'tool-error'

function FieldRow({ field: base, values, set, invalid, chips }: { field: Field; values: Values; set: SetValue; invalid: boolean; chips?: boolean }) {
  if (base.visibleIf && !base.visibleIf(values)) return null
  const field = base.labelFor ? { ...base, label: labelOf(base, values) } : base

  if (field.kind === 'rows') {
    const rows = (values[field.id] as string[][]) ?? []
    const setCell = (r: number, c: number, v: string) => set(field.id, rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)))
    return (
      <fieldset className="rows" data-invalid={invalid || undefined} aria-describedby={invalid ? ERROR_ID : undefined}>
        <legend className="field-label">{field.label}</legend>
        {field.hint && <p className="rows__hint">{field.hint}</p>}
        {rows.map((row, r) => (
          <div className={field.columns.length > 3 ? 'rows__row rows__row--wrap' : 'rows__row'} key={r}>
            {field.columns.map((col, c) => (
              <label className="rows__cell" key={col.id}>
                <span className="rows__cap">{col.label}</span>
                <Input field={col} value={row[c] ?? ''} onChange={(v) => setCell(r, c, v)} />
              </label>
            ))}
            {rows.length > field.min && (
              <button type="button" className="icon-btn" aria-label={`Remove row ${r + 1}`} title={`Remove row ${r + 1}`} onClick={() => set(field.id, rows.filter((_, i) => i !== r))}>
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
        ))}
        {rows.length < field.max && (
          <button type="button" className="btn" onClick={() => set(field.id, [...rows, field.columns.map(() => '')])}>
            Add row
          </button>
        )}
      </fieldset>
    )
  }

  const value = (values[field.id] as string) ?? ''
  const hintId = field.hint ? `h-${field.id}` : undefined
  const describedBy = [hintId, invalid ? ERROR_ID : undefined].filter(Boolean).join(' ') || undefined
  return (
    <div className="field-row" data-invalid={invalid || undefined}>
      <label className="field-label" htmlFor={`f-${field.id}`}>
        {field.label}
      </label>
      <Input field={field} value={value} onChange={(v) => set(field.id, v)} describedBy={describedBy} invalid={invalid} words chips={chips && field.kind === 'number' && field.unit === 'rupee'} />
      {field.hint && (
        <span id={hintId} className="field-hint">
          {field.hint}
        </span>
      )}
    </div>
  )
}

/** The fields of one list. Neighbours sharing a `cluster` heading are drawn as one compact block (advance tax: the four payments). */
function FieldList({ fields, values, set, invalidIds, chips }: { fields: Field[]; values: Values; set: SetValue; invalidIds: Set<string>; chips: boolean }) {
  const out: React.ReactNode[] = []
  for (let i = 0; i < fields.length; ) {
    const f = fields[i]!
    if (!f.cluster) {
      out.push(<FieldRow key={f.id} field={f} values={values} set={set} invalid={invalidIds.has(f.id)} chips={chips && !f.advanced} />)
      i++
      continue
    }
    let j = i
    while (j < fields.length && fields[j]!.cluster === f.cluster) j++
    out.push(
      <fieldset className="cluster" key={f.id}>
        <legend className="field-label">{f.cluster}</legend>
        <div className="cluster__grid">
          {fields.slice(i, j).map((g) => (
            <FieldRow key={g.id} field={g} values={values} set={set} invalid={invalidIds.has(g.id)} chips={chips && !g.advanced} />
          ))}
        </div>
      </fieldset>,
    )
    i = j
  }
  return <>{out}</>
}

/**
 * Two columns stay a table. Three or more become one block per row: the first cell is its heading and every other
 * cell is a labelled value beneath it. That is the phone pattern for a table (no sideways scrolling), and it suits
 * what these are: schedules and comparisons read one row at a time. Values never break across lines.
 */
function Table({ table, fmt }: { table: ResultTable; fmt: (c: Parameters<typeof formatCell>[0], f?: Fmt) => string }) {
  if (table.columns.length <= 2) {
    // Label and value, side by side while they fit, stacked when they do not (a big number or a big font).
    return (
      <div className="kv-wrap">
        {table.title && <h3 className="result__sub">{table.title}</h3>}
        <ul className="kv" aria-label={table.title ?? 'Table'}>
          {table.rows.map((row, i) => (
            <li className="kv__row" key={i}>
              <span className="kv__k">{fmt(row[0] ?? '', table.fmts?.[0])}</span>
              {row[1] !== undefined && <span className="kv__v">{fmt(row[1], table.fmts?.[1])}</span>}
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return (
    <div className="rowcards-wrap">
      {table.title && <h3 className="result__sub">{table.title}</h3>}
      <ol className="rowcards" aria-label={table.title ?? 'Table'}>
        {table.rows.map((row, i) => (
          <li className="rowcard" key={i}>
            {/* A bare number heading ("1") says nothing: put the column's name in front ("Year 1"). */}
            <p className="rowcard__title">
              {typeof row[0] === 'string' && !/^\d+$/.test(row[0]) ? row[0] : `${table.columns[0]} ${fmt(row[0] ?? '', table.fmts?.[0])}`}
            </p>
            <dl className="rowcard__grid">
              {row.slice(1).map((cell, j) => (
                <div className="rowcard__cell" key={j}>
                  <dt>{table.columns[j + 1]}</dt>
                  <dd>{fmt(cell, table.fmts?.[j + 1])}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Stacked bars, drawn in SVG. The first series sits at the bottom. */
function Chart({ chart }: { chart: ResultChart }) {
  const W = 320
  const H = 140
  const n = chart.labels.length
  const totals = chart.labels.map((_, i) => chart.series.reduce((s, x) => s + (x.values[i] ?? 0), 0))
  const max = Math.max(...totals, 1)
  const slot = W / Math.max(n, 1)
  const bar = Math.max(Math.min(slot * 0.7, 28), 2)
  // Neutral tones only: accent means "you can act on this", not "this series".
  const fills = ['var(--ink-3)', 'var(--ink)', 'var(--ink-2)']
  const step = Math.max(1, Math.ceil(n / 8))
  return (
    <figure className="chart">
      <figcaption className="result__sub">{chart.title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`${chart.title}: ${chart.series.map((s) => s.name).join(', ')}`}>
        {chart.labels.map((label, i) => {
          let y = H
          return (
            <g key={label + i}>
              {chart.series.map((s, k) => {
                const h = ((s.values[i] ?? 0) / max) * H
                y -= h
                return <rect key={s.name} x={i * slot + (slot - bar) / 2} y={y} width={bar} height={Math.max(h, 0)} fill={fills[k % fills.length]} />
              })}
              {i % step === 0 && (
                <text x={i * slot + slot / 2} y={H + 13} textAnchor="middle" className="chart__tick">
                  {label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="chart__legend">
        {chart.series.map((s, k) => (
          <span key={s.name}>
            <i style={{ background: fills[k % fills.length] }} /> {s.name}
          </span>
        ))}
      </div>
    </figure>
  )
}

function Result({ out, mainRef, verified, rates, examples }: { out: Output; mainRef: React.RefObject<HTMLDivElement>; verified?: ToolSpec['verified']; rates?: ToolSpec['rates']; examples: string[] }) {
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const fmt = (c: Parameters<typeof formatCell>[0], f?: Fmt) => formatCell(c, f, { system, decimals })
  return (
    <section className="result" aria-labelledby="result-head">
      <h2 className="section-head" id="result-head">
        Result
      </h2>
      {out.rows.map((r) => (
        <div key={r.label} ref={r.main ? mainRef : undefined} className={r.main ? 'result__row result__row--main' : 'result__row'}>
          <span className="result__label">{r.label}</span>
          <span className={['result__value', r.tone ? `result__value--${r.tone}` : '', typeof r.value === 'string' ? 'result__value--text' : ''].filter(Boolean).join(' ')}>
            {fmt(r.value, r.fmt)}
            {/* Colour is never the only signal: a screen reader, and anyone who cannot
                separate red from green, gets the meaning in words. */}
            {r.tone && <span className="sr-only">{r.tone === 'positive' ? ' — in your favour' : ' — against you'}</span>}
          </span>
        </div>
      ))}
      {out.note && <p className="result__note">{out.note}</p>}
      {out.span && (
        // Says nothing the rows above do not: hidden from a screen reader so it is not read twice.
        <div className="span" aria-hidden="true">
          <span className="span__end">{out.span.start}</span>
          <span className="span__end span__end--to">{out.span.end}</span>
          <span className="span__bar">
            <span className="span__count">{out.span.between}</span>
          </span>
        </div>
      )}
      {verified && <p className="result__checked">Checked against {verified.source}</p>}
      {rates && <p className="result__checked">{ratesLine(rates, Date.now())}</p>}
      {examples.length > 0 && <p className="result__checked">Uses example values for {examples.join(', ').toLowerCase()}. Check them under More options.</p>}
      {out.chart && <Chart chart={out.chart} />}
      {out.table && <Table table={out.table} fmt={fmt} />}
      {out.formula && (
        <details className="formula">
          <summary>How this is worked out</summary>
          {out.formula.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </details>
      )}
    </section>
  )
}

/**
 * What the user last typed into each calculator lives in the store (`drafts`, saved with the rest), so leaving for another tab,
 * or closing the app, does not throw the numbers away. Reset clears it. Not kept for a saved card, which has its own stored inputs.
 */

/** Puts one value into one box of a calculator before it opens ("Use in another tool"). Every other box stays as it was. */
export function prefillDraft(store: AppStore, spec: ToolSpec, fieldId: string, value: string) {
  store.getState().setDraft(spec.id, { ...defaultValues(spec), ...store.getState().drafts[spec.id], [fieldId]: value })
}

export function ToolScreen({ spec, onBack, initial, card }: { spec: ToolSpec; onBack: () => void; initial?: Values; card?: SavedCard }) {
  const store = useAppStore()
  const [values, setValues] = useState<Values>(() => migrateLegacyTerm(spec.fields, { ...defaultValues(spec), ...(card ? initial : (store.getState().drafts[spec.id] ?? initial)) }))
  const set = (id: string, v: string | string[][]) => setValues((cur) => ({ ...cur, [id]: v }))
  // Keep the draft in step with what is typed. Back at the starting values (Reset) means no draft at all.
  useEffect(() => {
    if (card) return
    const same = JSON.stringify(values) === JSON.stringify(defaultValues(spec))
    const stored = store.getState().drafts[spec.id]
    if (same ? stored !== undefined : JSON.stringify(stored) !== JSON.stringify(values)) store.getState().setDraft(spec.id, same ? null : values)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values])
  const [saving, setSaving] = useState(false)
  const [listing, setListing] = useState(false)
  const [reminding, setReminding] = useState(false)
  const [using, setUsing] = useState(false)
  const [expensing, setExpensing] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  // The floating answer bar shows only once the real answer has scrolled out of sight.
  const [mainSeen, setMainSeen] = useState(true)
  // Which way the bar's arrow points: the answer is usually above, but it is below while the form is long.
  const [mainAbove, setMainAbove] = useState(true)
  const showCard = useApp((s) => s.showCard)
  const showLinkSnack = useApp((s) => s.showLinkSnack)
  const toast = useApp((s) => s.toast)
  const setTab = useApp((s) => s.setTab)
  // Once "More options" is open (by the user, or by itself because a field changed) it stays open.
  const [moreOpen, setMoreOpen] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(card?.id ?? null)

  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const deleteCard = useApp((s) => s.deleteCard)
  const saved = useApp((s) => s.cards.find((c) => c.id === savedId && c.deletedAt === null))
  const reminder = useApp((s) => s.reminders.find((r) => r.cardId === savedId))
  const dismissedTips = useApp((s) => s.settings.dismissedTips)
  const reminderTime = useApp((s) => s.settings.reminderTime)
  const updateSettings = useApp((s) => s.updateSettings)
  const toolUse = useApp((s) => s.settings.toolUse)
  const pinnedTools = useApp((s) => s.settings.pinnedTools)
  const saveCard = useApp((s) => s.saveCard)
  const updateCard = useApp((s) => s.updateCard)
  const addAdvanceTaxPack = useApp((s) => s.addAdvanceTaxPack)

  // A spec that throws on odd input must not take the app down.
  const computed = useMemo(() => {
    try {
      // An amount no real loan, price or salary reaches: say so, instead of printing 1.2E+25 rupees.
      const tooBig = spec.fields.find((f) => f.kind === 'number' && f.unit === 'rupee' && (parseNum(values[f.id])?.abs().gt('1e13') ?? false))
      if (tooBig) return { error: `${tooBig.label} is too large. Use ₹10 lakh crore or less` }
      return spec.compute(values)
    } catch {
      return { error: 'Check the numbers you entered' }
    }
  }, [spec, values])

  const ok = !isError(computed)
  const main = ok ? (computed.rows.find((r) => r.main) ?? computed.rows[0]) : undefined
  const draft: CardDraft = {
    title: saved?.title ?? spec.title,
    kind: 'tool',
    toolId: spec.id,
    inputs: values,
    summary: main ? `${main.label}: ${formatCell(main.value, main.fmt, { system, decimals })}` : '',
    amount: main && typeof main.value !== 'string' && main.value.isFinite() ? main.value.toFixed() : null,
    // Carried so the card can draw the number as what it is. Without this a date
    // difference was saved as a bare number and shown as "₹300".
    amountFmt: main?.fmt ?? 'number',
    lines: [],
  }

  // A list is a list of *amounts*: it totals them and shows "₹3,000 left". Offering it
  // for 300 days apart, or a BMI of 24.5, produced "₹300" and made no sense.
  const listableAmount = draft.amountFmt === 'money' ? draft.amount : null
  // "Use in another tool" only for a plain number that some other calculator has a box for.
  const link = ok ? linkable(computed) : null
  const canUse = link !== null && linkTargets(ALL_TOOLS, spec.id, link.fmt).length > 0

  // One "next step" chip under the result. Used or dismissed once, it never comes back. Not offered when this EMI already has a reminder.
  const tip = ok && !(reminder && spec.id === 'emi') ? suggestionFor(spec.id, dismissedTips) : null
  const closeTip = () => tip && updateSettings({ dismissedTips: [...dismissedTips, tip.id] })
  const takeTip = () => {
    if (!tip) return
    if (tip.id === 'advance-tax-pack') addAdvanceTaxPack()
    else {
      const rem = { dueAt: nextOnDay(Date.now(), EMI_REMINDER_DAY, reminderTime), repeat: 'monthly' as const, leadDays: 1 }
      if (saved) updateCard(saved.id, {}, rem)
      else setSavedId(saveCard(draft, rem))
      showLinkSnack(`Saved with a reminder every month on the ${EMI_REMINDER_DAY}th`, { label: 'View', run: () => setTab('due') })
    }
    closeTip()
  }

  useBackHandler(true, onBack)

  // One more use for this calculator: "Your tools" on Tools floats the most used ones up. Counted once the screen has
  // stayed open for 1.5 seconds (a stray tap is not a use), and not while the screen is still sliding in.
  useEffect(() => {
    const t = setTimeout(() => updateSettings({ toolUse: bumpUse(toolUse, spec.id) }), 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.id])
  const pinned = pinnedTools.includes(spec.id)
  const togglePin = () => {
    const next = togglePinned(pinnedTools, spec.id)
    if (next === null) return toast('You can pin up to 3 tools. Unpin one first.')
    updateSettings({ pinnedTools: next })
    toast(pinned ? 'Unpinned from Your tools' : 'Pinned to Your tools')
  }

  // Back to the starting values. Undo puts back exactly what was typed. A saved card is not touched until "Update".
  const replaceAll = (next: Values) => setValues(next)
  const reset = () => {
    const before = values
    const fresh = defaultValues(spec)
    if (JSON.stringify(before) === JSON.stringify(fresh)) return toast('Already at the starting values')
    replaceAll(fresh)
    showLinkSnack('Inputs reset', { label: 'Undo', run: () => replaceAll(before) })
  }

  // Quick-add chips only where the amounts are big: loans and investments.
  const chips = spec.category === 'loans' || spec.category === 'invest'
  const visible = spec.fields.filter((f) => !f.advanced)
  const advanced = spec.fields.filter((f) => f.advanced && (!f.visibleIf || f.visibleIf(values)))
  const error = isError(computed) ? computed.error : null
  const invalidIds = useMemo(() => invalidFieldIds(spec, values, error), [spec, values, error])

  const opts = { system, decimals }
  const shareBody = ok
    ? buildShareText({
        title: saved?.title ?? spec.title,
        inputs: inputLines(spec.fields, values, opts),
        rows: computed.rows.map((r) => ({ label: r.label, text: formatCell(r.value, r.fmt, opts) })),
        note: computed.note,
      })
    : ''

  // Watch the main answer row; when it is not on screen, the answer bar floats at the bottom edge.
  //
  // Two thresholds, not one. A single threshold makes the show point and the hide point the same
  // pixel, so a 3px scroll (or one frame of momentum) flips the bar on and off repeatedly. Showing
  // only below 5% and hiding only above 60% leaves a wide band where nothing changes.
  useEffect(() => {
    const target = mainRef.current
    const root = bodyRef.current
    if (!target || !root || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        // Which way to point: the answer is above when its top is past the top of the scrolling box.
        // rootBounds is null in some browsers when the root is cross-origin; fall back to the live box.
        const rootTop = entry.rootBounds?.top ?? root.getBoundingClientRect().top
        setMainAbove(entry.boundingClientRect.top < rootTop)
        if (entry.intersectionRatio >= 0.6) setMainSeen(true)
        else if (entry.intersectionRatio <= 0.05) setMainSeen(false)
        // In between: leave it as it is. That gap is the hysteresis.
      },
      { root, threshold: [0, 0.05, 0.6, 1] },
    )
    io.observe(target)
    return () => io.disconnect()
  }, [ok, computed])

  return (
    <div className="screen" style={tintStyle(groupOfTool(spec.id)?.tint ?? 8)} role="dialog" aria-modal="true" aria-label={spec.title}>
      <ScreenHeader
        title={saved?.title ?? spec.title}
        onBack={onBack}
        icons={
          <>
            <button type="button" className="icon-btn" aria-pressed={pinned} aria-label={pinned ? `Unpin ${spec.title} from Your tools` : `Pin ${spec.title} to Your tools`} title={pinned ? 'Unpin from Your tools' : 'Pin to Your tools'} onClick={togglePin}>
              <Icon name={pinned ? 'pinFilled' : 'pin'} size={20} />
            </button>
            {saved && (
              <button type="button" className="icon-btn" aria-label={`Delete ${saved.title}`} title={`Delete ${saved.title}`} onClick={() => { deleteCard(saved.id); onBack() }}>
                <Icon name="trash" size={20} />
              </button>
            )}
          </>
        }
        action={
          <button
            type="button"
            className="link-btn"
            onClick={() => (ok ? setSaving(true) : toast(isError(computed) ? `${computed.error}. Then you can save it.` : 'Fill in the form first'))}
          >
            {saved ? 'Update' : 'Save'}
          </button>
        }
      />
      <div className="screen__body tool" ref={bodyRef}>
        {/* 1. Edit: where you type. A tinted card. */}
        <h2 className="section-head section-head--tint" id="inputs-head">
          What you are working out
        </h2>
        <form className="tool__form inputcard" aria-labelledby="inputs-head" onSubmit={(e) => e.preventDefault()}>
          <FieldList fields={visible} values={values} set={set} invalidIds={invalidIds} chips={chips} />
          {advanced.length > 0 && (
            <details className="more" open={moreOpen || advancedOpen(spec.fields, values)} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
              <summary>More options</summary>
              <div className="more__body">
                <FieldList fields={advanced} values={values} set={set} invalidIds={invalidIds} chips={false} />
              </div>
            </details>
          )}
        </form>
        {error && (
          <p className="tool__error" id={ERROR_ID} role="status">
            {error}
          </p>
        )}

        {/* 2. Result: what it comes to. A plain card, never tinted. */}
        {ok && <Result out={computed} mainRef={mainRef} verified={spec.verified} rates={spec.rates} examples={exampleFieldsInUse(spec, values)} />}

        {ok && computed.expense && computed.expense.amount.gt(0) && (
          <div className="suggest">
            <button type="button" className="link-btn" onClick={() => setExpensing(true)}>Save my share to Budget</button>
          </div>
        )}

        {tip && (
          <div className="suggest">
            <button type="button" className="link-btn" onClick={takeTip}>{tip.text}</button>
            <button type="button" className="icon-btn" aria-label={`Dismiss: ${tip.text}`} title="Not now" onClick={closeTip}>
              <Icon name="close" size={18} />
            </button>
          </div>
        )}

        {/* 3. Keep and share: what to do with it. */}
        {ok && (
          <KeepAndShare
            title={saved?.title ?? spec.title}
            text={shareBody}
            canList={listableAmount !== null}
            onList={() => setListing(true)}
            onRemind={() => setReminding(true)}
            onUse={canUse && !card ? () => setUsing(true) : undefined}
            onReset={reset}
          />
        )}

        {/* Takes no room: while the answer above is out of sight, this button floats at the bottom edge. Tapping it scrolls back to the answer. */}
        {/* The bar stays in the page whenever there is an answer, and only turns invisible — it is never removed.
            Removing it changed the page's height, which meant that arriving at the bottom made the bar appear,
            which made the page taller, which meant you were no longer at the bottom, so the bar stayed pinned
            over the Copy / Share row. Keeping its space always reserved is what stops that. */}
        <div className="answer-anchor">
          {ok && main && (
            <button type="button" className={`answer${mainSeen ? ' answer--idle' : ''}`} aria-hidden={mainSeen || undefined} tabIndex={mainSeen ? -1 : undefined} aria-label={`${main.label}: ${formatCell(main.value, main.fmt, opts)}. Show the result.`} onClick={() => mainRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })}>
              <span className="answer__label">{main.label}</span>
              <span className="answer__value">{formatCell(main.value, main.fmt, opts)}</span>
              {/* Points at where the answer actually is, so the arrow never sends you the wrong way. */}
              <Icon name={mainAbove ? 'up' : 'down'} size={18} className="answer__icon" />
            </button>
          )}
        </div>
      </div>
      {expensing && ok && computed.expense && <ExpenseSheet prefill={{ amount: computed.expense.amount.toDecimalPlaces(2).toFixed(), note: computed.expense.note }} onClose={() => setExpensing(false)} />}
      {using && link && <UseInSheet fromToolId={spec.id} value={link.value} text={linkText(link.value, link.fmt)} fmt={link.fmt} label={link.label} onClose={() => setUsing(false)} />}
      {listing && listableAmount !== null && <ToListSheet value={listableAmount} onClose={() => setListing(false)} onDone={showCard} />}
      {(saving || reminding) && (
        <SaveSheet
          draft={draft}
          card={saved}
          reminder={reminder}
          suggest={reminding ? 'none' : undefined}
          onClose={() => {
            setSaving(false)
            setReminding(false)
          }}
          onSaved={(id) => {
            setSavedId(id)
            showLinkSnack(saved ? 'Updated in Notes' : 'Saved to Notes', { label: 'View', run: () => setTab('saved') })
          }}
        />
      )}
    </div>
  )
}
