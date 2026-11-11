import { D } from '../engine/decimal'
import { sameName } from './payeeKey'

/**
 * "Is this the same payment?" for the manual scan list and the Inbox.
 *
 * WHY DUPLICATES SHOWED (every cause found, 2026-11-11, from reading the code; real messages were not seen):
 *  1. ONE payment sends TWO messages (the bank's debit alert, then a UPI app or second bank confirming it), worded differently. The message
 *     fingerprint (smsParse.fingerprint) is the UPI reference when the text has one, otherwise day|amount|card|MERCHANT. The two texts name the
 *     payee differently ("Swiggy" / "Bundl Technologies"), or only one has a reference, so they got two different fingerprints and both showed.
 *  2. The two messages can reach the Inbox in DIFFERENT drains (the phone queue is drained when the app opens). Nothing compared a new message
 *     with an item already waiting in the Inbox, only with fingerprints, so the twin was added as a second item.
 *  3. The manual scan never looked at the Inbox either. A payment waiting in the Inbox (or already approved or rejected there) could be offered
 *     again if its twin text differed.
 *  4. `alreadyAdded` (is it in the budget?) matched only when the card matched or the entry's note CONTAINED the merchant. A different spelling
 *     of the payee, or a message that names no card you have saved, slipped through.
 *  5. The same text stored twice (dual SIM, a resend) a moment either side of midnight has a different day, so a different fingerprint.
 *  6. Own money showed up as spending: an FD opened shows as a debit AND (at the other end) a credit; a card bill shows as a debit AND the card
 *     "payment received". Handled separately in ownMoney.ts, but it looked like duplicates too.
 *
 * The rule below is deliberately generous about which signals say "same" and strict about what says "different": two different references,
 * or two different known cards, always keep two payments apart. A merged candidate says how many messages it holds (`mergedFrom`) so the
 * screen can say "2 messages merged" and nothing is hidden silently.
 */

/** What is compared. Both a scan Candidate and an InboxItem fit. */
export interface Same {
  /** 'in' for own money that came in. Absent = 'out'. */
  direction?: 'out' | 'in'
  amount: string
  /** A day key 'YYYY-MM-DD'. */
  date: string
  /** A short hash of the UPI or bank reference (never the reference itself). */
  refKey?: string | null
  last4: string | null
  instrumentId: string | null
  bank: string | null
  merchant: string
}

const dayNum = (key: string): number => { const [y = 1970, m = 1, d = 1] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86_400_000) }
const digitsAgree = (a: string, b: string) => a === b || a.endsWith(b) || b.endsWith(a)

/** The amount as one canonical string ("500", "500.00" and "500.0" are one). */
export const amountKey = (amount: string): string => new D(amount).toFixed(2)

/**
 * Same direction and amount, within one day, and then ANY of: the same reference; the same card or account; the same payee name (one
 * contains the other); one of the messages names no payee. Never when both have a reference and the references differ, nor when both name
 * a card or account and they are different ones (an exact same reference overrides that: banks word the tail in different ways).
 */
export function samePayment(a: Same, b: Same): boolean {
  if ((a.direction ?? 'out') !== (b.direction ?? 'out')) return false
  if (amountKey(a.amount) !== amountKey(b.amount)) return false
  if (Math.abs(dayNum(a.date) - dayNum(b.date)) > 1) return false
  if (a.refKey && b.refKey && a.refKey === b.refKey) return true
  // Two different references are two payments, even to the same shop for the same amount on the same day (two orders, two teas).
  if (a.refKey && b.refKey) return false
  const names = sameName(a.merchant, b.merchant)
  const bankOk = !a.bank || !b.bank || a.bank === b.bank
  const sameCard = (a.instrumentId !== null && a.instrumentId === b.instrumentId) || (!!a.last4 && !!b.last4 && bankOk && digitsAgree(a.last4, b.last4))
  const cardClash = (a.instrumentId !== null && b.instrumentId !== null && a.instrumentId !== b.instrumentId) || (!!a.last4 && !!b.last4 && bankOk && !digitsAgree(a.last4, b.last4))
  if (sameCard || names) return true
  if (cardClash) return false
  return a.merchant.trim() === '' || b.merchant.trim() === ''
}

const longer = (a: string, b: string) => (b.length > a.length ? b : a)

/** One candidate or item from two that are the same payment: the first, with every empty field filled from the second and the longer payee name. */
export function mergeCandidates<T extends Same & { id: string; mode: unknown; source?: unknown; sender?: string; categoryId: string | null; categoryGuessed?: boolean; mergedFrom?: number; alsoIds?: string[]; nature?: string; ownKind?: string; ownWhy?: string }>(a: T, b: T): T {
  const useB = (k: keyof T) => a[k] === null || a[k] === undefined || a[k] === ''
  const out: T = { ...a }
  for (const k of ['instrumentId', 'last4', 'bank', 'mode', 'source', 'sender', 'refKey'] as (keyof T)[]) if (useB(k) && b[k] !== undefined) out[k] = b[k]
  out.merchant = longer(a.merchant, b.merchant)
  if (a.categoryId === null && b.categoryId !== null) { out.categoryId = b.categoryId; if (b.categoryGuessed !== undefined) out.categoryGuessed = b.categoryGuessed }
  // Own-money evidence in either message wins: the words said so, and the other message just said less.
  if (b.nature === 'ownMoney' && a.nature !== 'ownMoney') { out.nature = b.nature; if (b.ownKind) out.ownKind = b.ownKind; if (b.ownWhy) out.ownWhy = b.ownWhy }
  out.mergedFrom = (a.mergedFrom ?? 1) + (b.mergedFrom ?? 1)
  const also = [...(a.alsoIds ?? []), b.id, ...(b.alsoIds ?? [])].filter((id) => id !== a.id)
  if (also.length > 0) out.alsoIds = [...new Set(also)]
  if ('duplicateOfExisting' in a || 'duplicateOfExisting' in b) (out as Record<string, unknown>).duplicateOfExisting = !!(a as Record<string, unknown>).duplicateOfExisting || !!(b as Record<string, unknown>).duplicateOfExisting
  return out
}

/**
 * Collapses a list in place of order: the first of each group of "same payment" keeps its position and absorbs the rest.
 * `joined(survivorIndex, absorbedIndex)` is called for each absorbed item so the caller can keep track (masked samples).
 * ponytail: compares inside one amount bucket, so cost is (messages with the same amount) squared; fine for a few thousand messages.
 */
export function collapse<T extends Parameters<typeof mergeCandidates>[0]>(items: T[], joined?: (survivor: number, absorbed: number) => void): T[] {
  const out: { item: T; at: number }[] = []
  const byAmount = new Map<string, number[]>()
  items.forEach((it, i) => {
    const key = `${it.direction ?? 'out'}|${amountKey(it.amount)}`
    const bucket = byAmount.get(key) ?? []
    const hit = bucket.find((o) => samePayment(out[o]!.item, it))
    if (hit === undefined) {
      bucket.push(out.length)
      byAmount.set(key, bucket)
      out.push({ item: it, at: i })
    } else {
      out[hit]!.item = mergeCandidates(out[hit]!.item, it)
      joined?.(out[hit]!.at, i)
    }
  })
  return out.map((o) => o.item)
}
