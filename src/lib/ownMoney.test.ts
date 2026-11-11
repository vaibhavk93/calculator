import { describe, expect, it } from 'vitest'
import { accountTails, hasDeposit, natureOf, ownFromText, stripDeposit, type OwnContext } from './ownMoney'
import { buildCandidates, newInstruments, readSms, type ParsedSms } from './smsParse'
import { starterBudget, type BudgetData } from './budget'

/**
 * HONESTY NOTE: every message below is SYNTHETIC. They are written from memory of how Indian banks word deposit, sweep and transfer
 * messages (SBI, HDFC, ICICI, Axis, Kotak, PNB, BoB, Canara, IDFC, Yes), with made-up numbers and names. NO real message was read. The
 * wording of a real bank's text may differ. The table proves the RULES (what is own money, what stays spending, what is not offered),
 * not that any bank still sends exactly this text.
 */

type Want = { kind?: string; direction?: 'out' | 'in'; last4?: string | null; amount?: string; why?: RegExp }
type Row = [label: string, sender: string, body: string, want: Want]

const NO_CTX: OwnContext = { instruments: [] }
const ok = (body: string, sender: string, ctx: OwnContext = NO_CTX): ParsedSms => {
  const r = readSms(body, sender, ctx)
  if (!r.ok) throw new Error(`not offered (${r.reason}): ${body}`)
  return r
}

// ------------------------------------------------------------------------------------------------ own money going OUT
const OWN_OUT: Row[] = [
  ['SBI term deposit opened (the TD digits are not the account)', 'AD-SBIINB', 'Dear Customer, Rs.50,000.00 debited from your A/c XXXXX123456 on 05-11-26 for opening of Term Deposit A/c XXXXXXX987654. -SBI', { kind: 'fdOpen', last4: '3456', amount: '50000.00' }],
  ['SBI "TD A/c" booked from the savings account', 'AD-SBIINB', 'Rs 25,000.00 debited from A/c X1234 on 05Nov26 towards TD A/c 12345678901 booking. -SBI', { kind: 'fdOpen', last4: '1234' }],
  ['HDFC fixed deposit booking, FD number', 'VM-HDFCBK', 'Rs 1,00,000.00 debited from a/c XX1234 on 05-11-26 towards Fixed Deposit booking. FD No 50100012345678', { kind: 'fdOpen', last4: '1234' }],
  ['ICICI FD created', 'VM-ICICIB', 'Dear Customer, INR 75,000.00 debited from your ICICI Bank A/c XX4321 on 05-Nov-26 for FD creation. FD A/c 000412345678', { kind: 'fdOpen', last4: '4321' }],
  ['Axis FD opened online', 'AX-AXISBK', 'INR 30,000.00 debited from A/c no. XX1234 05-11-26 22:30:45 for opening of Fixed Deposit through Internet Banking', { kind: 'fdOpen', last4: '1234' }],
  ['Kotak recurring deposit instalment', 'VM-KOTAKB', 'Rs 5,000.00 debited from your Kotak Bank a/c XX1234 on 05-11-26 towards Recurring Deposit instalment. RD A/c 000412345678', { kind: 'rd', last4: '1234' }],
  ['HDFC RD instalment (short form)', 'VM-HDFCBK', 'Rs 2,000.00 debited from a/c XX1234 on 05-11-26 for RD instalment, RD A/c XXXX9876', { kind: 'rd', last4: '1234' }],
  ['PNB sweep to a deposit', 'VM-PNBSMS', 'Rs 20,000.00 debited from a/c XX1234 on 05-11-26 for Auto Sweep-out to your Fixed Deposit. -PNB', { kind: 'sweep', last4: '1234' }],
  ['SBI Flexi deposit sweep', 'AD-SBIINB', 'Rs 40,000.00 debited from your A/c X1234 on 05Nov26 transfer to SBI Flexi Deposit A/c XXXXXXX4455. -SBI', { kind: 'sweep', last4: '1234' }],
  ['BoB transfer to SELF', 'VM-BOBSMS', 'Rs.10000 debited from A/c XXXXXX1234 and credited to SELF a/c XX5678 via IMPS Ref No 531234567890. -BOB', { kind: 'selfTransfer', last4: '1234' }],
  ['Canara NEFT to own account', 'VM-CANBNK', 'Rs 15,000.00 debited from A/c XXX1234 on 05/11/2026 NEFT to own account XXX5678. -Canara Bank', { kind: 'selfTransfer', last4: '1234' }],
  ['IDFC "transfer to your own account"', 'VK-IDFCFB', 'Your A/c XX1234 is debited by INR 3,000.00 on 05-Nov-26. Transfer to your own account XX5678. UPI Ref: 312345678912', { kind: 'selfTransfer', last4: '1234' }],
  ['Yes Bank UPI to SELF', 'VM-YESBNK', 'Rs.600.00 debited from your YES BANK a/c XX1234 on 05/11/2026 via UPI to SELF. Ref 312345678913', { kind: 'selfTransfer', last4: '1234' }],
  ['credit card bill from the account', 'VM-HDFCBK', 'Rs.20,000.00 debited from a/c XX1234 on 05-11-26 towards HDFC Credit Card XX9876 bill payment via BillDesk', { kind: 'cardBill', last4: '1234' }],
]

