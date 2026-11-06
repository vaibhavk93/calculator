import { D, type Dec } from '../../engine/decimal'
import { formatDecimal } from '../../lib/format'
import { toWholeMonths, toYears, unitText, type TimeUnit } from '../../engine/duration'
import { cagr, effectiveYield, epf, fd, goalSipMonths, growCorpus, lumpsumRows, ppf, rd, sip, sipMonths, swp, xirr, type YearRow } from '../../engine/investments/invest'
import { EXAMPLE, PPF, RATES_AS_OF } from '../../engine/investments/rates'
import { junkOptional, need, parseNum, unitOf, type Field, type Output, type ToolSpec } from '../../lib/tool'

/** Grouped the Indian way for the worked-out lines (1,50,000 and not 150000). */
const s = (v: Dec, dp = 2) => formatDecimal(v.toDecimalPlaces(dp), { system: 'indian', decimals: 'auto' })
const EX = 'Example rate, enter your own'

const num = (id: string, label: string, def: string, unit: Extract<Field, { kind: 'number' }>['unit'] = 'none', hint?: string, advanced?: boolean, example?: boolean, units?: TimeUnit[]): Field => ({
  id, label, kind: 'number', unit, default: def, hint, advanced, example, ...(units ? { units } : {}),
})
const RETURN = 'Expected yearly return'
const WHOLE = 'Whole years only'
const WHOLE_MONTHS_HINT = 'Whole months only. 1.5 years is 18 months.'

// The duration boxes. `units[0]` is what the box meant before the switch existed (years), so a saved card reopens the same.
const YM: TimeUnit[] = ['years', 'months']
const YMD: TimeUnit[] = ['years', 'months', 'days']
/** What `unitOf` needs to read the chosen unit of a duration box by id. */
const dur = (id: string, units: TimeUnit[]) => ({ id, unit: 'years' as const, units })
const YEARS_YM = dur('years', YM)
const YEARS_YMD = dur('years', YMD)
const WAIT_YM = dur('wait', YM)

const RETURN_ERR = 'Enter a yearly return from 0 to 100%'
const RATE_ERR = 'Enter a yearly interest rate from 0 to 100%'
const rateBad = (r: Dec) => r.isNegative() || r.gt(100)
const WHOLE_MONTHS_ERR = 'Time must come to whole months, from 1 month to 60 years'
const DAYS_NOTE = 'A year is counted as 365 days; leap years are ignored.'

/** Whole months from a duration typed in years or months: 1 to 720 (60 years), else null. */
const wholeMonths = (n: Dec, unit: TimeUnit): number | null => {
  const m = toWholeMonths(n, unit === 'months' ? 'months' : 'years')
  return m === null || m > 720 ? null : m
}

/** "18 months ÷ 12 = 1.5 years" for a box not in years, so the worked line shows how the time was read. [] for years. */
const timeLine = (n: Dec, unit: TimeUnit, t: Dec): string[] => (unit === 'years' ? [] : [`Time = ${n.toFixed()} ${unitText(n, unit)} ÷ ${unit === 'months' ? 12 : 365} = ${t.toDecimalPlaces(4).toFixed()} years`])
/** The time as it goes into a worked line: the typed years as they were, else the converted years. */
const tShow = (n: Dec, unit: TimeUnit, t: Dec) => (unit === 'years' ? s(n) : s(t, 4))

/** Whole years 1..60, or an error. */
function wholeYears(y: Dec): number | { error: string } {
  if (!y.isInteger() || y.lt(1)) return { error: 'Years must be a whole number, 1 or more' }
  if (y.gt(60)) return { error: 'Use 60 years or fewer' }
  return y.toNumber()
}

const negative = (n: Record<string, Dec>) => Object.values(n).some((v) => v.isNegative())

/** One table and chart row: `cell` is the year number, or words ("Month 18") for a last row that is part way through a year. */
interface GrowRow {
  cell: Dec | string
  label: string
  invested: Dec
  value: Dec
}
const yearRow = (r: YearRow): GrowRow => ({ cell: new D(r.year), label: `Y${r.year}`, invested: r.invested, value: r.value })

/** Stacked chart and year-wise table: invested vs returns (D13, the growth visualiser). */
function growth(rows: GrowRow[], valueLabel = 'Value'): Pick<Output, 'chart' | 'table'> {
  return {
    chart: {
      title: 'Invested vs returns',
      labels: rows.map((r) => r.label),
      series: [
        { name: 'Invested', values: rows.map((r) => r.invested.toNumber()) },
        { name: 'Returns', values: rows.map((r) => r.value.minus(r.invested).toNumber()) },
      ],
    },
    table: {
      title: 'Year by year',
      columns: ['Year', 'Invested', 'Returns', valueLabel],
      fmts: ['int', 'money', 'money', 'money'],
      rows: rows.map((r) => [r.cell, r.invested, r.value.minus(r.invested), r.value]),
    },
  }
}

