/**
 * Format-preserving masking for the reader log.
 *
 * Goal: whoever reads the log (a person, or an AI assistant helping improve the parser) sees text that LOOKS exactly
 * like the real message (same length, commas, decimals, date layout, capital letters, bank words) but holds NO real
 * numbers, names or dates. A wrong layout guess by the parser stays visible; the owner's data does not.
 *
 * How: every digit, and every letter of a payee name or UPI handle, is swapped for another one chosen by a keyed hash
 * (`salt` is random per install and never leaves the phone). The same real value always becomes the same fake value on
 * this phone, so repeats stay recognisable, but nobody can turn it back without the salt. Dates become valid fake dates
 * in the same layout. Words like "debited", "A/c", "Ref", "UPI" and bank names are kept: they are what the parser reads.
 */

/** Held pieces are replaced by one private-use character each (U+E100 + index), so later passes skip them. */
const HELD_BASE = 0xe100
const HELD = '[\uE100-\uE7FF]'

/** 32-bit FNV-1a of `salt|text`, then mixed. Not a cryptographic hash: the secrecy comes from the unknown salt. */
export function keyedHash(salt: string, text: string): number {
  let h = 0x811c9dc5
  const s = `${salt}|${text}`
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d) >>> 0
  h ^= h >>> 12
  return h >>> 0
}

const at = (salt: string, token: string, i: number) => keyedHash(salt, `${token}#${i}`)

/** Digits -> other digits, everything else kept. A leading non-zero digit stays non-zero so lengths look natural. */
export function fakeNumber(token: string, salt: string): string {
  let first = true
  return token.replace(/\p{Nd}/gu, (d, i: number) => {
    let n = at(salt, token, i) % 10
    if (first && d !== '0' && n === 0) n = 1
    first = false
    return String(n)
  })
}

/** Letters -> other letters of the same case, everything else kept. */
export function fakeWord(token: string, salt: string): string {
  // Any script (Devanagari, accented Latin...) becomes plain a-z. Combining marks vanish so the length stays about the same.
  return token.replace(/\p{M}/gu, '').replace(/\p{L}/gu, (c, i: number) => {
    const n = at(salt, token, i) % 26
    return String.fromCharCode((c === c.toUpperCase() ? 65 : 97) + n)
  })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number, width: number) => (width === 2 ? String(n).padStart(2, '0') : String(n))

function fakeDate(m: string, salt: string): string {
  const named = /^(\d{1,2})([-/. ])([A-Za-z]{3})[a-z]*\2(\d{2}|\d{4})$/.exec(m)
  const num = /^(\d{1,2})([-/.])(\d{1,2})\2(\d{2}|\d{4})$/.exec(m)
  const day = (w: number) => pad((keyedHash(salt, `${m}#d`) % 28) + 1, w)
  const year = (w: number) => (w === 4 ? String(2024 + (keyedHash(salt, `${m}#y`) % 3)) : String(24 + (keyedHash(salt, `${m}#y`) % 3)))
  if (named) return `${day(named[1]!.length)}${named[2]}${MONTHS[keyedHash(salt, `${m}#m`) % 12]}${named[2]}${year(named[4]!.length)}`
  if (num) return `${day(num[1]!.length)}${num[2]}${pad((keyedHash(salt, `${m}#m`) % 12) + 1, num[3]!.length)}${num[2]}${year(num[4]!.length)}`
  return fakeNumber(m, salt)
}

/** Words that describe the layout of a bank message. Everything else is treated as possibly personal. */
const KEEP = new Set(`
a an the and or of in on at to from by for with via into under as is are was were be been will has have had not no you your yours our we it this that
upi vpa imps neft rtgs ecs atm pos nach ach mandate autopay emi sip nav folio units unit fund funds growth direct plan
a/c ac acct account accounts card cards credit debit debited credited debits credits spent sent paid pay payment payments purchase transaction txn transfer transferred
rs inr rupees amount amt bal balance avl avail available limit total due minimum outstanding statement bill refund reversed reversal cashback
ref reference rrn utr id no number ending info alert update dear hi hello thank thanks regards team customer cardmember member
successful successfully failed declined processed received withdrawn withdrawal deposit deposited online banking bank netbanking
call sms block stop report dispute click visit download login log password otp pin cvv valid expires expire
today date time ist am pm ib dr cr sb cc
hdfc icici sbi axis kotak yes idfc first indusind pnb canara union federal rbl standard chartered stanchart amex american express paytm hsbc bob baroda idbi bandhan
au small finance mf ltd pvt limited india
jan feb mar apr may jun jul aug sep oct nov dec
`.split(/\s+/).filter(Boolean))

/** Masks one message. `salt` is the per-install secret. */
export function maskText(body: string, salt: string): string {
  const kept: string[] = []
  const hold = (s: string) => String.fromCharCode(HELD_BASE + kept.push(s) - 1)
  // The log keeps 400 characters, so there is no reason to scan more: the UPI-handle pattern below is quadratic on a very long
  // unbroken run of letters (a 100,000-character text took over a minute).
  let t = body.slice(0, 1200).replace(/\s+/g, ' ').trim()

  t = t.replace(/https?:\/\/\S+|www\.\S+/gi, () => hold('<link>'))
  // dates first, so their digits are not masked as plain numbers
  t = t.replace(/\b\d{1,2}([-/.])\d{1,2}\1(?:\d{4}|\d{2})\b|\b\d{1,2}([-/. ])[A-Za-z]{3}[a-z]*\2(?:\d{4}|\d{2})\b/g, (m) => hold(fakeDate(m, salt)))
  // UPI handles: the part before @ is personal, the part after names a bank app
  t = t.replace(/([\w.\-]{2,})@([\w.]+)/g, (_m, local: string, host: string) => hold(`${fakeNumber(fakeWord(local, salt), salt)}@${host}`))
  // words: only a fixed list of structure words (debited, A/c, Ref, bank names...) survive. Every other word, which
  // could be a name, a payee, a fund, an address, is swapped letter for letter. Strings of x or * (hidden digits) stay.
  t = t.replace(/[\p{L}\p{M}]+/gu, (w) => (w.length <= 1 && /[A-Za-z]/.test(w) ? w : /^[xX]+$/.test(w) || KEEP.has(w.toLowerCase()) ? w : fakeWord(w, salt)))
  // all remaining numbers (any script's digits)
  t = t.replace(/\p{Nd}[\p{Nd},]*(?:\.\p{Nd}+)?/gu, (m) => hold(fakeNumber(m, salt)))
  return t.replace(new RegExp(HELD, 'g'), (c) => kept[c.charCodeAt(0) - HELD_BASE] ?? '').slice(0, 400)
}

/** The shape of a value without the value: "1990.00" -> "4 digits, 2 decimals"; "Netflx" -> "6 letters". */
export function shapeOf(value: string): string {
  if (/^[\d,]+(\.\d+)?$/.test(value)) {
    const [whole = '', frac] = value.replace(/,/g, '').split('.')
    return `${whole.length} digit${whole.length === 1 ? '' : 's'}${frac !== undefined ? `, ${frac.length} decimal${frac.length === 1 ? '' : 's'}` : ''}`
  }
  const n = value.replace(/\s+/g, '').length
  return `${n} character${n === 1 ? '' : 's'}`
}
