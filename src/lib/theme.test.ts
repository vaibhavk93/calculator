// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  ACCENT_NAMES,
  ACCENTS,
  PALETTES,
  applyTheme,
  buildCssVars,
  contrastRatio,
  resolveTheme,
  type ResolvedTheme,
} from './theme'

const THEMES: ResolvedTheme[] = ['dark', 'light']
const AA_BODY = 4.5
const AA_NON_TEXT = 3

describe('contrast, computed for every theme', () => {
  for (const theme of THEMES) {
    const p = PALETTES[theme]
    const grounds = { bg: p.bg, surface: p.surface, raised: p.raised }

    for (const [gName, ground] of Object.entries(grounds)) {
      it(`${theme}: ink, ink-2, ink-3 and alert are readable on ${gName}`, () => {
        for (const [name, colour] of Object.entries({ ink: p.ink, ink2: p.ink2, ink3: p.ink3, alert: p.alert })) {
          expect(contrastRatio(colour, ground), `${name} on ${gName}`).toBeGreaterThanOrEqual(AA_BODY)
        }
      })
    }

    it(`${theme}: key labels are readable on their own keys`, () => {
      // Operator keys are transparent in light mode, so they sit on the ground.
      const opGround = p.keyOp === 'transparent' ? p.bg : p.keyOp
      expect(contrastRatio(p.ink, p.keyDigit)).toBeGreaterThanOrEqual(AA_BODY)
      expect(contrastRatio(p.ink2, opGround)).toBeGreaterThanOrEqual(AA_BODY)
      expect(contrastRatio(p.alert, opGround)).toBeGreaterThanOrEqual(AA_BODY)
    })

    it(`${theme}: pressed keys keep their labels readable`, () => {
      expect(contrastRatio(p.ink, p.keyDigitPressed)).toBeGreaterThanOrEqual(AA_BODY)
      expect(contrastRatio(p.ink2, p.keyOpPressed)).toBeGreaterThanOrEqual(AA_BODY)
    })
  }
})

describe('contrast, for every accent', () => {
  for (const name of ACCENT_NAMES) {
    const a = ACCENTS[name]
    for (const theme of THEMES) {
      const p = PALETTES[theme]
      const vars = buildCssVars(theme, name)
      const accentText = vars['--accent']!
      const accentLine = vars['--accent-dim']!

      it(`${name} / ${theme}: accent text and icons are readable on every ground`, () => {
        for (const ground of [p.bg, p.surface, p.raised, p.sheet]) {
          expect(contrastRatio(accentText, ground), `on ${ground}`).toBeGreaterThanOrEqual(AA_BODY)
        }
      })

      it(`${name} / ${theme}: accent borders are visible (non-text 3:1)`, () => {
        expect(contrastRatio(accentLine, p.bg)).toBeGreaterThanOrEqual(AA_NON_TEXT)
      })
    }

    it(`${name}: the label on the accent fill (the "=" key) is readable`, () => {
      expect(contrastRatio(a.ink, a.fill)).toBeGreaterThanOrEqual(7)
    })
  }
})

describe('the "=" key is the same in both themes', () => {
  it('fill and ink come from the accent, not the theme', () => {
    for (const name of ACCENT_NAMES) {
      const d = buildCssVars('dark', name)
      const l = buildCssVars('light', name)
      expect(d['--accent-fill']).toBe(l['--accent-fill'])
      expect(d['--accent-ink']).toBe(l['--accent-ink'])
    }
  })
})

describe('elevation reverses direction between themes', () => {
  // Digit keys sit forward of the ground. Forward is lighter on dark, darker on light.
  it('digit keys are lighter than the ground on dark', () => {
    expect(PALETTES.dark.keyDigit.toLowerCase() > PALETTES.dark.bg.toLowerCase()).toBe(true)
  })
  it('digit keys are darker than the ground on light', () => {
    expect(PALETTES.light.keyDigit.toLowerCase() < PALETTES.light.bg.toLowerCase()).toBe(true)
  })
  it('light operator keys carry no fill', () => {
    expect(PALETTES.light.keyOp).toBe('transparent')
  })
})

describe('neutrals carry no hidden tint', () => {
  it.each(THEMES)('%s: every neutral is a pure grey', (theme) => {
    const p = PALETTES[theme]
    for (const hex of [p.bg, p.surface, p.raised, p.line, p.ink, p.ink2, p.ink3]) {
      const [r, g, b] = [1, 3, 5].map((i) => hex.slice(i, i + 2))
      expect(r, hex).toBe(g)
      expect(g, hex).toBe(b)
    }
  })
})

describe('resolveTheme', () => {
  it('passes explicit choices through', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })
  it('follows the system when asked', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('applyTheme', () => {
  it('writes every token to the document and records the resolved theme', () => {
    const resolved = applyTheme('light', 'sky', document, true)
    expect(resolved).toBe('light')
    const root = document.documentElement
    expect(root.dataset.theme).toBe('light')
    expect(root.style.getPropertyValue('--bg')).toBe('#FFFFFF')
    expect(root.style.getPropertyValue('--accent-fill')).toBe(ACCENTS.sky.fill)
    expect(root.style.getPropertyValue('--accent')).toBe(ACCENTS.sky.textOnLight)
  })
  it('"system" follows the OS preference', () => {
    expect(applyTheme('system', 'citron', document, true)).toBe('dark')
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#060606')
    expect(applyTheme('system', 'citron', document, false)).toBe('light')
  })
  it('updates the browser chrome colour', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#000000">'
    applyTheme('dark', 'citron', document, true)
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#060606')
  })
  it('is safe to call repeatedly', () => {
    for (let i = 0; i < 5; i++) applyTheme('dark', 'amber', document, true)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
