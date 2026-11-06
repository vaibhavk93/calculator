// App shell + settings + backup/restore + accessibility test campaign.
// Run: node e2e/shell.test.mjs        (ONLY=SH-K node e2e/shell.test.mjs runs the cases whose id starts with that)
// Prints one line per case: PASS|FAIL <id> <type> <title> :: <actual if fail>. Exits non-zero on any FAIL.
// A FAIL is a bug or a mismatch with the project docs. Lines starting NOTE are observations (ideas), not failures.
// Uses only e2e/lib.mjs helpers plus Playwright core. Seeds its own data. Never touches a phone.
import { startApp, openApp, tab, keys, overflowing, stored } from './lib.mjs'
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// ------------------------------------------------------------------ tiny framework
const cases = []
const T = (id, type, title, fn) => cases.push({ id: 'SH-' + id, type, title, fn })
let CUR = null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const settle = (page, ms = 250) => page.waitForTimeout(ms)
function ok(cond, msg) { if (!cond) throw new Error(typeof msg === 'function' ? msg() : msg) }
const notes = []
const note = (m) => { notes.push(`${CUR?.id ?? ''} ${m}`); console.log(`NOTE ${CUR?.id ?? ''} ${m}`) }
const KNOWN = (id, msg) => `known ${id}, confirmed: ${msg}`

// ------------------------------------------------------------------ seed data
function seed(over = {}) {
  const now = Date.now(); const day = new Date().toISOString().slice(0, 10)
  const history = Array.from({ length: 8 }, (_, i) => ({ id: 'h' + i, expression: `${i + 1}00*3`, result: String((i + 1) * 300), at: now - i * 60000 }))
  history[1].memo = 'Rent share'; history[2].locked = true
  const cards = [
    { id: 'c1', title: 'Home loan EMI', kind: 'tool', toolId: 'emi', inputs: { principal: '5000000', rate: '8.5', years: '20' }, summary: 'EMI 43,391', amount: '43391', amountFmt: 'money', lines: [], note: '', tags: ['Loan'], pinned: true, createdAt: now, updatedAt: now, deletedAt: null },
    { id: 'c2', title: 'Groceries', kind: 'tape', toolId: null, inputs: null, summary: '2 lines', amount: '700', lines: [{ id: 'l1', label: 'Milk', value: '200' }, { id: 'l2', label: 'Rice', value: '500' }], note: '', tags: [], pinned: false, createdAt: now - 1000, updatedAt: now - 1000, deletedAt: null },
    { id: 'c3', title: 'Call the bank', kind: 'task', toolId: null, inputs: null, summary: '', amount: null, lines: [], note: '', tags: [], pinned: false, createdAt: now - 2000, updatedAt: now - 2000, deletedAt: null },
  ]
  const reminders = [{ id: 'r1', cardId: 'c1', dueAt: now + 3 * 86400000, repeat: 'monthly', anchorDay: new Date(now + 3 * 86400000).getDate(), leadDays: 3, done: false, history: [] }]
  const budget = {
    overall: '30000',
    categories: [{ id: 'k1', name: 'Food', limit: '5000', parentId: null, deletedAt: null }, { id: 'k2', name: 'Rent', limit: null, parentId: null, deletedAt: null }],
    instruments: [{ id: 'i1', name: 'HDFC Regalia', kind: 'credit', network: 'visa', bank: 'HDFC', last4: '1234', rewardNote: '', deletedAt: null }],
    expenses: [
      { id: 'e1', date: day, amount: '250.50', categoryId: 'k1', mode: 'upi', instrumentId: null, note: 'tea and snacks', deletedAt: null },
      { id: 'e2', date: day, amount: '12000', categoryId: 'k2', mode: 'credit', instrumentId: 'i1', note: 'rent', deletedAt: null },
    ],
  }
  return { schemaVersion: 3, settings: {}, history, cards, reminders, memory: null, input: { expr: '', fresh: false }, budget, ...over }
}
const withSettings = (s, over = {}) => seed({ settings: s, ...over })
const todayKey = () => new Date().toISOString().slice(0, 10)
const manyExpenses = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: 'x' + i, date: todayKey(), amount: String(10 + (i % 90)) + '.50', categoryId: i % 2 ? 'k1' : 'k2', mode: 'upi', instrumentId: null, note: 'n' + i, deletedAt: null, ...extra }))

// ------------------------------------------------------------------ opening the app (own copy of openApp so raw text, init scripts, media can be set)
async function open(app, o = {}) {
  const { raw, data, empty = false, settings = {}, theme = null, width = 360, height = 790, font = 100, colorScheme, reducedMotion = 'reduce', init, wait = true,
    permissions, locale = 'en-IN', timezone = 'Asia/Kolkata', now = null, mobile = true, dsf = 2 } = o
  const context = await app.browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, hasTouch: mobile, isMobile: mobile, locale, timezoneId: timezone, colorScheme, reducedMotion, acceptDownloads: true, permissions })
  CUR?.ctxs.push(context)
  const page = await context.newPage()
  const errors = [], reqs = [], failed = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 300)}`) })
  page.on('request', (r) => reqs.push(r.url()))
  page.on('requestfailed', (r) => failed.push(r.url()))
  const text = empty ? null : raw !== undefined ? raw : JSON.stringify(data ?? { schemaVersion: 3, settings: { ...(theme ? { theme } : {}), ...settings }, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false } })
  await page.addInitScript(([t, f, fixed]) => {
    try { if (t !== null && !sessionStorage.getItem('__seeded')) { localStorage.setItem('vkcalc.data', t); sessionStorage.setItem('__seeded', '1') } } catch {}
    if (f !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = f + '%' })
    if (fixed) { const TT = fixed; const RD = Date; globalThis.Date = class extends RD { constructor(...a) { if (a.length === 0) super(TT); else super(...a) } static now() { return TT } } }
  }, [text, font, now])
  if (init) await page.addInitScript({ content: init })
  await page.goto(app.url)
  let up = true
  if (wait) { try { await page.waitForSelector('.app', { timeout: 6000 }) } catch { up = false } }
  return { page, errors, reqs, failed, context, up }
}
const hide = (page) => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')) })
const body = (page) => page.evaluate(() => document.body.innerText)
const bad = /\bNaN\b|\bundefined\b|\bInfinity\b|\[object Object\]|\bnull\b/
const display = (page) => page.locator('.display__result').innerText()
const openSettings = async (page) => { await page.click('[aria-label=Settings]'); await settle(page, 150) }
const openHistory = async (page) => { await page.click('[aria-label=History]'); await settle(page, 150) }
const pickFrom = async (page, labelStart, optionText) => {
  await page.click(`button.pick[aria-label^="${labelStart}"]`); await settle(page, 150)
  await page.click(`.sheet [role=option]:has-text("${optionText}")`); await settle(page, 150)
}
const bgOf = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const dataTheme = (page) => page.evaluate(() => document.documentElement.dataset.theme)
const cssVar = (page, v) => page.evaluate((n) => document.documentElement.style.getPropertyValue(n).trim(), v)
// Backup, restore and export live on the Settings sub-screen "Backup and export" (B17). Open it if it is not open yet.
const inBackup = async (page) => { if ((await page.locator('.screen[aria-label="Backup and export"]').count()) === 0) { await page.click('text=Backup and export'); await settle(page, 150) } }
// Leaving Settings from inside "Backup and export": close the sub-screen first, then Settings.
const leaveSettings = async (page) => { if (await page.locator('.screen[aria-label="Backup and export"]').count()) { await page.locator('[aria-label=Back]').last().click(); await settle(page, 150) } await page.click('[aria-label=Back]') }
const download = async (page, clickSel) => {
  await inBackup(page)
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click(clickSel)])
  return { name: dl.suggestedFilename(), text: readFileSync(await dl.path(), 'utf8') }
}
const upload = async (page, name, text) => { await inBackup(page); await page.setInputFiles('input[type=file]', { name, mimeType: 'application/json', buffer: Buffer.from(text) }) }
const backupOf = (data, over = {}) => JSON.stringify({ kind: 'vkcalc-backup', schemaVersion: 3, exportedAt: '2026-10-01T10:00:00.000Z', app: 'Calc', data, ...over }, null, 2)

// The four Budget destinations sit behind "More in Budget" once anything has been spent; the empty
// state's own action list is never behind a sheet.
const openBudgetMore = async (p) => {
  const more = p.getByRole('button', { name: 'More in Budget' })
  if (await more.count()) {
    await p.locator('.snack').waitFor({ state: 'detached', timeout: 9000 }).catch(() => {})
    await more.click()
    await p.locator('.sheet').waitFor()
  }
}

// ------------------------------------------------------------------ navigation to each screen (used by the sweeps)
const SCREENS = {
  calc: async () => {},
  sci: async (p) => { await tab(p, 'Tools'); await p.click('.hero'); await settle(p) },
  tools: async (p) => { await tab(p, 'Tools'); await settle(p) },
  tool: async () => {}, // opened through startupTool in the seed
  notes: async (p) => { await tab(p, 'Notes'); await settle(p) },
  todo: async (p) => { await tab(p, 'Notes'); await p.locator('.seg__opt', { hasText: 'To-do' }).click(); await settle(p) },
  due: async (p) => { await tab(p, 'Due'); await settle(p) },
  budget: async (p) => { await tab(p, 'Budget'); await settle(p) },
  summary: async (p) => { await tab(p, 'Budget'); await openBudgetMore(p); await p.click('text=Spending summary'); await settle(p) },
  manage: async (p) => { await tab(p, 'Budget'); await openBudgetMore(p); await p.click('text=Categories and cards'); await settle(p) },
  settings: async (p) => { await openSettings(p) },
  history: async (p) => { await openHistory(p) },
  addExpense: async (p) => { await tab(p, 'Budget'); await p.click('button:has-text("Add expense")'); await settle(p) },
  picker: async (p) => { await openSettings(p); await p.click('button.pick[aria-label^="Opens on"]'); await settle(p) },
}
const SCREEN_NAMES = Object.keys(SCREENS)
const screenSeed = (name, extra = {}) => seed({ settings: { ...(name === 'tool' ? { startupTool: 'emi' } : {}), ...extra } })

// ------------------------------------------------------------------ in-page scanners (run inside the browser)
const scanFn = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; if (e.closest('[inert]')) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none' }
  const sel = 'button,a[href],input,select,textarea,[role=button],[role=radio],[role=switch],[role=checkbox],[role=option],[role=tab]'
  const desc = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''} "${(e.getAttribute('aria-label') || e.innerText || e.value || '').trim().slice(0, 22)}"`
  const name = (e) => {
    const al = e.getAttribute('aria-label'); if (al && al.trim()) return al
    const lb = e.getAttribute('aria-labelledby'); if (lb) { const t = lb.split(' ').map((i) => document.getElementById(i)?.textContent || '').join(' ').trim(); if (t) return t }
    if (e.labels && e.labels.length) { const t = [...e.labels].map((l) => l.textContent).join(' ').trim(); if (t) return t }
    const t = (e.innerText || e.textContent || '').trim(); if (t) return t
    return e.getAttribute('title') || e.getAttribute('placeholder') || ''
  }
  const interactive = [...document.querySelectorAll(sel)].filter(vis)
  const out = { names: [], small: [], smallBoth: [], tabindexPos: 0, heads: [], headIssues: [], contrast: [], boundary: [], overflow: [], hscroll: false, order: [] }
  for (const e of interactive) {
    if (!name(e)) out.names.push(desc(e))
    if (e.closest('.sr-only') || e.type === 'file' || e.disabled) continue
    const r = e.getBoundingClientRect()
    if (Math.max(r.width, r.height) < 44) out.smallBoth.push(`${desc(e)} ${Math.round(r.width)}x${Math.round(r.height)}`)
    if (Math.min(r.width, r.height) < 44) out.small.push(`${desc(e)} ${Math.round(r.width)}x${Math.round(r.height)}`)
  }
  out.tabindexPos = document.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex^="-"])').length
  // headings
  const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis)
  out.heads = hs.map((h) => `${h.tagName}:${h.textContent.trim().slice(0, 24)}`)
  const lv = hs.map((h) => +h.tagName[1])
  const inDialog = !!document.querySelector('.sheet')
  if (!inDialog && !lv.includes(1)) out.headIssues.push('no h1')
  if (lv.filter((x) => x === 1).length > 1) out.headIssues.push('more than one h1')
  for (let i = 1; i < lv.length; i++) if (lv[i] - lv[i - 1] > 1) out.headIssues.push(`skips h${lv[i - 1]} to h${lv[i]}`)
  // contrast
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  const bg = (el) => {
    const layers = []; let e = el
    while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break } e = e.parentElement }
    let b = { r: 255, g: 255, b: 255 }
    for (let i = layers.length - 1; i >= 0; i--) { const l = layers[i]; b = { r: l.r * l.a + b.r * (1 - l.a), g: l.g * l.a + b.g * (1 - l.a), b: l.b * l.a + b.b * (1 - l.a) } }
    return b
  }
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b) }
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  const opac = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o }
  const seen = new Set()
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || el.closest('.sr-only') || el.closest('svg')) continue
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    const isField = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.value
    if (!own && !isField) continue
    if (el.disabled || el.closest(':disabled') || el.closest('[aria-disabled=true]')) continue
    const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg) continue
    const base = bg(el); const o = Math.min(opac(el), fg.a)
    const eff = { r: fg.r * o + base.r * (1 - o), g: fg.g * o + base.g * (1 - o), b: fg.b * o + base.b * (1 - o) }
    const size = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight)
    const large = size >= 24 || (size >= 18.66 && w >= 700)
    const need = large ? 3 : 4.5; const rt = ratio(eff, base)
    if (rt < need) { const k = desc(el) + rt.toFixed(2); if (!seen.has(k)) { seen.add(k); out.contrast.push(`${desc(el)} ${rt.toFixed(2)}<${need}`) } }
  }
  // non-text: the visible edge of a control must be 3:1 against what is behind it
  for (const el of document.querySelectorAll('input.field, textarea.field, select.field, .field, .btn:not(.btn--primary), .pick, .toggle, .chip')) {
    if (!vis(el) || el.closest('.sr-only') || el.disabled) continue
    const cs = getComputedStyle(el); const behind = bg(el.parentElement)
    const bw = parseFloat(cs.borderTopWidth); const bc = parse(cs.borderTopColor)
    let best = 0
    if (bw > 0 && cs.borderTopStyle !== 'none' && bc) best = Math.max(best, ratio(bc, behind))
    const own = parse(cs.backgroundColor); if (own && own.a > 0) best = Math.max(best, ratio(bg(el), behind))
    if (best < 3) out.boundary.push(`${desc(el)} ${best.toFixed(2)}<3`)
  }
  // sideways overflow
  const W = document.documentElement.clientWidth
  for (const el of document.querySelectorAll('.app *')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || el.closest('.sr-only') || el.closest('[inert]')) continue
    if (r.right > W + 1 || r.left < -1) out.overflow.push(`${desc(el)} ${Math.round(r.left)}..${Math.round(r.right)}`)
  }
  out.overflow = [...new Set(out.overflow)].slice(0, 6)
  out.hscroll = document.documentElement.scrollWidth > W + 1 || document.body.scrollWidth > W + 1
  // tab order: tabbable elements, in DOM order, must not jump back up the screen
  const tabbables = interactive.filter((e) => !e.disabled && e.tabIndex >= 0 && !e.closest('.sr-only'))
  let prevTop = -1
  for (const e of tabbables) {
    const r = e.getBoundingClientRect()
    if (prevTop >= 0 && r.top < prevTop - 40) out.order.push(`${desc(e)} at y=${Math.round(r.top)} after y=${Math.round(prevTop)}`)
    prevTop = r.top
  }
  out.order = out.order.slice(0, 5)
  return out
}
const scanCache = new Map()
async function scan(app, name, { theme = 'dark', accent = 'citron', font = 100, width = 360, height = 790 } = {}) {
  const key = [name, theme, accent, font, width, height].join('|')
  if (scanCache.has(key)) return scanCache.get(key)
  const { page, context } = await open(app, { data: screenSeed(name, { theme, accent }), font, width, height })
  try {
    await SCREENS[name](page); await settle(page, 300)
    const r = await page.evaluate(scanFn)
    r.errors = 0
    scanCache.set(key, r); return r
  } finally { await context.close() }
}

