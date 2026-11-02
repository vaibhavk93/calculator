import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

/** Calls `cb` when the Android back button is pressed. Returns a function that stops listening. No-op in the browser. */
export async function onHardwareBack(cb: () => void): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {}
  const handle = await App.addListener('backButton', cb)
  return () => void handle.remove()
}

/** Leaves the app, from the back button on the first screen. */
export function exitApp(): void {
  if (Capacitor.isNativePlatform()) void App.exitApp()
}
