import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../lib/storage'
import { buildBackup, parseBackup } from './backup'
import { bootStore } from './boot'
import { createAppStore } from './app'
import { STORAGE_KEY, defaultPersisted, migrate, sanitizeDrafts } from './persistence'
import { MAX_DRAFTS } from './types'

const make = () => createAppStore(defaultPersisted(), { now: () => 1, newId: () => 'x' })

describe('calculator drafts (resume per calculator, PRD A23)', () => {
  it('remembers inputs per tool, and forgets them on null (Reset)', () => {
    const s = make()
    s.getState().setDraft('emi', { amount: '500000', rate: '9' })
    s.getState().setDraft('sip', { monthly: '5000' })
    expect(s.getState().drafts).toEqual({ emi: { amount: '500000', rate: '9' }, sip: { monthly: '5000' } })
    s.getState().setDraft('emi', null)
    expect(Object.keys(s.getState().drafts)).toEqual(['sip'])
  })

  it('keeps the newest 40 when there are more', () => {
    const s = make()
    for (let i = 0; i < MAX_DRAFTS + 5; i++) s.getState().setDraft(`t${i}`, { a: String(i) })
    const ids = Object.keys(s.getState().drafts)
    expect(ids).toHaveLength(MAX_DRAFTS)
    expect(ids[0]).toBe('t5')
    expect(ids.at(-1)).toBe(`t${MAX_DRAFTS + 4}`)
  })

  it('is absent from the snapshot when empty, present when not, and survives a backup round trip', () => {
    const s = make()
    expect('drafts' in s.getState().snapshot()).toBe(false)
    s.getState().setDraft('emi', { amount: '1' })
    const back = parseBackup(buildBackup(s.getState().snapshot()))
    expect(back.ok && back.data.drafts).toEqual({ emi: { amount: '1' } })
    const t = make()
    t.getState().restore(back.ok ? back.data : defaultPersisted())
    expect(t.getState().drafts).toEqual({ emi: { amount: '1' } })
  })

  it('survives closing and reopening the app (a real reload through storage)', async () => {
    const storage = createMemoryStorage()
    const first = await bootStore(storage)
    first.store.getState().setDraft('emi', { amount: '750000' })
    await first.flush()
    const again = await bootStore(storage)
    expect(again.store.getState().drafts).toEqual({ emi: { amount: '750000' } })
    expect(JSON.parse(storage.dump()[STORAGE_KEY]!).drafts).toEqual({ emi: { amount: '750000' } })
  })

  it('loading drops damaged drafts and old data without drafts still loads', () => {
    expect(sanitizeDrafts('x')).toBeUndefined()
    expect(sanitizeDrafts({ 'Bad Id!': { a: '1' }, emi: 'nope', ok: { a: '1', n: 5 } })).toEqual({ ok: { a: '1' } })
    expect(migrate({ schemaVersion: 3 }).drafts).toBeUndefined()
    expect(migrate({ ...defaultPersisted(), drafts: { emi: { a: '1' } } }).drafts).toEqual({ emi: { a: '1' } })
  })
})