/** SIP rows: a whole year is "Y1", a last row part way through a year is "Month 18". */
const monthRows = (rows: ReturnType<typeof sipMonths>): GrowRow[] =>
  rows.map((r) => {
    const whole = r.months % 12 === 0
    return { cell: whole ? new D(r.months / 12) : `Month ${r.months}`, label: whole ? `Y${r.months / 12}` : `M${r.months}`, invested: r.invested, value: r.value }
  })

const SIP_NOTE = 'Assumes each payment goes in at the start of the month and grows at return ÷ 12 each month, the usual convention for Indian SIP calculators. Returns are not guaranteed.'

const sipSpec: ToolSpec = {
  id: 'sip',
  title: 'SIP: monthly investing',
  blurb: 'What your monthly SIP grows to',
  category: 'invest',
  keywords: ['mutual fund', 'systematic investment plan', 'monthly investment', 'corpus'],
  fields: [num('monthly', 'Monthly investment', '5000', 'rupee'), num('rate', RETURN, '12', 'percent'), num('years', 'Number of years', '10', 'years', WHOLE_MONTHS_HINT, undefined, undefined, YM)],
  compute: (v) => {
    const r = need(v, [{ id: 'monthly', label: 'Monthly amount' }, { id: 'rate', label: 'Expected return' }, { id: 'years', label: 'Years' }])
    if (!r.ok) return r
    if (rateBad(r.n.rate!)) return { error: RETURN_ERR, field: 'rate' }
    if (negative(r.n)) return { error: 'Use positive numbers' }
    const months = wholeMonths(r.n.years!, unitOf(YEARS_YM, v))
    if (months === null) return { error: WHOLE_MONTHS_ERR, field: 'years' }
    const rows = sipMonths(r.n.monthly!, r.n.rate!, months)
    const last = rows[rows.length - 1]!
    return {
      rows: [
        { label: 'Value at the end', value: last.value, fmt: 'money', main: true },
        { label: 'Total invested', value: last.invested, fmt: 'money' },
        { label: 'Gains', value: last.value.minus(last.invested), fmt: 'money' },
      ],
      ...growth(monthRows(rows)),
      formula: ['FV = P × ((1+i)^n − 1) ÷ i × (1+i), i = return ÷ 12 ÷ 100', `${s(r.n.monthly!)} × ((1+${s(r.n.rate!.div(1200), 6)})^${months} − 1) ÷ ${s(r.n.rate!.div(1200), 6)} × (1+${s(r.n.rate!.div(1200), 6)})`],
      note: SIP_NOTE,
    }
  },
}

const stepUpSpec: ToolSpec = {
  id: 'step-up-sip',
  title: 'Step-up SIP',
  blurb: 'A SIP that rises every year',
  category: 'invest',
  keywords: ['top-up sip', 'increasing sip', 'annual increase'],
  fields: [...sipSpec.fields, num('step', 'Yearly increase', '10', 'percent')],
  compute: (v) => {
    const r = need(v, [{ id: 'monthly', label: 'Monthly amount' }, { id: 'rate', label: 'Expected return' }, { id: 'years', label: 'Years' }, { id: 'step', label: 'Yearly raise' }])
    if (!r.ok) return r
    if (rateBad(r.n.rate!)) return { error: RETURN_ERR, field: 'rate' }
    if (negative(r.n)) return { error: 'Use positive numbers' }
    const months = wholeMonths(r.n.years!, unitOf(YEARS_YM, v))
    if (months === null) return { error: WHOLE_MONTHS_ERR, field: 'years' }
    const rows = sipMonths(r.n.monthly!, r.n.rate!, months, r.n.step!)
    const flat = sipMonths(r.n.monthly!, r.n.rate!, months).at(-1)!
    const last = rows.at(-1)!
    return {
      rows: [
        { label: 'Value at the end', value: last.value, fmt: 'money', main: true },
        { label: 'Total invested', value: last.invested, fmt: 'money' },
        { label: 'Gains', value: last.value.minus(last.invested), fmt: 'money' },
        { label: 'Without step-up', value: flat.value, fmt: 'money' },
        { label: 'Extra from step-up', value: last.value.minus(flat.value), fmt: 'money' },
      ],
      ...growth(monthRows(rows)),
      formula: [
        'Each year the monthly amount × (1 + step ÷ 100); each month balance = (balance + amount) × (1 + return ÷ 1200)',
        `${months % 12 === 0 ? `Year ${months / 12}` : `Month ${months}`} monthly amount = ${s(r.n.monthly!)} × ${s(new D(1).plus(r.n.step!.div(100)), 4)}^${Math.floor((months - 1) / 12)}`,
      ],
      note: SIP_NOTE,
    }
  },
}

