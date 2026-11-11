import { describe, expect, it } from 'vitest'
import { cardRule, senderRule } from '../lib/smsIgnore'
import type { InboxItem } from '../lib/inbox'
import { createAppStore } from './app'
import { defaultPersisted, migrate, sanitizeSettings } from './persistence'

const NOW = 1_700_000_000_000
const item = (id: string, o: Partial<InboxItem> = {}): InboxItem => ({ id, date: '2026-11-12', amount: '5.00', merchant: 'Shop', kind: 'spend', mode: 'credit', instrumentId: null, last4: '1234', bank: 'HDFC Bank', sender: 'HDFCBK', categoryId: null, why: '', person: false, status: 'pending', at: NOW, ...o })
const make = (items: InboxItem[]) => {
  const s = createAppStore(defaultPersisted(), { now: () => NOW, newId: () => 'id' })
  s.getState().commitDrain({ items, entries: [], seen: [], ackIds: [], held: 0 })
  return s
}

describe('ignoring from the store', () => {
  it('adds the rule, clears the waiting items it covers, and Undo puts both back', () => {
    const s = make([item('aaa111'), item('bbb222', { last4: '9999', sender: 'ICICIB', bank: 'ICICI Bank' })])
    expect(s.getState().addIgnore(cardRule({ last4: '1234', bank: 'HDFC Bank' })!)).toBe(1)
    expect(s.getState().budget.inbox!.map((i) => i.id)).toEqual(['bbb222'])
    expect(s.getState().settings.smsIgnored.map((r) => r.key)).toEqual(['card:HDFC Bank|1234'])
    s.getState().undoRemoval()
    expect(s.getState().settings.smsIgnored).toEqual([])
    expect(s.getState().budget.inbox!.map((i) => i.id).sort()).toEqual(['aaa111', 'bbb222'])
  })
  it('a sender rule clears that sender only; stop ignoring removes it', () => {
    const s = make([item('aaa111'), item('bbb222', { sender: 'ICICIB', last4: '9999' })])
    expect(s.getState().addIgnore(senderRule('VM-ICICIB')!)).toBe(1)
    expect(s.getState().budget.inbox!.map((i) => i.id)).toEqual(['aaa111'])
    s.getState().removeIgnore('sender:ICICIB')
    expect(s.getState().settings.smsIgnored).toEqual([])
  })
  it('already-added entries and approved items are left alone', () => {
    const s = make([item('aaa111', { status: 'approved', entryId: 'e' })])
    expect(s.getState().addIgnore(senderRule('VM-HDFCBK')!)).toBe(0)
    expect(s.getState().budget.inbox).toHaveLength(1)
  })
})

describe('the ignore list is stored safely', () => {
  it('defaults empty; old files load; junk and hand-edited keys are dropped or rebuilt; capped', () => {
    expect(defaultPersisted().settings.smsIgnored).toEqual([])
    expect(migrate({ schemaVersion: 3, settings: {} }).settings.smsIgnored).toEqual([])
    const out = sanitizeSettings({
      smsIgnored: [
        { kind: 'card', key: 'sender:EVIL', last4: '1234', bank: 'HDFC Bank', label: 'Mine' },
        { kind: 'card', last4: '12', bank: 'x' },
        { kind: 'sender', sender: 'vm-hdfcbk' },
        { kind: 'sender', sender: 'HDFCBK' },
        { kind: 'sender', sender: 'HDFCBK' },
        { kind: 'other' },
        'junk',
      ],
    }).smsIgnored
    expect(out.map((r) => r.key)).toEqual(['card:HDFC Bank|1234', 'sender:HDFCBK'])
    const many = Array.from({ length: 80 }, (_, i) => ({ kind: 'card', last4: String(1000 + i), bank: '' }))
    expect(sanitizeSettings({ smsIgnored: many }).smsIgnored).toHaveLength(50)
  })
  it('a stored item keeps its short sender and nothing else of the header', () => {
    const b = migrate({ schemaVersion: 3, budget: { overall: null, categories: [], instruments: [], expenses: [], inbox: [{ id: 'abc123', date: '2026-11-12', amount: '5', status: 'pending', sender: 'VM-HDFCBK' }, { id: 'abc124', date: '2026-11-12', amount: '5', status: 'pending', sender: 'HDFCBK' }] } }).budget
    expect(b.inbox!.map((i) => i.sender)).toEqual([undefined, 'HDFCBK'])
  })
})
