import { describe, expect, it } from 'vitest'
import { D } from '../engine'
import { CLOSE_AT, categoryName, compareLastMonth, dailyAverage, daysInMonth, limitState, needsAttention, paceLeft, sharePercent, spentIn, topEntries, trend, cleanInstrument, dayKey, eligibleInstruments, instrumentFitsMode, modeLabel, monthKey, paymentError, shiftMonth, suggestFor, summarise, PAYMENT_MODES } from './budget'
import { validateAmount, validateCategoryName, validateDate, validateExpense, validateInstrumentDraft, validateLimit } from './budget'
import {
  KNOWN_BANKS, UPI_DEFAULT_LABEL, activeCategories, cardOutstanding, categoryActiveIn, dropInapplicable, effectiveLimit, effectiveOverall, instrumentLabel, validateCategoryMonths, validateInstrumentFields,
} from './budget'
import { dailyTotals, dayLongLabel, limitLabel, monthShortLabel, monthWeeks, monthWindow, owesWords, recentCategoryIds } from './budget'
import type { BudgetData, BudgetExpense, PayInstrument } from './budget'
import { cardCostIn, isCostCategory, utilisationWords } from './budget'

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
    expect(eligibleInstruments(withInst, 'upi').map((i) => i.id)).toEqual(['hdfc', 'hdfcdc', 'amzpay', 'neo']) // bank, debit, wallet, then RuPay credit
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

describe('spend summary maths', () => {
  const ex = (id: string, date: string, amount: string, categoryId: string | null = null, mode: 'upi' | 'credit' | null = null, instrumentId: string | null = null) => ({ id, date, amount, categoryId, mode, instrumentId, note: '', deletedAt: null })
  const b: BudgetData = {
    overall: null,
    instruments: [{ id: 'c1', name: 'Card', kind: 'credit', network: 'rupay', bank: '', last4: '', rewardNote: '', deletedAt: null }],
    categories: [cat('food', '100'), cat('eat', '50', null, 'food')],
    expenses: [
      ex('a', '2026-11-02', '0.1', 'eat'),
      ex('b', '2026-11-20', '0.2', 'food', 'credit', 'c1'),
      ex('c', '2026-10-01', '10', 'food'),
      ex('d', '2026-10-21', '5', 'food', 'upi', 'c1'),
      ex('e', '2026-10-20', '5', 'food'),
    ],
  }
  const today = new Date(2026, 10, 20)
  it('sums exactly, up to a day, with a filter', () => {
    expect(spentIn(b, '2026-11').toString()).toBe('0.3')
    expect(spentIn(b, '2026-11', {}, 10).toString()).toBe('0.1')
    expect(spentIn(b, '2026-10', { kind: 'credit' }).toString()).toBe('5')
    expect(spentIn(b, '2026-11', { kind: 'debit' }).toString()).toBe('0')
  })
  it('trend is oldest first and ends at the month', () => {
    expect(trend(b, '2026-11', 3).map((t) => [t.month, t.spent.toString()])).toEqual([['2026-09', '0'], ['2026-10', '20'], ['2026-11', '0.3']])
  })
  it('daily average: today for this month, all days for a past one, none for the future', () => {
    expect(dailyAverage(new D(40), '2026-11', today)).toMatchObject({ days: 20 })
    expect(dailyAverage(new D(30), '2026-10', today)!.days).toBe(31)
    expect(dailyAverage(new D(30), '2026-12', today)).toBeNull()
    expect(daysInMonth('2026-02')).toBe(28)
  })
  it('compares the same days last month, not the whole month', () => {
    const c = compareLastMonth(b, '2026-11', today)!
    expect(c.throughDay).toBe(20)
    expect(c.previous.toString()).toBe('15') // 1 Oct + 20 Oct + not 21 Oct
    expect(c.diff.toString()).toBe('-14.7')
    expect(c.pct).toBe(-98)
    expect(compareLastMonth(b, '2026-10', today)!.previous.toString()).toBe('0')
    expect(compareLastMonth(b, '2026-10', today)!.pct).toBeNull()
    expect(compareLastMonth(b, '2026-12', today)).toBeNull()
  })
  it('topEntries: biggest first, ties newest first', () => {
    expect(topEntries(b.expenses, 3).map((e) => e.id)).toEqual(['c', 'd', 'e'])
  })
  it('share percent and limit states are exact at the edges', () => {
    expect(sharePercent(new D(1), new D(3))).toBe(33)
    expect(sharePercent(new D(1), new D(0))).toBe(0)
    expect(CLOSE_AT).toBe(0.8)
    expect(limitState(new D('79.99'), new D(100))).toBe('fine')
    expect(limitState(new D(80), new D(100))).toBe('close')
    expect(limitState(new D('99.99'), new D(100))).toBe('close')
    expect(limitState(new D(100), new D(100))).toBe('reached')
    expect(limitState(new D('100.01'), new D(100))).toBe('over')
  })
  it('needs attention lists parents and subcategories at 80% or more, worst first', () => {
    const s = summarise({ ...b, expenses: [ex('x', '2026-11-02', '45', 'eat'), ex('y', '2026-11-03', '50', 'food')] }, '2026-11')
    expect(needsAttention(s.lines).map((i) => [i.name, i.state])).toEqual([['food', 'close'], ['food › eat', 'close']])
  })
  it('pace only for this month with money left', () => {
    expect(paceLeft(new D(110), '2026-11', today)).toMatchObject({ days: 11 })
    expect(paceLeft(new D(0), '2026-11', today)).toBeNull()
    expect(paceLeft(new D(10), '2026-10', today)).toBeNull()
  })
})

