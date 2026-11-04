import { describe, expect, it } from 'vitest'
import { buildExpensesCsv, csvCell } from './csv'
import { buildCandidates, logAsText, logEntryFor, mergeLog, parseSms, type InboxMessage, type ParseLogEntry } from './smsParse'
import { starterBudget, type BudgetData } from './budget'

// QA (cross-cutting) privacy and safety. Written 2026-11-03. See docs/QA-REPORT-cross.md.

// ---------------------------------------------------------------- 200 real-shaped, fake bank messages
let seed = 20261103
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const int = (n: number) => Math.floor(rnd() * n)
const digits = (n: number) => Array.from({ length: n }, (_, i) => (i === 0 ? 1 + int(9) : int(10))).join('')
const FIRST = ['Ramesh', 'Priyanka', 'Zorbex', 'Quixotic', 'Mahendra', 'Lakshmi', 'Gurpreet', 'Anirudh', 'Thimmappa', 'Bhuvaneshwari', 'Yashwant', 'Kavitha']
const LAST = ['Sharma', 'Venkataraman', 'Traders', 'Cafe', 'Chaudhary', 'Narayanan', 'Bhattacharya', 'Kulkarni', 'Pillai', 'Mukherjee', 'Wadhwani', 'Subramanian']
const comma = (n: string) => n.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
interface Fake { msg: InboxMessage; digitRuns: string[]; words: string[] }

function fake(i: number): Fake {
  const first = FIRST[int(FIRST.length)]!
  const last = LAST[int(LAST.length)]!
  const name = `${first} ${last}`
  const whole = digits(3 + int(4))
  const amt = `${comma(whole)}.${String(int(100)).padStart(2, '0')}`
  const l4 = digits(4)
  const ref = digits(12)
  const bal = `${comma(digits(5 + int(3)))}.00`
  const phone = `9${digits(9)}`
  const date = `${String(1 + int(27)).padStart(2, '0')}-${String(1 + int(12)).padStart(2, '0')}-26`
  const handle = `${first.toLowerCase()}${digits(4)}@okhdfcbank`
  const kind = i % 5
  const body =
    kind === 0 ? `Rs.${amt} debited from a/c **${l4} on ${date} to VPA ${handle} (UPI Ref No ${ref}). Not you? Call 18002586161`
    : kind === 1 ? `Rs ${amt} debited from A/c XX${l4} for UPI to ${name}`
    : kind === 2 ? `Rs ${amt} debited from your account on ${date} for transaction ref ${ref}. Info: ${name}. Avl bal Rs ${bal}`
    : kind === 3 ? `${name} credited Rs ${amt} and your A/c XX${l4} debited. Ref ${ref}`
    : `Your account debited. For help contact ${name} on ${phone}. Ref ${ref}`
  return {
    msg: { id: 'm' + i, address: pick(['VM-HDFCBK', 'AX-ICICIB', 'AD-SBIUPI', 'JD-AXISBK']), date: Date.UTC(2026, 10, 2), body },
    digitRuns: [whole, l4, ref, phone, bal.replace(/\D/g, ''), digits4(handle)].filter((d) => d.length >= 4 && body.includes(d)),
    words: [first, last, ...(kind === 0 ? [first.toLowerCase()] : [])],
  }
}
const pick = <T,>(a: T[]): T => a[int(a.length)]!
const digits4 = (h: string) => h.replace(/\D/g, '')

const SALT = 'a-test-salt-0001'
const messages = Array.from({ length: 200 }, (_, i) => fake(i))
const strings = (e: ParseLogEntry) => [e.sender, e.template, e.outcome, JSON.stringify(e.got ?? {}), String(e.count), String(e.at)]

