import { D } from '../engine/decimal'
import {
  MAX_EXPENSES,
  categoryName,
  categoryUsable,
  dayKey,
  ruleFor,
  suggestFor,
  validateExpense,
  type BudgetData,
  type BudgetExpense,
  type PaymentModeId,
} from './budget'
import { isIgnored, senderKey, type IgnoreRule } from './smsIgnore'
import type { QueuedMessage, SmsQueuePort } from './smsQueue'
import { alreadyAdded, fingerprint, guessCategory, matchInstrument, modeFor, parseSms, type SmsKind } from './smsParse'

/**
 * The SMS Inbox (docs/SMS-INBOX-PLAN.md): payments caught from bank messages wait here until the person approves them.
 * Everything in this file is pure (no storage, no UI) so the safety rules can be tested without a phone.
 *
 * What is stored about a message: the fields the parser read (date, amount, payee, card digits). Never the message text.
 */

export type InboxStatus = 'pending' | 'approved' | 'rejected'

export interface InboxItem {
  /** The message fingerprint (smsParse.fingerprint). The same id is kept in `budget.smsSeen`, so a manual scan and the queue never count one message twice. */
  id: string
  date: string
  amount: string
  merchant: string
  kind: SmsKind
  mode: PaymentModeId | null
  instrumentId: string | null
  last4: string | null
  bank: string | null
  /** The suggested category, or null. */
  categoryId: string | null
  /** Why that category, in plain words ("You tagged Swiggy as Food twice"). Empty when there is no suggestion. */
  why: string
  /** The sender header in its short form ("HDFCBK"), so "Ignore this sender" works from the Inbox. A bank-style name only, never a number. */
  sender?: string
  /** UPI to what looks like a person. Never added without a tap. */
  person: boolean
  status: InboxStatus
  /** When it was caught (ms). */
  at: number
  /** Approved: the entry it became. */
  entryId?: string
  /** Approved by the app, not by a tap. */
  auto?: true
  /** Rejected with "Not a spend". */
  notSpend?: true
  /** When it was approved or rejected (ms). */
  resolvedAt?: number
}

/** What the app has learned about one payee: the category it was last tagged with, and how many times in a row. */
export interface LearnedPayee {
  key: string
  categoryId: string
  /** Confirmations in a row with this category. */
  count: number
  lastAt: number
}

/** The last auto-added items, newest first: `bad` once the person undid or changed one. Only the last DRIFT_WINDOW matter. */
export interface AutoLogEntry {
  id: string
  bad: boolean
}

export const MAX_INBOX = 300
export const MAX_LEARNED = 200
export const MAX_COUNT = 99
/** Same payee, same category, this many times in a row: the app may add it without asking (in Auto mode). */
export const AUTO_AFTER = 2
export const RECENT_DAYS = 14
export const DRIFT_WINDOW = 10
export const DRIFT_BAD = 2
const DAY_MS = 86_400_000

// ---------------------------------------------------------------- payees and learning

/** The short, comparable name of a payee: lower case, letters and digits, words with digits dropped (order numbers, card digits), at most 3 words. Null when too little is left. */
export function payeeKey(merchant: string): string | null {
  const words = merchant.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').split(/\s+/).filter((w) => w !== '' && !/\d/.test(w)).slice(0, 3)
  const key = words.join(' ').slice(0, 40).trim()
  return key.length >= 3 ? key : null
}

export const learnedFor = (budget: Pick<BudgetData, 'learned'>, key: string | null): LearnedPayee | undefined => (key === null ? undefined : (budget.learned ?? []).find((l) => l.key === key))

/** The person confirmed `categoryId` for this payee: same as last time counts one more, a different one starts again at 1. Newest first, capped. */
export function recordConfirm(learned: LearnedPayee[] | undefined, key: string, categoryId: string, now: number): LearnedPayee[] {
  const list = learned ?? []
  const cur = list.find((l) => l.key === key)
  const next: LearnedPayee = cur && cur.categoryId === categoryId ? { ...cur, count: Math.min(cur.count + 1, MAX_COUNT), lastAt: now } : { key, categoryId, count: 1, lastAt: now }
  return [next, ...list.filter((l) => l.key !== key)].slice(0, MAX_LEARNED)
}

