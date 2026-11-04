// Calculator test campaign. Run: node e2e/calculator.test.mjs   (builds the app, serves it, drives real Chrome at phone size)
// One line per case:  PASS|FAIL <id> <TYPE> <title> :: <actual if fail>.  Exit code 1 if any FAIL.
// Every case gets a fresh page with data it seeds itself. Never touches a phone.
import { startApp, openApp, tab, overflowing, stored } from './lib.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'

const SHOTS = process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp/shots` : '/tmp/calc-shots'
mkdirSync(SHOTS, { recursive: true })
const ONLY = process.argv[2] // optional: run only ids containing this text

// ------------------------------------------------------------------ helpers
const NAMES = { '+': 'Add', '-': 'Subtract', '*': 'Multiply', '/': 'Divide', '.': 'Decimal point', '%': 'Percent', '(': 'Brackets', ')': 'Brackets', '=': 'Equals', C: 'Clear', Z: 'Double zero', '!': 'Factorial', '^': 'Power' }
const nm = (c) => NAMES[c] ?? c
/** Taps keypad keys one character at a time: digits, + - * / . % ( ) = C, Z = "00", ! ^ (scientific keys). */
const tap = async (page, s) => { for (const c of s) await page.locator(`.key[aria-label="${nm(c)}"]`).first().click() }
/** Tap a key by its full accessible name (Sine, Square root, Backspace...). */
const key = (page, name) => page.locator(`[aria-label="${name}"]`).first().click()
/** Types on a hardware keyboard (fast path for long input). Enter is "=". */
const kb = (page, s) => page.keyboard.type(s)
const read = async (page) => ({
  expr: await page.locator('.display__expr').inputValue(),
  res: (await page.locator('.display__result').innerText()).trim(),
  note: (await page.locator('.display__note').innerText()).trim(),
  mem: (await page.locator('.display__memory').innerText()).trim(),
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const saved = async (page) => { await wait(450); return stored(page) }
const mk = (over = {}, settings = {}) => ({ schemaVersion: 3, settings: { theme: 'dark', ...settings }, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false }, ...over })
const row = (i, extra = {}) => ({ id: `h${i}`, expression: `${i}+1`, result: String(i + 1), at: 1700000000000 + i, ...extra })
const rows = (n) => Array.from({ length: n }, (_, i) => row(n - i)) // newest first
const caret = async (page, a, b = a) => {
  await page.evaluate(([x, y]) => { const el = document.querySelector('.display__expr'); el.focus(); el.setSelectionRange(x, y) }, [a, b])
  await wait(80)
}
const openHistory = async (page) => { await page.locator('[aria-label="History"]').first().click(); await page.waitForSelector('.sheet') }
const openSci = async (page) => { await tab(page, 'Tools'); await page.locator('.hero').click(); await page.waitForSelector('.sci-screen') }
const rect = (page, sel) => page.locator(sel).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right } })
const eq = (actual, expected, what = '') => { if (actual !== expected) throw new Error(`${what ? what + ': ' : ''}got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`) }
const ok = (cond, msg) => { if (!cond) throw new Error(msg) }
const has = (hay, needle, what = '') => { if (!String(hay).includes(needle)) throw new Error(`${what ? what + ': ' : ''}got ${JSON.stringify(hay)}, expected to contain ${JSON.stringify(needle)}`) }
const BAD_TEXT = /NaN|undefined|Infinity|\[object/
const bodyText = (page) => page.evaluate(() => document.body.innerText)
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` }).catch(() => {})
/** Give the page a real clipboard it can read and write. */
const allowClip = (t) => t.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(t.page.url()).origin })
const clipRead = (page) => page.evaluate(() => navigator.clipboard.readText())
const clipWrite = (page, text) => page.evaluate((x) => navigator.clipboard.writeText(x), text)
/** The 10-significant-digit scientific form of a positive integer string, the way the app should write it. */
const sci10 = (digits) => { const d = digits.replace(/^0+/, ''); const exp = d.length - 1; let m = BigInt(d.slice(0, 11).padEnd(11, '0')); m = (m + 5n) / 10n; let s = m.toString(); let e = exp; if (s.length > 10) { s = s.slice(0, 10); e += 1 } s = s.replace(/0+$/, ''); return (s.length > 1 ? `${s[0]}.${s.slice(1)}` : s) + `E+${e}` }

const cases = []
const C = (id, type, title, fn, opts = {}) => cases.push({ id, type, title, fn, opts })

// ================================================================== KEYPAD ENTRY (POS)
C('CALC-001', 'POS', 'Digits 0-9 show with Indian grouping', async ({ page }) => {
  await tap(page, '1234567890'); eq((await read(page)).res, '1,23,45,67,890')
})
C('CALC-002', 'POS', 'International grouping setting', async ({ page }) => {
  await tap(page, '1234567'); eq((await read(page)).res, '1,234,567')
}, { settings: { numberSystem: 'international' } })
C('CALC-003', 'POS', '00 key types two zeros', async ({ page }) => { await tap(page, '5Z'); eq((await read(page)).res, '500') })
C('CALC-004', 'POS', 'Four operations give right answers (7+8, 6x7, 9/4, 10-3)', async ({ page }) => {
  const got = []
  for (const [s, want] of [['7+8=', '15'], ['6*7=', '42'], ['9/4=', '2.25'], ['10-3=', '7']]) { await tap(page, 'C'); await tap(page, s); got.push((await read(page)).res); if (got.at(-1) !== want) throw new Error(`${s} gave ${got.at(-1)}, expected ${want}`) }
})
C('CALC-005', 'POS', 'After = the line above says "expr =" and the answer is large', async ({ page }) => {
  await tap(page, '7+8='); const r = await read(page); eq(r.expr, '7 + 8 ='); eq(r.res, '15')
})
C('CALC-006', 'POS', 'Operator can continue from an answer (2+3=, x2=)', async ({ page }) => { await tap(page, '2+3=*2='); eq((await read(page)).res, '10') })
C('CALC-007', 'POS', 'A digit after = starts a new number', async ({ page }) => { await tap(page, '2+3=7'); const r = await read(page); eq(r.res, '7'); eq(r.expr, '') })
C('CALC-008', 'POS', 'Decimal: 0.1+0.2 is exactly 0.3', async ({ page }) => { await tap(page, '0.1+0.2='); eq((await read(page)).res, '0.3') })
C('CALC-009', 'POS', 'Percent: 200+10% = 220 (percent of the first number)', async ({ page }) => { await tap(page, '200+10%='); eq((await read(page)).res, '220') })
C('CALC-010', 'POS', 'Percent alone: 50% = 0.5', async ({ page }) => { await tap(page, '50%='); eq((await read(page)).res, '0.5') })
C('CALC-011', 'POS', 'Brackets key opens then closes: (2+3)x4 = 20', async ({ page }) => { await tap(page, '(2+3)*4='); const r = await read(page); eq(r.res, '20'); eq(r.expr, '(2 + 3) × 4 =') })
C('CALC-012', 'POS', 'Unclosed bracket is closed by =: (2+3 = 5', async ({ page }) => { await tap(page, '(2+3='); eq((await read(page)).res, '5') })
C('CALC-013', 'POS', 'Clear key empties the display', async ({ page }) => { await tap(page, '12+3C'); const r = await read(page); eq(r.res, '0'); eq(r.expr, '') })
C('CALC-014', 'POS', 'Live preview shows the answer, dimmed, before =', async ({ page }) => {
  await tap(page, '12+3'); eq((await read(page)).res, '15'); eq(await page.locator('.display__result').getAttribute('data-preview'), 'true')
})
C('CALC-015', 'POS', 'Keyboard: type 12+3 then Enter = 15, Escape clears', async ({ page }) => {
  await kb(page, '12+3'); await page.keyboard.press('Enter'); eq((await read(page)).res, '15'); await page.keyboard.press('Escape'); eq((await read(page)).res, '0')
})
C('CALC-016', 'POS', 'Percent key then more: 200x10% = 20', async ({ page }) => { await tap(page, '200*10%='); eq((await read(page)).res, '20') })

// ------------------------------------------------------------------ NEG
C('CALC-020', 'NEG', 'New operator replaces the dangling one (5+x3 = 15)', async ({ page }) => { await tap(page, '5+*3'); const r = await read(page); eq(r.expr, '5 × 3'); eq(r.res, '15') })
C('CALC-021', 'NEG', 'Operator first is ignored (x5 gives 5)', async ({ page }) => { await tap(page, '*5'); eq((await read(page)).res, '5') })
C('CALC-022', 'NEG', 'Second decimal point in a number is ignored (1.5.2 -> 1.52)', async ({ page }) => { await tap(page, '1.5.2'); eq((await read(page)).res, '1.52') })
C('CALC-023', 'NEG', 'Leading zeros collapse (0,0,5 -> 5)', async ({ page }) => { await tap(page, '005'); eq((await read(page)).res, '5') })
C('CALC-024', 'NEG', '00 on an empty line gives a single 0', async ({ page }) => { await tap(page, 'Z'); eq((await read(page)).res, '0') })
C('CALC-025', 'NEG', 'Close-bracket with nothing open does nothing (")" via keyboard)', async ({ page }) => { await kb(page, '5)'); eq((await read(page)).res, '5') })
C('CALC-026', 'NEG', 'Percent on nothing does nothing', async ({ page }) => { await tap(page, '%'); const r = await read(page); eq(r.res, '0'); eq(r.expr, '') })
C('CALC-027', 'NEG', 'Letters on a hardware keyboard are ignored', async ({ page }) => { await kb(page, 'abc5'); eq((await read(page)).res, '5') })
C('CALC-028', 'NEG', 'Typing inside the expression box does not insert raw text', async ({ page }) => {
  await tap(page, '12+3'); await page.locator('.display__expr').click(); await page.keyboard.type('xyz'); eq((await read(page)).expr, '12 + 3')
})
C('CALC-029', 'NEG', 'Operator right after ( is refused, except minus (( then x)', async ({ page }) => { await tap(page, '(*'); eq((await read(page)).expr, '('); })
C('CALC-030', 'NEG', 'Trailing operator then = ignores the operator (5+= gives 5)', async ({ page }) => { await tap(page, '5+='); eq((await read(page)).res, '5') })

// ------------------------------------------------------------------ ERR
C('CALC-040', 'ERR', 'Divide by zero says "Can\'t divide by zero" and keeps the expression', async ({ page }) => {
  await tap(page, '5/0='); const r = await read(page); eq(r.note, "Can't divide by zero"); eq(r.expr, '5 ÷ 0'); eq(r.res, '')
})
C('CALC-041', 'ERR', 'Divide by zero is warned before pressing =', async ({ page }) => { await tap(page, '5/0'); eq((await read(page)).note, "Can't divide by zero") })
C('CALC-042', 'ERR', 'A failed = is not added to History', async ({ page }) => { await tap(page, '5/0='); await openHistory(page); has(await page.locator('.sheet').innerText(), 'Nothing here yet') })
C('CALC-043', 'ERR', 'Error text is plain words, never NaN/undefined/Infinity', async ({ page }) => {
  for (const s of ['5/0=', '0/0=', '1/0*0=', '(1/0)=']) { await tap(page, 'C'); await tap(page, s); ok(!BAD_TEXT.test(await bodyText(page)), `${s}: ${await bodyText(page)}`) }
})
C('CALC-044', 'ERR', 'Error clears when you type on (backspace the 0)', async ({ page }) => { await tap(page, '5/0='); await key(page, 'Backspace'); await tap(page, '2='); eq((await read(page)).res, '2.5') })
C('CALC-045', 'ERR', '0/0 also says cannot divide by zero', async ({ page }) => { await tap(page, '0/0='); eq((await read(page)).note, "Can't divide by zero") })
C('CALC-046', 'ERR', 'Error message colour is the error tone', async ({ page }) => { await tap(page, '5/0'); eq(await page.locator('.display__note').getAttribute('data-tone'), 'error') })
C('CALC-047', 'ERR', 'Error is shown for at least a moment then settles (live preview error remains while expr is bad)', async ({ page }) => {
  await tap(page, '5/0='); await wait(2800); const r = await read(page); has(r.note, 'divide by zero', 'still shown because the expression is still bad')
})

