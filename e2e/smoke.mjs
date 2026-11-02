/**
 * Browser smoke test: drives the built app in real Chromium and checks the
 * behaviour a user would see. Not part of `npm test` (it needs a running server
 * and Playwright); run it before a release and after any UI change.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   node e2e/smoke.mjs                      # screenshots go to e2e/shots/
 *   BASE_URL=http://localhost:5173 node e2e/smoke.mjs
 *
 * Needs `playwright` resolvable (npm i -D playwright, or a global install).
 */
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/'
const SHOTS = process.env.SHOTS_DIR ?? join(dirname(fileURLToPath(import.meta.url)), 'shots')
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${detail}]` : ''}`)
}

const browser = await chromium.launch()
const errors = []

async function newPage(opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    colorScheme: 'dark',
    ...opts,
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
  await page.goto(BASE)
  await page.waitForSelector('.keypad')
  return { page, ctx }
}

const text = (page, sel) => page.locator(sel).first().innerText()
const key = (page, name) => page.getByRole('button', { name, exact: true }).first()
async function tapKeys(page, names) {
  for (const n of names) await key(page, n).tap()
}
const digits = (s) => [...s].map((c) => (c === '.' ? 'Decimal point' : c))
const shot = (page, name) => page.screenshot({ path: join(SHOTS, `${name}.png`), animations: 'disabled' })