/** Forgets a payee, so it needs AUTO_AFTER new confirmations again. */
export const forgetPayee = (learned: LearnedPayee[] | undefined, key: string): LearnedPayee[] => (learned ?? []).filter((l) => l.key !== key)

/**
 * Whole words only: "Ravi" must not look like the word "vi" (a phone company). The category word list in smsParse is a loose guess for a
 * suggestion; this list decides something stricter, that a UPI payee is a business, so it is short and exact.
 */
const BUSINESS_WORDS = /\b(swiggy|zomato|eatsure|dominos|mcdonalds|kfc|starbucks|bigbasket|blinkit|zepto|instamart|dmart|jiomart|uber|ola|rapido|redbus|irctc|fastag|airtel|jio|vodafone|bsnl|netflix|hotstar|spotify|youtube|amazon|flipkart|myntra|ajio|nykaa|meesho|croma|decathlon|makemytrip|goibibo|cleartrip|indigo|zerodha|groww|upstox|apollo|medplus|netmeds|practo|bescom|ltd|limited|pvt|private|stores?|mart|traders?|enterprises?|services?|hotel|restaurant|cafe|pharmacy|medical|supermarket|bakery|kitchen|salon|clinic|hospital|technologies|solutions|retail|bazaar|shop|agency|industries|company)\b/i

/**
 * Whether the payee looks like a person. UPI to a person (a name, a phone number) is never added without a tap, because the same person can be
 * rent, a lunch split or a loan paid back. Unsure counts as a person: a missed auto-add is cheap, a wrong one is not.
 */
