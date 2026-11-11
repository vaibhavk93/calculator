import type { CSSProperties } from 'react'

/**
 * Sets the section colour for everything inside an element: `--tint` (the wash) and `--tint-ink` (heading text on it),
 * picked from the eight in src/lib/theme.ts. A tint says which section this is. It is never state, and it is
 * never used on a result (see docs/DESIGN-SYSTEM.md, "Section colours").
 */
export const tintStyle = (n: number): CSSProperties =>
  ({ '--tint': `var(--tint-${n})`, '--tint-ink': `var(--tint-${n}-ink)` }) as CSSProperties

/** The eight section hues, in the order the design hands them to categories and cards (Food yellow, Travel blue, Bills purple...). */
const DOT_SLOTS = [3, 5, 6, 4, 1, 2, 8, 7]

/**
 * `--dot`, the colour of a category's (or a card's) small mark, picked by its place in the list. Identity only, never state:
 * the colour is never the only signal because the name is always beside it. A subcategory takes its parent's colour; no category
 * (or one that is gone) gets the quiet grey. Deleted items stay in the list, so the colours of the others never shift.
 */
export function dotStyle(list: { id: string; parentId?: string | null }[], id: string | null): CSSProperties {
  const byId = (x: string) => list.find((c) => c.id === x)
  const found = id === null ? undefined : byId(id)
  const top = found?.parentId ? byId(found.parentId) ?? found : found
  if (!top) return { '--dot': 'var(--ink-2)' } as CSSProperties
  const i = list.filter((c) => !c.parentId).findIndex((c) => c.id === top.id)
  return { '--dot': `var(--tint-${DOT_SLOTS[(i < 0 ? 0 : i) % DOT_SLOTS.length]}-ink)` } as CSSProperties
}