describe('QA-P1 the reader log holds only masked text (200 fake bank messages)', () => {
  const log = messages.flatMap((f) => {
    const e = logEntryFor(f.msg, parseSms(f.msg.body, f.msg.address), 1, SALT)
    return e ? [{ f, e }] : []
  })
  it('a good share of the messages were logged, so the checks below mean something', () => {
    expect(log.length).toBeGreaterThanOrEqual(100)
  })
  it('no input digit run of 5 or more digits (amounts, refs, phone numbers, balances) appears in any stored string', () => {
    for (const { f, e } of log) for (const run of f.digitRuns.filter((r) => r.length >= 5)) for (const s of strings(e)) expect(s).not.toContain(run)
  })
  it('4-digit runs (card tails): the fake never equals the real one more than by chance', () => {
    let same = 0, total = 0
    for (const { f, e } of log) for (const run of f.digitRuns.filter((r) => r.length === 4)) { total++; if (strings(e).some((s) => s.includes(run))) same++ }
    expect(total).toBeGreaterThan(30)
    expect(same / total).toBeLessThan(0.05)
  })
  it('no first or last name from the input appears in any stored string (case-insensitive)', () => {
    for (const { f, e } of log) for (const w of f.words) for (const s of strings(e)) expect(s.toLowerCase()).not.toContain(w.toLowerCase())
  })
  it('the share-as-text form of the whole log leaks nothing either', () => {
    const text = logAsText(log.map((x) => x.e)).toLowerCase()
    for (const { f } of log) {
      for (const w of f.words) expect(text).not.toContain(w.toLowerCase())
      for (const run of f.digitRuns.filter((r) => r.length >= 5)) expect(text).not.toContain(run)
    }
  })
  it('the stored template is capped in length', () => {
    for (const { e } of log) expect(e.template.length).toBeLessThanOrEqual(400)
  })
  it('after merging, still only masked text, never more than 200 entries', () => {
    const merged = mergeLog([], log.map((x) => x.e))
    expect(merged.length).toBeLessThanOrEqual(200)
    for (const e of merged) for (const s of strings(e)) for (const { f } of log.slice(0, 20)) for (const w of f.words) expect(s.toLowerCase()).not.toContain(w.toLowerCase())
  })
  it('a phone number as the sender is never stored (only letter-style senders may be)', () => {
    const m = { id: 'p', address: '+919876543210', date: 1, body: 'Rs 500 debited from your account. Info: Some Body' }
    const e = logEntryFor(m, parseSms(m.body, m.address), 1, SALT)
    expect(e === null || !/\d{5,}/.test(e.sender)).toBe(true)
  })
  it('buildCandidates: the scan result keeps no message text anywhere except as masked log entries', () => {
    const budget = starterBudget()
    const r = buildCandidates(messages.map((f) => f.msg), budget, () => null, SALT)
    const dump = JSON.stringify({ skipped: r.skipped, alreadySeen: r.alreadySeen, log: r.log })
    for (const f of messages) for (const w of f.words.filter((x) => x.length > 4)) expect(dump.toLowerCase()).not.toContain(w.toLowerCase())
    for (const c of r.found) for (const v of Object.values(c)) expect(String(v)).not.toMatch(/Ref|debited|Not you/i)
  })
})

describe('QA-P2 spreadsheet formula injection in the CSV export', () => {
  const evil = ['=1+1', '+1+1', '-1+1', '@SUM(A1)', '\t=1', '\r=1', '=HYPERLINK("http://x","y")', '=cmd|\' /C calc\'!A0']
  it.each(evil)('csvCell(%j) starts with an apostrophe or is quoted so a spreadsheet will not run it', (t) => {
    const cell = csvCell(t)
    const inner = cell.startsWith('"') ? cell.slice(1) : cell
    expect(inner.startsWith("'")).toBe(true)
  })
  it('note, category, card and mode columns are all escaped in a full export', () => {
    const b: BudgetData = {
      ...starterBudget(),
      categories: [{ id: 'k', name: '=CAT()', limit: null, parentId: null, deletedAt: null }],
      instruments: [{ id: 'i', name: '@CARD', kind: 'wallet', network: null, bank: '+BANK', last4: '', rewardNote: '', deletedAt: null }],
      expenses: [{ id: 'e', date: '2026-11-01', amount: '10', categoryId: 'k', mode: 'wallet', instrumentId: 'i', note: '=2+3', deletedAt: null }],
    }
    const csv = buildExpensesCsv(b, 'all', new Date(2026, 10, 3))
    const row = csv.split('\r\n')[1]!
    for (const cell of ['=CAT()', '=2+3', '@CARD', '+BANK']) {
      expect(row).not.toMatch(new RegExp(`(^|,)"?${cell.replace(/[()+@=]/g, '\\$&')}`))
    }
    expect(row).toContain("'=2+3")
  })
  it('a note with quotes, commas and line breaks stays one cell', () => {
    expect(csvCell('a "b", c\nd')).toBe('"a ""b"", c\nd"')
  })
})
