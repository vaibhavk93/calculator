import { describe, expect, it } from 'vitest'
import { createAppStore } from './app'
import { defaultPersisted } from './persistence'
import { DEFAULT_SETTINGS, MAX_HISTORY, type PersistedData } from './types'
import type { Key } from '../engine'

let n = 0
const deps = () => ({ now: () => 1_700_000_000_000, newId: () => `id-${++n}` })

function make(overrides: Partial<PersistedData> = {}) {
  const store = createAppStore({ ...defaultPersisted(), ...overrides }, deps())
  const press = (...keys: Key[]) => keys.forEach((k) => store.getState().press(k))
  return { store, press, get: () => store.getState() }
}

describe('typing and equals', () => {
  it('computes and records to history', () => {
    const { press, get } = make()
    press('1', '8', '4', '5', '0', '+', '7', '2', '0', '0', '=')
    expect(get().input).toEqual({ expr: '25650', fresh: true })
    expect(get().history).toHaveLength(1)
    expect(get().history[0]).toMatchObject({ expression: '18450+7200', result: '25650' })
  })
  it('newest history entry comes first', () => {
    const { press, get } = make()
    press('1', '+', '1', '=', 'clear', '2', '+', '2', '=')
    expect(get().history.map((h) => h.result)).toEqual(['4', '2'])
  })
  it('respects "keep the calculation record" being off', () => {
    const { press, get, store } = make()
    store.getState().updateSettings({ keepHistory: false })
    press('1', '+', '1', '=')
    expect(get().input.expr).toBe('2')
    expect(get().history).toHaveLength(0)
  })
  it('a division by zero surfaces as a notice and leaves the input', () => {
    const { press, get } = make()
    press('5', '/', '0', '=')
    expect(get().notice?.text).toBe("Can't divide by zero")
    expect(get().input.expr).toBe('5/0')
    expect(get().history).toHaveLength(0)
  })
  it('the notice clears on the next successful key', () => {
    const { press, get } = make()
    press('5', '/', '0', '=', 'backspace')
    expect(get().notice).toBeNull()
  })
  it('uses the angle setting', () => {
    const { press, get, store } = make()
    press('sin', '3', '0', '()', '=')
    expect(get().input.expr).toBe('0.5')
    press('clear')
    store.getState().updateSettings({ angle: 'rad' })
    press('sin', '0', '()', '=')
    expect(get().input.expr).toBe('0')
  })
  it('history is capped', () => {
    const { store, get } = make()
    for (let i = 0; i < MAX_HISTORY + 20; i++) {
      store.getState().press('clear')
      for (const k of String(i + 1).split('') as Key[]) store.getState().press(k)
      store.getState().press('+')
      store.getState().press('1')
      store.getState().press('=')
    }
    expect(get().history).toHaveLength(MAX_HISTORY)
  })
})

describe('the line above the result', () => {
  it('remembers what "=" evaluated, and forgets it once you edit', () => {
    const { press, get } = make()
    press('2', '+', '3', '=')
    expect(get().lastExpression).toBe('2+3')
    press('*')
    expect(get().lastExpression).toBeNull()
  })
  it('an ignored key does not wipe it', () => {
    const { press, get } = make()
    press('2', '+', '3', '=')
    press(')')
    expect(get().lastExpression).toBe('2+3')
  })
  it('a bare number records nothing to show', () => {
    const { press, get } = make()
    press('7', '=')
    expect(get().lastExpression).toBeNull()
  })
  it('errors carry the error tone, info notices do not', () => {
    const { press, get } = make()
    press('5', '/', '0', '=')
    expect(get().notice?.tone).toBe('error')
    get().memoryRecall()
    expect(get().notice?.tone).toBe('info')
  })
})

