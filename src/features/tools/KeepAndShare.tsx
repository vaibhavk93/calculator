import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { copyText } from '../../lib/device'
import { shareText } from '../../lib/share'

/**
 * "Keep and share": everything you can do with a finished answer, in one place under the Result.
 * Copy and Share send the whole story (title, what you typed, the answers) as text. To list and Remind me
 * keep it in the app. Save lives in the page header, because it is the screen's one main action.
 * See docs/DESIGN-SYSTEM.md, "Page anatomy".
 */
export function KeepAndShare({
  title,
  text,
  canList,
  onList,
  onRemind,
}: {
  title: string
  text: string
  /** Money answers only: a list adds up amounts. */
  canList: boolean
  onList: () => void
  onRemind: () => void
}) {
  const [msg, setMsg] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  const say = (t: string) => {
    setMsg(t)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(''), 2200)
  }

  const copy = async () => say((await copyText(text)) ? 'Copied. Paste it anywhere.' : "Couldn't copy here.")
  const share = async () => {
    const r = await shareText(title, text)
    if (r === 'copied') say('This browser has no share sheet, so it was copied.')
    else if (r === 'failed') say("Couldn't share here.")
  }

  return (
    <section className="keep" aria-labelledby="keep-head">
      <h2 className="section-head" id="keep-head">
        Keep and share
      </h2>
      <div className="keep__grid">
        <button type="button" className="keep__btn" onClick={() => void copy()}>
          <Icon name="copy" size={20} />
          <span>Copy</span>
        </button>
        <button type="button" className="keep__btn" onClick={() => void share()}>
          <Icon name="share" size={20} />
          <span>Share</span>
        </button>
        {canList && (
          <button type="button" className="keep__btn" onClick={onList}>
            <Icon name="list" size={20} />
            <span>To list</span>
          </button>
        )}
        <button type="button" className="keep__btn" onClick={onRemind}>
          <Icon name="due" size={20} />
          <span>Remind me</span>
        </button>
      </div>
      <p className="keep__msg" role="status">
        {msg}
      </p>
    </section>
  )
}
