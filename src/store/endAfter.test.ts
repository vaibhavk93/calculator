import { describe, expect, it } from 'vitest'
import { createAppStore } from './app'
import { buildBackup, parseBackup } from './backup'
import { defaultPersisted, sanitizeBudget } from './persistence'
import { starterBudget } from './types'
import { cleanPaymentCount, isPaymentCount, type ExpenseDraft } from '../lib/budget'
import { lastPaymentAt, paymentsLeftText } from '../lib/recurring'
import { planNotifications } from '../lib/notifications'

const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).getTime()
const NOW = at(2026, 11, 10)
const money = (a: string) => `Rs ${a}`

function setup() {
  let t = NOW
  let n = 0
  const store = createAppStore({ ...defaultPersisted(), budget: starterBudget() }, { now: () => t, newId: () => `id${++n}` })
  return { store, get: store.getState, tick: (ms: number) => (t += ms) }
}
const draft = (o: Partial<ExpenseDraft> = {}): ExpenseDraft => ({ amount: '5000', categoryId: 'starter-bills', date: '2026-11-03', note: 'Car loan', ...o })

/** A monthly bill with `payments` payments in all (the entry made now is the first). So `payments - 1` are left. */
function withLoan(payments: number | null = 4, o: Partial<ExpenseDraft> = {}) {
  const s = setup()
  expect(s.get().addExpense(draft(o), 'monthly', payments)).toBe(true)
  return { ...s, bill: () => s.get().budget.recurring![0]!, rem: () => s.get().reminders[0] }
}
const spent = (s: Pick<ReturnType<typeof setup>, 'get'>) => s.get().budget.expenses.filter((e) => e.deletedAt === null).length

describe('a bill that ends after N payments', () => {
  it('"4 payments" made from an entry that is payment 1 leaves 3, the next one included', () => {
    const { bill } = withLoan(4)
    expect(bill().remaining).toBe(3)
  })
  it('each Mark paid counts one down and moves the date on', () => {
    const { get, bill, rem } = withLoan(4)
    get().markPaid(rem()!.id)
    expect(bill().remaining).toBe(2)
    expect(rem()!.dueAt).toBe(at(2027, 1, 3))
    expect(get().snack?.text).toBe('Paid. Added to your budget')
  })
  it('the last payment is recorded, then the bill ends: no reminder, no card, not in the live list', () => {
    const { get, bill, rem } = withLoan(2) // 1 left
    const before = spent({ get })
    get().markPaid(rem()!.id)
    expect(get().budget.expenses.filter((e) => e.deletedAt === null)).toHaveLength(before + 1)
    expect(bill().deletedAt).not.toBeNull()
    expect(get().reminders).toEqual([])
    expect(get().cards.find((c) => c.id === bill().cardId)).toBeUndefined()
    expect(get().snack).toMatchObject({ text: 'Last payment recorded. This bill has ended.', canUndo: true })
    // nothing left for the phone to ring about
    expect(planNotifications(get().reminders, get().cards, NOW, money)).toEqual([])
  })
  it('a full run: 3 payments ends on the 3rd tap, and past entries stay', () => {
    const { get, bill, rem, tick } = withLoan(3) // entry + 2 left
    get().markPaid(rem()!.id)
    expect(bill().deletedAt).toBeNull()
    tick(30 * 86_400_000) // a month on (two taps on the same day add one entry only)
    get().markPaid(rem()!.id)
    expect(bill().deletedAt).not.toBeNull()
    expect(get().budget.expenses.filter((e) => e.recurringId === bill().id)).toHaveLength(3) // the first entry plus 2 paid
  })

  it('UNDO of the last payment brings back BOTH the bill and the reminder, and takes the entry away', () => {
    const { get, bill, rem } = withLoan(2)
    const due = rem()!.dueAt
    const cardId = bill().cardId
    const entries = spent({ get })
    get().markPaid(rem()!.id)
    get().undoRemoval()
    expect(spent({ get })).toBe(entries) // the payment is gone
    expect(bill().deletedAt).toBeNull()
    expect(bill().remaining).toBe(1)
    expect(rem()).toMatchObject({ dueAt: due, cardId })
    expect(rem()!.history).toEqual([])
    expect(get().cards.find((c) => c.id === cardId)).toBeDefined()
    const plan = planNotifications(get().reminders, get().cards, NOW, money)
    expect(plan.length).toBeGreaterThan(0)
    expect(plan.every((p) => !/undefined|NaN/.test(p.title + p.body))).toBe(true)
  })
  it('Undo twice does not corrupt: the second does nothing', () => {
    const { get, bill, rem } = withLoan(2)
    get().markPaid(rem()!.id)
    get().undoRemoval()
    const snapshot = JSON.stringify({ b: get().budget, r: get().reminders, c: get().cards })
    get().undoRemoval()
    expect(JSON.stringify({ b: get().budget, r: get().reminders, c: get().cards })).toBe(snapshot)
    expect(bill().remaining).toBe(1)
    expect(get().reminders).toHaveLength(1)
  })
  it('the bill can be paid again after the Undo, and still ends', () => {
    const { get, bill, rem } = withLoan(2)
    get().markPaid(rem()!.id)
    get().undoRemoval()
    get().markPaid(rem()!.id)
    expect(bill().deletedAt).not.toBeNull()
    expect(get().reminders).toEqual([])
  })
  it('Undo of an ordinary (not last) payment puts the count back too', () => {
    const { get, bill, rem } = withLoan(4)
    get().markPaid(rem()!.id)
    expect(bill().remaining).toBe(2)
    get().undoRemoval()
    expect(bill().remaining).toBe(3)
  })
  it('a payment is counted even when the entry was already there that day (nothing added)', () => {
    const { get, bill, rem } = withLoan(4)
    get().markPaid(rem()!.id)
    // an old reminder date makes the same "today" key; the second tap adds no second entry but still counts one off
    get().markPaid(rem()!.id)
    expect(bill().remaining).toBe(1)
  })
  it('ticking the task in To-do counts and ends the bill the same way', () => {
    const { get, bill, rem } = withLoan(2)
    get().setTaskDone(rem()!.cardId, true)
    expect(bill().deletedAt).not.toBeNull()
    expect(get().reminders).toEqual([])
    get().undoRemoval()
    expect(bill().deletedAt).toBeNull()
    expect(bill().remaining).toBe(1)
  })
})

