import { D, type Dec } from '../../engine/decimal'
import { formatDecimal } from '../../lib/format'
import { burnBand, burnMultiple, cacLtv, cacPayback, ruleOf40 } from '../../engine/metrics/unit'
import { funnel, retention, runRate } from '../../engine/metrics/growth'
import { sampleSize } from '../../engine/metrics/sampleSize'
import { need, parseNum, type ToolSpec, type Values } from '../../lib/tool'

const f = (v: Dec) => formatDecimal(v, { system: 'indian', decimals: 'auto' })
const f2 = (v: Dec) => formatDecimal(v.toDecimalPlaces(2), { system: 'indian', decimals: 'auto' })

/** An error when any named number is negative. */
function nonNegative(n: Record<string, Dec>, fields: { id: string; label: string }[]): { error: string } | null {
  const bad = fields.find((x) => n[x.id]!.isNegative())
  return bad ? { error: `${bad.label} can't be negative` } : null
}

/** Reads a 'rows' field as pairs of [text, number]. Fully blank rows are skipped. */
function pairs(v: Values, id: string): { name: string; n: Dec }[] | { error: string } {
  const rows = v[id]
  const out: { name: string; n: Dec }[] = []
  for (const r of Array.isArray(rows) ? rows : []) {
    const [name = '', raw = ''] = r
    if (name.trim() === '' && raw.trim() === '') continue
    const n = parseNum(raw)
    if (n === null || n.isNegative()) return { error: `Enter a count of 0 or more for ${name.trim() || 'every row'}` }
    out.push({ name: name.trim(), n })
  }
  return out
}

// ---- F7 CAC and LTV ----------------------------------------------------------
const cacLtvFields = [
  { id: 'spend', label: 'Marketing and sales spend' },
  { id: 'customers', label: 'New customers won' },
  { id: 'arpu', label: 'Monthly revenue per customer (ARPU)' },
  { id: 'margin', label: 'Gross margin' },
  { id: 'churn', label: 'Monthly churn' },
]

const cacLtvSpec: ToolSpec = {
  id: 'cac-ltv',
  title: 'Customer cost and value',
  blurb: 'Cost to win vs lifetime value',
  category: 'metrics',
  keywords: ['cac and ltv', 'cac', 'ltv', 'lifetime value', 'customer acquisition cost', 'ltv cac', 'saas', 'churn'],
  fields: [
    { id: 'spend', label: 'Marketing and sales spend', kind: 'number', unit: 'rupee', default: '600000', hint: 'For the same period as the new customers' },
    { id: 'customers', label: 'New customers won', kind: 'number', default: '300' },
    { id: 'arpu', label: 'Monthly revenue per customer (ARPU)', kind: 'number', unit: 'rupee', default: '500' },
    { id: 'margin', label: 'Gross margin', kind: 'number', unit: 'percent', default: '70' },
    { id: 'churn', label: 'Monthly churn (customers lost)', kind: 'number', unit: 'percent', default: '4', hint: 'Share of customers lost each month' },
  ],
  compute: (v) => {
    const r = need(v, cacLtvFields)
    if (!r.ok) return r
    const { spend, customers, arpu, margin, churn } = r.n as Record<string, Dec>
    const neg = nonNegative(r.n, cacLtvFields)
    if (neg) return neg
    if (margin!.gt(100) || churn!.gt(100)) return { error: 'Margin and churn are percentages from 0 to 100' }
    const x = cacLtv(spend!, customers!, arpu!, margin!, churn!)
    if (!x) return { error: 'New customers must be more than 0' }
    const formula = [
      'CAC = spend ÷ new customers',
      `${f(spend!)} ÷ ${f(customers!)} = ${f2(x.cac)}`,
      'LTV = ARPU × gross margin ÷ monthly churn (as a fraction)',
    ]
    if (!x.ltv) {
      return {
        rows: [
          { label: 'CAC (cost to win one customer)', value: x.cac, fmt: 'money', main: true },
          { label: 'LTV (lifetime value)', value: 'Not defined', fmt: 'text' },
        ],
        formula: [...formula, 'Churn is 0, so customers never leave and the lifetime value has no end'],
        note: 'With 0% churn, lifetime value cannot be worked out; enter a monthly churn above 0 to get LTV.',
      }
    }
    const ratio = x.ratio
    const verdict = !ratio
      ? 'CAC is zero, so there is no cost to compare lifetime value against.'
      : ratio.lt(1)
        ? 'A customer earns back less profit than they cost to win, so this loses money.'
        : ratio.lt(3)
          ? 'Below the common 3:1 benchmark (a rule of thumb), so winning customers is costly for what they return. 3:1 is a common SaaS target; it depends on margins and growth stage.'
          : 'At or above the common 3:1 benchmark (a rule of thumb), so customers return well over what they cost. 3:1 is a common SaaS target; it depends on margins and growth stage.'
    return {
      rows: [
        { label: 'CAC (cost to win one customer)', value: x.cac, fmt: 'money', main: true },
        { label: 'LTV (lifetime value)', value: x.ltv, fmt: 'money' },
        ...(ratio ? [{ label: 'LTV to CAC ratio', value: ratio, fmt: 'number' as const }] : []),
        { label: 'Average customer lifetime (months)', value: x.lifetimeMonths!, fmt: 'number' },
      ],
      formula: [...formula, `${f(arpu!)} × ${f(margin!)}% ÷ ${f(churn!.div(100))} = ${f2(x.ltv)}`, 'Customer lifetime = 1 ÷ churn'],
      note: verdict,
    }
  },
}

