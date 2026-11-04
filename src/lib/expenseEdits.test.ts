import { describe, expect, it } from 'vitest'
import { MAX_EDITS, editWords, expenseChanges, sanitizeEdits, withEdits, type ExpenseEdit } from './budget'

const AT = new Date(2026, 10, 2, 10).getTime() // 2 Nov 2026
const a = { amount: '900', date: '2026-10-28', categoryId: 'food' as string | null }

describe('edit history on an expense', () => {
  it('records only what really changed', () => {
    expect(expenseChanges(a, { ...a }, AT)).toEqual([])
    expect(expenseChanges(a, { ...a, amount: '900.00' }, AT)).toEqual([]) // same number
    expect(expenseChanges(a, { ...a, amount: '950' }, AT)).toEqual([{ at: AT, field: 'amount', from: '900', to: '950' }])
    const three = expenseChanges(a, { amount: '1', date: '2026-10-29', categoryId: null }, AT)
    expect(three.map((x) => x.field)).toEqual(['amount', 'date', 'category'])
  })
  it('keeps only the newest 10', () => {
    const one: ExpenseEdit = { at: 1, field: 'amount', from: '1', to: '2' }
    let trail: ExpenseEdit[] | undefined
    for (let i = 0; i < 15; i++) trail = withEdits(trail, [{ ...one, at: i }])
    expect(trail).toHaveLength(MAX_EDITS)
    expect(trail![0]!.at).toBe(5)
    expect(trail![9]!.at).toBe(14)
    expect(withEdits(undefined, [])).toBeUndefined()
  })
  it('says it in plain words', () => {
    const money = (p: string) => `₹${p}`
    const cat = (id: string | null) => (id === 'food' ? 'Food' : 'Uncategorised')
    // Day labels follow the device locale on purpose, so "2 Nov" here and "Nov 2" on a US-locale phone are
    // both right. Deriving the expected day the same way keeps this test about the SENTENCE, not the locale.
    const day = (y: number, m: number, d: number) => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d))
    const changed = day(2026, 11, 2)
    expect(editWords({ at: AT, field: 'amount', from: '900', to: '950' }, money, cat)).toBe(`Changed ${changed}: was ₹900`)
    expect(editWords({ at: AT, field: 'date', from: '2026-10-28', to: '2026-10-29' }, money, cat)).toBe(`Changed ${changed}: date was ${day(2026, 10, 28)}`)
    expect(editWords({ at: AT, field: 'category', from: 'food', to: null }, money, cat)).toBe(`Changed ${changed}: category was Food`)
  })
  it('loading drops damaged notes and caps the list', () => {
    expect(sanitizeEdits('x')).toBeUndefined()
    expect(sanitizeEdits([{ at: 'no', field: 'amount', from: '1', to: '2' }, { at: 1, field: 'note', from: 'a', to: 'b' }, null, { at: 1, field: 'amount', from: 5, to: '2' }])).toBeUndefined()
    const many = Array.from({ length: 30 }, (_, i) => ({ at: i + 1, field: 'amount', from: '1', to: '2' }))
    expect(sanitizeEdits(many)).toHaveLength(MAX_EDITS)
    expect(sanitizeEdits([{ at: 1, field: 'category', from: null, to: 'x' }])).toEqual([{ at: 1, field: 'category', from: null, to: 'x' }])
  })
})
