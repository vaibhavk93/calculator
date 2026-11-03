import { categoryName, instrumentLabel, modeLabel, monthKey, shiftMonth, type BudgetData, type BudgetExpense } from './budget'

/** Which entries to export. "3 months" is this month and the two before it. */
export type ExportRange = 'month' | '3months' | 'year' | 'all'
export const EXPORT_RANGES: { id: ExportRange; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: '3months', label: 'Last 3 months' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All' },
]

export const CSV_HEADER = ['Date', 'Amount', 'Category', 'Payment mode', 'Paid from', 'Note', 'Type'] as const

/**
 * One text cell, RFC 4180: wrapped in quotes when it holds a comma, quote, CR or LF, with inner quotes doubled.
 * A cell a spreadsheet would run as a formula (starts with = + - @, or a tab or CR) gets a leading apostrophe first.
 */
export function csvCell(text: string): string {
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

const TYPE: Record<string, string> = { cardBill: 'card bill', transfer: 'transfer' }

/** Live entries in the range, oldest first (same date: stored order), as CSV text with a BOM so Excel reads rupee signs and accents. */
export function buildExpensesCsv(budget: BudgetData, range: ExportRange, today: Date = new Date()): string {
  const thisMonth = monthKey(today)
  const bounds: Record<ExportRange, [string, string] | null> = {
    month: [thisMonth, thisMonth],
    '3months': [shiftMonth(thisMonth, -2), thisMonth],
    year: [`${today.getFullYear()}-01`, `${today.getFullYear()}-12`],
    all: null,
  }
  const b = bounds[range]
  const inRange = (e: BudgetExpense) => e.deletedAt === null && (b === null || (e.date.slice(0, 7) >= b[0] && e.date.slice(0, 7) <= b[1]))
  const rows = budget.expenses.filter(inRange).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))

  const lines = [CSV_HEADER.join(',')]
  for (const e of rows) {
    const inst = e.instrumentId === null ? undefined : budget.instruments.find((i) => i.id === e.instrumentId)
    lines.push(
      [
        e.date,
        e.refund ? `-${e.amount}` : e.amount, // a validated plain decimal, never text, so it is not escaped. A refund is negative so a SUM adds up right.
        csvCell(e.settlement ? '' : categoryName(budget, e.categoryId).replace(' › ', ' > ')),
        csvCell(e.mode ? modeLabel(e.mode) : ''),
        csvCell(inst ? instrumentLabel(inst) : ''),
        csvCell(e.note),
        e.settlement ? TYPE[e.settlement] ?? 'spending' : e.refund ? 'refund' : 'spending',
      ].join(','),
    )
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}

export const expensesCsvFilename = (range: ExportRange, today: Date = new Date()): string =>
  `calc-expenses-${range}-${monthKey(today)}-${String(today.getDate()).padStart(2, '0')}.csv`
