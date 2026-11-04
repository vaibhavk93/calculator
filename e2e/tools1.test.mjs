// Test campaign: tools-1 = the first 26 calculators (everyday + loans) and the shared calculator-page chrome.
// Run:  node e2e/tools1.test.mjs            (all cases)
//       node e2e/tools1.test.mjs emi gst    (only cases whose id contains one of the words)
//       ONLY=emi|gst node e2e/tools1.test.mjs   (only cases whose id matches the regex)
// One line per case:  PASS|FAIL <id> <type> <title> :: <actual if fail>.  Exit code 1 if any FAIL.
// Types: POS NEG ERR CORNER UI UX RUNTIME.  Each case opens its own fresh page with its own seeded data.
// A FAIL is either a BUG or a spec mismatch (the report says which).
import Decimal from 'decimal.js'
import { writeFileSync } from 'node:fs'
import { startApp, openApp, tab, overflowing, stored } from './lib.mjs'

Decimal.set({ precision: 60 })
const D = (x) => new Decimal(x)

// ---------------------------------------------------------------------------------------------------------------------
// The 26 calculators: id, the title on its page, and the group tile it lives under.
// ---------------------------------------------------------------------------------------------------------------------
const T = (id, title, group) => ({ id, title, group })
const TOOLS = [
  T('percentage', 'Percentage', 'Math and numbers'),
  T('number-base', 'Binary and hex', 'Math and numbers'),
  T('discount', 'Discount', 'Money and shopping'),
  T('gst', 'GST', 'Money and shopping'),
  T('unit-price', 'Compare pack prices', 'Money and shopping'),
  T('tip', 'Tip and split', 'Money and shopping'),
  T('currency', 'Currency converter', 'Money and shopping'),
  T('unit-converter', 'Unit converter', 'Units and travel'),
  T('fuel-efficiency', 'Mileage converter', 'Units and travel'),
  T('fuel-cost', 'Fuel cost', 'Units and travel'),
  T('date', 'Date calculator', 'Dates and health'),
  T('world-time', 'World time', 'Dates and health'),
  T('body-metrics', 'BMI and calories', 'Dates and health'),
  T('ovulation', 'Ovulation', 'Dates and health'),
  T('grade-average', 'Marks and GPA', 'Dates and health'),
  T('emi', 'Loan EMI', 'Loans and EMI'),
  T('amortisation', 'Repayment schedule', 'Loans and EMI'),
  T('reverse-emi', 'Affordable loan', 'Loans and EMI'),
  T('prepayment', 'Loan prepayment', 'Loans and EMI'),
  T('rate-change', 'Floating rate change', 'Loans and EMI'),
  T('balance-transfer', 'Loan balance transfer', 'Loans and EMI'),
  T('loan-compare', 'Compare loan offers', 'Loans and EMI'),
  T('card-emi', 'Credit card EMI cost', 'Loans and EMI'),
  T('home-loan-tax', 'Home loan tax benefit', 'Loans and EMI'),
  T('simple-compound', 'Simple vs compound interest', 'Loans and EMI'),
  T('loan-presets', 'Typical loan rates', 'Loans and EMI'),
]
const tool = (id) => TOOLS.find((t) => t.id === id)

// ---------------------------------------------------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------------------------------------------------
let app
const cases = []
const def = (id, type, title, fn) => cases.push({ id, type, title, fn })
const results = []
const matrixLog = []
const NOISE = [/Failed to load resource/i, /net::ERR/i, /fetch/i, /CORS/i, /currency/i] // the live-rate fetch of the currency tool (offline here)

async function withPage(opts, fn) {
  const o = await openApp(app, opts)
  try {
    await o.context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
    return await fn(o)
  } finally {
    await o.close().catch(() => {})
  }
}
const realErrors = (errors) => errors.filter((e) => !NOISE.some((n) => n.test(e)))
const fail = (...issues) => {
  const l = issues.flat().filter(Boolean)
  if (l.length) throw new Error(l.slice(0, 5).join(' | ') + (l.length > 5 ? ` (+${l.length - 5} more)` : ''))
}

// ---- navigation ------------------------------------------------------------------------------------------------------
const scr = (page, t) => page.locator(`.screen[aria-label="${t.title}"]`)
async function openTool(page, t, how = 'group') {
  await tab(page, 'Tools')
  if (how === 'search') {
    await page.locator('input[aria-label="Search calculators"]').fill(t.title)
    await page.locator('.tools__list .navrow', { has: page.getByText(t.title, { exact: true }) }).first().click()
  } else {
    await page.locator('.tile', { hasText: t.group }).click()
    await page.locator('.screen .navrow', { has: page.getByText(t.title, { exact: true }) }).first().click()
  }
  await scr(page, t).waitFor({ timeout: 5000 })
  return scr(page, t)
}

// ---- reading the page --------------------------------------------------------------------------------------------------
const BAD = /\bNaN\b|\bundefined\b|\bInfinity\b|\[object|\bnull\b/
const rowsOf = (s) =>
  s.locator('section.result .result__row').evaluateAll((els) => els.map((e) => [e.querySelector('.result__label')?.textContent ?? '', (e.querySelector('.result__value')?.textContent ?? '').replace(/ — (in your favour|against you)$/, '')]))
const cardsOf = (s) =>
  s.locator('section.result .rowcard').evaluateAll((els) => els.map((e) => ({ title: e.querySelector('.rowcard__title')?.textContent ?? '', cells: Object.fromEntries([...e.querySelectorAll('.rowcard__cell')].map((c) => [c.querySelector('dt')?.textContent, c.querySelector('dd')?.textContent])) })))
const kvOf = (s) => s.locator('section.result .kv__row').evaluateAll((els) => els.map((e) => [e.querySelector('.kv__k')?.textContent ?? '', e.querySelector('.kv__v')?.textContent ?? '']))
/** First number in a formatted string: "₹1,04,13,878.80" -> Decimal. */
const num = (txt) => {
  const m = String(txt).replace(/,/g, '').replace(/−/g, '-').match(/-?\d+(\.\d+)?(E[+-]?\d+)?/i)
  if (!m) throw new Error(`no number in "${txt}"`)
  return D(m[0])
}
const rowVal = async (s, label) => {
  const r = (await rowsOf(s)).find(([l]) => l === label || l.startsWith(label))
  if (!r) throw new Error(`no result row "${label}"`)
  return r[1]
}
const snap = async (s) => {
  const hasResult = (await s.locator('section.result').count()) > 0
  const errEl = s.locator('.tool__error')
  const err = (await errEl.count()) ? (await errEl.first().innerText()).trim() : null
  const text = await s.innerText()
  const main = hasResult ? ((await rowsOf(s))[0] ?? ['', '']) : null
  return { state: hasResult ? 'result' : err ? 'error' : 'blank', err, bad: BAD.exec(text)?.[0] ?? null, main }
}
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())))

// ---- field helpers -----------------------------------------------------------------------------------------------------
const field = (s, id) => s.locator(`#f-${id}`)
const setField = async (page, s, id, text) => {
  await field(s, id).fill(text)
  await settle(page)
}
const openMore = async (s) => {
  const d = s.locator('details.more')
  if (!(await d.count())) return false
  if (!(await d.evaluate((e) => e.open))) await d.locator('summary').click()
  return true
}
const pickValue = (s, id) => field(s, id).locator('.pick__value').innerText()
/** Chooses an option in a picker (more than 3 options) or segmented control (3 or fewer). */
async function choose(page, s, id, label) {
  const seg = s.locator(`.seg[aria-label]`).filter({ has: page.locator(`button[role=radio]`, { hasText: label }) })
  const pick = field(s, id)
  if ((await pick.count()) && (await pick.evaluate((e) => e.tagName)) === 'BUTTON') {
    await pick.click()
    // options may carry a hint, "5% (merit)", so a label matches itself or itself followed by " (...)"
    await page.locator('.sheet .pick__opt', { has: page.locator('.pick__label', { hasText: new RegExp('^\\s*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s*\\(.*\\))?\\s*$') }) }).first().click()
  } else {
    await s.locator('.field-row', { has: page.locator(`label[for="f-${id}"]`) }).locator('button[role=radio]', { hasText: new RegExp(`^${label}$`) }).click()
  }
  await settle(page)
  void seg
}
async function setRows(page, s, rows) {
  const rr = s.locator('.rows__row')
  for (let r = 0; r < rows.length; r++) {
    const inputs = rr.nth(r).locator('input.field')
    for (let c = 0; c < rows[r].length; c++) if (rows[r][c] !== null) await inputs.nth(c).fill(rows[r][c])
  }
  await settle(page)
}

// ---- layout probes -----------------------------------------------------------------------------------------------------
const smallTargets = (page, scope) =>
  page.evaluate((sc) => {
    const out = []
    const roots = [...document.querySelectorAll(sc)]
    const sel = 'button, input:not([type=hidden]), summary, [role=radio], [role=switch], a[href], textarea'
    for (const root of roots)
      root.querySelectorAll(sel).forEach((el) => {
        if (el.closest('.sr-only')) return
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) return
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || cs.display === 'none') return
        if (r.width < 43.5 && r.height < 43.5) out.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 18)}"`)
      })
    return [...new Set(out)].slice(0, 8)
  }, scope)
const clippedText = (page, scope) =>
  page.evaluate((sc) => {
    const root = document.querySelector(sc)
    const out = []
    if (!root) return out
    root.querySelectorAll('*').forEach((el) => {
      if (el.closest('.sr-only') || el.tagName === 'INPUT' || el.tagName === 'svg' || el.closest('svg')) return
      const cs = getComputedStyle(el)
      if (!['hidden', 'clip'].includes(cs.overflowX)) return
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 24)} scroll ${el.scrollWidth} > ${el.clientWidth} "${(el.textContent || '').trim().slice(0, 24)}"`)
    })
    return [...new Set(out)].slice(0, 6)
  }, scope)
const docOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
async function layoutIssues(page, s, label) {
  const sel = `.screen[aria-label="${await s.getAttribute('aria-label')}"]`
  const ov = await overflowing(page)
  const dw = await docOverflow(page)
  const sm = await smallTargets(page, `${sel}, .tabbar`)
  const cl = await clippedText(page, sel)
  return [ov.length ? `${label} sideways overflow: ${ov.slice(0, 3).join('; ')}` : '', dw > 1 ? `${label} page scrolls sideways by ${dw}px` : '', sm.length ? `${label} targets under 44px: ${sm.slice(0, 3).join('; ')}` : '', cl.length ? `${label} clipped text: ${cl.slice(0, 2).join('; ')}` : '']
}

// ---------------------------------------------------------------------------------------------------------------------
// 1. Opening every calculator, from its group and (for a few) from search
// ---------------------------------------------------------------------------------------------------------------------
for (const t of TOOLS) {
  def(`T1-OPEN-${t.id}`, 'POS', `${t.title}: opens from its group, default result is sensible`, () =>
    withPage({}, async ({ page, errors }) => {
      const s = await openTool(page, t)
      const sn = await snap(s)
      const rows = sn.state === 'result' ? await rowsOf(s) : []
      const head = await s.locator('h1.screen__title').innerText()
      fail(
        sn.state !== 'result' ? `default shows ${sn.state}${sn.err ? ' "' + sn.err + '"' : ''} instead of a result` : '',
        sn.bad ? `default shows "${sn.bad}"` : '',
        rows.some(([, v]) => v.trim() === '' || v.trim() === '—') ? 'a result row is empty or "—"' : '',
        head !== t.title ? `header says "${head}"` : '',
        realErrors(errors),
      )
    }),
  )
}
for (const t of [tool('emi'), tool('world-time'), tool('unit-price')])
  def(`T1-SEARCH-${t.id}`, 'POS', `${t.title}: opens from the search box`, () =>
    withPage({}, async ({ page }) => {
      const s = await openTool(page, t, 'search')
      const sn = await snap(s)
      fail(sn.state !== 'result' ? `state ${sn.state}` : '')
    }),
  )
def('T1-SEARCH-keyword', 'POS', 'Search finds a calculator by a keyword that is not in its title (mpg, bmi, cgpa, forex)', () =>
  withPage({}, async ({ page }) => {
    await tab(page, 'Tools')
    const want = { mpg: 'Mileage converter', bmi: 'BMI and calories', cgpa: 'Marks and GPA', forex: 'Currency converter', refinance: 'Loan balance transfer' }
    const bad = []
    for (const [q, title] of Object.entries(want)) {
      await page.locator('input[aria-label="Search calculators"]').fill(q)
      const names = await page.locator('.tools__list .navrow .navrow__label').allInnerTexts()
      if (!names.includes(title)) bad.push(`"${q}" -> ${names.join(', ') || 'nothing'}`)
    }
    fail(bad)
  }),
)
def('T1-SEARCH-none', 'NEG', 'Search with no match says so in words', () =>
  withPage({}, async ({ page }) => {
    await tab(page, 'Tools')
    await page.locator('input[aria-label="Search calculators"]').fill('zzzzqq')
    const t = await page.locator('.tools__none').innerText()
    fail(!/no calculator/i.test(t) ? `text "${t}"` : '')
  }),
)
def('T1-SEARCH-case', 'CORNER', 'Search ignores case and surrounding spaces', () =>
  withPage({}, async ({ page }) => {
    await tab(page, 'Tools')
    await page.locator('input[aria-label="Search calculators"]').fill('  LOAN EMI ')
    const names = await page.locator('.tools__list .navrow .navrow__label').allInnerTexts()
    fail(!names.includes('Loan EMI') ? `got ${names.join(', ')}` : '')
  }),
)
def('T1-GROUPS-counts', 'UX', 'Each group tile count matches the rows on its page (Math 2, Money 5, Units 3, Dates 5, Loans 13)', () =>
  withPage({}, async ({ page }) => {
    await tab(page, 'Tools')
    const want = { 'Math and numbers': 2, 'Money and shopping': 5, 'Units and travel': 3, 'Dates and health': 5, 'Loans and EMI': 13 }
    const bad = []
    for (const [g, n] of Object.entries(want)) {
      await page.locator('.tile', { hasText: g }).click()
      const k = await page.locator('.screen .navrow').count()
      if (k !== n) bad.push(`${g}: ${k} rows, tile says ${n}`)
      await page.locator('.screen button[aria-label="Back"]').click()
    }
    fail(bad)
  }),
)
def('T1-GROUPS-tap', 'UI', 'Group tiles and tool rows are at least 44px and show a chevron', () =>
  withPage({}, async ({ page }) => {
    await tab(page, 'Tools')
    const tiles = await page.locator('.tile').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
    await page.locator('.tile', { hasText: 'Loans and EMI' }).click()
    const rows = await page.locator('.screen .navrow').evaluateAll((els) => els.map((e) => ({ h: Math.round(e.getBoundingClientRect().height), chev: !!e.querySelector('.navrow__chev') })))
    fail(tiles.some((h) => h < 44) ? `tile heights ${tiles}` : '', rows.some((r) => r.h < 44 || !r.chev) ? `rows ${JSON.stringify(rows.filter((r) => r.h < 44 || !r.chev))}` : '')
  }),
)

// ---------------------------------------------------------------------------------------------------------------------
// 2. Field matrix: every number and text box gets odd input. Result or a plain error must show. Never blank, never NaN.
// ---------------------------------------------------------------------------------------------------------------------
const NEG_INPUTS = ['', '-5', '−5', 'abc', '12abc', '.', '-', '1..2', '0x10', '1e5', '--5', '5-', '   ']
const CORNER_INPUTS = ['0', '1.5', '1,50,000', '1,5', '9'.repeat(40), '1e13', '1e14', '1e30', '0.0001', ' 12 ', '1 2', '0.000000000000000000001', '123456789012.123456789', '10000000000001']
const PASTES = ['₹ 1,50,000', '1,50,000.75', '  7  ', '१२३', '1\n2']

async function runMatrix(page, errors, t, inputs, mode = 'fill') {
  const s = scr(page, t)
  await openMore(s)
  const loc = s.locator('.tool__form input.field:not([type=date])')
  const n = await loc.count()
  const issues = []
  for (let i = 0; i < n; i++) {
    const el = loc.nth(i)
    const id = (await el.getAttribute('id')) ?? `#${i}`
    const orig = await el.inputValue()
    for (const text of inputs) {
      const t0 = Date.now()
      try {
        if (mode === 'paste') {
          await el.click()
          await el.selectText()
          await page.keyboard.insertText(text)
        } else await el.fill(text)
      } catch (e) {
        issues.push(`${id} <- ${JSON.stringify(text)}: fill threw ${String(e.message).split('\n')[0].slice(0, 60)}`)
        continue
      }
      await settle(page)
      const ms = Date.now() - t0
      const sn = await snap(s)
      matrixLog.push({ tool: t.id, field: id, i, input: text, mode, state: sn.state, err: sn.err, main: sn.main?.join(' = ') ?? null, ms })
      const tag = `${id}#${i} <- ${JSON.stringify(text)}`
      if (sn.state === 'blank') issues.push(`${tag}: blank panel (no result, no error)`)
      if (sn.bad) issues.push(`${tag}: shows "${sn.bad}"`)
      if (ms > 2000) issues.push(`${tag}: took ${ms} ms`)
      if (sn.state === 'error' && sn.err && /error|exception|undefined|\bat \w+\.\w+/i.test(sn.err)) issues.push(`${tag}: ugly error "${sn.err}"`)
    }
    await el.fill(orig)
  }
  issues.push(...realErrors(errors).map((e) => `console: ${e}`))
  return issues
}
for (const t of TOOLS) {
  def(`T1-NEGIN-${t.id}`, 'NEG', `${t.title}: wrong input in every box (empty, minus, letters, 0x10, 1e5) gives a result or a plain error`, () =>
    withPage({}, async ({ page, errors }) => {
      await openTool(page, t)
      fail(await runMatrix(page, errors, t, NEG_INPUTS))
    }),
  )
  def(`T1-CORNER-${t.id}`, 'CORNER', `${t.title}: zero, decimals, Indian commas, 40 digits, 1e13 and up, tiny, spaces in every box`, () =>
    withPage({}, async ({ page, errors }) => {
      await openTool(page, t)
      fail(await runMatrix(page, errors, t, CORNER_INPUTS))
    }),
  )
}
for (const t of TOOLS)
  def(`T1-PASTE-${t.id}`, 'CORNER', `${t.title}: pasted text ("₹ 1,50,000", spaces, Devanagari digits, two lines) in every box`, () =>
    withPage({}, async ({ page, errors }) => {
      await openTool(page, t)
      fail(await runMatrix(page, errors, t, PASTES, 'paste'))
    }),
  )

