import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

/**
 * Makes the phone's clock and battery icons readable: light icons on the dark theme, dark icons on
 * the light one. Without this they are dark on black and vanish. Does nothing outside the Android app.
 */
export async function setStatusBar(dark: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
  } catch {
    /* A phone that refuses just keeps its default. */
  }
}
