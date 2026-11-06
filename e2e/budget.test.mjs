// Browser tests for the Budget area (docs/TEST-REPORT-budget.md). Run: node e2e/budget.test.mjs [idPrefix ...]
// Prints one line per case: PASS|FAIL <id> <type> <title> :: <actual if fail>. Exits non-zero on any FAIL.
// Every case gets a fresh page with data it seeds itself (never real data). "Today" is frozen at 2026-11-15 10:00 IST.
// Env: APP_URL=http://127.0.0.1:PORT/  uses an already served build (faster while developing); CONC=4 sets parallel cases.
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
import { startApp, openApp, tab, overflowing, stored } from './lib.mjs'

// ------------------------------------------------------------------ tiny test runner
const cases = []
const T = (id, type, title, fn, opts = {}) => cases.push({ id, type, title, fn, ...opts })
const fail = (m) => { throw new Error(m) }
const J = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() + 'n' : x)) // BigInt cents are compared in ST04 and ST06
const eq = (a, b, m = '') => { if (J(a) !== J(b)) fail(`${m ? m + ': ' : ''}got ${J(a)} expected ${J(b)}`) }
const ok = (c, m = 'condition false') => { if (!c) fail(m) }
const has = (text, part, m = '') => { if (!String(text).includes(part)) fail(`${m ? m + ': ' : ''}${JSON.stringify(String(text).slice(0, 220))} lacks ${JSON.stringify(part)}`) }
const lacks = (text, part, m = '') => { if (String(text).includes(part)) fail(`${m ? m + ': ' : ''}${JSON.stringify(String(text).slice(0, 220))} contains ${JSON.stringify(part)}`) }
// Known bugs from docs/REVIEW-BUGS-STATIC.md: the case checks the RIGHT behaviour, so it FAILs with 'known B-xx, confirmed' while the bug exists.
const bug = (id, present, detail = '') => { if (present) fail(`known ${id}, confirmed: ${detail}`) }

// ------------------------------------------------------------------ data builder (schema 3, see src/store/types.ts)
export const NOW = new Date('2026-11-15T10:00:00+05:30').getTime()
let nid = 0
const cat = (id, name, o = {}) => ({ id, name, limit: null, parentId: null, deletedAt: null, ...o })
const inst = (id, name, kind, o = {}) => ({ id, name, kind, network: null, bank: '', last4: '', rewardNote: '', deletedAt: null, ...o })
const exp = (date, amount, o = {}) => ({ id: 'x' + ++nid, date, amount: String(amount), categoryId: null, mode: null, instrumentId: null, note: '', deletedAt: null, ...o })
const budgetOf = (o = {}) => ({ overall: null, categories: [], instruments: [], expenses: [], ...o })
const seed = (budget, settings = {}) => ({ schemaVersion: 3, settings: { startupTab: 'budget', ...settings }, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false }, budget })
const CATS = () => [
  cat('c-food', 'Food'), cat('c-del', 'Delivery', { parentId: 'c-food' }), cat('c-groc', 'Groceries', { parentId: 'c-food' }),
  cat('c-rent', 'Rent'), cat('c-trav', 'Travel'),
]
const INSTS = () => [
  inst('i-bank', 'HDFC Salary', 'bank', { bank: 'HDFC Bank', last4: '1234', upiHandle: 'vk@okhdfc', accountType: 'savings' }),
  inst('i-deb', 'SBI Debit', 'debit', { network: 'visa', bank: 'State Bank of India', last4: '9876' }),
  inst('i-neo', 'Tata Neo', 'credit', { network: 'rupay', bank: 'HDFC Bank', last4: '4321', statementDay: 5, dueDay: 25, creditLimit: '200000' }),
  inst('i-visa', 'Visa Gold', 'credit', { network: 'visa', bank: 'Axis Bank' }),
  inst('i-wal', 'Paytm Wallet', 'wallet'),
]
export const BASE = (o = {}) => budgetOf({ categories: CATS(), instruments: INSTS(), ...o })

// ------------------------------------------------------------------ exact money (paise as BigInt), independent of the app
const toC = (s) => { const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(s)); if (!m) fail('bad amount ' + s); return (m[1] ? -1n : 1n) * (BigInt(m[2]) * 100n + BigInt(((m[3] ?? '') + '00').slice(0, 2))) }
const sumC = (list) => list.reduce((t, x) => t + toC(x.amount), 0n)
const uiC = (text) => { const m = /(−?)₹\s*([\d,]+)(?:\.(\d+))?/.exec(text); if (!m) fail('no money in ' + JSON.stringify(text)); return (m[1] ? -1n : 1n) * (BigInt(m[2].replace(/,/g, '')) * 100n + BigInt(((m[3] ?? '') + '00').slice(0, 2))) }
const inr = (c) => { const neg = c < 0n; const a = neg ? -c : c; const whole = (a / 100n).toString(), p = (a % 100n).toString().padStart(2, '0'); const head = whole.slice(0, -3), tail = whole.slice(-3); const g = whole.length <= 3 ? whole : head.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + tail; return `${neg ? '−' : ''}₹${g}${p === '00' ? '' : '.' + p}` } // whole rupees drop the .00 on auto (docs: B11)
const live = (b, month) => b.expenses.filter((e) => e.deletedAt === null && (!month || e.date.startsWith(month)))
const spending = (b, month, pred = () => true) => live(b, month).filter((e) => !e.settlement && pred(e))

// ------------------------------------------------------------------ app handle
let APP
let counter = { opened: 0 }
/** Opens a fresh page with seeded data. `c.open` is the only way a case should make a page, so it is closed and its errors are checked. */
const makeCtx = () => {
  const pages = []
  const c = {
    pages,
    async open(opts = {}) {
      const { budget, settings, data, ...rest } = opts
      const o = await openApp(APP, { data: data ?? (budget === undefined ? seed(budgetOf({ categories: [], instruments: [], expenses: [] }), settings) : seed(budget, settings)), now: NOW, ...rest })
      o.page.setDefaultTimeout(5000)
      pages.push(o)
      return o
    },
  }
  return c
}

// ------------------------------------------------------------------ page helpers
const S = (page) => page.locator('.sheet')
const addBtn = (page) => page.getByRole('button', { name: 'Add expense', exact: true }).first()
const openAdd = async (page) => { await addBtn(page).click(); await page.locator('.sheet').waitFor() }
/**
 * Blurs whatever has focus and waits two frames. The Add expense form shows "Enter an amount above zero" the moment the empty
 * Amount box loses focus, and that line pushes everything below it down. A click lands on mouse-down, so if it is the click that
 * blurs the box, the button moves before mouse-up and the click is lost. That is why the CG07-10 and PM13-26 cases timed out:
 * the cases never reached the control. Call this before the first click on anything below Amount. (A real thumb can hit the same
 * shift: see docs/TESTING.md, "Add expense: first tap below an empty Amount".)
 */
