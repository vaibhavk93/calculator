import { describe, expect, it } from 'vitest'
import { guessCategory, guessGroup } from './categoryGuess'
import { groupByCategoryThenPayee, payeeKey } from './groupItems'

const it_ = (id: string, merchant: string, amount: string) => ({ id, merchant, amount })

describe('payeeKey', () => {
  it('treats spelling variants of one payee as the same', () => {
    expect(payeeKey('AMAZON PAY INDIA')).toBe(payeeKey('Amazon Pay'))
    expect(payeeKey('Swiggy 1234')).toBe(payeeKey('SWIGGY'))
  })
  it('keeps different payees apart, including two different people', () => {
    expect(payeeKey('Rahul S')).not.toBe(payeeKey('Rahul K'))
    expect(payeeKey('Zomato')).not.toBe(payeeKey('Swiggy'))
  })
})

describe('groupByCategoryThenPayee', () => {
  const items = [
    it_('1', 'Swiggy', '450'), it_('2', 'SWIGGY', '300.50'), it_('3', 'Amazon Pay India', '1200'), it_('4', 'Mystery Co', '99'), it_('5', 'Zomato', '610'),
  ]
  const cat = (x: { id: string }) => ({ '1': 'food', '2': 'food', '3': 'shop', '4': null, '5': 'food' } as Record<string, string | null>)[x.id]!
  const g = groupByCategoryThenPayee(items, cat)

  it('puts "not sure" first, then categories by total', () => {
    expect(g.map((c) => c.categoryId)).toEqual([null, 'food', 'shop'])
  })
  it('clubs a repeating payee but never merges the payments', () => {
    const food = g.find((c) => c.categoryId === 'food')!
    const swiggy = food.payees.find((p) => payeeKey(p.label) === 'swiggy')!
    expect(swiggy.items.map((x) => x.id)).toEqual(['1', '2'])
    expect(swiggy.total.toString()).toBe('750.5')
    expect(food.count).toBe(3)
    expect(food.total.toString()).toBe('1360.5')
  })
  it('an empty list is empty, and a merchant-less item stays on its own', () => {
    expect(groupByCategoryThenPayee([], () => null)).toEqual([])
    const two = groupByCategoryThenPayee([it_('a', '', '1'), it_('b', '', '2')], () => null)
    expect(two[0]!.payees).toHaveLength(2)
  })
})

describe('guessCategory', () => {
  const cats = [
    { id: 'c1', name: 'Food & dining', deletedAt: null }, { id: 'c2', name: 'Shopping', deletedAt: null },
    { id: 'c3', name: 'Bills', deletedAt: null }, { id: 'c4', name: 'Travel', deletedAt: 1 },
  ]
  it('maps a merchant onto the user\'s own category by name', () => {
    expect(guessCategory('SWIGGY BANGALORE', cats)?.categoryId).toBe('c1')
    expect(guessCategory('Amazon Pay India', cats)?.categoryId).toBe('c2')
    expect(guessCategory('Airtel Postpaid', cats)?.categoryId).toBe('c3')
  })
  it('says nothing rather than invent: no keyword, or no matching category, or a deleted one', () => {
    expect(guessCategory('Incred Growth Bank', cats)).toBeNull()
    expect(guessCategory('Uber India', cats)).toBeNull()
  })
  it('short words match whole words only ("vi", "ola", "lic")', () => {
    expect(guessGroup('Vishal Mart')).toBeNull()
    expect(guessGroup('Olaf Cafe')).toBe('food')
    expect(guessGroup('VI Postpaid')).toBe('bills')
    expect(guessGroup('Ola Cabs')).toBe('travel')
  })
  it('always says it is a guess', () => {
    expect(guessCategory('Zomato', cats)!.why).toMatch(/guess/i)
  })
})