describe('own money going out: not a spend', () => {
  it.each(OWN_OUT)('%s', (_label, sender, body, want) => {
    const p = ok(body, sender)
    expect(p.nature).toBe('ownMoney')
    expect(p.ownKind).toBe(want.kind)
    expect(p.ownWhy?.length ?? 0).toBeGreaterThan(10)
    if (want.last4 !== undefined) expect(p.last4).toBe(want.last4)
    if (want.amount) expect(p.amount).toBe(want.amount)
    expect(p.direction ?? 'out').toBe('out')
  })
  it('the plain-words reason says what it looks like', () => {
    expect(ok(OWN_OUT[2]![2], 'VM-HDFCBK').ownWhy).toMatch(/fixed deposit being opened/i)
  })
})

// ------------------------------------------------------------------------------------------------ own money coming IN
const OWN_IN: Row[] = [
  ['SBI TD premature closure, principal and interest', 'AD-SBIINB', 'Dear Customer, your Term Deposit A/c XXXXXXX987654 has been closed prematurely on 05-11-26. Rs.52,340.00 (principal and interest) credited to your A/c XXXXX123456. -SBI', { kind: 'fdBreak', last4: '3456', amount: '52340.00' }],
  ['HDFC FD matured, maturity amount credited', 'VM-HDFCBK', 'Your FD 50100012345678 has matured on 05-11-26. Maturity amount Rs 1,05,000.00 has been credited to your a/c XX1234', { kind: 'fdBreak', last4: '1234', amount: '105000.00' }],
  ['ICICI closure proceeds', 'VM-ICICIB', 'FD closure proceeds of Rs 75,000.00 credited to your ICICI Bank A/c XX4321 on 05-Nov-26', { kind: 'fdBreak', last4: '4321' }],
  ['Axis FD interest credit', 'AX-AXISBK', 'Interest of INR 2,500.00 on your Term Deposit A/c XXXX9876 has been credited to A/c no. XX1234', { kind: 'fdBreak', last4: '1234' }],
  ['Kotak FD auto-renewal with payout', 'VM-KOTAKB', 'Your Fixed Deposit matured and has been auto-renewed. Interest Rs 1,800.00 credited to a/c XX1234 on 05-11-26', { kind: 'fdBreak', last4: '1234' }],
  ['PNB RD matured', 'VM-PNBSMS', 'Your RD A/c 123456789 matured on 05-11-26. Rs 61,000.00 credited to a/c XX1234. -PNB', { kind: 'rd', last4: '1234' }],
  ['Yes Bank sweep-in from a deposit', 'VM-YESBNK', 'Rs 15,000.00 credited to a/c XX1234 on 05-11-26 by Sweep-in from your Flexi Deposit', { kind: 'sweep', last4: '1234' }],
  ['BoB NEFT from SELF', 'VM-BOBSMS', 'Rs.8000.00 credited to A/c XXXXXX1234 on 05-11-26 by NEFT from SELF. Ref No N123456789012. -BOB', { kind: 'selfTransfer', last4: '1234' }],
  ['IDFC IMPS from own account', 'VK-IDFCFB', 'Your A/c XX1234 is credited with INR 5,000.00 on 05-Nov-26 by IMPS from your own account XX5678', { kind: 'selfTransfer', last4: '1234' }],
  ['Canara FD booking confirmation at the deposit end', 'VM-CANBNK', 'Rs 30,000.00 credited to your Fixed Deposit A/c XXX7788 on booking on 05/11/2026. -Canara Bank', { kind: 'fdOpen' }],
]