describe('bills with no count are untouched (golden)', () => {
  it('never gets a remaining, never ends, behaves as before', () => {
    const { get, bill, rem } = withLoan(null)
    expect(bill()).not.toHaveProperty('remaining')
    for (let i = 0; i < 30; i++) get().markPaid(rem()!.id)
    expect(bill().deletedAt).toBeNull()
    expect(bill()).not.toHaveProperty('remaining')
    expect(get().reminders).toHaveLength(1)
  })
  it('a one-time reminder and a plain repeating task are not affected', () => {
    const { get } = setup()
    const id = get().saveCard({ title: 'Call', kind: 'task', toolId: null, inputs: null, summary: '', amount: null, lines: [], note: '', tags: [] }, { dueAt: at(2026, 11, 12), repeat: 'none', leadDays: 1 })!
    const r = get().reminders.find((x) => x.cardId === id)!
    get().markPaid(r.id)
    expect(get().reminders.find((x) => x.id === r.id)!.done).toBe(true)
    expect(get().budget.recurring).toBeUndefined()
  })
})

describe('editing a bill keeps the count', () => {
  it('a new name, amount, repeat or date keeps remaining', () => {
    const { get, bill } = withLoan(5)
    expect(get().updateBill(bill().id, { title: 'Car EMI', amount: '5100', repeat: 'monthly', date: '2026-12-09' })).toBe(true)
    expect(bill().remaining).toBe(4)
    expect(get().reminders[0]!.dueAt).toBe(at(2026, 12, 9))
  })
  it('only an explicit remaining changes it; null clears it', () => {
    const { get, bill } = withLoan(5)
    expect(get().updateBill(bill().id, { remaining: 10 })).toBe(true)
    expect(bill().remaining).toBe(10)
    expect(get().updateBill(bill().id, { remaining: null })).toBe(true)
    expect(bill()).not.toHaveProperty('remaining')
  })
  it('a bad remaining is refused in words, and changes nothing', () => {
    const { get, bill } = withLoan(5)
    for (const bad of [0, -1, 1.5, 601, NaN]) {
      expect(get().updateBill(bill().id, { remaining: bad })).toBe(false)
      expect(get().notice?.text).toMatch(/Number of payments/)
    }
    expect(bill().remaining).toBe(4)
  })
  it('editing the card (due day) of a card bill never touches a bill with a count', () => {
    const { get, bill } = withLoan(5)
    get().pauseBill(bill().id)
    expect(bill().remaining).toBe(4)
    get().resumeBill(bill().id)
    expect(bill().remaining).toBe(4)
  })
  it('a payment count below 2 on a new bill is refused, and nothing is made', () => {
    const { get } = setup()
    expect(get().addExpense(draft(), 'monthly', 1)).toBe(false)
    expect(get().addExpense(draft(), 'monthly', 601)).toBe(false)
    expect(get().budget.recurring).toBeUndefined()
    expect(get().budget.expenses).toEqual([])
  })
  it('payments without Repeats are ignored', () => {
    const { get } = setup()
    expect(get().addExpense(draft(), null, 12)).toBe(true)
    expect(get().budget.recurring).toBeUndefined()
  })
})

