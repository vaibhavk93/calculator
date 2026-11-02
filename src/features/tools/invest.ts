import { D, type Dec } from '../../engine/decimal'
import { formatDecimal } from '../../lib/format'
import { cagr, epf, fd, goalSip, lumpsum, ppf, rd, sip, swp, xirr, type YearRow } from '../../engine/investments/invest'
import { EXAMPLE, PPF } from '../../engine/investments/rates'
import { need, parseNum, type Field, type Output, type ToolSpec } from '../../lib/tool'

/** Grouped the Indian way for the worked-out lines (1,50,000 and not 150000). */
const s = (v: Dec, dp = 2) => formatDecimal(v.toDecimalPlaces(dp), { system: 'indian', decimals: 'auto' })
const EX = 'Example rate, enter your own'

const num = (id: string, label: string, def: string, unit: Extract<Field, { kind: 'number' }>['unit'] = 'none', hint?: string, advanced?: boolean): Field => ({
  id, label, kind: 'number', unit, default: def, hint, advanced,
})
const RETURN = 'Expected yearly return'
const WHOLE = 'Whole years only'

/** Whole years 1..60, or an error. */
function wholeYears(y: Dec): number | { error: string } {
  if (!y.isInteger() || y.lt(1)) return { error: 'Years must be a whole number, 1 or more' }
  if (y.gt(60)) return { error: 'Use 60 years or fewer' }
  return y.toNumber()
}

const negative = (n: Record<string, Dec>) => Object.values(n).some((v) => v.isNegative())

/** Stacked chart and year-wise table: invested vs returns (D13, the growth visualiser). */
function growth(rows: YearRow[], valueLabel = 'Value'): Pick<Output, 'chart' | 'table'> {
  return {
    chart: {
      title: 'Invested vs returns',
      labels: rows.map((r) => `Y${r.year}`),
      series: [
        { name: 'Invested', values: rows.map((r) => r.invested.toNumber()) },
        { name: 'Returns', values: rows.map((r) => r.value.minus(r.invested).toNumber()) },
      ],
    },
    table: {
      title: 'Year by year',
      columns: ['Year', 'Invested', 'Returns', valueLabel],
      fmts: ['int', 'money', 'money', 'money'],
      rows: rows.map((r) => [new D(r.year), r.invested, r.value.minus(r.invested), r.value]),
    },
  }
}

const SIP_NOTE = 'Assumes each payment goes in at the start of the month and grows at return ÷ 12 each month, the usual convention for Indian SIP calculators. Returns are not guaranteed.'