// --------------------------------------------------------------------------
{
  const { page, ctx } = await newPage()
  await page.waitForSelector('.display__result')

  check('opens on the calculator with 0', (await text(page, '.display__result')).trim() === '0')

  // Touch taps through the keypad.
  await tapKeys(page, [...digits('18450'), 'Add', ...digits('7200'), 'Add', ...digits('32000')])
  check('live preview while typing', (await text(page, '.display__result')) === '57,650', await text(page, '.display__result'))
  check('expression is grouped in the Indian system as you type', (await text(page, '.display__expr')) === '18,450 + 7,200 + 32,000')
  await shot(page, '01-dark-typing')

  await key(page, 'Equals').tap()
  check('equals keeps the result', (await text(page, '.display__result')) === '57,650')
  check('and shows what made it', (await text(page, '.display__expr')) === '18,450 + 7,200 + 32,000 =')

  // The exact expression from the ClevCalc screenshot, via the hardware keyboard.
  await key(page, 'Clear').tap()
  await page.keyboard.type('((1630*645+493436+229168-(327075+5085)))+147000+48*1634')
  await page.keyboard.press('Enter')
  check('ClevCalc screenshot expression = 16,67,226', (await text(page, '.display__result')) === '16,67,226', await text(page, '.display__result'))
  check('result is echoed in words', (await text(page, '.display__note')) === '16.67 lakh', await text(page, '.display__note'))
  await shot(page, '02-dark-result')

  // Percent semantics.
  await key(page, 'Clear').tap()
  await page.keyboard.type('200+10%')
  check('200 + 10% = 220', (await text(page, '.display__result')) === '220')

  // Errors in plain words.
  await key(page, 'Clear').tap()
  await page.keyboard.type('5/0')
  await page.keyboard.press('Enter')
  check("5 ÷ 0 says \"Can't divide by zero\"", (await text(page, '.display__note')) === "Can't divide by zero")

  // Undo brings back what Clear removed.
  await key(page, 'Clear').tap()
  await page.getByRole('button', { name: 'Undo' }).tap()
  check('undo restores a cleared expression', (await text(page, '.display__expr')).includes('5'))

  // Scientific.
  await key(page, 'Clear').tap()
  await page.getByRole('button', { name: 'Scientific functions' }).tap()
  await key(page, 'Sine').tap()
  await tapKeys(page, ['3', '0'])
  check('sin(30°) = 0.5 (degrees by default)', (await text(page, '.display__result')) === '0.5', await text(page, '.display__result'))
  await shot(page, '03-dark-scientific')
  await page.getByRole('button', { name: /switch to radians/i }).tap()
  check('angle toggle flips to radians', (await page.getByRole('button', { name: /in radians/i }).count()) === 1)
  await page.getByRole('button', { name: /switch to degrees/i }).tap()
  await page.getByRole('button', { name: 'Scientific functions' }).tap()

  // Memory panel.
  await key(page, 'Clear').tap()
  await tapKeys(page, ['5', '0'])
  await page.getByRole('button', { name: 'Memory and clipboard' }).tap()
  await page.getByRole('button', { name: 'Add to memory' }).tap()
  check('M+ stores the value and shows it', (await text(page, '.display__memory')) === 'M 50', await text(page, '.display__memory'))
  await shot(page, '04-dark-more-panel')
  await page.getByRole('button', { name: 'Memory and clipboard' }).tap()

  // Long numbers: one that can fit shrinks to fit; one that physically can't scrolls, newest digits in view.
  await key(page, 'Clear').tap()
  for (let i = 0; i < 2; i++) await tapKeys(page, ['9', '8', '7', '6', '5', '4', '3'])
  const mid = await page.evaluate(() => {
    const r = document.querySelector('.display__result')
    return { size: parseFloat(getComputedStyle(r).fontSize), fits: r.scrollWidth <= r.clientWidth + 1 }
  })
  check('14 digits shrink to fit on one line', mid.fits && mid.size < 52, JSON.stringify(mid))
  for (let i = 0; i < 10; i++) await key(page, String(i % 10)).tap()
  const huge = await page.evaluate(() => {
    const r = document.querySelector('.display__result')
    return {
      size: parseFloat(getComputedStyle(r).fontSize),
      scrolled: r.scrollWidth > r.clientWidth,
      atEnd: Math.abs(r.scrollLeft + r.clientWidth - r.scrollWidth) <= 2,
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
    }
  })
  check('24 digits stop at the minimum size, scroll, and keep the newest digits in view', huge.size === 24 && huge.scrolled && huge.atEnd && !huge.pageOverflow, JSON.stringify(huge))
  await shot(page, '05-dark-long-number')

  // Regression: a tapped utility button keeps focus; Enter must still mean "=", not re-press it.
  await key(page, 'Clear').tap()
  await page.keyboard.type('6*7')
  await page.getByRole('button', { name: 'Undo' }).tap()
  await page.keyboard.type('7')
  await page.keyboard.press('Enter')
  check('Enter after tapping Undo still evaluates (does not re-press Undo)', (await text(page, '.display__result')) === '42', await text(page, '.display__result'))

  // Holding backspace repeats.
  await key(page, 'Clear').tap()
  await tapKeys(page, digits('1234567890123456'))
  const before = (await text(page, '.display__result')).replace(/,/g, '').length
  const bs = page.getByRole('button', { name: 'Backspace' })
  const box = await bs.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(900)
  await page.mouse.up()
  const after = (await text(page, '.display__result')).replace(/,/g, '').length
  check('holding backspace repeats', before - after >= 4, `${before} -> ${after} digits`)

  // ---- History
  await key(page, 'Clear').tap()
  await page.keyboard.type('2*3+4')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'History' }).tap()
  await page.waitForSelector('.sheet')
  const rows = await page.locator('.hrow').count()
  check('history lists finished calculations, newest first', rows >= 3 && (await text(page, '.hrow .hrow__result')) === '10', `${rows} rows`)
  await shot(page, '06-dark-history')

  // Delete -> snackbar -> undo
  const firstExpr = await text(page, '.hrow .hrow__expr')
  await page.locator('.hrow').first().getByRole('button', { name: /^Delete/ }).tap()
  check('deleting shows an Undo bar', (await page.locator('.snack').count()) === 1)
  check('and the row is gone', (await text(page, '.hrow .hrow__expr')) !== firstExpr)
  await shot(page, '07-dark-history-undo')
  await page.locator('.snack').getByRole('button', { name: 'Undo' }).tap()
  check('Undo puts it back where it was', (await text(page, '.hrow .hrow__expr')) === firstExpr)

  // Clear all needs the word CLEAR.
  await page.getByRole('button', { name: 'Clear all' }).tap()
  const confirm = page.getByRole('button', { name: 'Clear history' })
  check('"Clear history" is disabled until CLEAR is typed', await confirm.isDisabled())
  await page.getByLabel('Type CLEAR to confirm').fill('clear')
  check('and enabled once it is (any case)', await confirm.isEnabled())
  await shot(page, '08-dark-clear-confirm')
  await confirm.tap()
  check('clearing empties the list but offers Undo', (await page.locator('.hrow').count()) === 0 && (await page.locator('.snack').count()) === 1)
  await page.locator('.snack').getByRole('button', { name: 'Undo' }).tap()
  check('Undo after clear-all restores everything', (await page.locator('.hrow').count()) === rows, `${await page.locator('.hrow').count()} / ${rows}`)

  // Reuse a result
  await page.keyboard.press('Escape')
  await page.waitForSelector('.sheet', { state: 'detached' })
  check('Escape closes the sheet', (await page.locator('.sheet').count()) === 0)

  // ---- Tabs
  for (const [tab, title] of [['Tools', 'More calculators are coming'], ['Saved', 'Nothing saved yet'], ['Due', 'No reminders yet']]) {
    await page.getByRole('navigation').getByRole('button', { name: tab }).tap()
    check(`${tab} tab shows an honest empty state`, (await text(page, '.empty h1')) === title)
    await shot(page, `09-dark-${tab.toLowerCase()}`)
  }
  await page.getByRole('navigation').getByRole('button', { name: 'Calculate' }).tap()

  // ---- Settings
  await page.getByRole('button', { name: 'Settings' }).tap()
  await page.waitForSelector('.screen')
  await shot(page, '10-dark-settings')
  await page.getByRole('radio', { name: 'International' }).tap()
  await page.getByRole('radio', { name: 'Sky' }).tap()
  await page.getByLabel('Decimal places').selectOption('2')
  await page.evaluate(() => document.querySelector('.screen__body').scrollTo(0, 9999))
  await shot(page, '11-dark-settings-bottom')
  await page.getByRole('button', { name: 'Back', exact: true }).tap()
  await key(page, 'Clear').tap()
  await page.keyboard.type('1234567+1')
  check('international grouping + 2 decimals apply immediately', (await text(page, '.display__result')) === '1,234,568.00', await text(page, '.display__result'))
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-fill').trim())
  check('accent changed to Sky', accent.toUpperCase() === '#8ED5FE', accent)

  // ---- Persistence across a reload
  await page.waitForTimeout(500)
  await page.reload()
  await page.waitForSelector('.keypad')
  check('the expression survives a reload', (await text(page, '.display__result')) === '1,234,568.00', await text(page, '.display__result'))
  await page.getByRole('button', { name: 'History' }).tap()
  check('history survives a reload', (await page.locator('.hrow').count()) === rows)
  await page.keyboard.press('Escape')

  // ---- Light theme
  await page.getByRole('button', { name: 'Settings' }).tap()
  await page.getByRole('radio', { name: 'Light' }).tap()
  await page.getByRole('radio', { name: 'Citron' }).tap()
  await page.getByLabel('Decimal places').selectOption('auto')
  await page.getByRole('radio', { name: 'Indian' }).tap()
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())
  check('light theme applies', bg.toUpperCase() === '#FFFFFF' && (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light', bg)
  await shot(page, '12-light-settings')
  await page.getByRole('button', { name: 'Back', exact: true }).tap()
  await key(page, 'Clear').tap()
  await page.keyboard.type('18450+7200+32000')
  await shot(page, '13-light-typing')
  await page.getByRole('button', { name: 'Scientific functions' }).tap()
  await shot(page, '14-light-scientific')
  await page.getByRole('button', { name: 'Scientific functions' }).tap()
  await key(page, 'Equals').tap()
  await page.getByRole('button', { name: 'History' }).tap()
  await shot(page, '15-light-history')
  await page.keyboard.press('Escape')

  // ---- Touch targets
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, [role=radio], [role=switch], select, input')]
      .filter((el) => el.offsetParent !== null && !el.classList.contains('sr-only'))
      .map((el) => {
        const r = el.getBoundingClientRect()
        return { label: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }
      })
      .filter((b) => b.w < 44 && b.h < 44),
  )
  check('every visible control on the calculator is at least 44px in one direction', small.length === 0, JSON.stringify(small))

  await ctx.close()
}