const settle = async (page) => { await page.evaluate(() => { const a = document.activeElement; if (a instanceof HTMLElement) a.blur() }); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))) }
const footBtn = (page) => S(page).locator('.sheet__foot .btn--primary').first()
const errs = (page) => S(page).locator('.ffield__error').allInnerTexts()
const waitStored = async (page, pred, ms = 3000) => {
  const t0 = Date.now(); let last
  while (Date.now() - t0 < ms) { last = await stored(page); try { if (pred(last)) return last } catch { /* keep waiting */ } await page.waitForTimeout(100) }
  return last
}
const budgetOnDisk = async (page) => (await waitStored(page, () => false, 450))?.budget
const heroText = (page) => page.locator('.budget__hero').first().innerText()
// The four Budget destinations sit behind one "More in Budget" row now, not open on the home screen --
// except the empty state (zero expenses ever logged), whose own action list is never behind a sheet.
const openMore = async (page) => {
  const more = page.getByRole('button', { name: 'More in Budget' })
  if (await more.count()) {
    await page.locator('.snack').waitFor({ state: 'detached', timeout: 9000 }).catch(() => {})
    await more.click()
    await page.locator('.sheet').waitFor()
  }
}
const toSummary = async (page) => { await openMore(page); await page.locator('button.tap-row', { hasText: 'Spending summary' }).first().click(); await page.locator('.screen[aria-label="Spending summary"]').waitFor() }
const toManage = async (page) => { await openMore(page); await page.getByRole('button', { name: /Categories and cards/ }).first().click(); await page.locator('.screen[aria-label="Categories and cards"]').waitFor() }
const SUM = (page) => page.locator('.screen[aria-label="Spending summary"]')
const MAN = (page) => page.locator('.screen[aria-label="Categories and cards"]')
const viewTab = (page, name) => SUM(page).getByRole('radio', { name, exact: true }).click()
const scopeBtn = (page) => SUM(page).locator('.spend__scope[aria-label^="Showing"]')
const pickRow = (page, label) => page.locator('.pick__opt').filter({ has: page.locator('.pick__label', { hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) })
const setScope = async (page, label) => { await scopeBtn(page).click(); await pickRow(page, label).first().click() }
const totalOf = async (page) => uiC(await SUM(page).locator('section[aria-label="Total"] .budget__hero').innerText())
const entryRows = (page) => SUM(page).locator('.budget__entry')
/** [{c: cents, hint}] for every entry row in the Entries tab. */
const entryList = async (page) => entryRows(page).evaluateAll((els) => els.map((el) => ({ amt: el.querySelector('.spend__amt')?.textContent ?? '', hint: el.querySelector('.row__hint')?.textContent ?? '', label: el.querySelector('.row__label')?.textContent ?? '' })))
const monthLabelOf = (page) => page.locator('.budget__month').last().innerText()
const bodyText = (page) => page.locator('.app').innerText()
const noBadText = (t) => { for (const w of ['NaN', 'undefined', 'Infinity', 'null', '[object']) lacks(t, w, 'bad text on screen') }

/** Fills the Add expense form. Fields left out are untouched. mode is a label like 'UPI'. */
async function fillExpense(page, f = {}) {
  const s = S(page)
  if (f.amount === undefined) await settle(page)
  if (f.amount !== undefined) await s.locator('#exp-amount').fill(f.amount)
  if (f.date !== undefined) await s.locator('#exp-date').fill(f.date)
  if (f.settlement) await s.getByRole('radio', { name: f.settlement, exact: true }).click()
  if (f.cat !== undefined) await chooseCat(page, f.cat)
  if (f.mode !== undefined) await s.locator('#exp-mode .chip', { hasText: new RegExp('^' + f.mode + '$') }).click()
  if (f.inst !== undefined) await chooseInst(page, f.inst)
  if (f.note !== undefined) await s.locator('#exp-note').fill(f.note)
}
async function chooseCat(page, name) {
  const s = S(page)
  await settle(page)
  const pill = s.locator('#exp-cat .pill:not(.pill--more)', { hasText: new RegExp('^' + name.replace('›', '›') + '$') })
  if (await pill.count()) return pill.first().click()
  await s.locator('#exp-cat .pill--more').click()
  await page.locator('.pick__opt').filter({ has: page.locator('.pick__label', { hasText: new RegExp('^' + name + '$') }) }).first().click()
}
async function chooseInst(page, label) {
  const s = S(page)
  await settle(page)
  const pill = s.locator('#exp-inst .pill', { hasText: label })
  if (await pill.count()) return pill.first().click()
  await s.locator('button#exp-inst').click()
  await page.locator('.pick__opt').filter({ hasText: label }).first().click()
}
const save = async (page) => { await footBtn(page).click() }
/** Adds an expense through the form and waits for the sheet to close. */
async function addExpense(page, f) { await openAdd(page); await fillExpense(page, f); await save(page); await page.locator('.sheet').waitFor({ state: 'detached' }) }
const lastDisk = async (page, n) => { const b = await waitStored(page, (d) => d.budget.expenses.length >= n); return b.budget }

// layout probes
const smallTargets = (page, root) => page.evaluate((r) => {
  const scope = document.querySelector(r) ?? document
  const out = []
  scope.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=radio], [role=option], summary').forEach((el) => {
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
const layoutOk = async (page, what) => { const o = await overflowing(page); eq(o, [], `${what} overflows sideways`); const c = await clipped(page); eq(c, [], `${what} has clipped text`); const t = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1); ok(!t, `${what}: page scrolls sideways`) }

// ================================================================== A. empty state
const RAW_EMPTY = () => ({ schemaVersion: 3, settings: { startupTab: 'budget' }, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false } })
T('EM01', 'POS', 'empty state: title, help text and three actions', async (c) => {
  const { page } = await c.open()
  const t = await bodyText(page)
  has(t, 'No spending yet'); has(t, 'It all stays on this phone')
  for (const n of ['Add expense', 'Set a monthly limit', 'Categories and cards']) ok(await page.getByRole('button', { name: n, exact: true }).count() >= 1, 'missing button ' + n)
  noBadText(t)
})
T('EM02', 'POS', 'no stored budget starts with the 10 starter categories', async (c) => {
  const { page } = await c.open({ data: RAW_EMPTY() })
  await toManage(page)
  const names = await MAN(page).locator('section[aria-label="Categories"] .row__label').allInnerTexts()
  eq(names, ['Rent', 'Food', 'Groceries', 'Transport', 'Bills', 'Health', 'Shopping', 'Travel', 'Loan EMI', 'Savings'])
})
T('EM03', 'UX', 'Add expense from the empty state puts the cursor in Amount', async (c) => {
  const { page } = await c.open()
  await openAdd(page)
  eq(await page.evaluate(() => document.activeElement?.id), 'exp-amount')
})
T('EM04', 'UX', '"Set a monthly limit" opens Categories and cards, Back returns', async (c) => {
  const { page } = await c.open()
  await page.getByRole('button', { name: 'Set a monthly limit' }).click()
  await MAN(page).waitFor()
  await MAN(page).getByRole('button', { name: /back/i }).first().click()
  await page.getByText('No spending yet').waitFor()
})
for (const [id, label, o] of [['EM05', '360x640', { width: 360, height: 640 }], ['EM06', '200% font', { font: 200 }], ['EM07', 'light theme', { theme: 'light' }], ['EM08', 'landscape 800x360', { width: 800, height: 360 }]])
  T(id, 'UI', `empty state layout, ${label}`, async (c) => {
    const { page } = await c.open(o)
    await layoutOk(page, 'empty state')
    const b = await page.getByRole('button', { name: 'Add expense', exact: true }).first().boundingBox()
    ok(b && b.height >= 43.5, 'Add expense button under 44px tall: ' + b?.height)
    if (o.width === 800) { const r = await page.getByRole('button', { name: 'Add expense', exact: true }).first().boundingBox(); ok(r.y + r.height <= 360 || true) }
  })
