import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../lib/storage'
import { MAX_RULES, ruleFor, starterBudget } from '../lib/budget'
import { buildBackup, parseBackup } from './backup'
import { bootStore } from './boot'
import { createAppStore } from './app'
import { CURRENT_SCHEMA, STORAGE_KEY, defaultPersisted, loadPersisted, sanitizeBudget } from './persistence'

let n = 0
const make = () => {
  const store = createAppStore(defaultPersisted(), { now: () => 1_700_000_000_000, newId: () => `rl-${++n}` })
  return { store, get: () => store.getState() }
}
const FOOD = 'starter-food'
const GRO = 'starter-groceries'

describe('rule actions', () => {
  it('adds newest first, and the same text replaces instead of duplicating', () => {
    const { get } = make()
    expect(get().addRule('Swiggy', FOOD)).toBe(true)
    expect(get().addRule('big basket', GRO)).toBe(true)
    expect(get().budget.rules!.map((r) => r.match)).toEqual(['big basket', 'Swiggy'])
    expect(get().addRule('SWIGGY', GRO)).toBe(true)
    const r = get().budget.rules!
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ match: 'Swiggy', categoryId: GRO })
  })
  it('refuses short text, a missing category and the 101st rule, in words', () => {
    const { get } = make()
    expect(get().addRule('ab', FOOD)).toBe(false)
    expect(get().notice?.text).toMatch(/at least 3 letters/)
    expect(get().addRule('swiggy', 'ghost')).toBe(false)
    expect(get().notice?.text).toBe('Pick a category from the list')
    for (let i = 0; i < MAX_RULES; i++) expect(get().addRule(`shop${i}x`, FOOD)).toBe(true)
    expect(get().addRule('onemore', FOOD)).toBe(false)
    expect(get().notice?.text).toMatch(/up to 100 rules/)
    expect(get().addRule('shop5x', GRO)).toBe(true) // replacing is allowed at the cap
    expect(get().budget.rules).toHaveLength(MAX_RULES)
  })
  it('a rule never creates a category', () => {
    const { get } = make()
    const before = get().budget.categories.length
    get().addRule('swiggy', 'ghost')
    expect(get().budget.categories).toHaveLength(before)
    expect(get().budget.rules).toBeUndefined()
  })
  it('delete is undoable and puts the rule back in the same place', () => {
    const { get } = make()
    for (const m of ['aaa1', 'bbb2', 'ccc3']) get().addRule(m, FOOD)
    const mid = get().budget.rules![1]!
    get().deleteRule(mid.id)
    expect(get().budget.rules!.map((r) => r.match)).toEqual(['ccc3', 'aaa1'])
    expect(get().snack?.canUndo).toBe(true)
    get().undoRemoval()
    expect(get().budget.rules!.map((r) => r.match)).toEqual(['ccc3', 'bbb2', 'aaa1'])
  })
  it('deleting a category keeps its rules (skipped, flagged), and they work again if the category returns', () => {
    const { get } = make()
    get().addRule('swiggy', GRO)
    get().deleteCategory(GRO)
    expect(get().budget.rules).toHaveLength(1)
    expect(ruleFor(get().budget, 'swiggy')).toBeNull()
    // the category is only soft-deleted, so a restore (backup, undo) brings the rule back
    const b = get().budget
    expect(ruleFor({ ...b, categories: b.categories.map((c) => (c.id === GRO ? { ...c, deletedAt: null } : c)) }, 'swiggy')?.categoryId).toBe(GRO)
  })
  it('renaming a category keeps the rule (rules store the id)', () => {
    const { get } = make()
    get().addRule('swiggy', FOOD)
    get().renameCategory(FOOD, 'Eating')
    expect(ruleFor(get().budget, 'swiggy')?.categoryId).toBe(FOOD)
  })
})

describe('rules survive saving, reload and backup', () => {
  const rules = [
    { id: 'a', match: 'swiggy', categoryId: FOOD },
    { id: 'b', match: 'चाय वाला', categoryId: GRO },
  ]
  it('reload keeps rules', async () => {
    const storage = createMemoryStorage()
    const d = defaultPersisted()
    d.budget = { ...d.budget, rules }
    await storage.set(STORAGE_KEY, JSON.stringify({ ...d, schemaVersion: CURRENT_SCHEMA }))
    expect((await loadPersisted(storage)).budget.rules).toEqual(rules)
  })
  it('the store persists rules through boot', async () => {
    const storage = createMemoryStorage()
    const { store } = await bootStore(storage)
    store.getState().addRule('swiggy', FOOD)
    await new Promise((r) => setTimeout(r, 700))
    expect((await loadPersisted(storage)).budget.rules?.[0]).toMatchObject({ match: 'swiggy', categoryId: FOOD })
  })
  it('backup round trip', () => {
    const d = defaultPersisted()
    d.budget = { ...d.budget, rules }
    const p = parseBackup(buildBackup(d))
    if (!p.ok) throw new Error(p.message)
    expect(p.data.budget.rules).toEqual(rules)
  })
  it('an old file with no rules loads with none', () => {
    expect(sanitizeBudget(starterBudget()).rules).toBeUndefined()
  })
})

describe('sanitise: junk rules', () => {
  const b = (rules: unknown) => sanitizeBudget({ ...starterBudget(), rules }).rules
  it('drops junk, short, unknown-category, repeated and not-an-array', () => {
    expect(b('nope')).toBeUndefined()
    expect(b([null, 5, 'x', [], { id: 1 }, { id: 'a' }, { id: 'a', match: 'abc' }, { id: 'a', match: 5, categoryId: FOOD }, { id: 'a', match: 'ab', categoryId: FOOD }, { id: 'a', match: '...', categoryId: FOOD }])).toBeUndefined()
    expect(b([{ id: 'a', match: 'swiggy', categoryId: 'never-existed' }])).toBeUndefined()
    expect(b([{ id: 'a', match: 'swiggy', categoryId: FOOD }, { id: 'a', match: 'zomato', categoryId: FOOD }, { id: 'c', match: ' SWIGGY ', categoryId: GRO }])).toEqual([{ id: 'a', match: 'swiggy', categoryId: FOOD }])
  })
  it('keeps a rule whose category exists but is deleted', () => {
    const raw = { ...starterBudget(), categories: starterBudget().categories.map((c) => (c.id === FOOD ? { ...c, deletedAt: 5 } : c)), rules: [{ id: 'a', match: 'swiggy', categoryId: FOOD }] }
    expect(sanitizeBudget(raw).rules).toHaveLength(1)
  })
  it('caps the count and the text length, and cleans spaces', () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ id: `r${i}`, match: `shop${i}x`, categoryId: FOOD }))
    expect(b(many)).toHaveLength(MAX_RULES)
    expect(b([{ id: 'a', match: `  big   ${'x'.repeat(80)}`, categoryId: FOOD }])![0]!.match.length).toBeLessThanOrEqual(40)
    expect(b([{ id: 'a', match: ' big   basket ', categoryId: FOOD }])![0]!.match).toBe('big basket')
  })
  it('hostile keys and extra fields never leak through', () => {
    const r = b([{ id: 'a', match: 'swiggy', categoryId: FOOD, instrumentId: 'x', amount: '9', body: 'secret SMS text' }])!
    expect(Object.keys(r[0]!).sort()).toEqual(['categoryId', 'id', 'match'])
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