const lumpsumSpec: ToolSpec = {
  id: 'lumpsum',
  title: 'Lump sum investment',
  blurb: 'One-time investment, compounded yearly',
  category: 'invest',
  keywords: ['one time', 'compound interest', 'maturity'],
  fields: [num('amount', 'Amount invested', '100000', 'rupee'), num('rate', RETURN, '12', 'percent'), num('years', 'Number of years', '10', 'years', 'Fractions are fine, e.g. 1.5, or switch to months or days', undefined, undefined, YMD)],
  compute: (v) => {
    const r = need(v, [{ id: 'amount', label: 'Amount' }, { id: 'rate', label: 'Expected return' }, { id: 'years', label: 'Years' }])
    if (!r.ok) return r
    if (rateBad(r.n.rate!)) return { error: RETURN_ERR, field: 'rate' }
    if (negative(r.n)) return { error: 'Use positive numbers' }
    const unit = unitOf(YEARS_YMD, v)
    const t = toYears(r.n.years!, unit)
    if (t.lte(0) || t.gt(60)) return { error: 'Time must be more than 0 and at most 60 years', field: 'years' }
    // The last row, when the time is not a whole number of years, is named in the unit it was typed in ("18 months").
    const typed = `${r.n.years!.toFixed()} ${unitText(r.n.years!, unit)}`
    const rows: GrowRow[] = lumpsumRows(r.n.amount!, r.n.rate!, t).map((x) => {
      const partial = !t.isInteger() && x.years.eq(t)
      return { cell: partial ? typed : x.years, label: partial ? `${unit[0]!.toUpperCase()}${r.n.years!.toFixed()}` : `Y${x.years.toFixed()}`, invested: x.invested, value: x.value }
    })
    const last = rows.at(-1)!
    return {
      rows: [
        { label: 'Final value', value: last.value, fmt: 'money', main: true },
        { label: 'Gains', value: last.value.minus(last.invested), fmt: 'money' },
      ],
      ...growth(rows),
      formula: ['A = P × (1 + r ÷ 100)^years', `${s(r.n.amount!)} × (1 + ${s(r.n.rate!)} ÷ 100)^${tShow(r.n.years!, unit, t)}`, ...timeLine(r.n.years!, unit, t)],
      note: 'Compounded once a year. Returns are not guaranteed.' + (t.isInteger() ? '' : ' A part of a year compounds fractionally.') + (unit === 'days' ? ` ${DAYS_NOTE}` : ''),
    }
  },
}

const goalSpec: ToolSpec = {
  id: 'goal-sip',
  title: 'SIP for a goal',
  blurb: 'Monthly SIP needed to reach a target',
  category: 'invest',
  keywords: ['target', 'reverse sip', 'how much to invest', 'goal planning'],
  fields: [
    num('target', 'Target amount', '1000000', 'rupee'),
    num('rate', RETURN, '12', 'percent'),
    num('years', 'Number of years', '10', 'years', WHOLE_MONTHS_HINT, undefined, undefined, YM),
    num('existing', 'Already saved', '0', 'rupee', undefined, true),
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'target', label: 'Target amount' }, { id: 'rate', label: 'Expected return' }, { id: 'years', label: 'Years' }])
    if (!r.ok) return r
    const junk = junkOptional(v, [{ id: 'existing', label: 'Already saved' }])
    if (junk) return junk
    const existing = parseNum(v.existing) ?? new D(0)
    if (rateBad(r.n.rate!)) return { error: RETURN_ERR, field: 'rate' }
    if (negative(r.n) || existing.isNegative()) return { error: 'Use positive numbers' }
    const months = wholeMonths(r.n.years!, unitOf(YEARS_YM, v))
    if (months === null) return { error: WHOLE_MONTHS_ERR, field: 'years' }
    const p = goalSipMonths(r.n.target!, r.n.rate!, months, existing)!
    const grown = existing.times(new D(1).plus(r.n.rate!.div(100)).pow(new D(months).div(12)))
    return {
      rows: [
        { label: 'Monthly SIP needed', value: p, fmt: 'money', main: true },
        { label: 'Savings so far grow to', value: grown, fmt: 'money' },
        { label: 'Total you will invest', value: p.times(months), fmt: 'money' },
      ],
      formula: [
        'P = (target − saved × (1+r)^years) ÷ (((1+i)^n − 1) ÷ i × (1+i)), i = r ÷ 12',
        `(${s(r.n.target!)} − ${s(grown)}) ÷ SIP factor for ${months} months`,
      ],
      note: p.isZero()
        ? 'What you have already saved reaches the target on its own.'
        : SIP_NOTE + (existing.gt(0) ? ' Saved money grows once a year while the monthly SIP grows every month, so the answer is on the cautious side.' : ''),
    }
  },
}