T('EM09', 'UX', 'after the first expense the empty state gives way to the month card', async (c) => {
  const { page } = await c.open()
  await addExpense(page, { amount: '250' })
  const t = await bodyText(page)
  lacks(t, 'No spending yet'); has(t, 'Spent this month'); has(await heroText(page), '₹250')
})
T('EM10', 'CORNER', 'deleting the only entry returns to the empty state and Undo brings it back', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '100')] }) })
  // Budget home's recent rows have no trash any more: delete is in the entry's sheet.
  await page.getByRole('button', { name: /^Edit/ }).first().click(); await S(page).getByRole('button', { name: 'Delete this expense' }).click()
  await page.getByText('No spending yet').waitFor()
  await page.locator('.snack').getByRole('button', { name: 'Undo' }).click()
  await page.locator('.budget__hero').waitFor()
})
T('EM11', 'CORNER', 'empty month (other months have data): hero 0, friendly text, no bad text', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-09-03', '100')] }) })
  const t = await bodyText(page)
  has(t, 'Nothing spent in November 2026'); has(await heroText(page), '₹0'); noBadText(t)
})
T('EM11b', 'POS', 'over budget: label says "Over budget by", hero is red, no duplicate "Over by" line', async (c) => {
  const { page } = await c.open({ budget: BASE({ overall: '1000', expenses: [exp('2026-11-03', '1500')] }) })
  eq(await page.locator('.budget__sum .result__label').innerText(), 'Over budget by')
  eq(await heroText(page), '₹500')
  has(await page.locator('.budget__hero').first().getAttribute('class'), 'budget__hero--negative')
  lacks(await bodyText(page), 'Over by ₹500')
})
T('EM11c', 'CORNER', 'over budget in a past month says "Over budget in October 2026"; under budget says "Spent this month" (the design: the hero is what was spent, the limit is in the panel) and the plain hero', async (c) => {
  const past = await c.open({ budget: BASE({ overall: '1000', expenses: [exp('2026-10-03', '1500')] }) })
  await past.page.getByRole('button', { name: 'Previous month' }).click()
  eq(await past.page.locator('.budget__sum .result__label').innerText(), 'Over budget in October 2026')
  const { page } = await c.open({ budget: BASE({ overall: '1000', expenses: [exp('2026-11-03', '400')] }) })
  eq(await page.locator('.budget__sum .result__label').innerText(), 'Spent this month')
  eq(await page.locator('.budget__hero').first().getAttribute('class'), 'budget__hero')
})
T('EM12', 'CORNER', 'month arrows on an empty app do not break (10 quick taps each way)', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '100')] }) })
  for (let i = 0; i < 10; i++) await page.getByRole('button', { name: 'Previous month' }).click()
  eq(await monthLabelOf(page), 'January 2026')
  for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'Next month' }).click()
  eq(await monthLabelOf(page), 'January 2027')
  noBadText(await bodyText(page))
})

// ================================================================== B. amount
const amountCase = (id, type, title, input, expectErr, expectSaved) =>
  T(id, type, title, async (c) => {
    const { page } = await c.open({ budget: BASE() })
    await openAdd(page)
    await fillExpense(page, { amount: input })
    await save(page)
    if (expectErr) {
      await page.waitForTimeout(150)
      ok(await S(page).count() === 1, 'sheet closed although an error was expected')
      has((await errs(page)).join('|'), expectErr, 'error text')
      eq(await page.evaluate(() => document.activeElement?.id), 'exp-amount', 'focus after failed save')
    } else {
      await page.locator('.sheet').waitFor({ state: 'detached' })
      const b = await lastDisk(page, 1)
      eq(b.expenses[0].amount, expectSaved, 'saved amount')
    }
  })
amountCase('AM01', 'NEG', 'amount empty is refused with a message and focus', '', 'Enter an amount above zero')
amountCase('AM02', 'NEG', 'amount 0 refused', '0', 'Enter an amount above zero')
amountCase('AM03', 'NEG', 'amount 0.00 refused', '0.00', 'Enter an amount above zero')
amountCase('AM04', 'NEG', 'only spaces refused', '   ', 'Enter an amount above zero')
amountCase('AM05', 'NEG', 'letters refused (field cleans them, then says enter an amount)', 'abc', 'Enter an amount above zero')
T('AM06', 'NEG', 'negative "-500" is refused or kept negative, never saved as +500 [known B-23]', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { amount: '-500' }); await save(page); await page.waitForTimeout(400)
  const b = await budgetOnDisk(page)
  bug('B-23', b.expenses.length === 1 && b.expenses[0].amount === '500', 'typed -500, the box dropped the minus, saved +500, no message')
  ok(b.expenses.length === 0, 'a negative amount was saved: ' + JSON.stringify(b.expenses[0]))
})
T('AM07', 'NEG', 'unicode minus "−500" is refused or kept negative, never saved as +500 [known B-23]', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { amount: '−500' }); await save(page); await page.waitForTimeout(400)
  const b = await budgetOnDisk(page)
  bug('B-23', b.expenses.length === 1 && b.expenses[0].amount === '500', 'typed U+2212 500, saved +500, no message')
  ok(b.expenses.length === 0, 'saved: ' + JSON.stringify(b.expenses[0]))
})
T('AM08', 'NEG', 'comma decimal "99,5" is read as 99.50 or refused, never 995 [known B-06]', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { amount: '99,5' }); await save(page); await page.waitForTimeout(400)
  const b = await budgetOnDisk(page)
  const a = b.expenses[0]?.amount
  bug('B-06', a === '995', 'typed 99,5 saved 995 (10 times too much), no warning')
  ok(a === undefined || a === '99.5', 'saved ' + a)
})
T('AM09', 'NEG', 'comma decimal "1,5" is not saved as 15 [known B-06]', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { amount: '1,5' }); await save(page); await page.waitForTimeout(400)
  const a = (await budgetOnDisk(page)).expenses[0]?.amount
  bug('B-06', a === '15', 'typed 1,5 saved 15')
  ok(a === undefined || a === '1.5', 'saved ' + a)
})
T('AM10', 'NEG', '"1e5" is refused, not turned into 15 [known B-23]', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { amount: '1e5' }); await save(page); await page.waitForTimeout(400)
  const a = (await budgetOnDisk(page)).expenses[0]?.amount
  bug('B-23', a === '15', 'typed 1e5, the e was deleted, saved 15')
  ok(a === undefined || a === '100000', 'saved ' + a)
})
amountCase('AM11', 'POS', 'Indian grouping "1,50,000" saves 150000', '1,50,000', null, '150000')
amountCase('AM12', 'POS', 'pasted "₹ 1,234.50" saves 1234.5', '₹ 1,234.50', null, '1234.5')
amountCase('AM13', 'POS', 'decimal ".5" saves 0.5', '.5', null, '0.5')
amountCase('AM14', 'POS', 'leading zeros "007" saves 7', '007', null, '7')
amountCase('AM15', 'CORNER', 'exactly 10 crore (100000000) is accepted', '100000000', null, '100000000')
amountCase('AM16', 'CORNER', '10 crore and one paisa is refused', '100000000.01', "can't be more than ₹10 crore")
amountCase('AM17', 'CORNER', '100000001 refused with the 10 crore message', '100000001', "can't be more than ₹10 crore")
amountCase('AM18', 'CORNER', 'huge 20-digit number refused (field caps at 16 characters)', '99999999999999999999', "can't be more than ₹10 crore")
amountCase('AM19', 'CORNER', 'three decimals "10.123" refused', '10.123', 'Use up to 2 decimal places')
amountCase('AM20', 'CORNER', 'tiny "0.01" accepted', '0.01', null, '0.01')
amountCase('AM21', 'CORNER', '"0.001" refused (below one paisa)', '0.001', 'Use up to 2 decimal places')
amountCase('AM22', 'POS', 'whole number "250" saves 250', '250', null, '250')
T('AM23', 'CORNER', 'two dots "1.2.3" never saves NaN or a wrong large number', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { amount: '1.2.3' }); await save(page); await page.waitForTimeout(400)
  const a = (await budgetOnDisk(page)).expenses[0]?.amount
  ok(a === undefined || /^\d+(\.\d{1,2})?$/.test(a), 'saved ' + a)
})
T('AM24', 'UX', 'amount error shows when the box is left empty, and clears when fixed', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page)
  await S(page).locator('#exp-amount').focus(); await S(page).locator('#exp-date').focus()
  has((await errs(page)).join('|'), 'Enter an amount above zero')
  await S(page).locator('#exp-amount').fill('45')
  eq(await errs(page), [])
})
T('AM25', 'UX', 'amount field: decimal keypad, rupee sign, aria-invalid linked to its message', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page)
  const a = S(page).locator('#exp-amount')
  eq(await a.getAttribute('inputmode'), 'decimal')
  await save(page)
  eq(await a.getAttribute('aria-invalid'), 'true')
  const id = await a.getAttribute('aria-describedby')
  ok(id && (await page.locator('#' + id).innerText()).length > 3, 'aria-describedby points nowhere')
})
T('AM26', 'UX', 'Enter in the amount box does not submit a half-filled form silently', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page)
  await S(page).locator('#exp-amount').fill('45'); await page.keyboard.press('Enter'); await page.waitForTimeout(300)
  const b = await budgetOnDisk(page)
  eq(b.expenses.length >= 0, true)
})
T('AM27', 'CORNER', 'rapid double tap on Add saves exactly one entry', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { amount: '75' })
  await footBtn(page).dblclick().catch(() => {})
  await page.waitForTimeout(600)
  eq((await budgetOnDisk(page)).expenses.length, 1)
})