describe('snooze, pause and month ends', () => {
  it('snooze does not change remaining', () => {
    const { get, bill, rem } = withLoan(5)
    get().snooze(rem()!.id, 3)
    expect(bill().remaining).toBe(4)
  })
  it('a paused bill does not count down, and keeps its count on resume', () => {
    const { get, bill } = withLoan(5)
    get().pauseBill(bill().id)
    get().setTaskDone(bill().cardId!, true) // ticking the note of a paused bill pays nothing
    expect(bill().remaining).toBe(4)
    expect(get().reminders).toEqual([])
  })
  it('a bill on the 31st keeps advancing correctly while it counts down', () => {
    const { get, bill, rem } = withLoan(5, { date: '2026-10-31' })
    const days: number[] = [rem()!.dueAt]
    for (let i = 0; i < 3; i++) {
      get().markPaid(rem()!.id)
      days.push(rem()!.dueAt)
    }
    expect(days).toEqual([at(2026, 11, 30), at(2026, 12, 31), at(2027, 1, 31), at(2027, 2, 28)])
    expect(bill().remaining).toBe(1)
  })
})

describe('the count survives saving', () => {
  it('sanitiser keeps good counts and drops junk', () => {
    const { get, bill } = withLoan(5)
    const base = get().budget
    for (const [value, kept] of [[1, true], [24, true], [600, true], [0, false], [-1, false], [1.5, false], ['12', false], [601, false], [NaN, false], [null, false]] as const) {
      const out = sanitizeBudget({ ...base, recurring: [{ ...bill(), remaining: value }] })
      expect(out.recurring?.[0]?.remaining, String(value)).toBe(kept ? value : undefined)
      expect(out.recurring).toHaveLength(1) // the bill itself is kept
    }
  })
  it('a card bill never carries a count', () => {
    const { get, bill } = withLoan(5)
    const out = sanitizeBudget({ ...get().budget, recurring: [{ ...bill(), kind: 'cardBill', remaining: 3 }] })
    expect(out.recurring?.[0]?.remaining).toBeUndefined()
  })
  it('a backup file round trip keeps it', () => {
    const { get, bill } = withLoan(5)
    const p = parseBackup(buildBackup(get().snapshot()))
    if (!p.ok) throw new Error(p.message)
    expect(p.data.budget.recurring![0]!.remaining).toBe(4)
    const back = createAppStore(p.data, { now: () => NOW, newId: () => 'x' })
    expect(back.getState().budget.recurring![0]!.id).toBe(bill().id)
    expect(back.getState().budget.recurring![0]!.remaining).toBe(4)
  })
})

describe('helpers', () => {
  it('isPaymentCount / cleanPaymentCount', () => {
    expect([1, 600, 24].every(isPaymentCount)).toBe(true)
    expect([0, 601, 1.5, '3', NaN, null, undefined].some(isPaymentCount)).toBe(false)
    expect(cleanPaymentCount('')).toBeNull()
    expect(cleanPaymentCount(' 24 ')).toBe(24)
    for (const bad of ['0', '601', '1.5', '-3', 'ab', '1e2', '1000']) expect(cleanPaymentCount(bad), bad).toBeUndefined()
  })
  it('last payment date: next one included, month ends clamp', () => {
    expect(lastPaymentAt(at(2026, 12, 5), 'monthly', 5, 1)).toBe(at(2026, 12, 5))
    expect(lastPaymentAt(at(2026, 12, 5), 'monthly', 5, 23)).toBe(at(2028, 10, 5))
    expect(lastPaymentAt(at(2026, 11, 30), 'monthly', 31, 4)).toBe(at(2027, 2, 28))
    expect(lastPaymentAt(at(2026, 12, 5), 'quarterly', 5, 3)).toBe(at(2027, 6, 5))
    expect(lastPaymentAt(at(2026, 12, 5), 'yearly', 5, 2)).toBe(at(2027, 12, 5))
  })
  it('words', () => {
    expect(paymentsLeftText(1)).toBe('1 payment left')
    expect(paymentsLeftText(5)).toBe('5 payments left')
  })
})
