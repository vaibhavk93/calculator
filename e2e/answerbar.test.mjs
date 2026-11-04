// Regression test for the floating answer bar on a calculator page (the "Yearly revenue (ARR)" bar).
// Run:  node e2e/answerbar.test.mjs
// One line per case:  PASS|FAIL <id> <title> :: <actual if fail>.  Exit code 1 if any FAIL.
//
// Every case here is a bug that was really on screen on 2026-11-04, found by measuring the live page
// rather than by reading the code. They are the kind of defect unit tests cannot see:
//   AB-1  the bar covered the whole Copy / Share / Add to a list / Remind me row
//   AB-2  the arrow pointed down while the answer was above
//   AB-3  one IntersectionObserver threshold made a 3px scroll flip the bar on and off
//   AB-4  the label/value/arrow wrapped onto three lines
import { startApp, openApp, tab } from './lib.mjs'

let pass = 0
let fail = 0
const say = (ok, id, title, actual = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${title}${ok ? '' : ` :: ${actual}`}`)
  ok ? pass++ : fail++
}

/** Opens the Recurring revenue forecast calculator, which has a `main: true` row and a long page. */
async function openArr(page) {
  await tab(page, 'Tools')
  await page.locator('input[type=search]').fill('Recurring revenue')
  await page.getByText('Recurring revenue forecast').first().click()
  await page.waitForSelector('.result__row--main')
}

const geom = (page) =>
  page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const r = (e) => (e ? e.getBoundingClientRect() : null)
    const bar = r(q('.answer'))
    const keep = r(q('.keep'))
    const path = q('.answer svg path')?.getAttribute('d') ?? null
    return {
      barShown: !!q('.answer') && !q('.answer').classList.contains('answer--idle'),
      barHeight: bar?.height ?? null,
      // 'M6 15l6-6 6 6' is the up chevron, 'M6 9.5l6 6 6-6' the down one (components/Icon.tsx).
      arrow: path === 'M6 15l6-6 6 6' ? 'up' : path === 'M6 9.5l6 6 6-6' ? 'down' : null,
      overlapsKeep: bar && keep && !q('.answer').classList.contains('answer--idle') ? !(keep.bottom <= bar.top || keep.top >= bar.bottom) : null,
      mainAbove: (r(q('.result__row--main'))?.top ?? 0) < (r(q('.screen__body'))?.top ?? 0),
      mainValueSize: parseFloat(getComputedStyle(q('.result__row--main .result__value')).fontSize),
      otherValueSize: parseFloat(getComputedStyle(q('.result__row:not(.result__row--main) .result__value')).fontSize),
    }
  })

const scrollTo = async (page, top) => {
  await page.evaluate((t) => { document.querySelector('.screen__body').scrollTop = t }, top)
  // The bar is driven by IntersectionObserver, which only settles on a rendered frame.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await page.waitForTimeout(120)
}

const bottom = (page) => page.evaluate(() => { const b = document.querySelector('.screen__body'); b.scrollTop = b.scrollHeight })

async function run() {
  const app = await startApp()
  try {
    // ---- At the bottom of the page: the bar is up, and it must not sit on the Keep and share row ----
    {
      const { page, errors, close } = await openApp(app)
      await openArr(page)
      await bottom(page)
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      await page.waitForTimeout(200)
      const g = await geom(page)

      say(g.barShown === true, 'AB-0', 'the bar appears once the answer is scrolled away', `barShown=${g.barShown}`)
      say(g.overlapsKeep === false, 'AB-1', 'the bar never covers the Copy / Share row', `overlapsKeep=${g.overlapsKeep}`)
      say(g.arrow === 'up' && g.mainAbove, 'AB-2', 'the arrow points at where the answer actually is', `arrow=${g.arrow} mainAbove=${g.mainAbove}`)
      say(g.barHeight !== null && g.barHeight < 76, 'AB-4', 'the bar stays two lines, the arrow never wraps', `height=${g.barHeight}`)
      say(g.mainValueSize > g.otherValueSize, 'AB-5', 'the headline answer is bigger than the other rows', `main=${g.mainValueSize} other=${g.otherValueSize}`)
      say(errors.length === 0, 'AB-6', 'no console or page errors', errors.join(' | '))
      await close()
    }

    // ---- Hysteresis: find where it turns on, then scroll BACK a little. It must stay on. ----
    {
      const { page, close } = await openApp(app)
      await openArr(page)

      // Sweep down in 8px steps to find the point where the bar turns on.
      let showAt = null
      const max = await page.evaluate(() => { const b = document.querySelector('.screen__body'); return b.scrollHeight - b.clientHeight })
      for (let t = 0; t <= max && showAt === null; t += 8) {
        await scrollTo(page, t)
        if (await page.evaluate(() => { const a = document.querySelector('.answer'); return !!a && !a.classList.contains('answer--idle') })) showAt = t
      }

      if (showAt === null) {
        say(false, 'AB-3', 'the bar does not flip on and off around one point', 'the bar never appeared during the sweep')
      } else {
        // Step back up in 4px steps and record where it turns off again.
        let hideAt = null
        for (let t = showAt; t >= 0 && hideAt === null; t -= 4) {
          await scrollTo(page, t)
          if (await page.evaluate(() => { const a = document.querySelector('.answer'); return !a || a.classList.contains('answer--idle') })) hideAt = t
        }
        const band = hideAt === null ? showAt : showAt - hideAt
        // Before the fix both points were the same pixel, so the band was 0 and a 3px scroll strobed it.
        // The two thresholds (0.05 and 0.6 of a ~69px row) should leave roughly 35-40px between them.
        say(band >= 20, 'AB-3', 'turning on and turning off happen at clearly different places', `showAt=${showAt} hideAt=${hideAt} band=${band}px, want >= 20`)
      }
      await close()
    }
  } finally {
    await app.stop()
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

run().catch((e) => { console.error(e); process.exit(1) })
