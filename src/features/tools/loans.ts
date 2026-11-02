import { D, type Dec } from '../../engine'
import { homeLoanTax, type Occupancy, type Regime } from '../../engine/loans/homeTax'
import {
  balanceTransfer,
  byYear,
  cardEmi,
  compoundInterest,
  effectiveAnnualPct,
  emi,
  maxLoan,
  prepay,
  rateChange,
  schedule,
  simpleInterest,
  sum,
  type PrepayMode,
  type RateChangeMode,
  type Row,
} from '../../engine/loans/loan'
import { CARD_GST_PCT, HOME_LOAN_TAX, LOAN_RULES_AS_OF, PRESETS, type LoanType } from '../../engine/loans/rules'
import { need, parseNum, type Computed, type Field, type Output, type ResultTable, type ToolSpec, type Values } from '../../lib/tool'

// ---- shared fields and helpers ------------------------------------------------

const ROUNDING_NOTE = 'Worked at full precision. Banks round the EMI to the rupee and adjust the last one, so their table can differ by a few rupees.'

const principalField = (d = '5000000'): Field => ({ id: 'principal', label: 'Loan amount', kind: 'number', unit: 'rupee', default: d })
const rateField = (d = '8.5', id = 'rate', label = 'Yearly interest rate'): Field => ({
  id,
  label,
  kind: 'number',
  unit: 'percent',
  default: d,
  hint: 'Example rate. Enter your own.',
})
/** Loan term as a number plus a years/months switch. `tuck` hides the switch under "More options" when the form is long. */
const tenureFields = (tuck = false): Field[] => [
  { id: 'tenure', label: 'Loan term', kind: 'number', default: '20', hint: tuck ? 'In years. Switch to months under More options.' : undefined },
  {
    id: 'tenureUnit',
    label: 'Years or months',
    kind: 'select',
    default: 'years',
    advanced: tuck || undefined,
    options: [
      { value: 'years', label: 'Years' },
      { value: 'months', label: 'Months' },
    ],
  },
]

const LOAN_NEEDS = [
  { id: 'principal', label: 'Loan amount' },
  { id: 'rate', label: 'Interest rate' },
  { id: 'tenure', label: 'Loan term' },
]

/** Tenure in whole months, from a number and a years/months select. */
function toMonths(t: Dec, unit: unknown): number | { error: string } {
  const m = unit === 'years' ? t.times(12) : t
  if (m.lte(0)) return { error: 'Loan term must be more than zero' }
  if (!m.isInteger()) return { error: 'Loan term must come to a whole number of months' }
  if (m.gt(600)) return { error: 'Loan term can be at most 50 years' }
  return m.toNumber()
}

interface Loan {
  p: Dec
  rate: Dec
  n: number
}

/** Reads principal, rate and tenure; checks them. */
function readLoan(v: Values): Loan | { error: string } {
  const r = need(v, LOAN_NEEDS)
  if (!r.ok) return r
  const { principal: p, rate, tenure } = r.n as Record<string, Dec>
  if (p!.lte(0)) return { error: 'Loan amount must be more than zero' }
  if (rate!.lt(0)) return { error: "Interest rate can't be negative" }
  if (rate!.gt(100)) return { error: 'Interest rate looks too high. Enter a yearly rate in percent' }
  const n = toMonths(tenure!, v.tenureUnit)
  if (typeof n !== 'number') return n
  return { p: p!, rate: rate!, n }
}

const money = (x: Dec) => `₹${x.toFixed(2)}`
const pct = (x: Dec) => `${x.toFixed()}%`
const yearsMonths = (m: number) => (m >= 12 ? `${Math.floor(m / 12)} y ${m % 12} m` : `${m} m`)

function scheduleTable(rows: Row[], yearly: boolean, title?: string): ResultTable {
  const view = yearly ? byYear(rows) : rows
  return {
    title,
    columns: [yearly ? 'Year' : 'Month', yearly ? 'Paid' : 'EMI', 'Interest', 'Principal', 'Balance'],
    fmts: ['int', 'money', 'money', 'money', 'money'],
    rows: view.map((x) => [new D(x.month), x.payment, x.interest, x.principal, x.balance]),
  }
}

const emiFormula = (l: Loan, e: Dec) => [
  'EMI = P × r × (1 + r)^n ÷ ((1 + r)^n − 1), r = yearly rate ÷ 12 ÷ 100',
  l.rate.isZero()
    ? `Rate is 0, so EMI = P ÷ n = ${l.p.toFixed()} ÷ ${l.n} = ${e.toFixed(2)}`
    : `P = ${l.p.toFixed()}, r = ${l.rate.toFixed()} ÷ 1200, n = ${l.n} → EMI = ${e.toFixed(2)}`,
]

