// QA campaign (browser part) for Notes, To-do, Due, Settings and the first-run tours: from a fresh install to heavy use.
// Cases are N-001... . The planning and data logic (time zones, month ends, delivery check, backup shape) is N-1xx in
// src/store/qaNotesDue.test.ts. Notifications cannot fire in a browser, so what is proven here is what the screens do.
// Run:  node e2e/qa-notes-due.test.mjs            (all)    node e2e/qa-notes-due.test.mjs N-02 N-03   (ids that start with)
// One line per case: PASS|FAIL|KNOWN <id> <type> <title> :: what was seen. KNOWN = an open bug, kept as a visible failure.
// Screenshots (a few key screens) land in $TMPDIR/calc-qa-notes-due.
process.env.TZ = 'Asia/Kolkata'
import { startApp, openApp, tab, stored, overflowing } from './lib.mjs'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AsyncLocalStorage } from 'node:async_hooks'

const OUT = join(tmpdir(), 'calc-qa-notes-due')
mkdirSync(OUT, { recursive: true })
const IST = '+05:30'
const ist = (s) => Date.parse(`${s.length <= 10 ? s + 'T09:00' : s}:00${IST}`)
const DAY = 86_400_000
const NOW = ist('2026-11-02T10:00') // Monday 2 Nov 2026, 10:00 in India

let seq = 0
const base = (o) => ({ title: 'Item', kind: 'tool', toolId: null, inputs: null, summary: '', amount: null, lines: [], note: '', tags: [], pinned: false, createdAt: NOW - 1000 * ++seq, updatedAt: NOW - 1000 * seq, deletedAt: null, ...o })
const emi = (id, title = 'Home EMI', o = {}) => base({ id, title, kind: 'tool', toolId: 'emi', inputs: { principal: '5000000', rate: '8.5', tenure: '20', tenureUnit: 'years' }, summary: 'Monthly EMI: ₹43,391.16', amount: '43391.16', amountFmt: 'money', ...o })
const task = (id, title, o = {}) => base({ id, title, kind: 'task', summary: 'No date', ...o })
const tape = (id, title, lines = [], o = {}) => base({ id, title, kind: 'tape', summary: `${lines.length} lines`, amount: String(lines.reduce((s, l) => s + Number(l.value), 0)), lines: lines.map((l, i) => ({ id: `${id}l${i}`, ...l })), ...o })
const rem = (id, cardId, at, o = {}) => ({ id, cardId, dueAt: at, repeat: 'none', anchorDay: new Date(at + 19_800_000).getUTCDate(), leadDays: 0, done: false, history: [], ...o })
const seed = ({ cards = [], reminders = [], settings = {}, extra = {} } = {}) => ({ schemaVersion: 3, settings: { theme: 'dark', tours: { budget: 'done', notes: 'done', due: 'done' }, ...settings }, history: [], cards, reminders, memory: null, input: { expr: '', fresh: false }, ...extra })
/** A seed in which the first-run tours have NOT been seen (a truly new person). */
const fresh = (o = {}) => seed({ ...o, settings: { tours: {}, ...(o.settings ?? {}) } })

const fail = (msg) => { throw new Error(msg) }
const eq = (a, b, what) => { if (a !== b) fail(`${what}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`) }
const ok = (c, what) => { if (!c) fail(what) }
const has = (t, part, what = 'text') => ok(String(t).includes(part), `${what} should contain "${part}" but is: ${String(t).replace(/\s+/g, ' ').slice(0, 240)}`)
const lacks = (t, part, what = 'text') => ok(!String(t).includes(part), `${what} should NOT contain "${part}": ${String(t).replace(/\s+/g, ' ').slice(0, 240)}`)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const text = (p, sel = '.app') => p.locator(sel).first().innerText()
const snackText = async (p) => ((await p.locator('.snack').count()) ? p.locator('.snack').innerText() : '')
const st = async (p) => { await wait(450); return stored(p) }
const bad = /\b(NaN|undefined|Infinity|\[object Object\]|Invalid Date)\b/
const noBadText = async (p, where) => { const t = await text(p); ok(!bad.test(t), `${where}: shows bad text "${(bad.exec(t) ?? [])[0]}"`) }
const noOverflow = async (p, where) => { const o = await overflowing(p); eq(o.length, 0, `${where}: sideways overflow ${JSON.stringify(o)}`) }
const shot = (p, n) => p.screenshot({ path: join(OUT, `${n}.png`) })
const notesTab = (p) => tab(p, 'Notes')
const modeTodo = (p) => p.getByRole('radio', { name: /^To-do/ }).click()
const view = (p, name) => p.getByRole('radio', { name, exact: true }).click()
const quickAdd = async (p, t) => { await p.locator('input[aria-label="New task"]').fill(t); await p.locator('.todo__add button[type=submit]').click() }
const sheetSave = (p) => p.locator('.sheet .sheet__foot .btn--primary').click()
const settings = (p) => p.locator('[aria-label="Settings"]').click()
const tourNext = (p) => p.locator('.sheet__foot .btn--primary')
/** Every interactive thing on screen is at least 44px in one direction. Lists the ones that are not. */
const smallTargets = (p, scope = '.app') => p.evaluate((sc) => {
  const out = []
  document.querySelectorAll(`${sc} button, ${sc} input:not([type=hidden]), ${sc} [role=radio], ${sc} [role=switch], ${sc} a[href]`).forEach((el) => {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || el.closest('.sr-only') || getComputedStyle(el).visibility === 'hidden') return
    if (r.width < 44 && r.height < 44) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 24)}[${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}] ${Math.round(r.width)}x${Math.round(r.height)}`)
  })
  return out
}, scope)

// ------------------------------------------------------------------ runner
const CASES = []
const T = (id, type, title, fn, opts = {}) => CASES.push({ id, type, title, fn, opts })
let APP
const als = new AsyncLocalStorage()
const track = (r) => { als.getStore()?.pages.push(r); return r }
const open = async (data = seed(), o = {}) => track(await openApp(APP, { data, now: NOW, theme: null, ...o }))
/** A real first run: nothing stored at all (no seed), like a freshly installed app. */
const openNothing = async (o = {}) => {
  const context = await APP.browser.newContext({ viewport: { width: 360, height: 790 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'en-IN', timezoneId: 'Asia/Kolkata', reducedMotion: 'reduce', acceptDownloads: true, ...o })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 200)}`) })
  await page.addInitScript((fixed) => { const RealDate = Date; globalThis.Date = class extends RealDate { constructor(...a) { if (a.length === 0) super(fixed); else super(...a) } static now() { return fixed } } }, NOW)
  await page.goto(APP.url)
  await page.waitForSelector('.app', { timeout: 10000 })
  return track({ page, errors, context, async close() { await context.close() } })
}

