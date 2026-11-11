import { D, type Dec } from '../engine'

/**
 * Grouping for the review lists (manual scan and Inbox): by category first, then payees that repeat inside a category.
 * Only a VIEW. Every payment stays its own entry with its own date, card and amount; nothing is merged or summed into one entry.
 */

export interface Groupable {
  id: string
  merchant: string
  amount: string
}

/** One payee inside a category. `items.length > 1` means "club these": the UI shows one row that expands. */
export interface PayeeGroup<T extends Groupable> {
  key: string
  label: string
  items: T[]
  total: Dec
}

export interface CategoryGroup<T extends Groupable> {
  /** Null = no category yet ("Not sure"). */
  categoryId: string | null
  payees: PayeeGroup<T>[]
  total: Dec
  count: number
}

const GENERIC = new Set(['india', 'pvt', 'ltd', 'private', 'limited', 'llp', 'inc', 'payments', 'pay', 'online', 'services', 'the'])

/** A stable key for "the same payee": lower case, no digits-only words, no punctuation, no company suffixes. Empty merchant stays unique. */
export function payeeKey(merchant: string): string {
  const words = merchant.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !/^\d+$/.test(w))
  const core = words.filter((w) => !GENERIC.has(w))
  return (core.length ? core : words).join(' ')
}

/** Categories by total (largest first) with "Not sure" first, because that is where the user's attention is needed. */
export function groupByCategoryThenPayee<T extends Groupable>(items: readonly T[], categoryOf: (item: T) => string | null): CategoryGroup<T>[] {
  const cats = new Map<string | null, Map<string, T[]>>()
  items.forEach((it, i) => {
    const c = categoryOf(it)
    const k = payeeKey(it.merchant) || `#${i}`
    const byPayee = cats.get(c) ?? new Map<string, T[]>()
    byPayee.set(k, [...(byPayee.get(k) ?? []), it])
    cats.set(c, byPayee)
  })
  const sum = (xs: readonly T[]) => xs.reduce((a, x) => a.plus(new D(x.amount)), new D(0))
  const out: CategoryGroup<T>[] = [...cats.entries()].map(([categoryId, byPayee]) => {
    const payees = [...byPayee.entries()]
      .map(([key, its]) => ({ key, label: its[0]!.merchant, items: its, total: sum(its) }))
      .sort((a, b) => b.total.comparedTo(a.total) || a.label.localeCompare(b.label))
    return { categoryId, payees, total: payees.reduce((a, p) => a.plus(p.total), new D(0)), count: payees.reduce((n, p) => n + p.items.length, 0) }
  })
  return out.sort((a, b) => (a.categoryId === null ? -1 : b.categoryId === null ? 1 : b.total.comparedTo(a.total)))
}
