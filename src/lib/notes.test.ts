import { describe, expect, it } from 'vitest'
import { MAX_NOTE_BODY, type SavedCard } from './memory'
import { bodyLimitHint, listShareText, noteShareText, notesExportText, validateNote, exportableCards } from './notes'

const fmt = { system: 'indian', decimals: 'auto' } as const
const card = (o: Partial<SavedCard>): SavedCard => ({ id: 'x', title: 'T', kind: 'text', toolId: null, inputs: null, summary: '', amount: null, lines: [], note: '', tags: [], pinned: false, createdAt: 1, updatedAt: 1, deletedAt: null, ...o })

describe('validateNote', () => {
  it('uses the typed title and shows the start of the text under it', () => {
    const r = validateNote({ title: '  Groceries ', body: 'milk\n\n  eggs   and   bread ', tags: [] })
    expect(r).toMatchObject({ errors: {}, title: 'Groceries', body: 'milk\n\n  eggs   and   bread', summary: 'milk eggs and bread' })
  })
  it('with no title, the first line is the title and the list line shows what follows it', () => {
    const r = validateNote({ title: '', body: '\n\nWifi password\nrouter is behind the TV\nname: home', tags: [] })
    expect(r.title).toBe('Wifi password')
    expect(r.summary).toBe('router is behind the TV name: home')
  })
  it('a long first line is cut for the title, and the list line keeps the whole text', () => {
    const first = 'a'.repeat(30) + ' ' + 'b'.repeat(60)
    const r = validateNote({ title: '', body: first, tags: [] })
    expect(r.title.length).toBeLessThanOrEqual(60)
    expect(r.title.endsWith('…')).toBe(true)
    expect(r.summary).toBe(first)
  })
  it('the list line is at most 120 characters', () => {
    expect(validateNote({ title: 'x', body: 'w '.repeat(500), tags: [] }).summary.length).toBe(120)
  })
  it('refuses a note with no title and no words, in words', () => {
    for (const body of ['', '   ', '\n \n']) expect(validateNote({ title: ' ', body, tags: [] }).errors.body).toBe('Write a title or some text')
    expect(validateNote({ title: 'Only a title', body: '', tags: [] }).errors).toEqual({})
  })
  it('refuses more than 10 tags', () => {
    expect(validateNote({ title: 'x', body: '', tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }).errors.tags).toBe('10 tags is the most')
  })
  it('never reads the text as maths or dates: it is kept exactly as written', () => {
    const body = '2-11-2026 call back, 50% off, 12/4 = ?, (3+4)*5'
    const r = validateNote({ title: '', body, tags: [] })
    expect(r.title).toBe(body)
    expect(r.body).toBe(body)
  })
})

describe('bodyLimitHint', () => {
  it('is quiet until the last 500 characters, then counts down, then says it was cut off', () => {
    expect(bodyLimitHint(100)).toBeNull()
    expect(bodyLimitHint(MAX_NOTE_BODY - 501)).toBeNull()
    expect(bodyLimitHint(MAX_NOTE_BODY - 10)).toBe('10 characters left.')
    expect(bodyLimitHint(MAX_NOTE_BODY)).toContain('cut off')
  })
})

describe('sharing as text', () => {
  it('a note is its title, a blank line, and the words; no footer', () => {
    expect(noteShareText({ title: 'Plan', note: '  one\ntwo ' })).toBe('Plan\n\none\ntwo')
    expect(noteShareText({ title: 'Just a title', note: '' })).toBe('Just a title')
  })
  it('a plain list says its total', () => {
    const lines = [{ id: 'a', label: 'Flights', value: '24000' }, { id: 'b', label: 'Hotel', value: '18000' }]
    expect(listShareText('Goa', lines, false, fmt)).toBe('Goa\nFlights  ₹24,000\nHotel  ₹18,000\nTotal  ₹42,000')
  })
  it('a checklist says who has paid, who was skipped, and what is left', () => {
    const lines = [
      { id: 'a', label: 'Amit', value: '1000', done: true },
      { id: 'b', label: 'Ravi', value: '500' },
      { id: 'c', label: 'Sam', value: '300', skip: true },
    ]
    expect(listShareText('Dinner', lines, true, fmt)).toBe(
      ['Dinner', '✔ Amit  ₹1,000', '☐ Ravi  ₹500', '✖ Sam  ₹300  (skipped)', 'Collected ₹1,000 of ₹1,500', 'Left ₹500', 'Skipped 1, not counted'].join('\n'),
    )
  })
})

describe('exporting every note', () => {
  const cards = [
    card({ id: '1', title: 'Old note', note: 'body one', updatedAt: 1 }),
    card({ id: '2', title: 'Pinned note', note: 'line a\nline b', tags: ['Home', 'Urgent'], pinned: true, updatedAt: 0 }),
    card({ id: '3', title: 'Trashed', note: 'gone', deletedAt: 5 }),
    card({ id: '4', title: 'A task', kind: 'task' }),
    card({ id: '5', title: 'Goa trip', kind: 'tape', lines: [{ id: 'l', label: 'Flights', value: '100' }], note: '', updatedAt: 3 }),
    card({ id: '6', title: 'HDFC EMI', kind: 'tool', toolId: 'emi', summary: 'EMI ₹8,678', note: 'my loan', updatedAt: 2 }),
  ]
  it('leaves out Trash and to-dos, puts pinned first and then newest', () => {
    expect(exportableCards(cards).map((c) => c.id)).toEqual(['2', '5', '6', '1'])
  })
  it('writes one plain text file that says what is and is not in it', () => {
    const t = notesExportText(cards, fmt, new Date(2026, 10, 4).getTime())
    expect(t.startsWith('Calc notes, exported 4 Nov 2026\n4 items: notes, lists and saved calculations. To-dos are not included.')).toBe(true)
    expect(t).toContain('Pinned note\nTags: Home, Urgent\n\nline a\nline b')
    expect(t).toContain('Goa trip\nFlights  ₹100\nTotal  ₹100')
    expect(t).toContain('HDFC EMI\nEMI ₹8,678\nmy loan')
    expect(t).not.toContain('Trashed')
    expect(t).not.toContain('A task')
    expect(t.endsWith('\n')).toBe(true)
  })
  it('an empty library still gives a readable file', () => {
    expect(notesExportText([], fmt, new Date(2026, 10, 4).getTime())).toContain('0 items')
  })
})
