import { useEffect, useRef } from 'react'
import type { Key } from '../../engine'
import { useAppStore } from '../../components/StoreProvider'
import type { AppState } from '../../store/app'
import { applyPaste } from './CalcParts'

const MAP: Record<string, Key> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  '.': '.', ',': '.',
  '+': '+', '-': '-', '*': '*', x: '*', X: '*', '/': '/', '^': '^',
  '(': '(', ')': ')', '%': '%', '!': '!',
  Enter: '=', '=': '=',
  Backspace: 'backspace',
  Delete: 'clear',
  Escape: 'clear',
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable)

/**
 * Desktop keyboard support: type a whole expression, Enter to evaluate,
 * Ctrl+Z to undo, Ctrl+C to copy the result, Ctrl+V to paste a calculation.
 * Reads the store at event time, so it registers once and never goes stale.
 * `isShowing` says whether this screen is the one in front, so two calculators never both type.
 */
export function useKeyboard(getCopyText: () => string | null, isShowing: (s: AppState) => boolean) {
  const store = useAppStore()
  const copyRef = useRef(getCopyText)
  copyRef.current = getCopyText
  const showingRef = useRef(isShowing)
  showingRef.current = isShowing

  useEffect(() => {
    const active = () => {
      const s = store.getState()
      return s.overlay === 'none' && showingRef.current(s)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!active() || isTyping(e.target)) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        store.getState().undoInput()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return

      // Enter on a button the user tabbed to is that button's own click. (A button that was only
      // tapped has already been blurred, see useBlurAfterPointerClick in App.)
      if (e.target instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return

      const key = MAP[e.key]
      if (!key) return
      e.preventDefault()
      store.getState().press(key)
    }

    const onCopy = (e: ClipboardEvent) => {
      if (!active() || isTyping(e.target)) return
      if (window.getSelection()?.toString()) return // let a real text selection copy normally
      const text = copyRef.current()
      if (text === null) return
      e.clipboardData?.setData('text/plain', text)
      e.preventDefault()
      store.getState().showNotice('Copied')
    }

    const onPaste = (e: ClipboardEvent) => {
      if (!active() || isTyping(e.target)) return
      e.preventDefault()
      const problem = applyPaste(store.getState(), e.clipboardData?.getData('text/plain') ?? '')
      if (problem) store.getState().showNotice(problem, 'error')
    }

    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('copy', onCopy)
    document.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('paste', onPaste)
    }
  }, [store])
}
