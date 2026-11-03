import { useState } from 'react'
import { useApp } from '../../components/StoreProvider'
import { D } from '../../engine'
import { ExpenseSheet } from '../budget/sheets'
import { listSummary, tapeTotal } from '../../lib/tape'
import { SaveSheet } from './SaveSheet'
import { ToListSheet } from './ToListSheet'

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/

/**
 * Two actions for a finished result: "To list" (send it to a list, as one line or as N lines to share out) and
 * "Remind me". `value` is the result as a plain decimal string; `active` is true once "=" has committed it.
 *
 * The row is ALWAYS in the layout, at a fixed height, and the chips appear inside it. Before, the row was added
 * after "=" and everything above it jumped up. A layout must not move because a number was finished.
 */
export function ResultActions({ value, active }: { value: string; active: boolean }) {
  const showCard = useApp((s) => s.showCard)
  const showNotice = useApp((s) => s.showNotice)
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const [open, setOpen] = useState<'list' | 'remind' | 'expense' | null>(null)

  const show = active && PLAIN_NUMBER.test(value)
  // "Add expense" only for a positive amount that is still at least 1 paisa after rounding to 2 places.
  const expenseAmount = show ? new D(value).toDecimalPlaces(2).toFixed() : '0'
  const canExpense = show && new D(expenseAmount).gt(0)

  const line = { id: 'one', label: '', value }
  const lines = [line]

  return (
    <>
      <div className="result-actions" role={show ? 'group' : undefined} aria-label={show ? 'What to do with this result' : undefined}>
        {show && (
          <>
            <button type="button" className="chip" onClick={() => setOpen('list')}>To list</button>
            <button type="button" className="chip" onClick={() => setOpen('remind')}>Remind me</button>
            {canExpense && <button type="button" className="chip" onClick={() => setOpen('expense')}>Add expense</button>}
          </>
        )}
      </div>

      {open === 'expense' && <ExpenseSheet prefill={{ amount: expenseAmount, note: 'from calculator' }} onClose={() => setOpen(null)} />}
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
