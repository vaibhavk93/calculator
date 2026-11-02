import type { CSSProperties } from 'react'

/**
 * Sets the section colour for everything inside an element: `--tint` (the wash) and `--tint-ink` (heading text on it),
 * picked from the eight in src/lib/theme.ts. A tint says which section this is. It is never state, and it is
 * never used on a result (see docs/DESIGN-SYSTEM.md, "Section colours").
 */
export const tintStyle = (n: number): CSSProperties =>
  ({ '--tint': `var(--tint-${n})`, '--tint-ink': `var(--tint-${n}-ink)` }) as CSSProperties
