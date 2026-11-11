// QA campaign "budget-new" (2026-11-03): browser cases for everything built or changed today in Budget, from a fresh install to a month of use.
// Pure-logic cases (statement CSV parser, bank-message parser, masking, CSV export) are in src/store/qaBudgetNew.test.ts (vitest).
// Run: node e2e/qa-budget-new.test.mjs [idPrefix ...]   Env: APP_URL=http://127.0.0.1:PORT/ (use a served build), CONC=3
// One line per case: PASS|FAIL <id> <type> <title> :: <why>. "Today" is frozen at 2026-11-15 10:00 IST. Every case seeds its own data.
import { chromium } from 'playwright-core'
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startApp, openApp, tab, overflowing, stored } from './lib.mjs'

const cases = []
const T = (id, type, title, fn, opts = {}) => cases.push({ id, type, title, fn, ...opts })
const fail = (m) => { throw new Error(m) }
const J = (v) => JSON.stringify(v)
const eq = (a, b, m = '') => { if (J(a) !== J(b)) fail(`${m ? m + ': ' : ''}got ${J(a)} expected ${J(b)}`) }
const ok = (c, m = 'condition false') => { if (!c) fail(m) }
const has = (t, p, m = '') => { if (!String(t).includes(p)) fail(`${m ? m + ': ' : ''}${J(String(t).slice(0, 240))} lacks ${J(p)}`) }
const lacks = (t, p, m = '') => { if (String(t).includes(p)) fail(`${m ? m + ': ' : ''}${J(String(t).slice(0, 240))} contains ${J(p)}`) }
const bug = (id, present, detail = '') => { if (present) fail(`known ${id}, confirmed: ${detail}`) }

const NOW = new Date('2026-11-15T10:00:00+05:30').getTime()
let nid = 0
const cat = (id, name, o = {}) => ({ id, name, limit: null, parentId: null, deletedAt: null, ...o })
const inst = (id, name, kind, o = {}) => ({ id, name, kind, network: null, bank: '', last4: '', rewardNote: '', deletedAt: null, ...o })
const exp = (date, amount, o = {}) => ({ id: 'x' + ++nid, date, amount: String(amount), categoryId: null, mode: null, instrumentId: null, note: '', deletedAt: null, ...o })
const budgetOf = (o = {}) => ({ overall: null, categories: [], instruments: [], expenses: [], ...o })
const seed = (budget, settings = {}) => ({ schemaVersion: 3, settings: { startupTab: 'budget', ...settings }, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false }, budget })
const CATS = () => [cat('c-food', 'Food'), cat('c-trav', 'Travel'), cat('c-goa', 'Goa trip', { parentId: 'c-trav' }), cat('c-rent', 'Rent'), cat('c-bills', 'Bills')]
const INSTS = () => [
  inst('i-bank', 'HDFC Salary', 'bank', { bank: 'HDFC Bank', last4: '1234' }),
  inst('i-neo', 'Tata Neo', 'credit', { network: 'rupay', bank: 'HDFC Bank', last4: '4321', statementDay: 5, dueDay: 25, creditLimit: '150000', annualFee: '500' }),
  inst('i-visa', 'Visa Gold', 'credit', { network: 'visa', bank: 'Axis Bank' }),
]
const BASE = (o = {}) => budgetOf({ categories: CATS(), instruments: INSTS(), ...o })
const RAW_EMPTY = () => ({ schemaVersion: 3, settings: { startupTab: 'budget' }, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false } })

let APP
const makeCtx = () => {
  const pages = []
  return {
    pages,
    async open(opts = {}) {
      const { budget, settings, data, ...rest } = opts
      const o = await openApp(APP, { data: data ?? seed(budget === undefined ? budgetOf() : budget, settings), now: NOW, ...rest })
      o.page.setDefaultTimeout(6000)
      pages.push(o)
      return o
    },
  }
}

// ---------------------------------------------------------------- helpers
const S = (page) => page.locator('.sheet')
const settle = async (page) => { await page.evaluate(() => { const a = document.activeElement; if (a instanceof HTMLElement) a.blur() }); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))) }
const addBtn = (page) => page.getByRole('button', { name: 'Add expense', exact: true }).first()
const openAdd = async (page) => { await addBtn(page).click(); await page.locator('.sheet').waitFor() }
const footBtn = (page) => S(page).locator('.sheet__foot .btn--primary').first()
const save = (page) => footBtn(page).click()
const errs = (page) => S(page).locator('.ffield__error').allInnerTexts()
const bodyText = (page) => page.locator('.app').innerText()
/** Text of the top-most full screen (a message shown on an overlay screen sits after the home text, which the one-line error cut would hide). */
const topText = (page) => page.locator('.screen').last().innerText()
const noBad = (t) => { for (const w of ['NaN', 'undefined', 'Infinity', '[object', 'null']) lacks(t, w, 'bad text on screen') }
const waitStored = async (page, pred, ms = 3000) => { const t0 = Date.now(); let last; while (Date.now() - t0 < ms) { last = await stored(page); try { if (pred(last)) return last } catch {} await page.waitForTimeout(100) } return last }
const budgetNow = async (page) => (await waitStored(page, () => false, 450))?.budget
const liveE = (b) => b.expenses.filter((e) => e.deletedAt === null)
const pageOf = (page, name) => page.locator(`.screen[aria-label="${name}"]`)
// By accessible name, not a CSS class: the home screen's navigation row carries class "tap-row" (any
// spending logged this month) or "link-btn" (the empty state's own action list, no spending yet) -- same
// button, same destination, two different presentations. A selector pinned to one class breaks on
// whichever seed the test happens to use. getByRole matches either.
// Only the non-empty state collapses these four behind "More in Budget" (its own row list is not behind
// a sheet): open it only if it is actually there.
const openMoreIfNeeded = async (page) => {
  const more = page.getByRole('button', { name: 'More in Budget' })
  if (await more.count()) {
    // "More in Budget" sits higher up now that the four destinations are collapsed, which can land it
    // under a still-showing snackbar (e.g. the backup nudge, or a just-seeded page's own first paint) --
    // wait that out rather than let Playwright's retry-click race its 8s auto-dismiss.
    await page.locator('.snack').waitFor({ state: 'detached', timeout: 9000 }).catch(() => {})
    await more.click()
    await page.locator('.sheet').waitFor()
  }
}
const toSummary = async (page) => { await openMoreIfNeeded(page); await page.getByRole('button', { name: /Spending summary/ }).first().click(); await pageOf(page, 'Spending summary').waitFor() }
const toBills = async (page) => { await openMoreIfNeeded(page); await page.getByRole('button', { name: /Bills and subscriptions/ }).first().click(); await pageOf(page, 'Bills and subscriptions').waitFor() }
const toManage = async (page) => { await openMoreIfNeeded(page); await page.getByRole('button', { name: /Categories and cards/ }).first().click(); await pageOf(page, 'Categories and cards').waitFor() }
// Categories and cards is a two-state screen (design reference): the cards and accounts are on its Cards state.
const toCards = async (page) => { await toManage(page); await pageOf(page, 'Categories and cards').getByRole('radio', { name: 'Cards', exact: true }).click() }
const toImport = async (page) => { await openMoreIfNeeded(page); await page.getByText('Add from bank messages').first().click(); await pageOf(page, 'Add from messages').waitFor() }
const SUM = (page) => pageOf(page, 'Spending summary')
const entriesTab = (page) => SUM(page).getByRole('radio', { name: 'Entries', exact: true }).click()
const chooseCat = async (page, name) => {
  await settle(page)
  const pill = S(page).locator('#exp-cat .pill:not(.pill--more)', { hasText: new RegExp('^' + name + '$') })
  if (await pill.count()) return pill.first().click()
  await S(page).locator('#exp-cat .pill--more').click()
  await page.locator('.pick__opt').filter({ has: page.locator('.pick__label', { hasText: new RegExp('^' + name + '$') }) }).first().click()
}
// "Repeats" sits under "More options" (B20): open it unless it is already open.
const openMore = async (page) => { const d = S(page).locator('details.more'); if (!(await d.evaluate((e) => e.open))) await d.locator('summary').click() }
const fill = async (page, f = {}) => {
  const s = S(page)
  if (f.amount !== undefined) await s.locator('#exp-amount').fill(f.amount)
  if (f.date !== undefined) await s.locator('#exp-date').fill(f.date)
  if (f.kind) { await settle(page); await s.getByRole('radio', { name: f.kind, exact: true }).click() }
  if (f.repeat) { await settle(page); await openMore(page); await s.getByRole('radio', { name: f.repeat, exact: true }).click() }
  if (f.cat !== undefined) await chooseCat(page, f.cat)
  if (f.mode !== undefined) { await settle(page); await s.locator('#exp-mode .chip', { hasText: new RegExp('^' + f.mode + '$') }).click() }
  if (f.note !== undefined) await s.locator('#exp-note').fill(f.note)
}
const addExpense = async (page, f) => { await openAdd(page); await fill(page, f); await save(page); await page.locator('.sheet').waitFor({ state: 'detached' }) }

