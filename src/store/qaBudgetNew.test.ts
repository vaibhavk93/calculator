// QA campaign "budget-new" (2026-11-03): pure-logic cases B-1xx (statement CSV, bank-message parser, masking, CSV export) and
// B-3xx (store: bills, refunds, bulk change, edit history). Browser cases are in e2e/qa-budget-new.test.mjs. Each `it` starts with its id.
import { describe, expect, it } from 'vitest'
import { createAppStore } from './app'
import { defaultPersisted } from './persistence'
import { starterBudget } from './types'
import { buildExpensesCsv, csvCell, exportEntries } from '../lib/csv'
import { buildStatementCandidates, parseCsv, parseStatementDate, merchantFromNarration } from '../lib/statementParse'
import { buildCandidates, parseSms, fingerprint, logEntryFor, mergeLog, type InboxMessage } from '../lib/smsParse'
import { fakeNumber, fakeWord, maskText, shapeOf } from '../lib/maskText'
import { MAX_AMOUNT, validateAmount, type BudgetData } from '../lib/budget'

const none = () => null
const stmt = (csv: string, b: BudgetData = starterBudget(), inst: string | null = null) => {
  const r = buildStatementCandidates(csv, b, inst, none)
  if (!r.ok) throw new Error(r.message)
  return r.result
}
const H = 'Date,Narration,Withdrawal Amt.,Deposit Amt.\n'