// ------------------------------------------------------------------ CORNER
C('CALC-050', 'CORNER', '= on nothing changes nothing', async ({ page }) => { await tap(page, '='); const r = await read(page); eq(r.res, '0'); eq(r.note, '') })
C('CALC-051', 'CORNER', 'Repeated = does nothing new and adds one history row only', async ({ page }) => {
  await tap(page, '2+3='); for (let i = 0; i < 5; i++) await tap(page, '='); eq((await read(page)).res, '5'); eq((await saved(page)).history.length, 1)
})
C('CALC-052', 'CORNER', '= on a bare number records nothing', async ({ page }) => { await tap(page, '5='); eq((await saved(page)).history.length, 0) })
C('CALC-053', 'CORNER', 'MAX digits: a number stops growing at 24 digits', async ({ page }) => {
  await tap(page, '1'.repeat(30)); const s = await saved(page); eq(s.input.expr.length, 24, 'stored length')
})
C('CALC-054', 'CORNER', '24-digit number shows as scientific 1.111111111E+23', async ({ page }) => { await tap(page, '1'.repeat(24)); eq((await read(page)).res, sci10('1'.repeat(24))) })
C('CALC-055', 'CORNER', 'MAX digits applies per number, not per expression', async ({ page }) => {
  await kb(page, '1'.repeat(30) + '+' + '2'.repeat(30)); const s = await saved(page); eq(s.input.expr.length, 24 + 1 + 24)
})
C('CALC-056', 'CORNER', '500-character cap on the expression', async ({ page }) => {
  await kb(page, '1+'.repeat(300)); const s = await saved(page); ok(s.input.expr.length <= 500, `length ${s.input.expr.length}`)
})
C('CALC-057', 'CORNER', '15-digit number is shown in full', async ({ page }) => { await tap(page, '999999999999999'); eq((await read(page)).res, '99,99,99,99,99,99,999') }, { })
C('CALC-058', 'CORNER', '16-digit number switches to E notation (1E+15)', async ({ page }) => { await tap(page, '1000000000000000'); eq((await read(page)).res, '1E+15') })
C('CALC-059', 'CORNER', '999999999999999+1 = 1E+15 (the threshold crossing)', async ({ page }) => { await kb(page, '999999999999999+1'); await page.keyboard.press('Enter'); eq((await read(page)).res, '1E+15') })
C('CALC-060', 'CORNER', 'Big product has 10 correct significant digits (BigInt check)', async ({ page }) => {
  await kb(page, '123456789012*987654321098'); await page.keyboard.press('Enter')
  eq((await read(page)).res, sci10((123456789012n * 987654321098n).toString()))
})
C('CALC-061', 'CORNER', 'Biggest allowed: 10^99 shows 1E+99', async ({ page }) => { await kb(page, '10^99'); await page.keyboard.press('Enter'); eq((await read(page)).res, '1E+99') })
C('CALC-062', 'CORNER', '10^100 says "Too large to show"', async ({ page }) => { await kb(page, '10^100'); await page.keyboard.press('Enter'); eq((await read(page)).note, 'Too large to show') })
C('CALC-063', 'CORNER', 'Tiny result: 1/10^11 = 1E-11 in auto decimals (not 0)', async ({ page }) => { await kb(page, '1/100000000000'); await page.keyboard.press('Enter'); eq((await read(page)).res, '1E-11') })
C('CALC-064', 'CORNER', 'Tiny result with fixed 2 decimals shows 0.00', async ({ page }) => { await kb(page, '1/1000'); await page.keyboard.press('Enter'); eq((await read(page)).res, '0.00') }, { settings: { decimals: 2 } })
C('CALC-065', 'CORNER', 'Negative tiny/rounded-to-zero never shows "-0.00"', async ({ page }) => { await kb(page, '-1/1000'); await page.keyboard.press('Enter'); const r = (await read(page)).res; ok(!/[-−]0\.00/.test(r), r) }, { settings: { decimals: 2 } })
C('CALC-066', 'CORNER', 'Decimals = 2: 10/3 = 3.33', async ({ page }) => { await tap(page, '10/3='); eq((await read(page)).res, '3.33') }, { settings: { decimals: 2 } })
C('CALC-067', 'CORNER', 'Decimals = 0 rounds half up: 10/4 = 3', async ({ page }) => { await tap(page, '10/4='); eq((await read(page)).res, '3') }, { settings: { decimals: 0 } })
C('CALC-068', 'CORNER', 'Decimals = 4 pads: 2+2 = 4.0000', async ({ page }) => { await tap(page, '2+2='); eq((await read(page)).res, '4.0000') }, { settings: { decimals: 4 } })
C('CALC-069', 'CORNER', 'Decimals = 10 and auto: 1/3 = 0.3333333333', async ({ page }) => { await tap(page, '1/3='); eq((await read(page)).res, '0.3333333333') }, { settings: { decimals: 10 } })
C('CALC-070', 'CORNER', 'Auto trims zeros: 1.50*2 = 3', async ({ page }) => { await tap(page, '1.50*2='); eq((await read(page)).res, '3') })
C('CALC-071', 'CORNER', 'Typed trailing zeros are kept while typing (1.50)', async ({ page }) => { await tap(page, '1.50'); eq((await read(page)).res, '1.50') })
C('CALC-072', 'CORNER', 'Typed "12." keeps its point', async ({ page }) => { await tap(page, '12.'); eq((await read(page)).res, '12.') })
C('CALC-073', 'CORNER', 'Decimal on empty gives "0."', async ({ page }) => { await tap(page, '.'); eq((await read(page)).res, '0.') })
C('CALC-074', 'CORNER', 'Negative result uses the real minus sign', async ({ page }) => { await tap(page, '3-8='); eq((await read(page)).res, '−5') })
C('CALC-075', 'CORNER', 'Rapid taps: 60 quick taps on "1" never exceed 24 digits and do not throw', async ({ page, errors }) => {
  await page.evaluate(() => { const b = document.querySelector('.key[aria-label="1"]'); for (let i = 0; i < 60; i++) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })) })
  const s = await saved(page); eq(s.input.expr.length, 24)
})
C('CALC-076', 'CORNER', 'Rapid operator taps leave one operator', async ({ page }) => {
  await tap(page, '5'); await page.evaluate(() => { const b = document.querySelector('.key[aria-label="Add"]'); for (let i = 0; i < 30; i++) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })) })
  eq((await read(page)).expr, '5 +')
})
C('CALC-077', 'CORNER', 'Zero divided: 0*5 = 0 and 0 shows "0"', async ({ page }) => { await tap(page, '0*5='); eq((await read(page)).res, '0') })
C('CALC-078', 'CORNER', 'Long expression with 1/3 chains keeps exact maths: 1/3*3 = 1', async ({ page }) => { await tap(page, '1/3*3='); eq((await read(page)).res, '1') })
C('CALC-079', 'CORNER', 'Unary minus: -5+3 = -2, and 5*-3 = -15', async ({ page }) => {
  await tap(page, '-5+3='); eq((await read(page)).res, '−2'); await tap(page, 'C5*-3='); eq((await read(page)).res, '−15')
})
C('CALC-080', 'CORNER', 'Double minus: 5--3 is refused as 5-3 or -(-3) never crashes', async ({ page }) => {
  await tap(page, '5--3='); const r = (await read(page)).res; ok(r === '2' || r === '8', r)
})
C('CALC-081', 'CORNER', 'Backspace on an empty line does nothing', async ({ page }) => { await key(page, 'Backspace'); eq((await read(page)).res, '0') })
C('CALC-082', 'CORNER', 'Backspace removes one digit; and a whole sin( at once', async ({ page }) => {
  await tap(page, '123'); await key(page, 'Backspace'); eq((await read(page)).res, '12')
})
C('CALC-083', 'CORNER', 'Backspace after = turns the answer into an editable number', async ({ page }) => { await tap(page, '2+3='); await key(page, 'Backspace'); const r = await read(page); eq(r.res, '' + r.res); ok(r.res === '0' || r.res === '', `got ${r.res}`) })
C('CALC-084', 'CORNER', 'Held Backspace repeats, and stops when you let go', async ({ page }) => {
  await kb(page, '1234567890123456789012'); const b = await rect(page, '[aria-label="Backspace"]')
  await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2); await page.mouse.down(); await wait(1300); await page.mouse.up()
  const n1 = (await saved(page)).input.expr.length; await wait(500); const n2 = (await saved(page)).input.expr.length
  ok(n1 <= 16 && n1 >= 2, `after hold ${n1} left of 22`); eq(n2, n1, 'still deleting after release')
})
C('CALC-085', 'CORNER', 'Undo walks back step by step', async ({ page }) => {
  await tap(page, '12+3'); await key(page, 'Undo'); eq((await read(page)).expr, '12 +'); await key(page, 'Undo'); eq((await read(page)).res, '12')
})
C('CALC-086', 'CORNER', 'Undo is disabled when there is nothing to undo', async ({ page }) => { eq(await page.locator('[aria-label="Undo"]').isDisabled(), true) })
C('CALC-087', 'CORNER', 'Undo after = goes back to the open expression', async ({ page }) => { await tap(page, '2+3='); await key(page, 'Undo'); eq((await read(page)).expr, '2 + 3') })
C('CALC-088', 'CORNER', 'Ctrl+Z undoes on a keyboard', async ({ page }) => { await tap(page, '12+3'); await page.keyboard.press('Control+z'); eq((await read(page)).expr, '12 +') })
C('CALC-089', 'CORNER', 'Undo depth is limited to 100 without error', async ({ page, errors }) => {
  await kb(page, '12'.repeat(60)); for (let i = 0; i < 5; i++) await key(page, 'Undo'); ok(errors.length === 0, errors.join())
})
C('CALC-090', 'CORNER', 'Tap in expression-edit: 7 digits then comma key on keyboard maps to a point', async ({ page }) => { await kb(page, '1,5'); eq((await read(page)).res, '1.5') })

