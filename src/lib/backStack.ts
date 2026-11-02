/**
 * The Android back button, as a stack. Each screen that has somewhere to go back to registers a
 * handler while it is open; the newest runs first. When none is left the caller decides
 * (go to the Calculate tab, then leave the app).
 */
export type BackHandler = () => void

const stack: BackHandler[] = []

/** Registers a handler. Returns a function that removes it. */
export function pushBack(handler: BackHandler): () => void {
  stack.push(handler)
  return () => {
    const i = stack.lastIndexOf(handler)
    if (i !== -1) stack.splice(i, 1)
  }
}

/** Runs the newest handler. Returns false when there was none. */
export function goBack(): boolean {
  const handler = stack[stack.length - 1]
  if (!handler) return false
  handler()
  return true
}

export const backDepth = () => stack.length
