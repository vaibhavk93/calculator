import { describe, expect, it } from 'vitest'
import { D } from '../../engine'
import { ALL_TOOLS } from './registry'
import { linkable, linkTargets, linkText } from '../../lib/toolLink'
import { defaultValues, isError, type ToolSpec } from '../../lib/tool'

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

describe('durations keep their unit', () => {
  const dur = (timeUnit: 'years' | 'months' | 'days') => ({ rows: [{ label: 'x', value: new D('18'), fmt: 'number' as const, timeUnit, main: true }] })
  const boxes = (fmt: 'number' | 'int', unit?: 'years' | 'months' | 'days') =>
    linkTargets(ALL_TOOLS, 'x', fmt, unit).flatMap((t) => t.fields.map((f) => ({ at: `${t.toolId}.${f.id}`, f })))
  const takes = (f: { unit?: string; units?: string[] }, u: string) => (f.units ? f.units.includes(u) : f.unit === u)

  it('linkable carries the row unit, and none for a plain number', () => {
    expect(linkable(dur('months'))?.unit).toBe('months')
    expect(linkable({ rows: [{ label: 'BMI', value: new D(24), fmt: 'number', main: true }] })?.unit).toBeUndefined()
  })
  it('a months result is never offered to a years-only box', () => {
    for (const { at, f } of boxes('number', 'months')) expect(takes(f, 'months'), at).toBe(true)
  })
  it('a days result is offered only to a field whose units have days', () => {
    for (const { at, f } of boxes('int', 'days')) expect(takes(f, 'days'), at).toBe(true)
  })
  it('a result with no unit goes only to unit-less boxes', () => {
    const all = boxes('number')
    expect(all.length).toBeGreaterThan(0)
    for (const { at, f } of all) expect([undefined, 'none'], at).toContain(f.unit)
  })
  it('a box with a unit switch is offered a result only when the switch has that unit (synthetic spec)', () => {
    const spec = { id: 't', title: 'T', blurb: '', category: 'everyday', keywords: [], compute: () => ({ rows: [] }), fields: [{ id: 'n', label: 'N', kind: 'number', unit: 'years', units: ['years', 'months'] }] } as unknown as ToolSpec
    const ids = (u?: 'years' | 'months' | 'days') => linkTargets([spec], 'x', 'number', u).flatMap((t) => t.fields.map((f) => f.id))
    expect([ids('months'), ids('years'), ids('days'), ids()]).toEqual([['n'], ['n'], [], []])
  })
  it('every duration headline that can link is tagged with its unit', () => {
    const tagged = { swp: ['Months it lasts', 'months'], 'cac-payback': ['Payback period (months)', 'months'], date: ['Days apart', 'days'] }
    for (const [id, [label, unit]] of Object.entries(tagged)) {
      const spec = ALL_TOOLS.find((s) => s.id === id)!
      const out = spec.compute(defaultValues(spec))
      const l = isError(out) ? null : linkable(out)
      expect([l?.label, l?.unit], id).toEqual([label, unit])
    }
  })
})