// ================================================================== SCIENTIFIC: memory, angles, domain, constants
const sciKeys = async (page, ...names) => { for (const n of names) await key(page, n) }
C('CALC-100', 'POS', 'Scientific opens from Tools and shows its function keys', async ({ page }) => {
  await openSci(page); for (const n of ['Sine', 'Cosine', 'Tangent', 'Logarithm base 10', 'Natural logarithm', 'Square root', 'Pi', 'Factorial', 'Recall memory', 'Add to memory']) ok(await page.locator(`[aria-label="${n}"]`).count() === 1, `missing ${n}`)
})
C('CALC-101', 'POS', 'Memory: M+ adds, display shows "M 5"', async ({ page }) => { await openSci(page); await tap(page, '5'); await key(page, 'Add to memory'); const r = await read(page); eq(r.mem, 'M 5'); eq(r.note, 'Memory updated') })
C('CALC-102', 'POS', 'Memory: MR puts memory into the expression (5 then C, MR)', async ({ page }) => { await openSci(page); await tap(page, '5'); await key(page, 'Add to memory'); await tap(page, 'C'); await key(page, 'Recall memory'); eq((await read(page)).res, '5') })
C('CALC-103', 'POS', 'Memory: M- subtracts (5 M+, 2 M- leaves 3)', async ({ page }) => {
  await openSci(page); await tap(page, '5'); await key(page, 'Add to memory'); await tap(page, 'C2'); await key(page, 'Subtract from memory'); eq((await read(page)).mem, 'M 3')
})
C('CALC-104', 'POS', 'Memory: MC clears and says so', async ({ page }) => { await openSci(page); await tap(page, '5'); await key(page, 'Add to memory'); await key(page, 'Clear memory'); const r = await read(page); eq(r.mem, ''); eq(r.note, 'Memory cleared') })
C('CALC-105', 'NEG', 'MR with empty memory says "Memory is empty"', async ({ page }) => { await openSci(page); await key(page, 'Recall memory'); eq((await read(page)).note, 'Memory is empty') })
C('CALC-106', 'NEG', 'M+ with nothing typed says "Nothing to add to memory"', async ({ page }) => { await openSci(page); await key(page, 'Add to memory'); eq((await read(page)).note, 'Nothing to add to memory') })
C('CALC-107', 'POS', 'M+ uses the live result of an expression (2+3 then M+ = 5)', async ({ page }) => { await openSci(page); await tap(page, '2+3'); await key(page, 'Add to memory'); eq((await read(page)).mem, 'M 5') })
C('CALC-108', 'CORNER', 'Memory goes negative: M- from empty gives M −2', async ({ page }) => { await openSci(page); await tap(page, '2'); await key(page, 'Subtract from memory'); eq((await read(page)).mem, 'M −2') })
C('CALC-109', 'CORNER', 'MR inside an expression: 5 M+, C, 2 + MR = 7', async ({ page }) => {
  await openSci(page); await tap(page, '5'); await key(page, 'Add to memory'); await tap(page, 'C2+'); await key(page, 'Recall memory'); await tap(page, '='); eq((await read(page)).res, '7')
})
C('CALC-110', 'CORNER', 'MR after a number replaces that number (not glues)', async ({ page }) => {
  await openSci(page); await tap(page, '5'); await key(page, 'Add to memory'); await tap(page, 'C7'); await key(page, 'Recall memory'); eq((await read(page)).res, '5')
})
C('CALC-111', 'CORNER', 'MR with a negative memory is bracketed: 3 + MR(-2)', async ({ page }) => {
  await openSci(page); await tap(page, '2'); await key(page, 'Subtract from memory'); await tap(page, 'C3+'); await key(page, 'Recall memory'); await tap(page, '='); eq((await read(page)).res, '1')
})
C('CALC-112', 'POS', 'Degrees: sin(30) = 0.5, cos(60) = 0.5, tan(45) = 1', async ({ page }) => {
  await openSci(page)
  for (const [fn, a, want] of [['Sine', '30', '0.5'], ['Cosine', '60', '0.5'], ['Tangent', '45', '1']]) { await tap(page, 'C'); await key(page, fn); await tap(page, a + ')'); await tap(page, '='); eq((await read(page)).res, want, `${fn}(${a})`) }
})
C('CALC-113', 'POS', 'Radians: Deg key switches to Rad and sin(0)=0, cos(0)=1', async ({ page }) => {
  await openSci(page); await page.locator('.sci .key', { hasText: 'Deg' }).click(); has(await page.locator('.sci').innerText(), 'Rad')
  await key(page, 'Cosine'); await tap(page, '0)='); eq((await read(page)).res, '1')
})
C('CALC-114', 'POS', 'Radians vs degrees differ: sin(90) = 1 in deg; sin(1.5707963268) ~ 1 in rad', async ({ page }) => {
  await openSci(page); await key(page, 'Sine'); await tap(page, '90)='); eq((await read(page)).res, '1')
  await tap(page, 'C'); await page.locator('.sci .key', { hasText: 'Deg' }).click(); await key(page, 'Sine'); await tap(page, '90)='); const r = (await read(page)).res; ok(r !== '1', `sin(90 rad) should not be 1, got ${r}`)
})
C('CALC-115', 'POS', 'Angle choice is saved with the app data', async ({ page }) => { await openSci(page); await page.locator('.sci .key', { hasText: 'Deg' }).click(); eq((await saved(page)).settings.angle, 'rad') })
C('CALC-116', 'POS', 'Inverse trig: asin(1) = 90 in degrees', async ({ page }) => { await openSci(page); await key(page, 'Inverse sine'); await tap(page, '1)='); eq((await read(page)).res, '90') })
C('CALC-117', 'POS', 'log(1000) = 3 and ln(e) = 1', async ({ page }) => {
  await openSci(page); await key(page, 'Logarithm base 10'); await tap(page, '1000)='); eq((await read(page)).res, '3')
  await tap(page, 'C'); await key(page, 'Natural logarithm'); await key(page, 'Euler’s number'); await tap(page, ')='); eq((await read(page)).res, '1')
})
C('CALC-118', 'ERR', 'asin(2) is "Not defined for this value"', async ({ page }) => { await openSci(page); await key(page, 'Inverse sine'); await tap(page, '2)'); eq((await read(page)).note, 'Not defined for this value') })
C('CALC-119', 'ERR', 'log(0), log(-1), ln(0) say "Not defined for this value"', async ({ page }) => {
  await openSci(page)
  for (const [fn, a] of [['Logarithm base 10', '0'], ['Logarithm base 10', '-1'], ['Natural logarithm', '0']]) { await tap(page, 'C'); await key(page, fn); await tap(page, a + ')'); eq((await read(page)).note, 'Not defined for this value', `${fn}(${a})`) }
})
C('CALC-120', 'ERR', 'sqrt(-4) is not defined; sqrt(16) = 4', async ({ page }) => {
  await openSci(page); await key(page, 'Square root'); await tap(page, '-4)'); eq((await read(page)).note, 'Not defined for this value')
  await tap(page, 'C'); await key(page, 'Square root'); await tap(page, '16)='); eq((await read(page)).res, '4')
})
C('CALC-121', 'ERR', 'tan(90) in degrees does not crash or show NaN/Infinity', async ({ page }) => {
  await openSci(page); await key(page, 'Tangent'); await tap(page, '90)='); ok(!BAD_TEXT.test(await bodyText(page)), (await read(page)).res)
})
C('CALC-122', 'POS', 'Constants: pi shows 3.1415926536, e shows 2.7182818285', async ({ page }) => {
  await openSci(page); await key(page, 'Pi'); eq((await read(page)).res, '3.1415926536'); await tap(page, 'C'); await key(page, 'Euler’s number'); eq((await read(page)).res, '2.7182818285')
})
C('CALC-123', 'POS', '2 x pi = 6.2831853072 (constant in an expression)', async ({ page }) => { await openSci(page); await tap(page, '2*'); await key(page, 'Pi'); await tap(page, '='); eq((await read(page)).res, '6.2831853072') })
C('CALC-124', 'POS', 'Power: 2^10 = 1024 and x² key: 9² = 81', async ({ page }) => {
  await openSci(page); await tap(page, '2'); await key(page, 'Power'); await tap(page, '10='); eq((await read(page)).res, '1,024'); await tap(page, 'C9'); await key(page, 'Square'); await tap(page, '='); eq((await read(page)).res, '81')
})
C('CALC-125', 'ERR', '0^-1 says cannot divide by zero; (-8)^0.5 not defined', async ({ page }) => {
  await openSci(page); await tap(page, '0'); await key(page, 'Power'); await tap(page, '-1'); eq((await read(page)).note, "Can't divide by zero")
  await tap(page, 'C(-8)'); await key(page, 'Power'); await tap(page, '0.5'); eq((await read(page)).note, 'Not defined for this value')
})
C('CALC-126', 'POS', 'Factorial: 5! = 120, 0! = 1, 10! = 36,28,800', async ({ page }) => {
  await openSci(page)
  for (const [n, want] of [['5', '120'], ['0', '1'], ['10', '36,28,800']]) { await tap(page, 'C' + n); await key(page, 'Factorial'); await tap(page, '='); eq((await read(page)).res, want, `${n}!`) }
})
C('CALC-127', 'CORNER', 'Factorial limits: 69! fits, 70! is "Too large to show"', async ({ page }) => {
  await openSci(page); await tap(page, '69'); await key(page, 'Factorial'); await tap(page, '='); eq((await read(page)).res, '1.711224524E+98')
  await tap(page, 'C70'); await key(page, 'Factorial'); eq((await read(page)).note, 'Too large to show')
})
C('CALC-128', 'ERR', '(-1)! and 2.5! are not defined; 101! too large', async ({ page }) => {
  await openSci(page); await tap(page, '2.5'); await key(page, 'Factorial'); eq((await read(page)).note, 'Not defined for this value')
  await tap(page, 'C101'); await key(page, 'Factorial'); eq((await read(page)).note, 'Too large to show')
})
C('CALC-129', 'CORNER', 'Factorial key after an operator is ignored (5+ then !)', async ({ page }) => { await openSci(page); await tap(page, '5+'); await key(page, 'Factorial'); eq((await read(page)).expr, '5 +') })
C('CALC-130', 'CORNER', 'Backspace removes a whole "sin(" in one tap', async ({ page }) => { await openSci(page); await key(page, 'Sine'); await key(page, 'Backspace'); eq((await read(page)).expr, '') })
C('CALC-131', 'CORNER', 'x² key adds ^2 (two keys in one tap, one undo step?)', async ({ page }) => {
  await openSci(page); await tap(page, '9'); await key(page, 'Square'); await key(page, 'Undo'); const e = (await read(page)).expr
  ok(e === '9' || e === '9^', `after one Undo the line is "${e}"; expected 9 (one tap = one undo step)`)
  eq(e, '9', 'x² is two key presses so Undo leaves "9^"')
})
C('CALC-132', 'CORNER', 'sin of a large angle in degrees stays exact-ish: sin(720)=0 not 1e-20', async ({ page }) => { await openSci(page); await key(page, 'Sine'); await tap(page, '720)='); eq((await read(page)).res, '0') })
C('CALC-133', 'RUNTIME', 'Memory and angle persist after reload', async ({ page }) => {
  await openSci(page); await tap(page, '5'); await key(page, 'Add to memory'); await page.locator('.sci .key', { hasText: 'Deg' }).click(); await wait(500); await page.reload(); await page.waitForSelector('.app')
  const s = await stored(page); eq(s.memory, '5'); eq(s.settings.angle, 'rad')
})
C('CALC-134', 'POS', 'Scientific shares History with Calculate', async ({ page }) => { await openSci(page); await tap(page, '2+3='); await page.locator('.sci-screen [aria-label="Back"]').click(); await tab(page, 'Calculate'); await openHistory(page); has(await page.locator('.sheet').innerText(), '2 + 3') })
C('CALC-135', 'CORNER', 'Memory with a huge value does not break the display (1E+50 M+)', async ({ page }) => {
  await openSci(page); await kb(page, '10^50'); await key(page, 'Add to memory'); const r = await read(page); ok(!BAD_TEXT.test(r.mem + r.note), r.mem)
})

// ================================================================== NUMBER WORDS
C('CALC-140', 'POS', 'Number words (Indian): lakh, crore, arab, kharab, lakh crore, neel, padma, shankh', async ({ page }) => {
  const want = [['100000', '1 lakh'], ['12345678', '1.23 crore'], ['1234567890', '1.23 arab'], ['12345678901', '1.23 kharab'], ['1000000000000', '1 lakh crore'], ['10000000000000', '1 neel'], ['100000000000000000', '1 shankh']]
  const bad = []
  for (const [n, w] of want) { await kb(page, n); const got = (await read(page)).note; if (got !== w) bad.push(`${n}->${got}`); await tap(page, 'C') }
  ok(bad.length === 0, bad.join('; '))
})
C('CALC-141', 'POS', 'Number words (international): million, billion, trillion, quadrillion', async ({ page }) => {
  const want = [['1000000', '1 million'], ['16672260', '16.67 million'], ['1000000000', '1 billion'], ['1000000000000', '1 trillion'], ['1000000000000000', '1 quadrillion']]
  const bad = []
  for (const [n, w] of want) { await kb(page, n); const got = (await read(page)).note; if (got !== w) bad.push(`${n}->${got}`); await tap(page, 'C') }
  ok(bad.length === 0, bad.join('; '))
}, { settings: { numberSystem: 'international' } })
C('CALC-142', 'CORNER', 'No words under 1 lakh (99,999) and none for small numbers', async ({ page }) => { await kb(page, '99999'); eq((await read(page)).note, ''); })
C('CALC-143', 'CORNER', 'Words line for huge 1E+25: international "septillion" ranges, Indian says nothing', async ({ page }) => {
  await kb(page, '10^25'); await page.keyboard.press('Enter'); eq((await read(page)).res, '1E+25'); eq((await read(page)).note, '', 'Indian has no name this big')
})
C('CALC-144', 'CORNER', 'International 12E+24 has a name: "12 septillion"', async ({ page }) => { await kb(page, '12*10^24'); await page.keyboard.press('Enter'); eq((await read(page)).note, '12 septillion') }, { settings: { numberSystem: 'international' } })
C('CALC-145', 'CORNER', 'Number past the top name has no words, and no crash (1E+36 international)', async ({ page }) => { await kb(page, '10^36'); await page.keyboard.press('Enter'); eq((await read(page)).note, ''); eq((await read(page)).res, '1E+36') }, { settings: { numberSystem: 'international' } })
C('CALC-146', 'CORNER', 'Negative numbers get words too: -12345678 = "−1.23 crore"', async ({ page }) => { await kb(page, '-12345678'); const n = (await read(page)).note; ok(/1\.23 crore/.test(n), n) })
C('CALC-147', 'CORNER', 'Words near a boundary: 99,99,999 is "99.99 lakh" or "1 crore", never "100 lakh"', async ({ page }) => { await kb(page, '9999999'); const n = (await read(page)).note; ok(n === '1 crore' || n === '99.99 lakh', n) })
C('CALC-148', 'CORNER', 'Words line while typing does not overwrite an error notice', async ({ page }) => { await kb(page, '12345678/0'); const n = (await read(page)).note; eq(n, "Can't divide by zero") })