const swpSpec: ToolSpec = {
  id: 'swp',
  title: 'SWP: monthly withdrawals',
  blurb: 'How long your money lasts',
  category: 'invest',
  keywords: ['systematic withdrawal', 'retirement income', 'monthly withdrawal', 'depletion'],
  fields: [
    num('corpus', 'Starting amount', '1000000', 'rupee'),
    num('withdraw', 'Monthly withdrawal', '10000', 'rupee'),
    num('rate', RETURN, '8', 'percent', 'While you are withdrawing'),
    num('wait', 'Years of saving first', '0', 'years', 'Time the money keeps growing before the first withdrawal, in whole months. 0 means start now.', true, undefined, YM),
    num('saveRate', 'Return in the saving years', '', 'percent', 'Leave blank to use the same return as above', true),
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'corpus', label: 'Corpus' }, { id: 'withdraw', label: 'Monthly withdrawal' }, { id: 'rate', label: 'Expected return' }])
    if (!r.ok) return r
    const junk = junkOptional(v, [{ id: 'wait', label: 'Years of saving first' }, { id: 'saveRate', label: 'Return in the saving years' }])
    if (junk) return junk
    const wait = parseNum(v.wait) ?? new D(0)
    const saveRate = parseNum(v.saveRate) ?? r.n.rate!
    if (rateBad(r.n.rate!)) return { error: RETURN_ERR, field: 'rate' }
    if (rateBad(saveRate)) return { error: 'Enter a yearly return from 0 to 100% for the saving years', field: 'saveRate' }
    if (negative(r.n) || wait.isNegative() || saveRate.isNegative()) return { error: 'Use positive numbers' }
    const waitMonths = wait.isZero() ? 0 : wholeMonths(wait, unitOf(WAIT_YM, v))
    if (waitMonths === null) return { error: 'Time of saving must come to whole months, 60 years at most', field: 'wait' }
    if (r.n.withdraw!.isZero()) return { error: 'Enter a withdrawal more than zero' }
    const start = growCorpus(r.n.corpus!, saveRate, waitMonths)
    const out = swp(start, r.n.withdraw!, r.n.rate!)
    const chart = {
      title: 'Balance at each year end',
      labels: out.yearEnd.map((_, i) => `Y${i + 1}`),
      series: [{ name: 'Balance', values: out.yearEnd.map((b) => b.toNumber()) }],
    }
    const formula = ['Each month: balance × (1 + return ÷ 1200) − withdrawal', `Interest in month 1 = ${s(start.times(r.n.rate!).div(1200))} vs withdrawal ${s(r.n.withdraw!)}`]
    if (waitMonths > 0) formula.unshift(`Saving years first: ${s(r.n.corpus!)} × (1 + ${s(saveRate)} ÷ 1200)^${waitMonths} = ${s(start)}`)
    const startRow: Output['rows'] = waitMonths > 0 ? [{ label: 'Amount when withdrawals start', value: start, fmt: 'money' }] : []
    if (out.months === null) {
      return {
        rows: [{ label: 'Lasts', value: 'Never runs out', fmt: 'text', main: true }, ...startRow],
        chart: { ...chart, labels: chart.labels.slice(0, 30), series: [{ ...chart.series[0]!, values: chart.series[0]!.values.slice(0, 30) }] },
        formula,
        note: 'The monthly return covers the withdrawal, so the corpus never runs out at this rate.',
      }
    }
    if (out.months >= 1200) return { rows: [{ label: 'Lasts', value: 'More than 100 years', fmt: 'text', main: true }, ...startRow], formula }
    const end = new Date()
    end.setMonth(end.getMonth() + waitMonths + out.months)
    return {
      rows: [
        { label: 'Months it lasts', value: new D(out.months), fmt: 'int', timeUnit: 'months', main: true },
        { label: 'In years and months', value: `${Math.floor(out.months / 12)} years ${out.months % 12} months`, fmt: 'text' },
        { label: 'Runs out around', value: end.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), fmt: 'text' },
        { label: 'Total withdrawn', value: out.totalWithdrawn, fmt: 'money' },
        ...startRow,
      ],
      chart,
      formula,
      note: 'Withdrawals come at each month’s end, after that month’s return, and the last one is whatever is left. Returns are not guaranteed.' + (waitMonths > 0 ? ' Months are counted from the first withdrawal, after the saving years.' : ' Using one return for both saving and withdrawing years is a common error: set the saving-years return under More options if they differ.'),
    }
  },
}

const PERIODS = { monthly: 12, quarterly: 4, 'half-yearly': 2, yearly: 1 } as const

