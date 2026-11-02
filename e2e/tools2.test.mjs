// Test campaign: Tools 2 = calculators 27 to 51 (SIP ... A/B sample size).
// Run:  node e2e/tools2.test.mjs            (all)     ONLY=sip node e2e/tools2.test.mjs    (cases whose id matches the regex)
// One line per case:  PASS|FAIL <id> <TYPE> <title> :: <actual if fail>.  Exit code 1 on any FAIL.
// Each case gets a fresh page (new browser context, seeded storage). Nothing here edits src/ or touches a phone.
import { pathToFileURL } from 'node:url'
import Decimal from 'decimal.js'
import { startApp, openApp, tab, overflowing, stored } from './lib.mjs'

Decimal.set({ precision: 60 })
export const D = (x) => new Decimal(x)

// ---------------------------------------------------------------------------------------------
// The 25 calculators: where they live in the UI, and their fields (labels as shown on screen).
// ---------------------------------------------------------------------------------------------
const SAV = 'Savings and investing', TAX = 'Tax and salary', BIZ = 'Business metrics'
export const SPEC = {
  sip: { g: SAV, t: 'SIP: monthly investing', main: 'Value at the end', req: ['Monthly investment', 'Expected yearly return', 'Number of years'], rupee: ['Monthly investment'], whole: ['Number of years'] },
  'step-up-sip': { g: SAV, t: 'Step-up SIP', main: 'Value at the end', req: ['Monthly investment', 'Expected yearly return', 'Number of years', 'Yearly increase'], rupee: ['Monthly investment'], whole: ['Number of years'] },
  lumpsum: { g: SAV, t: 'Lump sum investment', main: 'Final value', req: ['Amount invested', 'Expected yearly return', 'Number of years'], rupee: ['Amount invested'], whole: ['Number of years'] },
  'goal-sip': { g: SAV, t: 'SIP for a goal', main: 'Monthly SIP needed', req: ['Target amount', 'Expected yearly return', 'Number of years'], opt: ['Already saved'], rupee: ['Target amount', 'Already saved'], whole: ['Number of years'] },
  fd: { g: SAV, t: 'Fixed deposit', main: 'Maturity value', req: ['Deposit amount', 'Yearly interest rate', 'Number of years'], opt: ['Your tax slab'], rupee: ['Deposit amount'] },
  rd: { g: SAV, t: 'Recurring deposit', main: 'Maturity value', req: ['Monthly deposit', 'Yearly interest rate', 'Number of years'], rupee: ['Monthly deposit'] },
  ppf: { g: SAV, t: 'Public Provident Fund', main: 'Maturity value', req: ['Yearly deposit', 'Yearly interest rate'], rupee: ['Yearly deposit'] },
  nps: { g: SAV, t: 'NPS pension', main: 'Monthly pension', req: ['Monthly contribution', 'Expected yearly return', 'Your age now', 'Retirement age'], opt: ['Share put into annuity', 'Yearly annuity rate'], rupee: ['Monthly contribution'] },
  epf: { g: SAV, t: 'Provident fund (EPF)', main: 'EPF at retirement', req: ['Monthly basic + DA', 'Years to retirement', 'Yearly salary rise', 'Yearly EPF interest rate'], opt: ['Your share (% of basic)', 'Employer share (% of basic)', 'Pension wage ceiling'], rupee: ['Monthly basic + DA', 'Pension wage ceiling'], whole: ['Years to retirement'] },
  swp: { g: SAV, t: 'SWP: monthly withdrawals', main: 'Months it lasts', req: ['Starting amount', 'Monthly withdrawal', 'Expected yearly return'], rupee: ['Starting amount', 'Monthly withdrawal'] },
  inflation: { g: SAV, t: 'Inflation', main: 'Future cost of the same thing', req: ['Amount', 'Yearly inflation', 'Number of years'], opt: ['Your yearly return'], rupee: ['Amount'] },
  'cagr-xirr': { g: SAV, t: 'Investment return', main: 'Yearly growth (CAGR)', req: ['Starting value', 'Ending value', 'Number of years'], rupee: ['Starting value', 'Ending value'] },
  'income-tax': { g: TAX, t: 'Income tax: old vs new', main: null, req: ['Yearly salary before tax'], opt: ['Other income', 'Yearly basic + DA', 'Employer NPS contribution', 'Parents health insurance (old regime)', 'Your own NPS (old regime)', 'Professional tax paid (old regime)'], rupee: ['Yearly salary before tax', 'Section 80C (old regime)', 'Health insurance 80D (old regime)', 'Home loan interest (old regime)', 'HRA exemption (old regime)'] },
  'advance-tax': { g: TAX, t: 'Advance tax', main: 'Interest if paid as entered', req: ['Total tax for the year'], opt: ['TDS and TCS already deducted', 'Paid by 15 Jun', 'Months after 31 Mar 2027'], rupee: ['Total tax for the year', 'TDS and TCS already deducted', 'Paid by 15 Jun', 'Paid 16 Jun-15 Sep', 'Paid 16 Sep-15 Dec', 'Paid 16 Dec-15 Mar'] },
  'capital-gains': { g: TAX, t: 'Capital gains tax', main: 'Tax on this gain, with cess', req: ['Buying price', 'Selling price'], opt: ['Selling costs'], rupee: ['Buying price', 'Selling price', 'Selling costs'] },
  'presumptive-44ada': { g: TAX, t: 'Freelancer tax (44ADA)', main: null, req: ['Total receipts for the year', 'Actual business expenses'], opt: ['Share received in cash'], rupee: ['Total receipts for the year', 'Actual business expenses', 'Other income'] },
  'in-hand-salary': { g: TAX, t: 'Take-home salary', main: 'Take-home a month', req: ['Yearly CTC (total package)', 'Basic + DA, % of CTC', 'Your PF (% of basic)'], rupee: ['Yearly CTC (total package)', 'Professional tax, monthly', 'Yearly HRA exemption (old regime)'] },
  gratuity: { g: TAX, t: 'Gratuity', main: 'Gratuity payable', req: ['Last monthly basic + DA', 'Years of service'], opt: ['Extra months'], rupee: ['Last monthly basic + DA', 'Gratuity you actually got'] },
  'cac-ltv': { g: BIZ, t: 'Customer cost and value', main: 'CAC (cost to win one customer)', req: ['Marketing and sales spend', 'New customers won', 'Monthly revenue per customer (ARPU)', 'Gross margin', 'Monthly churn (customers lost)'], rupee: ['Marketing and sales spend', 'Monthly revenue per customer (ARPU)'] },
  'cac-payback': { g: BIZ, t: 'Customer payback time', main: 'Payback period (months)', req: ['Cost to win one customer', 'Monthly revenue per customer (ARPU)', 'Gross margin'], rupee: ['Cost to win one customer', 'Monthly revenue per customer (ARPU)'] },
  retention: { g: BIZ, t: 'Customer retention', main: null, req: ['Customers at the start'], rupee: [] },
  funnel: { g: BIZ, t: 'Funnel conversion', main: 'Overall conversion', req: [], rupee: [] },
  'arr-mrr': { g: BIZ, t: 'Recurring revenue forecast', main: null, req: ['Current monthly revenue (MRR)', 'New customer growth a month', 'Expansion a month', 'Monthly revenue churn', 'Months to project'], rupee: ['Current monthly revenue (MRR)'] },
  'rule-of-40': { g: BIZ, t: 'Rule of 40 and burn multiple', main: 'Rule of 40 score', req: ['Revenue growth', 'Profit margin', 'Net burn', 'Net new ARR'], rupee: ['Net burn', 'Net new ARR'] },
  'ab-sample-size': { g: BIZ, t: 'A/B test sample size', main: 'Visitors needed per variant', req: ['Current conversion rate', 'Smallest lift to detect', 'Daily visitors'], opt: ['Significance level', 'Test power'], rupee: [] },
}
export const IDS = Object.keys(SPEC)

