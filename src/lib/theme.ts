/**
 * The only file in the app allowed to contain raw colour values.
 * Everything else reads CSS variables, so a theme or accent change is one
 * function call and a stray hex in a component is a bug (see architecture.test.ts).
 *
 * Neutrals are chroma 0 on purpose: no hidden warm or cool tint.
 *
 * Accent means "you can act on this". `positive` and `negative` mean "this is
 * good / bad for you" and are the ONLY colours allowed to carry that meaning
 * (owner's decision, 2026-11-02; see docs/DESIGN-SYSTEM.md "Colour that means
 * good or bad"). They are never used alone: the value also carries a sign or a
 * word, because roughly 1 in 12 men cannot separate red from green.
 *
 * Section tints (`tint`, `tintInk`) say "which part of the app is this". They are identity, never
 * state: they never mean good, bad, tappable or selected. Eight, in a fixed order, one per group of
 * calculators (see src/features/tools/groups.ts). Hues stay clear of red, green and the citron accent, so a
 * section colour can never be mistaken for good, bad or tappable. They colour navigation and input areas only:
 * never the Result section, the answer bar, or anything beside a number that carries positive/negative.
 */

export type ThemePreference = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'
export type AccentName = 'citron' | 'sky' | 'violet' | 'amber'

export interface Palette {
  bg: string
  surface: string
  raised: string
  line: string
  ink: string
  ink2: string
  ink3: string
  alert: string
  /** "This is good for you." Never used without a sign or a word beside it. */
  positive: string
  /** "This is bad for you." Same hue family as `alert`, which stays for errors. */
  negative: string
  keyDigit: string
  keyDigitPressed: string
  keyOp: string
  keyOpPressed: string
  sheet: string
  scrim: string
  /** Eight section backgrounds, a faint wash of one hue. Text on them is `ink`. */
  tint: string[]
  /** The same eight hues, as heading text and small marks on their own `tint`. */
  tintInk: string[]
}

export interface AccentDef {
  label: string
  /** Bright fill, used behind dark ink. Identical in both themes so the brand reads continuously. */
  fill: string
  /** Text on `fill`. */
  ink: string
  /** Quiet accent for borders and inactive states in dark mode. */
  dim: string
  /** Accent used as text or an icon on a light ground. */
  textOnLight: string
}

export const PALETTES: Record<ResolvedTheme, Palette> = {
  dark: {
    bg: '#060606',
    surface: '#0D0D0D',
    raised: '#181818',
    line: '#262626',
    ink: '#F5F5F5',
    ink2: '#A4A4A4',
    ink3: '#818181',
    alert: '#EF675A',
    // 10.6:1 on bg. Chosen at the alert red's perceptual lightness so neither shouts louder.
    positive: '#5CD08A',
    negative: '#EF675A',
    keyDigit: '#181818',
    keyDigitPressed: '#262626',
    keyOp: '#0D0D0D',
    keyOpPressed: '#181818',
    sheet: '#0D0D0D',
    scrim: 'rgba(0, 0, 0, 0.62)',
    // Math, money, units, life, loans, savings, tax, business. Each pair is 6.4:1 or better (tintInk on tint); ink on tint is 12:1 or better.
    tint: ['#201933', '#192F33', '#322B1B', '#321B2B', '#182435', '#2C1A32', '#23262A', '#2B2722'],
    tintInk: ['#AA91F2', '#91E2F2', '#F0D494', '#F094D4', '#8FB9F5', '#D993F1', '#A1BCE3', '#E5CB9F'],
  },
  light: {
    bg: '#FFFFFF',
    surface: '#F7F7F7',
    raised: '#F2F2F2',
    line: '#DEDEDE',
    ink: '#121212',
    ink2: '#525252',
    ink3: '#5D5D5D',
    alert: '#BE241F',
    // 10.4:1 on white, and deliberately much darker than `negative`: on light
    // ground a mid green and a mid red land at nearly the same lightness, so
    // hue is all that separates them. Lightness has to do the work instead.
    positive: '#064A26',
    negative: '#BE241F',
    keyDigit: '#F2F2F2',
    keyDigitPressed: '#E2E2E2',
    // On white, any fill would push operators *forward*; no fill is what makes them recede.
    keyOp: 'transparent',
    keyOpPressed: '#F2F2F2',
    sheet: '#FFFFFF',
    scrim: 'rgba(18, 18, 18, 0.42)',
    tint: ['#E7E1F9', '#E1F5F9', '#F9F2E2', '#F9E2F2', '#E0EBFA', '#F3E1F9', '#E5ECF5', '#F6EFE5'],
    tintInk: ['#2B1961', '#195561', '#5F4B1C', '#5F1C4B', '#173764', '#4F1A60', '#283A52', '#544327'],
  },
}

