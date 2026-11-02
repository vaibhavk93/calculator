import { describe, expect, it } from 'vitest'
import { categoryName, cleanInstrument, dayKey, eligibleInstruments, instrumentFitsMode, modeLabel, monthKey, paymentError, shiftMonth, suggestFor, summarise, PAYMENT_MODES } from './budget'
import type { BudgetData, PayInstrument } from './budget'

const cat = (id: string, limit: string | null = null, deletedAt: number | null = null, parentId: string | null = null) => ({ id, name: id, limit, parentId, deletedAt })
const exp = (id: string, date: string, amount: string, categoryId: string | null, deletedAt: number | null = null) => ({ id, date, amount, categoryId, mode: null, instrumentId: null, note: '', deletedAt })

const data: BudgetData = {
  overall: '10000',
  instruments: [],
  categories: [cat('food', '4000'), cat('rent', null), cat('gone', '500', 1)],
  expenses: [
    exp('1', '2026-11-02', '1500.10', 'food'),
    exp('2', '2026-11-05', '2600.20', 'food'),
    exp('3', '2026-11-05', '5000', 'rent'),
    exp('4', '2026-11-09', '300', 'gone'), // its category was deleted
    exp('5', '2026-11-10', '120', null), // never had one
    exp('6', '2026-11-11', '999', 'food', 5), // deleted entry
    exp('7', '2026-10-30', '777', 'food'), // another month
  ],
}

describe('summarise', () => {
  const s = summarise(data, '2026-11')
  it('adds exactly: 0.1 + 0.2 style sums do not drift', () => {
    expect(s.lines.find((l) => l.id === 'food')!.spent.toFixed(2)).toBe('4100.30')
  })
  it('counts only the month, and skips deleted entries', () => {
    expect(s.entries.map((e) => e.id)).toEqual(['5', '4', '2', '3', '1']) // same-day entries keep their stored order (newest added first)
    expect(s.spent.toFixed(2)).toBe('9520.30')
  })
  it('shows how far over a limit you are as a negative "left"', () => {
    const food = s.lines.find((l) => l.id === 'food')!
    expect(food.left!.toFixed(2)).toBe('-100.30')
    expect(food.pct).toBe(103)
  })
  it('a category with no limit has no left or percent', () => {
    const rent = s.lines.find((l) => l.id === 'rent')!
    expect(rent.limit).toBeNull()
    expect(rent.left).toBeNull()
    expect(rent.pct).toBeNull()
  })
  it('entries of a deleted category, and uncategorised ones, are shown as uncategorised, not dropped', () => {
    expect(s.uncategorised.toFixed(2)).toBe('420.00')
    expect(s.lines.some((l) => l.id === 'gone')).toBe(false)
  })
  it('the overall limit is measured against everything spent', () => {
    expect(s.overall!.left.toFixed(2)).toBe('479.70')
    expect(s.overall!.pct).toBe(95)
  })
  it('no overall limit gives none', () => {
    expect(summarise({ ...data, overall: null }, '2026-11').overall).toBeNull()
  })
  it('an empty month is all zeros', () => {
    const e = summarise(data, '2027-01')
    expect(e.spent.toFixed(2)).toBe('0.00')
    expect(e.entries).toEqual([])
  })
})