// --------------------------------------------------------------------------
// A small phone with the scientific panel open: the result must still be visible.
{
  const { page, ctx } = await newPage({ viewport: { width: 360, height: 640 } })
  await page.keyboard.type('18450+7200')
  await page.getByRole('button', { name: 'Scientific functions' }).tap()
  const geo = await page.evaluate(() => {
    const d = document.querySelector('.display').getBoundingClientRect()
    const el = document.querySelector('.display__result')
    const r = el.getBoundingClientRect()
    const k = document.querySelector('.keypad').getBoundingClientRect()
    return {
      displayH: Math.round(d.height),
      // The box being inside the display is not enough: the digits inside must not be sliced.
      glyphsClipped: el.scrollHeight > el.clientHeight + 1,
      resultInside: r.top >= d.top - 1 && r.bottom <= d.bottom + 1,
      keypadBottomInView: k.bottom <= innerHeight,
      overflow: document.documentElement.scrollHeight > innerHeight,
    }
  })
  check('360x640 with scientific panel: result whole and visible, keypad on screen, no page scroll',
    !geo.glyphsClipped && geo.resultInside && geo.keypadBottomInView && !geo.overflow && geo.displayH >= 70, JSON.stringify(geo))
  await shot(page, '16-small-phone-scientific')
  await ctx.close()
}

