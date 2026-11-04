import { describe, expect, it } from 'vitest'
import { ACCENT_NAMES, PALETTES, buildCssVars, contrastRatio, type ResolvedTheme } from './theme'

// QA (cross-cutting): contrast of text on every section tint, in both themes. Computed, not eyeballed.
const THEMES: ResolvedTheme[] = ['dark', 'light']
const AA = 4.5

describe('QA-A1 text on every section tint', () => {
  for (const theme of THEMES) {
    const p = PALETTES[theme]
    p.tint.forEach((tint, i) => {
      it(`${theme} tint ${i + 1}: ink, its own heading ink and ink-2 are readable (4.5:1)`, () => {
        expect(contrastRatio(p.ink, tint), 'ink').toBeGreaterThanOrEqual(AA)
        expect(contrastRatio(p.tintInk[i]!, tint), 'tintInk').toBeGreaterThanOrEqual(AA)
        expect(contrastRatio(p.ink2, tint), 'ink-2').toBeGreaterThanOrEqual(AA)
      })
      it(`${theme} tint ${i + 1}: alert (errors) on the tint`, () => {
        expect(contrastRatio(p.alert, tint), 'alert').toBeGreaterThanOrEqual(AA)
      })

      // KNOWN GAP, measured 2026-11-04. `ink-3` is a text colour by design (DESIGN-SYSTEM.md line 72,
      // "Tertiary, timestamps") and the design system's own table requires 4.5:1 for it — but that table
      // only ever checked it on `bg` and `surface`. On the eight tinted section cards, which came later,
      // dark-mode `ink-3` measures 3.60 to 4.32. It is really on screen: `.field-hint` and `.field-words`
      // (tools.css) are ink-3 text inside the tinted input card on every calculator.
      //
      // Not fixed here because all three fixes are design decisions for the owner, not a patch:
      //   A. ink-3 dark #818181 -> #929292. Clears 4.5 everywhere (worst 4.51), but the grey ramp
      //      compresses: ink-2 vs ink-3 drops from 1.563 to 1.248, so the two greys look nearly alike.
      //   B. Stop using ink-3 for hint text; hints become ink-2 (already passes). Ramp is kept, but
      //      ink-3's role narrows to borders and disabled text, against its documented "tertiary text" job.
      //   C. Accept 3.60-4.32 on tints and write the exception into the design system.
      // Tracked in docs/UX-IMPROVEMENT-PLAN-2026-11-04.md (C3). The guard below still fails if it gets WORSE.
      it(`${theme} tint ${i + 1}: ink-3 (hints) does not get worse than it is today`, () => {
        expect(contrastRatio(p.ink3, tint), 'ink-3').toBeGreaterThanOrEqual(theme === 'dark' ? 3.6 : AA)
      })
      it.skip(`${theme} tint ${i + 1}: ink-3 (hints) reaches 4.5:1 — the goal, see options A/B/C above`, () => {
        expect(contrastRatio(p.ink3, tint), 'ink-3').toBeGreaterThanOrEqual(AA)
      })
      it(`${theme} tint ${i + 1}: every accent, used as text or an icon, is readable on it`, () => {
        for (const a of ACCENT_NAMES) expect(contrastRatio(buildCssVars(theme, a)['--accent']!, tint), a).toBeGreaterThanOrEqual(AA)
      })
    })
  }
  it('there are eight tints, each with its own ink, in both themes', () => {
    for (const t of THEMES) { expect(PALETTES[t].tint).toHaveLength(8); expect(PALETTES[t].tintInk).toHaveLength(8) }
  })
})
