import { useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { stripCommas, useCopyAs } from '../../components/CopyAs'
import { shareText } from '../../lib/share'

/**
 * "Keep and share": everything you can do with a finished answer, as one slim row under the Result.
 * Copy and Share carry a word beside the icon (they are the two people look for) and run directly. To list,
 * Remind me, Use in another tool and Reset are quieter, less-used actions, so they sit behind one "More"
 * button instead of four more icons competing with Copy/Share. Copy and Share send the whole story (title,
 * what you typed, the answers) as text. Save lives in the page header, because it is the screen's one main
 * action. A message ("Copied") takes the space beside the icons, so the row never grows.
 * See docs/DESIGN-SYSTEM.md, "Page anatomy".
 */
export function KeepAndShare({
  title,
  text,
  canList,
  onList,
  onRemind,
  onUse,
  onReset,
  notes = true,
}: {
  title: string
  text: string
  /** Money answers only: a list adds up amounts. */
  canList: boolean
  onList: () => void
  onRemind: () => void
  /** Set when the headline answer is a plain number another calculator could take. */
  onUse?: () => void
  /** Clears the calculator's inputs back to their starting values. The screen offers Undo. */
  onReset: () => void
  /** False when Notes and reminders is switched off: no list, no reminder. */
  notes?: boolean
}) {
  const [msg, setMsg] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  const say = (t: string) => {
    setMsg(t)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(''), 2200)
  }
  const { copy, sheet } = useCopyAs()

  const share = async () => {
    const r = await shareText(title, text)
    if (r === 'copied') say('Copied, this browser has no share sheet.')
    else if (r === 'failed') say("Couldn't share here.")
  }

  const run = (f: () => void) => () => {
    setMoreOpen(false)
    f()
  }

  const more: { icon: IconName; label: string; run: () => void }[] = [
    ...(notes && canList ? [{ icon: 'list' as const, label: 'Add to a list', run: run(onList) }] : []),
    ...(notes ? [{ icon: 'due' as const, label: 'Remind me', run: run(onRemind) }] : []),
    ...(onUse ? [{ icon: 'forward' as const, label: 'Use in another tool', run: run(onUse) }] : []),
    { icon: 'undo', label: 'Reset inputs', run: run(onReset) },
  ]

  return (
    <section className="keep" aria-label="Keep and share">
      <button type="button" className="keep__btn keep__btn--word" aria-label="Copy" title="Copy" onClick={() => void copy(text, stripCommas(text))}>
        <Icon name="copy" size={22} />
        Copy
      </button>
      <button type="button" className="keep__btn keep__btn--word" aria-label="Share" title="Share" onClick={() => void share()}>
        <Icon name="share" size={22} />
        Share
      </button>
      <button type="button" className="keep__btn" aria-label="More" title="More" onClick={() => setMoreOpen(true)}>
        <Icon name="more" size={22} />
      </button>
      <p className="keep__msg" role="status">
        {msg}
      </p>
      {sheet}
      {moreOpen && (
        <Sheet title="More" onClose={() => setMoreOpen(false)}>
          <div className="group" aria-label="More">
            {more.map((i) => (
              <button key={i.label} type="button" className="navrow tap-row" onClick={i.run}>
                <Icon name={i.icon} size={18} />
                <span className="navrow__label">{i.label}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </section>
  )
}
