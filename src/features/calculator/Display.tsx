import { useEffect, useLayoutEffect, useRef } from 'react'
import { useApp } from '../../components/StoreProvider'
import { formatExpression, formatPlain } from '../../lib/format'
import type { DisplayView, PastLine } from './displayLogic'
import { useFitText } from './useFitText'

const NOTICE_MS = 2200

interface DisplayProps {
  view: DisplayView
  fresh: boolean
  onCopy: () => void
  /** Finished calculations shown faded above the current line, oldest first. */
  past: PastLine[]
  onPastTap: (line: PastLine) => void
}

export function Display({ view, fresh, onCopy, past, onPastTap }: DisplayProps) {
  const memory = useApp((s) => s.memory)
  const notice = useApp((s) => s.notice)
  const clearNotice = useApp((s) => s.clearNotice)
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)

  const exprRef = useRef<HTMLDivElement>(null)
  const pastRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLButtonElement>(null)

  useFitText(resultRef, view.resultLine)

  // A long expression scrolls so the part being typed stays in view. And if there is not room
  // for even one whole line, hide it: half a line looks like a rendering glitch, and the live
  // result underneath still says everything that matters.
  useLayoutEffect(() => {
    const el = exprRef.current
    if (!el) return
    const settle = () => {
      el.style.visibility = 'visible'
      const oneLine = parseFloat(getComputedStyle(el).lineHeight) || 0
      if (el.clientHeight + 1 < oneLine) el.style.visibility = 'hidden'
      el.scrollTop = el.scrollHeight
    }
    settle()
    // The text can stay the same while the room for it changes (opening a panel, rotating,
    // resizing), so watch the element's size too, not just its content.
    const observer = new ResizeObserver(settle)
    observer.observe(el)
    return () => observer.disconnect()
  }, [view.exprLine, view.resultLine])

  // The newest past line sits right above the current one; keep it in view when space is short.
  useLayoutEffect(() => {
    const el = pastRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [past])

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
      {past.length > 0 && (
        <div className="display__past" ref={pastRef}>
          {past.map((line, i) => (
            <button
              key={line.id ?? `last-${i}`}
              type="button"
              className="past"
              onClick={() => onPastTap(line)}
              aria-label={`${formatExpression(line.expression, system)} equals ${formatPlain(line.result, { system, decimals })}. Tap to use the result.`}
            >
              <span className="past__expr">{formatExpression(line.expression, system)}</span>
              <span className="past__result">= {formatPlain(line.result, { system, decimals })}</span>
            </button>
          ))}
        </div>
      )}

      <div className="display__expr" ref={exprRef}>
        {view.exprLine}
      </div>

      <button
        type="button"
        ref={resultRef}
        className="display__result"
        data-preview={view.preview}
        onClick={onCopy}
        disabled={view.copyText === null}
        aria-label={view.resultLine ? `${view.preview ? 'Preview' : 'Result'} ${view.resultLine}. Tap to copy.` : 'No result yet'}
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