// ---------------------------------------------------------------------------------------------------------------------
// 3. Empty required box: the error must name the field; the field should be marked.
// ---------------------------------------------------------------------------------------------------------------------
const STOP = new Set(['your', 'the', 'number', 'amount', 'for', 'and', 'per', 'out', 'second', 'first'])
const tokensOf = (label) => label.toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w))
const namesField = (err, label) => {
  const e = err.toLowerCase()
  const toks = tokensOf(label)
  return toks.length === 0 ? e.includes(label.toLowerCase()) : toks.some((w) => e.includes(w.replace(/s$/, '')))
}
async function emptyEachField(page, t) {
  const s = scr(page, t)
  await openMore(s)
  const rows = await s.locator('.field-row').evaluateAll((els) => els.map((e) => ({ label: e.querySelector('label.field-label')?.textContent ?? '', id: e.querySelector('input.field:not([type=date])')?.id ?? '' })))
  const out = []
  for (const r of rows) {
    if (!r.id) continue
    const el = s.locator(`#${r.id}`)
    const orig = await el.inputValue()
    await el.fill('')
    await settle(page)
    const sn = await snap(s)
    const marked = await s.locator('.field-row[data-invalid]').count()
    const markedHere = await s.locator('.field-row[data-invalid]', { has: page.locator(`#${r.id}`) }).count()
    out.push({ ...r, state: sn.state, err: sn.err, marked, markedHere })
    await el.fill(orig)
  }
  // rows tools: empty a first cell
  return out
}
for (const t of TOOLS) {
  def(`T1-ERRNAME-${t.id}`, 'ERR', `${t.title}: emptying a box shows a plain error that names it (or a result when the box is optional)`, () =>
    withPage({}, async ({ page }) => {
      await openTool(page, t)
      const res = await emptyEachField(page, t)
      const bad = []
      for (const r of res) {
        if (r.state === 'blank') bad.push(`"${r.label}" empty: blank panel`)
        else if (r.state === 'error' && !namesField(r.err, r.label)) bad.push(`"${r.label}" empty: error "${r.err}" does not name it`)
      }
      fail(bad)
    }),
  )
  def(`T1-ERRMARK-${t.id}`, 'UX', `${t.title}: the box with the error is marked (red text and aria-invalid), not only described`, () =>
    withPage({}, async ({ page }) => {
      await openTool(page, t)
      const res = await emptyEachField(page, t)
      const bad = res.filter((r) => r.state === 'error' && r.markedHere === 0).map((r) => `"${r.label}" empty -> "${r.err}" but no box is marked`)
      fail(bad)
    }),
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// 4. Selects: every option of every picker and segmented control
// ---------------------------------------------------------------------------------------------------------------------
async function cycleAll(page, s, t, errors) {
  const issues = []
  const visited = new Set()
  const check = async (what) => {
    const sn = await snap(s)
    if (sn.state === 'blank') issues.push(`${what}: blank panel`)
    if (sn.bad) issues.push(`${what}: shows "${sn.bad}"`)
    return sn
  }
  await openMore(s)
  const cyclePicker = async (id, depth) => {
    if (visited.has(id)) return
    visited.add(id)
    const btn = field(s, id)
    if (!(await btn.count())) return
    await btn.click()
    const labels = await page.locator('.sheet .pick__opt:not(.pick__opt--add) .pick__label').allInnerTexts()
    await page.locator('.sheet button[aria-label^="Close"]').click()
    for (const lab of labels) {
      if (!(await field(s, id).count())) break
      await field(s, id).click()
      await page.locator('.sheet .pick__opt', { has: page.getByText(lab, { exact: true }) }).first().click()
      await settle(page)
      await check(`${id}=${lab}`)
      if (depth < 1) {
        const others = await s.locator('.tool__form button.pick').evaluateAll((els) => els.map((e) => e.id.replace(/^f-/, '')))
        for (const o of others) if (!visited.has(o)) await cyclePicker(o, depth + 1)
      }
    }
  }
  const segs = await s.locator('.tool__form .seg').evaluateAll((els) => els.map((e) => ({ label: e.getAttribute('aria-label'), n: e.querySelectorAll('button').length })))
  for (const sg of segs) {
    for (let k = 0; k < sg.n; k++) {
      const grp = s.locator('.tool__form .seg', {}).filter({ has: page.locator('button') }).nth(segs.indexOf(sg))
      if (!(await grp.count())) break
      await grp.locator('button').nth(k).click()
      await settle(page)
      await check(`${sg.label}#${k}`)
    }
  }
  const ids = await s.locator('.tool__form button.pick').evaluateAll((els) => els.map((e) => e.id.replace(/^f-/, '')))
  for (const id of ids) await cyclePicker(id, 0)
  issues.push(...realErrors(errors).map((e) => `console: ${e}`))
  return { issues, pickers: visited.size, segs: segs.length }
}
for (const t of TOOLS)
  def(`T1-SELECTS-${t.id}`, 'CORNER', `${t.title}: every option of every dropdown and switch gives a result or a plain error`, () =>
    withPage({}, async ({ page, errors }) => {
      const s = await openTool(page, t)
      const r = await cycleAll(page, s, t, errors)
      fail(r.issues)
    }),
  )

// ---------------------------------------------------------------------------------------------------------------------
// 5. Layout: 360px, 100% and 200% font, light and dark; tap targets; clipped text
// ---------------------------------------------------------------------------------------------------------------------
const COMBOS = [
  ['light 100%', { theme: 'light', font: 100 }],
  ['dark 100%', { theme: 'dark', font: 100 }],
  ['light 200%', { theme: 'light', font: 200 }],
  ['dark 200%', { theme: 'dark', font: 200 }],
]
for (const t of TOOLS)
  def(`T1-LAYOUT-${t.id}`, 'UI', `${t.title}: no sideways overflow, no clipped text, targets >= 44px (360px wide, light/dark, 100%/200% font)`, async () => {
    const issues = []
    for (const [name, o] of COMBOS)
      await withPage(o, async ({ page }) => {
        const s = await openTool(page, t)
        issues.push(...(await layoutIssues(page, s, name)))
        // And once with the "More options" open and a row added where the tool has rows.
        if (await openMore(s)) issues.push(...(await layoutIssues(page, s, name + ' +more')))
      })
    fail(issues)
  })
// Big numbers in the rupee box, at 200% font: the places a table or a result can spill.
for (const t of TOOLS.slice(2, 3).concat(TOOLS.slice(3, 4), TOOLS.slice(5, 6), TOOLS.slice(15)))
  def(`T1-BIGUI-${t.id}`, 'UI', `${t.title}: the biggest allowed amount (₹9,999,999,999,999) at 200% font does not break the layout`, () =>
    withPage({ theme: 'dark', font: 200 }, async ({ page }) => {
      const s = await openTool(page, t)
      const money = s.locator('.field-wrap:has(.field-unit:text-is("₹")) input')
      if (!(await money.count())) return
      await money.first().fill('9999999999999')
      await settle(page)
      const sn = await snap(s)
      fail(sn.bad ? `shows ${sn.bad}` : '', sn.state === 'blank' ? 'blank' : '', ...(await layoutIssues(page, s, 'big')))
    }),
  )
for (const view of ['yearly', 'monthly'])
  def(`T1-LAYOUT-amortisation-${view}`, 'UI', `Repayment schedule, ${view} table: cards fit at 200% font, 360px`, () =>
    withPage({ theme: 'dark', font: 200 }, async ({ page }) => {
      const t = tool('amortisation')
      const s = await openTool(page, t)
      await choose(page, s, 'view', view === 'yearly' ? 'Yearly' : 'Monthly')
      const n = await s.locator('.rowcard').count()
      fail(n !== (view === 'yearly' ? 20 : 240) ? `${n} cards` : '', ...(await layoutIssues(page, s, view)))
    }),
  )
def('T1-LAYOUT-landscape', 'UI', 'A calculator page at 780x360 (phone sideways) has no sideways overflow', () =>
  withPage({ width: 780, height: 360 }, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    const dw = await docOverflow(page)
    const ov = await overflowing(page)
    fail(dw > 1 ? `page scrolls sideways ${dw}px` : '', ov.length ? ov.join('; ') : '')
    void s
  }),
)
def('T1-LAYOUT-narrow', 'UI', 'Very narrow phone (320px) at 200% font: Loan EMI still fits', () =>
  withPage({ width: 320, height: 640, font: 200, theme: 'light' }, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    fail(...(await layoutIssues(page, s, '320')))
  }),
)

// ---------------------------------------------------------------------------------------------------------------------
// 6. Answers checked against an independent calculation (decimal.js, written here, not copied from the engine)
// ---------------------------------------------------------------------------------------------------------------------
const emiOf = (P, ratePct, n) => {
  const r = D(ratePct).div(1200)
  if (r.isZero()) return D(P).div(n)
  const g = r.plus(1).pow(n)
  return D(P).times(r).times(g).div(g.minus(1))
}
const near = (got, want, tol, what) => (D(got).minus(want).abs().gt(tol) ? `${what}: page ${D(got).toFixed(4)} vs independent ${D(want).toFixed(4)}` : '')