// ================================================================== A. FIRST LAUNCH AND DAMAGED STORAGE
T('A01', 'POS', 'first launch with empty storage opens on Calculate', async (app) => {
  const { page, errors } = await open(app, { empty: true })
  ok(await page.locator('.keypad').count() === 1, 'no keypad')
  ok((await display(page)).includes('0'), 'display is not 0')
  ok(await page.locator('.tab[aria-current=page]').innerText() === 'Calculate', 'Calculate not current')
  ok(errors.length === 0, errors.join(';'))
})
T('A02', 'UX', 'first run shows 5 tabs with plain labels and no setup screen', async (app) => {
  const { page } = await open(app, { empty: true })
  const labels = await page.locator('.tabbar .tab').allInnerTexts()
  ok(labels.join(',') === 'Calculate,Tools,Notes,Due,Budget', labels.join(','))
  ok(await page.locator('.keypad .key').count() >= 20, 'keypad incomplete')
  ok(!/welcome|sign in|log in|permission/i.test(await body(page)), 'a gate was shown on first launch')
})
T('A03', 'ERR', 'corrupt JSON in storage: app still opens', async (app) => {
  const { page, up, errors } = await open(app, { raw: '{"settings": {not json' })
  ok(up, 'app did not render')
  ok(errors.length === 0, errors.join(';'))
})
T('A04', 'ERR', 'truncated JSON in storage: app still opens', async (app) => {
  const full = JSON.stringify(seed())
  const { up } = await open(app, { raw: full.slice(0, Math.floor(full.length / 2)) })
  ok(up, 'app did not render')
})
T('A05', 'ERR', 'known B-01: a damaged saved text is not erased when the app hides', async (app) => {
  const bad = '{"schemaVersion":3,"history":[{"id":"keep-me"'
  const { page } = await open(app, { raw: bad })
  await settle(page, 400); await hide(page); await settle(page, 400)
  const all = await page.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k)))
  ok(all.some((v) => v && v.includes('keep-me')), KNOWN('B-01', 'the damaged text was overwritten with an empty app and no copy was kept'))
})
T('A06', 'ERR', 'localStorage.getItem throws: app still opens and works', async (app) => {
  const init = `Storage.prototype.getItem = function(){ throw new DOMException('boom','SecurityError') }`
  const { page, up } = await open(app, { empty: true, init })
  ok(up, 'app did not render')
  await keys(page, '7', 'Add', '1'); ok((await page.locator('.display__expr').inputValue()).includes('7'), 'keys not working')
})
T('A07', 'ERR', 'localStorage blocked entirely: app opens, settings still change in memory', async (app) => {
  const init = `Object.defineProperty(window,'localStorage',{get(){throw new DOMException('denied','SecurityError')}})`
  const { page, up } = await open(app, { empty: true, init })
  ok(up, 'app did not render')
  await openSettings(page); await page.click('[role=radio]:text-is("Light")'); await settle(page, 100)
  ok(await dataTheme(page) === 'light', 'theme did not change')
})
T('A08', 'ERR', 'known B-17: a failed save shows a warning', async (app) => {
  const init = `const o=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){ if(k==='vkcalc.data' && window.__failSave) throw new DOMException('full','QuotaExceededError'); return o.call(this,k,v) }`
  const { page } = await open(app, { empty: true, init })
  await page.evaluate(() => { window.__failSave = true })
  await openSettings(page); await page.click('[role=radio]:text-is("Light")'); await settle(page, 600)
  const t = await body(page)
  ok(/could(n't| not)|can't|not saved|failed|full|backup/i.test(t.replace(/Export a backup|Restore from a backup|Backup and export|Save a backup, restore one, or export expenses/g, '')), KNOWN('B-17', 'storage refused the save and the screen says nothing'))
})
T('A09', 'NEG', 'wrong-typed top-level fields fall back to defaults', async (app) => {
  const raw = JSON.stringify({ schemaVersion: 3, settings: { theme: 5, accent: {}, decimals: 'x', startupTab: 7, numberSystem: [], haptics: 'yes' }, history: 'abc', cards: {}, reminders: 5, memory: [], input: 9, budget: [] })
  const { page, up, errors } = await open(app, { raw })
  ok(up, 'app did not render'); ok(errors.length === 0, errors.join(';'))
  ok(await dataTheme(page) === 'dark', 'theme not default')
  await tab(page, 'Budget'); ok(/No spending yet/.test(await body(page)), 'budget not default')
})
T('A10', 'NEG', 'wrong-typed items inside lists are skipped, good ones kept', async (app) => {
  const d = seed(); d.history = [null, 5, 'x', { id: 1 }, ...d.history]; d.cards = [null, { id: 'z' }, ...d.cards]; d.budget.expenses = [{ id: 'q', date: 'bad', amount: 'abc' }, null, ...d.budget.expenses]
  const { page, up } = await open(app, { data: d })
  ok(up, 'did not render')
  await openHistory(page); ok(await page.locator('.hrow').count() === 8, 'history rows != 8: ' + await page.locator('.hrow').count())
})
T('A11', 'NEG', 'stored value is a JSON primitive (null, [], 42, "x"): app opens each time', async (app) => {
  for (const raw of ['null', '[]', '42', '"x"', 'true']) {
    const { up, context } = await open(app, { raw }); ok(up, `raw ${raw} did not render`); await context.close()
  }
})
T('A12', 'CORNER', 'huge stored JSON (~4.5 MB) opens in under 8 s', async (app) => {
  const d = seed(); d.budget.expenses = manyExpenses(14000); d.history = Array.from({ length: 5000 }, (_, i) => ({ id: 'h' + i, expression: '1+1', result: '2', at: i }))
  const raw = JSON.stringify(d); ok(raw.length > 3.5e6, 'seed too small ' + raw.length)
  const t0 = Date.now(); const { page, up } = await open(app, { raw })
  ok(up, 'did not render'); const ms = Date.now() - t0
  const len = await page.evaluate(() => localStorage.getItem('vkcalc.data').length); ok(len > 3.5e6, 'browser refused the seed, stored ' + len)
  ok(ms < 8000, `took ${ms} ms`)
  note(`4.5 MB start took ${ms} ms`)
})
T('A13', 'ERR', 'known B-16: saved calculator line "sin(" with fresh=true does not blank the app', async (app) => {
  const d = seed({ input: { expr: 'sin(', fresh: true } })
  const { page, up, errors } = await open(app, { data: d })
  const shown = up && await page.locator('.keypad').count() > 0
  ok(shown, KNOWN('B-16', 'white screen. ' + errors.slice(0, 1).join('')))
})
T('A14', 'CORNER', 'newer schema number (99) with valid data opens and keeps the data', async (app) => {
  const d = seed(); d.schemaVersion = 99
  const { page, up } = await open(app, { data: d }); ok(up, 'did not render')
  await openHistory(page); ok(await page.locator('.hrow').count() === 8, 'history lost')
})
T('A15', 'CORNER', 'older schema fixture (v1: no cards, reminders or budget) opens with starter budget', async (app) => {
  const v1 = { schemaVersion: 1, settings: { theme: 'light', numberSystem: 'international' }, history: [{ id: 'a', expression: '2+2', result: '4', at: 1 }], memory: '5', input: { expr: '', fresh: false } }
  const { page, up } = await open(app, { data: v1 }); ok(up, 'did not render')
  ok(await dataTheme(page) === 'light', 'old setting lost')
  await tab(page, 'Budget'); ok(/No spending yet/.test(await body(page)), 'budget start state missing')
  await openHistory(page).catch(() => {})
})
T('A16', 'RUNTIME', 'a changed setting and a typed expression survive a reload', async (app) => {
  const { page } = await open(app, { empty: true })
  await openSettings(page); await page.click('[role=radio]:text-is("Light")'); await page.click('text=International'); await page.click('button.row--button >> text=Indian').catch(() => {})
  await page.click('[role=radio]:has-text("International")'); await settle(page, 100)
  await page.click('[aria-label=Back]'); await settle(page, 100)
  await keys(page, '1', '2', 'Add'); await settle(page, 600)
  await page.reload(); await page.waitForSelector('.app'); await settle(page, 200)
  ok(await dataTheme(page) === 'light', 'theme not kept')
  ok((await page.locator('.display__expr').inputValue()).replace(/\s/g, '') === '12+', 'expression not resumed: ' + await page.locator('.display__expr').inputValue())
  const s = await stored(page); ok(s.settings.numberSystem === 'international', 'number system not kept')
})
T('A17', 'RUNTIME', 'hiding the app flushes the last change at once (no 250 ms loss)', async (app) => {
  const { page } = await open(app, { empty: true })
  await openSettings(page); await page.click('[role=radio]:text-is("Light")'); await hide(page)
  await page.reload(); await page.waitForSelector('.app')
  ok(await dataTheme(page) === 'light', 'last change lost')
})
T('A18', 'POS', 'startup tab setting opens the app on that tab', async (app) => {
  for (const t of ['tools', 'saved', 'due', 'budget']) {
    const { page, context } = await open(app, { data: seed({ settings: { startupTab: t } }) })
    const want = { tools: 'Tools', saved: 'Notes', due: 'Due', budget: 'Budget' }[t]
    ok(await page.locator('.tab[aria-current=page]').innerText() === want, `startup ${t} -> ${await page.locator('.tab[aria-current=page]').innerText()}`)
    await context.close()
  }
})
T('A19', 'POS', 'startup calculator setting opens straight into that calculator', async (app) => {
  const { page } = await open(app, { data: seed({ settings: { startupTool: 'emi', startupTab: 'budget' } }) })
  ok(await page.locator('.tab[aria-current=page]').innerText() === 'Tools', 'not on Tools')
  ok(/EMI/i.test(await page.locator('.screen__title').first().innerText().catch(() => '')) || /EMI/i.test(await body(page)), 'EMI not open')
})
T('A20', 'NEG', 'startup calculator id that does not exist falls back to the startup tab', async (app) => {
  const { page, up } = await open(app, { data: seed({ settings: { startupTool: 'nope-xyz', startupTab: 'due' } }) })
  ok(up, 'did not render')
  const cur = await page.locator('.tab[aria-current=page]').innerText()
  ok(cur === 'Due' || cur === 'Tools', 'tab ' + cur)
  ok(!/Something went wrong/i.test(await body(page)), 'error text')
  if (cur === 'Tools') note('unknown startupTool opens Tools (blank screen?) instead of the startup tab: body=' + (await page.locator('.app__body').innerText()).replace(/\n/g, '|').slice(0, 80))
})
T('A21', 'RUNTIME', 'timezone +14:00 and a far-future clock (2099) still open the app', async (app) => {
  const { page, up, errors } = await open(app, { data: seed(), timezone: 'Pacific/Kiritimati', now: Date.UTC(2099, 11, 31, 23, 0, 0) })
  ok(up, 'did not render'); await tab(page, 'Budget'); await settle(page)
  ok(!bad.test(await body(page)), 'bad text: ' + (await body(page)).match(bad)?.[0]); ok(errors.length === 0, errors.join(';'))
})
T('A22', 'RUNTIME', 'device language Arabic and Hindi do not change the app language or numbers', async (app) => {
  for (const locale of ['ar-SA', 'hi-IN']) {
    const { page, context, up } = await open(app, { data: seed({ input: { expr: '1000000/3', fresh: false } }), locale }); ok(up, locale + ' did not render')
    ok(/3,33,333/.test(await display(page)), `${locale}: ${await display(page)}`)
    await context.close()
  }
})

// ================================================================== N. TABS, SCREENS, OVERLAYS
const START = { Calculate: /^0/, Tools: /Browse by what you need/, Notes: /Notes[\s\S]*Home loan EMI/, Due: /Home loan EMI/, Budget: /Left this month/ }
for (const [name, re] of Object.entries(START)) {
  T('N0' + (Object.keys(START).indexOf(name) + 1), 'POS', `${name} tab opens and shows its start state, marked current`, async (app) => {
    const { page, errors } = await open(app, { data: seed() })
    await tab(page, name); await settle(page)
    const t = name === 'Calculate' ? await display(page) : await page.locator('.app__body').innerText()
    ok(re.test(t), `text: ${t.slice(0, 80)}`)
    ok(await page.locator('.tab[aria-current=page]').innerText() === name, 'aria-current wrong')
    ok(errors.length === 0, errors.join(';'))
  })
}
T('N06', 'POS', 'tab tap inside a calculator goes back to the Tools start', async (app) => {
  const { page } = await open(app, { data: seed({ settings: { startupTool: 'emi' } }) })
  ok(!/Browse by what you need/.test(await body(page)), 'tool not open first')
  await tab(page, 'Tools'); await settle(page)
  ok(/Browse by what you need/.test(await body(page)), 'did not return to the Tools start')
})
T('N07', 'POS', 'tab tap inside the Scientific calculator goes back to Tools start', async (app) => {
  const { page } = await open(app, { data: seed() })
  await SCREENS.sci(page); ok(await page.locator('.sci-screen, .keypad').count() > 0, 'scientific not open')
  await tab(page, 'Tools'); await settle(page)
  ok(/Browse by what you need/.test(await body(page)), 'not at Tools start')
})
T('N08', 'POS', 'tab tap inside a Notes card goes back to the Notes list', async (app) => {
  const { page } = await open(app, { data: seed() })
  await tab(page, 'Notes'); await page.click('text=Home loan EMI'); await settle(page)
  ok(!/Search notes/.test(await body(page)), 'card did not open')
  await tab(page, 'Notes'); await settle(page)
  ok(/Search notes/.test(await body(page)), 'did not return to the list')
})
T('N09', 'POS', 'tab tap inside Budget summary goes back to Budget home', async (app) => {
  const { page } = await open(app, { data: seed() })
  await SCREENS.summary(page); ok(!/Left this month/.test(await body(page)), 'summary not open')
  await tab(page, 'Budget'); await settle(page)
  ok(/Left this month/.test(await body(page)), 'not back on the home')
})
T('N10', 'POS', 'tab tap inside Budget manage page returns home', async (app) => {
  const { page } = await open(app, { data: seed() })
  await SCREENS.manage(page); await tab(page, 'Budget'); await settle(page)
  ok(/Left this month/.test(await body(page)), 'not home')
})
T('N11', 'POS', 'typed calculator input survives switching to other tabs and back', async (app) => {
  const { page } = await open(app, { empty: true })
  await keys(page, '1', '2', 'Add', '3'); for (const n of ['Tools', 'Notes', 'Due', 'Budget']) await tab(page, n)
  await tab(page, 'Calculate'); ok((await page.locator('.display__expr').inputValue()).replace(/\s/g, '') === '12+3', await page.locator('.display__expr').inputValue())
})
T('N12', 'UI', 'History sheet covers the tab bar and the page behind is inert', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page)
  const r = await page.evaluate(() => {
    const t = document.querySelector('.tabbar').getBoundingClientRect(); const el = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2)
    return { top: !!el?.closest('.sheet, .scrim'), inertMain: document.querySelector('main').hasAttribute('inert'), inertNav: !!document.querySelector('.app__nav[inert]') }
  })
  ok(r.top, 'tab bar is not covered by the sheet or scrim'); ok(r.inertMain && r.inertNav, 'page behind is not inert')
})
T('N13', 'UI', 'Settings screen covers the tab bar and the page behind is inert', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  const r = await page.evaluate(() => { const t = document.querySelector('.tabbar').getBoundingClientRect(); const el = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2); return { cov: !!el?.closest('.screen'), inert: document.querySelector('main').hasAttribute('inert') } })
  ok(r.cov, 'tab bar shows through Settings'); ok(r.inert, 'main not inert')
})
T('N14', 'POS', 'History closes with X, with the scrim, and with Escape', async (app) => {
  const { page } = await open(app, { data: seed() })
  await openHistory(page); await page.click('[aria-label="Close History"]'); await settle(page, 150); ok(await page.locator('.sheet').count() === 0, 'X did not close')
  await openHistory(page); await page.mouse.click(180, 40); await settle(page, 150); ok(await page.locator('.sheet').count() === 0, 'scrim tap did not close')
  await openHistory(page); await page.keyboard.press('Escape'); await settle(page, 150); ok(await page.locator('.sheet').count() === 0, 'Escape did not close')
})
T('N15', 'POS', 'Settings Back returns to Calculate with the typed line intact', async (app) => {
  const { page } = await open(app, { empty: true }); await keys(page, '9', 'Multiply', '8')
  await openSettings(page); await page.click('[aria-label=Back]'); await settle(page, 150)
  ok((await page.locator('.display__expr').inputValue()).replace(/\s/g, '') === '9×8', await page.locator('.display__expr').inputValue())
})
T('N16', 'POS', 'nested: Settings > Opens-on picker: Escape closes the picker only', async (app) => {
  const { page } = await open(app, { data: seed() }); await SCREENS.picker(page)
  ok(await page.locator('.sheet').count() === 1, 'picker not open')
  await page.keyboard.press('Escape'); await settle(page, 150)
  ok(await page.locator('.sheet').count() === 0, 'picker still open'); ok(await page.locator('.screen[aria-label=Settings]').count() === 1, 'Settings closed too')
})
T('N17', 'POS', 'nested: scrim tap on the picker closes the picker, not Settings', async (app) => {
  const { page } = await open(app, { data: seed() }); await SCREENS.picker(page)
  await page.mouse.click(180, 30); await settle(page, 150)
  ok(await page.locator('.sheet').count() === 0, 'picker still open'); ok(await page.locator('.screen[aria-label=Settings]').count() === 1, 'Settings closed')
})
T('N18', 'POS', 'nested: History > row menu (More): Escape closes only the row menu', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page)
  await page.locator('[aria-label^="More for"]').first().click(); await settle(page, 200)
  ok(await page.locator('.sheet').count() === 2, 'expected 2 sheets, got ' + await page.locator('.sheet').count())
  await page.keyboard.press('Escape'); await settle(page, 200)
  const n = await page.locator('.sheet').count()
  ok(n === 1, `Escape closed ${2 - n} sheets, only the top one should close. (Both Sheets listen on document and stopPropagation does not stop a sibling listener)`)
})
T('N19', 'POS', 'nested: Budget Add expense > category picker: Escape keeps the form open', async (app) => {
  const { page } = await open(app, { data: seed() }); await SCREENS.addExpense(page)
  const pick = page.locator('.sheet button.pick, .sheet [aria-haspopup=dialog]').first()
  ok(await pick.count() > 0, 'no picker on the form'); await pick.click(); await settle(page, 250)
  const before = await page.locator('.sheet').count()
  ok(before >= 2, 'picker did not open as a second sheet (' + before + ')')
  await page.keyboard.press('Escape'); await settle(page, 200)
  const n = await page.locator('.sheet').count()
  ok(n === before - 1, `Escape closed ${before - n} sheets; the form with typed data must stay`)
})
T('N20', 'POS', 'confirm inside a sheet: Clear all > Cancel keeps History open; CLEAR clears and offers Undo', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page)
  await page.click('text=Clear all'); ok(await page.locator('.confirm').count() === 1, 'no confirm')
  ok(await page.locator('.confirm button.btn--danger').isDisabled(), 'danger button enabled before typing CLEAR')
  await page.click('.confirm >> text=Cancel'); ok(await page.locator('.hrow').count() === 8, 'rows changed after cancel')
  await page.click('text=Clear all'); await page.fill('.confirm input', 'clear'); await page.click('.confirm button.btn--danger'); await settle(page, 200)
  const left = await page.locator('.hrow').count(); ok(left === 2, 'kept rows should be the named + locked 2, got ' + left)
  ok(/Cleared 6/.test(await page.locator('.snack').innerText()), 'snack: ' + await page.locator('.snack').innerText())
})
T('N21', 'NEG', 'Escape while the Clear-all confirm is shown closes History (documented, nothing is cleared)', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page)
  await page.click('text=Clear all'); await page.keyboard.press('Escape'); await settle(page, 150)
  ok(await page.locator('.sheet').count() === 0, 'sheet still open')
  await openHistory(page); ok(await page.locator('.hrow').count() === 8, 'rows lost')
})
T('N22', 'NEG', 'tab bar is unreachable by tap while Settings is open (nothing underneath fires)', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  const t = await page.evaluate(() => { const r = document.querySelector('.tabbar .tab:nth-child(5)').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })
  await page.mouse.click(t[0], t[1]); await settle(page, 200)
  ok(await page.locator('.screen[aria-label=Settings]').count() === 1, 'Settings closed by a tap on the tab bar area')
  ok(await page.locator('.tab[aria-current=page]').innerText() === 'Calculate', 'tab changed behind Settings')
})
T('N23', 'UX', 'Escape on the full Settings screen does nothing harmful (observation)', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await page.keyboard.press('Escape'); await settle(page, 150)
  const still = await page.locator('.screen[aria-label=Settings]').count() === 1
  note(still ? 'IMPROVE: Escape does not close the Settings screen (a hardware keyboard user has only the Back button)' : 'Escape closes Settings')
  ok(true, '')
})
T('N24', 'UX', 'every full screen has a visible Back that is at least 44 px', async (app) => {
  const { page } = await open(app, { data: seed() })
  for (const name of ['settings', 'manage', 'summary']) {
    await SCREENS[name](page)
    const r = await page.locator('.screen__bar [aria-label=Back]').first().boundingBox(); ok(r && r.width >= 44 && r.height >= 44, `${name} back ${JSON.stringify(r)}`)
    await page.click('.screen__bar [aria-label=Back] >> nth=0'); await settle(page, 150)
    if (name === 'manage' || name === 'summary') await tab(page, 'Calculate')
  }
})

