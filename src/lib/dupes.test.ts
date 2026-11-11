import { describe, expect, it } from 'vitest'
import { samePayment, type Same } from './dupes'
import { sameName } from './payeeKey'
import { alreadyAdded, buildCandidates, maskedSamplesText, seenIdsOf } from './smsParse'
import { applyPlan, planDrain, type InboxItem } from './inbox'
import { starterBudget, type BudgetData } from './budget'
import { maskText } from './maskText'

/** SYNTHETIC messages and names throughout. */

const s = (o: Partial<Same> = {}): Same => ({ amount: '500', date: '2026-11-05', last4: null, instrumentId: null, bank: null, merchant: '', ...o })

describe('sameName: whole words, not letters', () => {
  it('one contains the other', () => {
    expect(sameName('Zomato', 'Zomato Online Order Pvt Ltd')).toBe(true)
    expect(sameName('ZOMATO', 'zomato')).toBe(true)
  })
  it('not a prefix of a different word, not too short, not empty', () => {
    expect(sameName('Ravi', 'Ravindra')).toBe(false)
    expect(sameName('Al', 'Al Fresco Al')).toBe(false)
    expect(sameName('', '')).toBe(false)
    expect(sameName('Swiggy', 'Bundl Technologies')).toBe(false)
  })
})

describe('samePayment', () => {
  const rows: [string, Same, Same, boolean][] = [
    ['same reference, different names', s({ refKey: 'r1', merchant: 'Swiggy' }), s({ refKey: 'r1', merchant: 'Bundl Technologies' }), true],
    ['different references, same shop and amount: two payments', s({ refKey: 'r1', merchant: 'Swiggy', last4: '1234' }), s({ refKey: 'r2', merchant: 'Swiggy', last4: '1234' }), false],
    ['same card, different names, no references (bank alert + app)', s({ last4: '1234', merchant: 'Swiggy' }), s({ last4: '1234', merchant: 'Bundl Technologies' }), true],
    ['same saved card id', s({ instrumentId: 'c1', merchant: 'A' }), s({ instrumentId: 'c1', merchant: 'B' }), true],
    ['one contains the other, no card known', s({ merchant: 'Zomato' }), s({ merchant: 'Zomato Online Order' }), true],
    ['one message names no payee, nothing contradicts', s({ merchant: '' }), s({ merchant: 'Chai Point' }), true],
    ['one names no payee but they are two different known cards', s({ merchant: '', last4: '1234' }), s({ merchant: 'Chai Point', last4: '9999' }), false],
    ['different saved cards', s({ instrumentId: 'c1', merchant: '' }), s({ instrumentId: 'c2', merchant: '' }), false],
    ['two named, different payees, no card or reference known', s({ merchant: 'Tea Stall' }), s({ merchant: 'Cafe' }), false],
    ['different amount', s({ merchant: 'Swiggy' }), s({ amount: '501', merchant: 'Swiggy' }), false],
    ['same amount written differently', s({ amount: '500', merchant: 'Swiggy' }), s({ amount: '500.00', merchant: 'Swiggy' }), true],
    ['next day (a message either side of midnight)', s({ merchant: 'Swiggy' }), s({ date: '2026-11-06', merchant: 'Swiggy' }), true],
    ['two days apart', s({ merchant: 'Swiggy' }), s({ date: '2026-11-07', merchant: 'Swiggy' }), false],
    ['opposite direction', s({ merchant: 'Swiggy' }), s({ direction: 'in', merchant: 'Swiggy' }), false],
    ['same digits, different banks', s({ last4: '1234', bank: 'HDFC Bank', merchant: 'Shop' }), s({ last4: '1234', bank: 'ICICI Bank', merchant: 'Other' }), false],
    ['a 3-digit tail and the 4-digit one agree', s({ last4: '234', merchant: 'A' }), s({ last4: '1234', merchant: 'B' }), true],
  ]
  it.each(rows)('%s', (_l, a, b, want) => {
    expect(samePayment(a, b)).toBe(want)
    expect(samePayment(b, a)).toBe(want) // order does not matter
  })
})

const day = new Date(2026, 10, 5, 12).getTime()
const bud = (extra: Partial<BudgetData> = {}): BudgetData => ({ ...starterBudget(), ...extra })
const A = { id: 'a', address: 'VM-HDFCBK', date: day, body: 'Rs.500.00 debited from HDFC Bank A/c XX1234 on 05-11-26 to VPA zomato@icici (UPI Ref No 312345678901). Not you? Call 18002586161' }
// The app's message has no reference. (With the SAME reference the two share one fingerprint and were always treated as one.)
const B = { id: 'b', address: 'AX-ICICIB', date: day, body: 'Paid Rs 500.00 to ZOMATO ONLINE ORDER via UPI' }

