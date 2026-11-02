import { useCallback, useState, type ReactNode } from 'react'
import { copyText } from '../lib/device'
import { Sheet } from './Sheet'
import { useApp } from './StoreProvider'

/** Thousands commas out: "1,50,000.50" becomes "150000.50". Only commas between digits go. */
export const stripCommas = (text: string) => text.replace(/(\d),(?=\d)/g, '$1')

interface Pending {
  withCommas: string
  without: string
}

/**
 * Copy a number, honouring Settings, "Copying numbers": with commas, without, or ask each time.
 * Asking shows both versions, so the choice is a tap on the text you want. When the two are the
 * same (no commas to argue about) it just copies.
 * Returns `copy` and the `sheet` to render once somewhere in the screen.
 */
export function useCopyAs(): { copy: (withCommas: string, without?: string) => Promise<void>; sheet: ReactNode } {
  const format = useApp((s) => s.settings.copyFormat)
  const showNotice = useApp((s) => s.showNotice)
  const [pending, setPending] = useState<Pending | null>(null)

  const write = useCallback(
    async (text: string) => {
      const ok = await copyText(text)
      showNotice(ok ? 'Copied' : "Couldn't copy. Long-press the number instead.", ok ? 'info' : 'error')
    },
    [showNotice],
  )

  const copy = useCallback(
    async (withCommas: string, without = stripCommas(withCommas)) => {
      if (withCommas === without || format === 'without') return write(without)
      if (format === 'with') return write(withCommas)
      setPending({ withCommas, without })
    },
    [format, write],
  )

  const pick = (text: string) => {
    setPending(null)
    void write(text)
  }

  const sheet = pending && (
    <Sheet title="Copy as" onClose={() => setPending(null)}>
      <div className="copyas">
        <button type="button" className="copyas__opt" onClick={() => pick(pending.withCommas)}>
          <span className="copyas__name">With commas</span>
          <span className="copyas__text">{pending.withCommas}</span>
        </button>
        <button type="button" className="copyas__opt" onClick={() => pick(pending.without)}>
          <span className="copyas__name">Without commas</span>
          <span className="copyas__text">{pending.without}</span>
        </button>
        <p className="copyas__tip">Change the default in Settings, Copying numbers.</p>
      </div>
    </Sheet>
  )

  return { copy, sheet }
}
