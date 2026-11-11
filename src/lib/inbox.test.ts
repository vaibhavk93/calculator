import { describe, expect, it } from 'vitest'
import type { BudgetData, BudgetExpense, PayInstrument } from './budget'
import {
  AUTO_AFTER,
  MAX_INBOX,
  MAX_LEARNED,
  applyPlan,
  autoAddCheck,
  drainQueue,
  driftTripped,
  forgetPayee,
  isPerson,
  logAuto,
  logBad,
  noteCorrection,
  payeeKey,
  planDrain,
  pruneInbox,
  recentlyAuto,
  recordConfirm,
  suggestion,
  suggestionConfirmed,
  type DrainIO,
  type InboxItem,
  type LearnedPayee,
} from './inbox'
import { memorySmsQueue, type QueuedMessage } from './smsQueue'

const NOW = new Date('2026-11-12T10:00:00+05:30').getTime()
const DAY = 86_400_000
const cat = (id: string, name: string) => ({ id, name, limit: null, parentId: null, deletedAt: null })
const card: PayInstrument = { id: 'i-hdfc', name: 'HDFC Regalia', kind: 'credit', network: 'visa', bank: 'HDFC Bank', last4: '1234', rewardNote: '', deletedAt: null }
const bank: PayInstrument = { id: 'i-sal', name: 'HDFC Salary', kind: 'bank', network: null, bank: 'HDFC Bank', last4: '7261', rewardNote: '', deletedAt: null }

const budget = (o: Partial<BudgetData> = {}): BudgetData => ({ overall: null, categories: [cat('c-food', 'Food'), cat('c-shop', 'Shopping'), cat('c-rent', 'Rent')], instruments: [card, bank], expenses: [], ...o })
const learnedFood = (key: string, count = 2): LearnedPayee => ({ key, categoryId: 'c-food', count, lastAt: 1 })

let n = 0
const swiggy = (amount = '450.00', extra = ''): string => `Rs.${amount} spent on HDFC Bank Credit Card XX1234 at SWIGGY on 12-11-26. Ref ${++n}00000000${n}${extra}. Avl limit Rs.90000`
const msg = (body: string, id = `m${++n}`, at = NOW): QueuedMessage => ({ id, sender: 'VM-HDFCBK', body, receivedAt: at })
const newId = (() => { let k = 0; return () => `e${++k}` })()
const plan = (msgs: QueuedMessage[], b: BudgetData, auto = false) => planDrain(msgs, b, { auto, now: NOW, newId })

describe('payeeKey', () => {
  it('lower-cases, keeps words, drops words with digits, at most 3 words', () => {
    expect(payeeKey('SWIGGY')).toBe('swiggy')
    expect(payeeKey('Swiggy Instamart 4412')).toBe('swiggy instamart')
    expect(payeeKey('A B C D E')).toBe('a b c')
  })
  it('is null when too little is left', () => {
    expect(payeeKey('')).toBeNull()
    expect(payeeKey('12345')).toBeNull()
    expect(payeeKey('ab')).toBeNull()
  })
})

describe('learning counter transitions', () => {
  it('first confirm is 1, same tag again is +1, a different tag starts again at 1', () => {
    let l = recordConfirm(undefined, 'swiggy', 'c-food', 10)
    expect(l).toEqual([{ key: 'swiggy', categoryId: 'c-food', count: 1, lastAt: 10 }])
    l = recordConfirm(l, 'swiggy', 'c-food', 20)
    expect(l[0]).toMatchObject({ count: 2, lastAt: 20 })
    l = recordConfirm(l, 'swiggy', 'c-food', 30)
    expect(l[0]!.count).toBe(3)
    l = recordConfirm(l, 'swiggy', 'c-shop', 40)
    expect(l[0]).toMatchObject({ categoryId: 'c-shop', count: 1 })
    expect(l).toHaveLength(1)
  })
  it('forgetting resets the payee', () => {
    const l = recordConfirm(recordConfirm(undefined, 'a b', 'c-food', 1), 'zomato', 'c-food', 2)
    expect(forgetPayee(l, 'zomato').map((x) => x.key)).toEqual(['a b'])
  })
  it('keeps the newest MAX_LEARNED payees', () => {
    let l: LearnedPayee[] | undefined
    for (let i = 0; i < MAX_LEARNED + 5; i++) l = recordConfirm(l, `payee ${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}x`, 'c-food', i)
    expect(l).toHaveLength(MAX_LEARNED)
    expect(l![0]!.lastAt).toBe(MAX_LEARNED + 4)
  })
  it('a count never goes past 99', () => {
    let l = [{ key: 'swiggy', categoryId: 'c-food', count: 99, lastAt: 1 }]
    l = recordConfirm(l, 'swiggy', 'c-food', 2)
    expect(l[0]!.count).toBe(99)
  })
})

