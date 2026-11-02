import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  native: false,
  store: new Map<string, string>(),
  plugin: { hasBackupFolder: vi.fn(), saveBackup: vi.fn(), openBackupFolder: vi.fn() },
  download: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => h.native },
  registerPlugin: () => h.plugin,
}))
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: h.store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void h.store.set(key, value),
  },
}))
vi.mock('./device', () => ({ downloadTextFile: h.download }))

import { saveBackupFile } from './backupFile'

beforeEach(() => {
  h.native = false
  h.store.clear()
  vi.clearAllMocks()
})

describe('saveBackupFile', () => {
  it('web: downloads and never asks', async () => {
    const confirm = vi.fn()
    const r = await saveBackupFile('a.json', '{}', confirm)
    expect(h.download).toHaveBeenCalledWith('a.json', '{}')
    expect(confirm).not.toHaveBeenCalled()
    expect(r).toMatchObject({ ok: true, where: 'your downloads' })
  })

  it('native: declined creates nothing', async () => {
    h.native = true
    h.plugin.hasBackupFolder.mockResolvedValue({ exists: false })
    const r = await saveBackupFile('a.json', '{}', async () => false)
    expect(r).toMatchObject({ ok: false, reason: 'declined' })
    expect(h.plugin.saveBackup).not.toHaveBeenCalled()
  })

  it('native: asks once, saves, remembers, then does not ask again', async () => {
    h.native = true
    h.plugin.hasBackupFolder.mockResolvedValue({ exists: false })
    h.plugin.saveBackup.mockResolvedValue({ uri: 'content://x', path: 'Download/Calc/a.json' })
    h.plugin.openBackupFolder.mockResolvedValue({ opened: 'folder' })
    const confirm = vi.fn(async () => true)
    const r = await saveBackupFile('a.json', '{}', confirm)
    expect(r).toMatchObject({ ok: true, where: 'Download/Calc/a.json' })
    if (r.ok) await r.open()
    expect(h.plugin.openBackupFolder).toHaveBeenCalledWith({ uri: 'content://x' })
    await saveBackupFile('b.json', '{}', confirm)
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('native: existing folder skips the question', async () => {
    h.native = true
    h.plugin.hasBackupFolder.mockResolvedValue({ exists: true })
    h.plugin.saveBackup.mockResolvedValue({ uri: 'u', path: 'p' })
    const confirm = vi.fn()
    await saveBackupFile('a.json', '{}', confirm)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('native: a plugin error is reported as failed', async () => {
    h.native = true
    h.plugin.hasBackupFolder.mockResolvedValue({ exists: true })
    h.plugin.saveBackup.mockRejectedValue(new Error('disk full'))
    expect(await saveBackupFile('a.json', '{}', async () => true)).toEqual({ ok: false, reason: 'failed', message: 'disk full' })
  })
})
