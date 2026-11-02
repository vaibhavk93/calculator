import { D, type Dec } from '../../engine'
import { advanceTax } from '../../engine/tax/advanceTax'
import { capitalGains, type Asset } from '../../engine/tax/capitalGains'
import { gratuity } from '../../engine/tax/gratuity'
import { compareRegimes, inHandSalary, presumptive, type Regime, type TaxResult } from '../../engine/tax/incomeTax'
import { RULES_FY2026_27 as R, taxNote, type AgeBand } from '../../engine/tax/rules.FY2026-27'
import { need, parseNum, type Field, type ResultRow, type ResultTable, type ToolSpec, type Values } from '../../lib/tool'

// ---- shared ---------------------------------------------------------------------

const NOTE = taxNote(R)
const ZERO = new D(0)
const opt = (v: Values, id: string): Dec => parseNum(v[id]) ?? ZERO
const money = (id: string, label: string, d: string, hint?: string, advanced?: boolean): Field => ({ id, label, kind: 'number', unit: 'rupee', default: d, hint, advanced })
const r0 = (x: Dec) => x.toDecimalPlaces(0, D.ROUND_HALF_UP).toFixed()
const regimeName = (r: Regime) => (r === 'new' ? 'New regime' : 'Old regime')

const ageField: Field = {
  id: 'age',
  label: 'Your age',
  kind: 'select',
  default: 'below60',
  advanced: true,
  options: [
    { value: 'below60', label: 'Below 60' },
    { value: '60to80', label: '60 to 79' },
    { value: '80plus', label: '80 or more' },
  ],
}
const regimeField: Field = {
  id: 'regime',
  label: 'Tax regime',
  kind: 'select',
  default: 'new',
  options: [
    { value: 'new', label: 'New regime' },
    { value: 'old', label: 'Old regime' },
  ],
}
const yesNo = (id: string, label: string, d: 'yes' | 'no', hint?: string, advanced?: boolean): Field => ({
  id,
  label,
  kind: 'select',
  default: d,
  hint,
  advanced,
  options: [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ],
})

function slabTable(t: TaxResult): ResultTable {
  return {
    title: `${regimeName(t.regime)}: tax slab by slab`,
    columns: ['From', 'Up to', 'Rate', 'Tax'],
    fmts: ['money', 'money', 'percent', 'money'],
    rows: t.slabs.map((s) => [s.from, s.to ?? 'No limit', s.ratePct, s.tax]),
  }
}

const taxLine = (t: TaxResult) =>
  `${regimeName(t.regime)}: ₹${r0(t.slabTax)} − rebate ₹${r0(t.rebate)} + surcharge ₹${r0(t.surcharge)} + cess ₹${r0(t.cess)} = ₹${r0(t.total)}`

// ---- E1 income tax ----------------------------------------------------------------

