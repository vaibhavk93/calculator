import { describe, expect, it } from 'vitest'
import { DEFAULT_TAGS, mergeTags } from './memory'

describe('mergeTags', () => {
  it('shows the starter tags while the user has fewer than 3 of their own', () => {
    expect(mergeTags([], [], DEFAULT_TAGS)).toEqual([...DEFAULT_TAGS])
    expect(mergeTags(['Car', 'Pets'], [], ['Loan', 'Rent'])).toEqual(['Car', 'Pets', 'Loan', 'Rent'])
  })
  it('hides the starter tags once the user has 3 of their own', () => {
    expect(mergeTags(['Car', 'Pets', 'Gym'], [], DEFAULT_TAGS)).toEqual(['Car', 'Gym', 'Pets'])
  })
  it('counts an own tag that differs from another only by case once', () => {
    // "Car" and "car" are one tag, so the user has 2 and the starters still show.
    expect(mergeTags(['Car', 'car', 'Pets'], [], ['Loan'])).toEqual(['Car', 'Pets', 'Loan'])
  })
  it('merges "Loan" and "loan" into one chip, the user\'s own spelling first', () => {
    expect(mergeTags(['loan'], [], DEFAULT_TAGS).filter((t) => t.toLowerCase() === 'loan')).toEqual(['loan'])
    expect(mergeTags([], ['LOAN'], DEFAULT_TAGS).filter((t) => t.toLowerCase() === 'loan')).toEqual(['Loan'])
  })
  it('keeps a tag picked now even when it is neither own nor a starter, at the end', () => {
    expect(mergeTags(['Car', 'Pets', 'Gym'], ['Brand new'], DEFAULT_TAGS)).toEqual(['Car', 'Gym', 'Pets', 'Brand new'])
  })
  it('works with no starters (the task and note sheets)', () => {
    expect(mergeTags(['b', 'a', 'B'], ['c'])).toEqual(['a', 'b', 'c'])
  })
})
