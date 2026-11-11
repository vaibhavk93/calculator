// Add from bank messages: statement CSV flow in a browser (SMS scan itself needs the Android app).
import { startApp, openApp, tab, overflowing, stored } from './lib.mjs'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'calc-stmt-'))
const csv = join(dir, 'stmt.csv')
writeFileSync(csv, 'Date,Narration,Withdrawal Amt.,Deposit Amt.\n02/11/2026,UPI/312345678901/SWIGGY/okhdfc,450.00,\n03/11/2026,SALARY,,50000.00\n04/11/2026,POS AMAZON,"1,299.00",\n')
const csv2 = join(dir, 'club.csv')
writeFileSync(csv2, 'Date,Narration,Withdrawal Amt.,Deposit Amt.\n02/11/2026,UPI/111/AMAZON PAY INDIA/okhdfc,899.00,\n03/11/2026,UPI/112/AMAZON PAY INDIA/okhdfc,540.00,\n04/11/2026,UPI/113/AMAZON PAY INDIA/okhdfc,1200.00,\n05/11/2026,BANK PAYMENT,320.00,\n06/11/2026,BANK PAYMENT,150.00,\n07/11/2026,UPI/114/RAVI KUMAR/ravi@okaxis,100.00,\n08/11/2026,UPI/115/RAVI KUMAR/ravi@okaxis,200.00,\n')
const pdf = join(dir, 'stmt.pdf')
writeFileSync(pdf, '%PDF-1.4')

