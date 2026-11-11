// The layout contract: every main screen, at 3 widths and 2 font scales, with deliberately long seeded
// content (long category names, long notes, many entries). Written 2026-11-04 after a manual check at
// 375x812 declared the answer-bar overlap fixed when it was not -- a geometry assertion at a second size
// caught it immediately. This suite is the general form of that lesson: assert RELATIONSHIPS, not
// appearances. See docs/THE-PLAN.md section 6.
//
// What it checks on every screen, every size:
//   LC-OVERFLOW   nothing causes the page to scroll sideways
//   LC-OVERLAP    no two distinct interactive controls occupy the same point
//   LC-TARGET     every interactive control is at least 44px in one direction (DESIGN-SYSTEM.md section 9)
//   LC-CLIP       no text node's own box is wider than its scrollable ancestor (a true clip, not a
//                 legitimate wrap)
//   LC-NAME       every button/link has an accessible name (text or aria-label)
//
// Run:  node e2e/layout-contract.test.mjs            all screens, all sizes
//       node e2e/layout-contract.test.mjs budget      only screens whose id contains "budget"
import { startApp, openApp, tab } from './lib.mjs'

let pass = 0
let fail = 0
const results = []
const say = (ok, id, title, actual = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${id} ${title}${ok ? '' : ` :: ${actual}`}`)
  ok ? pass++ : fail++
}

const SIZES = [
  { width: 320, height: 640, font: 100, label: '320x640@100%' }, // a small Android phone
  { width: 360, height: 780, font: 100, label: '360x780@100%' }, // the common baseline this repo tests at
  { width: 412, height: 915, font: 100, label: '412x915@100%' }, // a large Android phone
  { width: 360, height: 780, font: 200, label: '360x780@200%' }, // accessibility-large text, the size that found the most bugs historically
]

// ---- Seeded data with deliberately long content, so a real layout break has something to break on ----
let seq = 0
const nid = () => 'x' + ++seq
const LONG = 'A genuinely long line of text that a real person might actually type into a note, a category name, or an expense, long enough to wrap more than once on a narrow phone'
const cat = (id, name, o = {}) => ({ id, name, limit: null, parentId: null, deletedAt: null, ...o })
const inst = (id, name, kind, o = {}) => ({ id, name, kind, network: null, bank: '', last4: '', rewardNote: '', deletedAt: null, ...o })
const exp = (date, amount, o = {}) => ({ id: nid(), date, amount: String(amount), categoryId: null, mode: null, instrumentId: null, note: '', deletedAt: null, ...o })
const cardBase = (o) => ({ title: 'Item', kind: 'tool', toolId: null, inputs: null, summary: '', amount: null, lines: [], note: '', tags: [], pinned: false, createdAt: 1, updatedAt: 1, deletedAt: null, ...o })

const CATS = [
  cat('c1', 'Food & groceries'),
  cat('c2', LONG.slice(0, 60)), // a long category name, which labels every expense row that uses it
  cat('c3', 'Travel'),
  cat('c4', 'Rent'),
]
const INSTS = [
  inst('i1', 'HDFC Salary Account', 'bank', { bank: 'HDFC Bank', last4: '1234' }),
  inst('i2', 'A card with an unusually long holder-chosen nickname', 'credit', { network: 'visa', bank: 'Axis Bank', last4: '4321', statementDay: 5, dueDay: 25, creditLimit: '150000', annualFee: '500' }),
]
const EXPENSES = Array.from({ length: 40 }, (_, i) =>
  exp(`2026-11-${String((i % 28) + 1).padStart(2, '0')}`, (100 + i * 37.5).toFixed(2), {
    categoryId: CATS[i % CATS.length].id,
    instrumentId: i % 3 === 0 ? INSTS[0].id : null,
    note: i % 5 === 0 ? LONG : '',
  }),
)
const CARDS = [
  cardBase({ id: 'n1', title: LONG, kind: 'tape', summary: '12 lines', amount: '45231.50', lines: Array.from({ length: 6 }, (_, i) => ({ id: 'l' + i, label: `Line item number ${i} with a reasonably long description`, value: String(100 * (i + 1)) })) }),
  cardBase({ id: 'n2', title: 'A short list', kind: 'tape', summary: '2 lines', amount: '300', tags: ['Rent', 'Reimbursable', 'A rather long custom tag someone actually typed'] }),
  ...Array.from({ length: 10 }, (_, i) => cardBase({ id: 'n' + (i + 3), title: `Saved item ${i}`, kind: 'tool', toolId: 'emi', summary: `Monthly EMI: ₹${(12345 + i).toLocaleString('en-IN')}.00`, amount: String(12345 + i), amountFmt: 'money', updatedAt: 1000 - i })),
]
const TASKS = Array.from({ length: 8 }, (_, i) => cardBase({ id: 't' + i, title: i === 0 ? LONG : `Task ${i}`, kind: 'task', summary: i % 2 === 0 ? 'Due today' : 'No date' }))
const REMINDERS = Array.from({ length: 6 }, (_, i) => ({ id: 'r' + i, cardId: `n${i + 3}`, dueAt: Date.now() + i * 86_400_000, repeat: 'none', leadDays: [3], done: false }))

const SEED = {
  schemaVersion: 3,
  settings: { startupTab: 'calculate' },
  history: Array.from({ length: 5 }, (_, i) => ({ id: 'h' + i, expression: `${100 + i}+${200 + i}`, result: String(300 + 2 * i), at: Date.now() - i * 1000, locked: false, memo: i === 0 ? LONG : null })),
  cards: [...CARDS, ...TASKS],
  reminders: REMINDERS,
  memory: null,
  input: { expr: '', fresh: false },
  budget: { overall: '50000', categories: CATS, instruments: INSTS, expenses: EXPENSES },
}

// ---- Screens to check: each opens the app then does whatever navigation is needed -------------------
const SCREENS = [
  ['calculate', async () => {}],
  ['tools', async (p) => tab(p, 'Tools')],
  ['notes', async (p) => tab(p, 'Notes')],
  ['todo', async (p) => { await tab(p, 'Notes'); await p.getByRole('radio', { name: /To-do/ }).click() }],
  ['due', async (p) => tab(p, 'Due')],
  ['budget', async (p) => tab(p, 'Budget')],
  // The Day view: a day heading in Recent entries opens it (the seed has long notes, long names and a long card name).
  ['budget-day', async (p) => { await tab(p, 'Budget'); await p.locator('.budget__day').first().click(); await p.locator('.screen[aria-label^="Day:"]').waitFor() }],
]

const geomCheck = (p) =>
  p.evaluate(() => {
    const body = document.body
    const out = { overflowX: null, overlaps: [], tiny: [], clipped: [], unnamed: [] }

    // LC-OVERFLOW: the page itself must not be wider than the viewport.
    out.overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      ? `scrollWidth=${document.documentElement.scrollWidth} > clientWidth=${document.documentElement.clientWidth}`
      : null

    // Gather every visible, enabled interactive control.
    const controls = [...body.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')].filter((el) => {
      if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return false
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') return false
      // A page left mounted under a full screen (Budget home under the Day view) is covered, so nobody can tap it: not part of what this screen shows.
      if (!el.closest('.screen')) {
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        if (top && !el.contains(top) && !top.contains(el) && top.closest('.screen')) return false
      }
      return true
    })

    // LC-TARGET: at least 44px in ONE direction -- the project's own documented rule
    // (docs/DESIGN-SYSTEM.md section 9: "At least 44px in one direction. A function key may be 36px
    // high if it is at least 62px wide.") is deliberately not "44px in both": a wide, short chip or a
    // tall, narrow segmented tab are both fine as long as the OTHER dimension compensates. An earlier
    // version of this check required both dimensions and flagged 8 controls that were working exactly
    // as designed (chip rows and the Notes/To-do segmented tabs) -- a bug in the test, not the app.
    // Deliberately excludes text inputs, which the design system allows to be visually thin as long as
    // their hit area is tall enough via padding -- measuring the visual box alone would over-report here.
    for (const el of controls) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') continue
      const r = el.getBoundingClientRect()
      if (Math.max(r.width, r.height) < 44) {
        out.tiny.push({ tag: el.tagName, name: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || '(unnamed)', w: Math.round(r.width), h: Math.round(r.height) })
      }
    }

    // LC-NAME: every button/link needs an accessible name.
    for (const el of controls) {
      if (el.tagName !== 'BUTTON' && !(el.tagName === 'A')) continue
      const name = (el.getAttribute('aria-label') || el.textContent || '').trim()
      if (!name) out.unnamed.push({ tag: el.tagName, cls: el.className.slice(0, 40) })
    }

    // getBoundingClientRect ignores clipping: a row half-scrolled under the bottom edge of an
    // overflow:auto list still reports its FULL, unclipped box, so its centre point can land well past
    // where the box is actually painted -- including, by coincidence, on something real far away (a
    // tab-bar label). The fix is to clip each control's rect against every scrolling/overflow-hidden
    // ancestor's own box (intersection, not a yes/no check -- a row that is HALF clipped still has a
    // real, smaller, genuinely painted remainder that can still really overlap something).
    const clippedRect = (el) => {
      let r = el.getBoundingClientRect()
      let box = { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
      let node = el.parentElement
      while (node && node !== document.body) {
        const cs = getComputedStyle(node)
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowY === 'hidden' || cs.overflow === 'hidden') {
          const nr = node.getBoundingClientRect()
          box = { top: Math.max(box.top, nr.top), bottom: Math.min(box.bottom, nr.bottom), left: Math.max(box.left, nr.left), right: Math.min(box.right, nr.right) }
          if (box.bottom <= box.top || box.right <= box.left) return null // clipped down to nothing: not painted at all
        }
        node = node.parentElement
      }
      return box
    }
    const visible = controls.map((el) => ({ el, box: clippedRect(el) })).filter((v) => v.box !== null)

    // LC-OVERLAP: no two controls' boxes overlap by more than a token amount (a 1px shared border is
    // fine; real overlap -- one control sitting on top of another -- is not). Centre-point test: if
    // control A's centre point falls inside control B's box (and they are not nested, one inside the
    // other, which is normal for e.g. a row containing a trailing icon button), that's a real conflict.
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i].el
        const b = visible[j].el
        if (a.contains(b) || b.contains(a)) continue // nesting is normal, not an overlap
        const ra = visible[i].box
        const rb = visible[j].box
        const ax = ra.left + (ra.right - ra.left) / 2
        const ay = ra.top + (ra.bottom - ra.top) / 2
        const bx = rb.left + (rb.right - rb.left) / 2
        const by = rb.top + (rb.bottom - rb.top) / 2
        const aCentreInB = ax >= rb.left && ax <= rb.right && ay >= rb.top && ay <= rb.bottom
        const bCentreInA = bx >= ra.left && bx <= ra.right && by >= ra.top && by <= ra.bottom
        if (aCentreInB || bCentreInA) {
          out.overlaps.push({
            a: a.getAttribute('aria-label') || a.textContent?.trim().slice(0, 24) || a.tagName,
            b: b.getAttribute('aria-label') || b.textContent?.trim().slice(0, 24) || b.tagName,
          })
        }
      }
    }

    // LC-CLIP: a leaf text element whose own scrollWidth is wider than its nearest ancestor that clips
    // overflow (overflow: hidden with no explicit allowance to wrap) is genuinely cut off, not just
    // wrapped -- overflow-wrap: anywhere / normal word wrap is fine and is not what this checks.
    const texty = [...body.querySelectorAll('span, p, div, h1, h2, h3')].filter((el) => el.children.length === 0 && el.textContent.trim().length > 0 && !el.closest('.sr-only'))
    for (const el of texty) {
      let node = el
      while (node && node !== body) {
        const cs = getComputedStyle(node)
        if (cs.overflow === 'hidden' || cs.overflowX === 'hidden') {
          // The deliberate 1x1px "visually hidden but screen-reader visible" technique: its whole point
          // is that scrollWidth > clientWidth, so it would otherwise look identical to a real clip bug.
          if (node.classList.contains('sr-only')) break
          // text-overflow: ellipsis is a DESIGNED truncation (the tab bar labels do this on purpose,
          // visibly, with "..."), not an accidental clip with no indication anything was cut.
          if (cs.textOverflow === 'ellipsis') break
          if (node.scrollWidth > node.clientWidth + 2) {
            out.clipped.push({ text: el.textContent.trim().slice(0, 40), ancestorClass: node.className.slice(0, 40) })
          }
          break
        }
        node = node.parentElement
      }
    }

    return out
  })

async function run() {
  const app = await startApp()
  const words = process.argv.slice(2)
  const screens = words.length ? SCREENS.filter(([id]) => words.some((w) => id.includes(w))) : SCREENS

  try {
    for (const size of SIZES) {
      for (const [id, navigate] of screens) {
        const { page, errors, close } = await openApp(app, { data: SEED, width: size.width, height: size.height, font: size.font })
        await navigate(page)
        await page.waitForTimeout(350) // entrance transition + fonts settling at the new scale
        const g = await geomCheck(page)
        const label = `${id} @ ${size.label}`

        say(!g.overflowX, 'LC-OVERFLOW', `${label}: no sideways page scroll`, g.overflowX ?? '')
        say(g.overlaps.length === 0, 'LC-OVERLAP', `${label}: no two controls occupy the same point`, g.overlaps.map((o) => `"${o.a}" over "${o.b}"`).join('; '))
        say(g.tiny.length === 0, 'LC-TARGET', `${label}: every control is at least 44px`, g.tiny.map((t) => `${t.name} ${t.w}x${t.h}`).join('; '))
        say(g.clipped.length === 0, 'LC-CLIP', `${label}: no text is truly clipped`, g.clipped.map((c) => `"${c.text}" in .${c.ancestorClass}`).join('; '))
        say(g.unnamed.length === 0, 'LC-NAME', `${label}: every button/link has an accessible name`, g.unnamed.map((u) => `${u.tag}.${u.cls}`).join('; '))
        say(errors.length === 0, 'LC-ERR', `${label}: no console or page errors`, errors.join(' | '))

        await close()
      }
    }
  } finally {
    await app.stop()
  }

  for (const l of results) console.log(l)
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

run().catch((e) => { console.error(e); process.exit(1) })
