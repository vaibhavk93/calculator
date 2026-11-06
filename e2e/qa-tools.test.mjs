// QA campaign for the Calculate/Scientific screens and Tools: everything built or changed on 2026-11-03.
// Run:  node e2e/qa-tools.test.mjs            (all)     ONLY=T-02 node e2e/qa-tools.test.mjs   (ids matching the regex)
// One line per case: PASS|FAIL <id> <TYPE> <title> :: <actual if fail>.  Exit code 1 on any FAIL. CONC=3 sets parallel pages.
// Expected values are worked out here with decimal.js from the textbook formulas, not copied from the app.
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import Decimal from 'decimal.js'
import { startApp, openApp, tab, overflowing, stored } from './lib.mjs'

Decimal.set({ precision: 60 })
const D = (x) => new Decimal(x)
const SHOTS = '/tmp/qa-tools'
mkdirSync(SHOTS, { recursive: true })

// ---- tool list, read from the source so no tool is forgotten -------------------------------------------------------
const SRC = new URL('../src/features/tools/', import.meta.url).pathname
const SPECS = []
for (const f of readdirSync(SRC).filter((n) => /^(everyday|invest|loans|metrics|planning|tax)\.ts$/.test(n))) {
  for (const block of readFileSync(SRC + f, 'utf8').split(/^const \w+Spec: ToolSpec = \{/m).slice(1)) {
    const id = /\n\s+id: '([^']+)'/.exec(block)?.[1]
    const title = /\n\s+title: '([^']+)'/.exec(block)?.[1]
    if (id && title) SPECS.push({ id, title: title.replace(/\\'/g, "'"), rates: /\n\s+rates: /.test(block), example: /example: true/.test(block) })
  }
}
const TITLE = Object.fromEntries(SPECS.map((s) => [s.id, s.title]))

// ---- harness -------------------------------------------------------------------------------------------------------
const cases = []
const C = (id, type, title, fn, opts = {}) => cases.push({ id, type, title, fn, opts })
const NOISE = [/Failed to load resource/i, /net::ERR/i, /fetch/i, /CORS/i, /currency/i]
const ok = (c, m) => { if (!c) throw new Error(m) }
const eq = (a, b, w = '') => { if (a !== b) throw new Error(`${w ? w + ': ' : ''}got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`) }
const has = (hay, needle, w = '') => { if (!String(hay).includes(needle)) throw new Error(`${w ? w + ': ' : ''}got ${JSON.stringify(String(hay).slice(0, 200))}, expected to contain ${JSON.stringify(needle)}`) }
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const BAD = /\bNaN\b|\bundefined\b|\bInfinity\b|\[object|\bnull\b/
const num = (t) => { const m = String(t).replace(/,/g, '').replace(/−/g, '-').match(/-?\d+(\.\d+)?/); return m ? D(m[0]) : null }
const near = (what, got, want, tol = 0.011) => { if (got === null || D(got).minus(D(want)).abs().gt(tol)) throw new Error(`${what}: screen ${got === null ? 'nothing' : D(got).toFixed(4)} vs hand ${D(want).toFixed(4)}`) }

let app
async function runCase(c) {
  const o = await openApp(app, { theme: 'dark', ...c.opts })
  try {
    await o.context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
    await Promise.race([c.fn(o), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout after 90 s')), 90000))])
    const bad = o.errors.filter((e) => !NOISE.some((n) => n.test(e)))
    if (bad.length && !c.opts.allowErrors) throw new Error('console errors: ' + bad.slice(0, 2).join(' | '))
    return { ok: true }
  } catch (e) {
    return { ok: false, msg: String(e.message).split('\n')[0].slice(0, 400) }
  } finally { await o.close().catch(() => {}) }
}

// ---- page helpers --------------------------------------------------------------------------------------------------
async function open(page, id) {
  const title = TITLE[id]
  await tab(page, 'Tools')
  await page.locator('.tools__search input').fill(title)
  await page.locator('.navrow .navrow__label').filter({ hasText: new RegExp('^\\s*' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') }).first().click()
  await page.waitForSelector('.tool')
  await settle(page)
}
const f = (page, id) => page.locator(`#f-${id}`)
async function more(page) { const d = page.locator('details.more'); if ((await d.count()) && !(await d.evaluate((e) => e.open))) await d.locator('summary').click() }
async function fill(page, id, text) {
  const el = f(page, id)
  if (!(await el.count()) || !(await el.isVisible())) await more(page)
  await el.fill(text); await settle(page)
}
async function pick(page, id, label) {
  const el = f(page, id)
  if (!(await el.count()) || !(await el.isVisible())) await more(page)
  const row = page.locator('.field-row', { has: page.locator(`label[for="f-${id}"]`) })
  if (await row.locator('button[role=radio]').count()) await row.locator('button[role=radio]', { hasText: new RegExp('^' + label + '$') }).click()
  else { await el.click(); await page.locator('.sheet .pick__opt').filter({ hasText: new RegExp('^\\s*' + label + '\\s*$') }).first().click() }
  await settle(page)
}
const rowsOf = (page) => page.locator('section.result .result__row').evaluateAll((els) => els.map((e) => [e.querySelector('.result__label').textContent.trim(), e.querySelector('.result__value').textContent.replace(/\s*—\s*(in your favour|against you)/, '').trim()]))
async function rv(page, label) {
  const r = (await rowsOf(page)).find(([l]) => l === label || l.startsWith(label))
  if (!r) throw new Error(`no result row "${label}" (rows: ${(await rowsOf(page)).map((x) => x[0]).join(' | ') || 'none'}; error: ${await err(page)})`)
  return r[1]
}
const err = async (page) => ((await page.locator('.tool__error').count()) ? (await page.locator('.tool__error').first().innerText()).trim() : null)
const hasResult = async (page) => (await page.locator('section.result').count()) > 0
const marked = (page) => page.locator('.tool__form [aria-invalid="true"], .tool__form fieldset[data-invalid]').count()
const noBad = async (page) => { const t = await page.locator('.tool').innerText(); ok(!BAD.test(t), 'bad text on screen: ' + t.match(BAD)[0]) }
const setRows = async (page, rows) => {
  const rr = page.locator('.rows__row')
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) if (rows[r][c] !== null) await rr.nth(r).locator('input.field').nth(c).fill(rows[r][c])
  await settle(page)
}
async function expectError(page, text, what) {
  const e = await err(page)
  ok(e, `${what}: no error shown (result: ${(await rowsOf(page)).map((x) => x.join('=')).join('; ').slice(0, 120)})`)
  has(e, text, what)
  ok(!(await hasResult(page)), `${what}: result still shown beside the error`)
}
const seedWith = (settings = {}, more = {}) => ({ schemaVersion: 3, settings: { theme: 'dark', ...settings }, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false }, ...more })

// ==================================================================================================================
// T-00x  the nine new calculators against hand calculations
// ==================================================================================================================
// ---- Emergency fund
C('T-001', 'POS', 'Emergency fund defaults: target 1,80,000, still 80,000, 3.3 months', async ({ page }) => {
  await open(page, 'emergency-fund')
  near('still to save', num(await rv(page, 'Still to save')), 80000)
  near('target', num(await rv(page, 'Target amount')), 180000)
  near('months covered', num(await rv(page, 'Months covered now')), 3.3, 0.051)
  has(await page.locator('.tool').innerText(), 'Freelancer or variable income', 'guide table')
})
C('T-002', 'POS', 'Emergency fund: savings above target says "Above your target"', async ({ page }) => {
  await open(page, 'emergency-fund'); await fill(page, 'savings', '5,00,000')
  near('above', num(await rv(page, 'Above your target')), 320000)
})
C('T-003', 'ERR', 'Emergency fund: zero expenses, zero/61 months, negative, junk savings, blank: each says the fix and marks a box', async ({ page }) => {
  await open(page, 'emergency-fund')
  await fill(page, 'expenses', '0'); await expectError(page, 'more than zero', 'expenses 0'); ok((await marked(page)) >= 1, 'expenses 0 not marked')
  await fill(page, 'expenses', '30000'); await fill(page, 'months', '0'); await expectError(page, 'Months must be more than zero', 'months 0')
  await fill(page, 'months', '61'); await expectError(page, '60 months or fewer', 'months 61'); ok((await marked(page)) >= 1, 'months 61 not marked')
  await fill(page, 'months', '60'); ok(await hasResult(page), '60 months should work (the boundary)')
  await fill(page, 'months', '6'); await fill(page, 'expenses', '-5'); ok(await err(page), 'negative expenses gave no error')
  await fill(page, 'expenses', '30000'); await fill(page, 'savings', 'abc'); ok(await err(page), 'junk savings gave no error (silent zero)')
  await fill(page, 'savings', ''); ok(await hasResult(page), 'blank savings means none')
  await fill(page, 'expenses', ''); ok(await err(page), 'blank expenses gave no error'); ok((await marked(page)) >= 1, 'blank expenses not marked')
})
C('T-004', 'CORNER', 'Emergency fund: huge numbers and 1e100 never show NaN', async ({ page }) => {
  await open(page, 'emergency-fund')
  for (const v of ['99999999999999999999', '1e100', '0.000001', '1,23,456.78']) { await fill(page, 'expenses', v); await noBad(page) }
})
// ---- Debt-to-income
C('T-010', 'POS', 'DTI defaults: 30%, Comfortable, room 6,000', async ({ page }) => {
  await open(page, 'debt-to-income')
  near('dti', num(await rv(page, 'Debt-to-income ratio')), 30)
  has(await rv(page, 'Band'), 'Comfortable'); near('room', num(await rv(page, 'EMI room left')), 6000)
})
C('T-011', 'CORNER', 'DTI band edges: 36% comfortable, 36.001% stretched, 50% stretched, 50.001% high', async ({ page }) => {
  await open(page, 'debt-to-income')
  for (const [debt, band] of [['36000', 'Comfortable'], ['36001', 'Stretched'], ['50000', 'Stretched'], ['50001', 'High'], ['0', 'Comfortable']]) {
    await fill(page, 'debts', debt); has(await rv(page, 'Band'), band, `debts ${debt}`)
  }
  await fill(page, 'debts', '60000'); near('over', num(await rv(page, 'Over the')), 24000)
})
C('T-012', 'ERR', 'DTI: zero income, limits the wrong way round, negative, blank', async ({ page }) => {
  await open(page, 'debt-to-income')
  await fill(page, 'income', '0'); await expectError(page, 'Income must be more than zero', 'income 0')
  await fill(page, 'income', '100000'); await fill(page, 'low', '50'); await expectError(page, 'lower than', 'low>=high')
  ok((await marked(page)) >= 1, 'limit error marks nothing')
  await fill(page, 'low', '36'); await fill(page, 'debts', '-1'); ok(await err(page), 'negative debts accepted')
  await fill(page, 'debts', ''); ok(await err(page), 'blank debts gave no error')
})
// ---- Savings rate
C('T-020', 'POS', 'Savings rate: 80,000 income, 55,000 spent = 31.25%, 25,000 a month, 3,00,000 a year', async ({ page }) => {
  await open(page, 'savings-rate')
  near('rate', num(await rv(page, 'Savings rate')), 31.25); near('month', num(await rv(page, 'Saved each month')), 25000); near('year', num(await rv(page, 'Saved in a year')), 300000)
  await pick(page, 'mode', 'Monthly savings'); near('rate (saved mode)', num(await rv(page, 'Savings rate')), 31.25)
})
C('T-021', 'CORNER', 'Savings rate: overspending shows a negative rate in words, saved more than income is refused', async ({ page }) => {
  await open(page, 'savings-rate'); await fill(page, 'spend', '90000')
  near('rate', num(await rv(page, 'Savings rate')), -12.5); near('overspent', num(await rv(page, 'Overspent each month')), 10000)
  await pick(page, 'mode', 'Monthly savings'); await fill(page, 'saved', '90000'); await expectError(page, 'more than income', 'saved > income')
  await fill(page, 'saved', '0'); near('0 saved', num(await rv(page, 'Savings rate')), 0)
  await fill(page, 'income', '0'); await expectError(page, 'Income must be more than zero', 'income 0')
})
// ---- Markup and margin
C('T-030', 'POS', 'Markup: cost 800, price 1,000 gives profit 200, markup 25%, margin 20%', async ({ page }) => {
  await open(page, 'markup')
  near('profit', num(await rv(page, 'Profit per unit')), 200); near('markup', num(await rv(page, 'Markup')), 25); near('margin', num(await rv(page, 'Margin')), 20)
})
C('T-031', 'POS', 'Markup from a markup % and from a margin %', async ({ page }) => {
  await open(page, 'markup'); await fill(page, 'cost', '100'); await pick(page, 'known', 'Markup %'); await fill(page, 'markupPct', '50')
  near('price', num(await rv(page, 'Selling price')), 150); near('margin', num(await rv(page, 'Margin')), 33.33, 0.011)
  await pick(page, 'known', 'Margin %'); await fill(page, 'marginPct', '20')
  near('price', num(await rv(page, 'Selling price')), 125); near('markup', num(await rv(page, 'Markup')), 25)
})
C('T-032', 'CORNER', 'Markup: a loss shows "Loss per unit" with negative markup and margin; 100% margin, zero cost, -100% markup refused', async ({ page }) => {
  await open(page, 'markup'); await fill(page, 'cost', '1000'); await fill(page, 'price', '800')
  near('loss', num(await rv(page, 'Loss per unit')), 200); near('markup', num(await rv(page, 'Markup')), -20); near('margin', num(await rv(page, 'Margin')), -25)
  await fill(page, 'cost', '0'); await expectError(page, 'Cost must be more than zero', 'cost 0')
  await fill(page, 'cost', '100'); await pick(page, 'known', 'Margin %'); await fill(page, 'marginPct', '100'); await expectError(page, 'below 100%', 'margin 100')
  await fill(page, 'marginPct', '99.99'); ok(await hasResult(page), 'margin 99.99 should work')
  await pick(page, 'known', 'Markup %'); await fill(page, 'markupPct', '-100'); await expectError(page, 'above', 'markup -100')
  await fill(page, 'markupPct', '0'); near('markup 0 price', num(await rv(page, 'Selling price')), 100)
  await fill(page, 'markupPct', '1e100'); await noBad(page)
})
// ---- Runway
C('T-040', 'POS', 'Runway defaults: 7,00,000 cash, 85,000 a month out = 8 months 7 days; names the loan to part-pay', async ({ page }) => {
  await open(page, 'runway')
  const lasts = await rv(page, 'Your money lasts'); has(lasts, '8 months', 'months'); has(lasts, '7 days', 'days')
  near('burn', num(await rv(page, 'Net money out each month')), 85000); has(await rv(page, 'Part-pay this loan first'), 'Home loan')
  near('cash', num(await rv(page, 'Cash you have')), 700000)
})
C('T-041', 'CORNER', 'Runway: income above spending never runs out; zero cash is "Less than a day"; no loans; part-pay more than cash refused; EMI below interest refused', async ({ page }) => {
  await open(page, 'runway')
  await fill(page, 'income', '200000'); has(await rv(page, 'Your money lasts'), 'Never runs out')
  await fill(page, 'income', '0'); await fill(page, 'payout', '0'); await fill(page, 'savings', '0'); await fill(page, 'partpay', '0'); has(await rv(page, 'Your money lasts'), 'Less than a day')
  await fill(page, 'payout', '400000'); await fill(page, 'savings', '300000'); await fill(page, 'partpay', '800000'); await expectError(page, 'part-payment is more', 'partpay > cash')
  await fill(page, 'partpay', '100000')
  await page.locator('.rows__row').nth(0).locator('input.field').nth(3).fill('1000'); await settle(page); await expectError(page, 'lower than the monthly interest', 'emi below interest')
  await page.getByRole('button', { name: 'Remove row 1' }).click(); await settle(page)
  ok(await hasResult(page), 'no loans should still work'); ok(!(await rowsOf(page)).some(([l]) => l.startsWith('Part-pay')), 'part-pay row shown with no loans')
  await fill(page, 'cost', '0'); await expectError(page, 'more than zero', 'cost 0')
})
// ---- Multi-loan payoff
const payoffRef = (loans, extra, order) => {
  let bal = loans.map((l) => D(l.bal)), month = 0, interest = D(0); const pool = loans.reduce((s, l) => s.plus(l.emi), D(extra))
  while (bal.some((b) => b.gt(0)) && month < 1200) {
    month++
    bal = bal.map((b, i) => { if (b.lte(0)) return b; const x = b.times(D(loans[i].rate).div(1200)); interest = interest.plus(x); return b.plus(x) })
    let left = pool
    const idx = bal.map((_, i) => i).filter((i) => bal[i].gt(0))
    for (const i of idx) { const p = Decimal.min(D(loans[i].emi), bal[i]); bal[i] = bal[i].minus(p); left = left.minus(p) }
    const pr = bal.map((_, i) => i).filter((i) => bal[i].gt(0)).sort((a, b) => order === 'avalanche' ? loans[b].rate - loans[a].rate || a - b : bal[a].comparedTo(bal[b]) || a - b)
    for (const i of pr) { if (left.lte(0)) break; const p = Decimal.min(left, bal[i]); bal[i] = bal[i].minus(p); left = left.minus(p) }
  }
  return { months: month, interest }
}
C('T-050', 'POS', 'Multi-loan: two loans, avalanche and snowball interest match a month-by-month hand simulation', async ({ page }) => {
  await open(page, 'multi-loan')
  await setRows(page, [['A', '100000', '12', '5000'], ['B', '50000', '18', '3000']]) // 2 rows only: remove the third
  await page.getByRole('button', { name: 'Remove row 3' }).click(); await settle(page); await fill(page, 'extra', '0')
  const loans = [{ bal: 100000, rate: 12, emi: 5000 }, { bal: 50000, rate: 18, emi: 3000 }]
  const av = payoffRef(loans, 0, 'avalanche'), sn = payoffRef(loans, 0, 'snowball')
  near('avalanche interest', num(await rv(page, 'Interest with avalanche')), av.interest, 2)
  near('snowball interest', num(await rv(page, 'Interest with snowball')), sn.interest, 2)
  has(await rv(page, 'Debt-free (avalanche)'), `${Math.floor(av.months / 12)} y ${av.months % 12} m`, 'months')
})
C('T-051', 'POS', 'Multi-loan defaults (3 loans, 5,000 extra): avalanche never costs more than snowball; extra speeds up the date', async ({ page }) => {
  await open(page, 'multi-loan')
  const a = num(await rv(page, 'Interest with avalanche')), s = num(await rv(page, 'Interest with snowball')), now = num(await rv(page, 'Interest left, loans as they run now'))
  ok(a.lte(s), `avalanche ${a} > snowball ${s}`); ok(a.lt(now), 'extra payment did not reduce interest')
  const loans = [{ bal: 3000000, rate: 8.5, emi: 30000 }, { bal: 400000, rate: 14, emi: 12000 }, { bal: 250000, rate: 9.5, emi: 8000 }]
  near('avalanche (3 loans)', a, payoffRef(loans, 5000, 'avalanche').interest, 3)
  await noBad(page)
})
C('T-052', 'CORNER', 'Multi-loan: 2..6 rows (Add stops at 6, remove stops at 2), six loans compute', async ({ page }) => {
  await open(page, 'multi-loan')
  const add = page.getByRole('button', { name: /^Add/ })
  for (let i = 0; i < 3; i++) { await add.first().click(); await settle(page) }
  eq(await page.locator('.rows__row').count(), 6, 'rows after 3 adds')
  eq(await page.getByRole('button', { name: /^Add/ }).count(), 0, 'Add button at 6 rows')
  await setRows(page, [null, null, null, ['D', '100000', '10', '4000'], ['E', '90000', '11', '4000'], ['F', '80000', '12', '4000']].map((r) => r && r))
  ok(await hasResult(page), `six loans: ${await err(page)}`); await noBad(page)
  for (let i = 0; i < 4; i++) { await page.getByRole('button', { name: 'Remove row 6' }).or(page.getByRole('button', { name: /^Remove row/ }).last()).click(); await settle(page) }
  eq(await page.locator('.rows__row').count(), 2, 'rows after removing')
  eq(await page.getByRole('button', { name: /^Remove row/ }).count(), 0, 'remove buttons at 2 rows')
})
C('T-053', 'ERR', 'Multi-loan: EMI below interest, zero balance, half-filled row, blank rows skipped, negative/junk extra, 1 loan', async ({ page }) => {
  await open(page, 'multi-loan')
  const cell = (r, c) => page.locator('.rows__row').nth(r).locator('input.field').nth(c)
  await cell(0, 3).fill('1000'); await settle(page); await expectError(page, 'lower than the monthly interest on Home loan', 'EMI below interest'); ok((await marked(page)) >= 1, 'row error marks nothing')
  await cell(0, 3).fill('30000'); await cell(1, 1).fill('0'); await settle(page); await expectError(page, 'Personal loan: balance must be more than zero', 'zero balance')
  await cell(1, 1).fill('400000'); await cell(1, 2).fill(''); await settle(page); await expectError(page, 'Fill in the balance, rate and EMI of Personal loan', 'half-filled')
  await cell(1, 2).fill('14'); for (const i of [2]) for (const c of [0, 1, 2, 3]) await cell(i, c).fill('')
  await settle(page); ok(await hasResult(page), 'a fully blank row should be skipped');
  await fill(page, 'extra', '-1'); await expectError(page, "can't be negative", 'extra -1'); await fill(page, 'extra', 'abc'); ok(await err(page), 'junk extra silently ignored')
  await fill(page, 'extra', ''); ok(await hasResult(page), 'blank extra = none')
  for (const c of [0, 1, 2, 3]) await cell(1, c).fill(''); await settle(page); await expectError(page, 'at least 2 loans', 'one loan')
})
C('T-054', 'CORNER', 'Multi-loan: equal rates, 0% loans, huge balances, tiny EMI barely above interest: no NaN, a result or a plain error', async ({ page }) => {
  await open(page, 'multi-loan')
  await setRows(page, [['A', '100000', '10', '5000'], ['B', '100000', '10', '5000'], ['C', '100000', '10', '5000']]); await noBad(page); ok(await hasResult(page), 'equal rates: ' + await err(page))
  has(await rv(page, 'Avalanche vs snowball').catch(() => rv(page, 'Avalanche saves')), '', 'row')
  await setRows(page, [['A', '100000', '0', '5000'], ['B', '100000', '0', '5000'], ['C', '1', '0', '1']]); await noBad(page); ok(await hasResult(page), 'zero rates: ' + await err(page))
  await setRows(page, [['A', '99999999999999', '8', '9999999999'], ['B', '5', '8', '1'], null]); await noBad(page)
  await setRows(page, [['A', '100000', '12', '1001'], ['B', '100000', '12', '5000'], null]); await noBad(page); ok((await hasResult(page)) || (await err(page)), 'EMI 1 above interest: neither result nor error')
})
// ---- Loan term box
const emiRef = (p, r, n) => { const i = D(r).div(1200); return i.isZero() ? D(p).div(n) : D(p).times(i).times(D(1).plus(i).pow(n)).div(D(1).plus(i).pow(n).minus(1)) }
async function emiAt(page, term) { await fill(page, 'tenure', term); return num(await rv(page, 'Monthly EMI')) }
C('T-060', 'POS', 'Loan term box accepts "18 months", "18m", "20 years", "20y", "1.5 years", a bare number, spaces and capitals', async ({ page }) => {
  await open(page, 'emi'); await fill(page, 'principal', '100000'); await fill(page, 'rate', '12')
  for (const [t, n] of [['18 months', 18], ['18m', 18], ['18 mo', 18], ['20 years', 240], ['20y', 240], ['20 YEARS', 240], [' 20 yrs ', 240], ['1.5 years', 18], ['1.5y', 18], ['20', 240], ['0.5', 6], ['50 years', 600], ['600 months', 600], ['1 month', 1], ['2,0 years', 240]])
    near(`term "${t}"`, await emiAt(page, t), emiRef(100000, 12, n))
})
C('T-061', 'ERR', 'Loan term box: junk, zero, huge, fractional months, negative and blank each give a plain error that names the fix', async ({ page }) => {
  await open(page, 'emi')
  for (const [t, words] of [['abc', 'months or years'], ['0', 'more than zero'], ['0 months', 'more than zero'], ['51 years', 'at most 50 years'], ['99999', 'at most 50 years'], ['601 months', 'at most 50 years'], ['1.3 years', 'whole number of months'], ['5 weeks', 'months or years'], ['-5', 'months or years'], ['', 'Enter loan term'], ['1e5', 'months or years'], ['0x10', 'months or years'], ['18 months 2 days', 'months or years']]) {
    await fill(page, 'tenure', t); await expectError(page, words, `term "${t}"`); ok((await f(page, 'tenure').getAttribute('aria-invalid')) === 'true', `term "${t}": the box is not marked`)
  }
  await fill(page, 'tenure', '20 years'); eq(await marked(page), 0, 'marking should clear')
})
C('T-062', 'UX', 'Loan term has a Years / Months switch: Years for a bare number, follows a typed unit, and tapping it keeps the digits', async ({ page }) => {
  await open(page, 'emi')
  const seg = page.getByRole('radiogroup', { name: 'Unit of Loan term' })
  const on = async () => (await seg.getByRole('radio', { checked: true }).allInnerTexts()).join('')
  eq(await on(), 'Years', 'bare'); await fill(page, 'tenure', '18 months'); eq(await on(), 'Months', 'with unit')
  await seg.getByRole('radio', { name: 'Years' }).click(); eq(await f(page, 'tenure').inputValue(), '18', 'digits kept'); eq(await on(), 'Years', 'after tap')
  await seg.getByRole('radio', { name: 'Months' }).click(); eq(await f(page, 'tenure').inputValue(), '18', 'digits kept (months)'); eq(await on(), 'Months', 'months')
  await fill(page, 'tenure', ''); eq(await on(), 'Months', 'blank keeps the choice')
})
C('T-063', 'POS', 'Every loan tool with a term box agrees on "18 months" (EMI, repayment schedule, affordable loan, compare offers)', async ({ page }) => {
  await open(page, 'amortisation'); await fill(page, 'principal', '100000'); await fill(page, 'rate', '12'); await fill(page, 'tenure', '18 months')
  eq(await page.locator('.rowcard, .kv__row').count() > 0, true, 'schedule rows'); await noBad(page)
  has(await page.locator('.tool').innerText(), '18', 'schedule shows month 18')
  await page.getByRole('button', { name: 'Back' }).click(); await settle(page)
  await open(page, 'reverse-emi'); await fill(page, 'emi', '6000'); await fill(page, 'rate', '12'); await fill(page, 'tenure', '18 months')
  const loan = num(await rv(page, (await rowsOf(page))[0][0]))
  near('affordable loan for 6,000 x 18 months at 12%', loan, D(6000).times(D(1).minus(D(1.01).pow(-18))).div(0.01), 1)
  await page.getByRole('button', { name: 'Back' }).click(); await settle(page)
  await open(page, 'loan-compare')
  const cell = (r, c) => page.locator('.rows__row').nth(r).locator('input.field').nth(c)
  await cell(0, 2).fill('18 months'); await cell(1, 2).fill('1.5y'); await settle(page); await noBad(page)
  await cell(0, 2).fill('abc'); await settle(page); ok(await err(page), 'compare: junk term gave no error'); ok((await marked(page)) >= 1, 'compare: junk term not marked')
})
// ---- Inflation, SWP
C('T-070', 'POS', 'Inflation with two rates: 1,00,000 for 10 years at 6% = 1,79,084.77, medical at 10% = 2,59,374.25; blank medical hides its row', async ({ page }) => {
  await open(page, 'inflation')
  near('general', num(await rv(page, 'Future cost of the same thing')), D(100000).times(D(1.06).pow(10)))
  near('medical', num(await rv(page, 'Future cost if it is medical')), D(100000).times(D(1.1).pow(10)))
  near('today money', num(await rv(page, 'Future amount, in today')), D(100000).div(D(1.06).pow(10)))
  await fill(page, 'medical', ''); ok(!(await rowsOf(page)).some(([l]) => /medical/i.test(l)), 'medical row still shown')
  await fill(page, 'medical', '0'); near('medical at 0%', num(await rv(page, 'Future cost if it is medical')), 100000)
  await more(page); await fill(page, 'ret', '12'); near('real return', num(await rv(page, 'Return after inflation')), D(1.12).div(1.06).minus(1).times(100), 0.011)
  await fill(page, 'medical', '-3'); ok(await err(page), 'negative medical accepted'); await fill(page, 'medical', 'x'); ok(await err(page), 'junk medical silently ignored')
})
const swpRef = (corpus, wd, rate) => { let b = D(corpus), m = 0; for (; m < 1200; m++) { b = b.times(D(1).plus(D(rate).div(1200))); if (b.lt(wd)) return m; b = b.minus(wd) } return null }
C('T-071', 'POS', 'SWP defaults: months it lasts match a month-by-month hand loop', async ({ page }) => {
  await open(page, 'swp')
  eq(Number(num(await rv(page, 'Months it lasts'))), swpRef(1000000, 10000, 8), 'months')
})
C('T-072', 'POS', 'SWP with saving years at a different return: start amount and months match hand maths', async ({ page }) => {
  await open(page, 'swp'); await fill(page, 'wait', '5'); await fill(page, 'saveRate', '12')
  const start = D(1000000).times(D(1).plus(D(12).div(1200)).pow(60))
  near('start', num(await rv(page, 'Amount when withdrawals start')), start)
  eq(Number(num(await rv(page, 'Months it lasts'))), swpRef(start, 10000, 8), 'months'); has(await page.locator('.tool').innerText(), 'after the saving years', 'note')
  await fill(page, 'saveRate', ''); near('blank = same return', num(await rv(page, 'Amount when withdrawals start')), D(1000000).times(D(1).plus(D(8).div(1200)).pow(60)))
})
C('T-073', 'CORNER', 'SWP: never runs out, 100+ years, bad saving years (fraction, 61, negative, junk), zero withdrawal', async ({ page }) => {
  await open(page, 'swp'); await fill(page, 'withdraw', '5000'); has(await rv(page, 'Lasts'), 'Never runs out')
  await fill(page, 'withdraw', '6700'); await noBad(page)
  await fill(page, 'withdraw', '10000'); await fill(page, 'wait', '1.5'); await noBad(page) // 1.5 years is 18 whole months, valid since the Years/Months switch
  await fill(page, 'wait', '1.55'); await expectError(page, 'whole months', 'wait 1.55')
  await fill(page, 'wait', '61'); await expectError(page, 'whole months', 'wait 61'); await fill(page, 'wait', '-1'); ok(await err(page), 'negative wait accepted')
  await fill(page, 'wait', 'abc'); ok(await err(page), 'junk wait silently ignored'); await fill(page, 'wait', '60'); await noBad(page)
  await fill(page, 'wait', '0'); await fill(page, 'withdraw', '0'); await expectError(page, 'more than zero', 'withdraw 0')
})
// ---- Tip and split
C('T-080', 'POS', 'Tip equal: 2400 + 10% over 4 = 660 each; 0.01 split 3 ways adds back to 0.01 and says who gets the paisa', async ({ page }) => {
  await open(page, 'tip'); near('each', num(await rv(page, 'Each person pays')), 660)
  await fill(page, 'bill', '0.01'); await fill(page, 'pct', '0'); await fill(page, 'people', '3')
  near('most pay', num(await rv(page, 'Most people pay')), 0); near('total', num(await rv(page, 'Total with tip')), 0.01)
  has(await page.locator('.result__note').first().innerText(), '₹0.01 extra goes to person 1', 'note')
  await fill(page, 'bill', '100'); await fill(page, 'people', '3'); has(await page.locator('.result__note').first().innerText(), 'person 1', 'note 100/3')
})
C('T-081', 'CORNER', 'Tip equal: 1000 people works, 1001/0/2.5/-1/blank give a plain error', async ({ page }) => {
  await open(page, 'tip')
  await fill(page, 'people', '1000'); ok(await hasResult(page), '1000 people: ' + await err(page)); await noBad(page)
  for (const p of ['1001', '0', '2.5', '-1', '']) { await fill(page, 'people', p); ok(await err(page), `people "${p}" gave no error`); ok((await marked(page)) >= 1, `people "${p}" not marked`) }
  await fill(page, 'people', '1'); near('1 person', num(await rv(page, 'Each person pays')), 2640)
  await fill(page, 'bill', '0'); await noBad(page); await fill(page, 'pct', '1e100'); await noBad(page)
})
C('T-082', 'POS', 'Tip modes: percent 60/40, shares 2:1, exact amounts; shares add to the total to the paisa; who-pays-whom', async ({ page }) => {
  await open(page, 'tip'); await pick(page, 'mode', 'By shares')
  const w = page.locator('.rows__row'); await w.nth(0).locator('input.field').nth(1).fill('2'); await w.nth(1).locator('input.field').nth(1).fill('1'); await settle(page)
  const t = await page.locator('.tool').innerText(); ok(/1,760/.test(t) && /880/.test(t), 'shares 2:1 of 2640 should be 1,760 and 880: ' + t.slice(t.indexOf('Result'), t.indexOf('Result') + 200))
  await fill(page, 'payer', '2'); has(await page.locator('.kv').first().innerText(), 'pays', 'settle')
  await pick(page, 'mode', 'Exact amounts'); await w.nth(0).locator('input.field').nth(1).fill('1000'); await w.nth(1).locator('input.field').nth(1).fill('1400'); await settle(page)
  ok(await hasResult(page), 'exact 1000+1400 = 2400: ' + await err(page))
  await w.nth(1).locator('input.field').nth(1).fill('1300'); await settle(page); ok(await err(page), 'exact amounts that do not add up to the bill gave no error')
  ok((await marked(page)) >= 1, 'exact mismatch marks nothing')
})
C('T-083', 'POS', 'Tip: Save my share to Budget opens Add expense with your share and the note', async ({ page }) => {
  await open(page, 'tip'); await page.getByRole('button', { name: 'Save my share to Budget' }).click(); await settle(page)
  eq((await page.locator('.sheet input').first().inputValue()).replace(/[^\d.]/g, ''), '660', 'amount')
})
C('T-084', 'CORNER', 'Tip rows: 6 people at most, uneven percent/negative/junk/blank names', async ({ page }) => {
  await open(page, 'tip'); await pick(page, 'mode', 'By percent')
  for (let i = 0; i < 6; i++) { const b = page.getByRole('button', { name: /^Add/ }); if (await b.count()) { await b.first().click(); await settle(page) } }
  ok((await page.locator('.rows__row').count()) <= 6, 'more than 6 people: ' + await page.locator('.rows__row').count())
  await page.locator('.rows__row').nth(0).locator('input.field').nth(1).fill('-5'); ok(await err(page), 'negative percent accepted')
  await page.locator('.rows__row').nth(0).locator('input.field').nth(1).fill('abc'); ok(await err(page), 'junk percent accepted')
})
// ---- World time
C('T-090', 'POS', 'World time, chosen time: 3 pm Mumbai on 10 Dec is 04:30 New York (winter); on 10 Jul it is 05:30 (daylight saving)', async ({ page }) => {
  await open(page, 'world-time'); await pick(page, 'when', 'A time I choose')
  await fill(page, 'day', '2026-12-10'); await fill(page, 'at', '15:00'); has(await page.locator('.rowcard', { hasText: 'New York' }).innerText(), '04:30', 'winter')
  await fill(page, 'day', '2026-07-10'); has(await page.locator('.rowcard', { hasText: 'New York' }).innerText(), '05:30', 'summer')
})
C('T-091', 'CORNER', 'World time: the day DST starts (8 Mar 2026) and ends (1 Nov 2026) in New York, midnight and 23:59, blank day = today, bad day', async ({ page }) => {
  await open(page, 'world-time'); await pick(page, 'when', 'A time I choose')
  const ny = () => page.locator('.rowcard', { hasText: 'New York' }).innerText()
  await fill(page, 'day', '2026-03-08'); await fill(page, 'at', '12:00'); has(await ny(), '02:30', 'on DST start day, 12:00 IST is 02:30 EST (-5)')
  await fill(page, 'day', '2026-03-09'); has(await ny(), '02:30', 'day after DST start, 12:00 IST is 02:30 EDT (-4)'.replace('02:30', '02:30'))
  await fill(page, 'at', '00:00'); await noBad(page); await fill(page, 'at', '23:59'); await noBad(page)
  await fill(page, 'day', ''); ok(await hasResult(page), 'blank day = today: ' + await err(page))
  await fill(page, 'at', ''); ok(await err(page), 'blank time gave no error'); ok((await marked(page)) >= 1, 'blank time not marked')
})
// ---- Use in another tool, suggestion chip
C('T-100', 'POS', 'Use in another tool: EMI into Emergency fund expenses; not offered when the result is an error', async ({ page }) => {
  await open(page, 'emi'); const emi = num(await rv(page, 'Monthly EMI'))
  // "Use in another tool" lives behind the tool page's own "More" button now (B16), not a direct icon.
  const moreBtn = page.locator('.keep__btn[aria-label="More"]')
  await moreBtn.scrollIntoViewIfNeeded()
  await moreBtn.click()
  await page.locator('.sheet .navrow', { hasText: 'Use in another tool' }).click(); await settle(page)
  await page.locator('.sheet .pick__opt', { hasText: 'Emergency fund' }).click(); await settle(page)
  await page.locator('.sheet .pick__opt').first().click(); await page.locator('.sheet__foot .btn').click(); await page.waitForSelector('.tool'); await settle(page)
  has(await page.locator('.screen__title').last().innerText(), 'Emergency fund', 'opened')
  const got = num(await f(page, 'expenses').inputValue()); ok(got && got.minus(emi).abs().lt(1), `expenses ${got} vs EMI ${emi}`)
  await page.getByRole('button', { name: 'Back' }).click(); await settle(page); await page.getByRole('button', { name: 'Back' }).click(); await settle(page)
  await open(page, 'emi'); await fill(page, 'rate', ''); eq(await page.getByRole('button', { name: 'Use in another tool' }).count(), 0, 'Use in offered on an error')
})
C('T-101', 'POS', 'Suggestion chip: offered once, dismissed stays dismissed after reload, not offered on an error', async ({ page }) => {
  await open(page, 'emi'); const chip = page.getByRole('button', { name: 'Remind me every month on the 5th', exact: true })
  eq(await chip.count(), 1, 'offered'); await fill(page, 'rate', ''); eq(await page.locator('.suggest').count(), 0, 'on error'); await fill(page, 'rate', '8.5')
  await page.getByRole('button', { name: /^Dismiss: Remind me/ }).click(); await settle(page); await wait(900)
  await page.reload(); await page.waitForSelector('.app'); await open(page, 'emi'); eq(await chip.count(), 0, 'after reload')
  eq((await stored(page)).reminders.length, 0, 'dismiss added a reminder')
})

// ==================================================================================================================
// T-1xx  chips, reset, rates, examples, draft, ordering, date span
// ==================================================================================================================
C('T-110', 'POS', 'Quick chips: +1K/+10K/+1L add to what is typed; blank box starts from zero; international system shows +100K; rapid taps all count', async ({ page }) => {
  await open(page, 'emi'); await fill(page, 'principal', '')
  const chips = page.locator('.field-row', { has: page.locator('label[for="f-principal"]') }).locator('.chip')
  await chips.nth(1).click(); eq(await f(page, 'principal').inputValue(), '10,000', 'blank +10K')
  for (let i = 0; i < 20; i++) await chips.nth(0).click()
  eq(await f(page, 'principal').inputValue(), '30,000', '20 rapid +1K taps')
  await fill(page, 'principal', '99999999999999'); await chips.nth(2).click(); await noBad(page)
  await fill(page, 'principal', '1.5'); await chips.nth(0).click(); eq((await f(page, 'principal').inputValue()).replace(/,/g, ''), '1001.5', 'decimal + 1K')
  const names = await chips.evaluateAll((e) => e.map((x) => x.getAttribute('aria-label'))); ok(names.every(Boolean), 'chip without a name: ' + names)
})
C('T-111', 'POS', 'Quick chips with the international system say +100K', async ({ page }) => {
  await open(page, 'emi'); const t = await page.locator('.field-row', { has: page.locator('label[for="f-principal"]') }).locator('.chip').allInnerTexts()
  ok(t.join(' ').includes('+100K') && !t.join(' ').includes('+1L'), 'chips: ' + t.join(' '))
}, { settings: { numberSystem: 'international' } })
C('T-112', 'POS', 'Reset puts every box back (also a blanked one and rows), Undo brings the typed values back; reload after Reset has no draft', async ({ page }) => {
  // Reset lives behind the tool page's own "More" button now (B16), not a direct icon.
  const reset = async () => { await page.locator('.keep__btn[aria-label="More"]').click(); await page.locator('.sheet .navrow', { hasText: 'Reset inputs' }).click() }
  await open(page, 'multi-loan'); await setRows(page, [['Z', '1', '1', '1']]); await fill(page, 'extra', '')
  await reset(); await settle(page)
  eq(await f(page, 'extra').inputValue(), '5,000', 'extra'); eq(await page.locator('.rows__row').nth(0).locator('input.field').nth(0).inputValue(), 'Home loan', 'row')
  has(await page.locator('.snack').innerText(), 'Inputs reset'); await page.locator('.snack .snack__link').click(); await settle(page)
  eq(await page.locator('.rows__row').nth(0).locator('input.field').nth(0).inputValue(), 'Z', 'undo row'); eq(await f(page, 'extra').inputValue(), '', 'undo extra')
  await reset(); await settle(page); await wait(900); eq(Object.keys((await stored(page)).drafts ?? {}).length, 0, 'draft after reset')
})
const RATE_TOOLS = SPECS.filter((s) => s.rates)
C('T-113', 'POS', `"Rates as of" lines: shown on exactly the ${RATE_TOOLS.length} tools with a changing rate (${RATE_TOOLS.map((s) => s.id).join(', ')}), on no other tool`, async ({ page }) => {
  const wrong = []
  for (const s of SPECS) {
    await open(page, s.id).catch(() => wrong.push(`${s.id}: cannot open`))
    const lines = await page.locator('.result__checked').allInnerTexts(); const got = lines.some((l) => /Rates as of|may have changed since/.test(l))
    if (got !== s.rates) wrong.push(`${s.id}: ${got ? 'has' : 'lacks'} a rates line`)
    await page.getByRole('button', { name: 'Back' }).click().catch(() => {}); await settle(page)
  }
  ok(wrong.length === 0, wrong.join('; '))
}, { now: Date.UTC(2026, 10, 3, 6, 0, 0) })
const EXAMPLE_TOOLS = SPECS.filter((s) => s.example)
C('T-114', 'POS', `"Uses example values" note on the tools with example fields (${EXAMPLE_TOOLS.map((s) => s.id).join(', ')}), and not on a tool without any`, async ({ page }) => {
  for (const s of EXAMPLE_TOOLS) { await open(page, s.id); ok((await page.locator('.result__checked', { hasText: 'Uses example values' }).count()) === 1, `${s.id}: note missing`); await page.getByRole('button', { name: 'Back' }).click(); await settle(page) }
  await open(page, 'emi'); eq(await page.locator('.result__checked', { hasText: 'Uses example values' }).count(), 0, 'EMI')
})
C('T-115', 'POS', 'Draft restore: typing survives a reload (box, term text, rows); an untouched tool has no draft; a different tool is not affected', async ({ page }) => {
  await open(page, 'emi'); await fill(page, 'principal', '777000'); await fill(page, 'tenure', '18 months'); await wait(900)
  await page.reload(); await page.waitForSelector('.app'); await open(page, 'emi')
  eq(await f(page, 'principal').inputValue(), '7,77,000', 'principal'); eq(await f(page, 'tenure').inputValue(), '18 months', 'term')
  await page.getByRole('button', { name: 'Back' }).click(); await settle(page); await open(page, 'multi-loan'); await page.locator('.rows__row').nth(0).locator('input.field').nth(1).fill('123456'); await wait(900)
  await page.reload(); await page.waitForSelector('.app'); await open(page, 'multi-loan'); eq(await page.locator('.rows__row').nth(0).locator('input.field').nth(1).inputValue(), '123456', 'row cell')
  await page.getByRole('button', { name: 'Back' }).click(); await settle(page); await open(page, 'sip'); ok(await hasResult(page), 'sip at defaults')
})
C('T-116', 'CORNER', 'Draft: damaged draft data (wrong types) does not crash the tool', async ({ page }) => {
  await open(page, 'emi'); await noBad(page)
}, { data: seedWith({}, { drafts: { emi: { principal: 5, rate: null, tenure: { x: 1 } }, 'multi-loan': { loans: 'oops', extra: [] }, ghost: { a: 'b' } } }) })
C('T-117', 'POS', 'Legacy saved inputs: tenure "18" + tenureUnit "months" opens as "18 months"; tenure "20" + years as "20"', async ({ page }) => {
  await open(page, 'emi'); eq(await f(page, 'tenure').inputValue(), '18 months', 'months'); near('EMI', num(await rv(page, 'Monthly EMI')), emiRef(100000, 12, 18))
  await page.getByRole('button', { name: 'Back' }).click(); await settle(page); await open(page, 'card-emi'); await noBad(page)
}, { data: seedWith({}, { drafts: { emi: { principal: '100000', rate: '12', tenure: '18', tenureUnit: 'months' } } }) })
C('T-118', 'POS', 'Legacy saved card (old tenure pair, junk unit) opens from Saved with the same answer', async ({ page }) => {
  await tab(page, 'Saved'); await page.locator('.rowcard, .navrow, .row', { hasText: 'Old loan' }).first().click(); await page.waitForSelector('.tool'); await settle(page)
  eq(await f(page, 'tenure').inputValue(), '20', 'years kept'); near('EMI', num(await rv(page, 'Monthly EMI')), emiRef(100000, 12, 240))
}, { data: seedWith({}, { cards: [{ id: 'c1', title: 'Old loan', kind: 'tool', toolId: 'emi', inputs: { principal: '100000', rate: '12', tenure: '20', tenureUnit: 'sideways' }, summary: '', amount: null, lines: [], note: '', tags: [], createdAt: 1700000000000, updatedAt: 1700000000000, pinned: false }] }) })
C('T-120', 'POS', 'Your tools: pins first (max 3, a 4th is refused), then most used (5 shown), unknown ids ignored', async ({ page }) => {
  await tab(page, 'Tools'); await page.locator('.tools__search input').fill(''); await settle(page)
  const labels = await page.locator('.tools__list .navrow__label').allInnerTexts()
  ok((await page.locator('h2.section-head', { hasText: 'Your tools' }).count()) === 1, 'no Your tools heading')
  const yours = await page.locator('h2.section-head', { hasText: 'Your tools' }).locator('xpath=following-sibling::*[1]').locator('.tile__label').allInnerTexts()
  eq(yours[0], 'GST', 'pinned first'); ok(yours.length === 5, 'Your tools has ' + yours.length + ': ' + yours.join(','))
  void labels
  await open(page, 'sip'); await page.getByRole('button', { name: /^Pin SIP/ }).click(); await settle(page)
  eq(await page.getByRole('button', { name: /^Unpin SIP/ }).count(), 0, 'SIP pinned over the limit of 3')
}, { data: seedWith({ pinnedTools: ['gst', 'ghost-tool', 'emi', 'ppf'], toolUse: { fd: 9, rd: 8, nps: 7, epf: 6, swp: 5, inflation: 4, ghost: 99, markup: 1 } }) })
C('T-121', 'POS', 'Date span: same day is "0 days", swapped dates still read start to end, a one-day gap says "1 day"', async ({ page }) => {
  await open(page, 'date'); const set = async (a, b) => { await fill(page, 'start', a); await fill(page, 'end', b) }
  const ids = await page.locator('.field-row input[type=date]').evaluateAll((e) => e.map((x) => x.id)); ok(ids.length >= 2, 'date boxes: ' + ids)
  await page.locator(`#${ids[0]}`).fill('2026-03-05'); await page.locator(`#${ids[1]}`).fill('2026-03-05'); await settle(page); has(await page.locator('.span').innerText(), '0 days', 'same day')
  await page.locator(`#${ids[1]}`).fill('2026-03-06'); await settle(page); has(await page.locator('.span').innerText(), '1 day', 'one day')
  await page.locator(`#${ids[1]}`).fill('2026-02-01'); await settle(page); const sp = await page.locator('.span').innerText(); ok(/1 Feb 2026[\s\S]*5 Mar 2026/.test(sp), 'swapped dates should read earliest first: ' + sp.replace(/\n/g, ' '))
  void set
})

// ==================================================================================================================
// T-2xx  invalid marking on ALL tools, layout at 200% in both themes for the new tools
// ==================================================================================================================
for (const s of SPECS) {
  C(`T-200-${s.id}`, 'UX', `${s.title}: blanking or junking each box gives an error that marks a box (aria-invalid, described by the message); fixing it clears the mark; no NaN`, async ({ page }) => {
    await open(page, s.id); await more(page)
    const ids = await page.locator('.tool__form .field-row input[id^="f-"]').evaluateAll((els) => els.filter((e) => e.type === 'text' && e.getAttribute('inputmode') && e.value !== '').map((e) => ({ id: e.id.slice(2), v: e.value })))
    const issues = []
    for (const { id, v } of ids) {
      for (const bad of ['', 'abc']) {
        await f(page, id).fill(bad).catch(() => {}); await settle(page)
        const e = await err(page)
        if (e) {
          const n = await marked(page)
          if (n < 1) issues.push(`${id}=${JSON.stringify(bad)}: error "${e.slice(0, 50)}" but nothing marked`)
          else { const d = await page.locator('.tool__form [aria-invalid="true"]').first().getAttribute('aria-describedby'); if (d && !d.includes('tool-error')) issues.push(`${id}: marked box not described by the message`) }
        } else if (bad === 'abc' && (await hasResult(page))) {
          issues.push(`${id}="abc": no error, result still shown (junk read as a number?)`)
        }
        const t = await page.locator('.tool').innerText(); if (BAD.test(t)) issues.push(`${id}=${JSON.stringify(bad)}: ${t.match(BAD)[0]} on screen`)
      }
      await f(page, id).fill(v); await settle(page)
      if ((await marked(page)) > 0 && !(await err(page))) issues.push(`${id}: mark stays after the value is restored`)
    }
    ok(issues.length === 0, issues.slice(0, 4).join(' || ') + (issues.length > 4 ? ` (+${issues.length - 4})` : ''))
  })
}
const NEW = ['emergency-fund', 'debt-to-income', 'savings-rate', 'markup', 'runway', 'multi-loan', 'emi', 'inflation', 'swp', 'tip', 'world-time']
for (const theme of ['dark', 'light']) for (const font of [100, 200]) for (const id of NEW) {
  C(`T-210-${id}-${theme}-${font}`, 'UI', `${TITLE[id]}: 360px, ${font}% font, ${theme}: nothing sideways, controls 44px, no NaN, no console errors`, async ({ page }) => {
    await open(page, id); await more(page)
    const o = await overflowing(page); const sw = await page.evaluate(() => { const s = [...document.querySelectorAll('.screen')].pop(); return s.scrollWidth > s.clientWidth + 1 || document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 })
    const small = await page.evaluate(() => { const s = [...document.querySelectorAll('.screen')].pop(), out = []; s.querySelectorAll('button, input:not([type=hidden]), summary, [role=radio]').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && r.height && !e.closest('.sr-only') && r.width < 43.5 && r.height < 43.5) out.push(`${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || e.id).trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`) }); return out.slice(0, 4) })
    await noBad(page)
    if (id === 'multi-loan' || id === 'runway') await page.screenshot({ path: `${SHOTS}/${id}-${theme}-${font}.png` })
    ok(o.length === 0 && !sw && small.length === 0, [...o, sw ? 'page scrolls sideways' : '', ...small].filter(Boolean).join(' | '))
  }, { theme, font })
}
C('T-220', 'UI', 'Worst case: 200% font, 320px wide, light, six loans with long names and huge balances: nothing sideways', async ({ page }) => {
  await open(page, 'multi-loan')
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /^Add/ }).first().click()
  await setRows(page, Array.from({ length: 6 }, (_, i) => ['A very long loan name number ' + i, '99999999999', '12.5', '99999999']))
  await noBad(page); const o = await overflowing(page); ok(o.length === 0, o.join(' | '))
}, { theme: 'light', font: 200, width: 320, height: 640 })