// A typical modern Android (360x800) with the scientific panel open keeps the expression visible.
{
  const { page, ctx } = await newPage({ viewport: { width: 360, height: 800 } })
  await page.keyboard.type('18450+7200')
  await page.getByRole('button', { name: 'Scientific functions' }).tap()
  const vis = await page.evaluate(() => {
    const e = document.querySelector('.display__expr')
    return { exprVisible: getComputedStyle(e).visibility === 'visible' && e.clientHeight > 20, text: e.textContent }
  })
  check('360x800 with scientific panel: expression and result both visible', vis.exprVisible && vis.text.includes('18,450'), JSON.stringify(vis))
  await shot(page, '16b-typical-android-scientific')
  await ctx.close()
}

// On the smallest screen the expression yields cleanly instead of showing as a sliver.
{
  const { page, ctx } = await newPage({ viewport: { width: 360, height: 640 } })
  await page.keyboard.type('18450+7200')
  await page.getByRole('button', { name: 'Scientific functions' }).tap()
  await page.waitForTimeout(150) // ResizeObserver reports at the next frame, not synchronously
  const e = await page.evaluate(() => {
    const el = document.querySelector('.display__expr')
    const lh = parseFloat(getComputedStyle(el).lineHeight)
    const hidden = getComputedStyle(el).visibility === 'hidden'
    return { hidden, partial: !hidden && el.clientHeight < lh - 1, h: el.clientHeight, lh }
  })
  check('360x640: expression is whole or hidden, never a sliver', !e.partial, JSON.stringify(e))
  await ctx.close()
}

// Phone font size set to maximum (rem-based type should scale, layout must hold).
{
  const { page, ctx } = await newPage()
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  await page.keyboard.type('18450+7200+32000')
  const geo = await page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > innerWidth,
    tabLabelsClipped: [...document.querySelectorAll('.tab span')].some((s) => s.scrollWidth > s.clientWidth + 1),
  }))
  check('200% font size: no sideways scroll', !geo.overflowX, JSON.stringify(geo))
  await shot(page, '17-dark-200pct-font')
  await ctx.close()
}

