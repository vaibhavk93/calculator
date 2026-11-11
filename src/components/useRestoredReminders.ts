import { useSyncExternalStore } from 'react'
import { getRestored, subscribeRestored } from '../lib/delivery'

/** How many reminders the app put back after the phone lost them (0 = none). See lib/delivery.ts. */
export const useRestoredReminders = () => useSyncExternalStore(subscribeRestored, getRestored)