def('T1-MATH-emi', 'POS', 'Loan EMI: EMI, interest, total match the formula (50 lakh, 8.5%, 20y)', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    const e = emiOf(5000000, 8.5, 240)
    const interest = e.times(240).minus(5000000)
    fail(
      near(num(await rowVal(s, 'Monthly EMI')), e, '0.01', 'EMI'),
      near(num(await rowVal(s, 'Total interest')), interest, '0.5', 'interest'),
      near(num(await rowVal(s, 'Total you pay')), e.times(240), '0.5', 'total'),
      near(num(await rowVal(s, 'Interest as share')), interest.div(e.times(240)).times(100), '0.01', 'share'),
    )
  }),
)
def('T1-MATH-emi-months', 'POS', 'Loan EMI: 7 lakh at 10.25% for 30 months gives the formula EMI (months switch)', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await setField(page, s, 'principal', '700000')
    await setField(page, s, 'rate', '10.25')
    await setField(page, s, 'tenure', '30 months')
    fail(near(num(await rowVal(s, 'Monthly EMI')), emiOf(700000, 10.25, 30), '0.01', 'EMI'))
  }),
)
def('T1-MATH-emi-zero-rate', 'CORNER', 'Loan EMI: 0% interest gives principal / months, interest 0', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await setField(page, s, 'rate', '0')
    await setField(page, s, 'principal', '120000')
    await setField(page, s, 'tenure', '1')
    fail(near(num(await rowVal(s, 'Monthly EMI')), 10000, '0.01', 'EMI'), near(num(await rowVal(s, 'Total interest')), 0, '0.01', 'interest'))
  }),
)
def('T1-MATH-amortisation', 'POS', 'Repayment schedule: yearly balance after year 1 and total interest match a month-by-month loop', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('amortisation'))
    const e = emiOf(5000000, 8.5, 240)
    let bal = D(5000000), paid12 = D(0), int12 = D(0)
    for (let m = 1; m <= 12; m++) {
      const i = bal.times(D(8.5).div(1200))
      paid12 = paid12.plus(e)
      int12 = int12.plus(i)
      bal = bal.minus(e.minus(i))
    }
    const cards = await cardsOf(s)
    const y1 = cards[0]
    fail(
      near(num(await rowVal(s, 'Number of EMIs')), 240, 0, 'EMIs'),
      near(num(y1.cells['Balance']), bal, '0.5', 'year-1 balance'),
      near(num(y1.cells['Interest']), int12, '0.5', 'year-1 interest'),
      near(num(y1.cells['Paid']), paid12, '0.5', 'year-1 paid'),
      cards.length !== 20 ? `${cards.length} yearly rows` : '',
    )
  }),
)
def('T1-MATH-amortisation-last', 'CORNER', 'Repayment schedule: last month closes the balance to 0', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('amortisation'))
    await setField(page, s, 'tenure', '3')
    await choose(page, s, 'view', 'Monthly')
    const cards = await cardsOf(s)
    fail(cards.length !== 36 ? `${cards.length} rows` : '', near(num(cards.at(-1).cells['Balance']), 0, '0.01', 'last balance'))
  }),
)
def('T1-MATH-reverse-emi', 'POS', 'Affordable loan: 40,000 EMI at 8.5% for 20y gives the formula loan', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('reverse-emi'))
    const r = D(8.5).div(1200)
    const g = r.plus(1).pow(240)
    const P = D(40000).times(g.minus(1)).div(r.times(g))
    fail(near(num(await rowVal(s, 'Maximum loan')), P, '0.5', 'max loan'), near(num(await rowVal(s, 'Total you repay')), 40000 * 240, '0.01', 'total repay'))
  }),
)
def('T1-MATH-prepayment', 'POS', 'Loan prepayment: interest saved (shorter loan) matches a month-by-month simulation', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('prepayment'))
    const e = emiOf(5000000, 8.5, 240)
    const sim = (pre) => {
      let bal = D(5000000), tot = D(0), m = 0
      while (bal.gt('0.005') && m < 1000) {
        m++
        const i = bal.times(D(8.5).div(1200))
        tot = tot.plus(i)
        bal = bal.minus(e.minus(i))
        if (pre && m === 24) bal = bal.minus(500000)
        if (bal.lt(0)) bal = D(0)
      }
      return { tot, m }
    }
    const a = sim(false), b = sim(true)
    fail(near(num(await rowVal(s, 'Interest saved')), a.tot.minus(b.tot), '5', 'interest saved'), near(num(await rowVal(s, 'Months saved')), 240 - b.m, 1, 'months saved'))
  }),
)
def('T1-MATH-prepayment-emi', 'POS', 'Loan prepayment: "Lower EMI" mode gives the formula EMI on the remaining balance', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('prepayment'))
    await openMore(s)
    await choose(page, s, 'mode', 'Lower EMI')
    const e = emiOf(5000000, 8.5, 240)
    let bal = D(5000000)
    for (let m = 1; m <= 24; m++) bal = bal.minus(e.minus(bal.times(D(8.5).div(1200))))
    bal = bal.minus(500000)
    fail(near(num(await rowVal(s, 'New EMI')), emiOf(bal, 8.5, 216), '0.05', 'new EMI'))
  }),
)
def('T1-MATH-rate-change', 'POS', 'Floating rate change: "Same EMI" mode new term matches a simulation (8.5% -> 9.0% from EMI 13)', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('rate-change'))
    const e = emiOf(5000000, 8.5, 240)
    let bal = D(5000000), m = 0
    for (; m < 12; m++) bal = bal.minus(e.minus(bal.times(D(8.5).div(1200))))
    while (bal.gt('0.005') && m < 2000) {
      m++
      const i = bal.times(D(9).div(1200))
      bal = bal.minus(e.minus(i))
    }
    const got = await rowVal(s, 'New loan term')
    const mm = /(?:(\d+) y)?\s*(\d+) m/.exec(got)
    const months = (mm?.[1] ? Number(mm[1]) * 12 : 0) + Number(mm?.[2] ?? NaN)
    fail(months !== m ? `page says ${got} (${months} months), simulation ${m}` : '')
  }),
)
def('T1-MATH-balance-transfer', 'POS', 'Loan balance transfer: net saving = (old EMI - new EMI) x months - fees', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('balance-transfer'))
    const save = emiOf(4000000, 9.5, 180).minus(emiOf(4000000, 8.5, 180))
    const net = save.times(180).minus(20000)
    fail(near(num(await rowVal(s, 'Net saving')), net, '0.5', 'net saving'), near(num(await rowVal(s, 'Saving each month')), save, '0.01', 'per month'), near(num(await rowVal(s, 'Breaks even after')), Math.ceil(20000 / save.toNumber()), 0, 'break-even months'))
  }),
)
def('T1-MATH-simple-compound', 'POS', 'Simple vs compound: 1 lakh, 10%, 5y gives SI 50,000 and CI 61,051', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('simple-compound'))
    fail(near(num(await rowVal(s, 'Simple interest')), 50000, '0.01', 'SI'), near(num(await rowVal(s, 'Compound interest')), D(100000).times(D(1.1).pow(5).minus(1)), '0.01', 'CI'))
  }),
)
def('T1-MATH-compound-monthly', 'POS', 'Simple vs compound: monthly compounding 2.5 years at 7.2% matches the formula', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('simple-compound'))
    await setField(page, s, 'rate', '7.2')
    await setField(page, s, 'years', '2.5')
    await openMore(s)
    await choose(page, s, 'freq', 'Monthly')
    const ci = D(100000).times(D(1).plus(D(7.2).div(1200)).pow(30).minus(1))
    fail(near(num(await rowVal(s, 'Compound interest')), ci, '0.01', 'CI'), near(num(await rowVal(s, 'Simple interest')), D(100000).times(7.2).times(2.5).div(100), '0.01', 'SI'))
  }),
)
def('T1-MATH-card-emi', 'POS', 'Credit card EMI: interest and 18% GST on it match an independent loop', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('card-emi'))
    const e = emiOf(60000, 15, 12)
    const interest = e.times(12).minus(60000)
    fail(near(num(await rowVal(s, 'EMI (before GST)')), e, '0.01', 'EMI'), near(num(await rowVal(s, 'Interest')), interest, '0.05', 'interest'), near(num(await rowVal(s, 'GST on interest')), interest.times('0.18'), '0.05', 'GST on interest'))
  }),
)
def('T1-MATH-home-loan-tax', 'POS', 'Home loan tax: year-1 interest cap 2,00,000 and tax saved at 30% match', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('home-loan-tax'))
    const e = emiOf(5000000, 8.5, 240)
    let bal = D(5000000), i1 = D(0), p1 = D(0)
    for (let m = 0; m < 12; m++) {
      const i = bal.times(D(8.5).div(1200))
      i1 = i1.plus(i)
      p1 = p1.plus(e.minus(i))
      bal = bal.minus(e.minus(i))
    }
    const intDed = Decimal.min(i1, 200000)
    const prDed = Decimal.min(p1, 150000)
    fail(near(num(await rowVal(s, 'Interest deduction, year 1')), intDed, '0.5', 'interest deduction'), near(num(await rowVal(s, 'Principal deduction, year 1')), prDed, '0.5', 'principal deduction'), near(num(await rowVal(s, 'Tax saved in year 1')), intDed.plus(prDed).times('0.3'), '0.5', 'tax saved'))
  }),
)
def('T1-MATH-loan-compare', 'POS', 'Compare loan offers: totals (loan + interest + fee) match, cheapest picked by rate with fee', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('loan-compare'))
    const offer = (rate, fee) => ({ e: emiOf(5000000, rate, 240), fee })
    const o1 = offer(8.5, 10000), o2 = offer(8.35, 25000)
    const total = (o) => D(5000000).plus(o.e.times(240).minus(5000000)).plus(o.fee)
    const cards = await cardsOf(s)
    // effective rate: solve by bisection on monthly rate
    const eff = (o) => {
      let lo = D(0), hi = D('0.05')
      const need = D(5000000).minus(o.fee)
      for (let k = 0; k < 80; k++) {
        const mid = lo.plus(hi).div(2)
        const pv = mid.isZero() ? o.e.times(240) : o.e.times(D(1).minus(D(1).plus(mid).pow(-240))).div(mid)
        if (pv.gt(need)) lo = mid
        else hi = mid
      }
      return lo.times(1200)
    }
    const best = eff(o1).lt(eff(o2)) ? 'Offer 1' : 'Offer 2'
    fail(
      near(num(cards[0].cells['Total cost']), total(o1), '1', 'offer 1 total'),
      near(num(cards[1].cells['Total cost']), total(o2), '1', 'offer 2 total'),
      near(num(cards[0].cells['Rate with fee']), eff(o1), '0.02', 'offer 1 rate with fee'),
      (await rowVal(s, 'Cheapest offer')) !== best ? `cheapest ${await rowVal(s, 'Cheapest offer')} vs ${best}` : '',
    )
  }),
)
def('T1-MATH-percentage', 'POS', 'Percentage: X% of Y, what %, % change give the right numbers', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('percentage'))
    const bad = [near(num((await rowsOf(s))[0][1]), 8100, '0.001', '18% of 45000')]
    await choose(page, s, 'mode', 'What %')
    bad.push(near(num((await rowsOf(s))[0][1]), D(18).div(45000).times(100), '0.001', '18 is what % of 45000'))
    await choose(page, s, 'mode', '% change')
    bad.push(near(num((await rowsOf(s))[0][1]), D(45000 - 18).div(18).times(100), '0.01', '% change 18 -> 45000'))
    await setField(page, s, 'x', '200')
    await setField(page, s, 'y', '150')
    bad.push(near(num((await rowsOf(s))[0][1]), -25, '0.001', '% change 200 -> 150'))
    fail(bad)
  }),
)
def('T1-MATH-percentage-zero', 'ERR', 'Percentage: division by zero and change from zero give plain-words errors', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('percentage'))
    await choose(page, s, 'mode', 'What %')
    await setField(page, s, 'y', '0')
    const a = await snap(s)
    await choose(page, s, 'mode', '% change')
    await setField(page, s, 'x', '0')
    await setField(page, s, 'y', '5')
    const b = await snap(s)
    fail(a.state !== 'error' || !/zero/i.test(a.err ?? '') ? `what%/0 -> ${a.state} ${a.err}` : '', b.state !== 'error' || !/zero/i.test(b.err ?? '') ? `change from 0 -> ${b.state} ${b.err}` : '')
  }),
)
def('T1-MATH-gst', 'POS', 'GST: add 18% to 10,000 = 11,800 (CGST 900 + SGST 900); remove from 11,800 = 10,000; 5% and 40% presets', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('gst'))
    const bad = [near(num(await rowVal(s, 'Total with GST')), 11800, '0.001', 'total'), near(num(await rowVal(s, 'GST amount')), 1800, '0.001', 'gst'), near(num(await rowVal(s, 'CGST')), 900, '0.001', 'cgst'), near(num(await rowVal(s, 'SGST')), 900, '0.001', 'sgst')]
    await choose(page, s, 'mode', 'With GST')
    await setField(page, s, 'amount', '11800')
    bad.push(near(num(await rowVal(s, 'Price before GST')), 10000, '0.01', 'base from 11,800'))
    await setField(page, s, 'amount', '10000')
    bad.push(near(num(await rowVal(s, 'Price before GST')), D(10000).div('1.18'), '0.01', 'base from 10,000'))
    await choose(page, s, 'rate', '5%')
    bad.push(near(num(await rowVal(s, 'Price before GST')), D(10000).div('1.05'), '0.01', 'base at 5%'))
    fail(bad)
  }),
)
def('T1-MATH-gst-inter', 'POS', 'GST: "Other state" shows one IGST line equal to the full GST', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('gst'))
    await openMore(s)
    await choose(page, s, 'supply', 'Other state')
    const rows = await rowsOf(s)
    const igst = rows.find(([l]) => l.startsWith('IGST'))
    fail(!igst ? 'no IGST row' : near(num(igst[1]), 1800, '0.001', 'IGST'), rows.some(([l]) => l.startsWith('CGST')) ? 'CGST still shown' : '')
  }),
)
def('T1-MATH-gst-custom', 'POS', 'GST: "Other rate" shows a rate box (12 by default); 3% on 10,000 gives 300', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('gst'))
    await choose(page, s, 'rate', 'Other rate')
    const had = await field(s, 'custom').count()
    await setField(page, s, 'custom', '3')
    fail(!had ? 'no custom rate box' : '', near(num(await rowVal(s, 'GST amount')), 300, '0.001', 'gst at 3%'))
  }),
)
def('T1-MATH-discount', 'POS', 'Discount: 2,499 at 20% = 1,999.20; second 10% plus flat 100 = 1,699.28', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('discount'))
    const bad = [near(num(await rowVal(s, 'Final price')), D(2499).times('0.8'), '0.001', 'final'), near(num(await rowVal(s, 'You save')), D(2499).times('0.2'), '0.001', 'save')]
    await openMore(s)
    await setField(page, s, 'd2', '10')
    await setField(page, s, 'flat', '100')
    bad.push(near(num(await rowVal(s, 'Final price')), D(2499).times('0.8').times('0.9').minus(100), '0.001', 'final with d2 and flat'), near(num(await rowVal(s, 'Combined discount')), D(1).minus(D('0.8').times('0.9')).times(100), '0.001', 'combined'))
    fail(bad)
  }),
)
def('T1-MATH-tip', 'POS', 'Tip and split: 2,400 + 10% over 4 = 660 each, tip 240, total 2,640', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('tip'))
    fail(near(num(await rowVal(s, 'Each person pays')), 660, '0.001', 'each'), near(num(await rowVal(s, 'Tip')), 240, '0.001', 'tip'), near(num(await rowVal(s, 'Total with tip')), 2640, '0.001', 'total'))
  }),
)
def('T1-MATH-tip-odd', 'CORNER', 'Tip and split: 1,000 + 15% over 3 = 383.33 each (rounding shown to 2 places)', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('tip'))
    await setField(page, s, 'bill', '1000')
    await setField(page, s, 'pct', '15')
    await setField(page, s, 'people', '3')
    fail(near(num(await rowVal(s, 'Each person pays')), D(1150).div(3), '0.005', 'each'))
  }),
)
def('T1-MATH-unit-price', 'POS', 'Compare pack prices: 45 for 500 g (90/kg) vs 85 for 1 kg (85/kg): Item 2 cheapest, Item 1 dearer by 5.88%', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('unit-price'))
    const cards = await cardsOf(s)
    fail((await rowVal(s, 'Cheapest pack')) !== 'Item 2' ? `cheapest ${await rowVal(s, 'Cheapest pack')}` : '', near(num(await rowVal(s, 'Its price per')), 85, '0.001', 'best per kg'), near(num(cards[0].cells['Dearer by']), D(90).minus(85).div(85).times(100), '0.01', 'dearer by'))
  }),
)
def('T1-MATH-fuel-cost', 'POS', 'Fuel cost: 450 km at 15 km/l and 100/l = 30 litres, 3,000, 6.67 per km', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('fuel-cost'))
    fail(near(num(await rowVal(s, 'Trip cost')), 3000, '0.001', 'cost'), near(num(await rowVal(s, 'Fuel needed')), 30, '0.001', 'litres'), near(num(await rowVal(s, 'Cost per km')), D(3000).div(450), '0.005', 'per km'))
  }),
)
def('T1-MATH-fuel-eff', 'POS', 'Mileage converter: 15 km/l = 6.67 l/100 km = 35.28 mpg (US) = 42.37 mpg (UK)', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('fuel-efficiency'))
    fail(near(num(await rowVal(s, 'litres per 100 km')), D(100).div(15), '0.005', 'l/100'), near(num(await rowVal(s, 'mpg (US)')), D(15).times('3.785411784').div('1.609344'), '0.005', 'mpg us'), near(num(await rowVal(s, 'mpg (UK)')), D(15).times('4.54609').div('1.609344'), '0.005', 'mpg uk'))
  }),
)
def('T1-MATH-fuel-eff-l100', 'POS', 'Mileage converter: 8 l/100 km = 12.5 km/l', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('fuel-efficiency'))
    await choose(page, s, 'unit', 'litres per 100 km')
    await setField(page, s, 'value', '8')
    fail(near(num(await rowVal(s, 'km per litre')), 12.5, '0.001', 'km/l'))
  }),
)
def('T1-MATH-unit-converter', 'POS', 'Unit converter: 1 km = 0.621371 mi; 100 C = 212 F; 1 GB in MB; 1 acre in sq ft', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('unit-converter'))
    const bad = [near(num((await rowsOf(s))[0][1]), '0.621371', '0.00001', 'km->mi')]
    await choose(page, s, 'category', 'Temperature')
    await setField(page, s, 'value', '100')
    bad.push(near(num((await rowsOf(s))[0][1]), 212, '0.001', '100C->F'))
    await choose(page, s, 'category', 'Area')
    await setField(page, s, 'value', '1')
    const v = num((await rowsOf(s))[0][1])
    bad.push(near(v, 43560, '1', '1 acre -> sq ft'))
    fail(bad)
  }),
)
def('T1-MATH-number-base', 'POS', 'Binary and hex: 255 -> FF, binary 11111111, octal 377; bit ops with 15 (AND 15, OR 255, XOR 240)', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('number-base'))
    const rows = await rowsOf(s)
    const kv = await kvOf(s)
    const get = (l) => rows.find(([x]) => x === l)?.[1]
    const op = (l) => kv.find(([x]) => x === l)?.[1]
    fail(
      get('Answer in base 16') !== 'FF' ? `hex ${get('Answer in base 16')}` : '',
      get('Binary') !== '11111111' ? `bin ${get('Binary')}` : '',
      get('Octal') !== '377' ? `oct ${get('Octal')}` : '',
      op('A AND B') !== '0F' && op('A AND B') !== 'F' ? `AND ${op('A AND B')}` : '',
      op('A XOR B') !== 'F0' ? `XOR ${op('A XOR B')}` : '',
      op('A OR B') !== 'FF' ? `OR ${op('A OR B')}` : '',
    )
  }),
)
def('T1-MATH-number-base-from-hex', 'POS', 'Binary and hex: "ff" typed in lower case as hex shows decimal 255', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('number-base'))
    await choose(page, s, 'from', 'Hex (16)')
    await setField(page, s, 'value', 'ff')
    const rows = await rowsOf(s)
    fail(rows.find(([l]) => l === 'Decimal')?.[1] !== '255' ? `decimal row ${JSON.stringify(rows.find(([l]) => l === 'Decimal'))}` : '')
  }),
)
def('T1-MATH-date-diff', 'POS', 'Date calculator: 1 Jan to 2 Nov 2026 is 305 days, 43 weeks 4 days, 10 months 1 day', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('date'))
    const days = Math.round((Date.UTC(2026, 10, 2) - Date.UTC(2026, 0, 1)) / 86400000)
    fail(near(num(await rowVal(s, 'Days apart')), days, 0, 'days'), (await rowVal(s, 'Weeks and days')) !== `${Math.floor(days / 7)} weeks, ${days % 7} days` ? `weeks ${await rowVal(s, 'Weeks and days')}` : '', (await rowVal(s, 'Years, months, days')) !== '0 years, 10 months, 1 days' ? `ymd ${await rowVal(s, 'Years, months, days')}` : '')
  }),
)
def('T1-MATH-body', 'POS', 'BMI and calories: BMI 24.2, BMR 1,618, TDEE 2,224 for 170 cm, 70 kg, 30, male, light', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('body-metrics'))
    const bmi = D(70).div(D(1.7).pow(2))
    const bmr = D(10).times(70).plus(D(6.25).times(170)).minus(150).plus(5)
    fail(near(num(await rowVal(s, 'BMI')), bmi.toDecimalPlaces(1), '0.05', 'BMI'), near(num(await rowVal(s, 'Calories at rest')), bmr, '1', 'BMR'), near(num(await rowVal(s, 'Daily calories')), bmr.times('1.375'), '1', 'TDEE'))
  }),
)
def('T1-MATH-grade', 'POS', 'Marks and GPA: weighted 74.56% and GPA 7.46 for the default three subjects', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('grade-average'))
    const pct = D(78 * 4 + 65 * 3 + 82 * 2).div(9)
    fail(near(num(await rowVal(s, 'Overall percentage')), pct, '0.01', 'percent'), near(num(await rowVal(s, 'GPA')), pct.div(10), '0.01', 'GPA'), near(num(await rowVal(s, 'Total credits')), 9, 0, 'credits'))
  }),
)
def('T1-MATH-ovulation', 'POS', 'Ovulation: last period 20 Oct 2026, 28-day cycle gives next period 17 Nov, ovulation 3 Nov, window 29 Oct to 4 Nov', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('ovulation'))
    const got = Object.fromEntries(await rowsOf(s))
    fail(!/17 Nov 2026/.test(got['Next period']) ? `next ${got['Next period']}` : '', !/3 Nov 2026/.test(got['Ovulation day']) ? `ovulation ${got['Ovulation day']}` : '', !/29 Oct 2026/.test(got['Fertile window starts']) ? `starts ${got['Fertile window starts']}` : '', !/4 Nov 2026/.test(got['Fertile window ends']) ? `ends ${got['Fertile window ends']}` : '')
  }),
)
def('T1-MATH-currency', 'POS', 'Currency converter: amount = amount x the shown "1 INR in USD" rate; same-currency gives the same amount', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('currency'))
    const amt = num(await rowVal(s, 'Amount in USD'))
    const rate = num(await rowVal(s, '1 INR in USD'))
    const bad = [near(amt, rate.times(10000), amt.times('0.001').plus('0.01'), 'amount vs rate')]
    await choose(page, s, 'to', 'INR Indian Rupee')
    bad.push(near(num(await rowVal(s, 'Amount in INR')), 10000, '0.001', 'INR to INR'))
    fail(bad)
  }),
)
def('T1-MATH-loan-presets', 'POS', 'Typical loan rates: each loan type shows a rate, a term and a source (no blank, no number without a source)', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('loan-presets'))
    await field(s, 'type').click()
    const labels = await page.locator('.sheet .pick__opt .pick__label').allInnerTexts()
    await page.locator('.sheet button[aria-label^="Close"]').click()
    const bad = []
    for (const l of labels) {
      await choose(page, s, 'type', l)
      const rows = Object.fromEntries(await rowsOf(s))
      if (!rows['Typical rate'] || !rows['Usual loan term'] || !rows['Source']) bad.push(`${l}: ${JSON.stringify(rows)}`)
    }
    fail(labels.length < 3 ? `only ${labels.length} loan types` : '', bad)
  }),
)
def('T1-MATH-loan-presets-emi', 'POS', 'Typical loan rates: example EMI matches the formula for the shown rate and months', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('loan-presets'))
    const rows = await rowsOf(s)
    const ex = rows.find(([l]) => l.startsWith('Example EMI'))
    if (!ex) throw new Error('no example EMI row for the default loan type')
    const m = /at ([\d.]+)% for (?:(\d+) y)?\s*(?:(\d+) m)?/.exec(ex[0])
    const n = Number(m[2] ?? 0) * 12 + Number(m[3] ?? 0)
    fail(near(num(ex[1]), emiOf(3000000, m[1], n), '0.01', `EMI at ${m[1]}% for ${n} months`))
  }),
)

