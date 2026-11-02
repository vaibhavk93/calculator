import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { useApp } from '../../components/StoreProvider'
import { D, type Dec } from '../../engine'
import { formatCell } from '../../lib/toolFormat'

const MAX_LINES = 50

/**
 * Takes one number to a list. The number is a single line, or several equal lines: 1,000 as
 * 5 lines is "1,000 from each of 5 friends". With more than one line the list gets checkboxes,
 * because the point is to tick off who has paid.
 */
export function ToListSheet({ value, onClose, onDone }: { value: string; onClose: () => void; onDone?: (cardId: string) => void }) {
  const cards = useApp((s) => s.cards)
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const addToList = useApp((s) => s.addToList)

  const lists = cards.filter((c) => c.kind === 'tape' && c.deletedAt === null)
  const [target, setTarget] = useState<string>('new')
  const [title, setTitle] = useState('')
  const [count, setCount] = useState(1)
  const [label, setLabel] = useState('')
  const [ticks, setTicks] = useState<boolean | null>(null)

  const opts = { system, decimals }
  const money = (v: string | Dec) => formatCell(typeof v === 'string' ? new D(v) : v, 'money', opts)
  const total = new D(value).times(count)
  const existing = target !== 'new'
  // Several lines means a split, so tick-boxes start on; one line starts off. The user can flip it.
  const withTicks = ticks ?? count > 1

  const done = () => {
    const id = existing
      ? addToList({ cardId: target }, value, count, label)
      : addToList({ title: title.trim() || (count > 1 ? 'Split' : 'List') }, value, count, label, withTicks)
    if (id) {
      onDone?.(id)
      onClose()
    }
  }

  return (
    <Sheet title="Add to a list" onClose={onClose} action={<button type="button" className="btn btn--primary" onClick={done}>Add</button>}>
      <div className="tolist">
        <p className="tolist__sum" aria-live="polite">
          {count === 1 ? money(value) : `${count} lines of ${money(value)} = ${money(total)}`}
        </p>

        <div className="tolist__field">
          <span className="field-label" id="tolist-lines">Lines</span>
          <div className="stepper" role="group" aria-labelledby="tolist-lines">
            <button type="button" className="stepper__btn" aria-label="One fewer line" disabled={count <= 1} onClick={() => setCount(count - 1)}>−</button>
            <span className="stepper__value" aria-live="polite">{count}</span>
            <button type="button" className="stepper__btn" aria-label="One more line" disabled={count >= MAX_LINES} onClick={() => setCount(count + 1)}>+</button>
          </div>
          <span className="field-hint">{count > 1 ? 'One line for each person. You can rename them after.' : 'Use more than one to share this amount out.'}</span>
        </div>

        {count > 1 && (
          <label className="tolist__field">
            <span className="field-label">Name the lines</span>
            <input className="field" placeholder="Person" value={label} maxLength={30} onChange={(e) => setLabel(e.target.value)} />
          </label>
        )}

        <label className="tolist__field">
          <span className="field-label">List</span>
          <select className="field" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="new">A new list</option>
            {lists.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </label>

        {!existing && (
          <>
            <label className="tolist__field">
              <span className="field-label">List name</span>
              <input className="field" placeholder={count > 1 ? 'Split' : 'List'} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="tolist__check">
              <input type="checkbox" checked={withTicks} onChange={(e) => setTicks(e.target.checked)} />
              <span>Tick lines off as they are paid</span>
            </label>
          </>
        )}
      </div>
    </Sheet>
  )
}