// ---- C1 EMI -------------------------------------------------------------------------

const emiSpec: ToolSpec = {
  id: 'emi',
  title: 'Loan EMI',
  blurb: 'Monthly payment, interest and total payable',
  category: 'loans',
  keywords: ['emi', 'loan', 'instalment', 'installment', 'home loan', 'car loan', 'interest'],
  fields: [principalField(), rateField(), ...tenureFields()],
  compute: (v) => {
    const l = readLoan(v)
    if ('error' in l) return l
    const rows = schedule(l.p, l.rate, l.n)
    const e = rows[0]!.payment
    const interest = sum(rows, 'interest')
    const years = byYear(rows)
    return {
      rows: [
        { label: 'Monthly EMI', value: e, fmt: 'money', main: true },
        { label: 'Total interest', value: interest, fmt: 'money' },
        { label: 'Total you pay', value: l.p.plus(interest), fmt: 'money' },
        { label: 'Interest as share of total', value: interest.div(l.p.plus(interest)).times(100), fmt: 'percent' },
      ],
      chart: {
        title: 'Principal and interest paid each year',
        labels: years.map((y) => `Y${y.month}`),
        series: [
          { name: 'Principal', values: years.map((y) => y.principal.toNumber()) },
          { name: 'Interest', values: years.map((y) => y.interest.toNumber()) },
        ],
      },
      formula: emiFormula(l, e),
      note: ROUNDING_NOTE,
    }
  },
}

// ---- C2 Amortisation schedule ----------------------------------------------------------

const scheduleSpec: ToolSpec = {
  id: 'amortisation',
  title: 'Repayment schedule',
  blurb: 'Interest and balance, year by year',
  category: 'loans',
  keywords: ['amortization', 'schedule', 'repayment', 'table', 'outstanding', 'balance'],
  fields: [
    principalField(),
    rateField(),
    ...tenureFields(),
    {
      id: 'view',
      label: 'Show',
      kind: 'select',
      default: 'yearly',
      options: [
        { value: 'yearly', label: 'Yearly' },
        { value: 'monthly', label: 'Monthly' },
      ],
    },
  ],
  compute: (v) => {
    const l = readLoan(v)
    if ('error' in l) return l
    const rows = schedule(l.p, l.rate, l.n)
    const e = rows[0]!.payment
    return {
      rows: [
        { label: 'Monthly EMI', value: e, fmt: 'money', main: true },
        { label: 'Total interest', value: sum(rows, 'interest'), fmt: 'money' },
        { label: 'Number of EMIs', value: new D(l.n), fmt: 'int' },
      ],
      table: scheduleTable(rows, v.view !== 'monthly'),
      formula: [...emiFormula(l, e), 'Each month: interest = balance × r; principal = EMI − interest; balance falls by the principal'],
      note: ROUNDING_NOTE,
    }
  },
}

// ---- C3 Prepayment ------------------------------------------------------------------------