describe('validateAmount and validateLimit', () => {
  it('needs a number above zero', () => {
    for (const bad of ['', ' ', '0', '0.00', 'abc', '-5', '1e3', '.', '1.2.3']) expect(validateAmount(bad), bad).toBe('Enter an amount above zero')
    for (const ok of ['1', '0.01', '1,50,000', '₹ 99.5', '.5', '5.']) expect(validateAmount(ok), ok).toBeNull()
  })
  it('allows 2 decimals at most, but trailing zeros are fine', () => {
    expect(validateAmount('1.234')).toBe('Use up to 2 decimal places')
    expect(validateAmount('1.500')).toBeNull()
  })
  it('stops at 10 crore exactly', () => {
    expect(validateAmount('100000000')).toBeNull()
    expect(validateAmount('100000000.01')).toBe("Amount can't be more than ₹10 crore")
  })
  it('a limit may be empty, otherwise follows the same rules', () => {
    expect(validateLimit('')).toBeNull()
    expect(validateLimit('0')).toBe('Enter a limit above zero, or leave it empty')
    expect(validateLimit('abc')).toBe('Enter a limit above zero, or leave it empty')
    expect(validateLimit('1.234')).toBe('Use up to 2 decimal places')
    expect(validateLimit('100000001')).toBe("A limit can't be more than ₹10 crore")
    expect(validateLimit('5000')).toBeNull()
  })
})

describe('validateDate', () => {
  const today = new Date(2026, 10, 2) // 2 Nov 2026
  it('needs a real calendar day', () => {
    for (const bad of ['', '2026-13-01', '2026-02-30', '26-11-02', 'today']) expect(validateDate(bad, today), bad).toBe('Pick a date')
    expect(validateDate('2028-02-29', new Date(2027, 5, 1))).toBeNull() // a real leap day
  })
  it('does not go before 2000', () => {
    expect(validateDate('1999-12-31', today)).toBe('Pick a date from the year 2000 onward')
    expect(validateDate('2000-01-01', today)).toBeNull()
  })
  it('allows up to one year ahead, no more', () => {
    expect(validateDate('2027-11-02', today)).toBeNull()
    expect(validateDate('2027-11-03', today)).toBe('That date is in the far future')
    expect(validateDate('2026-11-02', today)).toBeNull()
  })
})

describe('validateExpense', () => {
  const today = new Date(2026, 10, 2)
  const b: BudgetData = {
    overall: null,
    categories: [cat('food'), cat('swiggy', null, null, 'food'), cat('gone', null, 5), cat('orphan', null, null, 'gone')],
    instruments: [{ id: 'sbi', name: 'SBI', kind: 'bank', network: null, bank: '', last4: '', rewardNote: '', deletedAt: null }],
    expenses: [],
  }
  const ok = { amount: '100', date: '2026-11-02', categoryId: 'food', mode: 'upi' as const, instrumentId: 'sbi' }
  it('a good entry has no errors', () => expect(validateExpense(ok, b, today)).toEqual({}))
  it('reports each field on its own', () => {
    expect(validateExpense({ ...ok, amount: '0', date: 'x' }, b, today)).toEqual({ amount: 'Enter an amount above zero', date: 'Pick a date' })
  })
  it('refuses a deleted category, or a subcategory whose parent was deleted; accepts a live subcategory and none', () => {
    expect(validateExpense({ ...ok, categoryId: 'gone' }, b, today).category).toBe('Pick a category from the list')
    expect(validateExpense({ ...ok, categoryId: 'orphan' }, b, today).category).toBe('Pick a category from the list')
    expect(validateExpense({ ...ok, categoryId: 'nope' }, b, today).category).toBe('Pick a category from the list')
    expect(validateExpense({ ...ok, categoryId: 'swiggy' }, b, today)).toEqual({})
    expect(validateExpense({ ...ok, categoryId: null }, b, today)).toEqual({})
  })
  it('refuses a card that does not fit the mode', () => {
    expect(validateExpense({ ...ok, mode: 'credit' }, b, today).paidWith).toBe('Pick a credit card for Credit card')
    expect(validateExpense({ ...ok, mode: null }, b, today).paidWith).toBe('Pick how it was paid first')
    expect(validateExpense({ ...ok, mode: 'cash', instrumentId: null }, b, today)).toEqual({})
  })
})

describe('validateCategoryName', () => {
  const b: BudgetData = {
    overall: null,
    instruments: [],
    expenses: [],
    categories: [cat('Food'), cat('Travel'), cat('Swiggy', null, null, 'Food'), cat('Old', null, 9)],
  }
  it('needs a name of 1 to 40 characters', () => {
    expect(validateCategoryName('  ', b)).toBe('Give it a name')
    expect(validateCategoryName('x'.repeat(41), b)).toBe("Name can't be more than 40 characters")
    expect(validateCategoryName('x'.repeat(40), b)).toBeNull()
  })
  it('keeps "Uncategorised" for entries with no category', () => {
    expect(validateCategoryName('uncategorised', b)).toBe('That name is kept for entries with no category')
  })
  it('refuses a duplicate among siblings only, ignoring case and deleted ones', () => {
    expect(validateCategoryName('food', b)).toBe('That name is already used here')
    expect(validateCategoryName('swiggy', b, 'Food')).toBe('That name is already used here')
    expect(validateCategoryName('Swiggy', b, 'Travel')).toBeNull()
    expect(validateCategoryName('Old', b)).toBeNull()
  })
  it('a rename may keep its own name', () => expect(validateCategoryName('Food', b, null, 'Food')).toBeNull())
  it('subcategories go under a live top-level category only, up to 12', () => {
    expect(validateCategoryName('X', b, 'Swiggy')).toBe("Subcategories can't have their own subcategories")
    expect(validateCategoryName('X', b, 'Old')).toBe('That category was removed')
    const many: BudgetData = { ...b, categories: [cat('Food'), ...Array.from({ length: 12 }, (_, i) => cat(`s${i}`, null, null, 'Food'))] }
    expect(validateCategoryName('Thirteenth', many, 'Food')).toBe('A category can have up to 12 subcategories')
    expect(validateCategoryName('s0', many, 'Food', 's0')).toBeNull()
  })
  it('caps all categories at 60', () => {
    const full: BudgetData = { ...b, categories: Array.from({ length: 60 }, (_, i) => cat(`c${i}`)) }
    expect(validateCategoryName('One more', full)).toBe('You can have up to 60 categories')
  })
})