export function isPerson(mode: PaymentModeId | null, merchant: string, body: string): boolean {
  if (/UPI\/P2M\//i.test(body)) return false
  if (/UPI\/P2P\//i.test(body)) return true
  if (mode !== 'upi') return false // a card or net-banking payee is a shop, not a person
  return !BUSINESS_WORDS.test(merchant)
}

// ---------------------------------------------------------------- suggestions

export interface Suggestion {
  categoryId: string | null
  why: string
}

const times = (n: number) => (n === 2 ? 'twice in a row' : `${n} times in a row`)

/**
 * The category to suggest for a payee, and why. Your own rule wins, then what the app learned from your taps, then your last entry with the
 * same name, then a guess from the name (`hint` is extra text for the guess only, never stored).
 */
export function suggestion(budget: BudgetData, merchant: string, hint = ''): Suggestion {
  const rule = merchant ? ruleFor(budget, merchant) : null
  if (rule) return { categoryId: rule.categoryId, why: `Your rule: ${rule.match} is ${categoryName(budget, rule.categoryId)}` }
  const l = learnedFor(budget, payeeKey(merchant))
  if (l && categoryUsable(budget, l.categoryId)) {
    return { categoryId: l.categoryId, why: l.count >= 2 ? `You tagged ${merchant} as ${categoryName(budget, l.categoryId)} ${times(l.count)}` : `You tagged ${merchant} as ${categoryName(budget, l.categoryId)} once` }
  }
  const same = merchant ? suggestFor(budget, merchant) : null
  if (same?.categoryId) return { categoryId: same.categoryId, why: `Same as your last entry for ${merchant}` }
  const guess = guessCategory(budget, `${merchant} ${hint}`)
  return guess ? { categoryId: guess, why: 'A guess from the name. Check it' } : { categoryId: null, why: '' }
}

type Candidate = Pick<InboxItem, 'kind' | 'merchant' | 'categoryId' | 'person'>

/** Why a payment is not safe to add without a tap, or null when its category is one the person has confirmed enough times (AUTO_AFTER) and no rule of theirs disagrees. */
function notConfirmed(budget: BudgetData, c: Candidate): string | null {
  if (c.kind !== 'spend') return 'A card bill needs a card picked'
  if (c.person) return 'A person, not a shop'
  const l = learnedFor(budget, payeeKey(c.merchant))
  if (!l) return 'New payee'
  if (l.count < AUTO_AFTER) return 'Tagged only once'
  if (c.categoryId === null || c.categoryId !== l.categoryId || !categoryUsable(budget, l.categoryId)) return 'Suggestion is not the learned category'
  const rule = ruleFor(budget, c.merchant)
  if (rule && rule.categoryId !== l.categoryId) return 'Your rule says something else'
  return null
}

/** True when this item's suggestion can be approved in one go ("Approve all suggested"). */
export const suggestionConfirmed = (budget: BudgetData, item: InboxItem): boolean => item.status === 'pending' && notConfirmed(budget, item) === null

/**
 * The strict test for adding a payment without asking (Auto mode). ALL must hold: it is a spend; exactly one of your cards or accounts matches the
 * message; the payee is not a person; the payee was tagged the same way AUTO_AFTER times in a row; the entry is valid; it is not a duplicate.
 * `duplicate` is decided by the caller (it looks at the existing entries).
 */
export function autoAddCheck(budget: BudgetData, item: Candidate & Pick<InboxItem, 'amount' | 'mode' | 'instrumentId' | 'date'>, duplicate: boolean, now: number): { ok: true } | { ok: false; reason: string } {
  const no = (reason: string) => ({ ok: false as const, reason })
  const unconfirmed = notConfirmed(budget, item)
  if (unconfirmed) return no(unconfirmed)
  if (duplicate) return no('Looks like an entry you already have')
  if (item.instrumentId === null) return no('No single card or account matched')
  if (item.mode === null) return no('Not clear how it was paid')
  if (!new D(item.amount).gt(0)) return no('No amount')
  if (budget.expenses.length >= MAX_EXPENSES) return no('Entry limit reached')
  const bad = validateExpense({ amount: item.amount, date: item.date, categoryId: item.categoryId, mode: item.mode, instrumentId: item.instrumentId }, budget, new Date(now))
  const first = bad.amount ?? bad.date ?? bad.category ?? bad.paidWith
  return first ? no(first) : { ok: true }
}

// ---------------------------------------------------------------- the circuit breaker

/** True when 2 or more of the last 10 auto-added entries were undone or changed by the person. Auto mode must then switch itself off. */
export const driftTripped = (log: AutoLogEntry[] | undefined): boolean => (log ?? []).slice(0, DRIFT_WINDOW).filter((e) => e.bad).length >= DRIFT_BAD

export const logAuto = (log: AutoLogEntry[] | undefined, id: string): AutoLogEntry[] => [{ id, bad: false }, ...(log ?? []).filter((e) => e.id !== id)].slice(0, DRIFT_WINDOW)
export const logBad = (log: AutoLogEntry[] | undefined, id: string): AutoLogEntry[] => (log ?? []).map((e) => (e.id === id ? { ...e, bad: true } : e))

/** The inbox item that was auto-added as this entry, or undefined. */
export const autoItemFor = (budget: Pick<BudgetData, 'inbox'>, entryId: string): InboxItem | undefined => (budget.inbox ?? []).find((i) => i.auto === true && i.entryId === entryId)

/**
 * The person undid or changed an auto-added entry: it counts against Auto mode, the payee starts over (needs AUTO_AFTER new confirmations),
 * and the entry stops saying "Auto-added" if it still exists. Other entries are returned unchanged.
 */
export function noteCorrection(budget: BudgetData, entryId: string): BudgetData {
  const item = autoItemFor(budget, entryId)
  // Counted once: after the first correction the entry no longer says Auto-added.
  if (!item || !budget.expenses.some((e) => e.id === entryId && e.auto === true)) return budget
  const key = payeeKey(item.merchant)
  return {
    ...budget,
    autoLog: logBad(budget.autoLog, item.id),
    learned: key ? forgetPayee(budget.learned, key) : budget.learned,
    expenses: budget.expenses.map((e) => {
      if (e.id !== entryId || e.auto !== true) return e
      const { auto: _a, ...rest } = e
      return rest
    }),
  }
}

// ---------------------------------------------------------------- the inbox list

/** Resolved items older than RECENT_DAYS are dropped (their fingerprints stay in smsSeen). Pending items are never dropped. */
export function pruneInbox(inbox: InboxItem[] | undefined, now: number): InboxItem[] {
  return (inbox ?? []).filter((i) => i.status === 'pending' || now - (i.resolvedAt ?? i.at) <= RECENT_DAYS * DAY_MS)
}

export const pendingItems = (budget: Pick<BudgetData, 'inbox'>): InboxItem[] => (budget.inbox ?? []).filter((i) => i.status === 'pending')

/** Auto-added in the last RECENT_DAYS whose entry still exists and still says Auto-added: what the "Recently auto-added" list shows. */
export function recentlyAuto(budget: BudgetData, now: number): { item: InboxItem; entry: BudgetExpense }[] {
  const out: { item: InboxItem; entry: BudgetExpense }[] = []
  for (const item of budget.inbox ?? []) {
    if (item.auto !== true || item.status !== 'approved' || now - (item.resolvedAt ?? item.at) > RECENT_DAYS * DAY_MS) continue
    const entry = budget.expenses.find((e) => e.id === item.entryId && e.deletedAt === null && e.auto === true)
    if (entry) out.push({ item, entry })
  }
  return out
}

/** Re-works the suggestion of every pending item (a rule or a learned payee may have changed). */
export function resuggest(budget: BudgetData): BudgetData {
  if (!budget.inbox?.some((i) => i.status === 'pending')) return budget
  return { ...budget, inbox: budget.inbox.map((i) => (i.status === 'pending' && i.kind === 'spend' ? { ...i, ...suggestion(budget, i.merchant) } : i)) }
}

// ---------------------------------------------------------------- draining the phone-side queue

export interface DrainPlan {
  /** New items, newest first. In Auto mode a confident one comes back already approved (`auto`, with its `entryId`). */
  items: InboxItem[]
  /** The entries the plan adds (Auto mode only), newest first. */
  entries: BudgetExpense[]
  /** Fingerprints to remember, so a manual scan and a later drain skip them. */
  seen: string[]
  /** Queue ids that are safe to ack once the plan is saved: read and parsed, or not a payment at all. */
  ackIds: string[]
  /** Messages left in the queue because the inbox is full. */
  held: number
  /** The auto-add trail after this plan (set only when something was auto-added). */
  log?: AutoLogEntry[]
}

/**
 * Turns what was waiting in the queue into inbox items. Pure: nothing is saved here and nothing is acked.
 * Not payments (OTP, offers, money in, unclear) are acked and dropped. A message seen before, or twice in this batch, is acked and skipped.
 * A payment you already added by hand (same amount, same or next day, same card or payee) is acked and skipped: the same rule as the manual scan.
 */
export function planDrain(messages: QueuedMessage[], budget: BudgetData, o: { auto: boolean; now: number; newId: () => string; ignored?: IgnoreRule[] }): DrainPlan {
  const seen = new Set(budget.smsSeen ?? [])
  const room = Math.max(0, MAX_INBOX - pruneInbox(budget.inbox, o.now).length)
  const ackIds = new Set<string>()
  const queueIds = new Set<string>()
  const items: InboxItem[] = []
  const entries: BudgetExpense[] = []
  const newSeen: string[] = []
  const inPlan = new Set<string>()
  let held = 0
  let log = budget.autoLog
  const auto = o.auto && !driftTripped(budget.autoLog)

  for (const m of messages) {
    if (queueIds.has(m.id)) continue // the same message twice in one drain: handled once, acked once
    queueIds.add(m.id)
    const p = parseSms(m.body, m.sender)
    if (!p.ok) { ackIds.add(m.id); continue }
    // Ignored card or sender: acked and dropped before anything else, so it is never stored, never a duplicate, never learned from.
    if (isIgnored(o.ignored, { sender: m.sender, last4: p.last4, bank: p.bank })) { ackIds.add(m.id); continue }
    const date = dayKey(new Date(m.receivedAt))
    const id = fingerprint(p, date)
    if (seen.has(id) || inPlan.has(id)) { ackIds.add(m.id); continue }
    const inst = matchInstrument(budget, p)
    const base = { id, date, amount: p.amount, merchant: p.merchant, kind: p.kind, mode: modeFor(p, inst), instrumentId: inst?.id ?? null, last4: p.last4, bank: p.bank }
    // Checked against the entries that were there BEFORE this drain, so two real payments of one amount in one batch are not taken for one.
    if (alreadyAdded(budget, base)) { inPlan.add(id); newSeen.push(id); ackIds.add(m.id); continue }
    if (items.length >= room) { held++; continue } // not acked: it stays in the queue until there is room
    inPlan.add(id)
    newSeen.push(id)
    ackIds.add(m.id)
    const s = p.kind === 'spend' ? suggestion(budget, p.merchant, m.body) : { categoryId: null, why: '' }
    const sender = senderKey(m.sender)
    const item: InboxItem = { ...base, ...(sender ? { sender } : {}), categoryId: s.categoryId, why: s.why, person: p.kind === 'spend' && isPerson(base.mode, p.merchant, m.body), status: 'pending', at: o.now }
    if (auto && autoAddCheck(budget, item, false, o.now).ok) {
      const entryId = o.newId()
      const note = item.merchant || (item.bank ? `${item.bank} payment` : 'Bank payment')
      entries.unshift({ id: entryId, date: item.date, amount: item.amount, categoryId: item.categoryId, mode: item.mode, instrumentId: item.instrumentId, note, deletedAt: null, auto: true })
      items.unshift({ ...item, status: 'approved', auto: true, entryId, resolvedAt: o.now })
      log = logAuto(log, item.id)
    } else items.unshift(item)
  }
  return { items, entries, seen: newSeen, ackIds: [...ackIds], held, ...(log !== budget.autoLog ? { log } : {}) }
}

/** Puts a plan into the budget. Pure. The caller must persist the result BEFORE acking (see `drainQueue`). */
export function applyPlan(budget: BudgetData, plan: DrainPlan, now: number): BudgetData {
  if (plan.items.length === 0 && plan.seen.length === 0) return budget
  const inbox = [...plan.items, ...pruneInbox(budget.inbox, now)].slice(0, MAX_INBOX)
  return {
    ...budget,
    inbox,
    smsSeen: [...new Set([...plan.seen, ...(budget.smsSeen ?? [])])].slice(0, 5000),
    expenses: [...plan.entries, ...budget.expenses],
    ...(plan.log ? { autoLog: plan.log } : {}),
  }
}

export type DrainStatus = 'empty' | 'done' | 'unsaved' | 'failed'
export interface DrainResult {
  status: DrainStatus
  /** Items now waiting for a tap. */
  pending: number
  /** Entries added without a tap. */
  auto: number
  /** Messages left in the queue (inbox full). */
  held: number
}

export interface DrainIO {
  budget: () => BudgetData
  auto: () => boolean
  /** Cards and senders to drop on arrival. */
  ignored?: () => IgnoreRule[]
  /** Puts the plan into the app's state. */
  commit: (plan: DrainPlan) => void
  /** Resolves true only when storage has really accepted the data. */
  persist: () => Promise<boolean>
  now: () => number
  newId: () => string
}

/**
 * The drain flow, with no possible loss: read the queue, parse, put the result in the store, WAIT until storage has it, and only then ack.
 * A crash (or a failed save) at any point before the ack leaves every message in the queue; the fingerprints make a second drain harmless.
 */
export async function drainQueue(port: SmsQueuePort, io: DrainIO): Promise<DrainResult> {
  let messages: QueuedMessage[]
  try { messages = await port.drain() } catch { return { status: 'failed', pending: 0, auto: 0, held: 0 } }
  if (messages.length === 0) return { status: 'empty', pending: 0, auto: 0, held: 0 }
  const plan = planDrain(messages, io.budget(), { auto: io.auto(), now: io.now(), newId: io.newId, ignored: io.ignored?.() })
  io.commit(plan)
  const saved = await io.persist().catch(() => false)
  const counts = { pending: plan.items.filter((i) => i.status === 'pending').length, auto: plan.entries.length, held: plan.held }
  if (!saved) return { status: 'unsaved', ...counts }
  try { await port.ack(plan.ackIds) } catch { return { status: 'failed', ...counts } } // still queued; the fingerprints skip them next time
  return { status: 'done', ...counts }
}
