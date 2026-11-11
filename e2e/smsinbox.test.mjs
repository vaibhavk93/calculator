// Browser tests for the SMS Inbox: the permission explainer, draining the phone-side queue into To review, Approve / Change / Not a spend / Reject,
// learning, Auto mode (confident payments added with Undo, never a person or a new payee) and the drift circuit breaker.
// The phone-side queue is an in-memory fake handed to the app by a localStorage key read only at startup (src/main.tsx). Run: node e2e/smsinbox.test.mjs
// "Today" is frozen at 2026-11-15 10:00 IST. Env: APP_URL=http://127.0.0.1:PORT/ uses an already served build.
import { chromium } from 'playwright-core'
import { startApp, openApp, stored, tab } from './lib.mjs'

const NOW = new Date('2026-11-15T10:00:00+05:30').getTime()
const cat = (id, name) => ({ id, name, limit: null, parentId: null, deletedAt: null })
const inst = (id, name, kind, o = {}) => ({ id, name, kind, network: null, bank: '', last4: '', rewardNote: '', deletedAt: null, ...o })
let ref = 0
const swiggy = (amt = '450.00', who = 'SWIGGY') => `Rs.${amt} spent on HDFC Bank Credit Card XX1234 at ${who} on 15-11-26. Ref ${++ref}0000000${ref}. Avl limit Rs.90000`
const upiPerson = (amt = '150.00') => `Rs.${amt} debited from a/c XX7261 on 15-11-26 to VPA rahul.s@okhdfcbank (UPI Ref No 41234567${String(++ref).padStart(4, '0')}). Not you? Call 18001`
const OTP = 'Your OTP is 482913 for a transaction of Rs 450. Never share this with anyone'
const M = (body, id) => ({ id: id ?? `q${++ref}`, sender: 'VM-HDFCBK', body, receivedAt: NOW - 60_000 })

const budget = (extra = {}) => ({
  overall: null,
  categories: [cat('c-food', 'Food'), cat('c-shop', 'Shopping'), cat('c-trav', 'Travel'), cat('c-rent', 'Rent')],
  instruments: [inst('i-card', 'HDFC Regalia', 'credit', { network: 'visa', bank: 'HDFC Bank', last4: '1234' }), inst('i-sal', 'HDFC Salary', 'bank', { bank: 'HDFC Bank', last4: '7261' })],
  expenses: [],
  ...extra,
})
const seed = (b, settings = {}) => ({ schemaVersion: 3, settings: { startupTab: 'budget', ...settings }, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false }, budget: b })
const learnedOf = (key, count, categoryId = 'c-food') => ({ key, categoryId, count, lastAt: 1 })

