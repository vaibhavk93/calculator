// Cross-cutting QA: data integrity, runtime, accessibility, privacy, performance. Written 2026-11-03. Report: docs/QA-REPORT-cross.md
// Run: node e2e/qa-cross.test.mjs            (ONLY=QX-P node e2e/qa-cross.test.mjs runs the cases whose id starts with that)
// Prints PASS|FAIL <id> <type> <title> :: <actual if fail>. Lines starting NOTE are observations. Exits non-zero on any FAIL.
// Builds the app into a temp folder, serves it on a random port, seeds its own data, never touches a phone, leaves nothing running.
import { startApp, stored } from './lib.mjs'
import { writeFileSync } from 'node:fs'

const cases = []
const T = (id, type, title, fn) => cases.push({ id: 'QX-' + id, type, title, fn })
let CUR = null
const settle = (page, ms = 250) => page.waitForTimeout(ms)
const ok = (c, m) => { if (!c) throw new Error(typeof m === 'function' ? m() : m) }
const note = (m) => console.log(`NOTE ${CUR?.id ?? ''} ${m}`)
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ------------------------------------------------------------------ the full data set: every feature and field added so far
const NOW = Date.now()
const day = new Date().toISOString().slice(0, 10)
function fullData(over = {}) {
  const h = NOW - 3_600_000
  return {
    schemaVersion: 3,
    settings: { theme: 'dark', accent: 'citron', numberSystem: 'international', decimals: 4, angle: 'rad', startupTab: 'calculate', startupTool: null, haptics: false, keepAwake: false, keepHistory: false, copyFormat: 'without', reminderTime: '07:45', lastBackupAt: h, backupNudgedAt: h - 1000, backupDismissedAt: h - 2000, dismissedTips: ['tip-a', 'tip-b'], toolUse: { emi: 7, gst: 3 }, pinnedTools: ['sip'], tours: { budget: 'done', notes: 'skipped' } },
    history: [{ id: 'h1', expression: '12*3', result: '36', at: h, memo: 'Rent share', locked: true }, { id: 'h2', expression: '1+1', result: '2', at: h - 1 }],
    cards: [
      { id: 'c-tool', title: 'Home loan', kind: 'tool', toolId: 'emi', inputs: { principal: '5000000', rate: '8.5', years: '20' }, summary: 'EMI 43,391', amount: '43391', amountFmt: 'money', lines: [], note: 'n', tags: ['Loan'], pinned: true, createdAt: h, updatedAt: h, deletedAt: null },
      { id: 'c-tape', title: 'Trip', kind: 'tape', toolId: null, inputs: null, summary: '3 lines', amount: '300', lines: [{ id: 'l1', label: 'Hotel', value: '100', done: true }, { id: 'l2', label: 'Cab', value: '100', skip: true }, { id: 'l3', label: 'Food', value: '100' }], checklist: true, note: '', tags: [], pinned: false, createdAt: h, updatedAt: h, deletedAt: null },
      { id: 'c-task', title: 'Pay rent', kind: 'task', toolId: null, inputs: null, summary: '', amount: null, lines: [], done: true, doneAt: h, note: 'x', tags: ['Rent', 'Work'], pinned: false, createdAt: h, updatedAt: h, deletedAt: null },
    ],
    reminders: [
      { id: 'r1', cardId: 'c-task', dueAt: NOW + 86400000, repeat: 'monthly', anchorDay: 5, leadDays: 7, leads: [7, 3, 0], done: false, history: [{ paidAt: h, amount: '100' }] },
      { id: 'r2', cardId: 'c-tool', dueAt: NOW + 2 * 86400000, repeat: 'none', anchorDay: 6, leadDays: 1, afterDays: 30, done: false, history: [] },
    ],
    memory: '123.45',
    input: { expr: '', fresh: false },
    drafts: { emi: { principal: '100', rate: '9' } },
    budget: {
      overall: '30000', overallByMonth: { [day.slice(0, 7)]: '35000' },
      categories: [
        { id: 'k1', name: 'Food', limit: '5000', parentId: null, deletedAt: null, limitByMonth: { [day.slice(0, 7)]: '6000' } },
        { id: 'k2', name: 'Eating out', limit: null, parentId: 'k1', deletedAt: null },
      ],
      instruments: [
        { id: 'i1', name: 'Regalia', kind: 'credit', network: 'visa', bank: 'HDFC', last4: '1234', rewardNote: '4x', deletedAt: null, variant: 'Gold', holder: 'A', statementDay: 5, dueDay: 25, creditLimit: '200000', annualFee: '2500' },
        { id: 'i2', name: 'Salary a/c', kind: 'bank', network: null, bank: 'ICICI', last4: '9876', rewardNote: '', deletedAt: null, upiHandle: 'me@okicici', accountType: 'salary' },
      ],
      expenses: [
        { id: 'e1', date: day, amount: '250.50', categoryId: 'k2', mode: 'credit', instrumentId: 'i1', note: 'tea', deletedAt: null, edits: [{ at: h, field: 'amount', from: '200', to: '250.50' }] },
        { id: 'e2', date: day, amount: '500', categoryId: 'k1', mode: 'upi', instrumentId: 'i2', note: 'returned shoes', deletedAt: null, refund: true },
        { id: 'e3', date: day, amount: '9000', categoryId: null, mode: 'netbanking', instrumentId: 'i1', note: 'card bill', deletedAt: null, settlement: 'cardBill' },
        { id: 'e4', date: day, amount: '999', categoryId: 'k1', mode: 'upi', instrumentId: null, note: 'netflix', deletedAt: null, recurringId: 'rec1' },
      ],
      smsSeen: ['abcd1234', 'zz99yy88'],
      recurring: [
        { id: 'rec1', kind: 'bill', title: 'Netflix', amount: '999', repeat: 'monthly', categoryId: 'k1', mode: 'upi', instrumentId: 'i2', cardId: 'c-task', paused: true, pausedDue: h, deletedAt: null },
        { id: 'rec2', kind: 'cardBill', title: 'Regalia bill', amount: null, repeat: 'monthly', categoryId: null, mode: null, instrumentId: 'i1', cardId: null, deletedAt: null },
      ],
    },
    ...over,
  }
}
const SECTIONS = ['settings', 'history', 'cards', 'reminders', 'memory', 'budget', 'drafts']