const sipSpec: ToolSpec = {
  id: 'sip',
  title: 'SIP: monthly investing',
  blurb: 'What your monthly SIP grows to',
  category: 'invest',
  keywords: ['mutual fund', 'systematic investment plan', 'monthly investment', 'corpus'],
  fields: [num('monthly', 'Monthly investment', '5000', 'rupee'), num('rate', RETURN, '12', 'percent'), num('years', 'Number of years', '10', 'years', WHOLE)],
  compute: (v) => {
    const r = need(v, [{ id: 'monthly', label: 'Monthly amount' }, { id: 'rate', label: 'Expected return' }, { id: 'years', label: 'Years' }])
    if (!r.ok) return r
    if (negative(r.n)) return { error: 'Use positive numbers' }
    const y = wholeYears(r.n.years!)
    if (typeof y !== 'number') return y
    const rows = sip(r.n.monthly!, r.n.rate!, y)
    const last = rows[rows.length - 1]!
    return {
      rows: [
        { label: 'Value at the end', value: last.value, fmt: 'money', main: true },
        { label: 'Total invested', value: last.invested, fmt: 'money' },
        { label: 'Gains', value: last.value.minus(last.invested), fmt: 'money' },
      ],
      ...growth(rows),
      formula: ['FV = P × ((1+i)^n − 1) ÷ i × (1+i), i = return ÷ 12 ÷ 100', `${s(r.n.monthly!)} × ((1+${s(r.n.rate!.div(1200), 6)})^${y * 12} − 1) ÷ ${s(r.n.rate!.div(1200), 6)} × (1+${s(r.n.rate!.div(1200), 6)})`],
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
    if (negative(r.n)) return { error: 'Use positive numbers' }
    const y = wholeYears(r.n.years!)
    if (typeof y !== 'number') return y
    const rows = sip(r.n.monthly!, r.n.rate!, y, r.n.step!)
    const flat = sip(r.n.monthly!, r.n.rate!, y).at(-1)!
    const last = rows.at(-1)!
    return {
      rows: [
        { label: 'Value at the end', value: last.value, fmt: 'money', main: true },
        { label: 'Total invested', value: last.invested, fmt: 'money' },
        { label: 'Gains', value: last.value.minus(last.invested), fmt: 'money' },
        { label: 'Without step-up', value: flat.value, fmt: 'money' },
        { label: 'Extra from step-up', value: last.value.minus(flat.value), fmt: 'money' },
      ],
      ...growth(rows),
      formula: [
        'Each year the monthly amount × (1 + step ÷ 100); each month balance = (balance + amount) × (1 + return ÷ 1200)',
        `Year ${y} monthly amount = ${s(r.n.monthly!)} × ${s(new D(1).plus(r.n.step!.div(100)), 4)}^${y - 1}`,
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
  fields: [num('amount', 'Amount invested', '100000', 'rupee'), num('rate', RETURN, '12', 'percent'), num('years', 'Number of years', '10', 'years', WHOLE)],
  compute: (v) => {
    const r = need(v, [{ id: 'amount', label: 'Amount' }, { id: 'rate', label: 'Expected return' }, { id: 'years', label: 'Years' }])
    if (!r.ok) return r
    if (negative(r.n)) return { error: 'Use positive numbers' }
    const y = wholeYears(r.n.years!)
    if (typeof y !== 'number') return y
    const rows = lumpsum(r.n.amount!, r.n.rate!, y)
    const last = rows.at(-1)!
    return {
      rows: [
        { label: 'Final value', value: last.value, fmt: 'money', main: true },
        { label: 'Gains', value: last.value.minus(last.invested), fmt: 'money' },
      ],
      ...growth(rows),
      formula: ['A = P × (1 + r ÷ 100)^years', `${s(r.n.amount!)} × (1 + ${s(r.n.rate!)} ÷ 100)^${y}`],
      note: 'Compounded once a year. Returns are not guaranteed.',
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
    num('years', 'Number of years', '10', 'years', WHOLE),
    num('existing', 'Already saved', '0', 'rupee', undefined, true),
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'target', label: 'Target amount' }, { id: 'rate', label: 'Expected return' }, { id: 'years', label: 'Years' }])
    if (!r.ok) return r
    const existing = parseNum(v.existing) ?? new D(0)
    if (negative(r.n) || existing.isNegative()) return { error: 'Use positive numbers' }
    const y = wholeYears(r.n.years!)
    if (typeof y !== 'number') return y
    const p = goalSip(r.n.target!, r.n.rate!, y, existing)!
    const grown = existing.times(new D(1).plus(r.n.rate!.div(100)).pow(y))
    return {
      rows: [
        { label: 'Monthly SIP needed', value: p, fmt: 'money', main: true },
        { label: 'Savings so far grow to', value: grown, fmt: 'money' },
        { label: 'Total you will invest', value: p.times(y * 12), fmt: 'money' },
      ],
      formula: [
        'P = (target − saved × (1+r)^years) ÷ (((1+i)^n − 1) ÷ i × (1+i)), i = r ÷ 12',
        `(${s(r.n.target!)} − ${s(grown)}) ÷ SIP factor for ${y * 12} months`,
      ],
      note: p.isZero() ? 'What you have already saved reaches the target on its own.' : SIP_NOTE,
    }
  },
}

const swpSpec: ToolSpec = {
  id: 'swp',
  title: 'SWP: monthly withdrawals',
  blurb: 'How long your money lasts',
  category: 'invest',
  keywords: ['systematic withdrawal', 'retirement income', 'monthly withdrawal', 'depletion'],
  fields: [num('corpus', 'Starting amount', '1000000', 'rupee'), num('withdraw', 'Monthly withdrawal', '10000', 'rupee'), num('rate', RETURN, '8', 'percent')],
  compute: (v) => {
    const r = need(v, [{ id: 'corpus', label: 'Corpus' }, { id: 'withdraw', label: 'Monthly withdrawal' }, { id: 'rate', label: 'Expected return' }])
    if (!r.ok) return r
    if (negative(r.n)) return { error: 'Use positive numbers' }
    if (r.n.withdraw!.isZero()) return { error: 'Enter a withdrawal more than zero' }
    const out = swp(r.n.corpus!, r.n.withdraw!, r.n.rate!)
    const chart = {
      title: 'Balance at each year end',
      labels: out.yearEnd.map((_, i) => `Y${i + 1}`),
      series: [{ name: 'Balance', values: out.yearEnd.map((b) => b.toNumber()) }],
    }
    const formula = ['Each month: balance × (1 + return ÷ 1200) − withdrawal', `Interest in month 1 = ${s(r.n.corpus!.times(r.n.rate!).div(1200))} vs withdrawal ${s(r.n.withdraw!)}`]
    if (out.months === null) {
      return {
        rows: [{ label: 'Lasts', value: 'Never runs out', fmt: 'text', main: true }],
        chart: { ...chart, labels: chart.labels.slice(0, 30), series: [{ ...chart.series[0]!, values: chart.series[0]!.values.slice(0, 30) }] },
        formula,
        note: 'The monthly return covers the withdrawal, so the corpus never runs out at this rate.',
      }
    }
    if (out.months >= 1200) return { rows: [{ label: 'Lasts', value: 'More than 100 years', fmt: 'text', main: true }], formula }
    const end = new Date()
    end.setMonth(end.getMonth() + out.months)
    return {
      rows: [
        { label: 'Months it lasts', value: new D(out.months), fmt: 'int', main: true },
        { label: 'In years and months', value: `${Math.floor(out.months / 12)} years ${out.months % 12} months`, fmt: 'text' },
        { label: 'Runs out around', value: end.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), fmt: 'text' },
        { label: 'Total withdrawn', value: out.totalWithdrawn, fmt: 'money' },
      ],
      chart,
      formula,
      note: 'Withdrawals come at each month’s end, after that month’s return, and the last one is whatever is left. Returns are not guaranteed.',
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
    num('years', 'Number of years', '5', 'years', 'Fractions are fine, e.g. 1.5'),
    {
      id: 'comp', label: 'Compounded', kind: 'select', default: 'quarterly', advanced: true,
      options: Object.keys(PERIODS).map((k) => ({ value: k, label: k[0]!.toUpperCase() + k.slice(1) })),
    },
    num('slab', 'Your tax slab', '30', 'percent', 'Your highest tax rate, e.g. 30', true),
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'principal', label: 'Amount' }, { id: 'rate', label: 'Interest rate' }, { id: 'years', label: 'Years' }])
    if (!r.ok) return r
    const slab = parseNum(v.slab) ?? new D(0)
    if (negative(r.n) || slab.isNegative()) return { error: 'Use positive numbers' }
    if (slab.gt(100)) return { error: 'Tax slab must be 100% or less' }
    if (r.n.years!.isZero()) return { error: 'Enter years more than zero' }
    const n = PERIODS[v.comp as keyof typeof PERIODS] ?? 4
    const m = fd(r.n.principal!, r.n.rate!, r.n.years!, n)
    const interest = m.minus(r.n.principal!)
    const tax = interest.times(slab).div(100)
    return {
      rows: [
        { label: 'Maturity value', value: m, fmt: 'money', main: true },
        { label: 'Interest earned', value: interest, fmt: 'money' },
        { label: 'Tax on interest', value: tax, fmt: 'money' },
        { label: 'Value after tax', value: m.minus(tax), fmt: 'money' },
      ],
      formula: ['A = P × (1 + r ÷ (100 × n))^(n × years)', `${s(r.n.principal!)} × (1 + ${s(r.n.rate!)} ÷ ${100 * n})^(${n} × ${s(r.n.years!)})`],
      note: 'Tax is your slab rate on the whole interest; cess, surcharge and TDS timing are not included.',
    }
  },
}