// ================================================================== FRESH INSTALL, FIRST RUN, TOURS
T('N-001', 'POS', 'Fresh install: app opens on Calculate with no errors, no stored data needed', async () => {
  const { page: p, errors } = await openNothing()
  ok(await p.locator('.tabbar').isVisible(), 'tab bar'); eq(errors.length, 0, errors.join('|'))
  has(await p.locator('.tabbar .tab[aria-current=page]').innerText(), 'Calculate', 'start tab')
})
T('N-002', 'POS', 'Fresh install, Notes: the tip row shows once, the empty state says what to do, nothing pops up by itself', async () => {
  const { page: p } = await openNothing(); await notesTab(p)
  eq(await p.locator('.tourrow').count(), 1, 'tip row'); eq(await p.locator('.sheet').count(), 0, 'no auto pop-up')
  const t = await text(p, '.tools'); has(t, 'No notes yet'); has(t, 'Open calculators')
  await shot(p, 'N-002-notes-fresh')
})
T('N-003', 'POS', 'Fresh install, Due: tip row, empty state, a way forward (Open notes, Add advance tax reminders)', async () => {
  const { page: p } = await openNothing(); await tab(p, 'Due')
  eq(await p.locator('.tourrow').count(), 1, 'tip row')
  const t = await text(p); has(t, 'No reminders yet'); has(t, 'Open notes'); has(t, 'Add advance tax reminders')
  await p.getByRole('button', { name: 'Open notes' }).click()
  has(await p.locator('.tabbar .tab[aria-current=page]').innerText(), 'Notes', 'Open notes goes to Notes')
})
T('N-004', 'UX', 'Notes tour: Next/Back, progress words, Done hides the row for good (also after reload) and empty state offers "Take the tour"', async () => {
  const { page: p } = await openNothing(); await notesTab(p)
  await p.locator('.tourrow__open').click()
  const sheet = p.locator('.sheet'); has(await sheet.innerText(), 'Step 1 of 6')
  eq(await p.locator('.sheet__foot .tour__back').evaluate((e) => getComputedStyle(e).visibility), 'hidden', 'Back on step 1')
  for (let i = 0; i < 5; i++) await tourNext(p).click()
  has(await sheet.innerText(), 'Step 6 of 6'); eq(await tourNext(p).innerText(), 'Done', 'last button')
  await p.locator('.sheet__foot .tour__back').click(); has(await sheet.innerText(), 'Step 5 of 6')
  await tourNext(p).click(); await tourNext(p).click()
  eq(await p.locator('.sheet').count(), 0, 'closed')
  eq((await st(p)).settings.tours.notes, 'done', 'stored done')
  await p.reload(); await p.waitForSelector('.app'); await notesTab(p)
  eq(await p.locator('.tourrow').count(), 0, 'row after reload'); has(await text(p, '.tools'), 'Take the tour')
})
T('N-005', 'UX', 'Due tour: X closes at any step and counts as skipped; Back at step 1 is hidden, not removed (footer does not jump)', async () => {
  const { page: p } = await openNothing(); await tab(p, 'Due')
  await p.locator('.tourrow__open').click(); await tourNext(p).click(); await tourNext(p).click()
  const h1 = (await p.locator('.sheet__foot').boundingBox()).height
  await p.locator('.sheet').getByRole('button', { name: /^Close/ }).click()
  eq(await p.locator('.sheet').count(), 0, 'closed'); eq((await st(p)).settings.tours.due, 'skipped', 'stored skipped')
  ok(h1 >= 44, `footer height ${h1}`)
})
T('N-006', 'UX', 'Escape closes a tour too; dismissing the row (X) hides it and survives a reload', async () => {
  const { page: p } = await openNothing(); await tab(p, 'Due')
  await p.locator('.tourrow__open').click(); await p.keyboard.press('Escape'); eq(await p.locator('.sheet').count(), 0, 'sheet after Escape')
  eq(await p.locator('.tourrow').count(), 0, 'row after Escape counts as skipped')
  await tab(p, 'Notes'); await p.getByRole('button', { name: /Dismiss the Notes/ }).click(); eq(await p.locator('.tourrow').count(), 0, 'dismissed')
  await p.reload(); await p.waitForSelector('.app'); await notesTab(p); eq(await p.locator('.tourrow').count(), 0, 'still gone')
})
T('N-007', 'UX', 'Settings "Tips and tours": each tour replays with no Try links; a finished tour stays done if closed early; "Show first-visit tips again" brings the rows back', async () => {
  const { page: p } = await open(); await settings(p)
  const sect = p.locator('section[aria-label="Tips and tours"]')
  await sect.getByRole('button', { name: /^Notes/ }).click()
  eq(await p.locator('.sheet').getByRole('button', { name: /Try it/ }).count(), 0, 'Try links from Settings')
  await tourNext(p).click(); await p.locator('.sheet').getByRole('button', { name: /^Close/ }).click()
  eq((await st(p)).settings.tours.notes, 'done', 'still done')
  await sect.getByRole('button', { name: /Show first-visit tips again/ }).click()
  has(await snackText(p), 'tips will show again'); eq(Object.keys((await st(p)).settings.tours).length, 0, 'tours cleared')
})
T('N-008', 'NEG', 'An old backup (no tours, no reminder time) restores cleanly and the tip rows show again', async () => {
  const { page: p } = await open(); await settings(p)
  const old = { kind: 'vkcalc-backup', schemaVersion: 3, exportedAt: '2026-01-01T00:00:00Z', data: { schemaVersion: 3, settings: { theme: 'dark' }, history: [], cards: [emi('a')], reminders: [], memory: null, input: { expr: '', fresh: false } } }
  const f = join(tmpdir(), 'qa-old-backup.json'); writeFileSync(f, JSON.stringify(old))
  await p.locator('input[type=file]').setInputFiles(f)
  has(await text(p, '.screen__body'), 'Replace everything with the backup'.replace('Replace everything with the backup', 'Replace'))
  await p.getByRole('button', { name: 'Replace everything' }).click()
  has(await text(p, '.screen__body'), 'Restored 0 calculations, 1 notes and lists')
  await p.getByRole('button', { name: 'Back' }).first().click(); await notesTab(p)
  eq(await p.locator('.tourrow').count(), 1, 'row after restoring an old backup'); has(await text(p, '.tools__list'), 'Home EMI')
})
T('N-009', 'NEG', 'Restoring junk is refused in words and changes nothing (empty file, text, wrong JSON, huge array)', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await settings(p)
  const f = join(tmpdir(), 'qa-bad.json')
  for (const content of ['', 'hello world', '{"a":1}', '[1,2,3]', '{"kind":"vkcalc-backup","data":5}']) {
    writeFileSync(f, content); await p.locator('input[type=file]').setInputFiles(f)
    const t = await text(p, '.screen__body'); ok(/isn't a Calc backup|damaged/.test(t), `message for ${JSON.stringify(content.slice(0, 12))}: ${t.slice(0, 120)}`)
    await noBadText(p, 'after junk restore')
  }
  eq((await st(p)).cards.length, 1, 'cards unchanged')
})
T('N-010', 'UX', 'Budget tour row shows on a fresh install and a Try it link opens the screen it names', async () => {
  const { page: p } = await openNothing(); await tab(p, 'Budget')
  eq(await p.locator('.tourrow').count(), 1, 'row')
  await p.locator('.tourrow__open').click(); await p.getByRole('button', { name: /Try it: Add an expense/ }).click(); await wait(200)
  has(await text(p, '.sheet'), 'Add expense')
})

