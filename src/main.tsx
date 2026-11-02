import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-ext-400.css'
import '@fontsource/ibm-plex-sans/greek-400.css'
import '@fontsource/ibm-plex-mono/latin-300.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-ext-400.css'
import './styles/global.css'
import './styles/tools.css'
import './styles/lists.css'

import { App } from './App'
import { StoreProvider } from './components/StoreProvider'
import { createStorage } from './lib/storage'
import { applyTheme } from './lib/theme'
import { bootStore } from './store/boot'

async function main() {
  const { store } = await bootStore(createStorage())

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
