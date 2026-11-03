import { D, type Dec } from '../../engine/decimal'
import { debtToIncome, emergencyFund, savingsRate, type DtiBand } from '../../engine/investments/planning'
import { fromMargin, fromMarkup, fromPrice } from '../../engine/metrics/markup'
import { formatDecimal } from '../../lib/format'
import { junkOptional, need, parseNum, type Field, type ToolSpec } from '../../lib/tool'

/** Personal-finance checks (emergency fund, debt-to-income, savings rate) and markup vs margin. Engine: engine/investments/planning.ts, engine/metrics/markup.ts. */

const s = (v: Dec, dp = 2) => formatDecimal(v.toDecimalPlaces(dp), { system: 'indian', decimals: 'auto' })
const num = (id: string, label: string, def: string, unit: Extract<Field, { kind: 'number' }>['unit'] = 'none', hint?: string, advanced?: boolean): Field => ({
  id, label, kind: 'number', unit, default: def, hint, advanced,
})

const emergencySpec: ToolSpec = {
  id: 'emergency-fund',
  title: 'Emergency fund',
  blurb: 'How many months of expenses you have set aside',
  category: 'invest',
  keywords: ['rainy day', 'safety net', 'contingency', 'months of expenses', 'liquid savings', 'job loss'],
  fields: [
    num('expenses', 'Monthly essential expenses', '30000', 'rupee', 'Rent, food, EMIs, bills, insurance. Not shopping or travel'),
    num('months', 'Months you want covered', '6', 'months', 'Type your own. See the guide under the result'),
    num('savings', 'Liquid savings now', '100000', 'rupee', 'Money you can reach within a day or two. Leave blank for none'),
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'expenses', label: 'Monthly essential expenses' }, { id: 'months', label: 'Months you want covered' }])
    if (!r.ok) return r
    const junk = junkOptional(v, [{ id: 'savings', label: 'Liquid savings' }])
    if (junk) return junk
    const savings = parseNum(v.savings) ?? new D(0)
    if (r.n.expenses!.isNegative() || r.n.months!.isNegative() || savings.isNegative()) return { error: 'Use positive numbers' }
    if (r.n.expenses!.isZero()) return { error: 'Monthly expenses must be more than zero' }
    if (r.n.months!.isZero()) return { error: 'Months must be more than zero' }
    if (r.n.months!.gt(60)) return { error: 'Use 60 months or fewer' }
    const e = emergencyFund(r.n.expenses!, r.n.months!, savings)!
    const short = e.gap.gt(0)
    return {
      rows: [
        short
          ? { label: 'Still to save', value: e.gap, fmt: 'money', main: true }
          : { label: 'Above your target', value: e.gap.negated(), fmt: 'money', main: true },
        { label: 'Target amount', value: e.target, fmt: 'money' },
        { label: 'Months covered now', value: e.monthsCovered.toDecimalPlaces(1), fmt: 'number' },
      ],
      table: {
        title: 'Months by situation (a rough guide)',
        columns: ['Situation', 'Months'],
        rows: [
          ['Salaried, one income', '6'],
          ['Two incomes in the household', '3 to 4'],
          ['Freelancer or variable income', '9 to 12'],
          ['Dependants or a health condition', '12'],
        ],
      },
      formula: ['Target = monthly essential expenses × months; months covered = savings ÷ expenses', `${s(r.n.expenses!)} × ${s(r.n.months!)} = ${s(e.target)}; ${s(savings)} ÷ ${s(r.n.expenses!)} = ${s(e.monthsCovered)}`],
      note: 'The months in the guide are common rules of thumb, not a rule: pick the row that matches your life and type your own number. Count only money you can reach quickly (savings account, liquid fund), not shares or property.',
    }
  },
}

const BAND_WORD: Record<DtiBand, string> = { comfortable: 'Comfortable', stretched: 'Stretched', high: 'High' }

