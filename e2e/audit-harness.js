/**
 * UI audit harness. Paste this whole file into a browser console (or a browser tool) on a page served from the
 * built app, e.g. `npm run build && npm run preview -- --port 4173`, then open http://localhost:4173/ and run it.
 * It needs no install: it mounts the app in a 360px-wide iframe, opens every page, and checks each one for the
 * layout bugs that unit tests cannot see. Written 2026-11-02; see docs/TESTING.md section 2.
 *
 *   await runChunk(0, 13)               // calculators 0..12, normal font      -> "Findings: none" when clean
 *   await runChunk(0, 13, {}, '200%')   // the same at 200% font size
 *   await runChunk(0, 13, { theme: 'light' })
 *   await A.pageSweep(['calc-idle', 'settings', 'notes'], null)         // app pages, see PAGES below
 *   await A.pageSweep(Object.keys(PAGES).slice(0, 7), '200%')
 *
 * Run in chunks of about 13 pages: a browser tool gives up after 45 seconds.
 * What it checks, per page: sideways scrolling, anything off the right edge, cut-off text, controls under 44px,
 * controls with no name, "NaN" or "undefined" on screen, money that wraps, empty headings or buttons.
 * Known false alarms: the invisible backup file input in Settings; a text value that wraps on purpose.
 */
window.IDS = ['percentage', 'number-base', 'discount', 'gst', 'unit-price', 'tip', 'currency', 'unit-converter', 'fuel-efficiency', 'fuel-cost', 'date', 'world-time', 'body-metrics', 'ovulation', 'grade-average', 'emi', 'amortisation', 'reverse-emi', 'prepayment', 'rate-change', 'balance-transfer', 'loan-compare', 'card-emi', 'home-loan-tax', 'simple-compound', 'loan-presets', 'sip', 'step-up-sip', 'lumpsum', 'goal-sip', 'fd', 'rd', 'ppf', 'nps', 'epf', 'swp', 'inflation', 'cagr-xirr', 'income-tax', 'advance-tax', 'capital-gains', 'presumptive-44ada', 'in-hand-salary', 'gratuity', 'cac-ltv', 'cac-payback', 'retention', 'funnel', 'arr-mrr', 'rule-of-40', 'ab-sample-size']