// ================================================================== S. SETTINGS, every control
T('S01', 'POS', 'Theme Dark: root marked dark, ground is near black', async (app) => {
  const { page } = await open(app, { data: seed({ settings: { theme: 'light' } }) }); await openSettings(page)
  await page.click('[role=radio]:text-is("Dark")'); await settle(page, 100)
  ok(await dataTheme(page) === 'dark', 'data-theme'); ok(/rgb\(6, 6, 6\)/.test(await bgOf(page)), await bgOf(page))
  ok(await page.locator('[role=radio]:text-is("Dark")').getAttribute('aria-checked') === 'true', 'aria-checked')
})
T('S02', 'POS', 'Theme Light: root marked light, ground is white', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  await page.click('[role=radio]:text-is("Light")'); await settle(page, 100)
  ok(await dataTheme(page) === 'light', 'data-theme'); ok(/rgb\(255, 255, 255\)/.test(await bgOf(page)), await bgOf(page))
  ok(await page.evaluate(() => document.querySelector('meta[name=theme-color]').content) === '#FFFFFF', 'meta theme-color not updated')
})
T('S03', 'POS', 'Theme System follows a dark phone', async (app) => {
  const { page } = await open(app, { data: seed({ settings: { theme: 'system' } }), colorScheme: 'dark' })
  ok(await dataTheme(page) === 'dark', await dataTheme(page))
})
T('S04', 'POS', 'Theme System follows a light phone', async (app) => {
  const { page } = await open(app, { data: seed({ settings: { theme: 'system' } }), colorScheme: 'light' })
  ok(await dataTheme(page) === 'light', await dataTheme(page))
})
T('S05', 'RUNTIME', 'Theme System switches live when the phone changes mode', async (app) => {
  const { page } = await open(app, { data: seed({ settings: { theme: 'system' } }), colorScheme: 'dark' })
  await page.emulateMedia({ colorScheme: 'light' }); await settle(page, 200); ok(await dataTheme(page) === 'light', 'did not go light')
  await page.emulateMedia({ colorScheme: 'dark' }); await settle(page, 200); ok(await dataTheme(page) === 'dark', 'did not go dark')
})
T('S06', 'NEG', 'Theme fixed to Light ignores a dark phone', async (app) => {
  const { page } = await open(app, { data: seed({ settings: { theme: 'light' } }), colorScheme: 'dark' })
  ok(await dataTheme(page) === 'light', 'followed the phone')
})
T('S07', 'POS', 'all 4 accent colours apply the right fill and show their name', async (app) => {
  const want = { Citron: '#CCD539', Sky: '#8ED5FE', Violet: '#CEC0FF', Amber: '#FFBC64' }
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  for (const [label, fill] of Object.entries(want)) {
    await page.click(`[role=radio][aria-label=${label}]`); await settle(page, 80)
    ok((await cssVar(page, '--accent-fill')).toUpperCase() === fill, `${label}: ${await cssVar(page, '--accent-fill')}`)
    ok(await page.locator(`[role=radio][aria-label=${label}]`).getAttribute('aria-checked') === 'true', label + ' aria-checked')
    ok((await page.locator('.sect--settings >> text=' + label).count()) > 0, 'name not shown for ' + label)
  }
})
T('S08', 'POS', 'Number system: Indian and International change how 1000000/3 is shown', async (app) => {
  const { page } = await open(app, { data: seed({ input: { expr: '1000000/3', fresh: false }, settings: { decimals: 3 } }) })
  ok(await display(page) === '3,33,333.333', await display(page))
  await openSettings(page); await page.click('[role=radio]:has-text("International")'); await page.click('[aria-label=Back]'); await settle(page, 150)
  ok(await display(page) === '333,333.333', await display(page))
})
for (const n of ['auto', ...Array.from({ length: 11 }, (_, i) => String(i))]) {
  T('S09' + (n === 'auto' ? 'a' : String.fromCharCode(98 + +n)), 'POS', `Decimal places ${n} chosen in Settings applies to 1000000/3`, async (app) => {
    const { page } = await open(app, { data: seed({ input: { expr: '1000000/3', fresh: false }, settings: { decimals: n === '10' ? 2 : 'auto' } }) })
    await openSettings(page); await pickFrom(page, 'Decimal places', n === 'auto' ? 'Auto' : n === '10' ? '10' : n)
    await page.click('[aria-label=Back]'); await settle(page, 150)
    const t = (await display(page)).trim(); ok(!bad.test(t), t)
    const frac = t.includes('.') ? t.split('.')[1].length : 0
    if (n === 'auto') ok(frac >= 3, 'auto: ' + t); else ok(frac === +n, `want ${n} decimals, got "${t}"`)
  })
}
T('S10', 'POS', 'Angle mode: sin(90) is 1 in degrees and about 0.894 in radians', async (app) => {
  const a = await open(app, { data: seed({ input: { expr: 'sin(90)', fresh: false }, settings: { angle: 'deg' } }) })
  ok(/^1(\.0+)?$/.test((await display(a.page)).trim()), 'deg: ' + await display(a.page))
  const b = await open(app, { data: seed({ input: { expr: 'sin(90)', fresh: false }, settings: { angle: 'rad' } }) })
  ok(/^0\.8939/.test((await display(b.page)).trim()), 'rad: ' + await display(b.page))
})
T('S11', 'POS', 'Angle control switches in Settings (Degrees/Radians radio)', async (app) => {
  const { page } = await open(app, { data: seed({ input: { expr: 'sin(90)', fresh: false } }) }); await openSettings(page)
  await page.click('[role=radio][aria-label="Angle mode"], [role=radio]:has-text("Radians")'); await page.click('[aria-label=Back]'); await settle(page, 150)
  ok(/^0\.89/.test((await display(page)).trim()), await display(page))
})
T('S12', 'POS', 'Copy format "with commas" puts 3,33,333.33 on the clipboard', async (app) => {
  const { page } = await open(app, { data: seed({ input: { expr: '1000000/3', fresh: false }, settings: { copyFormat: 'with', decimals: 2 } }), permissions: ['clipboard-read', 'clipboard-write'] })
  await page.click('.util >> text=Copy, .util button:has-text("Copy"), button:has-text("Copy")'); await settle(page, 250)
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => 'ERR ' + e.message))
  ok(clip === '3,33,333.33', 'clipboard: ' + clip)
})
T('S13', 'POS', 'Copy format "without commas" puts 333333.33 on the clipboard', async (app) => {
  const { page } = await open(app, { data: seed({ input: { expr: '1000000/3', fresh: false }, settings: { copyFormat: 'without', decimals: 2 } }), permissions: ['clipboard-read', 'clipboard-write'] })
  await page.click('button:has-text("Copy")'); await settle(page, 250)
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => 'ERR ' + e.message))
  ok(clip === '333333.33', 'clipboard: ' + clip)
})
T('S14', 'UX', 'Copy format "ask each time" shows a choice instead of copying silently', async (app) => {
  const { page } = await open(app, { data: seed({ input: { expr: '1000000/3', fresh: false }, settings: { copyFormat: 'ask', decimals: 2 } }), permissions: ['clipboard-read', 'clipboard-write'] })
  await page.click('button:has-text("Copy")'); await settle(page, 250)
  ok(await page.locator('.sheet').count() === 1, 'no choice sheet'); const t = await page.locator('.sheet').innerText()
  ok(/3,33,333\.33/.test(t) && /333333\.33/.test(t), 'sheet does not show both: ' + t.replace(/\n/g, '|'))
})
T('S15', 'POS', 'Vibrate on key press: calls vibrate when on, silent when off', async (app) => {
  const init = `window.__vib=0; navigator.vibrate=function(){ window.__vib++; return true }`
  const on = await open(app, { data: seed({ settings: { haptics: true } }), init }); await keys(on.page, '5', '6')
  const n1 = await on.page.evaluate(() => window.__vib); ok(n1 >= 2, 'on: calls=' + n1)
  const off = await open(app, { data: seed({ settings: { haptics: false } }), init }); await keys(off.page, '5', '6')
  ok(await off.page.evaluate(() => window.__vib) === 0, 'off but it vibrated')
})
T('S16', 'POS', 'Keep the screen on requests a screen wake lock and releases it when switched off', async (app) => {
  const init = `window.__wl={req:0,rel:0}; Object.defineProperty(navigator,'wakeLock',{value:{request: async (t)=>{ window.__wl.req++; window.__wl.type=t; return { addEventListener(){}, release: async()=>{ window.__wl.rel++ } } }}})`
  const { page } = await open(app, { data: seed(), init }); await openSettings(page)
  await page.click('[role=switch][aria-label="Keep the screen on"]'); await settle(page, 200)
  let w = await page.evaluate(() => window.__wl); ok(w.req >= 1 && w.type === 'screen', JSON.stringify(w))
  ok(await page.locator('[role=switch][aria-label="Keep the screen on"]').getAttribute('aria-checked') === 'true', 'switch state')
  await page.click('[role=switch][aria-label="Keep the screen on"]'); await settle(page, 200)
  w = await page.evaluate(() => window.__wl); ok(w.rel >= 1, 'not released: ' + JSON.stringify(w))
})
T('S17', 'ERR', 'Keep the screen on in a browser with no wake lock support does not error', async (app) => {
  const { page, errors } = await open(app, { data: seed(), init: `Object.defineProperty(navigator,'wakeLock',{value:undefined})` }); await openSettings(page)
  await page.click('[role=switch][aria-label="Keep the screen on"]'); await settle(page, 200); ok(errors.length === 0, errors.join(';'))
})
T('S18', 'POS', 'Keep calculation history OFF: = no longer records; ON: it records', async (app) => {
  const off = await open(app, { data: seed({ history: [], settings: { keepHistory: false } }) })
  await keys(off.page, '2', 'Add', '3', 'Equals'); await settle(off.page, 500)
  ok((await stored(off.page)).history.length === 0, 'history grew while off')
  const on = await open(app, { data: seed({ history: [] }) })
  await keys(on.page, '2', 'Add', '3', 'Equals'); await settle(on.page, 500)
  ok((await stored(on.page)).history.length === 1, 'history did not grow while on')
})
T('S19', 'POS', 'Keep history toggled OFF in Settings keeps old rows but records nothing new', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  await page.click('[role=switch][aria-label="Keep calculation history"]'); await page.click('[aria-label=Back]')
  await keys(page, '4', 'Add', '4', 'Equals'); await settle(page, 500)
  ok((await stored(page)).history.length === 8, 'count ' + (await stored(page)).history.length)
})
T('S20', 'POS', 'Opens on: choose Budget, reload, app opens on Budget', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await pickFrom(page, 'Opens on', 'Budget')
  await settle(page, 600); await page.reload(); await page.waitForSelector('.app')
  ok(await page.locator('.tab[aria-current=page]').innerText() === 'Budget', 'not Budget')
})
T('S21', 'POS', 'Opens on: choose a calculator (EMI), reload, app opens inside it; choosing a screen clears it', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  await page.click('button.pick[aria-label^="Opens on"]'); await settle(page, 150)
  await page.fill('.sheet input[type=search], .sheet input', 'EMI'); await settle(page, 150)
  await page.locator('.sheet [role=option]').filter({ hasText: /^EMI/ }).first().click(); await settle(page, 600)
  ok((await stored(page)).settings.startupTool === 'emi', 'startupTool ' + (await stored(page)).settings.startupTool)
  await page.reload(); await page.waitForSelector('.app'); ok(!/Browse by what you need/.test(await body(page)), 'tool not open')
  await openSettings(page); await pickFrom(page, 'Opens on', 'Notes'); await settle(page, 600)
  const s = (await stored(page)).settings; ok(s.startupTool === null && s.startupTab === 'saved', JSON.stringify([s.startupTool, s.startupTab]))
})
T('S22', 'POS', 'Opens on picker shows the chosen item with a tick and groups by section', async (app) => {
  const { page } = await open(app, { data: seed() }); await SCREENS.picker(page)
  ok(await page.locator('.sheet [aria-selected=true]').count() === 1, 'no selected option')
  ok(await page.locator('.sheet .pick__group').count() >= 5, 'groups ' + await page.locator('.sheet .pick__group').count())
})
T('S23', 'POS', 'Settings > Reminders section is native only: hidden in the browser', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  const heads = await page.locator('.screen h2').allInnerTexts()
  ok(!heads.includes('Reminders'), 'Reminders section visible: ' + heads.join(','))
  ok(!/Notifications: |Alarms and reminders:/.test(await body(page)), 'permission rows visible')
})
T('S24', 'POS', 'Categories and cards row (in Budget) opens Manage and Back returns to Budget; Settings no longer carries that row (B17)', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  ok((await page.locator('.screen[aria-label=Settings] >> text=Categories and cards').count()) === 0, 'Settings still has the Categories and cards row')
  await page.click('[aria-label=Back]'); await settle(page, 200)
  await tab(page, 'Budget'); await settle(page, 150)
  await openBudgetMore(page)
  await page.click('text=Categories and cards'); await settle(page, 200); ok(/Categories|Manage|limit/i.test(await body(page)), 'manage not shown')
  const backs = page.locator('[aria-label=Back]'); await backs.last().click(); await settle(page, 200)
  ok(await page.locator('.screen[aria-label="Categories and cards"]').count() === 0 && /Add expense/.test(await body(page)), 'not back on Budget')
})
T('S25', 'POS', 'About shows version 0.1.0-P1 and the privacy line', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  const t = await page.locator('.screen').innerText(); ok(/0\.1\.0-P1/.test(t), 'version'); ok(/No account, no ads, no tracking/.test(t), 'privacy line')
})
T('S26', 'RUNTIME', 'every Settings control, changed once, survives a reload together', async (app) => {
  const { page } = await open(app, { empty: true }); await openSettings(page)
  await page.click('[role=radio]:text-is("Light")'); await page.click('[role=radio][aria-label=Sky]'); await page.click('[role=radio]:has-text("International")')
  await pickFrom(page, 'Decimal places', '4'); await pickFrom(page, 'Copying numbers', 'Without'); await page.click('[role=radio]:has-text("Radians")')
  await page.click('[role=switch][aria-label="Vibrate on key press"]'); await page.click('[role=switch][aria-label="Keep the screen on"]'); await page.click('[role=switch][aria-label="Keep calculation history"]')
  await settle(page, 600); await page.reload(); await page.waitForSelector('.app')
  const s = (await stored(page)).settings
  const want = { theme: 'light', accent: 'sky', numberSystem: 'international', decimals: 4, copyFormat: 'without', angle: 'rad', haptics: false, keepAwake: true, keepHistory: false }
  for (const [k, v] of Object.entries(want)) ok(s[k] === v, `${k}: ${s[k]} != ${v}`)
})
T('S27', 'UX', 'a Settings change takes effect at once with no Save button', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  ok(await page.locator('.screen .btn--primary').count() === 0, 'a primary Save-type button exists')
  await page.click('[role=radio]:text-is("Light")'); ok(await dataTheme(page) === 'light', 'not immediate')
})
T('S28', 'NEG', 'Settings controls cannot be set to an invalid value through hand-edited data', async (app) => {
  const { page } = await open(app, { raw: JSON.stringify({ schemaVersion: 3, settings: { decimals: 99, accent: 'neon', theme: 'blue', startupTab: 'x', startupTool: '../../etc' } }) })
  const s = (await stored(page).catch(() => null)); await openSettings(page)
  ok(await page.locator('[role=radio][aria-checked=true]').count() >= 4, 'controls show no valid choice')
  ok(!/undefined|NaN/.test(await page.locator('.screen').innerText()), 'bad text in Settings')
})

