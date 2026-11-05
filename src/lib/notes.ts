import { D, type Dec } from '../engine'
import type { FormatOptions } from './format'
import { MAX_NOTE_BODY, MAX_NOTE_TAGS, type SavedCard, type TapeLine } from './memory'
import { shortDate } from './tasks'
import { listProgress, tapeTotal } from './tape'
import { formatCell } from './toolFormat'

/**
 * Plain notes, as plain data. A note is a SavedCard of kind 'text' whose body is the card's `note`.
 * The text is only ever text: nothing in it is read as maths (docs/THE-PLAN.md section 9).
 */

export const NOTE_EMPTY_ERROR = 'Write a title or some text'
const TITLE_FROM_BODY = 60
const SUMMARY_LENGTH = 120

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim()

export interface NoteChecked {
  errors: { body?: string; tags?: string }
  /** The title to save: the one typed, or else the first line of the text. */
  title: string
  body: string
  /** The one line shown under the title in the list. */
  summary: string
}

/**
 * Checks a note before it is saved. A title is optional: with none, the first line of the text is the title, and the
 * list line shows what follows it (so the first line is not said twice).
 */
export function validateNote(input: { title: string; body: string; tags: string[] }): NoteChecked {
  const body = input.body.trim()
  const typed = input.title.trim()
  const errors: NoteChecked['errors'] = {}
  if (!typed && !body) errors.body = NOTE_EMPTY_ERROR
  if (input.tags.length > MAX_NOTE_TAGS) errors.tags = `${MAX_NOTE_TAGS} tags is the most`
  if (typed) return { errors, title: typed, body, summary: collapse(body).slice(0, SUMMARY_LENGTH) }

  const lines = body.split(/\r?\n/)
  const at = lines.findIndex((l) => l.trim() !== '')
  const first = lines[at]?.trim() ?? ''
  if (first.length <= TITLE_FROM_BODY) return { errors, title: first, body, summary: collapse(lines.slice(at + 1).join(' ')).slice(0, SUMMARY_LENGTH) }
  // A long first line is cut for the title, so the list line carries the whole text rather than losing the end.
  return { errors, title: `${first.slice(0, TITLE_FROM_BODY - 1).trimEnd()}…`, body, summary: collapse(body).slice(0, SUMMARY_LENGTH) }
}

/** The words that say how far a note is from its limit, or null while there is plenty of room. */
export function bodyLimitHint(length: number): string | null {
  if (length >= MAX_NOTE_BODY) return `That is the limit, ${MAX_NOTE_BODY.toLocaleString('en-IN')} characters. Anything more was cut off.`
  if (length >= MAX_NOTE_BODY - 500) return `${(MAX_NOTE_BODY - length).toLocaleString('en-IN')} characters left.`
  return null
}

/** A note as the text people paste into a chat: the title, then the words. No footer; it is their own writing. */
export function noteShareText(card: { title: string; note: string }): string {
  return card.note.trim() ? `${card.title}\n\n${card.note.trim()}` : card.title
}

/**
 * A list as text. For a checklist it says who has paid, so it can go straight into a group chat.
 * One place for this, so "Copy as text" and "Share" on a list cannot drift apart.
 */
export function listShareText(title: string, lines: TapeLine[], checklist: boolean, opts: FormatOptions): string {
  const money = (v: string | Dec) => formatCell(new D(v), 'money', opts)
  const mark = (l: TapeLine) => (checklist ? (l.done ? '✔ ' : l.skip ? '✖ ' : '☐ ') : '')
  const body = lines.map((l) => `${mark(l)}${l.label || '—'}  ${money(l.value)}${checklist && l.skip && !l.done ? '  (skipped)' : ''}`)
  const total = tapeTotal(lines)
  const p = listProgress(lines)
  const foot = checklist
    ? [`Collected ${money(p.doneAmount)} of ${money(total)}`, `Left ${money(p.leftAmount)}`, ...(p.skipped > 0 ? [`Skipped ${p.skipped}, not counted`] : [])]
    : [`Total  ${money(total)}`]
  return [title, ...body, ...foot].join('\n')
}

/** Notes, lists and saved calculations that are not in Trash, pinned first and then newest, as the Notes screen shows them. */
export function exportableCards(cards: SavedCard[]): SavedCard[] {
  return cards.filter((c) => c.deletedAt === null && c.kind !== 'task').sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
}

/**
 * Every note, list and saved calculation as one plain text file. To-dos are left out (they carry dates and ticks that
 * need the full backup); the header says what is in the file, so it never looks like everything.
 */
export function notesExportText(cards: SavedCard[], opts: FormatOptions, now: number): string {
  const items = exportableCards(cards)
  const head = `Calc notes, exported ${shortDate(now)}\n${items.length} ${items.length === 1 ? 'item' : 'items'}: notes, lists and saved calculations. To-dos are not included.`
  const body = items.map((c) => {
    const tags = c.tags.length ? `Tags: ${c.tags.join(', ')}` : ''
    if (c.kind === 'text') {
      const note = c.note.trim()
      return [c.title, ...(tags ? [tags] : []), ...(note ? ['', note] : [])].join('\n')
    }
    if (c.kind === 'tape') return [listShareText(c.title, c.lines, !!c.checklist, opts), tags].filter(Boolean).join('\n')
    return [c.title, c.summary, tags, c.note.trim()].filter(Boolean).join('\n')
  })
  return [head, ...body].join('\n\n----------\n\n') + '\n'
}
