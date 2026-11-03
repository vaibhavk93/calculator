import { useSyncExternalStore } from 'react'
import { getMissed, subscribeMissed } from '../lib/delivery'

/** The Due tab's "a reminder may not have shown" notice, or null. See lib/delivery.ts. */
export const useMissedReminder = () => useSyncExternalStore(subscribeMissed, getMissed)