// Reduced motion is honoured.
{
  const { page, ctx } = await newPage({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'History' }).tap()
  const dur = await page.evaluate(() => getComputedStyle(document.querySelector('.sheet')).animationDuration)
  check('prefers-reduced-motion shortens animations', parseFloat(dur) <= 0.01, dur)
  await ctx.close()
}

// Desktop viewport: the app stays a phone-width column.
{
  const { page, ctx } = await newPage({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false })
  const w = await page.evaluate(() => document.querySelector('.app').getBoundingClientRect().width)
  check('on desktop the app stays a centred column', w <= 480, `${w}px`)
  await shot(page, '18-desktop')
  await ctx.close()
}

// --------------------------------------------------------------------------
// Landscape: a phone on its side is ~360px tall. Two panes, a rail instead of a bottom bar.
// A .toggle is drawn 24px tall; its ::before layer (inset -10px) makes the tap target 44px,
// which getBoundingClientRect cannot see, so toggles are checked by that CSS rule instead.
const smallTargets = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('button, [role=radio], [role=switch], select, input')]
      .filter((el) => el.offsetParent !== null && !el.classList.contains('sr-only') && !el.classList.contains('toggle'))
      .map((el) => {
        const r = el.getBoundingClientRect()
        return { label: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }
      })
      .filter((b) => b.w < 44 && b.h < 44),
  )
const noScroll = (page) =>
  page.evaluate(() => ({
    x: document.documentElement.scrollWidth > innerWidth,
    y: document.documentElement.scrollHeight > innerHeight,
  }))

