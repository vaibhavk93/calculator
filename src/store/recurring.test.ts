import { describe, expect, it } from 'vitest'
import { createAppStore } from './app'
import { defaultPersisted, migrate, sanitizeBudget } from './persistence'
import { starterBudget } from './types'
import type { ExpenseDraft } from '../lib/budget'

const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).getTime()
const NOW = at(2026, 11, 10)

function setup(budget = starterBudget()) {
  let t = NOW
  let n = 0
  const store = createAppStore({ ...defaultPersisted(), budget }, { now: () => t, newId: () => `id${++n}` })
  return { store, get: store.getState, tick: (ms: number) => (t += ms) }
}
const draft = (o: Partial<ExpenseDraft> = {}): ExpenseDraft => ({ amount: '199', categoryId: 'starter-bills', date: '2026-11-03', note: 'Netflix', ...o })

describe('Repeats on an expense: one record owns the reminder and the entries', () => {
  it('makes the entry, the bill, its Due card and its reminder together', () => {
    const { get } = setup()
    expect(get().addExpense(draft(), 'monthly')).toBe(true)
    const bill = get().budget.recurring![0]!
    expect(bill).toMatchObject({ kind: 'bill', title: 'Netflix', amount: '199', repeat: 'monthly', categoryId: 'starter-bills' })
    expect(get().budget.expenses[0]!.recurringId).toBe(bill.id)
    const card = get().cards.find((c) => c.id === bill.cardId)!
    expect(card).toMatchObject({ kind: 'task', title: 'Netflix', amount: '199' })
    const rem = get().reminders.find((r) => r.cardId === card.id)!
    expect(rem.dueAt).toBe(at(2026, 12, 3)) // one month after the entry. The date lives only on the reminder.
    expect(rem.repeat).toBe('monthly')
    expect(bill).not.toHaveProperty('dueAt')
  })
  it('Never makes no bill, no card and no reminder', () => {
    const { get } = setup()
    get().addExpense(draft(), null)
    expect(get().budget.recurring).toBeUndefined()
    expect(get().cards).toEqual([])
    expect(get().reminders).toEqual([])
  })
  it('a refund or a bill payment never repeats', () => {
    const { get } = setup()
    get().addExpense(draft({ refund: true }), 'monthly')
    get().addExpense(draft({ settlement: 'transfer', categoryId: null }), 'monthly')
    expect(get().budget.recurring).toBeUndefined()
    expect(get().budget.expenses).toHaveLength(2)
  })
  it('a refused entry makes no bill', () => {
    const { get } = setup()
    expect(get().addExpense(draft({ amount: '0' }), 'monthly')).toBe(false)
    expect(get().budget.recurring).toBeUndefined()
    expect(get().cards).toEqual([])
  })
  it('an old entry can be turned into a bill when edited, once', () => {
    const { get } = setup()
    get().addExpense(draft(), null)
    const id = get().budget.expenses[0]!.id
    expect(get().updateExpense(id, draft(), 'yearly')).toBe(true)
    expect(get().budget.recurring).toHaveLength(1)
    expect(get().budget.expenses[0]!.recurringId).toBe(get().budget.recurring![0]!.id)
    get().updateExpense(id, draft(), 'monthly') // already a bill: no second record
    expect(get().budget.recurring).toHaveLength(1)
  })
  it('a bill on the 31st keeps aiming at the 31st', () => {
    const { get } = setup()
    get().addExpense(draft({ date: '2026-10-31' }), 'monthly')
    expect(get().reminders[0]!.anchorDay).toBe(31)
  })
})