const incomeTaxSpec: ToolSpec = {
  id: 'income-tax',
  title: 'Income tax: old vs new',
  blurb: 'Which regime saves you more',
  category: 'tax',
  keywords: ['income tax', 'regime', 'slab', '80C', '80D', 'NPS', 'rebate', '87A', 'surcharge', 'old vs new'],
  fields: [
    money('salary', 'Yearly salary before tax', '1500000', 'Before standard deduction. Include employer NPS.'),
    money('sec123', 'Section 80C (old regime)', '150000', 'PF, PPF, ELSS, life cover. Max ₹1,50,000.'),
    money('healthSelf', 'Health insurance 80D (old regime)', '25000', 'Premium for self and family.'),
    money('homeLoan', 'Home loan interest (old regime)', '200000', 'Self-occupied house. Max ₹2,00,000.'),
    money('hra', 'HRA exemption (old regime)', '', 'From your Form 16 or payslip.'),
    money('other', 'Other income', '', 'Interest, rent and similar. Not capital gains.', true),
    ageField,
    money('basicDa', 'Yearly basic + DA', '600000', 'Only used to cap the employer NPS deduction.', true),
    money('employerNps', 'Employer NPS contribution', '', 'Both regimes. Max 14% (new) or 10% (old) of basic + DA.', true),
    money('healthParents', 'Parents health insurance (old regime)', '', 'Premium for your parents (80D).', true),
    yesNo('parentsSenior', 'Parents are 60 or older', 'no', undefined, true),
    money('ownNps', 'Your own NPS (old regime)', '', 'Extra 80CCD(1B). Max ₹50,000.', true),
    money('pt', 'Professional tax paid (old regime)', '2400', 'Max ₹2,500.', true),
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'salary', label: 'Gross salary' }])
    if (!r.ok) return r
    const nums = ['other', 'basicDa', 'employerNps', 'sec123', 'healthSelf', 'healthParents', 'ownNps', 'homeLoan', 'hra', 'pt']
    if ([r.n.salary!, ...nums.map((id) => opt(v, id))].some((x) => x.isNegative())) return { error: 'Amounts cannot be negative' }
    const c = compareRegimes(
      {
        age: v.age as AgeBand,
        salary: r.n.salary!,
        otherIncome: opt(v, 'other'),
        basicDa: opt(v, 'basicDa'),
        employerNps: opt(v, 'employerNps'),
        sec123: opt(v, 'sec123'),
        healthSelf: opt(v, 'healthSelf'),
        healthParents: opt(v, 'healthParents'),
        parentsSenior: v.parentsSenior === 'yes',
        ownNps: opt(v, 'ownNps'),
        homeLoanInterest: opt(v, 'homeLoan'),
        hraExempt: opt(v, 'hra'),
        professionalTax: opt(v, 'pt'),
      },
      R,
    )
    const pick = c.cheaper === 'old' ? c.old : c.new
    const verdict =
      c.cheaper === 'same' ? 'Both regimes cost the same' : `${regimeName(c.cheaper)} is cheaper by ₹${r0(c.saving)}`
    const rows: ResultRow[] = [
      // No tone when both regimes cost the same: there is nothing good or bad about a tie.
      { label: verdict, value: c.saving, fmt: 'money', main: true, ...(c.cheaper === 'same' ? {} : { tone: 'positive' as const }) },
      { label: 'Tax, new regime', value: c.new.total, fmt: 'money' },
      { label: 'Tax, old regime', value: c.old.total, fmt: 'money' },
      { label: 'Taxable income, new regime', value: c.new.totalIncome, fmt: 'money' },
      { label: 'Taxable income, old regime', value: c.old.totalIncome, fmt: 'money' },
      { label: `Tax as share of income, ${regimeName(pick.regime).toLowerCase()}`, value: pick.effectivePct, fmt: 'percent' },
    ]
    return {
      rows,
      table: slabTable(pick),
      formula: [
        'Tax = slab tax − rebate + surcharge + 4% cess, rounded to ₹10',
        taxLine(c.new),
        taxLine(c.old),
        ...pick.deductions.map((d) => `${regimeName(pick.regime)} deduction: ${d.label} ₹${r0(d.amount)}`),
      ],
      note: `${NOTE} Slab-rate income only; capital gains are taxed separately.`,
    }
  },
}

// ---- E2 in-hand salary -----------------------------------------------------------

