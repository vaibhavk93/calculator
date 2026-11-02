import { createContext, useContext, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { AppState, AppStore } from '../store/app'

const StoreContext = createContext<AppStore | null>(null)

export function StoreProvider({ store, children }: { store: AppStore; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useAppStore(): AppStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useAppStore must be used inside <StoreProvider>')
  return store
}

/** Subscribe to a slice of state. Select primitives or stable references, never fresh objects. */
export function useApp<T>(selector: (s: AppState) => T): T {
  return useStore(useAppStore(), selector)
}
