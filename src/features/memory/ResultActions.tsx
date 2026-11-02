import { useState } from 'react'
import { useApp } from '../../components/StoreProvider'
import { listSummary, tapeTotal } from '../../lib/tape'
import { SaveSheet } from './SaveSheet'
import { ToListSheet } from './ToListSheet'

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/

/**
 * Two actions for a finished result, shown only after "=" so the keypad stays clean while typing:
 * "To list" (send it to a list, as one line or as N lines to share out) and "Remind me".
 * `value` is the result as a plain decimal string.
 */
export function ResultActions({ value }: { value: string }) {
  const showCard = useApp((s) => s.showCard)
  const showNotice = useApp((s) => s.showNotice)
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const [open, setOpen] = useState<'list' | 'remind' | null>(null)

  if (!PLAIN_NUMBER.test(value)) return null

  const line = { id: 'one', label: '', value }
  const lines = [line]

  return (
    <>
      <div className="result-actions" role="group" aria-label="What to do with this result">
        <button type="button" className="chip" onClick={() => setOpen('list')}>To list</button>
        <button type="button" className="chip" onClick={() => setOpen('remind')}>Remind me</button>
      </div>

      {open === 'list' && <ToListSheet value={value} onClose={() => setOpen(null)} onDone={showCard} />}
      {open === 'remind' && (
        <SaveSheet
          draft={{
            title: 'Reminder',
            kind: 'tape',
            toolId: null,
            inputs: null,
            summary: listSummary(lines, false, { system, decimals }),
            amount: tapeTotal(lines).toFixed(),
            lines,
          }}
          suggest="none"
          onClose={() => setOpen(null)}
          onSaved={() => showNotice('Saved with a reminder. See the Due tab.')}
        />
      )}
    </>
  )
}
