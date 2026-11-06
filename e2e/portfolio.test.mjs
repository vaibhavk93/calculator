// Portfolio P1, in a real browser. Run: node e2e/portfolio.test.mjs
// Empty state, six holdings of mixed ages, hidden amounts, update sheet (same-day replace), add sheet and its errors, delete with Undo,
// reload keeps data, backup export then restore into a fresh app, Budget off hides the entry, 360px dark and light and 200% font
// with no sideways overflow. Screenshots go to e2e/shots/portfolio-*.png (look at them).
import { startApp, openApp, tab, overflowing, stored } from './lib.mjs'
import { mkdirSync, readFileSync } from 'node:fs'

mkdirSync(new URL('./shots/', import.meta.url).pathname, { recursive: true })
const shot = (page, name) => page.screenshot({ path: new URL(`./shots/portfolio-${name}.png`, import.meta.url).pathname })
let failed = 0
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) failed++ }
const settle = (page, ms = 200) => page.waitForTimeout(ms)

// The phone is set to India time, so "today" and every date below are in IST.
const ist = (offset = 0) => new Date(Date.now() + 19_800_000 - offset * 86_400_000).toISOString().slice(0, 10)
const TODAY = ist()
const budget = { overall: '30000', categories: [{ id: 'k1', name: 'Food', limit: '5000', parentId: null, deletedAt: null }], instruments: [], expenses: [{ id: 'e1', date: TODAY, amount: '250.50', categoryId: 'k1', mode: 'upi', instrumentId: null, note: 'tea', deletedAt: null }] }
const hold = (id, name, kind, ageDays, amount, extra = []) => ({ id, name, kind, deletedAt: null, values: [...extra, { date: ist(ageDays), amount }] })
const SAMPLE = [
  hold('h1', 'HDFC savings', 'bank', 1, '325000'),
  hold('h2', 'Bank FD', 'fd_rd', 5, '500000', [{ date: ist(95), amount: '480000' }]),
  hold('h3', 'Mutual funds', 'stocks_mf', 41, '840000'),
  hold('h4', 'Gold', 'gold', 17, '120000'),
  hold('h5', 'EPF', 'retirement', 4, '610000'),
  hold('h6', 'Home loan', 'loan', 3, '3800000', [{ date: ist(70), amount: '3850000' }]),
]
const data = (portfolio, extra = {}, theme = 'dark') => ({ schemaVersion: 3, settings: { theme, ...extra }, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false }, budget, ...(portfolio ? { portfolio } : {}) })

const toPortfolio = async (page) => {
  await tab(page, 'Budget'); await settle(page)
  // Net worth is the second side of Budget home's switch now (no separate Portfolio page).
  await page.getByRole('radio', { name: 'Net worth' }).click(); await settle(page, 300)
}
const NW = '[role=region][aria-label="Net worth"]'
const text = (page) => page.locator(NW).innerText()
const showAmounts = (page) => page.getByRole('button', { name: 'Show amounts' }).click()
const stateHoldings = async (page) => (await stored(page))?.portfolio ?? []

