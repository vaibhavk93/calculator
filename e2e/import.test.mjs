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
    check('no console errors (clubs)', errors.length === 0, errors.join('|'))
    await close()
  } finally { await app2.stop() }
}
console.log(`${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
