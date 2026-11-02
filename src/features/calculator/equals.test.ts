import { describe, expect, it } from 'vitest'
import { createAppStore } from '../../store/app'
import { defaultPersisted } from '../../store/persistence'
import type { Key } from '../../engine'
import { computeDisplay, recentWork, type PastLine } from './displayLogic'

/**
 * The owner's sequences for "=", end to end through the real store and the display rules.
 * What the screen shows is: past lines (from history) + the expression line + the big number.
 */
let n = 0
function make() {
  const store = createAppStore(defaultPersisted(), { now: () => 1_700_000_000_000, newId: () => `id-${++n}` })
  const press = (...keys: Key[]) => keys.forEach((k) => store.getState().press(k))
  const screen = () => {
    const s = store.getState()
    const source: PastLine[] = s.history.map((h) => ({ id: h.id, expression: h.expression, result: h.result }))
    const past = recentWork(s.input, s.lastExpression, source, 3)
    const view = computeDisplay(s.input, s.lastExpression, s.settings)
    return { past: past.map((l) => `${l.expression}=${l.result}`), expr: view.exprLine, big: view.resultLine, preview: view.preview }
  }
  return { store, press, screen, get: () => store.getState() }
}

describe('"=" sequences', () => {
  it('"23*36" previews dimmed, "=" commits it', () => {
    const { press, screen, get } = make()
    press('2', '3', '*', '3', '6')
    expect(screen()).toEqual({ past: [], expr: '23 × 36', big: '828', preview: true })
    press('=')
    expect(screen()).toEqual({ past: [], expr: '23 × 36 =', big: '828', preview: false })
    expect(get().history).toHaveLength(1)
  })

  it('"=" again changes nothing and adds no history', () => {
    const { press, screen, get } = make()
    press('2', '3', '*', '3', '6', '=')
    const before = { screen: screen(), input: get().input, undo: get().undoStack.length }
    press('=')
    expect(screen()).toEqual(before.screen)
    expect(get().input).toEqual(before.input)
    expect(get().undoStack).toHaveLength(before.undo)
    expect(get().history).toHaveLength(1)
  })

  it('then "6" starts a new calculation and the old one stays above', () => {
    const { press, screen } = make()
    press('2', '3', '*', '3', '6', '=', '=', '6')
    expect(screen()).toEqual({ past: ['23*36=828'], expr: '', big: '6', preview: false })
  })

  it('"52+5" "=" "+3" "=" keeps both calculations on screen', () => {
    const { press, screen, get } = make()
    press('5', '2', '+', '5', '=')
    expect(screen()).toMatchObject({ past: [], expr: '52 + 5 =', big: '57' })
    press('+', '3')
    expect(screen()).toEqual({ past: ['52+5=57'], expr: '57 + 3', big: '60', preview: true })
    press('=')
    expect(screen()).toEqual({ past: ['52+5=57'], expr: '57 + 3 =', big: '60', preview: false })
    press('=')
    expect(screen()).toEqual({ past: ['52+5=57'], expr: '57 + 3 =', big: '60', preview: false })
    expect(get().history.map((h) => h.result)).toEqual(['60', '57'])
  })

  it('"=" on an empty input does nothing', () => {
    const { press, screen, get } = make()
    press('=')
    expect(get().input).toEqual({ expr: '', fresh: false })
    expect(get().notice).toBeNull()
    expect(get().history).toHaveLength(0)
    expect(screen()).toEqual({ past: [], expr: '', big: '0', preview: false })
  })

  it('"C" clears the current line only', () => {
    const { press, screen } = make()
    press('5', '2', '+', '5', '=', '+', '3', 'clear')
    expect(screen()).toEqual({ past: ['52+5=57'], expr: '', big: '0', preview: false })
  })

  it('shows at most three past lines, oldest at the top', () => {
    const { press, screen } = make()
    for (const d of ['1', '2', '3', '4', '5'] as Key[]) press(d, '+', '1', '=')
    press('7')
    expect(screen().past).toEqual(['3+1=4', '4+1=5', '5+1=6'])
  })
})
