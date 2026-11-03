import { instrumentFitsMode, MAX_AMOUNT, type BudgetData } from './budget'
import { D } from '../engine/decimal'
import { alreadyAdded, fingerprint, guessCategory, modeFor, type Candidate, type ParsedSms, type ScanResult } from './smsParse'

/**
 * Reads a bank or card statement saved as CSV (picked with the file chooser: no permission needed) into the same review
 * list as bank messages. Runs on the phone; the file is not kept. Fails closed: a row whose date or amount is unclear is counted
 * as "not read", never guessed. PDF statements are not supported yet (every bank lays them out differently).
 */

/** Splits CSV text into rows of cells. Handles quotes, escaped quotes, commas or semicolons or tabs, and CRLF. */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '')
  const first = t.split(/\r?\n/, 1)[0] ?? ''
  const sep = [',', ';', '\t'].map((s) => [s, first.split(s).length] as const).sort((a, b) => b[1] - a[1])[0]![0]
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++ } else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === sep) { row.push(cell.trim()); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++
      row.push(cell.trim())
      cell = ''
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell.trim())
  if (row.some((c) => c !== '')) rows.push(row)
  return rows
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** "02/11/2026", "02-11-26", "2 Nov 2026", "2026-11-02" -> "2026-11-02". Day first (Indian statements). Null when unclear. */
export function parseStatementDate(raw: string): string | null {
  const s = raw.trim().replace(/\s+\d{1,2}:\d{2}.*$/, '')
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s)
  const dmy = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2}|\d{4})$/.exec(s)
  const named = /^(\d{1,2})[-/. ]([A-Za-z]{3})[a-z]*[-/. ,]*(\d{2}|\d{4})$/.exec(s)
  let y: number, m: number, d: number
  if (iso) { y = +iso[1]!; m = +iso[2]!; d = +iso[3]! }
  else if (dmy) { d = +dmy[1]!; m = +dmy[2]!; y = +dmy[3]! }
  else if (named) { d = +named[1]!; m = MONTHS.indexOf(named[2]!.toLowerCase()) + 1; y = +named[3]! }
  else return null
  if (y < 100) y += 2000
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000) return null
  const probe = new Date(y, m - 1, d)
  if (probe.getMonth() !== m - 1) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const money = (raw: string): string | null => {
  const t = raw.replace(/[,₹\s]|rs\.?|inr/gi, '')
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null
  const v = new D(t)
  if (v.isZero() || v.gt(MAX_AMOUNT)) return null
  return t.includes('.') ? v.toFixed(2) : v.toFixed(0)
}

interface Columns { date: number; text: number; debit: number; credit: number; amount: number; drcr: number; ref: number }

const find = (head: string[], re: RegExp) => head.findIndex((h) => re.test(h))

/** Finds the header row and which column is what. Null when it does not look like a statement. */
export function findColumns(rows: string[][]): { at: number; cols: Columns } | null {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const head = rows[i]!.map((h) => h.toLowerCase())
    const cols: Columns = {
      date: find(head, /^(txn |transaction |value |posting )?date\b|^date$/),
      text: find(head, /narration|description|particulars|details|remarks|merchant/),
      debit: find(head, /debit|withdrawal|\bdr\b.*amount|paid out/),
      credit: find(head, /credit|deposit|paid in/),
      amount: find(head, /^amount|amount \(inr\)|^amt/),
      drcr: find(head, /^(dr\/cr|cr\/dr|type|debit\/credit)$/),
      ref: find(head, /ref|chq|cheque|utr/),
    }
    if (cols.date >= 0 && cols.text >= 0 && (cols.debit >= 0 || cols.amount >= 0)) return { at: i, cols }
  }
  return null
}

/** The payee out of a statement line like "UPI/312345678901/SWIGGY/okhdfc" or "POS 1234XX5678 AMAZON PAY". */
export function merchantFromNarration(n: string): string {
  const parts = n.split(/[\/|]/).map((p) => p.trim()).filter(Boolean)
  const upi = /^UPI/i.test(n) ? parts.find((p, i) => i > 0 && !/^\d+$/.test(p) && !/^(P2[MP]|upi|payment|ok\w*|ybl|ibl|axl|paytm)$/i.test(p)) : undefined
  const raw = (upi ?? n).replace(/\b(POS|ECOM|PUR|IMPS|NEFT|ACH|INB|MB|BIL|BILLPAY)\b/gi, ' ').replace(/\b\d*[x*]{2,}\d*\b|\b\d{6,}\b/gi, ' ').replace(/\s+/g, ' ').trim()
  const t = raw.length > 40 ? raw.slice(0, 40).trim() : raw
  return t === t.toUpperCase() || t === t.toLowerCase() ? t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : t
}