// ---- F8 CAC payback ----------------------------------------------------------
const paybackFields = [
  { id: 'cac', label: 'CAC' },
  { id: 'arpu', label: 'Monthly revenue per customer (ARPU)' },
  { id: 'margin', label: 'Gross margin' },
]

const paybackSpec: ToolSpec = {
  id: 'cac-payback',
  title: 'Customer payback time',
  blurb: 'Months to earn back a customer’s cost',
  category: 'metrics',
  keywords: ['cac payback', 'cac', 'payback', 'payback period', 'saas', 'months to recover'],
  fields: [
    { id: 'cac', label: 'Cost to win one customer', kind: 'number', unit: 'rupee', default: '2000' },
    { id: 'arpu', label: 'Monthly revenue per customer (ARPU)', kind: 'number', unit: 'rupee', default: '500' },
    { id: 'margin', label: 'Gross margin', kind: 'number', unit: 'percent', default: '70' },
  ],
  compute: (v) => {
    const r = need(v, paybackFields)
    if (!r.ok) return r
    const { cac, arpu, margin } = r.n as Record<string, Dec>
    const neg = nonNegative(r.n, paybackFields)
    if (neg) return neg
    if (margin!.gt(100)) return { error: 'Gross margin is a percentage from 0 to 100' }
    const months = cacPayback(cac!, arpu!, margin!)
    if (!months) return { error: 'A customer needs to earn some gross profit to pay back' }
    const profit = arpu!.times(margin!.div(100))
    return {
      rows: [
        { label: 'Payback period (months)', value: months, fmt: 'number', timeUnit: 'months', main: true },
        { label: 'Profit per customer a month', value: profit, fmt: 'money' },
      ],
      formula: ['CAC payback = CAC ÷ (ARPU × gross margin)', `${f(cac!)} ÷ (${f(arpu!)} × ${f(margin!)}%) = ${f2(months)} months`],
      note: months.lte(12)
        ? 'Under 12 months is commonly seen as healthy (a rule of thumb for subscription businesses; it depends on churn and how much cash you have).'
        : months.lte(18)
          ? 'Between 12 and 18 months is commonly seen as acceptable but slow (a rule of thumb; it depends on churn and cash).'
          : 'Over 18 months is commonly seen as slow, so cash stays tied up for long (a rule of thumb; it depends on churn and cash).',
    }
  },
}