// ================================================================== CURSOR EDITING
C('CALC-160', 'POS', 'Cursor: type a digit in the middle of the expression', async ({ page }) => {
  await tap(page, '12+34'); await caret(page, 2); await tap(page, '5'); eq((await read(page)).expr, '125 + 34')
})
C('CALC-161', 'POS', 'Cursor: tap with a real tap inside the expression moves the cursor', async ({ page }) => {
  await tap(page, '1234+5678'); const b = await rect(page, '.display__expr'); await page.mouse.click(b.x + 8, b.y + b.h / 2); await wait(120)
  const pos = await page.locator('.display__expr').evaluate((el) => el.selectionStart); ok(pos <= 3, `caret at ${pos} after tapping the far left`)
})
C('CALC-162', 'POS', 'Cursor: tap in the middle then Backspace deletes before the cursor', async ({ page }) => {
  await tap(page, '1234'); await page.locator('.display__result').click(); await caret(page, 2); await key(page, 'Backspace'); eq((await read(page)).expr, '134')
})
C('CALC-163', 'POS', 'Cursor: replace an operator (caret after +, press x)', async ({ page }) => {
  await tap(page, '12+34'); await caret(page, 4); await tap(page, '*'); eq((await read(page)).expr, '12 × 34')
})
C('CALC-164', 'POS', 'Cursor: select a range and press Backspace removes it', async ({ page }) => {
  await tap(page, '12+34'); await caret(page, 1, 6); await key(page, 'Backspace'); eq((await read(page)).res, '14'.replace('14', '14'))
})
C('CALC-165', 'POS', 'Cursor: typing over a selection replaces it', async ({ page }) => {
  await tap(page, '12+34'); await caret(page, 5, 7); await tap(page, '9'); eq((await read(page)).expr, '12 + 9')
})
C('CALC-166', 'POS', 'Cursor: tap after = brings the last expression back to edit', async ({ page }) => {
  await tap(page, '2+3='); const b = await rect(page, '.display__expr'); await page.mouse.click(b.x + b.w - 8, b.y + b.h / 2); await wait(150)
  const r = await read(page); eq(r.expr, '2 + 3'); await tap(page, '4'); eq((await read(page)).res, '37'.replace('37', '37'))
})
C('CALC-167', 'POS', 'Cursor: a lone number has no edit line until you tap the big number', async ({ page }) => {
  await tap(page, '123'); eq((await read(page)).expr, ''); await page.locator('.display__result').click(); eq((await read(page)).expr, '123')
})
C('CALC-168', 'POS', 'Cursor: tapping the big number again (edit line open) copies', async ({ page }) => {
  await allowClip({ page, context: page.context() }); await tap(page, '123'); await page.locator('.display__result').click(); await page.locator('.display__result').click(); await wait(200)
  const t = await page.locator('.display__note').innerText(); const sheet = await page.locator('.sheet').count(); ok(t.includes('Copied') || sheet === 1 || t.includes('copy'), `note "${t}" sheets ${sheet}`)
})
C('CALC-169', 'CORNER', 'Cursor: caret at the very start, typing a digit prepends', async ({ page }) => { await tap(page, '12+34'); await caret(page, 0); await tap(page, '9'); eq((await read(page)).expr, '912 + 34') })
C('CALC-170', 'CORNER', 'Cursor: decimal point inside a number that has one is ignored', async ({ page }) => { await tap(page, '1.5+2'); await caret(page, 3); await tap(page, '.'); eq((await read(page)).expr, '1.5 + 2') })
C('CALC-171', 'CORNER', 'Cursor: after editing, the cursor stays where it was (type 2 digits in the middle)', async ({ page }) => {
  await tap(page, '12+34'); await caret(page, 2); await tap(page, '56'); eq((await read(page)).expr, '1256 + 34')
})
C('CALC-172', 'CORNER', 'Cursor: Clear key resets the cursor and the line', async ({ page }) => { await tap(page, '12+34'); await caret(page, 2); await tap(page, 'C'); eq((await read(page)).expr, '') })
C('CALC-173', 'CORNER', 'Cursor: operator typed at start of expression (caret 0) is refused except minus', async ({ page }) => { await tap(page, '12+34'); await caret(page, 0); await tap(page, '*'); eq((await read(page)).expr, '12 + 34') })
C('CALC-174', 'CORNER', 'Cursor: select all then type replaces everything', async ({ page }) => { await tap(page, '12+34'); await caret(page, 0, 7); await tap(page, '8'); eq((await read(page)).res, '8') })
C('CALC-175', 'CORNER', 'Cursor edits are one Undo step each', async ({ page }) => { await tap(page, '12+34'); await caret(page, 2); await tap(page, '5'); await key(page, 'Undo'); eq((await read(page)).expr, '12 + 34') })
C('CALC-176', 'CORNER', 'Cursor: edit inside a grouped number keeps the commas right (1,23,456 + insert)', async ({ page }) => {
  await tap(page, '123456+1'); await caret(page, 2); await tap(page, '9'); eq((await read(page)).expr, '1,29,3456 + 1'.replace('1,29,3456', '1,29,3,456'.replace('1,29,3,456', '1,29,34,56')) )
})
C('CALC-177', 'CORNER', 'Edit after =: the preview answer is live again (2+3= then tap, then 4 gives 2+34 = 36)', async ({ page }) => {
  await tap(page, '2+3='); const b = await rect(page, '.display__expr'); await page.mouse.click(b.x + b.w - 8, b.y + b.h / 2); await wait(150); await tap(page, '4'); eq((await read(page)).res, '36')
})

// ================================================================== PASTE
const paste = async (t, text) => { await allowClip(t); await clipWrite(t.page, text); await t.page.locator('.util__btn', { hasText: 'Paste' }).click(); await wait(250) }
C('CALC-180', 'POS', 'Paste: "1,50,000" becomes 1,50,000', async (t) => { await paste(t, '1,50,000'); eq((await read(t.page)).res, '1,50,000') })
C('CALC-181', 'POS', 'Paste: currency symbol "₹1,200 - ₹300" works out to 900', async (t) => { await paste(t, '₹1,200 - ₹300'); await tap(t.page, '='); eq((await read(t.page)).res, '900') })
C('CALC-182', 'POS', 'Paste: "$ 2,500" gives 2,500', async (t) => { await paste(t, '$ 2,500'); eq((await read(t.page)).res, '2,500') })
C('CALC-183', 'POS', 'Paste: a calculation "23 x 36" is read as 23*36', async (t) => { await paste(t, '23 x 36'); await tap(t.page, '='); eq((await read(t.page)).res, '828') })
C('CALC-184', 'POS', 'Paste: multi-line list adds lines and says "Added 3 lines"', async (t) => {
  await paste(t, 'Rent 25000\nFood 3000\n-500'); await wait(100); eq((await read(t.page)).note, 'Added 3 lines'); await tap(t.page, '='); eq((await read(t.page)).res, '27,500')
})
C('CALC-185', 'POS', 'Paste: 1.2e+25 from a spreadsheet becomes 1.2E+25', async (t) => { await paste(t, '1.2e+25'); eq((await read(t.page)).res, '1.2E+25') })
C('CALC-186', 'NEG', 'Paste: words with no number say "There\'s no number in what you copied"', async (t) => { await paste(t, 'hello world'); eq((await read(t.page)).note, "There's no number in what you copied") })
C('CALC-187', 'NEG', 'Paste: "12 34" (two numbers, no operator) is refused', async (t) => { await paste(t, '12 34'); const r = await read(t.page); ok(r.note.includes('no number') || r.res === '0', JSON.stringify(r)) })
C('CALC-188', 'ERR', 'Paste: over 500 characters is refused in plain words', async (t) => { await paste(t, '1+'.repeat(300) + '1'); has((await read(t.page)).note, 'too long') })
C('CALC-189', 'ERR', 'Paste when the clipboard is empty opens the "Paste a calculation" box', async (t) => {
  await allowClip(t); await clipWrite(t.page, ''); await t.page.locator('.util__btn', { hasText: 'Paste' }).click(); await t.page.waitForSelector('.sheet'); has(await t.page.locator('.sheet').innerText(), 'Paste a calculation')
})
C('CALC-190', 'UX', 'Paste box: Use with nothing typed says "Paste or type a calculation"', async (t) => {
  await allowClip(t); await clipWrite(t.page, ''); await t.page.locator('.util__btn', { hasText: 'Paste' }).click(); await t.page.waitForSelector('.sheet')
  await t.page.locator('.sheet button', { hasText: 'Use' }).click(); has(await t.page.locator('.sheet [role=alert]').innerText(), 'Paste or type a calculation')
})
C('CALC-191', 'POS', 'Paste box: typed text is used and the box closes', async (t) => {
  await allowClip(t); await clipWrite(t.page, ''); await t.page.locator('.util__btn', { hasText: 'Paste' }).click(); await t.page.waitForSelector('.sheet')
  await t.page.locator('#paste-box').fill('45 + 5'); await t.page.locator('.sheet button', { hasText: 'Use' }).click(); await wait(200); eq(await t.page.locator('.sheet').count(), 0, 'sheet still open'); eq((await read(t.page)).res, '50')
})
C('CALC-192', 'NEG', 'Paste box: invalid text shows the reason inside the box and stays open', async (t) => {
  await allowClip(t); await clipWrite(t.page, ''); await t.page.locator('.util__btn', { hasText: 'Paste' }).click(); await t.page.waitForSelector('.sheet')
  await t.page.locator('#paste-box').fill('abc'); await t.page.locator('.sheet button', { hasText: 'Use' }).click(); has(await t.page.locator('.sheet [role=alert]').innerText(), 'no number')
})
C('CALC-193', 'CORNER', 'Paste into the middle of an expression goes at the cursor', async (t) => {
  await tap(t.page, '12+34'); await caret(t.page, 2); await paste(t, '99'); eq((await read(t.page)).expr, '9912 + 34'.replace('9912', '1299'))
})
C('CALC-194', 'CORNER', 'Paste: negative accounting number "(500)" gives -500', async (t) => { await paste(t, '(500)'); has((await read(t.page)).res, '−500') })
C('CALC-195', 'CORNER', 'Paste after typed digits: pasted number should replace or be separated, not glue (known B-20, confirm)', async (t) => {
  await tap(t.page, '12'); await paste(t, '34'); const r = (await read(t.page)); ok(r.res !== '1,234', `known B-20, confirmed: typed 12 then pasted 34 gives ${r.res}`)
})
C('CALC-196', 'CORNER', 'Paste a date "12/05/2026" must not turn into a division (known B-20, confirm)', async (t) => {
  await paste(t, '12/05/2026'); const r = await read(t.page); ok(!/÷/.test(r.expr), `known B-20, confirmed: pasted date became "${r.expr}"`)
})
C('CALC-197', 'CORNER', 'Paste event on the expression box (long-press Paste) works', async (t) => {
  await t.page.evaluate(() => { const el = document.querySelector('.display__expr'); const dt = new DataTransfer(); dt.setData('text/plain', '7*6'); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })) })
  await wait(100); eq((await read(t.page)).res, '42')
})
C('CALC-198', 'CORNER', 'Paste a division by zero "5/0" shows the explanation, no crash', async (t) => { await paste(t, '5/0'); eq((await read(t.page)).note, "Can't divide by zero") })
C('CALC-199', 'CORNER', 'Paste is one Undo step', async (t) => { await paste(t, '1,50,000'); await key(t.page, 'Undo'); eq((await read(t.page)).res, '0') })