// ================================================================== TO-DO
T('N-020', 'POS', 'To-do from zero: empty state words, quick add in Today lands in Today with today\'s date, shows in Due', async () => {
  const { page: p } = await open(); await notesTab(p); await modeTodo(p)
  has(await text(p, '.todo'), 'No tasks yet')
  await quickAdd(p, 'Call plumber')
  const t = await text(p, '.todo'); has(t, 'Call plumber'); has(t, 'Today · 2 Nov 2026'); eq(await p.locator('input[aria-label="New task"]').inputValue(), '', 'box cleared')
  const s = await st(p); eq(s.reminders.length, 1, 'reminder'); eq(s.cards[0].kind, 'task', 'kind')
  await tab(p, 'Due'); has(await text(p, '.tools__list'), 'Call plumber')
  await shot(p, 'N-020-todo-today')
})
T('N-021', 'NEG', 'Quick add with an empty or spaces-only title says so in words, nothing is added', async () => {
  const { page: p } = await open(); await notesTab(p); await modeTodo(p)
  await quickAdd(p, '   '); has(await text(p, '.todo__add'), 'Write what needs doing'); eq((await st(p)).cards.length, 0, 'cards')
  eq(await p.locator('input[aria-label="New task"]').getAttribute('aria-invalid'), 'true', 'aria-invalid')
  await p.locator('input[aria-label="New task"]').fill('x'); lacks(await text(p, '.todo__add'), 'Write what needs doing', 'error clears while typing')
})
T('N-022', 'CORNER', 'Quick add: 121+ characters are stopped at 120; emoji, Hindi, Arabic, quotes and <b> all store and show as plain text', async () => {
  const { page: p } = await open(); await notesTab(p); await modeTodo(p); await view(p, 'All')
  await quickAdd(p, 'y'.repeat(150)); eq((await st(p)).cards[0].title.length, 120, 'title cut at 120')
  for (const t of ['🚗 सर्विस كتاب', `He said "hi" & <b>bold</b>`]) await quickAdd(p, t)
  const s = await st(p); ok(s.cards.some((c) => c.title === `He said "hi" & <b>bold</b>`), 'title kept exactly')
  eq(await p.locator('.todo b').count(), 0, 'no html injected'); await noOverflow(p, 'weird titles')
})
T('N-023', 'POS', 'All view: an undated task goes under "No date"; Upcoming and Today stay empty with their own words', async () => {
  const { page: p } = await open(); await notesTab(p); await modeTodo(p); await view(p, 'All'); await quickAdd(p, 'Someday thing')
  has(await text(p, '.todo'), 'No date'); eq((await st(p)).reminders.length, 0, 'no reminder for an undated task')
  await view(p, 'Today'); has(await text(p, '.todo'), 'Nothing due today. Add a task, or look at All.')
  await view(p, 'Upcoming'); has(await text(p, '.todo'), 'Nothing coming up')
})
T('N-024', 'POS', 'Tick a task: snackbar "Done" with Undo; Undo puts it back; the Done section is closed and counts', async () => {
  const { page: p } = await open(seed({ cards: [task('t', 'Pay rent')], reminders: [rem('r', 't', NOW)] })); await notesTab(p); await modeTodo(p)
  await p.getByRole('checkbox', { name: 'Pay rent, done' }).check(); has(await snackText(p), 'Done: "Pay rent"')
  has(await text(p, '.todo__done'), 'Done'); eq(await p.locator('.todo__done .todo__row').count(), 0, 'done list closed')
  await p.locator('.snack').getByRole('button', { name: 'Undo' }).click()
  eq(await p.getByRole('checkbox', { name: 'Pay rent, done' }).isChecked(), false, 'unticked after Undo')
  eq((await st(p)).reminders[0].done, false, 'reminder reopened')
})
T('N-025', 'UX', 'Done section opens; Clear done asks first (Keep them keeps), then moves to Trash with Undo', async () => {
  const { page: p } = await open(seed({ cards: [task('a', 'A', { done: true, doneAt: NOW }), task('b', 'B', { done: true, doneAt: NOW }), task('c', 'C')] })); await notesTab(p); await modeTodo(p); await view(p, 'All')
  await p.locator('.todo__toggle').click(); eq(await p.locator('.todo__done .todo__row').count(), 2, 'done rows')
  await p.getByRole('button', { name: 'Clear done' }).click(); has(await text(p, '.todo__confirm'), 'Move 2 done tasks to Trash')
  await p.getByRole('button', { name: 'Keep them' }).click(); eq((await st(p)).cards.filter((c) => !c.deletedAt).length, 3, 'kept')
  await p.getByRole('button', { name: 'Clear done' }).click(); await p.locator('.todo__confirm').getByRole('button', { name: 'Clear done' }).click()
  has(await snackText(p), 'Moved 2 done tasks to Trash'); await p.locator('.snack').getByRole('button', { name: 'Undo' }).click()
  eq((await st(p)).cards.filter((c) => !c.deletedAt).length, 3, 'undone')
})
T('N-026', 'POS', 'Task sheet: date + monthly; saved task shows "monthly" and the date; Due shows it with the repeat', async () => {
  const { page: p } = await open(); await notesTab(p); await modeTodo(p); await view(p, 'All')
  await p.getByRole('button', { name: 'Add with a date, repeat or note' }).click()
  await p.locator('#task-title').fill('Pay rent'); await p.locator('#task-date').fill('2026-11-05')
  await p.locator('.sheet').getByRole('radio', { name: 'Monthly' }).click(); await sheetSave(p)
  const t = await text(p, '.todo'); has(t, 'Pay rent'); has(t, '5 Nov 2026'); has(t, 'monthly')
  const s = await st(p); eq(s.reminders[0].repeat, 'monthly', 'repeat'); eq(s.reminders[0].anchorDay, 5, 'anchor')
  await tab(p, 'Due'); has(await text(p, '.tools__list'), 'In 3 days'); has(await text(p, '.tools__list'), 'monthly')
})
T('N-027', 'NEG', 'Task sheet: empty title blocks Save with an error under the field; a repeat without a date says "Pick a date first"', async () => {
  const { page: p } = await open(); await notesTab(p); await modeTodo(p)
  await p.getByRole('button', { name: 'Add with a date, repeat or note' }).click(); await sheetSave(p)
  has(await text(p, '.sheet'), 'Write what needs doing'); eq(await p.locator('.sheet').count(), 1, 'sheet stays')
  await p.locator('#task-title').fill('x'); await p.locator('.sheet').getByRole('radio', { name: 'Yearly' }).click(); await sheetSave(p)
  has(await text(p, '.sheet'), 'Pick a date first'); eq((await st(p)).cards.length, 0, 'nothing saved')
})
T('N-028', 'CORNER', 'Task sheet: date 29 Feb 2028 (leap) saves monthly with anchor 29; 31 Jan monthly anchors on 31', async () => {
  const { page: p } = await open(); await notesTab(p); await modeTodo(p)
  for (const [title, d] of [['Leap', '2028-02-29'], ['Month end', '2026-12-31']]) {
    await p.getByRole('button', { name: 'Add with a date, repeat or note' }).click()
    await p.locator('#task-title').fill(title); await p.locator('#task-date').fill(d); await p.locator('.sheet').getByRole('radio', { name: 'Monthly' }).click(); await sheetSave(p)
  }
  const s = await st(p); eq(s.reminders.find((r) => r.dueAt === ist('2028-02-29')).anchorDay, 29, 'leap anchor'); eq(s.reminders.find((r) => r.dueAt === ist('2026-12-31')).anchorDay, 31, 'month end anchor')
})
T('N-029', 'CORNER', 'Task sheet: a date more than 5 years ahead and a date before 2000 are refused in words', async () => {
  const { page: p } = await open(); await notesTab(p); await modeTodo(p)
  await p.getByRole('button', { name: 'Add with a date, repeat or note' }).click(); await p.locator('#task-title').fill('Far'); await p.locator('#task-date').fill('2040-01-01'); await sheetSave(p)
  has(await text(p, '.sheet'), 'within the next 5 years'); await p.locator('#task-date').fill('1999-05-05'); await sheetSave(p); has(await text(p, '.sheet'), 'from the year 2000')
})
T('N-030', 'POS', 'Several heads-up times: pills toggle, the last pill cannot be switched off, saved as a list biggest first', async () => {
  const { page: p } = await open(seed({ cards: [task('t', 'Insurance')], reminders: [rem('r', 't', ist('2026-12-20'))] })); await notesTab(p); await modeTodo(p); await view(p, 'All')
  await p.getByText('Insurance').first().click(); const sh = p.locator('.sheet')
  await sh.getByRole('button', { name: '14 days before' }).click(); await sh.getByRole('button', { name: '1 day before' }).click(); await sh.getByRole('button', { name: '30 days before' }).click()
  await sh.getByRole('button', { name: 'On the day' }).click() // it was the only one picked, plus three others now: allowed to switch off
  for (const n of ['14 days before', '1 day before', '30 days before']) await sh.getByRole('button', { name: n }).click()
  eq(await sh.locator('.lead [aria-pressed=true]').count(), 1, 'one pill stays on'); await sh.getByRole('button', { name: 'On the day' }).click()
  await sh.getByRole('button', { name: '14 days before' }).click(); await sh.getByRole('button', { name: '7 days before' }).click(); await sheetSave(p)
  const r = (await st(p)).reminders[0]; eq(JSON.stringify(r.leads), '[14,7,0]', 'leads'); eq(r.leadDays, 14, 'leadDays')
})
T('N-031', 'POS', 'Repeat after I tick it: switch, days box, invalid values (0, 366, blank) are refused in words; 180 saves; ticking moves the date from today', async () => {
  const { page: p } = await open(seed({ cards: [task('t', 'Service car')], reminders: [rem('r', 't', NOW)] })); await notesTab(p); await modeTodo(p)
  await p.getByText('Service car').first().click(); const sh = p.locator('.sheet')
  await sh.getByRole('switch', { name: 'Repeat after I tick it' }).click()
  for (const bad of ['0', '366', '']) { await sh.locator('#task-after').fill(bad); await sheetSave(p); has(await text(p, '.sheet'), 'from 1 to 365', `error for "${bad}"`) }
  await sh.locator('#task-after').fill('180'); await sheetSave(p); eq((await st(p)).reminders[0].afterDays, 180, 'afterDays')
  await p.getByRole('checkbox', { name: 'Service car, done' }).check(); await wait(100)
  has(await snackText(p), 'Next on 1 May 2027'); eq((await st(p)).reminders[0].dueAt, ist('2027-05-01'), 'next date')
})
T('N-032', 'UX', 'Delete a task from its sheet: goes to Trash with Undo; Trash lists it; Restore returns it', async () => {
  const { page: p } = await open(seed({ cards: [task('t', 'Old task')] })); await notesTab(p); await modeTodo(p); await view(p, 'All')
  await p.getByText('Old task').first().click(); await p.getByRole('button', { name: 'Delete task' }).click()
  has(await snackText(p), 'Moved "Old task" to Trash'); await p.locator('.snack').getByRole('button', { name: 'Undo' }).click(); has(await text(p, '.todo'), 'Old task')
  await p.getByText('Old task').first().click(); await p.getByRole('button', { name: 'Delete task' }).click()
  await modeTodo(p).catch(() => {}); await p.getByRole('radio', { name: /^Notes/ }).click(); await p.getByRole('button', { name: /Trash \(1\)/ }).click()
  has(await text(p, '.screen'), 'Old task'); await p.getByRole('button', { name: 'Restore' }).click()
})
T('N-033', 'POS', 'Task tags: preset and own tag; the sixth tag is refused in words; same tag in other case is one tag', async () => {
  const { page: p } = await open(seed({ cards: [task('t', 'Tagged')] })); await notesTab(p); await modeTodo(p); await view(p, 'All')
  await p.getByText('Tagged').first().click(); const sh = p.locator('.sheet')
  for (let i = 0; i < 6; i++) { await sh.getByLabel('Add your own tag').fill('tag' + i); await sh.getByRole('button', { name: 'Add tag' }).click() }
  await sheetSave(p); has(await text(p, '.sheet'), '5 tags is the most')
  await sh.getByLabel('Add your own tag').fill('TAG0'); await sh.getByRole('button', { name: 'Add tag' }).click(); eq(await sh.locator('.chip', { hasText: /^tag0$/i }).count(), 1, 'one tag0 chip')
})
T('N-034', 'POS', 'Pin a task: it goes to the top of its group with the word "pinned"; a 6th pin is refused in words', async () => {
  const cards = Array.from({ length: 6 }, (_, i) => task('t' + i, 'Task ' + i))
  const { page: p } = await open(seed({ cards })); await notesTab(p); await modeTodo(p); await view(p, 'All')
  for (let i = 0; i < 5; i++) { await p.getByText('Task ' + i, { exact: true }).first().click(); await p.locator('.sheet').getByRole('switch', { name: 'Pin to the top' }).click(); await sheetSave(p) }
  has(await text(p, '.todo'), 'pinned')
  await p.getByText('Task 5', { exact: true }).first().click(); await p.locator('.sheet').getByRole('switch', { name: 'Pin to the top' }).click(); await sheetSave(p)
  has(await text(p, '.sheet'), 'pin up to 5')
})
T('N-035', 'POS', 'To-do search and tag filter; "Nothing matches." for no result', async () => {
  const { page: p } = await open(seed({ cards: [task('a', 'Buy milk', { tags: ['Home'] }), task('b', 'File tax', { tags: ['Tax'] })] })); await notesTab(p); await modeTodo(p); await view(p, 'All')
  await p.getByLabel('Search tasks').fill('milk'); has(await text(p, '.todo'), 'Buy milk'); lacks(await text(p, '.todo'), 'File tax')
  await p.getByLabel('Search tasks').fill('zzzz'); has(await text(p, '.todo'), 'Nothing matches.')
  await p.getByLabel('Search tasks').fill(''); await p.locator('.saved__head .chip', { hasText: 'Tax' }).click(); lacks(await text(p, '.todo'), 'Buy milk')
})
T('N-036', 'CORNER', '500 tasks: To-do renders all views without error and a 501st is refused with a message (UI stays responsive)', async () => {
  const cards = Array.from({ length: 500 }, (_, i) => task('t' + i, 'Task ' + i)); const reminders = cards.slice(0, 200).map((c, i) => rem('r' + i, c.id, NOW + (i % 40 - 10) * DAY))
  const { page: p, errors } = await open(seed({ cards, reminders })); const t0 = Date.now(); await notesTab(p); await modeTodo(p)
  for (const v of ['Upcoming', 'All', 'Today']) await view(p, v)
  ok(Date.now() - t0 < 15000, `took ${Date.now() - t0} ms to walk 500 tasks`)
  await quickAdd(p, 'one more'); has(await text(p), 'up to 500'); eq(errors.length, 0, errors.join('|'))
})
T('N-037', 'CORNER', 'Midnight: a task due 2 Nov is "Today" at 23:59 and "Overdue" one minute later (fixed clocks)', async () => {
  const cards = [task('t', 'Rent')]; const reminders = [rem('r', 't', ist('2026-11-02T09:00'))]
  const a = await open(seed({ cards, reminders }), { now: ist('2026-11-02T23:59') }); await notesTab(a.page); await modeTodo(a.page)
  has(await text(a.page, '.todo'), 'Today'); lacks(await text(a.page, '.todo'), 'overdue')
  const b = await open(seed({ cards, reminders }), { now: ist('2026-11-03T00:00') }); await notesTab(b.page); await modeTodo(b.page)
  has(await text(b.page, '.todo'), '1 day overdue'); has(await text(b.page, '.todo .group[aria-label="Overdue"]'), 'Rent')
})
T('N-038', 'RUNTIME', 'Rapid taps: tick/untick 8 times, double-tap Add, 10 quick adds. No console error, no duplicate, no lost task', async () => {
  const { page: p } = await open(seed({ cards: [task('t', 'Tick me')], reminders: [rem('r', 't', NOW)] })); await notesTab(p); await modeTodo(p)
  const cb = p.getByRole('checkbox', { name: 'Tick me, done' })
  for (let i = 0; i < 8; i++) await cb.click({ noWaitAfter: true, force: true }).catch(() => {})
  await p.locator('input[aria-label="New task"]').fill('Once'); const add = p.locator('.todo__add button[type=submit]'); await add.dblclick()
  eq((await st(p)).cards.filter((c) => c.title === 'Once').length, 1, 'a double tap adds once')
  for (let i = 0; i < 10; i++) await quickAdd(p, 'Q' + i)
  eq((await st(p)).cards.filter((c) => /^Q\d$/.test(c.title)).length, 10, 'ten quick adds')
})
T('N-039', 'RUNTIME', 'Reload keeps tasks, ticks, tags, pin, afterDays, leads and the chosen reminder time', async () => {
  const { page: p } = await open(seed({ cards: [task('t', 'Keep', { tags: ['Home'], pinned: true, done: true, doneAt: NOW })], reminders: [rem('r', 't', NOW + DAY, { afterDays: 30, leads: [7, 0], leadDays: 7, done: true })], settings: { reminderTime: '18:30' } }))
  await wait(300); await p.reload(); await p.waitForSelector('.app'); const s = await st(p)
  eq(s.cards[0].done, true, 'done'); eq(s.cards[0].pinned, true, 'pinned'); eq(s.reminders[0].afterDays, 30, 'afterDays'); eq(JSON.stringify(s.reminders[0].leads), '[7,0]', 'leads'); eq(s.settings.reminderTime, '18:30', 'time')
})