const rdSpec: ToolSpec = {
  id: 'rd',
  title: 'Recurring deposit',
  blurb: 'Maturity value of a monthly deposit',
  category: 'invest',
  keywords: ['rd', 'recurring deposit', 'post office rd', 'monthly deposit'],
  fields: [num('monthly', 'Monthly deposit', '5000', 'rupee'), num('rate', 'Yearly interest rate', '7', 'percent', EX), num('years', 'Number of years', '5', 'years', 'Fractions are fine, e.g. 1.5')],
  compute: (v) => {
    const r = need(v, [{ id: 'monthly', label: 'Monthly deposit' }, { id: 'rate', label: 'Interest rate' }, { id: 'years', label: 'Years' }])
    if (!r.ok) return r
    if (negative(r.n)) return { error: 'Use positive numbers' }
    const months = r.n.years!.times(12)
    if (!months.isInteger() || months.lt(1)) return { error: 'Years must come to whole months, e.g. 1, 1.5 or 2.25' }
    if (months.gt(720)) return { error: 'Use 60 years or fewer' }
    const n = months.toNumber()
    const m = rd(r.n.monthly!, r.n.rate!, n)
    const yearRows: YearRow[] = []
    for (let y = 1; y * 12 <= n; y++) yearRows.push({ year: y, invested: r.n.monthly!.times(y * 12), value: rd(r.n.monthly!, r.n.rate!, y * 12) })
    const invested = r.n.monthly!.times(n)
    return {
      rows: [
        { label: 'Maturity value', value: m, fmt: 'money', main: true },
        { label: 'Deposited', value: invested, fmt: 'money' },
        { label: 'Interest earned', value: m.minus(invested), fmt: 'money' },
      ],
      ...(yearRows.length > 0 ? growth(yearRows) : {}),
      formula: ['M = Σ R × (1 + r ÷ 400)^(k ÷ 3), k = 1 … months', `R = ${s(r.n.monthly!)}, r = ${s(r.n.rate!)}, ${n} months`],
      note: 'Compounded every quarter, as Indian banks and India Post do. Your bank’s rate may differ.',
    }
  },
}