describe('months', () => {
  it('shifts across a year end both ways', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
  it('formats a date in local time', () => {
    expect(monthKey(new Date(2026, 10, 2))).toBe('2026-11')
    expect(dayKey(new Date(2026, 10, 2))).toBe('2026-11-02')
  })
})

describe('payment mode', () => {
  const m = (id: string, amount: string, mode: 'upi' | 'cash' | null, deletedAt: number | null = null, date = '2026-11-02', note = '') => ({ ...exp(id, date, amount, null, deletedAt), mode, note })
  const b: BudgetData = { overall: null, instruments: [], categories: [cat('food')], expenses: [m('1', '0.1', 'upi'), m('2', '0.2', 'upi'), m('3', '50', 'cash'), m('4', '999', 'upi', 5), m('5', '7', null), m('6', '9', 'cash', null, '2026-10-30')] }
  it('sums per mode exactly, skips deleted and other months', () => {
    const s = summarise(b, '2026-11')
    expect(s.byMode.map((x) => [x.id, x.label, x.spent.toString()])).toEqual([['cash', 'Cash', '50'], ['upi', 'UPI', '0.3']])
    expect(s.noMode.toString()).toBe('7')
  })
  it('modeLabel names a mode', () => expect(modeLabel('credit')).toBe('Credit card'))
  it('suggestFor matches the note ignoring case, newest date first, live entries only', () => {
    const x: BudgetData = {
      ...b,
      expenses: [
        { ...m('a', '1', 'cash', null, '2026-11-01', 'Swiggy'), categoryId: 'food' },
        { ...m('b', '1', 'upi', null, '2026-11-03', 'swiggy '), categoryId: 'food' },
        { ...m('c', '1', 'cash', 9, '2026-11-09', 'swiggy'), categoryId: 'food' },
      ],
    }
    expect(suggestFor(x, 'SWIGGY')).toEqual({ categoryId: 'food', parentId: null, mode: 'upi', instrumentId: null })
    expect(suggestFor(x, 'swig')).toBeNull()
    expect(suggestFor(x, '  ')).toBeNull()
  })
})

const inst = (id: string, kind: PayInstrument['kind'], network: PayInstrument['network'] = null, deletedAt: number | null = null): PayInstrument => ({ id, name: id, kind, network, bank: '', last4: '', rewardNote: '', deletedAt })
const INSTRUMENTS = [
  inst('neo', 'credit', 'rupay'),
  inst('swiggy', 'credit', 'mastercard'),
  inst('amex', 'credit', 'amex'),
  inst('hdfcdc', 'debit', 'visa'),
  inst('hdfc', 'bank'),
  inst('amzpay', 'wallet'),
  inst('old', 'wallet', null, 7),
]
const withInst: Pick<BudgetData, 'instruments'> = { instruments: INSTRUMENTS }

describe('subcategories', () => {
  const sub: BudgetData = {
    overall: null,
    instruments: [],
    categories: [cat('food', '4000'), cat('swiggy', '1000', null, 'food'), cat('dining', null, null, 'food'), cat('rent'), cat('orphan', null, null, 'rent'), cat('dead', null, 4, 'food')],
    expenses: [
      exp('1', '2026-11-02', '0.1', 'food'),
      exp('2', '2026-11-02', '0.2', 'swiggy'),
      exp('3', '2026-11-03', '1500.10', 'swiggy'),
      exp('4', '2026-11-04', '10', 'dining'),
      exp('5', '2026-11-05', '5000', 'rent'),
      exp('6', '2026-11-06', '3', 'dead'), // deleted subcategory
    ],
  }
  const s = summarise(sub, '2026-11')
  const food = s.lines.find((l) => l.id === 'food')!
  it('lists only top-level categories as lines, with children inside', () => {
    expect(s.lines.map((l) => l.id)).toEqual(['food', 'rent'])
    expect(food.children.map((c) => c.id)).toEqual(['swiggy', 'dining'])
    expect(s.lines.find((l) => l.id === 'rent')!.children.map((c) => c.id)).toEqual(['orphan'])
  })
  it('rolls a subcategory into its parent with exact sums', () => {
    expect(food.spent.toString()).toBe('1510.4')
    expect(food.direct.toString()).toBe('0.1')
    expect(food.children[0]!.spent.toString()).toBe('1500.3')
    expect(food.children[1]!.spent.toString()).toBe('10')
  })
  it('a child limit is its own and does not change the parent', () => {
    expect(food.limit!.toString()).toBe('4000')
    expect(food.left!.toString()).toBe('2489.6')
    const swiggy = food.children[0]!
    expect(swiggy.limit!.toString()).toBe('1000')
    expect(swiggy.left!.toString()).toBe('-500.3')
    expect(swiggy.pct).toBe(150)
    expect(food.children[1]!.limit).toBeNull()
  })
  it('a parent limit alone, with no child limits, still measures the whole family', () => {
    const t = summarise({ ...sub, categories: [cat('food', '1000'), cat('swiggy', null, null, 'food')] }, '2026-11')
    expect(t.lines[0]!.spent.toString()).toBe('1500.4')
    expect(t.lines[0]!.pct).toBe(150)
  })
  it('deleted subcategory entries are uncategorised, not dropped; totals still add up', () => {
    expect(s.uncategorised.toString()).toBe('3')
    expect(s.spent.toString()).toBe('6513.4')
    expect(s.lines.reduce((t, l) => t.plus(l.spent), s.uncategorised).toString()).toBe(s.spent.toString())
  })
  it('entries of a subcategory whose parent was deleted are uncategorised', () => {
    const t = summarise({ ...sub, categories: [cat('food', null, 9), cat('swiggy', null, null, 'food')] }, '2026-11')
    expect(t.lines).toEqual([])
    expect(t.uncategorised.toString()).toBe(t.spent.toString())
  })
  it('category filter: a parent includes its children, a child only itself', () => {
    // 1510.4 live + 3 in its deleted subcategory (still its family, shown as uncategorised)
    expect(summarise(sub, '2026-11', { categoryId: 'food' }).spent.toString()).toBe('1513.4')
    expect(summarise(sub, '2026-11', { categoryId: 'swiggy' }).spent.toString()).toBe('1500.3')
  })
  it('categoryName shows the path', () => {
    expect(categoryName(sub, 'swiggy')).toBe('food › swiggy')
    expect(categoryName(sub, 'food')).toBe('food')
    expect(categoryName(sub, 'dead')).toBe('Uncategorised')
    expect(categoryName(sub, null)).toBe('Uncategorised')
  })
  it('suggestFor reports the parent of a subcategory, and nothing for a deleted one', () => {
    const e = (id: string, categoryId: string) => ({ ...exp(id, '2026-11-01', '1', categoryId), note: 'lunch' })
    expect(suggestFor({ ...sub, expenses: [e('a', 'swiggy')] }, 'lunch')).toMatchObject({ categoryId: 'swiggy', parentId: 'food' })
    expect(suggestFor({ ...sub, expenses: [e('a', 'dead')] }, 'lunch')).toMatchObject({ categoryId: null, parentId: null })
  })
})

describe('mode and instrument rules', () => {
  const ok = (mode: (typeof PAYMENT_MODES)[number]['id'], id: string) => paymentError(withInst, mode, id) === null
  it('credit takes only credit cards', () => {
    expect(['neo', 'swiggy', 'amex'].every((i) => ok('credit', i))).toBe(true)
    expect(['hdfcdc', 'hdfc', 'amzpay'].some((i) => ok('credit', i))).toBe(false)
  })
  it('debit takes only debit cards', () => {
    expect(ok('debit', 'hdfcdc')).toBe(true)
    expect(['neo', 'hdfc', 'amzpay'].some((i) => ok('debit', i))).toBe(false)
  })
  it('net banking takes only bank accounts, wallet only wallets', () => {
    expect(ok('netbanking', 'hdfc')).toBe(true)
    expect(['neo', 'hdfcdc', 'amzpay'].some((i) => ok('netbanking', i))).toBe(false)
    expect(ok('wallet', 'amzpay')).toBe(true)
    expect(['neo', 'hdfcdc', 'hdfc'].some((i) => ok('wallet', i))).toBe(false)
  })
  it('cash takes nothing', () => {
    expect(['neo', 'hdfcdc', 'hdfc', 'amzpay'].some((i) => ok('cash', i))).toBe(false)
  })
  it('UPI takes bank, debit, wallet and RuPay credit only', () => {
    expect(['hdfc', 'hdfcdc', 'amzpay', 'neo'].every((i) => ok('upi', i))).toBe(true)
    expect(ok('upi', 'swiggy')).toBe(false) // Mastercard credit
    expect(ok('upi', 'amex')).toBe(false)
    expect(paymentError(withInst, 'upi', 'swiggy')).toBe('Pick a RuPay credit card, a bank account, a debit card or a wallet for UPI')
  })
  it('no instrument is always fine; a deleted or unknown one, or one with no mode, is not', () => {
    for (const m of PAYMENT_MODES) expect(paymentError(withInst, m.id, null)).toBeNull()
    expect(paymentError(withInst, 'wallet', 'old')).toBe('That card or account was removed')
    expect(paymentError(withInst, 'wallet', 'ghost')).toBe('That card or account was removed')
    expect(paymentError(withInst, null, 'neo')).toBe('Pick how it was paid first')
  })
  it('eligibleInstruments lists live matches for a mode', () => {
    expect(eligibleInstruments(withInst, 'credit').map((i) => i.id)).toEqual(['neo', 'swiggy', 'amex'])
    expect(eligibleInstruments(withInst, 'upi').map((i) => i.id)).toEqual(['neo', 'hdfcdc', 'hdfc', 'amzpay'])
    expect(eligibleInstruments(withInst, 'wallet').map((i) => i.id)).toEqual(['amzpay'])
    expect(eligibleInstruments(withInst, 'cash')).toEqual([])
    expect(eligibleInstruments(withInst, null)).toEqual([])
  })
  it('instrumentFitsMode reads only kind and network', () => {
    expect(instrumentFitsMode('upi', { kind: 'credit', network: null })).toBe(false)
  })
})

describe('cleanInstrument', () => {
  it('trims, caps and keeps a network only for cards', () => {
    const r = cleanInstrument({ name: '  Tata Neo ', kind: 'credit', network: 'rupay', bank: ' Tata ', last4: '1234', rewardNote: 'x'.repeat(300) })
    expect(r.ok && r.value).toMatchObject({ name: 'Tata Neo', network: 'rupay', bank: 'Tata', last4: '1234' })
    expect(r.ok && r.value.rewardNote).toHaveLength(200)
    const w = cleanInstrument({ name: 'Amazon Pay', kind: 'wallet', network: 'visa' })
    expect(w.ok && w.value.network).toBeNull()
  })
  it('rejects a blank name and a bad last4', () => {
    expect(cleanInstrument({ name: ' ', kind: 'bank' })).toEqual({ ok: false, error: 'Give it a name' })
    expect(cleanInstrument({ name: 'x', kind: 'bank', last4: '12a4' }).ok).toBe(false)
    expect(cleanInstrument({ name: 'x', kind: 'bank', last4: '123' }).ok).toBe(false)
    expect(cleanInstrument({ name: 'x', kind: 'bank', last4: '' }).ok).toBe(true)
  })
})

describe('summaries by instrument, network and filter', () => {
  const e = (id: string, amount: string, mode: BudgetData['expenses'][number]['mode'], instrumentId: string | null, categoryId: string | null = null, date = '2026-11-02', deletedAt: number | null = null) => ({
    ...exp(id, date, amount, categoryId, deletedAt),
    mode,
    instrumentId,
  })
  const b: BudgetData = {
    overall: null,
    instruments: INSTRUMENTS,
    categories: [cat('food')],
    expenses: [
      e('1', '0.1', 'upi', 'neo', 'food'), // UPI from RuPay credit
      e('2', '0.2', 'credit', 'neo'),
      e('3', '100', 'credit', 'swiggy', 'food'),
      e('4', '50', 'upi', 'hdfc'),
      e('5', '7', 'cash', null),
      e('6', '999', 'credit', 'swiggy', null, '2026-11-02', 5), // deleted
      e('7', '888', 'credit', 'swiggy', null, '2026-10-30'), // other month
    ],
  }
  const s = summarise(b, '2026-11')
  it('groups by instrument, biggest first, with counts', () => {
    expect(s.byInstrument.map((r) => [r.instrument.id, r.spent.toString(), r.count])).toEqual([['swiggy', '100', 1], ['hdfc', '50', 1], ['neo', '0.3', 2]])
  })
  it('groups by network (banks and wallets have none)', () => {
    expect(s.byNetwork.map((r) => [r.id, r.label, r.spent.toString(), r.count])).toEqual([['mastercard', 'Mastercard', '100', 1], ['rupay', 'RuPay', '0.3', 2]])
  })
  it('filters narrow everything', () => {
    const f = summarise(b, '2026-11', { modeId: 'upi' })
    expect(f.spent.toString()).toBe('50.1')
    expect(f.byMode.map((m) => m.id)).toEqual(['upi'])
    expect(summarise(b, '2026-11', { instrumentId: 'neo' }).spent.toString()).toBe('0.3')
    expect(summarise(b, '2026-11', { network: 'rupay' }).entries.map((x) => x.id)).toEqual(['1', '2'])
    expect(summarise(b, '2026-11', { network: 'rupay', modeId: 'upi' }).spent.toString()).toBe('0.1')
    expect(summarise(b, '2026-11', { network: 'amex' }).spent.toString()).toBe('0')
    expect(summarise(b, '2026-11', { categoryId: 'food', modeId: 'credit' }).spent.toString()).toBe('100')
  })
  it('no filter is the plain summary', () => {
    expect(s.spent.toString()).toBe('157.3')
  })
  it('suggestFor brings the instrument back when it still fits', () => {
    const n = (instrumentId: string | null, mode: 'upi' | 'credit') => ({ ...e('x', '1', mode, instrumentId), note: 'fuel' })
    expect(suggestFor({ ...b, expenses: [n('neo', 'upi')] }, 'fuel')!.instrumentId).toBe('neo')
    expect(suggestFor({ ...b, expenses: [n('old', 'credit')] }, 'fuel')!.instrumentId).toBeNull()
  })
})