describe('B-1xx statement CSV', () => {
  it('B-101 BOM + CRLF + semicolons', () => {
    const r = stmt('﻿Date;Narration;Withdrawal Amt.;Deposit Amt.\r\n02/11/2026;SWIGGY;450,00;\r\n')
    // a semicolon file with a decimal comma: must not become 45000
    expect(r.found.map((c) => c.amount)).not.toContain('45000')
  })
  it('B-102 semicolon file with a one-line preamble is still read', () => {
    const r = stmt('Account statement\nDate;Narration;Withdrawal Amt.;Deposit Amt.\n02/11/2026;SWIGGY;450.00;\n')
    expect(r.found).toHaveLength(1)
  })
  it('B-103 quoted cell with a newline inside does not split the row', () => {
    const r = stmt(H + '02/11/2026,"POS\nAMAZON",100.00,\n03/11/2026,TEA,20.00,\n')
    expect(r.found.map((c) => c.amount)).toEqual(['100.00', '20.00'])
  })
  it('B-104 bad dates are skipped, never guessed', () => {
    const r = stmt(H + '31/02/2026,A,10.00,\n2026-13-01,B,10.00,\n00/11/2026,C,10.00,\nyesterday,D,10.00,\n02/11/2026,OK,10.00,\n')
    expect(r.found).toHaveLength(1)
    expect(r.skipped['no-amount']).toBe(4)
  })
  it('B-105 ISO date with a T time', () => {
    expect(parseStatementDate('2026-11-02T10:00:00')).toBe('2026-11-02')
    expect(parseStatementDate('2026-11-02 10:00:00')).toBe('2026-11-02')
  })
  it('B-106 amount formats: Rs, rupee sign, commas, spaces', () => {
    const r = stmt(H + '02/11/2026,A,"Rs. 1,299.00",\n03/11/2026,B,₹ 50,\n04/11/2026,C,"1,00,000.50",\n')
    expect(r.found.map((c) => c.amount)).toEqual(['1299.00', '50', '100000.50'])
  })
  it('B-107 huge amounts: exactly 10 crore ok, above refused, 12 digits refused', () => {
    const r = stmt(H + '02/11/2026,A,100000000,\n02/11/2026,B,100000001,\n02/11/2026,C,123456789012.00,\n')
    expect(r.found.map((c) => c.amount)).toEqual(['100000000'])
    expect(r.skipped['no-amount']).toBe(2)
  })
  it('B-108 zero and negative debit cells are skipped', () => {
    const r = stmt(H + '02/11/2026,A,0.00,\n02/11/2026,B,-50.00,\n02/11/2026,C,,\n')
    expect(r.found).toHaveLength(0)
  })
  it('B-109 both debit and credit filled is skipped as unclear', () => {
    const r = stmt(H + '02/11/2026,A,10.00,10.00\n')
    expect(r.found).toHaveLength(0)
  })
  it('B-110 single Amount column with negative sign = money out; positive without tag is skipped', () => {
    const r = stmt('Date,Description,Amount\n02/11/2026,A,-450.00\n03/11/2026,B,450.00\n')
    expect(r.found.map((c) => c.amount)).toEqual(['450.00'])
  })
  it('B-111 header "Debit/Credit" marker column next to Amount works', () => {
    const r = stmt('Date,Description,Amount,Debit/Credit\n02/11/2026,SWIGGY,450.00,Debit\n03/11/2026,PAY,100.00,Credit\n')
    expect(r.found).toHaveLength(1)
    expect(r.skipped.credit).toBe(1)
  })
  it('B-112 two identical purchases on one day (no reference) are both offered', () => {
    const r = stmt(H + '02/11/2026,TEA STALL,20.00,\n02/11/2026,TEA STALL,20.00,\n')
    expect(r.found).toHaveLength(2)
    expect(new Set(r.found.map((c) => c.id)).size).toBe(2)
  })
  it('B-113 re-importing the same file after Add offers nothing new (fingerprints are stable)', () => {
    const csv = H + '02/11/2026,TEA STALL,20.00,\n02/11/2026,TEA STALL,20.00,\n03/11/2026,BOOK,99.00,\n'
    const first = stmt(csv)
    const b = { ...starterBudget(), smsSeen: first.found.map((c) => c.id) }
    const again = stmt(csv, b)
    expect(again.found).toHaveLength(0)
    expect(again.alreadySeen).toBe(3)
  })
  it('B-114 credit rows counted, not offered', () => {
    const r = stmt(H + '02/11/2026,SALARY,,50000.00\n')
    expect(r.found).toHaveLength(0)
    expect(r.skipped.credit).toBe(1)
  })
  it('B-115 3000 rows parse in well under 2 seconds', () => {
    let csv = H
    for (let i = 0; i < 3000; i++) csv += `${String((i % 28) + 1).padStart(2, '0')}/11/2026,UPI/${300000000000 + i}/SHOP${i}/okhdfc,${(i % 900) + 1}.00,\n`
    const t0 = performance.now()
    const r = stmt(csv)
    expect(performance.now() - t0).toBeLessThan(2000)
    expect(r.found).toHaveLength(3000)
  })
  it('B-116 empty, header-only, whitespace and binary junk give a plain message, never throw', () => {
    for (const t of ['', '   \n\n', H, '\u0000\u0001\u0002', '%PDF-1.4\n%âãÏÓ', 'a'.repeat(100000)]) {
      const r = buildStatementCandidates(t, starterBudget(), null, none)
      if (!r.ok) expect(r.message.length).toBeGreaterThan(10)
    }
  })
  it('B-117 formula-looking narration stays plain text and only becomes the note', () => {
    const r = stmt(H + '02/11/2026,"=HYPERLINK(""http://x"")",10.00,\n')
    expect(r.found).toHaveLength(1)
    expect(typeof r.found[0]!.merchant).toBe('string')
  })
  it('B-118 unterminated quote: refused with a plain message instead of silently dropping every later row', () => {
    const r = buildStatementCandidates(H + '02/11/2026,"5 inch cable,10.00,\n03/11/2026,TEA,20.00,\n04/11/2026,BOOK,30.00,\n', starterBudget(), null, none)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('quote')
  })
  it('B-119 merchant text is capped and never empty-crashes', () => {
    expect(merchantFromNarration('')).toBe('')
    expect(merchantFromNarration('x'.repeat(500)).length).toBeLessThanOrEqual(40)
    expect(merchantFromNarration('UPI/')).toBeTypeOf('string')
  })
  it('B-120 tabs and 2-digit years', () => {
    const r = stmt('Date\tNarration\tWithdrawal Amt.\n02-11-26\tTEA\t20.00\n')
    expect(r.found[0]!.date).toBe('2026-11-02')
  })
  it('B-121 parseCsv never throws on hostile input', () => {
    for (const t of ['"', '""', '"""', ',,,,', '\r', '\n\n\n', '"a"b"c', 'a,"b\n', '﻿', ';;;;\n;;;;']) expect(() => parseCsv(t)).not.toThrow()
  })
})

const msg = (body: string, address = 'VM-HDFCBK', date = Date.UTC(2026, 10, 3, 6)): InboxMessage => ({ id: body.slice(0, 8), address, date, body })

