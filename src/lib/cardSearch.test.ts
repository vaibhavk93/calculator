import { describe, expect, it } from 'vitest'
import { matchesCard } from './cardSearch'
import type { SavedCard } from './memory'

const card = { title: 'HDFC card', note: 'incl. flight booking', summary: 'Total ₹57,650', tags: ['Credit Card'], amount: '57650', lines: [{ id: 'l', label: 'Flights', value: '24000' }] } as SavedCard

describe('matchesCard', () => {
  it('matches title, note, tag, summary and tape label, ignoring case', () => {
    for (const q of ['hdfc', 'FLIGHT BOOKING', 'credit', 'total', 'flights']) expect(matchesCard(card, q), q).toBe(true)
  })
  it('matches an amount typed with commas or the rupee sign', () => {
    for (const q of ['57650', '57,650', '₹57,650', '24000']) expect(matchesCard(card, q), q).toBe(true)
  })
  it('does not match unrelated text, and an empty query matches everything', () => {
    expect(matchesCard(card, 'sbi')).toBe(false)
    expect(matchesCard(card, '99999')).toBe(false)
    expect(matchesCard(card, '  ')).toBe(true)
  })
})