describe('own money coming in: shown as own money, never as income or spending', () => {
  it.each(OWN_IN)('%s', (_label, sender, body, want) => {
    const p = ok(body, sender)
    expect(p.direction).toBe('in')
    expect(p.nature).toBe('ownMoney')
    expect(p.ownKind).toBe(want.kind)
    if (want.last4 !== undefined) expect(p.last4).toBe(want.last4)
    if (want.amount) expect(p.amount).toBe(want.amount)
  })
  it('interest on a deposit says the person can count it as income themselves', () => {
    expect(ok(OWN_IN[3]![2], 'AX-AXISBK').ownWhy).toMatch(/income/i)
  })
})

// ------------------------------------------------------------------------------------------------ real spending and real income stay as before
const STAYS: [string, string, string][] = [
  ['salary credit', 'VM-HDFCBK', 'Rs.50,000.00 credited to a/c XX1234 on 05-11-26 by NEFT from ACME PVT LTD. Avl Bal Rs.60,000.00'],
  ['a friend pays you by UPI', 'VM-HDFCBK', 'Rs 500 received in your a/c XX1234 from TEST PERSON via UPI on 05-11-26'],
  ['savings account interest (no deposit named)', 'VM-HDFCBK', 'Interest of Rs 120.50 credited to a/c XX1234 for the quarter ending 30-09-26'],
  ['cash deposit is not a term deposit', 'VM-HDFCBK', 'Rs 5,000.00 deposited in your a/c XX1234 by cash on 05-11-26'],
  ['a refund', 'VM-HDFCBK', 'Refund of Rs 300.00 for your order has been credited to your account'],
  ['FD maturity REMINDER (future)', 'VM-HDFCBK', 'Your FD will mature on 05-12-26 and Rs 51,000.00 will be credited to your a/c XX1234'],
  ['FD auto-renew notice with no credit', 'VM-HDFCBK', 'Your FD of Rs 50,000 is auto-renewed for 12 months on 05-11-26'],
  ['credit from another account that is NOT yours', 'VM-HDFCBK', 'Rs 5,000.00 credited to a/c XX1234 on 05-11-26 via IMPS from a/c XX5678'],
]
describe('real income and unclear messages stay as before (not offered)', () => {
  it.each(STAYS)('%s', (_l, sender, body) => {
    expect(readSms(body, sender, NO_CTX).ok).toBe(false)
  })
})

