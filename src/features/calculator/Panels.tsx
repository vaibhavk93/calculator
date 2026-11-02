import { pressHandlers } from './Keypad'
import { haptic, readClipboardText } from '../../lib/device'
import { parseClipboardNumber } from '../../lib/clipboard'
import { useApp } from '../../components/StoreProvider'
import type { Key } from '../../engine'

export function MorePanel({ onCopy }: { onCopy: () => void }) {
  const memoryAdd = useApp((s) => s.memoryAdd)
  const memoryRecall = useApp((s) => s.memoryRecall)
  const memoryClear = useApp((s) => s.memoryClear)
  const insertPlain = useApp((s) => s.insertPlain)
  const showNotice = useApp((s) => s.showNotice)

  const paste = async () => {
    const text = await readClipboardText()
    if (text === null) return showNotice("Can't read the clipboard here. Try Ctrl+V or a long-press paste.")
    const n = parseClipboardNumber(text)
    if (n === null) return showNotice("That isn't a number", 'error')
    insertPlain(n)
  }

  return (
    <div className="panel panel--more" role="group" aria-label="Memory and clipboard">
      <button type="button" className="panel__btn" aria-label="Add to memory" onClick={() => memoryAdd(1)}>
        M+
      </button>
      <button type="button" className="panel__btn" aria-label="Subtract from memory" onClick={() => memoryAdd(-1)}>
        M{'−'}
      </button>
      <button type="button" className="panel__btn" aria-label="Recall memory" onClick={memoryRecall}>
        MR
      </button>
      <button type="button" className="panel__btn" aria-label="Clear memory" onClick={memoryClear}>
        MC
      </button>
      <button type="button" className="panel__btn" onClick={onCopy}>
        Copy
      </button>
      <button type="button" className="panel__btn" onClick={() => void paste()}>
        Paste
      </button>
    </div>
  )
}

interface SciKey {
  label: string
  name: string
  keys: Key[]
}

const SCI: SciKey[] = [
  { label: 'sin', name: 'Sine', keys: ['sin'] },
  { label: 'cos', name: 'Cosine', keys: ['cos'] },
  { label: 'tan', name: 'Tangent', keys: ['tan'] },
  { label: 'log', name: 'Logarithm base 10', keys: ['log'] },
  { label: 'ln', name: 'Natural logarithm', keys: ['ln'] },
  { label: 'asin', name: 'Inverse sine', keys: ['asin'] },
  { label: 'acos', name: 'Inverse cosine', keys: ['acos'] },
  { label: 'atan', name: 'Inverse tangent', keys: ['atan'] },
  { label: '√', name: 'Square root', keys: ['sqrt'] },
  { label: 'x!', name: 'Factorial', keys: ['!'] },
  { label: 'π', name: 'Pi', keys: ['pi'] },
  { label: 'e', name: 'Euler’s number', keys: ['e'] },
  { label: '^', name: 'Power', keys: ['^'] },
  { label: 'x²', name: 'Square', keys: ['^', '2'] },
]

export function ScientificPanel() {
  const press = useApp((s) => s.press)
  const haptics = useApp((s) => s.settings.haptics)
  const angle = useApp((s) => s.settings.angle)
  const update = useApp((s) => s.updateSettings)

  return (
    <div className="panel panel--sci" role="group" aria-label="Scientific functions">
      {SCI.map((k) => (
        <button
          key={k.label}
          type="button"
          className="panel__btn"
          aria-label={k.name}
          {...pressHandlers(() => {
            haptic(haptics)
            k.keys.forEach((key) => press(key))
          })}
        >
          {k.label}
        </button>
      ))}
      <button
        type="button"
        className="panel__btn"
        aria-label={angle === 'deg' ? 'Angles in degrees. Switch to radians.' : 'Angles in radians. Switch to degrees.'}
        onClick={() => update({ angle: angle === 'deg' ? 'rad' : 'deg' })}
      >
        {angle === 'deg' ? 'Deg' : 'Rad'}
      </button>
    </div>
  )
}
