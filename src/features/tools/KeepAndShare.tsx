import { useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { stripCommas, useCopyAs } from '../../components/CopyAs'
import { shareText } from '../../lib/share'

/**
 * "Keep and share": everything you can do with a finished answer, as one slim row of icons under the Result.
 * Copy and Share send the whole story (title, what you typed, the answers) as text. To list and Remind me
 * keep it in the app. Reset clears the inputs (the snackbar offers Undo). Save lives in the page header, because it is the screen's one main action.
 * A message ("Copied") takes the space beside the icons, so the row never grows. See docs/DESIGN-SYSTEM.md, "Page anatomy".
 */
export function KeepAndShare({
  title,
  text,
  canList,
  onList,
  onRemind,
  onUse,
  onReset,
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
}) {
  const [msg, setMsg] = useState('')
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

  const items: { icon: IconName; label: string; run: () => void }[] = [
    { icon: 'copy', label: 'Copy', run: () => void copy(text, stripCommas(text)) },
    { icon: 'share', label: 'Share', run: () => void share() },
    ...(canList ? [{ icon: 'list' as const, label: 'Add to a list', run: onList }] : []),
    { icon: 'due', label: 'Remind me', run: onRemind },
    ...(onUse ? [{ icon: 'forward' as const, label: 'Use in another tool', run: onUse }] : []),
    { icon: 'undo', label: 'Reset inputs', run: onReset },
  ]

  return (
    <section className="keep" aria-label="Keep and share">
      {items.map((i) => (
        <button key={i.label} type="button" className="keep__btn" aria-label={i.label} title={i.label} onClick={i.run}>
          <Icon name={i.icon} size={22} />
        </button>
      ))}
      <p className="keep__msg" role="status">
        {msg}
      </p>
      {sheet}
    </section>
  )
}
