import { D, type Dec } from '../../engine/decimal'
import { formatDecimal } from '../../lib/format'
import { fdLadder, type Rung } from '../../engine/investments/fdLadder'
import { DICGC, KVP, MIS, NSC, OFFICIAL_TO, RATES_AS_OF as SAVINGS_AS_OF, SCSS, SMALL_SAVINGS_SOURCE, SSY, TD } from '../../engine/investments/rates'
import { kvp, mis, nsc, scss, ssy, timeDeposit } from '../../engine/investments/smallSavings'
import { RATES_AS_OF as TAX_AS_OF, RULES_FY2026_27 as R } from '../../engine/tax/rules.FY2026-27'
import { goalSipByMonths, monthsUntil } from '../../engine/investments/goalSip'
import { addMonths, parseDate, toIso } from '../../engine/everyday/dates'
import { yearsMonthsText, toWholeMonths } from '../../engine/duration'
import { growth, yearRow, type GrowRow } from './invest'
import { junkOptional, need, parseNum, unitOf, type Field, type ResultRow, type ToolSpec } from '../../lib/tool'

/** Whole rupees grouped the Indian way, for the worked-out lines and notes. */
/** Grouped the Indian way with 2 places by default, for the worked-out lines. */
const s = (v: Dec, dp = 2) => formatDecimal(v.toDecimalPlaces(dp), { system: 'indian', decimals: 'auto' })
const r0 = (x: Dec) => formatDecimal(x.toDecimalPlaces(0, D.ROUND_HALF_UP), { system: 'indian', decimals: 0 })

// ---- FD ladder --------------------------------------------------------------------------

const PERIODS = { monthly: 12, quarterly: 4, 'half-yearly': 2, yearly: 1 } as const