// ---------------------------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------------------------
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const exact = (s) => new RegExp('^\\s*' + esc(s) + '\\s*$')
export const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

/** Opens a calculator the way a person does: Tools tab, group tile, row. */
export async function openTool(page, id) {
  const s = SPEC[id]
  await tab(page, 'Tools')
  await page.locator('.tile', { hasText: s.g }).click()
  await page.locator('.navrow .row__label').filter({ hasText: exact(s.t) }).click()
  await page.waitForSelector('.tool')
  await settle(page)
}

export const fieldRow = (page, label) => page.locator('.field-row').filter({ has: page.locator('.field-label').filter({ hasText: exact(label) }) })

export async function openMore(page) {
  const d = page.locator('details.more')
  if ((await d.count()) && !(await d.evaluate((e) => e.open))) await d.locator('summary').click()
}

/** Types text into a number, text or date box. `fill` replaces the box content, which is what a paste does. */
export async function setField(page, label, text) {
  let row = fieldRow(page, label)
  if (!(await row.count()) || !(await row.first().isVisible())) { await openMore(page); row = fieldRow(page, label) }
  const input = row.locator('input').first()
  await input.fill(text, { timeout: 8000 })
  await settle(page)
}

export async function getField(page, label) {
  let row = fieldRow(page, label)
  if (!(await row.count()) || !(await row.first().isVisible())) { await openMore(page); row = fieldRow(page, label) }
  return row.locator('input').first().inputValue()
}