describe('marking a bill paid in Due', () => {
  const withBill = () => {
    const s = setup()
    s.get().addExpense(draft({ mode: 'upi' }), 'monthly')
    return { ...s, rem: () => s.get().reminders[0]! }
  }
  it('adds the entry for that period, dated the due day, and moves the reminder on', () => {
    const { get, rem, tick } = withBill()
    tick(at(2026, 12, 5) - NOW) // paid 2 days after it was due on 3 Dec
    const before = get().budget.expenses.length
    get().markPaid(rem().id)
    const added = get().budget.expenses[0]!
    expect(get().budget.expenses).toHaveLength(before + 1)
    expect(added).toMatchObject({ date: '2026-12-03', amount: '199', categoryId: 'starter-bills', mode: 'upi', note: 'Netflix', recurringId: get().budget.recurring![0]!.id })
    expect(rem().dueAt).toBe(at(2027, 1, 3))
    expect(get().snack?.text).toBe('Paid. Added to your budget')
  })
  it('paid early: dated today, not in the future', () => {
    const { get, rem } = withBill()
    get().markPaid(rem().id) // due 3 Dec, today is 10 Nov
    expect(get().budget.expenses[0]!.date).toBe('2026-11-10')
  })
  it('tapping it twice in a day does not add the same day twice', () => {
    const { get, rem } = withBill()
    get().markPaid(rem().id)
    get().markPaid(rem().id)
    expect(get().budget.expenses.filter((e) => e.date === '2026-11-10')).toHaveLength(1)
  })
  it('Undo takes the entry and the date move back', () => {
    const { get, rem } = withBill()
    const due = rem().dueAt
    get().markPaid(rem().id)
    get().undoRemoval()
    expect(get().budget.expenses).toHaveLength(1)
    expect(rem().dueAt).toBe(due)
  })
  it('a paused bill adds nothing, even if its note is ticked in To-do', () => {
    const { get } = withBill()
    const bill = get().budget.recurring![0]!
    get().pauseBill(bill.id)
    expect(get().reminders).toEqual([])
    get().setTaskDone(bill.cardId!, true)
    expect(get().budget.expenses).toHaveLength(1)
  })
  it('ticking the task in To-do does the same as Mark paid', () => {
    const { get, rem } = withBill()
    const cardId = rem().cardId
    get().setTaskDone(cardId, true)
    expect(get().budget.expenses).toHaveLength(2)
    expect(get().snack?.text).toContain('Added to your budget')
    get().undoRemoval()
    expect(get().budget.expenses).toHaveLength(1)
  })
  it('a plain reminder with no bill adds nothing', () => {
    const { get } = setup()
    get().saveCard({ title: 'Rent', kind: 'task', toolId: null, inputs: null, summary: '', amount: '5000', lines: [] }, { dueAt: at(2026, 11, 20), repeat: 'monthly', leadDays: 1 })
    get().markPaid(get().reminders[0]!.id)
    expect(get().budget.expenses).toEqual([])
  })
})

describe('Bills view actions', () => {
  const withBill = () => {
    const s = setup()
    s.get().addExpense(draft(), 'monthly')
    return { ...s, id: s.get().budget.recurring![0]!.id }
  }
  it('editing the name, amount and date changes the record, the card and the reminder', () => {
    const { get, id } = withBill()
    expect(get().updateBill(id, { title: 'Netflix 4K', amount: '649', date: '2026-12-20' })).toBe(true)
    expect(get().budget.recurring![0]).toMatchObject({ title: 'Netflix 4K', amount: '649' })
    expect(get().cards[0]).toMatchObject({ title: 'Netflix 4K', amount: '649' })
    expect(get().reminders[0]).toMatchObject({ dueAt: at(2026, 12, 20), anchorDay: 20 })
  })
  it('refuses a bad amount in plain words and changes nothing', () => {
    const { get, id } = withBill()
    expect(get().updateBill(id, { amount: '0' })).toBe(false)
    expect(get().notice?.text).toBe('Enter an amount above zero')
    expect(get().budget.recurring![0]!.amount).toBe('199')
  })
  it('pause removes the reminder; resume brings it back on the next due date', () => {
    const { get, id } = withBill()
    get().pauseBill(id)
    expect(get().reminders).toEqual([])
    expect(get().budget.recurring![0]).toMatchObject({ paused: true, pausedDue: at(2026, 12, 3) })
    get().resumeBill(id)
    expect(get().budget.recurring![0]!.paused).toBeUndefined()
    expect(get().reminders[0]!.dueAt).toBe(at(2026, 12, 3))
  })
  it('resume after a long pause skips the dates that went by', () => {
    const { get, id, tick } = withBill()
    get().pauseBill(id)
    tick(at(2027, 3, 20) - NOW)
    get().resumeBill(id)
    expect(get().reminders[0]!.dueAt).toBe(at(2027, 4, 3))
  })
  it('stop removes the reminder and the card, keeps the past entries, and Undo brings it all back', () => {
    const { get, id } = withBill()
    get().stopBill(id)
    expect(get().reminders).toEqual([])
    expect(get().cards).toEqual([])
    expect(get().budget.expenses).toHaveLength(1)
    expect(get().budget.recurring![0]!.deletedAt).not.toBeNull()
    get().undoRemoval()
    expect(get().budget.recurring![0]!.deletedAt).toBeNull()
    expect(get().cards).toHaveLength(1)
    expect(get().reminders).toHaveLength(1)
  })
  it('Remove in Due ends the bill too', () => {
    const { get } = withBill()
    get().removeReminder(get().reminders[0]!.id)
    expect(get().budget.recurring![0]!.deletedAt).not.toBeNull()
    expect(get().reminders).toEqual([])
  })
  it('stops adding bills at the cap', () => {
    const { get } = setup()
    for (let i = 0; i < 100; i++) get().addExpense(draft({ note: `b${i}` }), 'monthly')
    expect(get().cards.length).toBeLessThanOrEqual(100)
    expect(get().addExpense(draft({ note: 'one more' }), 'monthly')).toBe(false)
  })
})