// ---- F9 Funnel conversion ----------------------------------------------------
const funnelSpec: ToolSpec = {
  id: 'funnel',
  title: 'Funnel conversion',
  blurb: 'Step-by-step conversion and the biggest drop-off',
  category: 'metrics',
  keywords: ['funnel', 'conversion', 'drop off', 'drop-off', 'steps', 'signup', 'checkout'],
  fields: [
    {
      id: 'stages',
      label: 'Funnel stages, top to bottom',
      kind: 'rows',
      min: 2,
      max: 12,
      columns: [
        { id: 'name', label: 'Stage', kind: 'text' },
        { id: 'count', label: 'Count', kind: 'number' },
      ],
      defaultRows: [['Visited', '10000'], ['Signed up', '1800'], ['Activated', '900'], ['Paid', '180']],
    },
  ],
  compute: (v) => {
    const s = pairs(v, 'stages')
    if ('error' in s) return s
    if (s.length < 2) return { error: 'Enter at least two stages' }
    if (s[0]!.n.isZero()) return { error: 'The first stage needs a count above 0' }
    const name = (i: number) => s[i]!.name || `Stage ${i + 1}`
    for (let i = 1; i < s.length; i++) {
      if (s[i]!.n.gt(s[i - 1]!.n)) return { error: `${name(i)} can't be bigger than ${name(i - 1)}` }
    }
    const x = funnel(s.map((r) => r.n))!
    const last = s.length - 1
    const w = x.worst
    const lost = w === null ? null : s[w - 1]!.n.minus(s[w]!.n)
    const biggest = w === null || x.step[w]!.gte(100) ? 'No drop-off' : `${name(w - 1)} to ${name(w)}`
    return {
      rows: [
        { label: 'Overall conversion', value: x.overall[last]!, fmt: 'percent', main: true },
        { label: 'Biggest drop-off', value: biggest, fmt: 'text' },
        ...(w !== null && lost && lost.gt(0) ? [{ label: 'People lost at that step', value: lost, fmt: 'int' as const }] : []),
      ],
      table: {
        columns: ['Stage', 'Count', 'Of previous', 'Of first'],
        fmts: ['text', 'int', 'percent', 'percent'],
        rows: s.map((r, i) => [name(i), r.n, x.step[i] ?? '—', x.overall[i]!]),
      },
      formula: ['Step conversion = this stage ÷ previous stage × 100', 'Overall conversion = last stage ÷ first stage × 100', `${f(s[last]!.n)} ÷ ${f(s[0]!.n)} × 100`],
      note: 'The biggest drop-off is the step with the lowest step conversion, so look there first.',
    }
  },
}

// ---- F10 ARR / MRR run-rate --------------------------------------------------
const runRateFields = [
  { id: 'mrr', label: 'Current MRR' },
  { id: 'newPct', label: 'New customer growth per month' },
  { id: 'expPct', label: 'Expansion per month' },
  { id: 'churn', label: 'Monthly revenue churn' },
  { id: 'months', label: 'Months to project' },
]