const cases = []
const T = (id, title, fn) => cases.push({ id, title, fn })
const ok = (c, m) => { if (!c) throw new Error(m) }
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`) }

let APP
/** Opens the app with a captured-messages queue. `capture` seeds "Capture bank messages" as already on. */
const open = async ({ b = budget(), messages = [], permission = 'granted', capture = true, mode = 'review', startupTab = 'budget', noQueue = false } = {}) => {
  const o = await openApp(APP, { data: seed(b, { smsCapture: capture, smsMode: mode, startupTab }), now: NOW, smsQueue: noQueue ? null : { permission, messages } })
  o.page.setDefaultTimeout(5000)
  return o
}
const queueLeft = (page) => page.evaluate(async () => (await window.__smsQueue.drain()).length)
const REVIEW = (page) => page.locator('.screen[aria-label="To review"]')
const openInbox = async (page) => { await page.getByRole('button', { name: /to review|auto-added/ }).click(); await REVIEW(page).waitFor() }
const rows = (page) => REVIEW(page).locator('.inbox__item')
const rowText = async (page) => (await rows(page).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())
const settle = (page) => page.waitForTimeout(400) // the drain on open, the 250ms save
const toast = (page) => page.locator('.snack').innerText().then((t) => t.replace(/\s+/g, ' ').trim())
const openSettings = async (page) => { await page.locator('[aria-label="Settings"]').click(); await page.locator('.screen[aria-label="Settings"]').waitFor() }

T('IN01', 'permission explainer: shown BEFORE the permission, says what it must, Not now leaves capture off', async () => {
  const { page, errors, close } = await open({ capture: false, permission: 'prompt', startupTab: 'calculate' })
  await openSettings(page)
  const sw = page.getByRole('switch', { name: 'Capture bank messages' })
  eq(await sw.getAttribute('aria-checked'), 'false')
  await sw.click()
  const sheet = page.locator('.sheet')
  await sheet.waitFor()
  const t = (await sheet.innerText()).replace(/\s+/g, ' ')
  for (const w of ['Why', 'What is read', 'bank-style senders', 'Personal chats are never read', 'One-time passwords and offers are ignored', 'Only on this phone', 'encrypted', 'Not backed up', 'Never sent anywhere', 'No one else can see it', 'masked', 'Delete captured messages', 'Allow messages', 'Not now']) ok(t.includes(w), `explainer lacks "${w}": ${t}`)
  eq(await page.evaluate(() => window.__smsQueue.permission()), 'prompt', 'no permission was asked yet')
  await sheet.getByRole('button', { name: 'Not now' }).click()
  eq(await sheet.count(), 0, 'sheet closed')
  eq(await sw.getAttribute('aria-checked'), 'false', 'still off')
  eq((await stored(page)).settings.smsCapture ?? false, false)
  eq(errors, [], 'console errors')
  await close()
})

T('IN02', 'Allow messages: permission asked, capture turns on, the queue is drained', async () => {
  const { page, close } = await open({ capture: false, permission: 'prompt', startupTab: 'calculate', messages: [M(swiggy())] })
  await openSettings(page)
  await page.getByRole('switch', { name: 'Capture bank messages' }).click()
  await page.getByRole('button', { name: 'Allow messages' }).click()
  await page.locator('.sheet').waitFor({ state: 'detached' })
  eq(await page.getByRole('switch', { name: 'Capture bank messages' }).getAttribute('aria-checked'), 'true')
  eq(await page.evaluate(async () => [await window.__smsQueue.permission(), await window.__smsQueue.captureEnabled()]), ['granted', true])
  await settle(page)
  eq((await stored(page)).settings.smsCapture, true)
  eq((await stored(page)).budget.inbox?.length, 1, 'the waiting message was drained into the inbox')
  eq(await queueLeft(page), 0, 'and acked')
  await close()
})

T('IN03', 'denied (and blocked by restricted settings): says what to do, offers Open settings, nothing turned on', async () => {
  const { page, close } = await open({ capture: false, permission: 'prompt', startupTab: 'calculate' })
  await page.evaluate(() => { window.__opened = 0; window.__smsQueue.request = async () => 'denied'; window.__smsQueue.openAppSettings = async () => { window.__opened++ } })
  await openSettings(page)
  await page.getByRole('switch', { name: 'Capture bank messages' }).click()
  await page.getByRole('button', { name: 'Allow messages' }).click()
  const sheet = page.locator('.sheet')
  await sheet.getByText('Android did not allow it').waitFor()
  const t = (await sheet.innerText()).replace(/\s+/g, ' ')
  for (const w of ['Capture is still off', "Don't allow", 'Restricted setting', 'App info', 'three dots', 'Allow restricted settings']) ok(t.includes(w), `denied help lacks "${w}": ${t}`)
  await sheet.getByRole('button', { name: 'Open settings' }).click()
  eq(await page.evaluate(() => window.__opened), 1, 'asked Android to open settings')
  await sheet.locator('.sheet__foot').getByRole('button', { name: 'Close' }).click()
  eq(await page.getByRole('switch', { name: 'Capture bank messages' }).getAttribute('aria-checked'), 'false')
  await close()
})

T('IN04', 'not available (web build): says so, and the rest still works', async () => {
  const { page, close } = await open({ capture: false, startupTab: 'calculate', noQueue: true })
  await openSettings(page)
  const body = await page.locator('.screen[aria-label="Settings"]').innerText()
  ok(body.includes('Works in the Android app only'), 'row hint missing')
  await page.getByRole('switch', { name: 'Capture bank messages' }).click()
  await page.locator('.sheet').getByText('works only in the Android app').waitFor()
  await close()
})

T('IN05', 'drain: payments land in To review, OTP and offers are dropped, nothing is kept of the message, the queue is acked', async () => {
  const { page, errors, close } = await open({ messages: [M(swiggy('450.00')), M(OTP), M(upiPerson()), M('Congratulations! Pre-approved loan of Rs 500000. Apply now')] })
  await settle(page)
  await page.getByRole('button', { name: '2 to review' }).waitFor()
  eq(await page.locator('.budget__review').count(), 1)
  await openInbox(page)
  const t = await rowText(page)
  eq(t.length, 2, 'two rows: ' + t.join(' | '))
  ok(t.some((x) => /₹450/.test(x) && /Swiggy/.test(x) && /Credit card/.test(x) && /HDFC Regalia/.test(x)), 'Swiggy row names the saved card: ' + t.join(' | '))
  ok(t.some((x) => /₹150/.test(x) && /Rahul S/.test(x) && /UPI/.test(x)), 'UPI row')
  ok(t.every((x) => /\d{1,2} Nov/.test(x)), 'a date is shown')
  const data = await stored(page)
  const raw = JSON.stringify(data)
  ok(!/spent on|Avl limit|OTP|VM-HDFCBK|Pre-approved/i.test(raw), 'a message body or sender was stored')
  eq(data.budget.inbox.length, 2)
  eq(data.budget.smsSeen.length, 2, 'fingerprints shared with the manual scan')
  eq(data.budget.expenses.length, 0, 'nothing is an entry yet')
  eq(await queueLeft(page), 0, 'acked')
  eq(errors, [], 'console errors')
  await close()
})

T('IN06', 'the review row is always on Budget home: "Nothing waiting" at zero, then "1 to review" when a new message appears as the app comes back to the front', async () => {
  const { page, close } = await open({ messages: [] })
  await settle(page)
  eq(await page.locator('.budget__review').count(), 1, 'one quiet row, never hidden')
  eq((await page.locator('.budget__review').innerText()).replace(/\s+/g, ' ').trim(), 'To review Nothing waiting')
  await page.evaluate(() => window.__smsQueue.push({ id: 'late1', sender: 'VM-HDFCBK', body: 'Rs.99.00 spent on HDFC Bank Credit Card XX1234 at ZOMATO on 15-11-26. Ref 999900000001', receivedAt: Date.now() }))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.getByRole('button', { name: '1 to review' }).waitFor()
  await close()
})

T('IN07', 'Approve: one tap makes a real entry, learns the payee, and the card is kept', async () => {
  const { page, close } = await open({ messages: [M(swiggy('450.00'))] })
  await settle(page)
  await openInbox(page)
  await rows(page).first().getByRole('button', { name: /^Approve/ }).click()
  ok(/Added ₹450/.test(await toast(page)), 'toast: ' + await toast(page))
  eq(await rows(page).count(), 0)
  await settle(page)
  const d = (await stored(page)).budget
  eq(d.expenses.length, 1)
  ok(d.expenses[0].auto === undefined, 'a tap-approved entry is not Auto-added')
  eq([d.expenses[0].amount, d.expenses[0].note, d.expenses[0].mode, d.expenses[0].instrumentId, d.expenses[0].date], ['450', 'Swiggy', 'credit', 'i-card', '2026-11-15'])
  eq(d.expenses[0].categoryId, 'c-food', 'the keyword guess for Swiggy, shown to the person first')
  eq(d.learned, [{ key: 'swiggy', categoryId: 'c-food', count: 1, lastAt: NOW }])
  eq(d.inbox[0].status, 'approved')
  await close()
})

T('IN08', 'the suggestion has a plain "because" line, and the Inbox shows nothing but plain words', async () => {
  const { page, close } = await open({ b: budget({ learned: [learnedOf('swiggy', 1)] }), messages: [M(swiggy())] })
  await settle(page)
  await openInbox(page)
  const t = (await rowText(page))[0]
  ok(t.includes('You tagged Swiggy as Food once'), t)
  ok(t.includes('Food'), 'category shown')
  await close()
})

T('IN09', 'Reject removes it (Undo brings it back); Not a spend too; neither makes an entry or teaches anything', async () => {
  const { page, close } = await open({ messages: [M(swiggy('450.00')), M(upiPerson('150.00'))] })
  await settle(page)
  await openInbox(page)
  await rows(page).filter({ hasText: 'Swiggy' }).getByRole('button', { name: /^Reject/ }).click()
  eq(await rows(page).count(), 1)
  await page.getByRole('button', { name: 'Undo' }).click()
  eq(await rows(page).count(), 2, 'Undo put it back')
  await rows(page).filter({ hasText: 'Swiggy' }).getByRole('button', { name: /is not a spend/ }).click()
  await rows(page).filter({ hasText: 'Rahul' }).getByRole('button', { name: /^Reject/ }).click()
  eq(await rows(page).count(), 0)
  await settle(page)
  const d = (await stored(page)).budget
  eq(d.expenses.length, 0)
  eq(d.learned, undefined)
  eq(d.inbox.map((i) => [i.status, !!i.notSpend]).sort(), [['rejected', false], ['rejected', true]])
  await close()
})

T('IN10', 'Change: pick another category and add a note, then approve; the new tag is what is learned', async () => {
  const { page, close } = await open({ messages: [M(swiggy('450.00'))] })
  await settle(page)
  await openInbox(page)
  await rows(page).first().locator('.inbox__acts').getByRole('button', { name: /^Change/ }).click()
  const sheet = page.locator('.sheet')
  await sheet.getByRole('button', { name: /^Category: / }).click()
  await page.locator('.sheet').last().getByRole('option', { name: 'Shopping' }).click()
  await sheet.getByLabel('Note').fill('birthday gift')
  await sheet.locator('.sheet__foot').getByRole('button', { name: 'Approve', exact: true }).click()
  await settle(page)
  const d = (await stored(page)).budget
  eq([d.expenses[0].categoryId, d.expenses[0].note], ['c-shop', 'Swiggy: birthday gift'])
  eq(d.learned[0], { key: 'swiggy', categoryId: 'c-shop', count: 1, lastAt: NOW })
  await close()
})

T('IN11', 'Approve all suggested: only payees tagged the same way twice, never a person; one Undo', async () => {
  const { page, close } = await open({ b: budget({ learned: [learnedOf('swiggy', 2), learnedOf('rahul s', 4)] }), messages: [M(swiggy('450.00')), M(swiggy('120.00')), M(upiPerson('150.00')), M(swiggy('75.00', 'ZOMATO'))] })
  await settle(page)
  await openInbox(page)
  const btn = REVIEW(page).getByRole('button', { name: /Approve all suggested/ })
  eq((await btn.innerText()).trim(), 'Approve all suggested (2)')
  await btn.click()
  await settle(page)
  eq(await rows(page).count(), 2, 'person and new payee still waiting')
  eq((await stored(page)).budget.expenses.length, 2)
  await page.getByRole('button', { name: 'Undo' }).click()
  eq(await rows(page).count(), 4, 'Undo took both back')
  await settle(page)
  eq((await stored(page)).budget.expenses.length, 0)
  await close()
})

T('IN12', 'Auto mode: a confident payee is added with an Auto-added label; a person, a new payee and an unmatched card wait', async () => {
  const { page, errors, close } = await open({
    mode: 'auto',
    b: budget({ learned: [learnedOf('swiggy', 2), learnedOf('rahul s', 5)] }),
    messages: [M(swiggy('450.00')), M(upiPerson('150.00')), M(swiggy('99.00', 'ZOMATO')), M(swiggy('300.00').replace('XX1234', 'XX9999'))],
  })
  await settle(page)
  const d = (await stored(page)).budget
  eq(d.expenses.length, 1, 'only one auto-added')
  eq([d.expenses[0].note, d.expenses[0].auto, d.expenses[0].categoryId], ['Swiggy', true, 'c-food'])
  eq(d.inbox.filter((i) => i.status === 'pending').length, 3, 'three wait for review')
  eq(d.learned.find((l) => l.key === 'swiggy').count, 2, 'auto-adding does not count as a confirmation')
  await page.getByRole('button', { name: '3 to review' }).waitFor()
  ok((await page.locator('.budget__recent').first().innerText()).includes('Auto-added'), 'Budget home entry says Auto-added')
  await page.locator('.budget__day').first().click()
  const day = page.locator('.screen[aria-label^="Day:"]')
  await day.waitFor()
  ok((await day.innerText()).includes('Auto-added'), 'Day view says Auto-added')
  await day.getByRole('button', { name: 'Back' }).click()
  await openInbox(page)
  ok((await REVIEW(page).innerText()).includes('Recently auto-added'), 'recent list')
  const t = (await rowText(page)).join(' | ')
  ok(/Rahul S/.test(t) && /Zomato/.test(t), t)
  ok(/Looks like a person/.test(t), 'person note in Auto mode')
  eq(errors, [], 'console errors')
  await close()
})

T('IN13', 'Undo on an auto-added entry: removes it, the payee starts again, the item is back to review', async () => {
  const { page, close } = await open({ mode: 'auto', b: budget({ learned: [learnedOf('swiggy', 2)] }), messages: [M(swiggy('450.00'))] })
  await settle(page)
  await openInbox(page)
  eq(await rows(page).count(), 0, 'nothing waiting')
  await REVIEW(page).getByRole('button', { name: /^Undo ₹450/ }).click()
  eq(await rows(page).count(), 1, 'back to review')
  ok(!(await REVIEW(page).innerText()).includes('Recently auto-added'), 'recent list empty')
  await settle(page)
  const d = (await stored(page)).budget
  eq(d.expenses.length, 0)
  eq(d.learned ?? [], [], 'the payee was forgotten')
  eq(d.autoLog, [{ id: d.inbox[0].id, bad: true }])
  eq((await stored(page)).settings.smsMode, 'auto', 'one undo is not drift')
  await close()
})

T('IN14', 'circuit breaker: 2 undone or changed of the last 10 switch back to Review first and say why', async () => {
  const msgs = ['A', 'B', 'C'].map((s, i) => M(swiggy(`${100 + i}.00`, `SHOP${s}X`)))
  const { page, close } = await open({ mode: 'auto', b: budget({ learned: ['shopax', 'shopbx', 'shopcx'].map((k) => learnedOf(k, 2)) }), messages: msgs })
  await settle(page)
  eq((await stored(page)).budget.expenses.length, 3, 'three auto-added')
  await openInbox(page)
  await REVIEW(page).getByRole('button', { name: /^Undo ₹100/ }).click()
  eq((await stored(page)).settings.smsMode, 'auto')
  await REVIEW(page).getByRole('button', { name: /^Undo ₹101/ }).click()
  ok((await toast(page)).includes('Auto-add is off now: 2 of the last 10'), 'toast: ' + await toast(page))
  ok((await REVIEW(page).innerText()).includes('Auto-add switched itself off'), 'the screen says why')
  await settle(page)
  eq((await stored(page)).settings.smsMode, 'review')
  await REVIEW(page).getByRole('button', { name: 'Back' }).click()
  await page.evaluate(() => window.__smsQueue.push({ id: 'z1', sender: 'VM-HDFCBK', body: 'Rs.102.00 spent on HDFC Bank Credit Card XX1234 at SHOPCX on 15-11-26. Ref 777700000009', receivedAt: Date.now() }))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await settle(page)
  eq((await stored(page)).budget.expenses.length, 1, 'nothing more was added automatically')
  await close()
})

T('IN15', 'Settings: mode choice with an honest sentence each; Delete captured messages asks first and clears the queue and the waiting list', async () => {
  const { page, close } = await open({ startupTab: 'calculate', messages: [M(swiggy()), M(upiPerson())] })
  await settle(page)
  await openSettings(page)
  const s = page.locator('.screen[aria-label="Settings"]')
  const text = (await s.innerText()).replace(/\s+/g, ' ')
  ok(text.includes('Nothing is added until you approve it'), 'review sentence')
  await s.getByRole('button', { name: /^When a payment arrives: / }).click()
  const pick = page.locator('.sheet').last()
  const t = (await pick.innerText()).replace(/\s+/g, ' ')
  ok(t.includes('Review first') && t.includes('Auto-add the confident ones') && t.includes('marked Auto-added with Undo'), t)
  await pick.getByRole('option', { name: /Auto-add the confident ones/ }).click()
  await settle(page)
  eq((await stored(page)).settings.smsMode, 'auto')
  await page.evaluate(() => window.__smsQueue.push({ id: 'held', sender: 'VM-HDFCBK', body: 'x', receivedAt: Date.now() }))
  await s.getByRole('button', { name: /Delete captured messages/ }).click()
  const dlg = page.locator('.sheet')
  ok((await dlg.innerText()).includes('cannot be undone'), 'says it cannot be undone')
  await dlg.getByRole('button', { name: 'Keep them' }).click()
  eq(((await stored(page)).budget.inbox ?? []).length, 2, 'Keep them changed nothing')
  await s.getByRole('button', { name: /Delete captured messages/ }).click()
  await page.locator('.sheet__foot').getByRole('button', { name: 'Delete', exact: true }).click()
  await settle(page)
  eq(await queueLeft(page), 0, 'the phone queue is empty')
  eq(((await stored(page)).budget.inbox ?? []).filter((i) => i.status === 'pending').length, 0, 'the waiting list is empty')
  await close()
})

T('IN16', 'Learned payees (reusing Merchant rules): list, change a category (starts again at 1), forget with Undo', async () => {
  const { page, close } = await open({ startupTab: 'calculate', b: budget({ learned: [learnedOf('swiggy', 3), learnedOf('zomato', 1)] }), messages: [] })
  await openSettings(page)
  await page.locator('.screen[aria-label="Settings"]').getByRole('button', { name: /Learned payees/ }).click()
  const rules = page.locator('.screen[aria-label="Merchant rules"]')
  await rules.waitFor()
  const t = (await rules.locator('#learned').innerText()).replace(/\s+/g, ' ')
  ok(t.includes('Swiggy') && t.includes('Tagged the same way 3 times in a row') && t.includes('Zomato') && t.includes('Tagged once'), t)
  await rules.getByRole('button', { name: /^Category for Swiggy: / }).click()
  await page.locator('.sheet').last().getByRole('option', { name: 'Travel' }).click()
  await settle(page)
  eq((await stored(page)).budget.learned.find((l) => l.key === 'swiggy'), { key: 'swiggy', categoryId: 'c-trav', count: 1, lastAt: NOW })
  await rules.getByRole('button', { name: 'Forget Zomato' }).click()
  await page.locator('.snack').getByRole('button', { name: 'Undo' }).click()
  ok((await rules.locator('#learned').innerText()).includes('Zomato'), 'Undo brought it back')
  await close()
})

T('IN17', 'no loss, no double count: a message the phone re-sends after a restart is skipped by its fingerprint', async () => {
  const m = M(swiggy('450.00'), 'same-queue-id')
  const { page, close } = await open({ messages: [m] })
  await settle(page)
  eq((await stored(page)).budget.inbox.length, 1)
  await page.reload() // the fake queue starts again with the same message, as if it was never acked
  await page.waitForSelector('.app')
  await settle(page)
  eq((await stored(page)).budget.inbox.length, 1, 'still one')
  eq(await queueLeft(page), 0, 'and acked again')
  await close()
})

T('IN18', 'the manual scan and the queue never count one message twice: a message already added by hand is not offered', async () => {
  const swiggyEntry = { id: 'x1', date: '2026-11-15', amount: '450', categoryId: 'c-food', mode: 'credit', instrumentId: 'i-card', note: 'Swiggy', deletedAt: null }
  const { page, close } = await open({ b: budget({ expenses: [swiggyEntry] }), messages: [M(swiggy('450.00'))] })
  await settle(page)
  eq((await page.locator('.budget__review').innerText()).replace(/\s+/g, ' ').trim(), 'To review Nothing waiting', 'already in the budget: not offered')
  eq(await queueLeft(page), 0, 'but acked')
  await close()
})

T('IN19', 'empty states: capture off offers to turn it on; capture on says nothing is waiting. The old manual scan is still there', async () => {
  let o = await open({ capture: false, permission: 'prompt', b: budget() })
  await o.page.getByRole('button', { name: 'Capture bank messages' }).waitFor() // Budget empty state
  await o.page.getByRole('button', { name: 'Add from bank messages' }).click()
  await o.page.locator('.screen[aria-label="Add from messages"]').waitFor()
  await o.close()
  o = await open({ capture: true, b: budget({ expenses: [{ id: 'x1', date: '2026-11-15', amount: '5', categoryId: null, mode: null, instrumentId: null, note: 'x', deletedAt: null }] }) })
  await o.page.getByRole('button', { name: 'More in Budget' }).click()
  await o.close()
})

T('IN20', 'Ignore: a card is dropped on arrival (acked, never stored), listed in Settings, and Stop ignoring brings it back', async () => {
  const icici = (n) => `INR 300.00 spent using ICICI Bank Credit Card XX4455 on 15-11-26 at AMAZON. Ref 6600000000${n}`
  const { page, errors, close } = await open({ startupTab: 'budget', messages: [M(swiggy('450.00')), { ...M(icici(1)), sender: 'AX-ICICIB-S' }] })
  await settle(page)
  await openInbox(page)
  eq(await rows(page).count(), 2)
  await rows(page).filter({ hasText: 'Swiggy' }).getByRole('button', { name: /^Ignore messages like/ }).click()
  const sheet = page.locator('.sheet')
  const t = (await sheet.innerText()).replace(/\s+/g, ' ')
  for (const w of ['dropped the moment they arrive', 'not saved', 'This card', 'HDFC Regalia', 'This sender', 'HDFCBK', 'Settings, Bank messages, Ignored']) ok(t.includes(w), `ignore sheet lacks "${w}": ${t}`)
  await sheet.getByRole('button', { name: 'Ignore this card' }).click()
  eq(await rows(page).count(), 1, 'its waiting item was cleared')
  ok(/Ignoring HDFC Regalia/.test(await toast(page)), 'toast: ' + await toast(page))
  await page.evaluate(() => window.__smsQueue.push({ id: 'again', sender: 'VM-HDFCBK', body: 'Rs.80.00 spent on HDFC Bank Credit Card XX1234 at ZOMATO on 15-11-26. Ref 5500000000077', receivedAt: Date.now() }))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await settle(page)
  eq(await queueLeft(page), 0, 'acked')
  const d = (await stored(page)).budget
  eq(d.inbox.length, 1, 'only the ICICI item is stored')
  ok(!JSON.stringify(d).includes('ZOMATO') && !JSON.stringify(d.smsSeen).includes('zomato'), 'nothing of the dropped message was kept')
  eq((await stored(page)).settings.smsIgnored.map((r) => r.key), ['card:HDFC Bank|1234'])
  // Settings > Bank messages > Ignored
  await REVIEW(page).getByRole('button', { name: 'Back' }).click()
  await tab(page, 'Calculate')
  await openSettings(page)
  const sc = page.locator('.screen[aria-label="Settings"]')
  await sc.getByRole('button', { name: /^Ignored/ }).click()
  ok((await page.locator('.sheet').innerText()).includes('HDFC Regalia'), 'listed')
  await page.getByRole('button', { name: /^Stop ignoring HDFC Regalia/ }).click()
  await page.waitForTimeout(400)
  eq((await stored(page)).settings.smsIgnored, [], 'rule removed')
  await page.evaluate(() => window.__smsQueue.push({ id: 'back', sender: 'VM-HDFCBK', body: 'Rs.81.00 spent on HDFC Bank Credit Card XX1234 at ZOMATO on 15-11-26. Ref 5500000000078', receivedAt: Date.now() }))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await settle(page)
  eq((await stored(page)).budget.inbox.length, 2, 'messages from the card arrive again')
  eq(errors, [], 'console errors')
  await close()
})

const someEntry = { id: 'x0', date: '2026-11-14', amount: '5', categoryId: null, mode: null, instrumentId: null, note: 'x', deletedAt: null } // so Budget home shows More in Budget
T('IN21', 'Budget home has a quiet row with capture OFF: "Catch bank payments automatically", Off. Tap to set it up, opens the explainer; on the web it says Android only', async () => {
  let o = await open({ capture: false, permission: 'prompt', messages: [] })
  const row = o.page.locator('.budget__review')
  eq(await row.count(), 1, 'row is there with capture off')
  eq((await row.innerText()).replace(/\s+/g, ' ').trim(), 'Catch bank payments automatically Off. Tap to set it up')
  await row.getByRole('button').click()
  const sheet = o.page.locator('.sheet')
  await sheet.waitFor()
  ok((await sheet.innerText()).includes('Capture bank messages?'), 'the explainer opened')
  await sheet.getByRole('button', { name: 'Not now' }).click()
  eq((await stored(o.page)).settings.smsCapture ?? false, false, 'Not now leaves it off')
  await o.close()
  o = await open({ capture: false, noQueue: true })
  await o.page.locator('.budget__review').getByRole('button').click()
  ok((await o.page.locator('.sheet').innerText()).includes('works only in the Android app'), 'web says Android only')
  await o.close()
})

T('IN22', 'Budget home row with capture ON: "To review / Nothing waiting" opens the empty To review; with items it is "N to review"; More in Budget has both new rows', async () => {
  let o = await open({ messages: [], b: budget({ expenses: [someEntry] }) })
  await settle(o.page)
  await o.page.locator('.budget__review').getByRole('button').click()
  await REVIEW(o.page).waitFor()
  await REVIEW(o.page).getByRole('button', { name: 'Back', exact: true }).click()
  await o.page.getByRole('button', { name: 'More in Budget' }).click()
  const more = o.page.locator('.sheet')
  const t = (await more.innerText()).replace(/\s+/g, ' ')
  for (const w of ['To review (bank messages)', 'Nothing waiting', 'Bank message settings']) ok(t.includes(w), `More in Budget lacks "${w}": ${t}`)
  await more.getByRole('button', { name: /To review \(bank messages\)/ }).click()
  await REVIEW(o.page).waitFor()
  await o.close()
  o = await open({ messages: [M(swiggy()), M(swiggy('120.00', 'ZOMATO'))], b: budget({ expenses: [someEntry] }) })
  await settle(o.page)
  eq((await o.page.locator('.budget__review').innerText()).replace(/\s+/g, ' ').trim(), '2 to review Bank payments waiting for your OK')
  await o.page.getByRole('button', { name: 'More in Budget' }).click()
  ok((await o.page.locator('.sheet').innerText()).includes('2 waiting'), 'More in Budget counts them')
  await o.close()
})

const bankHead = (page) => page.locator('.screen[aria-label="Settings"] h2#settings-bank')
const landedOnBank = async (page) => {
  const sc = page.locator('.screen[aria-label="Settings"]')
  await sc.waitFor()
  await page.waitForTimeout(300)
  eq(await page.evaluate(() => document.activeElement?.id), 'settings-bank', 'the Bank messages heading has focus')
  const box = await bankHead(page).boundingBox()
  const vh = page.viewportSize().height
  ok(box && box.y >= 0 && box.y + box.height <= vh, `heading is in view: ${JSON.stringify(box)}`)
  eq(await sc.locator('h2.sect__head').first().innerText(), 'Bank messages', 'it is the FIRST section')
}

T('IN23', 'jump to Settings > Bank messages from the To review header and from More in Budget: first section, scrolled into view, heading focused', async () => {
  const { page, errors, close } = await open({ messages: [], b: budget({ expenses: [someEntry] }) })
  await settle(page)
  await page.locator('.budget__review').getByRole('button').click()
  await REVIEW(page).waitFor()
  await REVIEW(page).getByRole('button', { name: 'Bank message settings' }).click()
  await landedOnBank(page)
  await page.locator('.screen[aria-label="Settings"]').getByRole('button', { name: 'Back', exact: true }).click()
  await REVIEW(page).waitFor()
  await REVIEW(page).getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: 'More in Budget' }).click()
  await page.locator('.sheet').getByRole('button', { name: /Bank message settings/ }).click()
  await landedOnBank(page)
  eq(errors, [], 'console errors')
  await close()
  // Opened the normal way (the gear on Calculate), nothing is focused or scrolled for it.
  const o = await open({ messages: [], startupTab: 'calculate' })
  await openSettings(o.page)
  await o.page.waitForTimeout(300)
  ok(await o.page.evaluate(() => document.activeElement?.id) !== 'settings-bank', 'a plain open does not steal focus')
  await o.close()
})

T('IN24', 'empty To review explains how it fills and shows the state: capture on + mode, not allowed by Android, off', async () => {
  let o = await open({ messages: [], mode: 'review' })
  await settle(o.page)
  await o.page.locator('.budget__review').getByRole('button').click()
  let t = (await REVIEW(o.page).innerText()).replace(/\s+/g, ' ')
  ok(t.includes('Bank messages are caught while Calc is closed and wait here when you open it. Nothing yet.'), 'plain how-it-fills: ' + t)
  ok(t.includes('Capture is on. When a payment arrives: Review first.'), 'state: ' + t)
  await o.close()
  o = await open({ messages: [], mode: 'auto' })
  await settle(o.page)
  await o.page.locator('.budget__review').getByRole('button').click()
  ok((await REVIEW(o.page).innerText()).includes('When a payment arrives: Auto-add the confident ones.'), 'auto mode named')
  await o.close()
  o = await open({ messages: [], permission: 'denied' })
  await settle(o.page)
  await o.page.locator('.budget__review').getByRole('button').click()
  ok((await REVIEW(o.page).innerText()).replace(/\s+/g, ' ').includes('Android is not allowing it'), 'no permission is said plainly')
  await o.close()
  o = await open({ capture: false, permission: 'prompt', messages: [], b: budget({ expenses: [someEntry] }) })
  await o.page.getByRole('button', { name: 'More in Budget' }).click()
  await o.page.locator('.sheet').getByRole('button', { name: /To review \(bank messages\)/ }).click()
  t = (await REVIEW(o.page).innerText()).replace(/\s+/g, ' ')
  ok(t.includes('Capture is off. Calc reads no messages.'), 'off: ' + t)
  await o.close()
})

// ------------------------------------------------------------------ runner
const only = process.argv.slice(2)
if (process.env.APP_URL) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  APP = { url: process.env.APP_URL, browser, async stop() { await browser.close() } }
} else APP = await startApp()
let failed = 0
for (const c of cases.filter((x) => only.length === 0 || only.some((p) => x.id.startsWith(p)))) {
  try { await c.fn(); console.log(`PASS ${c.id} ${c.title}`) } catch (e) { failed++; console.log(`FAIL ${c.id} ${c.title} :: ${(process.env.FULL ? e.message : String(e.message).split('\n')[0].slice(0, 500))}`) }
}
await APP.stop()
console.log(`\n${cases.length - failed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
