// Browser tests for the Day view (Budget > a day heading). Run: node e2e/dayview.test.mjs
// "Today" is frozen at 2026-11-15 10:00 IST. The busy day is Sat 14 Nov 2026.
// Env: APP_URL=http://127.0.0.1:PORT/ uses an already served build.
import { chromium } from 'playwright-core'
import { startApp, openApp, stored } from './lib.mjs'

const NOW = new Date('2026-11-15T10:00:00+05:30').getTime()
let n = 0
const cat = (id, name, o = {}) => ({ id, name, limit: null, parentId: null, deletedAt: null, ...o })
const inst = (id, name, kind, o = {}) => ({ id, name, kind, network: null, bank: '', last4: '', rewardNote: '', deletedAt: null, ...o })
const exp = (date, amount, o = {}) => ({ id: 'x' + ++n, date, amount: String(amount), categoryId: null, mode: null, instrumentId: null, note: '', deletedAt: null, ...o })
const DAY = '2026-11-14'

// Oldest entered first. The store keeps the newest first, so the seed is reversed below.
const entered = () => [
  exp(DAY, '1200', { mode: 'upi', categoryId: 'c-trav', note: 'Auto fare' }),
  exp(DAY, '3000', { mode: 'credit', instrumentId: 'i-neo', categoryId: 'c-food', note: 'Dinner' }),
  exp(DAY, '400', { mode: 'credit', instrumentId: 'i-visa', categoryId: 'c-food' }),
  exp(DAY, '150', { mode: 'cash' }),
  exp(DAY, '50000', { income: true, note: 'Salary' }),
  exp(DAY, '200', { mode: 'credit', instrumentId: 'i-neo', categoryId: 'c-food', refund: true, note: 'Returned' }),
  exp(DAY, '1000', { settlement: 'cardBill', instrumentId: 'i-neo', note: 'HDFC bill' }),
  exp(DAY, '999', { mode: 'cash', note: 'Deleted one', deletedAt: 5 }),
  exp('2026-11-13', '77', { mode: 'cash', note: 'Yesterday' }),
]
const budget = (list = entered()) => ({
  overall: null,
  categories: [cat('c-food', 'Food'), cat('c-trav', 'Travel')],
  instruments: [inst('i-neo', 'Tata Neo', 'credit', { network: 'rupay', bank: 'HDFC Bank', last4: '4321' }), inst('i-visa', 'Visa Gold', 'credit', { network: 'visa', bank: 'Axis Bank' })],
  expenses: [...list].reverse(),
})
const seed = (b) => ({ schemaVersion: 3, settings: { startupTab: 'budget' }, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false }, budget: b })