const fdSpec: ToolSpec = {
  id: 'fd',
  title: 'Fixed deposit',
  blurb: 'Maturity, interest and value after tax',
  category: 'invest',
  keywords: ['fd', 'fixed deposit', 'bank deposit', 'term deposit'],
  fields: [
    num('principal', 'Deposit amount', '100000', 'rupee'),
    num('rate', 'Yearly interest rate', '7', 'percent', EX),
    num('years', 'Number of years', '5', 'years', 'Fractions are fine, e.g. 1.5, or switch to months or days', undefined, undefined, YMD),
    {
      id: 'comp', label: 'Compounded', kind: 'select', default: 'quarterly', advanced: true,
      options: Object.keys(PERIODS).map((k) => ({ value: k, label: k[0]!.toUpperCase() + k.slice(1) })),
    },
    num('slab', 'Your tax slab', '30', 'percent', 'Your highest tax rate, e.g. 30', true, true),
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'principal', label: 'Amount' }, { id: 'rate', label: 'Interest rate' }, { id: 'years', label: 'Years' }])
    if (!r.ok) return r
    const junk = junkOptional(v, [{ id: 'slab', label: 'Your tax slab' }])
    if (junk) return junk
    const slab = parseNum(v.slab) ?? new D(0)
    if (rateBad(r.n.rate!)) return { error: RATE_ERR, field: 'rate' }
    if (negative(r.n) || slab.isNegative()) return { error: 'Use positive numbers' }
    if (slab.gt(100)) return { error: 'Tax slab must be 100% or less' }
    const unit = unitOf(YEARS_YMD, v)
    const t = toYears(r.n.years!, unit)
    if (t.isZero()) return { error: 'Enter years more than zero', field: 'years' }
    if (t.gt(50)) return { error: 'Use 50 years or fewer', field: 'years' }
    const n = PERIODS[v.comp as keyof typeof PERIODS] ?? 4
    const m = fd(r.n.principal!, r.n.rate!, t, n)
    const interest = m.minus(r.n.principal!)
    const tax = interest.times(slab).div(100)
    // Does the time end part way through a compounding period (odd days, 7 months compounded quarterly)? Nine places first: 7 months is 7/12 held to 40 digits.
    const partPeriod = !t.times(n).toDecimalPlaces(9).isInteger()
    return {
      rows: [
        { label: 'Maturity value', value: m, fmt: 'money', main: true },
        { label: 'Interest earned', value: interest, fmt: 'money' },
        { label: 'Tax on interest', value: tax, fmt: 'money' },
        { label: 'Value after tax', value: m.minus(tax), fmt: 'money' },
        { label: 'Effective yearly yield', value: effectiveYield(r.n.rate!, n), fmt: 'percent' },
      ],
      formula: [
        'A = P × (1 + r ÷ (100 × n))^(n × years)',
        `${s(r.n.principal!)} × (1 + ${s(r.n.rate!)} ÷ ${100 * n})^(${n} × ${tShow(r.n.years!, unit, t)})`,
        ...timeLine(r.n.years!, unit, t),
        'Effective yearly yield = ((1 + r ÷ (100 × n))^n − 1) × 100',
      ],
      note:
        'Tax is your slab rate on the whole interest; cess, surcharge and TDS timing are not included.' +
        (partPeriod ? ' A part of a compounding period is compounded fractionally here. A bank may pay plain simple interest for that part instead (unproven), so ask yours.' : '') +
        (unit === 'days' ? ` ${DAYS_NOTE}` : ''),
    }
  },
}

const rdSpec: ToolSpec = {
  id: 'rd',
  title: 'Recurring deposit',
  blurb: 'Maturity value of a monthly deposit',
  category: 'invest',
  keywords: ['rd', 'recurring deposit', 'post office rd', 'monthly deposit'],
  fields: [num('monthly', 'Monthly deposit', '5000', 'rupee'), num('rate', 'Yearly interest rate', '7', 'percent', EX), num('years', 'Number of years', '5', 'years', 'Whole months only, e.g. 1.5 years or 18 months', undefined, undefined, YM)],
  compute: (v) => {
    const r = need(v, [{ id: 'monthly', label: 'Monthly deposit' }, { id: 'rate', label: 'Interest rate' }, { id: 'years', label: 'Years' }])
    if (!r.ok) return r
    if (rateBad(r.n.rate!)) return { error: RATE_ERR, field: 'rate' }
    if (negative(r.n)) return { error: 'Use positive numbers' }
    const unit = unitOf(YEARS_YM, v)
    const months = toWholeMonths(r.n.years!, unit === 'months' ? 'months' : 'years')
    if (months === null) return { error: 'Time must come to whole months', field: 'years' }
    if (months > 720) return { error: 'Use 60 years or fewer', field: 'years' }
    const n = months
    const m = rd(r.n.monthly!, r.n.rate!, n)
    // A row at the end of each year, then one for the last months when the plan stops part way through a year.
    const ends = Array.from({ length: Math.floor(n / 12) }, (_, i) => (i + 1) * 12)
    if (n % 12 !== 0) ends.push(n)
    const yearRows: GrowRow[] = ends.map((k) => ({
      cell: k % 12 === 0 ? new D(k / 12) : `Month ${k}`,
      label: k % 12 === 0 ? `Y${k / 12}` : `M${k}`,
      invested: r.n.monthly!.times(k),
      value: rd(r.n.monthly!, r.n.rate!, k),
    }))
    const invested = r.n.monthly!.times(n)
    return {
      rows: [
        { label: 'Maturity value', value: m, fmt: 'money', main: true },
        { label: 'Deposited', value: invested, fmt: 'money' },
        { label: 'Interest earned', value: m.minus(invested), fmt: 'money' },
      ],
      ...growth(yearRows),
      formula: ['M = Σ R × (1 + r ÷ 400)^(k ÷ 3), k = 1 … months', `R = ${s(r.n.monthly!)}, r = ${s(r.n.rate!)}, ${n} months`],
      note: 'Compounded every quarter, as Indian banks and India Post do. Your bank’s rate may differ.',
    }
  },
}

