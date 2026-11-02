import { Icon } from '../../components/Icon'
import { useApp } from '../../components/StoreProvider'
import { ResultActions } from '../memory/ResultActions'
import { PasteSheet, UtilRow, useCalcCore } from './CalcParts'
import { Display } from './Display'
import { Keypad } from './Keypad'
import { useKeyboard } from './useKeyboard'

/** Short phones keep one past line so the current one never gets squeezed. */
const pastLinesFor = () => (window.innerHeight < 700 ? 1 : 3)

export function CalculatorScreen() {
  const setOverlay = useApp((s) => s.setOverlay)
  const core = useCalcCore(pastLinesFor())

  useKeyboard(() => core.view.copyText, (s) => s.tab === 'calculate' && !s.nav.scientific)

  return (
    <div className="calc">
      <header className="calc__bar">
        <span className="calc__title">Calc</span>
        <button type="button" className="icon-btn" aria-label="History" onClick={() => setOverlay('history')}>
          <Icon name="history" size={21} />
        </button>
        <button type="button" className="icon-btn" aria-label="Settings" onClick={() => setOverlay('settings')}>
          <Icon name="menu" size={21} />
        </button>
      </header>

      <Display
        view={core.view}
        fresh={core.input.fresh}
        onCopy={() => void core.doCopy()}
        past={core.past}
        onPastTap={core.pickPast}
      />

      {core.input.fresh && <ResultActions value={core.input.expr} />}

      <UtilRow onPaste={() => void core.doPaste()} onCopy={() => void core.doCopy()} />

      <Keypad />

      {core.pasteOpen && <PasteSheet onClose={core.closePaste} />}
    </div>
  )
}
