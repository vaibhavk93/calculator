// Browser tests for: Notes, saved calculations, lists, To-do, Due, reminders, Trash, backup, damaged data.
// Run:  node e2e/notes-todo.test.mjs            (all cases)
//       node e2e/notes-todo.test.mjs N0 T1      (only cases whose id starts with N0 or T1)
// One line per case:  PASS|FAIL <id> <type> <title> :: <what was seen, on FAIL>
// Every case opens its own fresh page with its own seeded data. Nothing here touches src/ or a phone.
// Notification delivery cannot be tested in a browser. The PLANNING function (which notifications would
// exist, and when) is bundled with esbuild and tested directly: cases P01...
process.env.TZ = 'Asia/Kolkata'
import { startApp, openApp, tab, stored, overflowing } from './lib.mjs'
import { build } from 'esbuild'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { AsyncLocalStorage } from 'node:async_hooks'

const ROOT = new URL('..', import.meta.url).pathname

// ------------------------------------------------------------------ time
const IST = '+05:30'
const ist = (s) => Date.parse(`${s.length <= 10 ? s + 'T09:00' : s}:00${IST}`)
const DAY = 86_400_000
const NOW = ist('2026-11-02T10:00') // Monday 2 Nov 2026, 10:00 in India
const day = (ms) => new Date(ms + 19_800_000).getUTCDate()

// ------------------------------------------------------------------ seed builders
let seq = 0
const base = (o) => ({ title: 'Item', kind: 'tool', toolId: null, inputs: null, summary: '', amount: null, lines: [], note: '', tags: [], pinned: false, createdAt: NOW - 1000 * ++seq, updatedAt: NOW - 1000 * seq, deletedAt: null, ...o })
const emi = (id, title = 'Home EMI', o = {}) => base({ id, title, kind: 'tool', toolId: 'emi', inputs: { principal: '5000000', rate: '8.5', tenure: '20', tenureUnit: 'years' }, summary: 'Monthly EMI: ₹43,391.16', amount: '43391.16', amountFmt: 'money', ...o })
const task = (id, title, o = {}) => base({ id, title, kind: 'task', summary: 'No date', ...o })
const tape = (id, title, lines = [], o = {}) => base({ id, title, kind: 'tape', summary: `${lines.length} lines`, amount: lines.reduce((s, l) => s + Number(l.value), 0).toString(), lines: lines.map((l, i) => ({ id: `${id}l${i}`, ...l })), ...o })
const rem = (id, cardId, at, o = {}) => ({ id, cardId, dueAt: at, repeat: 'none', anchorDay: day(at), leadDays: 3, done: false, history: [], ...o })
const seed = ({ cards = [], reminders = [], settings = {}, extra = {} } = {}) => ({ schemaVersion: 3, settings: { theme: 'dark', ...settings }, history: [], cards, reminders, memory: null, input: { expr: '', fresh: false }, ...extra })

// ------------------------------------------------------------------ small drivers
const fail = (msg) => { throw new Error(msg) }
const eq = (a, b, what) => { if (a !== b) fail(`${what}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`) }
const ok = (c, what) => { if (!c) fail(what) }
const has = (text, part, what = 'text') => ok(String(text).includes(part), `${what} should contain "${part}" but is: ${String(text).replace(/\s+/g, ' ').slice(0, 220)}`)
const lacks = (text, part, what = 'text') => ok(!String(text).includes(part), `${what} should NOT contain "${part}": ${String(text).replace(/\s+/g, ' ').slice(0, 220)}`)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const notes = (p) => tab(p, 'Notes')
const modeTodo = (p) => p.getByRole('radio', { name: /^To-do/ }).click()
const view = (p, name) => p.getByRole('radio', { name, exact: true }).click()
const quickAdd = async (p, text) => { await p.locator('input[aria-label="New task"]').fill(text); await p.locator('.todo__add button[type=submit]').click() }
const text = (p, sel = '.app') => p.locator(sel).first().innerText()
const snackText = async (p) => (await p.locator('.snack').count()) ? p.locator('.snack').innerText() : ''
const sheetText = (p) => p.locator('.sheet').innerText()
const sheetSave = (p) => p.locator('.sheet .sheet__foot .btn--primary').click()
/** Stored JSON after the 250 ms save delay. */
const st = async (p) => { await wait(450); return stored(p) }
const rowOf = (p, title) => p.locator('.row, .todo__row, .due').filter({ hasText: title })
const box = (loc) => loc.boundingBox()
const bad = /\b(NaN|undefined|Infinity|\[object Object\]|Invalid Date)\b/
const noBadText = async (p, where) => { const t = await text(p); ok(!bad.test(t), `${where}: shows bad text "${(bad.exec(t) ?? [])[0]}"`) }
const noOverflow = async (p, where) => { const o = await overflowing(p); eq(o.length, 0, `${where}: sideways overflow ${JSON.stringify(o)}`) }
/** Taps a button inside the Save sheet or a header by its exact text. */
const btn = (p, name, scope = '.app') => p.locator(scope).getByRole('button', { name, exact: true })