describe('undo', () => {
  it('steps back through edits', () => {
    const { press, get } = make()
    press('1', '2', '3')
    get().undoInput()
    expect(get().input.expr).toBe('12')
    get().undoInput()
    expect(get().input.expr).toBe('1')
  })
  it('undoes "=" and brings the expression back', () => {
    const { press, get } = make()
    press('2', '+', '3', '=')
    get().undoInput()
    expect(get().input).toEqual({ expr: '2+3', fresh: false })
  })
  it('undoes a clear: nothing is ever lost', () => {
    const { press, get } = make()
    press('9', '9', 'clear')
    expect(get().input.expr).toBe('')
    get().undoInput()
    expect(get().input.expr).toBe('99')
  })
  it('ignored keys add nothing to the undo stack', () => {
    const { press, get } = make()
    press('+', '*', '%')
    expect(get().undoStack).toHaveLength(0)
  })
  it('undo with nothing to undo is a no-op', () => {
    const { get } = make()
    expect(() => get().undoInput()).not.toThrow()
  })
})

describe('memory', () => {
  it('M+ adds the live value, M- subtracts, MR recalls, MC clears', () => {
    const { press, get } = make()
    press('5', '0')
    get().memoryAdd(1)
    expect(get().memory).toBe('50')
    press('clear', '8')
    get().memoryAdd(-1)
    expect(get().memory).toBe('42')
    press('clear')
    get().memoryRecall()
    expect(get().input.expr).toBe('42')
    get().memoryClear()
    expect(get().memory).toBeNull()
  })
  it('M+ works on a half-typed expression via the live preview', () => {
    const { press, get } = make()
    press('2', '*', '()', '3')
    get().memoryAdd(1)
    expect(get().memory).toBe('6')
  })
  it('recall on empty memory says so rather than inserting zero', () => {
    const { get } = make()
    get().memoryRecall()
    expect(get().notice?.text).toBe('Memory is empty')
    expect(get().input.expr).toBe('')
  })
  it('M+ with nothing to add says so', () => {
    const { get } = make()
    get().memoryAdd(1)
    expect(get().memory).toBeNull()
    expect(get().notice?.text).toBe('Nothing to add to memory')
  })
  it('memory keeps exact decimals', () => {
    const { press, get } = make()
    press('0', '.', '1')
    get().memoryAdd(1)
    press('clear', '0', '.', '2')
    get().memoryAdd(1)
    expect(get().memory).toBe('0.3')
  })
})

describe('history: reuse, delete, undo', () => {
  function withTwo() {
    const m = make()
    m.press('1', '+', '1', '=', 'clear', '2', '*', '3', '=', 'clear')
    return m
  }
  it('reuses an expression for editing', () => {
    const { get } = withTwo()
    const id = get().history[1]!.id // 1+1
    get().setOverlay('history')
    get().reuseExpression(id)
    expect(get().input).toEqual({ expr: '1+1', fresh: false })
    expect(get().overlay).toBe('none')
  })
  it('reuses a result as a number', () => {
    const { press, get } = withTwo()
    press('5', '+')
    get().reuseResult(get().history[0]!.id) // 6
    expect(get().input.expr).toBe('5+6')
  })
  it('deleting offers undo, and undo puts it back in the same place', () => {
    const { get } = withTwo()
    const [first, second] = get().history
    get().deleteHistory(first!.id)
    expect(get().history).toEqual([second])
    expect(get().snack?.canUndo).toBe(true)
    get().undoRemoval()
    expect(get().history).toEqual([first, second])
    expect(get().snack).toBeNull()
  })
  it('clearing everything is also undoable, order intact', () => {
    const { get } = withTwo()
    const before = get().history
    get().clearHistory()
    expect(get().history).toEqual([])
    get().undoRemoval()
    expect(get().history).toEqual(before)
  })
  it('the snackbar timing out forgets the undo', () => {
    const { get } = withTwo()
    get().deleteHistory(get().history[0]!.id)
    get().dismissSnack(get().snack!.id)
    get().undoRemoval()
    expect(get().history).toHaveLength(1)
  })
  it('a stale dismiss from an older snackbar does not kill a newer one', () => {
    const { get } = withTwo()
    get().deleteHistory(get().history[0]!.id)
    const staleId = get().snack!.id
    get().deleteHistory(get().history[0]!.id)
    get().dismissSnack(staleId)
    expect(get().snack).not.toBeNull()
  })
  it('clearing an already-empty history does not raise a pointless snackbar', () => {
    const { get } = make()
    get().clearHistory()
    expect(get().snack).toBeNull()
  })
  it('unknown ids are ignored', () => {
    const { get } = withTwo()
    expect(() => {
      get().deleteHistory('nope')
      get().reuseExpression('nope')
      get().reuseResult('nope')
    }).not.toThrow()
    expect(get().history).toHaveLength(2)
  })
})