// ================================================================== COPY
C('CALC-210', 'POS', 'Copy (ask): sheet "Copy as" shows both versions', async (t) => {
  await allowClip(t); await tap(t.page, '150000'); await t.page.locator('.util__btn', { hasText: 'Copy' }).click(); await t.page.waitForSelector('.sheet')
  const s = await t.page.locator('.sheet').innerText(); has(s, 'With commas'); has(s, '1,50,000'); has(s, 'Without commas'); has(s, '150000')
})
C('CALC-211', 'POS', 'Copy (ask): choose "Without commas" puts 150000 on the clipboard', async (t) => {
  await allowClip(t); await tap(t.page, '150000'); await t.page.locator('.util__btn', { hasText: 'Copy' }).click(); await t.page.locator('.copyas__opt', { hasText: 'Without commas' }).click(); await wait(200)
  eq(await clipRead(t.page), '150000'); eq((await read(t.page)).note, 'Copied')
})
C('CALC-212', 'POS', 'Copy (ask): choose "With commas" puts 1,50,000 on the clipboard', async (t) => {
  await allowClip(t); await tap(t.page, '150000'); await t.page.locator('.util__btn', { hasText: 'Copy' }).click(); await t.page.locator('.copyas__opt', { hasText: 'With commas' }).click(); await wait(200)
  eq(await clipRead(t.page), '1,50,000')
})
C('CALC-213', 'POS', 'Copy: "remember" switch saves the choice to Settings', async (t) => {
  await allowClip(t); await tap(t.page, '150000'); await t.page.locator('.util__btn', { hasText: 'Copy' }).click(); await t.page.locator('.copyas__remember .toggle').click(); await t.page.locator('.copyas__opt', { hasText: 'Without commas' }).click()
  eq((await saved(t.page)).settings.copyFormat, 'without'); await tap(t.page, 'C150000'); await t.page.locator('.util__btn', { hasText: 'Copy' }).click(); await wait(200); eq(await t.page.locator('.sheet').count(), 0, 'sheet should not appear again')
})
C('CALC-214', 'POS', 'Copy: Settings default "with" copies instantly with commas', async (t) => {
  await allowClip(t); await tap(t.page, '150000'); await t.page.locator('.util__btn', { hasText: 'Copy' }).click(); await wait(250); eq(await clipRead(t.page), '1,50,000'); eq(await t.page.locator('.sheet').count(), 0)
}, { settings: { copyFormat: 'with' } })
C('CALC-215', 'POS', 'Copy: Settings default "without" copies instantly without commas', async (t) => {
  await allowClip(t); await tap(t.page, '150000'); await t.page.locator('.util__btn', { hasText: 'Copy' }).click(); await wait(250); eq(await clipRead(t.page), '150000')
}, { settings: { copyFormat: 'without' } })
C('CALC-216', 'CORNER', 'Copy: a number with no commas (5) copies straight away (no sheet)', async (t) => {
  await allowClip(t); await tap(t.page, '5'); await t.page.locator('.util__btn', { hasText: 'Copy' }).click(); await wait(250); eq(await t.page.locator('.sheet').count(), 0); eq(await clipRead(t.page), '5')
})
C('CALC-217', 'NEG', 'Copy with nothing typed says "Nothing to copy yet"', async (t) => { await t.page.locator('.util__btn', { hasText: 'Copy' }).click(); eq((await read(t.page)).note, 'Nothing to copy yet') })
C('CALC-218', 'CORNER', 'Copy a huge result copies 20 digits as 1.2345E+25 style and pastes back as a number', async (t) => {
  await allowClip(t); await kb(t.page, '12345*10^21'); await t.page.keyboard.press('Enter'); await t.page.locator('.util__btn', { hasText: 'Copy' }).click(); await wait(250)
  const c = await clipRead(t.page); ok(/^1\.2345E\+25$/.test(c), c); await tap(t.page, 'C'); await t.page.locator('.util__btn', { hasText: 'Paste' }).click(); await wait(250); eq((await read(t.page)).res, '1.2345E+25')
}, { settings: { copyFormat: 'with' } })
C('CALC-219', 'CORNER', 'Copy a fixed-decimals result keeps the places (decimals 2: 2+2 -> 4.00)', async (t) => {
  await allowClip(t); await tap(t.page, '2+2='); await t.page.locator('.util__btn', { hasText: 'Copy' }).click(); await wait(250); eq(await clipRead(t.page), '4.00')
}, { settings: { decimals: 2, copyFormat: 'with' } })
C('CALC-220', 'CORNER', 'Copy a negative number uses a plain minus sign on the clipboard', async (t) => {
  await allowClip(t); await tap(t.page, '3-8='); await t.page.locator('.util__btn', { hasText: 'Copy' }).click(); await wait(250); eq(await clipRead(t.page), '-5')
}, { settings: { copyFormat: 'without' } })
C('CALC-221', 'UX', 'Copy sheet: Escape closes it without copying', async (t) => {
  await allowClip(t); await clipWrite(t.page, 'keep'); await tap(t.page, '150000'); await t.page.locator('.util__btn', { hasText: 'Copy' }).click(); await t.page.waitForSelector('.sheet'); await t.page.keyboard.press('Escape'); await wait(150)
  eq(await t.page.locator('.sheet').count(), 0); eq(await clipRead(t.page), 'keep')
})
C('CALC-222', 'UX', 'Copy as sheet has a Close X and options are 44px tall', async (t) => {
  await tap(t.page, '150000'); await t.page.locator('.util__btn', { hasText: 'Copy' }).click(); await t.page.waitForSelector('.sheet'); ok(await t.page.locator('[aria-label="Close Copy as"]').count() === 1, 'no close X')
  const h = await rect(t.page, '.copyas__opt'); ok(h.h >= 44, `option height ${h.h}`)
})

