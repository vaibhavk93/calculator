import type { SavedCard } from './memory'

/** Matches titles, notes, tags, summaries, tape labels and amounts. "57,650" finds a card whose amount is 57650. */
export function matchesCard(card: SavedCard, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const digits = q.replace(/[,₹\s]/g, '')
  const text = [card.title, card.note, card.summary, ...card.tags, ...card.lines.map((l) => l.label)].join('\n').toLowerCase()
  if (text.includes(q)) return true
  const amounts = [card.amount, ...card.lines.map((l) => l.value)]
  return digits !== '' && /^[\d.]+$/.test(digits) && amounts.some((a) => a !== null && a.replace(/\.0+$/, '').includes(digits))
}
