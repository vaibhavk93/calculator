// Phase 2 tool-screen checks at 360px: invalid-field marking, "Use in another tool", the next-step chip, World time with a
// chosen time, and the unequal split. Run: node e2e/phase2.test.mjs   (screenshots go to /tmp/calc-p2). Exit code 1 on any FAIL.
import { mkdirSync } from 'node:fs'
import { startApp, openApp, tab, overflowing, stored } from './lib.mjs'

mkdirSync('/tmp/calc-p2', { recursive: true })
const app = await startApp()
let fails = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` :: ${extra}`}`); if (!ok) fails++ }
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
const saved = async (page) => { await page.waitForTimeout(900); return stored(page) }
const shot = (page, name) => page.screenshot({ path: `/tmp/calc-p2/${name}.png` })

async function openTool(page, search, title) {
  await tab(page, 'Tools')
  await page.locator('.tools__search input').fill(search)
  await page.locator('.navrow .navrow__label', { hasText: title }).first().click()
  await page.waitForSelector('.tool')
  await settle(page)
}
const field = (page, label) => page.locator('.field-row', { has: page.locator('label', { hasText: label }) })
const types = async (page, label, text) => { const i = field(page, label).locator('input'); await i.fill(text); await settle(page) }

try {
  // 1. Invalid marking. The message says "Enter interest rate"; the box is labelled "Yearly interest rate".
  {
    const { page, errors, close } = await openApp(app, { theme: 'dark' })
    await openTool(page, 'loan emi', 'Loan EMI')
    await types(page, 'Yearly interest rate', '')
    const rate = page.locator('#f-rate')
    check('EMI: blank rate is aria-invalid', (await rate.getAttribute('aria-invalid')) === 'true')
    check('EMI: rate is described by the message', ((await rate.getAttribute('aria-describedby')) ?? '').includes('tool-error') && (await page.locator('#tool-error').count()) === 1)
    const border = await rate.evaluate((el) => getComputedStyle(el).borderBottomColor)
    const alert = await page.evaluate(() => { const p = document.createElement('i'); p.style.color = 'var(--alert)'; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c })
    check('EMI: rate has the alert-coloured underline', border === alert, `${border} vs ${alert}`)
    check('EMI: the other boxes are not marked', (await page.locator('.tool__form [aria-invalid="true"]').count()) === 1)
    await shot(page, '1-invalid-emi')
    await types(page, 'Yearly interest rate', '8.5')
    check('EMI: marking clears once fixed', (await page.locator('.tool__form [aria-invalid="true"]').count()) === 0)
    check('1: no console errors', errors.length === 0, errors.join('|'))
    await close()
  }

  // 2. Use in another tool, then 3. the chip.
  {
    const { page, errors, close } = await openApp(app, { theme: 'dark' })
    await openTool(page, 'loan emi', 'Loan EMI')
    await shot(page, '3-emi-chip')
    check('EMI: chip is offered', (await page.getByRole('button', { name: 'Remind me every month on the 5th', exact: true }).count()) === 1)
    const emi = (await page.locator('.result__row--main .result__value').innerText()).replace(/[^\d.]/g, '')
    // "Use in another tool" lives behind the tool page's own "More" button now (B16), not a direct icon.
    await page.locator('.keep__btn[aria-label="More"]').click()
    await page.locator('.sheet .navrow', { hasText: 'Use in another tool' }).click()
    await settle(page)
    await shot(page, '2-use-in-tools')
    check('Use in: sheet has a close and lists tools', (await page.locator('.sheet__close').count()) === 1 && (await page.locator('.sheet .pick__opt').count()) > 3)
    check('Use in: the tool you came from is not listed', (await page.locator('.sheet .pick__label', { hasText: /^Loan EMI$/ }).count()) === 0)
    await page.locator('.sheet .pick__opt', { hasText: 'Tip and split' }).click()
    await settle(page)
    await shot(page, '2-use-in-fields')
    await page.locator('.sheet .pick__opt', { hasText: 'Bill amount' }).click()
    await page.locator('.sheet__foot .btn').click()
    await page.waitForSelector('.tool')
    await settle(page)
    const bill = (await page.locator('#f-bill').inputValue()).replace(/[^\d.]/g, '')
    check('Use in: Tip and split opens with the EMI in Bill amount', bill !== '' && Math.abs(Number(bill) - Number(emi)) < 1, `${bill} vs ${emi}`)
    check('Use in: the other boxes are untouched', (await page.locator('#f-pct').inputValue()) === '10')
    check('Use in: it is Tip and split', (await page.locator('.screen__title').last().innerText()).includes('Tip and split'))
    await page.locator('.screen__head .icon-btn, .screen__header .icon-btn').first().click().catch(() => {})
    check('2: no console errors', errors.length === 0, errors.join('|'))
    await close()
  }
  {
    const { page, errors, close } = await openApp(app, { theme: 'light' })
    await openTool(page, 'loan emi', 'Loan EMI')
    await page.getByRole('button', { name: 'Remind me every month on the 5th', exact: true }).click()
    await settle(page)
    const s = await saved(page)
    check('chip: EMI reminder saved, monthly', s.reminders.length === 1 && s.reminders[0].repeat === 'monthly' && new Date(s.reminders[0].dueAt).getDate() === 5, JSON.stringify(s.reminders))
    check('chip: gone after use and remembered', (await page.getByRole('button', { name: 'Remind me every month on the 5th', exact: true }).count()) === 0 && s.settings.dismissedTips.includes('emi-monthly'))
    await openTool(page, 'advance tax', 'Advance tax').catch(async () => { await page.locator('.screen .icon-btn').first().click(); await openTool(page, 'advance tax', 'Advance tax') })
    check('chip: advance tax chip is offered', (await page.getByRole('button', { name: 'Add all four quarterly due dates', exact: true }).count()) === 1)
    await page.getByRole('button', { name: 'Dismiss: Add all four quarterly due dates' }).click()
    await settle(page)
    const s2 = await saved(page)
    check('chip: dismissing adds no reminders and is remembered', s2.reminders.length === 1 && s2.settings.dismissedTips.includes('advance-tax-pack'))
    check('chip: SIP has none', await (async () => { await page.locator('.screen .icon-btn').first().click(); await openTool(page, 'sip', 'SIP: monthly'); return (await page.locator('.suggest').count()) === 0 })())
    check('3: no console errors', errors.length === 0, errors.join('|'))
    await close()
  }

  // 4. World time, a chosen time.
  {
    const { page, errors, close } = await openApp(app, { theme: 'dark' })
    await openTool(page, 'world', 'World time')
    await page.getByRole('radio', { name: 'A time I choose' }).click()
    await page.locator('#f-day').fill('2026-12-10')
    await page.locator('#f-at').fill('15:00')
    await settle(page)
    await shot(page, '4-world-time')
    const row = page.locator('.rowcard', { hasText: 'New York' })
    check('World time: 3:00 pm in Mumbai is 04:30 in New York', (await row.innerText()).includes('04:30'), await row.innerText())
    check('World time: a native time input, not a select', (await page.locator('#f-at').getAttribute('type')) === 'time')
    check('4: no sideways overflow', (await overflowing(page)).length === 0, (await overflowing(page)).join(','))
    await page.locator('#f-at').fill('')
    await settle(page)
    check('World time: a cleared time is marked invalid', (await page.locator('#f-at').getAttribute('aria-invalid')) === 'true')
    check('4: no console errors', errors.length === 0, errors.join('|'))
    await close()
  }

  // 5. Unequal split and "Save my share to Budget".
  {
    const { page, errors, close } = await openApp(app, { theme: 'dark' })
    await openTool(page, 'tip', 'Tip and split')
    await page.locator('#f-mode').click()
    await page.locator('[role=option]', { hasText: 'By percent' }).click()
    await settle(page)
    check('Split: percent mode shows the people rows', (await page.locator('.rows__row').count()) === 2)
    await shot(page, '5-split-error')
    check('Split: 1 + 1 is not 100, says so and marks the rows', (await page.locator('#tool-error').innerText()).includes('Percentages add to 2') && (await page.locator('fieldset.rows[data-invalid]').count()) === 1, `${await page.locator('#tool-error').innerText()} / marked ${await page.locator('fieldset.rows[data-invalid]').count()}`)
    const cells = page.locator('.rows__row input[inputmode]')
    await cells.nth(0).fill('60'); await cells.nth(1).fill('40')
    await settle(page)
    check('Split: 60/40 of 2400 + 10% is 1,584 for you', (await page.locator('.result__row--main').innerText()).replace(/\D/g, '').includes('1584'), await page.locator('.result__row--main').innerText())
    await page.locator('#f-payer').fill('1')
    await settle(page)
    await shot(page, '5-split-settle')
    check('Split: who pays whom', (await page.locator('.kv').innerText()).includes('Person 2 pays You'), await page.locator('.kv').innerText())
    check('5: no sideways overflow', (await overflowing(page)).length === 0, (await overflowing(page)).join(','))
    await page.getByRole('button', { name: 'Save my share to Budget' }).click()
    await settle(page)
    await shot(page, '5-split-budget')
    check('Split: Add expense opens with your share', (await page.locator('.sheet input').first().inputValue()).replace(/[^\d.]/g, '') === '1584', await page.locator('.sheet input').first().inputValue())
    check('5: no console errors', errors.length === 0, errors.join('|'))
    await close()
  }
} finally {
  await app.stop()
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED')
process.exit(fails ? 1 : 0)