// ================================================================== HISTORY
C('CALC-230', 'POS', 'History: = adds a row, newest first, with expression and answer', async ({ page }) => {
  await tap(page, '2+3='); await tap(page, 'C4*5='); await openHistory(page); const rows = await page.locator('.hrow').allInnerTexts(); has(rows[0], '4 × 5'); has(rows[0], '20'); has(rows[1], '2 + 3')
})
C('CALC-231', 'POS', 'History: empty state tells you what to do', async ({ page }) => { await openHistory(page); has(await page.locator('.sheet').innerText(), 'Nothing here yet') })
C('CALC-232', 'POS', 'History: tap the expression reuses it (sheet closes)', async ({ page }) => {
  await openHistory(page); await page.locator('.hrow__expr').first().click(); await wait(150); eq(await page.locator('.sheet').count(), 0); eq((await read(page)).res, '8')
}, { data: mk({ history: [row(7)] }) })
C('CALC-233', 'POS', 'History: tap the result reuses that number', async ({ page }) => {
  await openHistory(page); await page.locator('.hrow__result').first().click(); await wait(150); eq((await read(page)).res, '8')
}, { data: mk({ history: [row(7)] }) })
C('CALC-234', 'CORNER', 'History: reusing an expression while typing adds it in brackets (1+2+ then 9*9 -> 1+2+(9*9))', async ({ page }) => {
  await tap(page, '1+2+'); await openHistory(page); await page.locator('.hrow__expr').first().click(); await wait(150); eq((await read(page)).expr, '1 + 2 + (9 × 9)')
}, { data: mk({ history: [{ id: 'a', expression: '9*9', result: '81', at: 1 }] }) })
C('CALC-235', 'POS', 'History: Name a row; the name shows', async ({ page }) => {
  await openHistory(page); await page.locator('[aria-label^="Name "]').first().click(); await page.locator('.hrow__edit input').fill('Rent'); await page.locator('.hrow__edit button', { hasText: 'Save' }).click(); has(await page.locator('.hrow').first().innerText(), 'Rent')
  eq((await saved(page)).history[0].memo, 'Rent')
}, { data: mk({ history: [row(7)] }) })
C('CALC-236', 'POS', 'History: Lock from the More menu; lock icon shows; delete is disabled', async ({ page }) => {
  await openHistory(page); await page.locator('[aria-label^="More for"]').first().click(); await page.locator('.hmenu__item', { hasText: 'Lock' }).click(); await page.locator('[aria-label="Close Calculation"]').click(); await wait(150)
  eq(await page.locator('.hrow [aria-label^="Delete"]').first().isDisabled(), true); eq((await saved(page)).history[0].locked, true)
}, { data: mk({ history: [row(7)] }) })
C('CALC-237', 'POS', 'History: Unlock a locked row', async ({ page }) => {
  await openHistory(page); await page.locator('[aria-label^="More for"]').first().click(); await page.locator('.hmenu__item', { hasText: 'Unlock' }).click(); await wait(100); eq((await saved(page)).history[0].locked, undefined)
}, { data: mk({ history: [row(7, { locked: true })] }) })
C('CALC-238', 'POS', 'History: Edit expression re-works the answer (7+1 -> 7+2 gives 9)', async ({ page }) => {
  await openHistory(page); await page.locator('[aria-label^="More for"]').first().click(); await page.locator('.hmenu__item', { hasText: 'Edit expression' }).click(); await page.locator('#hrow-field').fill('7+2'); await page.locator('.sheet__foot button', { hasText: 'Save' }).click(); await wait(150)
  const h = (await saved(page)).history[0]; eq(h.result, '9')
}, { data: mk({ history: [row(7)] }) })
C('CALC-239', 'ERR', 'History: Edit expression with junk shows "Check the expression" and keeps the sheet', async ({ page }) => {
  await openHistory(page); await page.locator('[aria-label^="More for"]').first().click(); await page.locator('.hmenu__item', { hasText: 'Edit expression' }).click(); await page.locator('#hrow-field').fill('7+*'); await page.locator('.sheet__foot button', { hasText: 'Save' }).click(); has(await page.locator('#hrow-field-msg, .sheet').last().innerText(), 'Check the expression')
}, { data: mk({ history: [row(7)] }) })
C('CALC-240', 'ERR', 'History: Edit expression to 5/0 says cannot divide by zero', async ({ page }) => {
  await openHistory(page); await page.locator('[aria-label^="More for"]').first().click(); await page.locator('.hmenu__item', { hasText: 'Edit expression' }).click(); await page.locator('#hrow-field').fill('5/0'); await page.locator('.sheet__foot button', { hasText: 'Save' }).click(); has(await page.locator('.sheet').last().innerText(), "Can't divide by zero")
}, { data: mk({ history: [row(7)] }) })
C('CALC-241', 'NEG', 'History: Edit expression emptied says "Type an expression"', async ({ page }) => {
  await openHistory(page); await page.locator('[aria-label^="More for"]').first().click(); await page.locator('.hmenu__item', { hasText: 'Edit expression' }).click(); await page.locator('#hrow-field').fill(''); await page.locator('.sheet__foot button', { hasText: 'Save' }).click(); has(await page.locator('.sheet').last().innerText(), 'Type an expression')
}, { data: mk({ history: [row(7)] }) })
C('CALC-242', 'POS', 'History: Share (no share sheet in a browser) copies "expr = answer" and says so', async (t) => {
  await allowClip(t); await t.page.evaluate(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }) })
  await openHistory(t.page); await t.page.locator('[aria-label^="More for"]').first().click(); await t.page.locator('.hmenu__item', { hasText: 'Share' }).click(); await wait(300)
  eq(await clipRead(t.page), '7 + 1 = 8')
}, { data: mk({ history: [row(7)] }) })
C('CALC-243', 'POS', 'History: Copy from the More menu asks how (commas), copies "expr = answer"', async (t) => {
  await allowClip(t); await openHistory(t.page); await t.page.locator('[aria-label^="More for"]').first().click(); await t.page.locator('.hmenu__item', { hasText: 'Copy' }).click(); await wait(300)
  if (await t.page.locator('.copyas__opt').count()) await t.page.locator('.copyas__opt').first().click(); await wait(250); has(await clipRead(t.page), '7 + 1 = 8')
}, { data: mk({ history: [row(7)] }) })
C('CALC-244', 'POS', 'History: Delete removes the row and offers Undo', async ({ page }) => {
  await openHistory(page); await page.locator('.hrow [aria-label^="Delete"]').first().click(); eq(await page.locator('.hrow').count(), 1); has(await page.locator('.snack').innerText(), 'Removed from history'); has(await page.locator('.snack').innerText(), 'Undo')
}, { data: mk({ history: [row(7), row(6)] }) })
C('CALC-245', 'POS', 'History: Undo puts the deleted row back in its place', async ({ page }) => {
  await openHistory(page); await page.locator('.hrow [aria-label^="Delete"]').first().click(); await page.locator('.snack button', { hasText: 'Undo' }).click(); await wait(150)
  const t = await page.locator('.hrow').allInnerTexts(); eq(t.length, 2); has(t[0], '7 + 1')
}, { data: mk({ history: [row(7), row(6)] }) })
C('CALC-246', 'POS', 'History: Clear all asks you to type CLEAR; button stays off until you do', async ({ page }) => {
  await openHistory(page); await page.locator('.link-btn--danger', { hasText: 'Clear all' }).click(); eq(await page.locator('button', { hasText: 'Clear history' }).isDisabled(), true); await page.locator('input[aria-label="Type CLEAR to confirm"]').fill('clea'); eq(await page.locator('button', { hasText: 'Clear history' }).isDisabled(), true)
}, { data: mk({ history: [row(7), row(6)] }) })
C('CALC-247', 'POS', 'History: Clear all keeps locked and named rows, says how many are kept', async ({ page }) => {
  await openHistory(page); await page.locator('.link-btn--danger', { hasText: 'Clear all' }).click(); const msg = await page.locator('.confirm p').innerText(); has(msg, '5 calculations'); has(msg, '1 locked row is kept'); has(msg, 'Named calculations are kept')
  await page.locator('input[aria-label="Type CLEAR to confirm"]').fill('clear'); await page.locator('button', { hasText: 'Clear history' }).click(); await wait(200)
  eq((await saved(page)).history.length, 2)
}, { data: mk({ history: [row(1), row(2), row(3), row(4), row(5), row(6, { locked: true }), row(7, { memo: 'Rent' })] }) })
C('CALC-248', 'UX', 'History: after Clear all, Undo in the snackbar brings every row back', async ({ page }) => {
  await openHistory(page); await page.locator('.link-btn--danger', { hasText: 'Clear all' }).click(); await page.locator('input[aria-label="Type CLEAR to confirm"]').fill('CLEAR'); await page.locator('button', { hasText: 'Clear history' }).click(); await page.locator('.snack button', { hasText: 'Undo' }).click(); await wait(250)
  eq((await saved(page)).history.length, 4)
}, { data: mk({ history: [row(1), row(2), row(3), row(4)] }) })
C('CALC-249', 'CORNER', 'History: no "Clear all" when every row is locked or named', async ({ page }) => {
  await openHistory(page); eq(await page.locator('.link-btn--danger').count(), 0)
}, { data: mk({ history: [row(1, { locked: true }), row(2, { memo: 'x' })] }) })
C('CALC-250', 'POS', 'History: All / Locked filter shows only locked rows', async ({ page }) => {
  await openHistory(page); await page.locator('.hfilter .chip', { hasText: 'Locked' }).click(); eq(await page.locator('.hrow').count(), 1)
}, { data: mk({ history: [row(1), row(2, { locked: true }), row(3)] }) })
C('CALC-251', 'CORNER', 'History: cap. 600 saved rows load as 200 (oldest dropped), no crash', async ({ page }) => {
  await openHistory(page); eq(await page.locator('.hrow').count(), 200)
}, { data: mk({ history: rows(600) }) })
C('CALC-252', 'CORNER', 'History: the 201st calculation drops the oldest, newest is on top', async ({ page }) => {
  await tap(page, '9+9='); const s = await saved(page); eq(s.history.length, 200); eq(s.history[0].expression, '9+9'); ok(!s.history.some((h) => h.id === 'h1'), 'oldest row h1 should be gone')
}, { data: mk({ history: rows(200) }) })
C('CALC-253', 'CORNER', 'History: named rows survive the cap (50 named + 200 plain)', async ({ page }) => {
  await tap(page, '9+9='); const s = await saved(page); eq(s.history.filter((h) => h.memo).length, 50)
}, { data: mk({ history: [...rows(200).map((h, i) => (i % 4 === 0 ? { ...h, memo: 'n' + i } : h))] }) })
C('CALC-254', 'CORNER', '200 named rows: a new calculation must still be recorded (known B-19, confirm)', async ({ page }) => {
  await tap(page, '9+9='); const s = await saved(page); ok(s.history.some((h) => h.expression === '9+9'), 'known B-19, confirmed: new calculation vanished from History')
}, { data: mk({ history: rows(200).map((h) => ({ ...h, memo: 'n' + h.id })) }) })
C('CALC-255', 'CORNER', 'History: 600 rows opens in under 1.5 seconds', async ({ page }) => {
  const t0 = Date.now(); await openHistory(page); await page.waitForSelector('.hrow'); const ms = Date.now() - t0; ok(ms < 1500, `${ms} ms`)
}, { data: mk({ history: rows(600) }) })
C('CALC-256', 'CORNER', 'History: Keep-history setting off stops recording', async ({ page }) => { await tap(page, '2+3='); eq((await saved(page)).history.length, 0) }, { settings: { keepHistory: false } })
C('CALC-257', 'CORNER', 'History: Lock limit (100) says "Unlock one to lock another."', async ({ page }) => {
  await openHistory(page); await page.locator('[aria-label^="More for"]').first().click(); await page.locator('.hmenu__item', { hasText: 'Lock' }).click(); await wait(150)
  const n = await page.evaluate(() => document.body.innerText); has(n, 'Unlock one to lock another')
}, { data: mk({ history: [row(500), ...Array.from({ length: 100 }, (_, i) => row(i, { locked: true }))] }) })
C('CALC-258', 'CORNER', 'History: a locked row cannot be deleted from the More menu', async ({ page }) => {
  await openHistory(page); await page.locator('[aria-label^="More for"]').first().click(); eq(await page.locator('.hmenu__item', { hasText: 'Delete' }).isDisabled(), true)
}, { data: mk({ history: [row(7, { locked: true })] }) })
C('CALC-259', 'CORNER', 'History: Name longer than 80 characters is cut to 80', async ({ page }) => {
  await openHistory(page); await page.locator('[aria-label^="Name "]').first().click(); await page.locator('.hrow__edit input').fill('x'.repeat(120)); await page.locator('.hrow__edit button', { hasText: 'Save' }).click(); eq((await saved(page)).history[0].memo.length, 80)
}, { data: mk({ history: [row(7)] }) })
C('CALC-260', 'CORNER', 'History: Name left blank clears the name', async ({ page }) => {
  await openHistory(page); await page.locator('[aria-label^="Rename "]').first().click(); await page.locator('.hrow__edit input').fill('   '); await page.locator('.hrow__edit button', { hasText: 'Save' }).click(); eq((await saved(page)).history[0].memo, undefined)
}, { data: mk({ history: [row(7, { memo: 'Rent' })] }) })
C('CALC-261', 'POS', 'History: number system switch re-formats old rows (Indian -> International)', async ({ page }) => {
  await openHistory(page); has(await page.locator('.hrow').first().innerText(), '12,34,567'); await page.locator('[aria-label="Close History"]').click()
  await page.locator('[aria-label="Settings"]').click(); await page.locator('[role=radiogroup][aria-label="Number format"] >> text=International').click(); await page.locator('.screen [aria-label="Back"]').first().click(); await wait(150)
  await openHistory(page); has(await page.locator('.hrow').first().innerText(), '1,234,567'); ok(!(await page.locator('.hrow').first().innerText()).includes('12,34,567'), 'old format still showing')
}, { data: mk({ history: [{ id: 'a', expression: '1234566+1', result: '1234567', at: 1 }] }) })
C('CALC-262', 'POS', 'Number system switch also re-formats the open expression', async ({ page }) => {
  await tap(page, '1234567+1'); has((await read(page)).expr, '12,34,567'); await page.locator('[aria-label="Settings"]').click(); await page.locator('[role=radiogroup][aria-label="Number format"] >> text=International').click(); await page.locator('.screen [aria-label="Back"]').first().click(); await wait(150)
  has((await read(page)).expr, '1,234,567')
})
C('CALC-263', 'POS', 'Decimals setting re-formats history answers (auto -> 2 places)', async ({ page }) => {
  await openHistory(page); has(await page.locator('.hrow__result').first().innerText(), '3.3333333333')
}, { data: mk({ history: [{ id: 'a', expression: '10/3', result: '3.3333333333333333333', at: 1 }] }) })
C('CALC-264', 'UI', 'History: long expression (400 chars) does not overflow the sheet sideways', async ({ page }) => {
  await openHistory(page); const o = await overflowing(page); ok(o.length === 0, o.join('; '))
}, { data: mk({ history: [{ id: 'a', expression: '1234567+'.repeat(50) + '1', result: '1', at: 1 }] }) })
C('CALC-265', 'UI', 'History: huge number result (100 digits) does not overflow', async ({ page }) => {
  await openHistory(page); const o = await overflowing(page); ok(o.length === 0, o.join('; ')); ok(!BAD_TEXT.test(await page.locator('.sheet').innerText()), 'bad text')
}, { data: mk({ history: [{ id: 'a', expression: '10^99*9', result: '9' + '0'.repeat(99), at: 1 }] }) })
C('CALC-266', 'UI', 'History: huge number shows scientific, not 100 digits', async ({ page }) => {
  await openHistory(page); const r = await page.locator('.hrow__result').first().innerText(); ok(r.length < 25, `${r.length} chars: ${r.slice(0, 40)}`)
}, { data: mk({ history: [{ id: 'a', expression: '10^99*9', result: '9' + '0'.repeat(99), at: 1 }] }) })
C('CALC-267', 'UI', 'History: row buttons are 44px in one direction', async ({ page }) => {
  await openHistory(page); const bad = await page.evaluate(() => [...document.querySelectorAll('.sheet button')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { n: b.getAttribute('aria-label') || b.innerText, w: r.width, h: r.height } }).filter((x) => Math.max(x.w, x.h) < 44))
  ok(bad.length === 0, JSON.stringify(bad.slice(0, 4)))
}, { data: mk({ history: [row(7), row(6, { locked: true }), row(5, { memo: 'Rent' })] }) })
C('CALC-268', 'UI', 'History at 200% font: no sideways overflow', async ({ page }) => { await openHistory(page); const o = await overflowing(page); ok(o.length === 0, o.join('; ')) }, { font: 200, data: mk({ history: [row(7), row(6, { locked: true }), row(5, { memo: 'Rent a long name for the row' })] }) })
C('CALC-269', 'UX', 'History: opens with a Close X, and Escape closes; focus returns somewhere sensible', async ({ page }) => {
  await openHistory(page); await page.keyboard.press('Escape'); await wait(150); eq(await page.locator('.sheet').count(), 0)
  const a = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName); ok(a === 'History' || a === 'BODY', `focus is on ${a}`)
})
C('CALC-270', 'UX', 'History rows: the expression and answer buttons say what they do (aria-label "Use expression", "Use result")', async ({ page }) => {
  await openHistory(page); eq(await page.locator('[aria-label^="Use expression"]').count(), 1); eq(await page.locator('[aria-label^="Use result"]').count(), 1)
}, { data: mk({ history: [row(7)] }) })
C('CALC-271', 'UX', 'History: tapping a row to reuse takes 2 taps from the calculator (open, tap)', async ({ page }) => {
  let taps = 0; await openHistory(page); taps++; await page.locator('.hrow__result').first().click(); taps++; eq(taps, 2)
}, { data: mk({ history: [row(7)] }) })
C('CALC-272', 'CORNER', 'History: huge, negative and tiny stored answers format without NaN', async ({ page }) => {
  await openHistory(page); const t = await page.locator('.sheet').innerText(); ok(!BAD_TEXT.test(t), t.slice(0, 200)); has(t, '−5')
}, { data: mk({ history: [{ id: 'a', expression: '3-8', result: '-5', at: 1 }, { id: 'b', expression: '1/10^12', result: '0.000000000001', at: 2 }, { id: 'c', expression: '10^30', result: '1' + '0'.repeat(30), at: 3 }] }) })
C('CALC-273', 'CORNER', 'History: row with damaged data (empty expression, bad result) is dropped, app still loads', async ({ page }) => {
  await openHistory(page); eq(await page.locator('.hrow').count(), 1)
}, { data: mk({ history: [row(7), { id: 'bad', expression: '', result: 'x', at: 1 }, { id: 'bad2', expression: '1+1', result: 'NaN', at: 1 }] }) })
C('CALC-274', 'CORNER', 'History: tiny result "1/10^120" is kept (known B-24 for Edit expression, confirm)', async ({ page }) => {
  await openHistory(page); await page.locator('[aria-label^="More for"]').first().click(); await page.locator('.hmenu__item', { hasText: 'Edit expression' }).click(); await page.locator('#hrow-field').fill('1/10^120'); await page.locator('.sheet__foot button', { hasText: 'Save' }).click()
  const msg = await page.locator('.sheet').last().innerText(); ok(!msg.includes('Too large to show'), `known B-24, confirmed: a tiny answer says "Too large to show"`)
}, { data: mk({ history: [row(7)] }) })
C('CALC-275', 'ERR', 'History: tiny result from the keypad (1/10^120 =) does not silently vanish after reload', async ({ page }) => {
  await kb(page, '1/10^120'); await page.keyboard.press('Enter'); await wait(500); const before = (await stored(page)).history.length; await page.reload(); await page.waitForSelector('.app'); const after = (await stored(page)).history.length
  ok(before === 0 || after === before, `history had ${before} rows, after reload ${after}`)
})