const salarySpec: ToolSpec = {
  id: 'in-hand-salary',
  title: 'Take-home salary',
  blurb: 'Monthly take-home from yearly CTC',
  category: 'tax',
  keywords: ['ctc', 'take home', 'in hand', 'salary', 'pf', 'gratuity', 'professional tax'],
  fields: [
    money('ctc', 'Yearly CTC (total package)', '1200000'),
    { id: 'basicPct', label: 'Basic + DA, % of CTC', kind: 'number', unit: 'percent', default: '50' },
    { id: 'pfPct', label: 'Your PF (% of basic)', kind: 'number', unit: 'percent', default: R.pfPct, hint: 'Usual EPF rate is 12%. Enter 0 for no PF.' },
    yesNo('employerPf', 'CTC includes employer PF', 'yes'),
    yesNo('gratuityInCtc', 'CTC includes gratuity', 'yes', 'Many employers set aside 15/26 of a month’s basic a year.'),
    money('ptMonthly', 'Professional tax, monthly', '200', 'Set by your state; some have none. Check payslip.', true),
    money('hra', 'Yearly HRA exemption (old regime)', '', 'From your Form 16 or payslip.', true),
    ageField,
  ],
  compute: (v) => {
    const r = need(v, [
      { id: 'ctc', label: 'CTC' },
      { id: 'basicPct', label: 'Basic %' },
      { id: 'pfPct', label: 'PF %' },
    ])
    if (!r.ok) return r
    if (opt(v, 'ptMonthly').isNegative() || opt(v, 'hra').isNegative()) return { error: 'Amounts cannot be negative' }
    const s = inHandSalary(
      {
        ctc: r.n.ctc!,
        basicPct: r.n.basicPct!,
        pfPct: r.n.pfPct!,
        employerPfInCtc: v.employerPf === 'yes',
        gratuityInCtc: v.gratuityInCtc === 'yes',
        professionalTaxMonthly: opt(v, 'ptMonthly'),
        hraExempt: opt(v, 'hra'),
        age: v.age as AgeBand,
      },
      R,
    )
    if (!s) return { error: 'CTC must be above zero and basic between 1% and 100%' }
    return {
      rows: [
        { label: 'Take-home a month', value: s.monthlyInHand, fmt: 'money', main: true },
        { label: 'Take-home a year', value: s.annualInHand, fmt: 'money' },
        { label: `Income tax (${regimeName(s.regime).toLowerCase()}, the cheaper one)`, value: s.incomeTax, fmt: 'money' },
      ],
      table: {
        title: 'Where the CTC goes, per year',
        columns: ['Item', 'Amount'],
        fmts: ['text', 'money'],
        rows: [
          ['CTC', r.n.ctc!],
          ['Employer PF (in CTC)', s.employerPf],
          ['Gratuity set aside (in CTC)', s.gratuity],
          ['Gross salary', s.grossSalary],
          ['Your PF', s.employeePf],
          ['Professional tax', s.professionalTax],
          ['Income tax', s.incomeTax],
          ['Take-home', s.annualInHand],
        ],
      },
      formula: [
        'Take-home = CTC − employer PF − gratuity − your PF − professional tax − income tax',
        `₹${r0(r.n.ctc!)} − ₹${r0(s.employerPf)} − ₹${r0(s.gratuity)} − ₹${r0(s.employeePf)} − ₹${r0(s.professionalTax)} − ₹${r0(s.incomeTax)} = ₹${r0(s.annualInHand)}`,
        `Gratuity = basic × 15 ÷ 26 ÷ 12 = ₹${r0(s.basic)} × 15 ÷ 26 ÷ 12`,
        `Tax: new ₹${r0(s.tax.new.total)}, old ₹${r0(s.tax.old.total)} (old uses your PF as 80C)`,
      ],
      note: `${NOTE} PF is worked on full basic; if your employer caps PF at the statutory wage ceiling, enter your actual % instead.`,
    }
  },
}

// ---- E4 capital gains ------------------------------------------------------------

const slabOptions = ['0', '5', '10', '15', '20', '25', '30'].map((x) => ({ value: x, label: `${x}%` }))

