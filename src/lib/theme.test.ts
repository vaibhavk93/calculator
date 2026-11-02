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

describe('positive and negative (good / bad for you)', () => {
  for (const theme of THEMES) {
    const p = PALETTES[theme]
    const grounds = { bg: p.bg, surface: p.surface, raised: p.raised }

    for (const [gName, ground] of Object.entries(grounds)) {
      it(`${theme}: both are readable on ${gName}`, () => {
        expect(contrastRatio(p.positive, ground), `positive on ${gName}`).toBeGreaterThanOrEqual(AA_BODY)
        expect(contrastRatio(p.negative, ground), `negative on ${gName}`).toBeGreaterThanOrEqual(AA_BODY)
      })
    }

    it(`${theme}: they are told apart by more than hue alone`, () => {
      // A red/green pair that also differs in lightness survives being seen by
      // someone who cannot separate the two hues, and survives a greyscale print.
      expect(contrastRatio(p.positive, p.negative)).toBeGreaterThanOrEqual(1.4)
    })
  }

  it('both reach the CSS as their own tokens', () => {
    const vars = buildCssVars('dark', 'citron')
    expect(vars['--positive']).toBe(PALETTES.dark.positive)
    expect(vars['--negative']).toBe(PALETTES.dark.negative)
  })

  it('negative stays in the alert family: one red in the app, not two', () => {
    for (const theme of THEMES) expect(PALETTES[theme].negative).toBe(PALETTES[theme].alert)
  })
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

describe('section tints (identity colours, never state)', () => {
  for (const theme of THEMES) {
    const p = PALETTES[theme]
    it(`${theme}: eight tints, each with text that passes AA on its own wash`, () => {
      expect(p.tint).toHaveLength(8)
      expect(p.tintInk).toHaveLength(8)
      p.tint.forEach((bg, i) => {
        expect(contrastRatio(p.ink, bg), `ink on tint ${i + 1}`).toBeGreaterThanOrEqual(7)
        expect(contrastRatio(p.tintInk[i]!, bg), `tintInk on tint ${i + 1}`).toBeGreaterThanOrEqual(AA_BODY)
      })
    })
    it(`${theme}: every tint is a visibly different card from the ground, and from each other`, () => {
      p.tint.forEach((bg) => expect(contrastRatio(bg, p.bg)).toBeGreaterThanOrEqual(1.08))
      expect(new Set(p.tint).size).toBe(8)
    })
    it(`${theme}: exposes --tint-1..8 and --tint-1-ink..8-ink as CSS variables`, () => {
      const vars = buildCssVars(theme, 'citron')
      for (let i = 1; i <= 8; i++) {
        expect(vars[`--tint-${i}`]).toBe(p.tint[i - 1])
        expect(vars[`--tint-${i}-ink`]).toBe(p.tintInk[i - 1])
      }
    })
    it(`${theme}: no saturated tint sits in the red, green or citron hue ranges, so none can read as bad, good or tappable`, () => {
      const hue = (hex: string) => {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
        const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
        if (d === 0) return { h: 0, s: 0 }
        const l = (max + min) / 2
        const s = d / (1 - Math.abs(2 * l - 1))
        const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
        return { h: (h * 60 + 360) % 360, s }
      }
      p.tint.concat(p.tintInk).forEach((c) => {
        const { h, s } = hue(c)
        if (s < 0.15) return // near-neutral: carries no hue meaning
        expect(h < 25 || h > 345, `${c} is red-ish (hue ${Math.round(h)})`).toBe(false)
        expect(h >= 110 && h <= 175, `${c} is green-ish (hue ${Math.round(h)})`).toBe(false)
        expect(h >= 55 && h <= 80, `${c} is citron-ish (hue ${Math.round(h)})`).toBe(false)
      })
    })
  }
})
