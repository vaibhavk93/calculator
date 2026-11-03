import { describe, expect, it } from 'vitest'
import { D, type Dec } from '../decimal'
import { settleUp, splitBill } from './split'

const d = (...n: (number | string)[]) => n.map((x) => new D(x))
const sum = (xs: Dec[]) => xs.reduce((a, x) => a.plus(x), new D(0)).toFixed()

describe('splitBill', () => {
  it('shares: 2 parts and 1 part of Rs 3000 with no tip', () => {
    const r = splitBill(new D(3000), new D(0), 'shares', d(2, 1))
    expect(r.ok && r.shares.map((s) => s.toFixed())).toEqual(['2000', '1000'])
  })
  it('percent: 50, 30, 20 of Rs 2400 with a 10% tip, tip shared in proportion', () => {
    const r = splitBill(new D(2400), new D(10), 'percent', d(50, 30, 20))
    expect(r.ok && [r.tip.toFixed(), r.total.toFixed(), ...r.shares.map((s) => s.toFixed())]).toEqual(['240', '2640', '1320', '792', '528'])
  })
  it('exact: own amounts, tip on top, shares still add to the total to the paisa', () => {
    const r = splitBill(new D(1000), new D('7.5'), 'exact', d(333, 333, 334))
    expect(r.ok).toBe(true)
    if (r.ok) expect(sum(r.shares)).toBe(r.total.toFixed()) // 1075
  })
  it('rounding never loses a paisa: Rs 100 in thirds', () => {
    const r = splitBill(new D(100), new D(0), 'shares', d(1, 1, 1))
    expect(r.ok && r.shares.map((s) => s.toFixed())).toEqual(['33.34', '33.33', '33.33'])
  })
  it('percent that does not add to 100 says what it added to', () => {
    expect(splitBill(new D(100), new D(0), 'percent', d(50, 40))).toMatchObject({ ok: false, reason: 'percent-sum' })
    const r = splitBill(new D(100), new D(0), 'percent', d(50, 40))
    expect(!r.ok && r.sum.toFixed()).toBe('90')
  })
  it('exact amounts that miss the bill say so', () => {
    const r = splitBill(new D(1000), new D(0), 'exact', d(400, 500))
    expect(r).toMatchObject({ ok: false, reason: 'exact-sum' })
    expect(!r.ok && r.sum.toFixed()).toBe('900')
  })
  it('a person can pay nothing (0 share)', () => {
    const r = splitBill(new D(900), new D(0), 'shares', d(1, 0, 2))
    expect(r.ok && r.shares.map((s) => s.toFixed())).toEqual(['300', '0', '600'])
  })
  it('refuses negatives, no people and all-zero', () => {
    expect(splitBill(new D(-1), new D(0), 'shares', d(1))).toMatchObject({ ok: false, reason: 'invalid' })
    expect(splitBill(new D(10), new D(-1), 'shares', d(1))).toMatchObject({ ok: false, reason: 'invalid' })
    expect(splitBill(new D(10), new D(0), 'shares', [])).toMatchObject({ ok: false, reason: 'invalid' })
    expect(splitBill(new D(10), new D(0), 'shares', d(0, 0))).toMatchObject({ ok: false, reason: 'invalid' })
    expect(splitBill(new D(10), new D(0), 'shares', d(1, -1))).toMatchObject({ ok: false, reason: 'invalid' })
  })
})

describe('settleUp', () => {
  it('everyone but the payer owes the payer their share', () => {
    const r = settleUp(d(500, 300, 200), 0)!
    expect(r.map((x) => [x.person, x.owes.toFixed()])).toEqual([[1, '300'], [2, '200']])
  })
  it('skips people who owe nothing; null for a payer that does not exist', () => {
    expect(settleUp(d(500, 0, 200), 2)!.map((x) => x.person)).toEqual([0])
    expect(settleUp(d(1, 2), 2)).toBeNull()
    expect(settleUp(d(1, 2), -1)).toBeNull()
    expect(settleUp(d(1, 2), 0.5)).toBeNull()
  })
})