const ppfSpec: ToolSpec = {
  id: 'ppf',
  rates: RATES_AS_OF,
  title: 'Public Provident Fund',
  blurb: 'PPF maturity, tax-free',
  category: 'invest',
  verified: { source: 'PPF Scheme 2019 gazette (limit, term); OM F.No.1/4/2019-NS 30.09.2026 (7.1% rate)' },
  keywords: ['ppf', 'public provident fund', 'tax free', '80c', 'post office'],
  fields: [
    num('yearly', 'Yearly deposit', '150000', 'rupee', `₹${Number(PPF.minYearly).toLocaleString('en-IN')} to ₹${Number(PPF.maxYearly).toLocaleString('en-IN')} a year`),
    num('rate', 'Yearly interest rate', PPF.rate, 'percent', 'Official rate to 31 Dec 2026. Changes every quarter'),
    {
      id: 'years', label: 'Total years', kind: 'select', default: String(PPF.termYears),
      options: [0, 1, 2, 3, 4].map((k) => {
        const y = PPF.termYears + k * PPF.extensionBlockYears
        return { value: String(y), label: k === 0 ? `${y} years (full term)` : `${y} years (${k} extension${k > 1 ? 's' : ''})` }
      }),
    },
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'yearly', label: 'Yearly deposit' }, { id: 'rate', label: 'Interest rate' }])
    if (!r.ok) return r
    if (r.n.rate!.isNegative()) return { error: 'Use a positive rate' }
    if (r.n.yearly!.lt(PPF.minYearly)) return { error: `The yearly deposit must be at least ₹${PPF.minYearly}` }
    if (r.n.yearly!.gt(PPF.maxYearly)) return { error: 'PPF allows at most ₹1,50,000 a year' }
    const y = Number(v.years) || PPF.termYears
    const rows = ppf(r.n.yearly!, r.n.rate!, y)
    const last = rows.at(-1)!
    return {
      rows: [
        { label: 'Maturity value', value: last.value, fmt: 'money', main: true },
        { label: 'Deposited', value: last.invested, fmt: 'money' },
        { label: 'Tax-free gain', value: last.value.minus(last.invested), fmt: 'money' },
      ],
      ...growth(rows.map(yearRow), 'Balance'),
      formula: ['Each year: balance = (balance + deposit) × (1 + r ÷ 100)', `(balance + ${s(r.n.yearly!)}) × (1 + ${s(r.n.rate!)} ÷ 100), ${y} times`],
      note: `Deposit by 5 April each year to earn that year’s full interest. Locked for 15 years from the end of the year you open it, and extendable in 5-year blocks; limits from the PPF Scheme 2019 gazette. The ${PPF.rate}% rate is official to 31 Dec 2026 (${PPF.rateSource}) but is reset every quarter, so later years assume it holds.`,
    }
  },
}

const npsSpec: ToolSpec = {
  id: 'nps',
  rates: RATES_AS_OF,
  title: 'NPS pension',
  blurb: 'Retirement fund and monthly pension',
  category: 'invest',
  keywords: ['national pension system', 'pension', 'annuity', 'retirement', '80ccd'],
  fields: [
    num('monthly', 'Monthly contribution', '5000', 'rupee'),
    num('rate', RETURN, '10', 'percent'),
    num('age', 'Your age now', '30', 'years'),
    num('retire', 'Retirement age', '60', 'years'),
    num('annuity', 'Share put into annuity', EXAMPLE.npsAnnuityShare, 'percent', 'Example share. Check the current PFRDA rule.', true, true),
    num('annuityRate', 'Yearly annuity rate', EXAMPLE.npsAnnuityRate, 'percent', EX, true, true),
  ],
  compute: (v) => {
    const r = need(v, [
      { id: 'monthly', label: 'Monthly contribution' }, { id: 'rate', label: 'Expected return' }, { id: 'age', label: 'Your age' },
      { id: 'retire', label: 'Retirement age' }, { id: 'annuity', label: 'Annuity share' }, { id: 'annuityRate', label: 'Annuity rate' },
    ])
    if (!r.ok) return r
    if (negative(r.n)) return { error: 'Use positive numbers' }
    if (r.n.annuity!.gt(100)) return { error: 'Annuity share must be 100% or less' }
    const y = wholeYears(r.n.retire!.minus(r.n.age!))
    if (typeof y !== 'number') return { error: 'Retirement age must be at least a year after your age now, in whole years' }
    const corpus = sip(r.n.monthly!, r.n.rate!, y).at(-1)!
    const buy = corpus.value.times(r.n.annuity!).div(100)
    const pension = buy.times(r.n.annuityRate!).div(1200)
    return {
      rows: [
        { label: 'Monthly pension', value: pension, fmt: 'money', main: true },
        { label: `Fund at age ${s(r.n.retire!, 0)}`, value: corpus.value, fmt: 'money' },
        { label: 'Lump sum you take out', value: corpus.value.minus(buy), fmt: 'money' },
        { label: 'Used to buy the annuity', value: buy, fmt: 'money' },
        { label: 'Total you invest', value: corpus.invested, fmt: 'money' },
      ],
      formula: [
        'Corpus = SIP value over (retire − age) years; pension = corpus × annuity % × annuity rate ÷ 12',
        `${s(corpus.value)} × ${s(r.n.annuity!)}% × ${s(r.n.annuityRate!)}% ÷ 12`,
      ],
      note: 'Example annuity share and rate, not official figures: NPS exit rules and insurers’ annuity rates change, so enter your own. Pension is before tax.',
    }
  },
}

