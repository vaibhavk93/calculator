import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { caretMap, displayCaret, formatExpression, formatPlain } from '../../lib/format'
import { applyPaste } from './CalcParts'
import type { DisplayView } from './displayLogic'
import { useFitText } from './useFitText'

const NOTICE_MS = 2200

interface DisplayProps {
  view: DisplayView
  fresh: boolean
  onCopy: () => void
}

export function Display({ view, fresh, onCopy }: DisplayProps) {
  const memory = useApp((s) => s.memory)
  const notice = useApp((s) => s.notice)
  const clearNotice = useApp((s) => s.clearNotice)
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)

  const store = useAppStore()
  const input = useApp((s) => s.input)
  const selection = useApp((s) => s.selection)
  const lastExpression = useApp((s) => s.lastExpression)
  const setSelection = useApp((s) => s.setSelection)
  const editLast = useApp((s) => s.editLast)
  const exprRef = useRef<HTMLTextAreaElement>(null)

  // The line above the answer is a text box you can put a cursor in, select part of, and edit. Its text is the
  // formatted expression; `raw` is the engine's own form, and caretMap turns positions in one into the other.
  const raw = input.fresh ? lastExpression ?? '' : input.expr
  // A lone number is already the big line, so it would only be repeated here. Tapping the big number brings the line up
  // for editing (the Copy button copies); once there is an operator, or a cursor, the line stays.
  const bare = !input.fresh && /^-?[0-9.]+$/.test(input.expr)
  const [reveal, setReveal] = useState(false)
  useEffect(() => {
    if (!bare) setReveal(false)
  }, [bare])
  const showLine = !bare || reveal || selection !== null
  const text = !showLine ? '' : input.fresh ? view.exprLine : input.expr ? formatExpression(input.expr, system) : ''
  const sel = selection && !input.fresh && selection.expr === input.expr ? selection : null
  const resultRef = useRef<HTMLButtonElement>(null)

  // Too long for the smallest font: show the scientific form, as a pocket calculator does. Keyed by the line it
  // was decided for, so the next number starts in full again.
  const [compactFor, setCompactFor] = useState<string | null>(null)
  const shown = view.compactLine && compactFor === view.resultLine ? view.compactLine : view.resultLine
  useFitText(resultRef, shown, () => {
    if (view.compactLine && shown !== view.compactLine) setCompactFor(view.resultLine)
  })

  // Keep the box the right height for its text (up to the CSS cap), and keep the cursor where the store says. And if
  // there is not room for even one whole line, hide it: half a line looks like a glitch, and the live result
  // underneath still says everything that matters.
  useLayoutEffect(() => {
    const el = exprRef.current
    if (!el) return
    const settle = () => {
      el.style.visibility = 'visible'
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
      const oneLine = parseFloat(getComputedStyle(el).lineHeight) || 0
      if (el.clientHeight + 1 < oneLine) el.style.visibility = 'hidden'
    }
    settle()
    const map = caretMap(text, raw)
    if (sel) {
      const a = displayCaret(map, raw, sel.start)
      const b = sel.end === sel.start ? a : displayCaret(map, raw, sel.end)
      el.setSelectionRange(a, b)
      // Keys never take focus, but a button tapped in between does; the cursor is only visible in the box.
      const here = document.activeElement
      if (here !== el && (here === document.body || here instanceof HTMLButtonElement)) el.focus({ preventScroll: true })
    } else {
      el.setSelectionRange(text.length, text.length)
      el.scrollTop = el.scrollHeight
    }
    // The text can stay the same while the room for it changes (opening a panel, rotating,
    // resizing), so watch the element's size too, not just its content.
    const observer = new ResizeObserver(settle)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text, raw, sel?.start, sel?.end, view.resultLine])

  // No on-screen keyboard here (inputMode none), and nothing a keyboard types lands in the box by itself:
  // every key goes through the calculator's own rules, via the keypad or useKeyboard.
  useEffect(() => {
    const el = exprRef.current
    if (!el) return
    const block = (e: Event) => e.preventDefault()
    el.addEventListener('beforeinput', block)
    return () => el.removeEventListener('beforeinput', block)
  }, [])

  const toRaw = (pos: number | null) => caretMap(text, raw)[pos ?? text.length] ?? raw.length
  const onSelect = () => {
    const el = exprRef.current
    if (!el || input.fresh || document.activeElement !== el) return
    setSelection(toRaw(el.selectionStart), toRaw(el.selectionEnd))
  }
  // After "=": tapping the expression above the answer brings it back to edit.
  const onClick = () => {
    const el = exprRef.current
    if (el && input.fresh && lastExpression) editLast(toRaw(el.selectionStart), toRaw(el.selectionEnd))
  }

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => clearNotice(notice.id), NOTICE_MS)
    return () => clearTimeout(t)
  }, [notice, clearNotice])

  // A notice outranks the size echo; the live-preview error outranks nothing.
  const note = notice ?? view.echo
  // Screen readers hear the answer when "=" commits it, and notices; not every keystroke's preview.
  const announce = notice ? notice.text : fresh && view.resultLine ? `Result ${view.resultLine}` : ''

  return (
    <section className="display" aria-label="Display">
      <textarea
        ref={exprRef}
        className="display__expr"
        data-calc-input=""
        aria-label={input.fresh ? 'Last calculation. Tap to edit.' : 'Expression. Tap to move the cursor or select.'}
        rows={1}
        value={text}
        inputMode="none"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={() => {}}
        onSelect={onSelect}
        onClick={onClick}
        onPaste={(e) => {
          e.preventDefault()
          const problem = applyPaste(store.getState(), e.clipboardData.getData('text/plain'))
          if (problem) store.getState().showNotice(problem, 'error')
        }}
      />

      <button
        type="button"
        ref={resultRef}
        className="display__result"
        data-preview={view.preview}
        onClick={bare && !reveal ? () => setReveal(true) : onCopy}
        disabled={view.copyText === null}
        aria-label={view.resultLine ? `${view.preview ? 'Preview' : 'Result'} ${view.resultLine}. Tap to ${bare && !reveal ? 'edit' : 'copy'}.` : 'No result yet'}
      >
        {view.resultLine || ' '}
      </button>

      <div className="display__echo">
        <span className="display__memory">{memory !== null ? `M ${formatPlain(memory, { system, decimals })}` : ''}</span>
        <span className="display__note" data-tone={note?.tone}>
          {note?.text ?? ''}
        </span>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>
    </section>
  )
}
