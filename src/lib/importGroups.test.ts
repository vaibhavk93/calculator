import { describe, expect, it } from 'vitest'
import { categoryFor, isGenericPayee } from './importGroups'

const cats = [
  { id: 'f', name: 'Food', parentId: null, deletedAt: null },
  { id: 's', name: 'Shopping', parentId: null, deletedAt: null },
]
const c = (merchant: string, o: Partial<{ categoryId: string | null; categoryGuessed: boolean; bank: string | null; kind: string }> = {}) => ({ merchant, categoryId: null, bank: 'HDFC Bank', kind: 'spend', ...o })

describe('isGenericPayee', () => {
  it('says nothing-about-who names are generic', () => {
    for (const m of ['', 'Bank payment', 'HDFC Bank payment', 'HDFC BANK PAYMENT 4521', 'UPI payment']) expect(isGenericPayee(m, 'HDFC Bank')).toBe(true)
  })
  it('a real name is not generic, even with the word payment in it', () => {
    for (const m of ['Swiggy', 'Amazon Pay', 'Payment Gateway Cafe', 'Ravi Kumar']) expect(isGenericPayee(m, 'HDFC Bank')).toBe(false)
  })
})

describe('categoryFor', () => {
  it('your own category wins and is not a guess', () => expect(categoryFor(c('Swiggy', { categoryId: 's' }), false, cats)).toEqual({ categoryId: 's', guess: false }))
  it('a keyword guess lands on your own category and says guess', () => expect(categoryFor(c('Swiggy'), false, cats)).toEqual({ categoryId: 'f', guess: true }))
  it('nothing fits: not sure', () => expect(categoryFor(c('Mystery Traders'), false, cats)).toEqual({ categoryId: null, guess: false }))
  it('a generic name is always not sure, even with a category on it', () => expect(categoryFor(c('HDFC Bank payment', { categoryId: 'f' }), false, cats)).toEqual({ categoryId: null, guess: false }))
  it('a payment to a person is never guessed', () => expect(categoryFor(c('Swiggy'), true, cats)).toEqual({ categoryId: null, guess: false }))
  it('a person with your own category keeps it', () => expect(categoryFor(c('Ravi', { categoryId: 'f' }), true, cats)).toEqual({ categoryId: 'f', guess: false }))
  // The scan pipeline itself pre-fills a keyword guess (smsParse/statementParse `catFields`). It must still read as a guess here.
  it('a category the pipeline only guessed says guess', () => expect(categoryFor(c('Amazon Pay India', { categoryId: 's', categoryGuessed: true }), false, cats)).toEqual({ categoryId: 's', guess: true }))
  it('a pipeline guess is dropped for a person, like any other guess', () => expect(categoryFor(c('Ravi Kumar', { categoryId: 'f', categoryGuessed: true }), true, cats)).toEqual({ categoryId: null, guess: false }))
  it('a card bill has no category', () => expect(categoryFor(c('HDFC card', { kind: 'cardBill', categoryId: 'f' }), false, cats)).toEqual({ categoryId: null, guess: false }))
})