const runRateSpec: ToolSpec = {
  id: 'arr-mrr',
  title: 'Recurring revenue forecast',
  blurb: 'Project recurring revenue growth',
  category: 'metrics',
  keywords: ['arr and mrr', 'arr', 'mrr', 'run rate', 'run-rate', 'recurring revenue', 'nrr', 'net revenue retention', 'growth'],
  fields: [
    { id: 'mrr', label: 'Current monthly revenue (MRR)', kind: 'number', unit: 'rupee', default: '500000' },
    { id: 'newPct', label: 'New customer growth a month', kind: 'number', unit: 'percent', default: '6', hint: 'New customers\' MRR as a share of this month\'s MRR' },
    { id: 'expPct', label: 'Expansion a month', kind: 'number', unit: 'percent', default: '1', hint: 'Upsell from existing customers, as a share of MRR' },
    { id: 'churn', label: 'Monthly revenue churn', kind: 'number', unit: 'percent', default: '3', hint: 'Share of MRR lost each month' },
    { id: 'months', label: 'Months to project', kind: 'number', unit: 'months', default: '12', hint: 'Whole months, 1 to 120' },
  ],
  compute: (v) => {
    const r = need(v, runRateFields)
    if (!r.ok) return r
    const { mrr, newPct, expPct, churn, months } = r.n as Record<string, Dec>
    const neg = nonNegative(r.n, runRateFields)
    if (neg) return neg
    if (churn!.gt(100)) return { error: 'Churn is a percentage from 0 to 100' }
    if (!months!.isInteger() || months!.lt(1) || months!.gt(120)) return { error: 'Months must be a whole number from 1 to 120' }
    const m = months!.toNumber()
    const x = runRate(mrr!, newPct!, expPct!, churn!, m)
    const end = x.mrr[m]!
    // At most 24 bars: pick every step-th month and always the last.
    const step = Math.ceil(m / 24)
    const idx = [...Array(m + 1).keys()].filter((i) => i % step === 0 || i === m)
    return {
      rows: [
        { label: `Yearly revenue (ARR) after ${m} months`, value: end.times(12), fmt: 'money', main: true },
        { label: `Monthly revenue (MRR) after ${m} months`, value: end, fmt: 'money' },
        { label: 'Yearly revenue (ARR) today', value: mrr!.times(12), fmt: 'money' },
        { label: 'Net growth per month', value: x.netPct, fmt: 'percent' },
        { label: 'Revenue kept after 12 months (NRR)', value: x.nrr12, fmt: 'percent' },
      ],
      chart: { title: 'MRR by month', labels: idx.map((i) => `M${i}`), series: [{ name: 'MRR', values: idx.map((i) => x.mrr[i]!.toNumber()) }] },
      formula: [
        'ARR = MRR × 12',
        'Net growth = new + expansion − churn, compounded monthly: MRR × (1 + net)^months',
        `${f(newPct!)}% + ${f(expPct!)}% − ${f(churn!)}% = ${f2(x.netPct)}% per month`,
        'NRR (12 months) = (1 + expansion − churn)^12, existing customers only',
      ],
      note: 'A straight-line projection of constant rates; real growth rarely stays steady, so treat it as a what-if.',
    }
  },
}

// ---- F11 A/B test sample size ------------------------------------------------
const abFields = [
  { id: 'baseline', label: 'Baseline conversion rate' },
  { id: 'mde', label: 'Minimum detectable effect' },
  { id: 'alpha', label: 'Significance level' },
  { id: 'power', label: 'Power' },
  { id: 'traffic', label: 'Daily visitors' },
]

