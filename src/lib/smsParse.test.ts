import { describe, expect, it } from 'vitest'
import { alreadyAdded, buildCandidates, fingerprint, matchInstrument, modeFor, parseSms, type ParsedSms } from './smsParse'
import { starterBudget, type BudgetData, type PayInstrument } from './budget'

const ok = (body: string, from = 'VM-HDFCBK'): ParsedSms => {
  const r = parseSms(body, from)
  if (!r.ok) throw new Error(`skipped: ${r.reason}`)
  return r
}
const skipped = (body: string, from = 'VM-HDFCBK') => {
  const r = parseSms(body, from)
  return r.ok ? 'READ' : r.reason
}

describe('parseSms: money going out', () => {
  it('HDFC UPI debit', () => {
    const p = ok('Rs.1,250.00 debited from a/c **1234 on 02-11-26 to VPA zomato@icici (UPI Ref No 312345678901). Not you? Call 18002586161')
    expect(p).toMatchObject({ amount: '1250.00', last4: '1234', merchant: 'Zomato', mode: 'upi', bank: 'HDFC Bank', ref: '312345678901', kind: 'spend' })
  })
  it('HDFC "Sent" style', () => {
    const p = ok('Sent Rs.500.00 From HDFC Bank A/C *1234 To SWIGGY On 02/11/26 Ref 312345678902 Not You? Call 18002586161')
    expect(p).toMatchObject({ amount: '500.00', last4: '1234', merchant: 'Swiggy' })
  })
  it('credit card spend, ignores the available limit', () => {
    const p = ok('Spent Rs.2345.50 On HDFC Bank CREDIT Card xx4321 At AMAZON On 2026-11-02:14:22:10. Avl Lim Rs.1,00,000.00')
    expect(p).toMatchObject({ amount: '2345.50', last4: '4321', merchant: 'Amazon', mode: 'credit' })
  })
  it('ICICI account debit with the payee after a semicolon', () => {
    const p = ok('ICICI Bank Acct XX123 debited for Rs 1,500.00 on 02-Nov-26; ZOMATO credited. UPI:312345678903. Call 18002662 for dispute.', 'AX-ICICIB')
    expect(p).toMatchObject({ amount: '1500.00', last4: '123', merchant: 'Zomato', mode: 'upi', bank: 'ICICI Bank' })
  })
  it('ICICI card, INR amount first', () => {
    const p = ok('INR 1,234.00 spent using ICICI Bank Card XX1234 on 02-Nov-26 on AMAZON. Avl Limit: INR 98,766.00', 'VM-ICICIB')
    expect(p).toMatchObject({ amount: '1234.00', last4: '1234' })
  })
  it('SBI with no currency sign', () => {
    const p = ok('Dear UPI user A/C X1234 debited by 250.0 on date 02Nov26 trf to ZOMATO Refno 312345678904. If not u? call 1800111109', 'AD-SBIUPI')
    expect(p).toMatchObject({ amount: '250.00', last4: '1234', merchant: 'Zomato', bank: 'State Bank of India' })
  })
  it('Axis UPI line', () => {
    const p = ok('INR 500.00 debited A/c no. XX1234 02-11-26, 14:22:10 UPI/P2M/312345678905/SWIGGY. Not you? SMS BLOCK UPI to 18001035577', 'AX-AXISBK')
    expect(p).toMatchObject({ amount: '500.00', last4: '1234', merchant: 'Swiggy', mode: 'upi' })
  })
  it('a whole-rupee amount stays whole', () => {
    expect(ok('Rs 450 debited from A/c XX1234 for UPI to Ramesh Kumar').amount).toBe('450')
  })
  it('flags a credit card bill payment', () => {
    expect(ok('Rs.12,345.00 debited from a/c **1234 towards HDFC Credit Card bill payment on 02-11-26 via BILLDESK').kind).toBe('cardBill')
  })
})