window.A = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  /** A fresh app in a 360px iframe, with the given settings and stored data. The old page must close first, or it overwrites the new data as it saves. */
  async mount(settings = {}, extra = {}) {
    document.body.innerHTML = ''
    await A.sleep(250)
    localStorage.setItem('vkcalc.data', JSON.stringify({ schemaVersion: 2, settings, history: [], cards: [], reminders: [], memory: null, input: { expr: '', fresh: false }, ...extra }))
    const f = document.createElement('iframe')
    f.style.cssText = 'width:360px;height:720px;border:1px solid #444;display:block;margin:0 auto'
    f.src = '/'
    document.body.appendChild(f)
    await new Promise((r) => (f.onload = r))
    await A.sleep(650)
    A.f = f; A.d = f.contentDocument; A.w = f.contentWindow
    return A.d
  },
  top() { const s = A.d.querySelectorAll('.screen'); return s.length ? s[s.length - 1] : A.d.querySelector('.app__body') },
  check(root) {
    const d = A.d, w = A.w, vw = w.innerWidth, out = []
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    if (/NaN|Infinity|undefined|\[object/.test(root.textContent)) out.push('BADTEXT')
    if (d.documentElement.scrollWidth > vw + 1) out.push('PAGE-HSCROLL')
    const all = [...root.querySelectorAll('*')].filter(vis)
    const hs = all.filter((e) => { const cs = w.getComputedStyle(e); return (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && e.scrollWidth > e.clientWidth + 1 })
    if (hs.length) out.push('HSCROLL:' + hs.slice(0, 2).map((e) => e.className || e.tagName).join(','))
    const off = all.filter((e) => e.getBoundingClientRect().right > vw + 1 && !e.closest('.sr-only') && w.getComputedStyle(e).position !== 'fixed')
    if (off.length) out.push('OFFSCREEN:' + off.slice(0, 2).map((e) => (e.className || e.tagName) + '@' + Math.round(e.getBoundingClientRect().right)).join(','))
    const clip = all.filter((e) => w.getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1 && !e.classList.contains('sr-only'))
    if (clip.length) out.push('CLIPPED:' + clip.slice(0, 2).map((e) => e.textContent.trim().slice(0, 24)).join('|'))
    const sel = 'button,a[href],input:not([type=hidden]),select,textarea,summary,[role=radio],[role=switch]'
    const ctl = [...root.querySelectorAll(sel)].filter(vis)
    const small = ctl.filter((e) => { let r = e.getBoundingClientRect(); const l = e.closest('label'); if (l && e.type === 'checkbox') r = l.getBoundingClientRect(); return r.width < 44 && r.height < 44 && !e.classList.contains('sr-only') })
    if (small.length) out.push('SMALLTAP:' + small.slice(0, 3).map((e) => (e.getAttribute('aria-label') || e.textContent.trim() || e.className).slice(0, 18)).join('|'))
    const nameOf = (e) => e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.title || e.textContent.trim() || (e.id && d.querySelector('label[for="' + e.id + '"]')) || (e.closest('label') && e.closest('label').textContent.trim()) || e.placeholder
    const nn = ctl.filter((e) => !nameOf(e))
    if (nn.length) out.push('NONAME:' + nn.slice(0, 3).map((e) => e.tagName + '.' + e.className).join('|'))
    const money = [...root.querySelectorAll('.result__value:not(.result__value--text),.answer__value,.rowcard__cell dd,.kv__v,.tape__sum,.tolist__sum')].filter(vis)
    const wr = money.filter((e) => { const cs = w.getComputedStyle(e); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4; return e.getBoundingClientRect().height > lh * 1.6 })
    if (wr.length) out.push('MONEYWRAP:' + wr.slice(0, 2).map((e) => e.textContent.trim().slice(0, 20)).join('|'))
    const empt = [...root.querySelectorAll('h1,h2,h3,button')].filter((e) => vis(e) && !e.textContent.trim() && !e.getAttribute('aria-label') && !e.querySelector('svg'))
    if (empt.length) out.push('EMPTY:' + empt.length)
    return out
  },
  async sweepTools(from, to, settings = {}, zoom) {
    const res = []
    for (let i = from; i < Math.min(to, IDS.length); i++) {
      await A.mount({ startupTool: IDS[i], ...settings })
      if (zoom) A.d.documentElement.style.fontSize = zoom
      await A.sleep(300)
      const r = A.top()
      const f = r ? A.check(r) : ['NO-SCREEN']
      if (!A.d.querySelector('.keep')) f.push('NO-KEEP-SECTION')
      if (!r.querySelector('header.screen__bar')) f.push('NO-SHARED-HEADER')
      if (f.length) res.push(IDS[i] + ' - ' + f.join(' ; ').replace(/[=?&@]/g, '~'))
    }
    return res
  },
}
window.runChunk = async (a, b, settings, zoom) => 'checked ' + (b - a) + '. Findings: ' + ((await A.sweepTools(a, b, settings, zoom)).join(' // ') || 'none')

// Realistic stored data, so Notes, Due, History and the sheets have something to show.
const DAY = 86400000, now = Date.now()
const card = (id, title, kind, extra) => ({ id, title, kind, toolId: kind === 'tool' ? 'emi' : null, inputs: kind === 'tool' ? {} : null, summary: '', amount: null, lines: [], note: '', tags: [], pinned: false, createdAt: now, updatedAt: now, deletedAt: null, ...extra })
const L = (n, done) => ({ id: 'l' + n, label: 'Friend ' + n, value: '1000', ...(done ? { done: true } : {}) })
window.DATA = {
  history: [{ id: 'h1', expression: '52+5', result: '57', at: now - 9e5 }, { id: 'h2', expression: '1152*52', result: '59904', at: now - 8e5, name: 'Rent for the year' }],
  cards: [
    card('c1', 'Trip split', 'tape', { pinned: true, checklist: true, tags: ['Travel'], summary: '2 of 5 done, ₹3,000.00 left', amount: '5000', lines: [L(1, 1), L(2, 1), L(3), L(4), L(5)] }),
    card('c2', 'Groceries', 'tape', { summary: '3 lines, total ₹1,240.00', amount: '1240', lines: [{ id: 'g1', label: 'Milk', value: '120' }, { id: 'g2', label: 'Rice', value: '900' }, { id: 'g3', label: 'Tea', value: '220' }] }),
    card('c3', 'Home loan EMI', 'tool', { summary: 'Monthly EMI: ₹43,391.16', amount: '43391.16', tags: ['Loan'] }),
    card('c4', 'Credit card bill', 'tape', { summary: '1 line, total ₹18,450.00', amount: '18450', tags: ['Credit Card'], lines: [{ id: 'k1', label: '', value: '18450' }] }),
    card('c5', 'Old note', 'tape', { summary: '1 line', amount: '5', lines: [{ id: 'o1', label: 'x', value: '5' }], deletedAt: now - DAY }),
  ],
  reminders: [
    { id: 'r1', cardId: 'c3', dueAt: now - 2 * DAY, repeat: 'monthly', anchorDay: 5, leadDays: 3, done: false, history: [] },
    { id: 'r2', cardId: 'c4', dueAt: now + 3 * DAY, repeat: 'monthly', anchorDay: 5, leadDays: 3, done: false, history: [] },
  ],
}

const q = (s, t) => [...A.d.querySelectorAll(s)].find((e) => !t || e.textContent.includes(t))
const click = async (s, t) => { const e = q(s, t); if (!e) throw new Error('no ' + s + ' ' + (t || '')); e.click(); await A.sleep(450) }
const press = async (...ks) => { for (const n of ks) { [...A.d.querySelectorAll('.keypad .key')].find((b) => b.getAttribute('aria-label') === n).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })); await A.sleep(50) } }
const tab = (n) => click('.tab', n)
window.PAGES = {
  'calc-idle': async () => A.d.querySelector('.calc'),
  'calc-result': async () => { await press('5', '0', '0', '0', 'Divide', '5', 'Equals'); await A.sleep(300); return A.d.querySelector('.calc') },
  'history-sheet': async () => { await click('button[aria-label="History"]'); return A.d.querySelector('.sheet') },
  'settings': async () => { await click('button[aria-label="Settings"]'); return A.top() },
  'scientific': async () => { await tab('Tools'); await click('.hero'); return A.top() },
  'tools-home': async () => { await tab('Tools'); return A.d.querySelector('.tools') },
  'tools-search': async () => { await tab('Tools'); const i = A.d.querySelector('.tools__search input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'loan'); i.dispatchEvent(new Event('input', { bubbles: true })); await A.sleep(300); return A.d.querySelector('.tools') },
  'notes': async () => { await tab('Notes'); return A.d.querySelector('.tools') },
  'notes-list-open': async () => { await tab('Notes'); await click('.row__main', 'Trip split'); return A.top() },
  'notes-calc-open': async () => { await tab('Notes'); await click('.row__main', 'Home loan'); return A.top() },
  'notes-new-list': async () => { await tab('Notes'); await click('.link-btn', 'New list'); return A.top() },
  'notes-trash': async () => { await tab('Notes'); await click('.link-btn', 'Trash'); return A.top() },
  'due': async () => { await tab('Due'); return A.d.querySelector('.tools') },
  'save-sheet': async () => { await tab('Tools'); await click('.tile', 'Loans'); await click('.navrow', 'Loan EMI'); await click('.link-btn', 'Save'); return A.d.querySelector('.sheet') },
  'tolist-sheet': async () => { await press('5', '0', '0', '0', 'Divide', '5', 'Equals'); await click('.chip', 'To list'); return A.d.querySelector('.sheet') },
  'remind-sheet': async () => { await press('5', '0', '0', '0', 'Divide', '5', 'Equals'); await click('.chip', 'Remind me'); return A.d.querySelector('.sheet') },
  'paste-sheet': async () => { await click('.util__btn', 'Paste'); await A.sleep(600); return A.d.querySelector('.sheet') || A.d.querySelector('.calc') },
}
for (let g = 1; g <= 8; g++) PAGES['group-' + g] = async () => { await tab('Tools'); A.d.querySelectorAll('.tile')[g - 1].click(); await A.sleep(450); return A.top() }

A.pageSweep = async (keys, zoom, withData = true) => {
  const out = []
  for (const k of keys) {
    try {
      await A.mount({}, withData ? DATA : {})
      if (zoom) A.d.documentElement.style.fontSize = zoom
      await A.sleep(200)
      const root = await PAGES[k]()
      if (zoom) A.d.documentElement.style.fontSize = zoom
      await A.sleep(200)
      const f = A.check(root)
      if (f.length) out.push(k + ' - ' + f.join(' ; ').replace(/[=?&@]/g, '~'))
    } catch (e) { out.push(k + ' - SCRIPT-ERROR ' + e.message) }
  }
  return out.length ? out.join(' // ') : 'no findings'
}
'harness ready: ' + IDS.length + ' calculators, ' + Object.keys(PAGES).length + ' pages'