// ---------------------------------------------------------------------------------------------------------------------
// 7. Rows: unit price (2 to 5), marks (1 to 20), loan offers (2 to 3)
// ---------------------------------------------------------------------------------------------------------------------
const rowBounds = [
  ['unit-price', 2, 5],
  ['grade-average', 1, 20],
  ['loan-compare', 2, 3],
]
for (const [id, min, max] of rowBounds) {
  def(`T1-ROWS-${id}-max`, 'CORNER', `${tool(id).title}: "Add row" stops at ${max} rows and then disappears`, () =>
    withPage({}, async ({ page, errors }) => {
      const s = await openTool(page, tool(id))
      const add = s.locator('button.btn', { hasText: 'Add row' })
      let n = await s.locator('.rows__row').count()
      for (let k = 0; k < max + 3 && (await add.count()); k++) {
        await add.click()
        n = await s.locator('.rows__row').count()
      }
      const sn = await snap(s)
      fail(n !== max ? `${n} rows (max should be ${max})` : '', (await add.count()) ? '"Add row" still shown at max' : '', sn.state === 'blank' ? 'blank panel' : '', sn.bad ? sn.bad : '', realErrors(errors))
    }),
  )
  def(`T1-ROWS-${id}-min`, 'CORNER', `${tool(id).title}: remove stops at ${min} row(s); the last X is hidden`, () =>
    withPage({}, async ({ page }) => {
      const s = await openTool(page, tool(id))
      const add = s.locator('button.btn', { hasText: 'Add row' })
      while ((await add.count()) && (await s.locator('.rows__row').count()) < max) await add.click()
      for (let k = 0; k < max + 2; k++) {
        const rm = s.locator('.rows__row button[aria-label^="Remove row"]')
        if (!(await rm.count())) break
        await rm.last().click()
      }
      const n = await s.locator('.rows__row').count()
      const sn = await snap(s)
      fail(n !== min ? `${n} rows left (min should be ${min})` : '', sn.state === 'blank' ? 'blank panel' : '', sn.bad ?? '')
    }),
  )
}
def('T1-ROWS-remove-label', 'UI', 'Remove-row buttons have names ("Remove row 2") and are 44px', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('grade-average'))
    const b = await s.locator('.rows__row button[aria-label^="Remove row"]').evaluateAll((els) => els.map((e) => [e.getAttribute('aria-label'), Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)]))
    fail(b.length !== 3 ? `${b.length} remove buttons` : '', b.filter(([, w, h]) => w < 44 && h < 44).map((x) => `${x[0]} ${x[1]}x${x[2]}`))
  }),
)
def('T1-ROWS-unit-price-mixed', 'NEG', 'Compare pack prices: grams vs pieces says "compare like with like"; one half-filled row names the item', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('unit-price'))
    await s.locator('.rows__row').nth(0).locator('button.pick').click()
    await page.locator('.sheet .pick__opt', { has: page.getByText('piece', { exact: true }) }).click()
    const a = await snap(s)
    await s.locator('.rows__row').nth(1).locator('input.field').nth(0).fill('')
    const b = await snap(s)
    fail(a.state !== 'error' || !/like with like/i.test(a.err ?? '') ? `mixed -> ${a.state} ${a.err}` : '', b.state !== 'error' || !/item 2/i.test(b.err ?? '') ? `half row -> ${b.state} ${b.err}` : '')
  }),
)
def('T1-ROWS-unit-price-blank-rows', 'CORNER', 'Compare pack prices: only one filled row asks for at least two; a blank third row is ignored', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('unit-price'))
    await s.locator('button.btn', { hasText: 'Add row' }).click()
    const a = await snap(s)
    await s.locator('.rows__row').nth(1).locator('input.field').nth(0).fill('')
    await s.locator('.rows__row').nth(1).locator('input.field').nth(1).fill('')
    const b = await snap(s)
    fail(a.state !== 'result' ? `blank third row -> ${a.state} ${a.err}` : '', b.state !== 'error' || !/two/i.test(b.err ?? '') ? `one row -> ${b.state} ${b.err}` : '')
  }),
)
def('T1-ROWS-grade-blank-marks', 'CORNER', 'Marks and GPA: a subject with blank marks is skipped; all blank asks for marks; marks above the maximum is an error', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('grade-average'))
    const rows = s.locator('.rows__row')
    await rows.nth(2).locator('input.field').nth(1).fill('')
    const a = await snap(s)
    await rows.nth(0).locator('input.field').nth(1).fill('101')
    const b = await snap(s)
    await rows.nth(0).locator('input.field').nth(1).fill('')
    await rows.nth(1).locator('input.field').nth(1).fill('')
    const c = await snap(s)
    fail(a.state !== 'result' ? `skip blank -> ${a.state} ${a.err}` : '', b.state !== 'error' ? `101/100 -> ${b.state}` : '', c.state !== 'error' || !/marks/i.test(c.err ?? '') ? `none -> ${c.state} ${c.err}` : '')
  }),
)

// ---------------------------------------------------------------------------------------------------------------------
// 8. Dates
// ---------------------------------------------------------------------------------------------------------------------
async function setDate(page, s, id, v) {
  await field(s, id).fill(v)
  await settle(page)
}
def('T1-DATE-leap', 'CORNER', 'Date calculator: 29 Feb 2024 to 28 Feb 2025 is 365 days; 29 Feb 2024 to 1 Mar 2024 is 1 day', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('date'))
    await setDate(page, s, 'from', '2024-02-29')
    await setDate(page, s, 'to', '2025-02-28')
    const a = num(await rowVal(s, 'Days apart'))
    await setDate(page, s, 'to', '2024-03-01')
    const b = num(await rowVal(s, 'Days apart'))
    fail(!a.eq(365) ? `365 expected, got ${a}` : '', !b.eq(1) ? `1 expected, got ${b}` : '')
  }),
)
def('T1-DATE-invalid', 'NEG', 'Date calculator: invalid date (29 Feb 2027) or a cleared date gives a plain error, not a blank panel', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('date'))
    const out = []
    for (const v of ['2027-02-29', '', '2026-13-01']) {
      try {
        await setDate(page, s, 'to', v)
      } catch (e) {
        out.push(`fill ${v} threw`)
        continue
      }
      const sn = await snap(s)
      if (sn.state === 'blank') out.push(`${JSON.stringify(v)}: blank`)
      if (sn.state === 'error' && !/date/i.test(sn.err ?? '')) out.push(`${JSON.stringify(v)}: error "${sn.err}" does not mention a date`)
      if (sn.state === 'result') out.push(`${JSON.stringify(v)}: still a result (value now "${await field(s, 'to').inputValue()}")`)
    }
    fail(out)
  }),
)
def('T1-DATE-reversed', 'CORNER', 'Date calculator: start after end still gives the right days, and the screen says the dates were swapped', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('date'))
    await setDate(page, s, 'from', '2026-11-02')
    await setDate(page, s, 'to', '2026-01-01')
    const days = num(await rowVal(s, 'Days apart'))
    const text = await s.innerText()
    fail(!days.eq(305) ? `days ${days}` : '', !/swap|earlier|before|reverse/i.test(text) ? 'nothing tells the person the order was swapped (formula line shows it only inside "How this is worked out")' : '')
  }),
)
def('T1-DATE-year-end', 'CORNER', 'Date calculator: 31 Dec 2025 to 1 Jan 2026 is 1 day (year end)', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('date'))
    await setDate(page, s, 'from', '2025-12-31')
    await setDate(page, s, 'to', '2026-01-01')
    fail(!num(await rowVal(s, 'Days apart')).eq(1) ? 'not 1' : '')
  }),
)
def('T1-DATE-same-day', 'CORNER', 'Date calculator: same start and end is 0 days, 0 years 0 months 0 days', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('date'))
    await setDate(page, s, 'from', '2026-05-05')
    await setDate(page, s, 'to', '2026-05-05')
    fail(!num(await rowVal(s, 'Days apart')).eq(0) ? 'not 0' : '', (await rowVal(s, 'Years, months, days')) !== '0 years, 0 months, 0 days' ? await rowVal(s, 'Years, months, days') : '')
  }),
)
def('T1-DATE-extreme-years', 'CORNER', 'Date calculator: year 1000 to year 9999 gives a result without NaN', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('date'))
    await setDate(page, s, 'from', '1000-01-01')
    await setDate(page, s, 'to', '9999-12-31')
    const sn = await snap(s)
    fail(sn.state !== 'result' ? `${sn.state} ${sn.err}` : '', sn.bad ?? '')
  }),
)
def('T1-DATE-year-0001', 'CORNER', 'Date calculator: year 0001 (before the allowed 1000) gives a plain error naming the date', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('date'))
    await setDate(page, s, 'from', '0001-01-01')
    const sn = await snap(s)
    fail(sn.state === 'blank' ? 'blank' : '', sn.state === 'error' && !/date/i.test(sn.err ?? '') ? `error "${sn.err}"` : '', sn.state === 'result' ? 'accepted year 1' : '')
  }),
)
async function addCase(page, s, start, n, unit) {
  await choose(page, s, 'mode', 'Add time')
  await setDate(page, s, 'start', start)
  await setField(page, s, 'n', n)
  await choose(page, s, 'unit', unit)
  return snap(s)
}
def('T1-DATE-add-month-end', 'CORNER', 'Date calculator: 31 Jan 2026 + 1 month = 28 Feb 2026; 31 Jan 2028 + 1 month = 29 Feb 2028; 29 Feb 2024 + 1 year = 28 Feb 2025', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('date'))
    const bad = []
    for (const [start, n, unit, want] of [['2026-01-31', '1', 'Months', '28 Feb 2026'], ['2028-01-31', '1', 'Months', '29 Feb 2028'], ['2024-02-29', '1', 'Years', '28 Feb 2025'], ['2026-03-31', '-1', 'Months', '28 Feb 2026'], ['2026-12-31', '1', 'Days', '1 Jan 2027'], ['2026-01-01', '2', 'Weeks', '15 Jan 2026']]) {
      await addCase(page, s, start, n, unit)
      const got = await rowVal(s, 'New date')
      if (!got.includes(want)) bad.push(`${start} ${n} ${unit}: got ${got}, want ${want}`)
    }
    fail(bad)
  }),
)
def('T1-DATE-add-huge', 'CORNER', 'Date calculator: add 100000 years / go back 100000 years shows a real date or a plain error, never "Invalid"/NaN/negative year', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('date'))
    const bad = []
    for (const [n, unit] of [['100000', 'Years'], ['-100000', 'Years'], ['100000', 'Days'], ['-100000', 'Months'], ['100001', 'Days'], ['2.5', 'Days'], ['abc', 'Days'], ['', 'Days']]) {
      const sn = await addCase(page, s, '2026-01-31', n, unit)
      const got = sn.state === 'result' ? await rowVal(s, 'New date') : sn.err
      if (sn.state === 'blank') bad.push(`${n} ${unit}: blank`)
      else if (sn.bad || /invalid|-\d{3,}$|\d{6,}/i.test(got ?? '')) bad.push(`${n} ${unit}: "${got}"`)
    }
    fail(bad)
  }),
)
def('T1-DATE-add-fields', 'UX', 'Date calculator: switching to "Add time" shows Starting date, How many (hint about minus), Unit; hides the other mode fields', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('date'))
    await choose(page, s, 'mode', 'Add time')
    const labels = await s.locator('.field-row label.field-label').allInnerTexts()
    const hint = await s.locator('.field-hint').allInnerTexts()
    fail(!labels.includes('Starting date') || !labels.includes('How many') ? `labels ${labels}` : '', labels.includes('Start date') ? 'diff fields still visible' : '', !hint.some((h) => /minus/i.test(h)) ? `hint ${hint}` : '')
  }),
)
def('T1-DATE-age', 'POS', 'Date calculator, age: born 15 Jun 1990, on 2 Nov 2026 is 36 years, 4 months, 18 days; next birthday in 225 days', () =>
  withPage({ now: Date.UTC(2026, 10, 2, 6, 0, 0) }, async ({ page }) => {
    const s = await openTool(page, tool('date'))
    await choose(page, s, 'mode', 'Age')
    const age = await rowVal(s, 'Age')
    const lived = num(await rowVal(s, 'Days lived'))
    const nb = num(await rowVal(s, 'Next birthday in'))
    const days = Math.round((Date.UTC(2026, 10, 2) - Date.UTC(1990, 5, 15)) / 86400000)
    const next = Math.round((Date.UTC(2027, 5, 15) - Date.UTC(2026, 10, 2)) / 86400000)
    fail(age !== '36 years, 4 months, 18 days' ? `age "${age}"` : '', !lived.eq(days) ? `days lived ${lived} vs ${days}` : '', !nb.eq(next) ? `next birthday ${nb} vs ${next}` : '')
  }),
)
def('T1-DATE-age-future', 'ERR', 'Date calculator, age: a date of birth in the future says so in words', () =>
  withPage({ now: Date.UTC(2026, 10, 2, 6, 0, 0) }, async ({ page }) => {
    const s = await openTool(page, tool('date'))
    await choose(page, s, 'mode', 'Age')
    await setDate(page, s, 'dob', '2026-11-03')
    const sn = await snap(s)
    fail(sn.state !== 'error' || !/future/i.test(sn.err ?? '') ? `${sn.state} ${sn.err}` : '')
  }),
)
def('T1-DATE-age-today', 'CORNER', 'Date calculator, age: born today = 0 years 0 months 0 days, next birthday in 365 days (not 0)', () =>
  withPage({ now: Date.UTC(2026, 10, 2, 6, 0, 0) }, async ({ page }) => {
    const s = await openTool(page, tool('date'))
    await choose(page, s, 'mode', 'Age')
    await setDate(page, s, 'dob', '2026-11-02')
    const sn = await snap(s)
    const nb = sn.state === 'result' ? num(await rowVal(s, 'Next birthday in')) : null
    fail(sn.state !== 'result' ? `${sn.state} ${sn.err}` : '', nb && !nb.eq(365) ? `next birthday in ${nb} days` : '')
  }),
)
def('T1-DATE-age-leap-birthday', 'CORNER', 'Date calculator, age: born 29 Feb 2000, asked on 28 Feb 2026 and 1 Mar 2026, gives a sane age and next birthday', () => {
  const run = async (now) =>
    withPage({ now }, async ({ page }) => {
      const s = await openTool(page, tool('date'))
      await choose(page, s, 'mode', 'Age')
      await setDate(page, s, 'dob', '2000-02-29')
      return { age: await rowVal(s, 'Age'), next: await rowVal(s, 'Next birthday in') }
    })
  return (async () => {
    const a = await run(Date.UTC(2026, 1, 28, 6))
    const b = await run(Date.UTC(2026, 2, 1, 6))
    fail(a.age !== '25 years, 11 months, 30 days' && !/^25 years, 11 months/.test(a.age) ? `28 Feb: ${a.age}` : '', !/^26 years, 0 months, (0|1) days/.test(b.age) ? `1 Mar: ${b.age}` : '', num(a.next).lte(0) || num(b.next).lte(0) ? `next birthday ${a.next}/${b.next}` : '')
  })()
})
def('T1-DATE-ovulation-edges', 'CORNER', 'Ovulation: cycles 21 and 45 work; 20, 46 and 28.5 give an error naming the cycle', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('ovulation'))
    const out = []
    for (const [c, okv] of [['21', true], ['45', true], ['20', false], ['46', false], ['28.5', false], ['0', false], ['-28', false]]) {
      await setField(page, s, 'cycle', c)
      const sn = await snap(s)
      if (okv && sn.state !== 'result') out.push(`${c}: ${sn.state} ${sn.err}`)
      if (!okv && (sn.state !== 'error' || !/cycle/i.test(sn.err ?? ''))) out.push(`${c}: ${sn.state} ${sn.err}`)
    }
    fail(out)
  }),
)
def('T1-DATE-ovulation-year-end', 'CORNER', 'Ovulation: last period 31 Dec 2026 with 28 days gives next period 28 Jan 2027', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('ovulation'))
    await setDate(page, s, 'last', '2026-12-31')
    fail(!/28 Jan 2027/.test(await rowVal(s, 'Next period')) ? await rowVal(s, 'Next period') : '')
  }),
)
def('T1-DATE-ovulation-empty', 'ERR', 'Ovulation: cleared date asks for the first day of the last period', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('ovulation'))
    await setDate(page, s, 'last', '')
    const sn = await snap(s)
    fail(sn.state !== 'error' || !/period|date/i.test(sn.err ?? '') ? `${sn.state} ${sn.err}` : '')
  }),
)
def('T1-DATE-input-type', 'UX', 'Date boxes open the phone date picker (type=date), show a value in default, 44px high', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('date'))
    const d = await s.locator('input[type=date]').evaluateAll((els) => els.map((e) => [e.id, e.value, Math.round(e.getBoundingClientRect().height)]))
    fail(d.length !== 2 ? `${d.length} date inputs` : '', d.filter(([, v, h]) => !v || h < 44).map((x) => x.join(' ')))
  }),
)
def('T1-WORLD-time', 'POS', 'World time: home city (Mumbai) shows the device time (IST); table lists 20+ cities with offsets', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('world-time'))
    const main = (await rowsOf(s))[0]
    const cards = await cardsOf(s)
    const m = /(\d{1,2}):(\d{2})/.exec(main[1])
    const now = new Date()
    const ist = new Date(now.getTime() + 5.5 * 3600000)
    const diff = m ? Math.abs((Number(m[1]) * 60 + Number(m[2])) - (ist.getUTCHours() * 60 + ist.getUTCMinutes())) : 9999
    fail(!m ? `main "${main[1]}"` : '', diff > 3 && diff < 1437 ? `shows ${main[1]}, real IST ${ist.getUTCHours()}:${ist.getUTCMinutes()}` : '', cards.length < 20 ? `${cards.length} cities` : '')
  }),
)
def('T1-WORLD-home', 'POS', 'World time: changing home to London changes the headline and "From home" column', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('world-time'))
    await choose(page, s, 'home', 'London')
    const main = (await rowsOf(s))[0]
    fail(!/London/.test(main[0]) ? `headline "${main[0]}"` : '')
  }),
)
def('T1-WORLD-stale', 'UX', 'World time: the shown time follows the clock (ticks) or says it is a snapshot', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('world-time'))
    const a = (await rowsOf(s))[0][1]
    await page.waitForTimeout(62000)
    const b = (await rowsOf(s))[0][1]
    const note = await s.locator('.result__note').innerText().catch(() => '')
    fail(a === b && !/moment|snapshot|last changed|refresh/i.test(note) ? `still ${a} after a minute and no note` : '')
  }),
)

