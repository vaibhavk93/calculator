import { Icon } from '../../components/Icon'
import { useApp } from '../../components/StoreProvider'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useBackHandler } from '../../components/useBackHandler'
import type { Key } from '../../engine'
import { haptic } from '../../lib/device'
import { useBackspace, useCalcCore } from './CalcParts'
import { Display } from './Display'
import { Keypad, pressHandlers } from './Keypad'
import { useKeyboard } from './useKeyboard'

interface FnKey {
  label: string
  name: string
  keys: Key[]
}

const FNS: FnKey[] = [
  { label: 'sin', name: 'Sine', keys: ['sin'] },
  { label: 'cos', name: 'Cosine', keys: ['cos'] },
  { label: 'tan', name: 'Tangent', keys: ['tan'] },
  { label: 'log', name: 'Logarithm base 10', keys: ['log'] },
  { label: 'ln', name: 'Natural logarithm', keys: ['ln'] },
  { label: 'asin', name: 'Inverse sine', keys: ['asin'] },
  { label: 'acos', name: 'Inverse cosine', keys: ['acos'] },
  { label: 'atan', name: 'Inverse tangent', keys: ['atan'] },
  { label: '√', name: 'Square root', keys: ['sqrt'] },
  { label: 'x²', name: 'Square', keys: ['^', '2'] },
  { label: 'xʸ', name: 'Power', keys: ['^'] },
  { label: 'x!', name: 'Factorial', keys: ['!'] },
  { label: 'π', name: 'Pi', keys: ['pi'] },
  { label: 'e', name: 'Euler’s number', keys: ['e'] },
]

/** The scientific calculator: the same input, history and settings as Calculate, with functions and memory. */
export function ScientificScreen({ onBack }: { onBack: () => void }) {
  const press = useApp((s) => s.press)
  const haptics = useApp((s) => s.settings.haptics)
  const angle = useApp((s) => s.settings.angle)
  const updateSettings = useApp((s) => s.updateSettings)
  const memoryAdd = useApp((s) => s.memoryAdd)
  const memoryRecall = useApp((s) => s.memoryRecall)
  const memoryClear = useApp((s) => s.memoryClear)
  const core = useCalcCore()
  const backspace = useBackspace(press, haptics)

  useBackHandler(true, onBack)
  useKeyboard(() => core.view.copyText, (s) => s.nav.scientific)

  const act = (fn: () => void) =>
    pressHandlers(() => {
      haptic(haptics)
      fn()
    })

  return (
    <div className="screen sci-screen">
      <ScreenHeader title="Scientific" onBack={onBack} />

      <Display
        view={core.view}
        fresh={core.input.fresh}
        onCopy={() => void core.doCopy()}
      />

      <div className="sci" role="group" aria-label="Functions and memory">
        {FNS.map((k) => (
          <button key={k.label} type="button" className="key key--op key--fn" aria-label={k.name} {...act(() => k.keys.forEach((key) => press(key)))}>
            {k.label}
          </button>
        ))}
        <button
          type="button"
          className="key key--op key--fn"
          aria-label={angle === 'deg' ? 'Angles in degrees. Switch to radians.' : 'Angles in radians. Switch to degrees.'}
          {...act(() => updateSettings({ angle: angle === 'deg' ? 'rad' : 'deg' }))}
        >
          {angle === 'deg' ? 'Deg' : 'Rad'}
        </button>
        <button type="button" className="key key--op key--fn" aria-label="Clear memory" {...act(memoryClear)}>
          MC
        </button>
        <button type="button" className="key key--op key--fn" aria-label="Recall memory" {...act(memoryRecall)}>
          MR
        </button>
        <button type="button" className="key key--op key--fn" aria-label="Add to memory" {...act(() => memoryAdd(1))}>
          M+
        </button>
        <button type="button" className="key key--op key--fn" aria-label="Subtract from memory" {...act(() => memoryAdd(-1))}>
          M−
        </button>
        <button type="button" className="key key--op key--fn key--back" aria-label="Backspace" {...backspace}>
          <Icon name="backspace" size={21} />
        </button>
      </div>

      <Keypad />
    </div>
  )
}
