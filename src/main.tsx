import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@fontsource/ibm-plex-sans/latin-ext-400.css'
import '@fontsource/ibm-plex-sans/greek-400.css'
import '@fontsource/ibm-plex-mono/latin-300.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-ext-400.css'
import './styles/global.css'
import './styles/tools.css'
import './styles/lists.css'
import './styles/history.css'
import './styles/budget.css'
import './styles/forms.css'
import './styles/onboarding.css'

import { App } from './App'
import { StoreProvider } from './components/StoreProvider'
import { createStorage } from './lib/storage'
import { applyTheme } from './lib/theme'
import { bootStore } from './store/boot'
import { initSmsRuntime } from './store/smsRuntime'
import { memorySmsQueue, type QueuedMessage, type SmsPermission } from './lib/smsQueue'
import { nativeSmsQueue } from './lib/smsQueueNative'

/**
 * The phone-side message queue: the real one on Android, none on the web. The one test hook: a browser test sets the localStorage key
 * `vkcalc.test.smsqueue` to `{ "permission": "...", "messages": [...] }` BEFORE the app starts, and gets an in-memory queue instead (also
 * reachable as window.__smsQueue, so the test can push a message). Nothing else reads that key; with it absent this is exactly the old behaviour.
 */
function smsQueueForThisRun() {
  try {
    const raw = localStorage.getItem('vkcalc.test.smsqueue')
    if (raw) {
      const t = JSON.parse(raw) as { permission?: SmsPermission; messages?: QueuedMessage[] }
      const q = memorySmsQueue(t.messages ?? [], t.permission ?? 'granted')
      ;(window as unknown as { __smsQueue?: unknown }).__smsQueue = q
      return q
    }
  } catch { /* no hook: use the real queue */ }
  return nativeSmsQueue()
}

async function main() {
  const { store, persist } = await bootStore(createStorage())
  initSmsRuntime({ store, port: smsQueueForThisRun(), persist })

  // Colours before the first paint, so there is no flash of the wrong theme.
  const { theme, accent } = store.getState().settings
  applyTheme(theme, accent)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <StoreProvider store={store}>
        <App />
      </StoreProvider>
    </StrictMode>,
  )
}

void main()