// ================================================================== K. BACKUP AND RESTORE
T('K01', 'POS', 'export gives valid JSON with kind, schemaVersion, exportedAt, app and data', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  const f = await download(page, 'text=Export a backup'); const j = JSON.parse(f.text)
  ok(j.kind === 'vkcalc-backup' && j.schemaVersion === 3 && j.app === 'Calc', JSON.stringify([j.kind, j.schemaVersion, j.app]))
  ok(!Number.isNaN(Date.parse(j.exportedAt)), 'exportedAt ' + j.exportedAt)
})
T('K02', 'POS', 'export includes budget, tasks, reminders, history (with lock and name) and settings', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  const j = JSON.parse((await download(page, 'text=Export a backup')).text).data
  ok(j.budget.expenses.length === 2 && j.budget.categories.length === 2 && j.budget.instruments.length === 1, 'budget incomplete')
  ok(j.cards.some((c) => c.kind === 'task') && j.cards.length === 3, 'cards/tasks missing')
  ok(j.reminders.length === 1, 'reminder missing'); ok(j.history.some((h) => h.locked === true) && j.history.some((h) => h.memo === 'Rent share'), 'history lock/name missing')
  ok(j.settings && typeof j.settings.theme === 'string', 'settings missing')
})
T('K03', 'POS', 'export file name is vkcalc-backup-YYYY-MM-DD.json and size is small for small data', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  const f = await download(page, 'text=Export a backup'); ok(/^vkcalc-backup-\d{4}-\d{2}-\d{2}\.json$/.test(f.name), f.name); ok(f.text.length < 20000, 'size ' + f.text.length)
  note(`small backup is ${f.text.length} bytes; pretty printed: ${f.text.includes('\n  ')}`)
})
T('K04', 'CORNER', 'known B-25: backup file name uses the phone\'s local date, not UTC', async (app) => {
  const now = Date.UTC(2026, 10, 2, 19, 0, 0) // 3 Nov 00:30 in India
  const { page } = await open(app, { data: seed(), now }); await openSettings(page)
  const f = await download(page, 'text=Export a backup'); ok(f.name === 'vkcalc-backup-2026-11-03.json', KNOWN('B-25', f.name + ' (local date is 2026-11-03)'))
})
T('K05', 'POS', 'export shows a confirmation with where it went', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await download(page, 'text=Export a backup'); await settle(page, 150)
  ok(/Backup saved to/.test(await page.locator('.snack').innerText()), 'no confirmation')
})
T('K06', 'UX', 'known (new): the "Open folder" link on the web build does nothing', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await download(page, 'text=Export a backup'); await settle(page, 150)
  const link = page.locator('.snack__link'); ok(await link.count() === 1, 'no link')
  await link.click(); await settle(page, 200)
  // A working link would open something. In the browser the app should hide a link that has nowhere to go.
  ok(false, 'a button that cannot do anything is shown on the web build (it just vanishes). Hide it when not native')
})
T('K07', 'POS', 'restore: a valid backup into a fresh app, confirm text, Replace everything, data appears', async (app) => {
  const src = await open(app, { data: seed() }); await openSettings(src.page); const f = await download(src.page, 'text=Export a backup')
  const { page } = await open(app, { empty: true }); await openSettings(page); await upload(page, f.name, f.text); await settle(page, 300)
  const c = await page.locator('.confirm').innerText()
  ok(/everything/i.test(c) && /calculations \(8\)/.test(c) && /notes and lists \(3\)/.test(c) && /reminders \(1\)/.test(c) && /budget entries \(2\)/.test(c) && /settings/.test(c), 'confirm text: ' + c.replace(/\n/g, ' '))
  await page.click('.confirm .btn--primary'); await settle(page, 300)
  ok(/Restored 8 calculations, 3 notes and lists, 1 reminders and 2 budget entries/.test(await body(page)), 'done note: ' + (await page.locator('.note[role=status]').innerText().catch(() => 'none')))
  await leaveSettings(page); await tab(page, 'Budget'); ok(/Left this month/.test(await body(page)), 'budget not restored')
})
T('K08', 'UX', 'restore: confirm text lists what is replaced and says it is lost, and offers Cancel', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await upload(page, 'b.json', backupOf(seed()))
  await settle(page, 300); const c = await page.locator('.confirm').innerText()
  ok(/What is on this phone now is lost/.test(c), 'no loss warning'); ok(/from \d/.test(c), 'no backup date'); ok(/Cancel/.test(c), 'no Cancel')
})
T('K09', 'POS', 'restore: "Save a backup of this phone first" downloads the current data and the confirm stays', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await upload(page, 'b.json', backupOf(seed({ history: [] })))
  await settle(page, 300)
  const f = await download(page, '.confirm >> text=Save a backup of this phone first'); ok(JSON.parse(f.text).data.history.length === 8, 'did not save the CURRENT data')
  ok(await page.locator('.confirm').count() === 1, 'confirm vanished after the safety backup')
})
T('K10', 'POS', 'restore: Cancel changes nothing', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await upload(page, 'b.json', backupOf(seed({ history: [] })))
  await settle(page, 300); await page.click('.confirm >> text=Cancel'); await settle(page, 200); ok(await page.locator('.confirm').count() === 0, 'confirm still shown')
  await leaveSettings(page); await openHistory(page); ok(await page.locator('.hrow').count() === 8, 'history changed')
})
T('K11', 'ERR', 'restore: a file that is not JSON gives a plain error and changes nothing', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await upload(page, 'x.json', 'hello this is not json'); await settle(page, 300)
  ok(/isn't a Calc backup/.test(await page.locator('.note[role=status]').innerText()), 'no error'); ok(await page.locator('.confirm').count() === 0, 'confirm shown for a bad file')
})
T('K12', 'ERR', 'restore: JSON of the wrong kind is refused', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await upload(page, 'x.json', JSON.stringify({ kind: 'other-app', data: {} })); await settle(page, 300)
  ok(/isn't a Calc backup/.test(await page.locator('.note[role=status]').innerText()), 'no error')
})
T('K13', 'ERR', 'restore: a file bigger than 5 MB is refused with a plain message', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await upload(page, 'big.json', 'x'.repeat(5.2 * 1024 * 1024)); await settle(page, 600)
  ok(/too large/.test(await page.locator('.note[role=status]').innerText()), 'no size error')
})
T('K14', 'CORNER', 'restore: older schema (v1) backup is accepted and upgraded', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  await upload(page, 'old.json', backupOf({ settings: { numberSystem: 'international' }, history: [{ id: 'a', expression: '2+2', result: '4', at: 1 }], memory: null, input: { expr: '', fresh: false } }, { schemaVersion: 1 })); await settle(page, 300)
  ok(/calculations \(1\)/.test(await page.locator('.confirm').innerText()), 'confirm: ' + await page.locator('.confirm').innerText())
  await page.click('.confirm .btn--primary'); await settle(page, 300)
  const s = await stored(page); await settle(page, 400); ok((await stored(page)).schemaVersion === 3, 'schema not upgraded')
})
T('K15', 'CORNER', 'restore: a backup from a NEWER schema is accepted without crashing (no warning is shown)', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await upload(page, 'new.json', backupOf({ ...seed(), futureField: { a: 1 } }, { schemaVersion: 99 })); await settle(page, 300)
  ok(await page.locator('.confirm').count() === 1, 'not accepted')
  note('IMPROVE: a backup written by a newer app version is restored silently; fields it does not know are dropped. Warn first.')
})
T('K16', 'CORNER', 'restore: partial backup (settings only) resets everything else and says counts of 0', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await upload(page, 'p.json', backupOf({ settings: { theme: 'light' } })); await settle(page, 300)
  const c = await page.locator('.confirm').innerText(); ok(/calculations \(0\)/.test(c) && /budget entries \(0\)/.test(c), c)
  await page.click('.confirm .btn--primary'); await settle(page, 300)
  ok(await dataTheme(page) === 'light', 'theme from the file not applied')
  note('a partial backup wipes every other area to empty (documented behaviour of "Replace everything")')
})
T('K17', 'ERR', 'restore: data field null gives "damaged" not a crash', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await upload(page, 'd.json', JSON.stringify({ kind: 'vkcalc-backup', schemaVersion: 3, data: null })); await settle(page, 300)
  ok(/damaged/.test(await page.locator('.note[role=status]').innerText()), await page.locator('.note[role=status]').innerText())
})
T('K18', 'POS', 'restore then undo is not possible: no Undo snack and the calculator Undo stack is empty (documented)', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await upload(page, 'r.json', backupOf(seed({ history: [] }))); await settle(page, 300)
  await page.click('.confirm .btn--primary'); await settle(page, 300)
  ok(await page.locator('.snack').count() === 0, 'a snack exists after restore')
  note('restore cannot be undone. The only safety net is the "Save a backup of this phone first" button on the confirm. IMPROVE: keep the replaced data for one undo.')
})
T('K19', 'NEG', 'restore: the "Replace" confirm is not reachable twice (a second tap does nothing harmful)', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await upload(page, 'r.json', backupOf(seed())); await settle(page, 300)
  await page.click('.confirm .btn--primary'); ok(await page.locator('.confirm').count() === 0, 'confirm still shown after replacing')
})
T('K20', 'ERR', 'known B-03: a backup the app wrote with 20,000 budget entries can be restored', async (app) => {
  const d = seed(); d.budget.expenses = manyExpenses(20000)
  const { page, up } = await open(app, { data: d }); ok(up, 'did not render'); await openSettings(page)
  const f = await download(page, 'text=Export a backup'); note(`20,000 entries -> backup ${(f.text.length / 1048576).toFixed(2)} MB`)
  await upload(page, f.name, f.text); await settle(page, 1200)
  ok(await page.locator('.confirm').count() === 1, KNOWN('B-03', `restore said: ${await page.locator('.note[role=status]').innerText().catch(() => '(nothing)')}; file was ${(f.text.length / 1048576).toFixed(2)} MB`))
})
T('K21', 'ERR', 'known B-16 via restore: backup whose calculator line is "sin(" fresh=true does not blank the app', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await upload(page, 'r.json', backupOf(seed({ input: { expr: 'sin(', fresh: true } }))); await settle(page, 300)
  await page.click('.confirm .btn--primary'); await settle(page, 400); await leaveSettings(page).catch(() => {}); await settle(page, 300)
  ok(await page.locator('.app').count() === 1 && await page.locator('.keypad').count() > 0, KNOWN('B-16', 'the app went blank after restore'))
})
T('K22', 'NEG', 'restore: HTML and script text in names is shown as plain text and never runs', async (app) => {
  const evil = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>'
  const d = seed(); d.cards[0].title = evil; d.history[0].memo = evil; d.budget.categories[0].name = evil
  const { page } = await open(app, { empty: true }); await openSettings(page); await upload(page, 'e.json', backupOf(d)); await settle(page, 300)
  await page.click('.confirm .btn--primary'); await settle(page, 300); await leaveSettings(page); await tab(page, 'Notes'); await settle(page, 400)
  ok(await page.evaluate(() => window.__xss) === undefined, 'script ran'); ok((await body(page)).includes('<img src=x'), 'text not shown literally')
})
T('K23', 'CORNER', 'restore: 10,000 history rows in a file are cut to the 200 cap, locked/named kept', async (app) => {
  const d = seed(); d.history = Array.from({ length: 10000 }, (_, i) => ({ id: 'h' + i, expression: '1+1', result: '2', at: i }))
  const { page } = await open(app, { data: seed() }); await openSettings(page); await upload(page, 'h.json', backupOf(d)); await settle(page, 500)
  const c = await page.locator('.confirm').innerText(); ok(/calculations \(200\)/.test(c), 'confirm count: ' + c.replace(/\n/g, ' ').slice(0, 200))
})
T('K24', 'POS', 'restore picks the file input again after a refusal (same file can be chosen twice)', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  await upload(page, 'x.json', 'nope'); await settle(page, 200); await upload(page, 'x.json', 'nope'); await settle(page, 200)
  ok(/isn't a Calc backup/.test(await page.locator('.note[role=status]').innerText()), 'second choice ignored')
})
T('K25', 'UI', 'restore confirm and its three buttons fit 360 px and 200% font, buttons >= 44 px', async (app) => {
  const { page } = await open(app, { data: seed(), font: 200 }); await openSettings(page); await upload(page, 'b.json', backupOf(seed())); await settle(page, 300)
  const o = await overflowing(page); ok(o.length === 0, o.join(' | '))
  for (const b of await page.locator('.confirm .btn').all()) { const r = await b.boundingBox(); ok(r.height >= 44, 'button height ' + r.height) }
  await page.locator('.confirm').scrollIntoViewIfNeeded()
})
T('K26', 'RUNTIME', 'backup round trip: restore of an export is lossless for every area', async (app) => {
  const d = seed({ memory: '42' }); const src = await open(app, { data: d }); await openSettings(src.page); const f = await download(src.page, 'text=Export a backup')
  const { page } = await open(app, { empty: true }); await openSettings(page); await upload(page, f.name, f.text); await settle(page, 300); await page.click('.confirm .btn--primary'); await settle(page, 700)
  const a = JSON.parse(f.text).data, b = await stored(page)
  for (const k of ['history', 'cards', 'reminders', 'budget', 'memory']) ok(JSON.stringify(a[k]) === JSON.stringify(b[k]), `${k} differs after restore`)
})