describe('validateInstrumentDraft', () => {
  const inst = (id: string, name: string, kind: PayInstrument['kind'], deletedAt: number | null = null): PayInstrument => ({ id, name, kind, network: null, bank: '', last4: '', rewardNote: '', deletedAt })
  const b = { instruments: [inst('a', 'Tata Neo', 'credit'), inst('b', 'Gone', 'credit', 3)] }
  it('needs a kind and a name', () => {
    expect(validateInstrumentDraft({ name: '', kind: null }, b)).toEqual({ kind: 'Pick what this is', name: 'Give it a name' })
    expect(validateInstrumentDraft({ name: 'x'.repeat(41), kind: 'bank' }, b).name).toBe("Name can't be more than 40 characters")
  })
  it('refuses a name already used for the same kind, not another kind, not a deleted one', () => {
    expect(validateInstrumentDraft({ name: 'tata neo', kind: 'credit' }, b).name).toBe('You already have one with that name')
    expect(validateInstrumentDraft({ name: 'Tata Neo', kind: 'debit' }, b)).toEqual({})
    expect(validateInstrumentDraft({ name: 'Gone', kind: 'credit' }, b)).toEqual({})
    expect(validateInstrumentDraft({ name: 'Tata Neo', kind: 'credit' }, b, 'a')).toEqual({})
  })
  it('last four is blank or exactly four digits; a longer number is refused, not shortened', () => {
    expect(validateInstrumentDraft({ name: 'x', kind: 'bank', last4: '' }, b)).toEqual({})
    expect(validateInstrumentDraft({ name: 'x', kind: 'bank', last4: '4321' }, b)).toEqual({})
    expect(validateInstrumentDraft({ name: 'x', kind: 'bank', last4: '123' }, b).last4).toBe('Last 4 digits must be exactly 4 numbers')
    expect(validateInstrumentDraft({ name: 'x', kind: 'bank', last4: '12ab' }, b).last4).toBe('Last 4 digits must be exactly 4 numbers')
    expect(validateInstrumentDraft({ name: 'x', kind: 'bank', last4: '4111111111111111' }, b).last4).toBe('Enter only the last 4 digits. Calc never keeps a full card number')
    expect(cleanInstrument({ name: 'x', kind: 'bank', last4: '4111111111111111' }).ok).toBe(false)
  })
  it('limits the bank and the reward notes, and refuses a long number in the notes', () => {
    expect(validateInstrumentDraft({ name: 'x', kind: 'bank', bank: 'b'.repeat(41) }, b).bank).toBe("Bank can't be more than 40 characters")
    expect(validateInstrumentDraft({ name: 'x', kind: 'bank', rewardNote: 'n'.repeat(201) }, b).rewardNote).toBe("Notes can't be more than 200 characters")
    expect(validateInstrumentDraft({ name: 'x', kind: 'bank', rewardNote: '5% on dining, 4111 1111 1111 1111' }, b).rewardNote).toBe('Remove the long number. Calc does not store card numbers')
    expect(validateInstrumentDraft({ name: 'x', kind: 'bank', rewardNote: '5% on dining, cap 1500 a month' }, b)).toEqual({})
  })
  it('caps the number of cards at 40', () => {
    const full = { instruments: Array.from({ length: 40 }, (_, i) => inst(`i${i}`, `Card ${i}`, 'debit')) }
    expect(validateInstrumentDraft({ name: 'One more', kind: 'debit' }, full).name).toContain('up to 40')
  })
})


describe('limits: every month or this month only', () => {
  const b: BudgetData = {
    overall: '10000',
    overallByMonth: { '2026-12': '15000', '2027-01': null },
    instruments: [],
    categories: [{ ...cat('food', '4000'), limitByMonth: { '2026-11': '6000', '2026-12': null } }, cat('rent')],
    expenses: [exp('1', '2026-11-02', '5000', 'food'), exp('2', '2026-12-02', '5000', 'food')],
  }
  it('a month override wins, even "no limit this month"; other months keep the standing limit', () => {
    expect(effectiveLimit(b.categories[0]!, '2026-11')).toBe('6000')
    expect(effectiveLimit(b.categories[0]!, '2026-12')).toBeNull()
    expect(effectiveLimit(b.categories[0]!, '2027-02')).toBe('4000')
    expect(effectiveOverall(b, '2026-12')).toBe('15000')
    expect(effectiveOverall(b, '2027-01')).toBeNull()
    expect(effectiveOverall(b, '2026-11')).toBe('10000')
  })
  it('summarise, needsAttention and limitState use the limit of the month shown', () => {
    const nov = summarise(b, '2026-11')
    const food = nov.lines.find((l) => l.id === 'food')!
    expect(food.limit!.toFixed()).toBe('6000')
    expect(food.limitScope).toBe('month')
    expect(limitState(food.spent, food.limit!)).toBe('close')
    expect(needsAttention(nov.lines).map((x) => x.state)).toEqual(['close'])
    const dec = summarise(b, '2026-12')
    expect(dec.lines.find((l) => l.id === 'food')!.limit).toBeNull()
    expect(needsAttention(dec.lines)).toEqual([])
    expect(dec.overall!.limit.toFixed()).toBe('15000')
    expect(dec.overall!.scope).toBe('month')
    expect(nov.overall!.scope).toBe('always')
    expect(summarise(b, '2027-01').overall).toBeNull()
    expect(paceLeft(food.left!, '2026-11', new Date(2026, 10, 10))!.days).toBe(21)
  })
})