const sampleSpec: ToolSpec = {
  id: 'ab-sample-size',
  title: 'A/B test sample size',
  blurb: 'Visitors and days an A/B test needs',
  category: 'metrics',
  verified: { source: 'R power.prop.test documentation' },
  keywords: ['ab test', 'a/b', 'sample size', 'experiment', 'mde', 'power', 'significance', 'conversion', 'duration'],
  fields: [
    { id: 'baseline', label: 'Current conversion rate', kind: 'number', unit: 'percent', default: '20' },
    {
      id: 'mdeType',
      label: 'Lift is measured as',
      kind: 'select',
      default: 'absolute',
      options: [
        { value: 'absolute', label: 'Absolute' },
        { value: 'relative', label: 'Relative' },
      ],
    },
    { id: 'mde', label: 'Smallest lift to detect', kind: 'number', unit: 'percent', default: '5', hint: 'Points if Absolute, % of current rate if Relative' },
    { id: 'traffic', label: 'Daily visitors', kind: 'number', default: '500', hint: 'All variants together' },
    { id: 'alpha', label: 'Significance level', kind: 'number', unit: 'percent', default: '5', hint: '5 means 95% confidence', advanced: true },
    { id: 'power', label: 'Test power', kind: 'number', unit: 'percent', default: '80', hint: 'Chance of catching a real lift of that size', advanced: true },
  ],
  compute: (v) => {
    const r = need(v, abFields)
    if (!r.ok) return r
    const { baseline, mde, alpha, power, traffic } = r.n as Record<string, Dec>
    const type = v.mdeType === 'relative' ? 'relative' : 'absolute'
    if (baseline!.lte(0) || baseline!.gte(100)) return { error: 'Baseline must be between 0% and 100%' }
    if (mde!.lte(0)) return { error: 'The effect to detect must be above 0' }
    if (alpha!.lte(0) || alpha!.gte(100)) return { error: 'Significance level must be between 0% and 100%' }
    if (power!.lte(0) || power!.gte(100)) return { error: 'Power must be between 0% and 100%' }
    if (traffic!.lte(0)) return { error: 'Daily visitors must be above 0' }
    const x = sampleSize(baseline!.div(100).toNumber(), mde!.div(100).toNumber(), type, alpha!.div(100).toNumber(), power!.div(100).toNumber())
    if (!x) return { error: 'That lift would take the rate above 100%, so pick a smaller effect' }
    if (!Number.isFinite(x.n) || x.n > 1e12) return { error: 'That effect is too small to measure with any realistic sample' }
    const per = new D(Math.ceil(x.n))
    const total = per.times(2)
    const days = total.div(traffic!).ceil()
    return {
      rows: [
        { label: 'Visitors needed per variant', value: per, fmt: 'int', main: true },
        { label: 'Visitors needed in total (2 variants)', value: total, fmt: 'int' },
        { label: 'Test duration (days)', value: days, fmt: 'int' },
        { label: 'New rate you need to see', value: new D(x.p2).times(100), fmt: 'percent' },
      ],
      formula: [
        'n per variant = (z(1 − α/2) × √(2·p̄·q̄) + z(power) × √(p1·q1 + p2·q2))² ÷ (p2 − p1)²',
        'Two-sided test for two proportions, equal split; p̄ = average of p1 and p2, q = 1 − p',
        `p1 = ${f(baseline!)}%, p2 = ${f2(new D(x.p2).times(100))}% (${type} effect of ${f(mde!)}${type === 'absolute' ? ' points' : '% of baseline'})`,
        'Duration = 2 × n ÷ daily visitors, rounded up',
      ],
      note: days.lt(7)
        ? 'Run it for at least a full week even though the numbers allow less, so weekday and weekend habits both show up.'
        : 'Do not stop early when the result looks good; stopping at the planned sample is what keeps the test honest.',
    }
  },
}

// ---- F12 Retention / cohort --------------------------------------------------
const retentionSpec: ToolSpec = {
  id: 'retention',
  title: 'Customer retention',
  blurb: 'Retention curve and average lifetime',
  category: 'metrics',
  keywords: ['retention and cohort', 'retention', 'cohort', 'churn', 'lifetime', 'curve', 'active users'],
  fields: [
    { id: 'cohort', label: 'Customers at the start', kind: 'number', default: '1000' },
    {
      id: 'periods',
      label: 'Still active after each period',
      kind: 'rows',
      min: 1,
      max: 24,
      columns: [
        { id: 'period', label: 'Period', kind: 'text' },
        { id: 'retained', label: 'Retained', kind: 'number' },
      ],
      defaultRows: [['Month 1', '620'], ['Month 2', '480'], ['Month 3', '410'], ['Month 4', '370'], ['Month 5', '345']],
    },
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'cohort', label: 'Customers at the start' }])
    if (!r.ok) return r
    const cohort = r.n.cohort!
    if (cohort.lte(0)) return { error: 'Customers at the start must be above 0' }
    const p = pairs(v, 'periods')
    if ('error' in p) return p
    if (p.length < 1) return { error: 'Enter at least one period' }
    const name = (i: number) => p[i]!.name || `Period ${i + 1}`
    const over = p.findIndex((x) => x.n.gt(cohort))
    if (over >= 0) return { error: `${name(over)} can't be more than the cohort size` }
    const x = retention(cohort, p.map((q) => q.n))!
    const labels = ['Start', ...p.map((_, i) => name(i))]
    const rates = [new D(100), ...x.rates]
    return {
      rows: [
        { label: `Retention at ${name(p.length - 1)}`, value: x.rates[p.length - 1]!, fmt: 'percent', main: true },
        { label: 'Average lifetime (in periods)', value: x.lifetime, fmt: 'number' },
      ],
      table: {
        columns: ['Period', 'Retained', 'Retention'],
        fmts: ['text', 'int', 'percent'],
        rows: labels.map((l, i) => [l, i === 0 ? cohort : p[i - 1]!.n, rates[i]!]),
      },
      chart: { title: 'Retention curve (%)', labels, series: [{ name: 'Retained', values: rates.map((q) => q.toNumber()) }] },
      formula: ['Retention = retained ÷ cohort size × 100', 'Average lifetime = 1 (the start period) + the sum of each period\'s retention as a fraction'],
      note: 'Lifetime counts only the periods you entered, so it is a floor; customers still active after the last period would add more.',
    }
  },
}