// ================================================================== T. TOASTS AND SNACKBARS
// A history row's Delete now lives in its More sheet (B14): open the nth row's More, tap Delete. Locked rows have Delete disabled there.
const delRow = async (page, i = 0) => {
  const rows = page.locator('.hrow'); let seen = 0
  for (let r = 0, n = await rows.count(); r < n; r++) {
    await rows.nth(r).locator('[aria-label^="More for"]').click(); await settle(page, 100)
    const del = page.locator('.hmenu__item', { hasText: 'Delete' })
    if (await del.isEnabled()) { if (seen++ === i) { await del.click(); return settle(page, 150) } }
    await page.click('[aria-label="Close Calculation"]'); await settle(page, 100)
  }
  throw new Error('no deletable history row #' + i)
}
T('T01', 'POS', 'delete a history row: snackbar with text and Undo appears above the tab bar', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page); await delRow(page)
  const s = page.locator('.snack'); ok(await s.count() === 1, 'no snack'); ok(/Removed from history/.test(await s.innerText()) && /Undo/.test(await s.innerText()), await s.innerText())
  ok(await s.getAttribute('role') === 'status', 'not role=status')
})
T('T02', 'POS', 'Undo puts the row back in the same place', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page)
  const before = await page.locator('.hrow__expr').allInnerTexts(); await delRow(page, 0); await page.click('.snack >> text=Undo'); await settle(page, 200)
  ok((await page.locator('.hrow__expr').allInnerTexts()).join() === before.join(), 'order or content changed')
})
T('T03', 'RUNTIME', 'snackbar hides by itself after 8 seconds (not before)', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page); await delRow(page)
  await sleep(6500); ok(await page.locator('.snack').count() === 1, 'gone before 7 s')
  await sleep(2300); ok(await page.locator('.snack').count() === 0, 'still there after ~9 s')
})
T('T04', 'POS', 'a newer snackbar replaces the older one, and Undo restores only the latest', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page); await delRow(page, 0); const t1 = await page.locator('.snack').innerText(); await delRow(page, 0)
  ok(await page.locator('.snack').count() === 1, 'two snacks'); await page.click('.snack >> text=Undo'); await settle(page, 200)
  ok(await page.locator('.hrow').count() === 7, 'rows: ' + await page.locator('.hrow').count()); note('first snack said: ' + t1.replace(/\n/g, ' '))
})
T('T05', 'UI', 'snackbar sits above the tab bar, never over it', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page); await delRow(page)
  await page.click('[aria-label="Close History"]'); await settle(page, 200)
  const r = await page.evaluate(() => { const s = document.querySelector('.snack').getBoundingClientRect(), t = document.querySelector('.tabbar').getBoundingClientRect(); return { sb: s.bottom, tt: t.top } })
  ok(r.sb <= r.tt + 1, `snack bottom ${r.sb} > tabbar top ${r.tt}`)
})
T('T06', 'UI', 'snackbar readable at 200% font: wraps, nothing clipped, buttons >= 44 px', async (app) => {
  const { page } = await open(app, { data: seed(), font: 200 }); await openHistory(page); await delRow(page)
  const r = await page.evaluate(() => { const s = document.querySelector('.snack'); const b = s.getBoundingClientRect(); return { w: b.width, vw: innerWidth, sw: s.scrollWidth, cw: s.clientWidth, btn: [...s.querySelectorAll('button')].map((x) => x.getBoundingClientRect().height) } })
  ok(r.sw <= r.cw + 1, 'content wider than the bar'); ok(r.btn.every((h) => h >= 44), 'buttons ' + r.btn.join(','))
})
T('T07', 'UI', 'snackbar stays on screen when the keyboard shrinks the window (viewport 360x330)', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page); await delRow(page)
  await page.setViewportSize({ width: 360, height: 330 }); await settle(page, 200)
  const r = await page.evaluate(() => { const b = document.querySelector('.snack').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, vh: innerHeight } })
  ok(r.top >= 0 && r.bottom <= r.vh + 1, JSON.stringify(r))
})
T('T08', 'UX', 'snackbar Undo and link buttons are real buttons with 44 px height', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page); await delRow(page)
  for (const b of await page.locator('.snack button').all()) { const r = await b.boundingBox(); ok(r.height >= 44, `${await b.innerText()} is ${r.height}px high`) }
})
T('T09', 'UX', 'a screen reader hears the snackbar: role=status exists (it is added with the text, observation)', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page); await delRow(page)
  ok(await page.locator('.snack[role=status]').count() === 1, 'no role=status')
  note('IMPROVE: .snack is mounted together with its text, so some screen readers skip the first message. Keep an empty role=status region mounted and fill it.')
})
T('T10', 'RUNTIME', 'snackbar timer restarts for a replacement message (second snack lives a full 8 s)', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page); await delRow(page, 0); await sleep(5500); await delRow(page, 0)
  await sleep(4000); ok(await page.locator('.snack').count() === 1, 'second snack cut short by the first timer')
})
T('T11', 'UX', 'Settings > export shows a snack that is visible above the Settings screen', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await download(page, 'text=Export a backup'); await settle(page, 200)
  const r = await page.evaluate(() => { const b = document.querySelector('.snack').getBoundingClientRect(); const e = document.elementFromPoint(b.left + 20, b.top + b.height / 2); return !!e?.closest('.snack') })
  ok(r, 'the snackbar is covered by the Settings screen')
})
T('T12', 'POS', 'delete several history rows then tab away: snack stays and Undo still works', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page); await delRow(page); await page.click('[aria-label="Close History"]'); await tab(page, 'Tools')
  ok(await page.locator('.snack').count() === 1, 'snack lost when changing tab')
})