const fdLadderSpec: ToolSpec = {
  id: 'fd-ladder',
  rates: TAX_AS_OF,
  title: 'FD ladder',
  blurb: 'Several FDs: maturity, bank cover and TDS',
  category: 'invest',
  verified: { source: 'DICGC deposit insurance guide (₹5 lakh cover); Income-tax Act 2025 s.393 Table Sl.5(ii) (TDS limit), Finance Act 2026 (10%)' },
  keywords: ['fd ladder', 'fixed deposit', 'laddering', 'dicgc', 'deposit insurance', 'tds', 'bank interest', '5 lakh', 'staggered'],
  fields: [
    {
      id: 'rungs',
      label: 'Your FDs',
      kind: 'rows',
      min: 1,
      max: 8,
      columns: [
        { id: 'bank', label: 'Bank', kind: 'text' },
        { id: 'amount', label: 'Amount', kind: 'number', unit: 'rupee' },
        { id: 'rate', label: 'Yearly rate', kind: 'number', unit: 'percent' },
        { id: 'years', label: 'Years', kind: 'number', unit: 'years' },
      ],
      defaultRows: [
        ['Bank A', '200000', '6.8', '1'],
        ['Bank A', '200000', '7', '2'],
        ['Bank B', '300000', '7.1', '3'],
      ],
      hint: 'One row per FD. Rows with the same bank name count as one bank. Rates are examples, enter yours.',
    },
    {
      id: 'senior',
      label: 'Aged 60 or more',
      kind: 'select',
      default: 'no',
      hint: 'Raises the TDS limit to ₹1,00,000 a year. Being 60 at any time in the tax year counts.',
      options: [
        { value: 'no', label: 'No' },
        { value: 'yes', label: 'Yes' },
      ],
    },
    {
      id: 'comp',
      label: 'Compounded',
      kind: 'select',
      default: 'quarterly',
      advanced: true,
      options: Object.keys(PERIODS).map((k) => ({ value: k, label: k[0]!.toUpperCase() + k.slice(1) })),
    },
  ],
  compute: (v) => {
    const rows = Array.isArray(v.rungs) ? v.rungs : []
    const rungs: Rung[] = []
    for (const [i, row] of rows.entries()) {
      const [bank = '', amount = '', rate = '', years = ''] = row
      if ([bank, amount, rate, years].every((c) => c.trim() === '')) continue
      const label = bank.trim() || `FD ${i + 1}`
      const p = parseNum(amount)
      const pct = parseNum(rate)
      const y = parseNum(years)
      if (!p || !pct || !y) return { error: `Fill in the amount, rate and years of ${label}` }
      if (p.lte(0)) return { error: `${label}: amount must be more than zero` }
      if (pct.isNegative() || pct.gt(100)) return { error: `${label}: enter a yearly rate from 0 to 100%` }
      if (y.lte(0) || y.gt(50)) return { error: `${label}: years must be more than 0 and at most 50` }
      rungs.push({ bank: bank.trim() || `Bank ${i + 1}`, principal: p, ratePct: pct, years: y })
    }
    if (rungs.length === 0) return { error: 'Enter at least one FD' }
    const senior = v.senior === 'yes'
    const n = PERIODS[v.comp as keyof typeof PERIODS] ?? 4
    const l = fdLadder(rungs, { senior, perYear: n })
    if (!l) return { error: 'These FDs cannot be worked out' }

    const over = l.banks.filter((b) => b.notInsured.gt(0))
    const tds = l.banks.filter((b) => b.tdsApplies)
    const names = (bs: typeof l.banks) => bs.map((b) => b.bank).join(', ')

    const out: ResultRow[] = [
      { label: 'Total at maturity', value: l.atMaturity, fmt: 'money', main: true },
      { label: 'Total put in', value: l.principal, fmt: 'money' },
      { label: 'Interest earned', value: l.interest, fmt: 'money' },
      { label: 'Average yearly rate', value: l.blendedPct, fmt: 'percent' },
      { label: 'Banks over the ₹5 lakh cover', value: over.length ? names(over) : 'None', fmt: 'text', ...(over.length ? { tone: 'negative' as const } : {}) },
      { label: 'Banks where TDS applies', value: tds.length ? names(tds) : 'None', fmt: 'text' },
    ]

    const insure =
      over.length > 0
        ? ` ${names(over)} would hold more than ₹${r0(l.cover)} (money plus interest), so the part above it is not insured. Spread it over more banks to be covered.`
        : ` Every bank stays within the ₹${r0(l.cover)} cover.`
    const tdsNote =
      tds.length > 0
        ? ` At ${names(tds)} the first year's interest passes ₹${r0(l.tdsThreshold)}, so the bank deducts TDS at ${R.tdsBankInterest.ratePct}%.`
        : ` No bank passes the ₹${r0(l.tdsThreshold)} yearly interest limit, so no TDS is expected.`

    return {
      rows: out,
      table: {
        title: 'Bank by bank: what the ₹5 lakh cover protects',
        columns: ['Bank', 'At maturity', 'Insured', 'Not insured'],
        fmts: ['text', 'money', 'money', 'money'],
        rows: l.banks.map((b) => [b.bank, b.atMaturity, b.insured, b.notInsured]),
      },
      formula: [
        `Each FD: amount × (1 + rate ÷ ${100 * n})^(${n} × years)`,
        ...l.rungs.map((g, i) => `FD ${i + 1} (${g.bank}): ₹${r0(g.principal)} at ${g.ratePct.toFixed()}% for ${g.years.toFixed()} years = ₹${r0(g.maturity)}`),
        `Insured at a bank = the smaller of (its FDs at maturity, ₹${r0(l.cover)})`,
      ],
      note:
        `Assumptions: all FDs under one bank name are yours alone in one account type (joint accounts are insured separately, so this can overstate the risk); a bank is told apart only by its name; "first year's interest" is each FD's first 12 months, not a tax-year tally.` +
        insure +
        tdsNote +
        ` DICGC covers ₹${r0(l.cover)} per person per bank, principal and interest together (${DICGC.source}, read ${DICGC.confirmed}). TDS limit and rate: Income-tax Act 2025 s.393 and Finance Act 2026. The no-PAN rate is not shown.`,
    }
  },
}

// ---- Post office and small-savings schemes -----------------------------------------------

