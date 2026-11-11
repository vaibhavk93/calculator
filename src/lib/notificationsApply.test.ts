import { beforeEach, describe, expect, it, vi } from 'vitest'

const plugin = vi.hoisted(() => ({
  getPending: vi.fn(),
  cancel: vi.fn(),
  schedule: vi.fn(),
  registerActionTypes: vi.fn(),
  checkPermissions: vi.fn(),
  checkExactNotificationSetting: vi.fn(),
}))
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: plugin }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true }, registerPlugin: () => ({}) }))

import { applyNotifications, type Planned } from './notifications'

const TEST_ID = 2_147_483_000
const plan = (id: number): Planned => ({ id, at: Date.now() + 1e6, title: 't', body: 'b', reminderId: `r${id}` })
const pending = (...ids: number[]) => plugin.getPending.mockResolvedValue({ notifications: ids.map((id) => ({ id })) })

beforeEach(() => {
  Object.values(plugin).forEach((f) => f.mockReset())
  plugin.checkPermissions.mockResolvedValue({ display: 'granted' })
  plugin.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'granted' })
  plugin.registerActionTypes.mockResolvedValue(undefined)
  plugin.schedule.mockResolvedValue({ notifications: [] })
  plugin.cancel.mockResolvedValue(undefined)
})

describe('applyNotifications', () => {
  it('schedules the plan, cancels only stale ids, keeps planned ids and the test id', async () => {
    pending(1, 2, 9, TEST_ID)
    expect(await applyNotifications([plan(1), plan(2)])).toBe(true)
    expect(plugin.schedule.mock.calls[0]![0].notifications.map((n: { id: number }) => n.id)).toEqual([1, 2])
    expect(plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: 9 }] })
    expect(plugin.schedule.mock.invocationCallOrder[0]).toBeLessThan(plugin.cancel.mock.invocationCallOrder[0]!)
  })
  it('cancels nothing and reports failure when scheduling throws', async () => {
    pending(9)
    plugin.schedule.mockRejectedValue(new Error('boom'))
    expect(await applyNotifications([plan(1)])).toBe(false)
    expect(plugin.cancel).not.toHaveBeenCalled()
  })
  it('an empty plan cancels every stale id except the test id', async () => {
    pending(5, 6, TEST_ID)
    expect(await applyNotifications([])).toBe(true)
    expect(plugin.schedule).not.toHaveBeenCalled()
    expect(plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: 5 }, { id: 6 }] })
  })
})
