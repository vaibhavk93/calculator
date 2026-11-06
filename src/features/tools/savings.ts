import { D, type Dec } from '../../engine/decimal'
import { formatDecimal } from '../../lib/format'
import { fdLadder, type Rung } from '../../engine/investments/fdLadder'
import { DICGC } from '../../engine/investments/rates'
import { RATES_AS_OF as TAX_AS_OF, RULES_FY2026_27 as R } from '../../engine/tax/rules.FY2026-27'
import { parseNum, type ResultRow, type ToolSpec } from '../../lib/tool'

/** Whole rupees grouped the Indian way, for the worked-out lines and notes. */
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

export const TOOLS: ToolSpec[] = [fdLadderSpec]
