/**
 * Thin, defensive wrappers over browser/device APIs. Every one of them can be
 * missing or refuse (private windows, old WebViews, iOS), and none of that may
 * ever break a calculation: they fail quietly and report whether they worked.
 *
 * In the Android build these get Capacitor-backed implementations (Haptics,
 * KeepAwake, Clipboard, Filesystem); the call sites do not change.
 */

import { Capacitor } from '@capacitor/core'
import { Clipboard } from '@capacitor/clipboard'

export function haptic(enabled: boolean, ms = 8): void {
  if (!enabled) return
  try {
    globalThis.navigator?.vibrate?.(ms)
  } catch {
    /* unsupported */
  }
}

export interface WakeLockController {
  /** Request or release the screen wake lock. Safe to call repeatedly. */
  set(on: boolean): Promise<void>
  dispose(): void
}

export function createWakeLock(): WakeLockController {
  let sentinel: WakeLockSentinel | null = null
  let wanted = false

  const acquire = async () => {
    try {
      if (!wanted || sentinel || !navigator.wakeLock) return
      sentinel = await navigator.wakeLock.request('screen')
      sentinel.addEventListener('release', () => {
        sentinel = null
      })
    } catch {
      sentinel = null
    }
  }

  // The browser drops the lock whenever the page is hidden; take it back on return.
  const onVisible = () => {
    if (document.visibilityState === 'visible') void acquire()
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)

  return {
    async set(on) {
      wanted = on
      if (on) await acquire()
      else {
        try {
          await sentinel?.release()
        } catch {
          /* already released */
        }
        sentinel = null
      }
    },
    dispose() {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
      wanted = false
      void sentinel?.release().catch(() => undefined)
    },
  }
}

export async function copyText(text: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Clipboard.write({ string: text })
      return true
    } catch {
      /* fall through to the web paths */
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older WebViews and non-secure contexts: fall back to a hidden textarea.
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

/**
 * The clipboard's text, or null when it couldn't be read or held no text. Callers treat both the
 * same way: offer a text box the user can long-press paste into, which always works.
 */
export async function readClipboardText(): Promise<string | null> {
  try {
    const text = Capacitor.isNativePlatform() ? (await Clipboard.read()).value : await navigator.clipboard.readText()
    return text && text.trim() ? text : null
  } catch {
    return null
  }
}

export function downloadTextFile(filename: string, text: string, mime = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after the click has been handled.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