const cgSpec: ToolSpec = {
  id: 'capital-gains',
  title: 'Capital gains tax',
  blurb: 'Tax on selling shares, property or gold',
  category: 'tax',
  keywords: ['capital gains', 'ltcg', 'stcg', 'shares', 'mutual fund', 'property', 'gold', 'indexation', 'cii'],
  fields: [
    {
      id: 'asset',
      label: 'What did you sell',
      kind: 'select',
      default: 'equity',
      hint: 'Shares and equity funds count only if STT was paid.',
      options: [
        { value: 'equity', label: 'Shares or equity fund' },
        { value: 'debtFund', label: 'Debt mutual fund' },
        { value: 'property', label: 'Land or building' },
        { value: 'gold', label: 'Gold or jewellery' },
      ],
    },
    { id: 'buyDate', label: 'Buy date', kind: 'date', default: '2023-06-15' },
    { id: 'sellDate', label: 'Sell date', kind: 'date', default: '2026-09-15' },
    money('buy', 'Buying price', '500000'),
    money('sell', 'Selling price', '800000'),
    money('expenses', 'Selling costs', '', 'Brokerage, agent fees and similar.', true),
    { id: 'slab', label: 'Your tax slab', kind: 'select', default: '30', options: slabOptions, hint: 'Used where the gain is taxed at slab rates.', advanced: true },
    { ...money('used', 'LTCG exemption already used', '', 'The ₹1,25,000 limit covers all equity sales this year.', true), visibleIf: (v) => v.asset === 'equity' } as Field,
  ],
  compute: (v) => {
    const r = need(v, [
      { id: 'buy', label: 'Purchase price' },
      { id: 'sell', label: 'Sale price' },
    ])
    if (!r.ok) return r
    const out = capitalGains(
      {
        asset: v.asset as Asset,
        buyDate: String(v.buyDate ?? ''),
        sellDate: String(v.sellDate ?? ''),
        buyPrice: r.n.buy!,
        sellPrice: r.n.sell!,
        expenses: opt(v, 'expenses'),
        slabPct: new D(String(v.slab)),
        exemptionUsed: v.asset === 'equity' ? opt(v, 'used') : ZERO,
      },
      R,
    )
    if ('error' in out) return out
    const term = out.term === 'long' ? 'Long-term' : 'Short-term'
    const rows: ResultRow[] = [
      { label: 'Tax on this gain, with cess', value: out.total, fmt: 'money', main: true },
      { label: 'Holding type', value: `${term} (held ${out.monthsHeld} months)` },
      { label: out.gain.isNegative() ? 'Loss' : 'Gain', value: out.gain.abs(), fmt: 'money' },
      { label: 'Taxable gain', value: out.taxableGain, fmt: 'money' },
      { label: out.rateKind === 'slab' ? 'Rate (your slab)' : 'Rate', value: out.ratePct, fmt: 'percent' },
    ]
    const formula = [
      'Gain = sale price − purchase price − selling costs',
      `₹${r0(r.n.sell!)} − ₹${r0(r.n.buy!)} − ₹${r0(opt(v, 'expenses'))} = ₹${r0(out.gain)}`,
      `Tax = ₹${r0(out.taxableGain)} × ${out.ratePct.toFixed()}% = ₹${r0(out.tax)}, + 4% cess = ₹${r0(out.total)}`,
    ]
    let table: ResultTable | undefined
    if (out.indexed) {
      const x = out.indexed
      formula.push(`Indexed cost = ₹${r0(r.n.buy!)} × ${x.ciiSell} ÷ ${x.ciiBuy} = ₹${r0(x.indexedCost)}`)
      table = {
        title: 'Bought before 23 Jul 2024: the lower tax applies',
        columns: ['Method', 'Gain', 'Rate', 'Tax'],
        fmts: ['text', 'money', 'percent', 'money'],
        rows: [
          [`12.5% without indexation${x.chosen === 'flat' ? ' (used)' : ''}`, out.gain, new D(R.capitalGains.ltcgPct), x.flatTax],
          [`20% with indexation${x.chosen === 'indexed' ? ' (used)' : ''}`, x.gain, new D(R.capitalGains.propertyIndexedPct), x.tax],
        ],
      }
    }
    return {
      rows,
      table,
      formula,
      note: `${NOTE} One sale on its own: no surcharge, rebate or loss set-off, and your other income is assumed to use the basic exemption. Equity means listed shares or equity funds with STT paid.`,
    }
  },
}

// ---- E5 advance tax ----------------------------------------------------------------

