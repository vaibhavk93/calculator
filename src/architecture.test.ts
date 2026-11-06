/**
 * Rules that keep the codebase honest, checked by machine.
 *
 *   1. Layering: engine <- lib <- store <- components <- features.
 *      The engine is pure TypeScript with no idea a UI exists; that is what makes
 *      the verified math portable to another framework, platform or product.
 *   2. Design system: the bans from docs/DESIGN-SYSTEM.md, as tests.
 *
 * `npm run build` runs this file first, so a violation fails the build.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)))

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const ALL = walk(SRC)
const isTest = (f: string) => /\.test\.tsx?$/.test(f)
const rel = (f: string) => relative(SRC, f).split(sep).join('/')
const read = (f: string) => readFileSync(f, 'utf8')

/** Drops comments so a word in a comment can't trip a rule. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

function importsOf(file: string): string[] {
  const code = stripComments(read(file))
  const out: string[] = []
  for (const m of code.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g)) out.push(m[1]!)
  return out
}

// ---------------------------------------------------------------- layering

type Layer = 'engine' | 'lib' | 'store' | 'components' | 'features'
const ALLOWED: Record<Layer, Layer[]> = {
  engine: ['engine'],
  lib: ['engine', 'lib'],
  store: ['engine', 'lib', 'store'],
  components: ['engine', 'lib', 'store', 'components'],
  features: ['engine', 'lib', 'store', 'components', 'features'],
}
const layerOf = (file: string): Layer | null => {
  const top = rel(file).split('/')[0]
  return top && top in ALLOWED ? (top as Layer) : null
}
const THIRD_PARTY_OK: Record<Layer, string[]> = {
  engine: ['decimal.js'],
  lib: ['decimal.js', 'loglevel', '@capacitor/core', '@capacitor/preferences', '@capacitor/local-notifications', '@capacitor/clipboard', '@capacitor/app', '@capacitor/status-bar', '@capacitor/share'],
  store: ['zustand', 'zustand/vanilla', 'decimal.js'],
  components: ['react', 'react-dom', 'zustand', 'react/jsx-runtime'],
  features: ['react', 'react-dom', 'zustand', 'react/jsx-runtime'],
}

describe('layering', () => {
  const layered = ALL.filter((f) => /\.tsx?$/.test(f) && layerOf(f))

  it('finds the source files it is meant to police', () => {
    expect(layered.length).toBeGreaterThan(10)
  })

  for (const file of layered) {
    const layer = layerOf(file)!
    it(`${rel(file)} only imports what ${layer} may`, () => {
      for (const spec of importsOf(file)) {
        if (spec.startsWith('.')) {
          const target = layerOf(resolve(dirname(file), spec) + '.ts') ?? layerOf(resolve(dirname(file), spec, 'index.ts'))
          // Relative paths that leave src/ entirely (e.g. fonts) are not layered code.
          if (!target) continue
          expect(ALLOWED[layer], `${rel(file)} imports "${spec}" (layer: ${target})`).toContain(target)
        } else if (/\.(css|woff2?)$/.test(spec)) {
          continue
        } else {
          // The test runner is allowed in test files only, never in shipped source.
          const allowed = isTest(file) ? [...THIRD_PARTY_OK[layer], 'vitest'] : THIRD_PARTY_OK[layer]
          const ok = allowed.some((p) => spec === p || spec.startsWith(p + '/'))
          expect(ok, `${rel(file)} imports "${spec}", not allowed in ${layer}`).toBe(true)
        }
      }
    })
  }

  it('the engine never touches the browser', () => {
    for (const file of ALL.filter((f) => layerOf(f) === 'engine' && !isTest(f))) {
      const code = stripComments(read(file))
      for (const banned of ['window', 'document', 'localStorage', 'navigator', 'fetch', 'setTimeout']) {
        expect(new RegExp(`\\b${banned}\\b`).test(code), `${rel(file)} uses ${banned}`).toBe(false)
      }
    }
  })
})

// ------------------------------------------------------------ design system

const STYLED = ALL.filter((f) => /\.(tsx?|css)$/.test(f) && !isTest(f) && rel(f) !== 'architecture.test.ts')
const CODE_FOR_DESIGN = (f: string) => stripComments(read(f))

describe('design system (docs/DESIGN-SYSTEM.md)', () => {
  it('has styled files to check', () => {
    // Guards against this suite silently passing because nothing was scanned.
    expect(STYLED.length).toBeGreaterThan(5)
  })

  it('raw colours live only in lib/theme.ts', () => {
    const offenders: string[] = []
    for (const f of STYLED) {
      if (rel(f) === 'lib/theme.ts') continue
      const hits = CODE_FOR_DESIGN(f).match(/#[0-9a-fA-F]{3,8}\b(?![\w-])/g)
      if (hits) offenders.push(`${rel(f)}: ${hits.slice(0, 3).join(', ')}`)
    }
    expect(offenders).toEqual([])
  })

  it('dates are formatted for India (DATE_LOCALE), never with the phone locale', () => {
    // Owner decision 2026-11-04: Indian first. See src/lib/dateLocale.ts.
    const bad = ALL.filter((f) => /\.tsx?$/.test(f) && !isTest(f)).filter((f) => /DateTimeFormat\(undefined|toLocale(Date|Time)?String\(\s*\)/.test(stripComments(read(f))))
    expect(bad.map(rel)).toEqual([])
  })

  it('border-radius is only 0 or one of the three tokens (4 / 10 / 20)', () => {
    const bad: string[] = []
    const token = /^(0|var\(--r-(?:sm|md|lg)\))$/
    for (const f of STYLED) {
      const code = CODE_FOR_DESIGN(f)
      const values = [
        ...[...code.matchAll(/border-radius\s*:\s*([^;}\n]+)/g)].map((m) => m[1]!),
        ...[...code.matchAll(/borderRadius\s*:\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]!),
      ]
      for (const v of values) {
        const parts = v.trim().replace(/\s*!important/, '').split(/\s+(?![^(]*\))/)
        if (!parts.every((p) => token.test(p))) bad.push(`${rel(f)}: ${v.trim()}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('no uppercase tracked eyebrows', () => {
    const bad = STYLED.filter((f) => /text-transform\s*:\s*uppercase|textTransform\s*:\s*['"`]uppercase/.test(CODE_FOR_DESIGN(f)))
    expect(bad.map(rel)).toEqual([])
  })

  it('letter-spacing is never positive', () => {
    const bad: string[] = []
    for (const f of STYLED) {
      for (const m of CODE_FOR_DESIGN(f).matchAll(/letter-spacing\s*:\s*(-?[\d.]+)/g)) {
        if (parseFloat(m[1]!) > 0) bad.push(`${rel(f)}: ${m[0]}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('no shadows, no gradients, no glass', () => {
    const bad: string[] = []
    for (const f of STYLED) {
      const code = CODE_FOR_DESIGN(f)
      if (/box-shadow\s*:\s*(?!none)/.test(code)) bad.push(`${rel(f)}: box-shadow`)
      if (/(?:linear|radial|conic)-gradient/.test(code)) bad.push(`${rel(f)}: gradient`)
      if (/backdrop-filter/.test(code)) bad.push(`${rel(f)}: backdrop-filter`)
    }
    expect(bad).toEqual([])
  })

  it('every full-screen header is the shared ScreenHeader (docs/DESIGN-SYSTEM.md, Page anatomy)', () => {
    const own = ALL.filter((f) => /\.tsx$/.test(f) && !isTest(f) && rel(f) !== 'components/ScreenHeader.tsx' && /screen__bar/.test(read(f)))
    expect(own.map(rel)).toEqual([])
  })

  it('no coloured side-stripe borders', () => {
    const bad: string[] = []
    for (const f of STYLED) {
      for (const m of CODE_FOR_DESIGN(f).matchAll(/border-(?:left|right)\s*:\s*(\d+)px/g)) {
        if (parseInt(m[1]!, 10) > 1) bad.push(`${rel(f)}: ${m[0]}`)
      }
    }
    expect(bad).toEqual([])
  })
})

// ---------------------------------------------------------------- budget totals (docs/BUDGET-PLAN.md, money in)

describe('spend totals go through countsAsSpend (lib/budget.ts)', () => {
  const SRC_FILES = ALL.filter((f) => /\.tsx?$/.test(f) && !isTest(f))

  // A new total that skips only `settlement` would count money that came in as spending. Ask the helper instead.
  it('nothing outside lib/budget.ts filters entries with `!x.settlement`', () => {
    const bad: string[] = []
    for (const f of SRC_FILES) {
      if (rel(f) === 'lib/budget.ts') continue
      for (const m of stripComments(read(f)).matchAll(/!\s*[\w.?]+\.settlement\b(?!\s*[=!]==)/g)) bad.push(`${rel(f)}: ${m[0]}`)
    }
    expect(bad).toEqual([])
  })

  // Reading the `income` flag is for deciding what an entry IS (sheet, list row, CSV, saving, loading), not for totals.
  const MAY_READ_INCOME = ['lib/budget.ts', 'lib/csv.ts', 'lib/smsParse.ts', 'store/app.ts', 'store/persistence.ts', 'features/budget/sheets.tsx', 'features/budget/SpendSummary.tsx']
  it("only the known files read an entry's `.income` flag", () => {
    const bad = SRC_FILES.filter((f) => /\be\.income\b|\bexpense\??\.income\b|\bx\.income\b|\bd\.income\b/.test(stripComments(read(f))) && !MAY_READ_INCOME.includes(rel(f)))
    expect(bad.map(rel)).toEqual([])
  })
})

// ---------------------------------------------------------------- modules on/off (docs/THE-PLAN.md, Phase 7)

describe('"Show in the app" switches are read through lib/modules.ts only', () => {
  // A screen that read `settings.modules` itself would hide a tab in one place and forget another.
  // Only the helper, the store (sanitiser, defaults, types) and the tests may mention the field.
  it('no component, feature or App.tsx reads `.modules` or `modules:` directly', () => {
    const screens = ALL.filter((f) => /\.tsx?$/.test(f) && !isTest(f) && (['components', 'features'].includes(rel(f).split('/')[0]!) || rel(f) === 'App.tsx'))
    const bad = screens.filter((f) => /\.modules\b|\bmodules\s*:/.test(stripComments(read(f))))
    expect(bad.map(rel)).toEqual([])
  })
})
