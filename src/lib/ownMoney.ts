import { payeeKindFor, type PayeeKind } from './payeeKey'

/**
 * Is this payment real spending, real income, or just YOUR OWN money moving?
 *
 * Own money = an FD or RD being opened or broken, a sweep between savings and a deposit, a transfer between your own accounts, a card bill
 * you pay. None of it is spending and none of it is income. Counting it either way makes the budget wrong (a broken FD is not a 50,000
 * "income", paying a card bill is not a second spend).
 *
 * HONESTY NOTE: every wording below is written from memory of how Indian banks word deposit and sweep messages (SBI "TD/Flexi", HDFC "FD/RD",
 * ICICI "iWish/FD", Axis, Kotak, PNB, BoB, Canara, IDFC, Yes). NO real message was read. The tests use SYNTHETIC text. The words are a guess
 * that the on-phone "Copy masked examples" button exists to correct.
 *
 * FAIL CLOSED: when it is not clear, the answer is "spend" (or "not offered", for money in). A wrongly hidden spend is worse than one extra row.
 * Own money is never added without a tap.
 *
 * Pure text rules live here; nothing imports the budget (only the small shapes below), so smsParse, inbox and the store can all use it.
 */

export type Nature = 'spend' | 'moneyIn' | 'ownMoney'
export type OwnKind = 'fdOpen' | 'fdBreak' | 'rd' | 'sweep' | 'selfTransfer' | 'cardBill'
/** 'out' = money left the account the message is about; 'in' = money came in. */
export type Direction = 'out' | 'in'

export const NATURES: readonly Nature[] = ['spend', 'moneyIn', 'ownMoney']
export const OWN_KINDS: readonly OwnKind[] = ['fdOpen', 'fdBreak', 'rd', 'sweep', 'selfTransfer', 'cardBill']
export const isNature = (v: unknown): v is Nature => typeof v === 'string' && (NATURES as readonly string[]).includes(v)
export const isOwnKind = (v: unknown): v is OwnKind => typeof v === 'string' && (OWN_KINDS as readonly string[]).includes(v)

/** The kinds whose digits are a DEPOSIT account number (never a card or bank account the person could add). */
export const DEPOSIT_KINDS: ReadonlySet<OwnKind> = new Set<OwnKind>(['fdOpen', 'fdBreak', 'rd', 'sweep'])

export interface OwnRead {
  ownKind: OwnKind
  /** Plain words, for the review list. */
  ownWhy: string
}

export interface OwnNature {
  nature: Nature
  ownKind?: OwnKind
  ownWhy?: string
}

// ---------------------------------------------------------------- deposit wording (SYNTHETIC / ASSUMED)

const NOUN = String.raw`(?:term|fixed|recurring|flexi|multi[- ]?option)\s+deposits?`
/**
 * A deposit account is named: "Term Deposit", "Fixed Deposit", FD / TD / FDR / TDR, "RD" or "MOD" only next to an account word, number or
 * deposit event (so "Rd" for road does not count), "deposit a/c". "TDS" (tax) must NOT match, nor "cash deposit" / "deposited in your a/c".
 */
const DEPOSIT = new RegExp(String.raw`\b(?:${NOUN}|fdr|tdr|fds?|td|(?:rd|mod)(?=\s*(?:a\/c|ac\b|acct|account|no\b|number|#|[x*•]|\d{3,}|instal|closure|closed|matur|premature|booking))|deposit\s+(?:a\/c|ac\b|acct|account|receipt))\b`, 'i')

/** The same names followed by an account number, so those digits can be cut out before the card/account digits are read. */
const DEPOSIT_NUMBER = new RegExp(String.raw`\b(?:${NOUN}|fdr|tdr|fds?|td|rd|mod)\b\s*(?:(?:a\/c|ac|acct|account|receipt|no|number)\b\.?\s*)*[#:\-]?\s*(?:no\.?|number)?\s*[:\-]?\s*(?:[x*•]+\s?)?\d{3,}|\bdeposit\s+(?:a\/c|ac|acct|account|receipt)\b\.?\s*(?:no\.?|number)?\s*[:\-]?\s*(?:[x*•]+\s?)?\d{3,}`, 'gi')