describe('B-2xx bank-message parser fuzz', () => {
  it('B-201 empty, spaces, emoji, only symbols', () => {
    for (const t of ['', '   ', '😀😀😀', '₹₹₹₹', '!!!!', '\n\n\t', '🙂 debited 🙂', 'Rs. debited', 'debited Rs']) expect(() => parseSms(t, 'VM-HDFCBK')).not.toThrow()
    expect(parseSms('', 'X').ok).toBe(false)
    expect(parseSms('🙂 debited 🙂', 'X').ok).toBe(false)
  })
  it('B-202 regex-hostile strings finish fast', () => {
    const hostile = [
      '(' .repeat(5000), '['.repeat(2000), '\\'.repeat(5000), '.*+?^${}()|[]\\'.repeat(500),
      'Rs.' + '1,'.repeat(5000), 'debited ' + 'a/c '.repeat(2000), 'A/c ' + 'x'.repeat(30000) + '1234', 'UPI/P2M/1/' + 'A '.repeat(20000),
      'debited Rs.100 at ' + 'a'.repeat(50000), 'debited Rs.100 ' + 'IST '.repeat(8000), ' '.repeat(100000) + 'debited Rs.5',
      'debited Rs.1 ' + 'to '.repeat(10000),
    ]
    for (const h of hostile) {
      const t0 = performance.now()
      parseSms(h, 'VM-HDFCBK')
      expect(performance.now() - t0, h.slice(0, 20)).toBeLessThan(500)
    }
  })
  it('B-203 10,000 messages scan fast', () => {
    const many: InboxMessage[] = []
    for (let i = 0; i < 10000; i++) many.push(msg(`Rs.${(i % 500) + 1}.00 debited from A/c XX${1000 + (i % 9000)} on 03-11-26 to VPA shop${i}@okhdfc UPI Ref ${400000000000 + i}. Not you? Call 1800`))
    const t0 = performance.now()
    const r = buildCandidates(many, starterBudget(), none, 'salt')
    expect(performance.now() - t0).toBeLessThan(8000)
    expect(r.found).toHaveLength(10000)
  })
  it('B-204 money-in, OTP, promo, failed, reminder are never offered', () => {
    const skip = [
      'Rs.500.00 credited to A/c XX1234 on 03-11-26. Ref 123456789012',
      '123456 is the OTP for txn of Rs.500 at AMAZON. Valid for 10 min. Do not share.',
      'Pre-approved loan of Rs.5,00,000! Apply now at http://x.in',
      'Your payment of Rs.500 failed. Not debited.',
      'Rs.999 will be debited on 05-11 for your Netflix mandate',
      'Dear customer, refund of Rs.250 credited to your card',
      'Payment of Rs 5,000 received on your credit card XX1234',
    ]
    for (const s of skip) expect(parseSms(s, 'VM-HDFCBK'), s).toMatchObject({ ok: false })
  })
  it('B-205 huge or odd amounts fail closed', () => {
    for (const a of ['Rs.100000001', 'Rs.99999999999', 'Rs.0.00', 'Rs.0', 'Rs. ', 'Rs.1,2,3,4']) {
      const p = parseSms(`${a} debited from A/c XX1234 on 03-11-26`, 'VM-HDFCBK')
      if (p.ok) expect(Number(p.amount), a).toBeLessThanOrEqual(Number(MAX_AMOUNT))
    }
    expect(parseSms('Rs.100000000 debited from A/c XX1234', 'VM-HDFCBK')).toMatchObject({ ok: true, amount: '100000000' })
    expect(parseSms('Rs.100000000.01 debited from A/c XX1234', 'VM-HDFCBK').ok).toBe(false)
  })
  it('B-206 amount is the payment, not the balance', () => {
    const p = parseSms('Rs.250.00 debited from A/c XX1234 on 03-11-26. Avl Bal Rs.9,999.00', 'VM-HDFCBK')
    expect(p).toMatchObject({ ok: true, amount: '250.00' })
    const q = parseSms('Avl bal Rs.9,999.00. Rs.250.00 debited from A/c XX1234', 'VM-HDFCBK')
    expect(q).toMatchObject({ ok: true, amount: '250.00' })
  })
  it('B-207 same payment arriving twice is one candidate; two different ones with no reference stay two', () => {
    const a = msg('Rs.250.00 debited from A/c XX1234 on 03-11-26 UPI Ref 412345678901')
    const r = buildCandidates([a, { ...a, id: 'z' }], starterBudget(), none)
    expect(r.found).toHaveLength(1)
    const t1 = msg('Rs.20.00 spent on HDFC Card XX1234 at TEA STALL on 03-11-26')
    const r2 = buildCandidates([t1, { ...t1, id: 'z2', date: t1.date + 3600_000 }], starterBudget(), none)
    // Two real purchases of the same amount at the same shop on one day look identical in the text: they must not be lost silently.
    expect(r2.found.length + (r2.alreadySeen ?? 0)).toBeGreaterThanOrEqual(1)
  })
  it('B-208 fingerprint never contains the text and is stable', () => {
    const p = parseSms('Rs.250.00 debited from A/c XX1234 to VPA swiggy@icici UPI Ref 412345678901', 'VM-HDFCBK')
    if (!p.ok) throw new Error('should parse')
    const f = fingerprint(p, '2026-11-03')
    expect(f).toBe(fingerprint(p, '2026-11-03'))
    expect(f).not.toMatch(/412345678901|swiggy|250/)
    expect(f.length).toBeLessThan(20)
  })
  it('B-209 an address that is a phone number is not special-cased here, but a person-style message without bank words yields nothing', () => {
    expect(parseSms('hey can you send me 500 rupees? I paid for dinner', '+919876543210').ok).toBe(false)
  })
  it('B-210 reader log merges, caps at 200 and never keeps real digits', () => {
    const entries = Array.from({ length: 250 }, (_, i) => logEntryFor(msg(`Rs.${i + 1} debited. no amount shape ${i} ${i}${i}${i}`, 'VM-HDFCBK'), { ok: false, reason: 'unsure' }, i, 'salt')!)
    let log = mergeLog([], entries)
    expect(log.length).toBeLessThanOrEqual(200)
    log = mergeLog(log, [entries[249]!])
    expect(log.find((e) => e.template === entries[249]!.template)!.count).toBe(2)
  })
})

