// Browser pass for: "Make reminders reliable", the Due "may not have shown" notice, several lead times,
// repeat-after-I-tick-it, three-state list lines, paste-a-list, inline rename. 360px, with screenshots.
// Run: node e2e/reminders-lists.test.mjs        Screenshots land in $TMPDIR/calc-reminders-shots
process.env.TZ = 'Asia/Kolkata'
import { startApp, openApp, tab, stored, overflowing } from './lib.mjs'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = join(tmpdir(), 'calc-reminders-shots')
mkdirSync(OUT, { recursive: true })
const NOW = Date.parse('2026-11-02T10:00:00+05:30')
const DAY = 86_400_000
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const ok = (c, what) => { if (!c) throw new Error(what) }
const base = (o) => ({ title: 'Item', kind: 'tool', toolId: null, inputs: null, summary: '', amount: null, lines: [], note: '', tags: [], pinned: false, createdAt: NOW - 1000, updatedAt: NOW - 1000, deletedAt: null, ...o })
const seed = (cards, reminders = []) => ({ schemaVersion: 3, settings: { theme: 'dark' }, history: [], cards, reminders, memory: null, input: { expr: '', fresh: false }, })
const list = () => base({ id: 'L1', title: 'Trip split', kind: 'tape', summary: '3 lines', amount: '3000', checklist: true, lines: [{ id: 'a', label: 'Ravi', value: '1000' }, { id: 'b', label: 'Asha', value: '1000' }, { id: 'c', label: 'Mohan', value: '1000' }] })

const app = await startApp()
let failed = 0
const T = async (name, fn, opts = {}) => {
  const { page, errors, close } = await openApp(app, opts)
  try {
    await fn(page)
    const over = await overflowing(page)
    ok(over.length === 0, `sideways overflow: ${over.join(' | ')}`)
    ok(errors.length === 0, `console errors: ${errors.join(' | ')}`)
    console.log('PASS', name)
  } catch (e) {
    failed++
    console.log('FAIL', name, '::', e.message)
    await page.screenshot({ path: join(OUT, `FAIL-${name.replace(/\W+/g, '-')}.png`) })
  } finally { await close() }
}
const shot = (page, n) => page.screenshot({ path: join(OUT, `${n}.png`) })

await T('settings: Make reminders reliable sheet', async (page) => {
  await page.locator('[aria-label="Settings"]').click()
  await page.getByRole('button', { name: /Make reminders reliable/ }).click()
  const sheet = page.locator('.sheet')
  ok((await sheet.innerText()).includes('Steps for most phones'), 'generic steps shown on the web')
  ok((await sheet.locator('ol.steps li').count()) >= 2, 'steps listed')
  ok(await sheet.getByRole('button', { name: 'Close' }).count(), 'X present')
  await shot(page, '1-reliable-sheet')
  await sheet.locator('.sheet__foot .btn--primary').click()
  ok((await sheet.innerText()).includes('only works in the Android app'), 'web says so')
  await page.getByRole('button', { name: 'Close' }).last().click()
  ok((await page.locator('.sheet').count()) === 0, 'sheet closed')
})

await T('list: three states cycle with words, totals ignore skipped', async (page) => {
  await tab(page, 'Notes'); await page.getByText('Trip split').first().click()
  const pill = (n) => page.locator('.tri').nth(n)
  ok((await pill(0).innerText()) === 'Pending', 'starts pending')
  await pill(0).click(); ok((await pill(0).innerText()) === 'Paid', 'paid after one tap')
  await pill(0).click(); ok((await pill(0).innerText()) === 'Skipped', 'skipped after two')
  await pill(1).click()
  const head = await page.locator('.tape__total').innerText()
  ok(/1 of 2 done/.test(head), `progress ignores the skipped line: ${head}`)
  ok(/1 skipped, not counted/.test(await page.locator('.tape__of').innerText()), 'skipped is said in words')
  await shot(page, '2-three-states')
  await pill(0).click(); ok((await pill(0).innerText()) === 'Pending', 'back to pending')
  const s = await stored(page)
  ok(!s.cards[0].lines[0].skip && !s.cards[0].lines[0].done, 'stored back to plain')
}, { data: seed([list()]), now: NOW })