const epfSpec: ToolSpec = {
  id: 'epf',
  rates: RATES_AS_OF,
  title: 'Provident fund (EPF)',
  blurb: 'EPF balance at retirement',
  category: 'invest',
  keywords: ['provident fund', 'pf', 'epfo', 'retirement', 'eps'],
  fields: [
    num('basic', 'Monthly basic + DA', '30000', 'rupee'),
    num('years', 'Years to retirement', '25', 'years', WHOLE),
    num('growth', 'Yearly salary rise', '5', 'percent'),
    num('rate', 'Yearly EPF interest rate', EXAMPLE.epfRate, 'percent', EX),
    num('emp', 'Your share (% of basic)', '12', 'percent', undefined, true),
    num('er', 'Employer share (% of basic)', '12', 'percent', 'Part of this goes to pension (EPS), not EPF', true),
    num('ceiling', 'Pension wage ceiling', EXAMPLE.epsWageCeiling, 'rupee', '₹25,000 from 17 Sep 2026. Check your payslip.', true, true),
  ],
  compute: (v) => {
    const r = need(v, [
      { id: 'basic', label: 'Monthly basic' }, { id: 'emp', label: 'Your contribution' }, { id: 'er', label: 'Employer contribution' },
      { id: 'growth', label: 'Salary rise' }, { id: 'years', label: 'Years' }, { id: 'rate', label: 'Interest rate' }, { id: 'ceiling', label: 'Wage ceiling' },
    ])
    if (!r.ok) return r
    if (negative(r.n)) return { error: 'Use positive numbers' }
    const y = wholeYears(r.n.years!)
    if (typeof y !== 'number') return y
    const rows = epf({
      basic: r.n.basic!, employeePct: r.n.emp!, employerPct: r.n.er!, growthPct: r.n.growth!, years: y,
      ratePct: r.n.rate!, epsSharePct: new D(EXAMPLE.epsShare), wageCeiling: r.n.ceiling!,
    })
    const last = rows.at(-1)!
    const eps = D.min(r.n.basic!, r.n.ceiling!).times(EXAMPLE.epsShare).div(100)
    return {
      rows: [
        { label: 'EPF at retirement', value: last.value, fmt: 'money', main: true },
        { label: 'Contributed', value: last.invested, fmt: 'money' },
        { label: 'Interest', value: last.value.minus(last.invested), fmt: 'money' },
      ],
      ...growth(rows.map(yearRow), 'Balance'),
      formula: [
        'Monthly into EPF = basic × your % + (basic × employer % − pension part); interest = rate ÷ 12 on each month’s balance, added yearly',
        `Year 1: ${s(r.n.basic!.times(r.n.emp!).div(100))} + (${s(r.n.basic!.times(r.n.er!).div(100))} − ${s(eps)}) a month`,
      ],
      note: 'Example interest rate and wage ceiling, not confirmed official figures. The pension (EPS) part is not in this total.',
    }
  },
}

const inflationSpec: ToolSpec = {
  id: 'inflation',
  title: 'Inflation',
  blurb: 'Future cost, today’s value and real return',
  category: 'invest',
  keywords: ['real return', 'purchasing power', 'future value', 'present value', 'cost of living'],
  fields: [
    num('amount', 'Amount', '100000', 'rupee'),
    num('infl', 'General inflation', '6', 'percent', EX),
    num('medical', 'Medical inflation', '10', 'percent', 'Usually higher than general. Example rate, enter your own; blank hides the medical lines'),
    num('years', 'Number of years', '10', 'years', 'Fractions are fine, e.g. 1.5, or switch to months', undefined, undefined, YM),
    num('ret', 'Your yearly return', '', 'percent', 'To see the return after inflation', true),
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'amount', label: 'Amount' }, { id: 'infl', label: 'Inflation' }, { id: 'years', label: 'Years' }])
    if (!r.ok) return r
    const junk = junkOptional(v, [{ id: 'ret', label: 'Your yearly return' }, { id: 'medical', label: 'Medical inflation' }])
    if (junk) return junk
    const med = parseNum(v.medical)
    if (rateBad(r.n.infl!) || (med && rateBad(med))) return { error: 'Enter a yearly inflation rate from 0 to 100%', field: rateBad(r.n.infl!) ? 'infl' : 'medical' }
    if (negative(r.n)) return { error: 'Use positive numbers' }
    const unit = unitOf(YEARS_YM, v)
    const t = toYears(r.n.years!, unit)
    if (t.gt(100)) return { error: 'Use 100 years or fewer', field: 'years' }
    const f = new D(1).plus(r.n.infl!.div(100)).pow(t)
    const ret = parseNum(v.ret)
    const rows: Output['rows'] = [
      { label: 'Future cost of the same thing', value: r.n.amount!.times(f), fmt: 'money', main: true },
      { label: 'Future amount, in today’s money', value: r.n.amount!.div(f), fmt: 'money' },
    ]
    const formula = ['Future cost = A × (1 + inflation)^years; today’s value = A ÷ (1 + inflation)^years', `${s(r.n.amount!)} × ${s(f, 6)}`, ...timeLine(r.n.years!, unit, t)]
    if (med) {
      const fm = new D(1).plus(med.div(100)).pow(t)
      rows.splice(2, 0, { label: 'Future cost if it is medical', value: r.n.amount!.times(fm), fmt: 'money' })
      formula.push(`Medical: ${s(r.n.amount!)} × (1 + ${s(med)} ÷ 100)^${tShow(r.n.years!, unit, t)} = ${s(r.n.amount!.times(fm))}`)
    }
    if (ret) {
      rows.push({ label: 'Return after inflation, a year', value: new D(1).plus(ret.div(100)).div(new D(1).plus(r.n.infl!.div(100))).minus(1).times(100), fmt: 'percent' })
      formula.push('Real return = (1 + return) ÷ (1 + inflation) − 1')
    }
    return { rows, formula, note: med ? 'General and medical inflation are separate rates: use the medical line for hospital and insurance costs, the first line for everything else.' : undefined }
  },
}

