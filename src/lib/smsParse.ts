import { dayKey, instrumentFitsMode, MAX_AMOUNT, type BudgetData, type PayInstrument, type PaymentModeId } from './budget'
import { D } from '../engine/decimal'

/**
 * Reads ONE bank text message into a possible expense. Everything here runs on the phone; nothing is sent anywhere
 * and the message text is never stored (only a short fingerprint, see `fingerprint`).
 *
 * It fails closed: when the amount, or whether money went out, is not certain, the message is NOT turned into an
 * expense. It comes back as a reason ("credit", "unsure"...) so the review screen can say it was skipped.
 * Bank texts change format without notice, so a wrong guess is worse than a skipped message.
 */

export type SmsKind = 'spend' | 'cardBill'
export type SkipReason = 'otp' | 'credit' | 'no-amount' | 'not-a-payment' | 'unsure'

export interface ParsedSms {
  ok: true
  kind: SmsKind
  amount: string
  /** Last 3 or 4 digits of the card or account named in the message. */
  last4: string | null
  merchant: string
  mode: PaymentModeId | null
  bank: string | null
  ref: string | null
}
export interface SkippedSms {
  ok: false
  reason: SkipReason
}

const BANKS: [RegExp, string][] = [
  [/hdfc/i, 'HDFC Bank'], [/icici/i, 'ICICI Bank'], [/\bsbi|sbm|sbicrd/i, 'State Bank of India'], [/axis|axb/i, 'Axis Bank'],
  [/kotak|kmb/i, 'Kotak Mahindra Bank'], [/yes ?b|yesbnk/i, 'Yes Bank'], [/idfc/i, 'IDFC First Bank'], [/indus/i, 'IndusInd Bank'],
  [/\bpnb/i, 'Punjab National Bank'], [/\bbob|barodamp/i, 'Bank of Baroda'], [/canara/i, 'Canara Bank'], [/union/i, 'Union Bank of India'],
  [/federal|fedbnk/i, 'Federal Bank'], [/\brbl/i, 'RBL Bank'], [/au ?bank|aubank/i, 'AU Small Finance Bank'], [/standard chartered|scbank|stanc/i, 'Standard Chartered'],
  [/amex|american express/i, 'American Express'], [/paytm|pytm/i, 'Paytm Payments Bank'], [/idbi/i, 'IDBI Bank'],
]

const DEBIT = /\b(debited|debit|spent|paid|sent|purchase|purchased|withdrawn|withdrawal|charged|deducted|txn of|transaction of|payment of)\b/i
const CREDIT = /\b(credited|received|deposited|refund(?:ed)?|reversed|reversal|cashback)\b/i
const REFUNDISH = /\b(refund(?:ed)?|reversed|reversal|cashback)\b/i
const OTP = /\b(otp|one[- ]?time password|verification code|cvv|pin)\b/i
const STRONG_DEBIT = /\b(debited|spent|withdrawn|sent|paid)\b/i
/** "Payment of Rs 500 received on your credit card": a payment INTO the card, so not spending. */
const RECEIPT = /\b(?:payment|amount)\b.{0,40}?\breceived\b/i
const PROMO = /\b(offer|apply now|pre-?approved|click|congratulations|limited time|win |reward points|download)\b|https?:\/\//i
const CARD_BILL = /\b(credit card (?:bill|payment|outstanding)|cc (?:bill|payment)|card bill|towards (?:your )?(?:credit )?card|billdesk.*card|cred club)\b/i

/** "Rs.1,250.00", "INR 450", "₹99". Amounts after "avail/bal/limit" are balances, not the payment. */
const MONEY = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi
const BALANCE_WORDS = /(avl|avail\w*|bal\w*|limit|outstanding|total due|min(?:imum)? due)[\s:.a-z/]{0,14}$/i

function amountOf(text: string): string | null {
  for (const m of text.matchAll(MONEY)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 24), m.index ?? 0)
    if (BALANCE_WORDS.test(before)) continue
    const a = clean(m[1] ?? '')
    if (a) return a
  }
  // SBI style: "debited by 250.0" with no currency sign.
  const bare = /\b(?:debited|credited)\s+(?:by|for|with)\s+([\d,]+(?:\.\d{1,2})?)\b/i.exec(text)
  return bare ? clean(bare[1] ?? '') : null
}

/** Digits with commas removed, trailing ".0" tidied, and held to the same limits as a typed amount. */
function clean(raw: string): string | null {
  const t = raw.replace(/,/g, '').replace(/\.$/, '')
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null
  const v = new D(t)
  if (v.isZero() || v.gt(MAX_AMOUNT)) return null
  return t.includes('.') ? v.toFixed(2) : v.toFixed(0)
}

