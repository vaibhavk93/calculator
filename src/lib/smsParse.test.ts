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

import { logAsText, logEntryFor, mergeLog } from './smsParse'
import { maskText } from './maskText'

describe('parser log', () => {
  it('log text holds no real numbers or names but keeps the layout', () => {
    const body = 'Sent Rs.1990.00 from HDFC Bank A/c 1234 To Netflx 03/11/26 Ref 111000000001'
    const m = { id: '1', address: 'JX-HDFCBK-S', date: 0, body }
    const e = logEntryFor(m, parseSms('Sent Rs.1990.00 from HDFC Bank', 'X'), 1, 's')
    expect(e?.template ?? '').not.toContain('1990')
    const masked = maskText(body, 's')
    expect(masked).toMatch(/^Sent Rs\.\d{4}\.\d{2} from HDFC Bank A\/c \d{4} To [A-Z][a-z]{5} \d{2}\/\d{2}\/\d{2} Ref \d{12}$/)
  })
  it('logs unreadable payments and partial reads, not credits or chat', () => {
    const m = (body: string) => ({ id: '1', address: 'VM-HDFCBK', date: 0, body })
    expect(logEntryFor(m('Your a/c XX1234 has been debited.'), parseSms('Your a/c XX1234 has been debited.', 'VM-HDFCBK'), 1, 's')?.outcome).toBe('no-amount')
    expect(logEntryFor(m('Rs 5 credited'), parseSms('Rs 5 credited', 'X'), 1, 's')).toBeNull()
    const part = 'Rs 450 debited via netbanking'
    expect(logEntryFor(m(part), parseSms(part, 'VM-HDFCBK'), 1, 's')?.outcome).toBe('partial')
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

describe('real-shape: HDFC UPI mandate from a "-S" sender', () => {
  it('reads card digits without x marks and a payee followed by the date', () => {
    const p = ok('UPI Mandate:\nSent Rs.1990.00\nfrom HDFC Bank A/c 1234\nTo Netflx\n03/11/26\nRef 111000000001\nNot You? Call 18002586161/SMS BLOCK UPI to 7308080808', 'JX-HDFCBK-S')
    expect(p).toMatchObject({ amount: '1990.00', last4: '1234', merchant: 'Netflx', ref: '111000000001', bank: 'HDFC Bank', mode: 'upi' })
  })
})

describe('not a finished payment, and payee hygiene', () => {
  it('skips reminders, scheduled debits, failures and requests', () => {
    expect(skipped('Rs 10400 will be debited from a/c XX1234 on 05-11-26 towards EMI')).toBe('not-a-payment')
    expect(skipped('Your payment of Rs 500 to SHOP from a/c XX1234 has failed')).toBe('not-a-payment')
    expect(skipped('Shop has requested money Rs 500 from you. Pay via UPI')).toBe('not-a-payment')
    expect(skipped('Reminder: card payment of Rs 5,000 is due on 10-11-26')).toBe('not-a-payment')
  })
  it('never takes the helpline or advice as the payee', () => {
    const p = ok('Rs.500.00 debited from a/c XX1234 on 02-11-26 UPI Ref 312345678901. Not You? Call 18002586161/SMS BLOCK UPI to 7308080808')
    expect(p.merchant).toBe('')
    expect(ok('Rs.500 debited A/c XX1234. To report fraud call 1800').merchant).toBe('')
    expect(ok('Sent Rs.250 from A/c XX1234 To www.loun12085291.in Ref 312345678901').merchant).not.toMatch(/\d{5}/)
  })
})

import { attachInstrument, guessCategory, newInstruments } from './smsParse'

describe('categories and cards found in messages', () => {
  const day = new Date(2026, 10, 2, 12).getTime()
  it('guesses a category by payee when the user has that category', () => {
    const b = starterBudget()
    expect(b.categories.find((c) => c.id === guessCategory(b, 'Swiggy'))?.name).toBe('Food')
    expect(b.categories.find((c) => c.id === guessCategory(b, 'Amazon'))?.name).toBe('Shopping')
    expect(guessCategory(b, 'Some Unknown Shop')).toBeNull()
    expect(guessCategory({ categories: [] }, 'Swiggy')).toBeNull()
  })
  it('a payee seen before wins over the keyword guess', () => {
    const r = buildCandidates([{ id: '1', address: 'VM-HDFCBK', date: day, body: 'Sent Rs.500.00 From HDFC Bank A/C *1234 To SWIGGY On 02/11/26' }], starterBudget(), () => ({ categoryId: 'starter-travel' }))
    expect(r.found[0]!.categoryId).toBe('starter-travel')
    const g = buildCandidates([{ id: '1', address: 'VM-HDFCBK', date: day, body: 'Sent Rs.500.00 From HDFC Bank A/C *1234 To SWIGGY On 02/11/26' }], starterBudget(), () => null)
    expect(g.found[0]!.categoryId).toBe('starter-food')
  })
  it('finds a card or account that is not added yet, then attaches payments to it', () => {
    const msgs = [
      { id: '1', address: 'JX-HDFCBK-S', date: day, body: 'Sent Rs.100 from HDFC Bank A/c 7261 To Shop 02/11/26 Ref 111000000001' },
      { id: '2', address: 'JX-HDFCBK-S', date: day, body: 'Sent Rs.200 from HDFC Bank A/c 7261 To Cafe 02/11/26 Ref 111000000002' },
      { id: '3', address: 'VM-ICICIB', date: day, body: 'INR 300 spent using ICICI Bank Credit Card XX4455 on 02-Nov-26 at AMAZON' },
    ]
    const r = buildCandidates(msgs, starterBudget(), () => null)
    const found = newInstruments(r.found)
    expect(found).toEqual([
      { bank: 'HDFC Bank', last4: '7261', kind: 'bank', uses: 2 },
      { bank: 'ICICI Bank', last4: '4455', kind: 'credit', uses: 1 },
    ])
    const inst = card({ id: 'new', kind: 'bank', bank: 'HDFC Bank', last4: '7261' })
    const after = attachInstrument(r.found, inst, 'HDFC Bank', '7261')
    expect(after.filter((c) => c.instrumentId === 'new')).toHaveLength(2)
    expect(newInstruments(after).map((n) => n.last4)).toEqual(['4455'])
  })
})

describe('formats seen in a real inbox (made-up values)', () => {
  it('Axis card: payee after the IST time', () => {
    const p = ok('Spent INR 9231 Axis Bank Card no. XX4828 17-07-25 18:15:49 IST RAZ*DREAMPL Avl Limit: INR 169365 Not you? SMS BLOCK 4828 to 485699741096', 'AX-AXISBK-S')
    expect(p).toMatchObject({ amount: '9231', last4: '4828', merchant: 'Raz*Dreampl', source: null })
  })
  it('HDFC card with an underscore payee and no x marks', () => {
    const p = ok('Spent Rs.8967 On HDFC Bank Card 4852 At _LIFE STYLE INTERN. On 2025-07-12:18:28:11.Not You? To Block+Reissue Call 18002586161/SMS BLOCK CC 4852 to 7308080808', 'JX-HDFCBK-S')
    expect(p).toMatchObject({ last4: '4852', merchant: 'Life Style Intern' })
  })
  it('RBL card with the digits in brackets', () => {
    expect(ok('INR5,093.07 spent at SOME SHOP on RBL Bank credit card (2655) on 20-03-2024.AVL limit- INR425,300.31. Not you? Call 1800', 'BP-RBLCRD-S')).toMatchObject({ amount: '5093.07', last4: '2655', merchant: 'Some Shop' })
  })
  it('SBI account with a long hidden-digit number', () => {
    expect(ok('Your A/C XXXXX123456 Debited INR 1,000.00 on 18/02/26 -Transferred to Some Person. Avl Balance INR 5.00-SBI', 'AX-CBSSBI-S').last4).toBe('3456')
  })
  it('skips EMI conversion offers, card payments received, and bill receipts', () => {
    expect(skipped('Convert your transaction of INR 91073 into easy monthly EMIs with tenure up to 49 months with FLEXI EMI on your Axis Bank Credit Card. Convert now. *T&Cs.')).toBe('not-a-payment')
    expect(skipped('We have received your payment of INR 4,113.86 towards your credit card number ending 4502. Thank you')).toBe('credit')
    expect(skipped('HDFC Bank Cardmember, Online Payment of Rs.8063 vide Ref# 12996M31F was credited to your card ending 1110 On 12/OCT/2025')).toBe('credit')
    expect(skipped('Hi A, we have received a payment of Rs. 7703.68 for your Airtel Black ID 32994437684014.')).toBe('credit')
    expect(skipped('A/C DEBIT ALERT: Your Rs.138 Bewakoof Bonus Cash is about to expire Redeem it now')).toBe('not-a-payment')
  })
  it('a card bill paid through net banking is a card-bill payment', () => {
    expect(ok('Transaction of Rs. 9350.17 for HDFC Credit Card with reference no. SB58091332389244M31F is Successful-SBI', 'VM-SBIINB-S').kind).toBe('cardBill')
  })
  it('mutual fund purchases are guessed as Savings', () => {
    const b = starterBudget()
    expect(b.categories.find((c) => c.id === guessCategory(b, 'Your Purchase in Folio 1234 under Some Flexi Cap Fund has been processed'))?.name).toBe('Savings')
  })
})
