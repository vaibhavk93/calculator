import { describe, expect, it } from 'vitest'
import { matchesCard, matchSnippet } from './cardSearch'
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

const note = { title: 'Wifi', kind: 'text', note: 'The router password is on the sticker under the TV, ask Amit if it changed', summary: 'The router password is on the sticker', tags: ['Home'], amount: null, lines: [] } as unknown as SavedCard

describe('matchesCard, inside a note body', () => {
  it('finds a word that is only in the body, ignoring case', () => {
    expect(matchesCard(note, 'AMIT')).toBe(true)
    expect(matchesCard(note, 'sticker under')).toBe(true)
  })
  it('several words match in any order, and every one must be there', () => {
    expect(matchesCard(note, 'tv router')).toBe(true)
    expect(matchesCard(note, 'wifi amit')).toBe(true)
    expect(matchesCard(note, 'router fridge')).toBe(false)
  })
  it('finds a word on a list line when it is not in the title, and combines it with the title', () => {
    expect(matchesCard(card, 'hdfc flights')).toBe(true)
    expect(matchesCard(card, 'flights sbi')).toBe(false)
  })
  it('a word and an amount together still match', () => {
    expect(matchesCard(card, 'hdfc 24,000')).toBe(true)
    expect(matchesCard(card, 'hdfc 99999')).toBe(false)
  })
})

describe('matchSnippet', () => {
  it('shows the words around a match that is only in the body', () => {
    expect(matchSnippet(note, 'amit')).toBe('…under the TV, ask Amit if it changed')
  })
  it('has nothing to add when there is no query, or the row already shows the match', () => {
    expect(matchSnippet(note, '')).toBeNull()
    expect(matchSnippet(note, 'wifi')).toBeNull()
    expect(matchSnippet(note, 'home')).toBeNull()
    expect(matchSnippet(note, 'router')).toBeNull() // already in the summary line
  })
  it('names the list line that matched', () => {
    expect(matchSnippet(card, 'flights')).toBe('Flights')
  })
  it('uses the first word of a several-word search that the row does not show', () => {
    expect(matchSnippet(note, 'wifi changed')).toBe('…the TV, ask Amit if it changed')
  })
  it('cuts a long body on both sides at word edges, marked with … and kept to one line', () => {
    const long = { ...note, note: `${'alpha beta gamma '.repeat(12)}\n\nneedle in the middle\n${'delta epsilon zeta '.repeat(12)}` } as SavedCard
    const hit = matchSnippet(long, 'needle') as string
    expect(hit.startsWith('…')).toBe(true)
    expect(hit.endsWith('…')).toBe(true)
    expect(hit).toContain('needle in the middle')
    expect(hit).not.toMatch(/\n/)
    expect(hit.length).toBeLessThanOrEqual(80)
  })
  it('is null when nothing matches', () => {
    expect(matchSnippet(note, 'zebra')).toBeNull()
  })
})