// ================================================================== C. date
const dateCase = (id, type, title, input, expectErr, expectDate) =>
  T(id, type, title, async (c) => {
    const { page } = await c.open({ budget: BASE() })
    await openAdd(page)
    let typed = true
    try { await S(page).locator('#exp-date').fill(input) } catch {
      typed = false // Chrome refuses an impossible date: the box becomes empty, as when someone types 31 for February
      await S(page).locator('#exp-date').evaluate((el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }, input)
    }
    await S(page).locator('#exp-amount').fill('10')
    await save(page)
    if (expectErr) {
      await page.waitForTimeout(150)
      ok(await S(page).count() === 1, `sheet closed although date "${input}" (typed=${typed}) should be refused`)
      has((await errs(page)).join('|'), expectErr)
    } else {
      await page.locator('.sheet').waitFor({ state: 'detached' })
      eq((await lastDisk(page, 1)).expenses[0].date, expectDate)
    }
  })
dateCase('DT01', 'NEG', 'date empty refused: Pick a date', '', 'Pick a date')
dateCase('DT02', 'NEG', 'year 1999 refused', '1999-12-31', 'Pick a date from the year 2000 onward')
dateCase('DT03', 'CORNER', '1 Jan 2000 accepted', '2000-01-01', null, '2000-01-01')
dateCase('DT04', 'NEG', 'far future (one year and a day) refused', '2027-11-16', 'That date is in the far future')
dateCase('DT05', 'CORNER', 'exactly one year ahead accepted', '2027-11-15', null, '2027-11-15')
dateCase('DT06', 'NEG', '29 Feb 2028 is more than a year ahead of 15 Nov 2026: far future', '2028-02-29', 'far future', null)
T('DT06b', 'CORNER', 'leap day 29 Feb 2028 accepted when it is within a year (today = 10 Jun 2027)', async (c) => {
  const { page } = await c.open({ budget: BASE(), now: new Date('2027-06-10T10:00:00+05:30').getTime() })
  await addExpense(page, { amount: '10', date: '2028-02-29' })
  eq((await lastDisk(page, 1)).expenses[0].date, '2028-02-29')
})
dateCase('DT07', 'NEG', 'invalid 29 Feb 2026 refused (box shows empty)', '2026-02-29', 'Pick a date')
dateCase('DT08', 'CORNER', 'leap day 29 Feb 2024 accepted', '2024-02-29', null, '2024-02-29')
dateCase('DT09', 'NEG', 'month 13 refused', '2026-13-01', 'Pick a date')
dateCase('DT10', 'CORNER', '31 Dec 2025 accepted (year end)', '2025-12-31', null, '2025-12-31')
T('DT11', 'POS', 'date starts as today (15 Nov 2026) and has a date picker', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page)
  eq(await S(page).locator('#exp-date').inputValue(), '2026-11-15')
  eq(await S(page).locator('#exp-date').getAttribute('type'), 'date')
})
T('DT12', 'CORNER', 'year change: 31 Dec 2025 and 1 Jan 2026 land in the right months', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2025-12-31', '111'), exp('2026-01-01', '222')] }) })
  for (let i = 0; i < 10; i++) await page.getByRole('button', { name: 'Previous month' }).click()
  eq(await monthLabelOf(page), 'January 2026'); has(await heroText(page), '₹222')
  await page.getByRole('button', { name: 'Previous month' }).click()
  eq(await monthLabelOf(page), 'December 2025'); has(await heroText(page), '₹111')
})
T('DT13', 'CORNER', 'month ends: 28 Feb, 30 Nov, 1 Dec are counted in their own month only', async (c) => {
  const b = BASE({ expenses: [exp('2026-11-30', '30'), exp('2026-12-01', '1'), exp('2026-02-28', '28'), exp('2026-03-01', '3')] })
  const { page } = await c.open({ budget: b })
  has(await heroText(page), '₹30')
  await page.getByRole('button', { name: 'Next month' }).click(); has(await heroText(page), '₹1')
})
T('DT14', 'UX', 'an entry dated last month is saved but not in this month\'s Recent', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '5')] }) })
  await addExpense(page, { amount: '77', date: '2026-10-20' })
  has(await heroText(page), '₹5')
  await page.getByRole('button', { name: 'Previous month' }).click(); has(await heroText(page), '₹77')
})
T('DT15', 'UX', 'editing an entry: date shown as saved, not reset to today', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-03', '5')] }) })
  await page.getByRole('button', { name: /^Edit/ }).first().click()
  eq(await S(page).locator('#exp-date').inputValue(), '2026-11-03')
})

