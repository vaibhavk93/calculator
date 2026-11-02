import { describe, expect, it } from 'vitest'
import { GROUPS, groupOfTool } from './groups'
import { ALL_TOOLS } from './registry'

describe('tool groups', () => {
  const ids = ALL_TOOLS.map((t) => t.id)
  const listed = GROUPS.flatMap((g) => g.tools)

  it('puts every calculator in exactly one group', () => {
    for (const id of ids) expect(listed.filter((x) => x === id), id).toHaveLength(1)
  })
  it('names only calculators that exist', () => {
    expect(listed.filter((x) => !ids.includes(x))).toEqual([])
  })
  it('has exactly 8 groups of at least 2, with unique ids and names, one section colour each', () => {
    expect(GROUPS).toHaveLength(8)
    expect(GROUPS.map((g) => g.tint).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    for (const g of GROUPS) expect(g.tools.length, g.id).toBeGreaterThanOrEqual(2)
    expect(new Set(GROUPS.map((g) => g.id)).size).toBe(GROUPS.length)
    expect(new Set(GROUPS.map((g) => g.name)).size).toBe(GROUPS.length)
  })
  it('finds the group of a tool', () => {
    expect(groupOfTool('gst')?.name).toBe('Money and shopping')
  })
  it('sorts by what the person is doing: currency is money, binary and hex are numbers, units are measuring', () => {
    expect(groupOfTool('currency')?.id).toBe('money')
    expect(groupOfTool('number-base')?.id).toBe('math')
    expect(groupOfTool('unit-converter')?.id).toBe('units')
  })
  it('every section has a title and at least one calculator, and no group is one giant unbroken list', () => {
    for (const g of GROUPS) {
      for (const s of g.sections) {
        expect(s.title.trim(), g.id).not.toBe('')
        expect(s.tools.length, `${g.id}/${s.title}`).toBeGreaterThanOrEqual(1)
      }
      // A group of more than 6 calculators must be split into sections, or it reads as a wall.
      if (g.tools.length > 6) expect(g.sections.length, g.id).toBeGreaterThanOrEqual(3)
    }
  })
})
