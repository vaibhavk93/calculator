import { describe, expect, it } from 'vitest'
import { moduleOn, startTab, tabOn, withModule } from '../lib/modules'
import { planNotifications } from '../lib/notifications'
import { buildBackup, parseBackup } from './backup'
import { createAppStore } from './app'
import { defaultPersisted, sanitizeModules, sanitizeSettings } from './persistence'
import { TABS, starterBudget, type Tab } from './types'

const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).getTime()
const NOW = at(2026, 11, 10)
const BOTH_ON = { budget: true, notes: true }
const COMBOS = [BOTH_ON, { budget: false, notes: true }, { budget: true, notes: false }, { budget: false, notes: false }]

function setup() {
  let n = 0
  const store = createAppStore({ ...defaultPersisted(), budget: starterBudget() }, { now: () => NOW, newId: () => `id${++n}` })
  return { store, get: store.getState }
}
const card = { title: 'Rent', kind: 'task' as const, toolId: null, inputs: null, summary: 's', amount: '100', lines: [], note: '', tags: [] }

describe('sanitizeModules: a missing or junk value is ON', () => {
  it('an old backup with no modules key loads as everything on', () => {
    expect(sanitizeSettings({ theme: 'light' }).modules).toEqual(BOTH_ON)
    expect(sanitizeSettings(undefined).modules).toEqual(BOTH_ON)
  })
  it('junk is on; only a real false hides', () => {
    expect(sanitizeModules(5)).toEqual(BOTH_ON)
    expect(sanitizeModules(null)).toEqual(BOTH_ON)
    expect(sanitizeModules({ budget: 'no', notes: 0 })).toEqual(BOTH_ON)
    expect(sanitizeModules({ budget: false })).toEqual({ budget: false, notes: true })
    expect(sanitizeModules({ notes: false, extra: 1 })).toEqual({ budget: true, notes: false })
  })
})

describe('tabOn', () => {
  it('Calculate and Tools are always on; Notes and Due go together', () => {
    for (const m of COMBOS) {
      expect(tabOn({ modules: m }, 'calculate')).toBe(true)
      expect(tabOn({ modules: m }, 'tools')).toBe(true)
      expect(tabOn({ modules: m }, 'saved')).toBe(m.notes)
      expect(tabOn({ modules: m }, 'due')).toBe(m.notes)
      expect(tabOn({ modules: m }, 'budget')).toBe(m.budget)
      expect(moduleOn({ modules: m }, 'budget')).toBe(m.budget)
    }
  })
  it('withModule changes one switch only', () => {
    expect(withModule({ modules: BOTH_ON }, 'budget', false)).toEqual({ modules: { budget: false, notes: true } })
  })
  it('startTab reads a stored choice at a hidden tab as Calculate, without rewriting it', () => {
    const s = { modules: { budget: false, notes: true }, startupTab: 'budget' as Tab }
    expect(startTab(s)).toBe('calculate')
    expect(s.startupTab).toBe('budget')
    expect(startTab({ ...s, modules: BOTH_ON })).toBe('budget')
  })
})

describe('the store with a module off', () => {
  it.each(COMBOS)('every visible tab opens, a hidden one lands on Calculate (%o)', (modules) => {
    const { get } = setup()
    get().updateSettings({ modules })
    for (const t of TABS) {
      get().setTab(t)
      expect(get().tab).toBe(tabOn({ modules }, t) ? t : 'calculate')
    }
  })
  it('showCard to a hidden Notes lands on Calculate; with Notes on it opens the card', () => {
    const { get } = setup()
    const id = get().saveCard(card)!
    get().updateSettings({ modules: { budget: true, notes: false } })
    get().showCard(id)
    expect(get().tab).toBe('calculate')
    expect(get().openCard).toBeNull()
    get().updateSettings({ modules: BOTH_ON })
    get().showCard(id)
    expect(get().tab).toBe('saved')
    expect(get().openCard).toBe(id)
  })
  it('the app opens on Calculate when startupTab points at a hidden tab, and the choice is kept', () => {
    const base = defaultPersisted()
    const settings = sanitizeSettings({ ...base.settings, startupTab: 'due', modules: { notes: false } })
    const store = createAppStore({ ...base, settings }, { now: () => NOW, newId: () => 'x' })
    expect(store.getState().tab).toBe('calculate')
    expect(store.getState().settings.startupTab).toBe('due')
    store.getState().updateSettings({ modules: BOTH_ON })
    expect(store.getState().settings.startupTab).toBe('due')
    const again = createAppStore({ ...base, settings: store.getState().settings }, { now: () => NOW, newId: () => 'y' })
    expect(again.getState().tab).toBe('due')
  })
  it('switching off the tab you are on moves you to Calculate; switching off another tab does not', () => {
    const { get } = setup()
    get().setTab('budget')
    get().updateSettings({ modules: { budget: true, notes: false } })
    expect(get().tab).toBe('budget')
    get().updateSettings({ modules: { budget: false, notes: false } })
    expect(get().tab).toBe('calculate')
    get().updateSettings({ modules: BOTH_ON })
    get().setTab('due')
    get().updateSettings({ modules: { budget: true, notes: false } })
    expect(get().tab).toBe('calculate')
  })
  it('a tap on a reminder notification (setTab due) lands on Calculate while Notes is off', () => {
    const { get } = setup()
    get().updateSettings({ modules: { budget: true, notes: false } })
    get().setTab('due')
    expect(get().tab).toBe('calculate')
  })
})

