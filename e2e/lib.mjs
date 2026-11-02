// Shared helpers for the browser tests. Uses the Chrome already installed on this Mac (no download).
// Usage in a test file:
//   import { startApp, openApp, defaultData } from './lib.mjs'
//   const app = await startApp()                       // builds and serves the current code once
//   const { page, errors, close } = await openApp(app, { data: {...}, theme: 'light', font: 200 })
//   ... drive `page` with Playwright, then check `errors` (console errors and page errors) ...
//   await app.stop()
import { chromium } from 'playwright-core'
import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

/** Builds the app into a temp folder and serves it. `port` is random unless given. */
export async function startApp({ port = 4200 + Math.floor(Math.random() * 500), build = true } = {}) {
  const out = mkdtempSync(join(tmpdir(), 'calc-e2e-'))
  if (build) execFileSync('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir'], { cwd: ROOT, stdio: 'ignore' })
  const server = spawn('npx', ['vite', 'preview', '--outDir', out, '--port', String(port), '--host', '127.0.0.1', '--strictPort'], { cwd: ROOT, stdio: 'ignore' })
  const url = `http://127.0.0.1:${port}/`
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(url)).ok) break } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  return { url, browser, async stop() { await browser.close(); server.kill() } }
}

/** A new page at phone size with optional stored data (written before the app starts), theme and font scale. */
export async function openApp(app, { data = null, settings = {}, width = 360, height = 790, font = 100, theme = null, locale = 'en-IN', timezone = 'Asia/Kolkata', now = null } = {}) {
  const context = await app.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale, timezoneId: timezone })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 300)}`) })
  const stored = data ?? { schemaVersion: 3, settings: { ...(theme ? { theme } : {}), ...settings }, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false } }
  await page.addInitScript(([d, f, fixed]) => {
    try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('vkcalc.data', JSON.stringify(d)); localStorage.setItem('__seeded', '1') } } catch {}
    if (f !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = f + '%' })
    if (fixed) { const T = fixed; const RealDate = Date; globalThis.Date = class extends RealDate { constructor(...a) { if (a.length === 0) super(T); else super(...a) } static now() { return T } } }
  }, [stored, font, now])
  await page.goto(app.url)
  await page.waitForSelector('.app', { timeout: 10000 })
  return { page, errors, context, async close() { await context.close() } }
}

/** Taps a tab by its label. */
export const tab = (page, name) => page.locator('.tabbar .tab', { hasText: name }).click()

/** Presses calculator keys by their accessible names: '7', 'Add', 'Multiply', 'Equals', 'Clear'... */
export async function keys(page, ...names) { for (const n of names) await page.locator(`.key[aria-label="${n}"]`).click() }

/** Everything visible overflowing the viewport sideways, as a list of short descriptions. */
export const overflowing = (page) => page.evaluate(() => {
  const W = document.documentElement.clientWidth, out = []
  document.querySelectorAll('.app *').forEach((el) => {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return
    if ((r.right > W + 1 || r.left < -1) && !el.closest('.sr-only')) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} ${Math.round(r.left)}..${Math.round(r.right)}`)
  })
  return [...new Set(out)].slice(0, 8)
})

/** Reads stored app data (the same JSON the app saves). */
export const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('vkcalc.data') || 'null'))
