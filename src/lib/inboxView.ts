import { categoryUsable, type BudgetData } from './budget'
import { guessCategory } from './categoryGuess'
import { groupByCategoryThenPayee, type CategoryGroup } from './groupItems'
import type { InboxItem } from './inbox'

/**
 * How the Inbox's "Waiting for you" list is laid out: sections by category ("Not sure" first), repeat payees clubbed inside a section.
 * Only a view: every payment stays its own item. Nothing here decides what may be added without a tap (that is inbox.ts autoAddCheck, which
 * needs a payee the person confirmed twice; a guess never counts).
 */

/** The category an item sits under, and whether it is only a keyword guess. A rule, a learned payee or the last entry for the name are not guesses. */
export function categoryFor(budget: BudgetData, item: Pick<InboxItem, 'categoryId' | 'why' | 'merchant'>): { categoryId: string | null; guess: boolean } {
  if (item.categoryId !== null && categoryUsable(budget, item.categoryId)) return { categoryId: item.categoryId, guess: item.why.startsWith('A guess') }
  const g = item.merchant ? guessCategory(item.merchant, budget.categories) : null
  return g ? { categoryId: g.categoryId, guess: true } : { categoryId: null, guess: false }
}

/**
 * Card bills and own money (an FD, a sweep, a transfer between your accounts) are not spending, so they have no category: they are listed
 * on their own. `own` is the person's own money moving: never in `sections`, so it cannot be approved as a spend by a category tap.
 */
export function reviewSections(budget: BudgetData, pending: readonly InboxItem[]): { sections: CategoryGroup<InboxItem>[]; cardBills: InboxItem[]; own: InboxItem[] } {
  const own = pending.filter((i) => i.nature === 'ownMoney' && i.kind === 'spend')
  const spends = pending.filter((i) => i.kind === 'spend' && i.nature !== 'ownMoney')
  return {
    sections: groupByCategoryThenPayee(spends, (i) => categoryFor(budget, i).categoryId),
    cardBills: pending.filter((i) => i.kind !== 'spend'),
    own,
  }
}