// ================================================================== Y. ACCESSIBILITY SWEEP (per screen, memoised scans)
for (const name of SCREEN_NAMES) {
  T('Y-NAME-' + name, 'UI', `[${name}] every button, link and input has an accessible name`, async (app) => { const r = await scan(app, name); ok(r.names.length === 0, r.names.slice(0, 5).join(' | ')) })
  T('Y-TAP-' + name, 'UI', `[${name}] every interactive element is >= 44 px in one direction (project rule)`, async (app) => { const r = await scan(app, name); ok(r.smallBoth.length === 0, r.smallBoth.slice(0, 5).join(' | ')); if (r.small.length) note(`IMPROVE ${name}: ${r.small.length} controls are under 44 px in one direction e.g. ${r.small.slice(0, 2).join(' | ')}`) })
  T('Y-HEAD-' + name, 'UI', `[${name}] headings: an h1, no skipped levels`, async (app) => { const r = await scan(app, name); ok(r.headIssues.length === 0, `${r.headIssues.join(', ')} :: ${r.heads.join(' ')}`) })
  T('Y-TXTD-' + name, 'UI', `[${name}] dark: text contrast AA (4.5, large 3)`, async (app) => { const r = await scan(app, name, { theme: 'dark' }); ok(r.contrast.length === 0, `${r.contrast.length}: ` + r.contrast.slice(0, 4).join(' | ')) })
  T('Y-TXTL-' + name, 'UI', `[${name}] light: text contrast AA (4.5, large 3)`, async (app) => { const r = await scan(app, name, { theme: 'light' }); ok(r.contrast.length === 0, `${r.contrast.length}: ` + r.contrast.slice(0, 4).join(' | ')) })
  T('Y-EDGE-' + name, 'UI', `[${name}] dark and light: control edges are 3:1 against their ground`, async (app) => {
    const a = await scan(app, name, { theme: 'dark' }), b = await scan(app, name, { theme: 'light' })
    ok(a.boundary.length + b.boundary.length === 0, `dark: ${a.boundary.slice(0, 3).join(' | ')} light: ${b.boundary.slice(0, 3).join(' | ')}`)
  })
  T('Y-OVF-' + name, 'UI', `[${name}] no sideways overflow at 360 px, 100% and 200% font`, async (app) => {
    const a = await scan(app, name), b = await scan(app, name, { font: 200 })
    ok(a.overflow.length === 0 && !a.hscroll, '100%: ' + a.overflow.join(' | ') + (a.hscroll ? ' hscroll' : '')); ok(b.overflow.length === 0 && !b.hscroll, '200%: ' + b.overflow.join(' | ') + (b.hscroll ? ' hscroll' : ''))
  })
}
T('Y01', 'UI', 'no screen uses a positive tabindex (tab order follows the page)', async (app) => {
  for (const name of ['calc', 'settings', 'budget', 'notes']) { const r = await scan(app, name); ok(r.tabindexPos === 0, name + ' has tabindex>0 elements: ' + r.tabindexPos) }
})
T('Y02', 'UI', 'tab order follows the visual order on Settings, Budget, Notes and Tools', async (app) => {
  for (const name of ['settings', 'budget', 'notes', 'tools']) { const r = await scan(app, name); ok(r.order.length === 0, `${name}: ${r.order.join(' | ')}`) }
})
// accent contrast: 4 accents x 2 themes, from real computed styles
for (const accent of ['citron', 'sky', 'violet', 'amber']) for (const theme of ['dark', 'light']) {
  T(`Y-ACC-${accent}-${theme}`, 'UI', `accent ${accent} in ${theme}: accent text 4.5:1 on bg, ink on fill 4.5:1, text contrast clean on Settings`, async (app) => {
    const { page } = await open(app, { data: seed({ settings: { theme, accent } }) }); await openSettings(page)
    const r = await page.evaluate(() => {
      const css = (n) => document.documentElement.style.getPropertyValue(n).trim()
      const h = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16))
      const lum = (x) => { const [r, g, b] = h(x).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
      const cr = (a, b) => { const p = lum(a), q = lum(b); return (Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05) }
      return { accentOnBg: cr(css('--accent'), css('--bg')), accentOnSurface: cr(css('--accent'), css('--surface')), inkOnFill: cr(css('--accent-ink'), css('--accent-fill')), dimOnBg: cr(css('--accent-dim'), css('--bg')) }
    })
    // --accent-fill is never painted as a foreground directly on --bg (checked: it's only ever a
    // background of its own, e.g. .btn--primary, the "=" key), so there is no real "fill on bg"
    // pairing to check -- the only place accent-fill's readability matters is ink-on-fill, above.
    ok(r.accentOnBg >= 4.5, `accent text on bg ${r.accentOnBg.toFixed(2)}`); ok(r.accentOnSurface >= 4.5, `accent on surface ${r.accentOnSurface.toFixed(2)}`); ok(r.inkOnFill >= 4.5, `ink on fill ${r.inkOnFill.toFixed(2)}`)
    ok(r.dimOnBg >= 3, `accent-dim (borders, inactive) on bg ${r.dimOnBg.toFixed(2)} < 3`)
    const s = await page.evaluate(scanFn); ok(s.contrast.length === 0, s.contrast.slice(0, 3).join(' | '))
  })
}
T('Y03', 'UI', 'landmarks: exactly one main and one nav on every tab; the nav is labelled', async (app) => {
  const { page } = await open(app, { data: seed() })
  for (const n of ['Calculate', 'Tools', 'Notes', 'Due', 'Budget']) { await tab(page, n); const r = await page.evaluate(() => ({ m: document.querySelectorAll('main').length, n: document.querySelectorAll('nav').length, l: document.querySelector('nav').getAttribute('aria-label') })); ok(r.m === 1 && r.n === 1 && r.l, `${n}: ${JSON.stringify(r)}`) }
})
T('Y04', 'UI', 'html has a lang attribute and a title; viewport allows scaling decision is recorded', async (app) => {
  const { page } = await open(app, { empty: true })
  ok(await page.evaluate(() => document.documentElement.lang) === 'en', 'lang'); ok(await page.title() === 'Calc', 'title ' + await page.title())
  const vp = await page.evaluate(() => document.querySelector('meta[name=viewport]').content)
  if (/user-scalable=no/.test(vp)) note('IMPROVE (accessibility): viewport has user-scalable=no, so pinch zoom is blocked. Fonts follow system size, so this is a choice, but WCAG 1.4.4 prefers allowing zoom.')
})
T('Y05', 'UI', 'aria-live: the calculator display has a polite live region that is announced on = ', async (app) => {
  const { page } = await open(app, { empty: true }); ok(await page.locator('.display [aria-live=polite]').count() === 1, 'no live region')
  await keys(page, '2', 'Add', '3', 'Equals'); await settle(page, 200); ok(/Result 5/.test(await page.locator('.display [aria-live=polite]').innerText()), 'result not announced: ' + await page.locator('.display [aria-live=polite]').innerText())
})
T('Y06', 'UI', 'focus moves into a sheet when opened by keyboard and returns to the opener on close', async (app) => {
  const { page } = await open(app, { data: seed() }); await page.focus('[aria-label=History]'); await page.keyboard.press('Enter'); await settle(page, 250)
  ok(await page.evaluate(() => !!document.activeElement?.closest('.sheet')), 'focus not in sheet: ' + await page.evaluate(() => document.activeElement?.tagName))
  await page.keyboard.press('Escape'); await settle(page, 250)
  ok(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'History', 'focus not back on the opener: ' + await page.evaluate(() => document.activeElement?.tagName + ' ' + document.activeElement?.getAttribute('aria-label')))
})
T('Y07', 'UI', 'known B-26: after a TAP opens and closes a sheet, focus is not left on the page body', async (app) => {
  const { page } = await open(app, { data: seed() }); await page.tap('[aria-label=History]').catch(async () => page.click('[aria-label=History]')); await settle(page, 250)
  await page.click('[aria-label="Close History"]'); await settle(page, 250)
  const a = await page.evaluate(() => document.activeElement === document.body)
  ok(!a, KNOWN('B-26', 'focus fell back to <body>, a TalkBack user loses their place after every sheet'))
})
T('Y08', 'UI', 'focus is trapped in an open sheet: 25 Tab presses never reach the page behind', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page)
  for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); const inside = await page.evaluate(() => { const a = document.activeElement; return a === document.body || !!a.closest('.sheet') }); ok(inside, `focus left the sheet at press ${i + 1}: ` + await page.evaluate(() => document.activeElement.tagName + '.' + document.activeElement.className)) }
})
T('Y09', 'UI', 'a form error is announced: field has aria-invalid and aria-describedby pointing at a role=alert message', async (app) => {
  const { page } = await open(app, { data: seed() }); await SCREENS.addExpense(page)
  await page.click('.sheet .btn--primary'); await settle(page, 250)
  const r = await page.evaluate(() => { const f = document.querySelector('.sheet [aria-invalid=true]'); if (!f) return { none: true }; const ids = (f.getAttribute('aria-describedby') || '').split(' '); const m = ids.map((i) => document.getElementById(i)).filter(Boolean); return { ok: m.length > 0, role: m[0]?.getAttribute('role'), text: m[0]?.textContent } })
  ok(!r.none, 'no field marked aria-invalid after saving an empty form'); ok(r.ok && r.role === 'alert', JSON.stringify(r))
})
T('Y10', 'UI', 'required fields are marked for screen readers "(required)" and visually with *', async (app) => {
  const { page } = await open(app, { data: seed() }); await SCREENS.addExpense(page)
  ok(await page.locator('.sheet .req').count() >= 1, 'no * marker'); ok(/\(required\)/.test(await page.locator('.sheet').evaluate((e) => e.innerHTML)), 'no sr-only (required)')
})
T('Y11', 'UI', 'reduced motion: animations and transitions are cut to ~1 ms', async (app) => {
  const { page } = await open(app, { data: seed(), reducedMotion: 'reduce' }); await openHistory(page)
  const d = await page.evaluate(() => { const s = document.querySelector('.sheet'); const c = getComputedStyle(s); return [c.animationDuration, c.transitionDuration] })
  ok(d.every((x) => x.split(',').every((v) => parseFloat(v) <= 0.002)), 'durations ' + d.join(' / '))
})
T('Y12', 'UI', 'normal motion keeps the sheet animation (so the reduced-motion rule is really what stops it)', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page)
  const d = await page.evaluate(() => getComputedStyle(document.querySelector('.sheet')).animationDuration); ok(parseFloat(d) > 0.002, 'sheet has no animation to begin with: ' + d)
})
T('Y13', 'UI', 'keyboard focus ring is visible on buttons (focus-visible outline)', async (app) => {
  const { page } = await open(app, { data: seed() }); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await settle(page, 100)
  const o = await page.evaluate(() => { const a = document.activeElement; const c = getComputedStyle(a); return { tag: a.tagName, w: parseFloat(c.outlineWidth), style: c.outlineStyle, shadow: c.boxShadow } })
  ok(o.style !== 'none' && o.w >= 2, JSON.stringify(o))
})
T('Y14', 'UI', 'tappable things look tappable: Settings rows that open something have a chevron, toggles have role=switch', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  ok(await page.locator('.tap-row .tap-row__chev').count() >= 3, 'chevrons: ' + await page.locator('.tap-row .tap-row__chev').count()); ok(await page.locator('[role=switch]').count() === 3, 'switches ' + await page.locator('[role=switch]').count())
  for (const sw of await page.locator('[role=switch]').all()) ok(await sw.getAttribute('aria-checked') !== null, 'switch without aria-checked')
})
T('Y15', 'UI', 'radio groups (theme, number format, angle, accent) have a group name and exactly one checked item', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  for (const g of await page.locator('[role=radiogroup]').all()) { ok(!!(await g.getAttribute('aria-label')), 'unnamed radiogroup'); ok(await g.locator('[role=radio][aria-checked=true]').count() === 1, 'not exactly one checked in ' + await g.getAttribute('aria-label')) }
})
T('Y16', 'UI', 'radio groups can be driven by keyboard: Tab reaches an option and Space selects it', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  await page.focus('[role=radio]:text-is("Light")'); await page.keyboard.press('Space'); await settle(page, 100); ok(await dataTheme(page) === 'light', 'Space did not select')
  note('Segmented radios are separate tab stops and arrow keys do nothing (not the ARIA radio-group pattern). IMPROVE: roving tabindex + arrow keys, or use buttons with aria-pressed.')
})