describe('manual scan: one payment, two messages', () => {
  it('merges the bank alert and the app message, keeps the richest fields, says how many', () => {
    const r = buildCandidates([A, B], bud(), () => null)
    expect(r.found).toHaveLength(1)
    expect(r.found[0]).toMatchObject({ amount: '500.00', last4: '1234', mergedFrom: 2, nature: 'spend' })
    expect(r.found[0]!.merchant).toBe('Zomato Online Order') // the longer name
    expect(r.found[0]!.alsoIds).toHaveLength(1)
    expect(seenIdsOf(r.found[0]!)).toHaveLength(2)
  })
  it('two texts with the SAME reference are one payment already (one fingerprint)', () => {
    const r = buildCandidates([A, { ...B, body: `${B.body}. UPI Ref 312345678901` }], bud(), () => null)
    expect(r.found).toHaveLength(1)
  })
  it('the other order gives the same single candidate', () => {
    const r = buildCandidates([B, A], bud(), () => null)
    expect(r.found).toHaveLength(1)
    expect(r.found[0]).toMatchObject({ last4: '1234', mergedFrom: 2 })
  })
  it('a bank alert with no payee and an app message with one are one payment (even with no shared reference)', () => {
    const r = buildCandidates([{ ...A, body: 'Rs.250.00 debited from HDFC Bank A/c XX1234 on 05-11-26. UPI Ref 312345678902' }, { ...B, body: 'Paid Rs 250 to Chai Point via UPI' }], bud(), () => null)
    expect(r.found).toHaveLength(1)
    expect(r.found[0]).toMatchObject({ merchant: 'Chai Point', last4: '1234', mergedFrom: 2 })
  })
  it('two real payments stay two: different references, or different cards', () => {
    const two = buildCandidates([{ ...A, id: '1', body: 'Rs.100 debited from a/c XX1234 to VPA tea@ybl UPI Ref 312345678911' }, { ...A, id: '2', body: 'Rs.100 debited from a/c XX1234 to VPA tea@ybl UPI Ref 312345678912' }], bud(), () => null)
    expect(two.found).toHaveLength(2)
    expect(two.found.every((c) => c.mergedFrom === 1)).toBe(true)
    const cards = buildCandidates([{ ...A, id: '1', body: 'Spent Rs.100 On HDFC Bank Card 1111 At TEA' }, { ...A, id: '2', body: 'Rs.100 debited from HDFC Bank A/c XX2222 UPI Ref 312345678913' }], bud(), () => null)
    expect(cards.found).toHaveLength(2)
  })
  it('a payment already waiting in the Inbox under a twin text is not offered again', () => {
    const b = bud()
    const planned = planDrain([{ id: 'q1', sender: A.address, body: A.body, receivedAt: day }], b, { auto: false, now: day, newId: () => 'e' })
    const withInbox = applyPlan(b, planned, day)
    expect(buildCandidates([B], withInbox, () => null).found).toHaveLength(0)
  })
  it('the other cause: "already in the budget" also knows a different spelling of the payee', () => {
    const b = bud({ expenses: [{ id: 'e', date: '2026-11-05', amount: '500.00', categoryId: null, mode: 'upi', instrumentId: null, note: 'Zomato Online Order Pvt Ltd', deletedAt: null }] })
    expect(alreadyAdded(b, { amount: '500.00', date: '2026-11-05', instrumentId: null, merchant: 'Zomato' })).toBe(true)
    expect(alreadyAdded(b, { amount: '500.00', date: '2026-11-05', instrumentId: null, merchant: 'Ravi' })).toBe(false)
    expect(buildCandidates([A], b, () => null).found[0]!.duplicateOfExisting).toBe(true)
  })
})