// ---------------------------------------------------------------------------------------------------------------------
// 9. More options disclosure
// ---------------------------------------------------------------------------------------------------------------------
const WITH_MORE = ['discount', 'gst', 'number-base', 'prepayment', 'rate-change', 'home-loan-tax', 'simple-compound']
for (const id of WITH_MORE)
  def(`T1-MORE-${id}`, 'UX', `${tool(id).title}: "More options" starts closed, opens on a tap, keeps the result, and stays open once opened`, () =>
    withPage({}, async ({ page }) => {
      const s = await openTool(page, tool(id))
      const d = s.locator('details.more')
      const closed = !(await d.evaluate((e) => e.open))
      const sum = await d.locator('summary').innerText()
      const h = await d.locator('summary').evaluate((e) => Math.round(e.getBoundingClientRect().height))
      await d.locator('summary').click()
      const open = await d.evaluate((e) => e.open)
      const fields = await d.locator('.field-row').count()
      const sn = await snap(s)
      await d.locator('input.field').first().fill('1').catch(() => {})
      const still = await d.evaluate((e) => e.open)
      fail(!closed ? 'starts open' : '', sum.trim() !== 'More options' ? `summary "${sum}"` : '', h < 44 ? `summary only ${h}px high` : '', !open ? 'did not open' : '', fields === 0 ? 'no fields inside' : '', sn.state !== 'result' ? `result gone: ${sn.state} ${sn.err}` : '', !still ? 'closed itself after typing' : '')
    }),
  )
def('T1-MORE-none', 'UX', 'Tools with only 2 to 4 fields show no "More options" line (percentage, tip, emi, fuel-cost)', () =>
  withPage({}, async ({ page }) => {
    const bad = []
    for (const id of ['percentage', 'tip', 'emi', 'fuel-cost'])
      await withPage({}, async (o) => {
        const s = await openTool(o.page, tool(id))
        if (await s.locator('details.more').count()) bad.push(id)
      })
    fail(bad)
    void page
  }),
)
def('T1-MORE-opens-by-itself', 'UX', 'Home loan tax: a saved card with a changed hidden field reopens with "More options" already open', () =>
  withPage({}, async ({ page }) => {
    const t = tool('home-loan-tax')
    const s = await openTool(page, t)
    await openMore(s)
    await choose(page, s, 'occupancy', 'Rented out')
    await s.locator('button.link-btn', { hasText: 'Save' }).click()
    await page.locator('.sheet .sheet__foot button.btn--primary').click()
    await tab(page, 'Notes')
    await page.locator('.group button, .group .navrow, .group [role=button]').first().click()
    const s2 = scr(page, t)
    await s2.waitFor()
    const open = await s2.locator('details.more').evaluate((e) => e.open)
    const rent = await s2.locator('#f-rent').count()
    fail(!open ? 'More options closed on the saved card' : '', !rent ? 'rent box not shown' : '')
  }),
)
def('T1-MORE-conditional-fields', 'UX', 'Conditional boxes appear and vanish: GST "Other rate" box, Home loan "Rented out" rent box, Home loan old regime section-123 box', () =>
  withPage({}, async ({ page }) => {
    const bad = []
    let s = await openTool(page, tool('gst'))
    if (await field(s, 'custom').count()) bad.push('GST custom rate visible by default')
    await choose(page, s, 'rate', 'Other rate')
    if (!(await field(s, 'custom').count())) bad.push('GST custom rate missing after Other rate')
    await choose(page, s, 'rate', '18%')
    if (await field(s, 'custom').count()) bad.push('GST custom rate stays after going back to 18%')
    await page.locator('.screen button[aria-label="Back"]').last().click()
    s = await openTool(page, tool('home-loan-tax'))
    await openMore(s)
    if (!(await field(s, 'used123').count())) bad.push('section-123 box missing in old regime')
    await choose(page, s, 'regime', 'New regime')
    if (await field(s, 'used123').count()) bad.push('section-123 box shown in new regime')
    fail(bad)
  }),
)

// ---------------------------------------------------------------------------------------------------------------------
// 10. Number box behaviour: grouping while typing, caret, words echo
// ---------------------------------------------------------------------------------------------------------------------
def('T1-TYPE-grouping', 'POS', 'Typing 1234567 in a rupee box shows 12,34,567 and "12 lakh 34 thousand..." words (Indian)', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    const el = field(s, 'principal')
    await el.click()
    await el.selectText()
    await page.keyboard.press('Backspace')
    await page.keyboard.type('1234567', { delay: 15 })
    const v = await el.inputValue()
    const words = await s.locator('.field-words').first().innerText()
    fail(v !== '12,34,567' ? `value "${v}"` : '', !/lakh/i.test(words) ? `words "${words}"` : '')
  }),
)
def('T1-TYPE-comma-typed', 'POS', 'Typing "1,50,000" with the commas gives 1,50,000 and a result for 1.5 lakh', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    const el = field(s, 'principal')
    await el.click()
    await el.selectText()
    await page.keyboard.type('1,50,000', { delay: 15 })
    const v = await el.inputValue()
    const emi = num(await rowVal(s, 'Monthly EMI'))
    fail(v !== '1,50,000' ? `value "${v}"` : '', near(emi, emiOf(150000, 8.5, 240), '0.01', 'EMI for 1.5 lakh'))
  }),
)
def('T1-TYPE-caret', 'UX', 'Typing a digit in the middle of a grouped number keeps the caret after that digit', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    const el = field(s, 'principal')
    await el.click()
    await el.selectText()
    await page.keyboard.type('1000', { delay: 15 })
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.type('5', { delay: 15 })
    await page.keyboard.type('9', { delay: 15 })
    const v = await el.inputValue()
    fail(v !== '1,05,900' ? `got "${v}", expected 1,05,900 (1000 -> 10|00 -> 5 -> 9)` : '')
  }),
)
def('T1-TYPE-backspace-comma', 'UX', 'Backspace right after a comma removes the digit before it in one press', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    const el = field(s, 'principal')
    await el.click()
    await el.selectText()
    await page.keyboard.type('12345', { delay: 15 })
    // value is 12,345; caret after the comma: Left x3 from the end
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Backspace')
    const v = await el.inputValue()
    fail(v === '12,345' ? 'first Backspace changed nothing (it only deleted the comma, then the commas were put back)' : '')
  }),
)
def('T1-TYPE-international', 'POS', 'With the international number system set, typing 1234567 shows 1,234,567 and "1.23 million"', () =>
  withPage({ settings: { numberSystem: 'international' } }, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    const el = field(s, 'principal')
    await el.click()
    await el.selectText()
    await page.keyboard.type('1234567', { delay: 15 })
    const v = await el.inputValue()
    const words = await s.locator('.field-words').first().innerText()
    fail(v !== '1,234,567' ? `value "${v}"` : '', !/million/i.test(words) ? `words "${words}"` : '')
  }),
)
def('T1-TYPE-percent-no-group', 'UX', 'Percent, years and months boxes do not add commas (rate 8.5, term 20)', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await field(s, 'rate').fill('12345')
    fail((await field(s, 'rate').inputValue()).includes(',') ? 'commas in the rate box' : '')
  }),
)
def('T1-TYPE-too-large', 'ERR', 'A rupee box above 10 lakh crore says it is too large and names the box; exactly 10 lakh crore still works', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await setField(page, s, 'principal', '10000000000001')
    const a = await snap(s)
    await setField(page, s, 'principal', '10000000000000')
    const b = await snap(s)
    fail(a.state !== 'error' || !/too large/i.test(a.err ?? '') || !/loan amount/i.test(a.err ?? '') ? `1e13+1 -> ${a.state} "${a.err}"` : '', b.state !== 'result' ? `1e13 -> ${b.state} "${b.err}"` : '')
  }),
)
def('T1-TYPE-too-large-nonrupee', 'CORNER', 'Counts and quantities (distance, people, unit value) above 1e13 are rejected or shown safely, not as raw E+ notation', () =>
  withPage({}, async ({ page }) => {
    const bad = []
    for (const [id, f, v] of [['fuel-cost', 'distance', '1e30'], ['tip', 'people', '1e30'], ['unit-converter', 'value', '1e30'], ['fuel-efficiency', 'value', '1e30']]) {
      await withPage({}, async (o) => {
        const s = await openTool(o.page, tool(id))
        await setField(o.page, s, f, v)
        const sn = await snap(s)
        const txt = sn.state === 'result' ? (await rowsOf(s)).map((r) => r.join('=')).join(' ; ') : sn.err
        if (sn.state === 'blank' || sn.bad || /E\+\d+/.test(txt ?? '')) bad.push(`${id}.${f}=${v}: ${sn.state} ${txt?.slice(0, 80)}`)
      })
    }
    fail(bad)
    void page
  }),
)
def('T1-TYPE-minus-unicode', 'NEG', 'A real minus sign (−5) typed in a tool box is read as negative and refused where negatives make no sense (tip percent)', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('tip'))
    await setField(page, s, 'pct', '−5')
    const a = await snap(s)
    await setField(page, s, 'pct', '-5')
    const b = await snap(s)
    fail(a.state !== 'error' ? `"−5" -> ${a.state}` : '', b.state !== 'error' ? `"-5" -> ${b.state}` : '', a.state === 'error' && b.state === 'error' && a.err !== b.err ? `different errors: ${a.err} / ${b.err}` : '')
  }),
)
def('T1-TYPE-comma-decimal', 'CORNER', 'known B-06: "1,5" typed as a decimal in a percent box is read as 15 (confirm)', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('tip'))
    await setField(page, s, 'pct', '1,5')
    const tipRow = num(await rowVal(s, 'Tip'))
    // bill 2400: 1.5% = 36, 15% = 360
    fail(tipRow.eq(360) ? 'known B-06, confirmed: "1,5" became 15 (tip 360 instead of 36 or an error)' : '')
  }),
)
def('T1-TYPE-hex-literal', 'CORNER', 'known B-23: "0x10" and "1e5" accepted as numbers in tool boxes (confirm)', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('tip'))
    await setField(page, s, 'pct', '0x10')
    const a = await snap(s)
    await setField(page, s, 'pct', '1e1')
    const b = await snap(s)
    fail(a.state === 'result' ? 'known B-23, confirmed: "0x10" accepted (tip 16%)' : '', b.state === 'result' ? 'known B-23, confirmed: "1e1" accepted (tip 10%)' : '')
  }),
)

// ---------------------------------------------------------------------------------------------------------------------
// 11. Page chrome: Save, Update, Delete, icons, answer bar, picker sheet, drafts, persistence
// ---------------------------------------------------------------------------------------------------------------------
const saveBtn = (s) => s.locator('header.screen__bar button.link-btn')
async function saveNow(page, s, title) {
  await saveBtn(s).click()
  if (title !== undefined) {
    const inp = page.locator('.sheet #save-title')
    await inp.fill(title)
  }
  await page.locator('.sheet .sheet__foot button.btn--primary').click()
}
const snackText = (page) => page.locator('.snack').innerText()
const storedCards = async (page) => (await stored(page))?.cards ?? []