const rupee = (id: string, label: string, def: string, hint?: string): Field => ({ id, label, kind: 'number', unit: 'rupee', default: def, hint })
const rateField = (def: string): Field => ({
  id: 'rate',
  label: 'Yearly interest rate',
  kind: 'number',
  unit: 'percent',
  default: def,
  hint: `Official rate to ${OFFICIAL_TO}. Changes every quarter.`,
})
const RATE_ERR = 'Enter a yearly interest rate from 0 to 100%'
const rateBad = (r: Dec) => r.isNegative() || r.gt(100)
const lakh = (x: string) => `₹${r0(new D(x))}`
const RATE_NOTE = `The rate is the official one to ${OFFICIAL_TO} (${SMALL_SAVINGS_SOURCE}, with the number from the National Savings Institute rate page). It is reset every quarter, so later quarters may differ.`
/** TDS line for a scheme that pays interest out. Post offices are named in s.393 Table Sl.5(ii); how the post office counts the limit is theirs to say. */
const tdsLine = (yearly: Dec, senior: boolean) => {
  const t = R.tdsBankInterest
  const limit = new D(senior ? t.thresholdSenior : t.thresholdOther)
  return yearly.gt(limit)
    ? ` Your yearly interest of ₹${r0(yearly)} is above the ₹${r0(limit)} limit, so TDS at ${t.ratePct}% may be deducted (Income-tax Act 2025 s.393, which names post offices).`
    : senior
      ? ` TDS may be deducted once a year's interest passes ₹${r0(limit)} for someone aged 60 or more, counted by the post office. Yours is ₹${r0(yearly)}.`
      : ` TDS may be deducted once a year's interest passes ₹${r0(new D(t.thresholdOther))} (₹${r0(new D(t.thresholdSenior))} if you are 60 or more), counted by the post office. Yours is ₹${r0(yearly)}.`
}
const yearsWord = (y: number) => `${y} year${y === 1 ? '' : 's'}`

const ssySpec: ToolSpec = {
  id: 'ssy',
  rates: SAVINGS_AS_OF,
  title: 'Sukanya Samriddhi (SSY)',
  blurb: 'Girl-child savings account maturity',
  category: 'invest',
  verified: { source: `SSY rules (limits, term); ${SMALL_SAVINGS_SOURCE} (rate)` },
  keywords: ['ssy', 'sukanya', 'samriddhi', 'girl child', 'daughter', 'post office', 'small savings', '80c'],
  fields: [
    rupee('yearly', 'Yearly deposit', SSY.maxYearly, `${lakh(SSY.minYearly)} to ${lakh(SSY.maxYearly)} a year`),
    rateField(SSY.rate),
    { id: 'age', label: "Girl's age when you open it", kind: 'number', unit: 'years', default: '3', hint: `The account can be opened until she is ${SSY.openUntilAge}.` },
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'yearly', label: 'Yearly deposit' }, { id: 'rate', label: 'Interest rate' }, { id: 'age', label: "Girl's age" }])
    if (!r.ok) return r
    if (rateBad(r.n.rate!)) return { error: RATE_ERR, field: 'rate' }
    if (r.n.yearly!.lt(SSY.minYearly)) return { error: `The yearly deposit must be at least ${lakh(SSY.minYearly)}`, field: 'yearly' }
    if (r.n.yearly!.gt(SSY.maxYearly)) return { error: `SSY allows at most ${lakh(SSY.maxYearly)} a year`, field: 'yearly' }
    const age = r.n.age!
    if (!age.isInteger() || age.isNegative() || age.gt(SSY.openUntilAge)) return { error: `She must be a whole number of years old, 0 to ${SSY.openUntilAge}`, field: 'age' }
    const rows = ssy(r.n.yearly!, r.n.rate!)!
    const last = rows.at(-1)!
    return {
      rows: [
        { label: 'Maturity value', value: last.value, fmt: 'money', main: true },
        { label: 'Total deposited', value: last.invested, fmt: 'money' },
        { label: 'Interest earned', value: last.value.minus(last.invested), fmt: 'money' },
        { label: 'Matures when she is', value: `${age.plus(SSY.termYears).toFixed()} years old`, fmt: 'text' },
      ],
      ...growth(rows.map(yearRow), 'Balance'),
      formula: [
        `Each year to year ${SSY.depositYears}: balance = (balance + deposit) × (1 + r ÷ 100). Then ${SSY.termYears - SSY.depositYears} more years of interest only`,
        `(balance + ${s(r.n.yearly!)}) × (1 + ${s(r.n.rate!)} ÷ 100), ${SSY.depositYears} times, then × (1 + ${s(r.n.rate!)} ÷ 100) ${SSY.termYears - SSY.depositYears} times`,
      ],
      note: `Assumes one deposit a year by 5 April (the month's lowest balance between the 5th and month end earns interest) and that the rate stays as entered for all ${SSY.termYears} years. Deposits run ${SSY.depositYears} years; the account matures ${SSY.termYears} years after opening. ${RATE_NOTE}`,
    }
  },
}

