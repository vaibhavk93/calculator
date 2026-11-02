import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { Key } from '../../engine'
import { haptic } from '../../lib/device'
import { useApp } from '../../components/StoreProvider'

type Kind = 'digit' | 'op' | 'clear' | 'equals'
interface KeyDef {
  key: Key
  label: string
  name: string
  kind: Kind
}

const KEYS: KeyDef[] = [
  { key: 'clear', label: 'C', name: 'Clear', kind: 'clear' },
  { key: '()', label: '( )', name: 'Brackets', kind: 'op' },
  { key: '%', label: '%', name: 'Percent', kind: 'op' },
  { key: '/', label: '÷', name: 'Divide', kind: 'op' },
  { key: '7', label: '7', name: '7', kind: 'digit' },
  { key: '8', label: '8', name: '8', kind: 'digit' },
  { key: '9', label: '9', name: '9', kind: 'digit' },
  { key: '*', label: '×', name: 'Multiply', kind: 'op' },
  { key: '4', label: '4', name: '4', kind: 'digit' },
  { key: '5', label: '5', name: '5', kind: 'digit' },
  { key: '6', label: '6', name: '6', kind: 'digit' },
  { key: '-', label: '−', name: 'Subtract', kind: 'op' },
  { key: '1', label: '1', name: '1', kind: 'digit' },
  { key: '2', label: '2', name: '2', kind: 'digit' },
  { key: '3', label: '3', name: '3', kind: 'digit' },
  { key: '+', label: '+', name: 'Add', kind: 'op' },
  { key: '0', label: '0', name: '0', kind: 'digit' },
  { key: '00', label: '00', name: 'Double zero', kind: 'digit' },
  { key: '.', label: '.', name: 'Decimal point', kind: 'digit' },
  { key: '=', label: '=', name: 'Equals', kind: 'equals' },
]

/**
 * Pointer-down, not click: a calculator should respond the instant a finger lands.
 * Click is kept only for keyboard activation (Enter/Space on a focused key), where
 * `detail` is 0; a real tap fires click with detail >= 1 and is already handled.
 */
export function pressHandlers(onPress: () => void) {
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      onPress()
    },
    onClick: (e: { detail: number }) => {
      if (e.detail === 0) onPress()
    },
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    // Without this, tapping "5" leaves it focused, and the next Enter on a hardware
    // keyboard presses "5" again instead of "=". Keys act, they don't take focus.
    onMouseDown: (e: { preventDefault: () => void }) => e.preventDefault(),
  }
}

export function Keypad() {
  const press = useApp((s) => s.press)
  const haptics = useApp((s) => s.settings.haptics)

  return (
    <div className="keypad" role="group" aria-label="Keypad">
      {KEYS.map((k) => (
        <button
          key={k.key}
          type="button"
          className={`key key--${k.kind}`}
          aria-label={k.name}
          {...pressHandlers(() => {
            haptic(haptics)
            press(k.key)
          })}
        >
          {k.label}
        </button>
      ))}
    </div>
  )
}

const REPEAT_AFTER_MS = 400
const REPEAT_EVERY_MS = 70

/** Backspace repeats while held, like every keyboard does. */
export function useRepeatingPress(onPress: () => void) {
  const timers = useRef<{ start?: ReturnType<typeof setTimeout>; repeat?: ReturnType<typeof setInterval> }>({})

  const stop = () => {
    clearTimeout(timers.current.start)
    clearInterval(timers.current.repeat)
    timers.current = {}
  }

  return {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      onPress()
      stop()
      timers.current.start = setTimeout(() => {
        timers.current.repeat = setInterval(onPress, REPEAT_EVERY_MS)
      }, REPEAT_AFTER_MS)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onClick: (e: { detail: number }) => {
      if (e.detail === 0) onPress()
    },
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    onMouseDown: (e: { preventDefault: () => void }) => e.preventDefault(),
  }
}