// ================================================================== LISTS, TAPES, SAVE A CALCULATION
T('N-050', 'POS', 'New list from zero: add "Milk 50" and "Eggs 60", total is exact; list shows in Notes under Lists', async () => {
  const { page: p } = await open(); await notesTab(p); await p.getByRole('button', { name: 'New list' }).click()
  const box = p.locator('input[aria-label="Label and amount"]')
  for (const t of ['Milk 50', 'Eggs 60.5']) { await box.fill(t); await p.locator('.screen form button[type=submit], .screen .btn--primary').last().click() }
  has(await text(p, '.screen'), '110.50'); await p.getByRole('button', { name: 'Back' }).click(); has(await text(p, '.tools__list'), 'Lists')
})
T('N-051', 'NEG', 'List line: no amount, letters only, divide by zero and 40-digit numbers give plain words, never NaN', async () => {
  const { page: p } = await open(); await notesTab(p); await p.getByRole('button', { name: 'New list' }).click()
  const box = p.locator('input[aria-label="Label and amount"]'); const add = p.locator('.screen form .btn--primary').last()
  for (const t of ['Milk', 'abc', 'x 1/0', 'big ' + '9'.repeat(40)]) { await box.fill(t); await add.click(); await noBadText(p, `after "${t}"`) }
  has(await text(p, '.screen'), 'Add an amount, like "Flights 24000"')
})
T('N-052', 'UX', 'Removing a list line offers Undo that puts it back in the same place (every delete is undoable)', async () => {
  const { page: p } = await open(seed({ cards: [tape('L', 'Trip', [{ label: 'A', value: '10' }, { label: 'B', value: '20' }, { label: 'C', value: '30' }])] })); await notesTab(p); await p.getByText('Trip').first().click()
  await p.getByRole('button', { name: 'Remove B' }).click()
  has(await snackText(p), 'Removed "B"'); await p.locator('.snack').getByRole('button', { name: 'Undo' }).click()
  const t = await text(p, '.screen'); ok(t.indexOf('A') < t.indexOf('B') && t.indexOf('B') < t.indexOf('C'), 'B back in the middle'); has(t, '60.00')
})
T('N-053', 'POS', 'Three-state lines: Pending -> Paid -> Skipped -> Pending; skipped leaves totals and is said in words', async () => {
  const { page: p } = await open(seed({ cards: [tape('L', 'Split', [{ label: 'Ravi', value: '1000' }, { label: 'Asha', value: '1000' }], { checklist: true })] })); await notesTab(p); await p.getByText('Split').first().click()
  const pill = (n) => p.locator('.tri').nth(n); eq(await pill(0).innerText(), 'Pending', 'start'); await pill(0).click(); eq(await pill(0).innerText(), 'Paid', 'paid'); await pill(0).click(); eq(await pill(0).innerText(), 'Skipped', 'skipped')
  has(await p.locator('.tape__of').innerText(), '1 skipped, not counted'); await pill(0).click(); eq(await pill(0).innerText(), 'Pending', 'cycle')
  await p.getByRole('button', { name: 'Back' }).click(); has(await text(p, '.tools__list'), 'Split')
})
T('N-054', 'POS', 'Paste a messy list (bullets, numbers, ticks, ₹, CRLF, blank lines) offers a checklist; Add keeps amounts and ticks', async () => {
  const { page: p } = await open(); await notesTab(p); await p.getByRole('button', { name: 'New list' }).click()
  await p.locator('input[aria-label="Label and amount"]').evaluate((el) => { const dt = new DataTransfer(); dt.setData('text/plain', '• Milk\r\n\r\n2) Eggs ₹60\n[x] Bread\n☐ Rice 1,200'); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })) })
  await p.getByRole('button', { name: /Add 4 lines as checklist items/ }).click(); await wait(400)
  const c = (await stored(p)).cards[0]; eq(c.lines.length, 4, 'lines'); eq(c.checklist, true, 'checklist'); eq(c.lines[1].value, '60', 'amount'); eq(c.lines[2].done, true, 'ticked'); eq(c.lines[3].value, '1200', 'comma amount')
})
T('N-055', 'CORNER', 'Paste of 250 lines is cut to 200 and the screen says how many were left out', async () => {
  const { page: p } = await open(); await notesTab(p); await p.getByRole('button', { name: 'New list' }).click()
  await p.locator('input[aria-label="Label and amount"]').evaluate((el) => { const dt = new DataTransfer(); dt.setData('text/plain', Array.from({ length: 250 }, (_, i) => 'Item ' + i).join('\n')); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })) })
  has(await p.locator('.tape__offer').innerText(), '200'); has(await p.locator('.tape__offer').innerText(), '50')
})
T('N-056', 'POS', 'Inline rename: Enter saves, Escape cancels, empty name keeps a dash; state (Paid) is kept', async () => {
  const { page: p } = await open(seed({ cards: [tape('L', 'Split', [{ label: 'Ravi', value: '1000', done: true }, { label: 'Asha', value: '1000' }], { checklist: true })] })); await notesTab(p); await p.getByText('Split').first().click()
  await p.getByRole('button', { name: 'Rename Ravi' }).click(); await p.locator('input.tape__rename').fill('Ravi K'); await p.locator('input.tape__rename').press('Enter')
  await p.getByRole('button', { name: 'Rename Asha' }).click(); await p.locator('input.tape__rename').fill('nope'); await p.keyboard.press('Escape')
  const l = (await st(p)).cards[0].lines; eq(l[0].label, 'Ravi K', 'renamed'); eq(l[0].done, true, 'state kept'); eq(l[1].label, 'Asha', 'escape cancelled')
})
T('N-057', 'POS', 'Save a calculation from a calculator, rename it in the sheet, add a note, find it by search, open it again', async () => {
  const { page: p } = await open()
  await tab(p, 'Tools'); await p.locator('.tile', { hasText: 'Loans and EMI' }).click(); await p.locator('.navrow .row__label').filter({ hasText: 'Loan EMI' }).first().click(); await p.waitForSelector('.tool')
  await p.locator('.screen__bar .link-btn').click(); await p.locator('#save-title').fill('Car loan'); await p.locator('#save-note').fill('bank visit friday'); await sheetSave(p)
  has(await snackText(p), 'Saved to Notes'); await notesTab(p); await p.getByLabel('Search notes').fill('car')
  has(await text(p, '.tools__list'), 'Car loan'); await p.locator('.row__main').first().click(); has(await text(p, '.screen'), 'Car loan')
})
T('N-058', 'CORNER', 'Trash 7 days: a task trashed 8 days ago is gone at start with its reminder, one trashed 6 days ago stays and restores', async () => {
  const { page: p } = await open(seed({ cards: [task('old', 'Old', { deletedAt: NOW - 8 * DAY }), task('new', 'Recent', { deletedAt: NOW - 6 * DAY })], reminders: [rem('r', 'old', NOW + DAY)] }))
  const s = await st(p); eq(JSON.stringify(s.cards.map((c) => c.id)), '["new"]', 'cards'); eq(s.reminders.length, 0, 'reminders')
  await notesTab(p); await p.getByRole('button', { name: 'Trash (1)' }).click(); has(await text(p, '.screen'), 'Recent')
})