describe('suggestions say why', () => {
  it('once, twice, three times in a row', () => {
    expect(suggestion(budget({ learned: [learnedFood('swiggy', 1)] }), 'Swiggy')).toEqual({ categoryId: 'c-food', why: 'You tagged Swiggy as Food once' })
    expect(suggestion(budget({ learned: [learnedFood('swiggy', 2)] }), 'Swiggy').why).toBe('You tagged Swiggy as Food twice in a row')
    expect(suggestion(budget({ learned: [learnedFood('swiggy', 3)] }), 'Swiggy').why).toBe('You tagged Swiggy as Food 3 times in a row')
  })
  it('your rule wins over what was learned', () => {
    const s = suggestion(budget({ learned: [learnedFood('swiggy', 3)], rules: [{ id: 'r1', match: 'swiggy', categoryId: 'c-shop' }] }), 'Swiggy')
    expect(s.categoryId).toBe('c-shop')
    expect(s.why).toMatch(/Your rule/)
  })
  it('falls back to a guess from the name, and to nothing', () => {
    expect(suggestion(budget(), 'Swiggy').why).toMatch(/guess/)
    expect(suggestion(budget(), 'Rahul S')).toEqual({ categoryId: null, why: '' })
  })
  it('a learned category that was deleted is not suggested', () => {
    const b = budget({ categories: [{ ...cat('c-food', 'Food'), deletedAt: 5 }], learned: [learnedFood('swiggy', 3)] })
    expect(suggestion(b, 'Swiggy').categoryId).toBeNull()
  })
})

describe('people are never confirmed', () => {
  it('UPI to a name is a person, UPI to a known shop is not, P2P/P2M markers decide first', () => {
    expect(isPerson('upi', 'Rahul S', '')).toBe(true)
    expect(isPerson('upi', 'Ravi Kumar', '')).toBe(true) // "Ravi" must not look like the phone company "vi"
    expect(isPerson('upi', '', '')).toBe(true) // unknown payee over UPI: treated as a person
    expect(isPerson('upi', 'Swiggy', '')).toBe(false)
    expect(isPerson('upi', 'Sharma Stores', '')).toBe(false)
    expect(isPerson('upi', 'Rahul S', 'UPI/P2M/1234/Rahul S')).toBe(false)
    expect(isPerson('upi', 'Swiggy', 'UPI/P2P/1234/Swiggy')).toBe(true)
    expect(isPerson('credit', 'Rahul S', '')).toBe(false)
  })
})

describe('the confidence test (Auto mode)', () => {
  const item = (o: Partial<InboxItem> = {}): InboxItem => ({ id: 'abc123', date: '2026-11-12', amount: '450.00', merchant: 'SWIGGY', kind: 'spend', mode: 'credit', instrumentId: 'i-hdfc', last4: '1234', bank: 'HDFC Bank', categoryId: 'c-food', why: '', person: false, status: 'pending', at: NOW, ...o })
  const learned = budget({ learned: [learnedFood('swiggy', AUTO_AFTER)] })
  const check = (b: BudgetData, i: InboxItem, dup = false) => autoAddCheck(b, i, dup, NOW)

  it('passes when ALL hold', () => expect(check(learned, item())).toEqual({ ok: true }))
  it('never the first time, and once is only a suggestion', () => {
    expect(check(budget(), item())).toMatchObject({ ok: false, reason: 'New payee' })
    expect(check(budget({ learned: [learnedFood('swiggy', 1)] }), item())).toMatchObject({ ok: false, reason: 'Tagged only once' })
  })
  it('not a person', () => expect(check(learned, item({ person: true }))).toMatchObject({ ok: false, reason: 'A person, not a shop' }))
  it('not a duplicate', () => expect(check(learned, item(), true)).toMatchObject({ ok: false }))
  it('exactly one instrument must match', () => expect(check(learned, item({ instrumentId: null }))).toMatchObject({ ok: false, reason: 'No single card or account matched' }))
  it('the how-paid must be known', () => expect(check(learned, item({ mode: null }))).toMatchObject({ ok: false }))
  it('the suggested category must be the learned one', () => expect(check(learned, item({ categoryId: 'c-shop' }))).toMatchObject({ ok: false }))
  it('a rule of yours that says something else blocks it', () => {
    expect(check(budget({ ...learned, rules: [{ id: 'r', match: 'swiggy', categoryId: 'c-shop' }] }), item())).toMatchObject({ ok: false, reason: 'Your rule says something else' })
  })
  it('a card bill is never auto-added', () => expect(check(learned, item({ kind: 'cardBill' }))).toMatchObject({ ok: false }))
  it('a bad date is refused by the same checks as a typed entry', () => expect(check(learned, item({ date: '1999-01-01' }))).toMatchObject({ ok: false }))
  it('a deleted learned category is refused', () => {
    expect(check(budget({ ...learned, categories: [{ ...cat('c-food', 'Food'), deletedAt: 1 }] }), item())).toMatchObject({ ok: false })
  })
  it('suggestionConfirmed (Approve all suggested) needs the same learning but no card match', () => {
    expect(suggestionConfirmed(learned, item({ instrumentId: null }))).toBe(true)
    expect(suggestionConfirmed(learned, item({ person: true }))).toBe(false)
    expect(suggestionConfirmed(budget({ learned: [learnedFood('swiggy', 1)] }), item())).toBe(false)
    expect(suggestionConfirmed(learned, item({ status: 'approved' }))).toBe(false)
  })
})