// ==================================================================================================================
// T-3xx  Calculate and Scientific
// ==================================================================================================================
const KEY = { '+': 'Add', '-': 'Subtract', '*': 'Multiply', '/': 'Divide', '.': 'Decimal point', '=': 'Equals', C: 'Clear' }
const tap = async (page, s) => { for (const c of s) await page.locator(`.key[aria-label="${KEY[c] ?? c}"]`).first().click() }
const disp = async (page) => ({ expr: await page.locator('.display__expr').inputValue(), res: (await page.locator('.display__result').innerText()).trim(), note: (await page.locator('.display__note').innerText()).trim() })
C('T-300', 'POS', 'Add expense after "=": 12*3 gives a chip that opens Add expense with 36; not offered for 0, a negative or an error', async ({ page }) => {
  await tap(page, '12*3='); const chip = page.getByRole('button', { name: 'Add expense', exact: true }); eq(await chip.count(), 1, 'chip')
  await chip.click(); await settle(page); eq((await page.locator('.sheet input').first().inputValue()).replace(/[^\d.]/g, ''), '36', 'amount')
  await page.locator('.sheet__close').click(); await settle(page)
  for (const e of ['C5-9=', 'C0=', 'C5/0=', 'C0.001=']) { await tap(page, e); eq(await chip.count(), 0, `chip after ${e}`) }
  await tap(page, 'C0.015='); eq(await chip.count(), 1, '0.015 rounds to 0.02'); await tap(page, 'C1/3='); eq(await chip.count(), 1, '1/3')
})
C('T-301', 'POS', 'Big numbers: lakh-crore grouping up to 15 digits, 1.2E+25 beyond, "Too large" past 1e100; the answer reads back when pasted', async ({ page }) => {
  await page.locator('.display__expr').focus()
  await page.keyboard.type('999999999999999='.replace('=', '+0')); await settle(page); has((await disp(page)).res, '9,99,99,99,99,99,999', '15 digits Indian')
  await page.keyboard.press('Control+a'); await page.keyboard.type('12000000000000*1000000000000'); await settle(page); eq((await disp(page)).res, '1.2E+25', '1.2E+25')
  await page.keyboard.press('Control+a'); await page.keyboard.type(Array(11).fill('9999999999').join('*')); await settle(page); has((await disp(page)).res + (await disp(page)).note, 'Too large', '1e110')
  await page.keyboard.press('Control+a'); await page.keyboard.type('1/3'); await settle(page); has((await disp(page)).res, '0.33333', '1/3')
  await page.keyboard.press('Control+a'); await page.keyboard.type('0.1+0.2'); await settle(page); eq((await disp(page)).res, '0.3', 'exact decimals')
  await page.keyboard.press('Control+a'); await page.keyboard.type('5/0'); await settle(page); has((await disp(page)).note, "Can't divide by zero", 'divide by zero'); ok(!BAD.test((await disp(page)).res), 'NaN shown')
})
C('T-302', 'UI', 'Big result fits 360px at 200% font in light theme', async ({ page }) => {
  await page.locator('.display__expr').focus(); await page.keyboard.type('99999999999*99999'); await settle(page)
  const o = await overflowing(page); ok(o.length === 0, o.join(' | ')); await page.screenshot({ path: `${SHOTS}/calc-big-200.png` })
}, { theme: 'light', font: 200 })
C('T-303', 'POS', 'Cursor editing: type 12+34, tap between digits and type; swap an operator; edit after "="', async ({ page }) => {
  await tap(page, '12+34'); await page.evaluate(() => { const el = document.querySelector('.display__expr'); el.focus(); el.setSelectionRange(2, 2) }); await wait(80)
  await tap(page, '9'); eq((await disp(page)).expr.replace(/\s/g, ''), '192+34', 'inserted at cursor'); eq((await disp(page)).res, '226', 'result')
  await page.evaluate(() => { const el = document.querySelector('.display__expr'); el.focus(); el.setSelectionRange(el.value.length, el.value.length) }); await tap(page, '*'); eq((await disp(page)).expr.replace(/\s/g, ''), '192+34×'.replace('×', '*'), 'trailing op'); await tap(page, '-')
  ok(!/[*×−-]\s*[*×−-]/.test((await disp(page)).expr.replace('+', '')), 'operator doubled: ' + (await disp(page)).expr)
})
C('T-304', 'POS', 'Copy with and without commas: Settings "with" copies 1,50,000; "without" copies 150000; a number with no commas copies straight away', async ({ page }) => {
  await tap(page, '150000'); await page.locator('.util__btn', { hasText: 'Copy' }).click(); await settle(page); await wait(250)
  eq(await page.evaluate(() => navigator.clipboard.readText()), '1,50,000', 'with')
}, { settings: { copyFormat: 'with' } })
C('T-305', 'POS', 'Copy "without" setting', async ({ page }) => {
  await tap(page, '150000'); await page.locator('.util__btn', { hasText: 'Copy' }).click(); await wait(250)
  eq(await page.evaluate(() => navigator.clipboard.readText()), '150000', 'without')
}, { settings: { copyFormat: 'without' } })
C('T-306', 'POS', 'Copy (ask): a number with commas shows the sheet; a number without commas (12) copies at once', async ({ page }) => {
  await tap(page, '12'); await page.locator('.util__btn', { hasText: 'Copy' }).click(); await wait(250); eq(await page.locator('.sheet').count(), 0, 'sheet for 12')
  await tap(page, 'C150000'); await page.locator('.util__btn', { hasText: 'Copy' }).click(); await page.waitForSelector('.sheet'); has(await page.locator('.sheet').innerText(), 'Without commas')
})
C('T-307', 'POS', 'Rapid taps: 200 key presses in a row never freeze or show NaN; Clear resets', async ({ page }) => {
  for (let i = 0; i < 40; i++) await tap(page, '9+')
  await tap(page, '9='); const d = await disp(page); ok(!BAD.test(d.res), d.res); eq(d.res, '369', '40 x 9 + 9'); await tap(page, 'C'); eq((await disp(page)).res, '0', 'clear')
})
C('T-308', 'POS', 'Calculator: the typed line survives a reload', async ({ page }) => {
  await tap(page, '12*3'); await wait(700); await page.reload(); await page.waitForSelector('.app'); has((await disp(page)).expr, '12', 'expr'); has((await disp(page)).res, '36', 'result')
})
C('T-309', 'POS', 'Scientific: sin 30 = 0.5 in degrees, sqrt 2, 5! = 120, and no NaN on 0^0 / sqrt(-1) / ln(0)', async ({ page }) => {
  await tab(page, 'Tools'); await page.locator('.hero').click(); await page.waitForSelector('.sci-screen')
  await page.locator('.display__expr').focus()
  for (const [e, want] of [['sin(30)', '0.5'], ['5!', '120'], ['sqrt(2)', '1.41421']]) { await page.keyboard.press('Control+a'); await page.keyboard.type(e); await settle(page); has((await disp(page)).res, want, e) }
  for (const e of ['0^0', 'sqrt(-1)', 'ln(0)', 'log(-5)', '1/0', 'tan(90)', '1000!']) { await page.keyboard.press('Control+a'); await page.keyboard.type(e); await settle(page); const d = await disp(page); ok(!BAD.test(d.res + d.note), `${e}: ${d.res} / ${d.note}`) }
})

// ==================================================================================================================
async function main() {
  const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null
  const todo = cases.filter((c) => (!only || only.test(c.id)))
  app = await startApp()
  const conc = Number(process.env.CONC || 3), results = new Array(todo.length); let next = 0
  await Promise.all(Array.from({ length: conc }, async () => { while (next < todo.length) { const i = next++; results[i] = await runCase(todo[i]); const r = results[i]; console.log(`${r.ok ? 'PASS' : 'FAIL'} ${todo[i].id} ${todo[i].type} ${todo[i].title}${r.ok ? '' : ' :: ' + r.msg}`) } }))
  const fails = results.filter((r) => !r.ok).length
  console.log(`\nSUMMARY ${todo.length} cases, ${fails} failed`)
  await app.stop(); process.exit(fails ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(2) })