const prepaySpec: ToolSpec = {
  id: 'prepayment',
  title: 'Loan prepayment',
  blurb: 'Pay extra: lower EMI or shorter loan',
  category: 'loans',
  keywords: ['prepay', 'part payment', 'foreclose', 'lump sum', 'reduce emi', 'reduce tenure'],
  fields: [
    principalField(),
    rateField(),
    ...tenureFields(true),
    { id: 'amount', label: 'Prepayment amount', kind: 'number', unit: 'rupee', default: '500000' },
    { id: 'after', label: 'Prepay after EMI number', kind: 'number', unit: 'months', default: '24' },
    {
      id: 'mode',
      label: 'Use it to get',
      kind: 'select',
      default: 'reduceTenure',
      advanced: true,
      options: [
        { value: 'reduceTenure', label: 'Shorter loan' },
        { value: 'reduceEmi', label: 'Lower EMI' },
      ],
    },
  ],
  compute: (v) => {
    const l = readLoan(v)
    if ('error' in l) return l
    const r = need(v, [
      { id: 'amount', label: 'Prepayment' },
      { id: 'after', label: 'EMI number' },
    ])
    if (!r.ok) return r
    const { amount, after } = r.n as Record<string, Dec>
    if (amount!.lte(0)) return { error: 'Prepayment must be more than zero' }
    if (!after!.isInteger() || after!.lt(1) || after!.gte(l.n)) return { error: `EMI number must be a whole number from 1 to ${l.n - 1}` }
    const mode = v.mode as PrepayMode
    const out = prepay(l.p, l.rate, l.n, amount!, after!.toNumber(), mode)
    if (out === 'clears') return { error: 'That prepayment clears the whole loan. Nothing would be left to repay' }
    if (out === null) return { error: 'Check the EMI number' }
    const oldEmi = out.base[0]!.payment
    return {
      rows: [
        { label: 'Interest saved', value: out.interestSaved, fmt: 'money', main: true, tone: 'positive' },
        mode === 'reduceEmi'
          ? { label: 'New EMI', value: out.newEmi, fmt: 'money' }
          : { label: 'Months saved', value: new D(out.monthsSaved), fmt: 'int' },
        { label: 'EMI before', value: oldEmi, fmt: 'money' },
        { label: 'New loan term', value: yearsMonths(out.months), fmt: 'text' },
        { label: 'Interest without prepayment', value: sum(out.base, 'interest'), fmt: 'money' },
        { label: 'Interest with prepayment', value: sum(out.rows, 'interest'), fmt: 'money' },
      ],
      table: scheduleTable(out.rows, true, `Revised schedule by year (prepayment of ${money(amount!)} after EMI ${after!.toFixed()})`),
      formula: [
        `Balance after EMI ${after!.toFixed()} = ${out.base[after!.toNumber() - 1]!.balance.toFixed(2)}; less ${amount!.toFixed()} prepaid`,
        mode === 'reduceEmi'
          ? `New EMI = EMI formula on the rest over ${l.n - after!.toNumber()} months = ${out.newEmi.toFixed(2)}`
          : `Same EMI ${oldEmi.toFixed(2)} until the balance is 0: ${out.months} months in all`,
        `Interest saved = ${sum(out.base, 'interest').toFixed(2)} − ${sum(out.rows, 'interest').toFixed(2)}`,
      ],
      note: `Assumes no prepayment charge. ${ROUNDING_NOTE}`,
    }
  },
}

// ---- C4 Reverse EMI ------------------------------------------------------------------------

const reverseSpec: ToolSpec = {
  id: 'reverse-emi',
  title: 'Affordable loan',
  blurb: 'Biggest loan your EMI can repay',
  category: 'loans',
  keywords: ['affordability', 'eligibility', 'reverse emi', 'how much loan', 'max loan'],
  fields: [{ id: 'emi', label: 'EMI you can pay', kind: 'number', unit: 'rupee', default: '40000' }, rateField(), ...tenureFields()],
  compute: (v) => {
    const r = need(v, [
      { id: 'emi', label: 'EMI' },
      { id: 'rate', label: 'Interest rate' },
      { id: 'tenure', label: 'Loan term' },
    ])
    if (!r.ok) return r
    const { emi: pay, rate, tenure } = r.n as Record<string, Dec>
    if (pay!.lte(0)) return { error: 'EMI must be more than zero' }
    if (rate!.lt(0) || rate!.gt(100)) return { error: 'Enter a yearly rate from 0 to 100%' }
    const n = toMonths(tenure!, v.tenureUnit)
    if (typeof n !== 'number') return n
    const p = maxLoan(pay!, rate!, n)
    const total = pay!.times(n)
    return {
      rows: [
        { label: 'Maximum loan', value: p, fmt: 'money', main: true },
        { label: 'Total you repay', value: total, fmt: 'money' },
        { label: 'Total interest', value: total.minus(p), fmt: 'money' },
      ],
      formula: [
        'P = EMI × ((1 + r)^n − 1) ÷ (r × (1 + r)^n), r = yearly rate ÷ 12 ÷ 100',
        `EMI = ${pay!.toFixed()}, r = ${rate!.toFixed()} ÷ 1200, n = ${n} → P = ${p.toFixed(2)}`,
      ],
      note: 'Lenders also cap the EMI at a share of your income and look at your credit score, so they may offer less.',
    }
  },
}

// ---- C5 Rate change ---------------------------------------------------------------------------