describe('history: naming a calculation', () => {
  function withTwo() {
    const m = make()
    m.press('1', '+', '1', '=', 'clear', '2', '*', '3', '=', 'clear')
    return m
  }

  it('sets a name', () => {
    const { get } = withTwo()
    const id = get().history[0]!.id
    get().renameHistory(id, 'Rent split')
    expect(get().history.find((h) => h.id === id)?.memo).toBe('Rent split')
  })

  it('trims and caps a name at 80 characters', () => {
    const { get } = withTwo()
    const id = get().history[0]!.id
    get().renameHistory(id, `  ${'x'.repeat(100)}  `)
    expect(get().history.find((h) => h.id === id)?.memo).toHaveLength(80)
  })

  it('an empty name clears it', () => {
    const { get } = withTwo()
    const id = get().history[0]!.id
    get().renameHistory(id, 'temp')
    get().renameHistory(id, '   ')
    expect(get().history.find((h) => h.id === id)?.memo).toBeUndefined()
  })

  it('a named row survives Clear all; an unnamed one does not', () => {
    const { get } = withTwo()
    const oldestId = get().history[1]!.id
    get().renameHistory(oldestId, 'Keep me')
    const named = get().history.find((h) => h.id === oldestId)
    get().clearHistory()
    expect(get().history).toEqual([named])
    expect(get().snack?.text).toBe('Cleared 1 calculations')
  })

  it('Clear all is unavailable once every row is named (there is nothing to clear)', () => {
    const { get } = withTwo()
    for (const h of get().history) get().renameHistory(h.id, 'kept')
    get().clearHistory()
    expect(get().history).toHaveLength(2)
    expect(get().snack).toBeNull()
  })

  it('the 200-row cap evicts the oldest unnamed row, never a named one', () => {
    const { press, get } = make()
    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const
    press('1', '+', '1', '=')
    const first = get().history[0]!.id
    get().renameHistory(first, 'Do not lose me')
    for (let i = 0; i < MAX_HISTORY; i++) {
      press('clear', digits[i % 9]!, '+', '1', '=')
    }
    expect(get().history).toHaveLength(MAX_HISTORY)
    expect(get().history.some((h) => h.id === first)).toBe(true)
    expect(get().history.find((h) => h.id === first)?.memo).toBe('Do not lose me')
  })

  it('deleting a named row directly still works (naming only blocks bulk removal)', () => {
    const { get } = withTwo()
    const id = get().history[0]!.id
    get().renameHistory(id, 'temp')
    get().deleteHistory(id)
    expect(get().history.find((h) => h.id === id)).toBeUndefined()
  })

  it('unknown ids are ignored', () => {
    const { get } = withTwo()
    expect(() => get().renameHistory('nope', 'x')).not.toThrow()
    expect(get().history.every((h) => h.memo === undefined)).toBe(true)
  })
})

