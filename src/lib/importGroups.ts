import { guessCategory } from './categoryGuess'

/**
 * Where a found payment goes in the "Add from messages" list (a view only; nothing is saved by it).
 * Order: your own history or rule (`categoryId` already on the candidate), then a keyword guess (marked as one), else none ("Not sure").
 */

const FILLER = new Set(['bank', 'payment', 'payments', 'pmt', 'a/c', 'ac', 'account', 'card', 'upi', 'debit', 'credit', 'transaction', 'txn', 'transfer', 'spent', 'purchase'])

/** "Bank payment", "HDFC Bank payment", "": a name that says nothing about who was paid. These always go to "Not sure". */
export function isGenericPayee(merchant: string, bank: string | null): boolean {
  const bankWords = new Set((bank ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
  const words = merchant.toLowerCase().split(/[^a-z0-9/]+/).filter((w) => w && !/^\d+$/.test(w))
  return words.every((w) => FILLER.has(w) || bankWords.has(w))
}

export interface CategoryPick {
  categoryId: string | null
  /** True when it came from the keyword guess, so the screen says "guess". Your own history or rule is plain. */
  guess: boolean
}

export function categoryFor(
  c: { merchant: string; categoryId: string | null; categoryGuessed?: boolean; bank: string | null; kind: string },
  /** A UPI payment to a person: a guess is never applied (the same person can be rent, a lunch split or a loan paid back). */
  person: boolean,
  categories: readonly { id: string; name: string; parentId?: string | null; deletedAt: number | null }[],
): CategoryPick {
  if (c.kind === 'cardBill' || isGenericPayee(c.merchant, c.bank)) return { categoryId: null, guess: false }
  if (c.categoryId !== null) {
    const guessed = c.categoryGuessed === true
    // A guess is never applied to a person, however it was reached: the same person can be rent, a lunch split or a loan paid back.
    if (guessed && person) return { categoryId: null, guess: false }
    return { categoryId: c.categoryId, guess: guessed }
  }
  if (person) return { categoryId: null, guess: false }
  const g = guessCategory(c.merchant, categories)
  return g ? { categoryId: g.categoryId, guess: true } : { categoryId: null, guess: false }
}
