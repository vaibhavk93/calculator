import { describe, expect, it } from 'vitest'
import { historyShareText } from '../lib/historyText'
import { buildBackup, parseBackup } from './backup'
import { capHistory, defaultPersisted, migrate, sanitizeHistory, CURRENT_SCHEMA } from './persistence'
import { createAppStore } from './app'
import { MAX_HISTORY, MAX_LOCKED, type HistoryEntry } from './types'
import type { Key } from '../engine'

let n = 0
const deps = () => ({ now: () => 1_700_000_000_000, newId: () => `h-${++n}` })
function make(history: HistoryEntry[] = []) {
  const store = createAppStore({ ...defaultPersisted(), history }, deps())
  const get = () => store.getState()
  const calc = (...keys: Key[]) => keys.forEach((k) => get().press(k))
  return { get, calc }
}
const row = (id: string, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({ id, expression: '1+1', result: '2', at: 1, ...extra })

describe('history lock', () => {
  it('Clear all keeps locked rows, and Undo brings the rest back', () => {
    const { get } = make([row('a', { locked: true }), row('b'), row('c')])
    get().clearHistory()
    expect(get().history.map((h) => h.id)).toEqual(['a'])
    get().undoRemoval()
    expect(get().history.map((h) => h.id)).toEqual(['a', 'b', 'c'])
  })

  it('the cap evicts unlocked rows only, even when the locked one is the oldest', () => {
    const { get, calc } = make([row('old', { locked: true })])
    for (let i = 0; i < MAX_HISTORY + 5; i++) calc('clear', '1', '+', String((i % 9) + 1) as Key, '=')
    expect(get().history).toHaveLength(MAX_HISTORY)
    expect(get().history.some((h) => h.id === 'old' && h.locked)).toBe(true)
  })

  it('capHistory and loading keep every locked row past the cap', () => {
    const many = Array.from({ length: MAX_HISTORY + 10 }, (_, i) => row(`r${i}`, i >= MAX_HISTORY ? { locked: true } : {}))
    const capped = capHistory(many, MAX_HISTORY)
    expect(capped).toHaveLength(MAX_HISTORY)
    expect(capped.filter((h) => h.locked)).toHaveLength(10)
    expect(sanitizeHistory(many).filter((h) => h.locked)).toHaveLength(10)
  })

  it('a locked row cannot be deleted until unlocked', () => {
    const { get } = make([row('a', { locked: true })])
    get().deleteHistory('a')
    expect(get().history).toHaveLength(1)
    expect(get().notice?.text).toBe('Unlock it first to delete it.')
    get().setHistoryLocked('a', false)
    get().deleteHistory('a')
    expect(get().history).toHaveLength(0)
  })

  it('stops at the lock limit with a plain message', () => {
    const rows = Array.from({ length: MAX_LOCKED + 1 }, (_, i) => row(`r${i}`, i < MAX_LOCKED ? { locked: true } : {}))
    const { get } = make(rows)
    get().setHistoryLocked(`r${MAX_LOCKED}`, true)
    expect(get().history[MAX_LOCKED]!.locked).toBeFalsy()
    expect(get().notice?.text).toBe('Unlock one to lock another.')
  })
})

describe('history: edit expression', () => {
  it('re-evaluates, keeping the id and time', () => {
    const { get } = make([row('a')])
    expect(get().editHistoryExpression('a', '12*3')).toBeNull()
    expect(get().history[0]).toMatchObject({ id: 'a', at: 1, expression: '12*3', result: '36' })
  })
  it('rejects a bad expression in plain words and changes nothing', () => {
    const { get } = make([row('a')])
    expect(get().editHistoryExpression('a', '1/0')).toBe("Can't divide by zero")
    expect(get().editHistoryExpression('a', '2+*')).toBe('Check the expression')
    expect(get().editHistoryExpression('a', '   ')).toBe('Type an expression')
    expect(get().editHistoryExpression('a', '<b>')).toBe('Check the expression')
    expect(get().history[0]).toMatchObject({ expression: '1+1', result: '2' })
  })
})

describe('history: share text, legacy data, backup', () => {
  it('shares "expression = result"', () => {
    expect(historyShareText({ expression: '1500*12', result: '18000' }, { system: 'indian', decimals: 'auto' })).toBe('1,500 × 12 = 18,000')
  })
  it('legacy rows (no locked field) load unlocked; junk lock values are dropped', () => {
    const out = sanitizeHistory([row('a'), row('b', { locked: 'yes' as unknown as boolean }), row('c', { locked: true })])
    expect(out.map((h) => h.locked)).toEqual([undefined, undefined, true])
    expect(migrate({ schemaVersion: CURRENT_SCHEMA, history: [row('a')] }).history).toHaveLength(1)
  })
  it('lock survives a backup round trip', () => {
    const data = { ...defaultPersisted(), history: [row('a', { locked: true, memo: 'Rent' }), row('b')] }
    const r = parseBackup(buildBackup(data))
    expect(r.ok && r.data.history).toEqual(data.history)
  })
})