const ppfSpec: ToolSpec = {
  id: 'ppf',
  title: 'Public Provident Fund',
  blurb: 'PPF maturity, tax-free',
  category: 'invest',
  keywords: ['ppf', 'public provident fund', 'tax free', '80c', 'post office'],
  fields: [
    num('yearly', 'Yearly deposit', '150000', 'rupee', `₹${Number(PPF.minYearly).toLocaleString('en-IN')} to ₹${Number(PPF.maxYearly).toLocaleString('en-IN')} a year`),
    num('rate', 'Yearly interest rate', EXAMPLE.ppfRate, 'percent', EX),
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
      ...growth(rows, 'Balance'),
      formula: ['Each year: balance = (balance + deposit) × (1 + r ÷ 100)', `(balance + ${s(r.n.yearly!)}) × (1 + ${s(r.n.rate!)} ÷ 100), ${y} times`],
      note: `Deposit by 5 April each year to earn that year’s full interest. Locked for 15 years from the end of the year you open it, and extendable in 5-year blocks; limits as of ${PPF.confirmed} (PPF Scheme 2019), and the rate changes every quarter so one rate is an estimate.`,
    }
  },
}

const npsSpec: ToolSpec = {
  id: 'nps',
  title: 'NPS pension',
  blurb: 'Retirement fund and monthly pension',
  category: 'invest',
  keywords: ['national pension system', 'pension', 'annuity', 'retirement', '80ccd'],
  fields: [
    num('monthly', 'Monthly contribution', '5000', 'rupee'),
    num('rate', RETURN, '10', 'percent'),
    num('age', 'Your age now', '30', 'years'),
    num('retire', 'Retirement age', '60', 'years'),
    num('annuity', 'Share put into annuity', EXAMPLE.npsAnnuityShare, 'percent', 'Example share. Check the current PFRDA rule.', true),
    num('annuityRate', 'Yearly annuity rate', EXAMPLE.npsAnnuityRate, 'percent', EX, true),
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
    num('ceiling', 'Pension wage ceiling', EXAMPLE.epsWageCeiling, 'rupee', 'Was ₹15,000, reportedly ₹25,000 from Sep 2026. Check payslip.', true),
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
      ...growth(rows, 'Balance'),
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
    num('infl', 'Yearly inflation', '6', 'percent', EX),
    num('years', 'Number of years', '10', 'years'),
    num('ret', 'Your yearly return', '', 'percent', 'To see the return after inflation', true),
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'amount', label: 'Amount' }, { id: 'infl', label: 'Inflation' }, { id: 'years', label: 'Years' }])
    if (!r.ok) return r
    if (negative(r.n)) return { error: 'Use positive numbers' }
    const f = new D(1).plus(r.n.infl!.div(100)).pow(r.n.years!)
    const ret = parseNum(v.ret)
    const rows: Output['rows'] = [
      { label: 'Future cost of the same thing', value: r.n.amount!.times(f), fmt: 'money', main: true },
      { label: 'Future amount, in today’s money', value: r.n.amount!.div(f), fmt: 'money' },
    ]
    const formula = ['Future cost = A × (1 + inflation)^years; today’s value = A ÷ (1 + inflation)^years', `${s(r.n.amount!)} × ${s(f, 6)}`]
    if (ret) {
      rows.push({ label: 'Return after inflation, a year', value: new D(1).plus(ret.div(100)).div(new D(1).plus(r.n.infl!.div(100))).minus(1).times(100), fmt: 'percent' })
      formula.push('Real return = (1 + return) ÷ (1 + inflation) − 1')
    }
    return { rows, formula }
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
  keywords: ['cagr', 'xirr', 'annualised return', 'irr', 'returns', 'cashflow'],
  fields: [
    {
      id: 'mode', label: 'You have', kind: 'select', default: 'cagr',
      options: [{ value: 'cagr', label: 'Two values' }, { value: 'xirr', label: 'Many dates' }],
    },
    { ...num('start', 'Starting value', '100000', 'rupee'), visibleIf: (v) => v.mode !== 'xirr' } as Field,
    { ...num('end', 'Ending value', '200000', 'rupee'), visibleIf: (v) => v.mode !== 'xirr' } as Field,
    { ...num('years', 'Number of years', '6', 'years'), visibleIf: (v) => v.mode !== 'xirr' } as Field,
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
    const c = cagr(r.n.start!, r.n.end!, r.n.years!)
    if (c === null) return { error: r.n.years!.lte(0) ? 'Enter years more than zero' : 'Start value must be more than zero, end value zero or more' }
    return {
      rows: [
        { label: 'Yearly growth (CAGR)', value: c, fmt: 'percent', main: true },
        { label: 'Total growth', value: r.n.end!.div(r.n.start!).minus(1).times(100), fmt: 'percent' },
      ],
      formula: ['CAGR = (end ÷ start)^(1 ÷ years) − 1', `(${s(r.n.end!)} ÷ ${s(r.n.start!)})^(1 ÷ ${s(r.n.years!)}) − 1`],
    }
  },
}

export const TOOLS: ToolSpec[] = [sipSpec, stepUpSpec, lumpsumSpec, goalSpec, swpSpec, fdSpec, rdSpec, ppfSpec, npsSpec, epfSpec, inflationSpec, returnSpec]
