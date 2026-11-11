import { describe, expect, it } from 'vitest'
import type { BudgetData } from './budget'
import { planDrain } from './inbox'
import { MAX_IGNORED, cardRule, isIgnored, senderKey, senderRule, withRule } from './smsIgnore'
import { buildCandidates } from './smsParse'

const NOW = new Date('2026-11-12T10:00:00+05:30').getTime()
const cat = (id: string, name: string) => ({ id, name, limit: null, parentId: null, deletedAt: null })
const budget = (o: Partial<BudgetData> = {}): BudgetData => ({ overall: null, categories: [cat('c-food', 'Food')], instruments: [], expenses: [], ...o })
const body = (card = '1234', who = 'SWIGGY', n = 1) => `Rs.450.00 spent on HDFC Bank Credit Card XX${card} at ${who} on 12-11-26. Ref 8800000000${n}. Avl limit Rs.90000`
const q = (b: string, sender = 'VM-HDFCBK', id = `m${Math.random()}`) => ({ id, sender, body: b, receivedAt: NOW })
const plan = (msgs: ReturnType<typeof q>[], ignored = [] as ReturnType<typeof senderRule>[], b = budget()) => planDrain(msgs, b, { auto: false, now: NOW, newId: () => 'e1', ignored: ignored.filter((r) => r !== null) as never })

describe('senderKey: one sender however it is written', () => {
  it.each(['VM-HDFCBK', 'vm-hdfcbk', 'AX-HDFCBK-S', 'HDFCBK', ' hdfcbk ', 'JD-HDFCBK-T', 'VM-HDFC BK', 'HDFC_BK'])('%s is HDFCBK', (a) => expect(senderKey(a)).toBe('HDFCBK'))
  it('keeps different banks apart', () => expect(senderKey('VM-ICICIB')).toBe('ICICIB'))
  it('a phone number (a person) is never a sender', () => {
    expect(senderKey('+919876543210')).toBe('')
    expect(senderKey('9876543210')).toBe('')
    expect(senderKey('')).toBe('')
    expect(senderRule('+919876543210')).toBeNull()
  })
})

describe('isIgnored', () => {
  const sender = senderRule('VM-HDFCBK')!
  const card = cardRule({ last4: '1234', bank: 'HDFC Bank' }, 'HDFC Regalia ••1234')!
  it('a sender rule matches any form of that sender, and no other', () => {
    for (const s of ['AX-HDFCBK-S', 'hdfcbk', 'VM-HDFCBK']) expect(isIgnored([sender], { sender: s })).toBe(true)
    expect(isIgnored([sender], { sender: 'VM-ICICIB' })).toBe(false)
    expect(isIgnored([sender], { sender: null })).toBe(false)
  })
  it('a card rule needs the same digits AND the same bank', () => {
    expect(isIgnored([card], { last4: '1234', bank: 'HDFC Bank' })).toBe(true)
    expect(isIgnored([card], { last4: '1234', bank: 'hdfc bank' })).toBe(true) // case
    expect(isIgnored([card], { last4: '1234', bank: 'Axis Bank' })).toBe(false) // another bank with the same digits
    expect(isIgnored([card], { last4: '1234', bank: null })).toBe(false) // unknown bank: not swallowed
    expect(isIgnored([card], { last4: '4321', bank: 'HDFC Bank' })).toBe(false)
    expect(isIgnored([card], { last4: null, bank: 'HDFC Bank' })).toBe(false)
  })
  it('3-digit and 4-digit tails of the same card agree', () => {
    expect(isIgnored([card], { last4: '234', bank: 'HDFC Bank' })).toBe(true)
    expect(isIgnored([cardRule({ last4: '234', bank: 'HDFC Bank' })!], { last4: '1234', bank: 'HDFC Bank' })).toBe(true)
    expect(isIgnored([card], { last4: '999', bank: 'HDFC Bank' })).toBe(false)
  })
  it('a card rule with no bank matches on the digits alone', () => {
    expect(isIgnored([cardRule({ last4: '1234', bank: null })!], { last4: '1234', bank: 'Axis Bank' })).toBe(true)
  })
  it('bad digits make no rule', () => {
    expect(cardRule({ last4: '12', bank: 'HDFC Bank' })).toBeNull()
    expect(cardRule({ last4: 'abcd', bank: null })).toBeNull()
    expect(cardRule({ last4: null, bank: 'HDFC Bank' })).toBeNull()
  })
  it('an empty list ignores nothing', () => {
    expect(isIgnored([], { sender: 'VM-HDFCBK', last4: '1234', bank: 'HDFC Bank' })).toBe(false)
    expect(isIgnored(undefined, { sender: 'VM-HDFCBK' })).toBe(false)
  })
})

