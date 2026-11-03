// Budget > Spending summary > Paid with: modes expand to what paid; See entries filters the list.
import { startApp, openApp, tab, overflowing } from './lib.mjs'
let pass = 0, fail = 0
const check = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${ok ? '' : x}`) }
const now = new Date(2026, 10, 15, 12).getTime()
const inst = (o) => ({ rewardNote: '', deletedAt: null, network: null, bank: 'HDFC Bank', last4: '1234', ...o })
const data = {
  schemaVersion: 3, settings: {}, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false },
  budget: {
    overall: null, categories: [{ id: 'c1', name: 'Food', limit: null, parentId: null, deletedAt: null }],
    instruments: [inst({ id: 'b1', name: 'HDFC Savings', kind: 'bank' }), inst({ id: 'cc1', name: 'Regalia', kind: 'credit', network: 'visa', last4: '4321' })],
    expenses: [
      { id: 'e1', date: '2026-11-02', amount: '500', categoryId: 'c1', mode: 'upi', instrumentId: null, note: 'a', deletedAt: null },
      { id: 'e2', date: '2026-11-03', amount: '200', categoryId: 'c1', mode: 'upi', instrumentId: 'b1', note: 'b', deletedAt: null },
      { id: 'e3', date: '2026-11-04', amount: '1000', categoryId: 'c1', mode: 'credit', instrumentId: 'cc1', note: 'c', deletedAt: null },
      { id: 'e4', date: '2026-11-05', amount: '40', categoryId: 'c1', mode: 'cash', instrumentId: null, note: 'd', deletedAt: null },
    ],
  },
}
const app = await startApp()
try {
  const { page, errors, close } = await openApp(app, { data, now })
  await tab(page, 'Budget')
  await page.getByText('Spending summary').first().click()
  const card = page.locator('section[aria-label="Paid with"]')
  await card.waitFor()
  check('modes listed by spend', (await card.innerText()).indexOf('Credit card') < (await card.innerText()).indexOf('UPI'))
  await card.getByRole('button', { name: /^UPI/ }).click()
  const t = await card.innerText()
  check('UPI shows its sources', t.includes('Bank account (default)') && t.includes('HDFC Savings'), t)
  check('detail line shows the kind', t.includes('Bank account'))
  check('no overflow', (await overflowing(page)).length === 0, JSON.stringify(await overflowing(page)))
  await card.getByRole('button', { name: /See the 1 entry paid with HDFC Savings/ }).click()
  await page.waitForTimeout(300)
  const body = await page.locator('.screen').last().innerText()
  check('entries list is filtered to that account', body.includes('₹200') && !body.includes('₹1,000'), body.slice(0, 300))
  check('no console errors', errors.length === 0, errors.join('|'))
  await close()
} finally { await app.stop() }
console.log(`${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0)