const SWEEP = /\b(?:auto[- ]?)?sweep(?:[- ]?(?:in|out))?\b|\bmulti[- ]?option deposit\b|\bflexi (?:deposit|fd|account|a\/c)\b|\bsbi flexi\b|\bmod\s*(?:a\/c|ac\b|acct|account|deposit|balance)/i
const OPEN = /\b(?:book(?:ed|ing)|open(?:ed|ing)?|creat(?:ed|ion)|new|placed|renew(?:ed|al)?|auto[- ]?renew\w*|set ?up)\b/i
const CLOSE = /\b(?:clos(?:ed|ure|ing)|premature(?:ly)?|matur(?:ed|ity)|proceeds|liquidat\w+|broken|break(?:ing)?|encash\w*|withdrawn)\b/i
const INTEREST = /\binterest\b/i
const RD = /\b(?:rd|recurring deposit)\b/i
/** A real cost that touches a deposit (penalty, fee, tax): this IS money spent, so it stays a spend. */
const COST = /\b(?:penalt\w*|charges?|fees?|tds|gst)\b/i
/** Said about the future: a reminder, not something that happened. */
const FUTURE = /\b(?:will|shall|to) be (?:credited|debited|renewed|closed|transferred|booked)|\bwill (?:mature|auto|be)\b|\bmatur(?:es|ing) on\b|\bdue for (?:renewal|maturity)\b|\bupcoming\b|\breminder\b|\bplease (?:visit|contact)\b/i

/** Own account named in the text ("to SELF", "own account", "between your accounts"). */
const SELF = /\b(?:to|from|by|trf to)\s+self\b|\/self\b|\bself[- ]?(?:transfer|account|a\/c|ac)\b|\bown\s+(?:a\/c|ac|acct|account)s?\b|\b(?:your|my)\s+(?:other|linked|own)\s+(?:a\/c|ac|acct|account)s?\b|\bbetween\s+(?:your\s+)?(?:own\s+)?(?:a\/c|account)s?\b|\bsame\s+(?:name|holder)\b/i

export const hasDeposit = (text: string): boolean => DEPOSIT.test(text)

/** The text with every deposit account number cut out, so those digits are never read as a card or account (or as a reference). */
export const stripDeposit = (text: string): string => text.replace(DEPOSIT_NUMBER, ' ')

// ---------------------------------------------------------------- account tails (who is on the other end)

const TAIL = /(?:a\/c|\bac\b|acct?|account)\s*(?:no\.?|number|#)?\s*:?\s*(?:[x*•]+\s?)?(\d{3,})\b/gi
const NOT_AN_ACCOUNT_OF_YOURS = /(?:loan|emi|policy|folio|lan)\s*(?:a\/c|ac|acct|account)?\s*(?:no\.?|number)?\s*[:\-]?\s*$/i

/** The last 4 digits of every account number the text names (deposit and loan accounts left out), in order, no repeats. */
export function accountTails(text: string): string[] {
  const clean = stripDeposit(text)
  const out: string[] = []
  for (const m of clean.matchAll(TAIL)) {
    if (NOT_AN_ACCOUNT_OF_YOURS.test(clean.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0))) continue
    const d = m[1] ?? ''
    if (d.length < 4) continue // a 3-digit tail is too weak to name "my other account"
    const t = d.slice(-4)
    if (!out.includes(t)) out.push(t)
  }
  return out
}

// ---------------------------------------------------------------- reading the text

const WHY: Record<OwnKind, string> = {
  fdOpen: 'Looks like a fixed deposit being opened or topped up: your money moves into a deposit, it is not spent.',
  fdBreak: 'Looks like a fixed deposit closing or paying out: the money came back to your account.',
  rd: 'Looks like a recurring deposit: you are saving it, not spending it.',
  sweep: 'Looks like an automatic sweep between your savings and a deposit: your own money moving.',
  selfTransfer: 'Looks like a transfer between your own accounts.',
  cardBill: 'Paying your own credit card bill: the spending was counted when you used the card.',
}
const own = (ownKind: OwnKind, ownWhy = WHY[ownKind]): OwnRead => ({ ownKind, ownWhy })