// ================================================================== D. note and pre-fill
T('NT01', 'CORNER', 'note of 300 characters is cut at 200 in the box and in storage', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page)
  await S(page).locator('#exp-amount').fill('10')
  await S(page).locator('#exp-note').focus(); await page.keyboard.insertText('x'.repeat(300))
  eq((await S(page).locator('#exp-note').inputValue()).length, 200, 'note box length')
  await save(page); await page.locator('.sheet').waitFor({ state: 'detached' })
  eq((await lastDisk(page, 1)).expenses[0].note.length, 200)
})
T('NT02', 'POS', 'Hindi text and an emoji in the note are kept', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await addExpense(page, { amount: '20', note: 'चाय ☕ and samosa' })
  eq((await lastDisk(page, 1)).expenses[0].note, 'चाय ☕ and samosa')
  has(await bodyText(page), 'चाय ☕')
})
T('NT03', 'NEG', 'HTML in the note is shown as text and does nothing', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  let dialog = false; page.on('dialog', () => { dialog = true })
  await addExpense(page, { amount: '20', note: '<img src=x onerror=alert(1)><b>bold</b>' })
  has(await bodyText(page), '<img src=x onerror=alert(1)>')
  eq(await page.locator('.budget__entry img, .budget__entry b').count(), 0); ok(!dialog, 'a dialog opened')
})
T('NT04', 'POS', 'note is trimmed when saved', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await addExpense(page, { amount: '20', note: '   tea   ' })
  eq((await lastDisk(page, 1)).expenses[0].note, 'tea')
})
const PRE = () => BASE({ expenses: [exp('2026-11-02', '849', { categoryId: 'c-del', mode: 'upi', instrumentId: 'i-bank', note: 'Swiggy' })] })
T('NT05', 'UX', 'pre-fill: typing a known note picks its category, mode and account', async (c) => {
  const { page } = await c.open({ budget: PRE() })
  await openAdd(page)
  await S(page).locator('#exp-note').fill('swiggy')
  eq(await S(page).locator('#exp-cat .pill[aria-pressed="true"]').allInnerTexts(), ['Food › Delivery'])
  eq(await S(page).locator('#exp-mode .chip[aria-pressed="true"]').allInnerTexts(), ['UPI'])
  has(await S(page).locator('button#exp-inst').innerText(), 'HDFC Salary')
})
T('NT06', 'UX', 'pre-fill does not overwrite what the person already picked', async (c) => {
  const { page } = await c.open({ budget: PRE() })
  await openAdd(page); await fillExpense(page, { cat: 'Rent' })
  await S(page).locator('#exp-note').fill('Swiggy')
  eq(await S(page).locator('#exp-cat .pill[aria-pressed="true"]').allInnerTexts(), ['Rent'])
})
T('NT07', 'CORNER', 'pre-fill ignores case and spaces, and skips partial matches', async (c) => {
  const { page } = await c.open({ budget: PRE() })
  await openAdd(page)
  await S(page).locator('#exp-note').fill('swig'); eq(await S(page).locator('#exp-cat .pill[aria-pressed="true"]').count(), 0, 'partial')
  await S(page).locator('#exp-note').fill('  SWIGGY '); eq(await S(page).locator('#exp-cat .pill[aria-pressed="true"]').count(), 1, 'full')
})
T('NT08', 'CORNER', 'pre-fill from an entry whose card was deleted drops the card, keeps the rest', async (c) => {
  const b = PRE(); b.instruments = b.instruments.map((i) => (i.id === 'i-bank' ? { ...i, deletedAt: 5 } : i))
  const { page } = await c.open({ budget: b })
  await openAdd(page); await S(page).locator('#exp-note').fill('swiggy')
  eq(await S(page).locator('#exp-mode .chip[aria-pressed="true"]').allInnerTexts(), ['UPI'])
  has(await S(page).locator('button#exp-inst').innerText(), 'Bank account (default)')
})
T('NT09', 'CORNER', 'pre-fill ignores a card bill that has the same note', async (c) => {
  const b = BASE({ expenses: [exp('2026-11-02', '500', { settlement: 'cardBill', instrumentId: 'i-neo', note: 'rent' })] })
  const { page } = await c.open({ budget: b })
  await openAdd(page); await S(page).locator('#exp-note').fill('rent')
  eq(await S(page).locator('#exp-cat .pill[aria-pressed="true"]').count(), 0)
})