const SPENDS: [string, string, string, string?][] = [
  ['an ordinary UPI spend', 'VM-HDFCBK', 'Rs.2,500.00 debited from HDFC Bank A/c XX1234 on 05-11-26 to VPA bigbasket@hdfcbank (UPI Ref No 100000000001)'],
  ['premature-closure PENALTY is a real cost', 'VM-HDFCBK', 'Rs 500.00 debited from a/c XX1234 on 05-11-26 as FD premature closure penalty'],
  ['TDS on FD interest is a real cost', 'VM-HDFCBK', 'TDS of Rs 120.00 debited from a/c XX1234 on 05-11-26 on interest of FD'],
  ['"Rd" in a street name is not a recurring deposit', 'VM-HDFCBK', 'Rs 300.00 debited from a/c XX1234 on 05-11-26 at SUNRISE CAFE, MG Rd Branch'],
  ['"TDS"-like words and "FDA"', 'VM-HDFCBK', 'Rs 300.00 debited from a/c XX1234 on 05-11-26 at FDA PHARMACY'],
  ['"self" inside a shop name', 'VM-HDFCBK', 'Rs 300.00 debited from a/c XX1234 on 05-11-26 at SELF HELP GROUP STORES'],
  ['a second account that is not saved', 'VM-PNBSMS', 'Your a/c no. XX1234 is debited for Rs.1000.00 on 05-11-26 and a/c no. XX5678 is credited (IMPS Ref no 531234567890). -PNB'],
  ['EMI for a loan account whose digits match a saved account', 'VM-HDFCBK', 'Rs.8,500.00 debited from a/c XX1234 on 05-11-26 towards EMI for loan a/c 99885678'],
]
describe('real spending is never relabelled as own money (fail closed)', () => {
  const saved: OwnContext = { instruments: [{ id: 'b2', kind: 'bank', last4: '5678', deletedAt: null }] }
  it.each(SPENDS)('%s', (_l, sender, body) => {
    // only the loan row runs with the matching account saved; the "not saved" row runs with none
    const p = ok(body, sender, _l.startsWith('EMI') ? saved : NO_CTX)
    expect(p.nature).toBe('spend')
    expect(p.ownKind).toBeUndefined()
  })
})

// ------------------------------------------------------------------------------------------------ self vs somebody else, with what the app knows
describe('self transfer from what the app knows', () => {
  const body = 'Rs 4,000.00 debited from HDFC Bank A/c XX1234 on 05-11-26 to a/c XX5678 via NEFT'
  const saved = (last4: string, kind = 'bank', deletedAt: number | null = null): OwnContext => ({ instruments: [{ id: 'b2', kind, last4, deletedAt }] })
  it('the other account is one of your saved bank accounts: a self transfer', () => {
    const p = ok(body, 'VM-HDFCBK', saved('5678'))
    expect(p).toMatchObject({ nature: 'ownMoney', ownKind: 'selfTransfer' })
    expect(p.ownWhy).toContain('5678')
  })
  it('not saved, or a removed account, or a card: spend', () => {
    expect(ok(body, 'VM-HDFCBK', NO_CTX).nature).toBe('spend')
    expect(ok(body, 'VM-HDFCBK', saved('5678', 'bank', 5)).nature).toBe('spend')
    expect(ok(body, 'VM-HDFCBK', saved('5678', 'credit')).nature).toBe('spend')
  })
  it('two saved accounts with the same digits: nothing is claimed', () => {
    expect(ok(body, 'VM-HDFCBK', { instruments: [{ id: 'a', kind: 'bank', last4: '5678', deletedAt: null }, { id: 'b', kind: 'bank', last4: '5678', deletedAt: null }] }).nature).toBe('spend')
  })
  it('money in from your own saved account is own money; from an unknown account it is not offered', () => {
    const cr = 'Rs 5,000.00 credited to a/c XX1234 on 05-11-26 via IMPS from a/c XX5678'
    expect(ok(cr, 'VM-HDFCBK', saved('5678'))).toMatchObject({ direction: 'in', nature: 'ownMoney', ownKind: 'selfTransfer' })
    expect(readSms(cr, 'VM-HDFCBK', NO_CTX).ok).toBe(false)
  })
  it('taught: a payee the person called their own account is a self transfer; someone else / a shop blocks the guess', () => {
    const f = { kind: 'spend', merchant: 'Rahul Sharma', payee: 'rahul sharma', other: null, text: null }
    expect(natureOf(f, NO_CTX).nature).toBe('spend')
    expect(natureOf(f, { instruments: [], payeeKinds: [{ key: 'rahul sharma', kind: 'self', at: 1 }] })).toMatchObject({ nature: 'ownMoney', ownKind: 'selfTransfer' })
    const guess = { ...f, other: '5678' }
    const ctx = saved('5678')
    expect(natureOf(guess, ctx).nature).toBe('ownMoney')
    expect(natureOf(guess, { ...ctx, payeeKinds: [{ key: 'rahul sharma', kind: 'person', at: 1 }] }).nature).toBe('spend')
    expect(natureOf({ ...f, text: { ownKind: 'selfTransfer', ownWhy: 'x' } }, { instruments: [], payeeKinds: [{ key: 'rahul sharma', kind: 'merchant', at: 1 }] }).nature).toBe('spend')
    // a deposit is still read as a deposit, whatever the payee is called
    expect(natureOf({ ...f, text: { ownKind: 'fdOpen', ownWhy: 'x' } }, { instruments: [], payeeKinds: [{ key: 'rahul sharma', kind: 'person', at: 1 }] }).ownKind).toBe('fdOpen')
  })
})