describe('planDrain', () => {
  it('turns a bank message into a pending item with parsed fields only', () => {
    const p = plan([msg(swiggy())], budget())
    expect(p.items).toHaveLength(1)
    const i = p.items[0]!
    expect(i).toMatchObject({ amount: '450.00', merchant: 'Swiggy', date: '2026-11-12', mode: 'credit', instrumentId: 'i-hdfc', status: 'pending', person: false })
    expect(JSON.stringify(p.items)).not.toMatch(/spent on|Avl limit|VM-HDFCBK/) // never the message, never the sender
    expect(Object.keys(i).sort()).not.toContain('body')
  })
  it('OTP, offers and money-in are acked and dropped', () => {
    const msgs = [msg('Your OTP is 123456 for txn of Rs 500. Do not share'), msg('Congratulations! Pre-approved loan of Rs 500000. Apply now'), msg('Rs 5000 credited to a/c XX1234 by SALARY'), msg('hello there')]
    const p = plan(msgs, budget())
    expect(p.items).toEqual([])
    expect(p.ackIds.sort()).toEqual(msgs.map((m) => m.id).sort())
    expect(p.seen).toEqual([])
  })
  it('the same queue id twice, and the same payment twice, make one item', () => {
    const m = msg(swiggy())
    const twin = { ...m, id: 'other' } // same text under another id: same fingerprint
    const p = plan([m, m, twin], budget())
    expect(p.items).toHaveLength(1)
    expect(p.ackIds.sort()).toEqual([m.id, 'other'].sort())
  })
  it('skips what was seen before (manual scan or an earlier drain) and acks it', () => {
    const m = msg(swiggy())
    const first = plan([m], budget())
    const b = applyPlan(budget(), first, NOW)
    const again = plan([m], b)
    expect(again.items).toEqual([])
    expect(again.ackIds).toEqual([m.id])
    expect(b.smsSeen).toEqual([first.items[0]!.id]) // the same fingerprint the manual scan keeps
  })
  it('skips a payment already entered by hand and acks it', () => {
    const e: BudgetExpense = { id: 'x1', date: '2026-11-12', amount: '450', categoryId: 'c-food', mode: 'credit', instrumentId: 'i-hdfc', note: 'Swiggy', deletedAt: null }
    const m = msg(swiggy())
    const p = plan([m], budget({ expenses: [e] }))
    expect(p.items).toEqual([])
    expect(p.ackIds).toEqual([m.id])
    expect(p.seen).toHaveLength(1)
  })
  it('two real payments of one amount in one batch are both kept', () => {
    const p = plan([msg(swiggy('50.00')), msg(swiggy('50.00'))], budget()) // different refs
    expect(p.items).toHaveLength(2)
  })
  it('a full inbox holds the rest: they are NOT acked, so they stay in the queue', () => {
    const full: InboxItem[] = Array.from({ length: MAX_INBOX }, (_, k) => ({ id: `id${k}x`, date: '2026-11-12', amount: '1', merchant: 'Shop', kind: 'spend', mode: null, instrumentId: null, last4: null, bank: null, categoryId: null, why: '', person: false, status: 'pending', at: NOW }))
    const m = msg(swiggy())
    const p = plan([m], budget({ inbox: full }))
    expect(p.items).toEqual([])
    expect(p.held).toBe(1)
    expect(p.ackIds).toEqual([])
  })
  it('old resolved items make room; pending ones are never dropped', () => {
    const old = (status: InboxItem['status'], at: number): InboxItem => ({ id: `o${status}${at}`.slice(0, 12), date: '2026-10-01', amount: '1', merchant: 'Shop', kind: 'spend', mode: null, instrumentId: null, last4: null, bank: null, categoryId: null, why: '', person: false, status, at, resolvedAt: at })
    const pruned = pruneInbox([old('pending', 1), old('approved', NOW - 20 * DAY), old('rejected', NOW - 2 * DAY)], NOW)
    expect(pruned.map((i) => i.status).sort()).toEqual(['pending', 'rejected'])
  })

  describe('Auto mode', () => {
    const learned = (b: Partial<BudgetData> = {}) => budget({ learned: [learnedFood('swiggy', 2)], ...b })
    it('adds a confident payment straight to the entries, flagged, and logs it', () => {
      const p = plan([msg(swiggy())], learned(), true)
      expect(p.entries).toHaveLength(1)
      expect(p.entries[0]).toMatchObject({ amount: '450.00', categoryId: 'c-food', mode: 'credit', instrumentId: 'i-hdfc', note: 'Swiggy', auto: true, deletedAt: null })
      expect(p.items[0]).toMatchObject({ status: 'approved', auto: true, entryId: p.entries[0]!.id })
      const b = applyPlan(learned(), p, NOW)
      expect(b.expenses).toHaveLength(1)
      expect(b.autoLog).toEqual([{ id: p.items[0]!.id, bad: false }])
      expect(recentlyAuto(b, NOW)).toHaveLength(1)
    })
    it('does not auto-add the first time, a person, or an unmatched card; they go to the inbox', () => {
      expect(plan([msg(swiggy())], budget(), true).entries).toEqual([])
      const upiPerson = 'Rs.150.00 debited from a/c XX7261 on 12-11-26 to VPA rahul.s@okhdfcbank (UPI Ref No 4123456789012). Not you? Call 18001'
      const b = budget({ learned: [learnedFood('rahul s', 5)] })
      const p = plan([msg(upiPerson)], b, true)
      expect(p.entries).toEqual([])
      expect(p.items[0]).toMatchObject({ status: 'pending', person: true })
      const noCard = swiggy().replace('XX1234', 'XX9999')
      expect(plan([msg(noCard)], learned(), true).entries).toEqual([])
    })
    it('review mode never auto-adds, however well learned', () => {
      expect(plan([msg(swiggy())], learned(), false).entries).toEqual([])
    })
    it('is off while the drift breaker is tripped', () => {
      const tripped = learned({ autoLog: [{ id: 'aa11', bad: true }, { id: 'bb22', bad: true }] })
      expect(plan([msg(swiggy())], tripped, true).entries).toEqual([])
    })
    it('does not self-reinforce: auto-adding changes no learned count', () => {
      const b = applyPlan(learned(), plan([msg(swiggy())], learned(), true), NOW)
      expect(b.learned).toEqual([learnedFood('swiggy', 2)])
    })
    it('two confident payments in one batch are both added', () => {
      const p = plan([msg(swiggy('450.00')), msg(swiggy('450.00'))], learned(), true)
      expect(p.entries).toHaveLength(2)
    })
  })
})

