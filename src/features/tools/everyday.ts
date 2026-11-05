import { D, type Dec } from '../../engine'
import { convertCurrency } from '../../engine/convert/currency'
import { CURRENCY_NAMES, CURRENCY_SNAPSHOT } from '../../engine/convert/currencySnapshot'
import { getCurrencyRates, primeCurrencyRates } from '../../lib/currencyRates'
import { discount } from '../../engine/convert/discount'
import { fuelCost, fuelEfficiency, type EfficiencyUnit } from '../../engine/convert/fuel'
import { gst } from '../../engine/convert/gst'
import { GST_PRESETS, GST_RATES_AS_OF, RATES_AS_OF } from '../../engine/convert/gstRates'
import { bitOps, parseBase, toBase, type Base } from '../../engine/convert/numberBase'
import { percentage, type PercentMode } from '../../engine/convert/percentage'
import { tip } from '../../engine/convert/tip'
import { settleUp, splitBill, type SplitMode } from '../../engine/convert/split'
import { UNIT_CATEGORIES, convertAll, convertUnit } from '../../engine/convert/units'
import { STANDARD_UNIT, unitPrices, type PriceUnit } from '../../engine/convert/unitPrice'
import { addDays, addMonths, addYears, daysBetween, formatDate, parseDate, ymd } from '../../engine/everyday/dates'
import { bodyMetrics, type Activity, type Sex } from '../../engine/everyday/body'
import { gradeAverage } from '../../engine/everyday/grades'
import { ovulation } from '../../engine/everyday/ovulation'
import { CITIES, instantAt, todayIn, worldTimes } from '../../engine/everyday/worldTime'
import { need, parseNum, type Computed, type Field, type ResultTable, type ToolSpec, type Values } from '../../lib/tool'

/** An optional number: blank means `fallback`, junk text is an error (null). */
function opt(values: Values, id: string, fallback = '0'): Dec | null {
  const t = values[id]
  return typeof t === 'string' && t.trim() === '' ? new D(fallback) : parseNum(t)
}
const str = (v: Values, id: string): string => (typeof v[id] === 'string' ? (v[id] as string) : '')
const plain = (d: Dec): string => d.toFixed()
const today = (): Date => {
  const n = new Date()
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))
}

/** What the two boxes mean in each mode. The ids stay x and y. */
const PERCENT_LABELS: Record<PercentMode, [string, string]> = {
  of: ['Percent', 'Of this number'],
  whatPercent: ['Part', 'Whole'],
  change: ['Old value', 'New value'],
}

const percentSpec: ToolSpec = {
  id: 'percentage',
  title: 'Percentage',
  blurb: 'Percent of a number, or percent change',
  category: 'everyday',
  keywords: ['percent', '%', 'increase', 'decrease'],
  fields: [
    {
      id: 'mode',
      label: 'What to find',
      kind: 'select',
      default: 'of',
      options: [
        { value: 'of', label: 'X% of Y' },
        { value: 'whatPercent', label: 'What %' },
        { value: 'change', label: '% change' },
      ],
    },
    { id: 'x', label: 'Number X', labelFor: (v) => PERCENT_LABELS[v.mode as PercentMode]?.[0] ?? 'Number X', kind: 'number', default: '18' },
    { id: 'y', label: 'Number Y', labelFor: (v) => PERCENT_LABELS[v.mode as PercentMode]?.[1] ?? 'Number Y', kind: 'number', default: '45000' },
  ],
  compute: (v) => {
    const [lx, ly] = PERCENT_LABELS[v.mode as PercentMode] ?? ['Number X', 'Number Y']
    const r = need(v, [{ id: 'x', label: lx }, { id: 'y', label: ly }])
    if (!r.ok) return r
    const mode = v.mode as PercentMode
    const result = percentage(mode, r.n.x!, r.n.y!)
    if (result === null) return { error: mode === 'change' ? "Can't work out a change from zero" : "Can't divide by zero" }
    const formula = {
      of: [`Percent of a number = percent ÷ 100 × number`, `${r.n.x!.toFixed()} ÷ 100 × ${r.n.y!.toFixed()}`],
      whatPercent: [`Part as a percent of the whole = part ÷ whole × 100`, `${r.n.x!.toFixed()} ÷ ${r.n.y!.toFixed()} × 100`],
      change: [`% change = (new − old) ÷ old × 100`, `(${r.n.y!.toFixed()} − ${r.n.x!.toFixed()}) ÷ ${r.n.x!.toFixed()} × 100`],
    }[mode]
    const label = {
      of: `${plain(r.n.x!)}% of ${plain(r.n.y!)}`,
      whatPercent: `${plain(r.n.x!)} as a percent of ${plain(r.n.y!)}`,
      change: `Change from ${plain(r.n.x!)} to ${plain(r.n.y!)}`,
    }[mode]
    return { rows: [{ label, value: result, fmt: mode === 'of' ? 'number' : 'percent', main: true }], formula }
  },
}

// ---- B1 Unit converter ------------------------------------------------------

const UNIT_DEFAULTS: Record<string, [string, string]> = {
  length: ['km', 'mi'], mass: ['kg', 'lb'], volume: ['l', 'galus'], area: ['acre', 'sqft'],
  speed: ['kmh', 'mph'], time: ['h', 'min'], data: ['GB', 'MB'], temperature: ['C', 'F'],
}
const unitFields: Field[] = UNIT_CATEGORIES.flatMap((c): Field[] => {
  const options = c.units.map((u) => ({ value: u.id, label: u.label }))
  const [from, to] = UNIT_DEFAULTS[c.id]!
  const show = (v: Values) => v.category === c.id
  return [
    { id: `from_${c.id}`, label: 'From unit', kind: 'select', options, default: from, visibleIf: show, swapWith: `to_${c.id}` },
    { id: `to_${c.id}`, label: 'To unit', kind: 'select', options, default: to, visibleIf: show },
  ]
})

