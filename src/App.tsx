import { useEffect, useState } from 'react'
import { SnackBar } from './components/SnackBar'
import { useApp, useAppStore } from './components/StoreProvider'
import { TabBar } from './components/TabBar'
import { CalculatorScreen } from './features/calculator/CalculatorScreen'
import { HistorySheet } from './features/calculator/HistorySheet'
import { BudgetScreen } from './features/budget/BudgetScreen'
import { DueScreen } from './features/memory/DueScreen'
import { SavedScreen } from './features/memory/SavedScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { ToolsScreen } from './features/tools/ToolsScreen'
import { goBack } from './lib/backStack'
import { createWakeLock } from './lib/device'
import { exitApp, onHardwareBack } from './lib/nativeBack'
import { setStatusBar } from './lib/statusBar'
import { applyNotifications, ensurePermission, onNotificationAction, planNotifications } from './lib/notifications'
import { formatCell } from './lib/toolFormat'
import { D } from './engine'
import { applyTheme } from './lib/theme'

/** Keeps the document's colours, and the screen's wake lock, in step with settings. */
function useSettingsEffects() {
  const theme = useApp((s) => s.settings.theme)
  const accent = useApp((s) => s.settings.accent)
  const keepAwake = useApp((s) => s.settings.keepAwake)

  useEffect(() => {
    void setStatusBar(applyTheme(theme, accent) === 'dark')
    if (theme !== 'system') return
    // Follow the phone when it switches between light and dark.
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => void setStatusBar(applyTheme(theme, accent) === 'dark')
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
 * Keeps the phone's scheduled notifications in step with the reminders, and handles Mark paid / Snooze
 * tapped on a notification. The permission is asked for only once a reminder exists, never at launch.
 */
function useReminderNotifications() {
  const reminders = useApp((s) => s.reminders)
  const cards = useApp((s) => s.cards)
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const markPaid = useApp((s) => s.markPaid)
  const snooze = useApp((s) => s.snooze)
  const setTab = useApp((s) => s.setTab)

  // Coming back from Android's permission screens re-plans, so a newly allowed exact alarm takes effect.
  const [resumed, setResumed] = useState(0)
  useEffect(() => {
    const onShow = () => document.visibilityState === 'visible' && setResumed((n) => n + 1)
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [])

  useEffect(() => {
    const money = (plain: string) => formatCell(new D(plain), 'money', { system, decimals })
    const planned = planNotifications(reminders, cards, Date.now(), money)
    void (async () => {
      if (planned.length > 0 && !(await ensurePermission())) return
      await applyNotifications(planned)
    })()
  }, [reminders, cards, system, decimals, resumed])

  useEffect(() => {
    const stop = onNotificationAction((id, action) => {
      if (action === 'paid') markPaid(id)
      else if (action === 'snooze') snooze(id, 1)
      else setTab('due')
    })
    return () => void stop.then((f) => f())
  }, [markPaid, snooze, setTab])
}

/**
 * The Android back button: close a settings or history screen first, then whatever screen has
 * registered a handler (a calculator, a Tools group), then go to the Calculate tab, then leave.
 */
function useHardwareBack() {
  const store = useAppStore()
  useEffect(() => {
    const stop = onHardwareBack(() => {
      const s = store.getState()
      if (s.overlay !== 'none') return s.setOverlay('none')
      if (goBack()) return
      if (s.tab !== 'calculate') return s.setTab('calculate')
      exitApp()
    })
    return () => void stop.then((f) => f())
  }, [store])
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
  useReminderNotifications()
  useHardwareBack()
  const tab = useApp((s) => s.tab)
  const overlay = useApp((s) => s.overlay)

  // While a sheet or the settings screen is open, the page behind it is out of reach
  // of the keyboard and of screen readers.
  const behind = overlay !== 'none' ? ({ inert: '' } as Record<string, string>) : {}

  return (
    <div className="app">
      <main className="app__body" {...behind}>
        {tab === 'calculate' && <CalculatorScreen />}
        {tab === 'tools' && <ToolsScreen />}
        {tab === 'saved' && <SavedScreen />}
        {tab === 'due' && <DueScreen />}
        {tab === 'budget' && <BudgetScreen />}
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
