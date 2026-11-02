import { useLayoutEffect, useRef, type RefObject } from 'react'

/**
 * Shrinks an element's font until its text fits on one line, never below `min`.
 * The result display uses it so a long number gets smaller instead of wrapping,
 * truncating or turning into "1.66e6". Below `min` it calls `onOverflow` so the caller can switch to a shorter form; failing that it scrolls sideways rather than lose digits.
 */
export function useFitText(ref: RefObject<HTMLElement>, text: string, onOverflow?: () => void, max = 52, min = 24) {
  const overflow = useRef(onOverflow)
  overflow.current = onOverflow
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const fit = () => {
      // Short phones get a smaller ceiling so the result never crowds out the keypad.
      let size = window.innerHeight < 700 ? Math.min(max, 40) : max
      el.style.fontSize = `${size}px`
      while (el.scrollWidth > el.clientWidth + 1 && size > min) {
        size -= 2
        el.style.fontSize = `${size}px`
      }
      // Still too wide at the smallest size: ask for a shorter form (scientific notation). If there is none,
      // scroll to the end, where the digits being typed are.
      if (el.scrollWidth > el.clientWidth + 1) overflow.current?.()
      el.scrollLeft = el.scrollWidth
    }

    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [ref, text, max, min])
}
