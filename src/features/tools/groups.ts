/**
 * How the Tools tab is laid out: plain-named groups, each a list of tool ids. The calculators
 * themselves stay in their spec files; this only says where each one is shown.
 * groups.test.ts fails if a calculator is in no group, in two groups, or a group names an unknown id.
 */
export interface ToolGroup {
  id: string
  name: string
  tools: string[]
}

export const GROUPS: ToolGroup[] = [
  { id: 'money', name: 'Money and shopping', tools: ['percentage', 'discount', 'gst', 'tip', 'unit-price'] },
  { id: 'convert', name: 'Convert', tools: ['unit-converter', 'currency', 'number-base'] },
  { id: 'time', name: 'Dates and time', tools: ['date', 'world-time'] },
  { id: 'travel', name: 'Fuel and travel', tools: ['fuel-cost', 'fuel-efficiency'] },
  { id: 'health', name: 'Health and study', tools: ['body-metrics', 'ovulation', 'grade-average'] },
  {
    id: 'loans',
    name: 'Loans and EMI',
    tools: ['emi', 'amortisation', 'prepayment', 'reverse-emi', 'rate-change', 'loan-compare', 'balance-transfer', 'card-emi', 'home-loan-tax', 'simple-compound', 'loan-presets'],
  },
  {
    id: 'invest',
    name: 'Savings and investing',
    tools: ['sip', 'step-up-sip', 'lumpsum', 'goal-sip', 'swp', 'fd', 'rd', 'ppf', 'nps', 'epf', 'inflation', 'cagr-xirr'],
  },
  {
    id: 'tax',
    name: 'Tax and salary',
    tools: ['income-tax', 'in-hand-salary', 'capital-gains', 'advance-tax', 'gratuity', 'presumptive-44ada'],
  },
  {
    id: 'metrics',
    name: 'Business metrics',
    tools: ['cac-ltv', 'cac-payback', 'funnel', 'arr-mrr', 'ab-sample-size', 'retention', 'rule-of-40'],
  },
]

export const groupById = (id: string | null) => GROUPS.find((g) => g.id === id)
export const groupOfTool = (toolId: string) => GROUPS.find((g) => g.tools.includes(toolId))
