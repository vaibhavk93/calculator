// Browser pass for the first-run tours (Budget, Notes and to-do, Due): the tip row, the tour sheet, Try it links,
// Settings replay. 360px and 200% font, with screenshots.
// Run: node e2e/onboarding.test.mjs        Screenshots land in $TMPDIR/calc-onboarding-shots
process.env.TZ = 'Asia/Kolkata'
import { startApp, openApp, tab, stored, overflowing } from './lib.mjs'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = join(tmpdir(), 'calc-onboarding-shots')
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const ok = (c, what) => { if (!c) throw new Error(what) }
const seed = (tours) => ({ schemaVersion: 3, settings: { theme: 'dark', ...(tours ? { tours } : {}) }, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false } })

const app = await startApp()
let failed = 0
const T = async (name, fn, opts = {}) => {
  const { page, errors, close } = await openApp(app, opts)
  try {
    await fn(page)
    const over = await overflowing(page)
    ok(over.length === 0, `sideways overflow: ${over.join(' | ')}`)
    ok(errors.length === 0, `console errors: ${errors.join(' | ')}`)
    console.log('PASS', name)
  } catch (e) {
    failed++
    console.log('FAIL', name, '::', e.message)
    await page.screenshot({ path: join(OUT, `FAIL-${name.replace(/\W+/g, '-')}.png`) })
  } finally { await close() }
}
const shot = (page, n) => page.screenshot({ path: join(OUT, `${n}.png`) })
const sheetOf = (page) => page.locator('.sheet')
const next = (page) => sheetOf(page).locator('.sheet__foot .btn--primary')
const back = (page) => sheetOf(page).locator('.sheet__foot .tour__back')
const tours = async (page) => { await wait(250); return (await stored(page))?.settings?.tours ?? {} }
const row = (page) => page.locator('.tourrow')

// ---------------------------------------------------------------- Budget
await T('budget: first visit shows the row, tour pages with Next and Back, Done hides the row', async (page) => {
  await tab(page, 'Budget')
  ok((await row(page).count()) === 1, 'row shown on first visit')
  ok((await row(page).innerText()).includes('New here? See what you can do in Budget (1 minute)'), 'row words')
  ok((await sheetOf(page).count()) === 0, 'not an auto pop-up')
  await shot(page, '1-budget-row')
  await row(page).locator('.tourrow__open').click()
  const sheet = sheetOf(page)
  ok((await sheet.locator('.sheet__title').innerText()) === 'Budget: what you can do', 'title')
  ok(await page.evaluate(() => document.activeElement?.classList.contains('sheet')), 'focus moved into the sheet')
  ok((await sheet.innerText()).includes('Step 1 of 7'), 'step 1 of 7')
  ok((await back(page).evaluate((el) => getComputedStyle(el).visibility)) === 'hidden', 'Back hidden on step 1')
  await shot(page, '2-budget-step1')
  await next(page).click()
  ok((await sheet.innerText()).includes('Step 2 of 7'), 'step 2')
  ok((await sheet.locator('.tour__heading').innerText()).includes('Categories'), 'step 2 heading')
  ok((await sheet.locator('.tour__step').getAttribute('aria-live')) === 'polite', 'step is announced')
  ok((await sheet.locator('[role=progressbar]').getAttribute('aria-valuenow')) === '2', 'progress value')
  await back(page).click()
  ok((await sheet.innerText()).includes('Step 1 of 7'), 'Back returns to step 1')
  for (let i = 0; i < 6; i++) await next(page).click()
  ok((await sheet.innerText()).includes('Step 7 of 7'), 'last step')
  ok((await next(page).innerText()) === 'Done', 'Next becomes Done')
  await shot(page, '3-budget-last')
  await next(page).click()
  ok((await sheetOf(page).count()) === 0, 'tour closed')
  ok((await row(page).count()) === 0, 'row gone after Done')
  ok((await tours(page)).budget === 'done', 'stored as done')
  ok((await page.getByRole('button', { name: 'Take the tour' }).count()) === 1, 'empty state offers the tour again')
})

await T('budget: X closes at any time and hides the row; nothing is lost', async (page) => {
  await tab(page, 'Budget')
  await row(page).locator('.tourrow__open').click()
  await next(page).click()
  await sheetOf(page).getByRole('button', { name: /^Close/ }).click()
  ok((await sheetOf(page).count()) === 0, 'closed')
  ok((await row(page).count()) === 0, 'row hidden after closing')
  ok((await tours(page)).budget === 'skipped', 'stored as skipped')
  ok((await page.locator('.empty').innerText()).includes('No spending yet'), 'screen unchanged')
})

await T('budget: dismissing the row hides it for good, also after reload', async (page) => {
  await tab(page, 'Budget')
  await row(page).getByRole('button', { name: /Dismiss/ }).click()
  ok((await row(page).count()) === 0, 'row gone')
  ok((await tours(page)).budget === 'skipped', 'stored')
  await page.reload()
  await page.waitForSelector('.app')
  await tab(page, 'Budget')
  ok((await row(page).count()) === 0, 'still gone after reload')
})

await T('budget: Try it closes the tour and opens Add expense', async (page) => {
  await tab(page, 'Budget')
  await row(page).locator('.tourrow__open').click()
  await sheetOf(page).getByRole('button', { name: /Try it: Add an expense/ }).click()
  await wait(200)
  const titles = await page.locator('.sheet .sheet__title').allInnerTexts()
  ok(titles.length === 1 && /Add expense/.test(titles[0]), `Add expense opened, got ${titles.join(' | ')}`)
})

