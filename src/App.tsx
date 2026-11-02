import { useEffect } from 'react'
import { SnackBar } from './components/SnackBar'
import { useApp } from './components/StoreProvider'
import { TabBar } from './components/TabBar'
import { CalculatorScreen } from './features/calculator/CalculatorScreen'
import { HistorySheet } from './features/calculator/HistorySheet'
import { DuePlaceholder, SavedPlaceholder, ToolsPlaceholder } from './features/placeholders/ComingSoon'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { createWakeLock } from './lib/device'
import { applyTheme } from './lib/theme'

/** Keeps the document's colours, and the screen's wake lock, in step with settings. */
function useSettingsEffects() {
  const theme = useApp((s) => s.settings.theme)
  const accent = useApp((s) => s.settings.accent)
  const keepAwake = useApp((s) => s.settings.keepAwake)

  useEffect(() => {
    applyTheme(theme, accent)
    if (theme !== 'system') return
    // Follow the phone when it switches between light and dark.
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(theme, accent)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme, accent])

  useEffect(() => {
    const lock = createWakeLock()
    void lock.set(keepAwake)
    return () => lock.dispose()
  }, [keepAwake])
}

/**
 * A button you tap should not keep keyboard focus: otherwise the next Enter on a hardware
 * keyboard activates that button again instead of meaning "=". Real clicks have detail >= 1;
 * keyboard activation has detail 0, so a button you tabbed to keeps its focus.
 * Runs in the capture phase, before React's handlers, so a sheet that opens as a result
 * never records the tapped button as the place to return to.
 */
function useBlurAfterPointerClick() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.detail === 0) return
      const button = (e.target as Element | null)?.closest?.('button')
      if (button && document.activeElement === button) button.blur()
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
}

export function App() {
  useSettingsEffects()
  useBlurAfterPointerClick()
  const tab = useApp((s) => s.tab)
  const overlay = useApp((s) => s.overlay)

  // While a sheet or the settings screen is open, the page behind it is out of reach
  // of the keyboard and of screen readers.
  const behind = overlay !== 'none' ? ({ inert: '' } as Record<string, string>) : {}

  return (
    <div className="app">
      <main className="app__body" {...behind}>
        {tab === 'calculate' && <CalculatorScreen />}
        {tab === 'tools' && <ToolsPlaceholder />}
        {tab === 'saved' && <SavedPlaceholder />}
        {tab === 'due' && <DuePlaceholder />}
      </main>

      <div className="app__nav" {...behind}>
        <TabBar />
      </div>

      {overlay === 'history' && <HistorySheet />}
      {overlay === 'settings' && <SettingsScreen />}
      <SnackBar />
    </div>
  )
}