for (const [w, h] of [
  [800, 360],
  [640, 360],
]) {
  const tag = `${w}x${h}`
  const { page, ctx } = await newPage({ viewport: { width: w, height: h } })

  // Touch calculation works on its side.
  await tapKeys(page, [...digits('18450'), 'Add', ...digits('7200'), 'Add', ...digits('32000')])
  check(`${tag} landscape: typing by touch gives the live result`, (await text(page, '.display__result')) === '57,650')

  const geo = await page.evaluate(() => {
    const r = (sel) => document.querySelector(sel).getBoundingClientRect()
    const nav = r('.tabbar')
    const disp = r('.display')
    const pad = r('.keypad')
    const res = document.querySelector('.display__result')
    const rr = res.getBoundingClientRect()
    return {
      railVertical: nav.height >= innerHeight - 1 && nav.width <= 80 && nav.left <= 1,
      keypadRightOfDisplay: pad.left >= disp.right - 1,
      keypadInView: pad.top >= 0 && pad.bottom <= innerHeight + 0.5 && pad.right <= innerWidth + 0.5,
      resultWhole: res.scrollHeight <= res.clientHeight + 1 && rr.bottom <= disp.bottom + 1 && rr.top >= disp.top - 1,
      tabsFit: [...document.querySelectorAll('.tab')].every((t) => t.getBoundingClientRect().bottom <= innerHeight + 0.5),
    }
  })
  check(`${tag} landscape: tab rail on the left, keypad on the right, result whole`, Object.values(geo).every(Boolean), JSON.stringify(geo))
  check(`${tag} landscape: no page scroll`, JSON.stringify(await noScroll(page)) === '{"x":false,"y":false}', JSON.stringify(await noScroll(page)))
  check(`${tag} landscape: every control at least 44px in one direction`, (await smallTargets(page)).length === 0, JSON.stringify(await smallTargets(page)))
  await shot(page, `19-landscape-${tag}-typing`)

  // Scientific panel: the tightest case.
  await page.getByRole('button', { name: 'Scientific functions' }).tap()
  await page.waitForTimeout(200)
  const sci = await page.evaluate(() => {
    const d = document.querySelector('.display').getBoundingClientRect()
    const res = document.querySelector('.display__result')
    const rr = res.getBoundingClientRect()
    const p = document.querySelector('.panel').getBoundingClientRect()
    const k = document.querySelector('.keypad').getBoundingClientRect()
    return {
      displayH: Math.round(d.height),
      resultWhole: res.scrollHeight <= res.clientHeight + 1 && rr.bottom <= d.bottom + 1 && rr.top >= d.top - 1,
      panelInView: p.bottom <= innerHeight + 0.5,
      keypadInView: k.bottom <= innerHeight + 0.5,
      noOverflow: document.documentElement.scrollHeight <= innerHeight,
    }
  })
  check(`${tag} landscape + scientific panel: result whole, panel and keypad on screen`,
    sci.resultWhole && sci.panelInView && sci.keypadInView && sci.noOverflow && sci.displayH >= 70, JSON.stringify(sci))
  check(`${tag} landscape + scientific panel: controls still 44px`, (await smallTargets(page)).length === 0, JSON.stringify(await smallTargets(page)))
  await shot(page, `20-landscape-${tag}-scientific`)
  await page.getByRole('button', { name: 'Scientific functions' }).tap()

  // Memory panel.
  await page.getByRole('button', { name: 'Memory and clipboard' }).tap()
  await page.waitForTimeout(200)
  const more = await page.evaluate(() => ({
    panelInView: document.querySelector('.panel').getBoundingClientRect().bottom <= innerHeight + 0.5,
    noOverflow: document.documentElement.scrollHeight <= innerHeight,
  }))
  check(`${tag} landscape + memory panel fits`, more.panelInView && more.noOverflow, JSON.stringify(more))
  check(`${tag} landscape + memory panel: controls still 44px`, (await smallTargets(page)).length === 0, JSON.stringify(await smallTargets(page)))
  await shot(page, `21-landscape-${tag}-memory`)
  await page.getByRole('button', { name: 'Memory and clipboard' }).tap()

  // History opens as a side panel, and its Undo bar stays inside that panel's width.
  await key(page, 'Equals').tap()
  await page.getByRole('button', { name: 'History' }).tap()
  await page.waitForSelector('.sheet')
  await page.waitForTimeout(350)
  const sheet = await page.evaluate(() => {
    const s = document.querySelector('.sheet').getBoundingClientRect()
    return { right: Math.round(s.right), width: Math.round(s.width), top: Math.round(s.top), bottom: Math.round(s.bottom), vw: innerWidth, vh: innerHeight }
  })
  check(`${tag} landscape: history is a full-height side panel on the right`,
    sheet.right === sheet.vw && sheet.top === 0 && sheet.bottom === sheet.vh && sheet.width <= 440, JSON.stringify(sheet))
  check(`${tag} landscape: history controls are 44px`, (await smallTargets(page)).length === 0, JSON.stringify(await smallTargets(page)))
  await shot(page, `22-landscape-${tag}-history`)
  await page.locator('.hrow').first().getByRole('button', { name: /^Delete/ }).tap()
  await page.waitForTimeout(300) // let the 160ms slide-in finish: mid-animation it sits 12px low
  const snack = await page.evaluate(() => {
    const n = document.querySelector('.snack').getBoundingClientRect()
    const s = document.querySelector('.sheet').getBoundingClientRect()
    return { snackLeft: Math.round(n.left), sheetLeft: Math.round(s.left), snackRight: Math.round(n.right), vw: innerWidth, bottom: Math.round(n.bottom), vh: innerHeight }
  })
  check(`${tag} landscape: the Undo bar sits under the history panel, inside the screen`,
    snack.snackLeft >= snack.sheetLeft - 1 && snack.snackRight <= snack.vw + 0.5 && snack.bottom <= snack.vh + 0.5, JSON.stringify(snack))
  await shot(page, `23-landscape-${tag}-undo`)
  await page.locator('.snack').getByRole('button', { name: 'Undo' }).tap()
  check(`${tag} landscape: Undo restores the deleted row`, (await page.locator('.hrow').count()) === 1)
  await page.keyboard.press('Escape')
  await page.waitForSelector('.sheet', { state: 'detached' })

  // Settings and an empty tab.
  await page.getByRole('button', { name: 'Settings' }).tap()
  await page.waitForSelector('.screen')
  await page.waitForTimeout(300)
  check(`${tag} landscape: settings has no sideways scroll`, !(await noScroll(page)).x, JSON.stringify(await noScroll(page)))
  check(`${tag} landscape: settings controls are 44px`, (await smallTargets(page)).length === 0, JSON.stringify(await smallTargets(page)))
  await shot(page, `24-landscape-${tag}-settings`)
  await page.getByRole('button', { name: 'Back', exact: true }).tap()
  await page.getByRole('navigation').getByRole('button', { name: 'Saved' }).tap()
  const empty = await page.evaluate(() => {
    const e = document.querySelector('.empty').getBoundingClientRect()
    return { inView: e.top >= 0 && e.bottom <= innerHeight + 0.5, noOverflow: document.documentElement.scrollHeight <= innerHeight }
  })
  check(`${tag} landscape: empty tab fits without scrolling`, empty.inView && empty.noOverflow, JSON.stringify(empty))
  await shot(page, `25-landscape-${tag}-saved`)
  await ctx.close()
}

