// Merchant rules (D5) in a browser: Rules screen, add/delete/undo, statement import with a rule, Remember this merchant, reload, 360px dark/light, 200% font.
// Run: node e2e/rules.test.mjs   Env: SHOTS=/some/dir to save screenshots.
import { startApp, openApp, tab, overflowing, stored } from './lib.mjs'
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SHOTS = process.env.SHOTS || ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const dir = mkdtempSync(join(tmpdir(), 'calc-rules-'))
const csv = join(dir, 'stmt.csv')
writeFileSync(csv, 'Date,Narration,Withdrawal Amt.,Deposit Amt.\n02/11/2026,UPI/312345678901/SWIGGY/okhdfc,450.00,\n03/11/2026,UPI/312345678902/ZOMATO/okhdfc,300.00,\n04/11/2026,POS AMAZON,"1,299.00",\n')

let pass = 0, fail = 0
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${ok ? '' : extra}`) }
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) }) }

const cat = (id, name) => ({ id, name, limit: null, parentId: null, deletedAt: null })
const seed = (rules, settings = {}) => ({
  schemaVersion: 3, settings: { startupTab: 'budget', ...settings }, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false },
  budget: { overall: null, categories: [cat('c-food', 'Food'), cat('c-gro', 'Groceries'), cat('c-shop', 'Shopping')], instruments: [], expenses: [], ...(rules ? { rules } : {}) },
})
const NOW = new Date(2026, 10, 5, 12).getTime()

const openRules = async (page) => {
  await tab(page, 'Budget')
  await page.getByText('Categories and cards').first().click()
  await page.locator('.navrow', { hasText: 'Rules' }).first().click()
  await page.getByRole('dialog', { name: 'Merchant rules' }).waitFor()
}

const app = await startApp()
try {
  // 1. empty list
  {
    const { page, errors, close } = await openApp(app, { data: seed(null), now: NOW })
    await openRules(page)
    check('empty list says so', await page.getByText('No rules yet').isVisible())
    check('empty: no overflow', (await overflowing(page)).length === 0, JSON.stringify(await overflowing(page)))
    await shot(page, 'rules-empty')
    // validation in plain words
    await page.locator('#rule-text').fill('ab')
    await page.getByRole('button', { name: 'Add rule' }).click()
    check('short text refused in words', await page.getByText('at least 3 letters').isVisible())
    check('missing category refused in words', await page.getByText('Pick a category from the list').first().isVisible())
    await shot(page, 'rules-errors')
    // add one
    await page.locator('#rule-text').fill('swiggy')
    await page.locator('#rule-cat').click()
    await page.getByRole('option', { name: 'Groceries' }).or(page.getByText('Groceries', { exact: true })).last().click()
    await page.getByRole('button', { name: 'Add rule' }).click()
    await page.waitForTimeout(300)
    const d = await stored(page)
    check('rule stored', d.budget.rules?.length === 1 && d.budget.rules[0].match === 'swiggy' && d.budget.rules[0].categoryId === 'c-gro', JSON.stringify(d.budget.rules))
    // delete + undo
    await page.getByRole('button', { name: 'Delete rule swiggy' }).click()
    await page.waitForTimeout(900)
    check('deleted', (await stored(page)).budget.rules === undefined || (await stored(page)).budget.rules.length === 0)
    await page.getByRole('button', { name: 'Undo' }).click()
    await page.waitForTimeout(900)
    check('undo restores it', (await stored(page)).budget.rules?.length === 1)
    check('no console errors', errors.length === 0, errors.join(' | '))
    await close()
  }
  // 2. three rules + a removed category, layouts
  const three = [
    { id: 'r3', match: 'amazon', categoryId: 'c-shop' },
    { id: 'r2', match: 'swiggy', categoryId: 'c-gro' },
    { id: 'r1', match: 'zomato', categoryId: 'c-gone' },
  ]
  for (const [theme, font] of [['dark', 100], ['light', 100], ['dark', 200], ['light', 200]]) {
    const data = seed(three, { theme })
    data.budget.categories.push({ ...cat('c-gone', 'Dining'), deletedAt: 5 })
    const { page, errors, close } = await openApp(app, { data, now: NOW, font, theme })
    await openRules(page)
    if (theme === 'dark' && font === 100) check('flagged "Category removed"', await page.getByText('Category removed').isVisible())
    check(`3 rules ${theme} ${font}%: no overflow`, (await overflowing(page)).length === 0, JSON.stringify(await overflowing(page)))
    await shot(page, `rules-3-${theme}-${font}`)
    check(`3 rules ${theme} ${font}%: no console errors`, errors.length === 0, errors.join(' | '))
    await close()
  }
  // 3. statement import: rule changes the category and shows why; Remember this merchant
  {
    const data = seed([{ id: 'r1', match: 'swiggy', categoryId: 'c-gro' }])
    const { page, errors, close } = await openApp(app, { data, now: NOW })
    await tab(page, 'Budget')
    await page.getByText('Add from bank messages').first().click()
    await page.locator('input[type=file]').setInputFiles(csv)
    await page.getByText('Found').first().waitFor()
    const rows = await page.locator('.import__row').allInnerTexts()
    const sw = rows.find((r) => /Swiggy/i.test(r)) || ''
    const zo = rows.find((r) => /Zomato/i.test(r)) || ''
    check('Swiggy row says Groceries (rule: swiggy)', sw.includes('Groceries (rule: swiggy)'), sw)
    check('Zomato row has built-in Food, no rule reason', zo.includes('Food') && !zo.includes('rule:'), zo)
    await shot(page, 'import-rule-reason')
    // change Amazon (uncategorised or Shopping guess) and remember it
    await page.locator('.import__row', { hasText: 'Amazon' }).locator('button.tap-row').click()
    await page.locator('#exp-cat').getByRole('button', { name: 'Groceries' }).click()
    await shot(page, 'remember-toggle')
    check('Remember toggle appears after changing the category', await page.getByText('Remember this merchant').isVisible())
    await page.getByRole('switch', { name: /Remember/ }).click()
    await page.getByRole('button', { name: 'Add expense', exact: true }).last().click()
    await page.waitForTimeout(1000)
    const d = await stored(page)
    check('rule made from the merchant word only', d.budget.rules?.[0]?.match === 'Amazon' && d.budget.rules[0].categoryId === 'c-gro' && Object.keys(d.budget.rules[0]).sort().join() === 'categoryId,id,match', JSON.stringify(d.budget.rules))
    check('2 rules now', d.budget.rules.length === 2)
    // reload keeps rules
    await page.reload()
    await page.waitForSelector('.app')
    check('reload keeps rules', (await stored(page)).budget.rules.length === 2)
    check('import: no console errors', errors.length === 0, errors.join(' | '))
    await close()
  }
} finally {
  await app.stop()
}
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