describe('the drift circuit breaker', () => {
  it('trips at 2 bad among the last 10, not before', () => {
    let log = [] as ReturnType<typeof logAuto>
    for (let i = 0; i < 10; i++) log = logAuto(log, `id${i}aa`)
    expect(driftTripped(log)).toBe(false)
    log = logBad(log, 'id9aa')
    expect(driftTripped(log)).toBe(false)
    log = logBad(log, 'id3aa')
    expect(driftTripped(log)).toBe(true)
  })
  it('only the last 10 count: an old bad one falls out of the window', () => {
    let log = logAuto(undefined, 'old1aa')
    log = logBad(log, 'old1aa')
    log = logBad(logAuto(log, 'old2aa'), 'old2aa')
    expect(driftTripped(log)).toBe(true)
    for (let i = 0; i < 10; i++) log = logAuto(log, `new${i}aa`)
    expect(driftTripped(log)).toBe(false)
    expect(log).toHaveLength(10)
  })
  it('a correction marks the log, forgets the payee and drops the Auto-added flag', () => {
    const p = plan([msg(swiggy())], budget({ learned: [learnedFood('swiggy', 2)] }), true)
    const b = applyPlan(budget({ learned: [learnedFood('swiggy', 2)] }), p, NOW)
    const c = noteCorrection(b, p.entries[0]!.id)
    expect(c.autoLog![0]!.bad).toBe(true)
    expect(c.learned).toEqual([])
    expect(c.expenses[0]!.auto).toBeUndefined()
    expect(noteCorrection(c, p.entries[0]!.id)).toBe(c) // no longer auto: nothing more to count
    expect(noteCorrection(b, 'not-an-auto-entry')).toBe(b)
  })
})

