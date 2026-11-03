// Add from bank messages: statement CSV flow in a browser (SMS scan itself needs the Android app).
import { startApp, openApp, tab, overflowing, stored } from './lib.mjs'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'calc-stmt-'))
const csv = join(dir, 'stmt.csv')
writeFileSync(csv, 'Date,Narration,Withdrawal Amt.,Deposit Amt.\n02/11/2026,UPI/312345678901/SWIGGY/okhdfc,450.00,\n03/11/2026,SALARY,,50000.00\n04/11/2026,POS AMAZON,"1,299.00",\n')
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
console.log(`${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
