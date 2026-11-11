// Phone test for SMS capture, run against the SEPARATE "Calc QA" app (com.vaibhavkumawat.vkcalc.qa) with FAKE messages only.
// Read docs/PHONE-TESTING-GUIDE.md first. Usage (from the repo root, phone connected over adb):
//   mkdir -p /tmp/phone-out && node scripts/phone-qa/phonetest.mjs /tmp/phone-out
// SAFETY: the QA app must be EMPTY (clear its data in Android settings: adb `pm clear` is refused on this phone).
// Screenshots come from inside the QA WebView only (never the device screen). Never run this against the real Calc app.
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const A = process.env.HOME + '/Library/Android/sdk/platform-tools/adb'
const QA = 'com.vaibhavkumawat.vkcalc.qa'
const OUT = process.argv[2]
const sh = (c) => execFileSync(A, ['shell', c], { encoding: 'utf8' })
let CUR = null
const snap = async (n) => { try { writeFileSync(`${OUT}/${n}.png`, await CUR.screenshot()) } catch {} }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fails++ }
const dump = async (page, label) => { const tx = await page.evaluate(() => document.body.innerText); console.log('   [' + label + '] ' + tx.split('\n').filter(Boolean).length + ' lines; has an entry list: ' + /Recent entries/.test(tx)) }
const connect = async () => {
  const pid = sh(`pidof ${QA}`).trim()
  try { execFileSync(A, ['forward', '--remove', 'tcp:9333']) } catch {}
  execFileSync(A, ['forward', 'tcp:9333', `localabstract:webview_devtools_remote_${pid}`])
  const b = await chromium.connectOverCDP('http://127.0.0.1:9333')
  const page = b.contexts()[0].pages()[0]
  CUR = page
  await page.waitForSelector('.app', { timeout: 15000 })
  return { b, page }
}
const text = (page) => page.evaluate(() => document.body.innerText)
// native dialog: tap "Allow" if a permission dialog is on screen
const tapAllow = () => {
  for (let i = 0; i < 4; i++) {
    execFileSync(A, ['shell', 'uiautomator dump /sdcard/ui.xml >/dev/null 2>&1'])
    const xml = sh('cat /sdcard/ui.xml')
    const m = xml.match(/text="(Allow|ALLOW|Allow all the time|While using the app)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
    if (m) { sh(`input tap ${Math.round((+m[2] + +m[4]) / 2)} ${Math.round((+m[3] + +m[5]) / 2)}`); return m[1] }
  }
  return null
}

let { b, page } = await connect()
await page.waitForTimeout(800)
await page.locator('.tabbar .tab', { hasText: 'Budget' }).click(); await page.waitForTimeout(600)
let t = await text(page)
check(/Catch bank payments automatically/.test(t), 'T1 Budget home shows the "Catch bank payments automatically" row with capture off'); if (!/Catch bank payments automatically/.test(t)) await dump(page, 'budget')
await snap('1-budget-home')
await page.getByText('Catch bank payments automatically').first().click(); await page.waitForTimeout(800)
t = await text(page)
check(/Capture bank messages\?/.test(t) && /Allow messages/.test(t) && /What is read/.test(t), 'T2 the explanation screen appears BEFORE any Android dialog')
await snap('2-explainer')
await page.getByRole('button', { name: 'Allow messages' }).click(); await page.waitForTimeout(1500)
const tapped = tapAllow(); console.log('native dialog tapped:', tapped)
await sleep(1500)
await snap('3-after-allow')
t = await text(page)
console.log('after allow text contains Capture/Review:', /To review|Nothing waiting|Capture/.test(t))
await b.close()

// --- inject FAKE bank messages (synthetic) into the QA app only, with the app in the background
sh('input keyevent KEYCODE_HOME'); await sleep(800)
const today = new Date(); const d = String(today.getDate()).padStart(2, '0') + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getFullYear()).slice(2)
const msgs = [
  ['HDFCBK', `Rs.450.00 debited from HDFC Bank Card x4321 at SWIGGY BANGALORE on ${d}. Avl Lmt Rs.1,48,750.00. Not you? Call 18002586161`],
  ['HDFCBK', `Rs.320.50 debited from HDFC Bank Card x4321 at SWIGGY BANGALORE on ${d}. Avl Lmt Rs.1,48,429.50. Not you? Call 18002586161`],
  ['HDFCBK', `Rs.1,200.00 debited from HDFC Bank Card x4321 at AMAZON PAY INDIA on ${d}. Avl Lmt Rs.1,47,229.50. Not you? Call 18002586161`],
  ['HDFCBK', `Rs.799.00 debited from HDFC Bank Card x4321 at AMAZON PAY INDIA on ${d}. Avl Lmt Rs.1,46,430.50. Not you? Call 18002586161`],
  ['ICICIB', `Rs 150.00 sent via UPI from ICICI Bank A/c *9087 to RAHUL SHARMA rahul.s@okaxis on ${d}. UPI Ref 631245987012. Not you? Call 18002662`],
  ['HDFCBK', 'Your OTP for transaction is 482913. Do not share. -HDFC Bank'],
  ['VM-AMZNDL', 'Big sale! Up to 70% off. Shop now'],
  ['+919812345678', 'Hi, can you send me Rs.500 tomorrow?'],
]
let n = 0
for (const [s, body] of msgs) { sh(`am broadcast -n ${QA}/com.vaibhavkumawat.vkcalc.SmsDebugReceiver --es op inject --es sender '${s}' --es body '${body.replace(/'/g, '')}' --el at ${Date.now() + n++} >/dev/null 2>&1`) }
const cnt = sh(`am broadcast -n ${QA}/com.vaibhavkumawat.vkcalc.SmsDebugReceiver --es op count`)
console.log('queue after injection:', (cnt.match(/data="?([^"\n]*)/) || [])[1] || cnt.split('\n').slice(-3).join(' | '))

// --- reopen the app: it drains the queue into the Inbox
sh(`am force-stop ${QA}`); sh(`monkey -p ${QA} -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1`); await sleep(5000)
;({ b, page } = await connect()); await page.waitForTimeout(1500)
await page.locator('.tabbar .tab', { hasText: 'Budget' }).click(); await page.waitForTimeout(800)
t = await text(page)
const m = t.match(/(\d+) to review/)
check(!!m, `T3 Budget home shows "N to review" after messages arrived while the app was closed (${m ? m[0] : 'not found'})`)
await snap('4-budget-waiting')
await page.getByText(/\d+ to review/).first().click(); await page.waitForTimeout(1000)
t = await text(page)
await snap('5-inbox')
check(/Swiggy/i.test(t) && /Amazon/i.test(t), 'T4 Inbox lists the Swiggy and Amazon payments')
check(/×\s?2|x\s?2/i.test(t), 'T5 repeat payees are clubbed ("Swiggy ×2", "Amazon Pay ×2")')
check(/Not sure/i.test(t), 'T6 a "Not sure" section exists for items without a category')
check(!/482913|70% off|send me Rs/.test(t), 'T7 the OTP, the promo and the personal chat never reach the Inbox')
check(/Rahul/i.test(t), 'T8 the UPI-to-a-person payment is in the Inbox (never auto-added)')
console.log('--- Inbox text (fake data only):\n' + t.split('\n').filter(Boolean).slice(0, 40).join(' | ').slice(0, 900))
await b.close()
console.log(fails === 0 ? 'ALL CHECKS PASSED' : `${fails} CHECK(S) FAILED`)