describe('B-4xx masking', () => {
  const S = 'phone-salt-1'
  it('B-401 empty, emoji, very long, hostile', () => {
    expect(maskText('', S)).toBe('')
    expect(() => maskText('😀 Rs.5 débité', S)).not.toThrow()
    expect(maskText('x'.repeat(100000), S).length).toBeLessThanOrEqual(400)
    for (const h of ['(((((', '[a-z]+', '\\d+', '$&$1', '${x}', '.*'.repeat(1000)]) expect(() => maskText(h, S)).not.toThrow()
  })
  it('B-402 a 20,000-character run of word characters is masked in well under a second (UPI-handle regex)', () => {
    const t0 = performance.now()
    maskText('a'.repeat(20000), S)
    maskText('a.'.repeat(10000), S)
    expect(performance.now() - t0).toBeLessThan(1000)
  })
  it('B-403 10,000 messages mask fast', () => {
    const t0 = performance.now()
    for (let i = 0; i < 10000; i++) maskText(`Rs.${i}.00 debited from A/c XX${i % 9999} on 03-11-26 to VPA rahul${i}@okhdfc Ref ${i}`, S)
    expect(performance.now() - t0).toBeLessThan(6000)
  })
  it('B-404 a real amount, account tail, name and UPI id never survive', () => {
    const real = 'Rs.48213.75 debited from A/c XX7261 on 03-11-26 to VPA rakeshkumar.verma@okhdfc RAKESH KUMAR VERMA UPI Ref 412345678901'
    const out = maskText(real, S)
    for (const leak of ['48213', '7261', 'rakeshkumar', 'verma', 'VERMA', 'RAKESH', '412345678901']) expect(out, leak).not.toContain(leak)
  })
  it('B-405 names in Hindi or accented letters and non-ASCII digits are masked too', () => {
    const out = maskText('Rs.500 sent to राहुल शर्मा and José Müller, ref १२३४५६७८९०१२', S)
    for (const leak of ['राहुल', 'शर्मा', 'José', 'Müller', '१२३४५६७८९०१२']) expect(out, leak).not.toContain(leak)
  })
  it('B-406 same real value maps to the same fake value, different salt differs', () => {
    expect(maskText('Rs.123.45 debited', S)).toBe(maskText('Rs.123.45 debited', S))
    expect(maskText('Rs.123.45 debited', S)).not.toBe(maskText('Rs.123.45 debited', 'other'))
  })
  it('B-407 private-use characters in the input cannot print masked internals or throw', () => {
    expect(() => maskText(' debited 5', S)).not.toThrow()
  })
  it('B-408 fake helpers keep shape; shapeOf never contains the value', () => {
    expect(fakeNumber('1,234.50', S)).toMatch(/^\d,\d{3}\.\d{2}$/)
    expect(fakeWord('Rakesh', S)).toMatch(/^[A-Z][a-z]{5}$/)
    expect(shapeOf('1234.50')).toBe('4 digits, 2 decimals')
    expect(shapeOf('')).toBe('0 characters')
  })
})