const unitSpec: ToolSpec = {
  id: 'unit-converter',
  title: 'Unit converter',
  blurb: 'Length, weight, area, temperature and more',
  category: 'everyday',
  verified: { source: 'NIST SP 811 conversion factors' },
  keywords: ['convert', 'length', 'weight', 'mass', 'volume', 'area', 'temperature', 'speed', 'data', 'acre', 'cent', 'sq ft', 'hectare', 'celsius', 'fahrenheit'],
  fields: [
    { id: 'category', label: 'What to convert', kind: 'select', default: 'length', options: UNIT_CATEGORIES.map((c) => ({ value: c.id, label: c.label })) },
    { id: 'value', label: 'Amount to convert', kind: 'number', default: '1' },
    ...unitFields,
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'value', label: 'the amount to convert' }])
    if (!r.ok) return r
    const cat = UNIT_CATEGORIES.find((c) => c.id === v.category)
    const from = cat?.units.find((u) => u.id === v[`from_${cat.id}`])
    const to = cat?.units.find((u) => u.id === v[`to_${cat.id}`])
    if (!cat || !from || !to) return { error: 'Pick the units to convert' }
    const value = r.n.value!
    if (cat.id === 'temperature' && convertUnit('temperature', from.id, 'C', value)!.lt('-273.15')) {
      return { error: "That's below absolute zero (−273.15°C), so it isn't a real temperature" }
    }
    const out = convertUnit(cat.id, from.id, to.id, value)!
    const formula =
      cat.id === 'temperature'
        ? ['Everything goes through Celsius: °C = (°F − 32) × 5 ÷ 9, °F = °C × 9 ÷ 5 + 32, K = °C + 273.15', `${plain(value)} ${from.label} = ${plain(out)} ${to.label}`]
        : ['converted = value × size of from-unit ÷ size of to-unit', `${plain(value)} × ${from.factor} ÷ ${to.factor}`, `Sizes are in ${cat.units.find((u) => u.factor === '1')!.label.toLowerCase()}s`]
    return {
      rows: [{ label: `${from.label} to ${to.label}`, value: out, unit: to.label, timeUnit: cat.id === 'time' ? ({ d: 'days', yr: 'years' } as const)[to.id as 'd' | 'yr'] : undefined, main: true }],
      table: { title: `${plain(value)} ${from.label} in every unit`, columns: ['Unit', 'Value'], fmts: ['text', 'number'], rows: convertAll(cat.id, from.id, value).map((x) => [x.unit.label, x.value]) },
      formula,
    }
  },
}

// ---- B2 Currency ------------------------------------------------------------

// Kicks off a background fetch of live rates the first time this module loads. Never blocks
// rendering and never throws: offline or blocked, the bundled snapshot below still works.
primeCurrencyRates()

// The option list is always the fixed, reviewed set -- a live fetch can update rate numbers,
// never add or remove a currency from what is offered.
const currencyOptions = Object.keys(CURRENCY_SNAPSHOT.perInr).map((c) => ({ value: c, label: `${c} ${CURRENCY_NAMES[c] ?? ''}`.trim() }))
const currencySpec: ToolSpec = {
  id: 'currency',
  title: 'Currency converter',
  blurb: 'About 30 currencies, rates refresh every 6 hours',
  category: 'everyday',
  keywords: ['currency', 'forex', 'exchange', 'dollar', 'usd', 'euro', 'pound', 'yen', 'rate'],
  fields: [
    { id: 'amount', label: 'Amount to convert', kind: 'number', default: '10000' },
    { id: 'from', label: 'From currency', kind: 'select', options: currencyOptions, default: 'INR', swapWith: 'to' },
    { id: 'to', label: 'To currency', kind: 'select', options: currencyOptions, default: 'USD' },
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'amount', label: 'the amount to convert' }])
    if (!r.ok) return r
    const from = str(v, 'from')
    const to = str(v, 'to')
    const rates = getCurrencyRates()
    const c = convertCurrency(r.n.amount!, from, to, rates.perInr)
    if (!c) return { error: 'Pick two currencies' }
    return {
      rows: [
        { label: `Amount in ${to}`, value: c.result, main: true },
        { label: `1 ${from} in ${to}`, value: c.rate },
        { label: 'Rates as of', value: rates.date, fmt: 'text' },
      ],
      formula: ['converted = amount × (rate of target ÷ rate of source), both per 1 INR', `${plain(r.n.amount!)} × (${rates.perInr[to]} ÷ ${rates.perInr[from]})`],
      note: rates.live
        ? `Rates as of ${rates.date} (${rates.source}), refreshed on this device within the last 6 hours. Banks and cards add their own margin.`
        : `Rates as of ${rates.date} (${rates.source}), saved with the app -- a live refresh has not reached this device yet. Banks and cards add their own margin.`,
    }
  },
}

// ---- B4 Discount ------------------------------------------------------------

const discountSpec: ToolSpec = {
  id: 'discount',
  title: 'Discount',
  blurb: 'Final price after discounts',
  category: 'everyday',
  keywords: ['discount', 'sale', 'off', 'mrp', 'coupon', 'saving'],
  fields: [
    { id: 'mrp', label: 'Price (MRP)', kind: 'number', unit: 'rupee', default: '2499' },
    { id: 'd1', label: 'Discount', kind: 'number', unit: 'percent', default: '20' },
    { id: 'd2', label: 'Second discount', hint: 'Applied after the first, not added to it', kind: 'number', unit: 'percent', advanced: true },
    { id: 'flat', label: 'Flat amount off', hint: 'Taken off after the percentages', kind: 'number', unit: 'rupee', advanced: true },
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'mrp', label: 'the price' }])
    if (!r.ok) return r
    const d1 = opt(v, 'd1')
    const d2 = opt(v, 'd2')
    const flat = opt(v, 'flat')
    if (!d1 || !d2 || !flat) return { error: 'Check the discount numbers' }
    const percents = [d1, d2].filter((p) => !p.isZero())
    const x = discount(r.n.mrp!, percents, flat)
    if (!x) return { error: 'Discount must be 0 to 100%, and the price above zero' }
    if (x.final.isNegative()) return { error: 'The flat amount is more than the discounted price' }
    return {
      rows: [
        { label: 'Final price', value: x.final, fmt: 'money', main: true },
        { label: 'You save', value: x.saved, fmt: 'money', tone: 'positive' },
        { label: 'Combined discount', value: x.effectivePercent, fmt: 'percent' },
      ],
      formula: ['final = price × (1 − d1 ÷ 100) × (1 − d2 ÷ 100) − flat', `${plain(r.n.mrp!)} × (1 − ${plain(d1)} ÷ 100) × (1 − ${plain(d2)} ÷ 100) − ${plain(flat)}`],
    }
  },
}

