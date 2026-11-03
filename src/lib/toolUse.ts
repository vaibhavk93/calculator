/**
 * "Your tools": the calculators you open most, floated to the top of Tools. Pure helpers; the counts and pins
 * live in Settings (`toolUse`, `pinnedTools`). Nothing here knows about the screen.
 */

export const MAX_USE_COUNT = 999
export const MAX_COUNTED_TOOLS = 80
export const MAX_PINNED_TOOLS = 3
/** A tool needs this many opens before it floats up on its own, so one stray tap changes nothing. */
export const PROMOTE_AFTER = 2
export const MAX_YOUR_TOOLS = 5

/** One more open of `id`. Counts only add up, to a cap, and the table is trimmed to the most-used tools. */
export function bumpUse(counts: Record<string, number>, id: string): Record<string, number> {
  const next = { ...counts, [id]: Math.min(MAX_USE_COUNT, (counts[id] ?? 0) + 1) }
  const ids = Object.keys(next)
  if (ids.length <= MAX_COUNTED_TOOLS) return next
  const drop = ids.filter((k) => k !== id).sort((a, b) => next[a]! - next[b]!)[0]!
  delete next[drop]
  return next
}

/** Pin or unpin. A pin always stays above counted tools. At the limit a new pin is refused (null). */
export function togglePinned(pinned: string[], id: string): string[] | null {
  if (pinned.includes(id)) return pinned.filter((p) => p !== id)
  return pinned.length >= MAX_PINNED_TOOLS ? null : [...pinned, id]
}

/** The list shown on Tools: pinned first (in the order pinned), then the most opened, most first. Only tools that still exist. */
export function yourTools(counts: Record<string, number>, pinned: string[], exists: (id: string) => boolean): string[] {
  const pins = pinned.filter(exists)
  const used = Object.keys(counts)
    .filter((id) => exists(id) && !pins.includes(id) && counts[id]! >= PROMOTE_AFTER)
    .sort((a, b) => counts[b]! - counts[a]!)
  return [...pins, ...used].slice(0, Math.max(MAX_YOUR_TOOLS, pins.length))
}
