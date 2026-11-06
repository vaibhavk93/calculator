/**
 * How the Tools tab is laid out: eight groups, each split into small named sections, each section a list of
 * tool ids. The calculators themselves stay in their spec files; this only says where each one is shown.
 *
 * Sorted by what the person is trying to do, not by how the maths works: a currency converter is about money,
 * binary and hex are about numbers, a unit converter is about measuring. groups.test.ts fails if a calculator is
 * in no group, in two groups, or a section names an unknown id.
 *
 * `tint` picks one of the eight section colours (--tint-N, see src/lib/theme.ts). The colour only says "which
 * section": it is used on tiles, section cards and headings, never on a result.
 */
export interface ToolSection {
  title: string
  tools: string[]
}

export interface ToolGroup {
  id: string
  name: string
  /** 1 to 8: which --tint-N colour this group uses. */
  tint: number
  sections: ToolSection[]
  /** Every tool id in the group, in order. Derived from `sections`. */
  tools: string[]
}

const group = (id: string, name: string, tint: number, sections: ToolSection[]): ToolGroup => ({
  id,
  name,
  tint,
  sections,
  tools: sections.flatMap((s) => s.tools),
})

export const GROUPS: ToolGroup[] = [
  group('math', 'Math and numbers', 1, [
    { title: 'Everyday maths', tools: ['percentage'] },
    { title: 'Number systems', tools: ['number-base'] },
  ]),
  group('money', 'Money and shopping', 2, [
    { title: 'Prices and bills', tools: ['discount', 'gst', 'unit-price'] },
    { title: 'Sharing a bill', tools: ['tip'] },
    { title: 'Foreign money', tools: ['currency'] },
  ]),
  group('units', 'Units and travel', 3, [
    { title: 'Convert units', tools: ['unit-converter', 'fuel-efficiency'] },
    { title: 'Trip costs', tools: ['fuel-cost'] },
  ]),
  group('life', 'Dates and health', 4, [
    { title: 'Dates and time', tools: ['date', 'world-time'] },
    { title: 'Body', tools: ['body-metrics', 'ovulation'] },
    { title: 'Study', tools: ['grade-average'] },
  ]),
  group('loans', 'Loans and EMI', 5, [
    { title: 'Plan a loan', tools: ['emi', 'amortisation', 'reverse-emi'] },
    { title: 'Change a loan', tools: ['prepayment', 'rate-change', 'balance-transfer', 'loan-compare'] },
    { title: 'Several loans', tools: ['multi-loan', 'runway'] },
    { title: 'Special cases', tools: ['card-emi', 'home-loan-tax', 'simple-compound', 'loan-presets'] },
  ]),
  group('savings', 'Savings and investing', 6, [
    { title: 'Grow your money', tools: ['sip', 'step-up-sip', 'lumpsum', 'goal-sip'] },
    { title: 'Fixed returns', tools: ['fd', 'fd-ladder', 'rd', 'ppf'] },
    { title: 'Retirement', tools: ['nps', 'epf', 'swp'] },
    { title: 'Measure growth', tools: ['inflation', 'cagr-xirr'] },
    { title: 'Check your finances', tools: ['emergency-fund', 'debt-to-income', 'savings-rate'] },
  ]),
  group('tax', 'Tax and salary', 7, [
    { title: 'Your tax', tools: ['income-tax', 'advance-tax'] },
    { title: 'Your pay', tools: ['in-hand-salary', 'hra', 'gratuity'] },
    { title: 'Gains and freelance income', tools: ['capital-gains', 'ltcg-harvest', 'presumptive-44ada'] },
  ]),
  group('business', 'Business metrics', 8, [
    { title: 'Customers', tools: ['cac-ltv', 'cac-payback', 'retention'] },
    { title: 'Growth', tools: ['funnel', 'arr-mrr', 'rule-of-40'] },
    { title: 'Experiments', tools: ['ab-sample-size'] },
    { title: 'Pricing', tools: ['markup'] },
  ]),
]

export const groupById = (id: string | null) => GROUPS.find((g) => g.id === id)
export const groupOfTool = (toolId: string) => GROUPS.find((g) => g.tools.includes(toolId))
