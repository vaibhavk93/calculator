// Phase 7: "Show in the app" switches (Budget, Notes and reminders). Run: node e2e/modules.test.mjs
// Checks, in a real browser: the tab bar for each of the 4 combinations (360px, dark and light, 200% font, no overflow),
// every visible tab opens without a console error, the calculator result icons follow the switches, the Settings group
// turns things off and on, and the choice survives a reload. Screenshots go to e2e/shots/modules-*.png (look at them).
import { startApp, openApp, tab, keys, overflowing, stored } from './lib.mjs'
import { mkdirSync } from 'node:fs'

mkdirSync(new URL('./shots/', import.meta.url).pathname, { recursive: true })
const shot = (page, name) => page.screenshot({ path: new URL(`./shots/modules-${name}.png`, import.meta.url).pathname })
let failed = 0
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) failed++ }

const now = Date.now()
const day = new Date().toISOString().slice(0, 10)
const data = (modules, extra = {}) => ({
  schemaVersion: 3,
  settings: { theme: 'dark', ...(modules ? { modules } : {}), ...extra },
  history: [],
  cards: [{ id: 'c1', title: 'Home loan EMI', kind: 'tool', toolId: 'emi', inputs: { principal: '5000000', rate: '8.5', years: '20' }, summary: 'EMI 43,391', amount: '43391', amountFmt: 'money', lines: [], note: '', tags: [], pinned: false, createdAt: now, updatedAt: now, deletedAt: null }],
  reminders: [{ id: 'r1', cardId: 'c1', dueAt: now + 3 * 86400000, repeat: 'monthly', anchorDay: new Date(now + 3 * 86400000).getDate(), leadDays: 3, done: false, history: [] }],
  memory: null,
  input: { expr: '', fresh: false },
  budget: { overall: '30000', categories: [{ id: 'k1', name: 'Food', limit: '5000', parentId: null, deletedAt: null }], instruments: [], expenses: [{ id: 'e1', date: day, amount: '250.50', categoryId: 'k1', mode: 'upi', instrumentId: null, note: 'tea', deletedAt: null }] },
})
const COMBOS = [
  ['on-on', { budget: true, notes: true }, ['Calculate', 'Tools', 'Notes', 'Due', 'Budget']],
  ['budget-off', { budget: false, notes: true }, ['Calculate', 'Tools', 'Notes', 'Due']],
  ['notes-off', { budget: true, notes: false }, ['Calculate', 'Tools', 'Budget']],
  ['both-off', { budget: false, notes: false }, ['Calculate', 'Tools']],
]
const labels = (page) => page.locator('.tabbar .tab span').allTextContents()
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const icons = (page) => page.locator('.result-actions__btn').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))

const app = await startApp()
try {
  for (const [name, modules, expected] of COMBOS) {
    for (const [theme, font] of [['dark', 100], ['light', 100], ['dark', 200]]) {
      const o = await openApp(app, { data: data(modules, { theme }), font })
      const { page, errors } = o
      const got = await labels(page)
      check(eq(got, expected), `${name} ${theme} ${font}%: tab bar is ${got.join(', ')}`)
      check((await overflowing(page)).length === 0, `${name} ${theme} ${font}%: nothing overflows sideways`)
      const bar = await page.locator('.tabbar').boundingBox()
      check(bar.width <= 361, `${name} ${theme} ${font}%: bar width ${Math.round(bar.width)}`)
      if (theme === 'dark' && font === 100) {
        for (const t of expected) { await tab(page, t); await page.waitForTimeout(150) }
        check(errors.length === 0, `${name}: every visible tab opened with no console error ${errors.join(' | ')}`)
        await tab(page, 'Calculate')
        await keys(page, '2', 'Add', '3', 'Equals')
        await page.waitForTimeout(200)
        const ic = await icons(page)
        const want = [...(modules.notes ? ['Add to a list', 'Remind me'] : []), ...(modules.budget ? ['Add expense'] : [])]
        check(eq(ic, want), `${name}: calculator result icons are [${ic.join(', ')}]`)
        await shot(page, name)
      } else if (name === 'both-off' || name === 'on-on') await shot(page, `${name}-${theme}-${font}`)
      await o.close()
    }
  }

  // Settings group: switch off, look, switch back on, reload.
  const o = await openApp(app, { data: data(null) })
  const { page } = o
  await page.click('[aria-label=Settings]')
  await page.waitForTimeout(200)
  check((await page.locator('section[aria-label="Show in the app"] [role=switch]').count()) === 2, 'Settings: group "Show in the app" has two switches')
  await page.locator('section[aria-label="Show in the app"]').scrollIntoViewIfNeeded()
  await shot(page, 'settings')
  const hint = await page.locator('section[aria-label="Show in the app"] .row__hint').allTextContents()
  console.log('hints:', hint.join(' || '))
  check(/1 reminder is set and will still ring/.test(hint[1] ?? ''), 'Settings: notes hint counts the reminder')
  await page.click('[role=switch][aria-label="Budget"]')
  await page.click('[role=switch][aria-label="Notes and reminders"]')
  await page.waitForTimeout(200)
  check(eq(await labels(page), ['Calculate', 'Tools']), 'Settings: both off hides the tabs behind the screen')
  const s1 = await stored(page)
  await page.waitForTimeout(600)
  const st = await stored(page)
  check(st.settings.modules?.budget === false && st.settings.modules?.notes === false, 'storage holds the choice')
  check(st.cards.length === 1 && st.reminders.length === 1 && st.budget.expenses.length === 1, 'cards, reminders and expenses are still in storage')
  // Opens-on list has no hidden tabs.
  await page.click('button.pick[aria-label^="Opens on"]')
  await page.waitForTimeout(200)
  const opts = await page.locator('[role=dialog] [role=option], [role=listbox] [role=option]').allTextContents()
  check(!opts.some((t) => /^(Notes|Due|Budget)/.test(t.trim())), `Opens-on list hides Notes, Due and Budget`)
  await shot(page, 'opens-on')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.reload()
  await page.waitForSelector('.app')
  check(eq(await labels(page), ['Calculate', 'Tools']), 'reload keeps both off')
  await page.click('[aria-label=Settings]')
  await page.click('[role=switch][aria-label="Budget"]')
  await page.click('[role=switch][aria-label="Notes and reminders"]')
  await page.waitForTimeout(200)
  await page.click('[aria-label=Back]')
  check(eq(await labels(page), ['Calculate', 'Tools', 'Notes', 'Due', 'Budget']), 'switching both back on restores all five tabs')
  await tab(page, 'Notes'); await page.waitForTimeout(200)
  check((await page.locator('body').innerText()).includes('Home loan EMI'), 'Notes still shows the saved card')
  await tab(page, 'Budget'); await page.waitForTimeout(200)
  check((await page.locator('body').innerText()).includes('250'), 'Budget still shows the expense')
  check(o.errors.length === 0, `no console errors in the Settings pass ${o.errors.join(' | ')}`)
  void s1
  await o.close()
} finally {
  await app.stop()
}
console.log(failed ? `${failed} FAILED` : 'ALL PASSED')
process.exit(failed ? 1 : 0)
