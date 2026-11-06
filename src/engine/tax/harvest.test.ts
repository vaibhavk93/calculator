import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { harvestLtcg, type Holding } from './harvest'

const h = (name: string, buy: string, cost: string, value: string, fmv: string | null = null): Holding => ({
  name, buyDate: buy, cost: new D(cost), value: new D(value), fmv2018: fmv === null ? null : new D(fmv),
})
const n = (x: { toString(): string }) => Number(x.toString())
const NOW = '2026-11-06'
const ok = (hs: Holding[], booked = '0', sell = NOW) => {
  const r = harvestLtcg(hs, { sellDate: sell, booked: new D(booked) })
  if ('error' in r) throw new Error(r.error)
  return r
}

describe('LTCG harvesting', () => {
  it('fills the Rs 1,25,000 exemption: 60,000 + 65,000 across two long-term holdings', () => {
    const r = ok([h('A', '2024-01-10', '100000', '160000'), h('B', '2025-01-01', '200000', '300000')])
    expect(n(r.headroom)).toBe(125000)
    expect(n(r.longTermAvailable)).toBe(160000)
    expect(n(r.toBook)).toBe(125000)
    expect(n(r.leftOver)).toBe(35000)
    expect(n(r.holdings[0]!.planGain)).toBe(60000)
    expect(n(r.holdings[0]!.planSell)).toBe(160000) // all of A
    expect(n(r.holdings[1]!.planGain)).toBe(65000)
    expect(n(r.holdings[1]!.planSell)).toBe(195000) // 65% of B's 3,00,000
    // 12.5% of 1,25,000 = 15,625; with 4% cess 16,250
    expect(n(r.taxSaved)).toBe(15625)
    expect(n(r.taxSavedWithCess)).toBe(16250)
  })

  it('already-booked gains shrink the headroom; a net loss widens it; over the limit leaves nothing', () => {
    const hs = [h('A', '2024-01-10', '100000', '300000')]
    expect(n(ok(hs, '50000').headroom)).toBe(75000)
    expect(n(ok(hs, '50000').toBook)).toBe(75000)
    expect(n(ok(hs, '-30000').headroom)).toBe(155000) // losses are set off first
    expect(n(ok(hs, '125000').headroom)).toBe(0)
    expect(n(ok(hs, '200000').headroom)).toBe(0)
    expect(n(ok(hs, '200000').taxSaved)).toBe(0)
  })

  it('long-term needs MORE than 12 months: exactly 12 months is still short-term', () => {
    const a = ok([h('A', '2025-11-06', '100000', '200000')]) // sold 6 Nov 2026: exactly 12 months
    expect(a.holdings[0]!.term).toBe('short')
    expect(a.holdings[0]!.longTermFrom).toBe('2026-11-07')
    expect(n(a.toBook)).toBe(0) // short-term gains are never part of the plan
    const b = ok([h('A', '2025-11-05', '100000', '200000')])
    expect(b.holdings[0]!.term).toBe('long')
  })

  it('grandfathering (s.90(7)-(8)): cost is the higher of cost and the lower of (31 Jan 2018 value, sale value)', () => {
    // Bought 2017, cost 1,00,000, worth 1,50,000 on 31 Jan 2018, sold for 1,80,000: cost used 1,50,000, gain 30,000.
    const a = ok([h('A', '2017-06-01', '100000', '180000', '150000')]).holdings[0]!
    expect(a.grandfathered).toBe(true)
    expect(n(a.costUsed)).toBe(150000)
    expect(n(a.gain)).toBe(30000)
    // Sold below the 2018 value: the lower of the two is the sale value, so no gain and no loss.
    const b = ok([h('A', '2017-06-01', '100000', '140000', '150000')]).holdings[0]!
    expect(n(b.costUsed)).toBe(140000)
    expect(n(b.gain)).toBe(0)
    // Real cost above the 2018 value: the real cost wins.
    const c = ok([h('A', '2017-06-01', '160000', '180000', '150000')]).holdings[0]!
    expect(n(c.costUsed)).toBe(160000)
    expect(n(c.gain)).toBe(20000)
  })

  it('a pre-2018 holding with no 31 Jan 2018 value is refused, not guessed', () => {
    const r = harvestLtcg([h('Old fund', '2017-06-01', '100000', '180000')], { sellDate: NOW, booked: new D(0) })
    expect(r).toEqual({ error: 'Old fund: bought before 1 Feb 2018, so enter its value on 31 Jan 2018' })
    // 1 Feb 2018 itself is not grandfathered.
    expect('error' in harvestLtcg([h('X', '2018-02-01', '100', '200')], { sellDate: NOW, booked: new D(0) })).toBe(false)
  })

  it('partial sale is proportional, also for a grandfathered holding', () => {
    // Gain 30,000 on value 1,80,000. Headroom 15,000 (booked 1,10,000) takes half the gain, so half the value.
    const r = ok([h('A', '2017-06-01', '100000', '180000', '150000')], '110000')
    expect(n(r.holdings[0]!.planGain)).toBe(15000)
    expect(n(r.holdings[0]!.planSell)).toBe(90000)
  })

  it('loss-making and short-term holdings are not in the plan, and do not block it', () => {
    const r = ok([h('Loss', '2024-01-01', '100000', '60000'), h('Short', '2026-06-01', '100000', '150000'), h('Good', '2024-05-01', '100000', '130000')])
    expect(n(r.holdings[0]!.gain)).toBe(-40000)
    expect(n(r.holdings[0]!.planGain)).toBe(0)
    expect(n(r.toBook)).toBe(30000)
    expect(n(r.longTermAvailable)).toBe(30000)
  })

  it('refuses bad input in plain words', () => {
    expect(harvestLtcg([], { sellDate: NOW, booked: new D(0) })).toEqual({ error: 'Add at least one holding' })
    expect(harvestLtcg([h('A', '', '1', '2')], { sellDate: NOW, booked: new D(0) })).toEqual({ error: 'A: enter the buy date' })
    expect(harvestLtcg([h('A', '2026-12-01', '1', '2')], { sellDate: NOW, booked: new D(0) })).toEqual({ error: 'A: bought after the sale date' })
    expect(harvestLtcg([h('A', '2024-01-01', '1', '2')], { sellDate: '2027-04-02', booked: new D(0) })).toMatchObject({ error: expect.stringContaining('2026-04-01') })
    expect(harvestLtcg([h('A', '2024-01-01', '-1', '2')], { sellDate: NOW, booked: new D(0) })).toEqual({ error: 'A: amounts cannot be negative' })
  })
})
