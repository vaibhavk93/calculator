// Phase 3 Budget and tools checks at 360px: bulk recategorise, edit history, the monthly-bill guess, the History row menu,
// and a calculator draft that survives a reload. Run: node e2e/phase3b.test.mjs  (screenshots in /tmp/calc-p3b). Exit 1 on any FAIL.
import { mkdirSync } from 'node:fs'
import { startApp, openApp, tab, overflowing, stored } from './lib.mjs'

mkdirSync('/tmp/calc-p3b', { recursive: true })
const app = await startApp()
let fails = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` :: ${extra}`}`); if (!ok) fails++ }
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
const shot = (page, name) => page.screenshot({ path: `/tmp/calc-p3b/${name}.png` })
const NOW = new Date('2026-11-15T10:00:00+05:30').getTime()
const cat = (id, name) => ({ id, name, limit: null, parentId: null, deletedAt: null })
const exp = (id, date, amount, o = {}) => ({ id, date, amount, categoryId: null, mode: null, instrumentId: null, note: '', deletedAt: null, ...o })
const seed = (budget, extra = {}) => ({ schemaVersion: 3, settings: { startupTab: 'budget' }, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false }, budget: { overall: null, categories: [cat('c-food', 'Food'), cat('c-trav', 'Travel')], instruments: [], expenses: [], ...budget }, ...extra })
const noScroll = async (page, name) => { const o = await overflowing(page); check(`${name}: no sideways overflow`, o.length === 0, o.join(',')) }

try {
  // ---- 1. bulk recategorise, 2. edit history
  {
    const data = seed({ expenses: [exp('a', '2026-11-10', '120', { note: 'Lunch', categoryId: 'c-food' }), exp('b', '2026-11-11', '300', { note: 'Cab' }), exp('c', '2026-11-12', '80', { note: 'Tea', categoryId: 'c-food' }), exp('t', '2026-11-13', '5000', { settlement: 'transfer' })] })
    const { page, errors, close } = await openApp(app, { data, now: NOW })
    await page.getByRole('button', { name: 'More in Budget' }).click()
    await page.getByRole('button', { name: /Spending summary/ }).click()
    await page.getByRole('radio', { name: 'Entries' }).click().catch(async () => page.locator('button', { hasText: /^Entries$/ }).click())
    await settle(page)
    await page.getByRole('button', { name: /Select entries to change their category/ }).click()
    await settle(page)
    check('select mode: footer says 0 of 3 selected (a transfer cannot be ticked)', (await page.locator('.spend__bulk').innerText()).includes('0 of 3 selected'), await page.locator('.spend__bulk').innerText())
    await page.getByRole('button', { name: /Chang?e? ?category$|^Change category$/ }).click()
    check('Change category with nothing ticked says so', (await page.locator('.spend__bulk').innerText()).includes('Tick at least one entry'), await page.locator('.spend__bulk').innerText())
    await page.getByRole('checkbox', { name: /Select .*Cab/ }).click().catch(() => {})
    const boxes = page.getByRole('checkbox')
    await boxes.nth(0).click()
    await boxes.nth(1).click()
    check('select mode: 2 of 3 selected', (await page.locator('.spend__bulk').innerText()).includes('2 of 3 selected'), await page.locator('.spend__bulk').innerText())
    await shot(page, '1-select')
    await noScroll(page, 'select mode')
    await page.getByRole('button', { name: 'Change category' }).click()
    await settle(page)
    await shot(page, '2-pick')
    await page.getByRole('option', { name: 'Travel' }).click()
    await settle(page)
    let s = await stored(page)
    // let the debounced save land
    await page.waitForTimeout(500)
    s = await stored(page)
    const moved = s.budget.expenses.filter((e) => e.categoryId === 'c-trav').length
    check('two entries moved to Travel', moved === 2, `moved=${moved}`)
    check('snackbar offers Undo', (await page.locator('.snack').innerText()).includes('moved to Travel'), await page.locator('.snack').innerText().catch(() => 'no snack'))
    await shot(page, '3-moved')
    await page.locator('.snack button', { hasText: 'Undo' }).click()
    await page.waitForTimeout(500)
    s = await stored(page)
    check('one Undo puts both back', s.budget.expenses.filter((e) => e.categoryId === 'c-trav').length === 0 && s.budget.expenses.filter((e) => e.categoryId === 'c-food').length === 2, JSON.stringify(s.budget.expenses.map((e) => e.categoryId)))
    check('select mode closed after the move', (await page.locator('.spend__bulk').count()) === 0)

    // edit history
    await page.getByRole('region', { name: 'Entries' }).getByRole('button', { name: /Edit .*120/ }).click()
    await settle(page)
    await page.locator('#exp-amount').fill('900')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await page.waitForTimeout(400)
    await page.getByRole('region', { name: 'Entries' }).getByRole('button', { name: /Edit .*900/ }).click()
    await settle(page)
    const trail = await page.locator('.expense__trail').innerText().catch(() => '')
    check('edit sheet shows "Changed ... was ₹120"', /Changed .*: was ₹120/.test(trail), trail)
    await shot(page, '4-trail')
    check('edit sheet: no sideways overflow', (await overflowing(page)).length === 0)
    check('no console errors (bulk, edit history)', errors.length === 0, errors.join('|'))
    await close()
  }

  // ---- 3. monthly-bill guess
  {
    const data = seed({ expenses: [exp('n1', '2026-09-15', '199', { note: 'Netflix' }), exp('n2', '2026-10-15', '199', { note: 'Netflix' })] })
    const { page, errors, close } = await openApp(app, { data, now: NOW })
    await page.getByRole('button', { name: 'Add expense' }).first().click()
    await settle(page)
    await page.locator('#exp-amount').fill('199')
    await page.locator('#exp-note').fill('Netflix')
    await settle(page)
    const text = await page.locator('.sheet').innerText()
    check('guess line shows for a third monthly Netflix', text.includes('Looks like a monthly bill. Make it a bill?'), text.slice(0, 200))
    await shot(page, '5-guess')
    await noScroll(page, 'guess line')
    await page.getByRole('button', { name: 'Not now' }).click()
    check('Not now hides it', !(await page.locator('.sheet').innerText()).includes('Looks like a monthly bill'))
    await page.locator('#exp-note').fill('Netflix ')
    check('and it stays hidden while the sheet is open', !(await page.locator('.sheet').innerText()).includes('Looks like a monthly bill'))
    check('no guess for a note with no repeats', (await (async () => { await page.locator('#exp-note').fill('Zzz'); return page.locator('.sheet').innerText() })()).includes('Looks like') === false)
    check('no console errors (guess)', errors.length === 0, errors.join('|'))
    await close()
  }

  // ---- 4. History row menu
  {
    const data = seed({}, { settings: { startupTab: 'calculate' }, history: [{ id: 'h1', expression: '18450+7200', result: '25650', at: NOW }, { id: 'h2', expression: '5*3', result: '15', at: NOW - 1000 }] })
    const { page, errors, close } = await openApp(app, { data, now: NOW })
    await page.getByRole('button', { name: 'History' }).click()
    await settle(page)
    await page.getByRole('button', { name: /More for/ }).first().click()
    await settle(page)
    await shot(page, '6-history-menu')
    const items = await page.locator('.hmenu__item').allInnerTexts()
    check('row menu has Use result, Name, Edit, Lock, Share, Copy, Delete', ['Use result', 'Name', 'Edit expression', 'Lock', 'Share', 'Copy', 'Delete'].every((l) => items.some((t) => t.includes(l))), items.join('|'))
    const h = await page.evaluate(() => { const s = document.querySelector('.sheet'); const r = s.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight, scroll: s.scrollHeight, client: s.clientHeight } })
    check('row menu fits the 360x790 screen', h.top >= 0 && h.bottom <= h.vh + 1, JSON.stringify(h))
    const small = await page.evaluate(() => [...document.querySelectorAll('.hmenu__item')].filter((b) => b.getBoundingClientRect().height < 44).length)
    check('every menu row is at least 44px tall', small === 0, `${small} too small`)
    await noScroll(page, 'history row menu')
    await page.getByRole('button', { name: /^Share/ }).click()
    await page.waitForTimeout(500)
    const note = await page.locator('.snack, .notice, .display__notice').allInnerTexts().catch(() => [])
    check('Share on a plain row does not crash (copies in a browser without a share sheet)', errors.length === 0, errors.join('|') + ' ' + note.join('|'))
    await close()
  }
  // short phone: 360x640
  {
    const data = seed({}, { settings: { startupTab: 'calculate' }, history: [{ id: 'h1', expression: '18450+7200', result: '25650', at: NOW }] })
    const { page, close } = await openApp(app, { data, now: NOW, height: 640 })
    await page.getByRole('button', { name: 'History' }).click()
    await settle(page)
    await page.getByRole('button', { name: /More for/ }).first().click()
    await settle(page)
    await shot(page, '7-history-menu-640')
    const r = await page.evaluate(() => { const s = document.querySelector('.sheet'); const b = s.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, vh: innerHeight, scroll: s.scrollHeight } })
    check('row menu on a 640px-tall phone stays on screen (it scrolls inside)', r.top >= 0 && r.bottom <= r.vh + 1, JSON.stringify(r))
    await close()
  }

  // ---- 5. calculator draft across a reload
  {
    const { page, errors, close } = await openApp(app, { now: NOW })
    await tab(page, 'Tools')
    await page.locator('.tools__search input').fill('loan emi')
    await page.locator('.navrow .navrow__label', { hasText: 'Loan EMI' }).first().click()
    await page.waitForSelector('.tool')
    const amount = page.locator('.field-row', { has: page.locator('label', { hasText: /Loan amount/ }) }).locator('input').first()
    await amount.fill('7,77,000')
    await settle(page)
    await page.waitForTimeout(700)
    const s1 = await stored(page)
    check('the typed value is written to storage', JSON.stringify(s1.drafts ?? {}).includes('777000'), JSON.stringify(s1.drafts ?? null))
    await page.reload()
    await page.waitForSelector('.app')
    await tab(page, 'Tools')
    await page.locator('.tools__search input').fill('loan emi')
    await page.locator('.navrow .navrow__label', { hasText: 'Loan EMI' }).first().click()
    await page.waitForSelector('.tool')
    const back = await page.locator('.field-row', { has: page.locator('label', { hasText: /Loan amount/ }) }).locator('input').first().inputValue()
    check('after a reload the calculator reopens with what was typed', back.replace(/,/g, '') === '777000', back)
    await shot(page, '8-draft-restored')
    // Reset clears it
    // Reset lives behind the tool page's own "More" button now (B16), not a direct icon.
    await page.locator('.keep__btn[aria-label="More"]').click()
    await page.locator('.sheet .navrow', { hasText: 'Reset inputs' }).click()
    await page.waitForTimeout(700)
    const s2 = await stored(page)
    check('Reset clears the draft from storage', !JSON.stringify(s2.drafts ?? {}).includes('777000'), JSON.stringify(s2.drafts ?? null))
    check('no console errors (drafts)', errors.length === 0, errors.join('|'))
    await close()
  }
} finally {
  await app.stop()
}
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAIL`)
process.exit(fails === 0 ? 1 - 1 : 1)