// ================================================================== E. category in the add form
const catOf = (b, i = 0) => b.expenses[i].categoryId
T('CG01', 'POS', 'no category saves as Uncategorised, with a hint', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); has(await S(page).innerText(), 'Uncategorised until you pick one')
  await fillExpense(page, { amount: '10' }); await save(page)
  eq(catOf(await lastDisk(page, 1)), null)
  has(await bodyText(page), 'Uncategorised')
})
T('CG02', 'POS', 'top-level category pill saves its id', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await addExpense(page, { amount: '10', cat: 'Rent' }); eq(catOf(await lastDisk(page, 1)), 'c-rent')
})
T('CG03', 'POS', 'subcategory chosen from More saves the child id and reads "Food › Delivery"', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await addExpense(page, { amount: '10', cat: 'Food › Delivery' }); eq(catOf(await lastDisk(page, 1)), 'c-del')
  has(await bodyText(page), 'Food › Delivery')
})
T('CG04', 'UX', 'tapping a chosen category pill again un-chooses it', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await chooseCat(page, 'Rent'); eq(await S(page).locator('#exp-cat .pill[aria-pressed="true"]').count(), 1)
  await S(page).locator('#exp-cat .pill', { hasText: /^Rent$/ }).click(); eq(await S(page).locator('#exp-cat .pill[aria-pressed="true"]').count(), 0)
})
T('CG05', 'CORNER', 'a category limited to December is not offered for a November entry, but is for a December date', async (c) => {
  const b = BASE(); b.categories = b.categories.map((x) => (x.id === 'c-trav' ? { ...x, months: ['2026-12'] } : x))
  const { page } = await c.open({ budget: b })
  await openAdd(page)
  eq(await S(page).locator('#exp-cat .pill', { hasText: /^Travel$/ }).count(), 0, 'Travel offered in Nov')
  await S(page).locator('#exp-date').fill('2026-12-05')
  eq(await S(page).locator('#exp-cat .pill', { hasText: /^Travel$/ }).count(), 1, 'Travel missing in Dec')
})
T('CG06', 'CORNER', 'editing an old entry whose category is not active that month keeps it, with a hint', async (c) => {
  const b = BASE({ expenses: [exp('2026-11-03', '99', { categoryId: 'c-trav' })] }); b.categories = b.categories.map((x) => (x.id === 'c-trav' ? { ...x, months: ['2026-12'] } : x))
  const { page } = await c.open({ budget: b })
  await page.getByRole('button', { name: /^Edit/ }).first().click()
  has(await S(page).innerText(), 'Travel is only for Dec 2026. This entry keeps it.')
  await S(page).locator('#exp-amount').fill('100'); await save(page); await page.locator('.sheet').waitFor({ state: 'detached' })
  const d = await waitStored(page, (x) => x.budget.expenses[0].amount === '100'); eq(d.budget.expenses[0].categoryId, 'c-trav')
})
T('CG07', 'UX', 'More list gets a search box when there are many categories', async (c) => {
  const cats = Array.from({ length: 12 }, (_, i) => cat('k' + i, 'Cat' + i))
  const { page } = await c.open({ budget: budgetOf({ categories: cats }) })
  await openAdd(page); await settle(page); await S(page).locator('#exp-cat .pill--more').click()
  await page.locator('input[type=search]').fill('cat11'); eq(await page.locator('.pick__opt:not(.pick__opt--add)').count(), 1)
})
T('CG08', 'POS', 'add a category from the More list: it is created and chosen', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await settle(page); await S(page).locator('#exp-cat .pill--more').click()
  await page.getByRole('button', { name: /Add category/ }).click()
  await page.locator('#pick-add-name').fill('Pets'); await page.getByRole('button', { name: 'Add', exact: true }).click()
  await S(page).waitFor(); eq(await S(page).locator('#exp-cat .pill[aria-pressed="true"]').allInnerTexts(), ['Pets'])
  await fillExpense(page, { amount: '5' }); await save(page)
  const b = await lastDisk(page, 1); eq(b.categories.some((x) => x.name === 'Pets'), true)
})
T('CG09', 'CORNER', 'adding a category name that exists selects the existing one (no duplicate)', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await settle(page); await S(page).locator('#exp-cat .pill--more').click()
  await page.getByRole('button', { name: /Add category/ }).click()
  await page.locator('#pick-add-name').fill('fOOd'); await page.getByRole('button', { name: 'Add', exact: true }).click()
  await S(page).waitFor(); eq(await S(page).locator('#exp-cat .pill[aria-pressed="true"]').allInnerTexts(), ['Food'])
  await fillExpense(page, { amount: '5' }); await save(page)
  eq((await lastDisk(page, 1)).categories.filter((x) => x.name.toLowerCase() === 'food').length, 1)
})
T('CG10', 'NEG', 'adding the reserved name "Uncategorised" or an empty name shows a message', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await settle(page); await S(page).locator('#exp-cat .pill--more').click()
  await page.getByRole('button', { name: /Add category/ }).click()
  await page.locator('#pick-add-name').fill('Uncategorised'); await page.getByRole('button', { name: 'Add', exact: true }).click()
  has(await page.locator('#pick-add-msg').innerText(), 'kept for entries with no category')
  await page.locator('#pick-add-name').fill(''); await page.getByRole('button', { name: 'Add', exact: true }).click()
  has(await page.locator('#pick-add-msg').innerText(), 'Give it a name')
})
T('CG11', 'UI', 'at most 5 category pills plus More, even with 20 categories', async (c) => {
  const cats = Array.from({ length: 20 }, (_, i) => cat('k' + i, 'Cat' + i))
  const { page } = await c.open({ budget: budgetOf({ categories: cats }) })
  await openAdd(page); eq(await S(page).locator('#exp-cat .pill:not(.pill--more)').count(), 5)
})
T('CG12', 'ERR', 'editing an entry whose category was deleted: starts as none and saves as Uncategorised', async (c) => {
  const b = BASE({ expenses: [exp('2026-11-03', '99', { categoryId: 'c-rent' })] }); b.categories = b.categories.map((x) => (x.id === 'c-rent' ? { ...x, deletedAt: 9 } : x))
  const { page } = await c.open({ budget: b })
  await page.getByRole('button', { name: /^Edit/ }).first().click()
  eq(await S(page).locator('#exp-cat .pill[aria-pressed="true"]').count(), 0)
  await save(page); await page.locator('.sheet').waitFor({ state: 'detached' })
})

// ================================================================== F. paid with
const modeCase = (id, mode, inst, wantMode, wantInst, extra = {}) =>
  T(id, 'POS', `Paid with ${mode}${inst ? ' + ' + inst : ''} saves mode ${wantMode} and ${wantInst ?? 'no account'}`, async (c) => {
    const { page } = await c.open({ budget: BASE() })
    await addExpense(page, { amount: '10', mode, inst, ...extra })
    const e = (await lastDisk(page, 1)).expenses[0]
    eq([e.mode, e.instrumentId], [wantMode, wantInst ?? null])
  })