const rateChangeSpec: ToolSpec = {
  id: 'rate-change',
  title: 'Floating rate change',
  blurb: 'See what a rate change does',
  category: 'loans',
  keywords: ['floating', 'repo', 'rate hike', 'rate cut', 'reset', 'mclr', 'eblr'],
  fields: [
    principalField(),
    rateField('8.5', 'rate', 'Current yearly rate'),
    ...tenureFields(true),
    { id: 'delta', label: 'Change in rate', kind: 'number', unit: 'percent', default: '0.5', hint: '0.25 for a rise, -0.25 for a cut' },
    { id: 'from', label: 'Change applies from EMI', kind: 'number', unit: 'months', default: '13' },
    {
      id: 'mode',
      label: 'Bank keeps',
      kind: 'select',
      default: 'keepEmi',
      advanced: true,
      options: [
        { value: 'keepEmi', label: 'Same EMI' },
        { value: 'keepTenure', label: 'Same term' },
      ],
    },
  ],
  compute: (v) => {
    const l = readLoan(v)
    if ('error' in l) return l
    const r = need(v, [
      { id: 'delta', label: 'Rate change' },
      { id: 'from', label: 'EMI number' },
    ])
    if (!r.ok) return r
    const { delta, from } = r.n as Record<string, Dec>
    const newRate = l.rate.plus(delta!)
    if (newRate.lt(0)) return { error: "The new rate can't be below zero" }
    if (!from!.isInteger() || from!.lt(1) || from!.gt(l.n)) return { error: `EMI number must be a whole number from 1 to ${l.n}` }
    const mode = v.mode as RateChangeMode
    const out = rateChange(l.p, l.rate, l.n, newRate, from!.toNumber(), mode)
    if (!out) return { error: "At the new rate this EMI doesn't cover the interest, so the loan would never end. The bank would raise the EMI" }
    const oldEmi = out.base[0]!.payment
    const more = out.extraInterest.gte(0)
    return {
      rows: [
        mode === 'keepTenure'
          ? { label: 'New EMI', value: out.newEmi, fmt: 'money', main: true }
          : { label: 'New loan term', value: yearsMonths(out.months), fmt: 'text', main: true },
        mode === 'keepTenure'
          ? { label: 'EMI change', value: out.newEmi.minus(oldEmi), fmt: 'money' }
          : { label: 'Term change (months)', value: new D(out.months - l.n), fmt: 'int' },
        { label: more ? 'Extra interest' : 'Interest saved', value: out.extraInterest.abs(), fmt: 'money' },
        { label: 'New rate', value: newRate, fmt: 'percent' },
      ],
      table: scheduleTable(out.rows, true, 'Revised schedule by year'),
      formula: [
        `Rate ${pct(l.rate)} → ${pct(newRate)} from EMI ${from!.toFixed()}`,
        mode === 'keepTenure'
          ? `New EMI = EMI formula on the balance then, over ${l.n - from!.toNumber() + 1} months = ${out.newEmi.toFixed(2)}`
          : `Same EMI ${oldEmi.toFixed(2)} until the balance is 0: ${out.months} months in all`,
      ],
      note: ROUNDING_NOTE,
    }
  },
}

// ---- C6 Loan comparison -----------------------------------------------------------------------

const compareSpec: ToolSpec = {
  id: 'loan-compare',
  title: 'Compare loan offers',
  blurb: 'Side by side, fees included',
  category: 'loans',
  keywords: ['compare', 'offers', 'best loan', 'processing fee', 'cheapest'],
  fields: [
    {
      id: 'offers',
      label: 'Loan offers',
      kind: 'rows',
      min: 2,
      max: 3,
      columns: [
        { id: 'principal', label: 'Loan amount', kind: 'number', unit: 'rupee' },
        { id: 'rate', label: 'Yearly rate', kind: 'number', unit: 'percent' },
        { id: 'tenure', label: 'Term', kind: 'number' },
        { id: 'fee', label: 'Fee', kind: 'number', unit: 'rupee' },
      ],
      defaultRows: [
        ['5000000', '8.5', '20', '10000'],
        ['5000000', '8.35', '20', '25000'],
      ],
    },
    tenureFields()[1]!,
  ],
  compute: (v): Computed => {
    const offers = Array.isArray(v.offers) ? v.offers : []
    const results: { p: Dec; e: Dec; interest: Dec; fee: Dec; total: Dec; eff: Dec }[] = []
    for (const [i, row] of offers.entries()) {
      const [p, rate, tenure, fee] = row.map((c) => parseNum(c))
      if (!p || !rate || !tenure) return { error: `Fill in the loan amount, rate and tenure of offer ${i + 1}` }
      if (p.lte(0)) return { error: `Offer ${i + 1}: loan amount must be more than zero` }
      if (rate.lt(0) || rate.gt(100)) return { error: `Offer ${i + 1}: enter a yearly rate from 0 to 100%` }
      const n = toMonths(tenure, v.tenureUnit)
      if (typeof n !== 'number') return { error: `Offer ${i + 1}: ${n.error.toLowerCase()}` }
      const f = fee ?? new D(0)
      if (f.lt(0)) return { error: `Offer ${i + 1}: fee can't be negative` }
      if (f.gte(p)) return { error: `Offer ${i + 1}: fee is more than the loan` }
      const rows = schedule(p, rate, n)
      const interest = sum(rows, 'interest')
      results.push({
        p,
        e: rows[0]!.payment,
        interest,
        fee: f,
        total: p.plus(interest).plus(f),
        eff: effectiveAnnualPct(p.minus(f), rows.map((x) => x.payment)) ?? new D(0),
      })
    }
    if (results.length < 2) return { error: 'Add at least two offers' }
    const best = results.reduce((b, x, i) => (x.eff.lt(results[b]!.eff) ? i : b), 0)
    return {
      rows: [
        { label: 'Cheapest offer', value: `Offer ${best + 1}`, fmt: 'text', main: true },
        { label: 'Its yearly rate with fee', value: results[best]!.eff, fmt: 'percent' },
      ],
      table: {
        columns: ['Offer', 'EMI', 'Interest', 'Fee', 'Total cost', 'Rate with fee'],
        fmts: ['text', 'money', 'money', 'money', 'money', 'percent'],
        rows: results.map((x, i) => [`Offer ${i + 1}`, x.e, x.interest, x.fee, x.total, x.eff]),
      },
      formula: [
        'Total cost = loan + total interest + fee',
        'Rate with fee = the yearly rate at which the EMIs repay (loan − fee), compounded monthly',
      ],
      note: 'Cheapest means the lowest yearly rate once the fee is counted. A longer loan can still cost more total interest, and GST on the fee is not included.',
    }
  },
}