// ---- B5 GST -----------------------------------------------------------------

const gstSpec: ToolSpec = {
  id: 'gst',
  rates: RATES_AS_OF,
  title: 'GST',
  blurb: 'Add or remove GST from a price',
  category: 'everyday',
  verified: { source: 'PIB release of 3 Sep 2025 (preset rates only)' },
  keywords: ['gst', 'tax', 'cgst', 'sgst', 'igst', 'invoice', 'inclusive', 'exclusive'],
  fields: [
    { id: 'amount', label: 'Amount', kind: 'number', unit: 'rupee', default: '10000' },
    { id: 'mode', label: 'The amount is', kind: 'select', default: 'add', options: [{ value: 'add', label: 'Without GST' }, { value: 'remove', label: 'With GST' }] },
    { id: 'rate', label: 'GST rate', kind: 'select', default: '18', options: [...GST_PRESETS, { value: 'custom', label: 'Other rate' }] },
    { id: 'custom', label: 'Your GST rate', hint: 'e.g. 12 or 28 for old invoices, 3 for gold', kind: 'number', unit: 'percent', default: '12', visibleIf: (v) => v.rate === 'custom' },
    { id: 'supply', label: 'Sold to', kind: 'select', default: 'intra', advanced: true, options: [{ value: 'intra', label: 'Same state' }, { value: 'inter', label: 'Other state' }] },
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'amount', label: 'an amount' }])
    if (!r.ok) return r
    const rate = v.rate === 'custom' ? parseNum(v.custom) : parseNum(str(v, 'rate'))
    if (!rate) return { error: 'Enter the GST rate' }
    if (rate.gt(100)) return { error: 'GST rate must be 100% or less -- the highest real slab is 40%' }
    const mode = v.mode === 'remove' ? 'remove' : 'add'
    const x = gst(r.n.amount!, rate, mode, v.supply === 'inter')
    if (!x) return { error: 'Amount and rate cannot be negative' }
    const split = x.igst
      ? [{ label: `IGST (${plain(rate)}%)`, value: x.igst, fmt: 'money' as const }]
      : [{ label: `CGST (${plain(rate.div(2))}%)`, value: x.cgst!, fmt: 'money' as const }, { label: `SGST (${plain(rate.div(2))}%)`, value: x.sgst!, fmt: 'money' as const }]
    return {
      rows: [
        mode === 'add' ? { label: 'Total with GST', value: x.total, fmt: 'money', main: true } : { label: 'Price before GST', value: x.base, fmt: 'money', main: true },
        ...(mode === 'add' ? [{ label: 'Price before GST', value: x.base, fmt: 'money' as const }] : [{ label: 'Total with GST', value: x.total, fmt: 'money' as const }]),
        { label: 'GST amount', value: x.gst, fmt: 'money' },
        ...split,
      ],
      formula:
        mode === 'add'
          ? ['GST = price × rate ÷ 100; total = price + GST', `${plain(r.n.amount!)} × ${plain(rate)} ÷ 100`]
          : ['price before GST = total ÷ (1 + rate ÷ 100)', `${plain(r.n.amount!)} ÷ (1 + ${plain(rate)} ÷ 100)`],
      note: `Preset rates are the slabs in force from 22 Sept 2025 (5%, 18%, 40%), checked ${GST_RATES_AS_OF}. Which slab an item falls in comes from the GST notifications, so check before filing.`,
    }
  },
}

// ---- B6 Tip -----------------------------------------------------------------

const SPLIT_ROWS = 6
const splitModes = [
  { value: 'equal', label: 'Equal' },
  { value: 'percent', label: 'By percent' },
  { value: 'shares', label: 'By shares' },
  { value: 'exact', label: 'Exact amounts' },
]