describe('drain, then ack: no possible loss', () => {
  const setup = (msgs: QueuedMessage[], opts: { persist?: () => Promise<boolean> } = {}) => {
    const queue = memorySmsQueue(msgs)
    const calls: string[] = []
    const ack = queue.ack
    queue.ack = async (ids) => { calls.push('ack'); await ack(ids) }
    let b = budget()
    const io: DrainIO = {
      budget: () => b,
      auto: () => false,
      commit: (p) => { calls.push('commit'); b = applyPlan(b, p, NOW) },
      persist: async () => { calls.push('persist'); return (await opts.persist?.()) ?? true },
      now: () => NOW,
      newId,
    }
    return { queue, calls, io, get budget() { return b } }
  }

  it('order is commit, persist, THEN ack; the queue is empty afterwards', async () => {
    const t = setup([msg(swiggy()), msg('Your OTP is 123456')])
    const r = await drainQueue(t.queue, t.io)
    expect(t.calls).toEqual(['commit', 'persist', 'ack'])
    expect(r).toMatchObject({ status: 'done', pending: 1 })
    expect(await t.queue.drain()).toEqual([])
    expect(t.budget.inbox).toHaveLength(1)
  })
  it('a crash at persist leaves every message in the queue', async () => {
    const t = setup([msg(swiggy())], { persist: async () => { throw new Error('process died') } })
    const r = await drainQueue(t.queue, t.io)
    expect(r.status).toBe('unsaved')
    expect(t.calls).not.toContain('ack')
    expect(await t.queue.drain()).toHaveLength(1)
  })
  it('storage that refuses the write (false) acks nothing', async () => {
    const t = setup([msg(swiggy())], { persist: async () => false })
    expect((await drainQueue(t.queue, t.io)).status).toBe('unsaved')
    expect(await t.queue.drain()).toHaveLength(1)
  })
  it('after a failed save, a second drain still acks nothing until a save works, and never double-counts', async () => {
    let ok = false
    const t = setup([msg(swiggy())], { persist: async () => ok })
    await drainQueue(t.queue, t.io)
    expect(await t.queue.drain()).toHaveLength(1)
    ok = true
    const r = await drainQueue(t.queue, t.io)
    expect(r.status).toBe('done')
    expect(await t.queue.drain()).toEqual([])
    expect(t.budget.inbox).toHaveLength(1) // the same fingerprint was skipped, not added twice
  })
  it('a crash after the save but before the ack: the next drain skips it by fingerprint and acks', async () => {
    const m = msg(swiggy())
    const t = setup([m])
    t.queue.ack = async () => { throw new Error('crashed before ack') }
    expect((await drainQueue(t.queue, t.io)).status).toBe('failed')
    expect(await t.queue.drain()).toHaveLength(1)
    const q2 = memorySmsQueue([m])
    expect((await drainQueue(q2, t.io)).status).toBe('done')
    expect(await q2.drain()).toEqual([])
    expect(t.budget.inbox).toHaveLength(1)
  })
  it('a drain that throws changes nothing', async () => {
    const t = setup([])
    t.queue.drain = async () => { throw new Error('plugin gone') }
    expect((await drainQueue(t.queue, t.io)).status).toBe('failed')
    expect(t.calls).toEqual([])
  })
  it('an empty queue is quiet', async () => {
    const t = setup([])
    expect((await drainQueue(t.queue, t.io)).status).toBe('empty')
    expect(t.calls).toEqual([])
  })
  it('messages held back for a full inbox are not acked', async () => {
    const t = setup([msg(swiggy())])
    const full = Array.from({ length: MAX_INBOX }, (_, k) => ({ id: `id${k}x`, date: '2026-11-12', amount: '1', merchant: 'Shop', kind: 'spend' as const, mode: null, instrumentId: null, last4: null, bank: null, categoryId: null, why: '', person: false, status: 'pending' as const, at: NOW }))
    t.io.budget = () => budget({ inbox: full })
    const r = await drainQueue(t.queue, t.io)
    expect(r.held).toBe(1)
    expect(await t.queue.drain()).toHaveLength(1)
  })
})