// ------------------------------------------------------------------------------------------------ deposit digits are never a card or account
describe('deposit account numbers are never offered as a card or account', () => {
  const day = new Date(2026, 10, 5, 12).getTime()
  const msgs = [...OWN_OUT, ...OWN_IN].map(([, sender, body], i) => ({ id: String(i), address: sender, date: day + i, body }))
  it('stripDeposit cuts the deposit number and leaves the savings account', () => {
    expect(stripDeposit('debited from A/c XXXXX123456 for Term Deposit A/c XXXXXXX987654')).not.toContain('987654')
    expect(stripDeposit('debited from A/c XXXXX123456 for Term Deposit A/c XXXXXXX987654')).toContain('123456')
    expect(stripDeposit('Rs 5000 deposited in your a/c XX1234 by cash')).toContain('XX1234')
  })
  it('hasDeposit knows the shapes and not look-alikes', () => {
    for (const t of ['Term Deposit A/c', 'Fixed Deposit', 'your FD has', 'TD A/c 123', 'TDR', 'FDR 123', 'RD instalment', 'RD A/c XXXX1', 'recurring deposit', 'MOD A/c XX12', 'SBI Flexi Deposit', 'deposit a/c 1234']) expect(hasDeposit(t), t).toBe(true)
    for (const t of ['TDS deducted', 'cash deposit', 'deposited in your a/c', 'MG Rd Branch', 'FDA PHARMACY', 'Rd 5', 'mod', 'FD']) expect(hasDeposit(t), t).toBe(t === 'FD')
  })
  it('no candidate carries a deposit account number as its card digits', () => {
    const r = buildCandidates(msgs, starterBudget(), () => null)
    const all = [...r.found, ...r.own]
    expect(all.length).toBeGreaterThan(15)
    const digits = new Set(all.map((c) => c.last4))
    for (const bad of ['7654', '4455', '7788', '9876']) expect(digits.has(bad), bad).toBe(false)
  })
  it('newInstruments never offers an FD / RD / sweep message at all', () => {
    const fd = buildCandidates([{ id: '1', address: 'AD-SBIINB', date: day, body: OWN_OUT[0]![2] }], starterBudget(), () => null)
    expect(fd.found).toHaveLength(1)
    expect(newInstruments(fd.found)).toEqual([])
    // the same savings account IS offered when it pays for something ordinary
    const plain = buildCandidates([{ id: '1', address: 'AD-SBIINB', date: day, body: 'Rs 99 debited from your A/c XXXXX123456 on 05-11-26 to VPA shop@ybl' }], starterBudget(), () => null)
    expect(newInstruments(plain.found).map((n) => n.last4)).toEqual(['3456'])
  })
})

describe('text helpers', () => {
  it('accountTails: both accounts, never a deposit or a loan account', () => {
    expect(accountTails('debited from a/c XX1234 to a/c XX5678')).toEqual(['1234', '5678'])
    expect(accountTails('debited from a/c XX1234 for Term Deposit A/c XXXXXXX987654')).toEqual(['1234'])
    expect(accountTails('EMI for loan a/c 99885678 from a/c XX1234')).toEqual(['1234'])
  })
  it('ownFromText: a future reminder and a penalty are not own money', () => {
    expect(ownFromText('your FD will mature on 05-12-26', 'in')).toBeNull()
    expect(ownFromText('FD premature closure penalty debited', 'out')).toBeNull()
    expect(ownFromText('Rs 5 debited as SMS charges', 'out')).toBeNull()
  })
})

// keep the types honest
const _b: BudgetData = starterBudget()
void _b
