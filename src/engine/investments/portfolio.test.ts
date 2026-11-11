import { describe, expect, it } from 'vitest'
import {
  countedHoldings,
  daysBetween,
  isAmount,
  isDay,
  isLiability,
  latestValue,
  monthlySeries,
  netWorth,
  oldestAsOf,
  splitByKind,
  staleCount,
  valueOn,
  withValue,
  type Holding,
  type HoldingKind,
} from './portfolio'

const h = (id: string, kind: HoldingKind, values: [string, string][], deletedAt: number | null = null): Holding => ({
  id,
  name: id,
  kind,
  deletedAt,
  values: values.map(([date, amount]) => ({ date, amount })),
})

const TODAY = '2026-11-06'

// The owner's sample: savings 3,25,000; FD 5,00,000; mutual funds 8,40,000 (41 days old); gold 1,20,000; EPF 6,10,000; home loan 38,00,000.
const sample: Holding[] = [
  h('hdfc', 'bank', [['2026-11-05', '325000']]),
  h('fd', 'fd_rd', [['2026-11-01', '500000']]),
  h('mf', 'stocks_mf', [['2026-09-26', '840000']]),
  h('gold', 'gold', [['2026-10-20', '120000']]),
  h('epf', 'retirement', [['2026-11-02', '610000']]),
  h('loan', 'loan', [['2026-11-03', '3800000']]),
]

describe('dates and amounts', () => {
  it('isDay accepts real days only', () => {
    expect(isDay('2026-02-28')).toBe(true)
    expect(isDay('2024-02-29')).toBe(true)
    expect(isDay('2026-02-29')).toBe(false)
    expect(isDay('2026-13-01')).toBe(false)
    expect(isDay('2026-1-1')).toBe(false)
    expect(isDay(20261106)).toBe(false)
  })
  it('daysBetween counts whole days, across months and a leap day', () => {
    expect(daysBetween('2026-09-26', '2026-11-06')).toBe(41)
    expect(daysBetween('2026-11-06', '2026-11-06')).toBe(0)
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
    expect(daysBetween('2026-11-06', '2026-11-05')).toBe(-1)
  })
  it('isAmount: positive plain numbers only', () => {
    for (const ok of ['1', '0.5', '325000', '12.34']) expect(isAmount(ok)).toBe(true)
    for (const bad of ['0', '0.00', '-5', '1e5', '1,000', ' 5', '', 'abc', '5.', '.5', 5, null]) expect(isAmount(bad)).toBe(false)
  })
  it('liabilities come from the kind', () => {
    expect(isLiability('loan')).toBe(true)
    expect(isLiability('card_debt')).toBe(true)
    expect(isLiability('bank')).toBe(false)
  })
})

describe('netWorth', () => {
  it('is assets minus liabilities, each at its latest value', () => {
    // 325000 + 500000 + 840000 + 120000 + 610000 = 2395000; minus 3800000
    expect(netWorth(sample).toFixed()).toBe('-1405000')
  })
  it('uses the newest value, not the last one in the list', () => {
    const x = h('a', 'bank', [['2026-11-01', '999'], ['2026-10-01', '1']])
    expect(netWorth([x]).toFixed()).toBe('999')
    expect(latestValue(x)?.amount).toBe('999')
  })
  it('is exact in decimal (0.1 + 0.2 is 0.3), and a liability can cancel an asset exactly', () => {
    expect(netWorth([h('a', 'bank', [['2026-11-01', '0.1']]), h('b', 'gold', [['2026-11-01', '0.2']])]).toFixed()).toBe('0.3')
    expect(netWorth([h('a', 'bank', [['2026-11-01', '100.10']]), h('b', 'loan', [['2026-11-01', '100.1']])]).toFixed()).toBe('0')
  })
  it('ignores deleted holdings and holdings with no value', () => {
    const all = [...sample, h('gone', 'bank', [['2026-11-01', '1000000']], 5), h('empty', 'bank', [])]
    expect(netWorth(all).toFixed()).toBe('-1405000')
  })
  it('is zero for nothing', () => {
    expect(netWorth([]).toFixed()).toBe('0')
  })
})

describe('staleness', () => {
  it('counts values older than 30 days, and names the oldest date', () => {
    expect(staleCount(sample, TODAY)).toBe(1)
    expect(countedHoldings(sample)).toBe(6)
    expect(oldestAsOf(sample)).toBe('2026-09-26')
  })
  it('exactly 30 days old is not yet old; 31 is', () => {
    expect(staleCount([h('a', 'bank', [['2026-10-07', '1']])], TODAY)).toBe(0)
    expect(staleCount([h('a', 'bank', [['2026-10-06', '1']])], TODAY)).toBe(1)
  })
  it('judges a holding by its newest value, not an old one in its history', () => {
    expect(staleCount([h('a', 'bank', [['2026-01-01', '1'], ['2026-11-05', '2']])], TODAY)).toBe(0)
  })
  it('skips deleted holdings; empty gives zero and no date', () => {
    expect(staleCount([h('a', 'bank', [['2020-01-01', '1']], 9)], TODAY)).toBe(0)
    expect(oldestAsOf([])).toBeNull()
    expect(staleCount([], TODAY)).toBe(0)
  })
})