/** The unequal path of Tip and split: names and weights from the rows, one person optionally paid the whole bill. */
function unequalSplit(v: Values, bill: Dec, pct: Dec, mode: SplitMode): Computed {
  const rows = (Array.isArray(v.rows) ? v.rows : []) as string[][]
  const names = rows.map((r, i) => (r[0] ?? '').trim() || (i === 0 ? 'You' : `Person ${i + 1}`))
  const weights: Dec[] = []
  for (let i = 0; i < rows.length; i++) {
    const w = parseNum(rows[i]?.[1])
    if (w === null) return { error: (rows[i]?.[1] ?? '').trim() === '' ? `Enter a share for ${names[i]}` : `The share for ${names[i]} isn't a number`, field: 'rows' }
    weights.push(w)
  }
  const r = splitBill(bill, pct, mode, weights)
  if (!r.ok) {
    if (r.reason === 'percent-sum') return { error: `Percentages add to ${plain(r.sum)}. They must add to 100`, field: 'rows' }
    if (r.reason === 'exact-sum') return { error: `Amounts add to ₹${plain(r.sum)}, but the bill is ₹${plain(bill)}`, field: 'rows' }
    return { error: 'Use shares of 0 or more, with at least one above zero, and no negative amounts', field: 'rows' }
  }
  const payerText = str(v, 'payer').trim()
  const payer = payerText === '' ? null : parseNum(payerText)
  if (payerText !== '' && (payer === null || !payer.isInteger() || payer.lt(1) || payer.gt(rows.length))) return { error: `Who paid is a person number from 1 to ${rows.length}`, field: 'payer' }
  const owes = payer ? settleUp(r.shares, payer.toNumber() - 1) : null
  const payerName = payer ? names[payer.toNumber() - 1]! : ''
  const table: ResultTable = owes
    ? { title: `Who pays ${payerName}`, columns: ['Person', 'Owes'], fmts: ['text', 'money'], rows: owes.map((o) => [`${names[o.person]} pays ${payerName}`, o.owes]) }
    : { title: 'Each person pays', columns: ['Person', 'Pays'], fmts: ['text', 'money'], rows: r.shares.map((s, i) => [names[i]!, s]) }
  return {
    rows: [
      { label: 'Your share', value: r.shares[0]!, fmt: 'money', main: true },
      { label: 'Tip', value: r.tip, fmt: 'money' },
      { label: 'Total with tip', value: r.total, fmt: 'money' },
    ],
    table,
    note: owes ? `${payerName} paid the whole bill and keeps their own share of ₹${plain(r.shares[payer!.toNumber() - 1]!)}. Everyone else pays them the amounts above.` : 'Shares add up to the total to the paisa.',
    expense: { amount: r.shares[0]!, note: 'My share of a split bill' },
    formula: [mode === 'percent' ? 'each pays their % of (bill + tip)' : mode === 'shares' ? 'each pays their shares ÷ all shares of (bill + tip)' : 'each pays their own amount plus the same % tip', 'Rounded to the paisa so the shares add up exactly'],
  }
}

const tipSpec: ToolSpec = {
  id: 'tip',
  title: 'Tip and split',
  blurb: 'Tip, total and each person\'s share',
  category: 'everyday',
  keywords: ['tip', 'split', 'bill', 'restaurant', 'share', 'unequal', 'who owes', 'settle', 'percent', 'shares'],
  fields: [
    { id: 'bill', label: 'Bill amount', kind: 'number', unit: 'rupee', default: '2400' },
    { id: 'pct', label: 'Tip', kind: 'number', unit: 'percent', default: '10' },
    { id: 'mode', label: 'Split', kind: 'select', default: 'equal', options: splitModes },
    { id: 'people', label: 'Number of people', kind: 'number', default: '4', visibleIf: (v) => !v.mode || v.mode === 'equal' },
    {
      id: 'rows',
      label: 'People',
      hint: 'Row 1 is you. Percent: each person\'s %, adding to 100. Shares: parts, such as 2 and 1. Exact: each person\'s own amount, before tip.',
      kind: 'rows',
      min: 2,
      max: SPLIT_ROWS,
      defaultRows: [['You', '1'], ['', '1']],
      columns: [
        { id: 'name', label: 'Name', kind: 'text' },
        { id: 'w', label: 'Share', kind: 'number' },
      ],
      visibleIf: (v) => v.mode === 'percent' || v.mode === 'shares' || v.mode === 'exact',
    },
    { id: 'payer', label: 'Who paid the bill?', hint: 'Optional. A person number from the list, to see who owes whom.', kind: 'number', unit: 'none', default: '', visibleIf: (v) => v.mode === 'percent' || v.mode === 'shares' || v.mode === 'exact' },
  ],
  compute: (v) => {
    const mode = str(v, 'mode')
    if (mode === 'percent' || mode === 'shares' || mode === 'exact') {
      const r = need(v, [{ id: 'bill', label: 'the bill' }, { id: 'pct', label: 'the tip percent' }])
      return r.ok ? unequalSplit(v, r.n.bill!, r.n.pct!, mode) : r
    }
    const r = need(v, [{ id: 'bill', label: 'the bill' }, { id: 'pct', label: 'the tip percent' }, { id: 'people', label: 'the number of people' }])
    if (!r.ok) return r
    const x = tip(r.n.bill!, r.n.pct!, r.n.people!)
    if (!x) return { error: 'Use a whole number of people (1 to 1000), and no negative amounts' }
    // Shares add up to the total to the paisa. The first few may pay one paisa more.
    const base = x.shares[x.shares.length - 1]!
    const extra = x.shares.filter((s) => s.gt(base)).length
    return {
      rows: [
        { label: extra ? 'Most people pay' : 'Each person pays', value: base, fmt: 'money', main: true },
        { label: 'Tip', value: x.tip, fmt: 'money' },
        { label: 'Total with tip', value: x.total, fmt: 'money' },
      ],
      note: extra
        ? `₹0.01 extra goes to ${extra === 1 ? 'person 1' : `each of the first ${extra} people`} so the total matches.`
        : undefined,
      expense: { amount: x.shares[0]!, note: 'My share of a split bill' },
      formula: ['tip = bill × tip% ÷ 100; each = (bill + tip) ÷ people, shared to the paisa', `${plain(r.n.bill!)} × ${plain(r.n.pct!)} ÷ 100; (${plain(r.n.bill!)} + ${plain(x.tip)}) ÷ ${plain(r.n.people!)}`],
    }
  },
}

// ---- B7 Unit price compare --------------------------------------------------