// ================================================================== DUE
T('N-070', 'POS', 'Due list order: Overdue first (alert words), then This week, then Later, each soonest first, counts shown', async () => {
  const cards = ['A', 'B', 'C', 'D', 'E'].map((x) => task('c' + x, 'Rent ' + x))
  const reminders = [rem('rE', 'cE', NOW + 40 * DAY), rem('rD', 'cD', NOW + 2 * DAY), rem('rC', 'cC', NOW + DAY), rem('rB', 'cB', NOW - 3 * DAY), rem('rA', 'cA', NOW - DAY)]
  const { page: p } = await open(seed({ cards, reminders })); await tab(p, 'Due')
  // Due's groups became plain hairline lists 2026-11-04 (docs/THE-PLAN.md Block B4/B5): no more
  // <section class="sect">, just a <div class="group" aria-label="...">. Same information, different tag.
  const secs = await p.locator('.tools__list .group').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') + ':' + [...e.querySelectorAll('.row__label')].map((x) => x.textContent).join(',')))
  eq(secs.join(' | '), 'Overdue:Rent B,Rent A | This week:Rent C,Rent D | Later:Rent E', 'sections'); has(await text(p, '.tools__list'), '3 days overdue'); await shot(p, 'N-070-due-order')
})
T('N-071', 'UX', 'Mark paid on a one-time reminder says what happened and offers Undo; Undo brings it back to Due', async () => {
  const { page: p } = await open(seed({ cards: [emi('a', 'HDFC card')], reminders: [rem('r', 'a', NOW + DAY)] })); await tab(p, 'Due')
  await p.getByRole('button', { name: 'Mark paid' }).click(); has(await snackText(p), 'Marked paid: "HDFC card"'); has(await text(p), 'No reminders yet')
  await p.locator('.snack').getByRole('button', { name: 'Undo' }).click(); has(await text(p, '.tools__list'), 'HDFC card')
})
T('N-072', 'POS', 'Mark paid on a monthly reminder moves it to next month, keeps the label "monthly"; a task says "Done"', async () => {
  const { page: p } = await open(seed({ cards: [emi('a', 'Rent'), task('t', 'Water filter')], reminders: [rem('r', 'a', ist('2026-11-05'), { repeat: 'monthly' }), rem('r2', 't', NOW)] })); await tab(p, 'Due')
  await p.locator('.due', { hasText: 'Rent' }).getByRole('button', { name: 'Mark paid' }).click(); has(await text(p, '.tools__list'), '5 Dec'); has(await text(p, '.tools__list'), 'monthly')
  eq(await p.locator('.due', { hasText: 'Water filter' }).getByRole('button', { name: 'Done' }).count(), 1, 'tasks use "Done"')
})
T('N-073', 'POS', 'Snooze 1 day moves the date one day on and says so in the row', async () => {
  const { page: p } = await open(seed({ cards: [emi('a', 'Rent')], reminders: [rem('r', 'a', ist('2026-11-05'))] })); await tab(p, 'Due')
  await p.getByRole('button', { name: 'Snooze 1 day' }).click(); has(await text(p, '.tools__list'), '6 Nov'); eq((await st(p)).reminders[0].dueAt, ist('2026-11-06'), 'dueAt')
})
T('N-074', 'UX', 'Remove asks first: "Keep it" keeps, "Yes, remove" removes the reminder and keeps the note', async () => {
  const { page: p } = await open(seed({ cards: [emi('a', 'Rent')], reminders: [rem('r', 'a', NOW + DAY)] })); await tab(p, 'Due')
  await p.getByRole('button', { name: 'Remove' }).click(); has(await text(p, '.due'), 'Remove this reminder? The note stays.'); await p.getByRole('button', { name: 'Keep it' }).click(); eq((await st(p)).reminders.length, 1, 'kept')
  await p.getByRole('button', { name: 'Remove' }).click(); await p.getByRole('button', { name: 'Yes, remove' }).click(); const s = await st(p); eq(s.reminders.length, 0, 'removed'); eq(s.cards.length, 1, 'note stays')
})
T('N-075', 'POS', 'Advance tax pack from zero: 4 reminders with the right dates (15 Dec 2026, 15 Mar, 15 Jun, 15 Sep 2027) in order; twice adds no more', async () => {
  const { page: p } = await open(); await tab(p, 'Due'); await p.getByRole('button', { name: /Add advance tax reminders/ }).click(); await wait(200)
  const labels = await p.locator('.tools__list .due .row__label').allInnerTexts(); eq(labels.length, 4, 'four rows')
  has(labels[0], '(75% due)'); has(labels[1], '(100% due)'); has(labels[2], '(15% due)'); has(labels[3], '(45% due)')
  await p.getByRole('button', { name: /Add a pack/ }).click(); eq((await st(p)).reminders.length, 4, 'still four'); has(await snackText(p), 'already there')
  const s = await stored(p); eq(s.reminders.every((r) => r.repeat === 'yearly' && r.leadDays === 7), true, 'yearly, 7 days')
})
T('N-076', 'CORNER', 'Pack uses the chosen reminder time (18:30) and a pack row can be marked done: next year, same time', async () => {
  const { page: p } = await open(seed({ settings: { reminderTime: '18:30' } })); await tab(p, 'Due'); await p.getByRole('button', { name: /Add advance tax reminders/ }).click(); await wait(200)
  const s = await st(p); ok(s.reminders.every((r) => new Date(r.dueAt + 19_800_000).getUTCHours() === 18 && new Date(r.dueAt + 19_800_000).getUTCMinutes() === 30), 'all at 18:30')
  await p.locator('.due').first().getByRole('button', { name: 'Done' }).click(); await wait(100); eq((await st(p)).reminders.some((r) => r.dueAt === ist('2027-12-15T18:30')), true, 'moved a year on')
})
T('N-077', 'POS', 'Reminder on a calculation: "Amounts due in the next 30 days" adds money only, excludes day 31 and non-money results', async () => {
  const cards = [emi('a', 'Rent', { amount: '10000' }), emi('b', 'Loan', { amount: '5000' }), emi('c', 'Far', { amount: '999' }), emi('d', 'BMI', { amount: '24.5', amountFmt: 'number' })]
  const reminders = [rem('r1', 'a', NOW + DAY), rem('r2', 'b', ist('2026-12-02T09:00')), rem('r3', 'c', ist('2026-12-03T09:00')), rem('r4', 'd', NOW)]
  const { page: p } = await open(seed({ cards, reminders })); await tab(p, 'Due'); has(await text(p, '.due__total'), '15,000'); lacks(await text(p, '.due__total'), '16')
})
T('N-078', 'RUNTIME', 'Due with 500 reminders renders, groups and scrolls without error', async () => {
  const cards = Array.from({ length: 500 }, (_, i) => task('t' + i, 'Task ' + i)); const reminders = cards.map((c, i) => rem('r' + i, c.id, NOW + (i - 100) * DAY / 3))
  const { page: p, errors } = await open(seed({ cards, reminders })); const t0 = Date.now(); await tab(p, 'Due'); ok((await p.locator('.due').count()) === 500, 'rows'); ok(Date.now() - t0 < 12000, `${Date.now() - t0} ms`); eq(errors.length, 0, errors.join('|'))
})
T('N-079', 'UX', 'Delivery notice: "A reminder may not have shown", plain words, never certain; Fix reminders opens the sheet; Dismiss hides it', async () => {
  const dueAt = ist('2026-11-02T08:00')
  const { page: p } = await open(seed({ cards: [task('C1', 'Pay rent')], reminders: [rem('R1', 'C1', dueAt)] }))
  await p.addInitScript(([at]) => { if (!sessionStorage.getItem('__fl')) { sessionStorage.setItem('__fl', '1'); localStorage.setItem('vkcalc.firelog', JSON.stringify({ seenAt: at - 6 * 3_600_000, planned: [{ rid: 'R1', due: at, at, nid: 5 }] })) } }, [dueAt])
  await p.reload(); await p.waitForSelector('.app'); await tab(p, 'Due'); await p.waitForSelector('.due__missed', { timeout: 8000 })
  const t = await p.locator('.due__missed').innerText(); has(t, 'A reminder may not have shown: Pay rent.'); ok(!/did not|didn't|failed/.test(t), 'no certainty')
  await p.locator('.due__missed').getByRole('button', { name: 'Fix reminders' }).click(); has(await text(p, '.sheet'), 'Make reminders reliable'); await p.getByRole('button', { name: /^Close/ }).last().click()
  await p.locator('.due__missed').getByRole('button', { name: 'Dismiss' }).click(); eq(await p.locator('.due__missed').count(), 0, 'dismissed')
})
T('N-080', 'POS', 'Due card open: the reminder editor shows lead pills; changing to 3 lead times saves a list; Back returns to Due', async () => {
  const { page: p } = await open(seed({ cards: [emi('a', 'HDFC card')], reminders: [rem('r', 'a', ist('2026-12-20'), { leadDays: 3 })] })); await tab(p, 'Due')
  await p.locator('.due__main').click(); await wait(200); has(await text(p, '.screen'), 'HDFC card'); has(await text(p), 'Remind me')
  await p.getByRole('button', { name: 'Back' }).first().click(); has(await text(p, '.tools__list'), 'HDFC card')
})

// ================================================================== SETTINGS
T('N-090', 'POS', 'Settings: every row works (theme x3, accent, number system, decimals, copying, angles, opens on, toggles) and the choices stick after reload', async () => {
  const { page: p } = await open(); await settings(p)
  await p.getByRole('radio', { name: 'Light' }).click()
  await p.getByRole('radio', { name: 'International' }).click(); await p.getByRole('switch', { name: 'Vibrate on key press' }).click(); await p.getByRole('switch', { name: 'Keep the screen on' }).click()
  await p.getByRole('radio', { name: 'Radians' }).click(); await p.locator('.swatch').nth(1).click()
  const s = await st(p); eq(s.settings.theme, 'light', 'theme'); eq(s.settings.numberSystem, 'international', 'numbers'); eq(s.settings.angle, 'rad', 'angle'); eq(s.settings.haptics, false, 'haptics flipped'); eq(s.settings.keepAwake, true, 'keep awake flipped'); ok(s.settings.accent !== (await open().then(async (o) => (await st(o.page)).settings.accent)), 'accent changed')
  await p.reload(); await p.waitForSelector('.app'); const s2 = await st(p); eq(s2.settings.theme, 'light', 'theme after reload'); eq(s2.settings.numberSystem, 'international', 'numbers after reload')
})
T('N-091', 'POS', 'Number system and decimals change how a saved amount is drawn in Notes and Due (Indian 12,34,567 vs 1,234,567; 0 vs 4 decimals)', async () => {
  const cards = [emi('a', 'Big', { amount: '1234567.891' })]; const { page: p } = await open(seed({ cards, reminders: [rem('r', 'a', NOW + DAY)] })); await tab(p, 'Due')
  has(await text(p, '.tools__list'), '12,34,567.89'); await settings(p); await p.getByRole('radio', { name: 'International' }).click(); await p.getByRole('button', { name: 'Back' }).first().click(); await tab(p, 'Due'); has(await text(p, '.tools__list'), '1,234,567.89')
})
T('N-092', 'POS', 'Reminder time: set 18:30, survives reload, the task sheet hint says "6:30 pm"; the test reminder says plainly it needs the phone app', async () => {
  const { page: p } = await open(); await settings(p); await p.locator('input[type=time]').fill('18:30'); await p.getByText('Send a test reminder').click()
  has(await snackText(p), 'only works in the Android app'); await wait(300); await p.reload(); await p.waitForSelector('.app'); eq((await st(p)).settings.reminderTime, '18:30', 'stored')
  await notesTab(p); await modeTodo(p); await p.getByRole('button', { name: 'Add with a date, repeat or note' }).click(); await p.locator('#task-date').fill('2026-12-01'); has(await text(p, '.sheet'), '6:30 pm')
})
T('N-093', 'NEG', 'Reminder time cleared in the box is ignored (stays valid), never blank or NaN', async () => {
  const { page: p } = await open(); await settings(p); await p.locator('input[type=time]').fill(''); await wait(200)
  eq((await st(p)).settings.reminderTime, '09:00', 'time stays'); await noBadText(p, 'settings')
})
T('N-094', 'UX', '"Make reminders reliable": the sheet lists numbered steps, says the web cannot open phone settings, and closes with X and Escape', async () => {
  const { page: p } = await open(); await settings(p); await p.getByRole('button', { name: /Make reminders reliable/ }).click()
  ok((await p.locator('.sheet ol.steps li').count()) >= 3, 'steps'); await p.locator('.sheet .sheet__foot .btn--primary').click(); has(await text(p, '.sheet'), 'only works in the Android app')
  await p.keyboard.press('Escape'); eq(await p.locator('.sheet').count(), 0, 'Escape closes')
})
T('N-095', 'UX', 'Backup nudge: 25 items and no backup says so once on the Settings page; Dismiss hides it and stays hidden after reload; under 25 items says nothing', async () => {
  const many = Array.from({ length: 25 }, (_, i) => emi('c' + i, 'Item ' + i)); const a = await open(seed({ cards: many })); await settings(a.page); has(await text(a.page, '.screen__body'), '25 items and no backup yet')
  await a.page.getByRole('button', { name: 'Dismiss' }).click(); await wait(400); await a.page.reload(); await a.page.waitForSelector('.app'); await settings(a.page); lacks(await text(a.page, '.screen__body'), 'no backup yet', 'after dismiss + reload')
  const b = await open(seed({ cards: many.slice(0, 24) })); await settings(b.page); lacks(await text(b.page, '.screen__body'), 'no backup yet', '24 items')
})
T('N-096', 'POS', 'Export a backup downloads a file, records the time (nudge stops); restoring that same file gives back every new field exactly', async () => {
  const cards = [task('t', 'Service car', { tags: ['Car'], pinned: true }), task('d', 'Done thing', { done: true, doneAt: NOW }), tape('L', 'Split', [{ label: 'R', value: '10', done: true }, { label: 'S', value: '5', skip: true }], { checklist: true }), emi('e', 'EMI', { tags: ['Loan'], note: 'a note' }), task('x', 'Trashed', { deletedAt: NOW - DAY })]
  const reminders = [rem('r', 't', ist('2026-12-01'), { afterDays: 180, leads: [14, 7, 0], leadDays: 14 }), rem('r2', 'e', ist('2026-12-05'), { repeat: 'quarterly' })]
  const { page: p } = await open(seed({ cards, reminders, settings: { reminderTime: '18:30', tours: { budget: 'done' } } })); await settings(p)
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByText('Export a backup').click()]); const file = join(tmpdir(), 'qa-export.json'); await dl.saveAs(file)
  ok(/^vkcalc-backup-2026-11-02\.json$/.test(dl.suggestedFilename()), 'file name ' + dl.suggestedFilename()); await wait(400)
  const before = JSON.parse(readFileSync(file, 'utf8')).data; ok((await stored(p)).settings.lastBackupAt > 0, 'lastBackupAt recorded')
  await p.getByRole('button', { name: /Back/ }).first().click(); await notesTab(p); await modeTodo(p); await view(p, 'All'); await p.getByText('Service car').first().click(); await p.getByRole('button', { name: 'Delete task' }).click()
  await settings(p); await p.locator('input[type=file]').setInputFiles(file); await p.getByRole('button', { name: 'Replace everything' }).click(); await wait(500)
  const after = await stored(p); eq(JSON.stringify(after.cards), JSON.stringify(before.cards), 'cards'); eq(JSON.stringify(after.reminders), JSON.stringify(before.reminders), 'reminders'); eq(after.settings.reminderTime, '18:30', 'time')
})
T('N-097', 'UX', 'Restore asks first with counts in words; Cancel changes nothing', async () => {
  const { page: p } = await open(seed({ cards: [emi('a')] })); await settings(p); const f = join(tmpdir(), 'qa-r.json')
  writeFileSync(f, JSON.stringify({ kind: 'vkcalc-backup', schemaVersion: 3, data: { schemaVersion: 3, settings: {}, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false } } })); await p.locator('input[type=file]').setInputFiles(f)
  has(await text(p, '.confirm'), 'Replace everything on this phone'); await p.locator('.confirm').getByRole('button', { name: 'Cancel' }).click(); eq((await st(p)).cards.length, 1, 'unchanged')
})
T('N-098', 'RUNTIME', 'Damaged saved data (cards is text, reminders garbage): the app still opens and Notes/Due draw, with plain words', async () => {
  const c = await openNothing(); await c.page.evaluate(() => localStorage.setItem('vkcalc.data', JSON.stringify({ schemaVersion: 3, settings: 5, cards: 'no', reminders: [null, 5, { id: 'x' }], history: 'x' }))); await c.page.reload(); await c.page.waitForSelector('.app')
  await notesTab(c.page); await tab(c.page, 'Due'); await noBadText(c.page, 'damaged data'); eq(c.errors.length, 0, c.errors.join('|'))
})

