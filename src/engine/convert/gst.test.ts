import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { GST_PRESETS } from './gstRates'
import { gst } from './gst'

// Not externally verified against an official calculator (CBIC publishes the method, not a tool).
// Recomputed by a different route: 10,000 + 18% = 11,800, so removing 18% from 11,800 must give 10,000 back.
const g = (a: string, r: string, m: 'add' | 'remove', inter = false) => gst(new D(a), new D(r), m, inter)

describe('gst', () => {
  it('add, intra-state: CGST and SGST are halves', () => {
    const x = g('10000', '18', 'add')!
    expect([x.base, x.gst, x.cgst, x.sgst, x.total].map((v) => v!.toFixed())).toEqual(['10000', '1800', '900', '900', '11800'])
    expect(x.igst).toBeNull()
  })
  it('add, inter-state: all IGST', () => {
    const x = g('10000', '5', 'add', true)!
    expect([x.gst, x.igst, x.total].map((v) => v!.toFixed())).toEqual(['500', '500', '10500'])
    expect(x.cgst).toBeNull()
  })
  it('remove gives the base back', () => {
    const x = g('11800', '18', 'remove')!
    expect([x.base.toFixed(), x.gst.toFixed(), x.total.toFixed()]).toEqual(['10000', '1800', '11800'])
  })
  it('remove with a repeating base keeps the parts adding up to the total', () => {
    const x = g('100', '40', 'remove')!
    expect(x.base.plus(x.gst).toDecimalPlaces(10).toFixed()).toBe('100')
  })
  it('0% and custom rates', () => {
    expect(g('250', '0', 'add')!.total.toFixed()).toBe('250')
    expect(g('1000', '12', 'add')!.total.toFixed()).toBe('1120')
  })
  it('negative input is null', () => {
    expect(g('-1', '18', 'add')).toBeNull()
    expect(g('1', '-18', 'add')).toBeNull()
  })
  it('presets are the current slabs only: no 12 or 28', () => {
    expect(GST_PRESETS.map((p) => p.value)).toEqual(['0', '5', '18', '40'])
  })
})