// ---- C7 Home loan tax benefit -----------------------------------------------------------------

const homeTaxSpec: ToolSpec = {
  id: 'home-loan-tax',
  title: 'Home loan tax benefit',
  blurb: 'Tax saved on your home loan',
  category: 'loans',
  keywords: ['24b', '80c', 'section 22', 'section 123', 'home loan tax', 'deduction', 'housing loan interest'],
  fields: [
    principalField(),
    rateField(),
    ...tenureFields(true),
    { id: 'slab', label: 'Your tax slab', kind: 'number', unit: 'percent', default: '30', hint: 'Optional: add 4% cess, so 30% becomes 31.2%' },
    {
      id: 'regime',
      label: 'Tax regime',
      kind: 'select',
      default: 'old',
      options: [
        { value: 'old', label: 'Old regime' },
        { value: 'new', label: 'New regime' },
      ],
    },
    {
      id: 'occupancy',
      label: 'House is',
      kind: 'select',
      default: 'self',
      advanced: true,
      options: [
        { value: 'self', label: 'Self-use' },
        { value: 'letOut', label: 'Rented out' },
      ],
    },
    {
      id: 'rent',
      label: 'Yearly rent after municipal tax',
      kind: 'number',
      unit: 'rupee',
      default: '240000',
      advanced: true,
      visibleIf: (v) => v.occupancy === 'letOut',
    },
    {
      id: 'used123',
      label: 'Section 123 limit already used',
      hint: 'PF, insurance, ELSS and similar',
      kind: 'number',
      unit: 'rupee',
      default: '0',
      advanced: true,
      visibleIf: (v) => v.regime === 'old',
    },
  ],
  compute: (v) => {
    const l = readLoan(v)
    if ('error' in l) return l
    const slab = parseNum(v.slab)
    if (!slab) return { error: 'Enter your tax slab' }
    if (slab.lt(0) || slab.gt(50)) return { error: 'Tax slab must be from 0 to 50%' }
    const occupancy = v.occupancy as Occupancy
    const regime = v.regime as Regime
    const rent = occupancy === 'letOut' ? parseNum(v.rent) : new D(0)
    if (!rent) return { error: 'Enter the yearly rent' }
    const used = regime === 'old' ? (parseNum(v.used123) ?? new D(0)) : new D(0)
    if (rent.lt(0) || used.lt(0)) return { error: "Amounts can't be negative" }
    const years = homeLoanTax(l.p, l.rate, l.n, slab, occupancy, regime, rent, used)
    const y1 = years[0]!
    const total = years.reduce((s, y) => s.plus(y.taxSaved), new D(0))
    const interestTaxSaved = y1.interestDeduction.times(slab).div(100)
    const effRate = y1.interest.isZero() ? l.rate : l.rate.times(new D(1).minus(interestTaxSaved.div(y1.interest)))
    const out: Output = {
      rows: [
        { label: 'Tax saved in year 1', value: y1.taxSaved, fmt: 'money', main: true, tone: 'positive' },
        { label: 'Interest deduction, year 1', value: y1.interestDeduction, fmt: 'money' },
        { label: 'Principal deduction, year 1', value: y1.principalDeduction, fmt: 'money' },
        { label: 'Tax saved over the loan', value: total, fmt: 'money', tone: 'positive' },
        { label: 'Loan rate after tax saving, year 1', value: effRate, fmt: 'percent' },
      ],
      table: {
        title: 'By loan year',
        columns: ['Year', 'Interest', 'Principal', 'Interest claimed', 'Principal claimed', 'Tax saved'],
        fmts: ['int', 'money', 'money', 'money', 'money', 'money'],
        rows: years.map((y) => [new D(y.year), y.interest, y.principal, y.interestDeduction, y.principalDeduction, y.taxSaved]),
      },
      formula:
        regime === 'new'
          ? occupancy === 'self'
            ? ['New regime (s.202): no interest deduction for a house you live in, and no section 123 deduction']
            : [
                `New regime: interest only down to zero house income: min(interest, 70% × ${rent.toFixed()})`,
                'No set-off of a house loss against other income, and no section 123',
              ]
          : [
              occupancy === 'self'
                ? `Interest deduction = min(interest, ₹2,00,000) (s.22(2)) = min(${y1.interest.toFixed(2)}, 200000)`
                : `Interest deduction = min(interest, 70% × rent + ₹2,00,000 set-off) = min(${y1.interest.toFixed(2)}, ${rent.times('0.7').plus(HOME_LOAN_TAX.houseLossSetOffCap).toFixed(2)})`,
              `Principal deduction = min(principal, ₹1,50,000 − ${used.toFixed()} already used) (s.123)`,
              `Tax saved = (interest deduction + principal deduction) × ${slab.toFixed()}%`,
            ],
      note: `Income-tax Act, 2025 rules for tax year ${HOME_LOAN_TAX.taxYear}, as of ${LOAN_RULES_AS_OF}; not tax advice. Assumes a house you live in unless you change it under More options, that the loan buys or builds it and it is finished within 5 years (else the interest cap is ₹30,000), that each loan year is a tax year, that limits stay the same, and that loss carried forward is not counted.`,
    }
    return out
  },
}

