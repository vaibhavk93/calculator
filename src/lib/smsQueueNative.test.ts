import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

const h = vi.hoisted(() => ({ native: true, plugin: {} as Record<'permission' | 'request' | 'captureEnabled' | 'setCaptureEnabled' | 'drain' | 'ack' | 'clear' | 'openAppSettings' | 'inject', Mock> }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => h.native },
  registerPlugin: () => h.plugin,
}))

import capacitorConfig from '../../capacitor.config.ts?raw'
import { debugInjectSms, nativeSmsQueue, queueFromPlugin, type SmsQueuePlugin } from './smsQueueNative'

const msg = (id: string, receivedAt: number) => ({ id, sender: 'HDFCBK', body: 'Rs 1 debited', receivedAt })

beforeEach(() => {
  h.native = true
  h.plugin = {
    permission: vi.fn(async () => ({ state: 'prompt' })),
    request: vi.fn(async () => ({ granted: true })),
    captureEnabled: vi.fn(async () => ({ enabled: true })),
    setCaptureEnabled: vi.fn(async () => undefined),
    drain: vi.fn(async () => ({ messages: [] })),
    ack: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
    openAppSettings: vi.fn(async () => undefined),
    inject: vi.fn(async () => ({ queued: 1 })),
  }
})

describe('nativeSmsQueue', () => {
  it('is null on the web', () => {
    h.native = false
    expect(nativeSmsQueue()).toBeNull()
  })
  it('is a port on the phone', () => {
    expect(nativeSmsQueue()).not.toBeNull()
  })
})

describe('queueFromPlugin: permission, request, capture switch', () => {
  it('maps the permission state through, and never throws', async () => {
    const q = queueFromPlugin(h.plugin as unknown as SmsQueuePlugin)
    for (const s of ['granted', 'denied', 'prompt', 'unavailable']) {
      h.plugin.permission.mockResolvedValueOnce({ state: s })
      expect(await q.permission()).toBe(s)
    }
    h.plugin.permission.mockResolvedValueOnce({ state: 'weird' })
    expect(await q.permission()).toBe('unavailable')
    h.plugin.permission.mockRejectedValueOnce(new Error('"SmsQueue" plugin is not implemented on android'))
    expect(await q.permission()).toBe('unavailable')
  })
  it('request: granted only when the phone says so; any failure is denied', async () => {
    const q = queueFromPlugin(h.plugin as unknown as SmsQueuePlugin)
    expect(await q.request()).toBe('granted')
    h.plugin.request.mockResolvedValueOnce({ granted: false })
    expect(await q.request()).toBe('denied')
    h.plugin.request.mockRejectedValueOnce(new Error('x'))
    expect(await q.request()).toBe('denied')
  })
  it('captureEnabled reads the flag and is false on failure; setCaptureEnabled sends { on }', async () => {
    const q = queueFromPlugin(h.plugin as unknown as SmsQueuePlugin)
    expect(await q.captureEnabled()).toBe(true)
    h.plugin.captureEnabled.mockResolvedValueOnce({ enabled: false })
    expect(await q.captureEnabled()).toBe(false)
    h.plugin.captureEnabled.mockRejectedValueOnce(new Error('x'))
    expect(await q.captureEnabled()).toBe(false)
    await q.setCaptureEnabled(false)
    expect(h.plugin.setCaptureEnabled).toHaveBeenCalledWith({ on: false })
  })
  it('setCaptureEnabled surfaces a failure instead of pretending it worked', async () => {
    const q = queueFromPlugin(h.plugin as unknown as SmsQueuePlugin)
    h.plugin.setCaptureEnabled.mockRejectedValueOnce(new Error('x'))
    await expect(q.setCaptureEnabled(true)).rejects.toThrow()
  })
})

describe('queueFromPlugin: drain, ack, clear', () => {
  it('drain returns messages oldest first and drops malformed rows', async () => {
    const q = queueFromPlugin(h.plugin as unknown as SmsQueuePlugin)
    h.plugin.drain.mockResolvedValueOnce({ messages: [msg('b', 20), { id: 5 }, null, msg('a', 10), { ...msg('c', 30), body: undefined }] })
    expect((await q.drain()).map((m) => m.id)).toEqual(['a', 'b'])
  })
  it('drain with a missing list is empty, and a plugin failure is thrown (nothing was read)', async () => {
    const q = queueFromPlugin(h.plugin as unknown as SmsQueuePlugin)
    h.plugin.drain.mockResolvedValueOnce({} as never)
    expect(await q.drain()).toEqual([])
    h.plugin.drain.mockRejectedValueOnce(new Error('x'))
    await expect(q.drain()).rejects.toThrow()
  })
  it('ack sends exactly the ids, skips the call for none, and a failure is thrown so the caller retries', async () => {
    const q = queueFromPlugin(h.plugin as unknown as SmsQueuePlugin)
    await q.ack(['a', 'b'])
    expect(h.plugin.ack).toHaveBeenCalledWith({ ids: ['a', 'b'] })
    h.plugin.ack.mockClear()
    await q.ack([])
    expect(h.plugin.ack).not.toHaveBeenCalled()
    h.plugin.ack.mockRejectedValueOnce(new Error('x'))
    await expect(q.ack(['a'])).rejects.toThrow()
  })
  it('clear and openAppSettings call the phone', async () => {
    const q = queueFromPlugin(h.plugin as unknown as SmsQueuePlugin)
    await q.clear()
    await q.openAppSettings()
    expect(h.plugin.clear).toHaveBeenCalledTimes(1)
    expect(h.plugin.openAppSettings).toHaveBeenCalledTimes(1)
  })
})

describe('debugInjectSms', () => {
  it('passes the fake message to the phone and returns how many were queued', async () => {
    expect(await debugInjectSms('HDFCBK', 'Rs 5 debited', 123)).toBe(1)
    expect(h.plugin.inject).toHaveBeenCalledWith({ sender: 'HDFCBK', body: 'Rs 5 debited', receivedAt: 123 })
  })
  it('is null on the web and in a release build (no SmsDebug plugin)', async () => {
    h.plugin.inject.mockRejectedValueOnce(new Error('"SmsDebug" plugin is not implemented on android'))
    expect(await debugInjectSms('A', 'b')).toBeNull()
    h.native = false
    expect(await debugInjectSms('A', 'b')).toBeNull()
  })
})

describe('privacy: nothing about a message may reach the phone log', () => {
  it("Capacitor's own call/result logging is off (it would print drained message text to logcat)", () => {
    expect(capacitorConfig).toMatch(/loggingBehavior:\s*'none'/)
  })
})
