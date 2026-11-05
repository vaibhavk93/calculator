import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'

export type AddChoice = 'note' | 'list' | 'task'

const CHOICES: { id: AddChoice; label: string; hint: string }[] = [
  { id: 'note', label: 'New note', hint: 'Plain text to keep' },
  { id: 'list', label: 'New list', hint: 'Lines with amounts and a running total' },
  { id: 'task', label: 'New to-do', hint: 'Something to do, with an optional date' },
]

/**
 * "What do you want to add?" One tap on a row both picks and leaves, so there is no footer (a choice sheet is X only,
 * docs/FORMS-AND-SHEETS.md). The caller closes this before it opens the next screen, so two sheets are never open at once.
 */
export function AddSheet({ onChoose, onClose }: { onChoose: (c: AddChoice) => void; onClose: () => void }) {
  return (
    <Sheet title="Add" onClose={onClose}>
      <div className="group" aria-label="What to add">
        {CHOICES.map((c) => (
          <button key={c.id} type="button" className="row row--button tap-row" onClick={() => onChoose(c.id)}>
            <span className="row__text">
              <span className="row__label">{c.label}</span>
              <span className="row__hint">{c.hint}</span>
            </span>
            <Icon name="chevron" size={18} className="tap-row__chev" />
          </button>
        ))}
      </div>
    </Sheet>
  )
}
