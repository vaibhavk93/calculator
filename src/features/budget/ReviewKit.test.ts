import { describe, expect, it } from 'vitest'
import { groupIsOpen, isOwnMoney, mergedOf, ownWhyOf } from './ReviewKit'

describe('review list helpers', () => {
  it('a payee group opens by itself at 2 payments and starts closed from 3; a tap flips it', () => {
    expect(groupIsOpen(2, false)).toBe(true)
    expect(groupIsOpen(3, false)).toBe(false)
    expect(groupIsOpen(2, true)).toBe(false)
    expect(groupIsOpen(5, true)).toBe(true)
  })

  it('reads the reader\'s optional fields defensively', () => {
    expect(mergedOf({})).toBe(0)
    expect(mergedOf({ mergedFrom: 1 })).toBe(0)
    expect(mergedOf({ mergedFrom: 2 })).toBe(2)
    expect(isOwnMoney({})).toBe(false)
    expect(isOwnMoney({ nature: 'ownMoney' })).toBe(true)
    expect(ownWhyOf({ nature: 'spend', ownWhy: 'x' })).toBe('')
    expect(ownWhyOf({ nature: 'ownMoney', ownWhy: 'FD closed' })).toBe('FD closed')
  })
})