describe('hide, never delete', () => {
  it('off then on leaves every piece of stored data byte-identical', () => {
    const { get } = setup()
    const id = get().saveCard(card, { dueAt: at(2026, 12, 3), repeat: 'monthly', leadDays: 1 })!
    get().saveCard({ ...card, title: 'Gone' })
    get().deleteCard(get().cards[0]!.id)
    get().addExpense({ amount: '199', categoryId: 'starter-bills', date: '2026-11-03', note: 'Netflix' }, 'monthly')
    const snap = () => JSON.stringify({ ...get().snapshot(), settings: undefined })
    const before = snap()
    const withSwitches = (modules: { budget: boolean; notes: boolean }) => get().updateSettings({ modules })
    for (const m of COMBOS) {
      withSwitches(m)
      expect(snap()).toBe(before)
    }
    withSwitches(BOTH_ON)
    expect(snap()).toBe(before)
    expect(get().reminders.some((r) => r.cardId === id)).toBe(true)
  })
  it('a backup keeps everything while a module is off', () => {
    const { get } = setup()
    get().saveCard(card, { dueAt: at(2026, 12, 3), repeat: 'none', leadDays: 1 })
    get().updateSettings({ modules: { budget: false, notes: false } })
    const p = parseBackup(buildBackup(get().snapshot()))
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.data.cards).toHaveLength(1)
    expect(p.data.reminders).toHaveLength(1)
    expect(p.data.settings.modules).toEqual({ budget: false, notes: false })
  })
  it('restoring a backup brings its own switches, and an old backup (no key) turns both on', () => {
    const { get } = setup()
    get().setTab('budget')
    get().updateSettings({ modules: { budget: false, notes: false } })
    const old = parseBackup(JSON.stringify({ kind: 'vkcalc-backup', schemaVersion: 3, exportedAt: '2026-10-01T10:00:00.000Z', app: 'Calc', data: { settings: { theme: 'light' } } }))
    expect(old.ok).toBe(true)
    if (!old.ok) return
    get().restore(old.data)
    expect(get().settings.modules).toEqual(BOTH_ON)

    const hidden = parseBackup(JSON.stringify({ kind: 'vkcalc-backup', schemaVersion: 3, exportedAt: '2026-10-01T10:00:00.000Z', app: 'Calc', data: { settings: { modules: { budget: false, notes: true } } } }))
    expect(hidden.ok).toBe(true)
    if (!hidden.ok) return
    get().setTab('budget')
    get().restore(hidden.data)
    expect(get().settings.modules).toEqual({ budget: false, notes: true })
    expect(get().tab).toBe('calculate')
  })
})

describe('reminders keep ringing with a module off', () => {
  const money = (p: string) => `₹${p}`
  it('the notification plan is identical with the modules on and off (cards, reminders and a Budget bill)', () => {
    const { get } = setup()
    get().saveCard(card, { dueAt: at(2026, 12, 3), repeat: 'monthly', leadDays: 1 })
    get().addExpense({ amount: '199', categoryId: 'starter-bills', date: '2026-11-03', note: 'Netflix' }, 'monthly')
    const plan = () => JSON.stringify(planNotifications(get().reminders, get().cards, NOW, money, get().settings.reminderTime))
    const on = plan()
    expect(JSON.parse(on).length).toBeGreaterThanOrEqual(2)
    for (const m of COMBOS) {
      get().updateSettings({ modules: m })
      expect(plan()).toBe(on)
    }
  })
  it('Budget bills DO schedule notifications: each bill owns a Due card and a reminder', () => {
    const { get } = setup()
    get().addExpense({ amount: '199', categoryId: 'starter-bills', date: '2026-11-03', note: 'Netflix' }, 'monthly')
    const bill = get().budget.recurring![0]!
    expect(get().reminders.some((r) => r.cardId === bill.cardId)).toBe(true)
    expect(planNotifications(get().reminders, get().cards, NOW, money).length).toBeGreaterThan(0)
  })
  it('Mark paid and Snooze from a notification still work with Due hidden', () => {
    const { get } = setup()
    const id = get().saveCard(card, { dueAt: at(2026, 11, 9), repeat: 'monthly', leadDays: 0 })!
    const id2 = get().saveCard({ ...card, title: 'One-off' }, { dueAt: at(2026, 11, 9), repeat: 'none', leadDays: 0 })!
    get().updateSettings({ modules: { budget: false, notes: false } })
    const rem = get().reminders.find((r) => r.cardId === id)!
    const one = get().reminders.find((r) => r.cardId === id2)!
    get().snooze(rem.id, 1)
    expect(get().reminders.find((r) => r.id === rem.id)!.dueAt).toBe(NOW + 86_400_000)
    get().markPaid(one.id)
    expect(get().reminders.find((r) => r.id === one.id)!.done).toBe(true)
    expect(get().tab).toBe('calculate')
  })
})