const priceUnitOptions = [
  { value: 'g', label: 'g' }, { value: 'kg', label: 'kg' }, { value: 'ml', label: 'ml' }, { value: 'l', label: 'litre' }, { value: 'pc', label: 'piece' },
]
const unitPriceSpec: ToolSpec = {
  id: 'unit-price',
  title: 'Compare pack prices',
  blurb: 'Which pack is cheaper per kg',
  category: 'everyday',
  keywords: ['unit price', 'compare', 'cheaper', 'best buy', 'per kg', 'per litre', 'grocery', 'pack'],
  fields: [
    {
      id: 'rows', label: 'Items to compare', kind: 'rows', min: 2, max: 5,
      columns: [
        { id: 'price', label: 'Price', kind: 'number', unit: 'rupee' },
        { id: 'qty', label: 'Quantity', kind: 'number' },
        { id: 'unit', label: 'Unit', kind: 'select', options: priceUnitOptions, default: 'g' },
      ],
      defaultRows: [['45', '500', 'g'], ['85', '1', 'kg']],
    },
  ],
  compute: (v) => {
    const rows = Array.isArray(v.rows) ? v.rows : []
    const used: { n: number; price: Dec; quantity: Dec; unit: PriceUnit }[] = []
    for (const [i, row] of rows.entries()) {
      const [p = '', q = '', u = ''] = row
      if (p.trim() === '' && q.trim() === '') continue
      const price = parseNum(p)
      const quantity = parseNum(q)
      if (!price || !quantity) return { error: `Fill in the price and quantity for item ${i + 1}` }
      used.push({ n: i + 1, price, quantity, unit: (u || 'g') as PriceUnit })
    }
    if (used.length < 2) return { error: 'Enter at least two items to compare' }
    const x = unitPrices(used)
    if (!x) return { error: 'Compare like with like (all weight, all volume or all pieces), with quantity above zero' }
    const std = STANDARD_UNIT[x.family]
    const best = x.perUnit[x.cheapest]!
    return {
      rows: [
        { label: 'Cheapest pack', value: `Item ${used[x.cheapest]!.n}`, fmt: 'text', main: true },
        { label: `Its price per ${std}`, value: best, fmt: 'money' },
      ],
      table: {
        title: `Price per ${std}`,
        columns: ['Item', 'Price', 'Quantity', `Per ${std}`, 'Dearer by'],
        fmts: ['text', 'money', 'text', 'money', 'percent'],
        rows: used.map((u, i) => [`Item ${u.n}${i === x.cheapest ? ' (cheapest)' : ''}`, u.price, `${plain(u.quantity)} ${u.unit}`, x.perUnit[i]!, x.perUnit[i]!.minus(best).div(best.isZero() ? 1 : best).times(100)]),
      },
      formula: [`per ${std} = price ÷ quantity, with g and ml turned into kg and litres first`, ...used.map((u, i) => `Item ${u.n}: ${plain(u.price)} ÷ (${plain(u.quantity)} ${u.unit} in ${std}s) = ${plain(x.perUnit[i]!.toDecimalPlaces(4))}`)],
    }
  },
}

// ---- B8 Date calculator -----------------------------------------------------

const dateSpec: ToolSpec = {
  id: 'date',
  title: 'Date calculator',
  blurb: 'Days between dates, add or subtract, age',
  category: 'everyday',
  keywords: ['date', 'days', 'between', 'age', 'birthday', 'add days', 'weeks', 'duration'],
  fields: [
    { id: 'mode', label: 'What to find', kind: 'select', default: 'diff', options: [{ value: 'diff', label: 'Days apart' }, { value: 'add', label: 'Add time' }, { value: 'age', label: 'Age' }] },
    { id: 'from', label: 'Start date', kind: 'date', default: '2026-01-01', visibleIf: (v) => v.mode === 'diff' },
    { id: 'to', label: 'End date', kind: 'date', default: '2026-11-02', visibleIf: (v) => v.mode === 'diff' },
    { id: 'start', label: 'Starting date', kind: 'date', default: '2026-01-31', visibleIf: (v) => v.mode === 'add' },
    { id: 'n', label: 'How many', labelFor: (v) => `How many ${str(v, 'unit') || 'months'}`, hint: 'Use a minus sign to go back', kind: 'number', default: '1', visibleIf: (v) => v.mode === 'add' },
    { id: 'unit', label: 'Unit of time', kind: 'select', default: 'months', visibleIf: (v) => v.mode === 'add', options: [{ value: 'days', label: 'Days' }, { value: 'weeks', label: 'Weeks' }, { value: 'months', label: 'Months' }, { value: 'years', label: 'Years' }] },
    { id: 'dob', label: 'Date of birth', kind: 'date', default: '1990-06-15', visibleIf: (v) => v.mode === 'age' },
  ],
  compute: (v) => {
    const get = (id: string): Date | null => parseDate(str(v, id))
    if (v.mode === 'add') {
      const start = get('start')
      const n = parseNum(v.n)
      if (!start) return { error: 'Enter a date' }
      if (!n || !n.isInteger() || n.abs().gt(100000)) return { error: 'Enter a whole number' }
      const k = n.toNumber()
      const unit = str(v, 'unit')
      const end = unit === 'days' ? addDays(start, k) : unit === 'weeks' ? addDays(start, k * 7) : unit === 'months' ? addMonths(start, k) : addYears(start, k)
      return {
        rows: [{ label: 'New date', value: formatDate(end), fmt: 'text', main: true }, { label: 'Days from the start', value: new D(daysBetween(start, end)), fmt: 'int' }],
        formula: [`${formatDate(start)} ${k < 0 ? '−' : '+'} ${Math.abs(k)} ${unit}`, 'Months and years keep the day number, or the last day of the month if it does not exist (31 Jan + 1 month = 28 Feb)'],
      }
    }
    if (v.mode === 'age') {
      const dob = get('dob')
      if (!dob) return { error: 'Enter a date of birth' }
      const now = today()
      const a = ymd(dob, now)
      if (!a) return { error: 'Date of birth is in the future' }
      const next = addYears(dob, a.years + 1)
      return {
        rows: [
          { label: 'Age', value: `${a.years} years, ${a.months} months, ${a.days} days`, fmt: 'text', main: true },
          { label: 'Days lived', value: new D(daysBetween(dob, now)), fmt: 'int' },
          { label: 'Next birthday in', value: new D(daysBetween(now, next)), fmt: 'int' },
        ],
        formula: [`From ${formatDate(dob)} to today, ${formatDate(now)}`],
      }
    }
    const from = get('from')
    const to = get('to')
    if (!from || !to) return { error: 'Enter both dates' }
    const [a, b] = from <= to ? [from, to] : [to, from]
    const days = daysBetween(a, b)
    const p = ymd(a, b)!
    return {
      rows: [
        { label: 'Days apart', value: new D(days), fmt: 'int', timeUnit: 'days', main: true },
        { label: 'Weeks and days', value: `${Math.floor(days / 7)} weeks, ${days % 7} days`, fmt: 'text' },
        { label: 'Years, months, days', value: `${p.years} years, ${p.months} months, ${p.days} days`, fmt: 'text' },
      ],
      span: { start: formatDate(a), end: formatDate(b), between: `${days} ${days === 1 ? 'day' : 'days'}` },
      formula: [`${formatDate(a)} to ${formatDate(b)}`, 'The start day is not counted, the end day is'],
    }
  },
}

