import { D, type Dec } from '../../engine/decimal'
import { goldBill, type Making } from '../../engine/convert/gold'
import { GOLD, GOLD_AS_OF } from '../../engine/convert/gstRates'
import { formatDecimal } from '../../lib/format'
import { junkOptional, need, parseNum, type ResultRow, type ToolSpec, type Values } from '../../lib/tool'

const s = (v: Dec, dp = 2) => formatDecimal(v.toDecimalPlaces(dp), { system: 'indian', decimals: 'auto' })
const optNum = (v: Values, id: string): Dec | null => parseNum(v[id])

const MAKING_LABEL = { percent: 'Making charge (% of gold value)', perGram: 'Making charge per gram', flat: 'Making charge (total)' } as const

const goldSpec: ToolSpec = {
  id: 'gold-bill',
  rates: GOLD_AS_OF,
  title: 'Gold jewellery bill',
  blurb: 'Gold, making charge and 3% GST',
  category: 'everyday',
  verified: { source: 'Notification 9/2025-Central Tax (Rate) Schedule IV serial 10 (3%); GST Council jewellery FAQ Q7 (3% on the whole bill)' },
  keywords: ['gold', 'jewellery', 'jewelry', 'making charge', 'wastage', 'gst', '3%', 'hallmark', 'carat', 'karat', 'bill', 'ornament', 'jeweller'],
  fields: [
    { id: 'grams', label: 'Weight', kind: 'number', unit: 'none', default: '10', hint: 'In grams, as on the bill' },
    {
      id: 'karat',
      label: 'Purity',
      kind: 'select',
      default: '22',
      options: GOLD.karats.map((k) => ({ value: String(k), label: `${k}K` })),
    },
    {
      id: 'rate',
      label: '24K gold rate per gram',
      kind: 'number',
      unit: 'rupee',
      default: '12000',
      hint: "Example. Type today's rate. The 22K, 18K and 14K prices are worked out from it.",
    },
    {
      id: 'makingType',
      label: 'Making charge is',
      kind: 'select',
      default: 'percent',
      options: [
        { value: 'percent', label: 'A % of the gold value' },
        { value: 'perGram', label: '₹ for every gram' },
        { value: 'flat', label: 'One total amount' },
      ],
    },
    {
      id: 'making',
      label: MAKING_LABEL.percent,
      labelFor: (v) => MAKING_LABEL[v.makingType as keyof typeof MAKING_LABEL] ?? MAKING_LABEL.percent,
      kind: 'number',
      unit: 'none',
      default: '12',
    },
    { id: 'stones', label: 'Stones and other charges', kind: 'number', unit: 'rupee', default: '', hint: 'Before GST. Leave blank for none.', advanced: true },
    { id: 'purityRate', label: "The shop's rate per gram for this purity", kind: 'number', unit: 'rupee', default: '', hint: 'Optional. If the shop quotes its own 22K or 18K rate, use it instead of the worked-out one.', advanced: true },
    {
      id: 'supply',
      label: 'Bought in',
      kind: 'select',
      default: 'intra',
      advanced: true,
      options: [
        { value: 'intra', label: 'Your own state (CGST + SGST)' },
        { value: 'inter', label: 'Another state (IGST)' },
      ],
    },
  ],
  compute: (v) => {
    const r = need(v, [
      { id: 'grams', label: 'The weight' },
      { id: 'rate', label: 'The gold rate' },
      { id: 'making', label: 'The making charge' },
    ])
    if (!r.ok) return r
    const junk = junkOptional(v, [
      { id: 'stones', label: 'Stones and other charges' },
      { id: 'purityRate', label: "The shop's rate" },
    ])
    if (junk) return junk
    const kind = v.makingType === 'perGram' || v.makingType === 'flat' ? v.makingType : 'percent'
    const making: Making = { kind, value: r.n.making! }
    if (r.n.grams!.lte(0)) return { error: 'Weight must be more than zero', field: 'grams' }
    if (r.n.rate!.lte(0)) return { error: 'The gold rate must be more than zero', field: 'rate' }
    if (making.value.isNegative()) return { error: 'The making charge cannot be negative', field: 'making' }
    if (kind === 'percent' && making.value.gt(100)) return { error: 'A making charge is 100% of the gold or less', field: 'making' }
    const stones = optNum(v, 'stones') ?? new D(0)
    if (stones.isNegative()) return { error: 'Stones and other charges cannot be negative', field: 'stones' }
    const own = optNum(v, 'purityRate')
    if (own && own.lte(0)) return { error: "The shop's rate must be more than zero", field: 'purityRate' }
    const karat = Number(v.karat) || 22
    const inter = v.supply === 'inter'
    const b = goldBill({ grams: r.n.grams!, karat, rate24: r.n.rate!, rateForPurity: own, making, stones, interState: inter })
    if (!b) return { error: 'These amounts cannot be worked out' }

    const rows: ResultRow[] = [
      { label: 'Total to pay', value: b.total, fmt: 'money', main: true },
      { label: `Gold (${s(r.n.grams!, 3)} g at ₹${s(b.ratePerGram)} a gram)`, value: b.metal, fmt: 'money' },
      { label: 'Making charge', value: b.making, fmt: 'money' },
      ...(b.stones.gt(0) ? [{ label: 'Stones and other charges', value: b.stones, fmt: 'money' as const }] : []),
      { label: 'Amount before GST', value: b.taxable, fmt: 'money' },
      ...(inter
        ? [{ label: `IGST (${GOLD.igstPct}%)`, value: b.igst!, fmt: 'money' as const }]
        : [
            { label: `CGST (${GOLD.cgstPct}%)`, value: b.cgst!, fmt: 'money' as const },
            { label: `SGST (${GOLD.sgstPct}%)`, value: b.sgst!, fmt: 'money' as const },
          ]),
    ]
    const rateLine = own ? `Price per gram: ₹${s(own)} (the shop's own rate)` : `Price per gram = 24K rate × ${karat} ÷ 24 = ₹${s(r.n.rate!)} × ${karat} ÷ 24 = ₹${s(b.ratePerGram)}`
    const fiveLine = b.making.gt(0)
      ? ` If a shop bills 5% GST on the making charge of a ready piece, you pay ₹${s(b.extraIfFivePctOnMaking)} more (2% of ₹${s(b.making)}). The GST Council's jewellery FAQ says the 5% is for job work on your own gold, charged on the job charge only.`
      : ''
    return {
      rows,
      formula: [
        'Gold = weight × price per gram. GST = 3% of (gold + making + stones)',
        rateLine,
        `GST = ${GOLD.ratePct}% × ₹${s(b.taxable)} = ₹${s(b.gst)}`,
      ],
      note:
        `GST on a ready piece of jewellery is 3% of the whole bill, whether the making charge is shown separately or not (Notification 9/2025-Central Tax (Rate), Schedule IV, heading 7113, still in force after the 30 Apr 2026 amendment, read 6 Nov 2026).` +
        fiveLine +
        ` Assumptions: the worked-out 22K, 18K and 14K prices are the 24K rate × karat ÷ 24, and shops may price slightly differently; the gold rate shown is an example, so type today's. ` +
        (inter ? 'Other-state IGST is taken as 3% (1.5% + 1.5%): its own notification was not read. ' : '') +
        `Not included: old-gold exchange and lab-grown stones, because the sources checked do not settle their GST treatment. Hallmarking fees, if charged, go under other charges.`,
    }
  },
}

export const TOOLS: ToolSpec[] = [goldSpec]
