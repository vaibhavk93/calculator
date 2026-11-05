// B13: the tool answer is a bare hero above the result card. Opens EVERY tool at its starting values and checks the hero
// at three sizes: 360x790, 360x790 at 200% font, and 360x640. Run:  node e2e/tool-hero.test.mjs   (SHOTS=dir to keep screenshots)
// Checks per tool: nothing overflows the page sideways, the hero value is not clipped (one line for numbers, wraps for words),
// the hero is the first thing in the result, a number never wraps mid-number, and the floating answer bar is idle while the hero is on screen.
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { startApp, openApp, tab, overflowing } from './lib.mjs'

const SRC = new URL('../src/features/tools/', import.meta.url).pathname
const SPECS = []
for (const f of readdirSync(SRC).filter((n) => /^(everyday|invest|loans|metrics|planning|tax)\.ts$/.test(n))) {
  for (const block of readFileSync(SRC + f, 'utf8').split(/^const \w+Spec: ToolSpec = \{/m).slice(1)) {
    const id = /\n\s+id: '([^']+)'/.exec(block)?.[1]
    const title = /\n\s+title: '([^']+)'/.exec(block)?.[1]
    if (id && title) SPECS.push({ id, title: title.replace(/\\'/g, "'") })
  }
}

const CONFIGS = [
  { label: '360x790', width: 360, height: 790, font: 100 },
  { label: '360x790@200%', width: 360, height: 790, font: 200 },
  { label: '360x640', width: 360, height: 640, font: 100 },
]
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

let pass = 0
let fail = 0
const stats = { hero: 0, text: 0, none: 0, noResult: 0 }
const say = (ok, id, title, actual = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${title}${ok ? '' : ` :: ${actual}`}`)
  ok ? pass++ : fail++
}

async function measure(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const body = q('.screen__body')
    const hero = q('.result__row--main')
    const rows = [...document.querySelectorAll('section.result .result__row')]
    const bad = []
    // Nothing in the result may be wider than its box (clipped or scrolling) except where the design says a huge number scrolls.
    for (const el of document.querySelectorAll('section.result .result__label, section.result .result__value, .hero__value')) {
      if (el.scrollWidth > el.clientWidth + 1) bad.push(`${el.className.split(' ')[0]} "${el.textContent.slice(0, 30)}" ${el.scrollWidth}>${el.clientWidth}`)
    }
    const hv = q('.hero__value')
    const isText = hv?.classList.contains('hero__value--text')
    const lh = hv ? parseFloat(getComputedStyle(hv).lineHeight) : 0
    const bar = q('.answer')
    const hr = hero?.getBoundingClientRect()
    const br = body.getBoundingClientRect()
    const heroSeen = hr ? (hr.top >= br.top && hr.bottom <= br.bottom ? 'all' : hr.bottom <= br.top || hr.top >= br.bottom ? 'none' : 'part') : null
    return {
      hasResult: !!q('section.result'),
      hasHero: !!hero,
      isText,
      label: hero?.querySelector('.result__label')?.textContent ?? '',
      value: hv?.textContent ?? '',
      size: hv ? parseFloat(getComputedStyle(hv).fontSize) : 0,
      lines: hv && lh ? Math.round(hv.getBoundingClientRect().height / lh) : 0,
      heroFirst: hero ? rows[0] === hero : null,
      heroTop: hero ? hero.getBoundingClientRect().top : null,
      heroInBox: hero ? hero.getBoundingClientRect().left >= body.getBoundingClientRect().left - 1 && hero.getBoundingClientRect().right <= body.getBoundingClientRect().right + 1 : null,
      heroBorder: hero ? getComputedStyle(hero).borderBottomWidth : null,
      heroBg: hero ? getComputedStyle(hero).backgroundColor : null,
      barIdle: bar ? bar.classList.contains('answer--idle') : null,
      heroSeen,
      hasUnit: !!hv?.querySelector('.result__unit'),
      bad,
    }
  })
}

async function run() {
  const app = await startApp()
  const shots = process.env.SHOTS
  if (shots) mkdirSync(shots, { recursive: true })
  try {
    for (const cfg of CONFIGS) {
      const { page, errors, close } = await openApp(app, { theme: 'dark', width: cfg.width, height: cfg.height, font: cfg.font })
      for (const s of SPECS) {
        const id = `HERO-${s.id}@${cfg.label}`
        try {
          await tab(page, 'Tools')
          await page.locator('.tools__search input').fill(s.title)
          await page.locator('.navrow .navrow__label').filter({ hasText: new RegExp('^\\s*' + esc(s.title) + '\\s*$') }).first().click()
          await page.waitForSelector('.tool')
          await settle(page)
          await page.waitForTimeout(260) // the screen slides in over 220 ms
          const m = await measure(page)
          const wide = await overflowing(page)
          if (cfg.label === CONFIGS[0].label && !m.hasResult) stats.noResult++
          if (cfg.label === CONFIGS[0].label && m.hasResult) { m.hasHero ? (m.isText ? stats.text++ : stats.hero++) : stats.none++ }
          say(wide.length === 0, id, 'no sideways overflow', wide.join('; '))
          if (m.hasResult) {
            say(m.bad.length === 0, id, 'no clipped result text', m.bad.join('; '))
            if (m.hasHero) {
              say(m.heroFirst === true && m.heroInBox, id, 'the hero is the first result and inside the page', `first=${m.heroFirst} inBox=${m.heroInBox}`)
              say(m.heroBorder === '0px' && m.heroBg === 'rgba(0, 0, 0, 0)', id, 'the hero has no border and no fill', `${m.heroBorder} ${m.heroBg}`)
              say(m.isText ? m.size >= 20 * (cfg.font / 100) * 0.99 : (m.hasUnit ? m.lines <= 2 : m.lines === 1) && m.size >= 16 * (cfg.font / 100) * 0.99, id, m.isText ? 'text hero is a readable size' : 'number hero is one line and not below 1rem', `size=${m.size} lines=${m.lines} "${m.value}"`)
              say(m.heroSeen === 'part' || m.barIdle === (m.heroSeen === 'all'), id, 'answer bar is hidden while the hero is on screen and shown when it is not', `hero=${m.heroSeen} barIdle=${m.barIdle}`)
            }
          }
          if (shots && ['emi', 'sip', 'income-tax', 'unit-converter', 'arr-mrr'].includes(s.id)) await page.screenshot({ path: `${shots}/${s.id}-${cfg.label.replace('@', '-').replace('%', 'pct')}.png` })
          console.log(`  info ${id} hero=${m.hasHero ? (m.isText ? 'text' : 'number') : m.hasResult ? 'none' : 'no result'} size=${m.size} label=${m.label.length} "${m.value.slice(0, 24)}"`)
        } catch (e) {
          say(false, id, 'opens', String(e.message).split('\n')[0])
        }
      }
      say(errors.length === 0, `HERO-errors@${cfg.label}`, 'no console errors', errors.slice(0, 2).join(' | '))
      await close()
    }
    // B20: the unit converter has a swap between From and To, and its answer carries the unit.
    {
      const { page, close } = await openApp(app, { theme: 'dark' })
      await tab(page, 'Tools')
      await page.locator('.tools__search input').fill('Unit converter')
      await page.locator('.navrow .navrow__label').filter({ hasText: /^\s*Unit converter\s*$/ }).first().click()
      await page.waitForSelector('.tool')
      const hero = () => page.locator('.hero__value').innerText()
      say(/^0\.6213711922\s+Mile$/.test((await hero()).trim()), 'SWAP-1', 'the answer shows its unit', await hero())
      const swap = page.getByRole('button', { name: 'Swap from and to' })
      say((await swap.count()) === 1 && (await swap.boundingBox()).height >= 44 && (await swap.boundingBox()).width >= 44, 'SWAP-2', 'one swap button, at least 44px')
      await swap.click()
      await settle(page)
      say(/^1\.609344\s+Kilometre$/.test((await hero()).trim()), 'SWAP-3', 'swapping turns km to mile into mile to km', await hero())
      await swap.click()
      await settle(page)
      say(/^0\.6213711922\s+Mile$/.test((await hero()).trim()), 'SWAP-4', 'swapping twice gets back', await hero())
      await close()
    }
  } finally {
    await app.stop()
  }
  console.log(`\n${pass} passed, ${fail} failed. At 360x790: ${stats.hero} number heroes, ${stats.text} text heroes, ${stats.none} results with no single main row, ${stats.noResult} tools with no result at their starting values.`)
  process.exit(fail ? 1 : 0)
}
run()