// Light theme, and the largest system font, on the smallest landscape screen.
{
  const { page, ctx } = await newPage({ viewport: { width: 640, height: 360 }, colorScheme: 'light' })
  await page.getByRole('button', { name: 'Settings' }).tap()
  await page.getByRole('radio', { name: 'Light' }).tap()
  await page.getByRole('button', { name: 'Back', exact: true }).tap()
  await page.keyboard.type('18450+7200+32000')
  await page.getByRole('button', { name: 'Scientific functions' }).tap()
  await shot(page, '26-landscape-light-scientific')
  await page.getByRole('button', { name: 'Scientific functions' }).tap()
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  await page.waitForTimeout(200)
  const big = await page.evaluate(() => {
    const k = document.querySelector('.keypad').getBoundingClientRect()
    return {
      overflowX: document.documentElement.scrollWidth > innerWidth,
      overflowY: document.documentElement.scrollHeight > innerHeight,
      keypadInView: k.bottom <= innerHeight + 0.5 && k.top >= 0,
      tabLabelsClipped: [...document.querySelectorAll('.tab span')].some((s) => s.scrollWidth > s.clientWidth + 1),
    }
  })
  check('640x360 landscape at 200% font: no page scroll, keypad on screen, rail labels whole', !big.overflowX && !big.overflowY && big.keypadInView && !big.tabLabelsClipped, JSON.stringify(big))
  await shot(page, '27-landscape-200pct-font')
  await ctx.close()
}

// Rotating a phone mid-use: nothing is lost, and the layout follows in both directions.
{
  const { page, ctx } = await newPage()
  await page.keyboard.type('18450+7200+32000')
  const portrait = await page.evaluate(() => document.querySelector('.tabbar').getBoundingClientRect().width)
  await page.setViewportSize({ width: 800, height: 360 })
  await page.waitForTimeout(250)
  const land = await page.evaluate(() => {
    const t = document.querySelector('.tabbar').getBoundingClientRect()
    return { railWidth: Math.round(t.width), railHeight: Math.round(t.height) }
  })
  check('rotating to landscape switches to the rail and keeps the expression and result',
    land.railWidth <= 80 && land.railHeight >= 359 && (await text(page, '.display__result')) === '57,650' && (await text(page, '.display__expr')) === '18,450 + 7,200 + 32,000',
    `${portrait}px bar -> ${JSON.stringify(land)}`)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(250)
  const back = await page.evaluate(() => {
    const t = document.querySelector('.tabbar').getBoundingClientRect()
    return { width: Math.round(t.width), height: Math.round(t.height) }
  })
  check('rotating back restores the bottom tab bar', back.width >= 380 && back.height <= 80 && (await text(page, '.display__result')) === '57,650', JSON.stringify(back))
  await ctx.close()
}

await browser.close()

check('no console errors or uncaught exceptions during the whole run', errors.length === 0, errors.slice(0, 3).join(' | '))

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