const advanceSpec: ToolSpec = {
  id: 'advance-tax',
  title: 'Advance tax',
  blurb: 'Instalments, due dates and late interest',
  category: 'tax',
  keywords: ['advance tax', '234b', '234c', 'instalment', 'due date', 'interest', 'self assessment'],
  fields: [
    money('tax', 'Total tax for the year', '200000', 'After rebate, with surcharge and cess. See the income tax tool.'),
    money('tds', 'TDS and TCS already deducted', '50000'),
    money('p1', 'Paid by 15 Jun', ''),
    money('p2', 'Paid 16 Jun-15 Sep', ''),
    money('p3', 'Paid 16 Sep-15 Dec', ''),
    money('p4', 'Paid 16 Dec-15 Mar', ''),
    yesNo('presumptive', 'Presumptive taxation (44AD/44ADA)', 'no', undefined, true),
    yesNo('senior', 'Age 60+, no business income', 'no', undefined, true),
    { id: 'months', label: 'Months after 31 Mar 2027', kind: 'number', unit: 'months', default: '4', hint: 'Until you pay the rest. Part month counts. 31 July is 4.', advanced: true },
  ],
  compute: (v) => {
    const r = need(v, [
      { id: 'tax', label: 'Tax for the year' },
      { id: 'months', label: 'Months' },
    ])
    if (!r.ok) return r
    const a = advanceTax(
      {
        tax: r.n.tax!,
        tds: opt(v, 'tds'),
        paid: [opt(v, 'p1'), opt(v, 'p2'), opt(v, 'p3'), opt(v, 'p4')],
        presumptive: v.presumptive === 'yes',
        seniorNoBusiness: v.senior === 'yes',
        monthsAfterYear: r.n.months!.toNumber(),
      },
      R,
    )
    if (!a) return { error: 'Amounts cannot be negative, and months must be a whole number' }
    if (!a.required)
      return {
        rows: [{ label: 'Advance tax due', value: ZERO, fmt: 'money', main: true }, { label: 'Tax left after TDS', value: a.net, fmt: 'money' }],
        note: `${NOTE} ${a.reason === 'senior' ? 'Residents aged 60+ with no business income pay no advance tax.' : 'Advance tax applies only when the tax left after TDS is ₹10,000 or more.'}`,
      }
    return {
      rows: [
        { label: 'Interest if paid as entered', value: a.totalInterest, fmt: 'money', main: true },
        { label: 'Advance tax due for the year', value: a.net, fmt: 'money' },
        { label: 'Interest for late instalments (234C)', value: a.interest425, fmt: 'money', tone: 'negative' },
        { label: 'Interest for paying under 90% (234B)', value: a.interest424, fmt: 'money', tone: 'negative' },
      ],
      table: {
        title: 'Instalments',
        columns: ['Due by', 'Due so far', 'Paid so far', 'Shortfall', 'Interest'],
        fmts: ['text', 'money', 'money', 'money', 'money'],
        rows: a.rows.map((x) => [x.due, x.dueCum, x.paidCum, x.shortfall, x.interest]),
      },
      formula: [
        'Due so far = advance tax × 15% / 45% / 75% / 100% by 15 Jun / Sep / Dec / Mar',
        '234C = shortfall × 3% for each of the first three dates, × 1% for March (none if 12% by June, 36% by September)',
        `234B = ₹${r0(a.shortfall424)} × 1% × ${r.n.months!.toFixed()} months = ₹${r0(a.interest424)}`,
      ],
      note: `${NOTE} The department rounds amounts down to ₹100 before working out interest; this does not.`,
    }
  },
}

// ---- E6 gratuity -------------------------------------------------------------------

const gratuitySpec: ToolSpec = {
  id: 'gratuity',
  title: 'Gratuity',
  blurb: 'Gratuity amount and tax-free part',
  category: 'tax',
  keywords: ['gratuity', 'retirement', 'resignation', '15/26', 'exempt'],
  fields: [
    money('wage', 'Last monthly basic + DA', '60000', 'Not covered by the law? Use the 10-month average.'),
    { id: 'years', label: 'Years of service', kind: 'number', unit: 'years', default: '10' },
    { id: 'months', label: 'Extra months', kind: 'number', unit: 'months', default: '7', hint: '0 to 11.' },
    {
      id: 'covered',
      label: 'Covered by gratuity law',
      kind: 'select',
      default: 'yes',
      hint: 'Usually yes if your employer has 10 or more staff.',
      options: [
        { value: 'yes', label: 'Covered' },
        { value: 'no', label: 'Not covered' },
      ],
    },
    money('received', 'Gratuity you actually got', '', 'Leave blank to use the formula.', true),
  ],
  compute: (v) => {
    const r = need(v, [
      { id: 'wage', label: 'Basic + DA' },
      { id: 'years', label: 'Years of service' },
    ])
    if (!r.ok) return r
    const months = parseNum(v.months) ?? ZERO
    if (!r.n.years!.isInteger() || !months.isInteger()) return { error: 'Years and months must be whole numbers' }
    const covered = v.covered === 'yes'
    const g = gratuity(
      { wage: r.n.wage!, years: r.n.years!.toNumber(), months: months.toNumber(), covered, received: parseNum(v.received) },
      R,
    )
    if (!g) return { error: 'Amounts cannot be negative, and extra months must be 0 to 11' }
    const k = R.gratuity
    return {
      rows: [
        { label: 'Gratuity payable', value: g.payable, fmt: 'money', main: true },
        { label: 'Tax-free', value: g.exempt, fmt: 'money' },
        { label: 'Taxable (added to salary)', value: g.taxable, fmt: 'money' },
        { label: 'Years counted', value: new D(g.countedYears), fmt: 'int' },
      ],
      formula: covered
        ? [
            'Gratuity = (basic + DA) × 15 ÷ 26 × years (a part year over 6 months counts), capped at ₹20,00,000',
            `₹${r0(r.n.wage!)} × 15 ÷ 26 × ${g.countedYears} = ₹${r0(g.formula)}`,
            'Tax-free = the lesser of what you got and this amount',
          ]
        : [
            'Tax-free = least of: received, ₹20,00,000, and ½ × average salary × completed years',
            `½ × ₹${r0(r.n.wage!)} × ${g.countedYears} = ₹${r0(g.formula)}`,
          ],
      note: `${NOTE} Usually payable after ${k.minYears} years of continuous service, or earlier on death or disablement. Government employees' gratuity is fully tax-free.`,
    }
  },
}

