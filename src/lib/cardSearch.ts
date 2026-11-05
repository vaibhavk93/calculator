import type { SavedCard } from './memory'

const digitsOf = (q: string) => q.replace(/[,₹\s]/g, '')
const isAmount = (d: string) => d !== '' && /^[\d.]+$/.test(d)

function amountsOf(card: SavedCard): string[] {
  return [card.amount, ...card.lines.map((l) => l.value)].filter((a): a is string => a !== null).map((a) => a.replace(/\.0+$/, ''))
}

/** Everything a search looks through, as one lower-case block: title, note body, tags, summary and every list line. */
const haystack = (card: SavedCard) => [card.title, card.note, card.summary, ...card.tags, ...card.lines.map((l) => l.label)].join('\n').toLowerCase()

/**
 * Matches titles, note bodies, tags, summaries, list line labels and amounts. "57,650" finds a card whose amount is 57650.
 * Several words match in any order, so "flight hdfc" finds "HDFC card" with a line "Flights"; every word must be found.
 */
export function matchesCard(card: SavedCard, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const text = haystack(card)
  if (text.includes(q)) return true
  const amounts = amountsOf(card)
  const hasAmount = (word: string) => {
    const d = digitsOf(word)
    return isAmount(d) && amounts.some((a) => a.includes(d))
  }
  if (hasAmount(q)) return true
  return q.split(/\s+/).every((w) => text.includes(w) || hasAmount(w))
}

/** The few words around `word` in `text`, on one line, with … where it was cut. Null when it is not there. */
function around(text: string, word: string): string | null {
  const flat = text.replace(/\s+/g, ' ').trim()
  const at = flat.toLowerCase().indexOf(word)
  if (at < 0) return null
  const from = Math.max(0, at - 25)
  const to = Math.min(flat.length, at + word.length + 40)
  let part = flat.slice(from, to)
  if (from > 0 && flat[from - 1] !== ' ') part = part.replace(/^\S*\s/, '') // not a half word at the front
  if (to < flat.length && flat[to] !== ' ') part = part.replace(/\s\S*$/, '') // nor at the back
  return `${from > 0 ? '…' : ''}${part.trim()}${to < flat.length ? '…' : ''}`
}

/**
 * When a search matched somewhere the list row does not already show (inside a note's body, or on a list line),
 * the few words around the match, so a result does not look like a random hit. Null when there is no query or the
 * match is in the title or tags, which the row shows anyway.
 */
export function matchSnippet(card: SavedCard, query: string): string | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const words = [q, ...q.split(/\s+/)].filter(Boolean)
  const inRow = [card.title, card.summary, ...card.tags].join('\n').toLowerCase()
  if (inRow.includes(q)) return null
  // The first word that is not already visible in the row, found in the body or on a list line.
  const places = [card.note, ...card.lines.map((l) => l.label)]
  for (const w of words) {
    if (inRow.includes(w)) continue
    for (const p of places) {
      const hit = around(p, w)
      if (hit) return hit
    }
  }
  return null
}