// OKLCH sources: fill L0.84 / ink L0.18 / dim L0.52 / textOnLight L0.47, at each hue,
// chroma reduced until inside sRGB.
export const ACCENTS: Record<AccentName, AccentDef> = {
  citron: { label: 'Citron', fill: '#CCD539', ink: '#121300', dim: '#6A6F20', textOnLight: '#5C6100' },
  sky: { label: 'Sky', fill: '#8ED5FE', ink: '#001421', dim: '#1C719A', textOnLight: '#00638A' },
  violet: { label: 'Violet', fill: '#CEC0FF', ink: '#130D21', dim: '#6D5C9C', textOnLight: '#61489B' },
  amber: { label: 'Amber', fill: '#FFBC64', ink: '#1C0E00', dim: '#8C5E1A', textOnLight: '#7D5002' },
}

export const ACCENT_NAMES = Object.keys(ACCENTS) as AccentName[]
export const DEFAULT_ACCENT: AccentName = 'citron'
export const DEFAULT_THEME: ThemePreference = 'dark'

export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light'
  return pref
}

export function buildCssVars(theme: ResolvedTheme, accent: AccentName): Record<string, string> {
  const p = PALETTES[theme]
  const a = ACCENTS[accent]
  return {
    '--bg': p.bg,
    '--surface': p.surface,
    '--raised': p.raised,
    '--line': p.line,
    '--ink': p.ink,
    '--ink-2': p.ink2,
    '--ink-3': p.ink3,
    '--alert': p.alert,
    '--positive': p.positive,
    '--negative': p.negative,
    '--key-digit': p.keyDigit,
    '--key-digit-pressed': p.keyDigitPressed,
    '--key-op': p.keyOp,
    '--key-op-pressed': p.keyOpPressed,
    '--sheet': p.sheet,
    '--scrim': p.scrim,
    ...Object.fromEntries(p.tint.map((c, i) => [`--tint-${i + 1}`, c])),
    ...Object.fromEntries(p.tintInk.map((c, i) => [`--tint-${i + 1}-ink`, c])),
    '--accent': theme === 'dark' ? a.fill : a.textOnLight,
    '--accent-fill': a.fill,
    '--accent-ink': a.ink,
    '--accent-dim': theme === 'dark' ? a.dim : a.textOnLight,
  }
}

export function systemPrefersDark(win: Pick<Window, 'matchMedia'> | undefined = globalThis.window): boolean {
  try {
    return win?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
  } catch {
    return true
  }
}

/** Applies the theme to the document. Safe to call repeatedly. */
export function applyTheme(
  pref: ThemePreference,
  accent: AccentName,
  doc: Document = document,
  systemDark: boolean = systemPrefersDark(),
): ResolvedTheme {
  const resolved = resolveTheme(pref, systemDark)
  const root = doc.documentElement
  for (const [k, v] of Object.entries(buildCssVars(resolved, accent))) root.style.setProperty(k, v)
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', PALETTES[resolved].bg)
  return resolved
}

/** WCAG relative-luminance contrast ratio between two #RRGGBB colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r = 0, g = 0, bl = 0] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