await T('list: paste several lines offers a checklist', async (page) => {
  await tab(page, 'Notes'); await page.getByText('Trip split').first().click()
  await page.locator('input[aria-label="Label and amount"]').evaluate((el) => {
    const dt = new DataTransfer(); dt.setData('text/plain', '- Milk\n- Eggs 60\n[x] Bread')
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  const offer = page.locator('.tape__offer')
  ok((await offer.innerText()).includes('Add 3 lines as checklist items'), `offer text: ${await offer.innerText().catch(() => 'none')}`)
  await shot(page, '3-paste-offer')
  await offer.getByRole('button', { name: /Add 3 lines/ }).click()
  const s = await stored(page)
  await wait(400)
  const lines = (await stored(page)).cards[0].lines
  ok(lines.length === 6, `6 lines, got ${lines.length}`)
  ok(lines[5].done === true && lines[5].label === 'Bread', 'ticked line kept')
  ok(lines[4].value === '60' && lines[3].value === '0', 'amount kept, none means 0')
  ok(s.cards[0].checklist === true, 'is a checklist')
}, { data: seed([list()]), now: NOW })

await T('list: rename a line in place', async (page) => {
  await tab(page, 'Notes'); await page.getByText('Trip split').first().click()
  await page.getByRole('button', { name: 'Rename Ravi' }).click()
  const input = page.locator('input.tape__rename')
  ok(await input.evaluate((el) => el === document.activeElement), 'input focused')
  await shot(page, '4-rename')
  await input.fill('Ravi K'); await input.press('Enter')
  await wait(400)
  ok((await stored(page)).cards[0].lines[0].label === 'Ravi K', 'renamed')
  await page.getByRole('button', { name: 'Rename Asha' }).click()
  await page.locator('input.tape__rename').fill('nope'); await page.keyboard.press('Escape')
  await wait(300)
  ok((await stored(page)).cards[0].lines[1].label === 'Asha', 'Escape cancels')
  ok((await page.locator('input.tape__rename').count()) === 0, 'input gone')
}, { data: seed([list()]), now: NOW })

await T('task sheet: lead pills and repeat after I tick it', async (page) => {
  const card = base({ id: 'T1', title: 'Service the car', kind: 'task', summary: 'Due 10 Nov 2026' })
  const rem = { id: 'R1', cardId: 'T1', dueAt: Date.parse('2026-11-10T09:00:00+05:30'), repeat: 'none', anchorDay: 10, leadDays: 3, done: false, history: [] }
  await page.evaluate(() => 0)
  await tab(page, 'Notes'); await page.getByRole('radio', { name: /^To-do/ }).click()
  await page.getByRole('radio', { name: 'All', exact: true }).click()
  await page.getByText('Service the car').first().click()
  const sheet = page.locator('.sheet')
  await sheet.getByRole('button', { name: '7 days before' }).click()
  await sheet.getByRole('button', { name: 'On the day' }).click()
  await sheet.getByRole('switch', { name: 'Repeat after I tick it' }).click()
  await sheet.locator('#task-after').fill('180')
  await sheet.locator('#task-after').scrollIntoViewIfNeeded()
  await sheet.getByRole('button', { name: '14 days before' }).scrollIntoViewIfNeeded()
  await shot(page, '5-task-sheet')
  await sheet.locator('.sheet__foot .btn--primary').click()
  await wait(400)
  const r = (await stored(page)).reminders[0]
  ok(r.afterDays === 180, `afterDays ${r.afterDays}`)
  ok(JSON.stringify(r.leads) === '[7,3,0]' && r.leadDays === 7, `leads ${JSON.stringify(r.leads)} / ${r.leadDays}`)
}, { data: seed([base({ id: 'T1', title: 'Service the car', kind: 'task', summary: 'Due 10 Nov 2026' })], [{ id: 'R1', cardId: 'T1', dueAt: Date.parse('2026-11-10T09:00:00+05:30'), repeat: 'none', anchorDay: 10, leadDays: 3, done: false, history: [] }]), now: NOW })

await T('Due: "may not have shown" notice, and its Fix reminders link', async (page) => {
  const dueAt = Date.parse('2026-11-02T08:00:00+05:30') // came due two hours ago
  // Seeded by an init script so the old page's going-away note cannot overwrite it before the reload.
  await page.addInitScript(([at, due]) => { if (!sessionStorage.getItem('__fl')) { sessionStorage.setItem('__fl', '1'); localStorage.setItem('vkcalc.firelog', JSON.stringify({ seenAt: at - 6 * 3_600_000, planned: [{ rid: 'R1', due, at, nid: 5 }] })) } }, [dueAt, dueAt])
  await page.reload(); await page.waitForSelector('.app')
  await tab(page, 'Due')
  await page.waitForSelector('.due__missed', { timeout: 6000 })
  const t = await page.locator('.due__missed').innerText()
  ok(t.includes('A reminder may not have shown: Pay rent.'), `notice: ${t}`)
  ok(!/did not|didn't|failed/.test(t), 'no claim of certainty')
  await shot(page, '6-due-notice')
  await page.locator('.due__missed').getByRole('button', { name: 'Fix reminders' }).click()
  ok((await page.locator('.sheet').innerText()).includes('Make reminders reliable'), 'link opens the sheet')
  await shot(page, '7-due-fix-sheet')
  await page.getByRole('button', { name: 'Close' }).last().click()
  await page.locator('.due__missed').getByRole('button', { name: 'Dismiss' }).click()
  ok((await page.locator('.due__missed').count()) === 0, 'dismissed')
}, { data: seed([base({ id: 'C1', title: 'Pay rent', kind: 'task', summary: 'x' })], [{ id: 'R1', cardId: 'C1', dueAt: Date.parse('2026-11-02T08:00:00+05:30'), repeat: 'none', anchorDay: 2, leadDays: 0, done: false, history: [] }]), now: NOW })

await app.stop()
console.log(failed ? `${failed} FAILED` : 'ALL PASSED', '— screenshots in', OUT)
process.exit(failed ? 1 : 0)
