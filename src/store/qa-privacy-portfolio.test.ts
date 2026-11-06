import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildExpensesCsv } from '../lib/csv'
import { planNotifications } from '../lib/notifications'
import { createAppStore } from './app'
import { defaultPersisted } from './persistence'

// Portfolio privacy: what you own and owe must never reach a CSV export, a log line or a notification.
// Companion to lib/qa-privacy.test.ts (bank messages). It sits in store/ because it drives the real store.
// The read-the-source checks (the export, notification and share code never mention it) are in src/portfolio-rules.test.ts.

const NOW = new Date(2026, 10, 6, 10).getTime()
const SECRET_NAME = 'Zorbex Secret Fund'
const SECRET_AMOUNT = '48271965'

function filled() {
  let n = 0
  const store = createAppStore(defaultPersisted(), { now: () => NOW, newId: () => `id${++n}` })
  const s = store.getState()
  s.addHolding({ name: SECRET_NAME, kind: 'stocks_mf', amount: SECRET_AMOUNT, date: '2026-11-01' })
  s.addHolding({ name: 'Home loan', kind: 'loan', amount: '3800000', date: '2026-11-01' })
  return store
}

describe('Portfolio privacy: CSV export', () => {
  it('a budget CSV built next to a full portfolio holds none of it', () => {
    const store = filled()
    const csv = buildExpensesCsv(store.getState().budget, 'all', new Date(2026, 10, 6))
    expect(csv).not.toContain(SECRET_NAME)
    expect(csv).not.toContain(SECRET_AMOUNT)
    expect(csv.toLowerCase()).not.toContain('holding')
    expect(csv.toLowerCase()).not.toContain('portfolio')
  })
})

describe('Portfolio privacy: logs', () => {
  const spies: ReturnType<typeof vi.spyOn>[] = []
  const lines: string[] = []
  beforeEach(() => {
    lines.length = 0
    for (const m of ['log', 'debug', 'info', 'warn', 'error', 'trace'] as const) {
      spies.push(vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void lines.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))))
    }
  })
  afterEach(() => {
    for (const s of spies) s.mockRestore()
    spies.length = 0
  })
  it('adding, updating, renaming, deleting, undoing and restoring write nothing about it to the console', () => {
    const store = filled()
    const s = store.getState()
    const id = store.getState().portfolio[0]!.id
    s.updateHoldingValue(id, { amount: '48271999', date: '2026-11-05' })
    s.renameHolding(id, 'Another Secret Name')
    s.deleteHolding(id)
    store.getState().undoRemoval()
    s.restore(s.snapshot())
    const all = lines.join('\n')
    expect(all).not.toContain(SECRET_NAME)
    expect(all).not.toContain('Another Secret Name')
    expect(all).not.toContain(SECRET_AMOUNT)
    expect(all).not.toContain('48271999')
  })
})

describe('Portfolio privacy: notifications', () => {
  it('a reminder plan built next to a full portfolio carries none of it', () => {
    const store = filled()
    const s = store.getState()
    const planned = planNotifications(s.reminders, s.cards, NOW, (v) => v)
    expect(JSON.stringify(planned)).not.toMatch(new RegExp(`${SECRET_NAME}|${SECRET_AMOUNT}`))
  })
})

describe('Hide amounts is local to the screen', () => {
  it('the stored data holds no flag for it', () => {
    const snap = filled().getState().snapshot()
    expect(JSON.stringify(snap)).not.toMatch(/hid(e|den)/i)
  })
})