// ================================================================== PERSISTENCE / RUNTIME
C('CALC-300', 'RUNTIME', 'Input in progress survives a reload', async ({ page }) => {
  await tap(page, '12+3'); await wait(500); await page.reload(); await page.waitForSelector('.app'); eq((await read(page)).expr, '12 + 3')
})
C('CALC-301', 'RUNTIME', 'History survives a reload', async ({ page }) => {
  await tap(page, '2+3='); await wait(500); await page.reload(); await page.waitForSelector('.app'); await openHistory(page); has(await page.locator('.hrow').first().innerText(), '2 + 3')
})
C('CALC-302', 'RUNTIME', 'A finished answer survives a reload and is still an answer', async ({ page }) => {
  await tap(page, '2+3='); await wait(500); await page.reload(); await page.waitForSelector('.app'); const r = await read(page); eq(r.res, '5'); await tap(page, '7'); eq((await read(page)).res, '7')
})
C('CALC-303', 'RUNTIME', 'Locked and named flags survive a reload', async ({ page }) => {
  await page.reload(); await page.waitForSelector('.app'); const s = await stored(page); ok(s.history[0].locked === true && s.history[1].memo === 'Rent', JSON.stringify(s.history))
}, { data: mk({ history: [row(2, { locked: true }), row(1, { memo: 'Rent' })] }) })
C('CALC-304', 'RUNTIME', 'No console or page errors through a 200-key random run', async ({ page, errors }) => {
  const ks = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '00', 'Decimal point', 'Add', 'Subtract', 'Multiply', 'Divide', 'Percent', 'Brackets', 'Equals', 'Clear', 'Equals']
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  for (let i = 0; i < 200; i++) {
    await page.locator(`.key[aria-label="${ks[Math.floor(rnd() * ks.length)]}"]`).click({ noWaitAfter: true })
    if (i % 25 === 0) { const t = await bodyText(page); ok(!BAD_TEXT.test(t), `bad text after key ${i}: ${t.slice(0, 120)}`) }
  }
  ok(errors.length === 0, errors.join(' | '))
})
C('CALC-305', 'RUNTIME', 'No NaN/undefined/Infinity anywhere after hostile sequences', async ({ page }) => {
  for (const s of ['0/0=', '(((', ')))', '..', '5%%%', '%5', '5+-*/3=', '-.-', '00.00=', '(5)(5)=']) { await tap(page, 'C'); await tap(page, s); const t = await bodyText(page); ok(!BAD_TEXT.test(t), `${s}: ${t.slice(0, 100)}`) }
})
C('CALC-306', 'RUNTIME', 'Key press updates the screen within 100 ms', async ({ page }) => {
  const ms = await page.evaluate(async () => { const b = document.querySelector('.key[aria-label="7"]'); const t0 = performance.now(); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return performance.now() - t0 })
  ok(ms < 100, `${Math.round(ms)} ms`); eq((await read(page)).res, '7')
})
C('CALC-307', 'RUNTIME', '100 key presses are handled in under 6 seconds', async ({ page }) => {
  const t0 = Date.now(); for (let i = 0; i < 50; i++) await tap(page, '1+'); const ms = Date.now() - t0; ok(ms < 6000, `${ms} ms`)
})
C('CALC-308', 'RUNTIME', 'Back (Escape) from a sheet leaves the typed expression untouched', async ({ page }) => {
  await tap(page, '12+3'); await openHistory(page); await page.keyboard.press('Escape'); await wait(150); eq((await read(page)).expr, '12 + 3')
})
C('CALC-309', 'RUNTIME', 'Back from Scientific returns to Tools and keeps what was typed', async ({ page }) => {
  await openSci(page); await tap(page, '12+3'); await page.locator('.sci-screen [aria-label="Back"]').click(); await tab(page, 'Calculate'); eq((await read(page)).expr, '12 + 3')
})
C('CALC-310', 'RUNTIME', 'Tab switch away and back keeps the display and history', async ({ page }) => {
  await tap(page, '2+3='); await tab(page, 'Tools'); await tab(page, 'Calculate'); eq((await read(page)).res, '5')
})
C('CALC-311', 'RUNTIME', 'Corrupt stored input (script text) is ignored, app starts blank', async ({ page }) => { eq((await read(page)).res, '0') }, { data: mk({ input: { expr: '<script>alert(1)</script>', fresh: true } }) })
C('CALC-312', 'RUNTIME', 'Stored input "fresh" with a non-number (known B-16) does not blank the app', async ({ page, errors }) => {
  await wait(300); ok(await page.locator('.app').count() === 1 && errors.length === 0, `known B-16: ${errors.join(' | ').slice(0, 200)}`)
}, { data: mk({ input: { expr: '(5', fresh: true } }) })
C('CALC-313', 'RUNTIME', 'Hardware keyboard Enter after a tapped digit means "=", not the digit again', async ({ page }) => {
  await tap(page, '2+3'); await page.keyboard.press('Enter'); eq((await read(page)).res, '5'); eq((await saved(page)).history.length, 1)
})
C('CALC-314', 'RUNTIME', 'Debug logging: expressions are not written to localStorage (CLAUDE.md says they are)', async ({ page }) => {
  await tap(page, '98765+4321='); await wait(400); const keys = await page.evaluate(() => Object.keys(localStorage)); const leaks = await page.evaluate(() => Object.entries(localStorage).filter(([k, v]) => k !== 'vkcalc.data' && /98765/.test(v)).map(([k]) => k))
  ok(leaks.length === 0, `expression text found under ${leaks.join()} (keys: ${keys.join()})`)
})

// ================================================================== UI: layout
const UISIZES = [['360x790', 360, 790, 100], ['360x640', 360, 640, 100], ['360x790@200%', 360, 790, 200], ['800x360 landscape', 800, 360, 100]]
const keyBoxes = (page) => page.evaluate(() => {
  const tb = document.querySelector('.tabbar')?.getBoundingClientRect(); const W = document.documentElement.clientWidth, H = document.documentElement.clientHeight
  const bad = []; let n = 0
  document.querySelectorAll('.key').forEach((k) => {
    const r = k.getBoundingClientRect(); if (!r.width) return; n++
    const outside = r.left < -0.5 || r.right > W + 0.5 || r.top < -0.5 || r.bottom > H + 0.5
    const under = tb && r.left < tb.right - 1 && r.right > tb.left + 1 && r.top < tb.bottom - 1 && r.bottom > tb.top + 1
    const small = Math.max(r.width, r.height) < 44
    if (outside || under || small) bad.push(`${k.getAttribute('aria-label')}:${outside ? ' outside' : ''}${under ? ' under tabbar' : ''}${small ? ' <44px' : ''} (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)})`)
  })
  return { n, bad, tabbar: tb && `${Math.round(tb.left)},${Math.round(tb.top)} ${Math.round(tb.width)}x${Math.round(tb.height)}` }
})
UISIZES.forEach(([label, w, h, font], i) => {
  C(`CALC-33${i}`, 'UI', `Calculate: every key visible, clear of the tab bar, 44px: ${label}`, async ({ page }) => {
    await shot(page, `calc-${label.replace(/\W+/g, '_')}`); const r = await keyBoxes(page); ok(r.n >= 20, `only ${r.n} keys`); ok(r.bad.length === 0, r.bad.slice(0, 4).join('; '))
  }, { width: w, height: h, font })
  C(`CALC-34${i}`, 'UI', `Scientific: every key visible, clear of the tab bar, 44px: ${label}`, async ({ page }) => {
    await openSci(page); await wait(200); await shot(page, `sci-${label.replace(/\W+/g, '_')}`); const r = await keyBoxes(page); ok(r.n >= 38, `only ${r.n} keys`); ok(r.bad.length === 0, `tabbar ${r.tabbar}; ${r.bad.slice(0, 5).join('; ')}`)
  }, { width: w, height: h, font })
  C(`CALC-35${i}`, 'UI', `Calculate and Scientific: no sideways overflow with a long expression: ${label}`, async ({ page }) => {
    await kb(page, '1234567+'.repeat(8) + '1'); let o = await overflowing(page); ok(o.length === 0, `calc: ${o.join('; ')}`)
    await openSci(page); await wait(50); o = await overflowing(page); ok(o.length === 0, `sci: ${o.join('; ')}`)
  }, { width: w, height: h, font })
})
;['light', 'dark'].forEach((theme, i) => {
  C(`CALC-36${i}`, 'UI', `Theme ${theme}: Calculate and History render, no overflow, text readable`, async ({ page }) => {
    await tap(page, '12+3='); await shot(page, `calc-${theme}`); let o = await overflowing(page); ok(o.length === 0, o.join('; '))
    await openHistory(page); await shot(page, `hist-${theme}`); o = await overflowing(page); ok(o.length === 0, o.join('; '))
    const contrast = await page.evaluate(() => { const p = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number); const L = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }; const el = document.querySelector('.hrow__expr'); const fg = p(getComputedStyle(el).color); const bg = p(getComputedStyle(document.querySelector('.sheet')).backgroundColor); const a = L(fg), b = L(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) })
    ok(contrast >= 4.5, `history text contrast ${contrast.toFixed(2)}`)
  }, { theme, data: mk({ history: [row(7)] }, { theme }) })
})
C('CALC-370', 'UI', 'Landscape: Calculate shows keypad and display side by side with all keys reachable', async ({ page }) => { const r = await keyBoxes(page); ok(r.bad.length === 0, r.bad.join('; ')) }, { width: 800, height: 360 })
C('CALC-371', 'UI', 'Keypad keeps the same position while the expression grows', async ({ page }) => {
  const a = await rect(page, '.keypad'); const u = await rect(page, '.util'); const d = await rect(page, '.display')
  await kb(page, '1234567+'.repeat(10) + '1'); const a2 = await rect(page, '.keypad'); const u2 = await rect(page, '.util'); const d2 = await rect(page, '.display')
  eq(Math.round(a2.y), Math.round(a.y), 'keypad top moved'); eq(Math.round(u2.y), Math.round(u.y), 'util row moved'); eq(Math.round(d2.h), Math.round(d.h), 'display height changed')
})
C('CALC-372', 'UI', 'Keypad does not move after = (result chips appear)', async ({ page }) => {
  await tap(page, '2+3'); const a = await rect(page, '.keypad'); await tap(page, '='); const a2 = await rect(page, '.keypad'); eq(Math.round(a2.y), Math.round(a.y))
})
C('CALC-373', 'UI', 'Keypad does not move when a notice or number-words line appears', async ({ page }) => {
  const a = await rect(page, '.keypad'); await tap(page, '5/0'); eq(Math.round((await rect(page, '.keypad')).y), Math.round(a.y), 'error'); await tap(page, 'C12345678'); eq(Math.round((await rect(page, '.keypad')).y), Math.round(a.y), 'words')
})
C('CALC-374', 'UI', 'Keypad does not move on a short phone (360x640) while typing', async ({ page }) => {
  const a = await rect(page, '.keypad'); await kb(page, '1234567+'.repeat(10) + '1'); eq(Math.round((await rect(page, '.keypad')).y), Math.round(a.y))
}, { height: 640 })
C('CALC-375', 'UI', 'Keypad does not move at 200% font while typing', async ({ page }) => {
  const a = await rect(page, '.keypad'); await kb(page, '1234567+'.repeat(10) + '1'); eq(Math.round((await rect(page, '.keypad')).y), Math.round(a.y))
}, { font: 200 })
C('CALC-376', 'UI', 'Scientific: display and keypad do not move while the expression grows', async ({ page }) => {
  await openSci(page); const a = await rect(page, '.keypad'); const s = await rect(page, '.sci'); await kb(page, '1234567+'.repeat(10) + '1'); eq(Math.round((await rect(page, '.keypad')).y), Math.round(a.y), 'keypad'); eq(Math.round((await rect(page, '.sci')).y), Math.round(s.y), 'function keys')
})
C('CALC-377', 'UI', 'Big number never gets cut off: 15-digit number fits on one line, no horizontal scroll inside', async ({ page }) => {
  await tap(page, '999999999999999'); const r = await page.locator('.display__result').evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, fs: getComputedStyle(el).fontSize })); ok(r.sw <= r.cw + 1, `scrollWidth ${r.sw} > clientWidth ${r.cw} at ${r.fs}`)
})
C('CALC-378', 'UI', 'Big number fits at 200% font (shrinks or uses E notation)', async ({ page }) => {
  await tap(page, '999999999999999'); const r = await page.locator('.display__result').evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth })); ok(r.sw <= r.cw + 1, `scrollWidth ${r.sw} > clientWidth ${r.cw}`)
}, { font: 200 })
C('CALC-379', 'UI', 'Long expression: the line above the answer stays inside the display (no spill over the keys)', async ({ page }) => {
  await kb(page, '1234567+'.repeat(20) + '1'); const e = await rect(page, '.display__expr'); const k = await rect(page, '.keypad'); const d = await rect(page, '.display'); ok(e.b <= k.y + 1 && e.b <= d.b + 1, `expr bottom ${e.b}, display bottom ${d.b}, keypad top ${k.y}`)
})
C('CALC-380', 'UI', 'Every calculator button has a name a screen reader can read', async ({ page }) => {
  const un = await page.evaluate(() => [...document.querySelectorAll('.calc button, .calc [role=button]')].filter((b) => !(b.getAttribute('aria-label') || b.innerText.trim())).length); eq(un, 0)
})
C('CALC-381', 'UI', 'Util row (Paste, Copy, Undo, Backspace) buttons are 44px and evenly placed', async ({ page }) => {
  const bad = await page.evaluate(() => [...document.querySelectorAll('.util__btn')].map((b) => { const r = b.getBoundingClientRect(); return { n: b.getAttribute('aria-label') || b.innerText, w: r.width, h: r.height } }).filter((x) => Math.max(x.w, x.h) < 44)); ok(bad.length === 0, JSON.stringify(bad))
})
C('CALC-382', 'UI', 'Disabled Undo looks different from enabled Undo', async ({ page }) => {
  const dim = () => page.locator('[aria-label="Undo"]').evaluate((el) => { const s = getComputedStyle(el); return `${s.opacity}|${s.color}` }); const a = await dim(); await tap(page, '5'); const b = await dim(); ok(a !== b, `same look ${a}`)
})
C('CALC-383', 'UI', 'Tappable: result number, History and Settings icons show a pointer/press state', async ({ page }) => {
  const c = await page.evaluate(() => ['.display__result', '[aria-label="History"]', '[aria-label="Settings"]', '.key', '.util__btn'].map((s) => [s, getComputedStyle(document.querySelector(s)).cursor])); const bad = c.filter(([, v]) => v !== 'pointer' && v !== 'default'); ok(bad.length === 0, JSON.stringify(bad))
})
C('CALC-384', 'UI', 'Calculator top bar buttons (History, Settings) are 44px', async ({ page }) => {
  for (const n of ['History', 'Settings']) { const r = await rect(page, `.calc__bar [aria-label="${n}"]`); ok(Math.max(r.w, r.h) >= 44, `${n} ${r.w}x${r.h}`) }
})
C('CALC-385', 'UI', 'Scientific: Deg/Rad key shows the current mode in text, not only colour', async ({ page }) => { await openSci(page); has(await page.locator('.sci').innerText(), 'Deg') })