describe('credit card bill reminder', () => {
  const withCard = (dueDay: number | null = 18) => {
    const s = setup()
    const id = s.get().addInstrument({ name: 'Regalia', kind: 'credit', network: 'visa', statementDay: 5, dueDay })!
    return { ...s, id }
  }
  it('makes a monthly Due reminder on the due day, with no amount, and never adds an entry', () => {
    const { get, id } = withCard()
    expect(get().setCardBillReminder(id, true)).toBe(true)
    const bill = get().budget.recurring![0]!
    expect(bill).toMatchObject({ kind: 'cardBill', amount: null, repeat: 'monthly', instrumentId: id })
    expect(get().reminders[0]).toMatchObject({ dueAt: at(2026, 11, 18), anchorDay: 18, repeat: 'monthly' })
    get().markPaid(get().reminders[0]!.id)
    expect(get().budget.expenses).toEqual([])
    expect(get().reminders[0]!.dueAt).toBe(at(2026, 12, 18))
  })
  it('turning it on twice makes one reminder', () => {
    const { get, id } = withCard()
    get().setCardBillReminder(id, true)
    get().setCardBillReminder(id, true)
    expect(get().budget.recurring).toHaveLength(1)
  })
  it('needs the due day, and says so', () => {
    const { get, id } = withCard(null)
    expect(get().setCardBillReminder(id, true)).toBe(false)
    expect(get().notice?.text).toBe("Add this card's due day first")
    expect(get().budget.recurring).toBeUndefined()
  })
  it('turning it off stops it', () => {
    const { get, id } = withCard()
    get().setCardBillReminder(id, true)
    get().setCardBillReminder(id, false)
    expect(get().reminders).toEqual([])
    expect(get().budget.recurring![0]!.deletedAt).not.toBeNull()
  })
  it('changing the due day moves the reminder; clearing it ends the reminder; deleting the card ends it', () => {
    const { get, id } = withCard()
    get().setCardBillReminder(id, true)
    get().updateInstrument(id, { dueDay: 25 })
    expect(get().reminders[0]).toMatchObject({ dueAt: at(2026, 11, 25), anchorDay: 25 })
    get().updateInstrument(id, { name: 'Regalia Gold' })
    expect(get().cards[0]!.title).toBe('Regalia Gold bill')
    expect(get().reminders[0]!.dueAt).toBe(at(2026, 11, 25)) // a rename does not undo the date
    get().updateInstrument(id, { dueDay: null })
    expect(get().reminders).toEqual([])
    get().updateInstrument(id, { dueDay: 7 })
    get().setCardBillReminder(id, true)
    get().deleteInstrument(id)
    expect(get().reminders).toEqual([])
    expect(get().budget.instruments.find((i) => i.id === id)!.deletedAt).not.toBeNull()
  })
})