describe('withRule', () => {
  it('adds newest first, ignores a repeat, refuses past the cap', () => {
    const a = senderRule('VM-AAAAAA')!
    let list = withRule(undefined, a)!
    expect(withRule(list, a)).toEqual(list)
    expect(withRule(list, senderRule('VM-BBBBBB')!)!.map((r) => r.sender)).toEqual(['BBBBBB', 'AAAAAA'])
    for (let i = 0; i < MAX_IGNORED - 1; i++) list = withRule(list, senderRule(`VM-X${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}ZZ`)!)!
    expect(list).toHaveLength(MAX_IGNORED)
    expect(withRule(list, senderRule('VM-QQQQQQ')!)).toBeNull()
  })
})

describe('the drain drops ignored messages before anything else', () => {
  it('an ignored sender: acked, no item, nothing remembered', () => {
    const m = q(body())
    const p = plan([m], [senderRule('AX-HDFCBK-S')])
    expect(p.items).toEqual([])
    expect(p.seen).toEqual([])
    expect(p.ackIds).toEqual([m.id])
  })
  it('an ignored card: only that card is dropped', () => {
    const rule = cardRule({ last4: '1234', bank: 'HDFC Bank' })!
    const mine = q(body('1234'), 'VM-HDFCBK', 'a')
    const other = q(body('9999', 'SWIGGY', 2), 'VM-HDFCBK', 'b')
    const p = planDrain([mine, other], budget(), { auto: false, now: NOW, newId: () => 'e', ignored: [rule] })
    expect(p.items.map((i) => i.last4)).toEqual(['9999'])
    expect(p.ackIds.sort()).toEqual(['a', 'b'])
  })
  it('it is not a duplicate or a learning input: nothing is compared, nothing stored', () => {
    const rule = cardRule({ last4: '1234', bank: 'HDFC Bank' })!
    const b = budget({ expenses: [{ id: 'x', date: '2026-11-12', amount: '450', categoryId: null, mode: 'credit', instrumentId: null, note: 'Swiggy', deletedAt: null }] })
    const p = planDrain([q(body())], b, { auto: true, now: NOW, newId: () => 'e', ignored: [rule] })
    expect(p).toMatchObject({ items: [], entries: [], seen: [] })
  })
  it('an item records its sender in the short form, never the raw header', () => {
    const p = plan([q(body(), 'VM-HDFCBK-S')])
    expect(p.items[0]!.sender).toBe('HDFCBK')
    expect(JSON.stringify(p.items)).not.toContain('VM-HDFCBK')
  })
})

describe('the manual scan honours the list too', () => {
  const msgs = [{ id: '1', address: 'VM-HDFCBK', date: NOW, body: body('1234') }, { id: '2', address: 'VM-ICICIB', date: NOW, body: 'INR 300 spent using ICICI Bank Credit Card XX4455 on 12-Nov-26 at AMAZON' }]
  it('drops ignored senders and cards before listing, logging or counting', () => {
    const none = buildCandidates(msgs, budget(), () => null)
    expect(none.found).toHaveLength(2)
    expect(none.found[0]!.sender).toBe('HDFCBK')
    const s = buildCandidates(msgs, budget(), () => null, 'k', [senderRule('VM-HDFCBK')!])
    expect(s.found.map((c) => c.merchant)).toEqual(['Amazon'])
    expect(s.alreadySeen).toBe(0)
    const c = buildCandidates(msgs, budget(), () => null, 'k', [cardRule({ last4: '4455', bank: 'ICICI Bank' })!])
    expect(c.found.map((x) => x.sender)).toEqual(['HDFCBK'])
  })
})
