import { useCallback, useMemo } from 'react'
import { Icon } from '../../components/Icon'
import { useApp } from '../../components/StoreProvider'
import { copyText, haptic } from '../../lib/device'
import { computeDisplay } from './display'
import { Display } from './Display'
import { Keypad, useRepeatingPress } from './Keypad'
import { MorePanel, ScientificPanel } from './Panels'
import { useKeyboard } from './useKeyboard'

export function CalculatorScreen() {
  const input = useApp((s) => s.input)
  const lastExpression = useApp((s) => s.lastExpression)
  const settings = useApp((s) => s.settings)
  const panel = useApp((s) => s.panel)
  const canUndo = useApp((s) => s.undoStack.length > 0)

  const press = useApp((s) => s.press)
  const undoInput = useApp((s) => s.undoInput)
  const setPanel = useApp((s) => s.setPanel)
  const setOverlay = useApp((s) => s.setOverlay)
  const showNotice = useApp((s) => s.showNotice)

  const view = useMemo(
    () => computeDisplay(input, lastExpression, settings),
    // Only the fields the display depends on, so unrelated settings don't recompute it.
    [input, lastExpression, settings.numberSystem, settings.decimals, settings.angle],
  )

  const doCopy = useCallback(async () => {
    if (view.copyText === null) return showNotice('Nothing to copy yet')
    const ok = await copyText(view.copyText)
    showNotice(ok ? 'Copied' : "Couldn't copy here", ok ? 'info' : 'error')
  }, [view.copyText, showNotice])

  useKeyboard(() => view.copyText)

  const backspace = useRepeatingPress(() => {
    haptic(settings.haptics)
    press('backspace')
  })

  return (
    <div className="calc" data-panel={panel}>
      <header className="calc__bar">
        <span className="calc__title">VK Calc</span>
        <button type="button" className="icon-btn" aria-label="History" onClick={() => setOverlay('history')}>
          <Icon name="history" size={21} />
        </button>
        <button type="button" className="icon-btn" aria-label="Settings" onClick={() => setOverlay('settings')}>
          <Icon name="menu" size={21} />
        </button>
      </header>

      <Display view={view} fresh={input.fresh} onCopy={() => void doCopy()} />

      <div className="util">
        <button
          type="button"
          className="util__btn"
          aria-label="Memory and clipboard"
          aria-expanded={panel === 'more'}
          onClick={() => setPanel('more')}
        >
          <Icon name="more" size={22} />
        </button>
        <button
          type="button"
          className="util__btn"
          aria-label="Scientific functions"
          aria-expanded={panel === 'scientific'}
          onClick={() => setPanel('scientific')}
        >
          <Icon name="up" size={22} className="icon--turn" />
        </button>
        <button type="button" className="util__btn" aria-label="Undo" disabled={!canUndo} onClick={undoInput}>
          <Icon name="undo" size={21} />
        </button>
        <button type="button" className="util__btn util__btn--primary" aria-label="Backspace" {...backspace}>
          <Icon name="backspace" size={23} />
        </button>
      </div>

      {panel === 'more' && <MorePanel onCopy={() => void doCopy()} />}
      {panel === 'scientific' && <ScientificPanel />}

      <Keypad />
    </div>
  )
}