const dtiSpec: ToolSpec = {
  id: 'debt-to-income',
  title: 'Debt-to-income ratio',
  blurb: 'How much of your income goes to EMIs',
  category: 'invest',
  keywords: ['dti', 'foir', 'emi to income', 'loan eligibility', 'obligations', 'debt ratio'],
  fields: [
    num('income', 'Monthly gross income', '100000', 'rupee', 'Before tax and deductions'),
    num('debts', 'Total monthly EMIs and dues', '30000', 'rupee', 'All loan EMIs plus credit card minimum dues'),
    num('low', 'Comfortable up to', '36', 'percent', 'Common lender rule of thumb. Each lender sets its own', true),
    num('high', 'Stretched up to', '50', 'percent', 'Above this the ratio is called high', true),
  ],
  compute: (v) => {
    const r = need(v, [{ id: 'income', label: 'Monthly gross income' }, { id: 'debts', label: 'Total monthly EMIs and dues' }, { id: 'low', label: 'Comfortable limit' }, { id: 'high', label: 'Stretched limit' }])
    if (!r.ok) return r
    const { income, debts, low, high } = r.n
    if (debts!.isNegative() || low!.isNegative() || high!.isNegative()) return { error: 'Use positive numbers' }
    if (income!.isZero() || income!.isNegative()) return { error: 'Income must be more than zero' }
    if (low!.gte(high!)) return { error: 'The comfortable limit must be lower than the stretched limit' }
    const d = debtToIncome(income!, debts!, low!, high!)!
    const over = d.roomAtComfortable.isNegative()
    return {
      rows: [
        { label: 'Debt-to-income ratio', value: d.pct, fmt: 'percent', main: true },
        { label: 'Band', value: `${BAND_WORD[d.band]} (${d.band === 'comfortable' ? `${s(low!)}% or less` : d.band === 'stretched' ? `over ${s(low!)}% up to ${s(high!)}%` : `over ${s(high!)}%`})`, fmt: 'text' },
        over
          ? { label: `Over the ${s(low!)}% limit by`, value: d.roomAtComfortable.negated(), fmt: 'money' }
          : { label: `EMI room left under ${s(low!)}%`, value: d.roomAtComfortable, fmt: 'money' },
      ],
      formula: ['DTI = monthly EMIs and dues ÷ monthly gross income × 100', `${s(debts!)} ÷ ${s(income!)} × 100`],
      note: `Bands used: ${s(low!)}% or less comfortable, up to ${s(high!)}% stretched, above that high. These are common lender rules of thumb, not a law: banks in India often look at the same idea (FOIR) and set their own limit, so check with your lender.`,
    }
  },
}

const savingsRateSpec: ToolSpec = {
  id: 'savings-rate',
  title: 'Savings rate',
  blurb: 'What share of your income you keep',
  category: 'invest',
  keywords: ['savings percentage', 'how much do i save', 'income saved', 'spend rate', 'save per month'],
  fields: [
    num('income', 'Monthly income', '80000', 'rupee', 'Take-home, after tax'),
    {
      id: 'mode', label: 'I know my', kind: 'select', default: 'spend',
      options: [{ value: 'spend', label: 'Monthly spending' }, { value: 'saved', label: 'Monthly savings' }],
    },
    { ...num('spend', 'Monthly spending', '55000', 'rupee'), visibleIf: (v) => v.mode !== 'saved' },
    { ...num('saved', 'Monthly savings', '25000', 'rupee', 'Everything you put aside or invest'), visibleIf: (v) => v.mode === 'saved' },
  ],
  compute: (v) => {
    const saved = v.mode === 'saved'
    const r = need(v, [{ id: 'income', label: 'Monthly income' }, saved ? { id: 'saved', label: 'Monthly savings' } : { id: 'spend', label: 'Monthly spending' }])
    if (!r.ok) return r
    if (r.n.income!.isNegative() || r.n.income!.isZero()) return { error: 'Income must be more than zero' }
    const known = saved ? r.n.saved! : r.n.spend!
    if (known.isNegative()) return { error: 'Use positive numbers' }
    if (saved && known.gt(r.n.income!)) return { error: 'Savings can’t be more than income' }
    const sr = savingsRate(r.n.income!, saved ? { saved: known } : { spend: known })!
    const under = sr.saved.isNegative()
    return {
      rows: [
        { label: 'Savings rate', value: sr.pct, fmt: 'percent', main: true },
        under ? { label: 'Overspent each month', value: sr.saved.negated(), fmt: 'money' } : { label: 'Saved each month', value: sr.saved, fmt: 'money' },
        under ? { label: 'Overspent in a year', value: sr.annualSaved.negated(), fmt: 'money' } : { label: 'Saved in a year', value: sr.annualSaved, fmt: 'money' },
        { label: 'Spent each month', value: sr.spent, fmt: 'money' },
      ],
      formula: ['Savings rate = (income − spending) ÷ income × 100; a year = 12 × monthly savings', `(${s(r.n.income!)} − ${s(sr.spent)}) ÷ ${s(r.n.income!)} × 100`],
      note: under ? 'You spend more than you earn, so the rate is below zero: the gap has to come from savings or borrowing.' : 'This counts only what you set aside from income. It does not include growth on money you have already saved.',
    }
  },
}