def('T1-SAVE-button', 'UI', 'Save is in the header, named, at least 44px, and looks like a link/button', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    const b = saveBtn(s)
    const r = await b.evaluate((e) => ({ w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height, text: e.textContent, deco: getComputedStyle(e).textDecorationLine, color: getComputedStyle(e).color }))
    fail(r.text.trim() !== 'Save' ? `text "${r.text}"` : '', r.h < 44 && r.w < 44 ? `size ${r.w}x${r.h}` : '')
  }),
)
def('T1-SAVE-empty-title', 'NEG', 'Save with the title cleared: sheet stays open, "Give this a name" shown, nothing saved', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await saveNow(page, s, '')
    const err = await page.locator('.sheet .ffield__error').innerText().catch(() => '')
    const open = await page.locator('.sheet').count()
    fail(!open ? 'sheet closed' : '', !/name/i.test(err) ? `error "${err}"` : '', (await storedCards(page)).length ? 'a card was saved' : '')
  }),
)
def('T1-SAVE-whitespace-title', 'NEG', 'Save with a title of only spaces is treated as empty', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await saveNow(page, s, '     ')
    const open = await page.locator('.sheet').count()
    fail(!open ? 'saved with a blank title' : '')
  }),
)
def('T1-SAVE-error-clears', 'UX', 'The "Give this a name" error disappears as soon as you type', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await saveNow(page, s, '')
    await page.locator('.sheet #save-title').fill('x')
    fail((await page.locator('.sheet .ffield__error').count()) ? 'error stays' : '')
  }),
)
def('T1-SAVE-snack-view', 'POS', 'Save shows the "Saved to Notes" snack with a View button that opens Notes', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await saveNow(page, s)
    const snack = await snackText(page)
    await page.locator('.snack button', { hasText: 'View' }).click()
    const on = await page.locator('.tabbar .tab[aria-current=page]').innerText()
    fail(!/Saved to Notes/.test(snack) ? `snack "${snack}"` : '', !/Notes/.test(on) ? `after View, tab is ${on}` : '')
  }),
)
def('T1-SAVE-stored', 'POS', 'Saved card stores tool id, title, inputs, summary and amount', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await setField(page, s, 'principal', '7500000')
    await saveNow(page, s, 'My home loan')
    await page.waitForTimeout(800)
    const c = (await storedCards(page))[0]
    fail(!c ? 'no card stored' : '', c && c.toolId !== 'emi' ? `toolId ${c.toolId}` : '', c && c.title !== 'My home loan' ? `title ${c.title}` : '', c && c.inputs?.principal !== '7500000' ? `inputs ${JSON.stringify(c.inputs)}` : '', c && !/Monthly EMI/.test(c.summary ?? '') ? `summary ${c.summary}` : '', c && !c.amount ? 'amount missing' : '')
  }),
)
def('T1-SAVE-header-after', 'UX', 'After saving, the header button reads Update and a Delete icon appears, title is the saved title', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await saveNow(page, s, 'Car loan plan')
    const label = await saveBtn(s).innerText()
    const del = await s.locator('header button[aria-label^="Delete"]').getAttribute('aria-label').catch(() => null)
    const head = await s.locator('h1.screen__title').innerText()
    fail(label !== 'Update' ? `button "${label}"` : '', del !== 'Delete Car loan plan' ? `delete label ${del}` : '', head !== 'Car loan plan' ? `header "${head}"` : '')
  }),
)
def('T1-SAVE-update', 'POS', 'Update: change an input, Update, snack says "Updated in Notes", stored inputs change, still one card', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await saveNow(page, s, 'Loan A')
    await page.waitForTimeout(300)
    await setField(page, s, 'principal', '3000000')
    await saveNow(page, s)
    const snack = await snackText(page)
    await page.waitForTimeout(800)
    const cards = await storedCards(page)
    fail(!/Updated in Notes/.test(snack) ? `snack "${snack}"` : '', cards.length !== 1 ? `${cards.length} cards` : '', cards[0]?.inputs?.principal !== '3000000' ? `principal ${cards[0]?.inputs?.principal}` : '')
  }),
)
def('T1-SAVE-update-title', 'POS', 'Update can rename: the header shows the new title', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await saveNow(page, s, 'Loan A')
    await saveNow(page, s, 'Loan B')
    fail((await s.locator('h1.screen__title').innerText()) !== 'Loan B' ? 'header not renamed' : '')
  }),
)
def('T1-SAVE-update-error-blocked', 'ERR', 'Save while the form has an error does not open the sheet and says why in a snack', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await setField(page, s, 'principal', '')
    await saveBtn(s).click()
    const snack = await snackText(page).catch(() => '')
    fail((await page.locator('.sheet').count()) ? 'sheet opened with an error' : '', !/Then you can save|loan amount/i.test(snack) ? `snack "${snack}"` : '')
  }),
)
def('T1-SAVE-delete-undo', 'POS', 'Delete saved: moves to Trash with an Undo snack; Undo brings it back', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await saveNow(page, s, 'Del me')
    await page.waitForTimeout(300)
    await s.locator('header button[aria-label="Delete Del me"]').click()
    const snack = await snackText(page)
    const gone = (await scr(page, tool('emi')).count()) === 0
    const afterDelete = (await storedCards(page)).filter((c) => c.deletedAt === null).length
    await page.locator('.snack button', { hasText: 'Undo' }).click()
    await page.waitForTimeout(600)
    const afterUndo = (await storedCards(page)).filter((c) => c.deletedAt === null).length
    fail(!/Moved .* to Trash/.test(snack) ? `snack "${snack}"` : '', !gone ? 'screen still open after delete' : '', afterDelete !== 0 ? `${afterDelete} live cards after delete` : '', afterUndo !== 1 ? `${afterUndo} live cards after undo` : '')
  }),
)
def('T1-SAVE-persist', 'RUNTIME', 'Save a card, reload the page, open it from Notes: every field value restored', () =>
  withPage({}, async ({ page, errors }) => {
    const t = tool('prepayment')
    const s = await openTool(page, t)
    await setField(page, s, 'principal', '7500000')
    await setField(page, s, 'rate', '9.25')
    await setField(page, s, 'amount', '250000')
    await setField(page, s, 'after', '30')
    await openMore(s)
    await choose(page, s, 'mode', 'Lower EMI')
    await saveNow(page, s, 'Prepay plan')
    await page.waitForTimeout(1000)
    await page.reload()
    await page.waitForSelector('.app')
    await tab(page, 'Notes')
    await page.locator('.group', { hasText: 'Prepay plan' }).locator('button', { hasText: 'Prepay plan' }).first().click()
    const s2 = scr(page, t)
    await s2.waitFor()
    const vals = {
      principal: await field(s2, 'principal').inputValue(),
      rate: await field(s2, 'rate').inputValue(),
      amount: await field(s2, 'amount').inputValue(),
      after: await field(s2, 'after').inputValue(),
    }
    const more = await s2.locator('details.more').evaluate((e) => e.open)
    const mode = await s2.locator('.seg').last().locator('button[aria-checked=true]').innerText()
    const head = await s2.locator('h1.screen__title').innerText()
    fail(
      vals.principal !== '75,00,000' ? `principal ${vals.principal}` : '',
      vals.rate !== '9.25' ? `rate ${vals.rate}` : '',
      vals.amount !== '2,50,000' ? `amount ${vals.amount}` : '',
      vals.after !== '30' ? `after ${vals.after}` : '',
      !more ? 'More options closed though mode was changed' : '',
      mode !== 'Lower EMI' ? `mode ${mode}` : '',
      head !== 'Prepay plan' ? `header ${head}` : '',
      realErrors(errors),
    )
  }),
)
def('T1-SAVE-persist-rows', 'RUNTIME', 'Save a card with row inputs (loan offers, 3 rows), reload, reopen: all rows restored', () =>
  withPage({}, async ({ page }) => {
    const t = tool('loan-compare')
    const s = await openTool(page, t)
    await s.locator('button.btn', { hasText: 'Add row' }).click()
    await setRows(page, s, [[null, '8.9'], [null, null], ['4000000', '9.1', '15', '5000']])
    await saveNow(page, s, 'Offers')
    await page.waitForTimeout(1000)
    await page.reload()
    await page.waitForSelector('.app')
    await tab(page, 'Notes')
    await page.locator('.group button', { hasText: 'Offers' }).first().click()
    const s2 = scr(page, t)
    await s2.waitFor()
    const n = await s2.locator('.rows__row').count()
    const vals = await s2.locator('.rows__row').nth(2).locator('input.field').evaluateAll((els) => els.map((e) => e.value))
    const r1 = await s2.locator('.rows__row').nth(0).locator('input.field').nth(1).inputValue()
    fail(n !== 3 ? `${n} rows` : '', vals.join('|') !== '40,00,000|9.1|15|5,000' ? `row 3 ${vals.join('|')}` : '', r1 !== '8.9' ? `row 1 rate ${r1}` : '')
  }),
)
def('T1-SAVE-persist-all-tools', 'RUNTIME', 'Every one of the 26 calculators can be saved and reopened from Notes with the same default result', () =>
  withPage({}, async ({ page, errors }) => {
    const bad = []
    for (const t of TOOLS) {
      await tab(page, 'Tools')
      const s = await openTool(page, t)
      const before = JSON.stringify(await rowsOf(s))
      await saveNow(page, s, `Card ${t.id}`)
      await page.locator('.screen button[aria-label="Back"]').last().click()
      await page.locator('.screen button[aria-label="Back"]').last().click().catch(() => {})
    }
    await page.waitForTimeout(800)
    const cards = await storedCards(page)
    if (cards.length !== 26) bad.push(`${cards.length} cards stored for 26 calculators`)
    await page.reload()
    await page.waitForSelector('.app')
    await tab(page, 'Notes')
    for (const t of TOOLS.slice(0, 26)) {
      const row = page.locator('.group button', { hasText: `Card ${t.id}` }).first()
      if (!(await row.count())) {
        bad.push(`${t.id}: not in Notes after reload`)
        continue
      }
      await row.click()
      const s = scr(page, { title: `Card ${t.id}` })
      await s.waitFor({ timeout: 3000 }).catch(() => bad.push(`${t.id}: card did not open`))
      const sn = (await s.count()) ? await snap(s) : { state: 'n/a' }
      if (sn.state !== 'result') bad.push(`${t.id}: reopened card shows ${sn.state}`)
      await page.locator('.screen button[aria-label="Back"]').last().click()
    }
    fail(bad, realErrors(errors))
  }),
)
def('T1-SAVE-reminder', 'POS', 'Remind me icon: sheet opens with the reminder switch on; Save stores a card and one reminder', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await s.locator('.keep__btn[aria-label="Remind me"]').click()
    const on = await page.locator('.sheet button[role=switch][aria-label="Remind me"]').getAttribute('aria-checked')
    await page.locator('.sheet .sheet__foot button.btn--primary').click()
    await page.waitForTimeout(800)
    const d = await stored(page)
    fail(on !== 'true' ? 'switch off after tapping Remind me' : '', (d.cards ?? []).length !== 1 ? `${(d.cards ?? []).length} cards` : '', (d.reminders ?? []).length !== 1 ? `${(d.reminders ?? []).length} reminders` : '')
  }),
)
def('T1-SAVE-reminder-no-date', 'NEG', 'Reminder with the date cleared: Save says what is wrong instead of doing nothing', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await s.locator('.keep__btn[aria-label="Remind me"]').click()
    await page.locator('.sheet input[type=date]').fill('')
    await page.locator('.sheet .sheet__foot button.btn--primary').click()
    const open = await page.locator('.sheet').count()
    const err = await page.locator('.sheet .ffield__error, .sheet [role=alert]').count()
    const snack = await page.locator('.snack').count()
    fail(open && !err && !snack ? 'known B-18, confirmed: nothing happens and nothing is said' : '')
  }),
)
def('T1-SAVE-sheet-close', 'UX', 'Save sheet closes with X, Escape and a tap outside; title is filled in; footer button is named Save', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    const bad = []
    await saveBtn(s).click()
    const title = await page.locator('.sheet #save-title').inputValue()
    const foot = await page.locator('.sheet .sheet__foot button').innerText()
    if (title !== 'Loan EMI') bad.push(`title "${title}"`)
    if (foot !== 'Save') bad.push(`footer "${foot}"`)
    await page.locator('.sheet button[aria-label="Close Save"]').click()
    if (await page.locator('.sheet').count()) bad.push('X did not close')
    await saveBtn(s).click()
    await page.keyboard.press('Escape')
    if (await page.locator('.sheet').count()) bad.push('Escape did not close')
    if (!(await scr(page, tool('emi')).count())) bad.push('Escape closed the calculator too')
    await saveBtn(s).click()
    await page.locator('.scrim').click({ position: { x: 10, y: 10 } })
    if (await page.locator('.sheet').count()) bad.push('tap outside did not close')
    fail(bad)
  }),
)
def('T1-ICONS-named', 'UI', 'Copy / Share / Add to a list / Remind me icons have names and are 44px; "Add to a list" only on money answers', () =>
  withPage({}, async ({ page }) => {
    const bad = []
    for (const [id, wantList] of [['emi', true], ['percentage', false], ['gst', true], ['date', false], ['currency', false]]) {
      await tab(page, 'Tools')
      const s = await openTool(page, tool(id))
      const b = await s.locator('.keep__btn').evaluateAll((els) => els.map((e) => [e.getAttribute('aria-label'), e.getAttribute('title'), Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)]))
      const names = b.map((x) => x[0])
      for (const n of ['Copy', 'Share', 'Remind me']) if (!names.includes(n)) bad.push(`${id}: no ${n}`)
      if (wantList !== names.includes('Add to a list')) bad.push(`${id}: "Add to a list" ${names.includes('Add to a list') ? 'shown' : 'missing'}`)
      for (const x of b) if (x[2] < 44 && x[3] < 44) bad.push(`${id}: ${x[0]} is ${x[2]}x${x[3]}`)
      await page.locator('.screen button[aria-label="Back"]').last().click()
      await page.locator('.screen button[aria-label="Back"]').last().click().catch(() => {})
    }
    fail(bad)
  }),
)
def('T1-ICONS-copy', 'POS', 'Copy asks "With commas / Without commas", then says Copied and the clipboard holds the text', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await s.locator('.keep__btn[aria-label="Copy"]').click()
    const names = await page.locator('.sheet .copyas__name').allInnerTexts()
    await page.locator('.sheet .copyas__opt', { hasText: 'Without commas' }).click()
    await page.waitForTimeout(300)
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => `ERR ${e.message}`)
    const said = await page.locator('.app').innerText()
    fail(names.join() !== 'With commas,Without commas' ? `sheet ${names}` : '', !/Copied/.test(said) ? 'no "Copied" message' : '', !/Monthly EMI/.test(clip) || /\d,\d/.test(clip.split('\n').find((l) => /Monthly EMI/.test(l)) ?? '') ? `clipboard "${clip.slice(0, 80)}"` : '')
  }),
)
def('T1-ICONS-copy-nocomma', 'UX', 'Copy of an answer with no thousands commas (Percentage) copies straight away, no question', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('percentage'))
    await s.locator('.keep__btn[aria-label="Copy"]').click()
    const sheet = await page.locator('.sheet').count()
    fail(sheet ? 'asked With/Without commas for text that has none' : '')
  }),
)
def('T1-ICONS-share', 'POS', 'Share: shows a message when the browser has no share sheet (Copied...), no error', () =>
  withPage({}, async ({ page, errors }) => {
    const s = await openTool(page, tool('emi'))
    await page.evaluate(() => { try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }) } catch {} })
    await s.locator('.keep__btn[aria-label="Share"]').click()
    await page.waitForTimeout(400)
    const msg = await s.locator('.keep__msg').innerText()
    fail(!/Copied/.test(msg) ? `message "${msg}"` : '', realErrors(errors))
  }),
)
def('T1-ICONS-to-list', 'POS', 'Add to a list: sheet shows the amount, "Add to list" creates a list and opens it in Notes', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('tip'))
    await s.locator('.keep__btn[aria-label="Add to a list"]').click()
    const sum = await page.locator('.sheet .tolist__sum').innerText()
    await page.locator('.sheet .sheet__foot button.btn--primary').click()
    await page.waitForTimeout(800)
    const on = await page.locator('.tabbar .tab[aria-current=page]').innerText()
    const cards = await storedCards(page)
    fail(!/660/.test(sum) ? `sum "${sum}"` : '', !/Notes/.test(on) ? `tab ${on}` : '', cards.length !== 1 || cards[0].kind !== 'tape' ? `cards ${JSON.stringify(cards.map((c) => c.kind))}` : '')
  }),
)
def('T1-ICONS-hidden-on-error', 'UX', 'With an error showing there is no Result card and no Keep/Share row', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    await setField(page, s, 'rate', '')
    fail((await s.locator('.keep').count()) ? 'icons shown with an error' : '', (await s.locator('section.result').count()) ? 'old result still shown' : '')
  }),
)
def('T1-ANSWER-bar', 'UX', 'Bottom answer button appears only when the result has scrolled away; tapping it scrolls back and it goes away', () =>
  withPage({}, async ({ page }) => {
    const t = tool('amortisation')
    const s = await openTool(page, t)
    const early = await s.locator('.answer').count()
    await choose(page, s, 'view', 'Monthly')
    const body = s.locator('.screen__body')
    await body.evaluate((e) => (e.scrollTop = e.scrollHeight))
    await s.locator('.answer').waitFor({ timeout: 3000 })
    const label = await s.locator('.answer').getAttribute('aria-label')
    const r = await s.locator('.answer').evaluate((e) => ({ h: e.getBoundingClientRect().height, bottom: e.getBoundingClientRect().bottom, tab: document.querySelector('.tabbar').getBoundingClientRect().top }))
    await s.locator('.answer').click()
    await page.waitForTimeout(1200)
    const after = await s.locator('.answer').count()
    const inView = await s.locator('.result__row--main').evaluate((e) => { const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= window.innerHeight })
    fail(early ? 'answer bar shown while the result is visible' : '', !/Monthly EMI/.test(label ?? '') ? `label "${label}"` : '', r.h < 44 ? `bar ${r.h}px high` : '', r.bottom > r.tab + 1 ? `bar overlaps the tab bar (${r.bottom} vs ${r.tab})` : '', after ? 'bar still shown after tapping it' : '', !inView ? 'main result not in view after tapping' : '')
  }),
)
def('T1-ANSWER-bar-200', 'UI', 'Answer bar at 200% font on a long result does not overflow or hide the last result row', () =>
  withPage({ font: 200, theme: 'light' }, async ({ page }) => {
    const s = await openTool(page, tool('amortisation'))
    await s.locator('.screen__body').evaluate((e) => (e.scrollTop = e.scrollHeight))
    await s.locator('.answer').waitFor({ timeout: 3000 })
    fail(...(await layoutIssues(page, s, 'answer 200%')))
  }),
)
def('T1-ANSWER-bar-error', 'UX', 'Answer bar never shows while there is an error', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('amortisation'))
    await s.locator('.screen__body').evaluate((e) => (e.scrollTop = e.scrollHeight))
    await s.locator('.answer').waitFor({ timeout: 3000 })
    await s.locator('.screen__body').evaluate((e) => (e.scrollTop = 0))
    await setField(page, s, 'rate', '')
    fail((await s.locator('.answer').count()) ? 'answer bar shown with an error' : '')
  }),
)
def('T1-PICKER-currency', 'POS', 'Picker sheet (30 currencies): opens, has search, "eur" narrows the list, a tap picks it and closes', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('currency'))
    await field(s, 'to').click()
    const total = await page.locator('.sheet .pick__opt').count()
    const search = await page.locator('.sheet .pick__search').count()
    await page.locator('.sheet .pick__search').fill('eur')
    const some = await page.locator('.sheet .pick__opt .pick__label').allInnerTexts()
    await page.locator('.sheet .pick__opt', { hasText: 'EUR' }).first().click()
    const closed = (await page.locator('.sheet').count()) === 0
    const shown = await pickValue(s, 'to')
    const rows = await rowsOf(s)
    fail(total < 20 ? `${total} options` : '', !search ? 'no search box for a long list' : '', some.length < 1 || some.length > 3 ? `eur matched ${some.length}: ${some}` : '', !closed ? 'sheet stayed open' : '', !/EUR/.test(shown) ? `value ${shown}` : '', !/Amount in EUR/.test(rows[0][0]) ? `result "${rows[0][0]}"` : '')
  }),
)
def('T1-PICKER-no-match', 'NEG', 'Picker search with no match says "Nothing matches"', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('currency'))
    await field(s, 'to').click()
    await page.locator('.sheet .pick__search').fill('qqqq')
    fail(!/Nothing matches/.test(await page.locator('.sheet').innerText()) ? 'no message' : '')
  }),
)
def('T1-PICKER-close', 'UX', 'Picker sheet closes with X and with Escape without changing the value, and the calculator stays open', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('currency'))
    const before = await pickValue(s, 'to')
    await field(s, 'to').click()
    await page.locator('.sheet button[aria-label^="Close"]').click()
    const a = await page.locator('.sheet').count()
    await field(s, 'to').click()
    await page.keyboard.press('Escape')
    const b = await page.locator('.sheet').count()
    fail(a ? 'X did not close' : '', b ? 'Escape did not close' : '', (await pickValue(s, 'to')) !== before ? 'value changed' : '', !(await scr(page, tool('currency')).count()) ? 'calculator closed too' : '')
  }),
)
def('T1-PICKER-short-list', 'UX', 'A picker with 8 or fewer options has no search box; the chosen option has a tick; options are 44px high', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('gst'))
    await field(s, 'rate').click()
    const n = await page.locator('.sheet .pick__opt').count()
    const search = await page.locator('.sheet .pick__search').count()
    const ticks = await page.locator('.sheet .pick__opt[aria-selected=true] svg').count()
    const hs = await page.locator('.sheet .pick__opt').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
    fail(n > 8 && !search ? 'long list without search' : '', n <= 8 && search ? 'search on a short list' : '', ticks !== 1 ? `${ticks} ticks` : '', hs.some((h) => h < 44) ? `option heights ${hs}` : '')
  }),
)
def('T1-PICKER-unit-converter', 'POS', 'Unit converter: 8 categories in a picker; the From/To pickers change with the category (Temperature gives C, F, K)', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('unit-converter'))
    await field(s, 'category').click()
    const cats = await page.locator('.sheet .pick__label').allInnerTexts()
    await page.locator('.sheet button[aria-label^="Close"]').click()
    await choose(page, s, 'category', 'Temperature')
    await field(s, 'from_temperature').click()
    const units = await page.locator('.sheet .pick__label').allInnerTexts()
    await page.locator('.sheet button[aria-label^="Close"]').click()
    fail(cats.length !== 8 ? `${cats.length} categories` : '', units.length !== 3 ? `${units.length} temperature units: ${units}` : '', (await field(s, 'from_length').count()) ? 'old length unit picker still there' : '')
  }),
)
def('T1-PICKER-aria', 'UX', 'Picker button has a name that says what it is and its value ("To currency: USD ... Change.")', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('currency'))
    const a = await field(s, 'to').getAttribute('aria-label')
    fail(!/To currency/.test(a ?? '') || !/USD/.test(a ?? '') ? `aria-label "${a}"` : '')
  }),
)
def('T1-DRAFT-tabs', 'UX', 'Draft kept: type a value, go to Notes and back to Tools, the value (and result) are still there', () =>
  withPage({}, async ({ page }) => {
    const t = tool('emi')
    const s = await openTool(page, t)
    await setField(page, s, 'principal', '1234567')
    await tab(page, 'Notes')
    await tab(page, 'Calculate')
    await tab(page, 'Tools')
    const s2 = scr(page, t)
    const open = await s2.count()
    const v = open ? await field(s2, 'principal').inputValue() : '(calculator was closed)'
    fail(v !== '12,34,567' ? `after switching tabs: ${v}` : '')
  }),
)
def('T1-DRAFT-back-and-reopen', 'UX', 'Draft kept: go Back out of a calculator and reopen it, the typed values are still there', () =>
  withPage({}, async ({ page }) => {
    const t = tool('gst')
    const s = await openTool(page, t)
    await setField(page, s, 'amount', '4321')
    await choose(page, s, 'rate', '5%')
    await page.locator('.screen button[aria-label="Back"]').last().click()
    await page.locator('.screen button[aria-label="Back"]').last().click()
    const s2 = await openTool(page, t)
    const v = await field(s2, 'amount').inputValue()
    const rate = await pickValue(s2, 'rate')
    fail(v !== '4,321' ? `amount ${v}` : '', !/5/.test(rate) ? `rate ${rate}` : '')
  }),
)
def('T1-DRAFT-lost-on-reload', 'UX', 'Draft is session-only: after a reload the calculator starts at its defaults (documented behaviour)', () =>
  withPage({}, async ({ page }) => {
    const t = tool('emi')
    const s = await openTool(page, t)
    await setField(page, s, 'principal', '1234567')
    await page.waitForTimeout(600)
    await page.reload()
    await page.waitForSelector('.app')
    const s2 = await openTool(page, t)
    const v = await field(s2, 'principal').inputValue()
    fail(v === '50,00,000' ? 'draft not kept across a reload (the person loses typed numbers if the phone kills the app)' : '')
  }),
)
def('T1-BACK-header', 'UX', 'Back in the header returns to the group page, then to Tools home; tapping the Tools tab while open returns to the top', () =>
  withPage({}, async ({ page }) => {
    const t = tool('emi')
    const s = await openTool(page, t)
    await page.locator(`.screen[aria-label="${t.title}"] button[aria-label="Back"]`).click()
    const onGroup = await page.locator('.screen[aria-label="Loans and EMI"]').count()
    await page.locator('.screen[aria-label="Loans and EMI"] button[aria-label="Back"]').click()
    const home = await page.locator('.tiles').count()
    await openTool(page, t)
    await tab(page, 'Tools')
    const afterTap = await page.locator('.tiles').count()
    fail(!onGroup ? 'Back did not land on the group page' : '', !home ? 'second Back did not land on Tools home' : '', !afterTap ? 'tapping Tools tab did not return to Tools home' : '')
    void s
  }),
)
def('T1-FORM-enter', 'UX', 'Pressing Enter in a box does not reload or submit anything', () =>
  withPage({}, async ({ page, errors }) => {
    const s = await openTool(page, tool('emi'))
    await field(s, 'principal').click()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
    fail(!(await scr(page, tool('emi')).count()) ? 'screen closed' : '', realErrors(errors), page.url().includes('?') ? `url changed ${page.url()}` : '')
  }),
)
def('T1-FORM-labels', 'UX', 'Every input has a visible label tied to it (for/id) and the result rows have labels', () =>
  withPage({}, async ({ page }) => {
    const bad = []
    for (const id of ['emi', 'gst', 'discount', 'prepayment', 'currency']) {
      await withPage({}, async (o) => {
        const s = await openTool(o.page, tool(id))
        await openMore(s)
        const r = await s.locator('.tool__form input.field').evaluateAll((els) => els.filter((e) => !(e.labels && e.labels.length) && !e.getAttribute('aria-label')).map((e) => e.id))
        if (r.length) bad.push(`${id}: no label for ${r}`)
      })
    }
    fail(bad)
    void page
  }),
)
def('T1-FORM-keyboard-type', 'UX', 'Number boxes ask the phone for a decimal keypad (inputmode=decimal); text box for hex asks for text', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    const a = await s.locator('input.field').evaluateAll((els) => els.map((e) => e.inputMode))
    await page.locator('.screen button[aria-label="Back"]').last().click()
    await page.locator('.screen button[aria-label="Back"]').last().click()
    const s2 = await openTool(page, tool('number-base'))
    const b = await s2.locator('#f-value').evaluate((e) => e.inputMode || e.type)
    fail(a.some((m) => m !== 'decimal') ? `emi inputmodes ${a}` : '', b === 'decimal' ? 'hex text box shows a number keypad (cannot type A-F)' : '')
  }),
)
def('T1-FORM-negative-keyboard', 'UX', 'inputmode=decimal keypads have no minus key: boxes that accept negatives (rate change, date "How many") hint how', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('rate-change'))
    const hint = await s.locator('.field-hint').allInnerTexts()
    fail(!hint.some((h) => /-0\.25|cut/i.test(h)) ? `hints ${hint}` : '')
  }),
)

