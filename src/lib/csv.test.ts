import { describe, expect, it } from 'vitest'
import { buildExpensesCsv, csvCell, expensesCsvFilename } from './csv'
import type { BudgetData, BudgetExpense } from './budget'

const e = (id: string, date: string, amount: string, over: Partial<BudgetExpense> = {}): BudgetExpense => ({
  id, date, amount, categoryId: null, mode: null, instrumentId: null, note: '', deletedAt: null, ...over,
})
const budget = (expenses: BudgetExpense[]): BudgetData => ({
  overall: null,
  categories: [
    { id: 'food', name: 'Food', limit: null, parentId: null, deletedAt: null },
    { id: 'sw', name: 'Swiggy', limit: null, parentId: 'food', deletedAt: null },
  ],
  instruments: [{ id: 'cc', name: 'HDFC', kind: 'credit', network: 'visa', bank: 'HDFC', last4: '1234', rewardNote: '', deletedAt: null }],
  expenses,
})
const today = new Date(2026, 10, 15) // 15 Nov 2026

describe('csvCell', () => {
  it('leaves plain text alone', () => expect(csvCell('lunch')).toBe('lunch'))
  it('quotes commas, newlines and doubles quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
  })
  it('defuses spreadsheet formulas with a leading apostrophe', () => {
    for (const c of ['=SUM(A1)', '+1', '-1', '@x']) expect(csvCell(c)).toBe(`'${c}`)
    expect(csvCell('=1,2')).toBe(`"'=1,2"`)
  })
})

describe('buildExpensesCsv', () => {
  const all = budget([
    e('1', '2026-11-03', '250.50', { categoryId: 'sw', mode: 'credit', instrumentId: 'cc', note: 'dinner, with "friends"' }),
    e('2', '2026-11-01', '5000', { settlement: 'cardBill', instrumentId: 'cc' }),
    e('3', '2026-09-10', '99', { note: '=HYPERLINK("x")' }),
    e('4', '2026-02-10', '10', { categoryId: 'food', mode: 'cash' }),
    e('5', '2025-12-31', '7'),
    e('6', '2026-11-04', '1', { deletedAt: 1 }),
  ])
  it('starts with a BOM and the header, ends rows with CRLF', () => {
    const t = buildExpensesCsv(all, 'all', today)
    expect(t.startsWith('﻿Date,Amount,Category,Payment mode,Paid from,Note,Type\r\n')).toBe(true)
    expect(t.endsWith('\r\n')).toBe(true)
  })
  it('writes category as Parent > Sub, the card, quoted notes and the type', () => {
    const lines = buildExpensesCsv(all, 'month', today).split('\r\n')
    expect(lines[1]).toBe('2026-11-01,5000,,,HDFC ••1234,,card bill')
    expect(lines[2]).toBe('2026-11-03,250.50,Food > Swiggy,Credit card,HDFC ••1234,"dinner, with ""friends""",spending')
    expect(lines).toHaveLength(4) // header, 2 rows, trailing empty after the final CRLF
  })
  it('picks the date range and leaves out deleted entries', () => {
    const n = (r: Parameters<typeof buildExpensesCsv>[1]) => buildExpensesCsv(all, r, today).split('\r\n').length - 2
    expect(n('month')).toBe(2)
    expect(n('3months')).toBe(3) // Sep, Oct, Nov
    expect(n('year')).toBe(4)
    expect(n('all')).toBe(5)
  })
  it('defuses a formula in a note', () => {
    expect(buildExpensesCsv(all, 'all', today)).toContain(`"'=HYPERLINK(""x"")"`)
  })
  it('an empty budget is just the header', () => {
    expect(buildExpensesCsv(budget([]), 'all', today)).toBe('﻿Date,Amount,Category,Payment mode,Paid from,Note,Type\r\n')
  })
  it('names the file by range and day', () => expect(expensesCsvFilename('year', today)).toBe('calc-expenses-year-2026-11-15.csv'))
})