const nscSpec: ToolSpec = {
  id: 'nsc',
  rates: SAVINGS_AS_OF,
  title: 'National Savings Certificate (NSC)',
  blurb: '5-year post office certificate maturity',
  category: 'invest',
  verified: { source: `NSC rules (term, minimum); ${SMALL_SAVINGS_SOURCE} (rate)` },
  keywords: ['nsc', 'national savings certificate', 'post office', 'small savings', '5 year', '80c'],
  fields: [rupee('amount', 'Amount', '100000', `At least ${lakh(NSC.min)}, then in multiples of ₹100. No maximum.`), rateField(NSC.rate)],
  compute: (v) => {
    const r = need(v, [{ id: 'amount', label: 'Amount' }, { id: 'rate', label: 'Interest rate' }])
    if (!r.ok) return r
    if (rateBad(r.n.rate!)) return { error: RATE_ERR, field: 'rate' }
    if (r.n.amount!.lt(NSC.min)) return { error: `NSC needs at least ${lakh(NSC.min)}`, field: 'amount' }
    const rows = nsc(r.n.amount!, r.n.rate!)
    if (!rows) return { error: 'After ₹1,000, NSC comes in multiples of ₹100', field: 'amount' }
    const last = rows.at(-1)!
    return {
      rows: [
        { label: 'Maturity value', value: last.value, fmt: 'money', main: true },
        { label: 'Interest earned', value: last.value.minus(last.invested), fmt: 'money' },
      ],
      ...growth(rows.map(yearRow), 'Value'),
      formula: ['A = P × (1 + r ÷ 100)^5, interest compounded once a year', `${s(r.n.amount!)} × (1 + ${s(r.n.rate!)} ÷ 100)^5`],
      note: `${NSC.years} years. Each year's interest is treated as reinvested, so it compounds; you get it all at maturity. The rate on the day you buy holds to maturity. ${RATE_NOTE}`,
    }
  },
}

