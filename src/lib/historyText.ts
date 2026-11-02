import { formatExpression, formatPlain, type FormatOptions } from './format'

/** The text a shared or copied history row carries: "expression = result". Plain, no footer. */
export function historyShareText(h: { expression: string; result: string }, fmt: FormatOptions): string {
  return `${formatExpression(h.expression, fmt.system)} = ${formatPlain(h.result, fmt)}`
}
