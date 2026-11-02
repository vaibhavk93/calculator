import { D } from '../engine'
import { MINUS, formatDecimal, type FormatOptions } from './format'
import type { Cell, Fmt } from './tool'

export const RUPEE = '₹'

/**
 * Turns a result cell into what the user reads.
 * Money and percentages show 2 places unless the user fixed the decimals in settings,
 * so 8.5% never reads as 9%.
 */
export function formatCell(cell: Cell, fmt: Fmt | undefined, opts: FormatOptions): string {
  if (typeof cell === 'string') return cell
  const kind: Fmt = fmt ?? 'number'
  if (kind === 'text') return cell.toFixed()
  if (!cell.isFinite()) return '—'

  const places = opts.decimals === 'auto' ? 2 : opts.decimals
  switch (kind) {
    case 'money': {
      // The sign leads ("−₹1,000"), and a value that rounds to zero carries no sign.
      const negative = !cell.toDecimalPlaces(places, D.ROUND_HALF_UP).isZero() && cell.isNegative()
      return (negative ? MINUS : '') + RUPEE + formatDecimal(cell.abs(), { ...opts, decimals: places })
    }
    case 'percent':
      return formatDecimal(cell, { ...opts, decimals: places }) + '%'
    case 'int':
      return formatDecimal(cell, { ...opts, decimals: 0 })
    default:
      return formatDecimal(cell, opts)
  }
}
