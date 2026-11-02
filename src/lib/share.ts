import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { copyText } from './device'

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

/**
 * Opens the phone's own share sheet. In a browser without one it copies the text instead, and says so, so the
 * caller can tell the person what happened. Backing out of the sheet is not an error.
 */
export async function shareText(title: string, text: string): Promise<ShareResult> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title, text, dialogTitle: 'Share' })
      return 'shared'
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, text })
      return 'shared'
    }
  } catch (e) {
    const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e)
    if (/abort|cancel/i.test(msg)) return 'cancelled'
    // Anything else: try a plain copy so the person still gets the text.
  }
  return (await copyText(text)) ? 'copied' : 'failed'
}
