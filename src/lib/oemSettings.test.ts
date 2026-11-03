import { describe, expect, it } from 'vitest'
import { OEM_GUIDES, oemBrand, openNote } from './oemSettings'

describe('oemBrand', () => {
  it.each([
    ['Xiaomi', 'Redmi', 'xiaomi'],
    ['Xiaomi', 'POCO', 'xiaomi'],
    ['OnePlus', 'OnePlus', 'oneplus'],
    ['OPPO', 'OPPO', 'oppo'],
    ['realme', 'realme', 'oppo'],
    ['vivo', 'vivo', 'vivo'],
    ['vivo', 'iQOO', 'vivo'],
    ['samsung', 'samsung', 'samsung'],
    ['HUAWEI', 'HONOR', 'huawei'],
    ['Google', 'google', 'other'],
    ['', '', 'other'],
  ])('%s %s is %s', (maker, brand, want) => {
    expect(oemBrand(maker, brand)).toBe(want)
  })
  it('matches on the brand when the maker name is generic', () => {
    expect(oemBrand('unknown', 'POCO')).toBe('xiaomi')
  })
})

describe('guides', () => {
  it('every brand has a name and plain steps, and the first step tells the person to tap Open settings', () => {
    for (const g of Object.values(OEM_GUIDES)) {
      expect(g.name.length).toBeGreaterThan(3)
      expect(g.steps.length).toBeGreaterThanOrEqual(2)
      expect(g.steps[0]).toMatch(/Open settings/)
    }
  })
})

describe('openNote', () => {
  it('stays quiet when the maker page opened, and explains every fallback in words', () => {
    expect(openNote('maker')).toBeNull()
    for (const o of ['battery', 'app', 'none', 'unsupported'] as const) expect(openNote(o)).toMatch(/\w/)
  })
})