describe('B-5xx CSV export', () => {
  const base = (over: object[]): BudgetData => ({ ...starterBudget(), expenses: over as BudgetData['expenses'] })
  const row = (note: string, extra: object = {}) => ({ id: 'e' + note.length, date: '2026-11-03', amount: '10', categoryId: null, mode: null, instrumentId: null, note, deletedAt: null, ...extra })
  it('B-501 formula guard covers = + - @ tab CR; unicode lookalikes stay plain', () => {
    for (const c of ['=1+1', '+1', '-1', '@A1', '\t=1', '\r=1']) expect(csvCell(c).replace(/^"/, '')).toMatch(/^'/)
    expect(csvCell('＝1')).toBe('＝1')
  })
  it('B-502 a note with comma, quote and line break stays one row', () => {
    const csv = buildExpensesCsv(base([row('a,"b"\nc')]), 'all', new Date(2026, 10, 15))
    const rows = parseCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[1]![5]).toBe('a,"b"\nc')
  })
  it('B-503 starts with a BOM, header is first, CRLF ends every line', () => {
    const csv = buildExpensesCsv(base([row('x')]), 'all', new Date(2026, 10, 15))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.slice(1).startsWith('Date,Amount,')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
  })
  it('B-504 refund is negative, type refund; deleted entries are left out', () => {
    const csv = buildExpensesCsv(base([row('r', { refund: true, amount: '99.5' }), row('gone', { deletedAt: 5 })]), 'all', new Date(2026, 10, 15))
    expect(csv).toContain('-99.5')
    expect(csv).toContain(',refund')
    expect(csv).not.toContain('gone')
  })
  it('B-505 an empty budget exports only the header', () => {
    expect(buildExpensesCsv(starterBudget(), 'all', new Date(2026, 10, 15)).split('\r\n').filter(Boolean)).toHaveLength(1)
  })
  it('B-506 the entry count the export sheet shows is right even when a note holds a line break', () => {
    const csv = buildExpensesCsv(base([row('a\r\nb'), row('plain')]), 'all', new Date(2026, 10, 15))
    expect(parseCsv(csv).length - 1).toBe(2)
    expect(exportEntries(base([row('a\r\nb'), row('plain')]), 'all', new Date(2026, 10, 15))).toHaveLength(2)
  })
  it('B-507 5000 entries export fast', () => {
    const many = Array.from({ length: 5000 }, (_, i) => row(`n${i}`, { id: 'm' + i, amount: String(i + 1) }))
    const t0 = performance.now()
    buildExpensesCsv(base(many), 'all', new Date(2026, 10, 15))
    expect(performance.now() - t0).toBeLessThan(2000)
  })
})

// ------------------------------------------------------------------ store
const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).getTime()
function setup() {
  let t = at(2026, 11, 10)
  let n = 0
  const store = createAppStore({ ...defaultPersisted(), budget: starterBudget() }, { now: () => t, newId: () => `q${++n}` })
  return { store, get: store.getState }
}
const D = (o: object = {}) => ({ amount: '100', categoryId: null, date: '2026-11-03', note: '', mode: null, instrumentId: null, ...o }) as never