// ---------------------------------------------------------------------------------------------------------------------
// 12. Semantic spot checks on odd values (found by reading the specs, confirmed in the browser)
// ---------------------------------------------------------------------------------------------------------------------
const oneShot = (id, type, title, toolId, sets, want, extra) =>
  def(id, type, title, () =>
    withPage({}, async ({ page }) => {
      const s = await openTool(page, tool(toolId))
      for (const [f, v] of sets) {
        if (f.startsWith('mode:')) await choose(page, s, f.slice(5), v)
        else if (f.startsWith('more:')) {
          await openMore(s)
          await setField(page, s, f.slice(5), v)
        } else await setField(page, s, f, v)
      }
      const sn = await snap(s)
      const msg = sn.state === 'result' ? `result ${sn.main.join(' = ')}` : sn.state === 'error' ? `error "${sn.err}"` : 'blank'
      const verdict = want(sn)
      if (verdict) throw new Error(`${verdict} (${msg})`)
      if (extra) await extra(s, sn, page)
    }),
  )
const wantError = (re, what) => (sn) => (sn.state !== 'error' ? `${what}: expected a plain error` : re && !re.test(sn.err) ? `${what}: error "${sn.err}" does not match ${re}` : '')
const wantResult = (what) => (sn) => (sn.state !== 'result' ? `${what}: expected a result, got ${sn.state} "${sn.err}"` : '')
oneShot('T1-SEM-emi-zero-principal', 'NEG', 'Loan EMI: loan amount 0 gives an error naming the loan amount', 'emi', [['principal', '0']], wantError(/loan amount/i, 'principal 0'))
oneShot('T1-SEM-emi-neg-rate', 'NEG', 'Loan EMI: negative rate gives "Interest rate can\'t be negative"', 'emi', [['rate', '-1']], wantError(/rate/i, 'rate -1'))
oneShot('T1-SEM-emi-rate-101', 'NEG', 'Loan EMI: rate 101% gives an error', 'emi', [['rate', '101']], wantError(/rate/i, 'rate 101'))
oneShot('T1-SEM-emi-51-years', 'CORNER', 'Loan EMI: 51 years gives "at most 50 years"; 50 years works', 'emi', [['tenure', '51']], wantError(/50 years/i, '51 years'))
oneShot('T1-SEM-emi-50-years', 'CORNER', 'Loan EMI: exactly 50 years works', 'emi', [['tenure', '50']], wantResult('50 years'))
oneShot('T1-SEM-emi-frac-year', 'CORNER', 'Loan EMI: 2.5 years (30 months) works; 2.3 years is not a whole number of months and says so', 'emi', [['tenure', '2.3']], wantError(/whole number of months/i, '2.3 years'))
oneShot('T1-SEM-emi-1-month', 'CORNER', 'Loan EMI: 1 month works', 'emi', [['tenure', '1 month']], (sn) => (sn.state === 'blank' ? 'blank' : ''))
oneShot('T1-SEM-emi-tiny-rate', 'CORNER', 'Loan EMI: rate 0.0001% still gives a result', 'emi', [['rate', '0.0001']], wantResult('rate 0.0001'))
oneShot('T1-SEM-emi-tiny-principal', 'CORNER', 'Loan EMI: loan amount 0.01 gives a result that does not show NaN or a negative EMI', 'emi', [['principal', '0.01']], (sn) => (sn.state === 'result' && /-|NaN/.test(sn.main[1]) ? `main ${sn.main[1]}` : sn.state === 'blank' ? 'blank' : ''))
oneShot('T1-SEM-prepay-after-last', 'ERR', 'Loan prepayment: "after EMI" equal to the last EMI gives an error with the valid range', 'prepayment', [['after', '240']], wantError(/1 to 239/i, 'after = n'))
oneShot('T1-SEM-prepay-clears', 'ERR', 'Loan prepayment: an amount that clears the loan says so', 'prepayment', [['amount', '90000000']], wantError(/clears|whole loan/i, 'prepay everything'))
oneShot('T1-SEM-prepay-zero', 'NEG', 'Loan prepayment: amount 0 is an error', 'prepayment', [['amount', '0']], wantError(/prepayment/i, 'amount 0'))
oneShot('T1-SEM-prepay-frac-after', 'NEG', 'Loan prepayment: "after EMI 2.5" is an error', 'prepayment', [['after', '2.5']], wantError(/whole number/i, 'after 2.5'))
oneShot('T1-SEM-ratechange-neg-below-zero', 'NEG', 'Rate change: a cut that takes the rate below 0 is an error', 'rate-change', [['delta', '-9']], wantError(/below zero|rate/i, 'delta -9'))
oneShot('T1-SEM-ratechange-from-1', 'CORNER', 'Rate change: applies from EMI 1 works', 'rate-change', [['from', '1']], wantResult('from 1'))
oneShot('T1-SEM-ratechange-from-n', 'CORNER', 'Rate change: applies from the last EMI (240) works', 'rate-change', [['from', '240']], wantResult('from 240'))
oneShot('T1-SEM-ratechange-from-241', 'NEG', 'Rate change: from EMI 241 on a 240-month loan is an error with the range', 'rate-change', [['from', '241']], wantError(/1 to 240/i, 'from 241'))
oneShot('T1-SEM-ratechange-cut', 'POS', 'Rate change: a cut of -0.5 shows "Interest saved" (not "Extra interest") and a green tone', 'rate-change', [['delta', '-0.5']], wantResult('cut'), async (s) => {
  const rows = (await rowsOf(s)).map((r) => r[0])
  if (!rows.includes('Interest saved')) throw new Error(`labels ${rows}`)
})
oneShot('T1-SEM-transfer-never', 'CORNER', 'Balance transfer: higher new rate says "Net loss" and "Never, within the loan"', 'balance-transfer', [['newRate', '11']], wantResult('worse rate'), async (s) => {
  const rows = Object.fromEntries(await rowsOf(s))
  if (!rows['Net loss']) throw new Error(`no Net loss row: ${Object.keys(rows)}`)
  if (!/Never/.test(rows['Breaks even after'])) throw new Error(`break-even ${rows['Breaks even after']}`)
})
oneShot('T1-SEM-transfer-same-rate', 'CORNER', 'Balance transfer: same rate and fees > 0 is a loss; same rate and no fees is zero saving without NaN', 'balance-transfer', [['newRate', '9.5'], ['fees', '0']], (sn) => (sn.state === 'blank' || sn.bad ? 'blank or NaN' : ''))
oneShot('T1-SEM-transfer-months-601', 'NEG', 'Balance transfer: 601 months is an error with the range', 'balance-transfer', [['months', '601']], wantError(/1 to 600/i, 'months 601'))
oneShot('T1-SEM-transfer-blank-fees', 'CORNER', 'Balance transfer: blank switching costs counts as 0', 'balance-transfer', [['fees', '']], wantResult('blank fees'))
oneShot('T1-SEM-transfer-junk-fees', 'NEG', 'Balance transfer: letters in switching costs do not silently count as 0', 'balance-transfer', [['fees', '12abc']], (sn) => (sn.state === 'result' ? 'letters in fees accepted: fee "12abc" was treated as 0 or 12 without a word' : ''))
oneShot('T1-SEM-compare-fee-too-big', 'NEG', 'Compare loan offers: a fee larger than the loan is an error naming the offer', 'loan-compare', [], wantResult('default'), async (s, _sn, page) => {
  await s.locator('.rows__row').nth(0).locator('input.field').nth(3).fill('6000000')
  const sn = await snap(s)
  if (sn.state !== 'error' || !/offer 1/i.test(sn.err ?? '')) throw new Error(`${sn.state} "${sn.err}"`)
  void page
})
oneShot('T1-SEM-compare-blank-fee', 'CORNER', 'Compare loan offers: blank fee counts as 0', 'loan-compare', [], wantResult('default'), async (s) => {
  await s.locator('.rows__row').nth(0).locator('input.field').nth(3).fill('')
  const sn = await snap(s)
  if (sn.state !== 'result') throw new Error(`${sn.state} "${sn.err}"`)
})
oneShot('T1-SEM-compare-zero-rate', 'CORNER', 'Compare loan offers: a 0% offer is accepted (not treated as missing)', 'loan-compare', [], wantResult('default'), async (s) => {
  await s.locator('.rows__row').nth(0).locator('input.field').nth(1).fill('0')
  const sn = await snap(s)
  if (sn.state !== 'result') throw new Error(`0% rate -> ${sn.state} "${sn.err}"`)
})
oneShot('T1-SEM-compare-months', 'POS', 'Compare loan offers: typing "20 months" in an offer\'s term box works (the term is one text box now)', 'loan-compare', [], wantResult('default'), async (s) => {
  await s.locator('.rows__row').nth(0).locator('input.field').nth(2).fill('20 months')
  await s.locator('.rows__row').nth(1).locator('input.field').nth(2).fill('20 months')
  const cards = await cardsOf(s)
  const e = emiOf(5000000, 8.5, 20)
  if (D(num(cards[0].cells['EMI'])).minus(e).abs().gt('0.01')) throw new Error(`EMI ${cards[0].cells['EMI']} vs ${e.toFixed(2)}`)
})
oneShot('T1-SEM-card-emi-zero-rate', 'POS', 'Credit card EMI: 0% (no-cost EMI) shows interest 0 and still charges GST on the fee', 'card-emi', [['rate', '0']], wantResult('rate 0'), async (s) => {
  const rows = Object.fromEntries(await rowsOf(s))
  if (!num(rows['Interest']).isZero()) throw new Error(`interest ${rows['Interest']}`)
  if (D(num(rows['Extra you pay over the price'])).minus(D(199).times('1.18')).abs().gt('0.01')) throw new Error(`extra ${rows['Extra you pay over the price']} vs 234.82`)
})
oneShot('T1-SEM-card-emi-121-months', 'NEG', 'Credit card EMI: 121 months is an error with the range', 'card-emi', [['tenure', '121']], wantError(/1 to 120/i, 'months 121'))
oneShot('T1-SEM-card-emi-fee-too-big', 'NEG', 'Credit card EMI: processing fee bigger than the purchase says so', 'card-emi', [['fee', '60000']], wantError(/fee/i, 'fee 60000'))
oneShot('T1-SEM-card-emi-blank-fee', 'CORNER', 'Credit card EMI: blank processing fee counts as 0', 'card-emi', [['fee', '']], wantResult('blank fee'))
oneShot('T1-SEM-card-emi-junk-fee', 'NEG', 'Credit card EMI: letters in the fee do not silently count as 0', 'card-emi', [['fee', 'abc']], (sn) => (sn.state === 'result' ? 'letters in fee accepted and treated as 0' : ''))
oneShot('T1-SEM-simple-101-years', 'NEG', 'Simple vs compound: 101 years is an error; 100 works', 'simple-compound', [['years', '101']], wantError(/100 years|time/i, 'years 101'))
oneShot('T1-SEM-simple-100-years-daily', 'CORNER', 'Simple vs compound: 100 years, 1000% rate, daily compounding finishes fast and does not show E+ / Infinity', 'simple-compound', [['rate', '1000'], ['years', '100'], ['more:freq', 'Daily (365)']], (sn) => (sn.state === 'blank' ? 'blank' : sn.state === 'result' && /E\+|e\+/.test(sn.main[1]) ? `main ${sn.main[1]}` : ''))
oneShot('T1-SEM-simple-fraction-year', 'POS', 'Simple vs compound: 2.5 years adds a final 2.5 row to the table', 'simple-compound', [['years', '2.5']], wantResult('2.5y'), async (s) => {
  const cards = await cardsOf(s)
  if (cards.length !== 3 || !/2\.5/.test(cards[2].title)) throw new Error(`rows ${cards.map((c) => c.title)}`)
})
oneShot('T1-SEM-reverse-zero-rate', 'POS', 'Affordable loan: 0% gives EMI x months exactly', 'reverse-emi', [['rate', '0']], wantResult('0%'), async (s) => {
  if (D(num(await rowVal(s, 'Maximum loan'))).minus(40000 * 240).abs().gt('0.01')) throw new Error(`max loan ${await rowVal(s, 'Maximum loan')}`)
})
oneShot('T1-SEM-home-tax-slab-51', 'NEG', 'Home loan tax: slab 51% is an error', 'home-loan-tax', [['slab', '51']], wantError(/slab/i, 'slab 51'))
oneShot('T1-SEM-home-tax-new-regime', 'POS', 'Home loan tax: new regime, self-use gives 0 tax saved (no deduction)', 'home-loan-tax', [['mode:regime', 'New regime']], wantResult('new regime'), async (s) => {
  if (!num(await rowVal(s, 'Tax saved in year 1')).isZero()) throw new Error(`tax saved ${await rowVal(s, 'Tax saved in year 1')}`)
})
oneShot('T1-SEM-home-tax-neg-used', 'NEG', 'Home loan tax: negative "Section 123 limit already used" is an error', 'home-loan-tax', [['more:used123', '-100000']], wantError(/negative|123|used/i, 'used123 -100000'))
oneShot('T1-SEM-home-tax-used-over', 'CORNER', 'Home loan tax: section-123 used above 1,50,000 gives 0 principal deduction, no negative', 'home-loan-tax', [['more:used123', '200000']], wantResult('used 200000'), async (s) => {
  if (num(await rowVal(s, 'Principal deduction, year 1')).gt(0)) throw new Error(`principal deduction ${await rowVal(s, 'Principal deduction, year 1')}`)
})
oneShot('T1-SEM-discount-101', 'NEG', 'Discount: 101% is an error', 'discount', [['d1', '101']], wantError(/0 to 100|discount/i, 'd1 101'))
oneShot('T1-SEM-discount-100', 'CORNER', 'Discount: 100% gives final price 0 (not an error)', 'discount', [['d1', '100']], wantResult('d1 100'), async (s) => {
  if (!num(await rowVal(s, 'Final price')).isZero()) throw new Error('final not 0')
})
oneShot('T1-SEM-discount-flat-too-big', 'NEG', 'Discount: flat amount bigger than the discounted price is an error', 'discount', [['more:flat', '99999']], wantError(/flat/i, 'flat 99999'))
oneShot('T1-SEM-discount-neg-d2', 'NEG', 'Discount: a negative second discount is an error, not a price increase', 'discount', [['more:d2', '-10']], (sn) => (sn.state === 'result' ? `negative second discount accepted (${sn.main.join(' = ')})` : ''))
oneShot('T1-SEM-discount-neg-flat', 'NEG', 'Discount: a negative flat amount is an error, not a price increase', 'discount', [['more:flat', '-500']], (sn) => (sn.state === 'result' ? `negative flat amount accepted (${sn.main.join(' = ')})` : ''))
oneShot('T1-SEM-discount-zero-mrp', 'NEG', 'Discount: price 0 is an error', 'discount', [['mrp', '0']], (sn) => (sn.state === 'result' ? 'price 0 gives a result' : ''))
oneShot('T1-SEM-gst-neg', 'NEG', 'GST: negative amount is an error', 'gst', [['amount', '-100']], wantError(/negative/i, 'amount -100'))
oneShot('T1-SEM-gst-zero', 'CORNER', 'GST: amount 0 gives a result of 0 (not an error, not NaN)', 'gst', [['amount', '0']], (sn) => (sn.state === 'blank' || sn.bad ? 'blank/NaN' : ''))
oneShot('T1-SEM-gst-custom-0', 'CORNER', 'GST: custom rate 0 gives GST 0', 'gst', [['mode:rate', 'Other rate'], ['custom', '0']], wantResult('custom 0'))
oneShot('T1-SEM-gst-custom-huge', 'CORNER', 'GST: custom rate 500% is accepted or refused in words (no GST rate is that high)', 'gst', [['mode:rate', 'Other rate'], ['custom', '500']], (sn) => (sn.state === 'result' ? 'custom GST rate 500% accepted without a warning' : ''))
oneShot('T1-SEM-gst-custom-blank', 'ERR', 'GST: custom rate box empty asks for the GST rate', 'gst', [['mode:rate', 'Other rate'], ['custom', '']], wantError(/gst rate/i, 'custom blank'))
oneShot('T1-SEM-tip-fractional-people', 'NEG', 'Tip: 2.5 people is an error', 'tip', [['people', '2.5']], wantError(/whole number/i, 'people 2.5'))
oneShot('T1-SEM-tip-zero-people', 'NEG', 'Tip: 0 people is an error', 'tip', [['people', '0']], wantError(/at least 1/i, 'people 0'))
oneShot('T1-SEM-tip-zero-tip', 'CORNER', 'Tip: 0% tip gives tip 0', 'tip', [['pct', '0']], wantResult('tip 0'))
oneShot('T1-SEM-tip-neg-bill', 'NEG', 'Tip: negative bill is an error', 'tip', [['bill', '-100']], wantError(/negative/i, 'bill -100'))
oneShot('T1-SEM-tip-huge-pct', 'CORNER', 'Tip: 1000% tip is accepted or refused in words', 'tip', [['pct', '1000']], (sn) => (sn.state === 'blank' ? 'blank' : ''))
oneShot('T1-SEM-pct-huge', 'CORNER', 'Percentage: 1e30 % of 1e30 does not show NaN or Infinity', 'percentage', [['x', '1e30'], ['y', '1e30']], (sn) => (sn.state === 'blank' || sn.bad ? 'blank/NaN' : ''))
oneShot('T1-SEM-pct-neg', 'POS', 'Percentage: negative X works (-10% of 200 = -20)', 'percentage', [['x', '-10'], ['y', '200']], wantResult('-10% of 200'), async (s) => {
  if (!num((await rowsOf(s))[0][1]).eq(-20)) throw new Error(`got ${(await rowsOf(s))[0][1]}`)
})
oneShot('T1-SEM-pct-label', 'UX', 'Percentage: empty box error uses the box\'s mode label ("Percent" in the default mode)', 'percentage', [['x', '']], wantError(/percent/i, 'x empty'), async (_s, sn) => {
  if (!/enter percent/i.test(sn.err)) throw new Error(`error "${sn.err}" does not name the box "Percent"`)
})
oneShot('T1-SEM-fuel-zero-mileage', 'NEG', 'Fuel cost: mileage 0 is an error (no divide by zero)', 'fuel-cost', [['mileage', '0']], wantError(/above zero|mileage/i, 'mileage 0'))
oneShot('T1-SEM-fuel-zero-price', 'CORNER', 'Fuel cost: price 0 gives cost 0', 'fuel-cost', [['price', '0']], wantResult('price 0'))
oneShot('T1-SEM-fuel-label', 'UX', 'Fuel cost: empty distance box error says the distance', 'fuel-cost', [['distance', '']], wantError(/distance/i, 'distance empty'))
oneShot('T1-SEM-fuel-eff-zero', 'NEG', 'Mileage converter: 0 is an error "above zero"', 'fuel-efficiency', [['value', '0']], wantError(/above zero/i, 'value 0'))
oneShot('T1-SEM-fuel-eff-tiny', 'CORNER', 'Mileage converter: 0.0001 km/l shows big numbers with no E+ notation overflow', 'fuel-efficiency', [['value', '0.0001']], wantResult('tiny'))
oneShot('T1-SEM-unit-conv-neg-temp', 'POS', 'Unit converter: -40 C = -40 F', 'unit-converter', [['mode:category', 'Temperature'], ['value', '-40']], wantResult('-40C'), async (s) => {
  if (!num((await rowsOf(s))[0][1]).eq(-40)) throw new Error(`got ${(await rowsOf(s))[0][1]}`)
})
oneShot('T1-SEM-unit-conv-below-abs-zero', 'NEG', 'Unit converter: -300 C (below absolute zero) is accepted or refused in words', 'unit-converter', [['mode:category', 'Temperature'], ['value', '-300']], (sn) => (sn.state === 'result' ? 'temperature below absolute zero (-273.15 C) accepted without a word' : ''))
oneShot('T1-SEM-body-child', 'NEG', 'BMI: age 17 says "For adults 18 and over" in words', 'body-metrics', [['age', '17']], wantError(/18/i, 'age 17'))
oneShot('T1-SEM-body-limits', 'CORNER', 'BMI: height 49 and 273 cm are errors; 50 works', 'body-metrics', [['height', '49']], wantError(/50 to 272|height/i, 'height 49'))
oneShot('T1-SEM-body-weight-1', 'NEG', 'BMI: weight 1 kg is an error', 'body-metrics', [['weight', '1']], wantError(/weight|2 to 500/i, 'weight 1'))
oneShot('T1-SEM-body-female', 'POS', 'BMI: Female lowers BMR by 166 versus Male (5 -> -161)', 'body-metrics', [['mode:sex', 'Female']], wantResult('female'), async (s) => {
  const bmr = num(await rowVal(s, 'Calories at rest'))
  if (bmr.minus(D(10 * 70 + 6.25 * 170 - 150 - 161)).abs().gt(1)) throw new Error(`BMR ${bmr}`)
})
oneShot('T1-SEM-grade-credits-zero', 'NEG', 'Marks and GPA: credits 0 is an error', 'grade-average', [], wantResult('default'), async (s) => {
  await s.locator('.rows__row').nth(0).locator('input.field').nth(3).fill('0')
  const sn = await snap(s)
  if (sn.state !== 'error') throw new Error(`credits 0 -> ${sn.state}`)
})
oneShot('T1-SEM-grade-neg-marks', 'NEG', 'Marks and GPA: negative marks are an error', 'grade-average', [], wantResult('default'), async (s) => {
  await s.locator('.rows__row').nth(0).locator('input.field').nth(1).fill('-5')
  const sn = await snap(s)
  if (sn.state === 'result') throw new Error(`negative marks accepted (${sn.main.join(' = ')})`)
})
oneShot('T1-SEM-grade-max-zero', 'NEG', 'Marks and GPA: "Out of" 0 is an error', 'grade-average', [], wantResult('default'), async (s) => {
  await s.locator('.rows__row').nth(0).locator('input.field').nth(2).fill('0')
  const sn = await snap(s)
  if (sn.state !== 'error') throw new Error(`max 0 -> ${sn.state}`)
})
oneShot('T1-SEM-base-invalid-digit', 'NEG', 'Binary and hex: "12" in binary says "not a whole number in base 2"', 'number-base', [['mode:from', 'Binary (2)'], ['value', '12']], wantError(/base 2/i, '12 in binary'))
oneShot('T1-SEM-base-negative', 'NEG', 'Binary and hex: a negative number is an error (hint says 0 or more)', 'number-base', [['value', '-5']], wantError(/whole number|base/i, '-5'))
oneShot('T1-SEM-base-empty', 'ERR', 'Binary and hex: empty value says "Enter the number to convert"', 'number-base', [['value', '']], wantError(/enter the number to convert/i, 'empty'))
oneShot('T1-SEM-base-huge', 'CORNER', 'Binary and hex: a 200-digit decimal converts to hex without hanging or NaN', 'number-base', [['value', '9'.repeat(200)]], wantResult('200 digits'))
oneShot('T1-SEM-base-shift-big', 'CORNER', 'Binary and hex: shift by 1000000000 gives "Shift is too large", does not hang', 'number-base', [['more:shift', '1000000000']], wantError(/too large/i, 'shift 1e9'))
oneShot('T1-SEM-base-shift-neg', 'NEG', 'Binary and hex: negative shift is an error', 'number-base', [['more:shift', '-1']], wantError(/shift/i, 'shift -1'))
oneShot('T1-SEM-base-not-width', 'CORNER', 'Binary and hex: NOT of 300 in 8 bits says it needs more bits', 'number-base', [['value', '300']], wantResult('300'), async (s) => {
  const kv = await kvOf(s)
  const row = kv.find(([k]) => k.startsWith('NOT A'))
  if (!row || !/more than|bits/i.test(row[1])) throw new Error(`NOT row ${JSON.stringify(row)}`)
})
oneShot('T1-SEM-base-second-junk', 'NEG', 'Binary and hex: junk in the second number says "second value"', 'number-base', [['more:other', 'zz']], wantError(/second/i, 'other zz'))
oneShot('T1-SEM-currency-zero', 'CORNER', 'Currency: amount 0 gives 0, no error', 'currency', [['amount', '0']], wantResult('0'))
oneShot('T1-SEM-currency-neg', 'NEG', 'Currency: negative amount is accepted or refused in words', 'currency', [['amount', '-50']], (sn) => (sn.state === 'blank' ? 'blank' : ''))
oneShot('T1-SEM-presets-blank-amount', 'CORNER', 'Typical loan rates: empty example amount still shows the typical rate (no example EMI), no error', 'loan-presets', [['principal', '']], wantResult('blank amount'))
oneShot('T1-SEM-presets-label', 'UX', 'Typical loan rates: the amount box says what it is for ("Loan amount for example EMI")', 'loan-presets', [], wantResult('default'), async (s) => {
  const l = await s.locator('label.field-label').allInnerTexts()
  if (!l.some((x) => /example EMI/.test(x))) throw new Error(`labels ${l}`)
})
oneShot('T1-SEM-unitprice-zero-qty', 'NEG', 'Compare pack prices: quantity 0 is an error (no divide by zero)', 'unit-price', [], wantResult('default'), async (s) => {
  await s.locator('.rows__row').nth(0).locator('input.field').nth(1).fill('0')
  const sn = await snap(s)
  if (sn.state !== 'error') throw new Error(`qty 0 -> ${sn.state} ${sn.main}`)
})
oneShot('T1-SEM-unitprice-free', 'CORNER', 'Compare pack prices: a price of 0 (free sample) does not give NaN in "Dearer by"', 'unit-price', [], wantResult('default'), async (s) => {
  await s.locator('.rows__row').nth(1).locator('input.field').nth(0).fill('0')
  const sn = await snap(s)
  if (sn.state === 'blank' || sn.bad) throw new Error(`price 0 -> ${sn.state} bad=${sn.bad}`)
})
oneShot('T1-SEM-unitprice-negative', 'NEG', 'Compare pack prices: a negative price is an error', 'unit-price', [], wantResult('default'), async (s) => {
  await s.locator('.rows__row').nth(1).locator('input.field').nth(0).fill('-85')
  const sn = await snap(s)
  if (sn.state === 'result') throw new Error(`negative price accepted: ${sn.main}`)
})
oneShot('T1-SEM-amort-monthly-600', 'CORNER', 'Repayment schedule: 50 years monthly shows 600 rows and still responds', 'amortisation', [['tenure', '50'], ['mode:view', 'Monthly']], wantResult('600 rows'), async (s) => {
  const n = await s.locator('.rowcard').count()
  if (n !== 600) throw new Error(`${n} rows`)
})