describe('Inbox drain: one payment, two messages, even in different drains', () => {
  const q = (m: typeof A, id: string) => ({ id, sender: m.address, body: m.body, receivedAt: m.date })
  const o = { auto: false, now: day, newId: () => 'e1' }
  it('the same drain', () => {
    const p = planDrain([q(A, 'q1'), q(B, 'q2')], bud(), o)
    expect(p.items).toHaveLength(1)
    expect(p.items[0]).toMatchObject({ mergedFrom: 2, last4: '1234', nature: 'spend' })
    expect(p.ackIds.sort()).toEqual(['q1', 'q2'])
    expect(p.seen).toHaveLength(2)
  })
  it('a later drain: the twin joins the item already waiting, the queue message is acked, nothing new is added', () => {
    const b1 = applyPlan(bud(), planDrain([q(A, 'q1')], bud(), o), day)
    const p2 = planDrain([q(B, 'q2')], b1, o)
    expect(p2.items).toEqual([])
    expect(p2.merged).toHaveLength(1)
    expect(p2.ackIds).toEqual(['q2'])
    const b2 = applyPlan(b1, p2, day)
    expect(b2.inbox).toHaveLength(1)
    expect(b2.inbox![0]).toMatchObject({ mergedFrom: 2, merchant: 'Zomato Online Order' })
    // and a third arrival of the same message is only recognised, not counted again
    expect(planDrain([q(B, 'q3')], b2, o).items).toEqual([])
  })
  it('the twin of an item already approved or rejected adds nothing', () => {
    const b1 = applyPlan(bud(), planDrain([q(A, 'q1')], bud(), o), day)
    for (const status of ['approved', 'rejected'] as const) {
      const b = { ...b1, inbox: b1.inbox!.map((i): InboxItem => ({ ...i, status })) }
      const p = planDrain([q(B, 'q2')], b, o)
      expect(p.items).toEqual([])
      expect(p.merged ?? []).toEqual([])
      expect(p.ackIds).toEqual(['q2'])
    }
  })
  it('two real payments in one batch are both kept', () => {
    const x = { ...A, body: 'Rs.100 debited from a/c XX1234 to VPA tea@ybl UPI Ref 312345678911' }
    const y = { ...A, body: 'Rs.100 debited from a/c XX1234 to VPA tea@ybl UPI Ref 312345678912' }
    expect(planDrain([q(x, 'q1'), q(y, 'q2')], bud(), o).items).toHaveLength(2)
  })
  it('stores a hash of the reference, never the reference', () => {
    const p = planDrain([q(A, 'q1')], bud(), o)
    expect(p.items[0]!.refKey).toMatch(/^[0-9a-z]{4,30}$/)
    expect(JSON.stringify(p.items)).not.toContain('312345678901')
  })
})

describe('masked samples: examples to refine the reader, with no real digits or names', () => {
  const salt = 'test-salt-xyz'
  const fd = { id: 'f', address: 'AD-SBIINB', date: day, body: 'Dear Customer, your Term Deposit A/c XXXXXXX987654 has been closed prematurely on 05-11-26. Rs.52,340.00 (principal and interest) credited to your A/c XXXXX123456. -SBI' }
  const self = { id: 's', address: 'VM-BOBSMS', date: day, body: 'Rs.10000.00 debited from A/c XXXXXX1234 on 05-11-26 to SELF a/c XX5678 via IMPS Ref No 531234567890. -BOB' }
  const plain = { id: 'p', address: 'VM-HDFCBK', date: day, body: 'Rs.99.00 debited from a/c XX1234 to VPA shop@ybl UPI Ref 312345678999' }
  const r = buildCandidates([A, B, fd, self, plain], bud(), () => null, salt)
  it('is produced for merged messages, own money and deposit messages, and not for plain spending', () => {
    expect(r.maskedSamples.map((m) => m.reason).sort()).toEqual(['merged', 'merged', 'ownMoney', 'ownMoney'])
    expect(r.maskedSamples.filter((m) => m.reason === 'merged').map((m) => m.group)).toEqual([1, 1]) // the two texts of one payment share a group
  })
  it('keeps the layout words and swaps every digit run and name', () => {
    const text = maskedSamplesText(r.maskedSamples)
    expect(text).toContain('Term Deposit')
    expect(text).toMatch(/closed prematurely/)
    expect(text).toMatch(/credited to your A\/c/)
    const real = [A, B, fd, self].map((m) => m.body).join(' ')
    for (const run of new Set(real.match(/\d{3,}/g) ?? [])) expect(text, run).not.toContain(run)
    for (const name of ['ZOMATO', 'zomato', 'Zomato', 'SHOP', 'shop']) expect(text, name).not.toContain(name)
    expect(text.split('\n')[0]).toMatch(/^Masked examples/)
  })
  it('an unsafe sender (a phone number) is hidden', () => {
    const x = buildCandidates([{ ...fd, address: '+919876543210' }], bud(), () => null, salt)
    expect(x.maskedSamples[0]!.sender).toBe('<hidden sender>')
  })
  it('the deposit words are kept by the masker, the digits are not', () => {
    const m = maskText('FD matured. Premature closure proceeds booked. Interest renewed. Sweep transfer own self RD TD. Rs 52,340.00 FD 50100012345678', salt)
    for (const w of ['matured', 'Premature', 'closure', 'proceeds', 'booked', 'Interest', 'renewed', 'Sweep', 'transfer', 'own', 'self', 'RD', 'TD', 'FD']) expect(m).toContain(w)
    expect(m).not.toContain('52,340')
    expect(m).not.toContain('50100012345678')
  })
})