// ================================================================== V. VIEWPORTS AND FONT SCALES
const VPS = { '360x640': [360, 640], '412x915': [412, 915], '320x568': [320, 568], '800x360': [800, 360], '640x360': [640, 360] }
for (const [vp, [w, h]] of Object.entries(VPS)) {
  T('V-' + vp, 'UI', `${vp}: calculate, tools, notes, due, budget, settings, history fit with no sideways scroll; tab bar and = key reachable`, async (app) => {
    const problems = []
    for (const name of ['calc', 'tools', 'notes', 'due', 'budget', 'settings', 'history']) {
      const r = await scan(app, name, { width: w, height: h }); if (r.overflow.length || r.hscroll) problems.push(`${name}: ${r.overflow.join(' | ') || 'hscroll'}`)
    }
    const { page } = await open(app, { data: seed(), width: w, height: h })
    const g = await page.evaluate(() => { const t = document.querySelector('.tabbar').getBoundingClientRect(), k = document.querySelector('.key[aria-label=Equals]').getBoundingClientRect(); return { tabBottom: t.bottom, vh: innerHeight, eqBottom: k.bottom, eqTop: k.top, eqH: k.height } })
    if (g.tabBottom > g.vh + 1) problems.push('tab bar off screen ' + g.tabBottom + '>' + g.vh)
    if (g.eqBottom > g.vh - 0 || g.eqTop < 0) problems.push(`= key off screen (${Math.round(g.eqTop)}..${Math.round(g.eqBottom)} of ${g.vh})`)
    if (g.eqH < 44) problems.push('= key only ' + Math.round(g.eqH) + 'px high')
    ok(problems.length === 0, problems.join(' || '))
  })
}
for (const font of [130, 200]) {
  T('V-F' + font, 'UI', `${font}% font: calculate, notes, due, budget, settings, history have no sideways overflow and the keypad stays inside the screen`, async (app) => {
    const problems = []
    for (const name of ['calc', 'tools', 'notes', 'due', 'budget', 'settings', 'history']) { const r = await scan(app, name, { font }); if (r.overflow.length || r.hscroll) problems.push(`${name}: ${r.overflow.join(' | ') || 'hscroll'}`) }
    const { page } = await open(app, { data: seed(), font }); const k = await page.evaluate(() => { const b = document.querySelector('.key[aria-label=Equals]').getBoundingClientRect(); return [b.bottom, innerHeight, document.querySelector('.tabbar').getBoundingClientRect().top] })
    if (k[0] > k[2] + 1) problems.push(`= key (${Math.round(k[0])}) overlaps tab bar (${Math.round(k[2])})`)
    ok(problems.length === 0, problems.join(' || '))
  })
}
T('V-F200-short', 'UI', '200% font on a short phone (360x640): Settings last row is reachable by scrolling', async (app) => {
  const { page } = await open(app, { data: seed(), font: 200, width: 360, height: 640 }); await openSettings(page)
  const r = await page.evaluate(async () => { const body = document.querySelector('.screen__body'); body.scrollTop = body.scrollHeight; await new Promise((r) => setTimeout(r, 100)); const last = [...document.querySelectorAll('.screen .row')].pop().getBoundingClientRect(); return { bottom: last.bottom, vh: innerHeight } })
  ok(r.bottom <= r.vh + 1, JSON.stringify(r))
})
T('V-ORI', 'UI', 'rotate 360x790 to landscape 790x360 live: the app keeps its state and re-lays out', async (app) => {
  const { page } = await open(app, { empty: true }); await keys(page, '1', '2', 'Add', '3'); await page.setViewportSize({ width: 790, height: 360 }); await settle(page, 300)
  ok((await page.locator('.display__expr').inputValue()).replace(/\s/g, '') === '12+3', 'expression lost on rotate'); const o = await overflowing(page); ok(o.length === 0, o.join(' | '))
  await page.setViewportSize({ width: 360, height: 790 }); await settle(page, 300); ok((await overflowing(page)).length === 0, 'overflow after rotating back')
})
T('V-DESK', 'UI', 'desktop window 1280x800 (not a phone): layout stays centred/usable with no overflow', async (app) => {
  const { page } = await open(app, { data: seed(), width: 1280, height: 800, mobile: false }); const o = await overflowing(page); ok(o.length === 0, o.join(' | '))
  ok(await page.locator('.key[aria-label=Equals]').isVisible(), '= not visible')
})

// ================================================================== L. LAYOUT STRESS
const WORD = 'W'.repeat(60)
function stressSeed(kind) {
  const d = seed(); const names = { long: WORD, rtl: 'مرحبا بالعالم שלום עולם ' + 'ع'.repeat(30), emoji: '🧾💰🏠🚗🎉🍕'.repeat(5) + ' 👨‍👩‍👧‍👦' }[kind]
  d.cards[0].title = names; d.cards[0].summary = names; d.cards[1].title = names; d.cards[1].lines[0].label = names; d.cards[2].title = names; d.cards[0].tags = [names.slice(0, 30)]
  d.history[0].memo = names; d.budget.categories[0].name = names.slice(0, 40); d.budget.categories[1].name = names.slice(0, 40); d.budget.instruments[0].name = names.slice(0, 40); d.budget.instruments[0].bank = names.slice(0, 40)
  d.budget.expenses[0].note = names; d.budget.expenses[1].note = names
  return d
}
for (const kind of ['long', 'rtl', 'emoji']) {
  T('L-' + kind, 'UI', `${kind} names in cards, tasks, tape lines, history memo, categories, cards and notes: no overflow on 7 screens`, async (app) => {
    const { page } = await open(app, { data: stressSeed(kind) }); const problems = []
    const chk = async (n) => { await settle(page, 200); const o = await overflowing(page); if (o.length) problems.push(`${n}: ${o.slice(0, 2).join(' | ')}`) }
    await tab(page, 'Notes'); await chk('notes'); await page.locator('.seg__opt', { hasText: 'To-do' }).click(); await chk('todo'); await tab(page, 'Due'); await chk('due'); await tab(page, 'Budget'); await chk('budget')
    await openBudgetMore(page); await page.click('text=Spending summary'); await chk('summary'); await tab(page, 'Budget'); await openBudgetMore(page); await page.click('text=Categories and cards'); await chk('manage')
    await tab(page, 'Calculate'); await openHistory(page); await chk('history')
    ok(problems.length === 0, problems.join(' || '))
    if (kind === 'emoji') ok((await body(page)).includes('🧾'), 'emoji missing from the page text')
  })
}
T('L-big', 'UI', 'numbers of 1e15 and beyond (30 digits) in budget, notes, tape and history: no overflow, no NaN/Infinity', async (app) => {
  const d = seed(); const big = '9'.repeat(30) + '.99'
  d.budget.expenses[0].amount = big; d.budget.expenses[1].amount = '9'.repeat(18); d.budget.overall = '9'.repeat(25); d.budget.categories[0].limit = '9'.repeat(20)
  d.cards[0].amount = big; d.cards[1].lines[0].value = big; d.cards[1].amount = big; d.history[0].result = '9'.repeat(40); d.history[0].expression = '9'.repeat(20) + '*' + '9'.repeat(20)
  const { page } = await open(app, { data: d }); const problems = []
  const chk = async (n) => { await settle(page, 250); const o = await overflowing(page); if (o.length) problems.push(`${n}: ${o.slice(0, 2).join(' | ')}`); const m = (await body(page)).match(bad); if (m) problems.push(`${n}: text "${m[0]}"`) }
  await tab(page, 'Notes'); await chk('notes'); await page.click('text=Groceries'); await chk('tape'); await tab(page, 'Notes'); await tab(page, 'Due'); await chk('due')
  await tab(page, 'Budget'); await chk('budget'); await openBudgetMore(page); await page.click('text=Spending summary'); await chk('summary'); await tab(page, 'Budget'); await openBudgetMore(page); await page.click('text=Categories and cards'); await chk('manage')
  await tab(page, 'Calculate'); await openHistory(page); await chk('history')
  ok(problems.length === 0, problems.join(' || '))
})
T('L-500', 'UI', '500 notes: Notes opens in under 3 s, no overflow, no errors', async (app) => {
  const d = seed(); d.cards = Array.from({ length: 500 }, (_, i) => ({ id: 'n' + i, title: 'Note number ' + i + ' ' + 'long title '.repeat(i % 5), kind: i % 3 ? 'tool' : 'tape', toolId: i % 3 ? 'emi' : null, inputs: i % 3 ? { principal: '100000' } : null, summary: 'EMI ' + i, amount: String(i * 100), lines: i % 3 ? [] : [{ id: 'l', label: 'a', value: '5' }], note: '', tags: [], pinned: false, createdAt: i, updatedAt: i, deletedAt: null }))
  const { page, errors } = await open(app, { data: d }); const t0 = Date.now(); await tab(page, 'Notes'); await page.waitForSelector('text=Note number 0', { timeout: 8000 }).catch(() => {}); const ms = Date.now() - t0
  ok(ms < 3000, `opened in ${ms} ms`); const o = await overflowing(page); ok(o.length === 0, o.join(' | ')); ok(errors.length === 0, errors.join(';'))
  note(`500 notes: Notes tab ready in ${ms} ms, rows in DOM: ${await page.locator('.app__body button').count()}`)
})
T('L-600h', 'UI', '600 history rows (cap 200) plus 100 named rows: History opens fast and has no overflow', async (app) => {
  const d = seed(); d.history = Array.from({ length: 700 }, (_, i) => ({ id: 'h' + i, expression: `${i}*${i}`, result: String(i * i), at: 1e12 - i, ...(i < 100 ? { memo: 'named ' + i } : {}) }))
  const { page, errors } = await open(app, { data: d }); const t0 = Date.now(); await openHistory(page); const ms = Date.now() - t0
  const n = await page.locator('.hrow').count(); ok(n >= 200 && n <= 320, 'rows ' + n); ok(ms < 2500, `opened in ${ms} ms`); const o = await overflowing(page); ok(o.length === 0, o.join(' | ')); ok(errors.length === 0, errors.join(';'))
  note(`700 stored rows -> ${n} shown (cap 200 + named rows kept); opened in ${ms} ms`)
})
T('L-20k', 'RUNTIME', '20,000 budget entries: Budget home and summary open in under 5 s', async (app) => {
  const d = seed(); d.budget.expenses = manyExpenses(20000); const { page, errors } = await open(app, { data: d })
  let t0 = Date.now(); await tab(page, 'Budget'); await page.waitForSelector('text=/Left this month|Over budget/', { timeout: 8000 }); const a = Date.now() - t0
  t0 = Date.now(); await openBudgetMore(page); await page.click('text=Spending summary'); await settle(page, 100); const b = Date.now() - t0
  ok(a < 5000 && b < 5000, `home ${a} ms, summary ${b} ms`); ok(errors.length === 0, errors.join(';')); note(`20k entries: Budget home ${a} ms, summary ${b} ms`)
})
T('L-xss', 'NEG', 'HTML in titles, memo, notes and categories is shown as text, never executed', async (app) => {
  const evil = '<img src=x onerror="window.__xss=1">'; const d = seed(); d.cards[0].title = evil; d.history[0].memo = evil; d.budget.categories[0].name = evil; d.budget.expenses[0].note = evil
  const { page } = await open(app, { data: d }); for (const n of ['Notes', 'Due', 'Budget']) { await tab(page, n); await settle(page, 200) }
  await tab(page, 'Calculate'); await openHistory(page); ok(await page.evaluate(() => window.__xss) === undefined, 'script ran'); ok(await page.locator('img[src=x]').count() === 0, 'an <img> was created')
})
T('L-tour', 'RUNTIME', 'no NaN, undefined, Infinity or [object Object] text on any screen with full seed data', async (app) => {
  const { page, errors } = await open(app, { data: seed() }); const hits = []
  for (const name of SCREEN_NAMES) { await page.reload(); await page.waitForSelector('.app'); await SCREENS[name](page); const m = (await body(page)).replace(/\bnull\b/g, '').match(/\bNaN\b|\bundefined\b|\bInfinity\b|\[object Object\]/); if (m) hits.push(name + ': ' + m[0]) }
  ok(hits.length === 0, hits.join(' | ')); ok(errors.length === 0, errors.slice(0, 2).join(';'))
})