describe('splitByKind', () => {
  it('sums per kind; assets first, then what you owe, biggest first', () => {
    const rows = splitByKind([...sample, h('sav2', 'bank', [['2026-11-01', '100000']]), h('card', 'card_debt', [['2026-11-01', '20000']])])
    expect(rows.map((r) => r.kind)).toEqual(['stocks_mf', 'retirement', 'fd_rd', 'bank', 'gold', 'loan', 'card_debt'])
    const bank = rows.find((r) => r.kind === 'bank')!
    expect(bank.total.toFixed()).toBe('425000')
    expect(bank.count).toBe(2)
    expect(bank.liability).toBe(false)
    expect(rows.find((r) => r.kind === 'loan')!.liability).toBe(true)
    expect(rows.find((r) => r.kind === 'loan')!.total.toFixed()).toBe('3800000')
  })
  it('leaves out empty kinds, deleted holdings and holdings with no value', () => {
    expect(splitByKind([h('a', 'bank', [['2026-11-01', '5']]), h('b', 'gold', [], null), h('c', 'fd_rd', [['2026-11-01', '5']], 1)]).map((r) => r.kind)).toEqual(['bank'])
    expect(splitByKind([])).toEqual([])
  })
})

describe('withValue', () => {
  it('a value on the same day REPLACES that day (never two on one date)', () => {
    const v = withValue([{ date: '2026-11-01', amount: '10' }], { date: '2026-11-01', amount: '12' })
    expect(v).toEqual([{ date: '2026-11-01', amount: '12' }])
  })
  it('keeps the list in date order, and does not change its input', () => {
    const before = [{ date: '2026-11-03', amount: '3' }, { date: '2026-11-01', amount: '1' }]
    const v = withValue(before, { date: '2026-11-02', amount: '2' })
    expect(v.map((x) => x.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
    expect(before).toHaveLength(2)
  })
  it('past the cap, the oldest values go first', () => {
    const day = (i: number) => new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10)
    const full = Array.from({ length: 120 }, (_, i) => ({ date: day(i), amount: '1' }))
    const v = withValue(full, { date: day(120), amount: '2' })
    expect(v).toHaveLength(120)
    expect(v[0]!.date).toBe(day(1))
    expect(v[119]).toEqual({ date: day(120), amount: '2' })
    // replacing a day on a full list drops nothing
    expect(withValue(full, { date: day(5), amount: '9' })).toHaveLength(120)
  })
})

describe('valueOn', () => {
  it('is the last value on or before the day, null before the first', () => {
    const x = h('a', 'bank', [['2026-06-10', '1'], ['2026-08-15', '2']])
    expect(valueOn(x, '2026-06-09')).toBeNull()
    expect(valueOn(x, '2026-06-10')?.amount).toBe('1')
    expect(valueOn(x, '2026-08-14')?.amount).toBe('1')
    expect(valueOn(x, '2026-12-31')?.amount).toBe('2')
  })
})

describe('monthlySeries', () => {
  it('has the last 6 months, oldest first, ending with this month', () => {
    const s = monthlySeries([], '2026-11-06')
    expect(s.map((m) => m.month)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
  })
  it('crosses a year end', () => {
    expect(monthlySeries([], '2026-02-10', 4).map((m) => m.month)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
  it('carries each holding\'s last value forward (a stale value stays, never dropped)', () => {
    const a = h('a', 'bank', [['2026-06-10', '100'], ['2026-09-05', '150']])
    const s = monthlySeries([a], TODAY)
    expect(s.map((m) => m.total.toFixed())).toEqual(['100', '100', '100', '150', '150', '150'])
    expect(s.every((m) => m.excluded.length === 0)).toBe(true)
  })
  it('a holding with NO value yet is excluded and flagged, so a new holding does not look like a jump', () => {
    const a = h('a', 'bank', [['2026-06-10', '1000']])
    const added = h('b', 'gold', [['2026-10-12', '500']])
    const s = monthlySeries([a, added], TODAY)
    expect(s.map((m) => m.total.toFixed())).toEqual(['1000', '1000', '1000', '1000', '1500', '1500'])
    expect(s.map((m) => m.excluded)).toEqual([['b'], ['b'], ['b'], ['b'], [], []])
    expect(s.map((m) => m.included)).toEqual([1, 1, 1, 1, 2, 2])
  })
  it('liabilities subtract in every month', () => {
    const s = monthlySeries([h('a', 'bank', [['2026-06-01', '1000']]), h('l', 'loan', [['2026-08-01', '400']])], TODAY)
    expect(s.map((m) => m.total.toFixed())).toEqual(['1000', '1000', '600', '600', '600', '600'])
  })
  it('a value on the last day of a month counts for that month; the next day does not', () => {
    const a = h('a', 'bank', [['2026-09-30', '10'], ['2026-10-01', '20']])
    const s = monthlySeries([a], TODAY, 3)
    expect(s.map((m) => [m.month, m.total.toFixed()])).toEqual([['2026-09', '10'], ['2026-10', '20'], ['2026-11', '20']])
  })
  it('a short month ends on its real last day (Feb)', () => {
    const a = h('a', 'bank', [['2026-02-28', '5'], ['2026-03-01', '9']])
    const s = monthlySeries([a], '2026-03-15', 2)
    expect(s.map((m) => m.total.toFixed())).toEqual(['5', '9'])
  })
  it('ignores deleted holdings; empty gives zeros', () => {
    const s = monthlySeries([h('a', 'bank', [['2026-06-01', '9']], 3)], TODAY)
    expect(s.every((m) => m.total.isZero() && m.included === 0 && m.excluded.length === 0)).toBe(true)
  })
  it('stays exact in decimal', () => {
    const s = monthlySeries([h('a', 'bank', [['2026-01-01', '0.1']]), h('b', 'gold', [['2026-01-01', '0.2']])], TODAY, 1)
    expect(s[0]!.total.toFixed()).toBe('0.3')
  })
})
