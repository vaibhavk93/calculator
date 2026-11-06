import { D, type Dec } from '../engine'
import {
  PAYMENT_MODES,
  UPI_DEFAULT_LABEL,
  countsAsSpend,
  entriesIn,
  entryMatches,
  instrumentLabel,
  networkLabel,
  signedAmount,
  type BudgetData,
  type BudgetExpense,
  type Filter,
  type InstrumentKind,
  type PaymentModeId,
} from './budget'

/**
 * Where the money went by HOW it was paid, as a tree: mode (UPI, Credit card, Debit card, Net banking, Wallet, Cash) and under
 * it the sub-type that actually paid (UPI from which bank account, debit card, wallet or RuPay card; which credit card).
 * Card bill payments and own-account transfers are not spending and are left out. A refund subtracts.
 */
export interface PayNode {
  /** Stable key for lists. */
  id: string
  label: string
  /** A second line: "Bank account", "Visa credit card", "No card or account picked"... */
  detail?: string
  spent: Dec
  count: number
  /** The filter that shows exactly this node's entries (feeds the existing entries list). */
  filter: Filter
  children: PayNode[]
}

const KIND_WORD: Record<InstrumentKind, string> = { credit: 'Credit card', debit: 'Debit card', bank: 'Bank account', wallet: 'Wallet' }

const add = (a: { spent: Dec; count: number }, e: BudgetExpense) => {
  a.spent = a.spent.plus(signedAmount(e))
  a.count += 1
}

export function paymentTree(budget: BudgetData, month: string, filter: Filter = {}): PayNode[] {
  const instById = new Map(budget.instruments.map((i) => [i.id, i]))
  const spend = entriesIn(budget, month, filter.cycleDay).filter((e) => countsAsSpend(e) && entryMatches(budget, e, filter))
  const modes = new Map<PaymentModeId | 'none', BudgetExpense[]>()
  for (const e of spend) {
    const k = e.mode ?? 'none'
    modes.set(k, [...(modes.get(k) ?? []), e])
  }

  const out: PayNode[] = []
  const order: (PaymentModeId | 'none')[] = [...PAYMENT_MODES.map((m) => m.id), 'none']
  for (const key of order) {
    const list = modes.get(key)
    if (!list || list.length === 0) continue
    const total = { spent: new D(0), count: 0 }
    const subs = new Map<string, PayNode>()
    for (const e of list) {
      add(total, e)
      if (key === 'none' || key === 'cash') continue
      const inst = e.instrumentId === null ? undefined : instById.get(e.instrumentId)
      const subKey = inst ? inst.id : 'default'
      let node = subs.get(subKey)
      if (!node) {
        node = {
          id: `${key}:${subKey}`,
          label: inst ? instrumentLabel(inst) : key === 'upi' ? UPI_DEFAULT_LABEL : 'No card or account picked',
          detail: inst ? [KIND_WORD[inst.kind], inst.network ? networkLabel(inst.network) : '', inst.bank].filter(Boolean).join(' · ') : undefined,
          spent: new D(0),
          count: 0,
          filter: { ...filter, modeId: key, ...(inst ? { instrumentId: inst.id } : {}) },
          children: [],
        }
        subs.set(subKey, node)
      }
      add(node, e)
    }
    out.push({
      id: key,
      label: key === 'none' ? 'No mode' : PAYMENT_MODES.find((m) => m.id === key)!.label,
      spent: total.spent,
      count: total.count,
      filter: key === 'none' ? { ...filter } : { ...filter, modeId: key },
      children: [...subs.values()].sort((a, b) => b.spent.comparedTo(a.spent)),
    })
  }
  return out.sort((a, b) => b.spent.comparedTo(a.spent))
}