const scssSpec: ToolSpec = {
  id: 'scss',
  rates: SAVINGS_AS_OF,
  title: 'Senior Citizens Savings Scheme',
  blurb: 'Quarterly interest for 60 and over',
  category: 'invest',
  verified: { source: `SCSS rules (limit, payout); ${SMALL_SAVINGS_SOURCE} (rate)` },
  keywords: ['scss', 'senior citizen', 'savings scheme', 'post office', 'quarterly interest', 'retired', 'small savings'],
  fields: [rupee('amount', 'Amount', '1000000', `Multiples of ₹1,000, up to ${lakh(SCSS.max)}`), rateField(SCSS.rate)],
  compute: (v) => {
    const r = need(v, [{ id: 'amount', label: 'Amount' }, { id: 'rate', label: 'Interest rate' }])
    if (!r.ok) return r
    if (rateBad(r.n.rate!)) return { error: RATE_ERR, field: 'rate' }
    if (r.n.amount!.lt(SCSS.min)) return { error: `SCSS needs at least ${lakh(SCSS.min)}`, field: 'amount' }
    if (r.n.amount!.gt(SCSS.max)) return { error: `SCSS allows at most ${lakh(SCSS.max)}`, field: 'amount' }
    const p = scss(r.n.amount!, r.n.rate!)
    if (!p) return { error: 'SCSS comes in multiples of ₹1,000', field: 'amount' }
    return {
      rows: [
        { label: 'Interest every quarter', value: p.perPeriod, fmt: 'money', main: true },
        { label: 'Interest in a year', value: p.yearly, fmt: 'money' },
        { label: `Interest over ${SCSS.years} years`, value: p.total, fmt: 'money' },
        { label: 'Your money back at the end', value: p.principal, fmt: 'money' },
      ],
      formula: ['Quarterly interest = amount × r ÷ 100 ÷ 4', `${s(r.n.amount!)} × ${s(r.n.rate!)} ÷ 400 = ${s(p.perPeriod)}`],
      note:
        `For ${SCSS.years} years, extendable once by 3. Interest is paid out on the first working day of April, July, October and January; interest you do not collect earns nothing. For people ${SCSS.minAge} or more (55 or more if retired, 50 or more if retired from the defence services). The first payout is for a part quarter if you open mid-quarter: not included. ${RATE_NOTE}` +
        tdsLine(p.yearly, true),
    }
  },
}

const kvpSpec: ToolSpec = {
  id: 'kvp',
  rates: SAVINGS_AS_OF,
  title: 'Kisan Vikas Patra (KVP)',
  blurb: 'Your money doubles in 115 months',
  category: 'invest',
  verified: { source: `KVP rules ("shall double on maturity", minimum); ${SMALL_SAVINGS_SOURCE} (rate and period)` },
  keywords: ['kvp', 'kisan vikas patra', 'double', 'post office', 'small savings', '115 months'],
  fields: [rupee('amount', 'Amount', '100000', `At least ${lakh(KVP.min)}. No maximum.`)],
  compute: (v) => {
    const r = need(v, [{ id: 'amount', label: 'Amount' }])
    if (!r.ok) return r
    if (r.n.amount!.lt(KVP.min)) return { error: `KVP needs at least ${lakh(KVP.min)}`, field: 'amount' }
    const k = kvp(r.n.amount!)!
    return {
      rows: [
        { label: 'Maturity value', value: k.maturity, fmt: 'money', main: true },
        { label: 'Interest earned', value: k.interest, fmt: 'money' },
        { label: 'Matures after', value: `${Math.floor(KVP.months / 12)} years ${KVP.months % 12} months (${KVP.months} months)`, fmt: 'text' },
        { label: 'Official yearly rate', value: new D(KVP.rate), fmt: 'percent' },
      ],
      formula: ['The certificate doubles on maturity', `${s(r.n.amount!)} × 2 = ${s(k.maturity)}`, `Doubling in ${KVP.months} months works out to ${s(k.impliedYearlyPct, 3)}% a year`],
      note: `The rule is that the deposit doubles at maturity; ${KVP.months} months goes with the ${KVP.rate}% rate (official to ${OFFICIAL_TO}). The period is fixed when you buy, so a later quarter's rate can change it. Early encashment is not shown. ${SMALL_SAVINGS_SOURCE}.`,
    }
  },
}

