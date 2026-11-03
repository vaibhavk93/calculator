import { describe, expect, it } from 'vitest'
import { buildStatementCandidates, findColumns, merchantFromNarration, parseCsv, parseStatementDate } from './statementParse'
import { starterBudget, type PayInstrument } from './budget'

const none = () => null
const bank = { id: 'b1', name: 'HDFC Savings', kind: 'bank', network: null, bank: 'HDFC Bank', last4: '1234', rewardNote: '', deletedAt: null } as PayInstrument

describe('parseCsv', () => {
  it('handles quotes, commas inside quotes, CRLF and a BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']])
  })
  it('detects semicolons and tabs', () => {
    expect(parseCsv('a;b\n1;2')[1]).toEqual(['1', '2'])
    expect(parseCsv('a\tb\n1\t2')[1]).toEqual(['1', '2'])
  })
})

describe('parseStatementDate', () => {
  it.each([['02/11/2026', '2026-11-02'], ['02-11-26', '2026-11-02'], ['2 Nov 2026', '2026-11-02'], ['02-Nov-2026', '2026-11-02'], ['2026-11-02', '2026-11-02'], ['02/11/2026 14:22', '2026-11-02']])('%s', (a, b) => expect(parseStatementDate(a)).toBe(b))
  it('refuses impossible or unclear dates', () => {
    for (const bad of ['31/02/2026', '13/13/2026', 'yesterday', '', '2026']) expect(parseStatementDate(bad)).toBeNull()
  })
})

describe('merchantFromNarration', () => {
  it('pulls the payee out of UPI and card lines', () => {
    expect(merchantFromNarration('UPI/312345678901/SWIGGY/okhdfcbank')).toBe('Swiggy')
    expect(merchantFromNarration('POS 4321XXXX8765 AMAZON PAY')).toBe('Amazon Pay')
  })
})

const CSV = `HDFC BANK Statement
Account: XXXX1234

Date,Narration,Chq./Ref.No.,Withdrawal Amt.,Deposit Amt.,Closing Balance
02/11/26,UPI-SWIGGY-swiggy@icici-312345678901,312345678901,450.00,,10000.00
03/11/26,SALARY CREDIT,000111,,50000.00,60000.00
04/11/26,"POS 4321XXXX8765 AMAZON, IN",000222,"1,299.00",,58701.00
bad date,SOMETHING,,10.00,,
05/11/26,NOTHING IN OR OUT,,,,`

describe('buildStatementCandidates', () => {
  it('finds the header under a preamble and offers only money out', () => {
    const r = buildStatementCandidates(CSV, { ...starterBudget(), instruments: [bank] }, 'b1', none)
    if (!r.ok) throw new Error(r.message)
    expect(r.result.found.map((c) => [c.date, c.amount, c.instrumentId])).toEqual([['2026-11-02', '450.00', 'b1'], ['2026-11-04', '1299.00', 'b1']])
    expect(r.result.skipped).toEqual({ credit: 1, 'no-amount': 2 })
    expect(r.result.found[0]!.mode).toBe('upi')
  })
  it('works with a single signed Amount and Dr/Cr column', () => {
    const csv = 'Date,Description,Amount,Dr/Cr\n02/11/2026,SWIGGY,450.00,Dr\n03/11/2026,REFUND,100.00,Cr'
    const r = buildStatementCandidates(csv, starterBudget(), null, none)
    if (!r.ok) throw new Error(r.message)
    expect(r.result.found).toHaveLength(1)
    expect(r.result.skipped.credit).toBe(1)
  })
  it('says plainly when it is not a statement', () => {
    expect(buildStatementCandidates('hello', starterBudget(), null, none).ok).toBe(false)
    expect(buildStatementCandidates('a,b\n1,2', starterBudget(), null, none)).toMatchObject({ ok: false })
    expect(findColumns([['x']])).toBeNull()
  })
  it('does not offer a row twice or one already handled, and flags one already in the budget', () => {
    const csv = 'Date,Narration,Debit\n02/11/2026,SWIGGY,450.00\n02/11/2026,SWIGGY,450.00'
    const once = buildStatementCandidates(csv, starterBudget(), null, none)
    if (!once.ok) throw new Error(once.message)
    expect(once.result.found).toHaveLength(1)
    const again = buildStatementCandidates(csv, { ...starterBudget(), smsSeen: [once.result.found[0]!.id] }, null, none)
    if (!again.ok) throw new Error(again.message)
    expect(again.result.found).toHaveLength(0)
    const b = { ...starterBudget(), expenses: [{ id: 'e', date: '2026-11-02', amount: '450.00', categoryId: null, mode: null, instrumentId: null, note: 'Swiggy', deletedAt: null }] }
    const dup = buildStatementCandidates(csv, b, null, none)
    if (!dup.ok) throw new Error(dup.message)
    expect(dup.result.found[0]!.duplicateOfExisting).toBe(true)
  })
})
