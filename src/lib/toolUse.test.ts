import { describe, expect, it } from 'vitest'
import { bumpUse, MAX_COUNTED_TOOLS, MAX_USE_COUNT, MAX_PINNED_TOOLS, togglePinned, yourTools } from './toolUse'

const all = () => true

describe('tool use counts', () => {
  it('adds one per open and stops at the cap', () => {
    expect(bumpUse({}, 'emi')).toEqual({ emi: 1 })
    expect(bumpUse({ emi: 1 }, 'emi')).toEqual({ emi: 2 })
    expect(bumpUse({ emi: MAX_USE_COUNT }, 'emi')).toEqual({ emi: MAX_USE_COUNT })
  })
  it('keeps the table small by dropping the least used other tool', () => {
    const big: Record<string, number> = {}
    for (let i = 0; i < MAX_COUNTED_TOOLS; i++) big[`t${i}`] = i + 2
    const next = bumpUse(big, 'new')
    expect(Object.keys(next)).toHaveLength(MAX_COUNTED_TOOLS)
    expect(next.new).toBe(1)
    expect('t0' in next).toBe(false)
  })
})

describe('your tools', () => {
  it('ignores a tool opened only once', () => expect(yourTools({ emi: 1 }, [], all)).toEqual([]))
  it('orders by how often each was opened', () => expect(yourTools({ a: 2, b: 9, c: 4 }, [], all)).toEqual(['b', 'c', 'a']))
  it('keeps a pinned tool first whatever the counts say', () => expect(yourTools({ a: 2, b: 9 }, ['a'], all)).toEqual(['a', 'b']))
  it('lists a pinned tool even with no opens, and never twice', () => expect(yourTools({ a: 9 }, ['a', 'z'], all)).toEqual(['a', 'z']))
  it('drops ids that are no longer tools', () => expect(yourTools({ a: 5, gone: 9 }, ['old'], (id) => id === 'a')).toEqual(['a']))
  it('shows at most 5 counted tools but never hides a pin', () => {
    const counts = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((k, i) => [k, 20 - i]))
    expect(yourTools(counts, [], all)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(yourTools(counts, ['g'], all)).toEqual(['g', 'a', 'b', 'c', 'd'])
  })
})

describe('pinning', () => {
  it('pins, unpins and refuses past the limit', () => {
    expect(togglePinned([], 'a')).toEqual(['a'])
    expect(togglePinned(['a', 'b'], 'a')).toEqual(['b'])
    const full = Array.from({ length: MAX_PINNED_TOOLS }, (_, i) => `p${i}`)
    expect(togglePinned(full, 'x')).toBeNull()
    expect(togglePinned(full, 'p0')).toHaveLength(MAX_PINNED_TOOLS - 1)
  })
})