/** Chooses an option in a segmented control or in the picker sheet. */
export async function choose(page, label, option) {
  let row = fieldRow(page, label)
  if (!(await row.count()) || !(await row.first().isVisible())) { await openMore(page); row = fieldRow(page, label) }
  if (await row.locator('.seg').count()) await row.locator('.seg__opt').filter({ hasText: exact(option) }).click()
  else {
    await row.locator('button.pick').click()
    await page.locator('.sheet .pick__opt').filter({ hasText: exact(option) }).click()
  }
  await settle(page)
}

export async function pickerOptions(page, label) {
  let row = fieldRow(page, label)
  if (!(await row.count()) || !(await row.first().isVisible())) { await openMore(page); row = fieldRow(page, label) }
  await row.locator('button.pick').click()
  const labels = await page.locator('.sheet .pick__opt .pick__label').allInnerTexts()
  await page.locator('.sheet .sheet__close').click()
  return labels
}

/** Reads the screen: result rows, error line, note. */
export async function read(page) {
  await settle(page)
  const err = (await page.locator('.tool__error').count()) ? (await page.locator('.tool__error').first().innerText()).trim() : null
  const rows = await page.locator('.result .result__row').evaluateAll((els) =>
    els.map((e) => ({
      label: e.querySelector('.result__label').textContent.trim(),
      value: e.querySelector('.result__value').textContent.replace(/\s*—\s*(in your favour|against you)/, '').trim(),
      main: e.classList.contains('result__row--main'),
    })),
  )
  const note = (await page.locator('.result__note').count()) ? (await page.locator('.result__note').first().innerText()).trim() : ''
  const text = await page.locator('.tool').innerText()
  return { err, rows, note, ok: rows.length > 0, main: rows.find((r) => r.main) ?? rows[0] ?? null, text }
}