describe('parseSms: fails closed', () => {
  it('ignores money coming in', () => {
    expect(skipped('Rs.5,000.00 credited to a/c **1234 on 02-11-26 by VPA ravi@okhdfc (UPI Ref 312345678906)')).toBe('credit')
    expect(skipped('Refund of Rs.300.00 for your order has been credited to your account')).toBe('credit')
    expect(skipped('Payment of Rs. 12,345 received on your HDFC Bank Credit Card ending 1234. Thank you')).toBe('credit')
  })
  it('ignores OTPs and offers', () => {
    expect(skipped('123456 is your OTP for transaction of Rs.500 at AMAZON. Do not share. Valid for 5 minutes')).toBe('otp')
    expect(skipped('Pre-approved loan of Rs.5,00,000 for you! Click https://x.in to apply now')).toBe('not-a-payment')
    expect(skipped('Hi! Meet at 5pm?')).toBe('not-a-payment')
  })
  it('skips when the amount is missing', () => {
    expect(skipped('Your a/c XX1234 has been debited. Call us if not you.')).toBe('no-amount')
  })
  it('skips when the direction is unclear', () => {
    expect(skipped('Rs 500 credited to A/c XX1234 and debited from Rs 500 wallet')).toBe('unsure')
  })
  it('never accepts a balance as the amount', () => {
    expect(skipped('Debited from a/c XX1234. Avl Bal Rs.45,000.00')).toBe('no-amount')
  })
  it('rejects absurd amounts', () => {
    expect(skipped('Rs.99,99,99,99,999.00 debited from a/c XX1234')).toBe('no-amount')
  })
  it('empty text', () => {
    expect(skipped('')).toBe('not-a-payment')
  })
})

describe('fingerprint', () => {
  it('is stable and uses the reference when there is one', () => {
    const a = ok('Rs.100 debited from a/c XX1234 UPI Ref No 312345678901 to VPA a@b')
    const b = ok('Sent Rs.100 from a/c XX1234 UPI Ref 312345678901')
    expect(fingerprint(a, '2026-11-02')).toBe(fingerprint(b, '2026-11-03'))
    expect(fingerprint(a, '2026-11-02')).toMatch(/^[0-9a-z]+$/)
  })
  it('differs for different payments', () => {
    const a = ok('Rs.100 debited from a/c XX1234 at SHOP A')
    const b = ok('Rs.101 debited from a/c XX1234 at SHOP A')
    expect(fingerprint(a, '2026-11-02')).not.toBe(fingerprint(b, '2026-11-02'))
  })
})

const card = (over: Partial<PayInstrument>): PayInstrument => ({ id: 'c1', name: 'HDFC Regalia', kind: 'credit', network: 'visa', bank: 'HDFC Bank', last4: '4321', rewardNote: '', deletedAt: null, ...over }) as PayInstrument

describe('matching', () => {
  it('matches one card by last digits', () => {
    expect(matchInstrument({ instruments: [card({}), card({ id: 'c2', last4: '9999' })] }, { last4: '4321', bank: null })?.id).toBe('c1')
  })
  it('refuses when two fit and the bank cannot tell them apart', () => {
    const list = [card({}), card({ id: 'c2', bank: 'HDFC Bank' })]
    expect(matchInstrument({ instruments: list }, { last4: '4321', bank: 'HDFC Bank' })).toBeNull()
  })
  it('does not match a removed card', () => {
    expect(matchInstrument({ instruments: [card({ deletedAt: 5 })] }, { last4: '4321', bank: null })).toBeNull()
  })
  it('modeFor uses the card kind', () => {
    expect(modeFor({ mode: null }, card({}))).toBe('credit')
    expect(modeFor({ mode: 'upi' }, card({ kind: 'bank' }))).toBe('upi')
    expect(modeFor({ mode: null }, card({ kind: 'bank' }))).toBe('netbanking')
    expect(modeFor({ mode: 'credit' }, null)).toBeNull()
    expect(modeFor({ mode: 'upi' }, null)).toBe('upi')
  })
})