const markupSpec: ToolSpec = {
  id: 'markup',
  title: 'Markup and margin',
  blurb: 'Selling price, profit, markup % and margin %',
  category: 'metrics',
  keywords: ['profit margin', 'gross margin', 'selling price', 'pricing', 'cost plus', 'retail', 'shop'],
  fields: [
    num('cost', 'Cost price', '800', 'rupee', 'What one unit costs you'),
    {
      id: 'known', label: 'I know the', kind: 'select', default: 'price',
      options: [{ value: 'price', label: 'Selling price' }, { value: 'markup', label: 'Markup %' }, { value: 'margin', label: 'Margin %' }],
    },
    { ...num('price', 'Selling price', '1000', 'rupee'), visibleIf: (v) => v.known === 'price' || !v.known },
    { ...num('markupPct', 'Markup %', '25', 'percent', 'Profit as a share of cost'), visibleIf: (v) => v.known === 'markup' },
    { ...num('marginPct', 'Margin %', '20', 'percent', 'Profit as a share of selling price'), visibleIf: (v) => v.known === 'margin' },
  ],
  compute: (v) => {
    const known = v.known === 'markup' ? 'markup' : v.known === 'margin' ? 'margin' : 'price'
    const field = { price: { id: 'price', label: 'Selling price' }, markup: { id: 'markupPct', label: 'Markup %' }, margin: { id: 'marginPct', label: 'Margin %' } }[known]
    const r = need(v, [{ id: 'cost', label: 'Cost price' }, field])
    if (!r.ok) return r
    const cost = r.n.cost!
    const x = r.n[field.id]!
    if (!cost.gt(0)) return { error: 'Cost must be more than zero' }
    if (known === 'price' && !x.gt(0)) return { error: 'Selling price must be more than zero' }
    if (known === 'markup' && x.lte(-100)) return { error: 'Markup must be above −100%' }
    if (known === 'margin' && x.gte(100)) return { error: 'Margin must be below 100%: profit can never be the whole price' }
    const m = (known === 'price' ? fromPrice(cost, x) : known === 'markup' ? fromMarkup(cost, x) : fromMargin(cost, x))!
    const loss = m.profit.isNegative()
    return {
      rows: [
        known === 'price'
          ? { label: loss ? 'Loss per unit' : 'Profit per unit', value: loss ? m.profit.negated() : m.profit, fmt: 'money', main: true }
          : { label: 'Selling price', value: m.price, fmt: 'money', main: true },
        { label: 'Markup (profit ÷ cost)', value: m.markupPct, fmt: 'percent' },
        { label: 'Margin (profit ÷ selling price)', value: m.marginPct, fmt: 'percent' },
        ...(known === 'price' ? [] : [{ label: loss ? 'Loss per unit' : 'Profit per unit', value: loss ? m.profit.negated() : m.profit, fmt: 'money' as const }]),
      ],
      formula: ['Markup % = profit ÷ cost × 100; margin % = profit ÷ selling price × 100', `${s(m.profit)} ÷ ${s(m.cost)} = ${s(m.markupPct)}%; ${s(m.profit)} ÷ ${s(m.price)} = ${s(m.marginPct)}%`],
      note: 'Markup and margin are not the same: markup is on cost, margin is on selling price. A 50% markup is only a 33.33% margin. Before GST and other costs.',
    }
  },
}

export const TOOLS: ToolSpec[] = [emergencySpec, dtiSpec, savingsRateSpec, markupSpec]
