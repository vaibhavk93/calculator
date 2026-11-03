import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * "Make reminders reliable" (PRD H7). Many phone makers add a battery saver that stops apps from waking up, which
 * can silently stop reminders. The local BatterySettings plugin (android/.../BatterySettingsPlugin.java) names the
 * maker and opens the matching settings page. Each page's name differs by phone and software version, so the steps
 * below are written in words the person can follow even when the page does not open exactly where we hope.
 */
interface BatterySettingsPlugin {
  getManufacturer(): Promise<{ manufacturer: string; brand: string; model: string }>
  openSettings(): Promise<{ opened: 'maker' | 'battery' | 'app' | 'none' }>
}
const plugin = registerPlugin<BatterySettingsPlugin>('BatterySettings')

export type OemBrand = 'xiaomi' | 'oneplus' | 'oppo' | 'vivo' | 'samsung' | 'huawei' | 'other'

/** Which family a phone belongs to, from Android's maker and brand names. Unknown makers are "other". */
export function oemBrand(manufacturer: string, brand = ''): OemBrand {
  const who = `${manufacturer} ${brand}`.toLowerCase()
  if (/xiaomi|redmi|poco/.test(who)) return 'xiaomi'
  if (who.includes('oneplus')) return 'oneplus'
  if (/oppo|realme/.test(who)) return 'oppo'
  if (/vivo|iqoo/.test(who)) return 'vivo'
  if (who.includes('samsung')) return 'samsung'
  if (/huawei|honor/.test(who)) return 'huawei'
  return 'other'
}

export interface OemGuide {
  /** What to call the phone: "Xiaomi, Redmi or POCO". */
  name: string
  /** Plain steps, in the order to do them. */
  steps: string[]
}

export const OEM_GUIDES: Record<OemBrand, OemGuide> = {
  xiaomi: {
    name: 'Xiaomi, Redmi or POCO',
    steps: [
      'Tap "Open settings". In the Autostart list, switch Calc on.',
      'Go back. Open Settings, Apps, Manage apps, Calc, Battery saver. Choose "No restrictions".',
      'Open the recent apps screen. Press and hold the Calc card, then tap the lock icon so the phone does not clear it.',
    ],
  },
  oneplus: {
    name: 'OnePlus',
    steps: [
      'Tap "Open settings". Allow Calc to start on its own and to run in the background.',
      'Open Settings, Battery, Battery optimisation. Find Calc and choose "Don\'t optimise".',
      'Open Settings, Apps, Calc, Battery usage. Choose "Allow background activity".',
    ],
  },
  oppo: {
    name: 'Oppo or Realme',
    steps: [
      'Tap "Open settings". Switch Calc on in the Auto launch (Startup) list.',
      'Open Settings, Battery. Find Calc and allow background activity, or choose "Don\'t optimise".',
      'Open Settings, Apps, App management, Calc, Battery usage. Allow background activity.',
    ],
  },
  vivo: {
    name: 'Vivo or iQOO',
    steps: [
      'Tap "Open settings". Switch Calc on in the background start-up list.',
      'Open Settings, Battery, Background power consumption. Find Calc and choose "Allow".',
      'Open Settings, Apps, Calc, Battery. Choose "No restrictions" if you see it.',
    ],
  },
  samsung: {
    name: 'Samsung',
    steps: [
      'Tap "Open settings" (Battery). Open "Background usage limits".',
      'Open "Sleeping apps" and "Deep sleeping apps". If Calc is there, remove it. Turn off "Put unused apps to sleep".',
      'Open Settings, Apps, Calc, Battery. Choose "Unrestricted".',
    ],
  },
  huawei: {
    name: 'Huawei or Honor',
    steps: [
      'Tap "Open settings". Find Calc in the list. Turn off "Manage automatically".',
      'Switch on all three: Auto-launch, Secondary launch and Run in background.',
    ],
  },
  other: {
    name: 'your phone',
    steps: [
      'Tap "Open settings". Find Calc in the list and choose "Don\'t optimise" (or "Unrestricted").',
      'If you cannot find it, open Settings, Apps, Calc, Battery and choose "Unrestricted".',
      'Some phones also have an "Auto-start" or "Background activity" switch for each app. Switch it on for Calc.',
    ],
  },
}

export const oemSupported = () => Capacitor.isNativePlatform()

/** The brand of this phone. On the web, or if the phone will not say, "other". */
export async function detectOemBrand(): Promise<{ brand: OemBrand; model: string }> {
  if (!oemSupported()) return { brand: 'other', model: '' }
  try {
    const r = await plugin.getManufacturer()
    return { brand: oemBrand(r.manufacturer, r.brand), model: r.model }
  } catch {
    return { brand: 'other', model: '' }
  }
}

export type OpenOutcome = 'maker' | 'battery' | 'app' | 'none' | 'unsupported'

/** Opens the maker's page, or the general battery list, or Calc's App info. Never throws. */
export async function openReminderSettings(): Promise<OpenOutcome> {
  if (!oemSupported()) return 'unsupported'
  try {
    return (await plugin.openSettings()).opened
  } catch {
    return 'none'
  }
}

/** What to tell the person after "Open settings", or null when the maker's own page opened and the steps say it all. */
export function openNote(outcome: OpenOutcome): string | null {
  switch (outcome) {
    case 'maker':
      return null
    case 'battery':
      return "This phone's own page did not open, so the general battery list opened. Follow the steps below from there."
    case 'app':
      return 'Opened Calc\'s App info page. Tap Battery there and choose "Unrestricted", then follow the other steps.'
    case 'none':
      return 'Could not open a settings page. Open Android Settings, Apps, Calc, Battery yourself and follow the steps.'
    case 'unsupported':
      return 'This only works in the Android app.'
  }
}