const cases = []
const T = (id, title, fn) => cases.push({ id, title, fn })
const ok = (c, m) => { if (!c) throw new Error(m) }
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`) }

let APP
const open = async (b = budget()) => {
  const o = await openApp(APP, { data: seed(b), now: NOW })
  o.page.setDefaultTimeout(5000)
  return o
}
const DV = (page) => page.locator('.screen[aria-label^="Day:"]')
const openDay = async (page, label = 'Sat 14 Nov') => {
  await page.getByRole('button', { name: new RegExp(`^${label}. See this day`) }).first().click()
  await DV(page).waitFor()
}
const titles = (page) => DV(page).locator('.day__item .row__label').allInnerTexts()

T('DV01', 'Budget home groups Recent entries by day and a day heading opens the Day view', async () => {
  const { page, errors, close } = await open()
  const heads = await page.locator('.budget__day').allInnerTexts()
  ok(heads.some((h) => h.includes('Sat 14 Nov')), 'no heading for Sat 14 Nov: ' + heads.join('|'))
  await openDay(page)
  ok(/Sat 14 Nov/.test(await DV(page).locator('h1').innerText()), 'header is not the day')
  await DV(page).getByRole('button', { name: 'Back' }).click()
  eq(await DV(page).count(), 0, 'Back should leave the day')
  eq(errors, [], 'console errors')
  await close()
})

T('DV02', 'hero is the day spend; money in, bill payment and deleted entries are not counted', async () => {
  const { page, close } = await open()
  await openDay(page)
  eq((await DV(page).locator('.budget__hero').innerText()).trim(), '₹4,550', 'hero')
  ok(!(await DV(page).innerText()).includes('999'), 'a deleted entry is showing')
  const text = await DV(page).locator('.budget__sum').innerText()
  ok(/Money in\s*₹50,000/.test(text), 'Money in line missing: ' + text)
  eq(await DV(page).locator('.budget__hero').count(), 1, 'one hero')
  await close()
})

T('DV03', 'per-route subtotals, biggest first, one line', async () => {
  const { page, close } = await open()
  await openDay(page)
  const line = (await DV(page).locator('.day__routes').first().innerText()).replace(/\s+/g, ' ').trim()
  eq(line, 'Tata Neo ••4321 ₹2,800 · UPI ₹1,200 · Visa Gold ₹400 · Cash ₹150', 'routes')
  await close()
})

T('DV04', 'entries are in the order they were entered, and each says how it was paid in words', async () => {
  const { page, close } = await open()
  await openDay(page)
  eq(await titles(page), ['Auto fare', 'Dinner', 'Food', 'Uncategorised', 'Salary', 'Returned', 'HDFC bill'], 'order')
  const dinner = (await DV(page).locator('.day__item', { hasText: 'Dinner' }).innerText()).replace(/\s+/g, ' ')
  ok(dinner.includes('Food') && dinner.includes('Tata Neo ••4321') && dinner.includes('3,000'), 'Dinner row: ' + dinner)
  const noRoute = (await DV(page).locator('.day__item', { hasText: 'Cash' }).first().innerText()).replace(/\s+/g, ' ')
  ok(noRoute.includes('Cash'), 'cash route: ' + noRoute)
  ok((await DV(page).locator('.day__item', { hasText: 'Salary' }).innerText()).includes('Money in'), 'money in is not labelled')
  await close()
})

T('DV05', '"Add a note" shows only on rows with no note and saves the note', async () => {
  const { page, close } = await open()
  await openDay(page)
  eq(await DV(page).getByRole('button', { name: /^Add a note to/ }).count(), 2, 'only the two rows with no note (Food 400, Uncategorised 150)')
  await DV(page).getByRole('button', { name: /^Add a note to ₹400/ }).click()
  await page.locator('.sheet').waitFor()
  // empty save says what to do and keeps the sheet
  await page.locator('.sheet__foot').getByRole('button', { name: 'Save note' }).click()
  ok((await page.locator('.sheet .ffield__error').innerText()).includes('Type a note'), 'no message for an empty note')
  await page.locator('#day-note').fill('Team lunch')
  await page.locator('.sheet__foot').getByRole('button', { name: 'Save note' }).click()
  await page.locator('.sheet').waitFor({ state: 'detached' })
  ok((await titles(page)).includes('Team lunch'), 'title did not become the note')
  eq(await DV(page).getByRole('button', { name: /^Add a note to/ }).count(), 1, 'one fewer control')
  let saved
  for (let i = 0; i < 30; i++) { saved = (await stored(page)).budget.expenses.find((e) => e.amount === '400'); if (saved.note) break; await page.waitForTimeout(100) } // saving is delayed a moment
  eq([saved.note, saved.mode, saved.instrumentId, saved.categoryId, saved.date], ['Team lunch', 'credit', 'i-visa', 'c-food', DAY], 'only the note changed')
  eq((await DV(page).locator('.budget__hero').innerText()).trim(), '₹4,550', 'hero unchanged')
  await close()
})

T('DV06', 'closing the note sheet with typed text asks first', async () => {
  const { page, close } = await open()
  await openDay(page)
  await DV(page).getByRole('button', { name: /^Add a note to ₹150/ }).click()
  await page.locator('#day-note').fill('Chai')
  await page.locator('.sheet__close').click()
  await page.getByRole('button', { name: 'Keep editing' }).waitFor()
  await page.getByRole('button', { name: 'Discard' }).click()
  await page.locator('.sheet').waitFor({ state: 'detached' })
  eq((await stored(page)).budget.expenses.find((e) => e.amount === '150').note, '', 'nothing saved')
  await close()
})

T('DV07', 'tapping a row opens the edit sheet for that entry', async () => {
  const { page, close } = await open()
  await openDay(page)
  await DV(page).locator('.day__item', { hasText: 'Dinner' }).locator('.budget__recent').click()
  const sheet = page.locator('.sheet')
  await sheet.waitFor()
  ok((await sheet.locator('.sheet__title').innerText()).includes('Edit'), 'not the edit sheet')
  eq(await sheet.locator('#exp-amount').inputValue(), '3000', 'amount')
  await close()
})

T('DV08', 'an empty day says so in plain words and Add starts on that date; deleting the last entry gets there', async () => {
  const b = budget([exp(DAY, '60', { mode: 'cash', note: 'Only one' })])
  const { page, close } = await open(b)
  await openDay(page)
  await DV(page).locator('.budget__recent').click()
  await page.locator('.sheet').waitFor()
  await page.getByRole('button', { name: 'Delete this expense' }).click()
  await page.waitForTimeout(300)
  ok((await DV(page).innerText()).includes('Nothing was entered for Sat 14 Nov'), 'no plain words: ' + (await DV(page).innerText()))
  eq(await DV(page).locator('.budget__hero').count(), 0, 'no hero on an empty day')
  await DV(page).getByRole('button', { name: 'Add expense' }).click()
  await page.locator('.sheet').waitFor()
  eq(await page.locator('#exp-date').inputValue(), DAY, 'date prefilled')
  await close()
})

T('DV09', 'the Entries list in the spending summary has day headings that open the Day view; Back returns to the summary', async () => {
  const { page, close } = await open()
  await page.getByRole('button', { name: 'More in Budget' }).click()
  await page.locator('button.tap-row', { hasText: 'Spending summary' }).first().click()
  const sum = page.locator('.screen[aria-label="Spending summary"]')
  await sum.getByRole('radio', { name: 'Entries', exact: true }).click()
  await sum.getByRole('button', { name: /^Sat 14 Nov. See this day/ }).click()
  await DV(page).waitFor()
  eq((await DV(page).locator('.budget__hero').innerText()).trim(), '₹4,550', 'hero')
  await DV(page).getByRole('button', { name: 'Back' }).click()
  eq(await DV(page).count(), 0, 'day closed')
  eq(await sum.count(), 1, 'back on the summary')
  await close()
})

T('DV10', 'search results are grouped by day too', async () => {
  const { page, close } = await open()
  await page.getByRole('button', { name: 'More in Budget' }).click()
  await page.locator('button.tap-row', { hasText: 'Spending summary' }).first().click()
  const sum = page.locator('.screen[aria-label="Spending summary"]')
  await sum.getByRole('radio', { name: 'Entries', exact: true }).click()
  await sum.locator('input[type=search]').fill('credit')
  await sum.getByRole('button', { name: /^Sat 14 Nov. See this day/ }).click()
  await DV(page).waitFor()
  await close()
})

const dayTitleOf = (page) => DV(page).locator('h1').innerText()
T('DV11', 'Previous and Next day arrows step one day, and are disabled at the first entry and at today', async () => {
  const { page, errors, close } = await open()
  await openDay(page) // Sat 14 Nov
  const prev = DV(page).getByRole('button', { name: 'Previous day' })
  const next = DV(page).getByRole('button', { name: 'Next day' })
  eq([await prev.isDisabled(), await next.isDisabled()], [false, false], 'both enabled mid-range')
  await next.click()
  eq(await dayTitleOf(page), 'Sun 15 Nov', 'next day')
  eq(await next.isDisabled(), true, 'nothing after today')
  ok((await DV(page).innerText()).includes('Nothing was entered for Sun 15 Nov'), 'a quiet day says so')
  await prev.click()
  await prev.click()
  eq(await dayTitleOf(page), 'Fri 13 Nov', 'two steps back')
  eq(await prev.isDisabled(), true, 'nothing before the first entry')
  eq((await DV(page).locator('.budget__hero').innerText()).trim(), '₹77', 'that day total')
  // Back leaves the Day view in one tap whatever day it moved to; Add starts on the day shown.
  await DV(page).getByRole('button', { name: 'Add expense' }).click()
  eq(await page.locator('#exp-date').inputValue(), '2026-11-13', 'Add uses the shown day')
  await page.locator('.sheet__close').click()
  await DV(page).getByRole('button', { name: 'Back' }).click()
  eq(await DV(page).count(), 0, 'back is one tap')
  eq(errors, [], 'console errors')
  await close()
})

T('DV12', 'an entry that was auto-added from a message says "Auto-added"; others do not', async () => {
  const b = budget([exp(DAY, '450', { mode: 'credit', instrumentId: 'i-neo', categoryId: 'c-food', note: 'Swiggy', auto: true }), exp(DAY, '60', { mode: 'cash', note: 'Chai' })])
  const { page, close } = await open(b)
  await openDay(page)
  eq(await DV(page).getByText('Auto-added').count(), 1, 'exactly one entry says it')
  ok((await DV(page).locator('.day__item', { hasText: 'Swiggy' }).innerText()).includes('Auto-added'), 'on the Swiggy row')
  ok(!(await DV(page).locator('.day__item', { hasText: 'Chai' }).innerText()).includes('Auto-added'), 'not on the Chai row')
  await close()
})

// ------------------------------------------------------------------ runner
const only = process.argv.slice(2)
if (process.env.APP_URL) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  APP = { url: process.env.APP_URL, browser, async stop() { await browser.close() } }
} else APP = await startApp()
let failed = 0
for (const c of cases.filter((x) => only.length === 0 || only.some((p) => x.id.startsWith(p)))) {
  try { await c.fn(); console.log(`PASS ${c.id} ${c.title}`) } catch (e) { failed++; console.log(`FAIL ${c.id} ${c.title} :: ${String(e.message).split('\n')[0].slice(0, 400)}`) }
}
await APP.stop()
console.log(`\n${cases.length - failed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