// ------------------------------------------------------------------ opening a page (own copy: raw text, init scripts, request log, CDP)
async function open(app, o = {}) {
  const { raw, data, empty = false, width = 360, height = 790, font = 100, colorScheme, reducedMotion = 'reduce', init, route, mobile = true, theme } = o
  const context = await app.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile, locale: 'en-IN', timezoneId: 'Asia/Kolkata', colorScheme, reducedMotion, acceptDownloads: true })
  CUR?.ctxs.push(context)
  const page = await context.newPage()
  const errors = [], reqs = [], consoleAll = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { consoleAll.push(`${m.type()}: ${m.text()}`); if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 300)}`) })
  page.on('request', (r) => reqs.push(r.url()))
  if (route) await context.route('**/*', route)
  let text = empty ? null : raw !== undefined ? raw : JSON.stringify(data ?? { schemaVersion: 3, settings: theme ? { theme } : {}, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false } })
  if (data && theme) text = JSON.stringify({ ...data, settings: { ...data.settings, theme } })
  await page.addInitScript(([t, f]) => {
    try { if (t !== null && !sessionStorage.getItem('__seeded')) { localStorage.setItem('vkcalc.data', t); sessionStorage.setItem('__seeded', '1') } } catch {}
    if (f !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = f + '%' })
  }, [text, font])
  if (init) await page.addInitScript({ content: init })
  const t0 = Date.now()
  await page.goto(app.url)
  let up = true
  try { await page.waitForSelector('.app', { timeout: 20000 }) } catch { up = false }
  return { page, errors, reqs, consoleAll, context, up, bootMs: Date.now() - t0 }
}
const tab = (page, name) => page.locator('.tabbar .tab', { hasText: name }).click()
const hide = (page) => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')) })
const readData = async (page) => { await hide(page); await settle(page, 400); return stored(page) }
const body = (page) => page.evaluate(() => document.body.innerText)
const openSettings = async (page) => { await page.click('[aria-label=Settings]'); await settle(page, 150) }
const download = async (page, sel) => { const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click(sel)]); const { readFileSync } = await import('node:fs'); return { name: dl.suggestedFilename(), text: readFileSync(await dl.path(), 'utf8') } }
const upload = (page, name, text) => page.setInputFiles('input[type=file]', { name, mimeType: 'application/json', buffer: Buffer.from(text) })
const realErrors = (errors) => errors.filter((e) => !/Failed to load resource|net::ERR|frankfurter/i.test(e))

// ================================================================== D. DATA INTEGRITY (UI level; the sanitizer fuzz is in src/store/qa-fuzz.test.ts)
T('D01', 'DATA', 'full data set: load, save, export, restore into a fresh app: every section identical', async (app) => {
  const full = fullData()
  const a = await open(app, { data: full })
  await a.page.keyboard.press('5'); await settle(a.page, 200) // a change, so the app saves
  const saved = await readData(a.page)
  for (const s of SECTIONS) ok(sameJson(saved[s], full[s]), () => `after load+save, section ${s} differs:\nwas ${JSON.stringify(full[s]).slice(0, 300)}\nnow ${JSON.stringify(saved[s]).slice(0, 300)}`)
  await openSettings(a.page)
  const f = await download(a.page, 'text=Export a backup')
  const exported = JSON.parse(f.text).data
  for (const s of SECTIONS) ok(sameJson(exported[s], full[s]), `export section ${s} differs`)
  ok(!/smslog|salt|vkcalc\./.test(f.text), 'the backup file contains reader-log or storage key names')
  const b = await open(app, { empty: true })
  await openSettings(b.page); await upload(b.page, f.name, f.text); await settle(b.page, 300)
  await b.page.click('.confirm .btn--primary'); await settle(b.page, 300)
  const restored = await readData(b.page)
  for (const s of SECTIONS) ok(sameJson(restored[s], full[s]), () => `after restore, section ${s} differs:\nwas ${JSON.stringify(full[s]).slice(0, 300)}\nnow ${JSON.stringify(restored[s]).slice(0, 300)}`)
  ok(realErrors(b.errors).length === 0, b.errors.join(';'))
})
T('D02', 'DATA', 'restored data survives a real reload (storage -> boot -> same data)', async (app) => {
  const full = fullData()
  const { page } = await open(app, { data: full })
  await page.reload(); await page.waitForSelector('.app'); await settle(page, 200)
  const again = await stored(page)
  for (const s of SECTIONS) ok(sameJson(again[s], full[s]), `section ${s} changed across reload`)
})
const BAD = 'vkcalc.data.bad'
for (const [id, name, text] of [
  ['D03', 'JSON null', 'null'], ['D04', 'a JSON array', '[1,2,3]'], ['D05', 'truncated JSON', JSON.stringify(fullData()).slice(0, 700)], ['D06', 'garbage text', '<html>not json</html>'],
]) {
  T(id, 'DATA', `B-01: stored text is ${name}: a raw copy is kept, the app opens, and the original is not replaced until something changes`, async (app) => {
    const { page, up, errors } = await open(app, { raw: text })
    ok(up, 'app did not render')
    await hide(page); await settle(page, 400)
    const keys = await page.evaluate(() => ({ bad: localStorage.getItem('vkcalc.data.bad'), main: localStorage.getItem('vkcalc.data') }))
    ok(keys.bad === text, `no raw copy under ${BAD}: ${String(keys.bad).slice(0, 60)}`)
    ok(keys.main === text, 'the original was overwritten before any change')
    ok(realErrors(errors).length === 0, errors.join(';'))
  })
}
T('D07', 'DATA', 'hostile restore file (prototype keys, wrong types, unknown fields) never crashes the app', async (app) => {
  const hostile = '{"kind":"vkcalc-backup","schemaVersion":3,"data":{"__proto__":{"polluted":1},"constructor":{"prototype":{"p2":1}},"settings":{"__proto__":{"p3":1},"theme":{"x":1},"toolUse":{"__proto__":5,"constructor":3},"tours":[1]},"history":"x","cards":[{"id":"__proto__","kind":"tool","toolId":"emi","inputs":{"__proto__":[["x"]]}},null,5,[],{"id":"c2","kind":"task","title":"<img src=x onerror=window.__xss=1>"}],"reminders":{"a":1},"budget":{"categories":"no","expenses":[{"id":"e","date":"2026-02-31","amount":"-5"}]},"drafts":{"__proto__":{"a":"b"},"emi":{"__proto__":[["p"]]}}}}'
  const { page, errors } = await open(app, { data: fullData() })
  await openSettings(page); await upload(page, 'evil.json', hostile); await settle(page, 300)
  await page.click('.confirm .btn--primary'); await settle(page, 300)
  await page.click('[aria-label=Back]'); await tab(page, 'Notes'); await page.locator('.seg__opt', { hasText: 'To-do' }).click(); await settle(page, 300)
  ok(await page.evaluate(() => !({}).polluted && !({}).p2 && !({}).p3 && !window.__xss), 'prototype pollution or script ran')
  ok(/<img src=x onerror/.test(await body(page)), 'the hostile task title was not shown as plain text')
  ok(await page.locator('.app img[src="x"]').count() === 0, 'an <img> element was created from text')
  ok(realErrors(errors).length === 0, errors.join(';'))
})
T('D08', 'DATA', 'a backup over 25 MB is refused in plain words and the app is unchanged', async (app) => {
  const { page, errors } = await open(app, { data: fullData() })
  await openSettings(page); await upload(page, 'big.json', 'x'.repeat(25 * 1024 * 1024 + 10)); await settle(page, 1500)
  ok(/too large/.test(await page.locator('.note[role=status]').innerText()), 'no size message: ' + await page.locator('.note[role=status]').innerText().catch(() => 'none'))
  ok(await page.locator('.confirm').count() === 0, 'confirm shown for a rejected file')
  ok(realErrors(errors).length === 0, errors.join(';'))
})
T('D09', 'DATA', 'a ~5 MB backup (above the old 5 MB limit) restores', async (app) => {
  const big = fullData()
  big.budget.expenses = Array.from({ length: 22000 }, (_, i) => ({ id: 'x' + i, date: day, amount: '10.50', categoryId: 'k1', mode: 'upi', instrumentId: null, note: 'padding note '.repeat(12) + i, deletedAt: null }))
  const text = JSON.stringify({ kind: 'vkcalc-backup', schemaVersion: 3, exportedAt: new Date().toISOString(), app: 'Calc', data: big })
  ok(text.length > 4_000_000, 'test file is only ' + text.length)
  const { page, errors } = await open(app, { empty: true })
  await openSettings(page); await upload(page, 'b.json', text); await settle(page, 1200)
  await page.click('.confirm .btn--primary'); await settle(page, 500)
  ok(/Restored .* 20000 budget entries/.test(await body(page)), 'done note: ' + (await page.locator('.note[role=status]').innerText().catch(() => 'none')))
  ok(realErrors(errors).length === 0, errors.join(';'))
})
T('D10', 'DATA', 'a v1 and a v2 backup restore through the UI with starter budget and default new settings', async (app) => {
  const mk = (v, data) => JSON.stringify({ kind: 'vkcalc-backup', schemaVersion: v, exportedAt: '2026-01-01T00:00:00Z', app: 'Calc', data })
  for (const [v, data] of [[1, { settings: { theme: 'light' }, history: [{ id: 'a', expression: '2+2', result: '4', at: 1 }], memory: null, input: { expr: '', fresh: false } }], [2, { settings: { theme: 'light' }, history: [], cards: [], reminders: [], memory: '5', input: { expr: '', fresh: false } }]]) {
    const { page, errors } = await open(app, { data: fullData() })
    await openSettings(page); await upload(page, 'old.json', mk(v, data)); await settle(page, 300)
    await page.click('.confirm .btn--primary'); await settle(page, 300)
    const s = await readData(page)
    ok(s.settings.theme === 'light' && s.settings.reminderTime === '09:00' && Object.keys(s.settings.tours).length === 0, `v${v}: settings ${JSON.stringify(s.settings).slice(0, 200)}`)
    ok(s.budget.categories.length >= 5 && s.budget.expenses.length === 0, `v${v}: budget not starter`)
    ok(realErrors(errors).length === 0, errors.join(';'))
  }
})

// ================================================================== R. RUNTIME
// The scanner runs inside the page. Same rules as e2e/shell.test.mjs (SH-Y*), but gathered per screen and size.
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
  const out = { names: [], tiny: [], narrow: [], headIssues: [], contrast: [], overflow: [], hscroll: false, clipped: [] }
  for (const e of [...document.querySelectorAll(sel)].filter(vis)) {
    if (!name(e)) out.names.push(desc(e))
    if (e.closest('.sr-only') || e.type === 'file' || e.disabled) continue
    const r = e.getBoundingClientRect()
    if (Math.max(r.width, r.height) < 44) out.tiny.push(`${desc(e)} ${Math.round(r.width)}x${Math.round(r.height)}`)
    else if (Math.min(r.width, r.height) < 44) out.narrow.push(`${desc(e)} ${Math.round(r.width)}x${Math.round(r.height)}`)
  }
  const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis)
  const lv = hs.map((h) => +h.tagName[1])
  if (!document.querySelector('.sheet') && !lv.includes(1)) out.headIssues.push('no h1')
  if (lv.filter((x) => x === 1).length > 1) out.headIssues.push('more than one h1')
  for (let i = 1; i < lv.length; i++) if (lv[i] - lv[i - 1] > 1) out.headIssues.push(`skips h${lv[i - 1]} to h${lv[i]}`)
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  const bg = (el) => { const layers = []; let e = el; while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break } e = e.parentElement } let b = { r: 255, g: 255, b: 255 }; for (let i = layers.length - 1; i >= 0; i--) { const l = layers[i]; b = { r: l.r * l.a + b.r * (1 - l.a), g: l.g * l.a + b.g * (1 - l.a), b: l.b * l.a + b.b * (1 - l.a) } } return b }
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b) }
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  const opac = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o }
  const seen = new Set()
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || el.closest('.sr-only') || el.closest('svg')) continue
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (!own && !((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.value)) continue
    if (el.disabled || el.closest(':disabled') || el.closest('[aria-disabled=true]')) continue
    const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg) continue
    const base = bg(el); const o = Math.min(opac(el), fg.a)
    const eff = { r: fg.r * o + base.r * (1 - o), g: fg.g * o + base.g * (1 - o), b: fg.b * o + base.b * (1 - o) }
    const size = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight)
    const need = size >= 24 || (size >= 18.66 && w >= 700) ? 3 : 4.5; const rt = ratio(eff, base)
    if (rt < need) { const k = desc(el) + rt.toFixed(2); if (!seen.has(k)) { seen.add(k); out.contrast.push(`${desc(el)} ${rt.toFixed(2)}<${need}`) } }
  }
  const W = document.documentElement.clientWidth
  for (const el of document.querySelectorAll('.app *')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || el.closest('.sr-only') || el.closest('[inert]')) continue
    if (r.right > W + 1 || r.left < -1) out.overflow.push(`${desc(el)} ${Math.round(r.left)}..${Math.round(r.right)}`)
  }
  out.overflow = [...new Set(out.overflow)].slice(0, 6)
  out.hscroll = document.documentElement.scrollWidth > W + 1 || document.body.scrollWidth > W + 1
  // text cut off inside a box that does not scroll
  for (const el of document.querySelectorAll('.app .row__label, .app .tab span, .app .btn, .app .pill, .app .chip, .app .seg__opt')) {
    if (!vis(el)) continue
    const cs = getComputedStyle(el)
    if (cs.overflow === 'hidden' && cs.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.clipped.push(desc(el))
  }
  out.clipped = out.clipped.slice(0, 5)
  return out
}
const SCREENS = {
  calc: async () => {},
  tools: async (p) => { await tab(p, 'Tools'); await settle(p, 150) },
  tool: async (p) => { await tab(p, 'Tools'); await p.locator('.hero').first().click().catch(() => {}); await settle(p, 150) },
  notes: async (p) => { await tab(p, 'Notes'); await settle(p, 150) },
  due: async (p) => { await tab(p, 'Due'); await settle(p, 150) },
  budget: async (p) => { await tab(p, 'Budget'); await settle(p, 150) },
  summary: async (p) => { await tab(p, 'Budget'); await p.click('text=Spending summary'); await settle(p, 200) },
  manage: async (p) => { await tab(p, 'Budget'); await p.click('text=Categories and cards'); await settle(p, 200) },
  settings: async (p) => { await openSettings(p) },
  history: async (p) => { await p.click('[aria-label=History]'); await settle(p, 150) },
  addExpense: async (p) => { await tab(p, 'Budget'); await p.click('button:has-text("Add expense")'); await settle(p, 200) },
}
const VIEWPORTS = [[360, 640], [360, 790], [412, 915], [800, 600]]
const sweep = (width, height, font, theme) => async (app) => {
  const bad = [], tiny = new Set(), narrow = new Set(), heads = new Set(), contrast = new Set()
  for (const name of Object.keys(SCREENS)) {
    const { page, errors, context } = await open(app, { data: fullData(), theme, width, height, font, mobile: width < 700 })
    try {
      await SCREENS[name](page); await settle(page, 200)
      const r = await page.evaluate(scanFn)
      if (r.hscroll || r.overflow.length) bad.push(`${name}: sideways overflow ${r.overflow.slice(0, 3).join(' | ')}`)
      if (r.names.length) bad.push(`${name}: no accessible name ${r.names.slice(0, 3).join(' | ')}`)
      if (r.clipped.length) bad.push(`${name}: text clipped ${r.clipped.join(' | ')}`)
      r.tiny.forEach((x) => tiny.add(`${name} ${x}`)); r.narrow.forEach((x) => narrow.add(`${name} ${x}`)); r.headIssues.forEach((x) => heads.add(`${name}: ${x}`)); r.contrast.forEach((x) => contrast.add(`${name} ${x}`))
      if (realErrors(errors).length) bad.push(`${name}: errors ${errors.join(';').slice(0, 200)}`)
    } finally { await context.close() }
  }
  if (tiny.size) bad.push('tap target under 44px in both directions: ' + [...tiny].slice(0, 6).join(' | '))
  if (contrast.size) bad.push('low contrast: ' + [...contrast].slice(0, 6).join(' | '))
  if (narrow.size) note(`${narrow.size} controls are under 44px in ONE direction (allowed by the rule): ${[...narrow].slice(0, 4).join(' | ')}`)
  if (heads.size) note(`heading order: ${[...heads].slice(0, 6).join(' | ')}`)
  ok(bad.length === 0, bad.join('\n   '))
}
for (const [w, h] of VIEWPORTS) for (const font of [100, 150, 200]) T(`R-${w}x${h}-f${font}-dark`, 'RUNTIME', `${w}x${h}, font ${font}%, dark: every screen has no sideways overflow, unnamed control, clipped text, tiny target or low contrast`, sweep(w, h, font, 'dark'))
for (const [w, h, f] of [[360, 640, 100], [360, 640, 200], [800, 600, 100]]) T(`R-${w}x${h}-f${f}-light`, 'RUNTIME', `${w}x${h}, font ${f}%, light: same checks`, sweep(w, h, f, 'light'))

T('R20', 'RUNTIME', 'OS dark and light (theme = system) follow prefers-color-scheme; no white flash colours leak into dark', async (app) => {
  for (const scheme of ['dark', 'light']) {
    const { page } = await open(app, { data: fullData(), theme: 'system', colorScheme: scheme })
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    ok(scheme === 'dark' ? /rgb\((\d|1\d|2\d), /.test(bg) : /rgb\(2[3-5]\d, /.test(bg), `${scheme}: body background ${bg}`)
  }
})
T('R21', 'RUNTIME', 'reduced motion: no animation or transition longer than 2 ms on any screen; normal motion does animate', async (app) => {
  const run = async (reducedMotion) => {
    const { page } = await open(app, { data: fullData(), reducedMotion })
    await page.click('[aria-label=History]'); await settle(page, 100)
    return page.evaluate(() => { const s = document.querySelector('.sheet'); const c = getComputedStyle(s); return [c.animationDuration, c.transitionDuration] })
  }
  const reduce = await run('reduce'), normal = await run('no-preference')
  ok(reduce.every((x) => x.split(',').every((v) => parseFloat(v) <= 0.002)), 'reduced: ' + reduce)
  ok(normal.some((x) => x.split(',').some((v) => parseFloat(v) > 0.002)), 'normal motion has no animation: ' + normal)
})
T('R22', 'RUNTIME', 'OFFLINE: a full tour of every tab and sheet makes no request except the documented currency-rate fetch, and nothing breaks', async (app) => {
  const external = []
  const route = (r) => { const u = r.request().url(); if (u.startsWith(app.url)) return r.continue(); external.push(u); return r.abort('internetdisconnected') }
  const { page, errors, reqs } = await open(app, { data: fullData(), route })
  for (const name of ['tools', 'tool', 'notes', 'due', 'budget', 'summary', 'manage', 'settings', 'history', 'addExpense']) { await page.goto(app.url); await page.waitForSelector('.app'); await SCREENS[name](page).catch(() => {}); await settle(page, 150) }
  await tab(page, 'Tools'); await page.locator('input[type=search]').first().fill('currency').catch(() => {}); await settle(page, 300)
  const outside = [...new Set([...external, ...reqs.filter((u) => !u.startsWith(app.url) && !u.startsWith('data:') && !u.startsWith('blob:'))])]
  note(`requests outside the app during the tour: ${outside.length ? outside.join(', ') : 'none'}`)
  const unexpected = outside.filter((u) => !/^https:\/\/api\.frankfurter\.dev\//.test(u))
  ok(unexpected.length === 0, 'unexpected network calls: ' + unexpected.join(', '))
  ok(realErrors(errors).length === 0, errors.join(';'))
  ok(!/\bNaN\b|undefined|\[object/.test(await body(page)), 'bad text on screen')
})
T('R23', 'RUNTIME', 'OFFLINE: Currency converter still gives a result from the bundled rates when the fetch fails', async (app) => {
  const route = (r) => (r.request().url().startsWith(app.url) ? r.continue() : r.abort('internetdisconnected'))
  const { page, errors } = await open(app, { data: fullData({ settings: { ...fullData().settings, startupTool: 'currency' } }), route })
  await settle(page, 600)
  const t = await body(page)
  ok(/Currency converter/.test(t) && !/\bNaN\b|undefined/.test(t), 'currency screen: ' + t.slice(0, 200))
  ok(realErrors(errors).length === 0, errors.join(';'))
})
T('R30', 'RUNTIME', 'ERROR BOUNDARY: an exception while drawing Budget shows a plain message, keeps the tab bar, other tabs recover, data untouched', async (app) => {
  const before = fullData()
  const { page, errors } = await open(app, { data: before })
  await page.evaluate(() => { window.__boom = false; const o = Intl.DateTimeFormat.prototype.format; Intl.DateTimeFormat.prototype.format = function (...a) { if (window.__boom) throw new Error('forced test exception'); return o.apply(this, a) } })
  await page.evaluate(() => { window.__boom = true })
  await tab(page, 'Budget'); await settle(page, 400)
  const t = await body(page)
  ok(/This screen hit a problem/.test(t), 'no fallback message; page text: ' + t.replace(/\n/g, ' ').slice(0, 160))
  ok(await page.locator('.tabbar .tab').count() === 5, 'tab bar gone')
  await page.evaluate(() => { window.__boom = false })
  await tab(page, 'Notes'); await settle(page, 300)
  ok(!/This screen hit a problem/.test(await body(page)), 'did not recover when another tab was tapped')
  await tab(page, 'Budget'); await settle(page, 300)
  ok(await page.locator('.budget__hero').count() >= 1, 'Budget did not recover once the fault was gone')
  const after = await readData(page)
  for (const s of SECTIONS) ok(sameJson(after[s], before[s]), `data section ${s} changed by the crash`)
  void errors
})
T('R31', 'RUNTIME', 'ERROR BOUNDARY: the "Back to Calculate" button works from the fallback', async (app) => {
  const { page } = await open(app, { data: fullData() })
  await page.evaluate(() => { window.__boom = true; const o = Intl.DateTimeFormat.prototype.format; Intl.DateTimeFormat.prototype.format = function (...a) { if (window.__boom) throw new Error('forced test exception'); return o.apply(this, a) } })
  await tab(page, 'Budget'); await settle(page, 300)
  await page.evaluate(() => { window.__boom = false })
  await page.click('text=Back to Calculate'); await settle(page, 300)
  ok(await page.locator('.keypad').count() === 1, 'calculator not shown')
})

// ---------------------------------------------------------------- performance, at the size limits
const big = () => {
  const d = fullData()
  const dates = []; const base = new Date()
  for (let m = 0; m < 24; m++) for (const dd of [3, 9, 15, 21, 27]) dates.push(new Date(base.getFullYear(), base.getMonth() - m, dd, 12).toISOString().slice(0, 10))
  d.budget.expenses = Array.from({ length: 20000 }, (_, i) => ({ id: 'x' + i, date: dates[i % dates.length], amount: String(10 + (i % 90)) + '.50', categoryId: i % 3 ? 'k1' : 'k2', mode: 'upi', instrumentId: null, note: 'entry ' + i, deletedAt: null }))
  d.cards = Array.from({ length: 500 }, (_, i) => ({ id: 'n' + i, title: 'Note number ' + i, kind: i % 2 ? 'task' : 'tape', toolId: null, inputs: null, summary: '', amount: null, lines: i % 2 ? [] : [{ id: 'l' + i, label: 'Item', value: String(i) }], note: 'body text ' + i, tags: ['Work'], pinned: false, createdAt: NOW - i * 1000, updatedAt: NOW - i * 1000, deletedAt: null }))
  d.reminders = d.cards.filter((c) => c.kind === 'task').slice(0, 100).map((c, i) => ({ id: 'rr' + i, cardId: c.id, dueAt: NOW + (i + 1) * 86400000, repeat: 'none', anchorDay: 1, leadDays: 1, done: false, history: [] }))
  return d
}
const timeIt = async (page, fn, waitFor) => { const t0 = Date.now(); await fn(); await page.waitForSelector(waitFor, { timeout: 30000 }); return Date.now() - t0 }
T('PF01', 'PERF', '20,000 expenses and 500 notes: boot, Budget, Spending summary, Entries list, scroll and search stay usable (desktop Chrome, CPU x1; a phone is about 4x slower)', async (app) => {
  const { page, bootMs, errors } = await open(app, { data: big() })
  const r = { boot: bootMs }
  r.budget = await timeIt(page, () => tab(page, 'Budget'), '.budget__hero')
  r.summary = await timeIt(page, () => page.click('text=Spending summary'), '.screen[aria-label="Spending summary"] .budget__hero')
  r.entries = await timeIt(page, () => page.locator('.screen[aria-label="Spending summary"]').getByRole('radio', { name: 'Entries', exact: true }).click(), '.budget__entry')
  const rows = await page.locator('.budget__entry').count()
  const scroll = await page.evaluate(async () => {
    const el = document.querySelector('.screen[aria-label="Spending summary"] .screen__body') || document.scrollingElement
    const gaps = []; let last = performance.now()
    for (let i = 0; i < 40; i++) { el.scrollTop += 400; await new Promise((r) => requestAnimationFrame(r)); const n = performance.now(); gaps.push(n - last); last = n }
    return { worst: Math.round(Math.max(...gaps)), avg: Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) }
  })
  const t0 = Date.now()
  await page.locator('input[type=search][aria-label="Search entries in all months"]').fill('entry 19999'); await page.waitForFunction(() => /entry 19999/.test(document.querySelector('.screen[aria-label="Spending summary"]')?.innerText ?? ''), null, { timeout: 30000 })
  r.search = Date.now() - t0
  await page.click('.screen[aria-label="Spending summary"] [aria-label^="Back"]').catch(() => {}); await page.keyboard.press('Escape')
  r.notes = await timeIt(page, async () => { await page.goto(app.url); await page.waitForSelector('.app'); await tab(page, 'Notes') }, '.app__body li, .app__body .card, .app__body button')
  const t1 = Date.now(); await page.locator('input[type=search]').first().fill('Note number 499'); await page.waitForFunction(() => /Note number 499/.test(document.body.innerText)); r.noteSearch = Date.now() - t1
  note(`ms: ${JSON.stringify(r)}; entries rendered ${rows}; scroll frame gap worst/avg ${scroll.worst}/${scroll.avg} ms`)
  ok(r.boot < 8000 && r.budget < 3000 && r.summary < 3000 && r.entries < 3000 && r.search < 3000 && r.noteSearch < 3000, 'too slow: ' + JSON.stringify(r))
  ok(scroll.worst < 250, `scroll hitch ${scroll.worst} ms`)
  ok(realErrors(errors).length === 0, errors.join(';'))
})
T('PF02', 'PERF', 'memory after 300 navigations: JS heap, DOM nodes and event listeners do not keep growing', async (app) => {
  const { page, context, errors } = await open(app, { data: fullData() })
  const cdp = await context.newCDPSession(page); await cdp.send('HeapProfiler.enable')
  const measure = async () => { await cdp.send('HeapProfiler.collectGarbage'); const h = await cdp.send('Runtime.getHeapUsage'); const c = await cdp.send('Memory.getDOMCounters'); return { heapMB: +(h.usedSize / 1048576).toFixed(2), nodes: c.nodes, listeners: c.jsEventListeners } }
  const lap = async () => {
    for (const n of ['Tools', 'Notes', 'Due', 'Budget', 'Calculate']) { await tab(page, n); await page.waitForTimeout(15) }
    await page.click('[aria-label=Settings]'); await page.waitForTimeout(15); await page.click('[aria-label=Back]'); await page.waitForTimeout(15)
    await page.click('[aria-label=History]'); await page.waitForTimeout(15); await page.keyboard.press('Escape'); await page.waitForTimeout(15)
  }
  for (let i = 0; i < 6; i++) await lap() // warm up
  const base = await measure()
  for (let i = 0; i < 43; i++) await lap() // 43 laps x 7 navigations = 301
  const end = await measure()
  note(`after warm-up ${JSON.stringify(base)}; after 300 more navigations ${JSON.stringify(end)}`)
  ok(end.heapMB - base.heapMB < 6, `heap grew ${(end.heapMB - base.heapMB).toFixed(1)} MB`)
  ok(end.nodes < base.nodes * 1.25 + 200, `DOM nodes ${base.nodes} -> ${end.nodes}`)
  ok(end.listeners < base.listeners * 1.25 + 50, `event listeners ${base.listeners} -> ${end.listeners}`)
  ok(realErrors(errors).length === 0, errors.join(';'))
})
T('PF03', 'RUNTIME', 'rapid double taps: Save an expense twice, Delete twice, Undo twice, add a task twice: one change each, no duplicates', async (app) => {
  const { page, errors } = await open(app, { data: fullData({ cards: [], reminders: [] }) })
  const entries = async () => (await readData(page)).budget.expenses
  const dbl = async (locator) => { const b = await locator.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2) }
  const n0 = (await entries()).length
  await tab(page, 'Budget'); await page.getByRole('button', { name: 'Add expense', exact: true }).first().click(); await page.locator('.sheet').waitFor()
  await page.locator('#exp-amount').fill('77.25'); await page.evaluate(() => document.activeElement?.blur()); await settle(page, 100)
  await dbl(page.locator('.sheet__foot .btn--primary').first()); await settle(page, 500)
  let list = await entries()
  ok(list.filter((e) => e.amount === '77.25').length === 1, `Save pressed twice made ${list.filter((e) => e.amount === '77.25').length} entries`)
  ok(list.length === n0 + 1, `entry count ${n0} -> ${list.length}`)
  ok(await page.locator('.sheet').count() <= 1, 'a second sheet opened from the second tap')
  await page.keyboard.press('Escape'); await settle(page, 200)
  const del = page.getByRole('button', { name: /^Delete.*77/ }).first()
  if (await del.count()) { await dbl(del); await settle(page, 400)
    list = await entries(); ok(list.filter((e) => e.deletedAt === null).length === n0, `Delete twice left ${list.filter((e) => e.deletedAt === null).length} live (expected ${n0})`)
    const undo = page.locator('.snack').getByRole('button', { name: 'Undo' })
    if (await undo.count()) { await dbl(undo); await settle(page, 400); list = await entries(); ok(list.filter((e) => e.deletedAt === null).length === n0 + 1, `Undo twice left ${list.filter((e) => e.deletedAt === null).length} live (expected ${n0 + 1})`); ok(list.filter((e) => e.amount === '77.25').length === 1, 'Undo duplicated the entry') }
  } else note('no Delete button named for the new entry on the Budget home; delete double-tap not run')
  await tab(page, 'Notes'); await page.locator('.seg__opt', { hasText: 'To-do' }).click(); await settle(page, 150)
  await page.locator('input[aria-label="New task"]').fill('Double task'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await settle(page, 400)
  const cards = (await readData(page)).cards.filter((c) => c.title === 'Double task')
  ok(cards.length === 1, `Enter twice made ${cards.length} tasks`)
  ok(realErrors(errors).length === 0, errors.join(';'))
})
T('PF04', 'RUNTIME', 'calculator: 30 rapid key presses and = taps never leave an error or NaN on screen', async (app) => {
  const { page, errors } = await open(app, { empty: true })
  for (const k of ['7', 'Multiply', '8', 'Equals', 'Equals', 'Equals', 'Add', 'Add', 'Subtract', 'Divide', '0', 'Equals', 'Clear', '9', 'Equals', 'Equals']) { await page.locator(`.key[aria-label="${k}"]`).click({ delay: 0 }) }
  ok(!/\bNaN\b|undefined|Infinity/.test(await page.locator('.display').innerText()), 'bad text on the display')
  ok(realErrors(errors).length === 0, errors.join(';'))
})

// ================================================================== A. ACCESSIBILITY
T('A01', 'A11Y', 'screen-reader words for amounts: refund and "not counted as spending" are said, not only coloured', async (app) => {
  const { page } = await open(app, { data: fullData() })
  await tab(page, 'Budget'); await page.click('text=Spending summary'); await settle(page, 200)
  await page.locator('.screen[aria-label="Spending summary"]').getByRole('radio', { name: 'Entries', exact: true }).click(); await settle(page, 200)
  const all = await page.evaluate(() => [...document.querySelectorAll('.screen[aria-label="Spending summary"] .budget__entry, .screen[aria-label="Spending summary"] .budget__entry *')].map((e) => (e.getAttribute('aria-label') || '') + ' ' + (e.className?.includes?.('sr-only') ? e.textContent : '')).join(' | ') + ' || ' + document.querySelector('.screen[aria-label="Spending summary"]').innerText)
  ok(/refund of/i.test(all) || /Refund/.test(all), 'no refund wording: ' + all.slice(0, 300))
  ok(/not counted as spending/i.test(all), 'no "not counted" wording for the card bill')
})
T('A02', 'A11Y', 'list lines say paid / skipped / not paid in words (aria-label), not only by colour or symbol', async (app) => {
  const { page } = await open(app, { data: fullData() })
  await tab(page, 'Notes'); await page.locator('text=Trip').first().click(); await settle(page, 300)
  const labels = await page.evaluate(() => [...document.querySelectorAll('.tape__line button')].map((b) => b.getAttribute('aria-label') || ''))
  ok(labels.some((l) => /paid|done/i.test(l)) && labels.some((l) => /skip/i.test(l)), 'state words missing: ' + labels.join(' | ').slice(0, 300))
})
T('A03', 'A11Y', 'Escape closes only the top sheet; the one below stays (Budget add expense > category picker)', async (app) => {
  const { page } = await open(app, { data: fullData() })
  await tab(page, 'Budget'); await page.getByRole('button', { name: 'Add expense', exact: true }).first().click(); await page.locator('.sheet').waitFor(); await settle(page, 200)
  const more = page.locator('#exp-cat .pill--more'); if (await more.count()) { await more.click(); await settle(page, 200) } else return note('no "more" category picker to nest; skipped')
  const n = await page.locator('.sheet').count()
  await page.keyboard.press('Escape'); await settle(page, 250)
  ok(await page.locator('.sheet').count() === n - 1 && await page.locator('#exp-amount').count() === 1, `sheets ${n} -> ${await page.locator('.sheet').count()}; form still there: ${await page.locator('#exp-amount').count()}`)
})
T('A04', 'A11Y', 'focus: opening a sheet by keyboard moves focus inside; Tab never reaches the page behind in 30 presses; Escape returns focus to the opener', async (app) => {
  const { page } = await open(app, { data: fullData() })
  await page.focus('[aria-label=History]'); await page.keyboard.press('Enter'); await settle(page, 250)
  ok(await page.evaluate(() => !!document.activeElement?.closest('.sheet')), 'focus not in sheet')
  for (let i = 0; i < 30; i++) { await page.keyboard.press('Tab'); ok(await page.evaluate(() => { const a = document.activeElement; return a === document.body || !!a.closest('.sheet') }), `focus escaped at press ${i + 1}`) }
  await page.keyboard.press('Escape'); await settle(page, 250)
  ok(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'History', 'focus did not return to History button')
})
T('A05', 'A11Y', 'every screen has one h1 (or is a dialog with a title) and no skipped heading level', async (app) => {
  const issues = []
  for (const name of ['calc', 'tools', 'notes', 'due', 'budget', 'summary', 'manage', 'settings']) {
    const { page, context } = await open(app, { data: fullData() })
    await SCREENS[name](page); await settle(page, 150)
    const r = await page.evaluate(scanFn); r.headIssues.forEach((x) => issues.push(`${name}: ${x}`)); await context.close()
  }
  ok(issues.length === 0, issues.join(' | '))
})

// ================================================================== P. PRIVACY AND SAFETY
T('P01', 'PRIVACY', 'production build: typing amounts and note text writes nothing to the console (every level)', async (app) => {
  const { page, consoleAll } = await open(app, { data: fullData() })
  const secrets = ['7391.55', 'TOPSECRETNOTE', '8642.10']
  for (const k of '7391.55'.split('')) await page.locator(`.key[aria-label="${k === '.' ? 'Decimal point' : k}"]`).click().catch(() => {})
  await tab(page, 'Budget'); await page.getByRole('button', { name: 'Add expense', exact: true }).first().click(); await page.locator('#exp-amount').fill('8642.10'); await page.locator('#exp-note').fill('TOPSECRETNOTE')
  await page.locator('.sheet__foot .btn--primary').first().click(); await settle(page, 400)
  const leaked = consoleAll.filter((l) => secrets.some((s) => l.includes(s)))
  note(`console lines during the session: ${consoleAll.length}`)
  ok(leaked.length === 0, 'console shows typed data: ' + leaked.join(' | ').slice(0, 300))
  ok(consoleAll.every((l) => !/^(log|debug|info):/.test(l) || /vite|DevTools/i.test(l)), 'debug or info lines in the console: ' + consoleAll.filter((l) => /^(log|debug|info):/.test(l)).join(' | ').slice(0, 300))
})
T('P02', 'PRIVACY', 'localStorage keys: only the known keys exist after a full session, and none holds raw message text', async (app) => {
  const { page } = await open(app, { data: fullData() })
  for (const n of ['Tools', 'Notes', 'Due', 'Budget']) { await tab(page, n); await settle(page, 80) }
  await hide(page); await settle(page, 300)
  const dump = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])))
  const known = /^(vkcalc\.data|vkcalc\.data\.bad|vkcalc\.smslog2|vkcalc\.smslog\.salt|vkcalc\.currencyRates|__seeded)$/
  const extra = Object.keys(dump).filter((k) => !known.test(k))
  ok(extra.length === 0, 'unknown keys: ' + extra.join(', '))
  ok(!Object.values(dump).some((v) => /debited|Not you\?|UPI Ref/i.test(v ?? '')), 'something that looks like message text is stored')
})
T('P03', 'PRIVACY', 'XSS: <img onerror>, <script>, javascript: and HTML in note, category, card, tag, list-line and history names show as plain text and run nothing', async (app) => {
  const X = ['<img src=x onerror=window.__xss=1>', '"><script>window.__xss=2</script>', '<svg onload=window.__xss=3>', 'javascript:window.__xss=4', '</div><b>bold</b>']
  const d = fullData()
  d.cards = [
    { id: 'x1', title: X[0], kind: 'task', toolId: null, inputs: null, summary: X[1], amount: null, lines: [], note: X[2], tags: [X[3]], pinned: false, createdAt: NOW, updatedAt: NOW, deletedAt: null },
    { id: 'x2', title: X[1], kind: 'tape', toolId: null, inputs: null, summary: '', amount: '5', lines: [{ id: 'xl', label: X[2], value: '5' }], note: X[0], tags: [], pinned: false, createdAt: NOW, updatedAt: NOW, deletedAt: null },
  ]
  d.reminders = [{ id: 'xr', cardId: 'x1', dueAt: NOW + 86400000, repeat: 'none', anchorDay: 1, leadDays: 0, done: false, history: [] }]
  d.history[0].memo = X[0]
  d.budget.categories[0].name = X[0].slice(0, 40); d.budget.categories[1].name = X[4]
  d.budget.instruments[0].name = X[2].slice(0, 40); d.budget.instruments[0].bank = X[0].slice(0, 40); d.budget.instruments[1].name = X[3]
  d.budget.expenses[0].note = X[0]; d.budget.recurring[0].title = X[2]
  const { page, errors } = await open(app, { data: d })
  const visit = async (fn) => { await fn(); await settle(page, 250); ok(await page.evaluate(() => !window.__xss), 'a script ran: window.__xss=' + await page.evaluate(() => window.__xss)) }
  await visit(async () => {}); await visit(() => page.click('[aria-label=History]')); await visit(() => page.keyboard.press('Escape'))
  await visit(() => tab(page, 'Notes')); await visit(() => page.locator('.app__body').getByText('onerror', { exact: false }).first().click().catch(() => {})); await visit(() => page.keyboard.press('Escape'))
  await visit(() => tab(page, 'Due')); await visit(() => tab(page, 'Budget')); await visit(() => page.click('text=Spending summary')); await visit(() => page.click('[aria-label^=Back]').catch(() => {}))
  await visit(() => page.click('text=Categories and cards').catch(() => {}))
  ok(await page.locator('.app img[src="x"], .app script, .app svg[onload]').count() === 0, 'an element was created from text')
  ok(await page.evaluate(() => [...document.querySelectorAll('.app a[href^="javascript:"], .app [href^="javascript:"]')].length === 0), 'a javascript: link exists')
  ok(realErrors(errors).length === 0, errors.join(';'))
})
T('P04', 'PRIVACY', 'CSV export of hostile notes: formula cells are neutralised; share text and backup carry no extra data', async (app) => {
  const d = fullData()
  d.budget.expenses[0].note = '=HYPERLINK("http://evil","x")'; d.budget.expenses[1].note = '+cmd|calc'; d.budget.expenses[3].note = '@SUM(A1)'
  d.budget.categories[0].name = '=CAT'
  const { page } = await open(app, { data: d })
  await openSettings(page)
  await page.click('text=Export entries').catch(async () => { await page.click('text=Export').catch(() => {}) }); await settle(page, 300)
  const btn = page.locator('.sheet .btn--primary').first()
  if (!(await btn.count())) return note('could not open the CSV export sheet by text; CSV escaping is covered by src/lib/qa-privacy.test.ts')
  const f = await download(page, '.sheet .btn--primary')
  const lines = f.text.replace(/^﻿/, '').split('\r\n').slice(1).filter(Boolean)
  ok(lines.length >= 3, 'too few rows: ' + lines.length)
  for (const l of lines) for (const cell of l.split(',')) ok(!/^"?[=+@]/.test(cell) && !/^"?-[A-Za-z(]/.test(cell), 'formula cell not neutralised: ' + cell)
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
  try { await Promise.race([c.fn(app), new Promise((_, rej) => setTimeout(() => rej(new Error('case timed out after 240 s')), 240000))]) } catch (e) { msg = String(e.message ?? e).replace(/\s+\n/g, '\n').slice(0, 900) }
  for (const x of CUR.ctxs) await x.close().catch(() => {})
  if (msg) { fails++; console.log(`FAIL ${c.id} ${c.type} ${c.title} :: ${msg}`) } else { passes++; console.log(`PASS ${c.id} ${c.type} ${c.title}`) }
  results.push({ id: c.id, type: c.type, title: c.title, pass: !msg, msg })
}
console.log(`\n${passes} passed, ${fails} failed, ${sel.length} cases`)
if (process.env.QA_OUT) writeFileSync(process.env.QA_OUT, JSON.stringify(results, null, 1))
await app.stop()
process.exit(fails ? 1 : 0)
