import { describe, expect, it } from 'vitest'
import { backupNudge } from './backupNudge'

const DAY = 86_400_000
const NOW = new Date(2026, 10, 10).getTime()

describe('backupNudge', () => {
  it('says nothing with little data', () => expect(backupNudge(24, null, null, NOW)).toBeNull())
  it('asks once there is real data and no backup', () => expect(backupNudge(25, null, null, NOW)).toContain('25 items and no backup yet'))
  it('is quiet after a recent backup, and asks after 30 days', () => {
    expect(backupNudge(100, NOW - 30 * DAY, null, NOW)).toBeNull()
    expect(backupNudge(100, NOW - 31 * DAY, null, NOW)).toContain('31 days old')
  })
  it('never repeats within 14 days of the last time it was shown or dismissed', () => {
    expect(backupNudge(100, null, NOW - 13 * DAY, NOW)).toBeNull()
    expect(backupNudge(100, null, NOW - 14 * DAY, NOW)).not.toBeNull()
  })
})
