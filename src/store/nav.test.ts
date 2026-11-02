import { describe, expect, it } from 'vitest'
import { createAppStore } from './app'
import { defaultPersisted, sanitizeSettings } from './persistence'
import { DEFAULT_SETTINGS } from './types'

const make = (settings: Partial<typeof DEFAULT_SETTINGS> = {}) => {
  const p = defaultPersisted()
  return createAppStore({ ...p, settings: { ...p.settings, ...settings } }, { now: () => 1, newId: () => 'x' })
}

describe('tapping the tab you are already on', () => {
  it('on Tools it returns to the top of Tools and bumps tabTap', () => {
    const s = make()
    s.getState().setTab('tools')
    s.getState().setNav({ category: 'money', tool: 'gst' })
    const before = s.getState().tabTap
    s.getState().setTab('tools')
    expect(s.getState().nav).toEqual({ category: null, tool: null, scientific: false })
    expect(s.getState().tabTap).toBe(before + 1)
  })
  it('switching to a different tab does not reset where you were, and does not bump tabTap', () => {
    const s = make()
    s.getState().setTab('tools')
    s.getState().setNav({ tool: 'gst' })
    s.getState().setTab('saved')
    expect(s.getState().nav.tool).toBe('gst')
    expect(s.getState().tabTap).toBe(0)
  })
  it('also closes a settings or history screen that is open', () => {
    const s = make()
    s.getState().setOverlay('settings')
    s.getState().setTab('calculate')
    expect(s.getState().overlay).toBe('none')
  })
})

describe('startup calculator', () => {
  it('opens the Tools tab with that calculator showing', () => {
    const s = make({ startupTool: 'gst' })
    expect(s.getState().tab).toBe('tools')
    expect(s.getState().nav.tool).toBe('gst')
  })
  it('with none chosen it uses startupTab as before', () => {
    expect(make({ startupTab: 'due' }).getState().tab).toBe('due')
    expect(make().getState().nav.tool).toBeNull()
  })
  it('a startup tool id from a damaged file is dropped', () => {
    expect(sanitizeSettings({ startupTool: 'GST; drop' }).startupTool).toBeNull()
    expect(sanitizeSettings({ startupTool: 'income-tax' }).startupTool).toBe('income-tax')
    expect(sanitizeSettings({ startupTool: 5 }).startupTool).toBeNull()
  })
})

describe('insertExpression (paste)', () => {
  it('appends to what is being typed', () => {
    const s = make()
    s.getState().insertExpression('23*36')
    s.getState().insertExpression('+5')
    expect(s.getState().input).toEqual({ expr: '23*36+5', fresh: false })
  })
  it('replaces a finished result instead of gluing onto it', () => {
    const s = make()
    s.getState().press('7')
    s.getState().press('=')
    s.getState().insertExpression('2+2')
    expect(s.getState().input.expr).toBe('2+2')
  })
  it('can be undone', () => {
    const s = make()
    s.getState().insertExpression('9*9')
    s.getState().undoInput()
    expect(s.getState().input.expr).toBe('')
  })
})
