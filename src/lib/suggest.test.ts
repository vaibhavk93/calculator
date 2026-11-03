import { describe, expect, it } from 'vitest'
import { suggestionFor } from './suggest'

describe('suggestionFor', () => {
  it('offers one chip for an EMI and for advance tax, none for a SIP', () => {
    expect(suggestionFor('emi', [])?.id).toBe('emi-monthly')
    expect(suggestionFor('advance-tax', [])?.id).toBe('advance-tax-pack')
    expect(suggestionFor('sip', [])).toBeNull()
  })
  it('never offers one again after it was dismissed', () => {
    expect(suggestionFor('emi', ['emi-monthly'])).toBeNull()
    expect(suggestionFor('advance-tax', ['emi-monthly'])?.id).toBe('advance-tax-pack')
  })
})