const misSpec: ToolSpec = {
  id: 'mis',
  rates: SAVINGS_AS_OF,
  title: 'Monthly Income Scheme (MIS)',
  blurb: 'Monthly interest from a post office deposit',
  category: 'invest',
  verified: { source: `MIS rules (limits, payout); ${SMALL_SAVINGS_SOURCE} (rate)` },
  keywords: ['mis', 'monthly income scheme', 'post office', 'monthly interest', 'small savings', 'pension'],
  fields: [
    rupee('amount', 'Amount', '900000', `At least ${lakh(MIS.min)}. Up to ${lakh(MIS.maxSingle)} alone, ${lakh(MIS.maxJoint)} jointly.`),
    rateField(MIS.rate),
    {
      id: 'holders',
      label: 'Account held by',
      kind: 'select',
      default: 'single',
      options: [
        { value: 'single', label: `One person (up to ${lakh(MIS.maxSingle)})` },
        { value: 'joint', label: `Two or three people (up to ${lakh(MIS.maxJoint)})` },
      ],
    },
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'amount', label: 'Amount' }, { id: 'rate', label: 'Interest rate' }])
    if (!r.ok) return r
    if (rateBad(r.n.rate!)) return { error: RATE_ERR, field: 'rate' }
    const joint = v.holders === 'joint'
    if (r.n.amount!.lt(MIS.min)) return { error: `MIS needs at least ${lakh(MIS.min)}`, field: 'amount' }
    const max = joint ? MIS.maxJoint : MIS.maxSingle
    if (r.n.amount!.gt(max)) return { error: `${joint ? 'A joint' : 'A single'} MIS account allows at most ${lakh(max)}`, field: 'amount' }
    const p = mis(r.n.amount!, r.n.rate!, joint)!
    return {
      rows: [
        { label: 'Interest every month', value: p.perPeriod, fmt: 'money', main: true },
        { label: 'Interest in a year', value: p.yearly, fmt: 'money' },
        { label: `Interest over ${MIS.years} years`, value: p.total, fmt: 'money' },
        { label: 'Your money back at the end', value: p.principal, fmt: 'money' },
      ],
      formula: ['Monthly interest = amount × r ÷ 100 ÷ 12', `${s(r.n.amount!)} × ${s(r.n.rate!)} ÷ 1200 = ${s(p.perPeriod)}`],
      note: `${MIS.years} years. Interest is paid every month and does not compound. ${RATE_NOTE}` + tdsLine(p.yearly, false),
    }
  },
}

const TD_YEARS = [1, 2, 3, 5]
const tdSpec: ToolSpec = {
  id: 'post-office-td',
  rates: SAVINGS_AS_OF,
  title: 'Post Office Time Deposit',
  blurb: '1, 2, 3 or 5 year post office FD',
  category: 'invest',
  verified: { source: `Time Deposit rules (quarterly working); ${SMALL_SAVINGS_SOURCE} (rates)` },
  keywords: ['td', 'time deposit', 'post office fd', 'post office', 'small savings', 'fixed deposit'],
  fields: [
    {
      id: 'years',
      label: 'Term',
      kind: 'select',
      default: '5',
      hint: 'The rate on the day you open holds to the end.',
      options: TD_YEARS.map((y) => ({ value: String(y), label: `${yearsWord(y)} (${TD.rates[y]}%)` })),
    },
    rupee('amount', 'Amount', '100000'),
    {
      id: 'payout',
      label: 'The yearly interest',
      kind: 'select',
      default: 'out',
      hint: 'The rules do not say whether it is paid out or stays in, so choose. Ask your post office.',
      options: [
        { value: 'out', label: 'Is paid out to me each year' },
        { value: 'in', label: 'Stays in and compounds' },
      ],
    },
    { id: 'rate', label: 'Rate, if not the official one', kind: 'number', unit: 'percent', default: '', hint: `Leave blank to use the official rate to ${OFFICIAL_TO}.`, advanced: true },
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'amount', label: 'Amount' }])
    if (!r.ok) return r
    const junk = junkOptional(v, [{ id: 'rate', label: 'Rate' }])
    if (junk) return junk
    const years = Number(v.years) || 5
    const official = TD.rates[years]
    if (official === undefined) return { error: 'Choose 1, 2, 3 or 5 years', field: 'years' }
    const rate = parseNum(v.rate) ?? new D(official)
    if (rateBad(rate)) return { error: RATE_ERR, field: 'rate' }
    if (r.n.amount!.lte(0)) return { error: 'Enter an amount more than zero', field: 'amount' }
    const paidOut = v.payout !== 'in'
    const t = timeDeposit(r.n.amount!, rate, years, paidOut)!
    const rows: ResultRow[] = paidOut
      ? [
          { label: 'Interest paid each year', value: t.yearly, fmt: 'money', main: true },
          { label: `Interest over ${yearsWord(years)}`, value: t.interest, fmt: 'money' },
          { label: 'Your deposit back at the end', value: r.n.amount!, fmt: 'money' },
        ]
      : [
          { label: 'Maturity value', value: t.maturity, fmt: 'money', main: true },
          { label: 'Interest earned', value: t.interest, fmt: 'money' },
        ]
    return {
      rows,
      ...(paidOut ? {} : growth(t.rows.map(yearRow), 'Value')),
      formula: paidOut
        ? ['Interest worked quarterly, paid at each year end: yearly interest = amount × ((1 + r ÷ 400)^4 − 1)', `${s(r.n.amount!)} × ((1 + ${s(rate)} ÷ 400)^4 − 1) = ${s(t.yearly)}`]
        : ['A = P × (1 + r ÷ 400)^(4 × years)', `${s(r.n.amount!)} × (1 + ${s(rate)} ÷ 400)^${4 * years}`],
      note:
        `Assumption: the rule text says the interest is "compounded on quarterly basis and payable at the end of each year" but not whether the yearly interest is paid to you or stays in, so both readings are offered (paid out is the default, from the wording). It cannot be withdrawn in the first 6 months. ${RATE_NOTE}` +
        (paidOut ? tdsLine(t.yearly, false) : ''),
    }
  },
}