// ---- F13 Rule of 40 and burn multiple ----------------------------------------
const rule40Fields = [
  { id: 'growth', label: 'Revenue growth' },
  { id: 'margin', label: 'Profit margin' },
  { id: 'burn', label: 'Net burn' },
  { id: 'newArr', label: 'Net new ARR' },
]

const BAND_WORDS = { great: 'great', good: 'good', okay: 'okay', weak: 'weak', bad: 'bad' } as const

const rule40Spec: ToolSpec = {
  id: 'rule-of-40',
  title: 'Rule of 40 and burn multiple',
  blurb: 'Growth plus profit, and burn efficiency',
  category: 'metrics',
  keywords: ['rule of 40', 'burn multiple', 'burn', 'saas', 'growth', 'profit margin', 'net new arr', 'efficiency'],
  fields: [
    { id: 'growth', label: 'Revenue growth', kind: 'number', unit: 'percent', default: '60', hint: 'Year on year' },
    { id: 'margin', label: 'Profit margin', kind: 'number', unit: 'percent', default: '-35', hint: 'Use a minus sign for a loss' },
    { id: 'burn', label: 'Net burn', kind: 'number', unit: 'rupee', default: '20000000', hint: 'Cash lost in the period; 0 if not burning' },
    { id: 'newArr', label: 'Net new ARR', kind: 'number', unit: 'rupee', default: '15000000', hint: 'ARR added minus ARR lost, same period as the burn' },
  ],
  compute: (v) => {
    const r = need(v, rule40Fields)
    if (!r.ok) return r
    const { growth, margin, burn, newArr } = r.n as Record<string, Dec>
    if (burn!.isNegative()) return { error: "Net burn can't be negative; enter 0 if you are not burning cash" }
    const score = ruleOf40(growth!, margin!)
    const bm = burnMultiple(burn!, newArr!)
    const passes = score.gte(40)
    const bandText = bm ? `burn efficiency is ${BAND_WORDS[burnBand(bm)]}` : 'burn multiple cannot be worked out without positive net new ARR'
    return {
      rows: [
        { label: 'Rule of 40 score', value: score, fmt: 'number', main: true },
        { label: 'Burn multiple (burn per rupee of new ARR)', value: bm ?? 'Not defined', fmt: bm ? 'number' : 'text' },
      ],
      formula: [
        'Rule of 40 = growth % + profit margin %',
        `${f(growth!)} + (${f(margin!)}) = ${f(score)}`,
        'Burn multiple = net burn ÷ net new ARR',
        bm ? `${f(burn!)} ÷ ${f(newArr!)} = ${f2(bm)}` : 'Net new ARR is zero or negative, so there is no multiple',
        'Rules of thumb for burn multiple: below 1 great, 1 to 1.5 good, 1.5 to 2 okay, 2 to 3 weak, above 3 bad',
      ],
      note: `The score ${passes ? 'passes' : 'is below'} the 40 mark and ${bandText}; both are rules of thumb, not laws. The 40 mark is aimed at SaaS companies past early stage; the burn bands assume a growing company.`,
    }
  },
}

export const TOOLS: ToolSpec[] = [cacLtvSpec, paybackSpec, funnelSpec, runRateSpec, sampleSpec, retentionSpec, rule40Spec]