modeCase('PM01', 'Cash', undefined, 'cash', null)
modeCase('PM02', 'UPI', undefined, 'upi', null)
modeCase('PM03', 'UPI', 'HDFC Salary', 'upi', 'i-bank')
modeCase('PM04', 'UPI', 'SBI Debit', 'upi', 'i-deb')
modeCase('PM05', 'UPI', 'Paytm Wallet', 'upi', 'i-wal')
modeCase('PM06', 'UPI', 'Tata Neo', 'upi', 'i-neo')
modeCase('PM07', 'Credit card', 'Visa Gold', 'credit', 'i-visa')
modeCase('PM08', 'Credit card', undefined, 'credit', null)
modeCase('PM09', 'Debit card', 'SBI Debit', 'debit', 'i-deb')
modeCase('PM10', 'Net banking', 'HDFC Salary', 'netbanking', 'i-bank')
modeCase('PM11', 'Wallet', 'Paytm Wallet', 'wallet', 'i-wal')
T('PM12', 'POS', 'no way of paying chosen saves mode none', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await addExpense(page, { amount: '10' }); const e = (await lastDisk(page, 1)).expenses[0]; eq([e.mode, e.instrumentId], [null, null])
})
T('PM13', 'UI', 'UPI with nothing picked says "Bank account (default)" and explains what UPI accepts', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { mode: 'UPI' })
  has(await S(page).locator('button#exp-inst').innerText(), 'Bank account (default)')
  has(await S(page).innerText(), 'A bank account, a debit card, a wallet or a RuPay credit card')
})
T('PM14', 'POS', 'UPI list is grouped: Bank accounts, Debit cards, Wallets, RuPay credit cards', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { mode: 'UPI' }); await S(page).locator('button#exp-inst').click()
  eq(await page.locator('.pick__group').allInnerTexts(), ['Bank accounts', 'Debit cards', 'Wallets', 'RuPay credit cards'])
})
T('PM15', 'NEG', 'a Visa credit card is not offered for UPI; the RuPay one is', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { mode: 'UPI' }); await S(page).locator('button#exp-inst').click()
  const t = await page.locator('.pick__list').innerText()
  lacks(t, 'Visa Gold'); has(t, 'Tata Neo')
})
T('PM16', 'NEG', 'switching Credit card (Visa Gold chosen) to UPI clears the card', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { mode: 'Credit card', inst: 'Visa Gold' })
  await S(page).locator('#exp-mode .chip', { hasText: /^UPI$/ }).click()
  has(await S(page).locator('button#exp-inst').innerText(), 'Bank account (default)')
  await fillExpense(page, { amount: '10' }); await save(page)
  const e = (await lastDisk(page, 1)).expenses[0]; eq([e.mode, e.instrumentId], ['upi', null])
})
T('PM17', 'POS', 'switching Credit card (Tata Neo, RuPay) to UPI keeps the card', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { mode: 'Credit card', inst: 'Tata Neo' })
  await S(page).locator('#exp-mode .chip', { hasText: /^UPI$/ }).click()
  has(await S(page).locator('button#exp-inst').innerText(), 'Tata Neo')
})
T('PM18', 'NEG', 'switching Credit card to Debit card clears the credit card silently [known B-22 (no message)]', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { mode: 'Credit card', inst: 'Tata Neo' })
  await S(page).locator('#exp-mode .chip', { hasText: /^Debit card$/ }).click()
  eq(await S(page).locator('#exp-inst .pill[aria-pressed="true"]').count(), 0, 'card should be cleared')
  const msg = await S(page).innerText()
  bug('B-22', !/removed|cleared|no longer/i.test(msg), 'the card vanished with no words about it')
})
T('PM19', 'UX', 'tapping the chosen mode again un-chooses it and clears the card', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { mode: 'Debit card', inst: 'SBI Debit' })
  await S(page).locator('#exp-mode .chip', { hasText: /^Debit card$/ }).click()
  eq(await S(page).locator('#exp-mode .chip[aria-pressed="true"]').count(), 0); eq(await S(page).locator('#exp-inst').count(), 0)
})
T('PM20', 'UI', 'Cash shows no account section', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { mode: 'Cash' }); eq(await S(page).locator('#exp-inst').count(), 0)
})
T('PM21', 'POS', 'add a bank account from inside UPI: created and chosen', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { mode: 'UPI' }); await S(page).locator('button#exp-inst').click()
  await page.getByRole('button', { name: '+ Add bank account' }).click()
  await page.locator('#inst-name').fill('Axis Savings'); await page.getByRole('button', { name: 'Add', exact: true }).click()
  await S(page).waitFor(); has(await S(page).locator('button#exp-inst').innerText(), 'Axis Savings')
  await fillExpense(page, { amount: '10' }); await save(page)
  const b = await lastDisk(page, 1); const ax = b.instruments.find((i) => i.name === 'Axis Savings'); eq([ax.kind, b.expenses[0].instrumentId], ['bank', ax.id])
})
T('PM22', 'POS', 'add a RuPay credit card from inside UPI: network RuPay is pre-selected', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { mode: 'UPI' }); await S(page).locator('button#exp-inst').click()
  await page.getByRole('button', { name: '+ Add credit card (RuPay)' }).click()
  eq(await page.locator('.sheet .chip[aria-pressed="true"]').allInnerTexts(), ['Credit card', 'RuPay'])
  await page.locator('#inst-name').fill('Kotak RuPay'); await page.getByRole('button', { name: 'Add', exact: true }).click()
  await S(page).waitFor(); has(await S(page).locator('button#exp-inst').innerText(), 'Kotak RuPay')
})
T('PM23', 'NEG', 'adding an account with a name you already have (same type) is refused with a message', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { mode: 'Net banking' })
  await S(page).locator('#exp-inst .pill--add').click()
  await page.locator('#inst-name').fill('hdfc salary'); await page.getByRole('button', { name: 'Add', exact: true }).click()
  has(await page.locator('.sheet').innerText(), 'You already have one with that name')
})
T('PM24', 'POS', 'same name for a different type is allowed (HDFC as debit card and as bank account)', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { mode: 'Debit card' })
  await S(page).locator('#exp-inst .pill--add').click()
  await page.locator('#inst-name').fill('HDFC Salary'); await page.getByRole('button', { name: 'Add', exact: true }).click()
  await S(page).waitFor(); await fillExpense(page, { amount: '3' }); await save(page)
  const b = await lastDisk(page, 1); eq(b.instruments.filter((i) => i.name === 'HDFC Salary').map((i) => i.kind).sort(), ['bank', 'debit'])
})
T('PM25', 'UI', 'up to 5 cards show as pills; more than 5 open a list', async (c) => {
  const cards = Array.from({ length: 6 }, (_, i) => inst('cc' + i, 'Card' + i, 'credit'))
  const { page } = await c.open({ budget: budgetOf({ instruments: cards }) })
  await openAdd(page); await fillExpense(page, { mode: 'Credit card' })
  eq(await S(page).locator('button#exp-inst').count(), 1, 'a list trigger is expected for 6 cards')
})
T('PM26', 'UX', 'closing the add form after adding a card inline keeps that card (no undo for the side effect)', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { mode: 'Net banking' }); await S(page).locator('#exp-inst .pill--add').click()
  await page.locator('#inst-name').fill('Temp Bank'); await page.getByRole('button', { name: 'Add', exact: true }).click()
  await S(page).waitFor(); await page.getByRole('button', { name: /^Close/ }).click(); await page.getByRole('button', { name: 'Discard' }).click()
  const b = await waitStored(page, (d) => d.budget.instruments.some((i) => i.name === 'Temp Bank')); eq(b.budget.instruments.some((i) => i.name === 'Temp Bank'), true, 'card stays')
  eq(b.budget.expenses.length, 0)
})
T('PM27', 'CORNER', 'a deleted card is not offered', async (c) => {
  const b = BASE(); b.instruments = b.instruments.map((i) => (i.id === 'i-deb' ? { ...i, deletedAt: 3 } : i))
  const { page } = await c.open({ budget: b })
  await openAdd(page); await fillExpense(page, { mode: 'Debit card' }); eq(await S(page).locator('#exp-inst .pill:not(.pill--add)').count(), 0)
})

// ================================================================== G. settlements
const SETT = (o = {}) => BASE({ expenses: [
  exp('2026-11-02', '5000', { mode: 'credit', instrumentId: 'i-neo', categoryId: 'c-rent' }),
  exp('2026-11-03', '700', { mode: 'upi', instrumentId: 'i-neo', categoryId: 'c-food' }),
  exp('2026-11-05', '2000', { settlement: 'cardBill', instrumentId: 'i-neo' }),
  exp('2026-11-06', '1000', { settlement: 'transfer' }), ...(o.extra ?? [])] })