await T('budget: the same row sits above a busy home too', async (page) => {
  await tab(page, 'Budget')
  await page.getByRole('button', { name: 'Add expense' }).first().click()
  await page.locator('#exp-amount').fill('250')
  await page.locator('.sheet__foot .btn--primary').click()
  await wait(300)
  ok((await page.locator('.budget__hero').count()) === 1, 'home with an entry')
  ok((await row(page).count()) === 1, 'row on the home')
  await shot(page, '4-budget-home-row')
}, { data: seed() })

// ---------------------------------------------------------------- Notes
await T('notes: row, 6 steps, Try it opens New list, then To-do', async (page) => {
  await tab(page, 'Notes')
  ok((await row(page).innerText()).includes('Notes and to-do'), 'row words')
  await shot(page, '5-notes-row')
  await row(page).locator('.tourrow__open').click()
  const sheet = sheetOf(page)
  ok((await sheet.innerText()).includes('Step 1 of 6'), '6 steps')
  await next(page).click()
  await sheet.getByRole('button', { name: /Try it: New list/ }).click()
  await wait(200)
  ok((await page.locator('[aria-label="Back"]').count()) > 0, 'a new list screen opened')
  ok((await sheetOf(page).count()) === 0, 'tour closed')
  await page.locator('[aria-label="Back"]').first().click()
  await row(page).count()
  // The row is gone (the tour was closed), so replay from the empty state.
  await page.getByRole('button', { name: 'Take the tour' }).click()
  for (let i = 0; i < 3; i++) await next(page).click()
  await sheetOf(page).getByRole('button', { name: /Try it: Open To-do/ }).click()
  await wait(200)
  ok((await page.locator('.todo__add').count()) === 1, 'To-do side opened')
})

// ---------------------------------------------------------------- Due
await T('due: row, 5 steps, last Try it opens Make reminders reliable', async (page) => {
  await tab(page, 'Due')
  ok((await row(page).count()) === 1, 'row')
  await shot(page, '6-due-row')
  await row(page).locator('.tourrow__open').click()
  ok((await sheetOf(page).innerText()).includes('Step 1 of 5'), '5 steps')
  for (let i = 0; i < 4; i++) await next(page).click()
  await shot(page, '7-due-last')
  await sheetOf(page).getByRole('button', { name: /Try it: Make reminders reliable/ }).click()
  await wait(200)
  const titles = await page.locator('.sheet .sheet__title').allInnerTexts()
  ok(titles.length === 1 && titles[0] === 'Make reminders reliable', `reliable sheet, got ${titles.join(' | ')}`)
})

// ---------------------------------------------------------------- Settings replay
await T('settings: replay a tour, then bring the tips back', async (page) => {
  await page.locator('[aria-label="Settings"]').click()
  const sect = page.locator('section[aria-label="Tips and tours"]')
  ok((await sect.count()) === 1, 'Tips and tours section')
  ok((await sect.locator('.row--button').count()) === 4, 'three tours and the reset row')
  await sect.scrollIntoViewIfNeeded()
  await shot(page, '8-settings-tips')
  await sect.getByRole('button', { name: /^Budget/ }).click()
  const sheet = sheetOf(page)
  ok((await sheet.innerText()).includes('Step 1 of 7'), 'Budget tour opened over Settings')
  ok((await sheet.getByRole('button', { name: /Try it/ }).count()) === 0, 'no Try it links from Settings')
  await next(page).click()
  await sheet.getByRole('button', { name: /^Close/ }).click()
  ok((await sheetOf(page).count()) === 0, 'closed')
  ok((await tours(page)).budget === 'done', 'a finished tour stays done when closed early on replay')
  await sect.getByRole('button', { name: /Show first-visit tips again/ }).click()
  ok(Object.keys(await tours(page)).length === 0, 'tips reset')
  await page.locator('[aria-label="Back"]').first().click()
  await tab(page, 'Due')
  ok((await row(page).count()) === 1, 'row is back on Due')
}, { data: seed({ budget: 'done', notes: 'done', due: 'done' }) })

// ---------------------------------------------------------------- 200% font, sizes, old data
await T('200% font: tour fits, buttons reach 44px, footer on screen', async (page) => {
  await tab(page, 'Budget')
  ok((await row(page).count()) === 1, 'row')
  await shot(page, '9-font200-row')
  await row(page).locator('.tourrow__open').click()
  await next(page).click()
  await shot(page, '10-font200-step')
  const m = await page.evaluate(() => {
    const h = (s) => document.querySelector(s)?.getBoundingClientRect()
    const foot = h('.sheet__foot'), nx = h('.sheet__foot .btn--primary'), x = h('.sheet__close'), vh = window.innerHeight
    return { footBottom: foot.bottom, vh, nextH: nx.height, closeH: x.height, closeW: x.width }
  })
  ok(m.nextH >= 44 && m.closeH >= 44 && m.closeW >= 44, `touch targets ${JSON.stringify(m)}`)
  ok(m.footBottom <= m.vh + 1, `footer on screen ${JSON.stringify(m)}`)
  await back(page).click()
  ok((await sheetOf(page).innerText()).includes('Step 1 of 7'), 'Back works at 200%')
}, { font: 200 })

await T('old data without tours loads and shows the rows', async (page) => {
  await tab(page, 'Due')
  ok((await row(page).count()) === 1, 'row on Due')
  await tab(page, 'Notes')
  ok((await row(page).count()) === 1, 'row on Notes')
}, { data: { schemaVersion: 3, settings: {}, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false } } })

await app.stop()
console.log(failed ? `${failed} FAILED` : 'ALL PASSED')
process.exit(failed ? 1 : 0)
