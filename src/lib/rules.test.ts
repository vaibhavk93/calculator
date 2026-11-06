import { describe, expect, it } from 'vitest'
import { cleanRuleMatch, ruleFor, ruleMatches, ruleTextFromMerchant, starterBudget, suggestFor, type BudgetData } from './budget'
import { buildCandidates, type InboxMessage } from './smsParse'
import { buildStatementCandidates } from './statementParse'

const base = (): BudgetData => starterBudget()
const food = 'starter-food'
const groceries = 'starter-groceries'
const withRules = (rules: BudgetData['rules']): BudgetData => ({ ...base(), rules })

describe('ruleMatches (whole words, any characters)', () => {
  it('ola does not hit Cola, but hits OLA CABS', () => {
    expect(ruleMatches('ola', 'Cola')).toBe(false)
    expect(ruleMatches('ola', 'OLA CABS')).toBe(true)
    expect(ruleMatches('ola', 'pistola')).toBe(false)
    expect(ruleMatches('ola', 'ola2')).toBe(false)
  })
  it('swiggy hits statement and UPI style text', () => {
    expect(ruleMatches('swiggy', 'SWIGGY*ORDER 123')).toBe(true)
    expect(ruleMatches('swiggy', 'UPI-Swiggy-xyz')).toBe(true)
    expect(ruleMatches('Swiggy', 'swiggy')).toBe(true)
    expect(ruleMatches('swiggy', 'swiggyfoods')).toBe(false)
  })
  it('regex characters never throw or match everything', () => {
    for (const m of ['a.b', 'swiggy(', '(.*)', '[abc', '\\d+', 'a|b', '^abc$', '***', 'a+b?', '{1,2}x']) {
      expect(() => ruleMatches(m, 'anything at all')).not.toThrow()
      expect(ruleMatches(m, 'anything at all')).toBe(false)
    }
    expect(ruleMatches('a.b', 'axb')).toBe(false)
    expect(ruleMatches('a.b', 'a.b store')).toBe(true)
    expect(ruleMatches('swiggy(', 'pay swiggy( now')).toBe(true)
    expect(ruleMatches('.*.', 'anything')).toBe(false)
  })
  it('works with non-English letters (a plain \\b would fail)', () => {
    expect(ruleMatches('चाय वाला', 'UPI चाय वाला 99')).toBe(true)
    expect(ruleMatches('café', 'Café Noir')).toBe(true)
    expect(ruleMatches('café', 'décafé')).toBe(false)
    expect(ruleMatches('cafe', 'Café')).toBe(false)
    expect(ruleMatches('ünï', 'Ünï store')).toBe(true)
  })
  it('too short never matches', () => {
    expect(ruleMatches('ab', 'ab cd')).toBe(false)
    expect(ruleMatches('', 'x')).toBe(false)
  })
})

describe('cleanRuleMatch', () => {
  it('rejects empty and short text in plain words', () => {
    for (const t of ['', '  ', 'ab', ' a ']) {
      const r = cleanRuleMatch(t)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(/at least 3 letters/)
    }
  })
  it('rejects punctuation only and over-long text', () => {
    expect(cleanRuleMatch('...').ok).toBe(false)
    expect(cleanRuleMatch('x'.repeat(41)).ok).toBe(false)
  })
  it('tidies spaces', () => {
    expect(cleanRuleMatch('  big   basket ')).toEqual({ ok: true, value: 'big basket' })
  })
})