// ---- C8 Balance transfer --------------------------------------------------------------------------

const transferSpec: ToolSpec = {
  id: 'balance-transfer',
  title: 'Loan balance transfer',
  blurb: 'Is moving your loan worth it?',
  category: 'loans',
  keywords: ['balance transfer', 'refinance', 'switch bank', 'takeover'],
  fields: [
    { id: 'balance', label: 'Loan balance left', kind: 'number', unit: 'rupee', default: '4000000' },
    rateField('9.5', 'oldRate', 'Current yearly rate'),
    rateField('8.5', 'newRate', 'New yearly rate'),
    { id: 'months', label: 'Months left', kind: 'number', unit: 'months', default: '180' },
    { id: 'fees', label: 'Switching costs', hint: 'Fee, legal and stamp duty', kind: 'number', unit: 'rupee', default: '20000' },
  ],
  compute: (v) => {
    const r = need(v, [
      { id: 'balance', label: 'Balance left' },
      { id: 'oldRate', label: 'Rate now' },
      { id: 'months', label: 'Months left' },
      { id: 'newRate', label: 'New rate' },
    ])
    if (!r.ok) return r
    const { balance, oldRate, months, newRate } = r.n as Record<string, Dec>
    const fees = parseNum(v.fees) ?? new D(0)
    if (balance!.lte(0)) return { error: 'Balance must be more than zero' }
    if (oldRate!.lt(0) || newRate!.lt(0) || oldRate!.gt(100) || newRate!.gt(100)) return { error: 'Enter yearly rates from 0 to 100%' }
    if (!months!.isInteger() || months!.lt(1) || months!.gt(600)) return { error: 'Months left must be a whole number from 1 to 600' }
    if (fees.lt(0)) return { error: "Switching costs can't be negative" }
    const n = months!.toNumber()
    const out = balanceTransfer(balance!, oldRate!, n, newRate!, fees)
    const worth = out.netSaving.gt(0)
    return {
      rows: [
        { label: worth ? 'Net saving' : 'Net loss', value: out.netSaving.abs(), fmt: 'money', main: true },
        { label: 'Breaks even after', value: out.breakeven === null ? 'Never, within the loan' : `${out.breakeven} months`, fmt: 'text' },
        { label: 'EMI now', value: out.oldEmi, fmt: 'money' },
        { label: 'EMI after transfer', value: out.newEmi, fmt: 'money' },
        { label: 'Saving each month', value: out.perMonth, fmt: 'money' },
      ],
      formula: [
        `Saving a month = EMI at ${pct(oldRate!)} − EMI at ${pct(newRate!)} = ${out.perMonth.toFixed(2)}`,
        `Net saving = ${out.perMonth.toFixed(2)} × ${n} − ${fees.toFixed()}`,
        out.breakeven === null ? 'Break-even: the monthly saving never covers the costs' : `Break-even = costs ÷ saving a month, rounded up = ${out.breakeven}`,
      ],
      note: worth ? 'Worth it if you stay the full term. Same tenure assumed; savings are not discounted.' : 'Not worth it at these numbers.',
    }
  },
}