const XIRR_ERR = {
  'too-few': 'Enter at least two cashflows',
  'no-sign-change': 'Add at least one money-in (negative) and one money-out (positive) amount',
  'no-solution': 'Couldn’t find a rate for these cashflows',
} as const

const returnSpec: ToolSpec = {
  id: 'cagr-xirr',
  title: 'Investment return',
  blurb: 'Yearly growth rate of an investment',
  category: 'invest',
  verified: { source: 'Excel XIRR documentation example (XIRR only)' },
  keywords: ['cagr', 'xirr', 'annualised return', 'irr', 'returns', 'cashflow'],
  fields: [
    {
      id: 'mode', label: 'You have', kind: 'select', default: 'cagr',
      options: [{ value: 'cagr', label: 'Two values' }, { value: 'xirr', label: 'Many dates' }],
    },
    { ...num('start', 'Starting value', '100000', 'rupee'), visibleIf: (v) => v.mode !== 'xirr' } as Field,
    { ...num('end', 'Ending value', '200000', 'rupee'), visibleIf: (v) => v.mode !== 'xirr' } as Field,
    { ...num('years', 'Number of years', '6', 'years', 'Years or months, e.g. 18 months', undefined, undefined, YM), visibleIf: (v) => v.mode !== 'xirr' } as Field,
    {
      id: 'flows', label: 'Money in and out', kind: 'rows', min: 2, max: 50,
      hint: 'Money you put in is negative; money you get back is positive',
      visibleIf: (v) => v.mode === 'xirr',
      columns: [{ id: 'date', label: 'Date', kind: 'date' }, { id: 'amount', label: 'Amount', kind: 'number', unit: 'rupee' }],
      defaultRows: [['2024-01-01', '-100000'], ['2024-07-01', '-50000'], ['2026-01-01', '180000']],
    },
  ],
  compute: (v) => {
    if (v.mode === 'xirr') {
      const flows: { date: Date; amount: Dec }[] = []
      for (const [date, amount] of (v.flows as string[][]) ?? []) {
        const a = parseNum(amount)
        if (!date && a === null) continue
        const d = new Date(`${date}T00:00:00Z`)
        if (!date || isNaN(d.getTime())) return { error: 'Give every cashflow a date' }
        if (a === null) return { error: 'Give every cashflow an amount' }
        flows.push({ date: d, amount: a })
      }
      const out = xirr(flows)
      if ('error' in out) return { error: XIRR_ERR[out.error] }
      return {
        rows: [{ label: 'Annual return (XIRR)', value: out.rate.times(100), fmt: 'percent', main: true }],
        formula: ['Σ amount ÷ (1 + XIRR)^(days since first ÷ 365) = 0', `${flows.length} cashflows, solved by Newton’s method, bisection if needed`],
        note: 'Same method as Excel’s XIRR: actual days ÷ 365.',
      }
    }
    const r = need(v, [{ id: 'start', label: 'Start value' }, { id: 'end', label: 'End value' }, { id: 'years', label: 'Years' }])
    if (!r.ok) return r
    const unit = unitOf(YEARS_YM, v)
    const t = toYears(r.n.years!, unit)
    const c = cagr(r.n.start!, r.n.end!, t)
    if (c === null) return { error: t.lte(0) ? 'Enter years more than zero' : 'Start value must be more than zero, end value zero or more' }
    return {
      rows: [
        { label: 'Yearly growth (CAGR)', value: c, fmt: 'percent', main: true },
        { label: 'Total growth', value: r.n.end!.div(r.n.start!).minus(1).times(100), fmt: 'percent' },
      ],
      formula: ['CAGR = (end ÷ start)^(1 ÷ years) − 1', `(${s(r.n.end!)} ÷ ${s(r.n.start!)})^(1 ÷ ${tShow(r.n.years!, unit, t)}) − 1`, ...timeLine(r.n.years!, unit, t)],
    }
  },
}

export const TOOLS: ToolSpec[] = [sipSpec, stepUpSpec, lumpsumSpec, goalSpec, swpSpec, fdSpec, rdSpec, ppfSpec, npsSpec, epfSpec, inflationSpec, returnSpec]
