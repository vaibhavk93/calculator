/**
 * The short name of a payee, how two names are compared, and what the person has taught the app about who a payee is.
 * No imports on purpose: smsParse, inbox and ownMoney all need it, and none of them may import another in a circle.
 */

/** The short, comparable name of a payee: lower case, letters and digits, words with digits dropped (order numbers, card digits), at most 3 words. Null when too little is left. */
export function payeeKey(merchant: string): string | null {
  const words = merchant.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').split(/\s+/).filter((w) => w !== '' && !/\d/.test(w)).slice(0, 3)
  const key = words.join(' ').slice(0, 40).trim()
  return key.length >= 3 ? key : null
}

/** Words that say nothing about WHO was paid ("Zomato Online Order Pvt Ltd" and "Zomato" are one payee). */
const FILLER = new Set(['india', 'pvt', 'ltd', 'private', 'limited', 'llp', 'inc', 'payments', 'payment', 'pay', 'online', 'services', 'order', 'the', 'and', 'bank', 'upi', 'vpa', 'a/c', 'ac', 'txn'])

const words = (s: string): string[] => s.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').split(/\s+/).filter((w) => w !== '' && !/^\d+$/.test(w) && !FILLER.has(w))

/**
 * "The same payee under two spellings": the meaningful words of one are all inside the other, as WHOLE words ("Zomato" is in "Zomato Online
 * Order", "Ravi" is not in "Ravindra"). At least 3 letters must be shared, so a one-letter or two-letter word never joins two payees.
 * Two empty names are NOT the same (nothing is known); the caller decides what an empty name means.
 */
export function sameName(a: string, b: string): boolean {
  const x = words(a)
  const y = words(b)
  if (x.length === 0 || y.length === 0) return false
  const [small, big] = x.length <= y.length ? [x, y] : [y, x]
  if (small.join('').length < 3) return false
  return small.every((w) => big.includes(w))
}

/** What the person told the app a payee is. `self` = one of their own accounts; `person` = somebody else; `merchant` = a shop or company. */
export type PayeeKindName = 'self' | 'person' | 'merchant'
export const PAYEE_KINDS: readonly PayeeKindName[] = ['self', 'person', 'merchant']

export interface PayeeKind {
  key: string
  kind: PayeeKindName
  at: number
}

export const MAX_PAYEE_KINDS = 200

export const payeeKindFor = (list: readonly PayeeKind[] | undefined, key: string | null): PayeeKindName | null => (key === null ? null : (list ?? []).find((p) => p.key === key)?.kind ?? null)

/** Sets what a payee is (newest first, capped). `null` forgets it. */
export function withPayeeKind(list: readonly PayeeKind[] | undefined, key: string, kind: PayeeKindName | null, at: number): PayeeKind[] {
  const rest = (list ?? []).filter((p) => p.key !== key)
  return (kind === null ? rest : [{ key, kind, at }, ...rest]).slice(0, MAX_PAYEE_KINDS)
}