describe('settings', () => {
  it('applies a patch and keeps the rest', () => {
    const { get } = make()
    get().updateSettings({ theme: 'light', decimals: 3 })
    expect(get().settings).toEqual({ ...DEFAULT_SETTINGS, theme: 'light', decimals: 3 })
  })
  it('refuses an invalid value rather than storing it', () => {
    const { get } = make()
    get().updateSettings({ decimals: 50 as never })
    expect(get().settings.decimals).toBe('auto')
  })
  it('opens on the startup tab', () => {
    const { get } = make({ settings: { ...DEFAULT_SETTINGS, startupTab: 'saved' } })
    expect(get().tab).toBe('saved')
  })
})

describe('navigation', () => {
  it('switching tab closes any overlay', () => {
    const { get } = make()
    get().setOverlay('settings')
    get().setTab('tools')
    expect(get().overlay).toBe('none')
    expect(get().tab).toBe('tools')
  })
  it('tapping an open panel closes it', () => {
    const { get } = make()
    get().setPanel('scientific')
    expect(get().panel).toBe('scientific')
    get().setPanel('scientific')
    expect(get().panel).toBe('none')
  })
  it('opening one panel replaces the other', () => {
    const { get } = make()
    get().setPanel('more')
    get().setPanel('scientific')
    expect(get().panel).toBe('scientific')
  })
})

describe('snapshot and restore', () => {
  it('snapshot captures exactly what should persist', () => {
    const { press, get } = make()
    press('7', '+', '1', '=')
    get().memoryAdd(1)
    const snap = get().snapshot()
    expect(Object.keys(snap).sort()).toEqual(['budget', 'cards', 'history', 'input', 'memory', 'reminders', 'schemaVersion', 'settings'])
    expect(snap.history).toHaveLength(1)
  })
  it('restore replaces state and clears transient things', () => {
    const a = make()
    a.press('1', '+', '1', '=')
    const snap = a.get().snapshot()

    const b = make()
    b.press('9', '9')
    b.get().deleteHistory('x')
    b.get().restore(snap)
    expect(b.get().history).toEqual(snap.history)
    expect(b.get().input).toEqual(snap.input)
    expect(b.get().undoStack).toEqual([])
    expect(b.get().snack).toBeNull()
  })
})