const smallTargets = (page, root) => page.evaluate((r) => {
  const scope = document.querySelector(r) ?? document
  const out = []
  scope.querySelectorAll('button, a[href], input:not([type=hidden]):not([type=file]), textarea, [role=radio], [role=checkbox], summary').forEach((el) => {
    const b = el.getBoundingClientRect(); if (!b.width || !b.height || el.closest('.sr-only') || el.classList.contains('sr-only')) return
    if (getComputedStyle(el).visibility === 'hidden') return
    if (Math.max(b.width, b.height) < 43.5) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 24)} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 22)}" ${Math.round(b.width)}x${Math.round(b.height)}`)
  })
  return [...new Set(out)].slice(0, 8)
}, root)
const clipped = (page) => page.evaluate(() => {
  const out = []
  document.querySelectorAll('.app *').forEach((el) => {
    const cs = getComputedStyle(el), b = el.getBoundingClientRect()
    if (!b.width || !b.height || !el.textContent?.trim() || el.closest('.sr-only')) return
    if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && el.children.length === 0) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 24)} "${el.textContent.trim().slice(0, 24)}" ${el.scrollWidth}>${el.clientWidth}`)
  })
  return [...new Set(out)].slice(0, 8)
})
const layoutOk = async (page, what, root = '.app') => {
  await page.waitForTimeout(400) // screens slide in over 220ms; measure after it
  eq(await overflowing(page), [], `${what} overflows sideways`)
  eq(await clipped(page), [], `${what} has clipped text`)
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)), `${what}: page scrolls sideways`)
  eq(await smallTargets(page, root), [], `${what}: controls under 44px`)
  noBad(await bodyText(page))
}

const dir = mkdtempSync(join(tmpdir(), 'qa-bn-'))
const file = (name, content) => { const p = join(dir, name); writeFileSync(p, content); return p }
const HDR = 'Date,Narration,Withdrawal Amt.,Deposit Amt.\n'

// ================================================================== A. zero to first use
T('B-001', 'POS', 'fresh install: Budget tab shows the empty state, starter categories exist, no errors', async (c) => {
  const { page } = await c.open({ data: RAW_EMPTY() })
  const t = await bodyText(page)
  has(t, 'No spending yet'); noBad(t)
  await toManage(page)
  has(await bodyText(page), 'Rent')
})
T('B-002', 'POS', 'a new user adds a first expense with only an amount, no help needed: saved as Uncategorised', async (c) => {
  const { page } = await c.open({ data: RAW_EMPTY() })
  await addExpense(page, { amount: '250' })
  const b = await budgetNow(page)
  eq(liveE(b).map((e) => [e.amount, e.categoryId, e.mode]), [['250', null, null]])
  has(await bodyText(page), 'Spent this month')
})
T('B-003', 'POS', 'full flow: amount, category pill, UPI, note, then it appears in Recent and in the summary', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await addExpense(page, { amount: '1,250.50', cat: 'Food', mode: 'UPI', note: 'Lunch' })
  const b = await budgetNow(page)
  const e = liveE(b)[0]
  eq([e.amount, e.categoryId, e.mode, e.note], ['1250.5', 'c-food', 'upi', 'Lunch'])
  has(await page.locator('.app').innerText(), '₹1,250.50')
  await toSummary(page)
  has(await bodyText(page), 'Food')
})
T('B-004', 'RUNTIME', 'reload keeps the data and the same screen total', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await addExpense(page, { amount: '321', cat: 'Food' })
  await page.waitForTimeout(500)
  await page.reload(); await page.waitForSelector('.app')
  has(await bodyText(page), '₹321')
})
T('B-005', 'NEG', 'note longer than 200 characters is capped, not refused or lost', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fill(page, { amount: '5', note: 'n'.repeat(300) }); await save(page)
  await page.locator('.sheet').waitFor({ state: 'detached' })
  eq(liveE(await budgetNow(page))[0].note.length, 200)
})
T('B-006', 'NEG', 'date cleared: plain message and the sheet stays', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fill(page, { amount: '5' })
  await S(page).locator('#exp-date').fill('')
  await save(page)
  has((await errs(page)).join('|'), 'Pick a date')
  eq(await S(page).count(), 1)
})
T('B-007', 'NEG', 'date far in the future and before the year 2000 are refused in words', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fill(page, { amount: '5', date: '2030-01-01' }); await save(page)
  has((await errs(page)).join('|'), 'far future')
  await S(page).locator('#exp-date').fill('1999-12-31'); await save(page)
  has((await errs(page)).join('|'), 'year 2000')
  eq(liveE(await budgetNow(page)).length, 0)
})
T('B-008', 'CORNER', 'an entry dated in another month does not change this month, but shows in that month', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await addExpense(page, { amount: '700', date: '2026-10-03' })
  has(await page.locator('.budget__hero').first().innerText(), '₹0')
})
T('B-009', 'RUNTIME', 'rapid double tap on Add expense saves exactly one entry (3 tries)', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fill(page, { amount: '75' })
  await footBtn(page).dblclick().catch(() => {})
  await page.waitForTimeout(600)
  eq(liveE(await budgetNow(page)).length, 1)
})
T('B-010', 'UX', 'closing a half-filled sheet asks before discarding; Keep editing returns; an empty sheet closes at once', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page)
  await S(page).getByRole('button', { name: /close/i }).first().click()
  await S(page).waitFor({ state: 'detached' })
  await openAdd(page); await fill(page, { amount: '55' })
  await S(page).getByRole('button', { name: /close/i }).first().click()
  has(await S(page).innerText(), 'Discard this expense?')
})
T('B-011', 'UX', 'delete from the edit sheet is undoable', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '100', { note: 'tea' })] }) })
  await page.getByRole('button', { name: /^Edit ₹100/ }).first().click()
  await S(page).getByRole('button', { name: 'Delete this expense' }).click()
  await page.locator('.snack').getByRole('button', { name: 'Undo' }).click()
  eq(liveE(await budgetNow(page)).length, 1)
})

// ================================================================== B. layout of every Budget screen and sheet (360, 200%, light, dark)
const VIEWS = [
  ['home', async () => {}],
  ['add-sheet', async (p) => { await openAdd(p) }],
  ['summary', async (p) => { await toSummary(p) }],
  ['entries', async (p) => { await toSummary(p); await entriesTab(p) }],
  ['bills', async (p) => { await toBills(p) }],
  ['manage', async (p) => { await toManage(p) }],
  ['import', async (p) => { await toImport(p) }],
  ['export-sheet', async (p) => { await toSummary(p); await p.getByRole('button', { name: /Export expenses/ }).click(); await p.locator('.sheet').waitFor() }],
]
const LAYOUT_DATA = () => BASE({
  expenses: [exp('2026-11-03', '1250.5', { categoryId: 'c-food', mode: 'upi', note: 'A long note that goes on and on to test wrapping at narrow widths ok' }), exp('2026-11-04', '99999999.99', { categoryId: 'c-goa', mode: 'credit', instrumentId: 'i-neo' }), exp('2026-11-05', '300', { refund: true, categoryId: 'c-food' }), exp('2026-10-05', '44', { categoryId: 'c-food' })],
  recurring: [], overall: '50000',
})
for (const [vid, go] of VIEWS)
  for (const [label, o] of [['360px', {}], ['200% font', { font: 200 }], ['light', { theme: 'light' }], ['dark', { theme: 'dark' }], ['360x640', { height: 640 }]])
    T(`B-02-${vid}-${label.replace(/\W/g, '')}`, 'UI', `${vid} layout at ${label}: no sideways scroll, no clipped text, controls 44px+`, async (c) => {
      const { page } = await c.open({ budget: LAYOUT_DATA(), ...o })
      await go(page)
      await layoutOk(page, vid, vid === 'add-sheet' || vid === 'export-sheet' ? '.sheet' : '.app')
    })
T('B-025', 'UI', 'rotate to landscape and back with the Add expense sheet open keeps the form and the typed amount', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fill(page, { amount: '88' })
  await page.setViewportSize({ width: 800, height: 360 })
  await page.waitForTimeout(200)
  eq(await S(page).locator('#exp-amount').inputValue(), '88')
  await page.setViewportSize({ width: 360, height: 790 })
  eq(await overflowing(page), [])
})

// ================================================================== C. statement CSV (Add from bank messages)
const findRows = (page) => page.locator('.import__row')
const pickFile = async (page, p) => { await page.locator('input[type=file]').setInputFiles(p) }
T('B-101', 'POS', 'a messy statement (BOM, title lines, quotes, comma amounts) lists money-out rows only', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toImport(page)
  await pickFile(page, file('m.csv', '﻿HDFC BANK\r\nAccount: XXXX1234\r\n\r\nDate,Narration,Chq./Ref.No.,Withdrawal Amt.,Deposit Amt.,Closing Balance\r\n02/11/26,UPI-SWIGGY-swiggy@icici-312345678901,312345678901,450.00,,10000.00\r\n03/11/26,SALARY,000111,,50000.00,60000.00\r\n04/11/26,"POS AMAZON, IN",000222,"1,299.00",,58701.00\r\n'))
  await page.getByText('Found').first().waitFor()
  eq(await findRows(page).count(), 2)
  has(await topText(page), '1 money-in message')
})
T('B-102', 'POS', 'a semicolon file with a decimal comma (450,00) is read as 450, never 45,000', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toImport(page)
  await pickFile(page, file('s.csv', 'Statement\nDate;Narration;Withdrawal Amt.;Deposit Amt.\n02/11/2026;SHOP;450,00;\n'))
  await page.getByText('Found').first().waitFor()
  has(await findRows(page).first().innerText(), '₹450')
})
T('B-103', 'NEG', 'a file over 5 MB is refused in plain words and nothing is listed', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toImport(page)
  await pickFile(page, file('big.csv', HDR + 'x'.repeat(5_000_001)))
  has(await topText(page), 'too big for a statement')
  eq(await findRows(page).count(), 0)
})
T('B-104', 'NEG', 'a PDF (by name, and a PDF renamed .csv) is refused in plain words', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toImport(page)
  await pickFile(page, file('a.pdf', '%PDF-1.4 x'))
  has(await topText(page), 'PDF statements are not supported yet')
  await pickFile(page, file('b.csv', '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj'))
  const t = await topText(page)
  ok(/not a CSV|Could not find|empty/.test(t), 'no plain message for a PDF renamed .csv: ' + t.slice(0, 200))
  noBad(t)
})
T('B-105', 'NEG', 'an empty file, a header-only file and plain text each give a plain message', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toImport(page)
  for (const [n, body] of [['e.csv', ''], ['h.csv', HDR], ['t.csv', 'hello world']]) {
    await pickFile(page, file(n, body))
    const t = await topText(page)
    ok(/empty|Could not find|not a CSV|Nothing new/.test(t), n + ' gave: ' + t.slice(0, 150))
    noBad(t)
  }
})
T('B-106', 'NEG', 'bad dates, zero, negative and huge amounts are skipped and counted, not guessed', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toImport(page)
  await pickFile(page, file('bad.csv', HDR + '31/02/2026,A,10.00,\n2026-13-01,B,10.00,\n02/11/2026,C,0.00,\n02/11/2026,D,-5.00,\n02/11/2026,E,999999999999.00,\n02/11/2026,OK,10.00,\n'))
  await page.getByText('Found').first().waitFor()
  eq(await findRows(page).count(), 1)
  has(await topText(page), '5 messages could not be read')
})
T('B-107', 'UX', 'Add saves exactly that row, removes it, remembers it; Skip hides it for good; re-importing says "handled before"', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toImport(page)
  const p = file('r.csv', HDR + '02/11/2026,TEA STALL,20.00,\n03/11/2026,BOOK SHOP,300.00,\n')
  await pickFile(page, p); await page.getByText('Found').first().waitFor()
  await findRows(page).first().getByRole('button', { name: 'Add' }).click()
  await page.waitForTimeout(250)
  eq(await findRows(page).count(), 1)
  await findRows(page).first().getByRole('button', { name: 'Skip' }).click()
  await page.waitForTimeout(250)
  const b = await budgetNow(page)
  eq(liveE(b).length, 1); eq(b.smsSeen.length, 2)
  await pickFile(page, p)
  has(await topText(page), 'handled before')
  eq(await findRows(page).count(), 0)
})
T('B-108', 'POS', 'Add the first expense from the review list: the screen is NOT reset (remount bug)', async (c) => {
  const { page } = await c.open({ data: RAW_EMPTY() }); await toImport(page)
  await pickFile(page, file('r.csv', HDR + '02/11/2026,TEA STALL,20.00,\n03/11/2026,BOOK SHOP,300.00,\n'))
  await page.getByText('Found').first().waitFor()
  await findRows(page).first().getByRole('button', { name: 'Add' }).click()
  await page.waitForTimeout(300)
  eq(await findRows(page).count(), 1, 'the other row should still be listed')
})
T('B-109', 'POS', 'two identical rows on one day are both offered (no silent loss)', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toImport(page)
  await pickFile(page, file('d.csv', HDR + '02/11/2026,TEA STALL,20.00,\n02/11/2026,TEA STALL,20.00,\n'))
  await page.getByText('Found').first().waitFor()
  eq(await findRows(page).count(), 2)
})
T('B-110', 'UX', 'a row that matches an existing entry is hidden under "that looks already added", with Add anyway', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-02', '20', { note: 'Tea stall' })] }) }); await toImport(page)
  await pickFile(page, file('d.csv', HDR + '02/11/2026,TEA STALL,20.00,\n'))
  await page.getByText('Found').first().waitFor()
  eq(await findRows(page).count(), 0)
  await page.getByRole('button', { name: /that looks already added/ }).click()
  eq(await findRows(page).count(), 1)
  await findRows(page).first().getByRole('button', { name: 'Add anyway' }).click()
  await page.waitForTimeout(250)
  eq(liveE(await budgetNow(page)).length, 2)
})
T('B-111', 'UX', 'Review opens the sheet with the row filled in; closing without saving keeps the row; saving removes it', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toImport(page)
  await pickFile(page, file('r.csv', HDR + '02/11/2026,BOOK SHOP,300.00,\n'))
  await page.getByText('Found').first().waitFor()
  await findRows(page).first().getByRole('button', { name: /^Review/ }).click()
  eq(await S(page).locator('#exp-amount').inputValue(), '300.00')
  eq(await S(page).locator('#exp-note').inputValue(), 'Book Shop')
  await S(page).getByRole('button', { name: /close/i }).first().click()
  if (await S(page).count()) await S(page).getByRole('button', { name: /Discard/ }).first().click()
  eq(await findRows(page).count(), 1)
  await findRows(page).first().getByRole('button', { name: /^Review/ }).click()
  await save(page)
  await page.locator('.sheet').waitFor({ state: 'detached' })
  eq(await findRows(page).count(), 0)
})
T('B-112', 'POS', 'choosing "Statement is for" a card attaches it to every row it adds', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toImport(page)
  await page.locator('button#' + (await page.locator('.import__intro button[aria-haspopup]').first().getAttribute('id'))).click().catch(() => {})
  await page.locator('.import__intro button[aria-haspopup]').first().click().catch(() => {})
  const opt = page.locator('.pick__opt').filter({ hasText: 'Tata Neo' }).first()
  if (!(await opt.count())) fail('Statement is for picker did not list the card')
  await opt.click()
  await pickFile(page, file('c.csv', HDR + '02/11/2026,BOOK SHOP,300.00,\n'))
  await page.getByText('Found').first().waitFor()
  await findRows(page).first().getByRole('button', { name: 'Add' }).click()
  await page.waitForTimeout(300)
  const e = liveE(await budgetNow(page))[0]
  ok(e && e.instrumentId === 'i-neo', 'expense not attached to the chosen card: ' + J(e))
})
T('B-113', 'POS', 'a "credit card payment" row becomes a card bill (Review, not one-tap Add)', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toImport(page)
  await pickFile(page, file('cb.csv', HDR + '02/11/2026,CREDIT CARD PAYMENT BILLDESK,5000.00,\n'))
  await page.getByText('Found').first().waitFor()
  has(await findRows(page).first().innerText(), 'Credit card bill payment')
  await findRows(page).first().getByRole('button', { name: 'Review', exact: true }).click()
  has(await S(page).innerText(), 'Card being paid')
})
T('B-114', 'RUNTIME', '3000 rows: the list appears in under 8 seconds and the page still responds', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toImport(page)
  let csv = HDR
  for (let i = 0; i < 3000; i++) csv += `${String((i % 28) + 1).padStart(2, '0')}/11/2026,UPI/${300000000000 + i}/SHOP${i}/okhdfc,${(i % 900) + 1}.00,\n`
  const t0 = Date.now()
  await pickFile(page, file('3k.csv', csv))
  await page.getByText('Found').first().waitFor({ timeout: 20000 })
  const took = Date.now() - t0
  ok(took < 8000, `3000 rows took ${took} ms to show`)
  const t1 = Date.now()
  await page.getByRole('button', { name: 'Reader log' }).first().click().catch(() => {})
  ok(Date.now() - t1 < 4000, 'page froze after 3000 rows')
}, { slow: true })
T('B-115', 'UX', 'Reader log opens with a close X; says nothing logged yet; Copy log works without an error', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toImport(page)
  await page.getByText('Reader log').first().click()
  has(await S(page).innerText(), 'Nothing logged yet')
  ok(await S(page).getByRole('button', { name: /close/i }).count() >= 1, 'no X')
  await S(page).getByRole('button', { name: 'Copy log' }).click()
  await S(page).getByRole('button', { name: /close/i }).first().click()
})
T('B-116', 'UI', 'import results at 200% font and light theme: nothing clipped, controls 44px+', async (c) => {
  for (const o of [{ font: 200 }, { theme: 'light' }]) {
    const { page } = await c.open({ budget: BASE(), ...o }); await toImport(page)
    await pickFile(page, file('l.csv', HDR + '02/11/2026,A VERY LONG MERCHANT NAME THAT KEEPS GOING AND GOING,99999999.00,\n03/11/2026,B,1.00,\n'))
    await page.getByText('Found').first().waitFor()
    await layoutOk(page, 'import results ' + J(o))
  }
})
T('B-117', 'NEG', 'a statement with a quote that never closes is refused in words, not "nothing found"', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toImport(page)
  await pickFile(page, file('q.csv', HDR + '02/11/2026,"5 inch cable,10.00,\n03/11/2026,TEA,20.00,\n'))
  has(await topText(page), 'quote mark')
})
T('B-118', 'NEG', 'a "Debit/Credit" marker column next to Amount is read (HDFC card style)', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toImport(page)
  await pickFile(page, file('dc.csv', 'Date,Description,Amount,Debit/Credit\n02/11/2026,SWIGGY,450.00,Debit\n03/11/2026,PAYMENT,100.00,Credit\n'))
  await page.getByText('Found').first().waitFor()
  eq(await findRows(page).count(), 1)
})

// ================================================================== D. bills and subscriptions
const makeBill = async (page, f) => { await addExpense(page, { repeat: 'Monthly', ...f }) }
T('B-201', 'POS', 'Repeats = Monthly on Add expense makes a bill: Bills page words, yearly total, Due reminder', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await makeBill(page, { amount: '199', note: 'Netflix', date: '2026-11-03' })
  const b = await budgetNow(page)
  eq((b.recurring ?? []).length, 1)
  await toBills(page)
  const t = await bodyText(page)
  has(t, 'Recurring spend'); has(t, '₹2,388 a year'); has(t, 'Monthly · due in')
  noBad(t)
})
T('B-202', 'POS', 'quarterly and yearly words are right', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await addExpense(page, { amount: '1200', note: 'Insurance', repeat: 'Quarterly', date: '2026-10-01' })
  await addExpense(page, { amount: '12000', note: 'Domain', repeat: 'Yearly', date: '2026-06-01' })
  await toBills(page)
  const t = await bodyText(page)
  has(t, 'Quarterly · due'); has(t, '₹1,200 every 3 months'); has(t, '₹12,000 a year'); has(t, '₹400'); has(t, '₹1,000')
})
T('B-203', 'POS', 'Mark paid in Due adds this period\'s expense once; a second tap does not double it', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await makeBill(page, { amount: '199', note: 'Netflix', date: '2026-10-20' }) // next due 20 Nov
  await tab(page, 'Due')
  await page.getByRole('button', { name: 'Mark paid' }).first().click()
  await page.waitForTimeout(400)
  const n1 = liveE(await budgetNow(page)).filter((e) => e.note === 'Netflix').length
  eq(n1, 2)
  await page.getByRole('button', { name: 'Mark paid' }).first().click().catch(() => {})
  await page.waitForTimeout(400)
  const n2 = liveE(await budgetNow(page)).filter((e) => e.note === 'Netflix').length
  ok(n2 <= 3, 'a second Mark paid added more than one period: ' + n2)
  const dates = liveE(await budgetNow(page)).filter((e) => e.note === 'Netflix').map((e) => e.date)
  eq(new Set(dates).size, dates.length, 'two entries share a date')
})
T('B-204', 'POS', 'Pause hides the reminder and adds no entries; Resume brings it back; Stop is undoable and keeps past entries', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await makeBill(page, { amount: '199', note: 'Netflix', date: '2026-11-03' })
  await toBills(page)
  // B20: Pause/Resume/Stop moved off the row into the bill's own detail sheet.
  await page.getByRole('button', { name: /^Edit Netflix/ }).click()
  await page.getByRole('button', { name: 'Pause this bill' }).click()
  has(await bodyText(page), 'Paused')
  await page.getByRole('button', { name: 'Resume this bill' }).click()
  has(await bodyText(page), 'Next due')
  await page.getByRole('button', { name: 'Stop this bill' }).click()
  has(await bodyText(page), 'No bills yet')
  await page.locator('.snack').getByRole('button', { name: 'Undo' }).click()
  has(await bodyText(page), 'Netflix')
  eq(liveE(await budgetNow(page)).length, 1)
})
T('B-205', 'NEG', 'Edit bill: empty name and zero amount are refused in plain words; a good edit updates the yearly words', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await makeBill(page, { amount: '199', note: 'Netflix', date: '2026-11-03' })
  await toBills(page)
  await page.getByRole('button', { name: /^Edit Netflix/ }).click()
  await S(page).locator('#bill-title').fill(''); await S(page).locator('#bill-amount').fill('0'); await save(page)
  const e = (await errs(page)).join('|')
  has(e, 'Give it a name'); has(e, 'Enter an amount above zero')
  await S(page).locator('#bill-title').fill('Netflix 4K'); await S(page).locator('#bill-amount').fill('649'); await save(page)
  await S(page).waitFor({ state: 'detached' })
  has(await bodyText(page), '₹649'); has(await bodyText(page), '₹7,788 a year')
})
T('B-206', 'UX', '"Add a bill" on the Bills page opens the sheet already on Monthly', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toBills(page)
  await page.getByRole('button', { name: 'Add a bill' }).click()
  has(await S(page).locator('.sheet__title, h2').first().innerText(), 'Add a bill')
  eq(await S(page).getByRole('radio', { name: 'Monthly', exact: true }).getAttribute('aria-checked'), 'true')
})
T('B-207', 'POS', 'a bill dated on the 31st lands on the last day of shorter months', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await makeBill(page, { amount: '100', note: 'Gym', date: '2026-01-31' })
  await toBills(page)
  has(await bodyText(page), '30 Nov')
})
T('B-208', 'UX', 'a refund or a card bill has no Repeats choice (only spending repeats)', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await openAdd(page)
  await fill(page, { kind: 'Refund' })
  eq(await S(page).getByRole('radio', { name: 'Quarterly' }).count(), 0)
})
T('B-209', 'UX', 'three monthly entries with the same note make the app offer "Make it a bill"; Not now is remembered', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-08-05', '500', { note: 'Gym' }), exp('2026-09-05', '500', { note: 'Gym' })] }) })
  await openAdd(page); await fill(page, { amount: '500', date: '2026-10-05', note: 'Gym' })
  has(await S(page).innerText(), 'Looks like a monthly bill')
  await S(page).getByRole('button', { name: 'Not now' }).click()
  lacks(await S(page).innerText(), 'Looks like a monthly bill')
  await fill(page, { note: 'Gym ' }) // still the same key
  lacks(await S(page).innerText(), 'Looks like a monthly bill')
})
T('B-210', 'UX', '"Make it a bill" turns Repeats to Monthly and saving makes the bill', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-08-05', '500', { note: 'Yoga' }), exp('2026-09-05', '500', { note: 'Yoga' })] }) })
  await openAdd(page); await fill(page, { amount: '500', date: '2026-10-05', note: 'Yoga' })
  await S(page).getByRole('button', { name: 'Make it a bill' }).click()
  await save(page); await S(page).waitFor({ state: 'detached' })
  eq(((await budgetNow(page)).recurring ?? []).length, 1)
})
T('B-211', 'UX', 'the suggestion does not appear for different amounts or irregular dates', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-08-05', '500', { note: 'Misc' }), exp('2026-09-25', '900', { note: 'Misc' })] }) })
  await openAdd(page); await fill(page, { amount: '500', date: '2026-10-05', note: 'Misc' })
  lacks(await S(page).innerText(), 'Looks like a monthly bill')
})
T('B-212', 'RUNTIME', 'a stopped bill removed from Due does not leave a ghost: Bills page and Due agree', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await makeBill(page, { amount: '199', note: 'Netflix', date: '2026-11-03' })
  await toBills(page)
  await page.getByRole('button', { name: /^Edit Netflix/ }).click()
  await page.getByRole('button', { name: 'Stop this bill' }).click()
  await page.getByRole('button', { name: /back/i }).first().click()
  // The Stop snackbar ("Stopped "Netflix" · Undo") says the bill's name too, and outlives the tab switch
  // (it dismisses itself after 8s, see SnackBar.tsx) -- wait it out so it can't make this check a false positive.
  await page.waitForSelector('.snack', { state: 'detached', timeout: 9000 }).catch(() => {})
  await tab(page, 'Due')
  lacks(await bodyText(page), 'Netflix')
})

// ================================================================== E. refunds, search, cycle, trip, bulk, history
T('B-301', 'POS', 'a refund lowers the month total, shows a minus and the word Refund; "Biggest spends" leaves it out', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '1000', { categoryId: 'c-food' }), exp('2026-11-04', '400', { refund: true, categoryId: 'c-food', note: 'Returned shirt' })] }) })
  has(await page.locator('.budget__hero').first().innerText(), '₹600')
  await toSummary(page); await entriesTab(page)
  const t = await SUM(page).innerText()
  has(t, 'Refund'); has(t, '−₹400')
})
T('B-302', 'CORNER', 'refund bigger than all spending shows a negative total in words, no NaN, no crash', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '100'), exp('2026-11-04', '400', { refund: true })] }) })
  const t = await bodyText(page); noBad(t)
  has(await page.locator('.budget__hero').first().innerText(), '₹')
  await toSummary(page)
  noBad(await bodyText(page))
})
T('B-303', 'POS', 'Add refund through the form: title changes, saved with refund true, positive amount stored', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fill(page, { kind: 'Refund', amount: '250', note: 'return' })
  has(await S(page).innerText(), 'Add refund')
  await save(page); await S(page).waitFor({ state: 'detached' })
  const e = liveE(await budgetNow(page))[0]
  eq([e.amount, e.refund], ['250', true])
})
T('B-304', 'POS', 'search: note, category, amount, mode words, every word must match, case-insensitive, across months', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '250', { note: 'Dinner at Taj', categoryId: 'c-food', mode: 'upi' }), exp('2026-09-03', '99', { note: 'Coffee', categoryId: 'c-food' }), exp('2026-11-05', '20', { note: 'Auto', mode: 'cash' })] }) })
  await toSummary(page); await entriesTab(page)
  const q = SUM(page).locator('input[type=search]')
  await q.fill('TAJ'); has(await SUM(page).innerText(), '1 entry match')
  await q.fill('food upi'); has(await SUM(page).innerText(), '1 entry match')
  await q.fill('food'); has(await SUM(page).innerText(), '2 entries match')
  await q.fill('99'); has(await SUM(page).innerText(), '1 entry match')
  await q.fill('zzz'); has(await SUM(page).innerText(), 'Nothing matches')
})
T('B-305', 'CORNER', 'search with regex-hostile text, emoji, 300 characters and spaces never throws', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '250', { note: 'Dinner' })] }) })
  await toSummary(page); await entriesTab(page)
  const q = SUM(page).locator('input[type=search]')
  for (const s of ['(((', '[a-', '\\', '.*', '$^', '😀', 'x'.repeat(300), '   ', '%', '+']) { await q.fill(s); await page.waitForTimeout(30) }
  noBad(await bodyText(page))
})
T('B-306', 'UX', 'clearing the search brings the month list back', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '250', { note: 'Dinner' })] }) })
  await toSummary(page); await entriesTab(page)
  await SUM(page).locator('input[type=search]').fill('Dinner')
  await SUM(page).getByRole('button', { name: 'Clear search' }).click()
  has(await SUM(page).innerText(), 'Entries')
})
T('B-307', 'POS', 'statement cycle: pick the card, switch to Statement cycle, entries move by the statement day', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-04', '100', { mode: 'credit', instrumentId: 'i-neo' }), exp('2026-11-06', '700', { mode: 'credit', instrumentId: 'i-neo' })] }) })
  await toSummary(page)
  await SUM(page).locator('.spend__scope[aria-label^="Showing"]').click()
  await page.locator('.pick__opt, .sheet button').filter({ hasText: /Tata Neo/ }).first().click()
  await SUM(page).getByRole('radio', { name: 'Statement cycle' }).click()
  const t = await SUM(page).innerText()
  has(t, 'Statement cycle: 6 Oct to 5 Nov'); has(t, '₹100'); lacks(t, '₹700'); lacks(t, 'Day by day')
  noBad(t)
})
T('B-308', 'POS', 'card statement cycle is not offered for a card without a statement day', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-04', '100', { mode: 'credit', instrumentId: 'i-visa' })] }) })
  await toSummary(page)
  await SUM(page).locator('.spend__scope[aria-label^="Showing"]').click()
  await page.locator('.pick__opt, .sheet button').filter({ hasText: /Visa Gold/ }).first().click()
  eq(await SUM(page).getByRole('radio', { name: 'Statement cycle' }).count(), 0)
})
T('B-309', 'POS', 'trip total: a category chosen shows "Goa trip · ₹ across N entries" for the month and for all months', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-04', '5000', { categoryId: 'c-goa' }), exp('2026-11-05', '2500.50', { categoryId: 'c-goa' }), exp('2026-10-05', '8000', { categoryId: 'c-goa' })] }) })
  await toSummary(page)
  await page.getByRole('button', { name: /^Goa trip/ }).first().click()
  const t = await SUM(page).innerText()
  has(t, 'Goa trip · ₹7,500.50 across 2 entries'); has(t, '₹15,500.50 across 3 entries in all months')
})
T('B-310', 'POS', 'bulk recategorise: tick two, Change category, move, Undo puts both back', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '100', { categoryId: 'c-food', note: 'a' }), exp('2026-11-04', '200', { categoryId: 'c-food', note: 'b' }), exp('2026-11-05', '300', { categoryId: 'c-food', note: 'c' })] }) })
  await toSummary(page); await entriesTab(page)
  await SUM(page).getByRole('button', { name: /Select entries to change their category/ }).click()
  await SUM(page).getByRole('checkbox', { name: /Select ₹100/ }).click().catch(async () => { await page.getByRole('checkbox').first().click() })
  await page.getByRole('checkbox').nth(1).click()
  await page.getByRole('button', { name: 'Change category' }).click()
  await page.locator('.pick__opt').filter({ has: page.locator('.pick__label', { hasText: /^Rent$/ }) }).first().click()
  const moved = liveE(await budgetNow(page)).filter((e) => e.categoryId === 'c-rent')
  eq(moved.length, 2)
  await page.locator('.snack').getByRole('button', { name: 'Undo' }).click()
  eq(liveE(await budgetNow(page)).filter((e) => e.categoryId === 'c-rent').length, 0)
})
T('B-311', 'NEG', 'bulk: Change category with nothing ticked says so in words; Cancel leaves everything alone', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '100', { categoryId: 'c-food' }), exp('2026-11-04', '200', { categoryId: 'c-food' })] }) })
  await toSummary(page); await entriesTab(page)
  await SUM(page).getByRole('button', { name: /Select entries to change their category/ }).click()
  await page.getByRole('button', { name: 'Change category' }).click()
  has(await bodyText(page), 'Tick at least one entry first')
  await page.getByRole('button', { name: 'Cancel' }).click()
  eq(await page.getByRole('checkbox').count(), 0)
})
T('B-312', 'POS', 'edit history: changing the amount and category lists plain-word lines in the edit sheet', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '100', { categoryId: 'c-food', note: 'x' })] }) })
  await page.getByRole('button', { name: /^Edit ₹100/ }).first().click()
  await S(page).locator('#exp-amount').fill('150'); await chooseCat(page, 'Rent'); await save(page)
  await S(page).waitFor({ state: 'detached' })
  await page.getByRole('button', { name: /^Edit ₹150/ }).first().click()
  const t = await S(page).locator('[aria-label="Changes to this entry"]').innerText()
  has(t.replace(/\n/g, ' | '), 'was ₹100', 'amount change')
  has(t.replace(/\n/g, ' | '), 'category was Food', 'category change')
  noBad(t)
})
T('B-313', 'CORNER', 'ten edits keep at most 10 lines in the history, the sheet shows 3 and counts the rest', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '100', { note: 'x' })] }) })
  for (let i = 1; i <= 12; i++) {
    await page.getByRole('button', { name: /^Edit ₹/ }).first().click()
    await S(page).locator('#exp-amount').fill(String(100 + i)); await save(page); await S(page).waitFor({ state: 'detached' })
  }
  const e = liveE(await budgetNow(page))[0]
  ok(e.edits.length <= 10, 'more than 10 edits kept: ' + e.edits.length)
  await page.getByRole('button', { name: /^Edit ₹/ }).first().click()
  has(await S(page).innerText(), 'earlier changes')
})
T('B-314', 'CORNER', 'editing without changing anything adds no history line', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '100', { note: 'x' })] }) })
  await page.getByRole('button', { name: /^Edit ₹100/ }).first().click(); await save(page); await S(page).waitFor({ state: 'detached' })
  eq(liveE(await budgetNow(page))[0].edits ?? [], [])
})

// ================================================================== F. Paid with tree, cards, utilisation, card cost
T('B-401', 'POS', 'Paid with tree: UPI with no account chosen shows "Bank account (default)"; credit shows the card; empty month hides the card', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '100', { mode: 'upi' }), exp('2026-11-04', '1000', { mode: 'credit', instrumentId: 'i-neo' })] }) })
  await toSummary(page)
  const card = page.locator('section[aria-label="Paid with"]')
  await card.getByRole('button', { name: /^UPI/ }).click()
  has(await card.innerText(), 'Bank account (default)')
  const other = await c.open({ budget: BASE() })
  await toSummary(other.page)
  eq(await other.page.locator('section[aria-label="Paid with"]').count(), 0)
})
T('B-402', 'POS', 'credit utilisation: "Using 34% of ₹1,50,000 limit"; over the limit says so in words; no limit = no line', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '51000', { mode: 'credit', instrumentId: 'i-neo' })] }) })
  await toCards(page)
  has(await pageOf(page, 'Categories and cards').locator('.navrow', { hasText: 'Tata Neo' }).innerText(), 'Using 34%')
  has(await pageOf(page, 'Categories and cards').locator('.navrow', { hasText: 'Tata Neo' }).innerText(), '1,50,000')
  lacks(await pageOf(page, 'Categories and cards').locator('.navrow', { hasText: 'Visa Gold' }).innerText(), 'Using')
  const o = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '160000', { mode: 'credit', instrumentId: 'i-neo' })] }) })
  await toCards(o.page)
  const t = await pageOf(o.page, 'Categories and cards').locator('.navrow', { hasText: 'Tata Neo' }).innerText()
  ok(/over|above|more than/i.test(t), 'over the limit not said in words: ' + t)
})
T('B-403', 'POS', 'card cost: annual fee plus fee/interest category entries for this year, shown in the card form', async (c) => {
  const b = BASE({ categories: [...CATS(), cat('c-fee', 'Card interest and fees')], expenses: [exp('2026-11-03', '300', { categoryId: 'c-fee', mode: 'credit', instrumentId: 'i-neo' })] })
  const { page } = await c.open({ budget: b }); await toCards(page)
  await pageOf(page, 'Categories and cards').locator('.navrow', { hasText: 'Tata Neo' }).click()
  const t = await S(page).innerText()
  has(t, 'cost you'); has(t, '₹800')
})
T('B-404', 'POS', 'card bill reminder from the card form makes a Due reminder and a "Card bill reminders" row; it never adds an expense', async (c) => {
  const { page } = await c.open({ budget: BASE() }); await toCards(page)
  await pageOf(page, 'Categories and cards').locator('.navrow', { hasText: 'Tata Neo' }).click()
  await S(page).locator('summary', { hasText: 'More details' }).click()
  const sw = S(page).getByRole('switch', { name: /Remind me about this card's bill/ })
  ok(await sw.count() === 1, 'no reminder switch in the card form')
  await sw.click(); await S(page).getByRole('button', { name: 'Save', exact: true }).click()
  await S(page).waitFor({ state: 'detached' })
  eq(liveE(await budgetNow(page)).length, 0)
  const d = await stored(page)
  eq((d.budget.recurring ?? []).filter((r) => r.kind === 'cardBill').length, 1)
  eq(d.reminders.length, 1)
})

// ================================================================== G. CSV export
T('B-501', 'POS', 'Export sheet: counts entries for the range, empty range says so in words, file has BOM and quoted cells', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '250.5', { note: 'dinner, "friends"', categoryId: 'c-food' }), exp('2026-11-04', '10', { note: '=HYPERLINK("http://x")' }), exp('2026-09-04', '10')] }) })
  await toSummary(page)
  await page.getByRole('button', { name: /Export expenses/ }).click()
  has(await S(page).innerText(), '2 entries in this range')
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), footBtn(page).click()])
  const path = await dl.path()
  const text = readFileSync(path, 'utf8')
  ok(text.charCodeAt(0) === 0xfeff, 'no BOM')
  has(text, '"dinner, ""friends"""'); has(text, "'=HYPERLINK"); lacks(text, ',=HYPERLINK')
})
T('B-502', 'NEG', 'exporting an empty range is refused with a plain message and no download', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-01-03', '10')] }) })
  await toSummary(page)
  await page.getByRole('button', { name: /Export expenses/ }).click()
  await footBtn(page).click()
  has((await errs(page)).join('|'), 'no entries in this range')
})
T('B-503', 'UX', 'range chips change the count; All includes older entries', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '1'), exp('2026-10-03', '1'), exp('2025-05-03', '1')] }) })
  await toSummary(page)
  await page.getByRole('button', { name: /Export expenses/ }).click()
  await S(page).getByRole('button', { name: 'All', exact: true }).click()
  has(await S(page).innerText(), '3 entries')
  await S(page).getByRole('button', { name: 'This year' }).click()
  has(await S(page).innerText(), '2 entries')
})

// ================================================================== H. Add expense after "="
const calc = async (page, ...names) => { for (const n of names) await page.locator(`.key[aria-label="${n}"]`).click() }
T('B-601', 'POS', '12 x 5 = then the Add expense chip opens the sheet with 60 and the note "from calculator"', async (c) => {
  const { page } = await c.open({ data: seed(BASE(), { startupTab: 'calculate' }) })
  await calc(page, '1', '2', 'Multiply', '5', 'Equals')
  await page.locator('.result-actions').getByRole('button', { name: 'Add expense' }).click()
  eq(await S(page).locator('#exp-amount').inputValue(), '60')
  eq(await S(page).locator('#exp-note').inputValue(), 'from calculator')
  await save(page); await S(page).waitFor({ state: 'detached' })
  eq(liveE(await budgetNow(page)).map((e) => e.amount), ['60'])
})
T('B-602', 'NEG', 'a negative or zero result offers no Add expense chip', async (c) => {
  const { page } = await c.open({ data: seed(BASE(), { startupTab: 'calculate' }) })
  await calc(page, '5', 'Subtract', '9', 'Equals')
  eq(await page.locator('.result-actions').getByRole('button', { name: 'Add expense' }).count(), 0)
  await calc(page, 'Clear', '5', 'Subtract', '5', 'Equals')
  eq(await page.locator('.result-actions').getByRole('button', { name: 'Add expense' }).count(), 0)
})
T('B-603', 'CORNER', '10 / 3 = gives 3.33 in the amount box (rounded to paise), not an error', async (c) => {
  const { page } = await c.open({ data: seed(BASE(), { startupTab: 'calculate' }) })
  await calc(page, '1', '0', 'Divide', '3', 'Equals')
  await page.locator('.result-actions').getByRole('button', { name: 'Add expense' }).click()
  eq(await S(page).locator('#exp-amount').inputValue(), '3.33')
  await save(page); await S(page).waitFor({ state: 'detached' })
})
T('B-604', 'CORNER', 'a result above 10 crore opens the sheet and says the amount is too big instead of saving', async (c) => {
  const { page } = await c.open({ data: seed(BASE(), { startupTab: 'calculate' }) })
  await calc(page, '9', '9', '9', '9', '9', '9', '9', '9', '9', '9', 'Multiply', '9', 'Equals')
  await page.locator('.result-actions').getByRole('button', { name: 'Add expense' }).click()
  await save(page)
  has((await errs(page)).join('|'), '10 crore')
  eq(liveE(await budgetNow(page)).length, 0)
})
T('B-605', 'UI', 'the chip row fits at 360px and at 200% font', async (c) => {
  for (const o of [{}, { font: 200 }]) {
    const { page } = await c.open({ data: seed(BASE(), { startupTab: 'calculate' }), ...o })
    await calc(page, '1', '2', 'Multiply', '5', 'Equals')
    eq(await overflowing(page), [], 'chip row overflows ' + J(o))
  }
})

// ================================================================== I. a month of use
T('B-701', 'RUNTIME', 'a month of use: 120 entries across 9 categories, a limit, 3 bills: totals exact, no NaN, scrolling screens stay inside', async (c) => {
  const cats = ['c-food', 'c-trav', 'c-goa', 'c-rent', 'c-bills', null]
  const expenses = []
  let total = 0n
  for (let i = 0; i < 120; i++) {
    const paise = BigInt(1000 + ((i * 7919) % 90000))
    total += paise
    expenses.push(exp(`2026-11-${String((i % 14) + 1).padStart(2, '0')}`, `${paise / 100n}.${String(paise % 100n).padStart(2, '0')}`, { categoryId: cats[i % 6], mode: i % 3 ? 'upi' : 'cash', note: `n${i}` }))
  }
  const { page } = await c.open({ budget: BASE({ expenses, overall: '60000' }) })
  const hero = await page.locator('.budget__hero').first().innerText()
  ok(/₹/.test(hero), 'no hero')
  noBad(await bodyText(page))
  await toSummary(page)
  const t = await SUM(page).locator('section[aria-label="Total"] .budget__hero').innerText()
  const want = `${total / 100n}${total % 100n === 0n ? '' : '.' + String(total % 100n).padStart(2, '0')}` // whole rupees drop .00
  eq(t.replace(/[₹,\s]/g, ''), want, 'month total')
  eq(await overflowing(page), [])
})
T('B-702', 'RUNTIME', 'switching months 24 times quickly and opening/closing the sheet 10 times leaves no errors', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '100')] }) })
  for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'Previous month' }).click()
  for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'Next month' }).click()
  for (let i = 0; i < 10; i++) { await openAdd(page); await S(page).getByRole('button', { name: /close/i }).first().click(); await S(page).waitFor({ state: 'detached' }) }
  noBad(await bodyText(page))
})
T('B-703', 'UX', 'every delete is undoable: entry, bill stop, bulk move all show an Undo', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '100', { categoryId: 'c-food' })] }) })
  await page.getByRole('button', { name: /^Edit/ }).first().click(); await S(page).getByRole('button', { name: 'Delete this expense' }).click()
  ok(await page.locator('.snack').getByRole('button', { name: 'Undo' }).count() === 1, 'no Undo after deleting an entry')
})

// ---------------------------------------------------------------- runner
const only = process.argv.slice(2)
const wanted = cases.filter((c) => only.length === 0 || only.some((p) => c.id.startsWith(p)))
if (process.env.APP_URL) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  APP = { url: process.env.APP_URL, browser, async stop() { await browser.close() } }
} else APP = await startApp()
let failed = 0, done = 0
async function runCase(c) {
  const ctx = makeCtx()
  let msg = null
  try {
    await Promise.race([c.fn(ctx), new Promise((_, rej) => setTimeout(() => rej(new Error('case timed out after 90s')), 90000))])
    for (const p of ctx.pages) if (p.errors.length) msg = 'console/page errors: ' + p.errors.slice(0, 2).join(' | ')
  } catch (e) { msg = String(e.message ?? e).replace(/\n+/g, ' | ').slice(0, 700) }
  for (const p of ctx.pages) await p.close().catch(() => {})
  done++
  if (msg) failed++
  console.log(msg ? `FAIL ${c.id} ${c.type} ${c.title} :: ${msg}` : `PASS ${c.id} ${c.type} ${c.title}`)
}
let idx = 0
await Promise.all(Array.from({ length: Number(process.env.CONC ?? 3) }, async () => { while (idx < wanted.length) await runCase(wanted[idx++]) }))
await APP.stop()
console.log(`\n${done} cases, ${done - failed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