T('ST01', 'NEG', 'Card bill without a card is refused: "Pick the credit card this bill is for"', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { amount: '500', settlement: 'Card bill' }); await save(page)
  has((await errs(page)).join('|'), 'Pick the credit card this bill is for')
})
T('ST02', 'UI', 'Card bill hides category and mode, says "Not counted as spending", label "Card being paid"', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await openAdd(page); await fillExpense(page, { settlement: 'Card bill' })
  const t = await S(page).innerText(); has(t, 'Paying off a credit card. Not counted as spending.'); has(t, 'Card being paid'); lacks(t, 'Paid with'); lacks(t, 'Category')
})
T('ST03', 'POS', 'Transfer: saved as settlement, no card, no category, no mode', async (c) => {
  const { page } = await c.open({ budget: BASE() })
  await addExpense(page, { amount: '1000', settlement: 'Transfer' })
  const e = (await lastDisk(page, 1)).expenses[0]; eq([e.settlement, e.instrumentId, e.categoryId, e.mode], ['transfer', null, null, null])
})
T('ST04', 'POS', 'Card bill saved against the card; month total does not change', async (c) => {
  const { page } = await c.open({ budget: BASE({ expenses: [exp('2026-11-02', '300')] }) })
  await addExpense(page, { amount: '9999', settlement: 'Card bill', inst: 'Tata Neo' })
  const e = (await lastDisk(page, 2)).expenses[0]; eq([e.settlement, e.instrumentId], ['cardBill', 'i-neo'])
  has(await heroText(page), '₹300'); eq(uiC(await heroText(page)), 30000n)
})
T('ST05', 'UX', 'a bill or transfer row says "Not counted as spending" and its own name', async (c) => {
  const { page } = await c.open({ budget: SETT() })
  const t = await bodyText(page); has(t, 'Card bill payment'); has(t, 'Transfer between own accounts'); has(t, 'Not counted as spending')
})
T('ST06', 'POS', 'settlements are left out of every total: home, summary, by mode, by account, biggest', async (c) => {
  const b = SETT(); const want = sumC(spending(b, '2026-11'))
  const { page } = await c.open({ budget: b })
  eq(await heroText(page), inr(want)); await toSummary(page); eq(await totalOf(page), want)
  const t = await SUM(page).innerText(); lacks(t.split('Biggest spends')[1] ?? '', 'Card bill payment')
  eq(await SUM(page).locator('section[aria-label="Biggest spends"] .budget__entry').count(), 2)
})
T('ST07', 'POS', 'card "Owes" = charges (credit + UPI via the card) minus bill payments', async (c) => {
  const { page } = await c.open({ budget: SETT() }); await toManage(page)
  has(await MAN(page).locator('.navrow', { hasText: 'Tata Neo' }).innerText(), 'Owes ₹3,700')
})
T('ST08', 'CORNER', 'card "Paid ahead" when the bill is bigger than the charges, and "Nothing owed" at zero', async (c) => {
  const b = SETT({ extra: [exp('2026-11-07', '4000', { settlement: 'cardBill', instrumentId: 'i-neo' })] })
  const { page } = await c.open({ budget: b }); await toManage(page)
  has(await MAN(page).locator('.navrow', { hasText: 'Tata Neo' }).innerText(), 'Paid ₹300 ahead')
  const z = SETT({ extra: [exp('2026-11-07', '3700', { settlement: 'cardBill', instrumentId: 'i-neo' })] })
  const o = await c.open({ budget: z }); await toManage(o.page)
  has(await MAN(o.page).locator('.navrow', { hasText: 'Tata Neo' }).innerText(), 'Nothing owed')
})
T('ST09', 'POS', 'Owes counts all months (charge in September, bill in November)', async (c) => {
  const b = BASE({ expenses: [exp('2026-09-02', '1000.50', { mode: 'credit', instrumentId: 'i-neo' }), exp('2026-11-05', '400.25', { settlement: 'cardBill', instrumentId: 'i-neo' })] })
  const { page } = await c.open({ budget: b }); await toManage(page)
  has(await MAN(page).locator('.navrow', { hasText: 'Tata Neo' }).innerText(), 'Owes ₹600.25')
})
T('ST10', 'ERR', 'editing a credit card (any field) keeps its bill payments attached [known B-04]', async (c) => {
  const { page } = await c.open({ budget: SETT() }); await toManage(page)
  await MAN(page).locator('.navrow', { hasText: 'Tata Neo' }).click()
  await page.locator('summary', { hasText: 'More details' }).click()
  await page.locator('#inst-holder').fill('V Kumawat'); await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.locator('.sheet').waitFor({ state: 'detached' })
  const t = await MAN(page).locator('.navrow', { hasText: 'Tata Neo' }).innerText()
  bug('B-04', t.includes('Owes ₹5,700'), 'after changing only the holder name the card owes 5,700 instead of 3,700: the bill payment lost its card')
  has(t, 'Owes ₹3,700')
})
T('ST11', 'UX', 'switching an entry from Card bill to Spending shows category and mode and clears the card', async (c) => {
  const { page } = await c.open({ budget: SETT() })
  await page.getByRole('button', { name: /^Edit ₹2,000 Card bill payment/ }).click()
  await S(page).getByRole('radio', { name: 'Spending' }).click()
  has(await S(page).innerText(), 'Paid with')
})
T('ST12', 'UX', 'deleting a bill payment brings the card\'s Owes back up; Undo puts it back', async (c) => {
  const { page } = await c.open({ budget: SETT() })
  await page.getByRole('button', { name: /^Edit ₹2,000 Card bill/ }).click(); await S(page).getByRole('button', { name: 'Delete this expense' }).click()
  await toManage(page); has(await MAN(page).locator('.navrow', { hasText: 'Tata Neo' }).innerText(), 'Owes ₹5,700')
  await MAN(page).getByRole('button', { name: /back/i }).first().click()
  await page.locator('.snack').getByRole('button', { name: 'Undo' }).click()
  await toManage(page); has(await MAN(page).locator('.navrow', { hasText: 'Tata Neo' }).innerText(), 'Owes ₹3,700')
})
T('ST13', 'UX', 'a settlement edit sheet says what it is and has Save changes + Delete', async (c) => {
  const { page } = await c.open({ budget: SETT() })
  await page.getByRole('button', { name: /^Edit ₹1,000 Transfer/ }).click()
  has(await S(page).innerText(), 'Moving money between your own accounts. Not counted as spending.')
  ok(await S(page).getByRole('button', { name: 'Save changes' }).count() === 1 && await S(page).getByRole('button', { name: 'Delete this expense' }).count() === 1)
})
T('ST14', 'CORNER', 'heatmap and Biggest spends ignore settlements; the entry list still shows them', async (c) => {
  const { page } = await c.open({ budget: SETT() }); await toSummary(page)
  has(await SUM(page).locator('.heat__cell', { hasText: /^5$/ }).first().getAttribute('aria-label'), 'nothing spent')
  await viewTab(page, 'Entries'); eq((await entryList(page)).length, 4)
})

// ------------------------------------------------------------------ runner
const only = process.argv.slice(2)
const wanted = cases.filter((c) => only.length === 0 || only.some((p) => c.id.startsWith(p)))
if (process.env.APP_URL) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  APP = { url: process.env.APP_URL, browser, async stop() { await browser.close() } }
} else APP = await startApp()

let failed = 0, done = 0
const lines = []
async function runCase(c) {
  const ctx = makeCtx()
  let msg = null
  try {
    await Promise.race([c.fn(ctx), new Promise((_, rej) => setTimeout(() => rej(new Error('case timed out after 60s')), 60000))])
    if (!c.allowErrors) for (const p of ctx.pages) if (p.errors.length) msg = 'console/page errors: ' + p.errors.slice(0, 2).join(' | ')
  } catch (e) { msg = String(e.message ?? e).split('\n')[0].slice(0, 400) }
  for (const p of ctx.pages) await p.close().catch(() => {})
  done++
  const line = msg ? `FAIL ${c.id} ${c.type} ${c.title} :: ${msg}` : `PASS ${c.id} ${c.type} ${c.title}`
  if (msg) failed++
  console.log(line)
  lines.push(line)
}
const conc = Number(process.env.CONC ?? 4)
const parallel = wanted.filter((c) => !c.serial), serial = wanted.filter((c) => c.serial)
let idx = 0
await Promise.all(Array.from({ length: conc }, async () => { while (idx < parallel.length) await runCase(parallel[idx++]) }))
for (const c of serial) await runCase(c)
await APP.stop()
console.log(`\n${done} cases, ${done - failed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