const app = await startApp()
try {
  // ---- empty
  for (const [theme, font, name] of [['dark', 100, 'empty-dark'], ['light', 100, 'empty-light'], ['dark', 200, 'empty-200']]) {
    const o = await openApp(app, { data: data(null, {}, theme), font })
    await toPortfolio(o.page)
    const t = await text(o.page)
    check(/List what you own and what you owe/.test(t), `${name}: empty sentence`)
    check((await o.page.locator(`${NW} .btn`).count()) === 1, `${name}: exactly one button (Add)`)
    check((await o.page.locator(`${NW} .btn--primary`, { hasText: /^Add$/ }).count()) === 1, `${name}: it is the filled Add button`)
    check((await overflowing(o.page)).length === 0, `${name}: no sideways overflow`)
    await shot(o.page, name)
    check(o.errors.length === 0, `${name}: no console errors ${o.errors.join('|')}`)
    await o.close()
  }

  // ---- six holdings
  for (const [theme, font, name] of [['dark', 100, 'six-dark'], ['light', 100, 'six-light'], ['dark', 200, 'six-200']]) {
    const o = await openApp(app, { data: data(SAMPLE, {}, theme), font })
    await toPortfolio(o.page)
    const t = await text(o.page)
    check(!/3,25,000|8,40,000|38,00,000|14,05,000/.test(t), `${name}: amounts are hidden by default`)
    check((t.match(/••••/g) ?? []).length >= 8, `${name}: dots show where amounts would be`)
    check(/1 of 6 values older than 30 days/.test(t), `${name}: "1 of 6 values older than 30 days"`)
    check(/Includes values from/.test(t), `${name}: "Includes values from <date>"`)
    check(/updated 41 days ago · old/.test(t), `${name}: the 41 day row says updated 41 days ago and old`)
    check((t.match(/ · old/g) ?? []).length === 1, `${name}: only that one row says old`)
    check(/updated yesterday/.test(t) && /updated 5 days ago/.test(t), `${name}: other rows say their age in words`)
    check((await overflowing(o.page)).length === 0, `${name}: no sideways overflow`)
    await shot(o.page, `${name}-hidden`)
    await showAmounts(o.page); await settle(o.page)
    const t2 = await text(o.page)
    check(/14,05,000/.test(t2) && /Liabilities are larger than assets/.test(t2), `${name}: shown, net worth is -14,05,000 (2,395,000 owned - 38,00,000 owed)`)
    check(/3,25,000/.test(t2) && /8,40,000/.test(t2) && /38,00,000/.test(t2), `${name}: row amounts shown`)
    check(/What you own/.test(t2) && /What you owe/.test(t2) && /Last 6 months/.test(t2), `${name}: split and months sections`)
    check(/Leaves out/.test(t2) && /no value yet/.test(t2), `${name}: months where a holding had no value yet say so, in words`)
    check((await overflowing(o.page)).length === 0, `${name}: shown, no sideways overflow`)
    await shot(o.page, `${name}-shown`)
    check(o.errors.length === 0, `${name}: no console errors ${o.errors.join('|')}`)
    await o.close()
  }

  // ---- update, add, delete, reload, restore
  const o = await openApp(app, { data: data(SAMPLE), font: 100 })
  const { page } = o
  await toPortfolio(page)
  await showAmounts(page)
  await page.locator('.tap-row', { hasText: 'Mutual funds' }).click(); await settle(page, 300)
  check((await page.locator('.sheet h2, .sheet [role=dialog] h2').first().innerText().catch(() => '')).includes('Update value') || (await page.locator('.sheet').innerText()).includes('Update value'), 'update sheet opens, titled Update value')
  check((await page.inputValue('#pfu-amount')) === '840000', 'the number is pre-filled with the last value')
  check((await page.inputValue('#pfu-date')) === TODAY, 'the date defaults to today')
  await shot(page, 'update-sheet')
  await page.fill('#pfu-amount', '900000')
  await page.locator('.sheet .btn--primary', { hasText: 'Save' }).click(); await settle(page, 300)
  let t = await text(page)
  check(/9,00,000/.test(t), 'new value shown on the row')
  let h = (await stateHoldings(page)).find((x) => x.id === 'h3')
  check(h.values.length === 2 && h.values[1].date === TODAY && h.values[1].amount === '900000', `history kept, new value dated today (${JSON.stringify(h.values)})`)
  check(/0 of 6 values older than 30 days/.test(t) && !/Includes values from/.test(t) && !/ · old/.test(t), 'nothing old any more, and the "Includes values from" line is gone')
  // same day again: replaces
  await page.locator('.tap-row', { hasText: 'Mutual funds' }).click(); await settle(page, 300)
  check(/already has a value/.test(await page.locator('.sheet').innerText()), 'the sheet says today already has a value (saving replaces)')
  await page.fill('#pfu-amount', '910000')
  await page.locator('.sheet .btn--primary', { hasText: 'Save' }).click(); await settle(page, 300)
  h = (await stateHoldings(page)).find((x) => x.id === 'h3')
  check(h.values.length === 2 && h.values[1].amount === '910000', 'a second save on the same day REPLACES that day (still 2 values)')
  // bad amount in the update sheet
  await page.locator('.tap-row', { hasText: 'Gold' }).click(); await settle(page, 300)
  await page.fill('#pfu-amount', '')
  await page.locator('.sheet .btn--primary', { hasText: 'Save' }).click(); await settle(page, 200)
  check(/Enter an amount above zero/.test(await page.locator('.sheet').innerText()), 'empty amount shows a plain error')
  await page.fill('#pfu-amount', '-5'); await settle(page, 100)
  check(/minus sign is not used/i.test(await page.locator('.sheet').innerText()) || (await page.inputValue('#pfu-amount')) === '5', 'a typed minus is refused or dropped')
  await page.keyboard.press('Escape'); await settle(page, 200)
  if (await page.locator('.expense__discard').count()) { await page.locator('.expense__discard .btn--danger').click(); await settle(page, 200) }

  // add
  await page.locator(`${NW} .btn--primary`, { hasText: /^Add$/ }).click(); await settle(page, 300)
  await shot(page, 'add-sheet')
  await page.locator('.sheet .btn--primary', { hasText: /^Add$/ }).click(); await settle(page, 200)
  const errs = await page.locator('.sheet').innerText()
  check(/Give it a name/.test(errs) && /Pick what kind/.test(errs) && /Enter an amount above zero/.test(errs), 'add with nothing filled: names every required field')
  await shot(page, 'add-sheet-errors')
  await page.fill('#pf-name', 'Car loan')
  await page.locator('#pf-kind').click(); await settle(page, 250)
  const pickText = await page.locator('.sheet').last().innerText()
  check(/I own this/.test(pickText) && /I owe this/.test(pickText) && /Loan \(I owe this\)/.test(pickText), 'the kind list is grouped: I own this / I owe this')
  await page.locator('.sheet button', { hasText: 'Loan (I owe this)' }).last().click(); await settle(page, 250)
  await page.fill('#pf-amount', '4,50,000')
  await page.fill('#pf-date', ist(-2)); await settle(page, 100)
  await page.locator('.sheet .btn--primary', { hasText: /^Add$/ }).click(); await settle(page, 200)
  check(/future/.test(await page.locator('.sheet').innerText()), 'a future date is refused in words')
  await page.fill('#pf-date', TODAY)
  await page.locator('.sheet .btn--primary', { hasText: /^Add$/ }).click(); await settle(page, 300)
  t = await text(page)
  check(/Car loan/.test(t) && /you owe this/.test(t) && /updated today/.test(t), 'new holding appears in the list, marked as owed')
  check(/0 of 7 values/.test(t), 'count is now 7')
  h = (await stateHoldings(page)).find((x) => x.name === 'Car loan')
  check(h && h.kind === 'loan' && h.values[0].amount === '450000' && h.deletedAt === null, 'stored cleanly (plain amount, kind loan)')

  // delete + undo
  await page.locator('.tap-row', { hasText: 'EPF' }).click(); await settle(page, 300)
  await page.locator('.sheet .link-btn--danger', { hasText: 'Remove this from the list' }).click(); await settle(page, 300)
  t = await text(page)
  check(!/EPF/.test(t) && /of 6 values/.test(t), 'removed row is gone from the list and the count')
  await shot(page, 'removed-snack')
  check((await page.locator('.snack').innerText()).includes('Removed "EPF"'), 'a message says what was removed')
  await page.locator('.snack button', { hasText: 'Undo' }).click(); await settle(page, 300)
  t = await text(page)
  check(/EPF/.test(t) && /of 7 values/.test(t), 'Undo brings it back')
  h = (await stateHoldings(page)).find((x) => x.id === 'h5')
  check(h.deletedAt === null && h.values.length === 1, 'and in storage, with its history')

  // reload keeps data
  await settle(page, 600)
  await page.reload(); await page.waitForSelector('.app'); await settle(page, 300)
  await toPortfolio(page)
  t = await text(page)
  check(/Car loan/.test(t) && /Mutual funds/.test(t) && /of 7 values/.test(t), 'reload keeps the data')
  check(/••••/.test(t) && !/9,10,000/.test(t), 'and amounts are hidden again after reload (never saved)')
  const raw = JSON.stringify(await stored(page))
  check(!/hid(e|den)/i.test(raw), 'storage holds no hide flag')

  // backup round trip
  await tab(page, 'Calculate'); await settle(page, 200)
  await page.click('[aria-label=Settings]'); await settle(page, 200)
  await page.click('text=Backup and export'); await settle(page, 200)
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('text=Export a backup')])
  const file = readFileSync(await dl.path(), 'utf8')
  const exported = JSON.parse(file).data
  check(Array.isArray(exported.portfolio) && exported.portfolio.length === 7, 'the backup file holds the 7 holdings')
  check(JSON.parse(file).schemaVersion === 3, 'schema version is still 3')
  const b = await openApp(app, { data: data(null), font: 100 })
  await b.page.click('[aria-label=Settings]'); await settle(b.page, 200)
  await b.page.click('text=Backup and export'); await settle(b.page, 200)
  await b.page.setInputFiles('input[type=file]', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(file) }); await settle(b.page, 300)
  await b.page.click('.confirm .btn--primary'); await settle(b.page, 400)
  const restored = (await stored(b.page)).portfolio
  check(JSON.stringify(restored) === JSON.stringify(exported.portfolio), 'restore into a fresh app: portfolio identical')
  await b.close()

  // old backup (no portfolio) loads empty
  const c = await openApp(app, { data: data(null), font: 100 })
  check(((await stored(c.page))?.portfolio ?? []).length === 0, 'old data with no portfolio loads empty')
  await c.close()
  check(o.errors.length === 0, `no console errors in the whole flow ${o.errors.join('|')}`)
  await o.close()

  // ---- Budget off hides the entry
  const off = await openApp(app, { data: data(SAMPLE, { modules: { budget: false, notes: true } }), font: 100 })
  const tabs = await off.page.locator('.tabbar .tab span').allTextContents()
  check(!tabs.includes('Budget'), `Budget off: no Budget tab (${tabs.join(', ')}), so no Net worth view`)
  check(((await stored(off.page))?.portfolio ?? []).length === 6, 'Budget off: the data stays in storage')
  await off.close()
  const on = await openApp(app, { data: data(SAMPLE, { modules: { budget: true, notes: true } }), font: 100 })
  await tab(on.page, 'Budget'); await settle(on.page)
  check((await on.page.getByRole('radio', { name: 'Net worth' }).count()) === 1, 'Budget on: the Net worth switch is on Budget home')
  await shot(on.page, 'budget-home-switch')
  await on.close()
} finally {
  await app.stop()
}
console.log(failed === 0 ? '\nAll Portfolio checks passed' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