describe('budget', () => {
  const draft = (over = {}) => ({ amount: '1,250.50', categoryId: null, date: '2026-11-02', note: ' tea ', ...over })
  it('records an expense with a clean amount and note', () => {
    const { get } = make()
    expect(get().addExpense(draft())).toBe(true)
    expect(get().budget.expenses[0]).toMatchObject({ amount: '1250.5', date: '2026-11-02', note: 'tea', deletedAt: null })
  })
  it('keeps a known payment mode and drops an unknown one', () => {
    const { get } = make()
    get().addExpense(draft({ mode: 'upi' }))
    get().addExpense(draft({ mode: 'bitcoin' }))
    get().addExpense(draft())
    expect(get().budget.expenses.map((e) => e.mode)).toEqual([null, null, 'upi'])
    get().updateExpense(get().budget.expenses[0]!.id, draft({ mode: 'cash' }))
    expect(get().budget.expenses[0]!.mode).toBe('cash')
  })
  it('refuses zero, blank and unreadable amounts with a plain message', () => {
    const { get } = make()
    for (const amount of ['', '0', 'abc', '-5']) expect(get().addExpense(draft({ amount }))).toBe(false)
    expect(get().notice?.text).toBe('Enter an amount above zero')
    expect(get().budget.expenses).toHaveLength(0)
  })
  it('refuses a bad date', () => {
    const { get } = make()
    expect(get().addExpense(draft({ date: '02/11/2026' }))).toBe(false)
  })
  it('a category that does not exist becomes Uncategorised', () => {
    const { get } = make()
    get().addExpense(draft({ categoryId: 'ghost' }))
    expect(get().budget.expenses[0]!.categoryId).toBeNull()
  })
  it('delete can be undone', () => {
    const { get } = make()
    get().addExpense(draft())
    const id = get().budget.expenses[0]!.id
    get().deleteExpense(id)
    expect(get().budget.expenses[0]!.deletedAt).not.toBeNull()
    expect(get().snack?.canUndo).toBe(true)
    get().undoRemoval()
    expect(get().budget.expenses[0]!.deletedAt).toBeNull()
  })
  it('deleting a category keeps its entries', () => {
    const { get } = make()
    const cat = get().budget.categories[0]!.id
    get().addExpense(draft({ categoryId: cat }))
    get().deleteCategory(cat)
    expect(get().budget.expenses).toHaveLength(1)
    expect(get().budget.categories.find((c) => c.id === cat)!.deletedAt).not.toBeNull()
  })
  it('a limit must be a positive number, otherwise it is cleared', () => {
    const { get } = make()
    const cat = get().budget.categories[0]!.id
    get().setCategoryLimit(cat, '4,000')
    expect(get().budget.categories[0]!.limit).toBe('4000')
    get().setCategoryLimit(cat, '0')
    expect(get().budget.categories[0]!.limit).toBeNull()
  })
  it('adding a category twice gives the same one', () => {
    const { get } = make()
    const a = get().addCategory('Pets')
    expect(get().addCategory(' pets ')).toBe(a)
  })

  describe('subcategories', () => {
    it('adds a subcategory under a top-level one, refuses a child or missing parent', () => {
      const { get } = make()
      const food = get().budget.categories[0]!.id
      const sub = get().addCategory('Swiggy', food)!
      expect(get().budget.categories.find((c) => c.id === sub)).toMatchObject({ parentId: food, name: 'Swiggy', limit: null })
      expect(get().addCategory('Deeper', sub)).toBeNull()
      expect(get().addCategory('Orphan', 'ghost')).toBeNull()
      expect(get().budget.categories.some((c) => c.name === 'Deeper' || c.name === 'Orphan')).toBe(false)
    })
    it('a duplicate name is per parent, ignoring case', () => {
      const { get } = make()
      const [a, b] = [get().budget.categories[0]!.id, get().budget.categories[1]!.id]
      const x = get().addCategory('Snacks', a)
      expect(get().addCategory(' snacks ', a)).toBe(x)
      expect(get().addCategory('Snacks', b)).not.toBe(x)
      expect(get().addCategory('Snacks')).not.toBe(x) // top level is its own scope
    })
    it('a subcategory has its own limit and does not touch its parent', () => {
      const { get } = make()
      const food = get().budget.categories[0]!.id
      const sub = get().addCategory('Swiggy', food)!
      get().setCategoryLimit(sub, '1,000')
      expect(get().budget.categories.find((c) => c.id === sub)!.limit).toBe('1000')
      expect(get().budget.categories.find((c) => c.id === food)!.limit).toBeNull()
    })
    it('deleting a parent deletes its children; entries stay and become uncategorised', () => {
      const { get } = make()
      const food = get().budget.categories[0]!.id
      const other = get().budget.categories[1]!.id
      const sub = get().addCategory('Swiggy', food)!
      get().addExpense({ ...draft(), categoryId: sub })
      get().deleteCategory(food)
      const cats = get().budget.categories
      expect(cats.find((c) => c.id === food)!.deletedAt).not.toBeNull()
      expect(cats.find((c) => c.id === sub)!.deletedAt).not.toBeNull()
      expect(cats.find((c) => c.id === other)!.deletedAt).toBeNull()
      expect(get().budget.expenses).toHaveLength(1)
      expect(get().addCategory('New', food)).toBeNull() // a deleted parent cannot take children
    })
    it('an expense can be filed under a subcategory', () => {
      const { get } = make()
      const sub = get().addCategory('Swiggy', get().budget.categories[0]!.id)!
      get().addExpense({ ...draft(), categoryId: sub })
      expect(get().budget.expenses[0]!.categoryId).toBe(sub)
    })
  })

  describe('instruments', () => {
    const neo = { name: 'Tata Neo', kind: 'credit', network: 'rupay', bank: 'Tata', last4: '4321', rewardNote: '5% on Tata Neu' } as const
    it('adds an instrument, and a duplicate name of the same kind returns the existing one', () => {
      const { get } = make()
      const id = get().addInstrument(neo)!
      expect(get().budget.instruments[0]).toMatchObject({ id, name: 'Tata Neo', kind: 'credit', network: 'rupay', last4: '4321', deletedAt: null })
      expect(get().addInstrument({ ...neo, name: ' tata neo ' })).toBe(id)
      expect(get().budget.instruments).toHaveLength(1)
      // same name, other kind, is a different thing
      expect(get().addInstrument({ name: 'Tata Neo', kind: 'debit' })).not.toBe(id)
    })
    it('refuses a blank name and bad last4 with a plain message', () => {
      const { get } = make()
      expect(get().addInstrument({ name: ' ', kind: 'bank' })).toBeNull()
      expect(get().notice?.text).toBe('Give it a name')
      expect(get().addInstrument({ name: 'HDFC', kind: 'bank', last4: '12' })).toBeNull()
      expect(get().notice?.text).toBe('Last 4 digits must be exactly 4 numbers')
      expect(get().budget.instruments).toHaveLength(0)
    })
    it('caps live instruments at 40; a deleted one frees a slot', () => {
      const { get } = make()
      for (let i = 0; i < 40; i++) expect(get().addInstrument({ name: `W${i}`, kind: 'wallet' })).not.toBeNull()
      expect(get().addInstrument({ name: 'One more', kind: 'wallet' })).toBeNull()
      expect(get().notice?.text).toMatch(/up to 40/)
      get().deleteInstrument(get().budget.instruments[0]!.id)
      expect(get().addInstrument({ name: 'One more', kind: 'wallet' })).not.toBeNull()
    })
    it('accepts valid mode and instrument pairs', () => {
      const { get } = make()
      const rupay = get().addInstrument(neo)!
      const bank = get().addInstrument({ name: 'HDFC Savings', kind: 'bank' })!
      const wallet = get().addInstrument({ name: 'Amazon Pay', kind: 'wallet' })!
      for (const [mode, instrumentId] of [['credit', rupay], ['upi', rupay], ['upi', bank], ['upi', wallet], ['netbanking', bank], ['wallet', wallet], ['cash', null]] as const) {
        expect(get().addExpense({ ...draft(), mode, instrumentId })).toBe(true)
      }
      expect(get().budget.expenses[0]!.instrumentId).toBeNull()
      expect(get().budget.expenses[1]).toMatchObject({ mode: 'wallet', instrumentId: wallet })
    })
    it('rejects UPI from a Visa credit card, with the reason', () => {
      const { get } = make()
      const visa = get().addInstrument({ name: 'Visa card', kind: 'credit', network: 'visa' })!
      expect(get().addExpense({ ...draft(), mode: 'upi', instrumentId: visa })).toBe(false)
      expect(get().notice?.text).toBe('Pick a RuPay credit card, a bank account, a debit card or a wallet for UPI')
      expect(get().budget.expenses).toHaveLength(0)
    })
    it('rejects the other wrong pairs, and an instrument with no mode, on add and on update', () => {
      const { get } = make()
      const cc = get().addInstrument({ name: 'Swiggy HDFC', kind: 'credit', network: 'mastercard' })!
      const wallet = get().addInstrument({ name: 'Amazon Pay', kind: 'wallet' })!
      expect(get().addExpense({ ...draft(), mode: 'debit', instrumentId: cc })).toBe(false)
      expect(get().addExpense({ ...draft(), mode: 'cash', instrumentId: wallet })).toBe(false)
      expect(get().addExpense({ ...draft(), mode: 'credit', instrumentId: wallet })).toBe(false)
      expect(get().addExpense({ ...draft(), mode: null, instrumentId: cc })).toBe(false)
      expect(get().addExpense({ ...draft(), mode: 'credit', instrumentId: 'ghost' })).toBe(false)
      get().addExpense({ ...draft(), mode: 'credit', instrumentId: cc })
      const id = get().budget.expenses[0]!.id
      expect(get().updateExpense(id, { ...draft(), mode: 'wallet', instrumentId: cc })).toBe(false)
      expect(get().budget.expenses[0]).toMatchObject({ mode: 'credit', instrumentId: cc })
      expect(get().updateExpense(id, { ...draft(), mode: 'cash' })).toBe(true)
      expect(get().budget.expenses[0]).toMatchObject({ mode: 'cash', instrumentId: null })
    })
    it('deleting an instrument keeps the entries and their mode but drops the link', () => {
      const { get } = make()
      const cc = get().addInstrument(neo)!
      get().addExpense({ ...draft(), mode: 'credit', instrumentId: cc })
      get().deleteInstrument(cc)
      expect(get().budget.instruments[0]!.deletedAt).not.toBeNull()
      expect(get().budget.expenses[0]).toMatchObject({ mode: 'credit', instrumentId: null })
      // and it can no longer be picked
      expect(get().addExpense({ ...draft(), mode: 'credit', instrumentId: cc })).toBe(false)
    })
    it('updateInstrument edits fields; a change that breaks an old pairing clears it from the entry', () => {
      const { get } = make()
      const cc = get().addInstrument(neo)!
      get().addExpense({ ...draft(), mode: 'upi', instrumentId: cc })
      expect(get().updateInstrument(cc, { rewardNote: '  new  ', last4: '9999' })).toBe(true)
      expect(get().budget.instruments[0]).toMatchObject({ rewardNote: 'new', last4: '9999', name: 'Tata Neo' })
      expect(get().budget.expenses[0]!.instrumentId).toBe(cc)
      expect(get().updateInstrument(cc, { network: 'visa' })).toBe(true) // no longer UPI-able
      expect(get().budget.expenses[0]).toMatchObject({ mode: 'upi', instrumentId: null })
      expect(get().updateInstrument(cc, { last4: 'x' })).toBe(false)
      expect(get().updateInstrument('ghost', { name: 'x' })).toBe(false)
    })
    it('a rename onto another instrument of the same kind is refused', () => {
      const { get } = make()
      get().addInstrument({ name: 'A', kind: 'wallet' })
      const b = get().addInstrument({ name: 'B', kind: 'wallet' })!
      expect(get().updateInstrument(b, { name: 'a' })).toBe(false)
      expect(get().notice?.text).toBe('You already have one with that name')
    })
  })
})

describe('editing inside the expression', () => {
  it('typing at the cursor goes there and keeps the cursor', () => {
    const { get, press } = make()
    press('1', '2', '3', '4')
    get().setSelection(2, 2)
    press('9')
    expect(get().input.expr).toBe('12934')
    expect(get().selection).toMatchObject({ start: 3, end: 3 })
  })
  it('a cursor at the very end is "no cursor"', () => {
    const { get, press } = make()
    press('1', '2')
    get().setSelection(2, 2)
    expect(get().selection).toBeNull()
  })
  it('a cursor stops applying once the input changes some other way', () => {
    const { get, press } = make()
    press('1', '+', '2')
    get().setSelection(1, 1)
    get().undoInput()
    press('9')
    expect(get().input.expr).toBe('1+9')
  })
  it('after = the expression can be brought back and edited', () => {
    const { get, press } = make()
    press('5', '+', '3', '=')
    get().editLast(1, 1)
    expect(get().input).toEqual({ expr: '5+3', fresh: false })
    press('*')
    expect(get().input.expr).toBe('5*3')
  })
})
