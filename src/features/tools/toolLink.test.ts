import { describe, expect, it } from 'vitest'
import { D } from '../../engine'
import { ALL_TOOLS } from './registry'
import { linkable, linkTargets, linkText } from '../../lib/toolLink'

describe('linkable', () => {
  it('offers the headline number', () => {
    const r = linkable({ rows: [{ label: 'EMI', value: new D('1234.567'), fmt: 'money', main: true }] })
    expect(r?.fmt).toBe('money')
    expect(r && linkText(r.value, r.fmt)).toBe('1234.57')
  })
  it('refuses text, negatives and a missing number', () => {
    expect(linkable({ rows: [{ label: 'Age', value: '5 years', fmt: 'text', main: true }] })).toBeNull()
    expect(linkable({ rows: [{ label: 'Loss', value: new D(-3), fmt: 'money', main: true }] })).toBeNull()
    expect(linkable({ rows: [] })).toBeNull()
  })
  it('keeps counts as whole numbers and other numbers to 4 places', () => {
    expect(linkText(new D('12.7'), 'int')).toBe('13')
    expect(linkText(new D('1.123456'), 'number')).toBe('1.1235')
  })
})

describe('linkTargets', () => {
  it('sends money only to rupee boxes, never to the tool it came from', () => {
    const t = linkTargets(ALL_TOOLS, 'emi', 'money')
    expect(t.length).toBeGreaterThan(3)
    expect(t.find((x) => x.toolId === 'emi')).toBeUndefined()
    for (const x of t) {
      const spec = ALL_TOOLS.find((s) => s.id === x.toolId)!
      for (const f of x.fields) {
        const field = spec.fields.find((g) => g.id === f.id)!
        expect(field.kind).toBe('number')
        expect(f.unit).toBe('rupee')
      }
    }
  })
  it('lists every rupee box of a tool so the person can choose', () => {
    const tip = linkTargets(ALL_TOOLS, 'emi', 'money').find((x) => x.toolId === 'tip')
    expect(tip?.fields.map((f) => f.id)).toEqual(['bill'])
    const it = linkTargets(ALL_TOOLS, 'emi', 'money').find((x) => x.toolId === 'income-tax')
    expect(it!.fields.length).toBeGreaterThan(1)
  })
  it('sends percent only to percent boxes', () => {
    for (const x of linkTargets(ALL_TOOLS, 'x', 'percent')) for (const f of x.fields) expect(f.unit).toBe('percent')
  })
  it('never offers select, date, text or row fields', () => {
    for (const fmt of ['money', 'percent', 'number', 'int'] as const)
      for (const x of linkTargets(ALL_TOOLS, 'x', fmt)) {
        const spec = ALL_TOOLS.find((s) => s.id === x.toolId)!
        for (const f of x.fields) expect(spec.fields.find((g) => g.id === f.id)!.kind).toBe('number')
      }
  })
})
