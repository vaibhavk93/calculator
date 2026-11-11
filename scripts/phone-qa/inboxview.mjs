// Prints the visible text of the Inbox screen in the QA app (aborts if the QA app has entries, so real data is never printed)
// and saves a screenshot taken from inside the QA WebView. Usage: node scripts/phone-qa/inboxview.mjs /tmp/phone-out
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const A = process.env.HOME + '/Library/Android/sdk/platform-tools/adb'
const pid = execFileSync(A, ['shell', 'pidof com.vaibhavkumawat.vkcalc.qa'], { encoding: 'utf8' }).trim()
try { execFileSync(A, ['forward', '--remove', 'tcp:9333']) } catch {}
execFileSync(A, ['forward', 'tcp:9333', `localabstract:webview_devtools_remote_${pid}`])
const b = await chromium.connectOverCDP('http://127.0.0.1:9333')
const page = b.contexts()[0].pages()[0]
const base = await page.evaluate(() => document.body.innerText)
if (/Recent entries/.test(base)) { console.log('ABORT: QA has entries, not printing'); await b.close(); process.exit(1) }
if (!/Waiting for you/.test(base)) { await page.getByText(/\d+ to review/).first().click(); await page.waitForTimeout(1200) }
const t = await page.evaluate(() => { const s = document.querySelector('.screen'); return (s ? s.innerText : document.body.innerText) })
console.log(t.split('\n').filter(Boolean).join(' | ').slice(0, 1800))
writeFileSync(process.argv[2] + '/inbox-phone.png', await page.screenshot())
await b.close()
