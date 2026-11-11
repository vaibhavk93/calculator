/**
 * Portfolio rules that can only be checked by reading the source (they need the file system, so this sits at the src root
 * like architecture.test.ts). The behaviour tests are in store/portfolio.test.ts and lib/qa-privacy-portfolio.test.ts.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)))
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8')
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]))
const sources = walk(SRC).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))

describe('Portfolio lives inside Budget, nowhere else', () => {
  it('only BudgetScreen.tsx imports PortfolioScreen, so the page hides with the Budget tab', () => {
    const importers = sources.filter((f) => /from\s+['"][^'"]*PortfolioScreen['"]/.test(readFileSync(f, 'utf8')))
    expect(importers.map((f) => f.split('/').pop())).toEqual(['BudgetScreen.tsx'])
  })
  it('the Budget tab is only rendered when it is on (the tab falls back to Calculate when Budget is off), so its Portfolio row goes with it', () => {
    expect(read('App.tsx')).toMatch(/tab === 'budget' && <BudgetScreen/)
  })
  it('net worth is the "Net worth" side of the Budget home switch, shown in the empty state too; there is no separate Portfolio page or row', () => {
    const budget = read('features/budget/BudgetScreen.tsx')
    expect(budget).toMatch(/\{ value: 'networth', label: 'Net worth' \}/)
    expect(budget).toMatch(/<PortfolioView hidden=\{hidden\} \/>/)
    expect(budget).not.toMatch(/'Portfolio'|>Portfolio</)
  })
})

describe('Portfolio privacy: the code that sends things out never mentions it', () => {
  it.each(['lib/csv.ts', 'features/budget/ExportSheet.tsx', 'lib/notifications.ts', 'lib/reminders.ts', 'lib/share.ts', 'lib/shareText.ts', 'lib/smsParse.ts', 'lib/delivery.ts', 'lib/historyText.ts'])('%s', (f) => {
    expect(read(f).toLowerCase()).not.toMatch(/portfolio|holding/)
  })
  it('the portfolio files never import the logger or touch storage on their own', () => {
    for (const f of ['lib/portfolio.ts', 'engine/investments/portfolio.ts', 'features/budget/PortfolioScreen.tsx']) {
      expect(read(f), f).not.toMatch(/logger|loglevel|localStorage|sessionStorage|Preferences|console\./)
    }
  })
  it('the logger writes only to the console, never to storage (so a trace can never reach a backup)', () => {
    expect(read('lib/logger.ts')).not.toMatch(/localStorage|sessionStorage|setItem/)
  })
})

describe('Hide amounts is local to Budget home', () => {
  it('is plain component state that starts hidden, and the stored types and sanitisers know nothing about it', () => {
    expect(read('features/budget/BudgetScreen.tsx')).toMatch(/const \[hidden, setHidden\] = useState\(true\)/)
    for (const f of ['store/types.ts', 'store/persistence.ts', 'lib/portfolio.ts', 'store/app.ts']) expect(read(f)).not.toMatch(/hideAmounts|amountsHidden/)
  })
})