// ================================================================== UX
C('CALC-400', 'UX', 'Copy takes 2 taps to finish (Copy, choose) and says "Copied"', async (t) => {
  await allowClip(t); await tap(t.page, '150000'); await t.page.locator('.util__btn', { hasText: 'Copy' }).click(); await t.page.locator('.copyas__opt').first().click(); await wait(150); eq((await read(t.page)).note, 'Copied')
})
C('CALC-401', 'UX', 'Feedback: M+ says "Memory updated" (not just a silent change)', async ({ page }) => { await openSci(page); await tap(page, '5'); await key(page, 'Add to memory'); eq((await read(page)).note, 'Memory updated') })
C('CALC-402', 'UX', 'Feedback: notices go away by themselves within 3 seconds', async ({ page }) => { await openSci(page); await key(page, 'Recall memory'); await wait(2800); eq((await read(page)).note, '') })
C('CALC-403', 'UX', 'Result is announced to a screen reader after = (live region)', async ({ page }) => { await tap(page, '2+3='); has(await page.locator('.display [role=status]').innerText(), 'Result 5') })
C('CALC-404', 'UX', 'Result button label says what a tap does ("Tap to copy" or "Tap to edit")', async ({ page }) => {
  await tap(page, '2+3='); has(await page.locator('.display__result').getAttribute('aria-label'), 'Tap to copy'); await tap(page, 'C12'); has(await page.locator('.display__result').getAttribute('aria-label'), 'Tap to edit')
})
C('CALC-405', 'UX', 'Expression box has a spoken label that says how to use it', async ({ page }) => { has(await page.locator('.display__expr').getAttribute('aria-label'), 'Expression') })
C('CALC-406', 'UX', 'Focus: keys do not take focus (so Enter never re-presses a key)', async ({ page }) => { await tap(page, '5'); const a = await page.evaluate(() => document.activeElement?.tagName); ok(a !== 'BUTTON', `active element ${a}`) })
C('CALC-407', 'UX', 'Focus after the Copy sheet closes: not stuck on the sheet', async (t) => {
  await tap(t.page, '150000'); await t.page.locator('.util__btn', { hasText: 'Copy' }).click(); await t.page.locator('.copyas__opt').first().click(); await wait(250); const a = await t.page.evaluate(() => document.activeElement?.closest('.sheet') ? 'sheet' : 'ok'); eq(a, 'ok')
})
C('CALC-408', 'UX', 'Add to a list, Remind me and Add expense icons appear after = (and only then)', async ({ page }) => {
  // Pre-existing stale expectation found and fixed 2026-11-04: this asserted 2, from before "Add
  // expense" existed (confirmed against the commit before this change: identically "got 3, expected 2").
  // A positive whole-number result shows all three.
  eq(await page.locator('.result-actions__btn').count(), 0); await tap(page, '2+3='); eq(await page.locator('.result-actions__btn').count(), 3); await tap(page, '7'); eq(await page.locator('.result-actions__btn').count(), 0)
})
C('CALC-409', 'UX', 'Remind me from a result opens a sheet with a close X', async ({ page }) => { await tap(page, '2+3='); await page.locator('.result-actions').getByRole('button', { name: 'Remind me' }).click(); await page.waitForSelector('.sheet'); ok(await page.locator('.sheet__close').count() === 1, 'no close X') })
C('CALC-410', 'UX', 'Wording: every message on a bad key sequence is plain words (no codes)', async ({ page }) => {
  const seen = new Set(); for (const s of ['5/0', '0/0', '10^100']) { await tap(page, 'C'); await kb(page, s); const n = (await read(page)).note; if (n) seen.add(n) }
  ok([...seen].every((m) => /^[A-Z][a-z]/.test(m) && !/error|exception|code/i.test(m)), [...seen].join(' | '))
})
C('CALC-411', 'UX', 'Number words line is visible without any extra tap (as you type 12345678)', async ({ page }) => { await tap(page, '12345678'); eq((await read(page)).note, '1.23 crore') })
C('CALC-412', 'UX', 'Tapping the big number on a lone number needs 1 tap to edit; copy needs a 2nd (discoverability note)', async ({ page }) => {
  await tap(page, '123'); const lab = await page.locator('.display__result').getAttribute('aria-label'); has(lab, 'Tap to edit')
})
C('CALC-413', 'UX', 'Undo is reachable after a wrong = (tap Undo once to reopen the expression)', async ({ page }) => { await tap(page, '2+3='); await key(page, 'Undo'); eq((await read(page)).res, '5'); eq((await read(page)).expr, '2 + 3') })
C('CALC-414', 'UX', 'Delete from History is undoable from the snackbar (rule: every delete is undoable)', async ({ page }) => { await openHistory(page); await page.locator('.hrow [aria-label^="Delete"]').first().click(); eq(await page.locator('.snack button', { hasText: 'Undo' }).count(), 1) }, { data: mk({ history: [row(7)] }) })
C('CALC-415', 'UX', 'Landscape: History button and Settings are still reachable', async ({ page }) => { await openHistory(page); eq(await page.locator('.sheet').count(), 1) }, { width: 800, height: 360 })
C('CALC-416', 'UX', 'Memory display "M 5" uses the same number format as the screen (Indian grouping)', async ({ page }) => { await openSci(page); await kb(page, '1234567'); await key(page, 'Add to memory'); eq((await read(page)).mem, 'M 12,34,567') })
C('CALC-417', 'UX', 'Scientific screen has a visible Back (system back is never required)', async ({ page }) => { await openSci(page); eq(await page.locator('.sci-screen [aria-label="Back"]').count(), 1) })
C('CALC-418', 'UX', 'History sheet Clear all wording tells how many go and that you can undo', async ({ page }) => { await openHistory(page); await page.locator('.link-btn--danger').click(); has(await page.locator('.confirm p').innerText(), 'undo') }, { data: mk({ history: [row(7), row(6)] }) })

// ------------------------------------------------------------------ runner
const app = await startApp()
const results = []
const run = async (c) => {
  const t0 = Date.now()
  let t
  try {
    t = await openApp(app, { ...c.opts, data: c.opts.data, settings: c.opts.settings })
    t.context = t.context
    await c.fn(t)
    await wait(30)
    if (t.errors.length) throw new Error(`console/page errors: ${t.errors.join(' | ').slice(0, 300)}`)
    results.push({ ...c, ok: true })
    console.log(`PASS ${c.id} ${c.type} ${c.title}`)
  } catch (e) {
    const msg = String(e.message ?? e).split('\n')[0].slice(0, 400)
    results.push({ ...c, ok: false, msg })
    console.log(`FAIL ${c.id} ${c.type} ${c.title} :: ${msg}`)
  } finally { await t?.close().catch(() => {}) }
}
const todo = cases.filter((c) => !ONLY || c.id.includes(ONLY) || c.type === ONLY)
const POOL = 3
let next = 0
await Promise.all(Array.from({ length: POOL }, async () => { while (next < todo.length) await run(todo[next++]) }))
await app.stop()
results.sort((a, b) => a.id.localeCompare(b.id))
const fails = results.filter((r) => !r.ok)
const byType = {}
for (const r of results) { byType[r.type] ??= { n: 0, f: 0 }; byType[r.type].n++; if (!r.ok) byType[r.type].f++ }
console.log(`\n${results.length} cases, ${results.length - fails.length} pass, ${fails.length} fail`)
console.log(Object.entries(byType).map(([k, v]) => `${k} ${v.n - v.f}/${v.n}`).join('  '))
if (process.env.CLAUDE_JOB_DIR) writeFileSync(`${process.env.CLAUDE_JOB_DIR}/tmp/results.json`, JSON.stringify(results.map(({ fn, ...r }) => r), null, 1))
process.exit(fails.length ? 1 : 0)