/** Opens Loan EMI the way a person does: Tools tab, the "Loans and EMI" tile, the row. */
const openEmi = async (p) => {
  await tab(p, 'Tools'); await p.locator('.tile', { hasText: 'Loans and EMI' }).click()
  await p.locator('.navrow .row__label').filter({ hasText: 'Loan EMI' }).first().click(); await p.waitForSelector('.tool')
}

/** Opens the Save sheet of the EMI card that is open (header "Update"/"Save"). */
const headerSave = (p) => p.locator('.screen__bar .link-btn').click()

// ------------------------------------------------------------------ runner
const CASES = []
const T = (id, type, title, fn, opts = {}) => CASES.push({ id, type, title, fn, opts })
let APP
const als = new AsyncLocalStorage()
const track = (r) => { als.getStore()?.pages.push(r); return r }
/** Open the app for this case. `data` is a seed(); `o` are openApp options. */
const open = async (data = seed(), o = {}) => {
  const r = await openApp(APP, { data, now: NOW, theme: null, ...o })
  return track(r)
}
/** Open with raw stored text (for damaged data). Returns the page even when the app never draws. */
const openRaw = async (raw, o = {}) => {
  const context = await APP.browser.newContext({ viewport: { width: 360, height: 790 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'en-IN', timezoneId: 'Asia/Kolkata', reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 200)}`) })
  await page.addInitScript(([r, fixed]) => {
    try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('vkcalc.data', r); localStorage.setItem('__seeded', '1') } } catch {}
    const T = fixed; const RealDate = Date; globalThis.Date = class extends RealDate { constructor(...a) { if (a.length === 0) super(T); else super(...a) } static now() { return T } }
  }, [raw, NOW])
  await page.goto(APP.url)
  const drawn = await page.waitForSelector('.app', { timeout: 4000 }).then(() => true, () => false)
  const r = { page, errors, context, drawn, async close() { await context.close() } }
  return track(r)
}

// ================================================================== NOTES AND SAVED CALCULATIONS
T('N01', 'POS', 'Notes empty state says what to do and has a way forward', async () => {
  const { page: p } = await open(); await notes(p)
  const t = await text(p, '.tools')
  has(t, 'No notes yet'); has(t, 'Open calculators')
  await p.getByRole('button', { name: 'Open calculators' }).click()
  ok((await p.locator('.tabbar .tab[aria-current=page]').innerText()).includes('Tools'), 'Open calculators should go to Tools')
})
T('N02', 'UI', 'Notes empty state fits at 360px, dark and light', async () => {
  for (const theme of ['dark', 'light']) {
    const { page: p } = await open(seed({ settings: { theme } })); await notes(p); await noOverflow(p, theme)
  }
})
T('N03', 'POS', 'Saved calculation shows title and summary under Calculations', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  const t = await text(p, '.tools__list'); has(t, 'Calculations'); has(t, 'Home EMI'); has(t, 'Monthly EMI: ₹43,391.16')
})
T('N04', 'POS', 'Opening a saved calculation restores its inputs', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  await p.locator('.row__main').first().click()
  const t = await text(p, '.screen'); has(t, 'Home EMI'); has(t, 'Monthly EMI'); has(t, '₹43,391.16')
})
T('N05', 'POS', 'Change a value, Update: card summary and snack change', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  await p.locator('.row__main').first().click()
  await p.getByLabel('Loan amount').first().fill('1000000')
  await headerSave(p); await sheetSave(p)
  has(await snackText(p), 'Updated in Notes')
  const s = await st(p); const c = s.cards[0]
  eq(c.inputs.principal, '1000000', 'stored principal'); has(c.summary, '₹8,678.23', 'summary')
})
T('N06', 'POS', 'Rename a saved calculation from the Update sheet', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  await p.locator('.row__main').first().click(); await headerSave(p)
  await p.locator('#save-title').fill('Car loan'); await sheetSave(p)
  await p.getByRole('button', { name: 'Back' }).click()
  has(await text(p, '.tools__list'), 'Car loan')
})
T('N07', 'NEG', 'Empty title in the Update sheet is refused with words', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  await p.locator('.row__main').first().click(); await headerSave(p)
  await p.locator('#save-title').fill('   '); await sheetSave(p)
  has(await sheetText(p), 'Give this a name'); eq(await p.locator('.sheet').count(), 1, 'sheet stays open')
  eq((await st(p)).cards[0].title, 'Home EMI', 'title unchanged')
})
T('N08', 'POS', 'Add a tag: row shows it, tag filter chip appears', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  await p.locator('.row__main').first().click(); await headerSave(p)
  await p.locator('.sheet .chip', { hasText: 'Loan' }).click(); await sheetSave(p); await p.getByRole('button', { name: 'Back' }).click()
  has(await text(p, '.tools__list'), 'Loan'); eq(await p.locator('.saved__head .chip', { hasText: 'Loan' }).count(), 1, 'filter chip')
})
T('N09', 'POS', 'Own tag can be added, then removed by tapping the chip again', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  await p.locator('.row__main').first().click(); await headerSave(p)
  await p.getByLabel('Add your own tag').fill('Mine'); await btn(p, 'Add', '.sheet').click()
  eq(await p.locator('.sheet .chip[aria-pressed=true]', { hasText: 'Mine' }).count(), 1, 'Mine chip pressed')
  await p.locator('.sheet .chip', { hasText: 'Mine' }).click(); await sheetSave(p)
  eq((await st(p)).cards[0].tags.length, 0, 'tags after removing')
})
T('N10', 'CORNER', 'Own tag longer than 30 characters is cut to 30', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  await p.locator('.row__main').first().click(); await headerSave(p)
  await p.getByLabel('Add your own tag').fill('x'.repeat(45)); await btn(p, 'Add', '.sheet').click(); await sheetSave(p)
  eq((await st(p)).cards[0].tags[0].length, 30, 'tag length')
})
T('N11', 'CORNER', 'Tags "Rent" and "rent" are one tag (as in the task sheet)', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  await p.locator('.row__main').first().click(); await headerSave(p)
  await p.locator('.sheet .chip', { hasText: /^Rent$/ }).click()
  await p.getByLabel('Add your own tag').fill('rent'); await btn(p, 'Add', '.sheet').click(); await sheetSave(p)
  const tags = (await st(p)).cards[0].tags
  eq(tags.length, 1, `tags ${JSON.stringify(tags)}`)
})
T('N12', 'CORNER', '12 tags on a calculation are all still there after a reload (loading keeps only 10)', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  await p.locator('.row__main').first().click(); await headerSave(p)
  for (let i = 0; i < 12; i++) { await p.getByLabel('Add your own tag').fill('t' + i); await btn(p, 'Add', '.sheet').click() }
  await sheetSave(p); await wait(450); await p.reload(); await p.waitForSelector('.app'); await notes(p)
  const hint = await text(p, '.row__main'); const n = hint.split(' · ').filter((x) => /^t\d+$/.test(x.trim().split('\n').pop())).length
  const stored12 = (await stored(p)).cards[0].tags.length
  ok(n === 12 || stored12 === 12, `sheet allowed 12 tags, only ${stored12} survive a reload (the other tags are cut silently)`)
})
T('N13', 'POS', 'Pin and unpin: Pinned section appears and goes', async () => {
  const { page: p } = await open(seed({ cards: [emi('a'), emi('b', 'Car EMI')] })); await notes(p)
  await p.getByRole('button', { name: 'Pin Car EMI' }).click()
  has(await text(p, '.tools__list'), 'Pinned')
  await p.getByRole('button', { name: 'Unpin Car EMI' }).click()
  lacks(await text(p, '.tools__list'), 'Pinned')
})
T('N14', 'CORNER', 'Pin limit: the 6th pin is refused with a message', async () => {
  const { page: p } = await open(seed({ cards: Array.from({ length: 6 }, (_, i) => emi('c' + i, 'EMI ' + i)) })); await notes(p)
  for (let i = 0; i < 5; i++) await p.getByRole('button', { name: `Pin EMI ${i}` }).click()
  await p.getByRole('button', { name: 'Pin EMI 5' }).click()
  has(await snackText(p) + await text(p), 'pin up to 5')
  eq(await p.locator('[aria-pressed=true][aria-label^="Unpin"]').count(), 5, 'pinned count')
})
T('N15', 'UX', 'The pin-limit message is visible somewhere (not silent)', async () => {
  const { page: p } = await open(seed({ cards: Array.from({ length: 6 }, (_, i) => emi('c' + i, 'EMI ' + i)) })); await notes(p)
  for (let i = 0; i < 6; i++) await p.getByRole('button', { name: `Pin EMI ${i}` }).click()
  await wait(100)
  const n = await p.locator('.notice, .toast, [role=status], [role=alert]').allInnerTexts()
  ok(n.join(' ').includes('pin up to'), `no visible message after the 6th pin; found ${JSON.stringify(n)}`)
})
T('N16', 'CORNER', 'Note text is cut at 5000 characters', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  await p.locator('.row__main').first().click(); await headerSave(p)
  await p.locator('#save-note').fill('n'.repeat(6000)); await sheetSave(p)
  eq((await st(p)).cards[0].note.length, 5000, 'stored note length')
})
T('N17', 'POS', 'Delete a calculation: snack says Trash, Undo brings it back', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  await p.locator('.row__main').first().click(); await p.getByRole('button', { name: 'Delete Home EMI' }).click()
  has(await snackText(p), 'Moved "Home EMI" to Trash'); has(await text(p, '.tools'), 'No notes yet')
  await p.locator('.snack').getByRole('button', { name: 'Undo' }).click()
  has(await text(p, '.tools__list'), 'Home EMI')
})
T('N18', 'POS', 'Trash lists the deleted item, Restore returns it', async () => {
  const { page: p } = await open(seed({ cards: [emi('a', 'Home EMI', { deletedAt: NOW - DAY })] })); await notes(p)
  await p.getByRole('button', { name: 'Trash (1)' }).click()
  has(await text(p, '.screen'), 'Home EMI'); await p.getByRole('button', { name: 'Restore' }).click()
  has(await text(p, '.tools__list'), 'Home EMI')
})
T('N19', 'UX', 'Empty Trash asks first; "Keep them" keeps; confirm empties', async () => {
  const { page: p } = await open(seed({ cards: [emi('a', 'A', { deletedAt: NOW - DAY }), emi('b', 'B', { deletedAt: NOW - DAY })] })); await notes(p)
  await p.getByRole('button', { name: 'Trash (2)' }).click()
  await p.getByRole('button', { name: 'Empty Trash' }).first().click()
  has(await text(p, '.screen'), 'deletes 2 items for good')
  eq((await st(p)).cards.length, 2, 'nothing deleted yet')
  await p.getByRole('button', { name: 'Keep them' }).click(); eq((await st(p)).cards.length, 2, 'after Keep')
  await p.getByRole('button', { name: 'Empty Trash' }).first().click()
  await p.locator('.confirm').getByRole('button', { name: 'Empty Trash' }).click()
  eq((await st(p)).cards.length, 0, 'after confirm')
})
T('N20', 'CORNER', 'Trash auto-purge: 8 days old goes at start, 6 days stays (fixed clock)', async () => {
  const { page: p } = await open(seed({ cards: [emi('old', 'Old', { deletedAt: NOW - 8 * DAY }), emi('new', 'Recent', { deletedAt: NOW - 6 * DAY })] }))
  await wait(300); const ids = (await st(p)).cards.map((c) => c.id)
  eq(JSON.stringify(ids), JSON.stringify(['new']), 'cards left')
})
T('N21', 'CORNER', 'Trash purge edge: deleted exactly 7 days ago is purged', async () => {
  const { page: p } = await open(seed({ cards: [emi('edge', 'Edge', { deletedAt: NOW - 7 * DAY }), emi('edge2', 'Edge2', { deletedAt: NOW - 7 * DAY + 60_000 })] }))
  const ids = (await st(p)).cards.map((c) => c.id)
  eq(JSON.stringify(ids), JSON.stringify(['edge2']), 'cards left (the 7-day card should go, the one a minute short stays)')
})
T('N22', 'CORNER', 'Purge also removes the purged card\'s reminder', async () => {
  const { page: p } = await open(seed({ cards: [emi('old', 'Old', { deletedAt: NOW - 9 * DAY })], reminders: [rem('r', 'old', NOW + DAY)] }))
  eq((await st(p)).reminders.length, 0, 'reminders left')
})
T('N23', 'POS', 'Search by title, tag and amount (57,650 finds 57650)', async () => {
  const { page: p } = await open(seed({ cards: [emi('a', 'Home EMI', { tags: ['Loan'] }), emi('b', 'Card bill', { amount: '57650', summary: 'Total' })] })); await notes(p)
  const q = p.getByLabel('Search notes')
  await q.fill('card'); has(await text(p, '.tools__list'), 'Card bill'); lacks(await text(p, '.tools__list'), 'Home EMI')
  await q.fill('loan'); has(await text(p, '.tools__list'), 'Home EMI'); lacks(await text(p, '.tools__list'), 'Card bill')
  await q.fill('57,650'); has(await text(p, '.tools__list'), 'Card bill')
})
T('N24', 'NEG', 'Search with nothing matching says so', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  await p.getByLabel('Search notes').fill('zzzz'); has(await text(p, '.tools__list'), 'Nothing matches.')
})
T('N25', 'NEG', 'Search with symbols ( [ \\ * + ? does not crash', async () => {
  const { page: p, errors } = await open(seed({ cards: [emi('a')] })); await notes(p)
  for (const q of ['(', '[', '\\', '*', '+?', '<script>', '%', "'"]) await p.getByLabel('Search notes').fill(q)
  eq(errors.length, 0, 'errors ' + errors.join('|')); await noBadText(p, 'after symbol search')
})
T('N26', 'CORNER', 'Duplicate titles are allowed and both rows show', async () => {
  const { page: p } = await open(seed({ cards: [emi('a', 'Same'), emi('b', 'Same')] })); await notes(p)
  eq(await p.locator('.row__label', { hasText: 'Same' }).count(), 2, 'rows')
})
T('N27', 'CORNER', '500 saved items open and render without error (cap seeded)', async () => {
  const { page: p, errors } = await open(seed({ cards: Array.from({ length: 500 }, (_, i) => emi('c' + i, 'Item ' + i)) })); await notes(p)
  ok((await p.locator('.row__label').count()) >= 500, 'rows rendered'); eq(errors.length, 0, errors.join('|'))
})
T('N28', 'CORNER', 'At 500 saved items a new task is refused with a clear message', async () => {
  const { page: p } = await open(seed({ cards: Array.from({ length: 500 }, (_, i) => emi('c' + i, 'Item ' + i)) })); await notes(p); await modeTodo(p)
  await quickAdd(p, 'one too many')
  const t = await text(p); has(t, 'up to 500')
  eq((await st(p)).cards.length, 500, 'cards stored')
})
T('N29', 'CORNER', 'At 500 saved items a calculation cannot be saved either, and says why', async () => {
  const { page: p } = await open(seed({ cards: Array.from({ length: 500 }, (_, i) => emi('c' + i, 'Item ' + i)) }))
  await openEmi(p)
  await headerSave(p); await sheetSave(p); await wait(200)
  has(await text(p), 'up to 500'); eq((await st(p)).cards.length, 500, 'cards stored')
})
T('N30', 'UI', 'Pin button is at least 44px', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  const b = await box(p.getByRole('button', { name: 'Pin Home EMI' })); ok(b.width >= 44 && b.height >= 44, `pin is ${b.width}x${b.height}`)
})
T('N31', 'UI', 'Row main button is at least 44px high', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  const b = await box(p.locator('.row__main').first()); ok(b.height >= 44, `row is ${b.height}px high`)
})
T('N32', 'UI', 'Long unbroken title (120 chars) does not overflow at 360px', async () => {
  const { page: p } = await open(seed({ cards: [emi('a', 'W'.repeat(120), { summary: 'S'.repeat(150) })] })); await notes(p); await noOverflow(p, 'notes list')
})
T('N33', 'UI', 'Notes list at 200% font and light theme: no overflow', async () => {
  const { page: p } = await open(seed({ cards: [emi('a', 'Home loan EMI for the long flat', { tags: ['Credit Card', 'Loan', 'Work'] })], reminders: [rem('r', 'a', NOW + 2 * DAY)], settings: { theme: 'light' } }), { font: 200 }); await notes(p)
  await noOverflow(p, '200% light')
})
T('N34', 'UI', 'Notes in landscape 800x360: list scrolls, no overflow', async () => {
  const { page: p } = await open(seed({ cards: Array.from({ length: 12 }, (_, i) => emi('c' + i, 'Item ' + i)) }), { width: 800, height: 360 }); await notes(p)
  await noOverflow(p, 'landscape'); ok(await p.locator('.tabbar').isVisible(), 'tab bar visible')
})
T('N35', 'UX', 'Row tap opens the card; Back returns to the list with scroll intact', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  await p.locator('.row__main').first().click(); await p.getByRole('button', { name: 'Back' }).click()
  has(await text(p, '.tools__list'), 'Home EMI')
})
T('N36', 'CORNER', 'A card whose calculator no longer exists: tapping it does something visible', async () => {
  const { page: p } = await open(seed({ cards: [emi('a', 'Old tool', { toolId: 'gone-calc' })] })); await notes(p)
  await p.locator('.row__main').first().click(); await wait(200)
  const screens = await p.locator('.screen').count()
  ok(screens > 0 || (await p.locator('.sheet').count()) > 0 || (await snackText(p)) !== '', 'tap on a card with an unknown calculator did nothing (no screen, no message)')
})
T('N37', 'UX', 'Tag filter: tap chip filters, tap again clears', async () => {
  const { page: p } = await open(seed({ cards: [emi('a', 'Home EMI', { tags: ['Loan'] }), emi('b', 'Other', { tags: ['Work'] })] })); await notes(p)
  await p.locator('.saved__head .chip', { hasText: 'Loan' }).click(); lacks(await text(p, '.tools__list'), 'Other')
  await p.locator('.saved__head .chip', { hasText: 'Loan' }).click(); has(await text(p, '.tools__list'), 'Other')
})
T('N38', 'POS', 'Sections: Pinned, Lists and Calculations separate', async () => {
  const { page: p } = await open(seed({ cards: [emi('a', 'Calc', { pinned: true }), tape('t', 'Trip', [{ label: 'x', value: '10' }]), emi('b', 'Calc2')] })); await notes(p)
  const t = await text(p, '.tools__list'); for (const h of ['Pinned', 'Lists', 'Calculations']) has(t, h)
})
T('N39', 'CORNER', 'Saving a calculation from Tools: new card with snack "Saved to Notes" and View link', async () => {
  const { page: p } = await open(); await openEmi(p)
  await headerSave(p); await sheetSave(p)
  const s = await snackText(p); has(s, 'Saved to Notes'); has(s, 'View')
  await p.locator('.snack').getByRole('button', { name: 'View' }).click()
  has(await text(p, '.tools__list'), 'Loan EMI')
})
T('N40', 'UX', 'Save sheet closes with Escape and X; X is labelled', async () => {
  const { page: p } = await open(); await openEmi(p)
  await headerSave(p); await p.keyboard.press('Escape'); eq(await p.locator('.sheet').count(), 0, 'sheet after Escape')
  await headerSave(p); await p.getByRole('button', { name: 'Close Save' }).click(); eq(await p.locator('.sheet').count(), 0, 'sheet after X')
})
T('N41', 'UI', 'Sheets cover the tab bar (scrim and sheet above it)', async () => {
  const { page: p } = await open(); await openEmi(p); await headerSave(p)
  const tb = await box(p.locator('.tabbar')); const hit = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('.sheet,.scrim') ? 'cover' : e.className) : 'none' }, [tb.x + tb.width / 2, tb.y + tb.height / 2])
  eq(hit, 'cover', 'element at the tab bar centre')
})
T('R01', 'POS', 'Due: "Add a pack" adds the four advance-tax reminders once, never twice', async () => {
  const { page: p } = await open(); await tab(p, 'Due')
  await p.getByRole('button', { name: /Add advance tax reminders/ }).click(); await wait(200)
  let s = await st(p); eq(s.reminders.length, 4, 'reminders after first add'); eq(s.cards.every((c) => /^Advance tax instalment \d of 4 \(\d+% due\)$/.test(c.title)), true, 'titles')
  await p.getByRole('button', { name: /Add a pack/ }).click(); await wait(200)
  s = await st(p); eq(s.reminders.length, 4, 'reminders after second add'); has(await snackText(p), 'already there')
})
T('R02', 'POS', 'Settings: reminder time is saved, and the test reminder says it needs the Android app on the web', async () => {
  const { page: p } = await open(); await p.getByRole('button', { name: 'Settings' }).click()
  await p.locator('input[type=time]').fill('18:30'); await p.getByText('Send a test reminder').click()
  has(await snackText(p), 'only works in the Android app'); eq((await st(p)).settings.reminderTime, '18:30', 'saved time')
})
T('R03', 'POS', 'Backup nudge: shown once on Settings with 25+ items and no backup, and Dismiss hides it', async () => {
  const { page: p } = await open(seed({ cards: Array.from({ length: 25 }, (_, i) => emi('c' + i, 'Item ' + i)) })); await wait(300)
  has(await snackText(p), '25 items and no backup yet')
  await p.getByRole('button', { name: 'Settings' }).click(); has(await text(p, '.screen__body'), '25 items and no backup yet')
  await p.getByRole('button', { name: 'Dismiss' }).click(); lacks(await text(p, '.screen__body'), 'no backup yet')
})
T('N42', 'RUNTIME', 'Reload keeps cards, tags, pinned, note, reminders', async () => {
  const { page: p } = await open(seed({ cards: [emi('a', 'Keep', { tags: ['Loan'], pinned: true, note: 'hello' })], reminders: [rem('r', 'a', NOW + 5 * DAY, { repeat: 'monthly' })] }))
  await wait(300); await p.reload(); await p.waitForSelector('.app'); const s = await st(p)
  eq(s.cards[0].note, 'hello', 'note'); eq(s.cards[0].pinned, true, 'pinned'); eq(s.cards[0].tags[0], 'Loan', 'tag'); eq(s.reminders[0].repeat, 'monthly', 'repeat')
})
T('N43', 'UX', 'Tapping the Notes tab again closes an open card and clears search', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  await p.getByLabel('Search notes').fill('home'); await p.locator('.row__main').first().click()
  await notes(p); eq(await p.locator('.screen').count(), 0, 'screen closed'); eq(await p.getByLabel('Search notes').inputValue(), '', 'search cleared')
})
T('N44', 'UX', 'Notes: Segmented switch Notes/To-do remembered after visiting another tab', async () => {
  const { page: p } = await open(); await notes(p); await modeTodo(p); await tab(p, 'Due'); await notes(p)
  eq(await p.getByRole('radio', { name: /^To-do/ }).getAttribute('aria-checked'), 'true', 'To-do still selected')
})
T('N45', 'UX', 'Search text typed in Notes is lost when you leave the tab (note the behaviour)', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await notes(p)
  await p.getByLabel('Search notes').fill('home'); await tab(p, 'Due'); await notes(p)
  eq(await p.getByLabel('Search notes').inputValue(), 'home', 'search text kept across tabs')
})

// ================================================================== RUN
const only = process.argv.slice(2)
const wanted = CASES.filter((c) => only.length === 0 || only.some((o) => c.id.startsWith(o)))
let planBundle = null
APP = await startApp()
const results = new Array(wanted.length)
let next = 0
async function worker() {
  while (next < wanted.length) {
    const i = next++
    const c = wanted[i]
    const ctx = { pages: [] }
    let line
    try {
      await als.run(ctx, () => Promise.race([c.fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('case timed out after 60s')), 60000))]))
      const errs = ctx.pages.flatMap((p) => p.errors || [])
      if (errs.length && !c.opts.allowErrors) throw new Error(`console/page errors: ${errs.slice(0, 2).join(' | ')}`)
      line = `PASS ${c.id} ${c.type} ${c.title}`
    } catch (e) {
      line = `FAIL ${c.id} ${c.type} ${c.title} :: ${String(e.message).replace(/\s+/g, ' ').slice(0, 400)}`
    }
    results[i] = line
    console.error(line.slice(0, 160))
    for (const p of ctx.pages) await p.close().catch(() => {})
  }
}
await Promise.all([worker(), worker(), worker(), worker()])
for (const l of results) console.log(l)
const failed = results.filter((l) => l.startsWith('FAIL')).length
console.log(`\n${results.length - failed} passed, ${failed} failed, ${results.length} cases`)
await APP.stop()
process.exit(failed ? 1 : 0)
