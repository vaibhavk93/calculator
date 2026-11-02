/**
 * Reads a number out of whatever was on the clipboard: "₹1,50,000.50",
 * "$ 2,500", "(500)", "-12". Returns a plain decimal string, or null when it
 * isn't clearly a single number.
 */
export function parseClipboardNumber(text: string): string | null {
  if (text.length > 60) return null

  let s = text.trim().replace(/[\s  ,₹$€£]/g, '').replace(/[−–]/g, '-')

  // Accounting style: (500) means -500.
  const paren = /^\((.*)\)$/.exec(s)
  if (paren) s = '-' + (paren[1] ?? '')

  const m = /^(-?)(\d+\.?\d*|\.\d+)$/.exec(s)
  if (!m) return null

  const sign = m[1] ?? ''
  let body = m[2] ?? ''
  if (body.startsWith('.')) body = '0' + body
  if (body.endsWith('.')) body = body.slice(0, -1)
  // Trim redundant leading zeros but keep "0" and "0.5".
  body = body.replace(/^0+(?=\d)/, '')
  return sign + body
}