/** "₹11,61,695.38" -> Decimal; "12.5%" -> 12.5; "−₹1,000" -> -1000. null when not a number. */
export function num(text) {
  if (text == null) return null
  const t = String(text).replace(/[₹,%\s]/g, '').replace(/−/g, '-')
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  return D(t)
}
export const rowVal = (r, label) => {
  const m = r.rows.find((x) => (label instanceof RegExp ? label.test(x.label) : x.label === label))
  return m ? m.value : undefined
}
export const rowNum = (r, label) => num(rowVal(r, label))
export const BAD = /NaN|undefined|Infinity|\[object|\bnull\b/
export const badText = (r) => (BAD.test(r.text) ? (r.text.match(BAD) || [])[0] : null)

/** Throws unless |a - b| <= tol. */
export function close(label, a, b, tol = 0.011) {
  if (a === null || a === undefined) throw new Error(`${label}: no number on screen (expected ${D(b).toFixed(2)})`)
  if (D(a).minus(D(b)).abs().gt(tol)) throw new Error(`${label}: screen ${D(a).toFixed(4)} vs independent ${D(b).toFixed(4)}`)
}
export const is = (cond, msg) => { if (!cond) throw new Error(msg) }

/** Everything that pokes out sideways. */
export async function sideways(page) {
  const o = await overflowing(page)
  const sw = await page.evaluate(() => {
    const out = []
    const scr = [...document.querySelectorAll('.screen')].pop()
    for (const e of [document.documentElement, scr, scr?.querySelector('.tool'), document.querySelector('.app')]) {
      if (e && e.scrollWidth > e.clientWidth + 1) out.push(`${e.className || e.tagName} scrollWidth ${e.scrollWidth} > ${e.clientWidth}`)
    }
    return out
  })
  return [...o, ...sw]
}

/** Visible controls smaller than 44px in both directions. */
export const smallTargets = (page) =>
  page.evaluate(() => {
    const scr = [...document.querySelectorAll('.screen')].pop()
    const out = []
    scr.querySelectorAll('button, input, summary, a, [role=radio], [role=switch]').forEach((e) => {
      const r = e.getBoundingClientRect()
      if (!r.width || !r.height) return
      if (e.closest('.sr-only')) return
      if (r.width < 43.5 && r.height < 43.5) out.push(`${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || e.id || '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`)
    })
    return out.slice(0, 6)
  })

// ---------------------------------------------------------------------------------------------
// Independent maths (decimal.js, written from the textbook, not copied from the app)
// ---------------------------------------------------------------------------------------------
export const ref = {
  /** SIP, payment at the start of each month, monthly rate = annual/12 */
  sip: (p, r, y) => { const i = D(r).div(1200), n = y * 12; return D(p).times(D(1).plus(i).pow(n).minus(1)).div(i).times(D(1).plus(i)) },
  lump: (p, r, y) => D(p).times(D(1).plus(D(r).div(100)).pow(y)),
  fd: (p, r, y, n) => D(p).times(D(1).plus(D(r).div(100).div(n)).pow(D(y).times(n))),
  /** Indian bank RD: M = R * ((1+i)^n - 1) / (1 - (1+i)^(-1/3)), i = r/4, n = quarters */
  rd: (R, r, months) => { const q = D(1).plus(D(r).div(400)), n = D(months).div(3); return D(R).times(q.pow(n).minus(1)).div(D(1).minus(q.pow(D(-1).div(3)))) },
  /** PPF: deposit at start of each year, interest at year end: P(1+r)((1+r)^n - 1)/r */
  ppf: (P, r, n) => { const g = D(1).plus(D(r).div(100)); return D(P).times(g).times(g.pow(n).minus(1)).div(D(r).div(100)) },
  stepSip(p, r, y, step) { let amt = D(p), bal = D(0), inv = D(0); const i = D(r).div(1200); for (let k = 0; k < y; k++) { for (let m = 0; m < 12; m++) { bal = bal.plus(amt).times(D(1).plus(i)); inv = inv.plus(amt) } amt = amt.times(D(1).plus(D(step).div(100))) } return { bal, inv } },
  /** SIP needed for a target: gap / annuity factor */
  goal: (t, r, y, saved = 0) => { const gap = D(t).minus(D(saved).times(D(1).plus(D(r).div(100)).pow(y))); const i = D(r).div(1200), n = y * 12; return gap.div(D(1).plus(i).pow(n).minus(1).div(i).times(D(1).plus(i))) },
  /** XIRR by bisection on actual/365 */
  xirr(flows) {
    const t0 = Math.min(...flows.map((f) => f.t))
    const npv = (r) => flows.reduce((s, f) => s.plus(D(f.a).div(D(1).plus(r).pow(D(f.t - t0).div(86400000 * 365)))), D(0))
    let lo = D('-0.99'), hi = D(10)
    for (let k = 0; k < 200; k++) { const mid = lo.plus(hi).div(2); if (npv(mid).gt(0)) lo = mid; else hi = mid }
    return lo.plus(hi).div(2).times(100)
  },
  /** Slab tax. slabs = [[upTo|null, pct]...] */
  slab(income, slabs) { let from = D(0), tax = D(0); for (const [up, pct] of slabs) { const top = up === null ? D(income) : Decimal.min(income, up); if (top.gt(from)) tax = tax.plus(top.minus(from).times(pct).div(100)); if (up === null || D(income).lte(up)) break; from = D(up) } return tax },
  round10: (v) => D(v).floor().div(10).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(10),
}
export const NEW_SLABS = [[400000, 0], [800000, 5], [1200000, 10], [1600000, 15], [2000000, 20], [2400000, 25], [null, 30]]
export const OLD_SLABS = {
  below60: [[250000, 0], [500000, 5], [1000000, 20], [null, 30]],
  '60to80': [[300000, 0], [500000, 5], [1000000, 20], [null, 30]],
  '80plus': [[500000, 0], [1000000, 20], [null, 30]],
}
const SUR = [[5000000, 10], [10000000, 15], [20000000, 25], [50000000, 37]]
/** Tax before cess and surcharge, after rebate (new: 60k up to 12L with marginal relief above; old: 12.5k up to 5L). */
function coreTax(inc, regime, age) {
  let tax = ref.slab(inc, regime === 'new' ? NEW_SLABS : OLD_SLABS[age])
  if (regime === 'new') {
    if (inc.lte(1200000)) tax = tax.minus(Decimal.min(tax, 60000))
    else { const ex = inc.minus(1200000); if (tax.gt(ex)) tax = ex }
  } else if (inc.lte(500000)) tax = tax.minus(Decimal.min(tax, 12500))
  return tax
}
/** Tax and surcharge, with marginal relief: tax+surcharge may not exceed (tax+surcharge at the threshold) + income above it. */
function taxSur(inc, regime, age) {
  const tax = coreTax(inc, regime, age)
  const band = [...SUR].reverse().find(([a]) => inc.gt(a))
  if (!band) return { tax, sur: D(0) }
  let rate = D(band[1]); if (regime === 'new') rate = Decimal.min(rate, 25)
  const th = D(band[0]); const at = taxSur(th, regime, age)
  const cap = at.tax.plus(at.sur).plus(inc.minus(th)).minus(tax)
  return { tax, sur: Decimal.max(0, Decimal.min(tax.times(rate).div(100), cap)) }
}
/** Total tax with 4% cess, rounded to the nearest 10, for TAXABLE income (after deductions). */
export function taxOn(income, regime, age = 'below60') {
  const inc = ref.round10(income)
  const { tax, sur } = taxSur(inc, regime, age)
  return ref.round10(tax.plus(sur).times(1.04))
}

// ---------------------------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------------------------
const cases = []
/** Registers a case. o = { tool, theme, font, width, now } ; tool opens that calculator before fn runs. */
export const T = (id, type, title, fn, o = {}) => cases.push({ id, type, title, fn, o })

async function runCase(app, c) {
  const t0 = Date.now()
  const o = c.o
  let ctx
  try {
    ctx = await openApp(app, { theme: o.theme ?? 'dark', font: o.font ?? 100, width: o.width ?? 360, now: o.now ?? null, data: o.data ?? null })
    const { page, errors } = ctx
    if (o.tool) await openTool(page, o.tool)
    await Promise.race([
      c.fn({ page, errors, app }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout after 60s')), 60000)),
    ])
    if (!o.allowErrors && errors.length) throw new Error('console/page error: ' + errors[0])
    return { ok: true, ms: Date.now() - t0 }
  } catch (e) {
    return { ok: false, msg: String(e && e.message ? e.message : e).replace(/\s+/g, ' ').slice(0, 400), ms: Date.now() - t0 }
  } finally {
    if (ctx) await ctx.close().catch(() => {})
  }
}

export async function runAll(registerAll) {
  registerAll()
  const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null
  const todo = cases.filter((c) => !only || only.test(c.id))
  const app = await startApp()
  const conc = Number(process.env.CONC || 4)
  const results = new Array(todo.length)
  let next = 0
  await Promise.all(Array.from({ length: conc }, async () => {
    while (next < todo.length) {
      const i = next++
      results[i] = await runCase(app, todo[i])
    }
  }))
  let fails = 0
  const byType = {}
  todo.forEach((c, i) => {
    const r = results[i]
    byType[c.type] ??= { pass: 0, fail: 0 }
    if (r.ok) byType[c.type].pass++
    else { byType[c.type].fail++; fails++ }
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${c.id} ${c.type} ${c.title}${r.ok ? '' : ' :: ' + r.msg}`)
  })
  console.log('\nSUMMARY ' + todo.length + ' cases, ' + fails + ' failed. ' + Object.entries(byType).map(([k, v]) => `${k} ${v.pass}/${v.pass + v.fail}`).join(', '))
  await app.stop()
  process.exit(fails ? 1 : 0)
}

export const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href
export { openApp, tab, stored, startApp }
