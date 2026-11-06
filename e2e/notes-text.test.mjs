// Browser pass for Block C: plain text notes, the one Add control on the Notes tab, sharing a note or list as text,
// "Export notes", and search inside note bodies and list lines. 360px, dark and light, 100% and 200% font, with screenshots.
// Run: node e2e/notes-text.test.mjs      Screenshots land in $TMPDIR/calc-notes-text
process.env.TZ = 'Asia/Kolkata'
import { startApp, openApp, tab, stored, overflowing } from './lib.mjs'
import { mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = join(tmpdir(), 'calc-notes-text')
mkdirSync(OUT, { recursive: true })
const NOW = Date.parse('2026-11-04T10:00:00+05:30')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const ok = (c, what) => { if (!c) throw new Error(what) }
const eq = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`) }
const has = (t, part, what) => ok(String(t).includes(part), `${what} should contain "${part}" but is: ${String(t).replace(/\s+/g, ' ').slice(0, 300)}`)

let seq = 0
const base = (o) => ({ title: 'Item', kind: 'tool', toolId: null, inputs: null, summary: '', amount: null, lines: [], note: '', tags: [], pinned: false, createdAt: NOW - 1000 * ++seq, updatedAt: NOW - 1000 * seq, deletedAt: null, ...o })
const note = (id, title, body, o = {}) => base({ id, title, kind: 'text', summary: body.replace(/\s+/g, ' ').slice(0, 120), note: body, ...o })
const tape = (id, title, lines, o = {}) => base({ id, title, kind: 'tape', summary: `${lines.length} lines`, amount: String(lines.reduce((s, l) => s + Number(l.value), 0)), lines: lines.map((l, i) => ({ id: `${id}l${i}`, ...l })), ...o })
const emi = (id, title) => base({ id, title, kind: 'tool', toolId: 'emi', inputs: { principal: '5000000', rate: '8.5', tenure: '20', tenureUnit: 'years' }, summary: 'Monthly EMI: ₹43,391.16', amount: '43391.16', amountFmt: 'money' })
const seed = (cards = [], theme = 'dark') => ({ schemaVersion: 3, settings: { theme, tours: { budget: 'done', notes: 'done', due: 'done' } }, history: [], cards, reminders: [], memory: null, input: { expr: '', fresh: false } })
const BUSY = (theme) => seed([
  note('n1', 'Wifi at home', 'The router password is on the sticker under the TV. The guest network has its own password, which is written in the notebook next to the phone. Ask Amit if it changed after the last visit by the technician.', { tags: ['Home'], pinned: true }),
  note('n2', 'Gift ideas', 'Books for Riya\nHeadphones for Dad\nPlant for the office'),
  tape('l1', 'Goa trip', [{ label: 'Flights', value: '24000' }, { label: 'Hotel', value: '18000' }]),
  tape('l2', 'Dinner split', [{ label: 'Amit', value: '1000', done: true }, { label: 'Ravi', value: '500' }, { label: 'Sam', value: '300', skip: true }], { checklist: true }),
  emi('e1', 'Home loan EMI'),
], theme)

const app = await startApp()
let failed = 0
let passed = 0
const T = async (name, fn, opts = {}) => {
  const { page, errors, close } = await openApp(app, { now: NOW, theme: null, ...opts })
  try {
    await fn(page)
    const over = await overflowing(page)
    ok(over.length === 0, `sideways overflow: ${over.join(' | ')}`)
    ok(errors.length === 0, `console errors: ${errors.join(' | ')}`)
    passed++
    console.log('PASS', name)
  } catch (e) {
    failed++
    console.log('FAIL', name, '::', e.message)
    await page.screenshot({ path: join(OUT, `FAIL-${name.replace(/\W+/g, '-').slice(0, 60)}.png`) })
  } finally { await close() }
}
const shot = (page, n) => page.screenshot({ path: join(OUT, `${n}.png`) })
const notes = (page) => tab(page, 'Notes')
const addBtn = (page) => page.getByRole('button', { name: 'New', exact: true })
const choose = async (page, label) => { await addBtn(page).click(); await page.getByRole('button', { name: new RegExp(`^${label}`) }).click() }
const sheet = (page) => page.locator('.sheet')
const save = (page) => sheet(page).locator('.sheet__foot .btn--primary').click()
const st = async (page) => { await wait(450); return stored(page) }
const snack = async (page) => ((await page.locator('.snack').count()) ? page.locator('.snack').innerText() : '')
const listText = (page) => page.locator('.tools__list').innerText()
/** Controls on screen that are under 44px in BOTH directions. */
const smallTargets = (page, scope) => page.evaluate((sc) => {
  const out = []
  document.querySelectorAll(`${sc} button, ${sc} input:not([type=hidden]):not([type=checkbox]), ${sc} textarea, ${sc} [role=radio]`).forEach((el) => {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || el.closest('.sr-only') || getComputedStyle(el).visibility === 'hidden') return
    if (r.width < 44 && r.height < 44) out.push(`${el.tagName.toLowerCase()}[${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}] ${Math.round(r.width)}x${Math.round(r.height)}`)
  })
  return out
}, scope)
/** The sheet's footer button sits inside the screen at the bottom, not under the keyboard-less viewport edge. */
const footVisible = (page) => page.evaluate(() => {
  const f = document.querySelector('.sheet .sheet__foot'); if (!f) return null
  const r = f.getBoundingClientRect(); return { bottom: Math.round(r.bottom), vh: innerHeight, ok: r.bottom <= innerHeight + 1 && r.top >= 0 }
})
/** Pretends the phone has a share sheet and records what was sent to it. */
const fakeShare = (page) => page.evaluate(() => { window.__shared = null; navigator.share = async (d) => { window.__shared = d } })

// ------------------------------------------------------------------ C2: the Add control
await T('C2 Notes shows one Add control, no "New list" link, and Add offers note, list and to-do', async (page) => {
  await notes(page)
  eq(await addBtn(page).count(), 1, 'one Add control')
  eq(await page.getByRole('button', { name: 'New list' }).count(), 0, 'no New list link on the page itself')
  const box = await addBtn(page).boundingBox()
  ok(box.height >= 44 && box.width >= 44, `Add is at least 44px: ${box.width}x${box.height}`)
  await addBtn(page).click()
  eq(await sheet(page).count(), 1, 'one sheet')
  eq(await sheet(page).locator('.sheet__title').innerText(), 'Add', 'sheet title')
  eq(await sheet(page).locator('.sheet__foot').count(), 0, 'a choice sheet has no footer')
  ok((await sheet(page).getByRole('button', { name: /^Close/ }).count()) === 1, 'X is there')
  const rows = await sheet(page).locator('.row--button .row__label').allInnerTexts()
  eq(rows, ['New note', 'New list', 'New to-do'], 'the three choices')
  eq(await smallTargets(page, '.sheet'), [], 'sheet targets')
  await shot(page, 'c2-add-sheet-empty')
  await sheet(page).getByRole('button', { name: /^Close/ }).click()
  eq(await sheet(page).count(), 0, 'X closes it')
}, { data: seed([]) })

await T('C2 Add > New list opens a new list screen, with no sheet left behind', async (page) => {
  await notes(page)
  await choose(page, 'New list')
  eq(await sheet(page).count(), 0, 'Add sheet closed first')
  has(await page.locator('.screen').first().getAttribute('aria-label'), 'List', 'list screen')
  await page.getByRole('button', { name: 'Back' }).click()
}, { data: BUSY('dark') })

await T('C2 Add > New to-do opens the task sheet on the To-do side and the task is saved', async (page) => {
  await notes(page)
  await choose(page, 'New to-do')
  eq(await sheet(page).count(), 1, 'exactly one sheet (not stacked)')
  eq(await sheet(page).locator('.sheet__title').innerText(), 'New task', 'task sheet')
  await sheet(page).locator('#task-title').fill('Renew passport')
  await save(page)
  eq(await sheet(page).count(), 0, 'closed after Save')
  ok((await page.getByRole('radio', { name: /^To-do/ }).getAttribute('aria-checked')) === 'true', 'switched to To-do')
  const d = await st(page)
  ok(d.cards.some((c) => c.kind === 'task' && c.title === 'Renew passport'), 'task stored')
}, { data: seed([]) })

await T('C2 on the To-do side the composer is the add (no second filled New button); its icon button opens the task sheet and Esc closes it', async (page) => {
  await notes(page)
  await page.getByRole('radio', { name: /^To-do/ }).click()
  eq(await addBtn(page).count(), 0, 'no header New on To-do')
  eq(await page.locator('.todo__add button[type=submit]').count(), 1, 'the composer Add is the one add')
  const more = page.getByRole('button', { name: 'Add with a date, repeat or note' })
  const box = await more.boundingBox()
  ok(box.height >= 44 && box.width >= 44, `the icon button is at least 44px: ${box.width}x${box.height}`)
  await more.click()
  eq(await sheet(page).count(), 1, 'one sheet')
  eq(await sheet(page).locator('.sheet__title').innerText(), 'New task', 'task sheet')
  await page.keyboard.press('Escape')
  await wait(100)
  eq(await sheet(page).count(), 0, 'Escape closes the sheet')
  await page.getByRole('radio', { name: /^Notes/ }).click()
  eq(await addBtn(page).count(), 1, 'New is back on Notes')
}, { data: BUSY('dark') })

// ------------------------------------------------------------------ C1: a plain note
await T('C1 write a note with no title: first line becomes the title, it shows under Notes, and is stored as kind text', async (page) => {
  await notes(page)
  await choose(page, 'New note')
  eq(await sheet(page).count(), 1, 'one sheet')
  eq(await sheet(page).locator('.sheet__title').innerText(), 'New note', 'title')
  await wait(200)
  ok(await page.evaluate(() => document.activeElement?.id === 'note-body'), 'the text box is focused (after the sheet settles)')
  await sheet(page).locator('#note-body').fill('Wifi password\nrouter is behind the TV')
  await shot(page, 'c1-new-note-typed')
  await save(page)
  eq(await sheet(page).count(), 0, 'closed after Save')
  const t = await listText(page)
  has(t, 'Notes', 'section heading')
  has(t, 'Wifi password', 'title in the list')
  has(t, 'router is behind the TV', 'summary line')
  const d = await st(page)
  const c = d.cards.find((x) => x.kind === 'text')
  eq([c.title, c.note, c.summary, c.toolId, c.inputs, c.lines, c.amount], ['Wifi password', 'Wifi password\nrouter is behind the TV', 'router is behind the TV', null, null, [], null], 'stored card')
  ok(Number.isFinite(c.createdAt) && c.deletedAt === null, 'stamped, not deleted')
}, { data: seed([]) })

await T('C1 maths and dates typed in a note stay exactly as written (nothing is evaluated)', async (page) => {
  await notes(page)
  await choose(page, 'New note')
  const body = '2-11-2026 call back, 50% off, (3+4)*5 = ?'
  await sheet(page).locator('#note-title').fill('Odd bits')
  await sheet(page).locator('#note-body').fill(body)
  await save(page)
  const c = (await st(page)).cards.find((x) => x.kind === 'text')
  eq([c.note, c.amount], [body, null], 'stored text, no amount')
  has(await listText(page), body.slice(0, 20), 'shown as typed')
}, { data: seed([]) })

await T('C1 an empty note is refused in words and the sheet stays open with the typed title kept', async (page) => {
  await notes(page)
  await choose(page, 'New note')
  await save(page)
  eq(await sheet(page).count(), 1, 'sheet stays open')
  has(await sheet(page).innerText(), 'Write a title or some text', 'error')
  ok(await page.evaluate(() => document.activeElement?.id === 'note-body'), 'focus goes to the bad field')
  eq((await st(page)).cards.length, 0, 'nothing stored')
  await sheet(page).locator('#note-body').fill('x')
  eq(await sheet(page).getByText('Write a title or some text').count(), 0, 'error clears once fixed')
  await shot(page, 'c1-empty-note-error')
}, { data: seed([]) })

await T('C1 open a note, change it, Save: the card is updated in place (same id), list line and title follow', async (page) => {
  await notes(page)
  await page.locator('.row__main', { hasText: 'Gift ideas' }).click()
  eq(await sheet(page).locator('.sheet__title').innerText(), 'Note', 'opens as a note')
  eq(await sheet(page).locator('#note-body').inputValue(), 'Books for Riya\nHeadphones for Dad\nPlant for the office', 'body restored')
  await sheet(page).locator('#note-title').fill('Gifts for Diwali')
  await sheet(page).locator('#note-body').fill('Books for Riya\nSweets for everyone')
  await save(page)
  const d = await st(page)
  eq(d.cards.filter((c) => c.kind === 'text').length, 2, 'still two notes')
  const c = d.cards.find((x) => x.id === 'n2')
  eq([c.title, c.note], ['Gifts for Diwali', 'Books for Riya\nSweets for everyone'], 'updated')
  has(await listText(page), 'Gifts for Diwali', 'list shows new title')
}, { data: BUSY('dark') })

await T('C1 closing with unsaved changes asks first; Keep editing keeps them; Discard drops them; a clean close does not ask', async (page) => {
  await notes(page)
  await page.locator('.row__main', { hasText: 'Gift ideas' }).click()
  await sheet(page).getByRole('button', { name: /^Close/ }).click()
  eq(await sheet(page).count(), 0, 'clean close needs no question')
  await page.locator('.row__main', { hasText: 'Gift ideas' }).click()
  await sheet(page).locator('#note-body').fill('changed text')
  await sheet(page).getByRole('button', { name: /^Close/ }).click()
  has(await sheet(page).innerText(), 'Discard your changes?', 'asks')
  await shot(page, 'c1-discard-ask')
  await sheet(page).getByRole('button', { name: 'Keep editing' }).click()
  eq(await sheet(page).locator('#note-body').inputValue(), 'changed text', 'typed text kept')
  await page.keyboard.press('Escape') // the back stack: asks again
  has(await sheet(page).innerText(), 'Discard your changes?', 'Escape asks too')
  await sheet(page).getByRole('button', { name: 'Discard' }).click()
  eq(await sheet(page).count(), 0, 'closed')
  eq((await st(page)).cards.find((c) => c.id === 'n2').note, 'Books for Riya\nHeadphones for Dad\nPlant for the office', 'not saved')
}, { data: BUSY('dark') })

await T('C1 tags and pin on a note: add your own tag, pin it, it moves to Pinned, tag chip filters', async (page) => {
  await notes(page)
  await choose(page, 'New note')
  await sheet(page).locator('#note-body').fill('Dentist 5pm Friday')
  await sheet(page).getByLabel('Add your own tag').fill('Health')
  await sheet(page).getByRole('button', { name: 'Add tag' }).click()
  await sheet(page).getByRole('switch', { name: 'Pin to the top' }).click()
  await save(page)
  const c = (await st(page)).cards.find((x) => x.title === 'Dentist 5pm Friday')
  eq([c.tags, c.pinned], [['Health'], true], 'stored')
  const heads = await page.locator('.group__title').allInnerTexts()
  has(heads[0], 'Pinned', 'first section')
  await page.getByRole('button', { name: 'Health', exact: true }).click()
  has(await listText(page), 'Dentist', 'filtered in')
  eq(await page.locator('.tools__list .row__label', { hasText: 'Gift ideas' }).count(), 0, 'others filtered out')
}, { data: BUSY('dark') })

await T('C1 more than 5 pinned is refused in words and the note is not lost', async (page) => {
  await notes(page)
  await choose(page, 'New note')
  await sheet(page).locator('#note-body').fill('sixth pin')
  await sheet(page).getByRole('switch', { name: 'Pin to the top' }).click()
  await save(page)
  eq(await sheet(page).count(), 1, 'sheet stays')
  has(await sheet(page).innerText(), 'You can pin up to 5', 'message')
  eq(await sheet(page).locator('#note-body').inputValue(), 'sixth pin', 'text kept')
}, { data: seed([1, 2, 3, 4, 5].map((i) => note(`p${i}`, `Pinned ${i}`, 'x', { pinned: true }))) })

await T('C1 delete a note: it goes to Trash with Undo; Undo brings it back; Trash lists it and Restore works', async (page) => {
  await notes(page)
  await page.locator('.row__main', { hasText: 'Gift ideas' }).click()
  await sheet(page).getByRole('button', { name: 'Delete note' }).click()
  eq(await sheet(page).count(), 0, 'sheet closed')
  has(await snack(page), 'Moved "Gift ideas" to Trash', 'snack')
  eq(await page.locator('.snack').getByRole('button', { name: /Undo/ }).count(), 1, 'Undo offered')
  await page.locator('.snack').getByRole('button', { name: /Undo/ }).click()
  has(await listText(page), 'Gift ideas', 'back after Undo')
  // delete again, then restore from Trash
  await page.locator('.row__main', { hasText: 'Gift ideas' }).click()
  await sheet(page).getByRole('button', { name: 'Delete note' }).click()
  await wait(100)
  await page.getByRole('button', { name: /^Trash \(1\)/ }).click()
  has(await page.locator('.screen').innerText(), 'Gift ideas', 'in Trash')
  await page.getByRole('button', { name: 'Restore' }).click()
  await wait(200)
  const d = await st(page)
  eq(d.cards.find((c) => c.id === 'n2').deletedAt, null, 'restored')
}, { data: BUSY('dark') })

await T('C1 at the 500-card limit a new note says so in words and keeps what was typed', async (page) => {
  await notes(page)
  await choose(page, 'New note')
  await sheet(page).locator('#note-body').fill('one too many')
  await save(page)
  eq(await sheet(page).count(), 1, 'sheet stays open')
  has(await sheet(page).innerText(), 'You can keep up to 500 notes and tasks. Delete some first.', 'message')
  eq(await sheet(page).locator('#note-body').inputValue(), 'one too many', 'text kept')
  eq((await st(page)).cards.length, 500, 'nothing added')
}, { data: seed(Array.from({ length: 500 }, (_, i) => note(`b${i}`, `Note ${i}`, 'x'))) })

await T('C1 a very long paste stops at 5,000 characters and the sheet says it was cut off', async (page) => {
  await notes(page)
  await choose(page, 'New note')
  await sheet(page).locator('#note-body').fill('a'.repeat(6000))
  eq((await sheet(page).locator('#note-body').inputValue()).length, 5000, 'cut at the limit')
  has(await sheet(page).innerText(), 'Anything more was cut off', 'says so')
}, { data: seed([]) })

await T('C1 a note survives a reload (it was saved, and it loads through the sanitizer)', async (page) => {
  await notes(page)
  await choose(page, 'New note')
  await sheet(page).locator('#note-body').fill('Remember the milk')
  await save(page)
  await wait(500)
  await page.reload()
  await page.waitForSelector('.app')
  await notes(page)
  has(await listText(page), 'Remember the milk', 'still there')
}, { data: seed([]) })

// ------------------------------------------------------------------ C3: share and export
await T('C3 a note shares as title, blank line, words; a list shares with its total; a checklist says who paid', async (page) => {
  await fakeShare(page)
  await notes(page)
  await page.locator('.row__main', { hasText: 'Gift ideas' }).click()
  await sheet(page).getByRole('button', { name: 'Share as text' }).click()
  await wait(100)
  eq(await page.evaluate(() => window.__shared), { title: 'Gift ideas', text: 'Gift ideas\n\nBooks for Riya\nHeadphones for Dad\nPlant for the office' }, 'shared note')
  await sheet(page).getByRole('button', { name: /^Close/ }).click()
  await page.locator('.row__main', { hasText: 'Goa trip' }).click()
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  await wait(100)
  eq((await page.evaluate(() => window.__shared)).text, 'Goa trip\nFlights  ₹24,000\nHotel  ₹18,000\nTotal  ₹42,000', 'shared list')
  await page.getByRole('button', { name: 'Back' }).click()
  await page.locator('.row__main', { hasText: 'Dinner split' }).click()
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  await wait(100)
  eq((await page.evaluate(() => window.__shared)).text.split('\n'), ['Dinner split', '✔ Amit  ₹1,000', '☐ Ravi  ₹500', '✖ Sam  ₹300  (skipped)', 'Collected ₹1,000 of ₹1,500', 'Left ₹500', 'Skipped 1, not counted'], 'shared checklist')
}, { data: BUSY('dark') })

await T('C3 with no share sheet (a plain browser) Share copies the text and says so', async (page) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
  await page.evaluate(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }) })
  await notes(page)
  await page.locator('.row__main', { hasText: 'Gift ideas' }).click()
  await sheet(page).getByRole('button', { name: 'Share as text' }).click()
  await wait(300)
  const s = await snack(page)
  ok(/Copied as text|Couldn't share/.test(s), `a plain word of what happened: "${s}"`)
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null)
  if (clip !== null) eq(clip, 'Gift ideas\n\nBooks for Riya\nHeadphones for Dad\nPlant for the office', 'clipboard holds the note')
}, { data: BUSY('dark') })

await T('C3 sharing an empty note is refused in words, not sent', async (page) => {
  await fakeShare(page)
  await notes(page)
  await choose(page, 'New note')
  await sheet(page).getByRole('button', { name: 'Share as text' }).click()
  has(await sheet(page).innerText(), 'Write a title or some text', 'message')
  eq(await page.evaluate(() => window.__shared), null, 'nothing shared')
}, { data: seed([]) })

await T('C3 Export notes in Settings saves one text file named by the date with notes, lists and calculations, not to-dos or Trash', async (page) => {
  await page.locator('[aria-label="Settings"]').click()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByText('Export notes', { exact: true }).click()])
  eq(dl.suggestedFilename(), 'calc-notes-2026-11-04.txt', 'file name')
  const file = join(tmpdir(), 'calc-notes-export.txt')
  await dl.saveAs(file)
  const t = readFileSync(file, 'utf8')
  has(t, 'Calc notes, exported 4 Nov 2026\n5 items: notes, lists and saved calculations. To-dos are not included.', 'header')
  has(t, 'Wifi at home\nTags: Home\n\nThe router password is on the sticker', 'pinned note first, with tag and body')
  ok(t.indexOf('Wifi at home') < t.indexOf('Gift ideas'), 'pinned first')
  has(t, 'Goa trip\nFlights  ₹24,000', 'list')
  has(t, 'Home loan EMI\nMonthly EMI: ₹43,391.16', 'calculation')
  ok(!t.includes('Plan the trip'), 'no to-do')
  ok(!t.includes('Old trashed'), 'no Trash')
  has(await snack(page), 'Notes saved to', 'says where')
}, { data: { ...BUSY('dark'), cards: [...BUSY('dark').cards, base({ id: 't1', title: 'Plan the trip', kind: 'task' }), note('x1', 'Old trashed', 'gone', { deletedAt: NOW - 1000 })] } })

await T('C3 Export notes with nothing to export says so and makes no file', async (page) => {
  await page.locator('[aria-label="Settings"]').click()
  let got = false
  page.on('download', () => { got = true })
  await page.getByText('Export notes', { exact: true }).click()
  await wait(300)
  has(await snack(page), 'There are no notes to export yet', 'message')
  ok(!got, 'no download')
}, { data: seed([base({ id: 't1', title: 'Only a task', kind: 'task' })]) })

// ------------------------------------------------------------------ C4: search inside bodies and lines
await T('C4 search finds a word inside a note body or a list line and shows the words around it', async (page) => {
  await notes(page)
  const q = page.getByRole('searchbox', { name: 'Search notes' })
  await q.fill('technician')
  const rows = await page.locator('.tools__list .row__label').allInnerTexts()
  eq(rows, ['Wifi at home'], 'only the note whose body has it')
  has(await page.locator('.row__found').innerText(), 'technician', 'snippet shows the match')
  await shot(page, 'c4-search-body')
  await q.fill('hotel')
  eq(await page.locator('.tools__list .row__label').allInnerTexts(), ['Goa trip'], 'a list line')
  eq(await page.locator('.row__found').innerText(), 'Hotel', 'the line that matched')
  await q.fill('riya books')
  eq(await page.locator('.tools__list .row__label').allInnerTexts(), ['Gift ideas'], 'two words in any order')
  await q.fill('riya zebra')
  has(await listText(page), 'Nothing matches.', 'plain words when nothing matches')
  await q.fill('')
  eq(await page.locator('.row__found').count(), 0, 'no snippets without a search')
}, { data: BUSY('dark') })

await T('C4 a word in the title or tag shows no extra snippet; an amount still finds a list', async (page) => {
  await notes(page)
  const q = page.getByRole('searchbox', { name: 'Search notes' })
  await q.fill('wifi')
  eq(await page.locator('.row__found').count(), 0, 'title match needs no snippet')
  await q.fill('24,000')
  eq(await page.locator('.tools__list .row__label').allInnerTexts(), ['Goa trip'], 'amount match')
}, { data: BUSY('dark') })

// ------------------------------------------------------------------ the look: 360px, dark and light, 100% and 200% font
for (const [theme, font] of [['dark', 100], ['light', 100], ['dark', 200], ['light', 200]]) {
  await T(`LOOK ${theme} ${font}%: Notes home, Add sheet, new note, open note, list and Settings row fit 360px, 44px targets, footer on screen`, async (page) => {
    const tag = `${theme}-${font}`
    await notes(page)
    await shot(page, `look-${tag}-1-notes-home`)
    eq(await smallTargets(page, '.tools'), [], 'Notes home targets')
    has(await page.locator('.saved__view').innerText(), 'New', 'Add control shows its word')

    await addBtn(page).click()
    await shot(page, `look-${tag}-2-add-sheet`)
    eq(await smallTargets(page, '.sheet'), [], 'Add sheet targets')
    await sheet(page).getByRole('button', { name: /^Close/ }).click()

    await choose(page, 'New note')
    await sheet(page).locator('#note-title').fill('Trip packing')
    await sheet(page).locator('#note-body').fill('Passport\nCharger\nSunscreen\nMedicines\nAdapter\nHeadphones')
    await shot(page, `look-${tag}-3-new-note`)
    eq(await smallTargets(page, '.sheet'), [], 'note sheet targets')
    const fv = await footVisible(page)
    ok(fv && fv.ok, `footer on screen ${JSON.stringify(fv)}`)
    await save(page)

    await page.locator('.row__main', { hasText: 'Wifi at home' }).click()
    await shot(page, `look-${tag}-4-open-note`)
    const fv2 = await footVisible(page)
    ok(fv2 && fv2.ok, `open note footer on screen ${JSON.stringify(fv2)}`)
    await sheet(page).locator('#note-body').fill('changed')
    await sheet(page).getByRole('button', { name: /^Close/ }).click()
    await shot(page, `look-${tag}-5-discard-ask`)
    const fv3 = await footVisible(page)
    ok(fv3 && fv3.ok, `discard footer on screen ${JSON.stringify(fv3)}`)
    await sheet(page).getByRole('button', { name: 'Discard' }).click()

    await page.getByRole('searchbox', { name: 'Search notes' }).fill('technician')
    await shot(page, `look-${tag}-6-search`)
    await page.getByRole('searchbox', { name: 'Search notes' }).fill('')

    await page.locator('.row__main', { hasText: 'Dinner split' }).click()
    await shot(page, `look-${tag}-7-list-share`)
    eq(await smallTargets(page, '.tape__tools'), [], 'list action targets')
    await page.getByRole('button', { name: 'Back' }).click()

    await tab(page, 'Calc')
    await page.locator('[aria-label="Settings"]').click()
    await page.getByText('Export notes', { exact: true }).scrollIntoViewIfNeeded()
    await shot(page, `look-${tag}-8-settings-export`)
  }, { data: BUSY(theme), font })
}

await app.stop()
console.log(failed ? `${passed} passed, ${failed} FAILED` : `${passed} passed, 0 failed`)
process.exit(failed ? 1 : 0)