// ---- C9 Simple vs compound --------------------------------------------------------------------------

const FREQ: Record<string, number> = { yearly: 1, halfYearly: 2, quarterly: 4, monthly: 12, daily: 365 }

const interestSpec: ToolSpec = {
  id: 'simple-compound',
  title: 'Simple vs compound interest',
  blurb: 'Simple, compound and the gap',
  category: 'loans',
  keywords: ['simple interest', 'compound interest', 'si', 'ci', 'compounding'],
  fields: [
    { id: 'principal', label: 'Principal amount', kind: 'number', unit: 'rupee', default: '100000' },
    { id: 'rate', label: 'Yearly interest rate', kind: 'number', unit: 'percent', default: '10' },
    { id: 'years', label: 'Duration', kind: 'number', unit: 'years', default: '5' },
    {
      id: 'freq',
      label: 'Compounded',
      kind: 'select',
      default: 'yearly',
      advanced: true,
      options: [
        { value: 'yearly', label: 'Yearly' },
        { value: 'halfYearly', label: 'Half-yearly' },
        { value: 'quarterly', label: 'Quarterly' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'daily', label: 'Daily (365)' },
      ],
    },
  ],
  compute: (v) => {
    const r = need(v, [
      { id: 'principal', label: 'Principal' },
      { id: 'rate', label: 'Rate' },
      { id: 'years', label: 'Time' },
    ])
    if (!r.ok) return r
    const { principal: p, rate, years: t } = r.n as Record<string, Dec>
    if (p!.lte(0)) return { error: 'Principal must be more than zero' }
    if (rate!.lt(0) || rate!.gt(1000)) return { error: 'Enter a yearly rate from 0 to 1000%' }
    if (t!.lte(0) || t!.gt(100)) return { error: 'Time must be more than 0 and at most 100 years' }
    const m = FREQ[v.freq as string] ?? 1
    const si = simpleInterest(p!, rate!, t!)
    const ci = compoundInterest(p!, rate!, t!, m)
    const marks = Array.from({ length: Math.floor(t!.toNumber()) }, (_, i) => new D(i + 1))
    if (!t!.isInteger()) marks.push(t!)
    return {
      rows: [
        { label: 'Compound interest', value: ci, fmt: 'money', main: true },
        { label: 'Simple interest', value: si, fmt: 'money' },
        { label: 'Difference', value: ci.minus(si), fmt: 'money' },
        { label: 'Total with compound interest', value: p!.plus(ci), fmt: 'money' },
      ],
      table: {
        title: 'Growth by year',
        columns: ['Year', 'Simple', 'Compound', 'Gap'],
        fmts: ['number', 'money', 'money', 'money'],
        rows: marks.map((y) => {
          const s = simpleInterest(p!, rate!, y)
          const c = compoundInterest(p!, rate!, y, m)
          return [y, p!.plus(s), p!.plus(c), c.minus(s)]
        }),
      },
      formula: [
        'SI = P × R × T ÷ 100;  CI = P × (1 + R ÷ 100 ÷ m)^(m × T) − P',
        `P = ${p!.toFixed()}, R = ${rate!.toFixed()}, T = ${t!.toFixed()}, m = ${m}`,
      ],
    }
  },
}

// ---- C10 Credit card EMI -------------------------------------------------------------------------------