describe('ruleFor (newest first, skips removed categories)', () => {
  it('newest rule wins', () => {
    const b = withRules([{ id: 'r2', match: 'swiggy', categoryId: groceries }, { id: 'r1', match: 'swiggy', categoryId: food }])
    expect(ruleFor(b, 'Swiggy')).toEqual({ categoryId: groceries, match: 'swiggy' })
  })
  it('a rule whose category is deleted is skipped and the next one applies', () => {
    const b = withRules([{ id: 'r2', match: 'swiggy', categoryId: groceries }, { id: 'r1', match: 'swig', categoryId: food }])
    b.categories = b.categories.map((c) => (c.id === groceries ? { ...c, deletedAt: 1 } : c))
    expect(ruleFor(b, 'Swiggy')).toBeNull()
    expect(ruleFor({ ...b, rules: [b.rules![0]!, { id: 'r3', match: 'swiggy', categoryId: food }] }, 'Swiggy')?.categoryId).toBe(food)
  })
  it('a subcategory of a deleted parent is skipped', () => {
    const b = withRules([{ id: 'r1', match: 'swiggy', categoryId: 'sub' }])
    b.categories = [...b.categories, { id: 'sub', name: 'Eating out', limit: null, parentId: food, deletedAt: null }]
    expect(ruleFor(b, 'swiggy')?.categoryId).toBe('sub')
    b.categories = b.categories.map((c) => (c.id === food ? { ...c, deletedAt: 1 } : c))
    expect(ruleFor(b, 'swiggy')).toBeNull()
  })
  it('never creates a category: a rule for an id that does not exist is ignored', () => {
    expect(ruleFor(withRules([{ id: 'r1', match: 'swiggy', categoryId: 'ghost' }]), 'swiggy')).toBeNull()
  })
  it('no rules is fine', () => expect(ruleFor(base(), 'swiggy')).toBeNull())
})

describe('ruleTextFromMerchant (privacy: only a short word)', () => {
  it('drops words with digits and keeps at most two words', () => {
    expect(ruleTextFromMerchant('Swiggy')).toBe('Swiggy')
    expect(ruleTextFromMerchant('Big Basket Foods Pvt')).toBe('Big Basket')
    expect(ruleTextFromMerchant('Amazon XX1234 99812')).toBe('Amazon')
    expect(ruleTextFromMerchant('Order 12345')).toBe('Order')
    expect(ruleTextFromMerchant('12345 98765')).toBeNull()
    expect(ruleTextFromMerchant('ab')).toBeNull()
    expect(ruleTextFromMerchant('')).toBeNull()
  })
})

describe('wiring: a rule changes the suggested category on import, with no parser change', () => {
  const rule = (b: BudgetData) => (note: string) => ruleFor(b, note) ?? suggestFor(b, note)

  it('statement: rule beats the built-in guess, others unchanged', () => {
    const b = withRules([{ id: 'r1', match: 'swiggy', categoryId: groceries }])
    const csv = 'Date,Narration,Debit\n01/11/2026,UPI/312345678901/SWIGGY/okhdfc,250.00\n02/11/2026,UPI/312345678902/ZOMATO/okhdfc,300.00\n'
    const r = buildStatementCandidates(csv, b, null, rule(b))
    if (!r.ok) throw new Error(r.message)
    const by = Object.fromEntries(r.result.found.map((c) => [c.merchant, c.categoryId]))
    expect(by.Swiggy).toBe(groceries) // built-in guess alone says Food
    expect(by.Zomato).toBe(food)
    const plain = buildStatementCandidates(csv, base(), null, (n) => suggestFor(base(), n))
    if (!plain.ok) throw new Error(plain.message)
    expect(plain.result.found.find((c) => c.merchant === 'Swiggy')!.categoryId).toBe(food)
  })

  it('sms: rule applies; credits and card bills get no category', () => {
    const b = withRules([{ id: 'r1', match: 'swiggy', categoryId: groceries }])
    const msg = (body: string, id: number): InboxMessage => ({ id: String(id), address: 'VM-HDFCBK', date: Date.UTC(2026, 10, 3), body })
    const r = buildCandidates(
      [
        msg('Rs.250.00 spent on HDFC Bank Card x1234 at SWIGGY on 03-11-26. Not you? Call 1800.', 1),
        msg('Rs.5000.00 credited to HDFC Bank A/c XX1234 on 03-11-26 by UPI from SWIGGY refund', 2),
      ],
      b,
      rule(b),
    )
    expect(r.found.find((c) => /swiggy/i.test(c.merchant))?.categoryId).toBe(groceries)
    expect(r.found.every((c) => c.kind !== 'spend' || c.categoryId !== null)).toBe(true)
  })
})
