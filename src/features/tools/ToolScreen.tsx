import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useApp } from '../../components/StoreProvider'
import { useBackHandler } from '../../components/useBackHandler'
import { magnitudeWords, type NumberSystem } from '../../lib/format'
import {
  defaultValues,
  isError,
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
import type { CardDraft } from '../../store/app'
import type { SavedCard } from '../../store/types'
import { SaveSheet } from '../memory/SaveSheet'
import { ToListSheet } from '../memory/ToListSheet'
import { ScreenHeader } from '../../components/ScreenHeader'
import { tintStyle } from '../../components/tint'
import { buildShareText, inputLines } from '../../lib/shareText'
import { KeepAndShare } from './KeepAndShare'
import { groupOfTool } from './groups'
import { Segmented } from '../settings/controls'
import { advancedOpen, caretFor, groupTyped, rawNumber, shouldGroup, significantBefore, type Leaf } from './fieldInput'

const UNIT_LABEL = { rupee: '₹', percent: '%', years: 'years', months: 'months', days: 'days', none: '' } as const

/** A number box. Money and counts show grouping as you type (50,00,000); the stored text stays plain digits. */
function NumberInput({ field, id, value, onChange, describedBy, invalid, words }: {
  field: Extract<Leaf, { kind: 'number' }>
  id: string
  value: string
  onChange: (v: string) => void
  describedBy?: string
  invalid?: boolean
  words?: boolean
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
    </>
  )
}

const wordsFor = (value: string, system: NumberSystem) => {
  const n = parseNum(value)
  return n ? magnitudeWords(n, system) : null
}

/** One input. `value` is the typed text; the screen never parses it, the spec does. */
function Input({ field, value, onChange, describedBy, invalid, words }: {
  field: Leaf
  value: string
  onChange: (v: string) => void
  describedBy?: string
  invalid?: boolean
  words?: boolean
}) {
  const id = `f-${field.id}`
  if (field.kind === 'select') {
    return field.options.length <= 3 ? (
      <Segmented label={field.label} value={value} options={field.options} onChange={onChange} />
    ) : (
      <select id={id} className="field" aria-describedby={describedBy} value={value} onChange={(e) => onChange(e.target.value)}>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }
  if (field.kind === 'date') {
    return <input id={id} className="field field--mono field--date" type="date" aria-describedby={describedBy} value={value} onChange={(e) => onChange(e.target.value)} />
  }
  if (field.kind === 'text') {
    return <input id={id} className="field" type="text" aria-describedby={describedBy} value={value} onChange={(e) => onChange(e.target.value)} />
  }
  return <NumberInput field={field} id={id} value={value} onChange={onChange} describedBy={describedBy} invalid={invalid} words={words} />
}

type SetValue = (id: string, v: string | string[][]) => void

function FieldRow({ field, values, set, error }: { field: Field; values: Values; set: SetValue; error: string | null }) {
  if (field.visibleIf && !field.visibleIf(values)) return null

  if (field.kind === 'rows') {
    const rows = (values[field.id] as string[][]) ?? []
    const setCell = (r: number, c: number, v: string) => set(field.id, rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)))
    return (
      <fieldset className="rows">
        <legend className="field-label">{field.label}</legend>
        {rows.map((row, r) => (
          <div className="rows__row" key={r}>
            {field.columns.map((col, c) => (
              <label className="rows__cell" key={col.id}>
                <span className="rows__cap">{col.label}</span>
                <Input field={col} value={row[c] ?? ''} onChange={(v) => setCell(r, c, v)} />
              </label>
            ))}
            {rows.length > field.min && (
              <button type="button" className="icon-btn" aria-label={`Remove row ${r + 1}`} onClick={() => set(field.id, rows.filter((_, i) => i !== r))}>
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
  // The spec's own message names the field ("Enter loan amount"), which is how we know which one to point at.
  const invalid = error !== null && error.toLowerCase().includes(field.label.toLowerCase())
  const hintId = field.hint ? `h-${field.id}` : undefined
  return (
    <div className="field-row" data-invalid={invalid || undefined}>
      <label className="field-label" htmlFor={`f-${field.id}`}>
        {field.label}
      </label>
      <Input field={field} value={value} onChange={(v) => set(field.id, v)} describedBy={hintId} invalid={invalid} words />
      {field.hint && (
        <span id={hintId} className="field-hint">
          {field.hint}
        </span>
      )}
    </div>
  )
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

function Result({ out, mainRef }: { out: Output; mainRef: React.RefObject<HTMLDivElement> }) {
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
 * What the user last typed into each calculator this session, so leaving for another tab and coming back
 * does not throw the numbers away. Not kept for a saved card, which has its own stored inputs.
 */
const drafts = new Map<string, Values>()

export function ToolScreen({ spec, onBack, initial, card }: { spec: ToolSpec; onBack: () => void; initial?: Values; card?: SavedCard }) {
  const [values, setValues] = useState<Values>(() => ({ ...defaultValues(spec), ...(card ? initial : (drafts.get(spec.id) ?? initial)) }))
  const set = (id: string, v: string | string[][]) =>
    setValues((cur) => {
      const next = { ...cur, [id]: v }
      if (!card) drafts.set(spec.id, next)
      return next
    })
  const [saving, setSaving] = useState(false)
  const [listing, setListing] = useState(false)
  const [reminding, setReminding] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  // The floating answer bar shows only once the real answer has scrolled out of sight.
  const [mainSeen, setMainSeen] = useState(true)
  const showCard = useApp((s) => s.showCard)
  // Once "More options" is open (by the user, or by itself because a field changed) it stays open.
  const [moreOpen, setMoreOpen] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(card?.id ?? null)

  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const deleteCard = useApp((s) => s.deleteCard)
  const saved = useApp((s) => s.cards.find((c) => c.id === savedId && c.deletedAt === null))
  const reminder = useApp((s) => s.reminders.find((r) => r.cardId === savedId))

  // A spec that throws on odd input must not take the app down.
  const computed = useMemo(() => {
    try {
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

  useBackHandler(true, onBack)

  const visible = spec.fields.filter((f) => !f.advanced)
  const advanced = spec.fields.filter((f) => f.advanced && (!f.visibleIf || f.visibleIf(values)))
  const error = isError(computed) ? computed.error : null

  const opts = { system, decimals }
  const shareBody = ok
    ? buildShareText({
        title: saved?.title ?? spec.title,
        inputs: inputLines(spec.fields, values, opts),
        rows: computed.rows.map((r) => ({ label: r.label, text: formatCell(r.value, r.fmt, opts) })),
        note: computed.note,
      })
    : ''

  // Watch the main answer row; when it is not on screen, the answer bar floats over the top of the page.
  useEffect(() => {
    const target = mainRef.current
    const root = bodyRef.current
    if (!target || !root || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setMainSeen(entry?.isIntersecting ?? true), { root, threshold: 0.2 })
    io.observe(target)
    return () => io.disconnect()
  }, [ok, computed])

  return (
    <div className="screen" style={tintStyle(groupOfTool(spec.id)?.tint ?? 8)} role="dialog" aria-modal="true" aria-label={spec.title}>
      <ScreenHeader
        title={saved?.title ?? spec.title}
        onBack={onBack}
        icons={
          saved && (
            <button type="button" className="icon-btn" aria-label={`Delete ${saved.title}`} onClick={() => { deleteCard(saved.id); onBack() }}>
              <Icon name="trash" size={20} />
            </button>
          )
        }
        action={
          <button type="button" className="link-btn" disabled={!ok} onClick={() => setSaving(true)}>
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
          {visible.map((f) => (
            <FieldRow key={f.id} field={f} values={values} set={set} error={error} />
          ))}
          {advanced.length > 0 && (
            <details className="more" open={moreOpen || advancedOpen(spec.fields, values)} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
              <summary>More options</summary>
              <div className="more__body">
                {advanced.map((f) => (
                  <FieldRow key={f.id} field={f} values={values} set={set} error={error} />
                ))}
              </div>
            </details>
          )}
        </form>
        {error && (
          <p className="tool__error" role="status">
            {error}
          </p>
        )}

        {/* 2. Result: what it comes to. A plain card, never tinted. */}
        {ok && <Result out={computed} mainRef={mainRef} />}

        {/* 3. Keep and share: what to do with it. */}
        {ok && (
          <KeepAndShare
            title={saved?.title ?? spec.title}
            text={shareBody}
            canList={listableAmount !== null}
            onList={() => setListing(true)}
            onRemind={() => setReminding(true)}
          />
        )}

        {/* Takes no room: while the answer above is out of sight, this button floats at the bottom edge. Tapping it scrolls back to the answer. */}
        <div className="answer-anchor">
          {ok && main && !mainSeen && (
            <button type="button" className="answer" aria-label={`${main.label}: ${formatCell(main.value, main.fmt, opts)}. Show the result.`} onClick={() => mainRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })}>
              <span className="answer__label">{main.label}</span>
              <span className="answer__value">{formatCell(main.value, main.fmt, opts)}</span>
            </button>
          )}
        </div>
      </div>
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
          onSaved={setSavedId}
        />
      )}
    </div>
  )
}