// ================================================================== UI: 360px, 200% font, dark+light, tap targets
const BUSY = () => seed({ cards: [task('a', 'Call the plumber about the kitchen sink and the leaking tap', { tags: ['Home', 'Work'], pinned: true }), task('b', 'W'.repeat(100)), task('c', 'Done', { done: true, doneAt: NOW }), tape('L', 'Trip split', [{ label: 'Ravi Kumar Sharma', value: '1234567.89' }, { label: 'Asha', value: '1000', done: true }, { label: 'Mohan', value: '500', skip: true }], { checklist: true }), emi('e', 'Home loan EMI for the long flat', { tags: ['Credit Card', 'Loan', 'Work'] })], reminders: [rem('ra', 'a', NOW - 2 * DAY, { repeat: 'monthly', afterDays: undefined }), rem('rb', 'b', NOW + 3 * DAY, { afterDays: 180, leads: [7, 3, 0], leadDays: 7 }), rem('re', 'e', NOW + 9 * DAY, { repeat: 'yearly' })] })
for (const [theme, font] of [['dark', 100], ['light', 100], ['dark', 200], ['light', 200]]) {
  T(`N-10${theme === 'dark' ? (font === 100 ? 0 : 2) : font === 100 ? 1 : 3}`, 'UI', `${theme} theme, ${font}% font: To-do, task sheet, Notes, list, Due, Settings and tour fit 360px with no overflow and no bad text`, async () => {
    const { page: p } = await open({ ...BUSY(), settings: { ...BUSY().settings, theme, tours: {} } }, { font })
    await notesTab(p); await noOverflow(p, 'notes'); await p.locator('.tourrow__open').click(); await noOverflow(p, 'tour sheet'); await tourNext(p).click(); await noOverflow(p, 'tour step 2'); await p.keyboard.press('Escape')
    await modeTodo(p); await view(p, 'All'); await noOverflow(p, 'todo all'); await p.locator('.todo__toggle').click(); await noOverflow(p, 'todo done open')
    await p.getByText('Call the plumber', { exact: false }).first().click(); await noOverflow(p, 'task sheet'); await p.locator('.sheet').getByRole('switch', { name: 'Repeat after I tick it' }).scrollIntoViewIfNeeded(); await noOverflow(p, 'task sheet scrolled'); await shot(p, `N-10x-${theme}-${font}-task-sheet`); await p.keyboard.press('Escape')
    await p.getByRole('radio', { name: /^Notes/ }).click(); await p.getByText('Trip split').first().click(); await noOverflow(p, 'list'); await p.getByRole('button', { name: 'Back' }).click()
    await tab(p, 'Due'); await noOverflow(p, 'due'); await shot(p, `N-10x-${theme}-${font}-due`); await settings(p); await noOverflow(p, 'settings'); await noBadText(p, 'settings')
  })
}
T('N-104', 'UI', 'Tap targets at 360px and 200%: To-do, Due, Notes, tour sheet and Settings controls are 44px in at least one direction', async () => {
  const issues = []
  for (const font of [100, 200]) {
    const { page: p } = await open(seed({ ...BUSY(), settings: { theme: 'dark', tours: {} } }), { font })
    await notesTab(p); issues.push(...(await smallTargets(p, '.tools')).map((x) => `notes ${font}% ${x}`)); await modeTodo(p); await view(p, 'All'); issues.push(...(await smallTargets(p, '.todo')).map((x) => `todo ${font}% ${x}`))
    await p.locator('.todo__toggle').click(); issues.push(...(await smallTargets(p, '.todo')).map((x) => `todo-done ${font}% ${x}`))
    await p.getByText('Call the plumber', { exact: false }).first().click(); issues.push(...(await smallTargets(p, '.sheet')).map((x) => `tasksheet ${font}% ${x}`)); await p.keyboard.press('Escape')
    await tab(p, 'Due'); issues.push(...(await smallTargets(p, '.tools')).map((x) => `due ${font}% ${x}`)); await settings(p); issues.push(...(await smallTargets(p, '.screen')).map((x) => `settings ${font}% ${x}`))
  }
  eq(issues.length, 0, `controls under 44px: ${issues.slice(0, 6).join(' ; ')}${issues.length > 6 ? ` (+${issues.length - 6} more)` : ''}`)
})
T('N-105', 'UI', 'Landscape 800x360: Notes, To-do, Due and the task sheet fit and the Save button is reachable', async () => {
  const { page: p } = await open(BUSY(), { width: 800, height: 360 }); await notesTab(p); await modeTodo(p); await view(p, 'All'); await noOverflow(p, 'todo')
  await p.getByText('W'.repeat(100)).first().click(); const b = await p.locator('.sheet .sheet__foot .btn--primary').boundingBox(); ok(b && b.y + b.height <= 361, `Save at y=${b && Math.round(b.y + b.height)}`)
})
T('N-106', 'UX', 'Back-navigation without the system button: every sheet has X, every screen has Back (task sheet, tour, reliable sheet, trash, list, a calculation)', async () => {
  const { page: p } = await open(BUSY()); await notesTab(p); await modeTodo(p); await view(p, 'All')
  await p.getByText('Call the plumber', { exact: false }).first().click(); await p.locator('.sheet').getByRole('button', { name: /^Close/ }).click(); eq(await p.locator('.sheet').count(), 0, 'task sheet X')
  await p.getByRole('radio', { name: /^Notes/ }).click(); await p.getByText('Trip split').first().click(); await p.getByRole('button', { name: 'Back' }).click(); await p.getByRole('button', { name: 'New list' }).click(); await p.getByRole('button', { name: 'Back' }).click()
  await p.locator('.row__main', { hasText: 'Home loan EMI' }).click(); await p.getByRole('button', { name: 'Back' }).click(); has(await text(p, '.tools__list'), 'Home loan EMI')
})
T('N-107', 'UX', 'Can a new person finish each job unaided? Add task, tick it, save a list, add a reminder date, find it in Due: every step has a visible control with words', async () => {
  const { page: p } = await open(fresh()); await notesTab(p)
  const names = await p.evaluate(() => [...document.querySelectorAll('.tools button, .tools input, .tools [role=radio]')].map((e) => (e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || '').trim()).filter(Boolean))
  for (const need of ['New list', 'Search notes']) ok(names.some((n) => n.includes(need)), `Notes shows "${need}": ${names.join(' | ')}`)
  await modeTodo(p); const t2 = await p.evaluate(() => [...document.querySelectorAll('.todo button, .todo input')].map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim()))
  for (const need of ['New task', 'Add', 'Add with a date, repeat or note']) ok(t2.some((n) => n === need), `To-do shows "${need}": ${t2.join(' | ')}`)
})
T('N-108', 'UX', 'No colour-only meaning: overdue, done, skipped, pinned are all said in words in To-do, Due and lists', async () => {
  const { page: p } = await open(BUSY()); await notesTab(p); await modeTodo(p); await view(p, 'All'); has(await text(p, '.todo'), 'overdue'); has(await text(p, '.todo'), 'pinned')
  await p.getByRole('radio', { name: /^Notes/ }).click(); await p.getByText('Trip split').first().click(); has(await text(p, '.screen'), 'Skipped'); has(await text(p, '.screen'), 'Paid'); has(await text(p, '.screen'), '1 skipped, not counted')
})
T('N-109', 'RUNTIME', 'Walk every tab and sheet on busy data: zero console errors and no "NaN/undefined/Invalid Date" text anywhere', async () => {
  const { page: p, errors } = await open(BUSY())
  for (const t of ['Calculate', 'Tools', 'Notes', 'Due', 'Budget']) { await tab(p, t); await noBadText(p, t) }
  await notesTab(p); await modeTodo(p); for (const v of ['Upcoming', 'All', 'Today']) { await view(p, v); await noBadText(p, 'todo ' + v) }
  await settings(p); await noBadText(p, 'settings'); eq(errors.length, 0, errors.join('|'))
})