describe('categories for selected months only', () => {
  const diwali = { ...cat('diwali'), months: ['2026-11'] }
  const b: BudgetData = {
    overall: null,
    instruments: [],
    categories: [cat('food'), diwali, { ...cat('sweets', null, null, 'diwali') }, { ...cat('lamps', null, null, 'food'), months: ['2026-11', '2026-12'] }],
    expenses: [exp('1', '2026-11-05', '800', 'diwali'), exp('2', '2026-12-05', '50', 'diwali'), exp('3', '2026-11-06', '30', 'sweets')],
  }
  it('is active only in its months; a subcategory inherits its parent', () => {
    expect(categoryActiveIn(b, 'diwali', '2026-11')).toBe(true)
    expect(categoryActiveIn(b, 'diwali', '2026-12')).toBe(false)
    expect(categoryActiveIn(b, 'sweets', '2026-12')).toBe(false)
    expect(categoryActiveIn(b, 'lamps', '2026-12')).toBe(true)
    expect(categoryActiveIn(b, 'food', '2030-01')).toBe(true)
  })
  it('the picker for an entry date offers only active categories', () => {
    expect(activeCategories(b, '2026-11').map((c) => c.id)).toEqual(['food', 'diwali', 'sweets', 'lamps'])
    expect(activeCategories(b, '2026-12').map((c) => c.id)).toEqual(['food', 'lamps'])
  })
  it('is hidden from a month with no entries on it, shown with a note when entries exist, and entries are never dropped', () => {
    expect(summarise(b, '2026-11').lines.find((l) => l.id === 'diwali')!.note).toBeNull()
    expect(summarise(b, '2026-10').lines.map((l) => l.id)).toEqual(['food'])
    const dec = summarise(b, '2026-12')
    const line = dec.lines.find((l) => l.id === 'diwali')!
    expect(line.spent.toFixed()).toBe('50')
    expect(line.note).toMatch(/^only for /)
    expect(dec.spent.toFixed()).toBe('50')
    expect(dec.uncategorised.toFixed()).toBe('0')
  })
  it('a new entry on a category that is not active that month is refused; editing an old one is allowed', () => {
    const d = { amount: '10', date: '2026-12-05', categoryId: 'diwali', mode: null, instrumentId: null }
    expect(validateExpense(d, b).category).toContain('not used in')
    expect(validateExpense(d, b, new Date(2026, 11, 5), 'diwali')).toEqual({})
    expect(validateExpense({ ...d, date: '2026-11-05' }, b, new Date(2026, 10, 5))).toEqual({})
  })
  it('a subcategory must stay inside its parent, and a parent must still cover its children', () => {
    expect(validateCategoryMonths(b, 'sweets', ['2026-11'])).toBeNull()
    expect(validateCategoryMonths(b, 'sweets', ['2026-12'])).toContain('inside diwali')
    expect(validateCategoryMonths(b, 'lamps', ['2026-11'])).toBeNull()
    expect(validateCategoryMonths(b, 'food', ['2026-11'])).toContain('lamps')
    expect(validateCategoryMonths(b, 'food', [])).toBe('Pick at least one month')
    expect(validateCategoryMonths(b, 'food', ['2026-13'])).toBe('Pick real months')
    expect(validateCategoryMonths(b, 'food', null)).toBeNull()
  })
})

describe('card details and UPI default', () => {
  it('knows common Indian banks', () => {
    expect(KNOWN_BANKS).toContain('HDFC Bank')
    expect(KNOWN_BANKS.length).toBeGreaterThanOrEqual(20)
  })
  it('the label shows name, product name and last four', () => {
    const i: PayInstrument = { id: 'a', name: 'Tata', kind: 'credit', network: 'rupay', bank: '', last4: '4321', rewardNote: '', deletedAt: null, variant: 'Neo' }
    expect(instrumentLabel(i)).toBe('Tata Neo ••4321')
    expect(instrumentLabel({ ...i, variant: undefined, last4: '' })).toBe('Tata')
  })
  it('checks the new fields', () => {
    const ok = { name: 'x', kind: 'credit' as const, statementDay: 5, dueDay: '28', creditLimit: '2,50,000', annualFee: '0' }
    expect(validateInstrumentFields(ok)).toEqual({})
    expect(validateInstrumentFields({ ...ok, statementDay: 29 }).statementDay).toBe('Enter a day from 1 to 28')
    expect(validateInstrumentFields({ ...ok, dueDay: 0 }).dueDay).toBeDefined()
    expect(validateInstrumentFields({ ...ok, dueDay: 2.5 }).dueDay).toBeDefined()
    expect(validateInstrumentFields({ ...ok, statementDay: null, dueDay: '' })).toEqual({})
    expect(validateInstrumentFields({ ...ok, creditLimit: '0' }).creditLimit).toBeDefined()
    expect(validateInstrumentFields({ ...ok, annualFee: 'abc' }).annualFee).toBeDefined()
    expect(validateInstrumentFields({ ...ok, variant: 'v'.repeat(41) }).variant).toBeDefined()
    expect(validateInstrumentFields({ ...ok, holder: 'h'.repeat(41) }).holder).toBeDefined()
    expect(validateInstrumentFields({ ...ok, kind: 'debit' }).creditLimit).toBe('Only credit cards have a credit limit')
    expect(validateInstrumentFields({ name: 'x', kind: 'bank', upiHandle: 'me@okhdfc', accountType: 'salary' })).toEqual({})
    expect(validateInstrumentFields({ name: 'x', kind: 'bank', upiHandle: 'nohandle' }).upiHandle).toBeDefined()
    expect(validateInstrumentFields({ name: 'x', kind: 'credit', upiHandle: 'me@okhdfc' }).upiHandle).toBeDefined()
    expect(validateInstrumentFields({ name: 'x', kind: 'wallet', accountType: 'savings' }).accountType).toBeDefined()
    expect(validateInstrumentFields({ name: 'x', kind: 'bank', accountType: 'joint' }).accountType).toBeDefined()
  })
  it('cleans money to plain decimal strings, keeps only fields that fit the kind', () => {
    const r = cleanInstrument({ name: 'x', kind: 'credit', creditLimit: '2,50,000', annualFee: '499.50', statementDay: '5', variant: ' Neo ', upiHandle: '' })
    expect(r.ok && r.value).toMatchObject({ creditLimit: '250000', annualFee: '499.5', statementDay: 5, variant: 'Neo' })
    const bank = cleanInstrument({ name: 'HDFC Savings', kind: 'bank', bank: 'HDFC Bank', last4: '1234', upiHandle: 'me@okhdfc', accountType: 'savings' })
    expect(bank.ok && bank.value).toMatchObject({ upiHandle: 'me@okhdfc', accountType: 'savings', last4: '1234' })
    expect(dropInapplicable({ name: 'x', kind: 'debit', creditLimit: '5', accountType: 'savings', upiHandle: 'a@b' })).toMatchObject({ creditLimit: null, accountType: null, upiHandle: '' })
  })
  it('UPI with no instrument is valid, counted under UPI and under No instrument', () => {
    expect(UPI_DEFAULT_LABEL).toBe('Bank account (default)')
    const b: BudgetData = { overall: null, categories: [], instruments: [], expenses: [{ ...exp('1', '2026-11-02', '200', null), mode: 'upi' }, { ...exp('2', '2026-11-03', '50', null), mode: 'cash' }] }
    expect(paymentError(b, 'upi', null)).toBeNull()
    expect(validateExpense({ amount: '5', date: '2026-11-02', categoryId: null, mode: 'upi', instrumentId: null }, b, new Date(2026, 10, 2))).toEqual({})
    const s = summarise(b, '2026-11')
    expect(s.byMode.find((m) => m.id === 'upi')!.spent.toFixed()).toBe('200')
    expect(s.upiDefault.spent.toFixed()).toBe('200')
    expect(s.upiDefault.count).toBe(1)
    expect(s.noInstrument.spent.toFixed()).toBe('250')
    expect(s.byInstrument).toEqual([])
  })
})