// ---- B9 World time ----------------------------------------------------------

const worldTimeSpec: ToolSpec = {
  id: 'world-time',
  title: 'World time',
  blurb: 'Time now, or a time you choose, in 20+ cities',
  category: 'everyday',
  keywords: ['time zone', 'timezone', 'world clock', 'utc', 'ist', 'london', 'new york', 'dubai', 'offset'],
  fields: [
    { id: 'home', label: 'Home city', hint: 'A time you choose below is read as this city\'s clock.', kind: 'select', default: 'mumbai', options: CITIES.map((c) => ({ value: c.id, label: c.label })) },
    { id: 'when', label: 'Show', kind: 'select', default: 'now', options: [{ value: 'now', label: 'Time now' }, { value: 'chosen', label: 'A time I choose' }] },
    { id: 'at', label: 'Time in home city', kind: 'time', default: '15:00', visibleIf: (v) => v.when === 'chosen' },
    { id: 'day', label: 'Day in home city', hint: 'Leave blank for today.', kind: 'date', default: '', visibleIf: (v) => v.when === 'chosen' },
  ],
  compute: (v) => {
    const homeId = str(v, 'home')
    const chosen = str(v, 'when') === 'chosen'
    let at = new Date()
    if (chosen) {
      if (str(v, 'at') === '') return { error: 'Enter the time in the home city' }
      const found = instantAt(homeId, str(v, 'day') || (todayIn(homeId, at) ?? ''), str(v, 'at'))
      if (!found) return { error: str(v, 'day') ? 'Enter a real day and time in the home city' : 'Pick a home city' }
      at = found
    }
    const times = worldTimes(at, homeId)
    if (!times) return { error: 'Pick a home city' }
    const home = times.find((c) => c.id === homeId)!
    return {
      rows: [{ label: chosen ? home.label : `${home.label} now`, value: `${home.time}, ${home.day}`, fmt: 'text', main: true }],
      table: { title: 'Cities', columns: ['City', 'Time', 'Day', 'Offset', 'From home'], fmts: ['text', 'text', 'text', 'text', 'text'], rows: times.map((c) => [c.label, c.time, c.day, c.offset, c.fromHome]) },
      note: chosen
        ? 'Daylight saving is applied for the day you chose. The offsets are for that day.'
        : 'Shown for the moment you last changed the home city. Daylight saving comes from the device\'s time zone data.',
    }
  },
}

// ---- B10 Number base --------------------------------------------------------

const baseOptions = ['10', '2', '8', '16'].map((b) => ({ value: b, label: b === '10' ? 'Decimal (10)' : b === '2' ? 'Binary (2)' : b === '8' ? 'Octal (8)' : 'Hex (16)' }))
const numberBaseSpec: ToolSpec = {
  id: 'number-base',
  title: 'Binary and hex',
  blurb: 'Convert bases and bit operations',
  category: 'everyday',
  keywords: ['binary', 'hex', 'hexadecimal', 'octal', 'decimal', 'base', 'and', 'or', 'xor', 'not', 'shift', 'bitwise'],
  fields: [
    { id: 'value', label: 'Number to convert', hint: 'Whole number, 0 or more', kind: 'text', default: '255' },
    { id: 'from', label: 'Number is in', kind: 'select', default: '10', options: baseOptions },
    { id: 'to', label: 'Show answer in', kind: 'select', default: '16', options: baseOptions },
    { id: 'other', label: 'Second number (AND, OR, XOR)', hint: 'Same base as the first number', kind: 'text', default: '15', advanced: true },
    { id: 'shift', label: 'Shift by (places)', kind: 'number', default: '2', advanced: true },
    { id: 'width', label: 'Bits for NOT', kind: 'select', default: '8', advanced: true, options: ['8', '16', '32', '64'].map((w) => ({ value: w, label: `${w} bits` })) },
  ],
  compute: (v) => {
    const from = Number(str(v, 'from')) as Base
    const to = Number(str(v, 'to')) as Base
    if (str(v, 'value').trim() === '') return { error: 'Enter the number to convert' }
    const a = parseBase(str(v, 'value'), from)
    if (a === null) return { error: `That is not a whole number in base ${from}` }
    const b = str(v, 'other').trim() === '' ? 0n : parseBase(str(v, 'other'), from)
    if (b === null) return { error: `The second value is not a whole number in base ${from}` }
    const shift = opt(v, 'shift')
    if (!shift || !shift.isInteger() || shift.isNegative()) return { error: 'Shift must be a whole number, 0 or more' }
    const width = Number(str(v, 'width')) as 8 | 16 | 32 | 64
    const ops = bitOps(a, b, shift.toNumber(), width)
    if (!ops) return { error: 'Shift is too large' }
    const s = (n: bigint) => toBase(n, to)
    return {
      rows: [
        { label: `Answer in base ${to}`, value: s(a), fmt: 'text', main: true },
        { label: 'Binary', value: toBase(a, 2), fmt: 'text' },
        { label: 'Octal', value: toBase(a, 8), fmt: 'text' },
        { label: 'Decimal', value: toBase(a, 10), fmt: 'text' },
        { label: 'Hex', value: toBase(a, 16), fmt: 'text' },
      ],
      table: {
        title: `Bitwise results in base ${to}`,
        columns: ['Operation', 'Result'],
        fmts: ['text', 'text'],
        rows: [
          ['A AND B', s(ops.and)], ['A OR B', s(ops.or)], ['A XOR B', s(ops.xor)],
          [`NOT A (${width} bits)`, ops.not === null ? `Needs more than ${width} bits` : s(ops.not)],
          [`A << ${shift.toFixed()}`, s(ops.shl)], [`A >> ${shift.toFixed()}`, s(ops.shr)],
        ],
      },
      formula: ['A is the first value, B the second. NOT flips every bit within the chosen width.'],
    }
  },
}