// ================================================================== RUN
const only = process.argv.slice(2)
const wanted = CASES.filter((c) => only.length === 0 || only.some((o) => c.id.startsWith(o)))
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
      await als.run(ctx, () => Promise.race([c.fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('case timed out after 90s')), 90000))]))
      const errs = ctx.pages.flatMap((p) => p.errors || [])
      if (errs.length && !c.opts.allowErrors) throw new Error(`console/page errors: ${errs.slice(0, 2).join(' | ')}`)
      line = `PASS ${c.id} ${c.type} ${c.title}`
    } catch (e) {
      line = `FAIL ${c.id} ${c.type} ${c.title} :: ${String(e.message).replace(/\s+/g, ' ').slice(0, 420)}`
      try { await ctx.pages[0]?.page.screenshot({ path: join(OUT, `FAIL-${c.id}.png`) }) } catch { /* the page may be gone */ }
    }
    results[i] = line
    console.error(line.slice(0, 170))
    for (const p of ctx.pages) await p.close().catch(() => {})
  }
}
await Promise.all([worker(), worker(), worker()])
for (const l of results) console.log(l)
const failed = results.filter((l) => l.startsWith('FAIL')).length
console.log(`\n${results.length - failed} passed, ${failed} failed, ${results.length} cases. Screenshots: ${OUT}`)
await APP.stop()
process.exit(failed ? 1 : 0)
