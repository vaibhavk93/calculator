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
  it('has 7 to 9 groups of at least 2, with unique ids and names', () => {
    expect(GROUPS.length).toBeGreaterThanOrEqual(7)
    expect(GROUPS.length).toBeLessThanOrEqual(9)
    for (const g of GROUPS) expect(g.tools.length, g.id).toBeGreaterThanOrEqual(2)
    expect(new Set(GROUPS.map((g) => g.id)).size).toBe(GROUPS.length)
    expect(new Set(GROUPS.map((g) => g.name)).size).toBe(GROUPS.length)
  })
  it('finds the group of a tool', () => {
    expect(groupOfTool('gst')?.name).toBe('Money and shopping')
  })
})
