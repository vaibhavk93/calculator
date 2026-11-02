import { useEffect, useRef } from 'react'
import { pushBack } from '../lib/backStack'

/** While `active`, the Android back button runs `onBack` instead of leaving the screen or the app. */
export function useBackHandler(active: boolean, onBack: () => void) {
  const ref = useRef(onBack)
  ref.current = onBack
  useEffect(() => {
    if (!active) return
    return pushBack(() => ref.current())
  }, [active])
}