// ---- E7 presumptive (44ADA) -----------------------------------------------------------

const presumptiveSpec: ToolSpec = {
  id: 'presumptive-44ada',
  title: 'Freelancer tax (44ADA)',
  blurb: 'Presumptive 50% profit vs your actual books',
  category: 'tax',
  keywords: ['44ada', 'freelancer', 'presumptive', 'professional', 'consultant', 'section 58'],
  fields: [
    money('receipts', 'Total receipts for the year', '3000000'),
    money('expenses', 'Actual business expenses', '800000'),
    regimeField,
    { id: 'cashPct', label: 'Share received in cash', kind: 'number', unit: 'percent', default: '0', hint: 'Up to 5% cash: ₹75 lakh limit. Above: ₹50 lakh.', advanced: true },
    money('other', 'Other income', '', 'Interest, rent and similar, at slab rates.', true),
    ageField,
  ],
  compute: (v) => {
    const r = need(v, [
      { id: 'receipts', label: 'Gross receipts' },
      { id: 'cashPct', label: 'Cash share' },
      { id: 'expenses', label: 'Expenses' },
    ])
    if (!r.ok) return r
    const p = presumptive(
      { receipts: r.n.receipts!, cashPct: r.n.cashPct!, expenses: r.n.expenses!, otherIncome: opt(v, 'other'), regime: v.regime as Regime, age: v.age as AgeBand },
      R,
    )
    if (!p) return { error: 'Amounts cannot be negative, and the cash share must be 0% to 100%' }
    if (!p.eligible) return { error: `Receipts above ₹${r0(p.limit)}: presumptive taxation is not open to you` }
    const diff = p.actual.total.minus(p.presumptive.total)
    const verdict = diff.gt(0)
      ? `Presumptive saves ₹${r0(diff)}`
      : diff.isZero()
        ? 'Same tax either way'
        : p.actualNeedsAudit
          ? `Books save ₹${r0(diff.abs())}, but need full accounts and an audit`
          : `Books save ₹${r0(diff.abs())}`
    return {
      rows: [
        { label: verdict, value: diff.abs(), fmt: 'money', main: true },
        { label: 'Tax, presumptive method', value: p.presumptive.total, fmt: 'money' },
        { label: 'Tax, actual books', value: p.actual.total, fmt: 'money' },
        { label: 'Presumptive profit (50%)', value: p.presumptiveIncome, fmt: 'money' },
        { label: 'Actual profit', value: p.actualProfit, fmt: 'money' },
      ],
      table: slabTable(p.presumptive),
      formula: [
        'Presumptive profit = 50% of gross receipts',
        `₹${r0(r.n.receipts!)} × 50% = ₹${r0(p.presumptiveIncome)}`,
        `Actual profit = ₹${r0(r.n.receipts!)} − ₹${r0(r.n.expenses!)} = ₹${r0(p.actualProfit)}`,
        taxLine(p.presumptive),
      ],
      note: `${NOTE} A business loss is taken as zero here. Presumptive filers pay all advance tax by 15 March.`,
    }
  },
}

export const TOOLS: ToolSpec[] = [incomeTaxSpec, salarySpec, cgSpec, advanceSpec, gratuitySpec, presumptiveSpec]