/**
 * What the WORDS of a message say about own money, or null. No budget needed. `dir` is which way the money went.
 * Order matters: sweep, then deposit, then "to self". A penalty, fee or tax on a deposit is a real cost, so it is not own money.
 */
export function ownFromText(text: string, dir: Direction): OwnRead | null {
  if (FUTURE.test(text)) return null
  if (SWEEP.test(text)) return own('sweep', dir === 'in' ? 'Looks like money swept back from a deposit to your account: your own money moving.' : WHY.sweep)
  if (hasDeposit(text)) {
    const rd = RD.test(text)
    if (dir === 'out') {
      if (COST.test(text) || CLOSE.test(text)) return null
      return rd ? own('rd') : own('fdOpen')
    }
    if (CLOSE.test(text)) return rd ? own('rd', 'Looks like a recurring deposit paying out: the money came back to your account.') : own('fdBreak')
    if (INTEREST.test(text)) return own('fdBreak', 'Interest paid on a deposit: your own money. If you want it counted as income, add it yourself.')
    if (OPEN.test(text)) return own('fdOpen')
    return null
  }
  if (SELF.test(text)) return own('selfTransfer', dir === 'in' ? 'The message says this came from your own account.' : 'The message says the money went to your own account.')
  return null
}

// ---------------------------------------------------------------- deciding with what the app knows

export interface OwnInstrument {
  id: string
  kind: string
  last4: string
  deletedAt: number | null
}
export interface OwnContext {
  instruments: readonly OwnInstrument[]
  payeeKinds?: readonly PayeeKind[]
}
export interface OwnFacts {
  /** 'cardBill' for a credit-card bill payment. */
  kind: string
  merchant: string
  /** `payeeKey(merchant)`. */
  payee: string | null
  /** The other account named in the message (see accountTails), or null. */
  other: string | null
  /** What the words say (ownFromText), or null. */
  text: OwnRead | null
}

/** The one saved bank account whose last digits are `tail`, or null (none, or more than one: then nothing is claimed). */
export function ownAccountFor(ctx: Pick<OwnContext, 'instruments'>, tail: string | null): OwnInstrument | null {
  if (!tail) return null
  const hits = ctx.instruments.filter((i) => i.deletedAt === null && i.kind === 'bank' && i.last4.length === 4 && i.last4 === tail)
  return hits.length === 1 ? hits[0]! : null
}

/**
 * Spend, or own money? Strongest evidence first: (1) the person taught the app this payee is their own account, (2) it is a card bill,
 * (3) the words say so, (4) the other account in the message is one of the person's saved bank accounts. If the person taught that the
 * payee is someone else or a shop, "own account" guesses from the words or the other account are dropped (a deposit or sweep is still read).
 */
export function natureOf(f: OwnFacts, ctx: OwnContext): OwnNature {
  const taught = payeeKindFor(ctx.payeeKinds, f.payee)
  if (taught === 'self') return { nature: 'ownMoney', ownKind: 'selfTransfer', ownWhy: 'You told the app this payee is your own account.' }
  if (f.kind === 'cardBill') return { nature: 'ownMoney', ownKind: 'cardBill', ownWhy: WHY.cardBill }
  const notSelf = taught === 'person' || taught === 'merchant'
  if (f.text && !(notSelf && f.text.ownKind === 'selfTransfer')) return { nature: 'ownMoney', ...f.text }
  if (!notSelf) {
    const mine = ownAccountFor(ctx, f.other)
    if (mine) return { nature: 'ownMoney', ownKind: 'selfTransfer', ownWhy: `The message names your own account ending ${mine.last4}.` }
  }
  return { nature: 'spend' }
}
