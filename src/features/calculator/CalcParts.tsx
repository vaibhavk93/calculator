import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { useApp } from '../../components/StoreProvider'
import { useBackHandler } from '../../components/useBackHandler'
import { parseClipboardExpression } from '../../lib/clipboard'
import { haptic, readClipboardText } from '../../lib/device'
import { useCopyAs } from '../../components/CopyAs'
import type { AppState } from '../../store/app'
import { computeDisplay } from './displayLogic'
import { useRepeatingPress } from './Keypad'

/**
 * Puts pasted text into the calculator. Returns null when it worked, otherwise the plain reason
 * it didn't, so the caller decides where to say it.
 */
export function applyPaste(s: Pick<AppState, 'insertExpression' | 'showNotice'>, text: string): string | null {
  const r = parseClipboardExpression(text)
  if (r.raw === null) return r.reason
  s.insertExpression(r.raw)
  if (r.lines > 1) s.showNotice(`Added ${r.lines} lines`)
  return null
}

/** Everything the basic and the scientific calculator share: the display, copy and paste. Finished calculations live in History only. */
export function useCalcCore() {
  const input = useApp((s) => s.input)
  const lastExpression = useApp((s) => s.lastExpression)
  const settings = useApp((s) => s.settings)
  const showNotice = useApp((s) => s.showNotice)
  const insertExpression = useApp((s) => s.insertExpression)

  const view = useMemo(
    () => computeDisplay(input, lastExpression, settings),
    // Only the fields the display depends on, so unrelated settings don't recompute it.
    [input, lastExpression, settings.numberSystem, settings.decimals, settings.angle],
  )

  const { copy, sheet: copySheet } = useCopyAs()
  const doCopy = useCallback(async () => {
    if (view.copyText === null) return showNotice('Nothing to copy yet')
    // The big line is the number as shown, with its commas; copyText is the same number without them.
    await copy(view.resultLine, view.copyText)
  }, [view.copyText, view.resultLine, copy, showNotice])

  const [pasteOpen, setPasteOpen] = useState(false)
  const doPaste = useCallback(async () => {
    const text = await readClipboardText()
    // Unreadable or empty: a text box always takes the system's long-press paste.
    if (text === null) return setPasteOpen(true)
    const problem = applyPaste({ insertExpression, showNotice }, text)
    if (problem) showNotice(problem, 'error')
  }, [insertExpression, showNotice])

  return { input, view, doCopy, copySheet, doPaste, pasteOpen, closePaste: () => setPasteOpen(false) }
}

/** Paste, Copy, Undo, Backspace: the row above the keypad. */
export function UtilRow({ onPaste, onCopy }: { onPaste: () => void; onCopy: () => void }) {
  const press = useApp((s) => s.press)
  const undoInput = useApp((s) => s.undoInput)
  const canUndo = useApp((s) => s.undoStack.length > 0)
  const haptics = useApp((s) => s.settings.haptics)
  const backspace = useBackspace(press, haptics)

  return (
    <div className="util">
      <button type="button" className="util__btn" onClick={onPaste}>
        Paste
      </button>
      <button type="button" className="util__btn" onClick={onCopy}>
        Copy
      </button>
      <button type="button" className="util__btn" aria-label="Undo" disabled={!canUndo} onClick={undoInput}>
        <Icon name="undo" size={21} />
      </button>
      <button type="button" className="util__btn util__btn--primary" aria-label="Backspace" {...backspace}>
        <Icon name="backspace" size={23} />
      </button>
    </div>
  )
}

export function useBackspace(press: AppState['press'], haptics: boolean) {
  return useRepeatingPress(() => {
    haptic(haptics)
    press('backspace')
  })
}

/** Shown when the clipboard can't be read: a text box takes a long-press paste on every phone. */
export function PasteSheet({ onClose }: { onClose: () => void }) {
  const insertExpression = useApp((s) => s.insertExpression)
  const showNotice = useApp((s) => s.showNotice)
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)

  useBackHandler(true, onClose)
  // The sheet focuses itself when it opens; move focus on to the box right after.
  useEffect(() => {
    const t = setTimeout(() => field.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [])

  const use = () => {
    const reason = applyPaste({ insertExpression, showNotice }, text)
    if (reason) return setProblem(reason)
    onClose()
  }

  return (
    <Sheet title="Paste a calculation" onClose={onClose}>
      <form
        className="paste"
        onSubmit={(e) => {
          e.preventDefault()
          use()
        }}
      >
        <label className="paste__label" htmlFor="paste-box">
          Paste here
        </label>
        <textarea
          id="paste-box"
          ref={field}
          className="field paste__box"
          rows={3}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setProblem(null)
          }}
          placeholder="Long-press, then Paste"
          autoComplete="off"
          spellCheck={false}
        />
        {problem && (
          <p className="note" data-tone="error" role="alert">
            {problem}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={text.trim() === ''}>
          Use
        </button>
      </form>
    </Sheet>
  )
}