describe('settlements', () => {
  const card: PayInstrument = { id: 'cc', name: 'Neo', kind: 'credit', network: 'rupay', bank: '', last4: '', rewardNote: '', deletedAt: null }
  const e = (id: string, date: string, amount: string, over: Partial<BudgetExpense> = {}): BudgetExpense => ({ ...exp(id, date, amount, 'food'), ...over })
  const b: BudgetData = {
    overall: null,
    instruments: [card],
    categories: [cat('food')],
    expenses: [
      e('1', '2026-11-02', '6000.10', { mode: 'credit', instrumentId: 'cc' }),
      e('2', '2026-11-03', '3999.90', { mode: 'upi', instrumentId: 'cc' }),
      e('3', '2026-11-20', '10000', { categoryId: null, instrumentId: 'cc', settlement: 'cardBill' }),
      e('4', '2026-11-21', '5000', { categoryId: null, settlement: 'transfer' }),
    ],
  }
  it('10,000 of purchases plus a 10,000 bill payment shows spend 10,000 and outstanding 0', () => {
    const s = summarise(b, '2026-11')
    expect(s.spent.toFixed(2)).toBe('10000.00')
    expect(cardOutstanding(b, 'cc').toFixed(2)).toBe('0.00')
  })
  it('settlements are listed but in no total, average, category, mode, instrument or top list', () => {
    const s = summarise(b, '2026-11')
    expect(s.entries.map((x) => x.id)).toEqual(['4', '3', '2', '1'])
    expect(s.uncategorised.toFixed()).toBe('0')
    expect(s.noMode.toFixed()).toBe('0')
    expect(s.byMode.reduce((t, m) => t.plus(m.spent), new D(0)).toFixed(2)).toBe('10000.00')
    expect(s.byInstrument[0]!.spent.toFixed(2)).toBe('10000.00')
    expect(spentIn(b, '2026-11').toFixed(2)).toBe('10000.00')
    expect(dailyAverage(s.spent, '2026-11', new Date(2026, 11, 1))!.perDay.toFixed(2)).toBe('333.33')
    expect(topEntries(s.entries, 5).map((x) => x.id)).toEqual(['1', '2'])
    expect(suggestFor({ ...b, expenses: [e('9', '2026-11-22', '1', { note: 'bill', settlement: 'cardBill' })] }, 'bill')).toBeNull()
  })
  it('outstanding is exact, can go negative, and ignores deleted entries', () => {
    expect(cardOutstanding({ expenses: b.expenses.slice(0, 2) }, 'cc').toFixed(2)).toBe('10000.00')
    expect(cardOutstanding({ expenses: [...b.expenses, e('5', '2026-11-22', '0.10', { categoryId: null, instrumentId: 'cc', settlement: 'cardBill' })] }, 'cc').toFixed(2)).toBe('-0.10')
    expect(cardOutstanding({ expenses: [{ ...b.expenses[0]!, deletedAt: 1 }] }, 'cc').toFixed(2)).toBe('0.00')
    expect(cardOutstanding({ expenses: [e('6', '2026-11-02', '70', { mode: 'cash' })] }, 'cc').toFixed(2)).toBe('0.00')
  })
  it('a card bill must name a credit card; a transfer needs nothing', () => {
    const d = { amount: '10', date: '2026-11-02', categoryId: null, mode: null, instrumentId: null }
    expect(validateExpense({ ...d, settlement: 'cardBill' }, b, new Date(2026, 10, 2)).paidWith).toBeDefined()
    expect(validateExpense({ ...d, settlement: 'cardBill', instrumentId: 'cc' }, b, new Date(2026, 10, 2))).toEqual({})
    expect(validateExpense({ ...d, settlement: 'transfer' }, b, new Date(2026, 10, 2))).toEqual({})
  })
})