const cardSpec: ToolSpec = {
  id: 'card-emi',
  title: 'Credit card EMI cost',
  blurb: 'True cost including GST',
  category: 'loans',
  keywords: ['credit card', 'no cost emi', 'card emi', 'gst', 'processing fee'],
  fields: [
    { id: 'principal', label: 'Purchase amount', kind: 'number', unit: 'rupee', default: '60000' },
    { id: 'rate', label: 'Yearly interest rate', kind: 'number', unit: 'percent', default: '15', hint: 'Example rate. Enter your own, or 0 for no-cost EMI.' },
    { id: 'tenure', label: 'Months to repay', kind: 'number', unit: 'months', default: '12' },
    { id: 'fee', label: 'Processing fee', kind: 'number', unit: 'rupee', default: '199' },
  ],
  compute: (v) => {
    const r = need(v, [
      { id: 'principal', label: 'Purchase amount' },
      { id: 'rate', label: 'Interest rate' },
      { id: 'tenure', label: 'Months to repay' },
    ])
    if (!r.ok) return r
    const { principal: p, rate, tenure } = r.n as Record<string, Dec>
    const fee = parseNum(v.fee) ?? new D(0)
    if (p!.lte(0)) return { error: 'Purchase amount must be more than zero' }
    if (rate!.lt(0) || rate!.gt(100)) return { error: 'Enter a yearly rate from 0 to 100%' }
    if (!tenure!.isInteger() || tenure!.lt(1) || tenure!.gt(120)) return { error: 'Tenure must be a whole number of months from 1 to 120' }
    if (fee.lt(0)) return { error: "Fee can't be negative" }
    const n = tenure!.toNumber()
    const g = new D(CARD_GST_PCT)
    if (fee.times(g.plus(100)).div(100).gte(p!)) return { error: 'The fee is more than the purchase' }
    const out = cardEmi(p!, rate!, n, fee, g)
    return {
      rows: [
        { label: 'Extra you pay over the price', value: out.extra, fmt: 'money', main: true },
        { label: 'EMI (before GST)', value: out.emi, fmt: 'money' },
        { label: 'First month payment, with GST', value: out.firstMonthOut, fmt: 'money' },
        { label: 'Interest', value: out.interest, fmt: 'money' },
        { label: `GST on interest (${CARD_GST_PCT}%)`, value: out.gstOnInterest, fmt: 'money' },
        { label: `Fee + GST`, value: fee.plus(out.gstOnFee), fmt: 'money' },
        { label: 'Total you pay', value: out.total, fmt: 'money' },
        ...(out.effective ? [{ label: 'Real yearly rate (with GST and fee)', value: out.effective, fmt: 'percent' as const }] : []),
      ],
      formula: [
        'EMI = P × r × (1 + r)^n ÷ ((1 + r)^n − 1); each month GST = 18% × that month’s interest',
        `Total = ${p!.toFixed()} + ${out.interest.toFixed(2)} + ${out.gstOnInterest.toFixed(2)} GST + ${fee.toFixed()} fee + ${out.gstOnFee.toFixed(2)} GST`,
        'Effective yearly cost = the rate at which the payments (EMI + GST) repay (price − fee − GST on fee), compounded monthly',
      ],
      note: `GST ${CARD_GST_PCT}% on card interest and fees (heading 9971; card interest is outside the loan-interest exemption), as of ${LOAN_RULES_AS_OF}. The GST falls each month as the interest does, and the fee is assumed to be charged at the start.`,
    }
  },
}

// ---- C11 Loan presets ---------------------------------------------------------------------------------

const presetSpec: ToolSpec = {
  id: 'loan-presets',
  title: 'Typical loan rates',
  blurb: 'Typical rates by loan type',
  category: 'loans',
  keywords: ['typical rate', 'home loan rate', 'car loan rate', 'personal loan rate', 'education loan', 'gold loan'],
  fields: [
    {
      id: 'type',
      label: 'Loan type',
      kind: 'select',
      default: 'home',
      options: (Object.keys(PRESETS) as LoanType[]).map((k) => ({ value: k, label: PRESETS[k].label })),
    },
    { ...principalField('3000000'), label: 'Loan amount for example EMI' },
  ],
  compute: (v) => {
    const pr = PRESETS[v.type as LoanType] ?? PRESETS.home
    const p = parseNum(v.principal)
    const rows: Output['rows'] = [
      { label: 'Typical rate', value: pr.rate ?? 'Not shown: no figure could be checked', fmt: 'text', main: true },
      { label: 'Usual loan term', value: pr.tenure, fmt: 'text' },
    ]
    const formula: string[] = []
    if (pr.rateFrom && p && p.gt(0)) {
      const e = emi(p, new D(pr.rateFrom), pr.exampleMonths)
      rows.push({ label: `Example EMI at ${pr.rateFrom}% for ${yearsMonths(pr.exampleMonths)}`, value: e, fmt: 'money' })
      formula.push(...emiFormula({ p, rate: new D(pr.rateFrom), n: pr.exampleMonths }, e))
    }
    rows.push({ label: 'Source', value: pr.source, fmt: 'text' })
    return {
      rows,
      formula: formula.length ? formula : undefined,
      note: `Typical, not an offer. Published SBI figures checked ${LOAN_RULES_AS_OF}; your rate depends on your lender, credit score and income.`,
    }
  },
}

export const TOOLS: ToolSpec[] = [
  emiSpec,
  scheduleSpec,
  prepaySpec,
  reverseSpec,
  rateChangeSpec,
  compareSpec,
  homeTaxSpec,
  transferSpec,
  interestSpec,
  cardSpec,
  presetSpec,
]