const LAST4 = [
  /(?:a\/c|acct?|account|card)[^\d\n]{0,25}?[x*•]+\s?(\d{3,4})\b/i,
  /(?:ending|ending with|ending in|no\.?)\s*(?:[x*•]+\s?)?(\d{4})\b/i,
  /\b[x*•]{2,}\s?(\d{3,4})\b/i,
]

const pretty = (s: string): string => {
  const t = s.replace(/\s+/g, ' ').replace(/[.,;:\-]+$/, '').trim()
  const small = t.length > 40 ? t.slice(0, 40).trim() : t
  const flat = small === small.toUpperCase() || small === small.toLowerCase()
  return flat ? small.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : small
}

const NOT_A_MERCHANT = /^(a\/c|acct|account|your|you|card|vpa|bank|ref|upi|self|the|a\b)/i

function merchantOf(text: string): string {
  const vpa = /\b(?:to|towards)\s+(?:vpa\s+)?([\w.\-]{2,}@[\w.]+)/i.exec(text)
  if (vpa) return pretty((vpa[1] ?? '').split('@')[0]!.replace(/[._\-]?\d{6,}$/g, '').replace(/[._]+/g, ' '))
  const p2m = /UPI\/P2[MP]\/\d+\/((?:[A-Za-z0-9 &'\-]|\.(?=\w)){2,40})/i.exec(text)
  if (p2m) return pretty(p2m[1]!)
  const payee = /;\s*([A-Za-z0-9 .&'\-*]{2,30}?)\s+credited/i.exec(text)
  if (payee && !NOT_A_MERCHANT.test(payee[1]!)) return pretty(payee[1]!)
  const at = /\b(?:at|trf to|to|towards)\s+([A-Za-z0-9](?:[A-Za-z0-9 &'\-*]|\.(?=\w)){1,34}?)(?=\s+(?:on|ref\w*|upi|avl|avail|not|if|call|via|dated|using|from|for|ending)\b|[.;,(]|\s*$)/i.exec(text)
  if (at && !NOT_A_MERCHANT.test(at[1]!)) return pretty(at[1]!.replace(/\s+(ltd|pvt|limited)\.?$/i, ''))
  return ''
}

function modeOf(text: string): PaymentModeId | null {
  if (/\bupi\b|\bvpa\b|@[a-z]{2,}\b/i.test(text)) return 'upi'
  if (/credit card|\bcc\b/i.test(text)) return 'credit'
  if (/debit card|\batm\b/i.test(text)) return 'debit'
  if (/net ?banking|\bneft\b|\bimps\b|\brtgs\b/i.test(text)) return 'netbanking'
  return null
}

export const bankFromSender = (address: string, body = ''): string | null => {
  for (const [re, name] of BANKS) if (re.test(address)) return name
  for (const [re, name] of BANKS) if (re.test(body)) return name
  return null
}

export function parseSms(body: string, address: string): ParsedSms | SkippedSms {
  const text = body.replace(/\s+/g, ' ').trim()
  if (!text) return { ok: false, reason: 'not-a-payment' }
  if (OTP.test(text) && !STRONG_DEBIT.test(text)) return { ok: false, reason: 'otp' }

  const d = DEBIT.exec(text)
  const c = CREDIT.exec(text)
  if (!d && !c) return { ok: false, reason: 'not-a-payment' }
  if (!d && PROMO.test(text)) return { ok: false, reason: 'not-a-payment' }
  if (REFUNDISH.test(text) || RECEIPT.test(text)) return { ok: false, reason: 'credit' }
  if (!d) return { ok: false, reason: 'credit' }
  // Both words present ("debited ... ; ZOMATO credited"): money went out only when the debit comes first.
  if (c && d.index > c.index) return { ok: false, reason: 'unsure' }
  if (PROMO.test(text) && /\b(loan|offer|apply|emi)\b/i.test(text) && !/\b(a\/c|card|upi)\b/i.test(text)) return { ok: false, reason: 'not-a-payment' }

  const amount = amountOf(text)
  if (!amount) return { ok: false, reason: 'no-amount' }

  let last4: string | null = null
  for (const re of LAST4) {
    const m = re.exec(text)
    if (m?.[1]) { last4 = m[1]; break }
  }
  const ref = /(?:ref(?:erence)?(?:\s*no\.?)?|rrn|utr|upi)[:\s./-]*(\d{9,})/i.exec(text)?.[1] ?? /\b(\d{12})\b/.exec(text)?.[1] ?? null
  return {
    ok: true,
    kind: CARD_BILL.test(text) ? 'cardBill' : 'spend',
    amount,
    last4,
    merchant: merchantOf(text),
    mode: modeOf(text),
    bank: bankFromSender(address, text),
    ref,
  }
}

/** A short code for "this same message or payment". Two 32-bit FNV-1a hashes, so a clash is very unlikely. Not reversible to the text. */
export function fingerprint(p: ParsedSms, day: string): string {
  const key = p.ref ?? `${day}|${p.amount}|${p.last4 ?? ''}|${p.merchant.toLowerCase()}`
  let a = 0x811c9dc5
  let b = 0x01000193
  for (let i = 0; i < key.length; i++) {
    a = Math.imul(a ^ key.charCodeAt(i), 0x01000193) >>> 0
    b = Math.imul(b ^ key.charCodeAt(i), 0x85ebca6b) >>> 0
  }
  return a.toString(36) + b.toString(36)
}

export interface Candidate {
  /** Fingerprint: also the id used to remember a skipped or added message. */
  id: string
  date: string
  amount: string
  merchant: string
  kind: SmsKind
  mode: PaymentModeId | null
  instrumentId: string | null
  bank: string | null
  last4: string | null
  /** Pre-filled from an earlier entry with the same merchant name, or null. */
  categoryId: string | null
  /** An entry with the same amount, on the same or the next day, from the same card or merchant already exists. */
  duplicateOfExisting: boolean
}

const live = (i: PayInstrument) => i.deletedAt === null

/** The user's card or account this message names, only when exactly one fits. */
export function matchInstrument(budget: Pick<BudgetData, 'instruments'>, p: Pick<ParsedSms, 'last4' | 'bank'>): PayInstrument | null {
  if (!p.last4) return null
  const hits = budget.instruments.filter((i) => live(i) && !!i.last4 && (i.last4 === p.last4 || i.last4.endsWith(p.last4!) || p.last4!.endsWith(i.last4)))
  if (hits.length <= 1) return hits[0] ?? null
  const byBank = p.bank ? hits.filter((i) => (i.bank ?? '').toLowerCase().includes(p.bank!.split(' ')[0]!.toLowerCase())) : []
  return byBank.length === 1 ? byBank[0]! : null
}

/** How the entry should be paid, using the matched card or account when there is one. */
export function modeFor(p: Pick<ParsedSms, 'mode'>, i: PayInstrument | null): PaymentModeId | null {
  if (!i) return p.mode === 'credit' || p.mode === 'debit' ? null : p.mode
  if (p.mode && instrumentFitsMode(p.mode, i)) return p.mode
  switch (i.kind) {
    case 'credit': return 'credit'
    case 'debit': return 'debit'
    case 'wallet': return 'wallet'
    case 'bank': return p.mode === 'upi' ? 'upi' : 'netbanking'
  }
}

const dayNum = (key: string): number => { const [y = 1970, m = 1, d = 1] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86_400_000) }

/** True when the budget already has this payment (same amount, same or next day, same card/account or same merchant name). */
export function alreadyAdded(budget: Pick<BudgetData, 'expenses'>, c: Pick<Candidate, 'amount' | 'date' | 'instrumentId' | 'merchant'>): boolean {
  const amount = new D(c.amount)
  return budget.expenses.some(
    (e) =>
      e.deletedAt === null &&
      new D(e.amount).eq(amount) &&
      Math.abs(dayNum(e.date) - dayNum(c.date)) <= 1 &&
      ((c.instrumentId !== null && e.instrumentId === c.instrumentId) || (c.merchant !== '' && e.note.toLowerCase().includes(c.merchant.toLowerCase()))),
  )
}

export interface InboxMessage {
  id: string
  address: string
  date: number
  body: string
}

export interface ScanResult {
  found: Candidate[]
  /** Messages that looked like payments but were not read (credits, unclear ones), counted by reason. Text is not kept. */
  skipped: Partial<Record<SkipReason, number>>
  /** Messages already added or skipped on an earlier scan. */
  alreadySeen: number
  /** Redacted notes on what the parser could not fully read (see ParseLogEntry). */
  log: ParseLogEntry[]
}

/**
 * Turns the inbox into a review list. `suggest` gives the category of the last entry with the same merchant name.
 * Nothing here saves anything: the user adds or skips each one.
 */
export function buildCandidates(
  messages: InboxMessage[],
  budget: BudgetData & { smsSeen?: string[] },
  suggest: (note: string) => { categoryId: string | null } | null,
): ScanResult {
  const seen = new Set(budget.smsSeen ?? [])
  const found: Candidate[] = []
  const skipped: Partial<Record<SkipReason, number>> = {}
  const inList = new Set<string>()
  const log: ParseLogEntry[] = []
  let alreadySeen = 0
  for (const m of messages) {
    const p = parseSms(m.body, m.address)
    const note = logEntryFor(m, p, Date.now())
    if (note) log.push(note)
    if (!p.ok) {
      if (p.reason !== 'not-a-payment' && p.reason !== 'otp') skipped[p.reason] = (skipped[p.reason] ?? 0) + 1
      continue
    }
    const date = dayKey(new Date(m.date))
    const id = fingerprint(p, date)
    if (seen.has(id)) { alreadySeen++; continue }
    // The same payment often arrives twice (bank and UPI app): keep the first.
    if (inList.has(id)) continue
    inList.add(id)
    const inst = matchInstrument(budget, p)
    const cand: Candidate = {
      id,
      date,
      amount: p.amount,
      merchant: p.merchant,
      kind: p.kind,
      mode: modeFor(p, inst),
      instrumentId: inst?.id ?? null,
      bank: p.bank,
      last4: p.last4,
      categoryId: p.kind === 'spend' && p.merchant ? (suggest(p.merchant)?.categoryId ?? null) : null,
      duplicateOfExisting: false,
    }
    cand.duplicateOfExisting = alreadyAdded(budget, cand)
    found.push(cand)
  }
  return { found, skipped, alreadySeen, log }
}

// ---------------------------------------------------------------- parser log (for improving the parser)

export interface ParseLogEntry {
  /** When the scan ran (ms). */
  at: number
  /** Sender header such as "VM-HDFCBK". Only alphanumeric headers are ever read, never a person's number. */
  sender: string
  /** 'read' (but a part was missing) or why it was skipped. */
  outcome: SkipReason | 'partial'
  /** The message with digits, handles, links and the names after "to / at / from / by" blanked out. */
  template: string
  /** What was understood, so a wrong guess can be seen next to the template. */
  got?: { amount?: string; merchant?: string; mode?: string | null; last4?: boolean; ref?: boolean }
  /** Same template seen again. */
  count: number
}

/** Blanks everything personal: digits become #, handles and links become <vpa>/<link>, payee names become <name>. */
export function redact(body: string): string {
  return body
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/https?:\/\/\S+|www\.\S+/gi, '<link>')
    .replace(/[\w.\-]+@[\w.]+/g, '<vpa>')
    .replace(/\b(to|at|from|by|trf to|towards)\s+(?!<)([A-Za-z][\w&'*.\-]*(?:\s+[A-Za-z][\w&'*.\-]*){0,2}?)(?=\s+(?:on|ref\w*|upi|avl|avail|not|if|call|via|dated|using|for|ending|credited|debited)\b|[.;,(]|\s*$)/gi, '$1 <name>')
    .replace(/;\s*[A-Za-z][\w &'*.\-]{1,30}?\s+credited/gi, '; <name> credited')
    .replace(/\d+/g, '#')
    .slice(0, 300)
}

/**
 * What to keep about one message for the parser log: skipped messages that looked like payments (not credits, OTPs or
 * chat: those are the normal case) and messages that were read but lack a merchant or card digits. Null = nothing to log.
 */
export function logEntryFor(m: InboxMessage, p: ParsedSms | SkippedSms, now: number): ParseLogEntry | null {
  if (p.ok) {
    if (p.merchant && p.last4) return null
    return { at: now, sender: m.address, outcome: 'partial', template: redact(m.body), got: { amount: p.amount, merchant: p.merchant, mode: p.mode, last4: !!p.last4, ref: !!p.ref }, count: 1 }
  }
  if (p.reason === 'no-amount' || p.reason === 'unsure') return { at: now, sender: m.address, outcome: p.reason, template: redact(m.body), count: 1 }
  return null
}

export const MAX_PARSE_LOG = 200

/** Adds entries newest first; an identical template from the same sender only raises the count. Capped. */
export function mergeLog(old: ParseLogEntry[], add: ParseLogEntry[]): ParseLogEntry[] {
  const out = [...old]
  for (const e of add) {
    const i = out.findIndex((x) => x.template === e.template && x.sender === e.sender && x.outcome === e.outcome)
    if (i >= 0) out[i] = { ...out[i]!, at: e.at, count: out[i]!.count + 1 }
    else out.unshift(e)
  }
  return out.sort((a, b) => b.at - a.at).slice(0, MAX_PARSE_LOG)
}

/** Plain text for pasting into a chat or an issue. */
export function logAsText(log: ParseLogEntry[]): string {
  return log
    .map((e) => `[${e.outcome}${e.count > 1 ? ` x${e.count}` : ''}] ${e.sender}: ${e.template}${e.got ? `  => ${JSON.stringify(e.got)}` : ''}`)
    .join('\n')
}
