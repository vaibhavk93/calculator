/**
 * "Ignore this card / this sender": messages that match are dropped the moment they arrive (the phone queue is acked), never stored,
 * never added to the Inbox, never shown by the manual scan, never counted as a duplicate or as learning. Pure, no storage here.
 */

export interface IgnoreRule {
  kind: 'card' | 'sender'
  /** Unique id of the rule: "card:HDFC Bank|1234" or "sender:HDFCBK". */
  key: string
  /** Words for the Settings list: "HDFC Regalia ••1234" or "Messages from HDFCBK". */
  label: string
  /** card: the last 3 or 4 digits the messages name. */
  last4?: string
  /** card: the bank the messages name ('' when they name none). */
  bank?: string
  /** sender: the sender header in its short form (see senderKey). */
  sender?: string
}

export const MAX_IGNORED = 50

/**
 * The short form of a sender header, so "VM-HDFCBK-S", "AX-HDFCBK", "hdfcbk" and "HDFC BK" are one sender: upper case, letters and digits,
 * a leading two-letter operator code and a trailing one-letter tag dropped. Empty for anything that looks like a phone number (a person).
 */
export function senderKey(address: string): string {
  const parts = address.toUpperCase().split(/[\s_-]+/).filter(Boolean)
  if (parts.length >= 3 && parts[parts.length - 1]!.length === 1) parts.pop()
  if (parts.length >= 2 && /^[A-Z]{2}$/.test(parts[0]!)) parts.shift()
  const key = parts.join('').replace(/[^A-Z0-9]/g, '')
  return /\d{5,}/.test(key) || key.length < 2 || key.length > 15 ? '' : key
}

const digits = (v: string | null | undefined) => (typeof v === 'string' && /^\d{3,4}$/.test(v) ? v : null)

/** What a message or an item says about where it came from. */
export interface Origin {
  sender?: string | null
  last4?: string | null
  bank?: string | null
}

/** Last digits agree when one ends with the other ("948086"-style tails are cut to 4 by the parser, but 3-digit tails exist). */
const sameDigits = (a: string, b: string) => a === b || a.endsWith(b) || b.endsWith(a)

/**
 * True when a rule covers this message. A card rule needs the same last digits AND the same bank (when the rule names one): ignoring one of
 * your cards must never swallow another bank's card that happens to share the digits.
 */
export function isIgnored(rules: readonly IgnoreRule[] | undefined, o: Origin): boolean {
  if (!rules || rules.length === 0) return false
  const sender = o.sender ? senderKey(o.sender) : ''
  const last4 = digits(o.last4)
  for (const r of rules) {
    if (r.kind === 'sender') {
      if (sender !== '' && r.sender === sender) return true
    } else if (last4 && r.last4 && sameDigits(last4, r.last4)) {
      const bank = (r.bank ?? '').toLowerCase()
      if (bank === '' || (o.bank ?? '').toLowerCase() === bank) return true
    }
  }
  return false
}

/** A card rule from what a message named, or null when there are no usable digits. `name` is how the person knows the card. */
export function cardRule(o: { last4: string | null; bank: string | null }, name?: string): IgnoreRule | null {
  const last4 = digits(o.last4)
  if (!last4) return null
  const bank = (o.bank ?? '').trim().slice(0, 40)
  return { kind: 'card', key: `card:${bank}|${last4}`, label: (name ?? `${bank ? `${bank} ` : ''}••${last4}`).slice(0, 60), last4, bank }
}

/** A sender rule, or null when the sender is missing or looks like a person's number. */
export function senderRule(address: string | null | undefined): IgnoreRule | null {
  const sender = address ? senderKey(address) : ''
  return sender ? { kind: 'sender', key: `sender:${sender}`, label: `Messages from ${sender}`, sender } : null
}

/** Adds a rule (newest first). The same key again changes nothing. Null when the list is full. */
export function withRule(rules: readonly IgnoreRule[] | undefined, rule: IgnoreRule): IgnoreRule[] | null {
  const list = rules ?? []
  if (list.some((r) => r.key === rule.key)) return [...list]
  return list.length >= MAX_IGNORED ? null : [rule, ...list]
}