// ---- Goal SIP by date ----------------------------------------------------------------------

const localToday = (): Date => {
  const n = new Date()
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))
}
const GOAL_UNITS = { id: 'duration', unit: 'years' as const, units: ['years' as const, 'months' as const] }

const goalDateSpec: ToolSpec = {
  id: 'goal-sip-date',
  title: 'Goal SIP by date',
  blurb: 'Monthly SIP to reach a target by a date',
  category: 'invest',
  keywords: ['goal', 'target date', 'sip for goal', 'how much sip', 'by date', 'step up', 'house', 'education', 'wedding', 'down payment', 'retirement target'],
  fields: [
    { id: 'target', label: 'Target amount', kind: 'number', unit: 'rupee', default: '1000000' },
    {
      id: 'when',
      label: 'I want it',
      kind: 'select',
      default: 'date',
      options: [
        { value: 'date', label: 'By a date' },
        { value: 'duration', label: 'In some years or months' },
      ],
    },
    { id: 'byDate', label: 'By this date', kind: 'date', default: toIso(addMonths(localToday(), 60)), visibleIf: (v) => v.when !== 'duration', hint: 'Months to go are counted from today. A part month counts as a full month.' },
    { id: 'duration', label: 'Time to go', kind: 'number', unit: 'years', units: ['years', 'months'], default: '5', visibleIf: (v) => v.when === 'duration', hint: 'Whole months only. 1.5 years is 18 months.' },
    { id: 'rate', label: 'Expected yearly return', kind: 'number', unit: 'percent', default: '12', hint: 'Example return, enter your own. Not guaranteed.' },
    { id: 'existing', label: 'Already saved for this', kind: 'number', unit: 'rupee', default: '0', hint: 'Leave blank for none. It grows at the same return.' },
    { id: 'stepUp', label: 'Raise the SIP every year by', kind: 'number', unit: 'percent', default: '0', advanced: true, hint: 'A yearly step-up, e.g. 10. Leave at 0 for a flat SIP.' },
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'target', label: 'Target amount' }, { id: 'rate', label: 'Expected return' }])
    if (!r.ok) return r
    const junk = junkOptional(v, [{ id: 'existing', label: 'Already saved' }, { id: 'stepUp', label: 'Yearly raise' }])
    if (junk) return junk
    const existing = parseNum(v.existing) ?? new D(0)
    const step = parseNum(v.stepUp) ?? new D(0)
    const { target, rate } = r.n as Record<string, Dec>
    if (target!.lte(0)) return { error: 'Target amount must be more than zero', field: 'target' }
    if (rate!.isNegative() || rate!.gt(100)) return { error: 'Enter a yearly return from 0 to 100%', field: 'rate' }
    if (existing.isNegative()) return { error: "Already saved can't be negative", field: 'existing' }
    if (step.isNegative() || step.gt(100)) return { error: 'Enter a yearly raise from 0 to 100%', field: 'stepUp' }
    let months: number | null
    if (v.when === 'duration') {
      const t = need(v, [{ id: 'duration', label: 'Time to go' }])
      if (!t.ok) return t
      months = toWholeMonths(t.n.duration!, unitOf(GOAL_UNITS, v) === 'months' ? 'months' : 'years')
      if (months === null) return { error: 'Time must come to whole months, from 1 month to 60 years', field: 'duration' }
    } else {
      const text = typeof v.byDate === 'string' ? v.byDate.trim() : ''
      if (text === '') return { error: 'Pick the date you want the money by', field: 'byDate' }
      const by = parseDate(text)
      if (!by) return { error: 'Enter a real date', field: 'byDate' }
      months = monthsUntil(localToday(), by)
      if (months === null) return { error: 'Pick a date after today', field: 'byDate' }
    }
    if (months > 720) return { error: 'Use a date within 60 years', field: v.when === 'duration' ? 'duration' : 'byDate' }
    const p = goalSipByMonths(target!, rate!, months, existing, step)!
    const i = rate!.div(1200)
    const stepped = step.gt(0)
    const rows: GrowRow[] = p.rows.map((x) => {
      const whole = x.months % 12 === 0
      const grownSaved = existing.times(new D(1).plus(i).pow(x.months))
      return { cell: whole ? new D(x.months / 12) : `Month ${x.months}`, label: whole ? `Y${x.months / 12}` : `M${x.months}`, invested: x.invested.plus(existing), value: x.value.plus(grownSaved) }
    })
    return {
      rows: [
        { label: stepped ? 'Monthly SIP to start with' : 'Monthly SIP needed', value: p.sip, fmt: 'money', main: true },
        ...(stepped ? [{ label: 'Monthly SIP in the last year', value: p.lastSip, fmt: 'money' as const }] : []),
        { label: 'Time to go', value: yearsMonthsText(months), fmt: 'text' },
        { label: 'You invest in all (SIPs)', value: p.invested, fmt: 'money' },
        { label: 'Savings so far grow to', value: p.savedGrown, fmt: 'money' },
        { label: 'Growth earned', value: target!.minus(p.invested).minus(existing), fmt: 'money' },
      ],
      ...(p.sip.isZero() ? {} : growth(rows, 'Total value')),
      formula: [
        'i = yearly return ÷ 12 ÷ 100. Money grows every month at i. Each SIP goes in at the start of the month',
        stepped
          ? `SIP factor = sum of each month's SIP growing to month ${months}, with the SIP raised ${s(step)}% after every 12 months`
          : 'SIP factor = ((1 + i)^n − 1) ÷ i × (1 + i)',
        `Monthly SIP = (target − saved × (1 + i)^${months}) ÷ SIP factor`,
        p.sip.isZero() ? `${s(target!)} − ${s(p.savedGrown)} is not more than zero, so no SIP is needed` : `(${s(target!)} − ${s(p.savedGrown)}) ÷ ${s(p.gap.div(p.sip), 4)} = ${s(p.sip)}`,
      ],
      note: p.sip.isZero()
        ? `What you have already saved grows to ${s(p.savedGrown)} by then, which reaches the target on its own.`
        : `Convention: everything compounds monthly at the yearly return ÷ 12 (so 12% is 12.68% over a year), and each SIP goes in at the start of the month. Money you have already saved grows the same way. Open question: the older "SIP for a goal" tool grows saved money once a year instead (12% stays 12%), so it asks for a larger SIP when you have savings; which is closer depends on how your fund compounds. Months are counted from today and a part month counts as a full month. Returns are not guaranteed.`,
    }
  },
}

export const TOOLS: ToolSpec[] = [fdLadderSpec, ssySpec, nscSpec, scssSpec, kvpSpec, misSpec, tdSpec, goalDateSpec]
