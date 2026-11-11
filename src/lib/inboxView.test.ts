import { describe, expect, it } from 'vitest'
import type { BudgetData } from './budget'
import { autoAddCheck, type InboxItem } from './inbox'
import { categoryFor, reviewSections } from './inboxView'

const cat = (id: string, name: string) => ({ id, name, limit: null, parentId: null, deletedAt: null })
const budget: BudgetData = { overall: null, categories: [cat('c-food', 'Food'), cat('c-shop', 'Shopping')], instruments: [], expenses: [] }
let n = 0
const item = (merchant: string, amount: string, o: Partial<InboxItem> = {}): InboxItem => ({ id: `i${++n}`, date: '2026-11-15', amount, merchant, kind: 'spend', mode: 'upi', instrumentId: 'i-card', last4: null, bank: null, categoryId: null, why: '', person: false, status: 'pending', at: 1, ...o })

describe('categoryFor', () => {
  it('keeps a learned category and says it is not a guess', () => {
    expect(categoryFor(budget, item('Swiggy', '1', { categoryId: 'c-food', why: 'You tagged Swiggy as Food twice' }))).toEqual({ categoryId: 'c-food', guess: false })
  })
  it('marks the parser guess as a guess', () => {
    expect(categoryFor(budget, item('Swiggy', '1', { categoryId: 'c-food', why: 'A guess from the name. Check it' })).guess).toBe(true)
  })
  it('guesses from the name onto the persons own categories', () => {
    expect(categoryFor(budget, item('Amazon Pay', '1'))).toEqual({ categoryId: 'c-shop', guess: true })
  })
  it('says nothing for an unclear name', () => {
    expect(categoryFor(budget, item('XYZ Traders', '1'))).toEqual({ categoryId: null, guess: false })
  })
})

describe('reviewSections', () => {
  it('puts Not sure first, clubs repeat payees, keeps every payment, and sets card bills apart', () => {
    const items = [item('Amazon Pay', '100'), item('Amazon Pay', '200'), item('XYZ Traders', '50'), item('Swiggy', '700'), item('HDFC card', '5000', { kind: 'cardBill' })]
    const { sections, cardBills } = reviewSections(budget, items)
    expect(sections.map((s) => s.categoryId)).toEqual([null, 'c-food', 'c-shop'])
    const shop = sections[2]!
    expect(shop.count).toBe(2)
    expect(shop.payees).toHaveLength(1)
    expect(shop.payees[0]!.items.map((i) => i.amount)).toEqual(['100', '200'])
    expect(shop.total.toString()).toBe('300')
    expect(cardBills).toHaveLength(1)
  })
})

describe('a guess never makes a payment eligible to be added by itself', () => {
  it('needs the learned payee, not a category guess', () => {
    const it1 = item('Swiggy', '450', { categoryId: 'c-food', why: 'A guess from the name. Check it' })
    expect(autoAddCheck(budget, it1, false, 1).ok).toBe(false)
  })
})