describe('buildCandidates', () => {
  const day = new Date(2026, 10, 2, 12).getTime()
  const base = (): BudgetData & { smsSeen?: string[] } => ({ ...starterBudget(), instruments: [card({})] })
  const none = () => null

  it('lists payments, counts credits, ignores people and OTPs', () => {
    const r = buildCandidates(
      [
        { id: '1', address: 'VM-HDFCBK', date: day, body: 'Spent Rs.450 On HDFC Bank CREDIT Card xx4321 At SWIGGY On 2026-11-02' },
        { id: '2', address: 'VM-HDFCBK', date: day, body: 'Rs.5,000 credited to a/c XX1234 by VPA a@b' },
        { id: '3', address: 'VM-HDFCBK', date: day, body: '123456 is your OTP' },
      ],
      base(),
      none,
    )
    expect(r.found).toHaveLength(1)
    expect(r.found[0]).toMatchObject({ amount: '450', date: '2026-11-02', instrumentId: 'c1', mode: 'credit', merchant: 'Swiggy' })
    expect(r.skipped).toEqual({ credit: 1 })
  })
  it('does not offer a message twice, nor one already added or skipped', () => {
    const msg = { id: '1', address: 'VM-HDFCBK', date: day, body: 'Rs.100 debited from a/c XX1234 UPI Ref 312345678901 to VPA a@b' }
    const first = buildCandidates([msg, { ...msg, id: '2', address: 'AX-ICICIB' }], base(), none)
    expect(first.found).toHaveLength(1)
    const again = buildCandidates([msg], { ...base(), smsSeen: [first.found[0]!.id] }, none)
    expect(again.found).toHaveLength(0)
    expect(again.alreadySeen).toBe(1)
  })
  it('marks one that is already in the budget', () => {
    const b = base()
    b.expenses = [{ id: 'e', date: '2026-11-02', amount: '450.00', categoryId: null, mode: 'credit', instrumentId: 'c1', note: '', deletedAt: null }]
    const r = buildCandidates([{ id: '1', address: 'VM-HDFCBK', date: day, body: 'Spent Rs.450 On HDFC Bank CREDIT Card xx4321 At SWIGGY' }], b, none)
    expect(r.found[0]!.duplicateOfExisting).toBe(true)
    expect(alreadyAdded(b, { amount: '451', date: '2026-11-02', instrumentId: 'c1', merchant: '' })).toBe(false)
  })
  it('uses the category of an earlier entry with the same name', () => {
    const r = buildCandidates([{ id: '1', address: 'VM-HDFCBK', date: day, body: 'Sent Rs.500.00 From HDFC Bank A/C *1234 To SWIGGY On 02/11/26' }], base(), () => ({ categoryId: 'starter-food' }))
    expect(r.found[0]!.categoryId).toBe('starter-food')
  })
})

import { logAsText, logEntryFor, mergeLog, redact } from './smsParse'

describe('parser log', () => {
  it('redact removes digits, handles, links and payee names', () => {
    const t = redact('Rs.1,250.00 debited from a/c **1234 to VPA ramesh.k@okhdfc on 02-11-26. Ref 312345678901. Call https://x.in')
    expect(t).not.toMatch(/\d{2}/)
    expect(t).not.toMatch(/ramesh|okhdfc|x\.in/)
    expect(t).toContain('debited')
    expect(redact('Sent Rs.500 From HDFC Bank A/C *1234 To RAMESH KUMAR On 02/11/26')).not.toMatch(/RAMESH|KUMAR/)
  })
  it('logs unreadable payments and partial reads, not credits or chat', () => {
    const m = (body: string) => ({ id: '1', address: 'VM-HDFCBK', date: 0, body })
    expect(logEntryFor(m('Your a/c XX1234 has been debited.'), parseSms('Your a/c XX1234 has been debited.', 'VM-HDFCBK'), 1)?.outcome).toBe('no-amount')
    expect(logEntryFor(m('Rs 5 credited'), parseSms('Rs 5 credited', 'X'), 1)).toBeNull()
    const part = 'Rs 450 debited via netbanking'
    expect(logEntryFor(m(part), parseSms(part, 'VM-HDFCBK'), 1)?.outcome).toBe('partial')
  })
  it('merges repeats, caps the size, and prints text', () => {
    const e = { at: 1, sender: 'A', outcome: 'unsure' as const, template: 't', count: 1 }
    const merged = mergeLog([e], [{ ...e, at: 2 }])
    expect(merged).toHaveLength(1)
    expect(merged[0]!.count).toBe(2)
    expect(mergeLog([], Array.from({ length: 250 }, (_, i) => ({ ...e, template: `t${i}`, at: i }))).length).toBe(200)
    expect(logAsText(merged)).toContain('[unsure x2] A: t')
  })
})