describe('refunds in the store', () => {
  it('keeps the amount positive and flags the entry; a normal entry still cannot be zero', () => {
    const { get } = setup()
    expect(get().addExpense({ amount: '500', categoryId: 'starter-shopping', date: '2026-11-03', note: 'Returned shoes', refund: true })).toBe(true)
    expect(get().budget.expenses[0]).toMatchObject({ amount: '500', refund: true })
    expect(get().addExpense({ amount: '0', categoryId: null, date: '2026-11-03', note: '', refund: true })).toBe(false)
    expect(get().addExpense({ amount: '-5', categoryId: null, date: '2026-11-03', note: '' })).toBe(false)
  })
  it('a plain entry has no refund field; editing can turn a refund off', () => {
    const { get } = setup()
    get().addExpense({ amount: '10', categoryId: null, date: '2026-11-03', note: '', refund: true })
    const id = get().budget.expenses[0]!.id
    get().updateExpense(id, { amount: '10', categoryId: null, date: '2026-11-03', note: '' })
    expect(get().budget.expenses[0]).not.toHaveProperty('refund')
  })
  it('a refund is never also a card bill or a transfer', () => {
    const { get } = setup()
    get().addExpense({ amount: '10', categoryId: null, date: '2026-11-03', note: '', refund: true, settlement: 'transfer' })
    expect(get().budget.expenses[0]).not.toHaveProperty('refund')
  })
})

describe('saved data', () => {
  it('an old backup with no bills or refunds loads with safe defaults', () => {
    const old = { ...defaultPersisted(), schemaVersion: 3 }
    const out = migrate(JSON.parse(JSON.stringify(old)))
    expect(out.schemaVersion).toBe(3)
    expect(out.budget.recurring).toBeUndefined()
  })
  it('bills, refunds and links survive a round trip; bad ones are dropped', () => {
    const { get } = setup()
    get().addExpense(draft(), 'monthly')
    get().addExpense({ amount: '5', categoryId: null, date: '2026-11-03', note: 'x', refund: true })
    const back = sanitizeBudget(JSON.parse(JSON.stringify(get().budget)))
    expect(back.recurring).toEqual(get().budget.recurring)
    expect(back.expenses.map((e) => [e.refund, e.recurringId])).toEqual(get().budget.expenses.map((e) => [e.refund, e.recurringId]))
  })
  it('drops a bill with no amount, a card bill with no card, an unknown repeat; fixes a missing category', () => {
    const raw = {
      ...starterBudget(),
      recurring: [
        { id: 'a', kind: 'bill', title: 'ok', amount: '10', repeat: 'monthly', categoryId: 'nope', mode: null, instrumentId: null, cardId: 'c', deletedAt: null },
        { id: 'b', kind: 'bill', title: 'no amount', amount: '-1', repeat: 'monthly' },
        { id: 'c', kind: 'cardBill', title: 'no card', amount: null, repeat: 'monthly', instrumentId: 'ghost' },
        { id: 'd', kind: 'bill', title: 'weekly', amount: '5', repeat: 'weekly' },
        { id: 'e', kind: 'bill', title: '', amount: '5', repeat: 'monthly' },
      ],
    }
    const out = sanitizeBudget(raw)
    expect(out.recurring!.map((r) => r.id)).toEqual(['a'])
    expect(out.recurring![0]!.categoryId).toBeNull()
  })
  it('a refund flag on a settlement is dropped; junk refund values are not refunds', () => {
    const raw = { ...starterBudget(), expenses: [
      { id: 'a', date: '2026-11-01', amount: '5', settlement: 'transfer', refund: true, deletedAt: null },
      { id: 'b', date: '2026-11-01', amount: '5', refund: 'yes', deletedAt: null },
      { id: 'c', date: '2026-11-01', amount: '5', refund: true, recurringId: 'r1', deletedAt: null },
    ] }
    const out = sanitizeBudget(raw)
    expect(out.expenses.map((e) => e.refund)).toEqual([undefined, undefined, true])
    expect(out.expenses[2]!.recurringId).toBe('r1')
  })
})
