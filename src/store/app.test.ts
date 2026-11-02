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
    expect(Object.keys(snap).sort()).toEqual(['cards', 'history', 'input', 'memory', 'reminders', 'schemaVersion', 'settings'])
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