// ---- B11 Fuel cost ----------------------------------------------------------

const fuelCostSpec: ToolSpec = {
  id: 'fuel-cost',
  title: 'Fuel cost',
  blurb: 'Fuel needed and cost for a trip',
  category: 'everyday',
  keywords: ['fuel', 'petrol', 'diesel', 'trip', 'mileage', 'cost per km', 'road trip'],
  fields: [
    { id: 'distance', label: 'Distance (km)', kind: 'number', default: '450' },
    { id: 'mileage', label: 'Mileage (km per litre)', kind: 'number', default: '15' },
    { id: 'price', label: 'Fuel price per litre', hint: 'Example price. Enter today\'s price.', kind: 'number', unit: 'rupee', default: '100' },
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'distance', label: 'the distance' }, { id: 'mileage', label: 'the mileage' }, { id: 'price', label: 'the fuel price' }])
    if (!r.ok) return r
    const x = fuelCost(r.n.distance!, r.n.mileage!, r.n.price!)
    if (!x) return { error: 'Distance and mileage must be above zero, and the price cannot be negative' }
    return {
      rows: [
        { label: 'Trip cost', value: x.cost, fmt: 'money', main: true },
        { label: 'Fuel needed (litres)', value: x.litres },
        { label: 'Cost per km', value: x.perKm, fmt: 'money' },
      ],
      formula: ['fuel = distance ÷ mileage; cost = fuel × price; per km = cost ÷ distance', `${plain(r.n.distance!)} ÷ ${plain(r.n.mileage!)} = ${plain(x.litres.toDecimalPlaces(4))} litres`],
    }
  },
}

// ---- B12 Fuel efficiency ----------------------------------------------------

const fuelEfficiencySpec: ToolSpec = {
  id: 'fuel-efficiency',
  title: 'Mileage converter',
  blurb: 'Convert km/l, mpg and L/100 km',
  category: 'everyday',
  keywords: ['mpg', 'km/l', 'l/100km', 'mileage', 'fuel economy', 'efficiency'],
  fields: [
    { id: 'value', label: 'Your mileage figure', kind: 'number', default: '15' },
    { id: 'unit', label: 'Measured in', kind: 'select', default: 'kmpl', options: [{ value: 'kmpl', label: 'km per litre' }, { value: 'mpgus', label: 'mpg (US)' }, { value: 'mpguk', label: 'mpg (UK)' }, { value: 'l100', label: 'litres per 100 km' }] },
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'value', label: 'your mileage figure' }])
    if (!r.ok) return r
    const x = fuelEfficiency(r.n.value!, str(v, 'unit') as EfficiencyUnit)
    if (!x) return { error: 'Enter a value above zero' }
    return {
      rows: [
        { label: 'km per litre', value: x.kmpl, main: true },
        { label: 'mpg (US)', value: x.mpgus },
        { label: 'mpg (UK)', value: x.mpguk },
        { label: 'litres per 100 km', value: x.l100 },
      ],
      formula: ['l/100 km = 100 ÷ km/l', 'mpg (US) = km/l × 3.785411784 ÷ 1.609344', 'mpg (UK) = km/l × 4.54609 ÷ 1.609344'],
    }
  },
}

// ---- B13 Body metrics -------------------------------------------------------

const bodySpec: ToolSpec = {
  id: 'body-metrics',
  title: 'BMI and calories',
  blurb: 'BMI, calories, ideal weight and body fat',
  category: 'everyday',
  keywords: ['bmi', 'bmr', 'tdee', 'calories', 'weight', 'ideal weight', 'body fat', 'health'],
  fields: [
    { id: 'height', label: 'Height (cm)', kind: 'number', default: '170' },
    { id: 'weight', label: 'Weight (kg)', kind: 'number', default: '70' },
    { id: 'age', label: 'Age', kind: 'number', unit: 'years', default: '30' },
    { id: 'sex', label: 'Sex', kind: 'select', default: 'male', options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }] },
    {
      id: 'activity', label: 'Activity level', kind: 'select', default: 'light',
      options: [
        { value: 'sedentary', label: 'Little or no exercise' }, { value: 'light', label: 'Light, 1 to 3 days a week' }, { value: 'moderate', label: 'Moderate, 3 to 5 days' },
        { value: 'active', label: 'Hard, 6 to 7 days' }, { value: 'veryActive', label: 'Very hard, or a physical job' },
      ],
    },
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'height', label: 'your height' }, { id: 'weight', label: 'your weight' }, { id: 'age', label: 'your age' }])
    if (!r.ok) return r
    const x = bodyMetrics(r.n.height!, r.n.weight!, r.n.age!, str(v, 'sex') as Sex, str(v, 'activity') as Activity)
    if (!x) return { error: 'For adults 18 and over. Height 50 to 272 cm, weight 2 to 500 kg' }
    const p1 = (d: Dec) => d.toDecimalPlaces(1)
    return {
      rows: [
        { label: `BMI (${x.category})`, value: p1(x.bmi), main: true },
        { label: 'Daily calories to keep your weight (TDEE)', value: x.tdee.toDecimalPlaces(0), fmt: 'int' },
        { label: 'Calories at rest (BMR)', value: x.bmr.toDecimalPlaces(0), fmt: 'int' },
        { label: 'Ideal weight (kg)', value: p1(x.idealWeightKg) },
        { label: 'Lowest healthy weight (kg)', value: p1(x.healthyMinKg) },
        { label: 'Highest healthy weight (kg)', value: p1(x.healthyMaxKg) },
        { label: 'Body fat estimate', value: p1(x.bodyFatPercent), fmt: 'percent' },
      ],
      formula: [
        'BMI = kg ÷ (height in m)²',
        'BMR (Mifflin-St Jeor) = 10 × kg + 6.25 × cm − 5 × age + 5 (men) or − 161 (women)',
        'TDEE = BMR × activity factor (1.2 to 1.9)',
        'Ideal weight (Devine) = 50 kg (men) or 45.5 kg (women) + 2.3 kg per inch over 5 ft',
        'Body fat (Deurenberg) = 1.20 × BMI + 0.23 × age − 10.8 × (1 if male) − 5.4',
      ],
      note: 'An estimate, not medical advice. BMI classes are the WHO adult ones, which assume an adult build; cut-offs for Asian adults can be lower, and BMI ignores muscle and body shape. The "healthy weight" range is the BMI 18.5 to 24.9 band.',
    }
  },
}