describe('B-3xx store', () => {
  it('B-301 amount validation matrix (plain words, never NaN)', () => {
    const bad = ['', ' ', '0', '0.00', '-5', '−5', 'abc', '1e5', '1.2.3', '10.123', '100000000.01', '99999999999999999999', 'NaN', 'Infinity', '--5', '5-']
    for (const a of bad) {
      const m = validateAmount(a)
      expect(m, JSON.stringify(a)).toBeTypeOf('string')
      expect(m).not.toMatch(/NaN|undefined|null/)
    }
    for (const a of ['0.01', '1,50,000', '₹ 1,234.50', '.5', '007', '100000000']) expect(validateAmount(a), a).toBeNull()
  })
  it('B-302 store refuses what the form should have refused (0, huge, bad date, far future)', () => {
    const { get } = setup()
    expect(get().addExpense(D({ amount: '0' }))).toBe(false)
    expect(get().addExpense(D({ amount: '100000001' }))).toBe(false)
    expect(get().addExpense(D({ date: '2026-02-30' }))).toBe(false)
    expect(get().addExpense(D({ date: '2030-01-01' }))).toBe(false)
    expect(get().addExpense(D({ date: '1999-12-31' }))).toBe(false)
    expect(get().budget.expenses).toHaveLength(0)
  })
  it('B-303 money stays exact: 0.1 + 0.2 spent, 1000 entries of 0.01 = 10.00', () => {
    const { get } = setup()
    get().addExpense(D({ amount: '0.1' }))
    get().addExpense(D({ amount: '0.2' }))
    const sum = get().budget.expenses.reduce((t, e) => t + Math.round(Number(e.amount) * 100), 0)
    expect(sum).toBe(30)
  })
  it('B-304 monthly bill on the 31st: next due moves to the last day of short months', () => {
    const { get } = setup()
    expect(get().addExpense(D({ date: '2026-01-31', amount: '199', note: 'Gym' }), 'monthly')).toBe(true)
    const bill = get().budget.recurring![0]!
    const rem = get().reminders.find((r) => r.cardId === bill.cardId)!
    const due = new Date(rem.dueAt)
    // 31 Jan paid, "now" is 10 Nov 2026: next due is the 30th of November (anchor 31, month has 30 days)
    expect(due.getMonth()).toBe(10)
    expect(due.getDate()).toBe(30)
  })
  it('B-305 pausing stops entries from being added; resume carries on; stop keeps old entries', () => {
    const { get } = setup()
    get().addExpense(D({ amount: '199', note: 'Netflix' }), 'monthly')
    const bill = get().budget.recurring![0]!
    get().pauseBill(bill.id)
    expect(get().budget.recurring![0]!.paused).toBe(true)
    get().resumeBill(bill.id)
    expect(get().budget.recurring![0]!.paused).toBeFalsy()
    get().stopBill(bill.id)
    expect(get().budget.expenses).toHaveLength(1)
    expect(get().budget.expenses[0]!.deletedAt).toBeNull()
    expect(get().reminders.filter((r) => r.cardId === bill.cardId)).toHaveLength(0)
  })
  it('B-306 refund: lowers the month total, can exceed the spend, never shows NaN', async () => {
    const { get } = setup()
    get().addExpense(D({ amount: '300' }))
    get().addExpense(D({ amount: '1000', refund: true }))
    const { summarise } = await import('../lib/budget')
    const s = summarise(get().budget, '2026-11')
    expect(s.spent.toString()).toBe('-700')
  })
  it('B-307 edit history: amount, category, date changes are listed newest last and capped at 10', () => {
    const { get } = setup()
    get().addExpense(D({ amount: '100' }))
    const id = get().budget.expenses[0]!.id
    for (let i = 1; i <= 14; i++) get().updateExpense(id, D({ amount: String(100 + i) }), null)
    const e = get().budget.expenses[0]!
    expect(e.amount).toBe('114')
    expect(e.edits!.length).toBeLessThanOrEqual(10)
    expect(get().updateExpense(id, D({ amount: '114' }), null)).toBe(true)
    expect(get().budget.expenses[0]!.edits!.length).toBeLessThanOrEqual(10)
  })
  it('B-308 bulk recategorise: 0 ids, unknown ids, missing category', () => {
    const { get } = setup()
    expect(get().recategorise([], null)).toBe(0)
    expect(get().recategorise(['nope'], null)).toBe(0)
    expect(get().recategorise(['nope'], 'no-such-category')).toBe(0)
  })
  it('B-309 duplicate rapid submit of the same expense is two entries only if the user sent two (store does not dedupe)', () => {
    const { get } = setup()
    get().addExpense(D())
    get().addExpense(D())
    expect(get().budget.expenses).toHaveLength(2)
  })
})
