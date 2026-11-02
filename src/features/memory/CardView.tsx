import type { SavedCard } from '../../store/types'
import { ALL_TOOLS } from '../tools/registry'
import { ToolScreen } from '../tools/ToolScreen'
import { TapeScreen } from './TapeScreen'
import { TaskSheet } from './TaskSheet'

/** Opens a saved card as what it is: a calculator with its inputs restored, a tape, or a task in its sheet. */
export function CardView({ card, onBack }: { card: SavedCard; onBack: () => void }) {
  if (card.kind === 'task') return <TaskSheet card={card} onClose={onBack} />
  if (card.kind === 'tape') return <TapeScreen card={card} onBack={onBack} />
  const spec = ALL_TOOLS.find((t) => t.id === card.toolId)
  if (!spec) return null
  return <ToolScreen spec={spec} initial={card.inputs ?? undefined} card={card} onBack={onBack} />
}