export type StatementResult = { ok: true; result: ScanResult & { total: number } } | { ok: false; message: string }

/**
 * Turns statement text into review candidates. `instrumentId` is the card or account the statement belongs to, chosen by
 * the user (a CSV does not say which one it is). Only money-out rows are offered; money in is counted.
 */
export function buildStatementCandidates(
  text: string,
  budget: BudgetData,
  instrumentId: string | null,
  suggest: (note: string) => { categoryId: string | null } | null,
): StatementResult {
  const rows = parseCsv(text)
  if (rows.length < 2) return { ok: false, message: 'That file is empty or is not a CSV statement.' }
  const found = findColumns(rows)
  if (!found) return { ok: false, message: 'Could not find the Date, Description and Debit (or Amount) columns. Save the statement as CSV from your bank site and try again.' }
  const { at, cols } = found
  const inst = instrumentId ? budget.instruments.find((i) => i.id === instrumentId && i.deletedAt === null) ?? null : null
  const seen = new Set(budget.smsSeen ?? [])
  const out: Candidate[] = []
  const inList = new Set<string>()
  const skipped: ScanResult['skipped'] = {}
  let alreadySeen = 0
  let total = 0
  for (const r of rows.slice(at + 1)) {
    const date = parseStatementDate(r[cols.date] ?? '')
    const narration = r[cols.text] ?? ''
    if (!date && !narration) continue
    total++
    let amount: string | null = null
    let isDebit: boolean | null = null
    if (cols.debit >= 0 || cols.credit >= 0) {
      const d = cols.debit >= 0 ? money(r[cols.debit] ?? '') : null
      const c = cols.credit >= 0 ? money(r[cols.credit] ?? '') : null
      if (d && !c) { amount = d; isDebit = true } else if (c && !d) { amount = c; isDebit = false }
    } else if (cols.amount >= 0) {
      const raw = (r[cols.amount] ?? '').trim()
      amount = money(raw.replace(/^-/, '').replace(/\s*(dr|cr)\.?$/i, ''))
      const tag = cols.drcr >= 0 ? (r[cols.drcr] ?? '').toLowerCase() : /\bcr\.?$/i.test(raw) ? 'cr' : /\bdr\.?$/i.test(raw) || raw.startsWith('-') ? 'dr' : ''
      isDebit = /^d|debit|\bdr\b/.test(tag) ? true : /^c|credit|\bcr\b/.test(tag) ? false : null
    }
    if (!date || !amount || isDebit === null) { skipped['no-amount'] = (skipped['no-amount'] ?? 0) + 1; continue }
    if (!isDebit) { skipped.credit = (skipped.credit ?? 0) + 1; continue }
    const merchant = merchantFromNarration(narration)
    const ref = cols.ref >= 0 ? (r[cols.ref] ?? '').replace(/\D/g, '') : ''
    const p: ParsedSms = { ok: true, source: null, kind: /credit card|cc payment|card bill|billdesk|autopay/i.test(narration) ? 'cardBill' : 'spend', amount, last4: null, merchant, mode: /^upi/i.test(narration) ? 'upi' : null, bank: null, ref: ref.length >= 9 ? ref : null }
    const id = fingerprint(p, date)
    if (seen.has(id)) { alreadySeen++; continue }
    if (inList.has(id)) continue
    inList.add(id)
    const cand: Candidate = {
      id, date, amount, merchant, kind: p.kind,
      mode: inst ? modeFor(p, inst) : p.mode === 'credit' || p.mode === 'debit' ? null : p.mode,
      instrumentId: inst && (p.mode === null || p.mode === 'upi' ? true : instrumentFitsMode(p.mode, inst)) ? inst.id : null,
      bank: null, last4: null, source: null,
      categoryId: p.kind === 'spend' ? ((merchant ? suggest(merchant)?.categoryId : null) ?? guessCategory(budget, `${merchant} ${narration}`)) : null,
      duplicateOfExisting: false,
    }
    cand.duplicateOfExisting = alreadyAdded(budget, cand)
    out.push(cand)
  }
  return { ok: true, result: { found: out, skipped, alreadySeen, log: [], total } }
}