// ---- B14 Grade average ------------------------------------------------------

const gradeSpec: ToolSpec = {
  id: 'grade-average',
  title: 'Marks and GPA',
  blurb: 'Percentage and GPA from your marks',
  category: 'everyday',
  keywords: ['grade', 'gpa', 'cgpa', 'marks', 'percentage', 'weighted average', 'credits', 'semester'],
  fields: [
    {
      id: 'rows', label: 'Subjects', kind: 'rows', min: 1, max: 20,
      columns: [
        { id: 'subject', label: 'Subject', kind: 'text' },
        { id: 'marks', label: 'Marks', kind: 'number' },
        { id: 'max', label: 'Out of', kind: 'number' },
        { id: 'credits', label: 'Credits', kind: 'number' },
      ],
      defaultRows: [['Maths', '78', '100', '4'], ['Physics', '65', '100', '3'], ['English', '82', '100', '2']],
    },
  ],
  compute: (v) => {
    const rows = Array.isArray(v.rows) ? v.rows : []
    const used = []
    for (const [i, row] of rows.entries()) {
      const [, m = '', mx = '', cr = ''] = row
      if (m.trim() === '') continue
      const marks = parseNum(m)
      const maxMarks = mx.trim() === '' ? new D(100) : parseNum(mx)
      const credits = cr.trim() === '' ? new D(1) : parseNum(cr)
      if (!marks || !maxMarks || !credits) return { error: `Check the numbers in subject ${i + 1}` }
      used.push({ marks, maxMarks, credits })
    }
    if (used.length === 0) return { error: 'Enter marks for at least one subject' }
    const x = gradeAverage(used)
    if (!x) return { error: 'Marks cannot be above the maximum, and the maximum and credits must be above zero' }
    return {
      rows: [
        { label: 'Overall percentage', value: x.percent.toDecimalPlaces(2), fmt: 'percent', main: true },
        { label: 'GPA (out of 10)', value: x.gpa10.toDecimalPlaces(2) },
        { label: 'Total credits', value: x.totalCredits },
      ],
      formula: ['average % = sum of (marks ÷ out of × 100 × credits) ÷ total credits', 'GPA = average % ÷ 10'],
      note: 'A blank "Out of" counts as 100 and blank "Credits" as 1. The GPA is percentage ÷ 10, and your university may use its own grade-point table.',
    }
  },
}

// ---- B15 Ovulation ----------------------------------------------------------

const ovulationSpec: ToolSpec = {
  id: 'ovulation',
  title: 'Ovulation',
  blurb: 'Estimated fertile window and next period',
  category: 'everyday',
  keywords: ['ovulation', 'fertile', 'period', 'cycle', 'pregnancy', 'menstrual'],
  fields: [
    { id: 'last', label: 'First day of last period', kind: 'date', default: '2026-10-20' },
    { id: 'cycle', label: 'Cycle length', hint: 'Usually 21 to 35. First day to first day.', kind: 'number', unit: 'days', default: '28' },
  ],
  compute: (v) => {
    const last = parseDate(str(v, 'last'))
    if (!last) return { error: 'Enter the first day of your last period' }
    const c = parseNum(v.cycle)
    if (!c) return { error: 'Enter your cycle length' }
    const x = ovulation(last, c.isInteger() ? c.toNumber() : NaN)
    if (!x) return { error: 'Cycle length must be a whole number from 21 to 45 days' }
    return {
      rows: [
        { label: 'Ovulation day', value: formatDate(x.ovulation), fmt: 'text', main: true },
        { label: 'Fertile window starts', value: formatDate(x.fertileStart), fmt: 'text' },
        { label: 'Fertile window ends', value: formatDate(x.fertileEnd), fmt: 'text' },
        { label: 'Next period', value: formatDate(x.nextPeriod), fmt: 'text' },
      ],
      formula: ['next period = last period + cycle length', 'ovulation = next period − 14 days', 'fertile window = ovulation − 5 days to ovulation + 1 day'],
      note: 'An estimate for a regular cycle. It is not contraception and not a way to avoid pregnancy.',
    }
  },
}

export const TOOLS: ToolSpec[] = [
  unitSpec, currencySpec, percentSpec, discountSpec, gstSpec, tipSpec, unitPriceSpec, dateSpec, worldTimeSpec,
  numberBaseSpec, fuelCostSpec, fuelEfficiencySpec, bodySpec, gradeSpec, ovulationSpec,
]