let pass = 0, fail = 0
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${ok ? '' : extra}`) }

const app = await startApp()
try {
  const { page, errors, close } = await openApp(app, { now: new Date(2026, 10, 5, 12).getTime() })
  await tab(page, 'Budget')
  await page.getByText('Add from bank messages').first().click()
  check('screen opens with Back', await page.getByRole('button', { name: 'Back' }).first().isVisible())
  await page.locator('input[type=file]').setInputFiles(pdf)
  check('PDF refused in plain words', await page.getByText('PDF statements are not supported yet').isVisible())
  await page.locator('input[type=file]').setInputFiles(csv)
  await page.getByText('Found').first().waitFor()
  check('two payments found, credit skipped', (await page.locator('.import__row').count()) === 2 && (await page.getByText('1 money-in message').count()) > 0)
  check('no sideways overflow', (await overflowing(page)).length === 0, JSON.stringify(await overflowing(page)))
  await page.locator('.import__row').first().getByRole('button', { name: 'Add' }).click()
  await page.waitForTimeout(300)
  const d = await stored(page)
  const live = d.budget.expenses.filter((e) => e.deletedAt === null)
  check('one expense saved, amount exact', live.length === 1 && ['1299', '450'].includes(live[0].amount.replace('.00','')), JSON.stringify(live))
  check('fingerprint remembered, no text stored', d.budget.smsSeen?.length === 1 && !JSON.stringify(d).includes('SWIGGY/okhdfc'))
  console.log('rows now', await page.locator('.import__row').count(), await page.locator('.import__row').allInnerTexts())
  check('row left the list', (await page.locator('.import__row').count()) === 1)
  await page.locator('.import__row').first().getByRole('button', { name: 'Skip' }).click()
  await page.waitForTimeout(900)
  check('skip remembered', (await stored(page)).budget.smsSeen.length === 2)
  await page.getByText('Reader log').first().click()
  check('reader log sheet opens with X', await page.getByRole('button', { name: /close/i }).first().isVisible())
  check('no console errors', errors.length === 0, errors.join('|'))
  await close()
} finally { await app.stop() }

// Found list in sections by category, repeat payees clubbed (docs: owner request 2026-11-11).
{
  const cat = (id, name) => ({ id, name, limit: null, parentId: null, deletedAt: null })
  const data = { schemaVersion: 3, settings: {}, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false }, budget: { overall: null, categories: [cat('c-shop', 'Shopping'), cat('c-food', 'Food')], instruments: [], expenses: [] } }
  const app2 = await startApp()
  try {
    const { page, errors, close } = await openApp(app2, { data, now: new Date(2026, 10, 9, 12).getTime() })
    await tab(page, 'Budget')
    await page.getByText('Add from bank messages').first().click()
    await page.locator('input[type=file]').setInputFiles(csv2)
    await page.locator('.import__cathead').first().waitFor()
    const heads = await page.locator('.import__cathead > span:first-child').allInnerTexts()
    check('Not sure first, then Shopping', heads[0] === 'Not sure' && heads[1] === 'Shopping', JSON.stringify(heads))
    check('Amazon Pay is one club row, 3 payments', (await page.locator('.import__club', { hasText: 'Amazon Pay India ×3' }).count()) === 1)
    check('two Bank payment names are NOT clubbed', (await page.locator('.import__row', { hasText: 'Bank Payment' }).count()) === 2)
    check('the person is clubbed but needs a category', (await page.locator('.import__club', { hasText: 'Ravi Kumar ×2' }).count()) === 1)
    const amz = page.locator('.import__club', { hasText: 'Amazon Pay India' })
    check('a club of 3 starts closed, a club of 2 starts open', (await amz.locator('button[aria-expanded]').first().getAttribute('aria-expanded')) === 'false' && (await page.locator('.import__club', { hasText: 'Ravi Kumar' }).locator('button[aria-expanded]').first().getAttribute('aria-expanded')) === 'true')
    const btns = await page.locator('.rv__acts .btn').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ t: e.innerText.trim(), h: Math.round(e.getBoundingClientRect().height) })))
    check('every action is a real button of 44px or more (Add, Skip, Add all, Skip all)', btns.length >= 8 && btns.every((b) => b.h >= 44) && ['Add', 'Skip', 'Add all 3', 'Skip all'].every((t) => btns.some((b) => b.t === t)), JSON.stringify(btns))
    check('no underlined text-link actions in the list', (await page.locator('.rv__section .link-btn').count()) === 0)
    await amz.getByRole('button', { name: /3 payments/ }).click()
    check('expanding shows each payment with its own amount and says guess', (await amz.locator('.import__row').count()) === 3 && (await amz.innerText()).includes('Shopping · guess') && (await amz.innerText()).includes('₹540'))
    const ravi = page.locator('.import__club', { hasText: 'Ravi Kumar' })
    await ravi.getByRole('button', { name: 'Add all 2' }).click()
    check('person club: Add all is off until a category is picked', await page.locator('.sheet').getByRole('button', { name: 'Add all 2', exact: true }).isDisabled())
    await page.locator('.sheet').getByRole('button', { name: /close/i }).first().click()
    await amz.getByRole('button', { name: 'Add all 3' }).click()
    const sh = page.locator('.sheet')
    check('a guess is shown filled in, and said to be a guess', (await sh.innerText()).includes('guess') && !(await sh.getByRole('button', { name: 'Add all 3', exact: true }).isDisabled()))
    await sh.getByRole('button', { name: 'Add all 3', exact: true }).click()
    await page.waitForTimeout(400)
    const live = (await stored(page)).budget.expenses.filter((e) => e.deletedAt === null)
    check('three separate entries, own amount and date, Shopping', live.length === 3 && live.every((e) => e.categoryId === 'c-shop') && new Set(live.map((e) => e.amount)).size === 3 && new Set(live.map((e) => e.date)).size === 3, JSON.stringify(live))
    check('the club left the list', (await page.locator('.import__club', { hasText: 'Amazon' }).count()) === 0)
    await ravi.getByRole('button', { name: 'Skip all' }).click()
    await page.waitForTimeout(900)
    const d = await stored(page)
    check('Skip all remembers each, adds nothing', d.budget.smsSeen.length === 5 && d.budget.expenses.filter((e) => e.deletedAt === null).length === 3)
    check('Copy masked examples is off, with a plain reason, when the scan has none', await page.getByRole('button', { name: 'Copy masked examples' }).isDisabled() && (await page.getByText('Nothing to share').count()) === 1)
    check('no console errors (clubs)', errors.length === 0, errors.join('|'))
    await close()
  } finally { await app2.stop() }
}

// The same list at 200% text on a 360x640 phone: nothing sideways, no clipped label, buttons 44px+.
{
  const app3 = await startApp()
  try {
    const { page, errors, close } = await openApp(app3, { now: new Date(2026, 10, 9, 12).getTime(), width: 360, height: 640, font: 200 })
    await tab(page, 'Budget')
    await page.getByText('Add from bank messages').first().click()
    await page.locator('input[type=file]').setInputFiles(csv2)
    await page.locator('.import__cathead').first().waitFor()
    for (const b of await page.locator('.import__club > button[aria-expanded="false"]').all()) await b.click()
    check('200%: no sideways overflow', (await overflowing(page)).length === 0, JSON.stringify(await overflowing(page)))
    const bs = await page.locator('.rv__acts .btn').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ t: e.innerText.trim(), h: Math.round(e.getBoundingClientRect().height), clipped: e.scrollWidth > e.clientWidth + 1 })))
    check('200%: buttons 44px+ and no clipped label', bs.length >= 8 && bs.every((b) => b.h >= 44 && !b.clipped), JSON.stringify(bs.filter((b) => b.h < 44 || b.clipped)))
    check('200%: no console errors', errors.length === 0, errors.join('|'))
    await close()
  } finally { await app3.stop() }
}
// Own money, merged messages, "is this your own account?" and the masked examples, on FAKE messages (the Scan test hook in src/lib/sms.ts).
{
  const day = new Date(2026, 10, 5, 12).getTime()
  const MSGS = [
    { id: 'm-a', address: 'VM-HDFCBK', date: day, body: 'Rs.500.00 debited from HDFC Bank A/c XX1234 on 05-11-26 to VPA zomato@icici (UPI Ref No 312345678901). Not you? Call 18002586161' },
    { id: 'm-b', address: 'AX-ICICIB', date: day, body: 'Paid Rs 500.00 to ZOMATO ONLINE ORDER via UPI' },
    { id: 'm-fd', address: 'AD-SBIINB', date: day, body: 'Dear Customer, your Term Deposit A/c XXXXXXX987654 has been closed prematurely on 05-11-26. Rs.52,340.00 (principal and interest) credited to your A/c XXXXX123456. -SBI' },
    { id: 'm-sw', address: 'VM-PNBSMS', date: day, body: 'Rs 20,000.00 debited from a/c XX1234 on 05-11-26 for Auto Sweep-out to your Fixed Deposit. -PNB' },
    { id: 'm-up', address: 'VM-HDFCBK', date: day, body: 'Rs.150.00 debited from a/c XX7261 on 05-11-26 to VPA rahul.s@okhdfcbank (UPI Ref No 412345678901). Not you? Call 18001' },
  ]
  const app4 = await startApp()
  try {
    const run = async (font) => {
      const { page, errors, context, close } = await openApp(app4, { now: new Date(2026, 10, 6, 12).getTime(), ...(font === 200 ? { width: 360, height: 640, font: 200 } : {}) })
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin }).catch(() => {})
      await page.evaluate((m) => localStorage.setItem('vkcalc.test.smsscan', JSON.stringify(m)), MSGS)
      await tab(page, 'Budget')
      await page.getByText('Add from bank messages').first().click()
      await page.getByRole('button', { name: /^Scan messages/ }).click()
      await page.locator('.rv__section').first().waitFor()
      const heads = await page.locator('.import__cathead > span:first-child').allInnerTexts()
      const text = () => page.locator('.screen').innerText().then((t) => t.replace(/\s+/g, ' '))
      check(`${font}%: "Your own money" comes right after "Not sure"`, heads.indexOf('Your own money') === heads.indexOf('Not sure') + 1 && heads.indexOf('Not sure') >= 0, JSON.stringify(heads))
      const own = page.locator('.rv__section', { hasText: 'Your own money' })
      const ot = (await own.innerText()).replace(/\s+/g, ' ')
      check(`${font}%: the FD closure is own money that came IN, with its reason, never a plain Add`, /\+₹52,340/.test(ot) && /deposit/i.test(ot) && (await own.getByRole('button', { name: 'Count as income' }).count()) === 1, ot)
      check(`${font}%: own money has Not a spend as its main button and is not clubbed or bulk-added`, (await own.getByRole('button', { name: /is not a spend/ }).count()) >= 2 && (await own.getByRole('button', { name: /Add all/ }).count()) === 0)
      check(`${font}%: the two messages for one payment are one row that says so`, (await text()).includes('2 messages merged'))
      check(`${font}%: no sideways overflow`, (await overflowing(page)).length === 0, JSON.stringify(await overflowing(page)))
      const bs = await page.locator('.rv__acts .btn').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ t: e.innerText.trim(), h: Math.round(e.getBoundingClientRect().height), clipped: e.scrollWidth > e.clientWidth + 1 })))
      check(`${font}%: every button 44px+ and not clipped`, bs.length >= 8 && bs.every((b) => b.h >= 44 && !b.clipped), JSON.stringify(bs.filter((b) => b.h < 44 || b.clipped)))
      if (font === 100) {
        // Not a spend: adds nothing, remembers the message (and any merged twin) so it never returns.
        await own.getByRole('button', { name: /52,340.*is not a spend/ }).click()
        await page.waitForTimeout(300)
        const d = await stored(page)
        check('Not a spend adds nothing and remembers the message', d.budget.expenses.filter((e) => e.deletedAt === null).length === 0 && d.budget.smsSeen?.length === 1 && !JSON.stringify(d).includes('52,340'), JSON.stringify(d.budget.smsSeen))
        // Is this your own account? One tap teaches it, the payment moves to Your own money, Undo puts it back.
        const rahul = page.locator('.rv__item', { hasText: 'Rahul' })
        check('a UPI person asks "Is Rahul S your own account?"', (await rahul.getByRole('button', { name: 'This is my own account' }).count()) === 1 && (await rahul.getByRole('button', { name: 'Someone else' }).count()) === 1, await rahul.innerText())
        await rahul.getByRole('button', { name: 'This is my own account' }).click()
        await page.waitForTimeout(300)
        check('own account: the payment moves under Your own money and says what was learned', (await own.locator('.rv__item', { hasText: 'Rahul' }).count()) === 1 && (await own.getByText('Marked as your own account').count()) === 1, await own.innerText())
        check('and the snackbar says so with an Undo', (await page.locator('.snack').innerText()).includes('Marked as your own account'))
        await page.locator('.snack').getByRole('button', { name: 'Undo' }).click()
        await page.waitForTimeout(300)
        check('Undo puts it back as an ordinary payment that asks again', (await own.locator('.rv__item', { hasText: 'Rahul' }).count()) === 0 && (await page.getByRole('button', { name: 'This is my own account' }).count()) === 1)
        await page.getByRole('button', { name: 'Someone else' }).click()
        await page.waitForTimeout(300)
        check('"Someone else" is learned and can be changed', (await page.locator('.rv__why', { hasText: 'Marked as someone else' }).count()) === 1 && (await page.getByRole('button', { name: 'This is my own account' }).count()) === 1)
        // Copy masked examples: the look-alike text, never the real digits or names.
        const copy = page.getByRole('button', { name: 'Copy masked examples' })
        check('Copy masked examples is on (own money and a merge were seen)', !(await copy.isDisabled()))
        await copy.click()
        await page.waitForTimeout(300)
        const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
        check('the copied text is the masked examples, with no real amount, account or name', clip.startsWith('Masked examples') && !/52,340|987654|rahul|zomato|312345678901/i.test(clip) && /\[ownMoney\]|\[merged/.test(clip), clip.slice(0, 300))
        check('and the screen said it was copied', (await page.locator('.snack').innerText()).includes('Masked examples copied'))
      }
      check(`${font}%: no console errors`, errors.length === 0, errors.join('|'))
      await close()
    }
    await run(100)
    await run(200)
  } finally { await app4.stop() }
}
console.log(`${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