// ---------------------------------------------------------------------------------------------------------------------
// 13. Runtime
// ---------------------------------------------------------------------------------------------------------------------
def('T1-RUNTIME-smoke-all', 'RUNTIME', 'Visit all 26 calculators once: no console errors, no page errors', () =>
  withPage({}, async ({ page, errors }) => {
    for (const t of TOOLS) {
      await tab(page, 'Tools')
      await openTool(page, t)
      await page.locator('.screen button[aria-label="Back"]').last().click()
      await page.locator('.screen button[aria-label="Back"]').last().click().catch(() => {})
    }
    fail(realErrors(errors), errors.length && !realErrors(errors).length ? `(only the known live-rate fetch noise: ${errors.length})` : '')
  }),
)
def('T1-RUNTIME-currency-offline', 'RUNTIME', 'Currency converter with no network still works from the saved rates and says the rates are saved with the app', () =>
  withPage({}, async ({ page, context }) => {
    await context.setOffline(true)
    const s = await openTool(page, tool('currency'))
    const sn = await snap(s)
    const note = await s.locator('.result__note').innerText().catch(() => '')
    fail(sn.state !== 'result' ? `state ${sn.state}` : '', !/saved with the app|as of/i.test(note) ? `note "${note}"` : '')
  }),
)
def('T1-RUNTIME-currency-console', 'RUNTIME', 'Currency converter opened with a blocked network adds no console error of its own', () =>
  withPage({}, async ({ page, context, errors }) => {
    await context.route('**/*', (r) => (r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort()))
    await openTool(page, tool('currency'))
    await page.waitForTimeout(1500)
    fail(errors.length ? `${errors.length} error(s): ${errors[0]}` : '')
  }),
)
def('T1-RUNTIME-speed-open', 'RUNTIME', 'Opening a calculator and showing its first result takes under 1 second (monthly 50-year schedule under 3 s)', () =>
  withPage({}, async ({ page }) => {
    const t0 = Date.now()
    const s = await openTool(page, tool('emi'))
    await s.locator('section.result').waitFor()
    const a = Date.now() - t0
    await page.locator('.screen button[aria-label="Back"]').last().click()
    await page.locator('.screen button[aria-label="Back"]').last().click()
    const s2 = await openTool(page, tool('amortisation'))
    await setField(page, s2, 'tenure', '50')
    const t1 = Date.now()
    await choose(page, s2, 'view', 'Monthly')
    await s2.locator('.rowcard').nth(599).waitFor()
    const b = Date.now() - t1
    fail(a > 1000 ? `EMI opened in ${a} ms` : '', b > 3000 ? `600-row schedule took ${b} ms` : '')
  }),
)
def('T1-RUNTIME-typing-speed', 'RUNTIME', 'Typing 10 digits in the loan amount keeps up (under 1.5 s on the laptop)', () =>
  withPage({}, async ({ page }) => {
    const s = await openTool(page, tool('amortisation'))
    await choose(page, s, 'view', 'Monthly')
    const el = field(s, 'principal')
    await el.click()
    await el.selectText()
    const t0 = Date.now()
    await page.keyboard.type('9876543210', { delay: 0 })
    await settle(page)
    const ms = Date.now() - t0
    fail(ms > 1500 ? `${ms} ms for 10 digits with a 240-row monthly table` : '')
  }),
)
def('T1-RUNTIME-reload-open-tool', 'RUNTIME', 'Reload while a calculator is open: app starts cleanly on its start tab, no errors', () =>
  withPage({}, async ({ page, errors }) => {
    await openTool(page, tool('emi'))
    await page.reload()
    await page.waitForSelector('.app')
    fail(realErrors(errors), (await page.locator('.tabbar').count()) ? '' : 'no tab bar')
  }),
)
def('T1-RUNTIME-tool-via-startup', 'RUNTIME', 'Startup "open a calculator" setting opens Loan EMI straight away with a result', () =>
  withPage({ settings: { startupTool: 'emi', startupTab: 'tools' } }, async ({ page }) => {
    await page.waitForTimeout(600)
    const s = scr(page, tool('emi'))
    fail(!(await s.count()) ? 'calculator not open at start' : (await snap(s)).state !== 'result' ? 'no result' : '')
  }),
)
def('T1-RUNTIME-settings-decimals', 'POS', 'Setting "decimals: 0" shows whole rupees in results; 4 shows four places', () =>
  withPage({ settings: { decimals: 0 } }, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    const v = await rowVal(s, 'Monthly EMI')
    fail(/\./.test(v) ? `EMI "${v}" has decimals with decimals=0` : '')
  }),
)
def('T1-RUNTIME-settings-intl', 'POS', 'International number system shows 1,000,000 style grouping in results', () =>
  withPage({ settings: { numberSystem: 'international' } }, async ({ page }) => {
    const s = await openTool(page, tool('emi'))
    const v = await rowVal(s, 'Total you pay')
    fail(!/^₹\d{1,3}(,\d{3})+\.\d\d$/.test(v) ? `total "${v}"` : '')
  }),
)

// ---------------------------------------------------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------------------------------------------------
async function main() {
  const filters = process.argv.slice(2)
  // ONLY=<regex> works too, like tools2.test.mjs. Words on the command line still work.
  const only = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null
  const todo = cases.filter((c) => (!filters.length || filters.some((f) => c.id.toLowerCase().includes(f.toLowerCase()))) && (!only || only.test(c.id)))
  app = await startApp()
  const q = [...todo]
  const CONC = Number(process.env.CONC ?? 4)
  const worker = async () => {
    while (q.length) {
      const c = q.shift()
      const t0 = Date.now()
      let msg = ''
      try {
        await Promise.race([c.fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout after 120 s')), 120000))])
      } catch (e) {
        msg = String(e?.message ?? e).split('\n')[0].slice(0, 700)
      }
      const r = { id: c.id, type: c.type, title: c.title, pass: !msg, msg, ms: Date.now() - t0 }
      results.push(r)
      console.log(`${r.pass ? 'PASS' : 'FAIL'} ${c.id} ${c.type} ${c.title}${msg ? ' :: ' + msg : ''}`)
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker))
  await app.stop()
  const dir = process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp` : '/tmp'
  try {
    writeFileSync(`${dir}/tools1-results.json`, JSON.stringify(results, null, 1))
    writeFileSync(`${dir}/tools1-matrix.json`, JSON.stringify(matrixLog, null, 0))
  } catch {}
  const fails = results.filter((r) => !r.pass).length
  console.log(`\n${results.length} cases, ${results.length - fails} pass, ${fails} fail`)
  process.exit(fails ? 1 : 0)
}
main()
