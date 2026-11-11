import { describe, expect, it } from 'vitest'
import { captureStatus } from './captureStatus'
import { jumpToSettingsSection, takeSettingsSection } from './settingsJump'

describe('captureStatus', () => {
  const base = { hasPort: true, capture: true, mode: 'review' as const, perm: 'granted' as const }
  it('says it is a phone feature in a browser', () => expect(captureStatus({ ...base, hasPort: false })).toMatch(/Android app only/))
  it('says capture is off', () => expect(captureStatus({ ...base, capture: false })).toBe('Capture is off. Calc reads no messages.'))
  it('says Android is not allowing it when on without permission', () => expect(captureStatus({ ...base, perm: 'denied' })).toMatch(/not allowing it/))
  it('does not claim a problem before the phone has answered', () => expect(captureStatus({ ...base, perm: null })).toMatch(/Capture is on\./))
  it('names the mode', () => {
    expect(captureStatus(base)).toContain('Review first')
    expect(captureStatus({ ...base, mode: 'auto' })).toContain('Auto-add the confident ones')
  })
})

describe('settingsJump', () => {
  it('hands the section over once', () => {
    expect(takeSettingsSection()).toBeNull()
    jumpToSettingsSection('bank')
    expect(takeSettingsSection()).toBe('bank')
    expect(takeSettingsSection()).toBeNull()
  })
})
