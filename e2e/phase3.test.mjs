// Phase 3 tool-screen checks at 360px, at normal size and 200% font: freshness line, example-values note, labels that follow
// the mode, the advance-tax block, quick-add chips, Reset with Undo, the date span, "Your tools".
// Run: node e2e/phase3.test.mjs   (screenshots go to /tmp/calc-p3). Exit code 1 on any FAIL.
import { mkdirSync } from 'node:fs'
import { startApp, openApp, tab, overflowing } from './lib.mjs'

mkdirSync('/tmp/calc-p3', { recursive: true })
const app = await startApp()
let fails = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` :: ${extra}`}`); if (!ok) fails++ }
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
const shot = (page, name) => page.screenshot({ path: `/tmp/calc-p3/${name}.png` })
const NOV3 = Date.UTC(2026, 10, 3, 6, 0, 0)
const APR2 = Date.UTC(2027, 3, 2, 6, 0, 0)

async function openTool(page, search, title) {
  await tab(page, 'Tools')
  await page.locator('.tools__search input').fill(search)
  await page.locator('.navrow .navrow__label', { hasText: title }).first().click()
  await page.waitForSelector('.tool')
  await settle(page)
}
const field = (page, label) => page.locator('.field-row', { has: page.locator('label', { hasText: label }) })
const types = async (page, label, text) => { await field(page, label).locator('input').fill(text); await settle(page) }
const checked = (page) => page.locator('.result__checked').allInnerTexts()
const noScroll = async (page, name) => { const o = await overflowing(page); check(`${name}: no sideways overflow`, o.length === 0, o.join(',')) }

try {
  for (const font of [100, 200]) {
    const tag = font === 100 ? '' : ' @200%'

    // Freshness line, before and after the boundary. PPF (small savings): until 1 Jan 2027.
    {
      const { page, errors, close } = await openApp(app, { theme: 'dark', font, now: NOV3 })
      await openTool(page, 'ppf', 'Public Provident Fund')
      check(`PPF: "Rates as of Nov 2026"${tag}`, (await checked(page)).some((t) => t.startsWith('Checked against') && t.endsWith('. Rates as of Nov 2026')), (await checked(page)).join('|'))
      await shot(page, `1-ppf${font}`)
      await noScroll(page, `PPF${tag}`)
      check(`PPF: no console errors${tag}`, errors.length === 0, errors.join('|'))
      await close()
      const late = await openApp(app, { theme: 'dark', font, now: APR2 })
      await openTool(late.page, 'ppf', 'Public Provident Fund')
      check(`PPF after the quarter: "may have changed"${tag}`, (await checked(late.page)).some((t) => /may have changed since 2 Nov 2026\. Check the official source\./.test(t)), (await checked(late.page)).join('|'))
      await late.close()
    }

    // Example values note (NPS): both hidden fields at their examples, then one changed.
    {
      const { page, close } = await openApp(app, { theme: 'dark', font, now: NOV3 })
      await openTool(page, 'nps', 'NPS pension')
      const note = () => page.locator('.result__checked', { hasText: 'Uses example values' }).allInnerTexts()
      check(`NPS: uses-example-values note names both fields${tag}`, (await note()).some((t) => /share put into annuity, yearly annuity rate/.test(t)), (await note()).join('|'))
      await page.locator('details.more summary').click()
      await types(page, 'Share put into annuity', '30')
      check(`NPS: note shrinks to the one field left${tag}`, (await note()).some((t) => /for yearly annuity rate\./.test(t) && !/annuity share|share put/.test(t)), (await note()).join('|'))
      await types(page, 'Yearly annuity rate', '5.5')
      check(`NPS: note gone once both are yours${tag}`, (await note()).length === 0, (await note()).join('|'))
      await close()
    }

    // Labels that follow the mode.
    {
      const { page, close } = await openApp(app, { theme: 'dark', font })
      await openTool(page, 'percentage', 'Percentage')
      const labels = async () => page.locator('.field-row .field-label').allInnerTexts()
      check(`Percentage: default mode labels${tag}`, (await labels()).includes('Percent') && (await labels()).includes('Of this number'), (await labels()).join('|'))
      await page.locator('button[role=radio]', { hasText: /^What %$/ }).click(); await settle(page)
      check(`Percentage: "What %" labels${tag}`, (await labels()).includes('Part') && (await labels()).includes('Whole'), (await labels()).join('|'))
      await page.locator('button[role=radio]', { hasText: /^% change$/ }).click(); await settle(page)
      check(`Percentage: "% change" labels${tag}`, (await labels()).includes('Old value') && (await labels()).includes('New value'), (await labels()).join('|'))
      await shot(page, `3-percentage${font}`)
      await noScroll(page, `Percentage${tag}`)
      await close()
    }

    // Date calculator: the amount is named by its unit; the difference shows a span.
    {
      const { page, close } = await openApp(app, { theme: 'dark', font })
      await openTool(page, 'date calc', 'Date calculator')
      const span = await page.locator('.span').innerText()
      check(`Date: span shows start, end and the count${tag}`, /1 Jan 2026/.test(span) && /2 Nov 2026/.test(span) && /\d+ days/.test(span), span)
      await shot(page, `7-date-span${font}`)
      await noScroll(page, `Date span${tag}`)
      await page.locator('button[role=radio]', { hasText: /^Add time$/ }).click(); await settle(page)
      check(`Date: add mode names the unit${tag}`, (await page.locator('.field-row .field-label').allInnerTexts()).includes('How many months'))
      await close()
    }

    // Advance tax: the four payments are one block, same ids.
    {
      const { page, close } = await openApp(app, { theme: 'dark', font, now: NOV3 })
      await openTool(page, 'advance tax', 'Advance tax')
      check(`Advance tax: one cluster of four boxes${tag}`, (await page.locator('fieldset.cluster #f-p1, fieldset.cluster #f-p2, fieldset.cluster #f-p3, fieldset.cluster #f-p4').count()) === 4)
      const boxes = await page.locator('fieldset.cluster input').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
      check(`Advance tax: two boxes a line at 100%, one per line at 200%${tag}`, font === 100 ? boxes[0] === boxes[1] && boxes[2] === boxes[3] && boxes[1] !== boxes[2] : new Set(boxes).size === 4, boxes.join(','))
      await shot(page, `4-advance-tax${font}`)
      await noScroll(page, `Advance tax${tag}`)
      await page.locator('#f-p1').fill('50000'); await settle(page)
      check(`Advance tax: typing in the block still gives a result${tag}`, (await page.locator('.result__row--main').count()) === 1)
      await close()
    }

    // Quick-add chips, Reset with Undo, Your tools.
    {
      const { page, errors, close } = await openApp(app, { theme: 'dark', font })
      await openTool(page, 'loan emi', 'Loan EMI')
      const chips = page.locator('#f-principal').locator('xpath=ancestor::div[contains(@class,"field-row")]').locator('.chip')
      check(`EMI: three chips under the loan amount${tag}`, (await chips.count()) === 3, String(await chips.count()))
      const h = await chips.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
      check(`EMI: chips are 44px high${tag}`, h.every((x) => x >= 44), h.join(','))
      await page.locator('#f-principal').focus()
      await chips.nth(2).click(); await settle(page)
      check(`EMI: +1L adds a lakh, Indian grouping kept${tag}`, (await page.locator('#f-principal').inputValue()) === '51,00,000', await page.locator('#f-principal').inputValue())
      check(`EMI: the box keeps focus after a chip${tag}`, await page.evaluate(() => document.activeElement?.id === 'f-principal'))
      await chips.nth(0).click(); await settle(page)
      check(`EMI: +1K adds a thousand${tag}`, (await page.locator('#f-principal').inputValue()) === '51,01,000', await page.locator('#f-principal').inputValue())
      await shot(page, `5-emi-chips${font}`)
      await noScroll(page, `EMI chips${tag}`)

      await page.getByRole('button', { name: 'Reset inputs' }).click(); await settle(page)
      check(`EMI: Reset puts the starting amount back${tag}`, (await page.locator('#f-principal').inputValue()) === '50,00,000', await page.locator('#f-principal').inputValue())
      check(`EMI: snackbar says so and offers Undo${tag}`, (await page.locator('.snack').innerText()).includes('Inputs reset') && (await page.locator('.snack .snack__link', { hasText: 'Undo' }).count()) === 1)
      await shot(page, `6-emi-reset${font}`)
      await page.locator('.snack .snack__link').click(); await settle(page)
      check(`EMI: Undo brings back what was typed${tag}`, (await page.locator('#f-principal').inputValue()) === '51,01,000', await page.locator('#f-principal').inputValue())

      // Your tools: open EMI twice in all, then it is listed; pin it and it stays first.
      await page.waitForTimeout(1700) // a use is counted after 1.5 s open
      await page.getByRole('button', { name: 'Back' }).click(); await settle(page)
      await page.locator('.tools__search input').fill('loan emi'); await page.locator('.navrow .navrow__label', { hasText: 'Loan EMI' }).first().click(); await page.waitForSelector('.tool'); await settle(page)
      await page.waitForTimeout(1700)
      await page.getByRole('button', { name: 'Back' }).click(); await settle(page)
      await page.locator('.tools__search input').fill('')
      await settle(page)
      check(`Tools: "Your tools" lists Loan EMI after two opens${tag}`, (await page.locator('h2.section-head', { hasText: 'Your tools' }).count()) === 1 && (await page.locator('.tools__list .navrow__label', { hasText: 'Loan EMI' }).count()) === 1)
      await shot(page, `8-your-tools${font}`)
      await noScroll(page, `Your tools${tag}`)
      check(`Tools: no console errors${tag}`, errors.length === 0, errors.join('|'))
      await close()
    }
  }

  // Pin from a calculator's header: listed first on Tools even with one open.
  {
    const { page, close } = await openApp(app, { theme: 'dark' })
    await openTool(page, 'gst', 'GST')
    await page.getByRole('button', { name: /^Pin GST/ }).click(); await settle(page)
    check('GST: pin button is pressed', (await page.getByRole('button', { name: /^Unpin GST/ }).getAttribute('aria-pressed')) === 'true')
    await page.getByRole('button', { name: 'Back' }).click(); await settle(page)
    await page.locator('.tools__search input').fill(''); await settle(page)
    const first = await page.locator('.tools__list .group .navrow').first().innerText()
    check('Tools: a pinned calculator is listed, marked pinned for a screen reader', /GST/.test(first) && /Pinned/.test(first), first)
    await close()
  }
} finally {
  await app.stop()
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED')
process.exit(fails ? 1 : 0)