describe('screen helpers', () => {
  const c = (id: string, over: Record<string, unknown> = {}) => ({ ...cat(id), ...over })
  const e = (id: string, date: string, amount: string, categoryId: string | null, over: Partial<BudgetExpense> = {}): BudgetExpense => ({ ...exp(id, date, amount, categoryId), ...over })

  it('monthWindow centres a month: five before, six after', () => {
    const w = monthWindow('2026-11')
    expect(w).toHaveLength(12)
    expect(w[0]).toBe('2026-06')
    expect(w[5]).toBe('2026-11')
    expect(w[11]).toBe('2027-05')
    expect(monthWindow('2026-02', 3)).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('limitLabel says every-month and this-month-only limits differently', () => {
    expect(limitLabel('₹4,000', 'always', '2026-11')).toBe('Monthly limit ₹4,000')
    expect(limitLabel(null, 'always', '2026-11')).toBe('No limit')
    expect(limitLabel('₹5,000', 'month', '2026-11')).toBe(`Limit ₹5,000 for ${monthShortLabel('2026-11')} only`)
    expect(limitLabel(null, 'month', '2026-11')).toContain('only')
    expect(monthShortLabel('2026-11')).toMatch(/2026/)
  })

  it('recentCategoryIds: newest first, distinct, usable, active in the month, no settlements or deleted', () => {
    const b: BudgetData = {
      overall: null,
      instruments: [],
      categories: [c('a'), c('b'), c('c'), c('d', { months: ['2026-10'] }), c('gone', { deletedAt: 1 })],
      expenses: [
        e('1', '2026-11-01', '1', 'a'),
        e('2', '2026-11-05', '1', 'b'),
        e('3', '2026-11-05', '1', 'c'),
        e('4', '2026-11-09', '1', 'd'),
        e('5', '2026-11-10', '1', 'gone'),
        e('6', '2026-11-11', '1', 'a', { deletedAt: 9 }),
        e('7', '2026-11-12', '1', 'c', { settlement: 'transfer' }),
        e('8', '2026-11-03', '1', 'a'),
        e('9', '2026-11-13', '1', null),
      ],
    }
    expect(recentCategoryIds(b, 5, '2026-11')).toEqual(['b', 'c', 'a'])
    expect(recentCategoryIds(b, 1, '2026-11')).toEqual(['b'])
    expect(recentCategoryIds(b, 5, '2026-10')).toEqual(['d', 'b', 'c', 'a'])
  })

  it('monthWeeks starts on Monday and pads to whole weeks', () => {
    // 1 Nov 2026 is a Sunday: six empty slots, then 1 on the Sunday.
    const w = monthWeeks('2026-11')
    expect(w[0]).toEqual([null, null, null, null, null, null, 1])
    expect(w[1]![0]).toBe(2)
    expect(w.every((r) => r.length === 7)).toBe(true)
    expect(w.flat().filter((x) => x !== null)).toHaveLength(30)
    // 1 Jun 2026 is a Monday: no padding at the start.
    expect(monthWeeks('2026-06')[0]![0]).toBe(1)
  })

  it('dayLongLabel reads like "Mon 3 Nov"', () => {
    expect(dayLongLabel('2026-11-02')).toMatch(/2\b.*\w/)
    expect(dayLongLabel('2026-11-02')).toContain('2')
  })

  describe('dailyTotals', () => {
    const inst = { id: 'cc', name: 'Neo', kind: 'credit' as const, network: 'rupay' as const, bank: '', last4: '', rewardNote: '', deletedAt: null }
    const b: BudgetData = {
      overall: null,
      instruments: [inst],
      categories: [c('food')],
      expenses: [
        e('1', '2026-11-03', '1000.10', 'food', { mode: 'credit', instrumentId: 'cc' }),
        e('2', '2026-11-03', '199.90', 'food'),
        e('3', '2026-11-04', '300', 'food'),
        e('4', '2026-11-05', '600', 'food'),
        e('5', '2026-11-06', '1', 'food'),
        e('6', '2026-11-07', '5000', null, { settlement: 'transfer' }),
        e('7', '2026-11-08', '99', 'food', { deletedAt: 3 }),
        e('8', '2026-10-31', '900', 'food'),
      ],
    }
    it('one row per day, exact sums, counts, levels relative to the biggest day', () => {
      const d = dailyTotals(b, '2026-11')
      expect(d).toHaveLength(30)
      expect(d[2]!.date).toBe('2026-11-03')
      expect(d[2]!.spent.toFixed(2)).toBe('1200.00')
      expect(d[2]!.count).toBe(2)
      expect(d[2]!.level).toBe(4)
      expect(d[3]!.level).toBe(1) // 300 of 1200 = 25%
      expect(d[4]!.level).toBe(2) // 600 of 1200 = 50%
      expect(d[5]!.level).toBe(1) // 1 of 1200
      expect(d[0]!.level).toBe(0)
      expect(d[6]!.spent.toFixed()).toBe('0') // a settlement is not spending
      expect(d[6]!.count).toBe(0)
      expect(d[7]!.spent.toFixed()).toBe('0') // deleted
    })
    it('levels step up at 25, 50 and 75 percent', () => {
      const mk = (a: string): BudgetData => ({ ...b, expenses: [e('x', '2026-11-01', '100', 'food'), e('y', '2026-11-02', a, 'food')] })
      expect(dailyTotals(mk('25'), '2026-11')[1]!.level).toBe(1)
      expect(dailyTotals(mk('25.01'), '2026-11')[1]!.level).toBe(2)
      expect(dailyTotals(mk('75'), '2026-11')[1]!.level).toBe(3)
      expect(dailyTotals(mk('75.01'), '2026-11')[1]!.level).toBe(4)
    })
    it('respects the filter and an empty month is all zero', () => {
      const only = dailyTotals(b, '2026-11', { instrumentId: 'cc' })
      expect(only[2]!.spent.toFixed(2)).toBe('1000.10')
      expect(only[2]!.level).toBe(4)
      expect(only[3]!.spent.toFixed()).toBe('0')
      expect(dailyTotals(b, '2026-12').every((x) => x.level === 0 && x.count === 0)).toBe(true)
    })
  })

  it('owesWords', () => {
    const m = (v: InstanceType<typeof D>) => `₹${v.toFixed(2)}`
    expect(owesWords(new D('1200.5'), m)).toBe('Owes ₹1200.50')
    expect(owesWords(new D('-10'), m)).toBe('Paid ₹10.00 ahead')
    expect(owesWords(new D(0), m)).toBe('Nothing owed')
  })
})

describe('card utilisation and cost', () => {
  const money = (v: InstanceType<typeof D>) => `₹${v.toFixed(0)}`
  it('says how much of the limit is used, in words', () => {
    expect(utilisationWords(new D(51000), '150000', money)).toBe('Using 34% of ₹150000 limit')
    expect(utilisationWords(new D(0), '150000', money)).toBe('Using 0% of ₹150000 limit')
  })
  it('paid ahead counts as 0%; over the limit says so in words', () => {
    expect(utilisationWords(new D(-500), '150000', money)).toBe('Using 0% of ₹150000 limit')
    expect(utilisationWords(new D(165000), '150000', money)).toBe('Using 110% of ₹150000 limit, over the limit')
  })
  it('shows nothing without a usable limit, and never divides by zero', () => {
    expect(utilisationWords(new D(100), null, money)).toBeNull()
    expect(utilisationWords(new D(100), undefined, money)).toBeNull()
    expect(utilisationWords(new D(100), '0', money)).toBeNull()
    expect(utilisationWords(new D(100), 'abc', money)).toBeNull()
  })

  const b: BudgetData = {
    overall: null,
    instruments: [],
    categories: [cat('food'), cat('fees'), cat('life', null, null, null), { ...cat('late', null, null, 'fees'), name: 'Late payment' }, { ...cat('int', null, 1), name: 'Interest' }],
    expenses: [
      { ...exp('1', '2026-03-02', '300', 'fees'), instrumentId: 'cc', mode: 'credit' },
      { ...exp('2', '2026-04-02', '40.50', 'late'), instrumentId: 'cc', mode: 'credit' }, // a subcategory of Fees
      { ...exp('3', '2026-04-03', '999', 'food'), instrumentId: 'cc', mode: 'credit' }, // ordinary spending
      { ...exp('4', '2025-12-03', '700', 'fees'), instrumentId: 'cc', mode: 'credit' }, // another year
      { ...exp('5', '2026-05-03', '50', 'fees'), instrumentId: 'other', mode: 'credit' }, // another card
      { ...exp('6', '2026-05-04', '60', 'fees', 9), instrumentId: 'cc', mode: 'credit' }, // deleted
    ],
  }
  it('only categories the user named interest, fee or charge count, parent or sub', () => {
    expect(isCostCategory(b, 'fees')).toBe(true)
    expect(isCostCategory(b, 'late')).toBe(true)
    expect(isCostCategory(b, 'food')).toBe(false)
    expect(isCostCategory(b, null)).toBe(false)
  })
  it('adds the annual fee and the recorded charges for one year, exactly', () => {
    const r = cardCostIn(b, { id: 'cc', annualFee: '2500' }, 2026, money)
    expect(r.total.toFixed(2)).toBe('2840.50')
    expect(r.words).toBe('In 2026 this card has cost you ₹2841: ₹2500 annual fee and ₹341 in interest and fees you recorded.')
  })
  it('says plainly when nothing is recorded', () => {
    expect(cardCostIn({ ...b, expenses: [] }, { id: 'cc', annualFee: null }, 2026, money).words).toBe('No annual fee, interest or fees recorded for this card in 2026.')
    expect(cardCostIn({ ...b, expenses: [] }, { id: 'cc', annualFee: '500' }, 2026, money).words).toBe('In 2026 this card has cost you ₹500: ₹500 annual fee.')
  })
})

// ---------------------------------------------------------------- Phase 2: refunds, statement cycles, search, trips
import { categoryTotal, cycleRange, entriesIn, searchEntries, signedAmount } from './budget'

const ex = (id: string, date: string, amount: string, o: Partial<BudgetExpense> = {}): BudgetExpense => ({ id, date, amount, categoryId: null, mode: null, instrumentId: null, note: '', deletedAt: null, ...o })
const cats = [cat('shop'), cat('travel'), cat('goa', null, null, 'travel'), cat('fuel', null, null, 'travel')]
const insts: PayInstrument[] = [
  { id: 'cc', name: 'HDFC Regalia', kind: 'credit', network: 'visa', bank: 'HDFC Bank', last4: '4321', rewardNote: '', deletedAt: null, statementDay: 15, dueDay: 5 },
]

describe('refunds', () => {
  const b: BudgetData = {
    overall: '1000', instruments: insts, categories: cats,
    expenses: [
      ex('1', '2026-11-02', '1000', { categoryId: 'shop', mode: 'credit', instrumentId: 'cc' }),
      ex('2', '2026-11-04', '300.50', { categoryId: 'shop', mode: 'credit', instrumentId: 'cc', refund: true }),
      ex('3', '2026-11-04', '50', { categoryId: 'shop', mode: 'cash' }),
    ],
  }
  it('signedAmount is negative only for a refund', () => {
    expect(signedAmount(b.expenses[0]!).toFixed(2)).toBe('1000.00')
    expect(signedAmount(b.expenses[1]!).toFixed(2)).toBe('-300.50')
  })
  it('lowers the total, the category, the mode, the card and the limit left', () => {
    const s = summarise(b, '2026-11')
    expect(s.spent.toFixed(2)).toBe('749.50')
    expect(s.lines.find((l) => l.id === 'shop')!.spent.toFixed(2)).toBe('749.50')
    expect(s.byMode.find((m) => m.id === 'credit')!.spent.toFixed(2)).toBe('699.50')
    expect(s.byInstrument[0]!.spent.toFixed(2)).toBe('699.50')
    expect(s.overall!.left.toFixed(2)).toBe('250.50')
    expect(s.entries).toHaveLength(3) // refunds are listed, and counted as entries
    expect(s.lines.find((l) => l.id === 'shop')!.count).toBe(3)
  })
  it('lowers the daily total, the month sum, the trend and what the card owes', () => {
    expect(dailyTotals(b, '2026-11').find((d) => d.day === 4)!.spent.toFixed(2)).toBe('-250.50')
    expect(spentIn(b, '2026-11').toFixed(2)).toBe('749.50')
    expect(trend(b, '2026-11', 2).map((t) => t.spent.toFixed(2))).toEqual(['0.00', '749.50'])
    expect(cardOutstanding(b, 'cc').toFixed(2)).toBe('699.50')
  })
  it('is not one of the biggest spends', () => {
    expect(topEntries(b.expenses, 5).map((e) => e.id)).toEqual(['1', '3'])
  })
  it('a category with only a refund is still shown (net negative), not hidden', () => {
    const only: BudgetData = { ...b, expenses: [ex('r', '2026-11-04', '200', { categoryId: 'shop', refund: true })] }
    const s = summarise(only, '2026-11')
    expect(s.spent.toFixed(2)).toBe('-200.00')
    expect(s.lines.map((l) => l.id)).toContain('shop')
  })
  it('still refuses a zero or negative amount for any entry', () => {
    expect(validateAmount('0')).toBe('Enter an amount above zero')
    expect(validateAmount('-5')).toBe('Enter an amount above zero')
  })
  it('a refund is never one of the shares of a total that is not above zero', () => {
    expect(sharePercent(new D(-5), new D(-5))).toBe(0)
  })
  it('compare: a negative earlier month gives no percentage', () => {
    const neg: BudgetData = { ...b, expenses: [ex('r', '2026-10-04', '200', { categoryId: 'shop', refund: true }), ex('s', '2026-11-04', '100', { categoryId: 'shop' })] }
    expect(compareLastMonth(neg, '2026-11', new Date(2026, 10, 20))!.pct).toBeNull()
  })
})

describe('statement cycle', () => {
  it('ends on the statement day and starts the day after the previous one', () => {
    expect(cycleRange(15, '2026-11')).toEqual({ from: '2026-10-16', to: '2026-11-15' })
    expect(cycleRange(15, '2026-01')).toEqual({ from: '2025-12-16', to: '2026-01-15' })
    expect(cycleRange(1, '2026-03')).toEqual({ from: '2026-02-02', to: '2026-03-01' })
  })
  it('day 28 starts on the 1st after a 28-day February', () => {
    expect(cycleRange(28, '2026-03')).toEqual({ from: '2026-03-01', to: '2026-03-28' })
    expect(cycleRange(28, '2026-02')).toEqual({ from: '2026-01-29', to: '2026-02-28' })
  })
  const b: BudgetData = {
    overall: null, instruments: insts, categories: cats,
    expenses: [
      ex('a', '2026-10-15', '100', { mode: 'credit', instrumentId: 'cc' }), // last cycle
      ex('b', '2026-10-16', '200', { mode: 'credit', instrumentId: 'cc' }), // first day of this cycle
      ex('c', '2026-11-15', '400', { mode: 'credit', instrumentId: 'cc' }), // last day of this cycle
      ex('d', '2026-11-16', '800', { mode: 'credit', instrumentId: 'cc' }), // next cycle
      ex('e', '2026-11-01', '1600', { mode: 'cash' }), // not this card
    ],
  }
  it('uses the entry date to decide which cycle an entry is in', () => {
    expect(entriesIn(b, '2026-11', 15).map((e) => e.id).sort()).toEqual(['b', 'c', 'e'])
    const s = summarise(b, '2026-11', { instrumentId: 'cc', cycleDay: 15 })
    expect(s.spent.toFixed(2)).toBe('600.00')
    expect(summarise(b, '2026-11', { instrumentId: 'cc' }).spent.toFixed(2)).toBe('1200.00') // calendar month: c + d
  })
  it('the trend counts one cycle per step and every cycle once', () => {
    const t = trend(b, '2026-11', 3, { instrumentId: 'cc', cycleDay: 15 })
    expect(t.map((x) => x.spent.toFixed(2))).toEqual(['0.00', '100.00', '600.00'])
    expect(spentIn(b, '2026-12', { instrumentId: 'cc', cycleDay: 15 }).toFixed(2)).toBe('800.00')
  })
})

describe('search', () => {
  const b: BudgetData = {
    overall: null, instruments: insts, categories: cats,
    expenses: [
      ex('1', '2026-11-02', '1200', { categoryId: 'goa', mode: 'credit', instrumentId: 'cc', note: 'Beach Shack lunch' }),
      ex('2', '2026-11-03', '250', { categoryId: 'shop', mode: 'upi', note: 'Chai' }),
      ex('3', '2026-11-04', '99.5', { categoryId: 'shop', refund: true, note: 'Returned shirt' }),
      ex('4', '2026-11-05', '5000', { settlement: 'cardBill', instrumentId: 'cc' }),
    ],
  }
  const ids = (q: string) => searchEntries(b, b.expenses, q).map((e) => e.id)
  it('finds by note, ignoring case', () => expect(ids('BEACH')).toEqual(['1']))
  it('finds by category and by its parent', () => {
    expect(ids('goa')).toEqual(['1'])
    expect(ids('travel')).toEqual(['1'])
  })
  it('finds by card name, payment mode and amount (commas and the rupee sign are ignored)', () => {
    expect(ids('regalia')).toEqual(['1', '4'])
    expect(ids('upi')).toEqual(['2'])
    expect(ids('₹1,200')).toEqual(['1'])
    expect(ids('99.5')).toEqual(['3'])
  })
  it('finds a refund by the word, and a bill payment by its kind', () => {
    expect(ids('refund')).toEqual(['3'])
    expect(ids('card bill')).toEqual(['4'])
  })
  it('every word must match; an empty query matches everything', () => {
    expect(ids('beach upi')).toEqual([])
    expect(ids('  ')).toHaveLength(4)
  })
})

describe('trip or event as a subcategory', () => {
  const b: BudgetData = {
    overall: null, instruments: [], categories: cats,
    expenses: [
      ex('1', '2026-11-02', '1000.50', { categoryId: 'goa' }),
      ex('2', '2026-12-01', '500', { categoryId: 'goa' }),
      ex('3', '2026-12-02', '100', { categoryId: 'goa', refund: true }),
      ex('4', '2026-11-03', '80', { categoryId: 'fuel' }),
      ex('5', '2026-11-03', '9', { categoryId: 'goa', deletedAt: 3 }),
      ex('6', '2026-11-04', '7', { categoryId: 'shop' }),
    ],
  }
  it('counts every entry across months, minus refunds, skipping deleted ones', () => {
    const t = categoryTotal(b, 'goa')
    expect(t.total.toFixed(2)).toBe('1400.50')
    expect(t.count).toBe(3)
  })
  it('a top-level category includes its subcategories', () => {
    const t = categoryTotal(b, 'travel')
    expect(t.total.toFixed(2)).toBe('1480.50')
    expect(t.count).toBe(4)
  })
  it('can be narrowed to a period', () => {
    expect(categoryTotal(b, 'goa', { from: '2026-11-01', to: '2026-11-30' }).total.toFixed(2)).toBe('1000.50')
  })
  it('the month summary gives the same counts', () => {
    const s = summarise(b, '2026-11')
    const travel = s.lines.find((l) => l.id === 'travel')!
    expect(travel.count).toBe(2)
    expect(travel.children.find((c) => c.id === 'goa')!.count).toBe(1)
  })
})