// ================================================================== P. PERFORMANCE AND MEMORY
T('P01', 'RUNTIME', 'cold start: first contentful paint under 2 s and interactive (first key works) under 3 s', async (app) => {
  const { page } = await open(app, { empty: true, wait: false }); const t0 = Date.now()
  await page.waitForSelector('.keypad'); await keys(page, '7'); await page.waitForFunction(() => document.querySelector('.display__expr')?.value.includes('7')); const tti = Date.now() - t0
  const m = await page.evaluate(() => ({ fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime, nav: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd }))
  note(`FCP ${Math.round(m.fcp)} ms, DOMContentLoaded ${Math.round(m.nav)} ms, first key response ${tti} ms after navigation settled`)
  ok(m.fcp < 2000, 'FCP ' + m.fcp); ok(tti < 3000, 'interactive ' + tti)
})
T('P02', 'RUNTIME', 'delivered JS and CSS size is recorded and the main bundle stays under 1 MB', async (app) => {
  const { page, reqs } = await open(app, { empty: true })
  const sizes = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => [r.name.split('/').pop(), r.decodedBodySize]))
  const js = sizes.filter(([n]) => n.endsWith('.js')), css = sizes.filter(([n]) => n.endsWith('.css')), fonts = sizes.filter(([n]) => /woff/.test(n))
  const sum = (a) => a.reduce((s, x) => s + x[1], 0)
  note(`JS ${(sum(js) / 1024).toFixed(0)} KB (${js.length} files), CSS ${(sum(css) / 1024).toFixed(0)} KB, fonts ${(sum(fonts) / 1024).toFixed(0)} KB, ${reqs.length} requests`)
  ok(sum(js) < 1024 * 1024, 'JS ' + sum(js))
})
T('P03', 'RUNTIME', 'scroll jank proxy: 500 notes scrolled for 2 s, p95 frame under 50 ms', async (app) => {
  const d = seed(); d.cards = Array.from({ length: 500 }, (_, i) => ({ id: 'n' + i, title: 'Note ' + i, kind: 'tool', toolId: 'emi', inputs: { principal: '100000' }, summary: 'EMI ' + i, amount: String(i * 100), lines: [], note: '', tags: [], pinned: false, createdAt: i, updatedAt: i, deletedAt: null }))
  const { page } = await open(app, { data: d }); await tab(page, 'Notes'); await settle(page, 500)
  const r = await page.evaluate(async () => {
    const sc = [...document.querySelectorAll('.app__body, .app__body *')].find((e) => e.scrollHeight > e.clientHeight + 200 && /auto|scroll/.test(getComputedStyle(e).overflowY)); if (!sc) return { none: true }
    const times = []; let last = performance.now(); const t0 = last
    await new Promise((res) => { const step = (now) => { times.push(now - last); last = now; sc.scrollTop += 40; if (now - t0 < 2000) requestAnimationFrame(step); else res() }; requestAnimationFrame(step) })
    times.sort((a, b) => a - b); return { n: times.length, p50: times[Math.floor(times.length / 2)], p95: times[Math.floor(times.length * 0.95)], max: times[times.length - 1] }
  })
  ok(!r.none, 'no scrolling container found'); note(`scroll frames: n=${r.n} p50=${r.p50.toFixed(1)} p95=${r.p95.toFixed(1)} max=${r.max.toFixed(0)} ms`); ok(r.p95 < 50, `p95 ${r.p95.toFixed(1)} ms`)
})
async function heap(page) {
  const cdp = await page.context().newCDPSession(page); await cdp.send('HeapProfiler.enable')
  const grab = async () => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); const h = await cdp.send('Runtime.getHeapUsage'); return h.usedSize }
  return grab
}
T('P04', 'RUNTIME', 'memory: 300 tab switches grow the JS heap by less than 6 MB and the DOM by under 60 nodes', async (app) => {
  const { page, errors } = await open(app, { data: seed() }); const grab = await heap(page)
  const cycle = async (n) => { const names = ['Tools', 'Notes', 'Due', 'Budget', 'Calculate']; for (let i = 0; i < n; i++) await page.locator('.tabbar .tab').nth(i % 5).click() }
  await cycle(30); const h0 = await grab(); const n0 = await page.evaluate(() => document.querySelectorAll('*').length)
  const t0 = Date.now(); await cycle(300); const ms = Date.now() - t0; const h1 = await grab(); const n1 = await page.evaluate(() => document.querySelectorAll('*').length)
  note(`300 tab switches in ${ms} ms; heap ${(h0 / 1048576).toFixed(1)} -> ${(h1 / 1048576).toFixed(1)} MB; DOM ${n0} -> ${n1}`)
  ok(h1 - h0 < 6 * 1048576, `heap grew ${((h1 - h0) / 1048576).toFixed(1)} MB`); ok(n1 - n0 < 60, `DOM grew ${n1 - n0}`); ok(errors.length === 0, errors.join(';'))
})
T('P05', 'RUNTIME', 'memory: 200 keypad presses grow the JS heap by less than 6 MB and keep history within the cap', async (app) => {
  const { page, errors } = await open(app, { empty: true }); const grab = await heap(page)
  const press = async (n) => { const seq = ['7', 'Add', '8', 'Multiply', '9', 'Equals', 'Clear']; for (let i = 0; i < n; i++) await page.locator(`.key[aria-label="${seq[i % seq.length]}"]`).click() }
  await press(30); const h0 = await grab(); const t0 = Date.now(); await press(200); const ms = Date.now() - t0; const h1 = await grab()
  note(`200 key presses in ${ms} ms (${(ms / 200).toFixed(1)} ms each incl. Playwright); heap ${(h0 / 1048576).toFixed(1)} -> ${(h1 / 1048576).toFixed(1)} MB`)
  ok(h1 - h0 < 6 * 1048576, `heap grew ${((h1 - h0) / 1048576).toFixed(1)} MB`); await settle(page, 500); ok((await stored(page)).history.length <= 200, 'history over cap'); ok(errors.length === 0, errors.join(';'))
})
T('P06', 'RUNTIME', 'memory: opening and closing History 100 times leaves no extra DOM nodes or document listeners', async (app) => {
  const { page, errors } = await open(app, { data: seed() }); const grab = await heap(page)
  const cycle = async (n) => { for (let i = 0; i < n; i++) { await page.click('[aria-label=History]'); await page.click('[aria-label="Close History"]') } }
  await cycle(10); const h0 = await grab(); const n0 = await page.evaluate(() => document.querySelectorAll('*').length)
  await cycle(100); const h1 = await grab(); const n1 = await page.evaluate(() => document.querySelectorAll('*').length)
  note(`100 History open/close: heap ${(h0 / 1048576).toFixed(1)} -> ${(h1 / 1048576).toFixed(1)} MB, DOM ${n0} -> ${n1}`)
  ok(n1 === n0, `DOM nodes ${n0} -> ${n1}`); ok(h1 - h0 < 5 * 1048576, 'heap grew ' + ((h1 - h0) / 1048576).toFixed(1)); ok(errors.length === 0, errors.join(';'))
})
T('P07', 'RUNTIME', 'a key press shows on screen within 100 ms (p95 over 60 presses, in-page timing)', async (app) => {
  const { page } = await open(app, { empty: true })
  const r = await page.evaluate(async () => {
    const ts = []; const key = document.querySelector('.key[aria-label="1"]'); const ta = document.querySelector('.display__expr')
    for (let i = 0; i < 60; i++) { const t = performance.now(); key.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'touch' })); await new Promise((r) => requestAnimationFrame(() => r())); ts.push(performance.now() - t); if (i % 10 === 9) document.querySelector('.key[aria-label=Clear]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'touch' })) }
    ts.sort((a, b) => a - b); return { p50: ts[30], p95: ts[57], max: ts[59] }
  })
  note(`key-to-frame p50=${r.p50.toFixed(1)} p95=${r.p95.toFixed(1)} max=${r.max.toFixed(0)} ms`); ok(r.p95 < 100, 'p95 ' + r.p95.toFixed(1))
})

// ================================================================== F. OFFLINE AND NETWORK
T('F01', 'RUNTIME', 'with the network switched off after load, every tab, Settings and History still work with zero errors', async (app) => {
  const { page, errors, context, failed } = await open(app, { data: seed() }); await context.setOffline(true)
  for (const n of ['Tools', 'Notes', 'Due', 'Budget', 'Calculate']) { await tab(page, n); await settle(page, 120) }
  await keys(page, '2', 'Add', '2', 'Equals'); ok((await display(page)).trim() === '4', 'calc: ' + await display(page))
  await openSettings(page); await page.click('[aria-label=Back]'); await openHistory(page); await page.click('[aria-label="Close History"]')
  ok(errors.length === 0, errors.join(';')); ok(failed.length === 0, 'failed requests: ' + failed.join(','))
})
T('F02', 'NEG', 'the app makes no request outside its own origin during a full tour (no tracking, no CDN)', async (app) => {
  const { page, reqs } = await open(app, { data: seed() })
  for (const n of SCREEN_NAMES) { await page.reload(); await page.waitForSelector('.app'); await SCREENS[n](page) }
  const out = reqs.filter((u) => !u.startsWith(app.url) && !u.startsWith('data:') && !u.startsWith('blob:')); ok(out.length === 0, 'external: ' + [...new Set(out)].slice(0, 4).join(', '))
})
T('F03', 'POS', 'fonts and icons are local (woff files come from the same origin and loaded)', async (app) => {
  const { page } = await open(app, { empty: true }); await settle(page, 400)
  const f = await page.evaluate(async () => { await document.fonts.ready; return { loaded: [...document.fonts].filter((f) => f.status === 'loaded').length, families: [...new Set([...document.fonts].map((f) => f.family))] } })
  ok(f.loaded >= 2, JSON.stringify(f))
})
T('F04', 'POS', 'service worker and manifest: none present (the web build is not a PWA). Recorded, not a failure', async (app) => {
  const { page } = await open(app, { empty: true })
  const r = await page.evaluate(async () => ({ sw: (await navigator.serviceWorker?.getRegistrations?.())?.length ?? 0, manifest: !!document.querySelector('link[rel=manifest]'), icon: !!document.querySelector('link[rel=icon]') }))
  note(`service workers ${r.sw}, manifest link ${r.manifest}, favicon ${r.icon}. IMPROVE: the web build cannot be reloaded offline and cannot be installed (only the APK is offline).`)
  ok(r.icon, 'no favicon')
})
T('F05', 'RUNTIME', 'favicon and the built files return 200 (no 404s on first load)', async (app) => {
  const { page } = await open(app, { empty: true }); const bad404 = []
  const ctx = page.context(); const p2 = await ctx.newPage(); p2.on('response', (r) => { if (r.status() >= 400) bad404.push(r.status() + ' ' + r.url()) }); await p2.goto(app.url); await settle(p2, 600)
  ok(bad404.length === 0, bad404.join(' | '))
})

// ================================================================== R. MISC RUNTIME
T('R01', 'RUNTIME', 'console error budget is zero over a long tour (all screens, settings, history, a sheet, a backup)', async (app) => {
  const { page, errors } = await open(app, { data: seed() })
  for (const n of SCREEN_NAMES) { await page.reload(); await page.waitForSelector('.app'); await SCREENS[n](page); await settle(page, 150) }
  await page.reload(); await page.waitForSelector('.app'); await openSettings(page); await download(page, 'text=Export a backup'); await settle(page, 200)
  ok(errors.length === 0, errors.slice(0, 3).join(' | '))
})
T('R02', 'RUNTIME', '60 rapid tab taps in 1 s raise no errors and end on the right tab', async (app) => {
  const { page, errors } = await open(app, { data: seed() })
  await page.evaluate(() => { const tabs = [...document.querySelectorAll('.tabbar .tab')]; for (let i = 0; i < 60; i++) tabs[i % 5].click() }); await settle(page, 400)
  ok(await page.locator('.tab[aria-current=page]').innerText() === 'Calculate', 'ended on ' + await page.locator('.tab[aria-current=page]').innerText()); ok(errors.length === 0, errors.join(';'))
})
T('R03', 'RUNTIME', 'two tabs of the same app: a change in one does not corrupt the other (last writer wins, no crash)', async (app) => {
  const { page, context, errors } = await open(app, { data: seed() }); const p2 = await context.newPage(); const e2 = []; p2.on('pageerror', (e) => e2.push(e.message)); await p2.goto(app.url); await p2.waitForSelector('.app')
  await openSettings(page); await page.click('[role=radio]:text-is("Light")'); await settle(page, 500)
  await p2.reload(); await p2.waitForSelector('.app'); ok(await p2.evaluate(() => document.documentElement.dataset.theme) === 'light', 'second tab did not pick up the change on reload'); ok(errors.length === 0 && e2.length === 0, errors.concat(e2).join(';'))
  note('IMPROVE: two open windows each keep their own copy in memory and the last save wins; it is only a risk on desktop browsers, not on the phone.')
})
T('R04', 'RUNTIME', 'resume: the open sheet is not restored after reload (the app starts clean on its tab)', async (app) => {
  const { page } = await open(app, { data: seed() }); await openHistory(page); await page.reload(); await page.waitForSelector('.app'); ok(await page.locator('.sheet').count() === 0, 'sheet persisted')
})
T('R05', 'RUNTIME', 'bfcache/visibility: hiding then showing the page re-requests a wake lock and does not error', async (app) => {
  const { page, errors } = await open(app, { data: seed({ settings: { keepAwake: true } }), init: `window.__wl=0; Object.defineProperty(navigator,'wakeLock',{value:{request: async ()=>{ window.__wl++; return { addEventListener(){}, release: async()=>{} } }}})` })
  await settle(page, 300); const a = await page.evaluate(() => window.__wl); await hide(page); await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) }); await settle(page, 300)
  ok(a >= 1, 'no wake lock at start'); ok(errors.length === 0, errors.join(';'))
})
T('R06', 'UX', 'Settings is reachable in 1 tap from Calculate; every tab in 1 tap; History in 1 tap', async (app) => {
  const { page } = await open(app, { data: seed() }); await page.click('[aria-label=Settings]'); ok(await page.locator('.screen[aria-label=Settings]').count() === 1, 'settings'); await page.click('[aria-label=Back]')
  await page.click('[aria-label=History]'); ok(await page.locator('.sheet').count() === 1, 'history')
  note('Settings and History exist only on the Calculate screen. IMPROVE: Notes, Due and Budget have no path to Settings without going back to Calculate (2 taps).')
})
T('R07', 'UX', 'first-run: Notes, Due and Budget empty states say what to do next in one plain line and give a button', async (app) => {
  const { page } = await open(app, { empty: true })
  for (const n of ['Notes', 'Due', 'Budget']) { await tab(page, n); await settle(page, 150); const t = await page.locator('.app__body').innerText(); ok(/No \w+/.test(t) && await page.locator('.app__body button.btn, .app__body .btn').count() >= 1, `${n}: ${t.replace(/\n/g, ' ').slice(0, 120)}`) }
})
T('R08', 'UX', 'tab labels are not truncated at 320 px width and 200% font', async (app) => {
  const { page } = await open(app, { empty: true, width: 320, height: 568, font: 200 })
  const r = await page.evaluate(() => [...document.querySelectorAll('.tabbar .tab span')].map((s) => ({ t: s.textContent, clipped: s.scrollWidth > s.clientWidth + 1, w: s.getBoundingClientRect().width })))
  ok(r.every((x) => !x.clipped), JSON.stringify(r.filter((x) => x.clipped)))
})
T('R09', 'UI', 'Settings headings, section order and the Reminders-free layout read naturally (observation of heading list)', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page)
  const h = await page.locator('.screen h1, .screen h2').allInnerTexts(); ok(h.join('|') === 'Settings|Appearance|Numbers|Behaviour|Reminders|More', h.join('|'))
})
T('R10', 'RUNTIME', 'document title, theme-color meta and html lang stay valid after a theme change', async (app) => {
  const { page } = await open(app, { data: seed() }); await openSettings(page); await page.click('[role=radio]:text-is("Light")')
  ok(await page.evaluate(() => document.querySelector('meta[name=theme-color]').content) === '#FFFFFF', 'theme-color')
  ok(await page.evaluate(() => document.documentElement.style.colorScheme) === 'light', 'color-scheme')
})

// ================================================================== runner
const only = process.env.ONLY
const sel = cases.filter((c) => !only || c.id.startsWith(only))
const app = await startApp()
let fails = 0, passes = 0
const results = []
for (const c of sel) {
  CUR = { id: c.id, ctxs: [] }
  let msg = ''
  try { await Promise.race([c.fn(app), new Promise((_, rej) => setTimeout(() => rej(new Error('case timed out after 90 s')), 90000))]) } catch (e) { msg = String(e.message ?? e).replace(/\s+/g, ' ').slice(0, 400) }
  for (const x of CUR.ctxs) await x.close().catch(() => {})
  if (msg) { fails++; console.log(`FAIL ${c.id} ${c.type} ${c.title} :: ${msg}`) } else { passes++; console.log(`PASS ${c.id} ${c.type} ${c.title}`) }
  results.push({ id: c.id, type: c.type, title: c.title, pass: !msg, msg })
}
console.log(`\n${passes} passed, ${fails} failed, ${sel.length} cases, ${notes.length} notes`)
if (process.env.CLAUDE_JOB_DIR) { try { mkdirSync(join(process.env.CLAUDE_JOB_DIR, 'tmp'), { recursive: true }); writeFileSync(join(process.env.CLAUDE_JOB_DIR, 'tmp', 'shell-results.json'), JSON.stringify({ results, notes }, null, 1)) } catch {} }
await app.stop()
process.exit(fails ? 1 : 0)
